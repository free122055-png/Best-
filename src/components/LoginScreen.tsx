import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, addDoc, limit } from 'firebase/firestore';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { User, AppConfig } from '../types';
import { ShieldCheck, UserPlus, LogIn, Mail, KeyRound, Globe, Lock, ArrowRight, AlertTriangle, CheckCircle2, User as UserIcon, Sparkles, Moon, Sun, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BNBLogo } from './BNBLogo';
import { normalizeMemberId, normalizePhoneNumber, saveUserToLocalBackup, convertBengaliToEnglishDigits, getNextSequentialMemberId, getClientDeviceId, getDeviceFingerprint, findUserInFirestoreByPhone } from '../lib/memberUtils';
import { LegacyEmailMigrationModal } from './LegacyEmailMigrationModal';
import ForgotPasswordModal from './ForgotPasswordModal';
import { sendEmailOtpDirect } from '../lib/emailOtpService';
import { apiUrl } from '../config/api';

interface LoginScreenProps {
  authUid?: string;
  onLoginSuccess: (user: User) => void;
  initialRegistering?: boolean;
  appConfig?: AppConfig | null;
  appLanguage?: string;
  onLanguageChange?: (lang: 'bn' | 'en') => void;
  darkMode?: boolean;
  onThemeToggle?: () => void;
  onOpenAdminPin?: () => void;
}

