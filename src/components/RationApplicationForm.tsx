import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, ShieldAlert, Check, Sparkles, Award } from 'lucide-react';
import { db } from '../lib/firebase';
import UnifiedBackButton from './UnifiedBackButton';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';

export default function RationApplicationForm({ liveUser, onClose }: any) {
  const [name, setName] = useState(liveUser?.name || '');
  const [phone, setPhone] = useState(liveUser?.phone || '');
  const [address, setAddress] = useState((liveUser as any)?.address || '');
  const [duration, setDuration] = useState('1');
  const [cardType, setCardType] = useState('Premium'); // Defaulting to Premium (Golden) for users
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const isInitialized = React.useRef(false);

  useEffect(() => {
    if (liveUser && !isInitialized.current) {
      setName(liveUser.name || '');
      setPhone(liveUser.phone || '');
      setAddress((liveUser as any)?.address || '');
      isInitialized.current = true;
    }
  }, [liveUser]);

  const cardCategories = [
    {
      id: 'Standard',
      name: '🥈 রেগুলার সিলভার কার্ড',
      fee: 100,
      badge: 'সাধারণ মেম্বার',
      desc: 'সকল সাধারণ সদস্যরা আবেদন করতে পারবেন। বছরে একবার ফি প্রদান করতে হয়।',
      benefit: '1 সেট মানসম্মত সাবসিডি রেশন সুবিধা।',
      bgClass: 'from-slate-50 to-slate-200 border-slate-300 text-slate-800',
      activeBorderClass: 'ring-4 ring-slate-400 border-slate-500'
    },
    {
      id: 'Premium',
      name: '👑 প্রিমিয়াম গোল্ডেন কার্ড',
      fee: 150,
      badge: 'ডাবল রেশন সুবিধা',
      desc: 'নিবন্ধিত সাধারণ ও বিশেষ সদস্যরা আবেদন করতে পারেন। ডাবল রেশন কোটা পাবেন।',
      benefit: 'ডাবল কোটায় 2 সেট সাবসিডি রেশন সামগ্রী সংগ্রহের সুযোগ।',
      bgClass: 'from-amber-50 to-yellow-100/60 border-amber-300 text-amber-900',
      activeBorderClass: 'ring-4 ring-amber-400 border-amber-600'
    },
    {
      id: 'Platinum',
      name: '💎 ভিআইপি গোল্ডেন কার্ড',
      fee: 500,
      badge: 'সমবায় ইনভেস্টর স্পেশাল',
      desc: 'শুধুমাত্র সমবায় সমিতির অনুমোদিত নিবন্ধিত ইনভেস্টরদের জন্য সীমাবদ্ধ।',
      benefit: 'আনলিমিটেড রেশন বুকিং ও ডিলার মেইন বিতরণ সেন্টারে ফাস্ট-ট্র্যাক সুবিধা।',
      bgClass: 'from-purple-950 via-slate-900 to-purple-950 border-purple-800 text-white',
      activeBorderClass: 'ring-4 ring-purple-600 border-purple-500'
    }
  ];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert("অনুগ্রহ করে 1.5 মেগাবাইটের কম সাইজের ছবি নির্বাচন করুন।");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const selectedCategoryObj = cardCategories.find(c => c.id === cardType) || cardCategories[1];
  const totalFee = selectedCategoryObj.fee * parseInt(duration);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoBase64) {
      alert("অনুগ্রহ করে আপনার একটি প্রোফাইল ছবি গ্যালারি থেকে আপলোড করুন।");
      return;
    }

    // 1. Check if VIP Golden is selected, and verify if user is an approved samity member
    if (cardType === 'Platinum') {
      const samityStatus = liveUser?.samityStatus || 'none';
      if (samityStatus !== 'approved') {
        alert("দুঃখিত! ভিআইপি গোল্ডেন কার্ডের জন্য শুধুমাত্র সমবায় সমিতির অনুমোদিত নিবন্ধিত ইনভেস্টরগণ আবেদন করতে পারবেন। দয়া করে প্রথমে সমবায় ফান্ডে যুক্ত হোন বা রেগুলার/প্রিমিয়াম রেশন কার্ড নির্বাচন করুন।");
        return;
      }
    }

    // 2. Check if user has sufficient main balance
    const userBalance = liveUser?.balance || 0;
    if (userBalance < totalFee) {
      alert(`আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই! রেশন কার্ড ফি ৳${totalFee} BDT কিন্তু আপনার ব্যালেন্স ৳${userBalance} BDT। অনুগ্রহ করে প্রথমে ড্যাশবোর্ড থেকে এড মানি করে অ্যাকাউন্ট ব্যালেন্স বৃদ্ধি করুন।`);
      return;
    }

    if (!window.confirm(`আপনি কি ৳${totalFee} BDT ফি প্রদান করে এই কার্ডের জন্য আবেদন করতে চান? আপনার মেইন ব্যালেন্স থেকে এই টাকা কেটে নেওয়া হবে।`)) {
      return;
    }

    setSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const cardNo = liveUser?.memberId || liveUser?.phone || `AMB-${Date.now()}`;
      
      // 3. Deduct balance from user
      const userRef = doc(db, 'users', liveUser.uid);
      await updateDoc(userRef, {
        balance: userBalance - totalFee,
        mainBalance: userBalance - totalFee
      });

      // 4. Create Ration Card record
      await addDoc(collection(db, 'ration_cards'), {
        userId: liveUser.uid,
        userName: name,
        name: name,
        phone: phone,
        address: address,
        village: address.split(',')[0] || address,
        upazila: address.split(',')[1] || 'যশোর সদর',
        district: address.split(',')[2] || 'যশোর',
        duration: duration,
        cardType: cardType, // Standard, Premium, Platinum
        cardNo: cardNo,
        cardNumber: cardNo,
        photoUrl: photoBase64,
        status: 'pending',
        createdAt: timestamp,
        issueDate: new Date().toLocaleDateString('bn-BD'),
        expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + parseInt(duration))).toLocaleDateString('bn-BD'),
        signature: 'S.Hasan',
        vipCardBg: cardType === 'Platinum' ? 'from-purple-950 via-slate-900 to-slate-950' : '',
        vipBorderColor: cardType === 'Platinum' ? '#A855F7' : '',
        vipTextColor: cardType === 'Platinum' ? 'text-purple-150' : '',
        vipPrimaryColor: cardType === 'Platinum' ? '#7C3AED' : ''
      });

      // 5. Add Transaction Log
      await addDoc(collection(db, 'transactions'), {
        id: `tx-rc-apply-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId || '',
        type: 'fee_payment',
        typeLabel: 'রেশন কার্ড সক্রিয়করণ ফি',
        amount: totalFee,
        status: 'success',
        description: `${selectedCategoryObj.name} সক্রিয়করণ ফি (মেয়াদঃ ${duration} বছর)। আবেদনটি পর্যালোচনার জন্য পাঠানো হয়েছে।`,
        createdAt: timestamp,
        paymentMethod: 'Main Balance'
      });

      // 6. Save Personal Notification
      await addDoc(collection(db, 'user_notifications'), {
        id: `notif-rc-apply-${Date.now()}`,
        userId: liveUser.uid,
        title: "🥗 রেশন কার্ড আবেদন ফি পরিশোধিত!",
        body: `আপনার ${selectedCategoryObj.name} এর আবেদন সফলভাবে গ্রহণ করা হয়েছে এবং ৳${totalFee} BDT মেইন ওয়ালেট থেকে কেটে নেওয়া হয়েছে। শীঘ্রই এডমিন কার্ডটি সক্রিয় করবেন।`,
        read: false,
        isPersonal: true,
        category: 'admin_msg',
        createdAt: timestamp
      });

      alert('অভিনন্দন! আপনার রেশন কার্ডের আবেদন এবং ফি সফলভাবে পরিশোধ করা হয়েছে। এডমিন প্যানেল থেকে দ্রুত সময়ের মধ্যে যাচাই শেষে কার্ডটি সক্রিয় করা হবে।');
      if (onClose) onClose();
    } catch (err: any) {
      alert('আবেদন পাঠাতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md min-h-screen p-4 text-slate-800 font-sans flex flex-col items-center justify-center relative select-none">
      {onClose && (
        <div className="absolute top-4 left-4 z-50">
          <UnifiedBackButton
            onClick={onClose}
            variant="light"
            title="পিছনে যান"
          />
        </div>
      )}
      <div className="max-w-xl w-full bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-2xl space-y-6 text-left my-8 overflow-y-auto max-h-[90vh]">
        
        <div className="border-b border-slate-100 pb-4 text-center space-y-1">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto border-2 border-emerald-100">
            <Award className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-[#015335]">🥗 কো-অপারেটিভ ডিজিটাল রেশন কার্ড আবেদনপত্র</h2>
          <p className="text-[10.5px] text-slate-500 font-bold">ন্যায্যমূল্যে নিত্যপ্রয়োজনীয় চাল, ডাল, তেল ও অন্যান্য ভর্তুকি পণ্য সুবিধা পাওয়ার ডিজিটাল কার্ড</p>
        </div>

        {/* 12 SECTIONS RULE & REPLICA ADHERENCE CONTAINER */}
        <div className="bg-emerald-55/40 border border-emerald-100/80 p-3.5 rounded-2xl flex items-start gap-2.5">
          <Sparkles className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-[10.5px] text-emerald-950 font-semibold leading-relaxed">
            <span className="font-black text-emerald-800">সহজ নিয়মাবলীঃ </span>
            আপনার ওয়ালেটে আবেদনের জন্য পর্যাপ্ত মেইন ব্যালেন্স থাকতে হবে। আবেদন সম্পূর্ণ হওয়ামাত্রই মেইন অ্যাকাউন্ট থেকে কার্ড সক্রিয়করণ চার্জ ডেবিট হয়ে যাবে। এডমিন অনুমোদন করা মাত্র কার্ডটি সচল দেখাবে।
          </div>
        </div>

        {/* THREE DISTINCT CARD CATEGORIES SELECTION BOXES */}
        <div className="space-y-3">
          <label className="block text-xs font-black text-slate-700">1. আপনার ডিজিটাল রেশন কার্ডের ক্যাটাগরি বেছে নিন *</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {cardCategories.map((category, idx) => {
              const isSelected = cardType === category.id;
              const isPlatinumVip = category.id === 'Platinum';
              return (
                <div
                  key={`${category.id}-${idx}`}
                  onClick={() => setCardType(category.id)}
                  className={`border-2 rounded-2xl p-4 cursor-pointer transition-all duration-200 relative flex flex-col justify-between text-left h-full shadow-sm select-none ${
                    isSelected 
                      ? category.activeBorderClass + ' scale-[1.01] bg-white' 
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  {/* Selected check circle overlay */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-[#015335] text-white rounded-full flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}

                  <div className="space-y-1.5 flex-grow">
                    <span className="px-2 py-0.5 bg-slate-200/60 text-slate-800 text-[8.5px] font-black rounded-md inline-block">
                      {category.badge}
                    </span>
                    <h4 className="text-xs font-black text-slate-900 leading-tight">{category.name}</h4>
                    <p className="text-[10px] text-slate-600 font-bold leading-normal">{category.desc}</p>
                    <p className="text-[9.5px] text-[#015335] font-extrabold leading-normal bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-100/40">
                      🎁 সুবিধা: {category.benefit}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-3 flex items-baseline gap-1">
                    <span className="text-base font-black text-slate-900 font-mono">৳{category.fee}</span>
                    <span className="text-[10px] text-slate-400 font-bold">/ বছরে</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-600 mb-1">সদস্যের নাম *</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-[#015335] outline-none" 
                required 
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-600 mb-1">মোবাইল নাম্বার *</label>
              <input 
                type="text" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-[#015335] outline-none" 
                required 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-600 mb-1">ঠিকানা (গ্রাম, উপজেলা, জেলা) *</label>
            <textarea 
              value={address} 
              onChange={(e) => setAddress(e.target.value)} 
              placeholder="যেমন: খড়কী, যশোর সদর, যশোর"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-[#015335] outline-none h-16 resize-none" 
              required 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-extrabold text-slate-600 mb-1">মেয়াদের সময়সীমা (বছর)</label>
              <select 
                value={duration} 
                onChange={(e) => setDuration(e.target.value)} 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-[#015335] outline-none"
              >
                {[1, 2, 3, 4, 5].map(y => <option key={y} value={y.toString()}>{y} বছর</option>)}
              </select>
            </div>

            {/* Total Payable Charge block */}
            <div className="bg-emerald-50/75 p-3.5 rounded-2xl border border-emerald-100 flex justify-between items-center h-full">
              <div>
                <p className="text-[10px] text-emerald-800 font-extrabold">মোট সক্রিয়করণ ফি</p>
                <p className="text-xs text-slate-500 font-semibold">ফি ৳{selectedCategoryObj.fee} × {duration} বছর</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-[#015335] font-mono">৳{totalFee} BDT</span>
              </div>
            </div>
          </div>

          {/* Member photo upload with Base64 gallery selection */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <label className="block text-xs font-black text-[#015335] mb-2">📸 সদস্য প্রোফাইল ছবি আপলোড (গ্যালারি থেকে) *</label>
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange} 
                className="hidden" 
                id="user-photo-upload" 
              />
              <label 
                htmlFor="user-photo-upload"
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-black rounded-xl cursor-pointer transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
              >
                <ImageIcon className="w-4 h-4" /> গ্যালারি থেকে ছবি নিন
              </label>
              {photoBase64 ? (
                <div className="relative">
                  <img src={photoBase64} alt="Selected Preview" className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-sm" />
                  <button 
                    type="button" 
                    onClick={() => setPhotoBase64('')}
                    className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white p-0.5 rounded-full cursor-pointer hover:bg-rose-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-slate-500 font-bold">কোনো ছবি নির্বাচন করা হয়নি</span>
              )}
            </div>
          </div>

          {/* VIP golden constraint warning */}
          {cardType === 'Platinum' && (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-900 font-bold leading-normal">
                সতর্কতা: ভিআইপি গোল্ডেন কার্ড শুধুমাত্র কো-অপারেটিভ সমবায় সমিতির নিবন্ধিত অনুমোদিত ইনভেস্টরদের জন্য। আপনি ইনভেস্টর না হয়ে থাকলে আবেদনটি বাতিল করা হবে।
              </p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={submitting}
            className="w-full py-3.5 bg-[#015335] hover:bg-[#014028] disabled:bg-slate-400 text-white rounded-2xl font-black text-xs transition cursor-pointer shadow-lg tracking-wide uppercase"
          >
            {submitting ? 'আবেদন পাঠানো হচ্ছে ও ফি ডেবিট হচ্ছে...' : `✓ ৳${totalFee} পরিশোধ ও রেশন কার্ড আবেদন জমা দিন`}
          </button>
        </form>
      </div>
    </div>
  );
}
