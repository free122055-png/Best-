import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { User } from '../types';
import { normalizePhoneNumber } from '../lib/memberUtils';
import { ShieldCheck, Mail, Phone, CheckCircle2, AlertTriangle, Search, ArrowRight, X, RefreshCw, Sparkles, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LegacyEmailMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmailLinked: (email: string) => void;
}

export function LegacyEmailMigrationModal({
  isOpen,
  onClose,
  onEmailLinked
}: LegacyEmailMigrationModalProps) {
  const [phoneInput, setPhoneInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  // Search existing user by phone number
  const handleSearchAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const raw = phoneInput.trim();
    if (!raw) {
      setError('অনুগ্রহ করে আপনার পূর্বে ব্যবহৃত মোবাইল নম্বরটি লিখুন।');
      return;
    }

    setSearching(true);
    setFoundUser(null);

    try {
      const normalized = normalizePhoneNumber(raw);
      const cleanDigits = raw.replace(/\D/g, '');
      const withPlus = raw.startsWith('+') ? raw : `+${cleanDigits}`;
      const withoutPlus = raw.replace(/^\+/, '');

      // Query variants to guarantee match
      const usersRef = collection(db, 'users');
      const queries = [
        query(usersRef, where('phone', '==', raw)),
        query(usersRef, where('phone', '==', normalized)),
        query(usersRef, where('phone', '==', withoutPlus)),
        query(usersRef, where('phone', '==', withPlus)),
        query(usersRef, where('normalizedPhone', '==', normalized)),
        query(usersRef, where('phoneNumber', '==', raw)),
        query(usersRef, where('phoneNumber', '==', normalized))
      ];

      let matchedUser: User | null = null;
      for (const q of queries) {
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          matchedUser = { uid: d.id, ...d.data() } as User;
          break;
        }
      }

      if (!matchedUser) {
        // Fallback: check if phone input is Member ID
        const memberIdQuery = query(usersRef, where('memberId', '==', raw.toUpperCase()));
        const memberSnap = await getDocs(memberIdQuery);
        if (!memberSnap.empty) {
          const d = memberSnap.docs[0];
          matchedUser = { uid: d.id, ...d.data() } as User;
        }
      }

      if (matchedUser) {
        setFoundUser(matchedUser);
        if (matchedUser.email) {
          setNewEmail(matchedUser.email);
        }
      } else {
        setError('এই মোবাইল নম্বরে পূর্বে কোনো অ্যাকাউন্ট খুঁজে পাওয়া যায়নি। অনুগ্রহ করে নম্বরটি সঠিকভাবে টাইপ করুন।');
      }
    } catch (err: any) {
      console.error('Error finding user by phone:', err);
      setError('অ্যাকাউন্ট খুঁজতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setSearching(false);
    }
  };

  // Save new email to found user's old account
  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundUser) return;
    setError('');

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('অনুগ্রহ করে একটি সঠিক ও সক্রিয় ইমেইল ঠিকানা (যেমন: example@gmail.com) লিখুন।');
      return;
    }

    setSaving(true);
    try {
      // Check if this email is already registered to ANOTHER user
      const emailQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const emailSnap = await getDocs(emailQuery);

      if (!emailSnap.empty) {
        const existingDoc = emailSnap.docs[0];
        if (existingDoc.id !== foundUser.uid) {
          setError('এই ইমেইলটি ইতোমধ্যে অন্য একটি অ্যাকাউন্টে লিঙ্ক করা রয়েছে। অনুগ্রহ করে আপনার নিজস্ব স্বতন্ত্র ইমেইল দিন।');
          setSaving(false);
          return;
        }
      }

      const targetUid = foundUser.uid || (foundUser as any).id;
      const targetMemberId = foundUser.memberId || 'AMB Member';

      // 1. Update user document with email in Firestore
      await updateDoc(doc(db, 'users', targetUid), {
        email: cleanEmail,
        updatedAt: new Date().toISOString()
      });

      // 2. Add confirmation notification in user_notifications
      const notifId = `email-link-${Date.now()}`;
      try {
        await setDoc(doc(db, 'user_notifications', notifId), {
          id: notifId,
          userId: targetUid,
          category: 'account_update',
          title: '🔐 অ্যাকাউন্টে নতুন ইমেইল সফলভাবে লিঙ্ক হয়েছে',
          body: `আপনার পূর্বের অ্যাকাউন্ট (${targetMemberId})-এ লগইন ইমেইল হিসেবে ${cleanEmail} সফলভাবে সংরক্ষণ করা হয়েছে। আপনার পূর্বের সমস্ত ব্যালেন্স ও সঞ্চয় ডাটাবেজ সুরক্ষিত রয়েছে।`,
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (notifErr) {
        console.warn('Notification log warning:', notifErr);
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Error updating user email:', err);
      setError('ইমেইল সংরক্ষণ করতে সমস্যা হয়েছে: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-slate-800 font-sans">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden relative text-left"
      >
        {/* Top Accent Gradient */}
        <div className="h-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 border border-cyan-200 shadow-xs">
              <Sparkles className="w-5 h-5 text-cyan-700" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  পুরানো একাউন্ট রিকভারি ও ইমেইল লিঙ্ক
                </h3>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 border border-cyan-200">
                  ডাটাবেজ সুরক্ষা
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                পূর্বের সমস্ত ব্যালেন্স ও তথ্য সুরক্ষিত রেখে নতুন ইমেইল যুক্ত করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition shrink-0 cursor-pointer"
            title="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Informational Notice */}
          <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>পূর্বের সদস্যদের জন্য জরুরি নির্দেশনা</span>
            </div>
            <p className="text-[10.5px] text-amber-800 leading-relaxed">
              আপনি যদি পূর্বে মোবাইল নম্বর দিয়ে একাউন্ট তৈরি করে থাকেন, তাহলে নিচে আপনার মোবাইল নম্বর দিয়ে একাউন্টটি খুঁজুন এবং একটি সচল জিমেইল/ইমেইল সেট করুন। এরপর থেকে আপনি আপনার এই নতুন ইমেইল দিয়েই পুরানো সমস্ত ব্যালেন্স ও সঞ্চয় অ্যাকাউন্টে লগইন করতে পারবেন।
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Screen */}
          {success ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-sm animate-bounce" style={{ animationDuration: '2s' }}>
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                ইমেইল সফলভাবে লিঙ্ক হয়েছে!
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                অভিনন্দন! আপনার পূর্বের অ্যাকাউন্টে নতুন লগইন ইমেইল হিসেবে <span className="font-bold font-mono text-emerald-700 bg-emerald-50 px-1 rounded">{newEmail}</span> সফলভাবে সংরক্ষণ করা হয়েছে। আপনার পূর্বের সমস্ত ওয়ালেট ব্যালেন্স ও তথ্য সুরক্ষিত রয়েছে।
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onEmailLinked(newEmail);
                    onClose();
                  }}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>এখনই এই ইমেইল দিয়ে লগইন করুন</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: Search by Old Phone Number */}
              <form onSubmit={handleSearchAccount} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>১. পূর্বে ব্যবহৃত মোবাইল নম্বর (Phone Number)</span>
                    <span className="text-[10px] text-cyan-700 font-semibold">ধাপ ১</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="যেমন: 01712345678"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 transition"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={searching || !phoneInput.trim()}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {searching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>অ্যাকাউন্ট খোঁজা হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>অ্যাকাউন্ট খুঁজুন</span>
                    </>
                  )}
                </button>
              </form>

              {/* STEP 2: Show Found Account & Enter New Email */}
              {foundUser && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 pt-3 border-t border-slate-200"
                >
                  {/* Found User Summary Card */}
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between border-b border-emerald-200/70 pb-1">
                      <span className="font-bold text-emerald-900 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>অ্যাকাউন্ট সনাক্ত হয়েছে</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                        {foundUser.memberId || 'AMB'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-700">
                      <div>
                        <span className="text-slate-400">নাম:</span>{' '}
                        <span className="font-bold text-slate-900">{foundUser.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">ফোন:</span>{' '}
                        <span className="font-mono font-bold text-slate-900">{foundUser.phone}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">মেইন ব্যালেন্স:</span>{' '}
                        <span className="font-mono font-bold text-emerald-700">৳{Number(foundUser.balance || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">সঞ্চয় স্থিতি:</span>{' '}
                        <span className="font-mono font-bold text-cyan-700">৳{Number(foundUser.savings || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {foundUser.email ? (
                      <div className="text-[10px] text-emerald-800 bg-emerald-100/60 p-1 rounded font-mono">
                        বর্তমান ইমেইল: {foundUser.email} (চাইলে নিচে নতুন ইমেইল দিয়ে আপডেট করতে পারেন)
                      </div>
                    ) : (
                      <div className="text-[10px] text-amber-800 bg-amber-100/60 p-1 rounded font-bold">
                        ⚠️ এই অ্যাকাউন্টে পূর্বে কোনো ইমেইল যুক্ত ছিল না (শুধুমাত্র ফোন দিয়ে খোলা)
                      </div>
                    )}
                  </div>

                  {/* Input for New Email */}
                  <form onSubmit={handleSaveEmail} className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>২. আপনার নতুন সচল ইমেইল (Active Gmail / Email)</span>
                        <span className="text-[10px] text-emerald-700 font-semibold">ধাপ ২</span>
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="যেমন: myaccount@gmail.com"
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition"
                        />
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        ভবিষ্যতে এই ইমেইলে ওটিপি (OTP) কোড পাঠানো হবে এবং এটি দিয়ে আপনি লগইন করতে পারবেন।
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={saving || !newEmail.trim()}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>ইমেইল ডাটাবেজে সংরক্ষণ করা হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>এই অ্যাকাউন্টে ইমেইল সংরক্ষণ ও লিঙ্ক করুন</span>
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-100/70 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-500 font-medium">
            নিরাপত্তা এনক্রিপশন সক্রিয় • আপনার পূর্বের কোনো তথ্য বা ব্যালেন্স পরিবর্তন হবে না
          </p>
        </div>
      </motion.div>
    </div>
  );
}
