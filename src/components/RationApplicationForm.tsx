import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, ShieldAlert, Check, Sparkles, Award } from 'lucide-react';
import { db } from '../lib/firebase';
import UnifiedBackButton from './UnifiedBackButton';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';

export default function RationApplicationForm({ liveUser, onClose, appConfig }: any) {
  const [name, setName] = useState(liveUser?.name || '');
  const [phone, setPhone] = useState(liveUser?.phone || '');
  const [address, setAddress] = useState((liveUser as any)?.address || '');
  const [duration, setDuration] = useState('1');
  const [cardType, setCardType] = useState('red_white'); // Defaulting to highest
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
      id: 'red_white',
      name: appConfig?.rationCardConfigs?.red_white?.label || 'গোল্ডেন প্রিমিয়াম',
      fee: appConfig?.rationCardConfigs?.red_white?.price || 500,
      color: 'bg-red-500',
      activeBorderClass: 'ring-2 ring-red-400 border-red-600'
    },
    {
      id: 'blue_white',
      name: appConfig?.rationCardConfigs?.blue_white?.label || 'গোল্ডেন',
      fee: appConfig?.rationCardConfigs?.blue_white?.price || 300,
      color: 'bg-blue-500',
      activeBorderClass: 'ring-2 ring-blue-400 border-blue-600'
    },
    {
      id: 'green_white',
      name: appConfig?.rationCardConfigs?.green_white?.label || 'প্রিমিয়াম',
      fee: appConfig?.rationCardConfigs?.green_white?.price || 200,
      color: 'bg-emerald-500',
      activeBorderClass: 'ring-2 ring-emerald-400 border-emerald-600'
    },
    {
      id: 'black_white',
      name: appConfig?.rationCardConfigs?.black_white?.label || 'রেগুলার',
      fee: appConfig?.rationCardConfigs?.black_white?.price || 100,
      color: 'bg-slate-700',
      activeBorderClass: 'ring-2 ring-slate-400 border-slate-500'
    }
  ];

  const selectedCategoryObj = cardCategories.find(c => c.id === cardType) || cardCategories[3];
  const totalFee = selectedCategoryObj.fee * parseInt(duration);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-use profile pic
    const userPhoto = liveUser.profilePic || liveUser.photoURL || '';

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
      const cardNo = liveUser?.memberId || liveUser?.phone || `BNB-${Date.now()}`;
      
      // 3. Deduct balance from user
      const userRef = doc(db, 'users', liveUser.uid);
      await updateDoc(userRef, {
        balance: userBalance - totalFee,
        mainBalance: userBalance - totalFee
      });

      // 4. Create Ration Card record
      const expiryDateObj = new Date(new Date().setFullYear(new Date().getFullYear() + parseInt(duration)));
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
        cardType: cardType, 
        cardNo: cardNo,
        cardNumber: cardNo,
        photoUrl: userPhoto,
        status: 'pending',
        createdAt: timestamp,
        issueDate: new Date().toLocaleDateString('bn-BD'),
        expiryDate: expiryDateObj.toLocaleDateString('bn-BD'),
        expiryTimestamp: expiryDateObj.toISOString(),
        signature: 'S.Hasan'
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
    <div className="fixed inset-0 z-[60] bg-white overflow-y-auto font-sans text-slate-800 select-none animate-fade-in">
      {onClose && (
        <div className="sticky top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center justify-between">
           <UnifiedBackButton onClick={onClose} variant="dark" title="পিছনে যান" />
           <h2 className="text-[13px] font-black text-[#015335]">রেশন কার্ড আবেদন ফর্ম</h2>
           <div className="w-8" />
        </div>
      )}

      <div className="max-w-xl mx-auto p-4 space-y-4">
        
        <div className="text-center space-y-0.5 py-1">
          <h2 className="text-[16px] font-black text-[#015335]">🥗 ডিজিটাল রেশন কার্ড আবেদনপত্র</h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">ভর্তুকি পণ্য সুবিধা পাওয়ার স্মার্ট কার্ড</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
          <p className="text-[9px] text-emerald-950 font-bold leading-tight">
            ওয়ালেটে পর্যাপ্ত মেইন ব্যালেন্স থাকতে হবে। আবেদন সম্পূর্ণ হওয়ামাত্রই অ্যাকাউন্ট থেকে ফি কেটে নেওয়া হবে।
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-tight ml-1">কার্ড ক্যাটাগরি নির্বাচন করুন *</label>
          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
            {cardCategories.map((category, idx) => {
              const isSelected = cardType === category.id;
              return (
                <div
                  key={`${category.id}-${idx}`}
                  onClick={() => setCardType(category.id)}
                  className={`border rounded-lg p-1.5 cursor-pointer transition-all flex-1 min-w-[75px] flex flex-col items-center justify-center gap-1 text-center ${
                    isSelected 
                      ? category.activeBorderClass + ' bg-white shadow-sm scale-[1.02]' 
                      : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${category.color} flex items-center justify-center`}>
                    {isSelected && <Check className="w-1.5 h-1.5 text-white stroke-[4]" />}
                  </div>
                  <div className="space-y-0">
                    <h4 className="text-[8.5px] font-black text-slate-800 leading-none truncate w-full px-0.5">{category.name}</h4>
                    <p className="text-[10px] font-mono font-black text-emerald-700 leading-none mt-0.5">৳{category.fee}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">সদস্যের নাম *</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-emerald-500 transition-all" 
                required 
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">মোবাইল নাম্বার *</label>
              <input 
                type="text" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono font-bold outline-none focus:border-emerald-500 transition-all" 
                required 
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">পূর্ণ ঠিকানা (গ্রাম, উপজেলা, জেলা) *</label>
            <textarea 
              value={address} 
              onChange={(e) => setAddress(e.target.value)} 
              placeholder="যেমন: খড়কী, যশোর সদর, যশোর"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none h-12 resize-none focus:border-emerald-500 transition-all" 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">মেয়াদের সময়সীমা</label>
              <select 
                value={duration} 
                onChange={(e) => setDuration(e.target.value)} 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none"
              >
                {[1, 2, 3, 4, 5].map(y => <option key={y} value={y.toString()}>{y} বছর</option>)}
              </select>
            </div>

            <div className="bg-slate-900 text-white px-3 py-2 rounded-xl flex justify-between items-center">
              <div>
                <p className="text-[8px] text-slate-400 font-bold uppercase leading-none">মোট ফি</p>
                <p className="text-[9px] text-emerald-400 font-black mt-1">৳{selectedCategoryObj.fee} × {duration}</p>
              </div>
              <div className="text-right">
                <span className="text-[15px] font-black text-white font-mono leading-none">৳{totalFee}</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full py-3.5 bg-[#015335] hover:bg-[#014028] disabled:bg-slate-300 text-white rounded-xl font-black text-[11px] transition cursor-pointer shadow-lg uppercase tracking-widest active:scale-95"
            >
              {submitting ? 'প্রসেস হচ্ছে...' : `✓ ৳${totalFee} পরিশোধ ও আবেদন জমা দিন`}
            </button>
            <p className="text-[8.5px] text-slate-400 text-center mt-2.5 font-bold">
              প্রোফাইল পিকচারটি রেশন কার্ডে অটোমেটিক সেট করা হবে।
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
