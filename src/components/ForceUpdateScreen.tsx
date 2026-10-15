import React from 'react';
import { motion } from 'motion/react';
import { Download, ShieldCheck, Rocket, Star, ShieldAlert, Lock } from 'lucide-react';
import { AppConfig, User } from '../types';
import { BNBLogo } from './BNBLogo';

interface ForceUpdateScreenProps {
  appConfig: AppConfig;
  currentUser: User | null;
  onBypassAdmin: () => void;
}

export default function ForceUpdateScreen({ appConfig, currentUser, onBypassAdmin }: ForceUpdateScreenProps) {
  const handleUpdateClick = () => {
    if (appConfig.downloadLink) {
      window.open(appConfig.downloadLink, '_blank', 'noopener,noreferrer');
    }
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'sub_admin';

  return (
    <div 
      className="fixed inset-0 z-100 flex flex-col items-center justify-between p-6 text-center select-none overflow-y-auto font-sans bg-slate-950"
      style={{
        backgroundImage: 'radial-gradient(circle at center, rgba(16, 24, 48, 0.5) 0%, rgba(2, 6, 23, 1) 100%)',
        backgroundSize: 'cover'
      }}
    >
      {/* Top Section - Logo & Branding */}
      <div className="w-full max-w-md pt-8 flex flex-col items-center">
        {isAdmin ? (
          <div 
            onClick={onBypassAdmin}
            className="cursor-pointer transform active:scale-95 transition"
          >
            {appConfig.logoUrl ? (
              <img 
                src={appConfig.logoUrl} 
                alt="BNB Logo" 
                className="h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <BNBLogo className="h-12 w-auto drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]" />
            )}
          </div>
        ) : (
          <div>
            {appConfig.logoUrl ? (
              <img 
                src={appConfig.logoUrl} 
                alt="BNB Logo" 
                className="h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <BNBLogo className="h-12 w-auto drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]" />
            )}
          </div>
        )}

        <h2 className="text-white text-xs font-black tracking-[0.2em] uppercase mt-2 font-sans">
          BNB BUSINESS
        </h2>
        <p className="text-slate-400 text-[9.5px] font-semibold tracking-wider -mt-0.5">
          Network Bangladesh
        </p>
      </div>

      {/* Middle Section - Header & Core Update Graphics */}
      <div className="w-full max-w-md my-auto py-6 flex flex-col items-center space-y-5">
        <div className="space-y-1">
          <span className="text-[10px] text-amber-500 font-black tracking-widest uppercase bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
            NEW UPDATE AVAILABLE
          </span>
          <h1 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-200 pt-1.5">
            {appConfig.updateTitle || 'নতুন সংস্করণ উপলব্ধ!'}
          </h1>
          <p className="text-[10.5px] text-slate-400 font-bold max-w-xs mx-auto leading-normal">
            {appConfig.updateDescription || 'BNB BUSINESS Network Bangladesh-এর নতুন আপডেট প্রকাশিত হয়েছে।'}
          </p>
        </div>

        {/* Central Glowing Shield Graphic */}
        <div className="relative w-40 h-40 flex items-center justify-center">
          {/* Animated Glow Backdrops */}
          <div className="absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full animate-pulse" />
          <div className="absolute inset-4 rounded-full border border-indigo-500/20 animate-spin" style={{ animationDuration: '20s' }} />
          
          <div className="w-28 h-28 bg-gradient-to-tr from-slate-900 to-indigo-950 rounded-3xl border border-indigo-500/40 flex items-center justify-center shadow-xl shadow-indigo-950/40 relative">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="w-16 h-16 text-indigo-400 flex items-center justify-center relative"
            >
              <img 
                src={appConfig.logoUrl || "https://img.icons8.com/color/144/checked-laptop.png"} 
                alt="App Icon" 
                className="w-full h-full object-contain rounded-2xl"
                onError={(e) => {
                  // Fallback if logo is missing or fails
                  e.currentTarget.style.display = 'none';
                }}
              />
              <ShieldCheck className="w-14 h-14 absolute stroke-[1.5]" />
            </motion.div>
            
            {/* Success validation green badge */}
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1 rounded-full border-2 border-slate-950 shadow-md">
              <ShieldCheck className="w-4 h-4 font-bold text-white fill-emerald-500" />
            </div>
          </div>
        </div>

        {/* Highlight Cards Grid */}
        <div className="grid grid-cols-1 gap-2.5 w-full max-w-sm px-2 text-left font-sans">
          
          {/* Item 1 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex items-center gap-3.5 shadow-sm">
            <div className="w-9 h-9 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/15 shrink-0">
              <Rocket className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="text-[11.5px] font-black text-slate-100 block">দ্রুত পারফরম্যান্স</span>
              <span className="text-[9.5px] text-slate-400 font-bold block">আরও দ্রুত ও স্মুথ অভিজ্ঞতা</span>
            </div>
          </div>

          {/* Item 2 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex items-center gap-3.5 shadow-sm">
            <div className="w-9 h-9 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/15 shrink-0">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="text-[11.5px] font-black text-slate-100 block">উন্নত নিরাপত্তা</span>
              <span className="text-[9.5px] text-slate-400 font-bold block">আপনার তথ্য থাকবে আরও নিরাপদ</span>
            </div>
          </div>

          {/* Item 3 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex items-center gap-3.5 shadow-sm">
            <div className="w-9 h-9 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/15 shrink-0">
              <Star className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="text-[11.5px] font-black text-slate-100 block">নতুন ফিচার</span>
              <span className="text-[9.5px] text-slate-400 font-bold block">নতুন ফিচার ও বাগ ফিক্স করা হয়েছে</span>
            </div>
          </div>
        </div>

        {/* Required warning message box */}
        <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-2.5 w-full max-w-sm text-left shadow-sm">
          <ShieldAlert className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[10px] text-amber-300 font-bold leading-normal">
            অ্যাপ ব্যবহার চালিয়ে যেতে হলে নতুন ভার্সন ইনস্টল করা বাধ্যতামূলক।
            <span className="block text-slate-300 text-[9px] font-semibold mt-0.5">নতুন ভার্সনে আপডেট না করা পর্যন্ত কোনো সার্ভিস কাজ করবে না।</span>
          </div>
        </div>
      </div>

      {/* Bottom Section - Core CTA and Admin Bypass */}
      <div className="w-full max-w-sm pb-8 flex flex-col items-center space-y-4">
        
        {/* Core Update Action Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleUpdateClick}
          className="w-full py-4.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs rounded-2xl tracking-wide flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all duration-300 active:scale-98"
        >
          <Download className="w-4.5 h-4.5 animate-bounce" />
          এখনই আপডেট করুন
        </motion.button>

        {/* Footer warnings */}
        <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-bold">
          <Lock className="w-3 h-3 text-slate-500" />
          <span>আপডেট না করলে অ্যাপ ব্যবহার করতে পারবেন না</span>
        </div>

        {/* Back door for admins */}
        {isAdmin && (
          <button 
            onClick={onBypassAdmin}
            className="text-[9.5px] font-semibold text-slate-500 hover:text-slate-300 underline transition cursor-pointer"
          >
            🛠️ bypass as admin
          </button>
        )}
      </div>
    </div>
  );
}
