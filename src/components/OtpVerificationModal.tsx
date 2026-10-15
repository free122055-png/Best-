import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, Clock, ArrowRight, RefreshCw, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiUrl } from '../config/api';

interface OtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  userId?: string;
  actionTitle?: string;
  actionDescription?: string;
  targetDestination?: string;
  onVerified: (payload?: any) => void;
  onResendOtp?: () => Promise<string | boolean | void>;
}

export const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({
  isOpen,
  onClose,
  sessionId: initialSessionId,
  userId,
  actionTitle = 'নিরাপত্তা ওটিপি ভেরিফিকেশন',
  actionDescription = 'সংবেদনশীল কাজের সুরক্ষায় আপনার মোবাইল বা ইমেইলে পাঠানো ৬ সংখ্যার কোড প্রদান করুন।',
  targetDestination,
  onVerified,
  onResendOtp
}) => {
  const [currentSessionId, setCurrentSessionId] = useState(initialSessionId);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes = 300 seconds
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (initialSessionId) {
      setCurrentSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  // Reset states when opened
  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setTimeLeft(300);
      setErrorMessage('');
      setSuccessMessage('');
      setIsVerifying(false);
      // Auto-focus first input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    }
  }, [isOpen, initialSessionId]);

  // 5-minute Countdown Timer
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timeLeft]);

  // Format mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, '');
    const char = cleaned.slice(-1);

    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setErrorMessage('');

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify if all 6 digits entered
    if (char && index === 5) {
      const fullCode = newDigits.join('');
      if (fullCode.length === 6) {
        verifyCode(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setDigits(newDigits);
      setErrorMessage('');
      if (pasted.length === 6) {
        verifyCode(pasted);
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
    }
  };

  const handleAutoPasteFromClipboard = async () => {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        const cleaned = text.replace(/\D/g, '').slice(0, 6);
        if (cleaned) {
          const newDigits = ['', '', '', '', '', ''];
          for (let i = 0; i < cleaned.length; i++) {
            newDigits[i] = cleaned[i];
          }
          setDigits(newDigits);
          if (cleaned.length === 6) {
            verifyCode(cleaned);
          } else {
            inputRefs.current[cleaned.length]?.focus();
          }
        }
      }
    } catch (e) {
      console.warn('Clipboard read error:', e);
    }
  };

  // Submit and verify via /api/otp/verify
  const verifyCode = async (codeToVerify?: string) => {
    const fullCode = codeToVerify || digits.join('');
    if (fullCode.length !== 6) {
      setErrorMessage('অনুগ্রহ করে সম্পূর্ণ ৬ সংখ্যার ওটিপি কোডটি লিখুন।');
      return;
    }

    if (timeLeft <= 0) {
      setErrorMessage('ওটিপি কোডের মেয়াদ শেষ হয়ে গেছে। দয়া করে পুনরায় ওটিপি পাঠান।');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await fetch(apiUrl('/api/otp/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          enteredOtp: fullCode
        })
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage('ভেরিফিকেশন সফল হয়েছে!');
        setTimeout(() => {
          onVerified(data.payload);
          onClose();
        }, 600);
      } else {
        setErrorMessage(data.message || 'প্রদত্ত ওটিপি কোডটি সঠিক নয়। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
        // Clear digits for retry
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      setErrorMessage('সার্ভারের সাথে যোগাযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (isResending) return;
    setIsResending(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (onResendOtp) {
        await onResendOtp();
        setTimeLeft(300);
        setDigits(['', '', '', '', '', '']);
        setSuccessMessage('নতুন ওটিপি কোড পাঠানো হয়েছে!');
      } else {
        const res = await fetch(apiUrl('/api/otp/resend'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentSessionId })
        });
        const data = await res.json();
        if (data.success) {
          setTimeLeft(300);
          setDigits(['', '', '', '', '', '']);
          setSuccessMessage('নতুন ওটিপি কোড সফলভাবে পাঠানো হয়েছে!');
          inputRefs.current[0]?.focus();
        } else {
          setErrorMessage(data.message || 'ওটিপি পুনরায় পাঠাতে সমস্যা হয়েছে।');
        }
      }
    } catch (err: any) {
      setErrorMessage('ওটিপি পুনরায় পাঠাতে ব্যর্থ হয়েছে।');
    } finally {
      setIsResending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-emerald-100 flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#0B532C] to-[#0D6B3C] p-5 text-white relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
                <ShieldCheck className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{actionTitle}</h3>
                <p className="text-xs text-emerald-100/90 font-medium">আর্থিক সুরক্ষা ও অ্যান্ড-টু-অ্যান্ড ভেরিফিকেশন</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            <div className="text-center space-y-1.5">
              <p className="text-xs sm:text-sm text-slate-650 leading-relaxed font-medium">
                {actionDescription}
              </p>
              {targetDestination && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold">
                  <span>📱</span>
                  <span>{targetDestination}</span>
                </div>
              )}
            </div>

            {/* Notification messages */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-2xl font-bold flex items-start gap-2 shadow-xs"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMessage}</span>
              </motion.div>
            )}

            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs p-3 rounded-2xl font-bold flex items-start gap-2 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{successMessage}</span>
              </motion.div>
            )}

            {/* 6 Digit Input Boxes */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>৬-সংখ্যার ওটিপি লিখুন:</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoPasteFromClipboard}
                  className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 transition cursor-pointer flex items-center gap-1"
                >
                  <span>📋</span>
                  <span>অটো-পেস্ট</span>
                </button>
              </div>

              <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    className={`w-full aspect-square text-center text-xl sm:text-2xl font-mono font-black rounded-2xl border-2 transition-all focus:outline-none ${
                      digit
                        ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-inner'
                        : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Timer and Countdown */}
            <div className="flex items-center justify-between px-1 text-xs">
              <div className={`flex items-center gap-1.5 font-bold ${timeLeft <= 60 ? 'text-rose-600 animate-pulse' : 'text-slate-600'}`}>
                <Clock className="w-4 h-4" />
                <span>মেয়াদ বাকি:</span>
                <span className="font-mono text-sm tracking-wider">{formatTime(timeLeft)}</span>
              </div>

              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || timeLeft > 240}
                className={`flex items-center gap-1 font-bold text-xs transition cursor-pointer ${
                  timeLeft <= 240
                    ? 'text-emerald-700 hover:text-emerald-900 underline'
                    : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                <span>পুনরায় কোড পাঠান</span>
              </button>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => verifyCode()}
              disabled={isVerifying || digits.join('').length !== 6 || timeLeft <= 0}
              className={`w-full py-4 px-6 rounded-full font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md transition cursor-pointer ${
                digits.join('').length === 6 && timeLeft > 0 && !isVerifying
                  ? 'bg-[#0B532C] hover:bg-[#084223] active:bg-[#06331B] text-white active:scale-98'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isVerifying ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>যাচাই ও কাজ সম্পন্ন করুন</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>

          {/* Footer Warning */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 font-medium">
              ওটিপি কোডটি অত্যন্ত গোপনীয়। এটি কোনো অবস্থাতেই অন্যের সাথে শেয়ার করবেন না।
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
