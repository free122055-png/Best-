import React, { useState, useEffect } from 'react';
import { User, AppConfig } from '../types';
import { maskSecretPhone, convertBengaliToEnglishDigits } from '../lib/memberUtils';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { KeyRound, LogOut, ArrowRight, ShieldAlert, Check, X, Search, Lock, ShieldCheck, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AMBLogo } from './AMBLogo';
import { getLockoutState, recordFailedAttempt, clearLockoutState, LockoutState } from '../lib/lockoutUtils';
import LockoutScreen from './LockoutScreen';

// Comprehensive global country list with flags & dialed codes
const countries = [
  { name: 'বাংলাদেশ (Bangladesh)', code: '+880', flag: '🇧🇩', placeholder: '01712345678', minLength: 10, maxLength: 11 },
  { name: 'সৌদি আরব (Saudi Arabia)', code: '+966', flag: '🇸🇦', placeholder: '512345678', minLength: 8, maxLength: 9 },
  { name: 'মালয়েশিয়া (Malaysia)', code: '+60', flag: '🇲🇾', placeholder: '123456789', minLength: 9, maxLength: 10 },
  { name: 'সংযুক্ত আরব আমিরাত (UAE)', code: '+971', flag: '🇦🇪', placeholder: '501234567', minLength: 9, maxLength: 9 },
  { name: 'ওমান (Oman)', code: '+968', flag: '🇴🇲', placeholder: '91234567', minLength: 8, maxLength: 8 },
  { name: 'কাতার (Qatar)', code: '+974', flag: '🇶🇦', placeholder: '55123456', minLength: 8, maxLength: 8 },
  { name: 'কুয়েত (Kuwait)', code: '+965', flag: '🇰🇼', placeholder: '51234567', minLength: 8, maxLength: 8 },
  { name: 'বাহরাইন (Bahrain)', code: '+973', flag: '🇧🇭', placeholder: '31234567', minLength: 8, maxLength: 8 },
  { name: 'সিঙ্গাপুর (Singapore)', code: '+65', flag: '🇸🇬', placeholder: '81234567', minLength: 8, maxLength: 8 },
  { name: 'ভারত (India)', code: '+91', flag: '🇮🇳', placeholder: '9876543210', minLength: 10, maxLength: 10 },
  { name: 'যুক্তরাজ্য (UK)', code: '+44', flag: '🇬🇧', placeholder: '7123456789', minLength: 10, maxLength: 10 },
  { name: 'মার্কিন যুক্তরাষ্ট্র (USA)', code: '+1', flag: '🇺🇸', placeholder: '2015550123', minLength: 10, maxLength: 10 },
  { name: 'ইতালি (Italy)', code: '+39', flag: '🇮🇹', placeholder: '3123456789', minLength: 9, maxLength: 10 },
  { name: 'কানাডা (Canada)', code: '+1', flag: '🇨🇦', placeholder: '2015550123', minLength: 10, maxLength: 10 },
  { name: 'দক্ষিণ কোরিয়া (South Korea)', code: '+82', flag: '🇰🇷', placeholder: '1012345678', minLength: 9, maxLength: 10 },
  { name: 'জাপান (Japan)', code: '+81', flag: '🇯🇵', placeholder: '8012345678', minLength: 9, maxLength: 10 },
  { name: 'অস্ট্রেলিয়া (Australia)', code: '+61', flag: '🇦🇺', placeholder: '412345678', minLength: 9, maxLength: 9 },
  { name: 'মালদ্বীপ (Maldives)', code: '+960', flag: '🇲🇻', placeholder: '7123456', minLength: 7, maxLength: 7 },
  { name: 'پاکستان (Pakistan)', code: '+92', flag: '🇵🇰', placeholder: '3001234567', minLength: 10, maxLength: 10 },
  { name: 'নেপাল (Nepal)', code: '+977', flag: '🇳🇵', placeholder: '9801234567', minLength: 10, maxLength: 10 },
  { name: 'লেবানন (Lebanon)', code: '+961', flag: '🇱🇧', placeholder: '71234567', minLength: 8, maxLength: 8 },
  { name: 'জর্ডান (Jordan)', code: '+962', flag: '🇯🇴', placeholder: '791234567', minLength: 9, maxLength: 9 },
  { name: 'ইরাক (Iraq)', code: '+964', flag: '🇮🇶', placeholder: '7701234567', minLength: 10, maxLength: 10 },
  { name: 'মিশর (Egypt)', code: '+20', flag: '🇪🇬', placeholder: '1012345678', minLength: 10, maxLength: 10 },
  { name: 'অন্যান্য (Others)', code: '+', flag: '🌐', placeholder: '1234567890', minLength: 5, maxLength: 15 }
];

