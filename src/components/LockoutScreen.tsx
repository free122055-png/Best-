import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, PhoneCall, MessageSquare, ExternalLink, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { formatRemainingTime, toBengaliDigits, resetLockout } from '../lib/lockoutUtils';

interface LockoutScreenProps {
  identifier?: string;
  initialRemainingSeconds: number;
  reason?: 'pin' | 'password' | string | null;
  onUnlocked: () => void;
  onBack?: () => void;
  appLanguage?: string;
}

export default function LockoutScreen({
  identifier,
  initialRemainingSeconds,
  reason = 'pin',
  onUnlocked,
  onBack,
  appLanguage = 'bn'
}: LockoutScreenProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemainingSeconds);

  useEffect(() => {
    setRemainingSeconds(initialRemainingSeconds);
  }, [initialRemainingSeconds]);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      if (identifier) {
        resetLockout(identifier, 'all');
      }
      onUnlocked();
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (identifier) {
            resetLockout(identifier, 'all');
          }
          onUnlocked();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, identifier, onUnlocked]);

  const { formattedBengali, formattedEnglish, minutes, seconds } = formatRemainingTime(remainingSeconds);

  const reasonText = reason === 'password'
    ? '3 বার ভুল সিকিউরিটি পাসওয়ার্ড দেওয়ার কারণে'
    : '3 বার ভুল সিকিউরিটি পিন দেওয়ার কারণে';

  const reasonTextEn = reason === 'password'
    ? 'Due to 3 incorrect security password attempts'
    : 'Due to 3 incorrect security PIN attempts';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-6 text-center space-y-5"
    >
      {/* Alert Icon */}
      <div className="relative mx-auto w-18 h-18 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-200 dark:border-rose-800 rounded-3xl flex items-center justify-center shadow-lg shadow-rose-500/10">
        <ShieldAlert className="w-10 h-10 text-rose-600 dark:text-rose-400 animate-pulse" />
        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-white dark:border-slate-900">
          !
        </div>
      </div>

      {/* Main Heading */}
      <div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 uppercase tracking-wider mb-2 border border-rose-200 dark:border-rose-800">
          <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
          {appLanguage === 'en' ? 'Account Temporarily Locked' : 'অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে'}
        </span>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">
          {appLanguage === 'en' ? '1-Hour Security Lockout' : '1 ঘণ্টার জন্য সিকিউরিটি লক'}
        </h3>
        <p className="text-xs text-rose-700 dark:text-rose-300 font-semibold mt-1 px-2">
          {appLanguage === 'en' ? reasonTextEn : reasonText} নিরাপত্তার স্বার্থে অ্যাকাউন্টটি 1 ঘণ্টার জন্য সাময়িকভাবে লক করা হয়েছে।
        </p>
      </div>

      {/* Live Countdown Timer Box */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white p-5 rounded-2xl border border-slate-800 shadow-xl space-y-2.5">
        <div className="flex items-center justify-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
          <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
          <span>{appLanguage === 'en' ? 'Remaining Lockout Time' : 'লক আনলক হতে বাকি সময়'}</span>
        </div>

        {/* Digital Clock display */}
        <div className="flex items-center justify-center gap-2 py-1">
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2 text-center min-w-[75px]">
            <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
              {appLanguage === 'en' ? String(minutes).padStart(2, '0') : toBengaliDigits(String(minutes).padStart(2, '0'))}
            </span>
            <span className="block text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-0.5">
              {appLanguage === 'en' ? 'MINUTES' : 'মিনিট'}
            </span>
          </div>

          <span className="text-2xl font-mono font-bold text-slate-500">:</span>

          <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2 text-center min-w-[75px]">
            <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
              {appLanguage === 'en' ? String(seconds).padStart(2, '0') : toBengaliDigits(String(seconds).padStart(2, '0'))}
            </span>
            <span className="block text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-0.5">
              {appLanguage === 'en' ? 'SECONDS' : 'সেকেন্ড'}
            </span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 font-medium">
          {appLanguage === 'en' 
            ? 'Timer resets automatically when 00:00 is reached.'
            : 'কাউন্টডাউন 0 হলে স্বয়ংক্রিয়ভাবে লক খুলে যাবে এবং পুনরায় চেষ্টা করতে পারবেন।'}
        </p>
      </div>

      {/* Admin WhatsApp Support Contact */}
      <div className="space-y-2 pt-1">
        <a
          href="https://wa.me/8801865911728?text=আসসালামু%20আলাইকুম%20এডমিন,%20আমার%20BNB%20অ্যাকাউন্টটি%20লক%20হয়ে%20গেছে।%20জরুরি%20সাহায্য%20প্রয়োজন।"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>📱 এডমিনকে মেসেজ দিয়ে দ্রুত আনলক করুন (WhatsApp)</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-1">
          <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
          <span>হেল্পলাইনঃ</span>
          <a href="tel:01865911728" className="font-mono font-bold text-slate-800 dark:text-slate-200 hover:underline">
            01865911728
          </a>
        </div>
      </div>

      {/* Back button */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-full py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded-xl text-xs transition cursor-pointer"
        >
          {appLanguage === 'en' ? 'Back to Number Entry' : 'অন্য মোবাইল নম্বর দিয়ে প্রবেশ করুন'}
        </button>
      )}
    </motion.div>
  );
}
