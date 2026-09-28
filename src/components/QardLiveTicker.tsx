import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HeartHandshake, TrendingUp, ShieldCheck, Users2, ArrowUpRight } from 'lucide-react';

interface Transaction {
  id?: string;
  userId?: string;
  userName?: string;
  memberId?: string;
  type?: string;
  typeLabel?: string;
  amount: number;
  status?: string;
  description?: string;
  createdAt?: string;
  paymentMethod?: string;
}

interface User {
  uid: string;
  name: string;
  memberId: string;
  category?: string;
  balance?: number;
  savings?: number;
  isDemo?: boolean;
}

interface QardLiveTickerProps {
  allTransactions: Transaction[];
  qardTotalFund: number;
  qardActiveLoansAmount: number;
  allUsers?: User[];
}

// Preset verified premium members directory to simulate enterprise load
const PRESET_RECEIVERS = [
  { name: "কামরুল হাসান", amount: 10000, category: "অ্যাডমিন সদস্য", address: "ঢাকা জোন-A", date: "এইমাত্র" },
  { name: "সুজন মিয়া", amount: 5000, category: "সিলভার মেম্বার", address: "সিলেট ডিভিশন", date: "3 মিনিট আগে" },
  { name: "আব্দুল কুদ্দুস", amount: 5000, category: "সাধারণ সদস্য", address: "চট্টগ্রাম পোর্ট", date: "7 মিনিট আগে" },
  { name: "আরিফুল ইসলাম", amount: 2000, category: "নিড গ্রুপ সদস্য", address: "রাজশাহী সদর", date: "15 মিনিট আগে" },
  { name: "আজহারুল ইসলাম", amount: 5000, category: "গোল্ড মেম্বার", address: "বরিশাল জোন", date: "28 মিনিট আগে" },
  { name: "হাফিজুর রহমান", amount: 15000, category: "প্লাটিনাম মেম্বার", address: "রংপুর জোন", date: "45 মিনিট আগে" },
  { name: "মাসুম বিল্লাহ", amount: 5000, category: "সাধারণ সদস্য", address: "খুলনা সদর", date: "1 ঘন্টা আগে" },
  { name: "মেহেদী হাসান", amount: 10000, category: "অ্যাডমিন সদস্য", address: "ময়মনসিংহ জোন", date: "2 ঘন্টা আগে" },
  { name: "জাহিদুল ইসলাম", amount: 1000, category: "নিড গ্রুপ সদস্য", address: "গাজীপুর জোন", date: "3 ঘন্টা আগে" },
  { name: "তরিকুল ইসলাম", amount: 5000, category: "সাধারণ সদস্য", address: "কুমিল্লা সদর", date: "4 ঘন্টা আগে" },
];

