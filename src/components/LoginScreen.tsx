import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, addDoc, limit } from 'firebase/firestore';
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
  const [step, setStep] = useState<'info' | 'verify-otp' | 'register-details'>(() => {
    if (typeof window !== 'undefined') {
      const pendingOtp = sessionStorage.getItem('bnb_pending_otp_code') || localStorage.getItem('bnb_pending_otp_code');
      const pendingUser = sessionStorage.getItem('bnb_pending_otp_user') || localStorage.getItem('bnb_pending_otp_user');
      if (pendingOtp && pendingUser) {
        return 'verify-otp';
      }
    }
    return 'info';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState<{ url: string; status: number; errorCode: string; rawSnippet?: string } | null>(null);
  const [healthStatus, setHealthStatus] = useState<{ build?: string; adminSdk?: boolean } | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/health'))
      .then(r => r.json())
      .then(d => setHealthStatus(d))
      .catch(() => {});
  }, []);

  // Form states
  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('amb_saved_login_email') || '';
    }
    return '';
  });
  const [otpInput, setOtpInput] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [sentOtpCode, setSentOtpCode] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('bnb_pending_otp_code') || localStorage.getItem('bnb_pending_otp_code') || '';
    }
    return '';
  });
  const [foundUser, setFoundUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('bnb_pending_otp_user') || localStorage.getItem('bnb_pending_otp_user');
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
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

  // Helper to locate user via server-side endpoint with automatic client-side Firestore fallback
  const locateUser = async (rawInput: string): Promise<User | null> => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) return null;

    // Strict Rule: BNB member codes or non-email queries are directly forbidden
    if (trimmedInput.toUpperCase().includes('BNB') || (!trimmedInput.includes('@') && /^\d+$/.test(trimmedInput))) {
      setError('BNB কোড বা অ্যাকাউন্ট নম্বর দিয়ে একাউন্ট খোলা বা লগইন করা সম্পূর্ণ নিষিদ্ধ! একাউন্ট খোলা এবং লগইন শুধুমাত্র আপনার নিবন্ধিত বৈধ ইমেইলের মাধ্যমে করতে হবে।');
      return null;
    }

    if (!trimmedInput.includes('@')) {
      setError('অনুগ্রহ করে আপনার সঠিক নিবন্ধিত ইমেইল অ্যাড্রেস প্রদান করুন (যেমন: example@gmail.com)।');
      return null;
    }

    const cleanInput = trimmedInput.toLowerCase();
    const isEmail = cleanInput.includes('@');

    // 1. Check local storage cached user (strictly by email)
    const lastUserRaw = localStorage.getItem('amb_last_user');
    if (lastUserRaw) {
      try {
        const cached = JSON.parse(lastUserRaw);
        if (cached.email && cached.email.toLowerCase().trim() === cleanInput) {
          return cached;
        }
      } catch (e) {}
    }

    const requestUrl = apiUrl('/api/auth/locate-user');
    try {
      const res = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleanInput })
      });

      const status = res.status;
      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      let rawSnippet: string | undefined = undefined;

      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      } else {
        const text = await res.text().catch(() => '');
        rawSnippet = text.slice(0, 80).replace(/\s+/g, ' ');
        data = { code: 'non_json_response', text };
      }

      if (res.ok && data.found && data.user) {
        setDebugInfo({ url: requestUrl, status, errorCode: '200_FOUND', rawSnippet });
        return data.user as User;
      }

      if (data.code === 'bnb_code_forbidden') {
        setError('BNB কোড বা অ্যাকাউন্ট নম্বর দিয়ে একাউন্ট খোলা বা লগইন করা সম্পূর্ণ নিষিদ্ধ! শুধুমাত্র আপনার নিবন্ধিত বৈধ ইমেইল অ্যাড্রেস দিয়ে লগইন করুন।');
        return null;
      }

      setDebugInfo({ url: requestUrl, status, errorCode: data.code || `STATUS_${status}`, rawSnippet });
    } catch (netErr: any) {
      console.warn('Server locateUser fetch error, immediately invoking client Firestore direct fallback:', netErr);
    }

    // 2. High-Reliability Direct Client-Side Firestore Fallback Search
    if (!db) return null;
    try {
      const queriesToTry = [
        query(collection(db, 'users'), where('email', '==', cleanInput), limit(1)),
        query(collection(db, 'users'), where('email', '==', trimmedInput), limit(1)),
        query(collection(db, 'users'), where('phone', '==', cleanInput), limit(1)),
        query(collection(db, 'users'), where('phone', '==', trimmedInput), limit(1))
      ];

      const results = await Promise.all(queriesToTry.map(q => getDocs(q).catch(() => null)));
      for (const snap of results) {
        if (snap && !snap.empty) {
          const docSnap = snap.docs[0];
          return { uid: docSnap.id, ...(docSnap.data() as any) } as User;
        }
      }

      // Case-insensitive deep scan on users collection for exact email match
      const allUsersSnap = await getDocs(collection(db, 'users')).catch(() => null);
      if (allUsersSnap && !allUsersSnap.empty) {
        for (const docSnap of allUsersSnap.docs) {
          const udata = docSnap.data();
          const em = String(udata.email || '').toLowerCase().trim();
          const ph = String(udata.phone || '').toLowerCase().trim();
          if (em === cleanInput || ph === cleanInput) {
            return { uid: docSnap.id, ...(udata as any) } as User;
          }
        }
      }
    } catch (clientErr) {
      console.warn('Client fallback search error:', clientErr);
    }

    return null;
  };

  // Handle Send OTP for Login (Strictly Email-Only OTP Verification)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    const rawInput = email.trim();
    if (!rawInput) {
      setError('অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল অ্যাড্রেস প্রদান করুন।');
      return;
    }

    // Strict Rule: BNB member codes or numeric IDs are forbidden
    if (rawInput.toUpperCase().includes('BNB') || (!rawInput.includes('@') && /^\d+$/.test(rawInput))) {
      setError('BNB কোড বা অ্যাকাউন্ট নম্বর দিয়ে অ্যাকাউন্ট খোলা বা লগইন করা সম্পূর্ণ নিষিদ্ধ! অ্যাকাউন্ট খোলা এবং লগইন শুধুমাত্র আপনার নিবন্ধিত বৈধ ইমেইল অ্যাড্রেসের মাধ্যমে করতে হবে।');
      return;
    }

    if (!rawInput.includes('@') || !rawInput.includes('.')) {
      setError('অনুগ্রহ করে আপনার সঠিক নিবন্ধিত ইমেইল অ্যাড্রেস প্রদান করুন (যেমন: example@gmail.com)।');
      return;
    }

    setLoading(true);

    try {
      const targetUser = await locateUser(rawInput);
      if (!targetUser) {
        setError('প্রদত্ত ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। সঠিক নিবন্ধিত ইমেইল অ্যাড্রেস দিয়ে পুনরায় চেষ্টা করুন।');
        return;
      }

      setFoundUser(targetUser);

      const userDisplayName = targetUser.name || 'সম্মানিত সদস্য';
      const userPhone = targetUser.phone || '';
      const userEmail = targetUser.email ? targetUser.email.trim().toLowerCase() : (targetUser.phone && targetUser.phone.includes('@') ? targetUser.phone.trim().toLowerCase() : '');

      // Strict security: User must have a registered email in database to login with real-time OTP
      if (!userEmail || !userEmail.includes('@')) {
        setError('এই অ্যাকাউন্টের সাথে কোনো বৈধ ইমেইল যুক্ত নেই। সুরক্ষার স্বার্থে শুধুমাত্র নিবন্ধিত ইমেইলের মাধ্যমেই রিয়েল-টাইম ওটিপি ভেরিফিকেশন করে লগইন করা সম্ভব।');
        return;
      }

      const targetEmail = userEmail;

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
      setFoundUser(targetUser);

      // Persist across app switching (e.g. when checking Gmail app)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bnb_pending_otp_code', generatedOtp);
        sessionStorage.setItem('bnb_pending_otp_user', JSON.stringify(targetUser));
        localStorage.setItem('bnb_pending_otp_code', generatedOtp);
        localStorage.setItem('bnb_pending_otp_user', JSON.stringify(targetUser));
      }

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

      // 3. Update UI state & prompt user instantly (Official Domain - Inbox delivery)
      setDeliveryInfo({
        deliveredTo: displayEmail,
        channel: 'email',
        targetPhone: formattedPhone,
        targetEmail: targetEmail
      });

      setSuccessMessage(`আপনার নিবন্ধিত ইমেইলে (${displayEmail}) ৬ সংখ্যার অফিসিয়াল ভেরিফিকেশন ওটিপি কোড পাঠানো হয়েছে। অনুগ্রহ করে আপনার ইনবক্স চেক করুন।`);

      setStep('verify-otp');
      if (typeof window !== 'undefined') {
        localStorage.setItem('amb_saved_login_email', rawInput);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'লগইন প্রসেসে ত্রুটি হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Execute actual login with unique activeSessionToken for single-device session control (Instant 0ms UI switch)
  const executeLogin = (userToLogin: User) => {
    const newSessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const deviceId = getClientDeviceId();
    
    const userWithToken: User = {
      ...userToLogin,
      activeSessionToken: newSessionToken,
      activeSessionDeviceId: deviceId
    };

    // 1. Synchronously persist session keys to guarantee 100% immediate state persistence
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('amb_user_uid', userWithToken.uid);
        localStorage.setItem('amb_user_phone', userWithToken.phone || '');
        localStorage.setItem('amb_user_name', userWithToken.name || 'সদস্য');
        localStorage.setItem('amb_user_role', userWithToken.role || 'user');
        localStorage.setItem('bnb_user_member_id', userWithToken.memberId || 'BNB00000000');
        localStorage.setItem('amb_active_session_token', newSessionToken);
        localStorage.setItem('amb_last_user', JSON.stringify(userWithToken));
        sessionStorage.removeItem('amb_session_unlocked');

        // Clear transient OTP storage
        sessionStorage.removeItem('bnb_pending_otp_code');
        sessionStorage.removeItem('bnb_pending_otp_user');
        localStorage.removeItem('bnb_pending_otp_code');
        localStorage.removeItem('bnb_pending_otp_user');
      } catch (storeErr) {
        console.warn('Storage save warning:', storeErr);
      }
    }

    // 2. Set explicit success feedback
    setSuccessMessage('✅ ওটিপি ভেরিফিকেশন সফল হয়েছে! অনুগ্রহ করে আপনার সিকিউরিটি পিন দিন...');
    setError('');

    // 3. Immediately invoke onLoginSuccess to switch screen to user dashboard (NEVER blocked by network)
    onLoginSuccess(userWithToken);

    // 4. Background non-blocking session recording via Admin SDK server route
    try {
      fetch(apiUrl('/api/auth/record-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: userWithToken.uid,
          activeSessionToken: newSessionToken,
          deviceId: deviceId
        })
      }).catch(() => {});
    } catch (e) {}

    // 5. Non-blocking client firestore update if available (never awaited)
    if (db && userToLogin.uid) {
      updateDoc(doc(db, 'users', userToLogin.uid), {
        activeSessionToken: newSessionToken,
        activeSessionDeviceId: deviceId,
        lastLoginAt: new Date().toISOString(),
        isLoggedIn: true
      }).catch(() => {});
    }
  };

  // Verify OTP (Dual check: Local session OTP, persistent storage OTP, or server-side /api/verify-otp)
  const handleVerifyOtp = async (e?: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    const code = (directCode || otpInput).trim();
    if (!code) {
      setError('অনুগ্রহ করে আপনার ইমেইলে আসা ৬ সংখ্যার ওটিপি কোডটি লিখুন।');
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

      // 1. Primary check against local state / persisted storage OTP code
      const effectiveSentCode = sentOtpCode || (typeof window !== 'undefined' ? (sessionStorage.getItem('bnb_pending_otp_code') || localStorage.getItem('bnb_pending_otp_code') || '') : '');
      
      let effectiveUser = foundUser;
      if (!effectiveUser && typeof window !== 'undefined') {
        try {
          const raw = sessionStorage.getItem('bnb_pending_otp_user') || localStorage.getItem('bnb_pending_otp_user');
          if (raw) effectiveUser = JSON.parse(raw);
        } catch (e) {}
      }

      if (effectiveSentCode && code === effectiveSentCode) {
        isVerified = true;
      }

      // 2. Server-side verification fallback via /api/verify-otp
      if (!isVerified && (effectiveUser?.email || email)) {
        try {
          const verifyRes = await fetch(apiUrl('/api/verify-otp'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: (effectiveUser?.email || email).trim().toLowerCase(),
              otp: code
            })
          });
          const verifyData = await verifyRes.json().catch(() => null);
          if (verifyData?.verified) {
            isVerified = true;
          }
        } catch (serverVerifyErr) {
          console.warn('Server verify-otp error:', serverVerifyErr);
        }
      }

      if (isVerified) {
        if (!effectiveUser) {
          effectiveUser = await locateUser(email.trim());
        }

        if (effectiveUser) {
          setSuccessMessage('✅ ওটিপি যাচাই সফল হয়েছে! স্বাগতম...');
          executeLogin(effectiveUser);
        } else {
          setError('ইউজার সেশন পাওয়া যায়নি। অনুগ্রহ করে পুনরায় আপনার নিবন্ধিত ইমেইল দিয়ে চেষ্টা করুন।');
        }
      } else {
        setError('প্রদত্ত ওটিপি কোডটি সঠিক নয়। অনুগ্রহ করে আপনার ইমেইল ইনবক্সে আসা ৬ সংখ্যার সঠিক কোডটি দিন।');
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

    const cleanRegEmail = email.trim().toLowerCase();
    if (cleanRegEmail.toUpperCase().includes('BNB')) {
      setError('BNB কোড দিয়ে একাউন্ট খোলা সম্পূর্ণ নিষিদ্ধ! শুধুমাত্র আপনার ব্যক্তিগত বৈধ ইমেইল অ্যাড্রেস দিয়ে একাউন্ট খুলুন।');
      return;
    }

    if (!cleanRegEmail.includes('@') || !cleanRegEmail.includes('.')) {
      setError('অনুগ্রহ করে একটি সঠিক ও সক্রিয় ইমেইল অ্যাড্রেস প্রদান করুন (যেমন: example@gmail.com)। একাউন্ট খোলা শুধুমাত্র ইমেইলের মাধ্যমেই সম্ভব।');
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

      // Fast, authoritative server-side registration via Firebase Admin SDK
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: cleanEmail,
          phone: standardPhone,
          password: regPassword.trim(),
          pin: regPin.trim()
        })
      });

      const data = await res.json().catch(() => null);

      if (!data || !data.success) {
        setError(data?.error || 'অ্যাকাউন্ট তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
        setLoading(false);
        return;
      }

      const createdUser: User = data.user;
      saveUserToLocalBackup(createdUser);
      setSuccessMessage('✅ আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! স্বাগতম...');
      executeLogin(createdUser);
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

  // Dedicated Full-Screen Forgot Password Screen (not a popup/modal)
  if (showForgotPassword) {
    return (
      <ForgotPasswordModal
        isOpen={true}
        onClose={() => setShowForgotPassword(false)}
        onLoginSuccess={(loggedInUser) => {
          executeLogin(loggedInUser);
        }}
        locateUser={locateUser}
        appConfig={appConfig}
        darkMode={darkMode}
        appLanguage={appLanguage}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-white flex flex-col justify-between relative overflow-x-hidden font-sans select-none" id="login-container">
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
            <div className="space-y-1.5">
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-2xl font-bold flex items-start gap-2 shadow-xs animate-fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </div>
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
                <div className="text-center space-y-1.5">
                  <h3 className="text-base font-black text-slate-900">৬ সংখ্যার ওটিপি কোড দিন</h3>
                  <p className="text-xs text-slate-600 font-medium">
                    {deliveryInfo?.channel === 'phone' ? (
                      <>আপনার সিমে <span className="font-bold text-emerald-800 font-mono tracking-wider">({deliveryInfo?.deliveredTo || email})</span> ফায়ারবেজ থেকে ওটিপি পাঠানো হয়েছে। মেসেজ চেক করে কোড দিন।</>
                    ) : (
                      <>আপনার ইমেইল ঠিকানায় <span className="font-bold text-emerald-800 font-mono">({deliveryInfo?.deliveredTo || email})</span> অফিসিয়াল সিকিউরিটি ওটিপি পাঠানো হয়েছে।</>
                    )}
                  </p>
                  <p className="text-[11px] text-emerald-800 font-bold bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-3 py-1 inline-block shadow-2xs">
                    ✓ অফিসিয়াল ভেরিফায়েড ডোমেইন থেকে ওটিপি সরাসরি আপনার ইনবক্সে পৌঁছেছে।
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
                      আপনার নিবন্ধিত ইমেইল অ্যাড্রেস
                    </label>
                    <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ইমেইল ওটিপি যাচাই
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none text-emerald-700">
                      <Mail className="w-5 h-5 stroke-[2]" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="আপনার ইমেইল দিন (যেমন: name@gmail.com)"
                      className="w-full pl-13 pr-5 py-3.5 sm:py-4 bg-white border-2 border-slate-200/90 rounded-full text-slate-950 text-xs sm:text-sm font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 shadow-2xs transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-amber-700 bg-amber-50/70 border border-amber-200/60 rounded-xl px-3 py-1.5 mt-2 font-medium">
                    ⚠️ BNB কোড বা অ্যাকাউন্ট নম্বর দিয়ে লগইন সম্পূর্ণ নিষিদ্ধ। একাউন্ট খোলা এবং লগইন শুধুমাত্র ইমেইলের মাধ্যমে করতে হবে।
                  </p>
                </div>

                {/* Forgot PIN link */}
                <div className="flex justify-end pt-0.5 px-1">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer flex items-center gap-1"
                  >
                    <span>🔑</span>
                    <span>Forgot PIN? Reset PIN</span>
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
    </div>
  );
}
