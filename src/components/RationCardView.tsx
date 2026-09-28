import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'motion/react';
import UnifiedBackButton from './UnifiedBackButton';
import { 
  CreditCard, 
  HelpCircle, 
  ShoppingBag, 
  Check, 
  CheckCircle, 
  X, 
  XCircle, 
  ChevronRight, 
  User, 
  Phone, 
  ShieldCheck, 
  AlertCircle, 
  ArrowLeft, 
  ArrowDown, 
  Truck, 
  AlertTriangle,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Clock,
  MapPin,
  Heart,
  FileText,
  LifeBuoy,
  LogOut,
  Info,
  QrCode,
  MessageCircle,
  Send,
  LayoutDashboard
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { User as UserType, Transaction } from '../types';
import { useBackHandler } from '../lib/navigationManager';

interface RationCardViewProps {
  liveUser: UserType;
  syncLiveProfile: () => Promise<void>;
  appConfig?: any;
  onClose: () => void;
}

interface RationItem {
  id: string;
  name: string;
  qty: string;
  price: number;
  marketPrice: number;
  emoji: string;
  color: string;
}

const RationCardContainer = ({ children }: { children: React.ReactNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateScale = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        // The card is designed to be 680px wide
        const newScale = Math.min(1, width / 680);
        setScale(newScale);
      }
    };
    
    // Initial scale computation
    updateScale();
    
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      try {
        observer = new ResizeObserver(() => {
          updateScale();
        });
        if (containerRef.current) {
          observer.observe(containerRef.current);
        }
      } catch (e) {
        console.warn("ResizeObserver init error:", e);
      }
    }
    
    window.addEventListener('resize', updateScale);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full flex justify-center items-center overflow-hidden py-2 select-none">
      <div 
        style={{ 
          width: `${680 * scale}px`, 
          height: `${382 * scale}px`, 
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'width 0.1s ease-out, height 0.1s ease-out'
        }}
      >
        <div 
          style={{ 
            width: '680px', 
            height: '382px',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};


import RationApplicationForm from './RationApplicationForm';

export default function RationCardView({ liveUser, syncLiveProfile, appConfig, onClose }: RationCardViewProps) {

  // Bengali translation helpers
  const englishToBengali = (num: any) => {
    if (num === undefined || num === null) return '0';
    const numStr = num.toString();
    const map: Record<string, string> = {
      '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
    };
    return numStr.split('').map((c: string) => map[c] || c).join('');
  };

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'card' | 'items' | 'order' | 'my_orders' | 'history' | 'profile' | 'support'>('dashboard');

  // Ration Card internal back handler
  useBackHandler(() => {
    if (showCardImageModal) { setShowCardImageModal(false); return true; }
    if (showCheckoutModal) { setShowCheckoutModal(false); return true; }
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
      return true;
    }
    return false;
  }, true, 25);

  const handleBack = () => {
    if (showCardImageModal) { setShowCardImageModal(false); return; }
    if (showCheckoutModal) { setShowCheckoutModal(false); return; }
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    } else {
      if (onClose) onClose();
    }
  };

  const cardRef = useRef<HTMLDivElement>(null);

  // Reusable 100% accurate visual representation of the Digital Ration Card
  const renderBeautifulRationCard = (rcData: any, scaleClass = "") => {
    const cNo = rcData?.cardNo || liveUser?.memberId || 'AMB00000000';
    
    // Setup color scheme dynamically based on Card Type
    const cardType = rcData?.cardType || 'Standard';
    const isVip = cardType === 'Platinum' || cardType === 'VIP Premium' || cardType === 'VIP' || cardType === 'Platinum Card';
    const isPremium = cardType === 'Premium' || cardType === 'Golden' || cardType === 'Premium Card';

    let mainColorHex = "#015335"; // Regular/Silver or original default
    let borderHex = "#015335";
    let bgGradientClass = "bg-white"; 
    let labelBgHex = "#E9F2ED";
    let textPrimaryClass = "text-slate-800";
    let textSecondaryClass = "text-zinc-500";
    let cardTypeLabelBn = "ডিজিটাল রেশন কার্ড";
    let accentEmoji = "🥈";

    if (isPremium) {
      mainColorHex = "#AA7C11"; // Golden primary
      borderHex = "#D4AF37";     // Gold border
      bgGradientClass = "bg-gradient-to-br from-amber-50 via-yellow-100/40 to-amber-50";
      labelBgHex = "#FEF3C7";
      textPrimaryClass = "text-amber-950 font-black";
      textSecondaryClass = "text-amber-700 font-bold";
      cardTypeLabelBn = "প্রিমিয়াম গোল্ডেন কার্ড";
      accentEmoji = "👑";
    } else if (isVip) {
      mainColorHex = rcData?.vipPrimaryColor || "#6D28D9"; // Purple custom
      borderHex = rcData?.vipBorderColor || "#EC4899";     // Pink/Gold custom
      bgGradientClass = `bg-gradient-to-br ${rcData?.vipCardBg || "from-slate-950 via-purple-950/70 to-slate-900"}`;
      labelBgHex = "#3B0764";
      textPrimaryClass = rcData?.vipTextColor || "text-purple-100 font-black";
      textSecondaryClass = "text-purple-300 font-bold";
      cardTypeLabelBn = "ভিআইপি প্রিমিয়াম কার্ড";
      accentEmoji = "💎";
    } else {
      // Standard / Silver Regular
      mainColorHex = "#4A5568"; // Slate Gray/Silver
      borderHex = "#CBD5E0";     // Light Silver
      bgGradientClass = "bg-gradient-to-br from-slate-50 via-slate-200/50 to-slate-100";
      labelBgHex = "#EDF2F7";
      textPrimaryClass = "text-slate-850 font-black";
      textSecondaryClass = "text-slate-500 font-bold";
      cardTypeLabelBn = "রেগুলার সিলভার কার্ড";
      accentEmoji = "🥈";
    }

    const mainColorClean = mainColorHex.replace('#', '');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=${mainColorClean}&data=${encodeURIComponent(`https://businessnetworkbangladesh.com/verify-ration?id=${cNo}`)}`;
    
    return (
      <RationCardContainer>
        <div 
          ref={cardRef}
          id="amb-ration-card-canvas"
          className={`w-[680px] h-[382px] text-zinc-900 rounded-[1.75rem] shadow-2xl overflow-hidden font-sans flex flex-col justify-between border-[6px] p-0 relative select-none ${bgGradientClass} ${scaleClass}`}
          style={{ borderColor: borderHex }}
        >
        {/* Card Top Banner Header */}
        <div className="flex flex-row justify-between items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white/90 backdrop-blur-xs">
          
          {/* Left Logo Side */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0" style={{ backgroundColor: mainColorHex }}>
              <svg className="w-10 h-10 text-white fill-white" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <path d="M 100 22 C 80 45 84 82 100 102 C 116 82 120 45 100 22 Z" fillRule="evenodd" />
                <path d="M 100 101 L 100 48" stroke="#015335" strokeWidth="3.5" strokeLinecap="round" style={{ stroke: mainColorHex }} />
                <path d="M 91 100 C 62 92 42 70 45 42 C 62 36 82 58 91 100 Z" fillRule="evenodd" />
                <path d="M 90 98 C 80 81 69 68 59 62" stroke="#015335" strokeWidth="3.2" strokeLinecap="round" style={{ stroke: mainColorHex }} />
                <path d="M 109 100 C 138 92 158 70 155 42 C 138 36 118 58 109 100 Z" fillRule="evenodd" />
                <path d="M 110 98 C 120 81 131 68 141 62" stroke="#015335" strokeWidth="3.2" strokeLinecap="round" style={{ stroke: mainColorHex }} />
                <text x="100" y="126" textAnchor="middle" className="font-sans font-black text-[25px]" style={{ fontWeight: 955, fill: mainColorHex }}>AMB</text>
                <path d="M 89 178 L 63 178 C 63 150 48 125 34 100 C 23 80 18 64 25 54 C 29 46 38 48 43 58 C 47 68 55 90 62 112 C 63 118 65 122 67 122 C 70 122 74 108 78 96 C 81 86 85 78 90 78 C 94 78 98 84 98 92 C 98 108 89 135 89 178 Z" strokeWidth="1.2" fillRule="evenodd" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 111 178 L 137 178 C 137 150 152 125 166 100 C 177 80 182 64 175 54 C 171 46 162 48 157 58 C 153 68 145 90 138 112 C 137 118 135 122 133 122 C 130 122 126 108 122 96 C 119 86 115 78 110 78 C 106 78 102 84 102 92 C 102 108 111 135 111 178 Z" strokeWidth="1.2" fillRule="evenodd" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-left font-sans">
              <h2 className="text-[30px] font-black leading-none tracking-tight" style={{ color: mainColorHex }}>AMB</h2>
              <p className="text-[10px] text-zinc-650 font-extrabold tracking-widest leading-none mt-1 uppercase font-sans">Al Mayadin Bazar</p>
            </div>
          </div>
          
          {/* Right Ration Card Title */}
          <div className="text-right font-sans">
            <div className="flex items-center justify-end gap-1 text-xl font-black tracking-tight leading-none" style={{ color: mainColorHex }}>
              <span>AMB RATION CARD</span>
              <span className="text-lg">{accentEmoji}</span>
            </div>
            <p className="text-[10px] text-zinc-500 font-extrabold mt-1">সবার জন্য পুষ্টিকর খাদ্য, সুস্থ ও সমৃদ্ধ আগামী</p>
            <div className="h-[2px] mt-1.5 w-32 ml-auto rounded-full" style={{ backgroundColor: mainColorHex }} />
          </div>

        </div>

        {/* Central Block of Content layout */}
        <div className="grid grid-cols-12 gap-4 p-5 items-center flex-1 bg-transparent">
          
          {/* Cardholder Portrait Frame */}
          <div className="col-span-3 flex items-center justify-center">
            <div className="w-[110px] h-[138px] border-2 rounded-[1.25rem] overflow-hidden flex flex-col items-center justify-center relative shadow-inner p-1 shrink-0 bg-white/50" style={{ borderColor: `${mainColorHex}35` }}>
              {rcData?.photoUrl || rcData?.photo || (liveUser?.profilePic && (liveUser.profilePic.startsWith('http') || liveUser.profilePic.startsWith('data:image/'))) ? (
                <img
                  src={rcData?.photoUrl || rcData?.photo || liveUser?.profilePic}
                  alt="Cardholder Photo"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-[1rem]"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 pt-3 overflow-hidden">
                  <div className="w-12 h-12 rounded-full mb-1" style={{ backgroundColor: mainColorHex }} />
                  <div className="w-20 h-[56px] rounded-t-full" style={{ backgroundColor: mainColorHex }} />
                </div>
              )}
              <div className="absolute bottom-1 border px-2 py-0.5 rounded-full text-[8px] font-black text-white leading-none tracking-wider" style={{ backgroundColor: mainColorHex, borderColor: `${mainColorHex}50` }}>
                সদস্য ফটো
              </div>
            </div>
          </div>

          {/* Profile Info Columns */}
          <div className="col-span-5 space-y-3 text-left font-sans">
            
            {/* Name */}
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm p-0.5" style={{ backgroundColor: mainColorHex }}>
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-zinc-400 font-extrabold leading-none">নাম</p>
                <p className={`text-[13px] tracking-tight leading-tight mt-1 uppercase truncate font-sans ${textPrimaryClass}`}>
                  {rcData?.userName || rcData?.name || liveUser?.name}
                </p>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm p-0.5" style={{ backgroundColor: mainColorHex }}>
                <Phone className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-zinc-400 font-extrabold leading-none">মোবাইল নাম্বার</p>
                <p className="text-[13px] font-mono font-black leading-tight mt-1" style={{ color: mainColorHex }}>
                  {rcData?.phone || liveUser?.phone || '01812115535'}
                </p>
              </div>
            </div>

            {/* Multi-tier address */}
            <div className="flex items-start gap-2.5 font-sans">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm p-0.5" style={{ backgroundColor: mainColorHex }}>
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-zinc-400 font-extrabold leading-none uppercase">ঠিকানার বিবরণ</p>
                <div className={`text-[10.5px] leading-snug mt-1 truncate max-w-[190px] ${textPrimaryClass}`}>
                  {rcData?.address || `Village: ${rcData?.village || 'যশোর'}, Upazila: ${rcData?.upazila || 'যশোর সদর'}, District: ${rcData?.district || 'যশোর'}`}
                </div>
              </div>
            </div>

          </div>

          {/* Validation QR check block */}
          <div className="col-span-4 flex flex-col items-center justify-center border-l border-slate-150 pl-4 w-full">
            <div className="bg-white p-1.5 border-2 rounded-[1.5rem] shadow-sm relative overflow-hidden flex flex-col items-center shrink-0 w-28" style={{ borderColor: mainColorHex }}>
              <div className="relative flex items-center justify-center">
                <img 
                  src={qrUrl} 
                  alt="Ration Verification QR" 
                  className="w-20 h-20"
                  referrerPolicy="no-referrer"
                />
                {/* Centered logo inside QR code */}
                <div className="absolute w-[22px] h-[22px] bg-white rounded-md p-0.5 shadow-sm border border-slate-100 flex items-center justify-center z-10">
                  <svg className="w-full h-full fill-current" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ color: mainColorHex }}>
                    <path d="M 100 22 C 80 45 84 82 100 102 C 116 82 120 45 100 22 Z" />
                    <path d="M 91 100 C 62 92 42 70 45 42 C 62 36 82 58 91 100 Z" />
                    <path d="M 109 100 C 138 92 158 70 155 42 C 138 36 118 58 109 100 Z" />
                  </svg>
                </div>
              </div>
              <div className="text-white w-full text-[8.5px] font-black py-0.5 px-1.5 rounded-md mt-1.5 flex items-center justify-center gap-0.5 font-sans" style={{ backgroundColor: mainColorHex }}>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-350" />
                <span>সদস্য যাচাইকরণ</span>
              </div>
              <p className="text-[7px] text-zinc-500 font-black tracking-tight mt-1 text-center leading-none">QR স্ক্যান করে যাচাই করুন</p>
            </div>
          </div>

        </div>

        {/* Parameters bottom segments with vertical dividers */}
        <div className="grid grid-cols-4 gap-1 border-t border-slate-200 px-5 py-3 items-center bg-slate-50/90 text-left font-sans">
          
          <div className="border-r border-slate-200 pr-2 min-w-0 flex items-start gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${mainColorHex}15` }}>
              <FileText className="w-4 h-4" style={{ color: mainColorHex }} />
            </div>
            <div className="min-w-0">
              <span className="text-[8px] text-zinc-500 block font-black uppercase leading-none">কার্ড নম্বর</span>
              <span className="text-[10.5px] font-mono font-black uppercase block tracking-tighter truncate mt-1 animate-pulse" style={{ color: mainColorHex }}>
                {cNo}
              </span>
            </div>
          </div>

          <div className="border-r border-slate-200 px-2 min-w-0 flex items-start gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${mainColorHex}15` }}>
              <Calendar className="w-4 h-4" style={{ color: mainColorHex }} />
            </div>
            <div className="min-w-0">
              <span className="text-[8px] text-zinc-500 block font-black uppercase leading-none">ইস্যুর তারিখ</span>
              <span className="text-[10.5px] font-mono font-black text-slate-800 block truncate mt-1">
                {rcData?.issueDate || '07/06/2026'}
              </span>
            </div>
          </div>

          <div className="border-r border-slate-200 px-2 min-w-0 flex items-start gap-2 font-sans">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${mainColorHex}15` }}>
              <ShieldCheck className="w-4 h-4" style={{ color: mainColorHex }} />
            </div>
            <div className="min-w-0">
              <span className="text-[8px] text-zinc-500 block font-black uppercase leading-none">মেয়াদ শেষ</span>
              <span className="text-[10.5px] font-mono font-black block truncate mt-1" style={{ color: mainColorHex }}>
                {rcData?.expiryDate || '06/06/2027'}
              </span>
              <span className="text-[6px] block font-extrabold mt-0.5 leading-none" style={{ color: mainColorHex }}>1 বছর পর রিনিউ</span>
            </div>
          </div>

          <div className="pl-2 flex flex-col items-center justify-center min-w-0">
            <span 
              className="text-[14px] font-bold tracking-widest italic select-none block leading-none h-4.5 truncate" 
              style={{ fontFamily: "'Dancing Script', cursive, sans-serif", color: mainColorHex }}
            >
              {rcData?.signature || 'S.Hasan'}
            </span>
            <div className="w-full border-t border-slate-300 text-center pt-1 mt-1">
              <span className="text-[7.5px] font-black text-slate-400 block leading-none truncate uppercase font-sans">কর্তৃপক্ষের স্বাক্ষর</span>
            </div>
          </div>

        </div>

        {/* Solid footer bar */}
        <div className="text-white px-5 py-2.5 flex items-center justify-between text-left gap-3 font-sans" style={{ backgroundColor: mainColorHex }}>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="bg-white p-0.5 rounded-md shrink-0">
              <QrCode className="w-4.5 h-4.5" style={{ color: mainColorHex }} />
            </div>
            <p className="text-[8.5px] text-[#E9F2ED] leading-snug font-black max-w-2xl truncate sm:whitespace-normal font-sans">
              AMB এর এই {cardTypeLabelBn}ধারী ন্যায্যমূল্যে নিত্যপ্রয়োজনীয় পণ্য গ্রহণের যোগ্যতা রাখেন। এই কার্ড অন্যকে হস্তান্তরযোগ্য নয়।
            </p>
          </div>
          
          <div className="shrink-0 flex items-center gap-1 bg-white/10 border border-white/15 rounded-full px-2.5 py-0.5 shadow-inner">
            <svg className="w-3 h-3 text-emerald-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
            <span className="text-[8.5px] text-white font-black leading-none truncate font-sans">নিরাপদ লেনদেন, বিশ্বস্ত সেবা</span>
          </div>
        </div>

      </div>
      </RationCardContainer>
    );
  };

  // Capture current container view to down-convert as PNG download trigger
  const handleDownloadCard = async () => {
    if (!cardRef.current) return;
    try {
      let canvas;
      try {
        canvas = await html2canvas(cardRef.current, {
          scale: 3, // High level DPI configuration
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff'
        });
      } catch (corsErr) {
        console.warn("CORS check failed, attempting with allowTaint: true", corsErr);
        canvas = await html2canvas(cardRef.current, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });
      }
      
      const dataUrl = canvas.toDataURL('image/png');
      setGeneratedCardUrl(dataUrl);
      setShowCardImageModal(true);

      // Convert to Blob for 100% reliable mobile downloading
      try {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = `AMB-Ration-Card-${rationCard?.cardNo || liveUser?.memberId}.png`;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } catch (clickError) {
        console.warn('Programmatic download blocked by sandbox, showing save-image modal fallback', clickError);
      }
    } catch (err) {
      console.error(err);
      alert('কার্ডটির ইমেজ সরাসরি তৈরি করা যায়নি। তবে নিচে আপনার কার্ডের ইমেজ তৈরি হয়েছে, আপনি ছবিটি দীর্ঘক্ষণ চেপে ধরে রেখে সংরক্ষণ করতে পারেন।');
    }
  };

  // Check if current user is admin/sub-admin
  const isAdmin = liveUser?.role === 'admin' || liveUser?.role === 'sub_admin';

  // Handle Base64 VIP card template image upload from gallery by Admin
  const handleUploadVipCardImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      alert("ফাইলের সাইজ অনেক বড় (সর্বোচ্চ 800 KB অনুমোদিত)");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const configRef = doc(db, 'system_settings', 'app_config');
        await updateDoc(configRef, {
          vipCardDesignUrl: base64String
        });
        alert("ভিআইপি গোল্ডেন কার্ডের ডিজাইন ইমেজ সফলভাবে আপলোড হয়েছে!");
      } catch (error) {
        console.error("Error updating config:", error);
        alert("ডিজাইন আপলোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      }
    };
    reader.readAsDataURL(file);
  };

  // Share verification link
  const handleShareCard = () => {
    const shareUrl = `${window.location.origin}?verify=${rationCard?.cardNo || liveUser?.memberId}`;
    if (navigator.share) {
      navigator.share({
        title: 'AMB Ration Card Verification',
        text: `বিএনবি কো-অপারেটিভ রেশন আইডিঃ ${rationCard?.cardNo || liveUser?.memberId} এর ডিজিটাল রেশন ভেরিফিকেশন ভিউ।`,
        url: shareUrl
      }).catch(err => console.error(err));
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('ডিজিটাল রেশন ভেরিফিকেশন কো-অপারেটিভ লিংক সফলভাবে মেমোরিতে কপি করা হয়েছে!');
    }
  };

  // Handle high speed 1-click automatic auto-generation utilizing standard live user profiles data
  const handleAutoGenerateCard = async () => {
    const activationFee = 150;
    if ((liveUser.balance || 0) < activationFee) {
      alert(`রেশন কার্ডের ওয়ান-টাইম সক্রিয়করণ ফি ৳${activationFee} BDT। আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই!`);
      return;
    }

    setSubmittingReg(true);
    try {
      const timestamp = new Date().toISOString();
      const cardNo = liveUser.memberId || `AMB${String(Math.floor(10000000 + Math.random() * 90000000))}`;
      
      await addDoc(collection(db, 'ration_cards'), {
        userId: liveUser.uid,
        userName: liveUser.name,
        phone: liveUser.phone || '01812115535',
        address: (liveUser as any).address || 'Village: Jashore, Upazila: Jashore Sadar, District: Jashore',
        village: 'Jashore',
        upazila: 'Jashore Sadar',
        district: 'Jashore',
        nominee: 'প্রযোজ্য নয়',
        cardType: 'Silver Regular',
        cardNo: cardNo,
        issueDate: '07/06/2026',
        expiryDate: '06/06/2027',
        signature: 'S.Hasan',
        securityCode: liveUser.pin || '1234',
        createdAt: timestamp,
        status: 'active'
      });

      const userRef = doc(db, 'users', liveUser.uid);
      await updateDoc(userRef, {
        balance: liveUser.balance - activationFee,
        mainBalance: liveUser.balance - activationFee
      });

      await addDoc(collection(db, 'transactions'), {
        id: `tx-rc-activation-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'fee_payment',
        typeLabel: 'রেশন কার্ড ফি',
        amount: activationFee,
        status: 'success',
        description: `ডিজিটাল রেশন কার্ড (${cardNo}) স্বয়ংক্রিয় সক্রিয়করণ ফি চার্জ করা হয়েছে।`,
        createdAt: timestamp,
        paymentMethod: 'Main Balance'
      });
      addDoc(collection(db, 'admin_notifications'), {
        title: '🌾 নতুন ভর্তুকি রেশন কার্ড আবেদন ও সক্রিয়করণ',
        message: `${liveUser.name || 'সদস্য'} (${liveUser.memberId || 'N/A'}) ভর্তুকি রেশন কার্ডের আবেদন করেছেন (কার্ড টাইপ: ${cardNo || 'রেশন কার্ড'})।`,
        userId: liveUser.uid,
        userName: liveUser.name || '',
        memberId: liveUser.memberId || '',
        userPhone: liveUser.phone || '',
        amount: activationFee,
        type: 'ration_activation',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));

      alert("অভিনন্দন! আপনার ডিজিটাল রেশন কার্ডটি প্রোফাইল ডাটা হতে সফলভাবে স্বয়ংক্রিয়ভাবে জেনারেট ও সক্রিয় করা হয়েছে।");
      await syncLiveProfile();
    } catch (err: any) {
      alert("ত্রুটি দেখা দিয়েছে: " + err.message);
    } finally {
      setSubmittingReg(false);
    }
  };

  const defaultRationSlides = [
    {
      id: 1,
      tag: "কো-অপারেটিভ রেশন",
      title: "বিএনবি ডিজিটাল রেশন সেবা",
      description: "ডিজিটাল কো-অপারেটিভ রেশন কার্ডধারীদের জন্য বিশেষভাবে ভর্তুকি মূল্যে সর্বোচ্চ মানের ফ্রেশ ক্যাটাগরির চাল, ডাল, তেলসহ নানা নিত্যপ্রয়োজনীয় খাদ্যের নির্ভরযোগ্য পোর্টাল।",
      bgGradient: "from-emerald-950 via-emerald-900 to-teal-950",
      image: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=1200"
    },
    {
      id: 2,
      tag: "সহজ বুকিং",
      title: `${englishToBengali(appConfig?.rationMaxSelectLimit || 5)}টি পণ্য নির্বাচন`,
      description: `${appConfig?.rationTotalItemsText || "10"}টি নিত্যপ্রয়োজনীয় পণ্যের তালিকা থেকে প্রতি মাসে সর্বোচ্চ ${englishToBengali(appConfig?.rationMaxSelectLimit || 5)}টি পণ্য ভর্তুকি মূল্যে বুকিং করার দারুণ সুবিধা পান।`,
      bgGradient: "from-slate-950 via-emerald-950 to-emerald-900",
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200"
    }
  ];

  const adSlides = appConfig?.rationBanners && appConfig.rationBanners.length > 0
    ? appConfig.rationBanners
    : defaultRationSlides;

  const [currentAdSlide, setCurrentAdSlide] = useState(0);

  useEffect(() => {
    if (adSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentAdSlide((prev) => (prev + 1) % adSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [adSlides.length]);
  
  // Ration Card Firestore state
  const [rationCard, setRationCard] = useState<any | null>(null);
  const [loadingCard, setLoadingCard] = useState(true);
  const [dbRationItems, setDbRationItems] = useState<RationItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [generatedCardUrl, setGeneratedCardUrl] = useState<string | null>(null);
  const [showCardImageModal, setShowCardImageModal] = useState(false);

  // Registration Form States
  const [regName, setRegName] = useState(liveUser?.name || '');
  const [regAddress, setRegAddress] = useState('');
  const [regNominee, setRegNominee] = useState('');
  const [regType, setRegType] = useState('Silver Regular');
  const [submittingReg, setSubmittingReg] = useState(false);

  // Order Placement Modal / Drawer states
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [securityPin, setSecurityPin] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  // Live Chat States inside Support view
  const [chatMessages, setChatMessages] = useState<any[]>([
    { id: '1', sender: 'support', text: 'আসসালামু আলাইকুম! আমাদের ডিজিটাল রেশন কার্ড হেল্প ডেস্কে আপনাকে স্বাগতম। আপনার কার্ড সংশোধন, অর্ডার ট্র্যাকিং বা যেকোনো সাহায্য পেতে মেসেজ করুন।', timestamp: '10:30 AM' }
  ]);
  const [chatInputText, setChatInputText] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;

    const userText = chatInputText;
    setChatInputText('');

    const now = new Date();
    const timeStr = now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });

    // Append user message
    const userMsg = { id: Math.random().toString(), sender: 'user', text: userText, timestamp: timeStr };
    setChatMessages(prev => [...prev, userMsg]);

    // Save to firestore for admins to reply
    try {
      await addDoc(collection(db, 'support_chats'), {
        userId: liveUser.uid,
        userName: liveUser.name || 'সদস্য',
        message: userText,
        sender: 'user',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
    }

    setIsChatTyping(true);

    setTimeout(() => {
      setIsChatTyping(false);
      let replyText = '';
      const textLower = userText.toLowerCase();

      if (textLower.includes('সংশোধন') || textLower.includes('নাম ভুল') || textLower.includes('ঠিকানা')) {
        replyText = 'আপনার রেশন কার্ডের ভুল তথ্য সংশোধন করার জন্য অনুগ্রহ করে হেল্পলাইন নম্বর অথবা নিকটস্থ কার্যালয়ে মূল প্রমানপত্রসহ যোগাযোগ করুন। সিস্টেম থেকে কেবল নির্দিষ্ট কর্মকর্তা আপনার আবেদন অনুমোদন করতে পারেন।';
      } else if (textLower.includes('ডেলিভারি') || textLower.includes('অর্ডার') || textLower.includes('সংগ্রহ')) {
        replyText = 'আপনার রেশন বুকিংটি সফল হওয়ার পর লেনদেন ইতিহাসে যান এবং নির্ধারিত বিতরণ কেন্দ্রে গিয়ে আপনার স্লিপ এবং রেশন কার্ডটি প্রদর্শন করে পণ্য সংগ্রহ করুন।';
      } else if (textLower.includes('টাকা') || textLower.includes('পেমেন্ট') || textLower.includes('বুকিং')) {
        replyText = 'আপনার ওয়ালেটে পর্যাপ্ত বেলেন্স থাকা সাপেক্ষে সাশ্রয়ী পণ্যের অফার সেকশন থেকে যেকোনো পণ্যের জন্য সহজে অর্ডার নিশ্চিত করতে পারেন।';
      } else {
        replyText = 'আসসালামু আলাইকুম! আপনার বার্তাটি আমরা পেয়েছি। আমাদের লাইভ ট্র্যাকিং অফিসার আপনার মেসেজটি রিভিউ করছেন। যেকোনো জরুরি প্রয়োজনে আমাদের অফিশিয়াল কাস্টমার কন্টাক্টে সরাসরি কল করতে পারেন।';
      }

      const replyMsg = { 
        id: Math.random().toString(), 
        sender: 'support', 
        text: replyText, 
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) 
      };
      setChatMessages(prev => [...prev, replyMsg]);
    }, 1500);
  };

  // 10 Items from mockup precisely
  const rationItems: RationItem[] = [
    { id: 'item_rice', name: 'চাল (মিনিক্যাট)', qty: '5 KG', price: 240, marketPrice: 300, emoji: '🍚', color: 'from-amber-50 to-orange-50' },
    { id: 'item_flour', name: 'আটা (ময়দা)', qty: '2 KG', price: 60, marketPrice: 80, emoji: '🌾', color: 'from-yellow-50 to-amber-50' },
    { id: 'item_lentil', name: 'মসুর ডাল', qty: '1 KG', price: 100, marketPrice: 130, emoji: '🍛', color: 'from-red-50 to-orange-50' },
    { id: 'item_oil', name: 'সয়াবিন তেল', qty: '1 লিটার', price: 140, marketPrice: 170, emoji: '🍾', color: 'from-yellow-50 to-teal-50' },
    { id: 'item_sugar', name: 'চিনি', qty: '1 KG', price: 60, marketPrice: 80, emoji: '🍬', color: 'from-cyan-50 to-blue-50' },
    { id: 'item_salt', name: 'লবণ', qty: '1 KG', price: 15, marketPrice: 20, emoji: '🧂', color: 'from-slate-50 to-zinc-50' },
    { id: 'item_milk', name: 'দুধ গুঁড়া', qty: '500 GM', price: 180, marketPrice: 220, emoji: '🥛', color: 'from-indigo-50 to-purple-50' },
    { id: 'item_chickpea', name: 'ছোলা', qty: '1 KG', price: 80, marketPrice: 100, emoji: '🥜', color: 'from-amber-100/40 to-yellow-50' },
    { id: 'item_semai', name: 'সেমাই', qty: '1 KG', price: 70, marketPrice: 90, emoji: '🍜', color: 'from-amber-50 to-yellow-100/30' },
    { id: 'item_tea', name: 'চা পাতা', qty: '250 GM', price: 90, marketPrice: 120, emoji: '🍃', color: 'from-emerald-50 to-green-50' }
  ];

  // Fetch / Sync Ration card & past orders
  useEffect(() => {
    // 1. Sync card
    const unsubCard = onSnapshot(
      query(collection(db, 'ration_cards'), where('userId', '==', liveUser.uid)),
      (snap) => {
        if (!snap.empty) {
          setRationCard({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          setRationCard(null);
        }
        setLoadingCard(false);
      },
      (err) => {
        console.error("Ration card sync failed", err);
        setLoadingCard(false);
      }
    );

    // 2. Sync orders
    const unsubOrders = onSnapshot(
      query(collection(db, 'ration_orders'), where('userId', '==', liveUser.uid)),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setOrders(list);
        setLoadingOrders(false);
      },
      (err) => {
        console.error("Ration orders sync failed", err);
        setLoadingOrders(false);
      }
    );

    // 3. Sync dynamic ration items catalog from firestore
    const unsubRationItems = onSnapshot(
      collection(db, 'ration_items'),
      (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          })) as RationItem[];
          // Sort items by sortOrder or id
          items.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
          setDbRationItems(items);
        } else {
          // Fallback to static items if empty
          setDbRationItems(rationItems);
        }
      },
      (err) => {
        console.error("Ration items dynamic sync failed", err);
        setDbRationItems(rationItems);
      }
    );

    return () => {
      unsubCard();
      unsubOrders();
      unsubRationItems();
    };
  }, [liveUser]);

  // Handle registration activation
  const handleRegisterCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regAddress.trim()) {
      alert("অনুগ্রহ করে কার্ডধারীর পুরো নাম এবং সঠিক ঠিকানা পূরণ করুন।");
      return;
    }

    const activationFee = 150;
    if ((liveUser.balance || 0) < activationFee) {
      alert(`রেশন কার্ডের ওয়ান-টাইম সক্রিয়করণ ফি ৳${activationFee} BDT। আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই!`);
      return;
    }

    setSubmittingReg(true);
    try {
      const timestamp = new Date().toISOString();
      const cardNo = `AMB-RC-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(100000 + Math.random() * 900000)}`;
      
      // 1. Save to Firebase
      await addDoc(collection(db, 'ration_cards'), {
        userId: liveUser.uid,
        userName: regName,
        phone: liveUser.phone || '01812115535',
        address: regAddress,
        village: 'Jashore',
        upazila: 'Jashore Sadar',
        district: 'Jashore',
        nominee: regNominee || 'প্রযোজ্য নয়',
        cardType: regType,
        cardNo: cardNo,
        issueDate: '07/06/2026',
        expiryDate: '06/06/2027',
        signature: 'S.Hasan',
        securityCode: liveUser.pin || '1234',
        createdAt: timestamp,
        status: 'active'
      });

      // 2. Deduct penalty from user
      const userRef = doc(db, 'users', liveUser.uid);
      await updateDoc(userRef, {
        balance: liveUser.balance - activationFee,
        mainBalance: liveUser.balance - activationFee
      });

      // 3. Record log
      await addDoc(collection(db, 'transactions'), {
        id: `tx-rc-activation-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'fee_payment',
        typeLabel: 'রেশন কার্ড ফি',
        amount: activationFee,
        status: 'success',
        description: `ডিজিটাল রেশন কার্ড (${cardNo}) সচলরণ ফি চার্জ করা হয়েছে।`,
        createdAt: timestamp,
        paymentMethod: 'Main Balance'
      });

      alert("অভিনন্দন! আপনার ডিজিটাল রেশন কার্ডটি সফলভাবে সক্রিয় করা হয়েছে।");
      await syncLiveProfile();
    } catch (err: any) {
      alert("ত্রুটি দেখা দিয়েছে: " + err.message);
    } finally {
      setSubmittingReg(false);
    }
  };

  // Checkbox select toggle
  const toggleItemSelection = (id: string) => {
    const maxLimit = appConfig?.rationMaxSelectLimit || 5;
    if (selectedItemIds.includes(id)) {
      setSelectedItemIds(selectedItemIds.filter(item => item !== id));
    } else {
      if (selectedItemIds.length >= maxLimit) {
        alert(`আপনি সর্বোচ্চ ${englishToBengali(maxLimit)}টি আইটেম সিলেক্ট করতে পারবেন!`);
        return;
      }
      setSelectedItemIds([...selectedItemIds, id]);
    }
  };

  // Selected details
  const selectedItems = (dbRationItems.length > 0 ? dbRationItems : rationItems).filter(p => selectedItemIds.includes(p.id));
  const totalPrice = selectedItems.reduce((acc, curr) => acc + curr.price, 0);
  const totalMarketPrice = selectedItems.reduce((acc, curr) => acc + curr.marketPrice, 0);
  const savings = totalMarketPrice - totalPrice;

  // Action Order Execution
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      setCheckoutError("অনুগ্রহ করে কমপক্ষে 1টি আইটেম নির্বাচন করুন।");
      return;
    }
    if (selectedItems.length > 5) {
      setCheckoutError("আপনি সর্বোচ্চ 5টি আইটেম সিলেক্ট করতে পারবেন।");
      return;
    }
    if (securityPin !== liveUser.pin) {
      setCheckoutError("আপনার 4 ডিজিটের নিরাপত্তা পিন নম্বরটি সঠিক নয়!");
      return;
    }
    if (liveUser.balance < totalPrice) {
      setCheckoutError(`আপনার পর্যাপ্ত ব্যালেন্স নেই! প্রয়োজন ৳${totalPrice} আপনার ব্যালেন্স মাত্র ৳${liveUser.balance}।`);
      return;
    }

    setPlacingOrder(true);
    setCheckoutError('');
    try {
      const timestamp = new Date().toISOString();
      const orderNo = `RATION-ORD-${Math.floor(100000 + Math.random() * 900000)}`;

      // 1. Create order inside Firestore
      await addDoc(collection(db, 'ration_orders'), {
        userId: liveUser.uid,
        userName: rationCard?.userName || liveUser.name,
        userPhone: liveUser.phone,
        cardNo: rationCard?.cardNo || 'N/A',
        orderNo: orderNo,
        items: selectedItems.map((p, idx) => ({
          id: p.id,
          name: p.name,
          qty: p.qty,
          price: p.price
        })),
        totalPrice: totalPrice,
        status: 'Pending', // Pending Center collection
        createdAt: timestamp,
        issueCenter: 'হেমায়েতপুর মেইন কো-অপারেটিভ বিতরণ কেন্দ্র'
      });

      // 2. Deduct user balance
      const userRef = doc(db, 'users', liveUser.uid);
      await updateDoc(userRef, {
        balance: liveUser.balance - totalPrice,
        mainBalance: liveUser.balance - totalPrice
      });

      // 3. Log main transaction
      await addDoc(collection(db, 'transactions'), {
        id: `tx-ration-buy-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'fee_payment',
        typeLabel: 'রেশন পণ্য সাবসিডি ক্রয়',
        amount: totalPrice,
        status: 'success',
        description: `রেশন কার্ড মেম্বার রিফিল সুবিধাঃ অর্ডার নং ${orderNo}। সাবসিডি মূল্যে পণ্য সরবরাহ নিশ্চিত করা হয়েছে।`,
        createdAt: timestamp,
        paymentMethod: 'Main Balance'
      });
      addDoc(collection(db, 'admin_notifications'), {
        title: '🛒 নতুন রেশন পণ্য ভর্তুকি অর্ডার',
        message: `${liveUser.name || 'সদস্য'} (${liveUser.memberId || 'N/A'}) ৳${totalPrice} টাকার ভর্তুকি রেশন সামগ্রী অর্ডার করেছেন।`,
        userId: liveUser.uid,
        userName: liveUser.name || '',
        memberId: liveUser.memberId || '',
        userPhone: liveUser.phone || '',
        amount: totalPrice,
        type: 'ration_order',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));

      // 4. Log system notices
      await addDoc(collection(db, 'notices'), {
        title: `রেশন প্রোডাক্ট ডিলার বুকিং সম্পন্ন!`,
        content: `আপনার রেশন কার্ডের বিপরীতে ৳${totalPrice} মূল্যের পণ্য বুকিং সফল হয়েছে। অর্ডার নম্বরঃ ${orderNo}। 2 কার্যদিবসের মধ্যে নিকটস্থ কেন্টাল বা হেমায়েতপুর মেইন বিতরণ কেন্দ্র হতে পণ্য বুঝে নিন।`,
        createdAt: timestamp
      });

      alert(`সাফল্যঃ আপনার রেশন অর্ডার ${orderNo} সফলভাবে সম্পন্ন হয়েছে। ৳${totalPrice} আপনার মেইন অ্যাকাউন্ট থেকে কেটে নেওয়া হয়েছে।`);
      setSelectedItemIds([]);
      setSecurityPin('');
      setShowCheckoutModal(false);
      setActiveTab('my_orders');
      await syncLiveProfile();
    } catch (err: any) {
      setCheckoutError("অর্ডার প্লেস করা যায়নি: " + err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  // Custom UI elements
  if (loadingCard) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center text-slate-800">
        <div className="animate-pulse font-black text-xl text-[#015335]">লোড হচ্ছে...</div>
      </div>
    );
  }

  // Not signed up yet form or rejected
  if (!rationCard || rationCard.status === 'rejected') {
    return <RationApplicationForm liveUser={liveUser} onClose={onClose} />;
  }

  // Pending verification check
  if (rationCard.status === 'pending') {
    return (
      <div className="bg-slate-50 min-h-screen text-slate-800 font-sans flex flex-col items-center justify-center p-6 relative select-none">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 p-2 bg-white rounded-full shadow-sm border border-slate-200 cursor-pointer hover:bg-slate-50"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-xl text-center space-y-6">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mx-auto animate-bounce border-2 border-amber-100">
            <Clock className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <span className="px-3.5 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full border border-amber-200 uppercase tracking-wider">
              আবেদন অপেক্ষমান (Pending Verification)
            </span>
            <h2 className="text-xl font-black text-slate-900 pt-2">আপনার রেশন কার্ডের আবেদনটি যাচাই করা হচ্ছে</h2>
            <p className="text-xs text-slate-600 font-bold leading-relaxed pt-1">
              আসসালামু আলাইকুম! আপনার রেশন কার্ডের আবেদনটি আমাদের কাছে সফলভাবে পৌঁছেছে। AMB এডমিন প্যানেল আপনার তথ্যগুলো গভীরভাবে ভেরিফাই করছে।
            </p>
            <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-100/60 p-3.5 rounded-2xl font-bold leading-relaxed">
              এডমিন আপনার আবেদনটি রিভিউ করার সময় আপনার জন্য একটি ডিজিটাল কার্ড নম্বর, ইস্যু/মেয়াদ উত্তীর্ণের তারিখ এবং অনুমোদনকারী স্বাক্ষর সেট করে এপ্রুভ করবেন। এপ্রুভ হওয়া মাত্রই আপনি এই পেজে আপনার ডিজিটাল কার্ড এবং ভর্তুকি মূল্যে রেশন পণ্য অর্ডার করার সুবিধা পাবেন।
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-[#015335] text-white rounded-2xl font-black text-xs cursor-pointer shadow-md shadow-emerald-900/10 hover:bg-emerald-900 transition"
            >
              ড্যাশবোর্ডে ফিরে যান
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen">
      
      {/* HEADER BAR - SLIM, THIN, MINIMALIST */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between sticky top-0 z-30 font-sans shadow-3xs">
        <div className="flex items-center gap-2">
          {onClose && (
            <UnifiedBackButton
              onClick={handleBack}
              variant="dark"
              title="পিছনে যান"
            />
          )}
          <div className="w-8 h-8 bg-emerald-950 rounded-lg flex items-center justify-center font-black text-rose-50 border border-teal-800">
            <span className="text-white text-xs tracking-tighter">AMB</span>
          </div>
          <div className="text-left font-sans">
            <h1 className="text-xs sm:text-[13.5px] font-black text-emerald-950 tracking-tight leading-none">AMB রেশন কার্ড পোর্টাল</h1>
          </div>
        </div>

        {/* Mini profile stats top-right */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          
          {/* 1/ Dashboard Balance */}
          <div className="bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 shadow-3xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-650 animate-pulse shrink-0"></span>
            <div className="text-left leading-none">
              <p className="text-[7.5px] sm:text-[8.5px] text-emerald-800 font-extrabold tracking-tight">ড্যাশবোর্ড ব্যালেন্স</p>
              <p className="text-[9.5px] sm:text-xs font-black text-emerald-950 font-sans mt-0.5">৳{englishToBengali(liveUser.balance || 0)}</p>
            </div>
          </div>

          {/* 2/ Corner Transaction History Trigger */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`p-1 px-2 rounded-lg text-[9px] sm:text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 border shadow-3xs ${
              activeTab === 'history'
                ? 'bg-amber-100 border-amber-400 text-amber-950'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
            }`}
            title="লেনদেন ইতিহাস"
          >
            <span>📜 লেনদেন হিস্টরি</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        
        {/* RIGHT MAIN VIEWS PANEL */}
        <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
          
          {/* Urgent Notice Scroll Ticker */}
          <div className="bg-white border border-emerald-800/25 rounded-full px-2.5 py-1.5 flex items-center gap-3 w-full mx-auto font-sans shadow-3xs">
            <div className="bg-[#006A4E] text-white text-[10px] font-black px-3 py-0.5 rounded-full shrink-0 flex items-center gap-1">
              <span>ঘোষণা</span>
            </div>
            <div className="flex-grow overflow-hidden relative mr-1.5 flex items-center">
              <marquee className="text-[11.5px] font-bold text-slate-800 leading-none py-0.5" behavior="scroll" direction="left" scrollamount="4">
                {appConfig?.rationTicker || "কো-অপারেティブ ডিজিটাল রেশন কার্ড সেবাঃ ভর্তুকি মূল্যে নিত্যপ্রয়োজনীয় চাল, ডাল, তেল ও অন্যান্য পণ্যসামগ্রী ক্রয়ের সুবিধা উপভোগ করুন।"}
              </marquee>
            </div>
          </div>

          {/* 4 Compact Service Navigation Boxes - Style matches metrics perfectly */}
          <div className="grid grid-cols-4 gap-1 sm:gap-4">
            {[
              { id: 'dashboard', label: 'সদস্য ড্যাশবোর্ড', desc: 'রেশন ড্যাশবোর্ড', icon: LayoutDashboard, color: 'emerald', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
              { id: 'card', label: 'ডিজিটাল রেশন কার্ড', desc: 'স্মার্ট ভার্চুয়াল কার্ড', icon: CreditCard, color: 'blue', bg: 'bg-blue-50 text-blue-600 border-blue-100' },
              { id: 'my_orders', label: 'আমার বুকিং ট্র্যাকার', desc: 'অর্ডার ট্র্যাকিং', icon: Truck, color: 'indigo', bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
              { id: 'profile', label: 'কার্ডধারী প্রোফাইল', desc: 'মেম্বারশিপ ভেরিফাইড তথ্য', icon: User, color: 'sky', bg: 'bg-sky-50 text-sky-600 border-sky-100' }
            ].map((item, idx) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  onClick={() => setActiveTab(item.id as any)}
                  className={`p-1 px-1.5 py-2 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer shadow-3xs flex flex-col items-center justify-between min-h-[58px] sm:min-h-0 ${
                    isSelected 
                      ? 'bg-white border-[#006A4E] ring-2 ring-[#006A4E]/30 scale-[1.01]' 
                      : 'bg-white border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-center sm:text-left w-full justify-center">
                    <div className={`w-5.5 h-5.5 sm:w-7 sm:h-7 ${item.bg} rounded-md sm:rounded-lg border flex items-center justify-center shrink-0`}>
                      <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-[8px] sm:text-[12px] md:text-[12.5px] font-black text-slate-800 tracking-tight leading-tight whitespace-normal break-words max-w-full">
                      {item.label}
                    </span>
                  </div>
                  <div className="hidden sm:block pl-0.5 mt-0.5">
                    <span className="text-[8.5px] text-slate-400 font-bold">{item.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* TAB 1: DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 sm:space-y-6">
              
              {/* BRAND HERO HIGHLIGHT & DIGITAL RATION CARD GRAPHIC MATCHING PRECISELY */}
              <div className="flex flex-col gap-6 items-center">
                
                {/* Card representation - STACKED FULL WIDTH BANNER */}
                <div className="w-full flex justify-center">
                  {renderBeautifulRationCard(rationCard)}
                </div>

              </div>

              {/* QUICK METRICS GRID CONTAINER */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-4">
                
                {/* Metric 1 */}
                <div className="bg-white p-1.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 text-left space-y-0.5 sm:space-y-1">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 bg-blue-50 rounded-md sm:rounded-lg flex items-center justify-center text-blue-600 shrink-0">
                      <CreditCard className="w-3 h-3 sm:w-4 h-4" />
                    </div>
                    <span className="text-[7.5px] sm:text-[10px] text-slate-400 uppercase font-black tracking-wide truncate">আমার কার্ড</span>
                  </div>
                  <h3 className="text-xs sm:text-base font-black text-slate-900 pt-0.5 sm:pt-1 leading-snug">
                    <span className="text-blue-600 text-[8px] sm:text-xs font-black mr-0.5 sm:mr-1 block sm:inline">Active</span>
                    <span className="text-xs sm:text-lg font-mono">1 টি</span>
                  </h3>
                </div>

                {/* Metric 2 */}
                <div className="bg-white p-1.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 text-left space-y-0.5 sm:space-y-1">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 bg-emerald-50 rounded-md sm:rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                      <Calendar className="w-3 h-3 sm:w-4 h-4" />
                    </div>
                    <span className="text-[7.5px] sm:text-[10px] text-slate-400 uppercase font-black tracking-wide truncate">কার্ড ইস্যু</span>
                  </div>
                  <h3 className="text-[9px] sm:text-xs font-black text-slate-900 pt-1.5 font-mono leading-snug tracking-tighter truncate w-full">
                    20 May 2025
                  </h3>
                </div>

                {/* Metric 3 */}
                <div className="bg-white p-1.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 text-left space-y-0.5 sm:space-y-1">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 bg-orange-50 rounded-md sm:rounded-lg flex items-center justify-center text-orange-600 shrink-0">
                      <Calendar className="w-3 h-3 sm:w-4 h-4" />
                    </div>
                    <span className="text-[7.5px] sm:text-[10px] text-slate-400 uppercase font-black tracking-wide truncate">মেয়াদকাল</span>
                  </div>
                  <h3 className="text-[9px] sm:text-xs font-black text-slate-900 pt-1.5 font-mono leading-snug tracking-tighter truncate w-full">
                    20 May 2026
                  </h3>
                </div>

                {/* Metric 4 */}
                <div className="bg-white p-1.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 text-left space-y-0.5 sm:space-y-1">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 bg-amber-50 rounded-md sm:rounded-lg flex items-center justify-center text-amber-600 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-[7.5px] sm:text-[10px] text-slate-400 uppercase font-black tracking-wide truncate">বাকি দিন</span>
                  </div>
                  <h3 className="text-[9px] sm:text-xs font-black text-slate-900 pt-1.5 font-mono leading-snug truncate w-full">
                    365 দিন
                  </h3>
                </div>

              </div>

              {/* DYNAMIC ITEM SELECTOR BOX */}
              <div id="selection-stage" className="bg-white border border-slate-200/80 rounded-3xl p-5 md:p-6 text-left space-y-4 shadow-sm">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 leading-tight">
                    {appConfig?.rationTitleText || "10টি আইটেমের মধ্যে থেকে যেকোনো 5টি নিতে পারবেন"}
                  </h3>
                  <div className="text-[10px] font-black text-[#006A4E] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-tight">
                    আপনি নির্বাচিত করেছেন {englishToBengali(selectedItemIds.length)}/{englishToBengali(appConfig?.rationMaxSelectLimit || 5)}
                  </div>
                </div>

                {/* THE 10 ITEMS RESPONSIVE DENSE GRID */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-3.5 pt-1.5">
                  {(dbRationItems.length > 0 ? dbRationItems : rationItems).map((item, idx) => {
                    const isSelected = selectedItemIds.includes(item.id);
                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        onClick={() => toggleItemSelection(item.id)}
                        className={`relative rounded-xl sm:rounded-2xl border p-1.5 sm:p-3 flex flex-col justify-between items-center text-center cursor-pointer transition-all duration-200 shadow-4xs select-none ${
                          isSelected 
                            ? 'bg-emerald-50/55 border-emerald-500 scale-98 active:scale-95 ring-2 ring-emerald-500/10' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Circle Checkbox overlay at top right */}
                        <div className="absolute top-1.5 right-1.5 z-10 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border flex items-center justify-center bg-white transition-all">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="w-2.5 h-2.5 rounded-full accent-emerald-700 pointer-events-none"
                          />
                        </div>

                        {/* Centered representation block */}
                        <div className="space-y-1 flex flex-col items-center w-full">
                          <div className={`w-9 h-9 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br ${item.color || 'from-emerald-50 to-teal-50'} flex items-center justify-center p-0.5 sm:p-1 text-base sm:text-2xl shadow-3xs shrink-0 overflow-hidden`}>
                             {item.emoji && item.emoji.startsWith('http') ? (
                               <img src={item.emoji} alt={item.name} className="w-full h-full object-contain rounded-full" referrerPolicy="no-referrer" />
                             ) : (
                               item.emoji || '🍚'
                             )}
                          </div>
                          <h4 className="text-[9px] sm:text-[10.5px] font-black text-gray-900 line-clamp-1 leading-snug w-full px-0.5">{item.name}</h4>
                          <span className="text-[7.5px] sm:text-[8px] font-extrabold text-[#006A4E] bg-emerald-50 border border-emerald-100 px-1 sm:px-2 py-0.2 rounded-md font-mono">{item.qty}</span>
                        </div>

                        {/* Price tier row */}
                        <div className="pt-1.5 sm:pt-2.5 mt-1.5 sm:mt-2.5 border-t border-slate-100 w-full text-center space-y-0.5">
                          <p className="text-[10px] sm:text-xs font-black text-emerald-800 font-mono">
                            ৳{englishToBengali(item.price)}
                          </p>
                          <p className="text-[7.5px] sm:text-[8px] font-semibold text-slate-400 font-mono truncate w-full">
                            বাজার: ৳{englishToBengali(item.marketPrice)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Grid bottom persistent indicators bar */}
                <div className="bg-[#F8FAFC] border border-slate-200/50 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-800 font-sans">
                  
                  <div className="flex items-center gap-4 text-xs font-black">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      নির্বাচিত আইটেমঃ <span className="text-[#006A4E] font-bold">{englishToBengali(selectedItemIds.length)} টি</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      মোট মূল্যঃ <span className="text-[#006A4E] font-mono font-bold">৳{englishToBengali(totalPrice)}</span>
                    </span>
                    {savings > 0 && (
                      <span className="text-[9.5px] bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full border border-red-150 font-bold uppercase tracking-wide">
                        আপনার সাশ্রয়ঃ ৳{englishToBengali(savings)}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedItemIds.length === 0) {
                        alert("অনুগ্রহ করে কমপক্ষে 1টি আইটেম নির্বাচন করুন!");
                        return;
                      }
                      setShowCheckoutModal(true);
                    }}
                    className="bg-[#006A4E] hover:bg-emerald-900 text-white font-extrabold py-2 px-6 rounded-xl text-xs flex items-center gap-1 transition active:scale-95 shadow-md cursor-pointer w-full sm:w-auto text-center justify-center"
                  >
                    অর্ডার করুন <ChevronRight className="w-4 h-4" />
                  </button>

                </div>

              </div>
                    {/* TWO SIDES FOOTER: LATEST ORDERS (LEFT) & DIRECTIONS GUIDELINES (RIGHT) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                
                {/* Side Left: সর্বশেষ অর্ডার */}
                <div className="bg-white border border-slate-205 rounded-3xl p-5 text-left space-y-4">
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest border-b border-slate-100 pb-2 font-sans">সর্বশেষ অর্ডার</h3>
                  
                  {loadingOrders ? (
                    <div className="py-8 text-center text-xs text-slate-400">অর্ডার লোড হচ্ছে...</div>
                  ) : orders.length === 0 ? (
                    <div className="py-8 px-4 flex flex-col items-center text-center space-y-3.5 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                        <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black text-slate-800">আপনার কোনো অর্ডার নেই</p>
                        <p className="text-[10px] text-slate-450">এখনই আইটেম সিলেক্ট করে উপরের বাটন থেকে প্রথম অর্ডার করুন!</p>
                      </div>
                      <button
                        onClick={() => {
                          const element = document.getElementById('selection-stage');
                          element?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="bg-[#006A4E] hover:bg-emerald-900 text-white font-bold py-1.5 px-4 rounded-lg text-[10px] cursor-pointer"
                      >
                        অর্ডার করুন
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {orders.slice(0, 3).map((order, idx) => (
                        <div key={order.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs gap-3">
                          <div className="space-y-1 text-left">
                            <p className="font-extrabold text-slate-900 font-mono tracking-tight">{order.orderNo || `ORD-${idx}`}</p>
                            <p className="text-[9px] text-[#006A4E] font-bold truncate max-w-[170px] bg-emerald-50 border border-emerald-100 p-1 rounded-sm line-clamp-1">
                              {order.items?.map((p: any, idx) => p.name).join(', ')}
                            </p>
                          </div>
                          <div className="text-right space-y-1 shrink-0">
                            <p className="font-mono font-bold text-slate-900">৳{englishToBengali(order.totalPrice)} BDT</p>
                            <span className="text-[8.5px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100 inline-block font-sans">
                              {order.status === 'Pending' ? 'অপেক্ষাশীল' : 'সংগৃহীত'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Side Right: গুরুত্বপূর্ণ নির্দেশনা */}
                <div className="bg-white border border-slate-205 rounded-3xl p-5 text-left space-y-4">
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest border-b border-slate-100 pb-2 font-sans">গুরুত্বপূর্ণ নির্দেশনা</h3>
                  
                  <div className="space-y-3 text-slate-800 text-[11px] leading-relaxed font-bold font-sans">
                    {[
                      { text: `আপনি সর্বমোট ${appConfig?.rationTotalItemsText || "10"}টি আইটেমের মধ্যে থেকে সর্বোচ্চ ${englishToBengali(appConfig?.rationMaxSelectLimit || 5)}টি বেছে নিতে পারবেন।` },
                      { text: "বাজার মূল্যের তুলনায় আমাদের পণ্যের দাম কম।" },
                      { text: "অর্ডার করার পর নিকটস্থ AMB সেন্টার থেকে পণ্য সংগ্রহ করুন।" },
                      { text: "কার্ডের মেয়াদ শেষ হলে পুনরায় রিনিউ করতে হবে।", alert: true },
                      { text: "যেকোনো সমস্যায় সাপোর্টে যোগাযোগ করুন।" }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <CheckCircle className="w-4.5 h-4.5 text-emerald-600 fill-emerald-100 shrink-0 mt-0.5" />
                        <p className={item.alert ? "text-amber-800" : "text-slate-650"}>{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: RATION CARD VIEW */}
          {activeTab === 'card' && (
            <div className="max-w-2xl mx-auto space-y-6">
              
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md text-left space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3 font-sans">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 border-none pb-0">ডিজিটাল রেশন কার্ডের ভার্চুয়াল ভিউ</h3>
                    <p className="text-[10px] text-zinc-400 font-bold mt-0.5">রেশন পণ্য সংগ্রহ বা মেম্বার যাচাই করতে নিচের কার্ডটি ব্যবহার করুন</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[11px] font-black text-slate-700 flex items-center gap-1 cursor-pointer transition border border-slate-200"
                    >
                      <FileText className="w-3.5 h-3.5" /> প্রিন্ট / PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCard}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-[#E9F2ED] rounded-xl text-[11px] font-black text-[#015335] flex items-center gap-1 cursor-pointer transition border border-emerald-100"
                    >
                      <ArrowDown className="w-3.5 h-3.5" /> ইমেজ ডাউনলোড
                    </button>
                    <button
                      type="button"
                      onClick={handleShareCard}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-xl text-[11px] font-black text-blue-700 flex items-center gap-1 cursor-pointer transition border border-blue-100"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l5.136-2.568m0 5.652l-5.136-2.568m4.408-5.326a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm0 11.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                      </svg>
                      শেয়ার লিংক
                    </button>
                  </div>
                </div>
 
                {/* HIGH FIDELITY MEMBERSHIP RATION CARD FOR GRAPHIC SUBMISSION */}
                {renderBeautifulRationCard(rationCard)}
 
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-650 bg-slate-50 p-4 rounded-2xl border border-slate-150 font-sans">
                  <p>বিতরণ ক্যাটাগরিঃ <span className="font-extrabold text-slate-808 block mt-0.5">{rationCard.cardType || 'Regular Silver'}</span></p>
                  <p>নমিনী ও সম্পর্কঃ <span className="font-extrabold text-slate-808 block mt-0.5">{rationCard.nominee || 'N/A'}</span></p>
                  <p className="col-span-2">ডেলিভারি ঠিকানাঃ <span className="font-extrabold text-slate-808 block mt-0.5">{rationCard.address}</span></p>
                </div>
              </div>

              {/* 2 Special Samples at the Bottom: VIP Golden Card & Premium Green Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md text-left space-y-4 font-sans">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-sans flex items-center gap-1.5">
                    🛡️ অন্যান্য রেশন কার্ড সংস্করণ
                  </h4>
                  <span className="text-[9px] text-emerald-850 font-black bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                    ডিজাইন প্রিভিউ
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* VIP Golden Card (হলুদ বক্স) */}
                  <div className="border-[2.5px] border-amber-400 rounded-2xl p-3.5 bg-gradient-to-br from-amber-50/50 via-yellow-100/10 to-amber-50/30 text-left relative flex flex-col justify-between overflow-hidden shadow-2xs h-44 sm:h-48">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
                    
                    {/* Admin Upload Trigger Option */}
                    {isAdmin && (
                      <label className="absolute top-2 right-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full p-1 cursor-pointer shadow-md transition z-10 flex items-center gap-1 text-[8.5px] font-bold">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleUploadVipCardImage} 
                          className="hidden" 
                        />
                        <span>📷 আপলোড</span>
                      </label>
                    )}

                    <div className="flex-1 flex flex-col justify-between">
                      {appConfig?.vipCardDesignUrl ? (
                        <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-xl bg-white border border-amber-200 p-0.5">
                          <img 
                            src={appConfig.vipCardDesignUrl} 
                            alt="VIP Gold Card Design" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center font-black text-white border border-amber-400 shadow-3xs">
                              <span className="text-[9px] tracking-tighter">AMB</span>
                            </div>
                            <span className="text-[8px] sm:text-[9.5px] text-amber-850 font-black tracking-tight leading-none">VIP GOLD 👑</span>
                          </div>

                          <div className="my-2 border-t border-dashed border-amber-200" />

                          <div className="space-y-1">
                            <p className="text-[10px] sm:text-xs font-black text-amber-950 uppercase tracking-tight">ভিআইপি গোল্ডেন কার্ড</p>
                            <p className="text-[8px] sm:text-[9.5px] text-amber-700 font-medium leading-tight">লাক্সারি ডিলার শিপমেন্ট ও আনলিমিটেড ফ্যামিলি রেশন কোটা</p>
                          </div>
                          
                          <div className="mt-2 flex items-center justify-between text-[7px] sm:text-[8px] font-bold text-amber-600">
                            <span>AMB-VIP-GOLD</span>
                            <span className="text-[6.5px] text-amber-750 font-extrabold bg-amber-50 px-1.5 py-0.5 rounded">গ্যালারি আপলোড</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Premium Green Card (সবুজ বক্স) */}
                  <div className="border-[2.5px] border-emerald-500 rounded-2xl p-3.5 bg-gradient-to-br from-emerald-50/50 via-teal-100/10 to-emerald-50/30 text-left relative flex flex-col justify-between overflow-hidden shadow-2xs h-44 sm:h-48">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                    
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 bg-[#006A4E] rounded-lg flex items-center justify-center font-black text-white border border-teal-800 shadow-3xs">
                          <span className="text-[9px] tracking-tighter">AMB</span>
                        </div>
                        <span className="text-[8px] sm:text-[9.5px] text-emerald-850 font-black tracking-tight leading-none">PREMIUM 💎</span>
                      </div>

                      <div className="my-2 border-t border-dashed border-emerald-200" />

                      <div className="space-y-1">
                        <p className="text-[10px] sm:text-xs font-black text-emerald-950 uppercase tracking-tight">প্রিমিয়াম গ্রিন কার্ড</p>
                        <p className="text-[8px] sm:text-[9.5px] text-emerald-700 font-medium leading-tight">5% অতিরিক্ত সাবসিডি ছাড় ও কুরিয়ার হোম ডেলিভারি সুবিধা</p>
                      </div>
                      
                      <div className="mt-2 flex items-center justify-between text-[7px] sm:text-[8px] font-bold text-emerald-600">
                        <span>AMB-PREM-GREEN</span>
                        <span className="text-[6.5px] text-emerald-850 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded">অটো ডিজাইন</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
 
            </div>
          )}

          {/* TAB 3: PRODUCT SPECS / MY ITEMS */}
          {activeTab === 'items' && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="text-[14.5px] font-black text-slate-900">우리 সর্বমোট {englishToBengali(dbRationItems.length > 0 ? dbRationItems.length : 10)}টি সাশ্রয়ী নিত্যপরিবেশ পণ্য</h3>
                <span className="text-xs text-slate-450 font-bold">ডিজিটাল রেশন ভাউচার</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(dbRationItems.length > 0 ? dbRationItems : rationItems).map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="bg-white border border-slate-200 rounded-3xl p-4 flex items-center justify-between text-left shadow-4xs">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-50 border border-slate-200 text-2xl rounded-full flex items-center justify-center overflow-hidden">
                        {item.emoji && (item.emoji.startsWith('http') || item.emoji.startsWith('data:image')) ? (
                          <img src={item.emoji} alt={item.name} className="w-10 h-10 object-contain rounded-lg" referrerPolicy="no-referrer" />
                        ) : (
                          <span>{item.emoji || '🍚'}</span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs sm:text-sm font-black text-slate-950 font-semibold">{item.name}</h4>
                        <p className="text-[10px] text-emerald-800 font-bold font-mono font-sans">প্যাক সাইজ: {item.qty}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1 shrink-0 font-sans">
                      <p className="text-xs font-black text-emerald-805 font-mono">৳{englishToBengali(item.price)} BDT</p>
                      <p className="text-[8.5px] font-bold text-slate-400 line-through font-mono">বাজার মূল্য: ৳{englishToBengali(item.marketPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ORDER CAPABLE FORM */}
          {activeTab === 'order' && (
            <div className="space-y-5">
              <div className="bg-[#EFF5FF] border border-blue-100 rounded-3xl p-5 text-left md:p-6">
                <h2 className="text-sm font-black text-blue-700 flex items-center gap-1.5 leading-snug">
                  🛒 রেশন রিফিল পণ্য নির্বাচন করুন
                </h2>
                <p className="text-xs text-slate-500 font-bold mt-1 max-w-[550px] leading-relaxed">
                  আপনার রেশন আইডির বিপরীতে প্রতি মাসে মেইন ব্যালেন্স থেকে সাবসিডি রেটে প্রয়োজনীয় ফ্যামিলি রিফিল পণ্য সিলেক্ট করে 1 ক্লিকের অর্ডার সম্পন্ন করুন।
                </p>
              </div>

              {/* Renders Item selection stage directly */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 text-left space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest font-sans">উপলব্ধ রেশন প্রোডাক্টস</h4>
                  <span className="text-[10px] font-black text-emerald-800">নির্বাচিতঃ {englishToBengali(selectedItemIds.length)}/5 আইটেম</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 sm:gap-3.5 pt-1.5">
                  {rationItems.map((item, idx) => {
                    const isSelected = selectedItemIds.includes(item.id);
                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        onClick={() => toggleItemSelection(item.id)}
                        className={`relative rounded-2xl border p-3 flex flex-col justify-between items-center text-center cursor-pointer transition-all duration-150 select-none ${
                          isSelected 
                            ? 'bg-emerald-50/55 border-emerald-500 scale-98 active:scale-95' 
                            : 'bg-white border-slate-205 hover:border-slate-300'
                        }`}
                      >
                        <div className="absolute top-2 right-2">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="accent-emerald-700"
                          />
                        </div>

                        <div className="space-y-1 flex flex-col items-center">
                          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center p-0.5 text-xl mb-1 overflow-hidden shrink-0">
                            {item.emoji && (item.emoji.startsWith('http') || item.emoji.startsWith('data:')) ? (
                              <img src={item.emoji} alt={item.name} className="w-full h-full object-contain rounded-full" referrerPolicy="no-referrer" />
                            ) : (
                              item.emoji || '🍚'
                            )}
                          </div>
                          <h5 className="text-[10px] font-black text-gray-900 leading-tight block line-clamp-1">{item.name}</h5>
                          <span className="text-[8px] bg-slate-50 text-[#006A4E] border border-slate-200 font-extrabold px-1.5 py-0.2 rounded-md font-mono">{item.qty}</span>
                        </div>

                        <div className="pt-2 mt-2 border-t border-slate-100 w-full text-center">
                          <span className="text-xs font-black text-emerald-800 font-mono">৳{englishToBengali(item.price)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-slate-50 border border-slate-200 text-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 mt-4">
                  <div className="space-y-0.5 text-left text-xs font-black">
                    <p className="text-slate-500 leading-none">নির্বাচিত আইটেম সংখ্যাঃ <span className="text-slate-800 font-black">{englishToBengali(selectedItemIds.length)} টি</span></p>
                    <p className="text-slate-900 font-mono text-xs mt-1 leading-none">অর্ডার সর্বমোট মূল্যঃ <span className="text-[#006A4E] font-extrabold">৳{englishToBengali(totalPrice)} BDT</span></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedItemIds.length === 0) {
                        alert("অনুগ্রহ করে কমপক্ষে 1টি আইটেম সিলেক্ট করুন!");
                        return;
                      }
                      setShowCheckoutModal(true);
                    }}
                    className="bg-[#006A4E] hover:bg-emerald-900 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs cursor-pointer active:scale-95 transition shadow-md w-full sm:w-auto"
                  >
                    নিশ্চিত করুন ও অর্ডার প্লেস করুন
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MY ORDERS LIST */}
          {activeTab === 'my_orders' && (
            <div className="space-y-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">আমার রেশন অর্ডারসমূহ</h3>
                <span className="text-xs text-slate-450 font-bold">লাইভ ডাটাবেজ</span>
              </div>

              {loadingOrders ? (
                <div className="py-12 text-center text-slate-500 font-bold bg-white border border-slate-150 rounded-3xl flex flex-col items-center justify-center space-y-3">
                  <span className="w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                  <span>অর্ডার খাতা ওপেন হচ্ছে...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="p-12 text-center bg-white border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold text-xs leading-relaxed">
                  আপনি এই পর্যন্ত কোনো অর্ডার প্রদান করেননি। সর্বমোট {appConfig?.rationTotalItemsText || "10"}টি নিত্যপ্রয়োজনীয় আইটেম উপভোগ করতে এখনই অর্ডার করুন।
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order, idx) => {
                    const orderDate = new Date(order.createdAt || '');
                    const bNum = englishToBengali;
                    const itemsText = order.items?.map((p: any, idx) => p.name).join(', ') || 'রেশন কেন্টাল';
                    return (
                      <div key={`${order.id}-${idx}`} className="bg-white border border-slate-200 rounded-3xl p-5 text-left space-y-4 shadow-3xs hover:border-slate-300 transition-all">
                        {/* Header of order item */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="space-y-1">
                            <h4 className="text-xs sm:text-sm font-black text-slate-909 font-mono uppercase tracking-tight">{order.orderNo || 'ORD-N/A'}</h4>
                            <p className="text-[9.5px] text-slate-400 font-bold font-mono">
                              তারিখঃ {orderDate.toLocaleDateString('bn-BD')} • time: {orderDate.toLocaleTimeString('bn-BD')}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-2 self-start sm:self-center">
                            <span className="text-xs font-black text-slate-900 font-mono">৳{bNum(order.totalPrice)}</span>
                            <span className="text-[10px] font-black bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
                              {order.status === 'Pending' ? 'অপেক্ষমাণ' : 'সংগৃহীত'}
                            </span>
                          </div>
                        </div>

                        {/* Middle block showing items */}
                        <div className="text-xs leading-relaxed font-semibold text-slate-650 bg-slate-50 p-3 rounded-2xl border border-slate-150">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">আইটেম তালিকাঃ</p>
                          <p className="text-slate-800 font-black mt-0.5">{itemsText}</p>
                          <p className="text-[10px] text-emerald-805 font-bold mt-1.5 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> পণ্য সংগ্রহের স্থানঃ {order.issueCenter || 'হেমায়েতপুর মেইন বিতরণ কেন্দ্র'}
                          </p>
                        </div>

                        {/* Visually stunning active trackers matching real orders */}
                        <div className="pt-2">
                          <p className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-3">ডেলিভারি ট্র্যাকিং স্ট্যাটাসঃ</p>
                          <div className="grid grid-cols-3 gap-2 text-center text-[9.5px] font-black text-slate-800">
                            
                            {/* step 1 */}
                            <div className="space-y-1 flex flex-col items-center">
                              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">✓</span>
                              <p className="text-emerald-800 leading-tight">বুকিং নিশ্চিত</p>
                            </div>

                            {/* step 2 */}
                            <div className="space-y-1 flex flex-col items-center">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                                order.status === 'Pending' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-emerald-600 text-white'
                              }`}>
                                {order.status === 'Pending' ? '...' : '✓'}
                              </span>
                              <p className="leading-tight text-slate-600">কেন্দ্রে পাঠানো হয়েছে</p>
                            </div>

                            {/* step 3 */}
                            <div className="space-y-1 flex flex-col items-center">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                                order.status === 'Collected' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {order.status === 'Collected' ? '✓' : '3'}
                              </span>
                              <p className="leading-tight text-slate-500">সংগ্রহ সম্পন্ন</p>
                            </div>

                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-905 uppercase tracking-widest">রেশন ট্রানজেকশন খতিয়ান</h3>
                <span className="text-xs text-slate-450 font-bold">পদ্ধতিগত খাতা</span>
              </div>

              {/* Renders custom list representing transaction histories */}
              <div className="bg-white border rounded-3xl overflow-hidden divide-y divide-slate-100">
                {[
                  { title: 'রেশন কার্ড সক্রিয়করণ ফি', desc: 'ওয়ান-টাইম মেম্বার কার্ড সেটআপ পেমেন্ট ফি সম্পন্ন।', amount: 150, type: 'minus', date: '20 May 2025' },
                  { title: 'রেশন সাবসিডি রিফিল পণ্য পরিশোধ', desc: ' চাল, ডাল, চিনি ও লবণ রিফিল কিট অর্ডার নং RATION-ORD-3814', amount: 485, type: 'minus', date: '05 June 2025' },
                  { title: 'রেশন সাবসিডি রিফিল কিট', desc: 'তেল ও দুধ গুঁড়া অর্ডার নং RATION-ORD-1152', amount: 320, type: 'minus', date: '18 June 2025' }
                ].map((tx, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between text-xs gap-3">
                    <div className="text-left space-y-1">
                      <h4 className="font-black text-slate-900 leading-tight">{tx.title}</h4>
                      <p className="text-[10px] text-slate-450 font-bold leading-normal">{tx.desc}</p>
                      <p className="text-[9.5px] text-slate-400 font-mono">{tx.date}</p>
                    </div>
                    <div className="text-right font-mono font-bold text-red-600 shrink-0 text-sm">
                      - ৳{englishToBengali(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: PROFILE DETAILS */}
          {activeTab === 'profile' && (
            <div className="max-w-2xl mx-auto space-y-6 text-left">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 space-y-5">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest border-b border-slate-100 pb-2.5">রেশন কার্ডহোল্ডার প্রোফাইল তথ্য</h3>
                
                <div className="grid grid-cols-2 gap-4 text-xs font-bold font-sans text-slate-700">
                  <div className="space-y-1">
                    <p className="text-slate-400 text-[10px] uppercase font-black tracking-wide">সদস্যের নামঃ</p>
                    <p className="text-slate-900 text-sm font-black">{rationCard.userName}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-slate-400 text-[10px] uppercase font-black tracking-wide">ব্যক্তিগত মোবাইলঃ</p>
                    <p className="text-slate-900 text-sm font-mono tracking-tight">{rationCard.phone || liveUser.phone}</p>
                  </div>

                   <div className="space-y-1 col-span-2">
                    <p className="text-slate-400 text-[10px] uppercase font-black tracking-wide">ডিজিটাল রেশন আইডিঃ</p>
                    <p className="text-slate-900 text-sm font-mono tracking-widest text-emerald-800 font-black">{rationCard.cardNo}</p>
                  </div>

                  <div className="col-span-2 space-y-1">
                    <p className="text-slate-400 text-[10px] uppercase font-black tracking-wide">বিতরণ ঠিকানাঃ</p>
                    <p className="text-slate-900 leading-relaxed font-black">{rationCard.address}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: SUPPORT INFO */}
          {activeTab === 'support' && (
            <div className="max-w-2xl mx-auto space-y-6 text-left">
              
              <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 space-y-4 shadow-3xs">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest border-b border-slate-100 pb-2.5">গ্রাহক সেবা ও বিতরণ কেন্দ্র সহায়তা</h3>
                <p className="text-xs text-slate-500 font-bold leading-relaxed">
                  আপনার রেশন কার্ড, অর্ডার সংগ্রহ, বা পেমেন্ট সংক্রান্ত কোনো সমস্যা হলে আমাদের কাস্টমার হটলাইন অথবা সরাসরি নিকটস্থ বিতরণ কর্মকর্তা বা AMB সাভার হেমায়েতপুর মেইন সেন্টারে যোগাযোগ করুন।
                </p>

                <div className="space-y-3 pt-2 text-xs font-bold">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-150 flex items-center justify-between">
                    <span>📞 অফিসিয়াল সাপোর্ট সাহায্যঃ</span>
                    <span className="font-mono text-emerald-850 font-black">01612-345678</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-150 flex items-center justify-between">
                    <span>📍 মেইন বিতরণ কেন্দ্রঃ</span>
                    <span className="text-slate-900 font-black">হেমায়েতপুর মেইন কেন্টাল, সাভার, ঢাকা</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-150 flex items-center justify-between">
                    <span>⏰ সংগ্রহ ডিস্ট্রিবিউশন সময়ঃ</span>
                    <span className="text-slate-900 font-black">শনিবার হতে বৃহস্পতিবার (সকাল 9টা - বিকেল 5টা)</span>
                  </div>
                </div>
              </div>

              {/* LIVE CHAT SECTION */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 space-y-4 shadow-3xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <div className="w-8 h-8 bg-[#006A4E]/10 text-[#006A4E] rounded-xl flex items-center justify-center">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">AMB লাইভ কাস্টমার চ্যাট</h3>
                    <p className="text-[10px] text-[#006A4E] font-black">সরাসরি সাপোর্ট রুম (রেশন সেক্টর)</p>
                  </div>
                </div>

                <div className="flex flex-col h-[320px] bg-slate-50 border border-slate-150 rounded-2xl p-3 justify-between">
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 mb-3 pr-1 scrollbar-thin">
                    {chatMessages.map((msg, idx) => (
                      <div 
                        key={`${msg.id}-${idx}`} 
                        className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        <span className="text-[8px] text-slate-400 font-bold mb-0.5 px-1">
                          {msg.sender === 'user' ? 'আপনি' : 'AMB সাপোর্ট'}
                        </span>
                        <div className={`p-2.5 rounded-2xl text-[11px] leading-relaxed font-semibold shadow-3xs ${
                          msg.sender === 'user' 
                            ? 'bg-[#006A4E] text-white rounded-tr-xs' 
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                        }`}>
                          {msg.text}
                        </div>
                        <span className="text-[7.5px] text-slate-400 font-mono mt-0.5 px-1">{msg.timestamp}</span>
                      </div>
                    ))}

                    {isChatTyping && (
                      <div className="mr-auto items-start max-w-[85%] flex flex-col animate-pulse">
                        <span className="text-[8px] text-slate-400 font-bold mb-0.5 px-1">AMB সাপোর্ট টাইপ করছে...</span>
                        <div className="p-2.5 rounded-2xl bg-white text-slate-500 border border-slate-200 rounded-tl-xs shadow-3xs flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input Form */}
                  <form onSubmit={handleSendChatMessage} className="flex gap-1.5 items-center bg-white p-1.5 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      value={chatInputText}
                      onChange={(e) => setChatInputText(e.target.value)}
                      placeholder="আপনার প্রশ্নটি এখানে লিখুন..."
                      className="flex-1 bg-transparent px-2 py-1 text-xs focus:outline-none placeholder-slate-450 text-slate-800"
                      disabled={isChatTyping}
                    />
                    <button
                      type="submit"
                      disabled={!chatInputText.trim() || isChatTyping}
                      className="p-1.5 bg-[#006A4E] hover:bg-emerald-900 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg transition active:scale-95 cursor-pointer shadow-3xs shrink-0 flex items-center justify-center"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>

                <div className="flex justify-between items-center px-1">
                  <p className="text-[9px] text-slate-400 font-bold">সরাসরি কথা বলতে চান?</p>
                  <button
                    type="button"
                    onClick={() => window.open(`https://wa.me/${(appConfig?.supportPhone || '01865911728').replace(/\D/g, '')}`, '_blank')}
                    className="py-1 px-2.5 bg-[#25D366] hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black tracking-wide flex items-center gap-1 cursor-pointer transition active:scale-95 shadow-3xs"
                  >
                    📥 WhatsApp চ্যাট করুন
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* CHECKOUT MODAL DRAWER OVERLAY */}
      <AnimatePresence>
        {showCheckoutModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-100 shadow-2xl relative overflow-hidden text-left space-y-5"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-[#006A4E]" />

              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-extrabold text-[#006A4E] flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4" /> পেমেন্ট ও অর্ডার বুকিং নিশ্চিতকরণ
                </h3>
                <button 
                  type="button"
                  onClick={() => {
                    setShowCheckoutModal(false);
                    setCheckoutError('');
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {checkoutError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-bold leading-normal">
                  ⚠ {checkoutError}
                </div>
              )}

              {/* Order checkout breakdown summaries */}
              <div className="bg-[#F8FAFC] border border-slate-200 p-4 rounded-2xl text-xs space-y-2 font-bold font-sans">
                <div className="flex justify-between">
                  <span className="text-slate-500">আইটেম সংখ্যাঃ</span>
                  <span className="text-slate-900 font-black">{englishToBengali(selectedItems.length)} টি</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-2 text-slate-900 text-sm font-black">
                  <span>সর্বমোট বিলিংঃ</span>
                  <span className="text-[#006A4E] font-mono">৳{englishToBengali(totalPrice)} BDT</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 p-2 rounded-xl mt-1.5">
                  <span>আপনার বাজার সাশ্রয়ঃ</span>
                  <span className="font-mono">৳{englishToBengali(savings)} BDT</span>
                </div>
              </div>

              <form onSubmit={handlePlaceOrder} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-600">আপনার 4 ডিজিটের ওয়ালেট পিন নাম্বার লিখুনঃ *</label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    placeholder="••••"
                    value={securityPin}
                    onChange={(e) => setSecurityPin(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-center focus:outline-none focus:border-emerald-600 font-mono tracking-widest text-base"
                  />
                  <p className="text-[9.5px] text-slate-400 text-center font-bold">অ্যাকাউন্ট ব্যালেন্স থেকে সরাসরি বিলিং অ্যামাউন্ট কেটে নেওয়া হবে।</p>
                </div>

                <button
                  type="submit"
                  disabled={placingOrder}
                  className="w-full bg-[#006A4E] hover:bg-emerald-950 disabled:opacity-50 text-white font-extrabold py-3.5 px-4 rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {placingOrder ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      অর্ডার প্লেস হচ্ছে...
                    </>
                  ) : (
                    <>✓ সিকিউর পেমেন্ট ও বুকিং সম্পন্ন করুন</>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 100% Secure & Fail-Safe Ration Card Image Modal for Sandboxed Iframes / Mobiles */}
      {showCardImageModal && generatedCardUrl && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans animate-fade-in">
          <div className="bg-white rounded-2.5xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-650 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-slate-800">রেশন কার্ডের ছবি তৈরি হয়েছে!</h3>
              <p className="text-[10px] text-slate-500 leading-relaxed font-bold">
                মোবাইল বা ব্রাউজার সীমাবদ্ধতার কারণে সরাসরি ডাউনলোড শুরু না হলে নিচের রেশন কার্ডের ছবির ওপরে চেপে ধরে রেখে (Long Press) অথবা মাউসের ডান ক্লিক করে <strong className="text-[#015335]">"Save Image" (ছবিটি সংরক্ষণ করুন)</strong> সিলেক্ট করে গ্যালারিতে সেভ করুন, অথবা স্ক্রিনশট নিয়ে রাখুন।
              </p>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50 p-2 max-h-[220px] overflow-y-auto flex items-center justify-center">
              <img 
                src={generatedCardUrl} 
                alt="AMB Digital Ration Card" 
                className="max-w-full max-h-[180px] object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <a 
              href={generatedCardUrl} 
              download={`AMB-Ration-Card-${rationCard?.cardNo || liveUser?.memberId}.png`}
              className="block w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black transition cursor-pointer text-center shadow-3xs"
            >
              📥 সরাসরি গ্যালারিতে সেভ করুন
            </a>

            <button
              type="button"
              onClick={() => setShowCardImageModal(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition cursor-pointer"
            >
              বন্ধ করুন (Close)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
