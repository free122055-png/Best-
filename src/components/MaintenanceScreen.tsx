import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Clock, ShieldAlert, Settings, Wrench, AlertTriangle } from 'lucide-react';
import { AppConfig, User } from '../types';
import { BNBLogo } from './BNBLogo';

interface MaintenanceScreenProps {
  appConfig: AppConfig;
  currentUser: User | null;
  onBypassAdmin: () => void;
}

export default function MaintenanceScreen({ appConfig, currentUser, onBypassAdmin }: MaintenanceScreenProps) {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'sub_admin';

  return (
    <div 
      className="fixed inset-0 z-100 flex flex-col items-center justify-between p-6 text-center select-none overflow-y-auto font-sans bg-slate-950"
      style={{
        backgroundImage: appConfig.maintenanceBgUrl 
          ? `radial-gradient(circle at center, rgba(212, 175, 55, 0.15) 0%, rgba(2, 6, 23, 1) 100%), url(${appConfig.maintenanceBgUrl})`
          : 'radial-gradient(circle at center, rgba(212, 175, 55, 0.1) 0%, rgba(2, 6, 23, 1) 70%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Top Section - Logo & Branding */}
      <div className="w-full max-w-md pt-8 flex flex-col items-center">
        <div className="relative group">
          {appConfig.maintenanceLogoUrl || appConfig.logoUrl ? (
            <img 
              src={appConfig.maintenanceLogoUrl || appConfig.logoUrl} 
              alt="BNB Logo" 
              className="h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]">
              <BNBLogo className="h-16 w-auto" />
            </div>
          )}
        </div>
        
        <h2 className="text-amber-500 text-xs font-black tracking-[0.2em] uppercase mt-3 drop-shadow-sm font-sans">
          BNB BUSINESS
        </h2>
        <p className="text-slate-400 text-[10px] font-semibold tracking-wider -mt-0.5">
          Network Bangladesh
        </p>
      </div>

      {/* Middle Section - Core Animation & Text */}
      <div className="w-full max-w-lg my-auto py-8 flex flex-col items-center space-y-6">
        
        {/* Core Animation Area */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          {appConfig.maintenanceAnimationUrl && appConfig.maintenanceAnimationUrl.startsWith('http') && appConfig.maintenanceAnimationUrl.includes('embed') ? (
            <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-amber-500/20 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2">
              <iframe 
                src={appConfig.maintenanceAnimationUrl.includes('embed') ? appConfig.maintenanceAnimationUrl : `https://embed.lottiefiles.com/animation/${appConfig.maintenanceAnimationUrl.split('/').pop()?.split('.')[0]}`}
                className="w-full h-full border-0 pointer-events-none"
                title="Maintenance Lottie"
              />
            </div>
          ) : (
            /* Breathtaking Gold + Dark Custom Rotating Gear CSS/SVG Animation */
            <div className="relative w-44 h-44 flex items-center justify-center">
              {/* Pulsing Outer Rings */}
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500/20 animate-spin" style={{ animationDuration: '40s' }} />
              <div className="absolute inset-2 rounded-full border border-amber-500/10 animate-ping" style={{ animationDuration: '3s' }} />
              
              {/* Outer Golden Glow Aura */}
              <div className="absolute inset-4 rounded-full bg-amber-500/5 blur-xl animate-pulse" />

              {/* Glowing Gear SVG */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
                className="absolute w-36 h-36 text-amber-500/90 drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]"
              >
                <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full">
                  <path d="M50 35c-8.3 0-15 6.7-15 15s6.7 15 15 15 15-6.7 15-15-6.7-15-15-15zm0 25c-5.5 0-10-4.5-10-10s4.5-10 10-10 10 4.5 10 10-4.5 10-10 10z" />
                  <path d="M91.3 43.7l-7.7-1.3c-.6-2.5-1.6-4.9-3-7.1l4.5-6.4c1.1-1.6.9-3.7-.5-5.1L79.2 18c-1.4-1.4-3.5-1.6-5.1-.5l-6.4 4.5c-2.2-1.4-4.6-2.4-7.1-3l-1.3-7.7c-.3-1.9-2-3.3-4-3.3h-10.7c-2 0-3.7 1.4-4 3.3l-1.3 7.7c-2.5.6-4.9 1.6-7.1 3l-6.4-4.5c-1.6-1.1-3.7-.9-5.1.5L18 20.8c-1.4 1.4-1.6 3.5-.5 5.1l4.5 6.4c-1.4 2.2-2.4 4.6-3 7.1l-7.7 1.3c-1.9.3-3.3 2-3.3 4v10.7c0 2 1.4 3.7 3.3 4l7.7 1.3c.6 2.5 1.6 4.9 3 7.1l-4.5 6.4c-1.1 1.6-.9 3.7.5 5.1L20.8 82c1.4 1.4 3.5 1.6 5.1.5l6.4-4.5c2.2 1.4 4.6 2.4 7.1 3l1.3 7.7c.3 1.9 2 3.3 4 3.3h10.7c2 0 3.7-1.4 4-3.3l1.3-7.7c2.5-.6 4.9-1.6 7.1-3l6.4 4.5c1.6 1.1 3.7.9 5.1-.5l5.4-5.4c1.4-1.4 1.6-3.5.5-5.1l-4.5-6.4c1.4-2.2 2.4-4.6 3-7.1l7.7-1.3c1.9-.3 3.3-2 3.3-4V47.7c0-2-1.4-3.7-3.3-4zM50 65c-8.3 0-15-6.7-15-15s6.7-15 15-15 15 6.7 15 15-6.7 15-15 15z" />
                </svg>
              </motion.div>

              {/* Smaller Counter-Rotating Gear */}
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                className="absolute w-16 h-16 text-amber-600/70 bottom-3 right-3 drop-shadow-[0_0_10px_rgba(217,119,6,0.3)]"
              >
                <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full">
                  <path d="M50 35c-8.3 0-15 6.7-15 15s6.7 15 15 15 15-6.7 15-15-6.7-15-15-15zm0 25c-5.5 0-10-4.5-10-10s4.5-10 10-10 10 4.5 10 10-4.5 10-10 10z" />
                  <path d="M91.3 43.7l-7.7-1.3c-.6-2.5-1.6-4.9-3-7.1l4.5-6.4c1.1-1.6.9-3.7-.5-5.1L79.2 18c-1.4-1.4-3.5-1.6-5.1-.5l-6.4 4.5c-2.2-1.4-4.6-2.4-7.1-3l-1.3-7.7c-.3-1.9-2-3.3-4-3.3h-10.7c-2 0-3.7 1.4-4 3.3l-1.3 7.7c-2.5.6-4.9 1.6-7.1 3l-6.4-4.5c-1.6-1.1-3.7-.9-5.1.5L18 20.8c-1.4 1.4-1.6 3.5-.5 5.1l4.5 6.4c-1.4 2.2-2.4 4.6-3 7.1l-7.7 1.3c-1.9.3-3.3 2-3.3 4v10.7c0 2 1.4 3.7 3.3 4l7.7 1.3c.6 2.5 1.6 4.9 3 7.1l-4.5 6.4c-1.1 1.6-.9 3.7.5 5.1L20.8 82c1.4 1.4 3.5 1.6 5.1.5l6.4-4.5c2.2 1.4 4.6 2.4 7.1 3l1.3 7.7c.3 1.9 2 3.3 4 3.3h10.7c2 0 3.7-1.4 4-3.3l1.3-7.7c2.5-.6 4.9-1.6 7.1-3l6.4 4.5c1.6 1.1 3.7.9 5.1-.5l5.4-5.4c1.4-1.4 1.6-3.5-.5-5.1l-4.5-6.4c1.4-2.2 2.4-4.6 3-7.1l7.7-1.3c1.9-.3 3.3-2 3.3-4V47.7c0-2-1.4-3.7-3.3-4zM50 65c-8.3 0-15-6.7-15-15s6.7-15 15-15 15 6.7 15 15-6.7 15-15 15z" />
                </svg>
              </motion.div>

              {/* Core Floating Glowing Golden Wrench */}
              <motion.div
                animate={{ 
                  y: [0, -6, 0],
                  rotate: [0, 8, -8, 0]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 4, 
                  ease: 'easeInOut' 
                }}
                className="absolute w-14 h-14 text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]"
              >
                <Wrench className="w-full h-full stroke-[2]" />
              </motion.div>

              {/* Tiny Warning Indicator */}
              <div className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full border-2 border-slate-950 shadow-md">
                <AlertTriangle className="w-3.5 h-3.5 font-bold" />
              </div>
            </div>
          )}
        </div>

        {/* Text Details with Gradient Title */}
        <div className="space-y-3.5 px-4">
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl md:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-200 drop-shadow-[0_2px_10px_rgba(245,158,11,0.2)]"
          >
            {appConfig.maintenanceTitle || 'আমরা আপডেট করছি'}
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm md:text-base text-slate-100 leading-relaxed max-w-sm mx-auto font-medium"
          >
            {appConfig.maintenanceDescription || 'আপনাদের জন্য আরও উন্নত, দ্রুত ও নিরাপদ সেবা নিশ্চিত করতে আমাদের সিস্টেম বর্তমানে আপডেট করা হচ্ছে।'}
          </motion.p>
        </div>

        {/* Estimated Time Badge */}
        {appConfig.maintenanceEstimatedTime && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-amber-950/60 border border-amber-500/40 px-5 py-2.5 rounded-2xl flex items-center gap-2.5 inline-flex shadow-inner drop-shadow-md backdrop-blur-xs"
          >
            <Clock className="w-4.5 h-4.5 text-amber-400 animate-pulse" />
            <span className="text-[10px] uppercase font-black tracking-widest text-amber-200">আনুমানিক সময়:</span>
            <span className="text-xs font-black text-amber-300 font-mono">
              {appConfig.maintenanceEstimatedTime}
            </span>
          </motion.div>
        )}
      </div>

      {/* Bottom Section - Footer & Admin Escape Button */}
      <div className="w-full max-w-md pb-8 flex flex-col items-center space-y-4">
        {/* Helper bottom warning */}
        <div className="text-[11.5px] text-slate-300 font-bold max-w-xs leading-normal">
          দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।
          <span className="block mt-0.5 text-slate-200">আপনাদের সহযোগিতার জন্য ধন্যবাদ।</span>
        </div>

        {/* Dynamic Admin access gate */}
        {isAdmin ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBypassAdmin}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs rounded-2xl tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-98 transition duration-300"
          >
            <Settings className="w-4 h-4 animate-spin-slow" />
            🛠️ অ্যাডমিন কন্ট্রোল প্যানেলে প্রবেশ করুন
          </motion.button>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-bold bg-slate-900/80 py-1 px-3 rounded-full border border-slate-700">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>সিস্টেম সিকিউরিটি এনফোর্সড সচল</span>
          </div>
        )}
      </div>
    </div>
  );
}
