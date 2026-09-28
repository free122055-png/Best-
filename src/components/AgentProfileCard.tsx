import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, Eye, Navigation, Heart, Share2, AlertTriangle, X, Phone, Send 
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  city: string;
  country: string;
  flag: string;
  phone: string;
  whatsapp?: string;
  img: string;
  lat: number;
  lng: number;
  realLat?: number;
  realLng?: number;
  verified?: boolean;
  status?: 'Available' | 'Busy' | 'Offline';
  distance?: number | null;
  estTime?: string | null;
  travelType?: string | null;
  role?: string;
  shopMapLink?: string;
  locationNumber?: string;
}

interface AgentProfileCardProps {
  agent: Agent;
  lang: 'bn' | 'en';
  onClose: () => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onOpenReport: (agent: Agent) => void;
  t: any;
  toBanglaDigits: (numStr: string) => string;
  userRole?: string;
  onDeleteAgent?: (id: string) => void;
}

export default function AgentProfileCard({
  agent,
  lang,
  onClose,
  favorites,
  onToggleFavorite,
  onOpenReport,
  t,
  toBanglaDigits,
  userRole,
  onDeleteAgent,
}: AgentProfileCardProps) {
  const [showSensitive, setShowSensitive] = useState<boolean>(false);
  const isFavorite = favorites.includes(agent.id);

  const handleShare = () => {
    const lat = agent.realLat !== undefined ? agent.realLat : agent.lat;
    const lng = agent.realLng !== undefined ? agent.realLng : agent.lng;
    navigator.clipboard.writeText(
      `AMB Agent: ${agent.name}, Phone: ${agent.phone}, Map URL: https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    );
    alert(lang === 'bn' ? 'এজেন্টের তথ্য সফলভাবে ক্লিপবোর্ডে কপি করা হয়েছে!' : 'Agent information successfully copied to clipboard!');
  };

  const lat = agent.realLat !== undefined ? agent.realLat : agent.lat;
  const lng = agent.realLng !== undefined ? agent.realLng : agent.lng;

  return (
    <div className="space-y-3.5">
      {/* Floating Header Banner */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[11.5px] font-black text-slate-800 uppercase tracking-wider">{t.selectedAgent}</h3>
        <button 
          onClick={onClose}
          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full cursor-pointer transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* BANK CREDIT-CARD-LIKE PROFILE CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-5 border border-white/10 relative overflow-hidden shadow-md aspect-[1.58/1] flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#0D9488]/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
        
        {/* Glowing Logo & Chip */}
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-xs font-black text-slate-100 tracking-tight flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              AMB Cooperative Ltd.
            </h4>
            <p className="text-[7px] text-[#22C55E] font-black tracking-widest uppercase font-mono">
              {agent.role || 'APPROVED CO-OP AGENT'}
            </p>
          </div>
          
          {/* NFC chip logo indicator */}
          <div className="w-8 h-6 bg-amber-400/25 rounded-lg border border-amber-300/40 flex items-center justify-center p-1 overflow-hidden shrink-0">
            <div className="grid grid-cols-3 gap-0.5 w-full h-full opacity-70">
              <div className="border border-amber-300/30 rounded-xs" />
              <div className="border border-amber-300/30 rounded-xs bg-amber-400/10" />
              <div className="border border-amber-300/30 rounded-xs" />
            </div>
          </div>
        </div>

        {/* Agent Avatar / Name / ID */}
        <div className="flex items-center gap-3.5 my-1 z-10">
          <div className="w-12 h-12 rounded-2xl border-2 border-white/20 overflow-hidden shrink-0 shadow-sm bg-slate-800">
            <img 
              src={agent.img} 
              alt={agent.name} 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white leading-tight font-sans tracking-tight truncate flex items-center gap-1">
              {agent.name}
              {agent.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 fill-emerald-400/10" />}
            </h3>
            <p className="text-[8px] text-slate-350 font-mono mt-0.5">
              ID: AMB-AGT-{agent.id.substring(0, 6).toUpperCase()}
            </p>
            <p className="text-[8px] text-[#22C55E] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-block mt-1 font-bold">
              ● {agent.status === 'Available' ? t.agentCardStatusActive : agent.status === 'Busy' ? t.agentCardStatusBusy : t.agentCardStatusOffline}
            </p>
          </div>
        </div>

        {/* Expiry / Phone Tapper */}
        <div className="flex justify-between items-end border-t border-white/10 pt-2.5 z-10">
          <div className="text-[7.5px] text-slate-400 font-bold tracking-wider">
            <p className="text-[6.5px] uppercase text-slate-500">EXPIRED</p>
            <p className="font-mono text-slate-200">12 / 30</p>
          </div>

          {/* EYE reveal phone number system */}
          <button 
            onClick={() => setShowSensitive(!showSensitive)}
            className="bg-white/10 hover:bg-white/20 border border-white/10 px-2.5 py-1 rounded-xl text-[8.5px] font-black flex items-center gap-1 transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-teal-300" />
            <span>
              {showSensitive ? agent.phone : '••• ••• •••• ' + (lang === 'bn' ? 'তথ্য দেখুন' : 'REVEAL')}
            </span>
          </button>
        </div>
      </div>

      {/* Live Details info under Card */}
      <div className="bg-white border border-slate-150 p-4 rounded-3xl shadow-3xs space-y-3 font-sans text-xs">
        <div className="grid grid-cols-2 gap-3 pt-0.5">
          <div className="space-y-0.5 text-left">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t.locationLabel}</p>
            <p className="font-bold text-slate-800">{agent.city}, {agent.country} {agent.flag}</p>
          </div>
          <div className="space-y-0.5 text-left">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t.phoneLabel}</p>
            <p className="font-bold font-mono text-slate-800">{showSensitive ? agent.phone : '********'}</p>
          </div>
        </div>

        {/* Interactive Distance estimation badge */}
        {agent.distance !== null && agent.distance !== undefined && (
          <div className="bg-emerald-50 border border-emerald-100/50 p-2.5 rounded-2xl flex items-center justify-between text-[11px] text-left">
            <span className="font-bold text-emerald-800 flex items-center gap-1.5">
              <span>{agent.travelType === 'হাঁটা পথ' ? '🚶' : '🚗'}</span>
              <span>{t.distLabel} {toBanglaDigits(agent.distance.toFixed(1))} কি.মি.</span>
            </span>
            <span className="font-black text-emerald-900">{t.timeLabel} {agent.estTime}</span>
          </div>
        )}

        {/* 3 BIG DIRECT INTERACTION ACTIONS */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* Button 1: Call Now */}
          <a 
            href={`tel:${agent.phone}`}
            className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-[10.5px] transition duration-150 flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-700/10 text-center"
          >
            <span>{t.callBtn}</span>
          </a>

          {/* Button 2: WhatsApp Chat */}
          <a 
            href={`https://wa.me/${agent.whatsapp || agent.phone.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="py-2.5 bg-[#25D366] hover:bg-[#20ba56] text-white font-black rounded-xl text-[10.5px] transition duration-150 flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-700/10 text-center"
          >
            <span>{t.waBtn}</span>
          </a>

          {/* Button 3: Get Direction */}
          <a 
            href={agent.shopMapLink || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
            target="_blank"
            rel="noreferrer"
            className="py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-[10.5px] transition duration-150 flex items-center justify-center gap-1.5 shadow-sm shadow-sky-700/10 text-center"
          >
            <Navigation className="w-3.5 h-3.5 shrink-0" />
            <span>{t.dirBtn}</span>
          </a>
        </div>

        {/* EXTRA ACTION BAR: FAVORITE, SHARE, REPORT */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button 
            onClick={() => onToggleFavorite(agent.id)}
            className={`flex-1 py-1.5 border rounded-xl text-[9.5px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${isFavorite ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-slate-500 border-slate-200'}`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>{isFavorite ? (lang === 'bn' ? 'ফেভারিট' : 'Favorited') : t.favBtn}</span>
          </button>

          <button 
            onClick={handleShare}
            className="flex-1 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-[9.5px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t.shareBtn}</span>
          </button>

          <button 
            onClick={() => onOpenReport(agent)}
            className="flex-1 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 rounded-xl text-[9.5px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer hover:border-rose-200"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>{t.reportBtn}</span>
          </button>
        </div>

        {/* Admin Delete Action */}
        {(userRole === 'admin' || userRole === 'sub_admin') && onDeleteAgent && (
          <button
            onClick={() => {
              if (window.confirm(lang === 'bn' ? 'আপনি কি নিশ্চিতভাবে এই এজেন্টকে ডিরেক্টরি থেকে ডিলিট করতে চান?' : 'Are you sure you want to delete this agent?')) {
                onDeleteAgent(agent.id);
              }
            }}
            className="w-full mt-2.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-[10px] transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            ❌ এজেন্ট ডিলিট করুন (Delete Agent)
          </button>
        )}
      </div>
    </div>
  );
}
