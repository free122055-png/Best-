import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { sendEmailOtpDirect } from '../lib/emailOtpService';
import { convertBengaliToEnglishDigits } from '../lib/memberUtils';
import { 
  X, 
  KeyRound, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Mail, 
  RotateCw, 
  ShieldCheck 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  locateUser: (input: string) => Promise<User | null>;
}

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  onLoginSuccess,
  locateUser
}: ForgotPasswordModalProps) {
  // Step: 1 = Enter Account/Phone/Email, 2 = Verify OTP, 3 = Set New Password, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [inputVal, setInputVal] = useState('');
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [countdown, setCountdown] = useState(60);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: any;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  if (!isOpen) return null;

  const maskEmailAddress = (em: string) => {
    const parts = em.split('@');
    if (parts.length !== 2) return em;
    const namePart = parts[0];
    const masked = namePart.length > 2 
      ? `${namePart.slice(0, 2)}••••${namePart.slice(-1)}` 
      : `${namePart}•`;
    return `${masked}@${parts[1]}`;
  };

  // Step 1: Request OTP for Account
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const raw = inputVal.trim();
    if (!raw) {
      setError('অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল অ্যাড্রেস প্রদান করুন।');
      return;
    }

    if (raw.toUpperCase().includes('BNB') || (!raw.includes('@') && /^\d+$/.test(raw))) {
      setError('BNB কোড বা অ্যাকাউন্ট নম্বর দিয়ে পাসওয়ার্ড রিসেট সম্পূর্ণ নিষিদ্ধ। অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল অ্যাড্রেস দিন।');
      return;
    }

    if (!raw.includes('@')) {
      setError('অনুগ্রহ করে আপনার সঠিক নিবন্ধিত ইমেইল অ্যাড্রেস দিন (যেমন: name@gmail.com)।');
      return;
    }

    setLoading(true);

    try {
      const user = await locateUser(raw);
      if (!user) {
        setError('প্রদত্ত ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। সঠিক নিবন্ধিত ইমেইল অ্যাড্রেস দিন।');
        setLoading(false);
        return;
      }

      setTargetUser(user);

      // Determine target email
      let userEmail = user.email ? user.email.trim().toLowerCase() : '';
      if (!userEmail && raw.includes('@')) {
        userEmail = raw.toLowerCase();
      }

      if (!userEmail) {
        setError('আপনার অ্যাকাউন্টে কোনো ইমেইল ঠিকানা যুক্ত নেই। পাসওয়ার্ড রিসেটের জন্য অনুগ্রহ করে হেল্পলাইন অথবা অ্যাডমিনের সাথে যোগাযোগ করুন।');
        setLoading(false);
        return;
      }

      setResolvedEmail(userEmail);
      setMaskedEmail(maskEmailAddress(userEmail));

      // Generate authentic 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);

      // Multi-channel dispatch (Fast non-blocking)
      sendEmailOtpDirect({
        email: userEmail,
        otp: code,
        userName: user.name || 'সম্মানিত সদস্য',
        phone: user.phone || '',
        memberId: user.memberId || raw,
        userId: user.uid,
        reason: 'forgot_password'
      }).catch(() => {});

      // Also attempt SMS via Firebase Phone Auth in background if phone is available
      if (user.phone) {
        let formattedPhone = user.phone;
        const rawDigits = convertBengaliToEnglishDigits(user.phone).replace(/\D/g, '');
        if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
          formattedPhone = `+88${rawDigits}`;
        } else if (rawDigits.length === 10) {
          formattedPhone = `+880${rawDigits}`;
        } else if (rawDigits.startsWith('880')) {
          formattedPhone = `+${rawDigits}`;
        }
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

      setStep(2);
      setCountdown(60);
      setSuccessMsg(`আপনার ইমেইল ${maskEmailAddress(userEmail)}-এ ৬ সংখ্যার ওটিপি কোড পাঠানো হয়েছে।`);
    } catch (err: any) {
      console.error('[Forgot Password Error]:', err);
      setError('ওটিপি পাঠাতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanOtp = convertBengaliToEnglishDigits(otpCode).trim();

    if (cleanOtp.length !== 6) {
      setError('অনুগ্রহ করে ৬-সংখ্যার সঠিক ওটিপি কোড প্রদান করুন।');
      return;
    }

    setLoading(true);

    try {
      let isVerified = false;

      // 1. Check generated email OTP
      if (generatedOtp && cleanOtp === generatedOtp.trim()) {
        isVerified = true;
      }

      // 2. Fallback check Firebase Phone Auth confirmation
      if (!isVerified && confirmationResult) {
        try {
          await confirmationResult.confirm(cleanOtp);
          isVerified = true;
        } catch (confirmErr) {
          console.warn('[Confirmation Result Mismatch]:', confirmErr);
        }
      }

      if (isVerified) {
        setStep(3);
        setError('');
        setSuccessMsg('ওটিপি সফলভাবে যাচাই হয়েছে। এবার আপনার নতুন পাসওয়ার্ড সেট করুন।');
      } else {
        setError('ভুল ওটিপি কোড! অনুগ্রহ করে আপনার ইমেইল ইনবক্স বা স্প্যাম ফোল্ডার চেক করে সঠিক কোড দিন।');
      }
    } catch (err: any) {
      console.error('[OTP Verify Error]:', err);
      setError('ওটিপি যাচাইয়ে ত্রুটি হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in Step 2
  const handleResendOtp = async () => {
    if (countdown > 0 || !resolvedEmail || !targetUser) return;
    setLoading(true);
    setError('');

    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);

      await sendEmailOtpDirect({
        email: resolvedEmail,
        otp: code,
        userName: targetUser.name || 'সম্মানিত সদস্য',
        phone: targetUser.phone || '',
        memberId: targetUser.memberId || '',
        userId: targetUser.uid,
        reason: 'forgot_password'
      });

      setCountdown(60);
      setSuccessMsg(`নতুন ওটিপি কোড পাঠানো হয়েছে: ${maskedEmail}`);
    } catch (e) {
      setError('পুনরায় ওটিপি পাঠাতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Save New Password & Auto Login
  const handleSavePasswordAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPass = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (cleanPass.length < 4) {
      setError('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setError('নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড দুটির মিল নেই!');
      return;
    }

    if (!targetUser?.uid) {
      setError('ইউজার তথ্য পাওয়া যায়নি। প্রথম থেকে শুরু করুন।');
      return;
    }

    setLoading(true);

    try {
      const userRef = doc(db, 'users', targetUser.uid);

      // Update password & app lock code in Firestore
      await updateDoc(userRef, {
        password: cleanPass,
        appLockCode: cleanPass,
        updatedAt: new Date().toISOString()
      });

      // In-app activity notification
      addDoc(collection(db, 'user_notifications'), {
        userId: targetUser.uid,
        title: '🔑 পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে',
        body: 'আপনার অ্যাকাউন্টের নতুন পাসওয়ার্ড সক্রিয় করা হয়েছে এবং স্বয়ংক্রিয়ভাবে লগইন করা হয়েছে।',
        category: 'security',
        createdAt: new Date().toISOString()
      }).catch(() => {});

      const updatedUser: User = {
        ...targetUser,
        password: cleanPass,
        appLockCode: cleanPass
      };

      setStep(4);
      setSuccessMsg('পাসওয়ার্ড সফলভাবে সেট করা হয়েছে! সরাসরি অ্যাকাউন্টে প্রবেশ করা হচ্ছে...');

      // Auto-login into software immediately
      setTimeout(() => {
        try {
          localStorage.setItem('amb_user_phone', updatedUser.phone || '');
          localStorage.setItem('amb_user_uid', updatedUser.uid);
          localStorage.setItem('amb_user_name', updatedUser.name || '');
          localStorage.setItem('amb_user_member_id', updatedUser.memberId || '');
          localStorage.setItem('amb_user_role', updatedUser.role || 'user');
          localStorage.setItem('amb_last_user', JSON.stringify(updatedUser));
          sessionStorage.setItem('amb_session_unlocked', 'true');
        } catch (e) {}

        onLoginSuccess(updatedUser);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[Save Password Error]:', err);
      setError('পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-md border border-slate-100"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#064e3b] to-[#047857] text-white p-5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-emerald-200 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base leading-tight">পাসওয়ার্ড রিসেট (Forgot Password)</h3>
              <p className="text-[11px] text-emerald-100 font-medium">ইমেইল ভেরিফিকেশন ও স্বয়ংক্রিয় লগইন</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* STEP 1: Enter Account info */}
            {step === 1 && (
              <motion.form
                key="step-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleRequestOtp}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1.5 px-1">
                    আপনার নিবন্ধিত ইমেইল অ্যাড্রেস *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-emerald-700">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input
                      type="email"
                      required
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      placeholder="আপনার ইমেইল দিন (যেমন: name@gmail.com)"
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-full text-slate-900 text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 shadow-2xs"
                    />
                  </div>
                  <p className="text-[11px] text-amber-700 mt-1.5 px-1 font-medium">
                    ⚠️ BNB কোড বা অ্যাকাউন্ট নম্বর দিয়ে পাসওয়ার্ড রিসেট সম্পূর্ণ নিষিদ্ধ। শুধুমাত্র নিবন্ধিত ইমেইল দিন।
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0B532C] hover:bg-[#084223] text-white font-black py-3.5 px-6 rounded-full text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>ইমেইলে ওটিপি কোড পাঠান</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {/* STEP 2: Enter OTP */}
            {step === 2 && (
              <motion.form
                key="step-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleVerifyOtp}
                className="space-y-4"
              >
                <div className="text-center py-1">
                  <span className="text-[11px] font-bold text-slate-500">ভেরিফিকেশন কোড পাঠানো হয়েছে:</span>
                  <div className="text-sm font-black text-emerald-800 font-mono mt-0.5">{maskedEmail}</div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1.5 px-1 text-center">
                    ৬-সংখ্যার ওটিপি কোড দিন (Enter 6-Digit OTP)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="• • • • • •"
                    className="w-full py-3 px-4 bg-slate-50 border-2 border-slate-200 rounded-full text-slate-900 text-center font-mono text-2xl font-black tracking-widest focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-500 text-center mt-1.5 font-medium">
                    ইনবক্সে না পেলে Spam / Promotions ফোল্ডার চেক করুন।
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full bg-[#0B532C] hover:bg-[#084223] text-white font-black py-3.5 px-6 rounded-full text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>ওটিপি যাচাই করুন (Verify OTP)</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  {countdown > 0 ? (
                    <span className="text-xs text-slate-500 font-bold">
                      পুনরায় কোড পাঠাতে অপেক্ষা করুন: <span className="text-emerald-700 font-mono">{countdown}s</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center justify-center gap-1.5 mx-auto transition cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>পুনরায় ওটিপি কোড পাঠান (Resend Code)</span>
                    </button>
                  )}
                </div>
              </motion.form>
            )}

            {/* STEP 3: Set New Password */}
            {step === 3 && (
              <motion.form
                key="step-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleSavePasswordAndLogin}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1 px-1">
                    নতুন পাসওয়ার্ড (New Password) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-emerald-700">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="কমপক্ষে ৪ সংখ্যার পাসওয়ার্ড দিন"
                      className="w-full pl-11 pr-11 py-3 bg-slate-50 border-2 border-slate-200 rounded-full text-slate-900 text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 shadow-2xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1 px-1">
                    নতুন পাসওয়ার্ড নিশ্চিত করুন (Confirm Password) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-emerald-700">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="নতুন পাসওয়ার্ড পুনরায় লিখুন"
                      className="w-full pl-11 pr-11 py-3 bg-slate-50 border-2 border-slate-200 rounded-full text-slate-900 text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 shadow-2xs font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full bg-[#0B532C] hover:bg-[#084223] text-white font-black py-3.5 px-6 rounded-full text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                      <span>পাসওয়ার্ড সংরক্ষণ ও স্বয়ংক্রিয় লগইন</span>
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {/* STEP 4: Success Transition */}
            {step === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 text-center space-y-3"
              >
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700">
                  <CheckCircle2 className="w-10 h-10 stroke-[2.5] animate-bounce" />
                </div>
                <h4 className="text-base font-black text-slate-900">পাসওয়ার্ড সফলভাবে সেট হয়েছে!</h4>
                <p className="text-xs text-slate-600 font-medium">
                  আপনার অ্যাকাউন্টে স্বয়ংক্রিয়ভাবে প্রবেশ করা হচ্ছে...
                </p>
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mt-2" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
