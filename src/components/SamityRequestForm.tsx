import React, { useState } from 'react';
import { User, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { 
  Building2, 
  ArrowLeft, 
  User as UserIcon, 
  Phone, 
  CreditCard, 
  MapPin, 
  Calendar, 
  ShieldAlert, 
  CheckCircle2, 
  Send,
  FileText,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';

interface SamityRequestFormProps {
  user: User;
  appConfig: AppConfig;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export default function SamityRequestForm({ user, appConfig, onClose, onSubmitSuccess }: SamityRequestFormProps) {
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState('');
  const [success, setSuccess] = useState(false);

  // Form states initialized with existing profile values
  const [country, setCountry] = useState(user.country || 'Bangladesh');
  const [fatherName, setFatherName] = useState(user.fatherName || '');
  const [motherName, setMotherName] = useState(user.motherName || '');
  const [nid, setNid] = useState(user.nid || '');
  const [dob, setDob] = useState(user.dob || '');
  const [division, setDivision] = useState(user.division || '');
  const [district, setDistrict] = useState(user.district || '');
  const [thana, setThana] = useState(user.thana || '');
  const [postOffice, setPostOffice] = useState(user.postOffice || '');
  const [customRegion, setCustomRegion] = useState('');
  const [nomineeName, setNomineeName] = useState(user.nomineeName || '');
  const [nomineeRelation, setNomineeRelation] = useState(user.nomineeRelation || '');
  const [nomineePhone, setNomineePhone] = useState(user.nomineePhone || '');
  const [agreed, setAgreed] = useState(false);

  // Desired monthly savings rates states (minimum 500 BDT)
  const [monthlySavingsOption, setMonthlySavingsOption] = useState<string>('');
  const [customSavingsAmount, setCustomSavingsAmount] = useState<string>('');

  // Countries List for Global Citizens
  const countriesList = [
    'Bangladesh (বাংলাদেশ)',
    'India (ভারত)',
    'Saudi Arabia (সৌদি আরব)',
    'United Arab Emirates (ইউএই)',
    'Qatar (কাতার)',
    'Oman (ওমান)',
    'Kuwait (কুয়েত)',
    'Malaysia (মালয়েশিয়া)',
    'Singapore (সিঙ্গাপুর)',
    'United Kingdom (যুক্তরাজ্য)',
    'United States (যুক্তরাষ্ট্র)',
    'Canada (কানাডা)',
    'Italy (ইতালি)',
    'Australia (অস্ট্রেলিয়া)',
    'South Africa (দক্ষিণ আফ্রিকা)',
    'Japan (জাপান)',
    'South Korea (দক্ষিণ কোরিয়া)',
    'Other (অন্যান্য দেশ)'
  ];

  // Division Options for Bangladesh
  const divisions = [
    'ঢাকা (Dhaka)',
    'চট্টগ্রাম (Chattogram)',
    'রাজশাহী (Rajshahi)',
    'খুলনা (Khulna)',
    'বরিশাল (Barishal)',
    'সিলেট (Sylhet)',
    'রংপুর (Rangpur)',
    'ময়মনসিংহ (Mymensingh)'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCode('');

    if (!agreed) {
      setErrorCode('আবেদন জমা দিতে অবশ্যই নীতিমালার সাথে একমত পোষণ করুন।');
      return;
    }

    if (!nid.trim()) {
      setErrorCode('অনুগ্রহ করে জাতীয় পরিচয়পত্র (NID) অথবা পাসপোর্ট নম্বর লিখুন।');
      return;
    }

    const finalRegion = country.startsWith('Bangladesh') ? division : customRegion;
    if (!finalRegion.trim()) {
      setErrorCode('অনুগ্রহ করে আপনার বিভাগ, স্টেট বা প্রদেশের নাম প্রদান করুন।');
      return;
    }

    if (!district.trim()) {
      setErrorCode('অনুগ্রহ করে আপনার জেলা প্রদান করুন।');
      return;
    }

    if (!thana.trim()) {
      setErrorCode('অনুগ্রহ করে আপনার থানা বা উপজেলা প্রদান করুন।');
      return;
    }

    if (!postOffice.trim()) {
      setErrorCode('অনুগ্রহ করে আপনার পোস্ট অফিস অথবা গ্রাম প্রদান করুন।');
      return;
    }

    if (!nomineeName.trim()) {
      setErrorCode('অনুগ্রহ করে নমিনির নাম প্রদান করুন।');
      return;
    }

    if (!nomineePhone.trim() || nomineePhone.length < 7) {
      setErrorCode('সঠিক নমিনির মোবাইল নম্বর লিখুন (ন্যূনতম 7 ডিজিট)।');
      return;
    }

    if (!monthlySavingsOption) {
      setErrorCode('অনুগ্রহ করে আপনার কাঙ্ক্ষিত মাসিক সঞ্চয় স্কিম নির্বাচন করুন।');
      return;
    }

    let savingsTarget = 500;
    if (monthlySavingsOption === 'custom') {
      const parsedAmt = parseInt(customSavingsAmount, 10);
      if (isNaN(parsedAmt) || parsedAmt < 500) {
        setErrorCode('আপনার কাঙ্ক্ষিত মাসিক সঞ্চয় অনুগ্রহ করে সংখ্যায় লিখুন এবং এটি অবশ্যই সর্বনিম্ন 500 টাকা হতে হবে।');
        return;
      }
      savingsTarget = parsedAmt;
    } else {
      savingsTarget = parseInt(monthlySavingsOption, 10);
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const appRef = doc(db, 'samity_applications', user.uid);
      const nowIso = new Date().toISOString();
      
      const isAutoApprove = appConfig?.autoApproveSomiti === true || appConfig?.autoApproveSamity === true;
      const targetSamityStatus = isAutoApprove ? 'approved' : 'pending';

      const updateData: Partial<User> = {
        country: country,
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        nid: nid.trim(),
        dob: dob || user.dob || '',
        division: finalRegion,
        district: district.trim(),
        thana: thana.trim(),
        postOffice: postOffice.trim(),
        nomineeName: nomineeName.trim(),
        nomineeRelation: nomineeRelation.trim(),
        nomineePhone: nomineePhone.trim(),
        monthlySavingsTarget: savingsTarget,
        samityStatus: targetSamityStatus,
        samityApproved: isAutoApprove ? true : false,
        isSamityMember: isAutoApprove ? true : (user.isSamityMember ?? false),
        approved: isAutoApprove ? true : (user.approved ?? false),
        samityAppliedAt: nowIso,
        hasSetProfile: true
      };

      const appData = {
        id: user.uid,
        uid: user.uid,
        userId: user.uid,
        name: user.name,
        phone: user.phone,
        memberId: user.memberId || '',
        country: country,
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        nid: nid.trim(),
        dob: dob || user.dob || '',
        division: finalRegion,
        district: district.trim(),
        thana: thana.trim(),
        postOffice: postOffice.trim(),
        nomineeName: nomineeName.trim(),
        nomineeRelation: nomineeRelation.trim(),
        nomineePhone: nomineePhone.trim(),
        monthlySavingsTarget: savingsTarget,
        status: targetSamityStatus,
        samityStatus: targetSamityStatus,
        approved: isAutoApprove,
        samityAppliedAt: nowIso,
        appliedAt: nowIso,
        createdAt: nowIso
      };

      // ⚡ Parallel Firestore writes (< 0.5s)
      await Promise.all([
        setDoc(userRef, updateData, { merge: true }),
        setDoc(appRef, appData, { merge: true })
      ]);

      if (isAutoApprove) {
        // Direct auto-approved user notification
        addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          title: '🎉 সমবায় মেম্বারশিপ অনুমোদিত!',
          message: `অভিনন্দন ${user.name}! আপনার সমিতি মেম্বারশিপ আবেদনটি স্বয়ংক্রিয়ভাবে (Auto-Approved) অনুমোদিত হয়েছে।`,
          type: 'samity_approved',
          read: false,
          createdAt: nowIso
        }).catch(() => {});
      } else {
        // Async background notification for admin review
        addDoc(collection(db, 'admin_notifications'), {
          type: 'samity_membership_application',
          title: '🏢 নতুন সমবায় সদস্যপদ আবেদন!',
          message: `${user.name} (${user.memberId || user.phone}) সমিতির সদস্যপদের জন্য আবেদন সাবমিট করেছেন। (মাসিক লক্ষ্য: ৳${savingsTarget.toLocaleString('bn-BD')} BDT)`,
          userId: user.uid,
          userName: user.name,
          memberId: user.memberId || '',
          read: false,
          createdAt: nowIso
        }).catch(e => console.warn("Admin notification warning:", e));
      }

      setSuccess(true);
      setTimeout(() => {
        onSubmitSuccess();
      }, 1000);
    } catch (err) {
      console.error('Error submitting Samity request form:', err);
      setErrorCode('আবেদনটি ডাটাবেজে রেকর্ড করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-xl mt-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-750 p-6 text-white text-left relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
        <button 
          onClick={onClose}
          className="mb-4 flex items-center gap-1.5 text-xs text-emerald-100 hover:text-white transition bg-emerald-900/40 p-2 py-1 rounded-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          ফিরে যান
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">সমিতি সদস্যপদ আবেদন ফরম</h1>
            <p className="text-[10.5px] text-emerald-150 mt-1 font-medium font-sans">বিশ্বের যে কোনো প্রান্ত থেকে সঞ্চয়, কিস্তি ও ঋণের অনলাইন সুবিধার জন্য সদস্যপদের প্রস্তাবনা</p>
          </div>
        </div>
      </div>

      {success ? (
        <div className="p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto animate-bounce">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-base font-black text-slate-800">আবেদন সফলভাবে সাবমিট হয়েছে!</h2>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
            আপনার সমিতির সদস্যপদ আবেদনটি এডমিন অফিসে পাঠানো হয়েছে। এডমিন প্যানেল আপনার প্রোফাইল তথ্য ভেরিফাই করার পর এটি অনুমোদন করবে। অনুগ্রহ করে অপেক্ষা করুন।
          </p>
          <div className="w-16 h-1 bg-emerald-500 rounded mx-auto mt-4 animate-pulse" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-left">
          {errorCode && (
            <div className="bg-rose-50 text-rose-750 border border-rose-100 p-3.5 rounded-2xl text-[11px] font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-650 shrink-0" />
              {errorCode}
            </div>
          )}

          {appConfig.samityTerms && (
            <div className="bg-emerald-50/50 text-slate-800 border border-emerald-200/60 p-4 rounded-2.5xl text-[10.5px] font-medium leading-relaxed space-y-2 shadow-xs">
              <span className="text-emerald-900 font-extrabold flex items-center gap-1.5 text-xs">
                📢 ভর্তি নিয়মাবলী ও নির্দেশাবলীঃ
              </span>
              <p className="text-slate-700 font-bold">{appConfig.samityTerms}</p>
            </div>
          )}

          {/* Section A: Verified Base Identity */}
          <div className="space-y-3 bg-slate-50/70 border border-slate-150 p-4 rounded-2.5xl">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
              <UserIcon className="w-3.5 h-3.5 text-slate-400" /> 1. প্রাথমিক প্রোফাইল তথ্য (স্থায়ী ও অপরিবর্তনশীল)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-[11px] font-sans">
              <div>
                <label className="text-slate-450 font-semibold block">সদস্যের নাম (Full Name):</label>
                <div className="text-slate-800 font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 mt-1 block">
                  {user.name}
                </div>
              </div>

              <div>
                <label className="text-slate-450 font-semibold block">মোবাইল নম্বর (Phone No):</label>
                <div className="text-slate-800 font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 mt-1 font-mono">
                  {user.phone}
                </div>
              </div>

              <div>
                <label className="text-slate-450 font-semibold block">সদস্য আইডি (Member ID):</label>
                <div className="text-emerald-800 font-black bg-white border border-slate-200 rounded-xl px-3 py-2 mt-1 font-mono">
                  {user.memberId}
                </div>
              </div>

              <div>
                <label className="text-slate-450 font-semibold block">অ্যাকাউন্ট রোল (Account Role):</label>
                <div className="text-slate-700 font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 mt-1 capitalize">
                  {user.role === 'admin' ? 'এডমিন (AMB Admin)' : 'প্রিমিয়াম সদস্য'}
                </div>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 italic">
              * নাম এবং মোবাইল নম্বর পরিবর্তন করতে হেল্পডেস্কে সরাসরি যোগাযোগ করুন।
            </p>
          </div>

          {/* Section B: Editable Fields */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-indigo-100 pb-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" /> 2. অতিরিক্ত সমবায় তথ্যাদি প্রদান (সারা বিশ্ব থেকে গ্রহণযোগ্য)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] font-sans">
              
              {/* Country Selection Field */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">বসবাসকারী দেশ (Country) <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <select
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      if (!e.target.value.startsWith('Bangladesh')) {
                        setDivision('');
                      }
                    }}
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all appearance-none"
                  >
                    {countriesList.map((countryName) => (
                      <option key={countryName} value={countryName}>{countryName}</option>
                    ))}
                  </select>
                  <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Father's Name */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">পিতার নাম (Father's Name) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="পিতার নাম লিখুন"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Mother's Name */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">মাতার নাম (Mother's Name) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="মাতার নাম লিখুন"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* NID / Passport Field */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">জাতীয় পরিচয়পত্র / পাসপোর্ট নম্বর <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="NID অথবা Passport নম্বর লিখুন"
                  value={nid}
                  onChange={(e) => setNid(e.target.value)} // Don't restrict to digits so global passports work
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">জন্ম তারিখ (Date of Birth)</label>
                <input
                  type="date"
                  placeholder="DD-MM-YYYY"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all font-mono"
                />
              </div>

              {/* Division/State Field */}
              {country.startsWith('Bangladesh') ? (
                <div>
                  <label className="text-slate-600 font-bold block mb-1">বিভাগ (Division) <span className="text-rose-500">*</span></label>
                  <select
                    value={division}
                    required
                    onChange={(e) => setDivision(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all"
                  >
                    <option value="">-- বিভাগ নির্বাচন করুন --</option>
                    {divisions.map((div) => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-slate-600 font-bold block mb-1">স্টেট / প্রদেশ / অঞ্চল (State / Province / Region) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="উদাঃ মক্কা, কুয়ালালামপুর, কুইন্স"
                    value={customRegion}
                    onChange={(e) => setCustomRegion(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                  />
                </div>
              )}

              {/* District Field */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">জেলা (District) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="আপনার জেলার নাম লিখুন"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Thana / Upazila Field */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">থানা / উপজেলা (Thana / Upazila) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="আপনার থানা বা উপজেলার নাম লিখুন"
                  value={thana}
                  onChange={(e) => setThana(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Post Office or Village Field */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">পোস্ট অফিস অথবা গ্রাম (Post Office / Village) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="আপনার পোস্ট অফিস বা গ্রামের নাম লিখুন"
                  value={postOffice}
                  onChange={(e) => setPostOffice(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Nominee Name */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">নমিনির নাম (Nominee Name) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="উদাঃ মোসাম্মৎ কুলসুম"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Nominee Relation */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">নমিনির সাথে সম্পর্ক <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="উদাঃ মাতা, স্ত্রী, পিতা, পুত্র"
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Nominee Phone */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">নমিনির সচল মোবাইল নম্বর <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="উদাঃ +8801712345678"
                  value={nomineePhone}
                  onChange={(e) => setNomineePhone(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Monthly Savings Target Choice */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">নির্ধারিত মাসিক সঞ্চয় (Monthly Savings Option) <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={monthlySavingsOption}
                  onChange={(e) => setMonthlySavingsOption(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all font-sans"
                >
                  <option value="" disabled>-- মাসিক সঞ্চয় স্কিম নির্বাচন করুন --</option>
                  <option value="500">500 BDT (Monthly)</option>
                  <option value="1000">1000 BDT (Monthly)</option>
                  <option value="2000">2000 BDT (Monthly)</option>
                  <option value="3000">3000 BDT (Monthly)</option>
                  <option value="5000">5000 BDT (Monthly)</option>
                  <option value="custom">Custom Amount (ম্যানুয়ালি পরিমাণ লিখুন)</option>
                </select>

                {monthlySavingsOption === 'custom' && (
                  <div className="mt-2.5">
                    <label className="text-slate-600 font-semibold text-[11px] block mb-1">আপনার কাঙ্ক্ষিত মাসিক সঞ্চয় পরিমাণ (BDT):</label>
                    <input
                      type="number"
                      min="100"
                      placeholder="e.g. 500, 1000, 2000, 3000, 5000"
                      value={customSavingsAmount}
                      onChange={(e) => setCustomSavingsAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step C: Checkbox Agreement */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-4 h-4 bg-slate-100 border border-slate-200 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 mt-0.5 shrink-0"
              />
              <span className="text-[10px] text-slate-500 leading-normal font-sans">
                আমি ঘোষণা করছি যে উপরে প্রদত্ত আমার সকল তথ্য সম্পূর্ণ সঠিক ও নিখুঁত। আমি সমবায়ের অনলাইন সেবার সদস্যপদ নিতে ইচ্ছুক এবং সমিতির যাবতীয় নিয়ম-কানুন ও নীতিমালা মেনে চলতে সর্বদা দায়বদ্ধ থাকবো।
              </span>
            </label>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 active:scale-98 transition text-center"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-xs hover:from-emerald-700 hover:to-teal-705 active:scale-98 transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-100"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  প্রক্রিয়াধীন...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  আবেদন করুন (Submit Application)
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