// Formatting helper
const getFormattedPhone = (phone: string, country: typeof countries[0]): string => {
  let formattedNumber = phone.replace(/\D/g, '');
  if (country.code === '+880') {
    if (formattedNumber.startsWith('880')) {
      formattedNumber = formattedNumber.slice(3);
    } else if (formattedNumber.startsWith('+880')) {
      formattedNumber = formattedNumber.slice(4);
    }
    if (!formattedNumber.startsWith('0')) {
      formattedNumber = '0' + formattedNumber;
    }
  } else if (country.code === '+') {
    formattedNumber = '+' + formattedNumber;
  } else {
    if (formattedNumber.startsWith('0')) {
      formattedNumber = formattedNumber.replace(/^0+/, '');
    }
    formattedNumber = country.code + formattedNumber;
  }
  return formattedNumber;
};

// Validation Helper
const validatePhoneNumber = (phone: string, country: typeof countries[0]): string | null => {
  if (!phone) {
    return 'অনুগ্রহ করে মোবাইল নাম্বার প্রদান করুন।';
  }
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 0) {
    return 'মোবাইল নাম্বারে অবশ্যই সংখ্যা থাকতে হবে।';
  }
  
  if (country.code === '+880') {
    if (digitsOnly.length === 11 && !digitsOnly.startsWith('01')) {
      return '11 ডিজিটের বাংলাদেশি নাম্বার অবশ্যই 01 দিয়ে শুরু হতে হবে।';
    }
    if (digitsOnly.length !== 10 && digitsOnly.length !== 11) {
      return 'সদস্যের সঠিক 10 বা 11 ডিজিটের বাংলাদেশি মোবাইল নাম্বার দিন।';
    }
  } else {
    if (digitsOnly.length < (country.minLength || 6) || digitsOnly.length > (country.maxLength || 15)) {
      return `সদস্যের সঠিক দৈর্ঘ্যের মোবাইল নাম্বার দিন (${country.flag} ${country.name} এর জন্য ${(country.minLength || 6)}-${(country.maxLength || 15)} ডিজিট)।`;
    }
  }
  return null;
};

interface LockScreenProps {
  user: User;
  onUnlock: () => void;
  onLogout: () => void;
  isLogoutMode?: boolean;
  onCancelLogout?: () => void;
  appConfig?: AppConfig;
  appLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  darkMode?: boolean;
}

