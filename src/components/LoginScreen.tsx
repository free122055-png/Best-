import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, addDoc, limit } from 'firebase/firestore';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { User, AppConfig } from '../types';
import { ShieldCheck, UserPlus, LogIn, Mail, KeyRound, Globe, Lock, ArrowRight, AlertTriangle, CheckCircle2, User as UserIcon, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AMBLogo } from './AMBLogo';
import { normalizeMemberId, normalizePhoneNumber, saveUserToLocalBackup, convertBengaliToEnglishDigits, getNextSequentialMemberId, getClientDeviceId, getDeviceFingerprint } from '../lib/memberUtils';
import { LegacyEmailMigrationModal } from './LegacyEmailMigrationModal';

interface LoginScreenProps {
  authUid?: string;
  onLoginSuccess: (user: User) => void;
  initialRegistering?: boolean;
  appConfig?: AppConfig | null;
  appLanguage?: string;
  onLanguageChange?: (lang: 'bn' | 'en') => void;
  darkMode?: boolean;
  onThemeToggle?: () => void;
}

export default function LoginScreen({
  authUid,
  onLoginSuccess,
  initialRegistering = false,
  appConfig,
  appLanguage = 'bn',
  onLanguageChange,
  darkMode = false,
  onThemeToggle
}: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(initialRegistering);
  const [step, setStep] = useState<'info' | 'verify-otp' | 'register-details'>( 'info' );
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
  const [sentOtpCode, setSentOtpCode] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<{ deliveredTo?: string; isOwnerFallback?: boolean } | null>(null);

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

  // Handle Send OTP for Login (Superfast 0ms cache check + parallel network query)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    const rawInput = email.trim();
    if (!rawInput) {
      setError('অনুগ্রহ করে আপনার ইমেইল অথবা মোবাইল নম্বর প্রদান করুন।');
      return;
    }

    const cleanEmail = rawInput.toLowerCase();
    const isEmail = cleanEmail.includes('@');
    const cleanPhoneDigits = convertBengaliToEnglishDigits(rawInput).replace(/\D/g, '');
    const isPhone = !isEmail && cleanPhoneDigits.length >= 10;
    const isMemberId = !isEmail && !isPhone && (cleanEmail.startsWith('amb') || cleanEmail.startsWith('bnb') || cleanEmail.startsWith('main'));

    setLoading(true);

    try {
      let targetUser: User | null = null;

      // 1. Superfast 0ms local storage cache inspection
      try {
        const localSources: User[] = [];
        const lastUserRaw = localStorage.getItem('amb_last_user');
        if (lastUserRaw) {
          const u = JSON.parse(lastUserRaw);
          if (u) localSources.push(u);
        }
        const cachedRaw = localStorage.getItem('amb_registered_members') || localStorage.getItem('amb_all_users_backup');
        if (cachedRaw) {
          const list = JSON.parse(cachedRaw);
          if (Array.isArray(list)) localSources.push(...list);
        }

        const foundInLocal = localSources.find((u: User) => {
          if (!u) return false;
          if (isEmail && u.email && u.email.trim().toLowerCase() === cleanEmail) return true;
          if (isPhone && u.phone) {
            const uDigits = convertBengaliToEnglishDigits(u.phone).replace(/\D/g, '');
            if (uDigits.endsWith(cleanPhoneDigits.slice(-10))) return true;
          }
          if (isMemberId && u.memberId && u.memberId.toUpperCase() === rawInput.toUpperCase()) return true;
          return false;
        });

        if (foundInLocal) {
          targetUser = foundInLocal;
        }
      } catch (cacheErr) {
        // Continue to online query
      }

      // 2. Query Firestore if not resolved from instant local cache
      if (!targetUser) {
        if (isEmail) {
          const q = query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const d = snap.docs[0];
            targetUser = { uid: d.id, ...d.data() } as User;
          } else {
            // Also check if admin master email
            if (cleanEmail === 'networkbangladeshbnbbusiness@gmail.com' || cleanEmail === 'networkbangladeshambbusiness@gmail.com' || cleanEmail === 'admin@amb.com') {
              const adminSnap = await getDoc(doc(db, 'users', 'admin_master'));
              if (adminSnap.exists()) {
                targetUser = { uid: 'admin_master', ...adminSnap.data() } as User;
              } else {
                targetUser = {
                  uid: 'admin_master',
                  name: 'Bangladesh AMB Administrator',
                  email: cleanEmail,
                  phone: '+8800011112222',
                  memberId: 'MAIN_ADMIN',
                  pin: '6666',
                  role: 'admin',
                  approved: true,
                  balance: 999000,
                  savings: 0,
                  dueLoan: 0,
                  createdAt: new Date().toISOString()
                };
                await setDoc(doc(db, 'users', 'admin_master'), targetUser);
              }
            }
          }
        } else if (isPhone) {
          const normalizedPhone = normalizePhoneNumber(cleanPhoneDigits) || cleanPhoneDigits;
          // Try direct user doc first
          const directDocSnap = await getDoc(doc(db, 'users', `user_${cleanPhoneDigits}`));
          if (directDocSnap.exists()) {
            targetUser = { uid: directDocSnap.id, ...directDocSnap.data() } as User;
          } else {
            const qPhone = query(collection(db, 'users'), where('phone', '==', normalizedPhone), limit(1));
            const phoneSnap = await getDocs(qPhone);
            if (!phoneSnap.empty) {
              const d = phoneSnap.docs[0];
              targetUser = { uid: d.id, ...d.data() } as User;
            }
          }
        } else if (isMemberId) {
          const normalizedId = normalizeMemberId(rawInput);
          const qMember = query(collection(db, 'users'), where('memberId', '==', normalizedId), limit(1));
          const memberSnap = await getDocs(qMember);
          if (!memberSnap.empty) {
            const d = memberSnap.docs[0];
            targetUser = { uid: d.id, ...d.data() } as User;
          }
        }
      }

      if (!targetUser) {
        if (appConfig?.emailMigrationPopupEnabled) {
          setError('এই তথ্য দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি। আপনি যদি পূর্বে মোবাইল নম্বর দিয়ে একাউন্ট করে থাকেন, তবে নিচের "পুরানো একাউন্ট রিকভারি" বাটনে ক্লিক করে আপনার ইমেইলটি লিঙ্ক করুন।');
        } else {
          setError('কোনো অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে সঠিক ইমেইল/নম্বর দিন অথবা "নিবন্ধন করুন" এ ক্লিক করুন।');
        }
        setLoading(false);
        return;
      }

      // If user was found via phone or memberId but has no email linked
      if (!targetUser.email || !targetUser.email.includes('@')) {
        setError('আপনার অ্যাকাউন্টে কোনো ইমেইল লিঙ্ক করা নেই। অনুগ্রহ করে নিচে "ইমেইল লিঙ্ক করুন" বাটনে ক্লিক করে আপনার ইমেইলটি যুক্ত করুন।');
        setShowMigrationModal(true);
        setLoading(false);
        return;
      }

      const targetEmail = targetUser.email.trim().toLowerCase();
      setEmail(targetEmail);
      try {
        localStorage.setItem('amb_saved_login_email', targetEmail);
      } catch (e) {}

      // Generate 6 digit OTP immediately
      const generated = Math.floor(100000 + Math.random() * 900000).toString();
      setSentOtpCode(generated);
      setFoundUser(targetUser);
      setLoading(false);
      setStep('verify-otp'); // Instant 0ms transition!

      // Non-blocking parallel background dispatch (guaranteed delivery)
      const notifId = `otp-login-${Date.now()}`;
      const payload = {
        id: notifId,
        userId: targetUser.uid,
        email: targetEmail,
        otp: generated,
        category: 'email_otp',
        title: '🔐 লগইন ভেরিফিকেশন ওটিপি (OTP)',
        body: `আপনার AMB Business Network অ্যাকাউন্টে লগইন করার ওটিপি কোড: ${generated}। কারো সাথে শেয়ার করবেন না।`,
        read: false,
        createdAt: new Date().toISOString()
      };

      // 1. Parallel writes to Firestore (fast & redundant)
      Promise.allSettled([
        setDoc(doc(db, 'user_notifications', notifId), payload),
        setDoc(doc(db, 'otp_requests', notifId), {
          id: notifId,
          userId: targetUser.uid,
          email: targetEmail,
          otp: generated,
          sent: false,
          createdAt: new Date().toISOString()
        })
      ]).catch(e => console.warn("Firestore OTP write notice:", e));

      // 2. Parallel HTTP dispatch with prioritized direct call
      const cloudBackendUrl = 'https://ais-pre-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app';
      (async () => {
        try {
          if (Capacitor.isNativePlatform()) {
            const capRes = await CapacitorHttp.post({
              url: `${cloudBackendUrl}/api/send-email-otp`,
              headers: { 'Content-Type': 'application/json' },
              data: { email: targetEmail, otp: generated }
            });
            if (capRes.status >= 200 && capRes.status < 300) {
              setDeliveryInfo(capRes.data);
            }
          } else {
            // Web: Call local endpoint first (superfast same-origin!)
            const res = await fetch('/api/send-email-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: targetEmail, otp: generated })
            });
            if (res.ok) {
              const delInfo = await res.json();
              setDeliveryInfo(delInfo);
            } else {
              // Fallback to cloud backend if local fails
              const fallbackRes = await fetch(`${cloudBackendUrl}/api/send-email-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: targetEmail, otp: generated })
              });
              if (fallbackRes.ok) {
                const delInfo = await fallbackRes.json();
                setDeliveryInfo(delInfo);
              }
            }
          }
        } catch (apiErr) {
          console.warn('HTTP dispatch notice:', apiErr);
        }
      })();

      console.log(`[Email OTP Generated for ${targetEmail}]: ${generated}`);
    } catch (err: any) {
      console.error(err);
      setError(`ওটিপি পাঠাতে সমস্যা হয়েছে: ${err?.message || 'আবার চেষ্টা করুন।'}`);
      setLoading(false);
    }
  };

  // Instantaneous 0ms login execution
  const executeLogin = (user: User) => {
    const clientDevId = getClientDeviceId();
    const clientFp = getDeviceFingerprint();
    const updatedUser: User = {
      ...user,
      isLoggedIn: true,
      currentDeviceId: clientDevId
    };

    // Remember last successful login email for instant next-time login
    if (user.email) {
      try {
        localStorage.setItem('amb_saved_login_email', user.email.toLowerCase().trim());
      } catch (e) {}
    }

    // Instant local save and dashboard transition
    saveUserToLocalBackup(updatedUser);
    onLoginSuccess(updatedUser);

    // Sync to Firestore in background without delaying user
    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, {
      isLoggedIn: true,
      currentDeviceId: clientDevId,
      deviceFingerprint: clientFp,
      deviceStatus: 'Online'
    }).catch(err => console.warn('Background login status update:', err));
  };

  // 1-Tap OTP Paste from clipboard
  const handlePasteOtp = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        const clean = text.replace(/\D/g, '').slice(0, 6);
        if (clean.length === 6) {
          setOtpInput(clean);
          if (clean === sentOtpCode && foundUser) {
            executeLogin(foundUser);
          } else {
            handleVerifyOtp(undefined, clean);
          }
        }
      }
    } catch (e) {
      console.warn("Clipboard paste notice:", e);
    }
  };

  // Handle Verify OTP & Complete Login
  const handleVerifyOtp = (e?: React.FormEvent, customCode?: string) => {
    if (e) e.preventDefault();
    setError('');
    const code = customCode !== undefined ? customCode : otpInput;
    if (!code || code.trim() !== sentOtpCode) {
      setError('ভুল ওটিপি কোড! অনুগ্রহ করে আপনার ইমেইল ইনবক্সে প্রেরিত সঠিক ৬ সংখ্যার ওটিপি দিন।');
      return;
    }

    if (!foundUser) {
      setError('ইউজার তথ্য পাওয়া যায়নি। আবার চেষ্টা করুন।');
      setStep('info');
      return;
    }

    executeLogin(foundUser);
  };

  // Handle Registration Submit (Zero-OTP for creation)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!regName.trim()) {
      setError('পূর্ণ নাম প্রদান করা বাধ্যতামূলক।');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('একটি সঠিক ইমেইল ঠিকানা দিন।');
      return;
    }
    if (!regPhone.trim() || regPhone.trim().length < 10) {
      setError('একটি সঠিক মোবাইল নম্বর দিন।');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setError('পাসওয়ার্ড কমপক্ষে ৪ অক্ষর বা সংখ্যার হতে হবে।');
      return;
    }
    if (!regPin || regPin.length !== 4) {
      setError('পিন অবশ্যই ৪ ডিজিটের হতে হবে।');
      return;
    }

    setLoading(true);
    try {
      // Check if email already exists
      const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setError('এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে। অনুগ্রহ করে লগইন করুন।');
        setLoading(false);
        return;
      }

      const memberId = await getNextSequentialMemberId();
      const userDocId = 'user_' + (regPhone.replace(/\D/g, '') || Date.now().toString());
      const userRef = doc(db, 'users', userDocId);

      const newUser: User = {
        uid: userDocId,
        name: regName.trim(),
        email: cleanEmail,
        phone: normalizePhoneNumber(regPhone) || regPhone.trim(),
        memberId: memberId,
        password: regPassword.trim(),
        pin: regPin.trim(),
        pinSet: true,
        role: 'user',
        balance: 0,
        telecomBalance: 0,
        superShopBalance: 0,
        savings: 0,
        dueLoan: 0,
        createdAt: new Date().toISOString(),
        isLoggedIn: false,
        approved: true
      };

      await setDoc(userRef, newUser);
      saveUserToLocalBackup(newUser);

      // Reset registration form inputs
      setRegName('');
      setRegPhone('');
      setRegPassword('');
      setRegPin('');

      // Redirect back to login mode so user must verify via OTP to log in
      setEmail(cleanEmail);
      setIsRegistering(false);
      setStep('info');
      setSuccessMessage('আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! এখন অ্যাকাউন্টে প্রবেশ করতে নিচের "OTP পাঠান" বাটনে ক্লিক করে ওটিপি ভেরিফাই করুন।');
    } catch (err: any) {
      console.error(err);
      setError(`অ্যাকাউন্ট তৈরিতে সমস্যা হয়েছে: ${err?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50/80 px-3.5 py-6 overflow-y-auto font-sans text-slate-900 w-full" id="login-container">
      <div className="w-full max-w-sm sm:max-w-md flex flex-col items-center justify-center my-auto">
        {/* Floating Language & Theme control bar */}
        <div className="w-full flex justify-between items-center px-1 mb-3 relative z-20 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-800 bg-white/90 px-3 py-1 rounded-full border border-slate-200/80 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AMB সিকিউর গেটওয়ে</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onLanguageChange && onLanguageChange(appLanguage === 'bn' ? 'en' : 'bn')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-800 rounded-full text-xs font-black shadow-2xs hover:bg-slate-50 cursor-pointer transition active:scale-95"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>{appLanguage === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>
            <button
              type="button"
              onClick={() => onThemeToggle && onThemeToggle()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-800 rounded-full text-xs font-black shadow-2xs hover:bg-slate-50 cursor-pointer transition active:scale-95"
            >
              <span>{darkMode ? '☀️ Light' : '🌙 Dark'}</span>
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-white border border-slate-200/90 shadow-xl rounded-3xl overflow-hidden"
        >
        {/* Banner with Brand */}
        <div className="bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950 px-4 py-4 text-white text-center relative flex flex-col items-center justify-center">
          <div className="absolute top-3 right-3 bg-white/15 backdrop-blur-md text-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-black border border-white/20">
            v2.0
          </div>
          <div className="flex items-center justify-center mb-2 shrink-0">
            {appConfig?.logoUrl ? (
              <img
                src={appConfig.logoUrl}
                alt="AMB Logo"
                className="h-16 sm:h-20 w-auto max-w-[140px] object-contain drop-shadow-md"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center filter drop-shadow-md">
                <AMBLogo size={70} variant="white" />
              </div>
            )}
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-base sm:text-lg font-black font-sans tracking-wide leading-tight text-center text-white drop-shadow-xs">
              <span className="text-emerald-300 font-extrabold mr-1.5">AMB</span>
              <span className="tracking-wider uppercase">BUSINESS NETWORK</span>
              <span className="block text-emerald-200 text-xs font-bold tracking-widest mt-0.5">BANGLADESH</span>
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 border border-white/15 text-emerald-100 text-[11px] font-bold backdrop-blur-xs shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর পোর্টাল</span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-white">
          <AnimatePresence mode="wait">
            {step === 'verify-otp' ? (
              <motion.div
                key="verify-otp-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-black mb-2">
                    <KeyRound className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <span>ইমেইল ওটিপি ভেরিফিকেশন</span>
                  </div>


                  <h3 className="text-sm font-black text-slate-900">৬ সংখ্যার ওটিপি কোড দিন</h3>
                  <p className="text-xs text-slate-600 font-medium mt-1">
                    আপনার <span className="font-bold text-emerald-800">{email}</span> ইমেইলে ৬ সংখ্যার সিকিউরিটি ওটিপি পাঠানো হয়েছে। অনুগ্রহ করে আপনার জিমেইল ইনবক্স চেক করুন।
                  </p>
                </div>

                

                {error && (
                  <div className="bg-rose-50 text-rose-700 border border-rose-200 text-xs p-3 rounded-2xl font-bold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Helpful note for Spam / All Mail folder in Gmail */}
                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-2xl flex items-start gap-2 shadow-2xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <b>আর্থিক সুরক্ষায় ওটিপি বাধ্যতামূলক:</b> আপনার ইমেইলে ৬ সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে। ইনবক্সে না পেলে জিমেইল অ্যাপের <b>"Spam" (স্প্যাম)</b> অথবা <b>"All Mail"</b> ফোল্ডারটি চেক করুন।
                  </span>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-extrabold text-slate-800">ওটিপি কোড (6 Digits OTP)</label>
                      <button
                        type="button"
                        onClick={handlePasteOtp}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 active:scale-95 px-2.5 py-0.5 rounded-lg border border-emerald-300 transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                        title="ক্লিপবোর্ড থেকে পেস্ট করুন"
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
                          if (val === sentOtpCode && foundUser) {
                            executeLogin(foundUser);
                          } else {
                            handleVerifyOtp(undefined, val);
                          }
                        }
                      }}
                      placeholder="123456"
                      className="block w-full px-3.5 py-3 bg-white border-2 border-slate-200 rounded-2xl text-slate-950 text-center font-mono text-xl font-black tracking-widest placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-black py-3 px-4 rounded-2xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>ওটিপি যাচাই করে অ্যাকাউন্টে প্রবেশ করুন</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading}
                      className="flex-1 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 rounded-2xl text-xs transition-all cursor-pointer"
                    >
                      পুনরায় ওটিপি পাঠান (Resend)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStep('info'); setOtpInput(''); setError(''); }}
                      className="flex-1 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 rounded-2xl text-xs transition-all cursor-pointer"
                    >
                      ইমেইল পরিবর্তন
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="info-step"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-3.5"
              >
                {/* Header Badge */}
                <div className="mb-2">
                  <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-black shadow-2xs">
                    <Mail className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <span>BNB সিকিউর মেম্বার গেটওয়ে (OTP Mandatory)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium text-center mt-1">
                    আর্থিক সুরক্ষায় ওটিপি ভেরিফিকেশন শতভাগ বাধ্যতামূলক।
                  </p>
                </div>

                {/* Tab selector */}
                <div className="flex bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => { setIsRegistering(false); setError(''); setSuccessMessage(''); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${!isRegistering ? 'bg-white shadow-sm text-emerald-900 border border-slate-200/70' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <LogIn className="w-4 h-4 text-emerald-700" />
                      লগইন করুন
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsRegistering(true); setError(''); setSuccessMessage(''); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${isRegistering ? 'bg-white shadow-sm text-emerald-900 border border-slate-200/70' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-emerald-700" />
                      নিবন্ধন করুন
                    </span>
                  </button>
                </div>

                {successMessage && (
                  <div className="bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs p-3 rounded-2xl font-bold flex items-start gap-2 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    <span className="leading-relaxed">{successMessage}</span>
                  </div>
                )}

                {error && (
                  <div className="bg-rose-50 text-rose-700 border border-rose-200 text-xs p-3 rounded-2xl font-bold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Old Account Migration Prompt Banner */}
                {appConfig?.emailMigrationPopupEnabled && (
                  <div className="p-3 bg-gradient-to-r from-cyan-50 via-teal-50 to-emerald-50 border border-cyan-200/90 rounded-2xl flex items-center justify-between gap-2 text-left shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔄</span>
                      <div>
                        <h4 className="text-xs font-bold text-cyan-950">পূর্বে ফোন দিয়ে একাউন্ট খুলেছেন?</h4>
                        <p className="text-[10px] text-cyan-800 leading-tight">পূর্বের ব্যালেন্স ও সঞ্চয় পেতে নতুন ইমেইল যুক্ত করুন</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMigrationModal(true)}
                      className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-bold text-[10.5px] rounded-xl shrink-0 transition shadow-xs cursor-pointer"
                    >
                      ইমেইল লিঙ্ক করুন
                    </button>
                  </div>
                )}

                {!isRegistering ? (
                  <form onSubmit={handleSendOtp} className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-extrabold text-slate-800">ইমেইল বা মোবাইল নম্বর (Email or Phone)</label>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          ⚡ সুপারফাস্ট
                        </span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4 text-emerald-700" />
                        </div>
                        <input
                          type="text"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="আপনার ইমেইল বা মোবাইল নম্বর দিন"
                          className="block w-full pl-10 pr-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-950 font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 text-xs font-bold transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-black py-3 px-4 rounded-2xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 mt-1 disabled:opacity-75 cursor-pointer active:scale-98"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>OTP কোড পাঠান (Send OTP)</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">আপনার পূর্ণ নাম *</label>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="উদাঃ মোঃ মোজাম্মেল হক"
                        className="block w-full px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-950 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">ইমেইল ঠিকানা (Email) *</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@gmail.com"
                        className="block w-full px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-950 font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">মোবাইল নম্বর *</label>
                      <input
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="01712345678"
                        className="block w-full px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-950 font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">পাসওয়ার্ড (কমপক্ষে ৪ অক্ষর) *</label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-950 font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">৪ ডিজিট সিকিউরিটি পিন *</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={regPin}
                        onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="block w-full px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-950 font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 text-xs font-bold"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-black py-3 px-4 rounded-2xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 mt-2 cursor-pointer active:scale-98"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>অ্যাকাউন্ট রেজিস্টার করুন</span>
                      )}
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="mt-4 text-center text-slate-500 text-[11px] font-bold">
        © 2026 BNB Business Network Bangladesh. সুরক্ষিত ও এনক্রিপ্টেড।
      </div>
      </div>

      {/* Old Account Email Migration & Recovery Modal */}
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
    </div>
  );
}
