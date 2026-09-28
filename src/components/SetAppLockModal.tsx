import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Lock, Eye, EyeOff, ShieldCheck, X, AlertTriangle, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SetAppLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onLockSuccess: (secretCode: string) => void;
  appLanguage?: string;
  isMandatoryOnLogout?: boolean;
}

export default function SetAppLockModal({
  isOpen,
  onClose,
  user,
  onLockSuccess,
  appLanguage = 'bn',
  isMandatoryOnLogout = false
}: SetAppLockModalProps) {
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [showConfirmCode, setShowConfirmCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCode = code.trim();
    const cleanConfirm = confirmCode.trim();

    if (cleanCode.length < 4 || cleanCode.length > 12) {
      setError('পাসওয়ার্ডটি অবশ্যই 4 থেকে 12 অক্ষরের/সংখ্যার হতে হবে!');
      return;
    }

    if (cleanCode !== cleanConfirm) {
      setError('পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড দুটির মিল নেই!');
      return;
    }

    setLoading(true);

    // Save to Firestore asynchronously
    if (user?.uid) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          password: cleanCode,
          appLockCode: cleanCode,
          isAppLocked: true,
          appLockResetRequested: false,
          appLockResetStatus: '',
          appLockUpdatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to save app lock code to Firestore:", err);
      }
    }

    setCode('');
    setConfirmCode('');
    setLoading(false);
    onLockSuccess(cleanCode);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs font-sans text-slate-800">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-100 relative text-left overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className={`w-9 h-9 rounded-xl ${isMandatoryOnLogout ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'} border flex items-center justify-center shrink-0`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1">
                {isMandatoryOnLogout ? '🔒 নিরাপদ লগআউট ও পাসওয়ার্ড লক' : '🔒 গোপন অ্যাপ লক সেটআপ'}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {isMandatoryOnLogout ? 'লগআউটের পর পুনরায় এই পাসওয়ার্ড দিয়ে লগইন করতে হবে' : 'সিকিউরিটি পাসওয়ার্ড (4 - 12 ডিজিট/অক্ষর)'}
              </p>
            </div>
          </div>

          {/* Warning / Instructions Box */}
          <div className={`${isMandatoryOnLogout ? 'bg-rose-50/80 border-rose-200 text-rose-900' : 'bg-amber-50/80 border-amber-200 text-amber-900'} border p-2.5 rounded-xl text-[10.5px] leading-relaxed mb-3 flex items-start gap-2 shadow-xs`}>
            <AlertTriangle className={`w-3.5 h-3.5 ${isMandatoryOnLogout ? 'text-rose-600' : 'text-amber-600'} shrink-0 mt-0.5`} />
            <div>
              {isMandatoryOnLogout ? (
                <span><strong>বাধ্যতামূলক নিয়ম:</strong> লগআউট করতে 4-12 অক্ষরের একটি পাসওয়ার্ড সেট/কনফার্ম করুন। পুনরায় অ্যাপে লগইন করতে <strong>হুবহু এই পাসওয়ার্ডটি</strong> প্রয়োজন হবে।</span>
              ) : (
                <span><strong>গুরুত্বপূর্ণ নিয়ম:</strong> 4-12 অক্ষরের একটি সিক্রেট পাসওয়ার্ড সেট করুন। অ্যাপ লক আনলক করতে এই পাসওয়ার্ডটি দিতে হবে।</span>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2 rounded-xl text-[11px] font-bold mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-2.5">
            {/* Input 1 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                সিকিউরিটি পাসওয়ার্ড (4 - 12 অক্ষর/সংখ্যা) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCode ? 'text' : 'password'}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={12}
                  placeholder="যেমন: amb987654 বা 1234"
                  className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                  required
                />
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  {showCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Input 2 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                পাসওয়ার্ডটি পুনরায় নিশ্চিত করুন <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmCode ? 'text' : 'password'}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  maxLength={12}
                  placeholder="কনফার্ম পাসওয়ার্ড লিখুন"
                  className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                  required
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowConfirmCode(!showConfirmCode)}
                  className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  {showConfirmCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Submit & Cancel Actions */}
            <div className="pt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-1/3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer text-center"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`w-2/3 py-2 px-3 ${isMandatoryOnLogout ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20'} text-white font-extrabold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5`}
              >
                {loading ? (
                  <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    {isMandatoryOnLogout ? 'লক করে লগআউট করুন' : 'অ্যাপ লক করুন'}
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