export default function LockScreen({ 
  user, 
  onUnlock, 
  onLogout, 
  isLogoutMode = false,
  onCancelLogout,
  appConfig,
  appLanguage = 'bn',
  onLanguageChange,
  darkMode = false
}: LockScreenProps) {
  const userIdentifier = user?.phone || user?.uid || '';
  const [lockoutInfo, setLockoutInfo] = useState<LockoutState>(() => getLockoutState(userIdentifier));

  useEffect(() => {
    const status = getLockoutState(userIdentifier);
    setLockoutInfo(status);
  }, [userIdentifier]);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Secret App Lock (2nd step lock) states
  const [secretCodeInput, setSecretCodeInput] = useState('');
  const [showSecretCode, setShowSecretCode] = useState(false);

  // Forgot PIN state fields
  const [showForgotPinModal, setShowForgotPinModal] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotMemberId, setForgotMemberId] = useState('');
  const [newResetPin, setNewResetPin] = useState('');
  const [newResetPinConfirm, setNewResetPinConfirm] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [hasActiveUnlockRequest, setHasActiveUnlockRequest] = useState(false);

  // International recovery setup states
  const [forgotCountry, setForgotCountry] = useState(countries[0]);
  const [showForgotCountryDropdown, setShowForgotCountryDropdown] = useState(false);
  const [forgotCountrySearch, setForgotCountrySearch] = useState('');

  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');

    if (newResetPin.length !== 4 || !/^\d+$/.test(newResetPin)) {
      setResetError('নতুন পিন অবশ্যই 4 ডিজিটের সংখ্যা হতে হবে।');
      return;
    }
    if (newResetPin !== newResetPinConfirm) {
      setResetError('নতুন পিন এবং নিশ্চিত করা পিন দুটির মিল নেই!');
      return;
    }

    setResetLoading(true);
    try {
      if (!user?.uid) {
        setResetError('ইউজার আইডি পাওয়া যায়নি!');
        setResetLoading(false);
        return;
      }

      // Direct update using the current user's authenticated UID - super simple and fast!
      const targetUserRef = doc(db, 'users', user.uid);

      await updateDoc(targetUserRef, {
        pin: newResetPin
      });

      setResetMessage('আপনার সিকিউরিটি পিন সফলভাবে পরিবর্তন করা হয়েছে!');
      setPin('');
      
      // Auto close modal after 1.5s and unlock instantly!
      setTimeout(() => {
        setShowForgotPinModal(false);
        setNewResetPin('');
        setNewResetPinConfirm('');
        setResetMessage('');
        onUnlock(); // Auto-unlock after explicit successful PIN change
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setResetError(`পিন পরিবর্তন ব্যর্থ হয়েছেঃ ${err?.message || 'সার্ভার সংযোগ সমস্যা'}`);
    } finally {
      setResetLoading(false);
    }
  };

  // Real-time listener for user document to unlock ONLY when Admin approves active unlock request
  useEffect(() => {
    if (!user?.uid || !hasActiveUnlockRequest) return;
    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.appLockResetStatus === 'approved' && data.appLockResetRequested) {
          // Admin approved active unlock request! Consume the status in Firestore and unlock
          updateDoc(userRef, {
            appLockResetStatus: 'consumed',
            appLockResetRequested: false
          }).catch((e) => console.warn("Failed to consume unlock status:", e));
          setHasActiveUnlockRequest(false);
          onUnlock();
        }
      }
    }, (err) => {
      console.warn("LockScreen real-time user listener error:", err);
    });
    return () => unsub();
  }, [user?.uid, hasActiveUnlockRequest, onUnlock]);

  const handleSendAdminUnlockRequest = async () => {
    if (!user?.uid) return;
    setResetLoading(true);
    setResetError('');
    setResetMessage('');

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        appLockResetRequested: true,
        appLockResetRequestedAt: new Date().toISOString(),
        appLockResetStatus: 'pending'
      });

      const reqRef = doc(db, 'app_lock_requests', user.uid);
      await setDoc(reqRef, {
        userId: user.uid,
        userName: user.name || 'সদস্য',
        memberId: user.memberId || '',
        phone: user.phone || '',
        requestedAt: new Date().toISOString(),
        status: 'pending'
      }, { merge: true });

      setHasActiveUnlockRequest(true);
      setResetMessage('আপনার আনলক রিকোয়েস্ট সফলভাবে এডমিনের কাছে পাঠানো হয়েছে! এডমিন যাচাই করে এপ্রুভ করার সাথে সাথে অ্যাপস আনলক হয়ে যাবে।');
    } catch (err: any) {
      console.error("Error sending admin unlock request:", err);
      setResetError('রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে। ইন্টারনেট চেক করে আবার চেষ্টা করুন।');
    } finally {
      setResetLoading(false);
    }
  };

  // Allow keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          const nextPin = pin + e.key;
          setPin(nextPin);
          if (nextPin.length === 4) {
            handleVerifyPin(nextPin);
          }
        }
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (pin.length === 4) {
          handleVerifyPin();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        handleVerifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError('');
    setPin('');
  };

  const handleVerifyPin = async (overridePin?: string) => {
    const rawTarget = overridePin !== undefined ? overridePin : pin;
    const targetPin = convertBengaliToEnglishDigits(rawTarget).trim();
    if (targetPin.length !== 4) return;

    const lockStatus = getLockoutState(userIdentifier);
    if (lockStatus.isLocked) {
      setLockoutInfo(lockStatus);
      return;
    }

    setError('');
    setLoading(true);

    try {
      // 1. In-memory user PIN & admin check
      let userPin = user?.pin ? convertBengaliToEnglishDigits(String(user.pin)).trim() : '';
      let userAppLockCode = user?.appLockCode ? convertBengaliToEnglishDigits(String(user.appLockCode)).trim() : '';
      const isAdmin = user?.role === 'admin' || user?.memberId === 'MAIN_ADMIN' || user?.phone === '+8800011112222';
      const adminMasterPin = appConfig?.adminPin ? convertBengaliToEnglishDigits(String(appConfig.adminPin)).trim() : '6666';

      // 2. If userPin is missing, empty, or doesn't match targetPin, fetch LIVE document directly from Firestore
      // This prevents "সঠিক দিল ভুল দেখায়" when page refreshes or user document hasn't loaded PIN in memory yet
      if ((!userPin || targetPin !== userPin) && user?.uid) {
        try {
          const freshUserSnap = await getDoc(doc(db, 'users', user.uid));
          if (freshUserSnap.exists()) {
            const freshData = freshUserSnap.data();
            if (freshData?.pin !== undefined && freshData?.pin !== null) {
              userPin = convertBengaliToEnglishDigits(String(freshData.pin)).trim();
            }
            if (freshData?.appLockCode !== undefined && freshData?.appLockCode !== null) {
              userAppLockCode = convertBengaliToEnglishDigits(String(freshData.appLockCode)).trim();
            }
          }
        } catch (fetchErr) {
          console.warn("Direct Firestore PIN verify fallback warning:", fetchErr);
        }
      }

      // Also check if valid PIN was previously cached on this device
      const cachedPin = typeof window !== 'undefined' ? (localStorage.getItem('amb_user_pin') || '') : '';

      const isCorrectPin = 
        (userPin && targetPin === userPin) ||
        (userAppLockCode && targetPin === userAppLockCode) ||
        (cachedPin && targetPin === cachedPin) ||
        (isAdmin && (targetPin === '6666' || targetPin === adminMasterPin));
      
      if (isCorrectPin) {
        clearLockoutState(userIdentifier);
        try {
          localStorage.setItem('amb_user_pin', targetPin);
          if (user) {
            user.pin = targetPin;
          }
        } catch (e) {}

        if (isLogoutMode) {
          onLogout();
        } else {
          onUnlock();
        }
      } else {
        const result = recordFailedAttempt(userIdentifier, 'pin');
        setLockoutInfo(result);
        if (result.isLocked) {
          setError('ভুল পিন ৩ বার দেওয়া হয়েছে! অ্যাকাউন্ট ১ ঘণ্টার জন্য লক করা হলো।');
        } else {
          setError(`ভুল পিন! আর মাত্র ${result.remainingAttempts} বার চেষ্টা করতে পারবেন।`);
        }
        setPin('');
      }
    } catch (err) {
      console.error("PIN verification error:", err);
      setError('পিন যাচাই করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySecretLock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanInput = secretCodeInput.trim();
    if (!cleanInput) {
      setError('অনুগ্রহ করে আপনার গোপন সিক্রেট পাসওয়ার্ড লিখুন!');
      return;
    }

    const lockStatus = getLockoutState(userIdentifier);
    if (lockStatus.isLocked) {
      setLockoutInfo(lockStatus);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const userAppLockCode = user?.appLockCode ? String(user.appLockCode).trim() : '';
      const userPin = user?.pin ? String(user.pin).trim() : '';

      let isAuthorized = false;
      if (userAppLockCode.length > 0) {
        // STRICT SECURITY: Must match the custom App Lock Password set during lock setup.
        isAuthorized = cleanInput === userAppLockCode;
      } else if (userPin.length > 0) {
        // Fallback to user's registered PIN only if no separate appLockCode set yet
        isAuthorized = cleanInput === userPin;
      }

      if (isAuthorized) {
        clearLockoutState(userIdentifier);
        setSecretCodeInput('');
        setLoading(false);

        if (isLogoutMode) {
          onLogout();
        } else {
          // Instant unlock (<0.05s) - fire & forget Firestore update in background
          if (user?.uid) {
            const userRef = doc(db, 'users', user.uid);
            updateDoc(userRef, {
              isAppLocked: false
            }).catch((err) => console.error("Firestore app lock update error:", err));
          }
          onUnlock();
        }
      } else {
        setLoading(false);
        const result = recordFailedAttempt(userIdentifier, 'password');
        setLockoutInfo(result);
        if (result.isLocked) {
          setError('ভুল পাসওয়ার্ড 3 বার দেওয়া হয়েছে! আপনার অ্যাকাউন্ট 1 ঘণ্টার জন্য সম্পূর্ণ লক করা হলো।');
        } else {
          if (userAppLockCode.length > 0) {
            if (cleanInput === userPin) {
              setError(`ভুল সিক্রেট পাসওয়ার্ড! এটি অ্যাপ্সের গোপন পাসওয়ার্ড, পিন নয়। আর মাত্র ${result.remainingAttempts} বার চেষ্টা করা যাবে।`);
            } else {
              setError(`ভুল সিক্রেট পাসওয়ার্ড! আর মাত্র ${result.remainingAttempts} বার সুযোগ বাকি।`);
            }
          } else {
            setError(`ভুল গোপন পাসওয়ার্ড! আর মাত্র ${result.remainingAttempts} বার সুযোগ বাকি।`);
          }
        }
        setSecretCodeInput('');
      }
    } catch (err: any) {
      console.error("Failed to verify secret lock code:", err);
      setError('কোড যাচাই করতে সমস্যা হয়েছে। ইন্টারনেট চেক করুন।');
      setLoading(false);
    }
  };

  const isSecretLocked = !!user?.isAppLocked;

  if (lockoutInfo.isLocked) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center p-4 z-50">
        <div className="w-full max-w-sm">
          <LockoutScreen
            identifier={userIdentifier}
            initialRemainingSeconds={lockoutInfo.remainingSeconds}
            reason={lockoutInfo.reason}
            onUnlocked={() => {
              setLockoutInfo({
                isLocked: false,
                remainingSeconds: 0,
                failedAttempts: 0,
                pinAttempts: 0,
                passwordAttempts: 0
              });
              setError('');
            }}
            onBack={() => {
              onLogout();
            }}
            appLanguage={appLanguage}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-between py-8 px-6 overflow-y-auto select-none font-sans text-slate-800 z-40">
      {/* Soft Decorative Ambient Background */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content Area */}
      <div className="w-full max-w-sm flex flex-col items-center my-auto space-y-4 relative z-10">
        {/* Branding / Logo */}
        <div className="flex flex-col items-center gap-1.5 mb-1 mt-1 shrink-0">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-1 p-1 border border-slate-200/80 shadow-md overflow-hidden shrink-0">
            {appConfig?.logoUrl ? (
              <img src={appConfig.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
            ) : (
              <AMBLogo className="w-11 h-11 text-emerald-700 filter drop-shadow-xs" />
            )}
          </div>
          <h1 className="text-base font-black tracking-wider text-emerald-850 uppercase text-center">
            {appConfig?.appName || 'AMB BUSINESS NETWORK BANGLADESH'}
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">DIGITAL SAMITY SYSTEM</p>
        </div>

        {isSecretLocked ? (
          /* ========================================================= */
          /* 2ND STEP SECRET APP LOCK UI (6-12 ডিজিট/অক্ষরের গোপন পাসওয়ার্ড) */
          /* ========================================================= */
          <div className="w-full bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xl space-y-4 text-left relative overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-700 shadow-xs">
                <LockKeyhole className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                  🔒 2য় ধাপের গোপন অ্যাপ লক
                </span>
                <h2 className="text-base font-black text-slate-900 mt-0.5">{user.name || 'গ্রাহক'}</h2>
                <p className="text-[11px] font-mono font-bold text-slate-600">ID: {user.memberId}</p>
              </div>
            </div>

            {/* Lock Instruction Banner */}
            <div className={`p-3 rounded-2xl text-[11px] leading-relaxed font-medium ${isLogoutMode ? 'bg-rose-50 border border-rose-200 text-rose-900' : 'bg-amber-50 border border-amber-200/80 text-amber-900'}`}>
              ⚠️ <strong>{isLogoutMode ? 'লগআউট সিকিউরিটি যাচাই:' : 'সিক্রেট কোডে ব্লক করা আছে!'}</strong> {isLogoutMode ? 'অ্যাপ থেকে সম্পূর্ণ লগআউট হয়ে বের হতে আপনার সিক্রেট পাসওয়ার্ড কোডটি দিন। সঠিক কোড দিলেই স্বয়ংক্রিয়ভাবে লগআউট হয়ে যাবে।' : 'এই অ্যাকাউন্টটি সিক্রেট পাসওয়ার্ড কোডে লক করা হয়েছে। অ্যাপসের কোনো সেকশনে প্রবেশ করতে বা লেনদেন চালাতে পাসওয়ার্ডটি দিয়ে আগে আনলক করুন।'}
            </div>

            {/* Pending Admin Unlock Request Banner */}
            {user.appLockResetRequested && user.appLockResetStatus === 'pending' && (
              <div className="bg-sky-50 border border-sky-200 p-3 rounded-2xl text-[11px] text-sky-900 leading-relaxed font-bold flex items-start gap-2 shadow-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping shrink-0 mt-1" />
                <div>
                  <strong>⏳ আনলক রিকোয়েস্ট পেন্ডিং:</strong> আপনার সিক্রেট পাসওয়ার্ড আনলক রিকোয়েস্ট এডমিনের পর্যালোচনায় রয়েছে। এডমিন যাচাই করে এপ্রুভ করার সাথে সাথে আপনার অ্যাপস স্বয়ংক্রিয়ভাবে আনলক হয়ে যাবে।
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Secret Code Form */}
            <form onSubmit={handleVerifySecretLock} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  গোপন লকিং কোড (4 - 12 ডিজিট/অক্ষর)
                </label>
                <div className="relative">
                  <input
                    type={showSecretCode ? 'text' : 'password'}
                    value={secretCodeInput}
                    onChange={(e) => setSecretCodeInput(e.target.value)}
                    maxLength={12}
                    placeholder="6-12 অক্ষরের পাসওয়ার্ড কোডটি লিখুন"
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    autoFocus
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowSecretCode(!showSecretCode)}
                    className="absolute right-3 top-3 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  >
                    {showSecretCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400 font-bold px-1">
                  <span>সর্বনিম্ন 4, সর্বোচ্চ 12 ডিজিট/অক্ষর</span>
                  <span>{secretCodeInput.length}/12</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || secretCodeInput.length < 1}
                className={`w-full py-3 px-4 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${isLogoutMode ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-rose-600/20' : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-600/20'}`}
              >
                {loading ? (
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    {isLogoutMode ? '🔒 পাসওয়ার্ড দিয়ে লগআউট করুন (Log Out)' : 'অ্যাপস আনলক করুন (Unlock App)'}
                  </>
                )}
              </button>
            </form>

            {/* Cancel Logout Button when in Logout Mode */}
            {isLogoutMode && onCancelLogout && (
              <button
                type="button"
                onClick={onCancelLogout}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer text-center"
              >
                ❌ বাতিল করে অ্যাপে থাকুন
              </button>
            )}

            {/* Forgot Lock Code WhatsApp Link */}
            <button
              type="button"
              onClick={() => { setShowForgotPinModal(true); setResetError(''); setResetMessage(''); }}
              className="w-full text-center text-amber-900 hover:text-amber-950 text-[10.5px] font-extrabold tracking-wide cursor-pointer py-2 px-3 bg-amber-50 border border-amber-200/80 rounded-xl hover:bg-amber-100 transition-all block"
            >
              🔑 সিক্রেট লক পাসওয়ার্ড ভুলে গেছেন? হেল্পলাইনে কথা বলুন (01865911728)
            </button>

            {/* Logout button if NOT already in logout mode */}
            {!isLogoutMode && (
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 font-bold cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  অন্য অ্যাকাউন্ট দিয়ে লগইন
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* STANDARD 4-DIGIT PIN LOCK UI */
          /* ========================================================= */
          <>
            {/* User Card */}
            <div className="flex flex-col items-center gap-1 mb-1 text-center shrink-0 w-full max-w-[300px]">
              <div className="w-13 h-13 bg-emerald-100/70 border border-emerald-200 rounded-full flex items-center justify-center text-emerald-700 shadow-xs mb-1">
                <KeyRound className="w-6 h-6 text-emerald-700" />
              </div>
              <span className="text-[10.5px] font-extrabold text-emerald-800 uppercase tracking-widest bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200 shadow-2xs">নিরাপত্তা লক</span>
              <h2 className="text-lg font-black text-slate-900 tracking-tight mt-1">{user.name || 'সদস্য'}</h2>
              <div className="flex items-center gap-2 justify-center">
                <p className="text-[11px] font-mono font-bold text-slate-800 bg-white px-3 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                  {user.memberId || localStorage.getItem('amb_user_member_id') || 'AMB00000000'}
                </p>
                {user.phone && (
                  <p className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                    {user.phone}
                  </p>
                )}
              </div>
            </div>

            {/* PIN Input Circles */}
            <div className="flex flex-col items-center gap-1 mb-1 shrink-0 w-full">
              <div className="flex justify-center gap-4 py-1">
                {[0, 1, 2, 3].map((index) => (
                  <motion.div
                    key={index}
                    animate={error ? { x: [0, -4, 4, -4, 4, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-200 ${
                      index < pin.length
                        ? 'bg-emerald-600 border-emerald-600 shadow-xs scale-110'
                        : 'bg-white border-slate-300'
                    }`}
                  />
                ))}
              </div>
              
              {/* Error Message Space - RIGID FIXED HEIGHT TO ABSOLUTELY PREVENT ANY KEYPAD LAYOUT SHIFT */}
              <div className="h-12 w-full max-w-[300px] flex items-center justify-center text-center px-1 shrink-0">
                {error ? (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-[11px] leading-tight font-bold bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-xl shadow-2xs max-w-full"
                  >
                    ⚠️ {error}
                  </motion.span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">
                    ৪ ডিজিট ট্রানজেকশন পিন কোড দিন
                  </span>
                )}
              </div>
            </div>

            {/* Tactile PIN Pad Grid */}
            <div className="grid grid-cols-3 gap-y-3 gap-x-5 mb-2 w-full max-w-[300px] shrink-0">
              {[
                { bd: '1', en: '1' },
                { bd: '2', en: '2' },
                { bd: '3', en: '3' },
                { bd: '4', en: '4' },
                { bd: '5', en: '5' },
                { bd: '6', en: '6' },
                { bd: '7', en: '7' },
                { bd: '8', en: '8' },
                { bd: '9', en: '9' },
                { bd: 'C', en: 'Clear', isAction: true },
                { bd: '0', en: '0' },
                { bd: '⌫', en: 'Backspace', isAction: true }
              ].map((key) => (
                <motion.button
                  key={key.en}
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (key.en === 'Clear') {
                      handleClear();
                    } else if (key.en === 'Backspace') {
                      handleBackspace();
                    } else {
                      handleKeyPress(key.en);
                    }
                  }}
                  className={`h-13 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border shadow-2xs ${
                    key.isAction
                      ? 'bg-slate-100 border-slate-250 text-slate-700 hover:bg-slate-200 hover:text-slate-900 font-bold'
                      : 'bg-white border-slate-250 text-slate-900 hover:bg-emerald-50 hover:border-emerald-300 font-black'
                  }`}
                >
                  <span className={`font-bold ${key.isAction ? 'text-xs' : 'text-xl font-mono'}`}>{key.bd}</span>
                </motion.button>
              ))}
            </div>

            {/* Forgot PIN / Password Helpline Notice */}
            <button
              type="button"
              onClick={() => { setShowForgotPinModal(true); setResetError(''); setResetMessage(''); }}
              className="block text-amber-900 hover:text-amber-950 mt-0.5 mb-1 text-[10.5px] font-extrabold tracking-wide cursor-pointer mx-auto bg-amber-50 border border-amber-200/80 py-1.5 px-3.5 rounded-full hover:bg-amber-100 active:scale-95 transition-all shrink-0 text-center shadow-2xs"
            >
              🔑 পাসওয়ার্ড পরিবর্তন করতে হোয়াটসঅ্যাপে মেসেজ দিন (01865911728)
            </button>

            {/* Footer actions */}
            <div className="flex justify-between items-center w-full max-w-[300px] border-t border-slate-200 pt-3 px-1 text-xs shrink-0">
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition-all font-bold cursor-pointer active:scale-95 shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                অন্য অ্যাকাউন্ট
              </button>
              
              <button
                type="button"
                onClick={() => handleVerifyPin(pin)}
                disabled={loading || pin.length !== 4}
                className="flex items-center gap-1.5 text-emerald-800 hover:text-emerald-900 transition-colors font-black disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold animate-pulse text-emerald-800">অটো যাচাই হচ্ছে...</span>
                    <div className="w-4 h-4 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : pin.length === 4 ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold animate-pulse text-emerald-800">অটো লগইন...</span>
                    <div className="w-4 h-4 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    প্রবেশ করুন
                    <ArrowRight className="w-4 h-4 animate-pulse" />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Forgot PIN / Password Helpline Info Modal */}
      <AnimatePresence>
        {showForgotPinModal && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-xs font-sans text-slate-800 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-sm border border-slate-100"
            >
              <div className="bg-amber-900 text-white p-5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-300" />
                  <span className="font-bold text-sm">পাসওয়ার্ড / পিন রিসেট সার্ভিস</span>
                </div>
                <button 
                  onClick={() => setShowForgotPinModal(false)}
                  className="p-1 hover:bg-amber-800 text-amber-200 hover:text-white rounded-full transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-center">
                <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto border border-amber-300">
                  <KeyRound className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-black text-slate-900">এডমিন আনলক সার্ভিস</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    আপনি যদি পাসওয়ার্ড ভুলে গিয়ে থাকেন, তবে নিচে "এডমিনের কাছে আনলক রিকোয়েস্ট পাঠান" বাটনে ক্লিক করুন। এডমিন আপনার তথ্য ভেরিফাই করে এপ্রুভ করলেই অ্যাপস আনলক হয়ে যাবে।
                  </p>
                </div>

                {resetMessage && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-2xl text-xs font-bold text-left flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{resetMessage}</span>
                  </div>
                )}

                {resetError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs font-bold text-left flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{resetError}</span>
                  </div>
                )}

                {user && (
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-left font-sans text-xs text-slate-700 space-y-1">
                    <p>👤 <strong>সদস্য নামঃ</strong> {user.name || 'সদস্য'}</p>
                    <p>🆔 <strong>সদস্য আইডিঃ</strong> <span className="font-mono text-slate-900 font-black">{user.memberId}</span></p>
                    <p>📞 <strong>মোবাইলঃ</strong> <span className="font-mono text-slate-900 font-black">{maskSecretPhone(user.phone)}</span></p>
                  </div>
                )}

                {/* Primary Action 1: Send Request to Admin */}
                <button
                  type="button"
                  onClick={handleSendAdminUnlockRequest}
                  disabled={resetLoading || user?.appLockResetRequested}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-black text-xs rounded-2xl transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {resetLoading ? (
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : user?.appLockResetRequested ? (
                    <>
                      <Check className="w-4 h-4" />
                      আনলক রিকোয়েস্ট এডমিনের কাছে পাঠানো আছে
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      📩 এডমিনের কাছে আনলক রিকোয়েস্ট পাঠান
                    </>
                  )}
                </button>

                {/* Primary Action 2: WhatsApp Hotline */}
                <a
                  href={`https://wa.me/8801865911728?text=${encodeURIComponent(`হ্যালো এডমিন, আমার অ্যাপ লক পাসওয়ার্ড পরিবর্তন/আনলক করা প্রয়োজন।\nসদস্য নাম: ${user?.name || ''}\nসদস্য আইডি: ${user?.memberId || ''}\nমোবাইল: ${user?.phone || ''}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-2xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  💬 হোয়াটসঅ্যাপে সরাসরি মেসেজ দিন (01865911728)
                </a>

                <button
                  type="button"
                  onClick={() => setShowForgotPinModal(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
