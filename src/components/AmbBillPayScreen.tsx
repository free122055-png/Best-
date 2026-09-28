import React, { useState } from 'react';
import { User, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { 
  ChevronLeft, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  RotateCcw, 
  Lightbulb, 
  Flame, 
  Droplet, 
  Wifi, 
  Tv, 
  Smartphone, 
  Info, 
  Image, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Trash2,
  Receipt,
  X
} from 'lucide-react';
import { motion } from 'motion/react';

interface AmbBillPayScreenProps {
  user: User;
  onBack: () => void;
  syncLiveProfile?: () => void;
  appConfig?: AppConfig | null;
}

export default function AmbBillPayScreen({ user, onBack, syncLiveProfile, appConfig }: AmbBillPayScreenProps) {
  const [billCategory, setBillCategory] = useState<string | null>(null);
  const [selectedBillProvider, setSelectedBillProvider] = useState<any | null>(null);
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [billAccNo, setBillAccNo] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billMonth, setBillMonth] = useState('June 2026');
  const [showMonthPopup, setShowMonthPopup] = useState(false);
  const [billImage, setBillImage] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Bill Providers static data list
  const billProviders = [
    // Electricity
    { id: 'palli_bidyut_prepaid', name: 'Palli Bidyut Prepaid', label: 'পল্লী বিদ্যুৎ (প্রিপেইড)', enLabel: 'Palli Bidyut (Prepaid)', category: 'electricity', iconColor: 'bg-pink-100 text-pink-600' },
    { id: 'palli_bidyut_postpaid', name: 'Palli Bidyut Postpaid', label: 'পল্লী বিদ্যুৎ (পোস্টপেইড)', enLabel: 'Palli Bidyut (Postpaid)', category: 'electricity', iconColor: 'bg-pink-100 text-pink-600' },
    { id: 'desco_prepaid', name: 'DESCO Prepaid', label: 'ডেসকো (প্রিপেইড)', enLabel: 'DESCO (Prepaid)', category: 'electricity', iconColor: 'bg-amber-100 text-amber-600' },
    { id: 'desco_postpaid', name: 'DESCO Postpaid', label: 'ডেসকো (পোস্টপেইড)', enLabel: 'DESCO (Postpaid)', category: 'electricity', iconColor: 'bg-amber-100 text-amber-600' },
    { id: 'dpdc_prepaid', name: 'DPDC Prepaid', label: 'ডিপিডিসি (প্রিপেইড)', enLabel: 'DPDC (Prepaid)', category: 'electricity', iconColor: 'bg-emerald-100 text-emerald-600' },
    { id: 'dpdc_postpaid', name: 'DPDC Postpaid', label: 'ডিপিডিসি (পোস্টপেইড)', enLabel: 'DPDC (Postpaid)', category: 'electricity', iconColor: 'bg-emerald-100 text-emerald-600' },
    { id: 'nesco_prepaid', name: 'NESCO Prepaid', label: 'নেসকো (প্রিপেইড)', enLabel: 'NESCO (Prepaid)', category: 'electricity', iconColor: 'bg-indigo-100 text-indigo-600' },
    { id: 'nesco_postpaid', name: 'NESCO Postpaid', label: 'নেসকো (পোস্টপেইড)', enLabel: 'NESCO (Postpaid)', category: 'electricity', iconColor: 'bg-indigo-100 text-indigo-600' },
    { id: 'wzpdcl_prepaid', name: 'WZPDCL Prepaid', label: 'ওজোপাডিকো (প্রিপেইড)', enLabel: 'WZPDCL (Prepaid)', category: 'electricity', iconColor: 'bg-cyan-100 text-cyan-600' },
    { id: 'wzpdcl_postpaid', name: 'WZPDCL Postpaid', label: 'ওজোপাডিকো (পোস্টপেইড)', enLabel: 'WZPDCL (Postpaid)', category: 'electricity', iconColor: 'bg-cyan-100 text-cyan-600' },

    // Gas
    { id: 'titas', name: 'Titas Gas', label: 'তিতাস গ্যাস বিল', enLabel: 'Titas Gas Bill', category: 'gas', iconColor: 'bg-rose-100 text-rose-600' },
    { id: 'jalalabad', name: 'Jalalabad Gas', label: 'জালালাবাদ গ্যাস বিল', enLabel: 'Jalalabad Gas Bill', category: 'gas', iconColor: 'bg-rose-100 text-rose-600' },
    { id: 'karnaphuli', name: 'Karnaphuli Gas', label: 'কর্ণফুলী গ্যাস বিল', enLabel: 'Karnaphuli Gas Bill', category: 'gas', iconColor: 'bg-rose-100 text-rose-600' },

    // Water
    { id: 'dhaka_wasa', name: 'Dhaka WASA', label: 'ঢাকা ওয়াসা পানি বিল', enLabel: 'Dhaka WASA Water Bill', category: 'water', iconColor: 'bg-blue-100 text-blue-600' },
    { id: 'ctg_wasa', name: 'Ctg WASA', label: 'চট্টগ্রাম ওয়াসা পানি বিল', enLabel: 'Ctg WASA Water Bill', category: 'water', iconColor: 'bg-blue-100 text-blue-600' },

    // Internet
    { id: 'link3', name: 'Link3', label: 'Link3 ইন্টারনেট বিল', enLabel: 'Link3 Internet Bill', category: 'internet', iconColor: 'bg-purple-100 text-purple-600' },
    { id: 'amber_it', name: 'Amber IT', label: 'Amber IT ইন্টারনেট বিল', enLabel: 'Amber IT Internet Bill', category: 'internet', iconColor: 'bg-purple-100 text-purple-600' },
    { id: 'carnival', name: 'Carnival', label: 'Carnival ইন্টারনেট বিল', enLabel: 'Carnival Internet Bill', category: 'internet', iconColor: 'bg-purple-100 text-purple-600' },

    // Cable TV
    { id: 'akash_dth', name: 'Akash DTH', label: 'আকাশ DTH ক্যাবল বিল', enLabel: 'Akash DTH Cable Bill', category: 'tv', iconColor: 'bg-fuchsia-100 text-fuchsia-600' },

    // Telephone
    { id: 'btcl', name: 'BTCL', label: 'BTCL ল্যান্ডলাইন বিল', enLabel: 'BTCL Landline Bill', category: 'telephone', iconColor: 'bg-teal-100 text-teal-600' }
  ];

  const categories = [
    { 
      id: 'electricity', 
      label: 'বিদ্যুৎ বিল', 
      enLabel: 'Electricity Bill', 
      icon: Lightbulb, 
      bg: 'bg-[#fef9f3]', 
      activeBg: 'bg-amber-500', 
      iconColor: 'text-amber-500',
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
      description: 'ডেসকো (DESCO), ডিপিডিসি (DPDC), পল্লী বিদ্যুৎ (REB), নেসকো (NESCO), ওজোপাডিকো (WZPDCL) ও পিডিবি (BPDB) সহ বাংলাদেশের সকল বিদ্যুৎ বণ্টনকারী সংস্থার প্রিপেইড ও পোস্টপেইড বিল নিরাপদে পরিশোধ করুন।'
    },
    { 
      id: 'gas', 
      label: 'গ্যাস বিল', 
      enLabel: 'Gas Bill', 
      icon: Flame, 
      bg: 'bg-[#fef2f2]', 
      activeBg: 'bg-rose-500', 
      iconColor: 'text-rose-500',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
      description: 'তিতাস গ্যাস, বাখরাবাদ গ্যাস, জালালাবাদ গ্যাস, কর্ণফুলী গ্যাস ও সুন্দরবন গ্যাস কোম্পানির প্রিপেইড কার্ড মিটার ও পোস্টপেইড আবাসিক/বাণিজ্যিক লাইনের বিল পরিশোধ করুন।'
    },
    { 
      id: 'water', 
      label: 'পানি বিল', 
      enLabel: 'Water Bill', 
      icon: Droplet, 
      bg: 'bg-[#f0f9ff]', 
      activeBg: 'bg-blue-500', 
      iconColor: 'text-blue-500',
      badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
      description: 'ঢাকা ওয়াসা (Dhaka WASA), চট্টগ্রাম ওয়াসা (Ctg WASA), খুলনা ওয়াসা ও রাজশাহী ওয়াসা সহ দেশের সকল আঞ্চলিক স্বীকৃত পানি সরবরাহ কর্তৃপক্ষের মাসিক বিল তাৎক্ষণিক প্রদান করুন।'
    },
    { 
      id: 'internet', 
      label: 'ইন্টারনেট বিল', 
      enLabel: 'Internet Bill', 
      icon: Wifi, 
      bg: 'bg-[#faf5ff]', 
      activeBg: 'bg-purple-500', 
      iconColor: 'text-purple-500',
      badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
      description: 'লিংক থ্রি (Link3), আম্বার আইটি (Amber IT), কার্নিভাল (Carnival) সহ দেশের সকল অনুমোদিত ব্রডব্যান্ড আইএসপি এবং ওয়াইফাই সংযোগের বিল পরিশোধ ও প্যাকেজ রিনিউ করুন।'
    },
    { 
      id: 'tv', 
      label: 'টিভি বিল', 
      enLabel: 'TV Bill', 
      icon: Tv, 
      bg: 'bg-[#fdf2f8]', 
      activeBg: 'bg-pink-500', 
      iconColor: 'text-pink-500',
      badgeBg: 'bg-pink-100 text-pink-800 border-pink-300',
      description: 'আকাশ ডিটিএইচ (Akash DTH) ও স্থানীয় ডিজিটাল ক্যাবল টিভির রিচার্জ ও মাসিক সাবস্ক্রিপশন চার্জ ঘরে বসেই সহজে সম্পন্ন করুন।'
    },
    { 
      id: 'telephone', 
      label: 'টেলিফোন বিল', 
      enLabel: 'Telephone Bill', 
      icon: Smartphone, 
      bg: 'bg-[#f0fdfa]', 
      activeBg: 'bg-teal-500', 
      iconColor: 'text-teal-500',
      badgeBg: 'bg-teal-100 text-teal-800 border-teal-300',
      description: 'বিটিসিএল (BTCL) ল্যান্ডলাইন, সরকারি ফিক্সড ফোন ও ল্যান্ডলাইন ব্রডব্যান্ড লাইনের ব্যবহারিক বিল প্রদান করুন।'
    }
  ];

  const activeCatObj = categories.find(c => c.id === billCategory);

  const globalSearchProviders = billSearchQuery.trim()
    ? billProviders.filter(p =>
        p.label.toLowerCase().includes(billSearchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(billSearchQuery.toLowerCase()) ||
        (p.enLabel && p.enLabel.toLowerCase().includes(billSearchQuery.toLowerCase()))
      )
    : [];

  const activeCatProviders = billCategory
    ? billProviders.filter(p => p.category === billCategory && (
        !billSearchQuery ||
        p.label.toLowerCase().includes(billSearchQuery.toLowerCase()) ||
        (p.enLabel && p.enLabel.toLowerCase().includes(billSearchQuery.toLowerCase()))
      ))
    : [];

  const handleBillPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (user.ambCardStatus === 'inactive') {
      setErrorMsg('দুঃখিত! আপনার ভার্চুয়াল কার্ডটি লক বা নিষ্ক্রিয় রয়েছে। অনুগ্রহ করে কার্ড আনলক করুন।');
      return;
    }

    const amountNum = Number(billAmount);
    if (!selectedBillProvider) {
      setErrorMsg('অনুগ্রহ করে একটি বিল প্রদানকারী প্রতিষ্ঠান নির্বাচন করুন।');
      return;
    }
    if (!billAccNo) {
      setErrorMsg('বিল একাউন্ট / মিটার / কাস্টমার নম্বর দিন।');
      return;
    }
    if (!billAmount || amountNum <= 0) {
      setErrorMsg('সঠিক টাকার পরিমাণ দিন।');
      return;
    }
    if (securityPin !== user.pin) {
      setErrorMsg('ভুল সিকিউরিটি পিন! সঠিক 4 সংখ্যার পিন প্রদান করুন।');
      return;
    }

    setLoading(true);

    try {
      addDoc(collection(db, 'admin_notifications'), {
        title: '⚡ নতুন BNB ইউটিলিটি বিল পে আবেদন',
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ${selectedBillProvider.name} এর ৳${amountNum.toLocaleString('bn-BD')} টাকা বিল পেমেন্ট রিকোয়েস্ট করেছেন (হিসাব/মিটার: ${billAccNo})।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        userPhone: billAccNo,
        amount: amountNum,
        type: 'bill_pay',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      await Promise.all([
        addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userName: user.name || '',
          userPhone: user.phone || '',
          memberId: user.memberId || '',
          amount: amountNum,
          type: 'bill_pay',
          typeLabel: 'ইউটিলিটি বিল',
          status: 'pending',
          paymentMethod: selectedBillProvider.name,
          phone: billAccNo,
          billImage: billImage || '',
          createdAt: new Date().toISOString(),
          description: `${selectedBillProvider.label} (${billAccNo}) এর ${billMonth} মাসের বিল ৳${amountNum.toLocaleString('bn-BD')} পরিশোধের আবেদন (পেন্ডিং)`
        }),
        addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          title: 'বিল পেমেন্ট রিকোয়েস্ট সাবমিট হয়েছে',
          message: `${selectedBillProvider.label} এর ৳${amountNum.toLocaleString('bn-BD')} বিল পরিশোধের রিকোয়েস্টটি সাবমিট হয়েছে। এডমিন ভেরিফাই করে পে করবে।`,
          read: false,
          createdAt: new Date().toISOString()
        })
      ]);

      setSuccessMsg('আপনার বিল পেমেন্ট রিকোয়েস্ট সফলভাবে সাবমিট হয়েছে!');
      setBillAmount('');
      setBillAccNo('');
      setBillImage('');
      setSelectedBillProvider(null);
      setSecurityPin('');

      if (syncLiveProfile) syncLiveProfile();
    } catch (err) {
      console.error("Bill pay error:", err);
      setErrorMsg('বিল পেমেন্ট সাবমিট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20 font-sans text-slate-800">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-150 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer active:scale-95 shadow-3xs"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-tight">AMB বিল পে</h1>
            <p className="text-[10px] text-slate-400 font-bold">ইউটিলিটি ও যাবতীয় পরিষেবা বিল প্রদান</p>
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 shadow-3xs">
          <span>৳ {(user.balance || 0).toLocaleString('bn-BD')}</span>
          <span className="text-[8px] text-emerald-600 uppercase font-sans">BDT</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4 text-left">
        {/* Error / Success toasts */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center justify-between gap-1.5 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')}><X className="w-4 h-4 text-rose-400" /></button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between gap-1.5 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')}><X className="w-4 h-4 text-emerald-400" /></button>
          </div>
        )}

        {/* SUB-PAGE 1: BILL PAYMENT FORM SCREEN */}
        {selectedBillProvider ? (
          <div className="bg-white rounded-3xl p-5 text-slate-800 space-y-4 animate-fade-in shadow-sm border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <button 
                type="button"
                onClick={() => setSelectedBillProvider(null)} 
                className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-black text-xs cursor-pointer bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 transition"
              >
                <ChevronLeft className="w-4 h-4" /> প্রতিষ্ঠানের তালিকায় ফিরুন
              </button>
              <button 
                type="button"
                onClick={() => setSelectedBillProvider(null)} 
                className="text-[9.5px] bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-xl text-slate-700 font-black transition cursor-pointer"
              >
                পরিবর্তন
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs font-black text-lg">
                ⚡
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase">{selectedBillProvider.label} পরিশোধ ফরম</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">সঠিক তথ্য প্রদান করে আপনার চলতি মাস বা বকেয়া বিলটি পরিশোধ সম্পন্ন করুন</p>
              </div>
            </div>

            <form onSubmit={handleBillPaySubmit} className="space-y-4 pt-1">
              {/* Account Number input field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">কাস্টমার আইডি / বিল অ্যাকাউন্ট নম্বর</label>
                <input
                  type="text"
                  required
                  value={billAccNo}
                  onChange={(e) => setBillAccNo(e.target.value)}
                  placeholder="বিল রশিদের অ্যাকাউন্ট নং যেমনঃ 102485903"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-xs font-mono font-bold outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {/* Month input field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">বিলের মাস ও বছর</label>
                  <button
                    type="button"
                    onClick={() => setShowMonthPopup(true)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-xs font-bold flex items-center justify-between outline-none text-left transition"
                  >
                    <span>{billMonth ? `${billMonth}` : 'মাস নির্বাচন করুন'}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Amount input field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">বিল পরিমাণ (৳ Amount)</label>
                  <input
                    type="number"
                    required
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    placeholder="৳ সর্বনিম্ন 10 BDT"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-xs font-mono font-bold text-emerald-950 outline-none transition"
                  />
                </div>
              </div>

              {/* Month Picker Popup modal */}
              {showMonthPopup && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-white text-slate-800 w-full max-w-sm rounded-3xl shadow-xl p-5 space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <h3 className="text-sm font-black text-slate-900">মাস নির্বাচন করুন</h3>
                      <button type="button" onClick={() => setShowMonthPopup(false)}><X className="w-4 h-4 text-slate-400" /></button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
                      {[
                        { en: 'January 2026', bn: 'জানুয়ারি 2026' },
                        { en: 'February 2026', bn: 'ফেব্রুয়ারি 2026' },
                        { en: 'March 2026', bn: 'মার্চ 2026' },
                        { en: 'April 2026', bn: 'এপ্রিল 2026' },
                        { en: 'May 2026', bn: 'মে 2026' },
                        { en: 'June 2026', bn: 'জুন 2026' },
                        { en: 'July 2026', bn: 'জুলাই 2026' },
                        { en: 'August 2026', bn: 'আগস্ট 2026' },
                        { en: 'September 2026', bn: 'সেপ্টেম্বর 2026' },
                        { en: 'October 2026', bn: 'অক্টোবর 2026' },
                        { en: 'November 2026', bn: 'নভেম্বর 2026' },
                        { en: 'December 2026', bn: 'ডিসেম্বর 2026' },
                      ].map((m) => (
                        <button
                          key={m.en}
                          type="button"
                          onClick={() => {
                            setBillMonth(m.en);
                            setShowMonthPopup(false);
                          }}
                          className={`w-full flex items-center justify-between p-3 border rounded-xl text-xs ${billMonth === m.en ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
                        >
                          <span className="font-bold text-slate-800">{m.en} ({m.bn})</span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${billMonth === m.en ? 'border-emerald-500' : 'border-slate-300'}`}>
                            {billMonth === m.en && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                          </div>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMonthPopup(false)}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                    >
                      বন্ধ করুন
                    </button>
                  </div>
                </div>
              )}

              {/* Bill Receipt Photo attachment section */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Image className="w-4.5 h-4.5 text-pink-600" /> বিল বা রশিদের ছবি সংযুক্ত করুন (প্রমাণস্বরূপ)
                </label>
                
                {!billImage ? (
                  <div className="relative group">
                    <input
                      type="file"
                      id="bill-receipt-upload-page"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') {
                              setBillImage(reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="bill-receipt-upload-page"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-pink-500 rounded-2xl p-6 bg-slate-50 hover:bg-slate-100/50 text-center cursor-pointer transition duration-150"
                    >
                      <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-pink-500 group-hover:scale-105 transition-all mb-2" />
                      <span className="text-xs font-black text-slate-800">রশিদের ছবি ড্রপ করুন বা ক্লিক করে সংযুক্ত করুন</span>
                      <span className="text-[9.5px] text-slate-400 mt-1 font-bold">JPEG, PNG বা WebP ছবি সিলেক্ট করতে পারবেন</span>
                    </label>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-emerald-50/40 p-3.5 flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300 bg-white shadow-xs flex-shrink-0">
                        <img src={billImage} alt="Uploaded bill receipt" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> ছবি সংযুক্ত হয়েছে!
                        </p>
                        <p className="text-[9.5px] text-slate-500 font-bold mt-0.5">এডমিন এই বিলের ছবি দেখে পেমেন্ট ভেরিফাই করবেন</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBillImage('')}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition flex items-center justify-center flex-shrink-0 cursor-pointer"
                      title="ছবি মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* PIN input field */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold text-slate-700">ওয়ালেট পিন নম্বর (Security PIN)</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={securityPin}
                  onChange={(e) => setSecurityPin(e.target.value)}
                  placeholder="4 সংখ্যার গোপন ওয়ালেট পিন"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-xs font-mono text-center tracking-widest outline-none transition"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer uppercase font-sans mt-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'নিরাপদ বিল পরিশোধ সম্পন্ন করুন ⚡'
                )}
              </button>
            </form>
          </div>
        ) : billCategory && activeCatObj ? (
          /* SUB-PAGE 2: DEDICATED CATEGORY SUB-PAGE WITH DETAILS AT TOP */
          <div className="space-y-4 animate-fade-in">
            {/* Top Navigation Back Button */}
            <button 
              type="button"
              onClick={() => { setBillCategory(null); setBillSearchQuery(''); }} 
              className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-black text-xs cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-3xs"
            >
              <ChevronLeft className="w-4 h-4" /> পে বিল ক্যাটাগরিতে ফিরে যান
            </button>

            {/* TOP DETAILED INFO BANNER CARD */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs ${activeCatObj.activeBg} text-white shrink-0`}>
                    <activeCatObj.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-wider uppercase text-slate-400 block">ক্যাটাগরি পেজ</span>
                    <h2 className="text-base font-black text-slate-900 leading-tight">{activeCatObj.label} সেকশন</h2>
                  </div>
                </div>
                <span className={`text-[9.5px] font-black px-3 py-1 rounded-full border ${activeCatObj.badgeBg}`}>
                  {activeCatObj.enLabel}
                </span>
              </div>

              {/* DETAILED INFORMATION BOX */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <p className="text-[10.5px] font-bold text-slate-700 leading-relaxed flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{activeCatObj.description}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200">
                  <span className="text-[9px] font-black text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    🏢 মোট প্রতিষ্ঠান: {activeCatProviders.length} টি
                  </span>
                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-lg border border-emerald-300">
                    ⚡ ইনস্ট্যান্ট পে রিসেট
                  </span>
                  <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    🔒 24/7 অটোমেটিক সাপোর্ট
                  </span>
                </div>
              </div>

              {/* SEARCH BOX INSIDE CATEGORY PAGE */}
              <div className="relative pt-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={billSearchQuery}
                  onChange={(e) => setBillSearchQuery(e.target.value)}
                  placeholder={`${activeCatObj.label} প্রোভাইডার বা প্রতিষ্ঠানের নাম টাইপ করুন...`}
                  className="w-full bg-slate-50 text-slate-800 pl-9 pr-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-xs font-bold outline-none transition"
                />
              </div>
            </div>

            {/* BILLERS LIST FOR THIS CATEGORY */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-900 uppercase flex items-center gap-1.5">
                  🏢 {activeCatObj.label} প্রোভাইডার সমূহের তালিকা ({activeCatProviders.length} টি)
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-2.5 max-h-[380px] overflow-y-auto pr-0.5">
                {activeCatProviders.map((provider, pIdx) => (
                  <button
                    key={`cat-page-${provider.id}-${pIdx}`}
                    type="button"
                    onClick={() => setSelectedBillProvider(provider)}
                    className="w-full p-3.5 bg-slate-50 hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 rounded-2xl flex items-center justify-between text-slate-800 text-left transition shadow-3xs cursor-pointer group active:scale-98"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${provider.iconColor || 'bg-slate-100 text-slate-500'}`}>
                        <activeCatObj.icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-900 uppercase group-hover:text-emerald-700 transition-colors truncate">
                          {provider.label}
                        </h4>
                        <p className="text-[9.5px] text-slate-500 font-bold truncate">
                          {provider.enLabel || provider.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9.5px] font-black px-3 py-1.5 rounded-xl bg-emerald-600 text-white shadow-3xs group-hover:bg-emerald-700 transition">
                        বিল পরিশোধ ➔
                      </span>
                    </div>
                  </button>
                ))}

                {activeCatProviders.length === 0 && (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-xs text-slate-500 font-bold">দুঃখিত! এই নামে কোনো প্রতিষ্ঠান পাওয়া যায়নি।</p>
                    <button 
                      type="button" 
                      onClick={() => setBillSearchQuery('')} 
                      className="text-[10px] font-black bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      সার্চ রিসেট করুন
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* SUB-PAGE 3: MAIN CATEGORIES GRID VIEW */
          <div className="space-y-4 animate-fade-in">
            {/* Top Search field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center pb-0.5">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-emerald-600" /> প্রতিষ্ঠানের নাম খুঁজুন
                </h3>
                {billSearchQuery && (
                  <button 
                    type="button"
                    onClick={() => setBillSearchQuery('')} 
                    className="text-[9px] bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg text-slate-600 font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> রিসেট
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={billSearchQuery}
                  onChange={(e) => setBillSearchQuery(e.target.value)}
                  placeholder="প্রতিষ্ঠানের নাম বা বিলার টাইপ করুন..."
                  className="w-full bg-white text-slate-800 pl-9 pr-4 py-3 border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs font-bold outline-none shadow-3xs"
                />
              </div>

              {/* Instant Search Results Dropdown/Box when typing */}
              {billSearchQuery.trim() !== '' && (
                <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-lg space-y-2 max-h-[250px] overflow-y-auto animate-fade-in">
                  <p className="text-[10px] font-black text-slate-500 border-b pb-1">খুঁজে পাওয়া প্রতিষ্ঠানসমূহ ({globalSearchProviders.length} টি):</p>
                  {globalSearchProviders.map((provider, sIdx) => {
                    const CatIcon = categories.find(c => c.id === provider.category)?.icon || Lightbulb;
                    return (
                      <button
                        key={`search-${provider.id}-${sIdx}`}
                        type="button"
                        onClick={() => {
                          setSelectedBillProvider(provider);
                          setBillSearchQuery('');
                        }}
                        className="w-full p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl flex items-center justify-between text-slate-800 text-left transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${provider.iconColor || 'bg-slate-100 text-slate-500'}`}>
                            <CatIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-900 group-hover:text-emerald-700">{provider.label}</h4>
                            <p className="text-[9px] text-slate-400">{provider.enLabel || provider.name}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
                      </button>
                    );
                  })}
                  {globalSearchProviders.length === 0 && (
                    <p className="text-center text-xs text-slate-400 font-bold py-3">দুঃখিত! কোনো বিল প্রোভাইডার পাওয়া যায়নি।</p>
                  )}
                </div>
              )}
            </div>

            {/* Categories Grid - 6 Category Cards */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600">পে বিল ক্যাটাগরি নির্বাচন করুন</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {categories.map((cat, idx) => (
                  <button
                    key={`${cat.id}-${idx}`}
                    type="button"
                    onClick={() => {
                      setBillCategory(cat.id as any);
                      setSelectedBillProvider(null);
                      setBillSearchQuery('');
                    }}
                    className={`rounded-[22px] transition-all duration-200 border-2 overflow-hidden border-transparent ${cat.bg} hover:scale-[1.02] p-4 text-left cursor-pointer group hover:shadow-md active:scale-98`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${cat.bg} ${cat.iconColor} shadow-3xs`}>
                        <cat.icon className="w-5.5 h-5.5" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-3">
                      <span className="text-xs font-black text-slate-900 leading-tight block group-hover:text-emerald-800 transition-colors">
                        {cat.label}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 block mt-0.5">{cat.enLabel}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