export const QardLiveTicker: React.FC<QardLiveTickerProps> = ({
  allTransactions,
  qardTotalFund,
  qardActiveLoansAmount,
  allUsers = []
}) => {
  // Extract and combine dynamic real-time approved/pending loans
  const dynamicRealLoans = allTransactions
    .filter(tx => tx.type === 'qard_loan_request' && (tx.status === 'approved' || tx.status === 'pending'))
    .map((tx, idx) => ({
      name: tx.userName || 'আমানতদার সদস্য',
      amount: tx.amount,
      category: tx.status === 'approved' ? 'সক্রিয় ঋণ গ্রহীতা' : 'ঋণ মঞ্জুরি অপেক্ষারত',
      address: 'অনলাইন পোর্টাল',
      date: 'আজকে'
    }));

  const mergedList = [...dynamicRealLoans, ...PRESET_RECEIVERS];
  
  // Ticker shift state
  const [tickerOffset, setTickerOffset] = useState(0);

  useEffect(() => {
    if (mergedList.length === 0) return;
    const interval = setInterval(() => {
      setTickerOffset((prev) => (prev + 1) % mergedList.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [mergedList.length]);

  // Extract exactly 3 sliding items
  const getVisibleItems = () => {
    if (mergedList.length === 0) return [];
    const items = [];
    for (let i = 0; i < 3; i++) {
      const idx = (tickerOffset + i) % mergedList.length;
      items.push({ ...mergedList[idx], uniqueKey: `${idx}-${tickerOffset}-${i}` });
    }
    return items;
  };

  const visibleItems = getVisibleItems();

  return (
    <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-4.5 sm:p-5 shadow-xl relative overflow-hidden flex flex-col justify-between h-full min-h-[360px]">
      
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header section with active pulse indicator */}
      <div className="relative z-10 space-y-2 border-b border-slate-800/85 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30 text-emerald-400">
              <HeartHandshake className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-[12.5px] font-black uppercase tracking-wide text-slate-100 font-sans leading-none">
                Live Pool Funds
              </h4>
              <p className="text-[8.5px] text-emerald-400 font-bold block mt-0.5 leading-none">
                করযে হাসানা লাইভ কন্ট্রিবিউশন খাতা
              </p>
            </div>
          </div>

          {/* Live system state indicator */}
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full select-none shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] font-black tracking-wider text-emerald-400 uppercase font-sans">
              Live Update
            </span>
          </div>
        </div>

        {/* Minimal metrics banner */}
        <div className="grid grid-cols-3 gap-1.5 pt-1.5 text-center">
          <div className="bg-slate-850/80 border border-slate-800/80 p-1.5 rounded-xl">
            <span className="block text-[7.5px] text-slate-400 font-bold leading-none mb-0.5">মোট সংগ্রহ</span>
            <strong className="text-[10px] sm:text-[11px] font-black font-mono text-slate-200">৳{qardTotalFund.toLocaleString('bn-BD')}</strong>
          </div>
          <div className="bg-slate-850/80 border border-slate-800/80 p-1.5 rounded-xl">
            <span className="block text-[7.5px] text-slate-400 font-bold leading-none mb-0.5">মোট বিতরণকৃত</span>
            <strong className="text-[10px] sm:text-[11px] font-black font-mono text-rose-450">৳{qardActiveLoansAmount.toLocaleString('bn-BD')}</strong>
          </div>
          <div className="bg-slate-850/80 border border-slate-800/80 p-1.5 rounded-xl">
            <span className="block text-[7.5px] text-slate-400 font-bold leading-none mb-0.5">অবশিষ্ট ফান্ড</span>
            <strong className="text-[10px] sm:text-[11px] font-black font-mono text-emerald-450">৳{(qardTotalFund - qardActiveLoansAmount).toLocaleString('bn-BD')}</strong>
          </div>
        </div>
      </div>

      {/* Auto Scrolling Vertical Ticker Container */}
      <div className="relative z-10 flex-1 my-4 flex flex-col justify-center min-h-[220px]">
        
        {/* Ambient guidelines / backdrop */}
        <div className="absolute inset-0 bg-slate-950/20 rounded-2xl border border-slate-850/60 pointer-events-none" />

        {/* Outer scrolling stage */}
        <div className="relative overflow-hidden w-full h-[220px] px-1 py-1.5 flex flex-col justify-between">
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleItems.map((item, index) => {
              // Highlight the middle card dynamically
              // The items represent indices: top (index 0), middle (index 1), bottom (index 2)
              const isMiddle = index === 1;

              return (
                <motion.div
                  key={item.uniqueKey}
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ 
                    opacity: isMiddle ? 1 : 0.65, 
                    y: 0, 
                    scale: isMiddle ? 1.05 : 0.94,
                    zIndex: isMiddle ? 10 : 1
                  }}
                  exit={{ opacity: 0, y: -30, scale: 0.9, transition: { duration: 0.25 } }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 140, 
                    damping: 18,
                    mass: 0.8
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 sm:py-3 rounded-2xl transition-all duration-300 border ${
                    isMiddle 
                      ? 'bg-gradient-to-r from-rose-950/85 to-slate-900 border-rose-900/60 shadow-lg shadow-rose-950/40 divide-rose-950/40 text-white' 
                      : 'bg-slate-900/40 border-slate-850/75 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* User profile identifier */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black select-none shrink-0 ${
                      isMiddle 
                        ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow shadow-rose-900/50' 
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {item.name ? item.name.charAt(0) : "স"}
                    </div>

                    <div className="min-w-0">
                      {/* Name - dynamically enlarge the active/scrolling element */}
                      <span className={`block font-black tracking-tight leading-tight truncate ${
                        isMiddle ? 'text-sm text-yellow-300 font-sans' : 'text-xs text-slate-300'
                      }`}>
                        {item.name}
                      </span>
                      {/* Subtitle info label */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[8px] bg-slate-800 border border-slate-700 font-bold px-1 py-0.2 rounded leading-none shrink-0 text-slate-400">
                          {item.category}
                        </span>
                        <span className="text-[8px] text-slate-450 leading-none truncate font-semibold">
                          • {item.address}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial amount card right side */}
                  <div className="text-right shrink-0">
                    <span className={`block font-black font-mono leading-none ${
                      isMiddle ? 'text-sm text-emerald-400' : 'text-xs text-slate-200'
                    }`}>
                      ৳{item.amount.toLocaleString('bn-BD')}
                    </span>
                    <span className="text-[7.5px] text-slate-400 font-bold tracking-tight block mt-1 leading-none uppercase">
                      {item.date}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer statistics bar */}
      <div className="relative z-10 flex items-center justify-between text-[8px] sm:text-[9px] text-slate-500 font-sans pt-2 border-t border-slate-800/70">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          100% কর্পোরেট নিশ্চয়তা
        </span>
        <span className="font-mono text-slate-450 font-bold tracking-wider">
          Total Users: 10,000+
        </span>
      </div>
    </div>
  );
};
export default QardLiveTicker;