export default function LoginScreen({
  authUid,
  onLoginSuccess,
  initialRegistering = false,
  appConfig,
  appLanguage = 'bn',
  onLanguageChange,
  darkMode = false,
  onThemeToggle,
  onOpenAdminPin
}: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(initialRegistering);
  const [step, setStep] = useState<'info' | 'verify-otp' | 'register-details'>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form states
  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('amb_saved_login_email') || '';
    }
    return '';
  });
  const [otpInput, setOtpInput] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [sentOtpCode, setSentOtpCode] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<{
    deliveredTo?: string;
    isOwnerFallback?: boolean;
    channel?: 'phone' | 'email';
    targetPhone?: string;
    targetEmail?: string;
  } | null>(null);

  // Registration states
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPin, setRegPin] = useState('');

  // Old account email recovery / migration popup state (controlled by Admin switch)
  const isMigrationActive = appConfig?.emailMigrationPopupEnabled === true;
  const [showMigrationModal, setShowMigrationModal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem('amb_migration_popup_dismissed');
      return isMigrationActive && !dismissed;
    }
    return isMigrationActive;
  });

  useEffect(() => {
    if (appConfig?.emailMigrationPopupEnabled) {
      const dismissed = sessionStorage.getItem('amb_migration_popup_dismissed');
      if (!dismissed) {
        setShowMigrationModal(true);
      }
    }
  }, [appConfig?.emailMigrationPopupEnabled]);

  // Helper to locate user across phone formats, account IDs, emails, and direct doc IDs
  const locateUser = async (rawInput: string): Promise<User | null> => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) return null;

    const cleanInput = trimmedInput.toLowerCase();
    const isEmail = cleanInput.includes('@');
    const cleanDigits = convertBengaliToEnglishDigits(trimmedInput).replace(/\D/g, '');

    // 1. Check local storage cached user
    const lastUserRaw = localStorage.getItem('amb_last_user');
    if (lastUserRaw) {
      try {
        const cached = JSON.parse(lastUserRaw);
        if (
          (isEmail && cached.email?.toLowerCase() === cleanInput) ||
          (cached.memberId?.toUpperCase() === trimmedInput.toUpperCase()) ||
          (cached.memberId?.toLowerCase() === cleanInput) ||
          (cleanDigits.length >= 10 && cached.phone?.replace(/\D/g, '').endsWith(cleanDigits.slice(-10)))
        ) {
          return cached;
        }
      } catch (e) {}
    }

    if (!db) return null;

    // 2. Direct email queries
    if (isEmail) {
      try {
        const qEmail = query(collection(db, 'users'), where('email', '==', cleanInput), limit(1));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          return { uid: snapEmail.docs[0].id, ...(snapEmail.docs[0].data() as any) } as User;
        }
        const qEmailRaw = query(collection(db, 'users'), where('email', '==', trimmedInput), limit(1));
        const snapEmailRaw = await getDocs(qEmailRaw);
        if (!snapEmailRaw.empty) {
          return { uid: snapEmailRaw.docs[0].id, ...(snapEmailRaw.docs[0].data() as any) } as User;
        }
      } catch (e) {}
    }

    // 3. Member ID and Account Number queries
    const upperInput = trimmedInput.toUpperCase();
    const queriesToTry = [
      query(collection(db, 'users'), where('memberId', '==', upperInput), limit(1)),
      query(collection(db, 'users'), where('memberId', '==', trimmedInput), limit(1)),
      query(collection(db, 'users'), where('memberId', '==', cleanInput), limit(1)),
      query(collection(db, 'users'), where('accountNumber', '==', upperInput), limit(1)),
      query(collection(db, 'users'), where('accountNumber', '==', trimmedInput), limit(1)),
      query(collection(db, 'users'), where('accountNo', '==', upperInput), limit(1))
    ];

    if (cleanDigits.length > 0 && cleanDigits.length <= 8) {
      const paddedId = `BNB${cleanDigits.padStart(8, '0')}`;
      queriesToTry.push(query(collection(db, 'users'), where('memberId', '==', paddedId), limit(1)));
    }

    if (cleanDigits.length >= 10) {
      const last10 = cleanDigits.slice(-10);
      queriesToTry.push(query(collection(db, 'users'), where('phone', '==', `+880${last10}`), limit(1)));
      queriesToTry.push(query(collection(db, 'users'), where('phone', '==', `0${last10}`), limit(1)));
      queriesToTry.push(query(collection(db, 'users'), where('phone', '==', cleanDigits), limit(1)));
      queriesToTry.push(query(collection(db, 'users'), where('phone', '==', `+${cleanDigits}`), limit(1)));
    }

    try {
      const results = await Promise.all(queriesToTry.map(q => getDocs(q).catch(() => null)));
      for (const res of results) {
        if (res && !res.empty) {
          return { uid: res.docs[0].id, ...(res.docs[0].data() as any) } as User;
        }
      }
    } catch (e) {}

    // 4. Try robust findUserInFirestoreByPhone helper (checks secret admin phone & all normalized patterns)
    try {
      const foundByPhone = await findUserInFirestoreByPhone(trimmedInput);
      if (foundByPhone?.user) {
        return foundByPhone.user;
      }
    } catch (e) {}

    // 5. Direct doc ID lookup in 'users'
    try {
      const directDoc = await getDoc(doc(db, 'users', trimmedInput));
      if (directDoc.exists()) {
        return { uid: directDoc.id, ...(directDoc.data() as any) } as User;
      }
    } catch (e) {}

    return null;
  };

  // Handle Send OTP for Login (Mandatory Multi-Channel: Direct Native Resend + Real-time Firestore Queue + Phone SIM SMS)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    const rawInput = email.trim();
    if (!rawInput) {
      setError('অনুগ্রহ করে আপনার অ্যাকাউন্ট নম্বর, মোবাইল নম্বর অথবা ইমেইল প্রদান করুন।');
      return;
    }

    setLoading(true);

    try {
      const targetUser = await locateUser(rawInput);
      if (!targetUser) {
        setError('প্রদত্ত তথ্যে কোনো অ্যাকাউন্ট পাওয়া যায়নি। সঠিক অ্যাকাউন্ট নম্বর (উদাঃ BNB00000028), মোবাইল নম্বর অথবা ইমেইল দিন।');
        setLoading(false);
        return;
      }

      setFoundUser(targetUser);

      const userDisplayName = targetUser.name || 'সম্মানিত সদস্য';
      const userPhone = targetUser.phone || '';
      const userEmail = targetUser.email || (rawInput.includes('@') ? rawInput.trim().toLowerCase() : '');

      // If user has NO registered email in profile
      if (!userEmail) {
        setLoading(false);
        setError('আপনার অ্যাকাউন্টে কোনো ইমেইল যুক্ত পাওয়া যায়নি। ওটিপি গ্রহণের জন্য অনুগ্রহ করে আপনার ইমেইল দিয়ে চেষ্টা করুন অথবা নিচে "পাসওয়ার্ড ভুলে গেছেন? রিসেট করুন" বাটনে ক্লিক করুন।');
        return;
      }

      const targetEmail = userEmail.trim().toLowerCase();

      // Format phone for Bangladesh or international standards
      let formattedPhone = '';
      if (userPhone) {
        let rawDigits = convertBengaliToEnglishDigits(userPhone).replace(/\D/g, '');
        if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
          formattedPhone = `+88${rawDigits}`;
        } else if (rawDigits.length === 10) {
          formattedPhone = `+880${rawDigits}`;
        } else if (rawDigits.startsWith('880')) {
          formattedPhone = `+${rawDigits}`;
        } else if (rawDigits.startsWith('+')) {
          formattedPhone = rawDigits;
        } else if (rawDigits) {
          formattedPhone = `+88${rawDigits}`;
        }
      }

      // 1. Generate authoritative 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setSentOtpCode(generatedOtp);

      // Mask email for privacy display
      const maskEmail = (em: string) => {
        const parts = em.split('@');
        if (parts.length !== 2) return em;
        const namePart = parts[0];
        const masked = namePart.length > 2 ? `${namePart.slice(0, 2)}••••${namePart.slice(-1)}` : `${namePart}•`;
        return `${masked}@${parts[1]}`;
      };
      const displayEmail = maskEmail(targetEmail);

      // 2. Multi-channel authoritative OTP dispatch (Awaited for 100% reliability)
      await sendEmailOtpDirect({
        email: targetEmail,
        otp: generatedOtp,
        userName: userDisplayName,
        phone: formattedPhone || userPhone,
        memberId: targetUser.memberId || rawInput,
        userId: targetUser.uid,
        reason: 'login'
      });

      // 4. Background Firebase Phone Auth SIM SMS attempt if phone exists (non-blocking)
      if (formattedPhone) {
        if (typeof window !== 'undefined') {
          try {
            if (!(window as any).recaptchaVerifier) {
              (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
                callback: () => {}
              });
            }
            const appVerifier = (window as any).recaptchaVerifier;
            signInWithPhoneNumber(auth, formattedPhone, appVerifier).then(confirmation => {
              setConfirmationResult(confirmation);
            }).catch(() => {});
          } catch (e) {}
        }
      }

      // 5. Update UI state & prompt user instantly
      setDeliveryInfo({
        deliveredTo: displayEmail,
        channel: 'email',
        targetPhone: formattedPhone,
        targetEmail: targetEmail
      });

      setSuccessMessage(`আপনার নিবন্ধিত ইমেইলে (${displayEmail}) ৬ সংখ্যার ওটিপি কোড পাঠানো হয়েছে। ইনবক্স অথবা স্প্যাম ফোল্ডার চেক করুন।`);

      setStep('verify-otp');
      if (typeof window !== 'undefined') {
        localStorage.setItem('amb_saved_login_email', rawInput);
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Login error:', err);
      setError('লগইন প্রসেসে ত্রুটি হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
      setLoading(false);
    }
  };

  // Execute actual login with unique activeSessionToken for single-device session control
  const executeLogin = async (userToLogin: User) => {
    const newSessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    
    const userWithToken = {
      ...userToLogin,
      activeSessionToken: newSessionToken,
      activeSessionDeviceId: getClientDeviceId()
    };

    if (db && userToLogin.uid) {
      try {
        await updateDoc(doc(db, 'users', userToLogin.uid), {
          activeSessionToken: newSessionToken,
          activeSessionDeviceId: getClientDeviceId(),
          lastLoginAt: new Date().toISOString(),
          isLoggedIn: true
        }).catch(() => {});
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('amb_user_uid', userWithToken.uid);
      localStorage.setItem('amb_user_phone', userWithToken.phone || '');
      localStorage.setItem('amb_user_name', userWithToken.name || 'সদস্য');
      localStorage.setItem('amb_user_role', userWithToken.role || 'user');
      localStorage.setItem('bnb_user_member_id', userWithToken.memberId || 'BNB00000000');
      localStorage.setItem('amb_active_session_token', newSessionToken);
      localStorage.setItem('amb_last_user', JSON.stringify(userWithToken));
      sessionStorage.setItem('amb_session_unlocked', 'true');
    }
    onLoginSuccess(userWithToken);
  };

  // Verify OTP (Dual check: Email OTP code OR Firebase Phone Auth SMS confirmation)
  const handleVerifyOtp = async (e?: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    const code = directCode || otpInput.trim();
    if (!code) {
      setError('অনুগ্রহ করে সিমে বা ইমেইলে আসা ৬ সংখ্যার ওটিপি কোডটি লিখুন।');
      return;
    }

    if (code.length !== 6) {
      setError('ওটিপি কোড অবশ্যই ৬ সংখ্যার হতে হবে।');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let isVerified = false;

      // 1. Primary check against generated session/email OTP code
      if (sentOtpCode && code === sentOtpCode) {
        isVerified = true;
      }

      // 2. If not matched, try Firebase Phone Auth confirmation
      if (!isVerified && confirmationResult) {
        try {
          await confirmationResult.confirm(code);
          isVerified = true;
        } catch (fbConfirmErr) {
          console.warn('Firebase SMS verification error:', fbConfirmErr);
        }
      }

      if (isVerified) {
        if (foundUser) {
          executeLogin(foundUser);
        } else {
          setError('ইউজার সেশন পাওয়া যায়নি।');
        }
      } else {
        setError('প্রদত্ত ওটিপি কোডটি সঠিক নয়। অনুগ্রহ করে আপনার সিমে বা ইমেইলে আসা কোডটি পুনরায় চেক করুন।');
      }
    } catch (verifyErr: any) {
      console.error('OTP Verification Error:', verifyErr);
      setError(verifyErr?.message || 'ওটিপি যাচাইয়ে ত্রুটি হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  // Registration handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!regName.trim() || !email.trim() || !regPhone.trim() || !regPassword.trim() || !regPin.trim()) {
      setError('অনুগ্রহ করে সকল তারকাচিহ্নিত (*) তথ্য সঠিকভাবে পূরণ করুন।');
      return;
    }

    if (regPin.trim().length !== 4) {
      setError('সিকিউরিটি পিন অবশ্যই ৪ সংখ্যার হতে হবে।');
      return;
    }

    setLoading(true);

    try {
      const cleanPhoneDigits = convertBengaliToEnglishDigits(regPhone).replace(/\D/g, '');
      const standardPhone = cleanPhoneDigits.length === 11 && cleanPhoneDigits.startsWith('0') ? `+88${cleanPhoneDigits}` : cleanPhoneDigits;
      const cleanEmail = email.trim().toLowerCase();

      // Check if phone or email already exists
      if (db) {
        const phoneQ = query(collection(db, 'users'), where('phone', '==', standardPhone), limit(1));
        const phoneSnap = await getDocs(phoneQ);
        if (!phoneSnap.empty) {
          setError('এই মোবাইল নম্বর দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।');
          setLoading(false);
          return;
        }

        const emailQ = query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1));
        const emailSnap = await getDocs(emailQ);
        if (!emailSnap.empty) {
          setError('এই ইমেইল ঠিকানা দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।');
          setLoading(false);
          return;
        }
      }

      const newMemberId = await getNextSequentialMemberId();
      const newUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newUser: User = {
        uid: newUid,
        name: regName.trim(),
        email: cleanEmail,
        phone: standardPhone,
        memberId: newMemberId,
        role: 'user',
        balance: 0,
        mainBalance: 0,
        savings: 0,
        telecomBalance: 0,
        superShopBalance: 0,
        dueLoan: 0,
        password: regPassword.trim(),
        pin: regPin.trim(),
        status: 'active',
        samityStatus: 'none',
        createdAt: new Date().toISOString()
      };

      if (db) {
        await setDoc(doc(db, 'users', newUid), newUser);
      }

      saveUserToLocalBackup(newUser);
      executeLogin(newUser);
    } catch (err: any) {
      console.error(err);
      setError(`অ্যাকাউন্ট তৈরিতে সমস্যা হয়েছে: ${err?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePasteOtp = async () => {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        const digits = text.replace(/\D/g, '').slice(0, 6);
        if (digits) {
          setOtpInput(digits);
          if (digits.length === 6) {
            handleVerifyOtp(undefined, digits);
          }
        }
      }
    } catch (e) {}
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col justify-between relative overflow-x-hidden font-sans select-none" id="login-container">
      {/* Firebase Phone Auth Invisible Recaptcha Mount Point */}
      <div id="recaptcha-container" className="hidden" />

      {/* 1. TOP HEADER SECTION WITH GREEN GRADIENT & WAVES */}
      <div className="relative w-full bg-gradient-to-b from-[#094828] via-[#0B5C33] to-[#0D6B3C] text-white pt-12 sm:pt-14 pb-12 sm:pb-16 px-4 overflow-hidden shadow-lg" style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top, 2.5rem))' }}>
        {/* Subtle decorative background silhouettes / landscape */}
        <div className="absolute inset-0 opacity-15 pointer-events-none mix-blend-overlay">
          <svg className="w-full h-full object-cover" viewBox="0 0 800 400" fill="currentColor" preserveAspectRatio="none">
            <path d="M0,280 L40,260 L80,280 L120,250 L160,270 L200,240 L240,270 L280,230 L320,260 L360,240 L400,260 L440,250 L480,270 L520,240 L560,260 L600,230 L640,270 L680,250 L720,270 L760,240 L800,260 L800,400 L0,400 Z" />
            <rect x="30" y="160" width="35" height="120" />
            <rect x="75" y="140" width="40" height="140" />
            <polygon points="95,90 80,140 110,140" />
            <rect x="130" y="170" width="30" height="110" />
            <rect x="180" y="130" width="45" height="150" />
            <rect x="240" y="150" width="35" height="130" />
            <rect x="290" y="180" width="40" height="100" />
            <rect x="350" y="140" width="50" height="140" />
            <polygon points="375,100 355,140 395,140" />
          </svg>
        </div>

        {/* Top Control Bar: Left BNB Security Gateway pill, Right English & Dark buttons */}
        <div className="max-w-md mx-auto w-full flex items-center justify-between relative z-20 mb-4 sm:mb-6">
          {/* Left: BNB সিকিউরিটি গেটওয়ে pill */}
          <div 
            onClick={onOpenAdminPin}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-white/95 text-emerald-900 border border-emerald-400/30 shadow-xs cursor-pointer active:scale-95 transition"
            title="সিকিউরিটি গেটওয়ে"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] sm:text-xs font-black tracking-tight">BNB সিকিউরিটি গেটওয়ে</span>
          </div>

          {/* Right: English & Dark toggle buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onLanguageChange && onLanguageChange(appLanguage === 'bn' ? 'en' : 'bn')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-slate-800 border border-slate-200/90 text-[11px] sm:text-xs font-black shadow-xs hover:bg-slate-50 active:scale-95 transition cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span>{appLanguage === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>
            <button
              type="button"
              onClick={() => onThemeToggle && onThemeToggle()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-slate-800 border border-slate-200/90 text-[11px] sm:text-xs font-black shadow-xs hover:bg-slate-50 active:scale-95 transition cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  <span>Dark</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Center: Official BNB Emblem inside Black Square Frame + Brand Typography */}
        <div className="max-w-md mx-auto w-full flex flex-col items-center justify-center text-center relative z-20 mt-1">
          {/* Black Square Logo Box */}
          <div className="w-[78px] h-[78px] sm:w-[86px] sm:h-[86px] bg-black border border-neutral-700/80 rounded-xl shadow-xl flex items-center justify-center p-2 mb-3">
            {appConfig?.logoUrl ? (
              <img
                src={appConfig.logoUrl}
                alt="BNB Logo"
                className="w-full h-full object-contain filter drop-shadow-md"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BNBLogo size={58} variant="white" />
              </div>
            )}
          </div>

          {/* Typography: BNB BUSINESS NETWORK BANGLADESH */}
          <div className="space-y-0.5">
            <h1 className="flex items-center justify-center text-white drop-shadow-md leading-none">
              <span className="font-serif italic font-extrabold text-2xl sm:text-3xl text-white mr-1.5">
                BNB
              </span>
              <span className="font-sans font-black text-lg sm:text-xl tracking-wider text-white uppercase">
                BUSINESS NETWORK
              </span>
            </h1>
            <div className="text-emerald-200 text-xs sm:text-[13px] font-black tracking-[0.38em] text-center uppercase drop-shadow-sm mt-0.5">
              BANGLADESH
            </div>
          </div>

          {/* Green Bordered Security Capsule: BNB সিকিউরিটি মেম্বার গেটওয়ে */}
          <div className="mt-3.5 inline-flex items-center gap-2 px-5 py-1.5 rounded-full border-2 border-emerald-500/85 bg-black/45 backdrop-blur-xs shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></span>
            <span className="text-white text-xs sm:text-sm font-black tracking-wide">
              BNB সিকিউরিটি মেম্বার গেটওয়ে
            </span>
          </div>
        </div>

        {/* Organic Multi-Layered Curved Waves at the bottom of the Header */}
        <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none z-10 pointer-events-none">
          <svg 
            className="relative block w-full h-8 sm:h-12 text-white" 
            viewBox="0 0 1200 120" 
            preserveAspectRatio="none"
          >
            {/* Background wave shadow layer */}
            <path 
              d="M0,0 C150,90 350,-20 500,60 C650,140 900,10 1200,50 L1200,120 L0,120 Z" 
              fill="rgba(16, 114, 61, 0.45)" 
            />
            {/* Foreground crisp white wave */}
            <path 
              d="M0,35 C180,105 380,10 550,75 C720,135 950,25 1200,65 L1200,120 L0,120 Z" 
              fill="#FFFFFF" 
            />
          </svg>
        </div>
      </div>

      {/* 2. MIDDLE CONTENT SECTION (WHITE BACKGROUND) */}
      <div className="w-full flex-1 flex flex-col justify-start items-center px-4 pt-1 pb-6 z-20">
        <div className="max-w-md w-full space-y-4">
          {/* Subtitle notice: আর্থিক সুরক্ষায় OTP ভেরিফিকেশন শতভাগ বাধ্যতামূলক */}
          <div className="text-center pt-1 pb-1">
            <p className="text-xs sm:text-sm font-bold text-slate-650 tracking-tight">
              আর্থিক সুরক্ষায় OTP ভেরিফিকেশন শতভাগ বাধ্যতামূলক
            </p>
          </div>

          {/* Login and Registration Tab Pill Bar */}
          <div className="bg-[#EEF2F6] p-1.5 rounded-full flex gap-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => { 
                setIsRegistering(false); 
                setStep('info'); 
                setError(''); 
                setSuccessMessage(''); 
              }}
              className={`flex-1 py-3 px-4 sm:px-6 rounded-full text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                !isRegistering && step !== 'register-details'
                  ? 'bg-white border-2 border-emerald-600 text-emerald-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <LogIn className={`w-4 h-4 sm:w-5 sm:h-5 ${!isRegistering && step !== 'register-details' ? 'text-emerald-700 stroke-[2.5]' : 'text-slate-500 stroke-[2]'}`} />
              <span>লগইন করুন</span>
            </button>

            <button
              type="button"
              onClick={() => { 
                setIsRegistering(true); 
                setStep('info'); 
                setError(''); 
                setSuccessMessage(''); 
              }}
              className={`flex-1 py-3 px-4 sm:px-6 rounded-full text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isRegistering || step === 'register-details'
                  ? 'bg-white border-2 border-emerald-600 text-emerald-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <UserPlus className={`w-4 h-4 sm:w-5 sm:h-5 ${isRegistering || step === 'register-details' ? 'text-emerald-700 stroke-[2.5]' : 'text-slate-500 stroke-[2]'}`} />
              <span>নিবন্ধন করুন</span>
            </button>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-2xl font-bold flex items-start gap-2 shadow-xs animate-fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs p-3.5 rounded-2xl font-bold flex items-start gap-2 shadow-xs animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Legacy Migration Alert Banner (if enabled) */}
          {appConfig?.emailMigrationPopupEnabled && (
            <div className="p-3 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/90 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">🔄</span>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-teal-950 truncate">পূর্বে ফোন দিয়ে একাউন্ট খুলেছেন?</h4>
                  <p className="text-[10px] text-teal-800">ব্যালেন্স পেতে নতুন ইমেইল যুক্ত করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMigrationModal(true)}
                className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-[10.5px] rounded-xl shrink-0 transition shadow-xs cursor-pointer"
              >
                লিঙ্ক করুন
              </button>
            </div>
          )}

          {/* FORM VIEW ROUTING */}
          <AnimatePresence mode="wait">
            {step === 'verify-otp' ? (
              /* OTP VERIFICATION STEP */
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4 pt-2"
              >
                <div className="text-center space-y-1">
                  <h3 className="text-base font-black text-slate-900">৬ সংখ্যার ওটিপি কোড দিন</h3>
                  <p className="text-xs text-slate-600 font-medium">
                    {deliveryInfo?.channel === 'phone' ? (
                      <>আপনার সিমে <span className="font-bold text-emerald-800 font-mono tracking-wider">({deliveryInfo?.deliveredTo || email})</span> ফায়ারবেজ থেকে ওটিপি পাঠানো হয়েছে। মেসেজ চেক করে কোড দিন।</>
                    ) : (
                      <>আপনার ইমেইল ঠিকানায় <span className="font-bold text-emerald-800">({deliveryInfo?.deliveredTo || email})</span> ওটিপি পাঠানো হয়েছে।</>
                    )}
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <label className="block text-xs font-extrabold text-slate-800">ওটিপি কোড (6 Digits)</label>
                      <button
                        type="button"
                        onClick={handlePasteOtp}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-300 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <span>📋</span>
                        <span>অটো-পেস্ট</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      autoFocus
                      required
                      maxLength={6}
                      value={otpInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setOtpInput(val);
                        if (val.length === 6) {
                          handleVerifyOtp(undefined, val);
                        }
                      }}
                      placeholder="• • • • • •"
                      className="w-full py-3.5 px-5 bg-white border-2 border-slate-200 rounded-full text-center font-mono text-xl font-black tracking-widest text-slate-950 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 shadow-2xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#0B532C] hover:bg-[#084223] active:bg-[#06331B] text-white font-black py-4 px-6 rounded-full text-sm sm:text-base shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>ওটিপি যাচাই করে প্রবেশ করুন</span>
                        <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                      </>
                    )}
                  </button>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-full border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                    >
                      পুনরায় পাঠান (Resend)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStep('info'); setOtpInput(''); setError(''); }}
                      className="flex-1 py-2.5 rounded-full border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                    >
                      অ্যাকাউন্ট / ইমেইল পরিবর্তন
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : !isRegistering ? (
              /* LOGIN FORM (MANDATORY SECURE OTP LOGIN) */
              <motion.form
                key="login-form-otp"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleSendOtp}
                className="space-y-4 pt-1"
              >
                {/* Input Label & Field */}
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <label className="block text-xs sm:text-sm font-extrabold text-slate-900 text-left">
                      অ্যাকাউন্ট নম্বর, মোবাইল নম্বর অথবা ইমেইল
                    </label>
                    <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      নিরাপদ ওটিপি যাচাই
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none text-emerald-700">
                      <KeyRound className="w-5 h-5 stroke-[2]" />
                    </div>
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="অ্যাকাউন্ট নম্বর, মোবাইল অথবা ইমেইল দিন"
                      className="w-full pl-13 pr-5 py-3.5 sm:py-4 bg-white border-2 border-slate-200/90 rounded-full text-slate-950 text-xs sm:text-sm font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 shadow-2xs transition-all"
                    />
                  </div>
                </div>

                {/* Forgot Password link */}
                <div className="flex justify-end pt-0.5 px-1">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer flex items-center gap-1"
                  >
                    <span>🔑</span>
                    <span>পাসওয়ার্ড ভুলে গেছেন? রিসেট করুন</span>
                  </button>
                </div>

                {/* Primary Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0B532C] hover:bg-[#084223] active:bg-[#06331B] text-white font-black py-3.5 sm:py-4 px-6 rounded-full text-sm sm:text-base shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>OTP কোড পাঠান (Send OTP)</span>
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              /* REGISTRATION FORM (CONSISTENT ROUNDED-FULL DESIGN) */
              <motion.form
                key="register-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleRegisterSubmit}
                className="space-y-3 pt-1 text-left"
              >
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1 px-1">আপনার পূর্ণ নাম *</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="উদাঃ মোঃ মোজাম্মেল হক"
                    className="w-full px-5 py-3 bg-white border-2 border-slate-200 rounded-full text-slate-950 text-xs sm:text-sm font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1 px-1">ইমেইল ঠিকানা (Email) *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full px-5 py-3 bg-white border-2 border-slate-200 rounded-full text-slate-950 text-xs sm:text-sm font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1 px-1">মোবাইল নম্বর *</label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="01712345678"
                    className="w-full px-5 py-3 bg-white border-2 border-slate-200 rounded-full text-slate-950 text-xs sm:text-sm font-mono font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1 px-1">পাসওয়ার্ড *</label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-5 py-3 bg-white border-2 border-slate-200 rounded-full text-slate-950 text-xs font-mono font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1 px-1">৪ ডিজিট পিন *</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full px-5 py-3 bg-white border-2 border-slate-200 rounded-full text-slate-950 text-xs font-mono font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs text-center"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0B532C] hover:bg-[#084223] active:bg-[#06331B] text-white font-black py-3.5 sm:py-4 px-6 rounded-full text-sm sm:text-base shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98 mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>নিবন্ধন সম্পন্ন করুন</span>
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 3. BOTTOM DECORATIVE ORGANIC WAVES (PALE LIGHT GREEN GRADIENT) */}
      <div className="relative w-full overflow-hidden leading-none z-10 pointer-events-none mt-auto">
        <svg 
          className="relative block w-full h-16 sm:h-24" 
          viewBox="0 0 1200 200" 
          preserveAspectRatio="none"
        >
          {/* Bottom mint wave layers matching reference image */}
          <path 
            d="M0,130 C200,60 450,180 700,90 C950,20 1100,100 1200,80 L1200,200 L0,200 Z" 
            fill="#E8F8F0" 
            opacity="0.9"
          />
          <path 
            d="M0,160 C300,100 550,195 800,135 C1050,75 1150,140 1200,120 L1200,200 L0,200 Z" 
            fill="#D5F2E3" 
            opacity="0.75"
          />
        </svg>
      </div>

      {/* Invisible Recaptcha for Firebase Phone Auth (CRITICAL: Required for Play Store / Native apps to send SMS) */}
      <div id="recaptcha-container" className="hidden"></div>

      {/* Old Account Email Migration Modal */}
      <LegacyEmailMigrationModal
        isOpen={showMigrationModal}
        onClose={() => {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('amb_migration_popup_dismissed', 'true');
          }
          setShowMigrationModal(false);
        }}
        onEmailLinked={(newLinkedEmail) => {
          setEmail(newLinkedEmail);
          setSuccessMessage(`আপনার পুরানো অ্যাকাউন্টে ইমেইল (${newLinkedEmail}) সফলভাবে লিঙ্ক হয়েছে! নিচে "OTP কোড পাঠান" বাটনে ক্লিক করে ওটিপি ভেরিফাই করুন।`);
          setError('');
          setShowMigrationModal(false);
        }}
      />

      {/* Forgot Password Modal (Multi-Channel OTP + Auto Login) */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        onLoginSuccess={(loggedInUser) => {
          executeLogin(loggedInUser);
        }}
        locateUser={locateUser}
      />
    </div>
  );
}
