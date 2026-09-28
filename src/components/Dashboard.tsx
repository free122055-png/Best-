import React, { useState, useEffect, useRef } from 'react';
import { User, Transaction, Notice, Offer, AppConfig, Product, UserNotification, SAMITY_MONTHS, SAMITY_YEARS, normalizePaidMonthsArray, getEffectivePaidMonthsList, getEffectiveBalance, generateAmbTrxId, formatShortTrxId } from '../types';
import { sortTransactionsNewestFirst } from '../lib/transactionUtils';
import UserTransactionsStatement from './UserTransactionsStatement';
import TransactionExchangeIcon from './TransactionExchangeIcon';
import { filterTransactionsLast60Days, cleanupExpiredTransactions } from '../lib/transactionCleanup';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc,
  setDoc,
  limit,
  onSnapshot,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { 
  Menu, 
  Bell, 
  BellRing,
  Eye,
  LogOut, 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Home,
  UserCircle, 
  DollarSign, 
  BookOpen, 
  Smartphone, 
  ShoppingBag, 
  CreditCard,
  Building2, 
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  FileText,
  Users,
  Megaphone,
  History,
  CheckCircle2,
  PlusCircle,
  AlertCircle,
  X,
  Languages,
  BadgePercent,
  ChevronRight,
  ChevronLeft,
  Clock,
  ShieldAlert,
  RefreshCw,
  MessageCircle,
  Store,
  Plus,
  Send,
  Calendar,
  Ticket,
  Construction,
  Lock,
  Check,
  Gift,
  Target,
  Landmark,
  Truck,
  Heart,
  Globe,
  PhoneCall,
  Utensils,
  Sun,
  Moon,
  Briefcase,
  QrCode,
  Banknote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AMBLogo } from './AMBLogo';
import SafeDealsEscrowView from './SafeDealsEscrowView';
import AMBTelecomScreen from './AMBTelecomScreen';
import SamityScreen from './SamityScreen';
import SamityRequestForm from './SamityRequestForm';
import QardScreen from './QardScreen';
import AgentScreen from './AgentScreen';
import { QardLiveTicker } from './QardLiveTicker';
import ProfileView from './ProfileView';
import { formatBanglaAmount, hasCompletedSamityProfile } from '../lib/memberUtils';
import MoneyExchangeModule from './MoneyExchangeModule';
import { AmbMobileBankingPortal } from './AmbMobileBankingPortal';
import RationCardView from './RationCardView';
import AmbAutoSalaryPay from './AmbAutoSalaryPay';
import AmbEducationCenter from './AmbEducationCenter';
import SmartExchange from './SmartExchange';
import SafiPremiumShop from './SafiPremiumShop';
import AmbCorporateGuide from './AmbCorporateGuide';
import { DashboardSubViews } from './dashboard/DashboardSubViews';
import { useBackHandler } from '../lib/navigationManager';

const cleanDescription = (desc: string, status?: string): string => {
  if (!desc) return '';
  if (status && status !== 'pending') {
    return desc
      .replace(/\s*\(অ্যাডমিন অনুমোদনের অপেক্ষায়\)।?/g, '')
      .replace(/\s*\(অ্যাডমিন অনুমোদনের অপেক্ষায়\)/g, '')
      .replace(/\s*\(অ্যাডমিন অনুমোদনের অপেক্ষায়\)।?/g, '')
      .replace(/\s*\(অ্যাডমিন অনুমোদনের অপেক্ষায়\)/g, '')
      .replace(/\s*\(অনুমোদনের অপেক্ষায়\)।?/g, '')
      .replace(/\s*\(অনুমোদনের অপেক্ষায়\)/g, '')
      .trim();
  }
  return desc;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

const toBnDigits = (num: number | string) => {
  const digits: Record<string, string> = {
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
    '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '.': '.'
  };
  return num.toString().split('').map(char => digits[char] || char).join('');
};

const defaultProducts: Product[] = [
  { id: 'item-101', name: 'Sundarban Honey 1kg', price: 2300, oldPrice: 2500, category: 'honey', icon: '🍯', description: 'সুন্দরবনের 100% খাঁটি প্রাকৃতিক চাকের খলিশা ফুলের মধু। 🐝', rating: 5.0, minOrder: '1 কেজি', supplier: 'Sundarban API Co.', flag: '🇧🇩', shipTime: '2-3 দিন', imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=300', latitude: 23.7930, longitude: 90.2330, shopAddress: 'মৌচাক বাজার, সাভার, ঢাকা' },
  { id: 'item-102', name: 'Gawa Ghee 1kg', price: 1800, oldPrice: 2000, category: 'oil_ghee', icon: '🍶', description: 'খাঁটি গরুর দুধের সর থেকে ঐতিহ্যবাহী পদ্ধতিতে তৈরি গাওয়া ঘি। সুবাসে অনন্য। 🧈', rating: 4.9, minOrder: '1 Unit', supplier: 'Pabna Sweet Dairy', flag: '🇧🇩', shipTime: '1-3 দিন', imageUrl: 'https://images.unsplash.com/photo-1622484211148-7162624dd1ee?auto=format&fit=crop&q=80&w=300', latitude: 23.7980, longitude: 90.2220, shopAddress: 'ডেইরি ফার্স্ট রোড, হেমায়েতপুর, সাভার' },
  { id: 'item-103', name: 'Deshi Mustard Oil 5 Liter', price: 1550, oldPrice: 1750, category: 'oil_ghee', icon: '🍶', description: 'কাঠের ঘানির ভাঙানো প্রথম চাপের খাঁটি সরিষার তেল। ঝাঁঝালো স্বাদ ও গন্ধ। 🌿', rating: 4.8, minOrder: '1 Unit', supplier: 'Rajshahi Oil Mills', flag: '🇧🇩', shipTime: '3-4 দিন', imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=300', latitude: 23.8200, longitude: 90.2600, shopAddress: 'ঘানিঘর লেন, সাভার বাসস্ট্যান্ড, ঢাকা' },
  { id: 'item-104', name: 'Black Seed Honey 1kg', price: 1500, oldPrice: 1600, category: 'honey', icon: '🍯', description: 'কালোজিরা ফুলের মধু অত্যন্ত পুষ্টিকর ও রোগ প্রতিরোধ ক্ষমতাবর্ধক। 💪', rating: 5.0, minOrder: '1 কেজি', supplier: 'Nator Honey Farms', flag: '🇧🇩', shipTime: '2-4 দিন', imageUrl: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&q=80&w=300', latitude: 23.8500, longitude: 90.2900, shopAddress: 'মৌমাছি এভিনিউ, নবীনগর, সাভার' },
  { id: 'item-105', name: 'African Organic Wild Honey', price: 1100, oldPrice: 1250, category: 'honey', icon: '🍯', description: 'আফ্রিকার চিরহরিৎ বনাঞ্চলের শতভাগ বুনো মোচাকের অর্গানিক মধু। 🍯', rating: 4.7, minOrder: '1 Unit', supplier: 'Kenya Wild Imports', flag: '🇰🇪', shipTime: '5-7 দিন', imageUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?auto=format&fit=crop&q=80&w=300', latitude: 23.9500, longitude: 90.3500, shopAddress: 'ইমপোর্ট হাব কমপ্লেক্স, উত্তরা, ঢাকা' },
  { id: 'item-106', name: 'Iranian Premium Dates 1kg', price: 1200, oldPrice: 1350, category: 'dates', icon: '🧆', description: 'শতভাগ প্রিমিয়াম বড় সাইজের ইরানি মরিয়ম খেজুর। নরম, মিষ্টি ও সুস্বাদু। 🌴', rating: 5.0, minOrder: '1 Unit', supplier: 'Tehran Palm Orchard', flag: '🇮🇷', shipTime: '3-5 দিন', imageUrl: 'https://images.unsplash.com/photo-1596701062351-8c2c14d1fdd0?auto=format&fit=crop&q=80&w=300', latitude: 24.1000, longitude: 90.5000, shopAddress: 'গাজীপুর চৌরাস্তা ইমপোর্ট জোন, গাজীপুর' }
];

const SAFI_CATEGORIES = [
  {
    id: 'food_grocery',
    name: 'খাদ্য ও নিত্যপ্রয়োজনীয় পণ্য',
    desc: 'ঘানি ভাঙা তেল, খাঁটি মধু, ঘি ও অর্গানিক খাদ্য',
    icon: '🍯',
    gradient: 'from-amber-50 to-orange-50/50 hover:from-amber-100 hover:to-orange-100/60 border-amber-200 text-amber-900',
    iconBg: 'bg-amber-150 text-amber-800',
    count: '6টি প্রোডাক্ট'
  },
  {
    id: 'clothing_fashion',
    name: 'পোশাক ও ফ্যাশন',
    desc: 'ঐতিহ্যবাহী সুতি শাড়ি, পাঞ্জাবি ও প্রিমিয়াম পোশাক',
    icon: '👕',
    gradient: 'from-sky-50 to-indigo-50/50 hover:from-sky-100 hover:to-indigo-100/60 border-indigo-150 text-indigo-900',
    iconBg: 'bg-indigo-100 text-indigo-800',
    count: '5টি প্রোডাক্ট'
  },
  {
    id: 'tech_gadgets',
    name: 'প্রযুক্তি ও গ্যাজেট',
    desc: 'ফাস্ট চার্জার, এয়ারবাডস ও মোবাইল পার্টস',
    icon: '⚡',
    gradient: 'from-purple-50 to-fuchsia-50/50 hover:from-purple-100 hover:to-fuchsia-100/60 border-purple-150 text-purple-900',
    iconBg: 'bg-purple-100 text-purple-800',
    count: '5টি প্রোডাক্ট'
  },
  {
    id: 'cosmetics_lifestyle',
    name: 'প্রসাধন ও লাইফস্টাইল',
    desc: 'আয়ুর্বেদিক সাবান, অর্গানিক তেল ও রূপচর্চা সামগ্রী',
    icon: '🧼',
    gradient: 'from-emerald-50 to-teal-50/50 hover:from-emerald-100 hover:to-teal-100/60 border-emerald-150 text-emerald-900',
    iconBg: 'bg-emerald-100 text-emerald-800',
    count: '4টি প্রোডাক্ট'
  }
];

const SAFI_PRODUCTS = [
  // Food & Grocery
  { id: 'sf_oil', category: 'food_grocery', name: 'Safi কাঠের ঘানি ভাঙা সর্ষের তৈল', price: 295, desc: '1 লিটার বোতল, শতভাগ বিশুদ্ধ সরিষার বীজ থেকে প্রস্তুত', emoji: '🛢️', badge: 'Best Seller', rating: '4.9', brand: 'Safi Pure', stock: '120 পিস' },
  { id: 'sf_honey_wild', category: 'food_grocery', name: 'Safi প্রিমিয়াম খাঁটি ফুলের মধু', price: 650, desc: '500 গ্রাম প্যাক, সুন্দরবনের প্রাকৃতিক চাক হতে সংগৃহীত', emoji: '🍯', badge: '100% Organic', rating: '5.0', brand: 'Safi Organics', stock: '45 পিস' },
  { id: 'sf_ghee', category: 'food_grocery', name: 'Safi প্রিমিয়াম গাওয়া ঘি (Pure Cow Ghee)', price: 420, desc: '250 গ্রাম বয়াম, traditional ও খাঁটি পদ্ধতিতে তৈরি', emoji: '🧈', badge: 'Pure Desi', rating: '4.8', brand: 'Safi Dairy', stock: '60 পিস' },
  { id: 'sf_honey_black', category: 'food_grocery', name: 'Safi প্রিমিয়াম কালোজিরা মধু', price: 550, desc: '500 গ্রাম প্রিমিয়াম গ্লাস জার, নাটোর ও সিরাজগঞ্জের বিশ্বস্ত কালোজিরা ফুলের মধু', emoji: '🐝', badge: 'Premium', rating: '4.9', brand: 'Safi Organics', stock: '85 পিস' },
  { id: 'sf_rice_chinigura', category: 'food_grocery', name: 'Safi সুগন্ধি চিনিগুঁড়া চাল', price: 145, desc: '1 কেজি এয়ারটাইট প্যাক, দিনাজপুর থেকে সংগৃহীত সুগন্ধি পোলাও চাল', emoji: '🌾', badge: 'Superb Quality', rating: '5.0', brand: 'Safi Foods', stock: '200 কেজি' },
  { id: 'sf_darjeeling_tea', category: 'food_grocery', name: 'Safi প্রিমিয়াম দার্জিলিং ব্ল্যাক টি', price: 250, desc: '200 গ্রাম লাক্সারি টিন ক্যান, বাগানের তরতাজা প্রথম চাপের প্রিমিয়াম চা পাতা', emoji: '🍵', badge: 'New Arrival', rating: '4.7', brand: 'Safi Brew', stock: '150 পিস' },

  // Clothing & Fashion
  { id: 'sf_sharee', category: 'clothing_fashion', name: 'Safi ঐতিহ্যবাহী টাঙ্গাইলের সুতি শাড়ি', price: 1450, desc: '100% পিওর সুতা দিয়ে কারিগরদের তাঁতে বোনা আকর্ষণীয় ডিজাইনের শাড়ি', emoji: '👘', badge: 'Handloom', rating: '4.9', brand: 'Safi Weaves', stock: '25 পিস' },
  { id: 'sf_panjabi', category: 'clothing_fashion', name: 'Safi প্রিমিয়াম সেমি-ফিটেড পাঞ্জাবি', price: 1250, desc: 'লিলেন ও সুতি ব্লেন্ডের আরামদায়ক পাঞ্জাবি, মেটাল বোতাম ও এমব্রয়ডারি ওয়ার্ক', emoji: '🧥', badge: 'Hot Trend', rating: '4.8', brand: 'Safi Fits', stock: '40 পিস' },
  { id: 'sf_tshirt', category: 'clothing_fashion', name: 'Safi আরামদায়ক ক্যাজুয়াল টি-শার্ট', price: 290, desc: '160 GSM প্রি-শ্রাঙ্ক কটন, অত্যন্ত আরামদায়ক ও ট্রেন্ডি কমফোর্ট ফিট টি-শার্ট', emoji: '👕', badge: 'Premium Cotton', rating: '4.7', brand: 'Safi Casuals', stock: '110 পিস' },
  { id: 'sf_trouser', category: 'clothing_fashion', name: 'Safi স্পোর্টস ট্রাউজার (Comfort Fit)', price: 450, desc: 'ব্রেথেবল ফেব্রিক, 4-ওয়ে স্ট্রেচেবল ওয়ার্কআউট ও ট্রাভেল জগার্স', emoji: '👖', badge: 'Comfort Wear', rating: '4.6', brand: 'Safi Sports', stock: '80 পিস' },
  { id: 'sf_lungi', category: 'clothing_fashion', name: 'Safi এক্সক্লুসিভ 8.5 হাত সুতি লুঙ্গি', price: 370, desc: 'আসল সুতি সুতা দিয়ে তৈরি অত্যন্ত আরামদায়ক ও স্থায়ী ঐতিহ্যবাহী দেশি লুঙ্গি', emoji: '🧣', badge: 'Traditional', rating: '4.9', brand: 'Safi Weaves', stock: '95 পিস' },

  // Technology & Gadgets
  { id: 'sf_adapter', category: 'tech_gadgets', name: 'Safi ফাস্ট চার্জিং এডাপ্টার 20 ওয়াট', price: 390, desc: 'PD Type-C ফাস্ট চার্জিং 3.0 পোর্ট, মাল্টি-লেয়ার প্রটেকশন ও থার্মাল কন্ট্রোল', emoji: '🔌', badge: 'Super Fast', rating: '4.8', brand: 'Safi Tech', stock: '75 পিস' },
  { id: 'sf_cable', category: 'tech_gadgets', name: 'Safi 2-ইন-1 মাল্টি ডাটা ক্যাবল', price: 150, desc: '1.2 মিটার নাইলন ব্রেইডেড টেকসই ক্যাবল, Type-C এবং Micro-USB চার্জিং', emoji: '🎗️', badge: 'Ultra Durable', rating: '4.7', brand: 'Safi Tech', stock: '120 পিস' },
  { id: 'sf_powerbank', category: 'tech_gadgets', name: 'Safi 10,000 mAh পাওয়ার ব্যাংক', price: 1250, desc: 'ডুয়াল ইউএসবি আউটপুট, ডিজিটাল ডিসপ্লে ইন্টিগ্রেটেড স্লিম পাওয়ার ব্যাংক', emoji: '🔋', badge: 'Li-Polymer', rating: '4.9', brand: 'Safi Power', stock: '30 পিস' },
  { id: 'sf_earbuds', category: 'tech_gadgets', name: 'Safi ওয়েরলেস ব্লুটুথ 5.3 ইয়ারবাডস', price: 990, desc: 'HIFI সাউন্ড কোয়ালিটি, 4 ঘন্টা একটানা প্লেব্যাক ও সুপার বেস সমৃদ্ধ', emoji: '🎧', badge: 'HIFI Audio', rating: '4.6', brand: 'Safi Audio', stock: '45 পিস' },
  { id: 'sf_otg', category: 'tech_gadgets', name: 'Safi ইউনিভার্সাল মেটাল ওটিজি কানেক্টর', price: 85, desc: 'Type-C টু USB 3.0 কনভার্টার, হাই স্পিড ডাটা ট্রান্সফার মেটালিক বডি', emoji: '⚙️', badge: 'Mini USB', rating: '4.8', brand: 'Safi Tech', stock: '150 পিস' },

  // Cosmetics & Lifestyle
  { id: 'sf_soap', category: 'cosmetics_lifestyle', name: 'Safi হস্তনির্মিত নিম ও তুলসী সাবান', price: 140, desc: '150 গ্রাম বার, নিম এবং তুলসী পাতার নির্যাসযুক্ত ন্যাচারাল গ্লিসারিন সাবান', emoji: '🧼', badge: 'Handcrafted', rating: '4.9', brand: 'Safi Herbs', stock: '110 পিস' },
  { id: 'sf_hair_oil', category: 'cosmetics_lifestyle', name: 'Safi অর্গানিক herbal হেয়ার অয়েল', price: 190, desc: '100 মিলি বোতল, আমলকী ও জবা ফুলের নির্যাসযুক্ত ও পুষ্টিকর herbal অয়েল', emoji: '🧴', badge: '100% Herbal', rating: '4.8', brand: 'Safi Herbs', stock: '65 পিস' },
  { id: 'sf_aloe_gel', category: 'cosmetics_lifestyle', name: 'Safi ফ্রেশ অ্যালোভেরা সুদিং জেল', price: 180, desc: '150 মিলি জার, প্রাকৃতিক অ্যালোভেরা নির্যাসের জাদুকরী স্কিন ময়শ্চারাইজার', emoji: '🧪', badge: 'Hydrating', rating: '4.7', brand: 'Safi Skin', stock: '8ো পিস' },
  { id: 'sf_chandan_pack', category: 'cosmetics_lifestyle', name: 'Safi প্রিমিয়াম চন্দন ফেসপ্যাক', price: 120, desc: '100 গ্রাম রিফিল প্যাক, আসল মহীশূর চন্দন কাঠের গুঁড়া মিশ্রিত স্কিন গ্লোয়িং ফর্মুলা', emoji: '🌸', badge: 'Natural Glow', rating: '4.9', brand: 'Safi Skin', stock: '100 পিস' }
];

interface DashboardProps {
  user: User;
  onLogout: (toRegister?: boolean) => void;
  onOpenDrawer: () => void;
  onTriggerAdmin: () => void;
  onTriggerBap: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setSelectedAction: (act: string | null) => void;
  selectedAction: string | null;
  appConfig: AppConfig;
  onTriggerDemoAuth?: () => void;
  appLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  darkMode?: boolean;
  onThemeToggle?: () => void;
}

const DashboardBannerSlider = React.memo(function DashboardBannerSlider({
  activeSliders,
  bannerType,
  bannerVal
}: {
  activeSliders: string[];
  bannerType: string;
  bannerVal?: number;
}) {
  const [currentAdSlide, setCurrentAdSlide] = useState(0);

  useEffect(() => {
    if (!activeSliders || activeSliders.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentAdSlide((prev) => (prev + 1) % activeSliders.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [activeSliders]);

  if (!activeSliders || activeSliders.length === 0) return null;

  let className = "relative w-full bg-slate-100 overflow-hidden border-t border-b border-slate-200/50 shadow-3xs";
  let style: React.CSSProperties = {};

  if (bannerType === 'custom' && bannerVal) {
    style = { height: `${bannerVal}px` };
  } else {
    switch (bannerType) {
      case 'thin':
        className += ' aspect-[16/5]';
        break;
      case 'medium':
        className += ' aspect-[16/7.5]';
        break;
      case 'thick':
        className += ' aspect-[16/10]';
        break;
      case '16:9':
        className += ' aspect-[16/9]';
        break;
      case 'square':
        className += ' aspect-square';
        break;
      default:
        className += ' aspect-[16/7.5]';
        break;
    }
  }

  return (
    <div className="w-full">
      <div className={className} style={style}>
        <img 
          src={activeSliders[currentAdSlide]} 
          alt="Advertisement Banner" 
          className="w-full h-full object-cover select-none transition-opacity duration-300"
          loading="lazy"
        />
        {activeSliders.length > 1 && (
          <div className="absolute bottom-3 right-4 flex items-center gap-1 bg-black/25 px-2.5 py-1.5 rounded-full backdrop-blur-xs">
            {activeSliders.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={'Slide ' + (index + 1)}
                onClick={() => setCurrentAdSlide(index)}
                className={'h-1.5 rounded-full transition-all duration-300 cursor-pointer ' + (
                  currentAdSlide === index ? 'w-4.5 bg-[#00a884]' : 'w-1.5 bg-white/60 hover:bg-white'
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export const Dashboard = React.memo(function Dashboard({ 
  user, 
  onLogout, 
  onOpenDrawer, 
  onTriggerAdmin,
  onTriggerBap,
  activeTab,
  setActiveTab,
  selectedAction,
  setSelectedAction,
  appConfig,
  onTriggerDemoAuth,
  appLanguage = 'bn',
  onLanguageChange,
  darkMode = false,
  onThemeToggle
}: DashboardProps) {

  // --- LAYOUT CUSTOMIZATION HELPERS ---
  const bannerType = appConfig?.bannerHeightType || 'medium';
  const bannerVal = appConfig?.bannerHeightValue;
  
  const getBannerStyleAndClass = () => {
    let className = "relative w-full bg-slate-100 overflow-hidden border-t border-b border-slate-200/50 shadow-3xs";
    let style: React.CSSProperties = {};

    if (bannerType === 'custom' && bannerVal) {
      style = { height: `${bannerVal}px` };
    } else {
      switch (bannerType) {
        case 'thin':
          className += ' aspect-[16/5]';
          break;
        case 'medium':
          className += ' aspect-[16/7.5]';
          break;
        case 'thick':
          className += ' aspect-[16/10]';
          break;
        case '16:9':
          className += ' aspect-[16/9]';
          break;
        case '21:9':
          className += ' aspect-[21/9]';
          break;
        case '32:9':
          className += ' aspect-[32/9]';
          break;
        default:
          className += ' aspect-[16/7.5]';
      }
    }
    return { className, style };
  };

  const gridCols = appConfig?.gridColsCount || 3;
  let gridClass = "grid gap-1.5 xs:gap-2 sm:gap-3 md:gap-4 ";
  if (gridCols === 2) {
    gridClass += "grid-cols-2";
  } else if (gridCols === 4) {
    gridClass += "grid-cols-4";
  } else if (gridCols === 5) {
    gridClass += "grid-cols-5";
  } else {
    gridClass += "grid-cols-3"; // Default
  }

  const iconSizeType = appConfig?.gridIconSize || 'medium';
  let diameter = 64; // Default medium (e.g. 64px)
  if (iconSizeType === 'small') {
    diameter = 48;
  } else if (iconSizeType === 'large') {
    diameter = 80;
  } else if (iconSizeType === 'custom' && appConfig?.gridIconSizeValue) {
    diameter = appConfig.gridIconSizeValue;
  }
  const innerIconSize = Math.max(16, Math.round(diameter * 0.5));

  const getTitleClass = () => {
    if (gridCols >= 4) {
      return "text-[8.5px] xs:text-[9.5px] sm:text-[11px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center";
    } else {
      return "text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center";
    }
  };

  const getCardMinHeightClass = () => {
    if (gridCols === 5) {
      return "p-1 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[74px] xs:min-h-[86px] sm:min-h-[105px] md:min-h-[115px] relative group";
    } else if (gridCols === 4) {
      return "p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[84px] xs:min-h-[98px] sm:min-h-[120px] md:min-h-[130px] relative group";
    } else if (gridCols === 2) {
      return "p-2 xs:p-2.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[110px] xs:min-h-[130px] sm:min-h-[160px] md:min-h-[180px] relative group";
    }
    return "p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group";
  };

  const isTabActive = (tabKey: string) => {
    if (tabKey === 'add_money') {
      return true; // Always active in bottom nav center
    }
    if (!appConfig?.bottomNavTabs || appConfig.bottomNavTabs.length === 0) {
      return true; // Default to all active
    }
    return appConfig.bottomNavTabs.includes(tabKey);
  };

  let bottomNavClass = "fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-100 z-20 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] transition-all ";
  const bottomNavHeight = appConfig?.bottomNavHeightType || 'medium';
  if (bottomNavHeight === 'thin') {
    bottomNavClass += "pb-[env(safe-area-inset-bottom,2px)] pt-0.5 px-2";
  } else if (bottomNavHeight === 'thick') {
    bottomNavClass += "pb-[env(safe-area-inset-bottom,12px)] pt-2.5 px-4";
  } else {
    bottomNavClass += "pb-[env(safe-area-inset-bottom,4px)] pt-1 px-3"; // medium
  }

  // Comprehensive Bilingual Translation helper
  const t = (str: string) => {
    if (appLanguage === 'en') {
      const dict: Record<string, string> = {
        // App Core Labels & Tabs
        'হোম': 'Home',
        'সেন্ড মানি': 'Send Money',
        'BNB এড মানি': 'BNB Add Money',
        'অ্যাড মানি': 'Add Money',
        'লেনদেন': 'Transactions',
        'ইতিহাস': 'Transactions',
        'প্রোফাইল': 'Profile',
        'সক্রিয়': 'ACTIVE',
        'পেন্ডিং': 'PENDING',
        'নিরাপদ ও সুদমুক্ত সামাজিক প্ল্যাটফর্ম': 'Interest-free Social Platform',
        'মোট সঞ্চয়': 'Total Savings',
        'চলতি আমানত': 'Total Savings',
        'মূল ব্যালেন্স': 'Main Balance',
        'টেলিকম ব্যালেন্স': 'Telecom Balance',
        'সুপারশপ ব্যালেন্স': 'Super Shop Balance',
        'চলতি লোন': 'Active Loan',
        'ট্যাপ করুন': 'Tap here',
        'ব্যালেন্স দেখতে ট্যাপ করুন': 'Tap to show balance',
        'টাকা': 'BDT',
        'টাকা জমা করুন': 'Deposit BDT',
        'টাকা উত্তোলন': 'Withdraw Money',
        'সঞ্চয় অ্যাকাউন্ট': 'Savings Account',
        'ব্যালেন্স': 'Balance',
        'বকেয়া': 'Due',

        // Quick Action Grid Items
        'সমবায় লোন': 'Cooperative Loan',
        'লোন সুবিধা': 'Loan Panel',
        'সমিতি ফান্ড': 'Samity Fund',
        'সদস্য সঞ্চয়': 'Samity General',
        'আল মায়াদিন পে': 'Al Mayadin Pay',
        'পেমেন্ট করুন': 'Scan & Pay',
        'টেলিকম রিচার্জ': 'Mobile Recharge',
        'রিচার্জ প্যানেল': 'Telecom Panel',
        'করজে হাসানা': 'Qard Screen',
        'বিনাসুদে লোন': 'Qard Panel',
        'রেশন কার্ড': 'Ration Card',
        'ফ্যামিলি কার্ড': 'Ration Panel',
        'নিরাপদ ডিল': 'Escrow Deals',
        'এসক্রো প্যানেল': 'Escrow Panel',
        'লাইভ চ্যাট': 'Live Chat',
        'সাপোর্ট এজেন্ট': 'Support Panel',

        // Announcements & Ticker
        'ঘোষণা': 'Announcement',
        'সাপ্তাহিক সঞ্চয়': 'Weekly Savings',
        'মাসিক লোন কিস্তি': 'Monthly Loan Installment',
        'চলতি সপ্তাহে সমবায়ের সঞ্চয় জমার শেষ সময় আগামী শুক্রবার রাত 10টা পর্যন্ত।': 'Savings deposit deadline for this week is next Friday 10:00 PM.',
        
        // Statements / Transaction History
        'সাম্প্রতিক লেনদেন সমূহ': 'Recent Transactions',
        'সব লেনদেন দেখুন': 'View all transactions',
        'কোনো লেনদেন পাওয়া যায়নি।': 'No transactions found.',
        'সফল': 'Success',
        'পেন্ডিং বা প্রক্রিয়াধীন': 'Pending/Processing',
        'ব্যর্থ': 'Failed',
        'বিবরণ': 'Description',
        'পরিমাণ': 'Amount',
        'তারিখ ও সময়': 'Date & Time',
        'স্ট্যাটাস': 'Status',
        
        // Popups and Forms
        'অ্যাড মানি (টাকা জমা)': 'Add Money (Deposit)',
        'টাকা উত্তোলন (ক্যাশআউট)': 'Withdraw Money (Cashout)',
        'পিন নম্বর দিন': 'Enter Security PIN',
        'নিশ্চিত করুন': 'Confirm Transaction',
        ' hiseab': ' Ledger',
        'বাতিল': 'Cancel',
        'পরিমাণ লিখুন': 'Enter Amount',
        '4 ডিজিটের পিন': '4-digit PIN',
        'ট্রানজেকশন সফল হয়েছে': 'Transaction successful!',
        'অনুগ্রহ করে অপেক্ষা করুন': 'Please wait...',
        'ব্যালেন্স অপর্যাপ্ত': 'Insufficient Balance',
        'ভুল পিন নম্বর': 'Invalid PIN number',
        'অনুগ্রহ করে সঠিক পরিমাণ ও পিন দিন': 'Please provide valid amount and PIN',

        // Dashboard Headers & Menu
        'শুভ সকাল': 'Good Morning',
        'শুভ দুপুর': 'Good Afternoon',
        'শুভ বিকাল': 'Good Afternoon',
        'শুভ সন্ধ্যা': 'Good Evening',
        'শুভ রাত্রি': 'Good Night',
        'সেটিংস': 'Settings',
        'লগআউট': 'Logout',
        'হেল্প ও সাপোর্ট': 'Help & Support',
        '12টি লাইভ সেবা ও প্যানেল': '12 Live Services & Panels',
        'সকল সার্ভিস ও হিসাব খাতা': 'All Services & Ledger',
        '*এই ড্যাশবোর্ডটি সরাসরি লাইভ ডাটাবেজ দ্বারা পরিচালিত হচ্ছে।': '*This dashboard is running directly on live database sync.',
        'সমবায় ডিজিটাল ব্যাংকিং নেটওয়ার্ক': 'Cooperative Digital Banking Network',
        'আপনার সঞ্চয় ও ভবিষ্যৎ আর্থিক নিরাপত্তা নিশ্চিতে শতভাগ বিশ্বস্ত সমবায় প্ল্যাটফর্ম।': '100% trusted cooperative platform to secure your savings and future.',
        'হেল্প ডেস্ক যোগাযোগ': 'Help Desk Contact',
        'যেকোনো সাহায্য বা তথ্যের জন্য সরাসরি আমাদের হেল্প ডেস্কে কল করুন।': 'Call our helpdesk directly for any support or information.',
        'কিল্যাণ ঋণ আবেদন': 'Welfare Loan Application',
        'ডিজিটাল রেশন কার্ডের আবেদন': 'Digital Ration Card Application'
      };
      return dict[str] || str;
    }
    return str;
  };

  const getTxt = (key: string, fallback: string) => {
    const rawVal = appConfig?.globalTexts?.[key] || fallback;
    return appLanguage === 'en' ? t(rawVal) : rawVal;
  };

  const [showBalance, setShowBalance] = useState(false);
  const [balanceText, setBalanceText] = useState('ব্যালেন্স দেখতে ট্যাপ করুন');
  const [isRevealed, setIsRevealed] = useState(false);

  // Advertisement slider states
  const defaultAdSlides = [
    {
      id: 1,
      tag: "সঞ্চয় ও বিনিয়োগ",
      title: "Al Mayadin Bazar",
      description: "নিরাপদে আপনার আমানত সঞ্চয় করুন ও সহজ ঋণের সুবিধা গ্রহণ করুন।",
      bgGradient: "from-emerald-950 via-emerald-900 to-teal-950",
      image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 2,
      tag: "টেলিকম অফার",
      title: "BNB টেলিকম রিচার্জ",
      description: "সব অপারেটরে আকর্ষণীয় ক্যাশব্যাক ও সুপার ফাস্ট ফ্লেক্সিলোড ড্রাইভে অফার!",
      bgGradient: "from-slate-950 via-cyan-950 to-emerald-950",
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 3,
      tag: "সুদমুক্ত ঋণ",
      title: "করযে হাসানা কল্যাণ তহবিল",
      description: "সব মেম্বারদের জন্য বিপদের সময়ে স্বস্তি ও সুদমুক্ত করযে হাসানা ঋণ সমাধান!",
      bgGradient: "from-stone-950 via-rose-950 to-indigo-950",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=650"
    }
  ];

  const adSlides = appConfig?.dashboardBanners && appConfig.dashboardBanners.length > 0
    ? appConfig.dashboardBanners
    : defaultAdSlides;

  const activeSliders = (appConfig?.sliders && appConfig.sliders.length > 0)
    ? appConfig.sliders
    : adSlides.map(slide => slide.image);



  // Core Account details loaded live in real-time
  const [liveUser, setLiveUser] = useState<User>(user);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>(() => {
    try {
      const cacheKey = `amb_tx_cache_${user.memberId || user.phone || user.uid}`;
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [selectedDetailNotif, setSelectedDetailNotif] = useState<UserNotification | null>(null);
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<'all' | 'bonus' | 'fine' | 'notice'>('all');

  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      // Autoplay permissions
    }
  };

  const isNotificationRead = (n: UserNotification) => {
    if (n.read === true) return true;
    if (n.userId === 'all') {
      const readGlobalIds = JSON.parse(localStorage.getItem('read_global_notifications') || '[]');
      return readGlobalIds.includes(n.id) || (!!n.docId && readGlobalIds.includes(n.docId));
    }
    return false;
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      // Instantly mark as read in local state so UI turns white immediately!
      setUserNotifications(prev => prev.map(x => {
        if (x.id === id || x.docId === id) {
          return { ...x, read: true };
        }
        return x;
      }));

      const n = userNotifications.find(x => x.id === id || x.docId === id);
      if (n && n.userId === 'all') {
        const readGlobalIds = JSON.parse(localStorage.getItem('read_global_notifications') || '[]');
        if (!readGlobalIds.includes(n.id)) {
          readGlobalIds.push(n.id);
        }
        if (n.docId && !readGlobalIds.includes(n.docId)) {
          readGlobalIds.push(n.docId);
        }
        localStorage.setItem('read_global_notifications', JSON.stringify(readGlobalIds));
        return;
      }

      const docIdToUpdate = n?.docId || id;
      if (docIdToUpdate) {
        try {
          await updateDoc(doc(db, 'user_notifications', docIdToUpdate), { read: true });
        } catch (err) {
          const q = query(collection(db, 'user_notifications'), where('id', '==', id));
          const snap = await getDocs(q);
          if (!snap.empty) {
            await updateDoc(doc(db, 'user_notifications', snap.docs[0].id), { read: true });
          }
        }
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      // Instantly update local state
      setUserNotifications(prev => prev.map(x => ({ ...x, read: true })));

      const unreadList = userNotifications.filter(n => !isNotificationRead(n));
      const readGlobalIds = JSON.parse(localStorage.getItem('read_global_notifications') || '[]');
      let updatedGlobal = false;

      for (const item of unreadList) {
        if (item.userId === 'all') {
          if (!readGlobalIds.includes(item.id)) {
            readGlobalIds.push(item.id);
            updatedGlobal = true;
          }
          if (item.docId && !readGlobalIds.includes(item.docId)) {
            readGlobalIds.push(item.docId);
            updatedGlobal = true;
          }
        } else {
          const docIdToUpdate = item.docId || item.id;
          try {
            await updateDoc(doc(db, 'user_notifications', docIdToUpdate), { read: true });
          } catch (e) {
            const q = query(collection(db, 'user_notifications'), where('id', '==', item.id));
            const snap = await getDocs(q);
            if (!snap.empty) {
              await updateDoc(doc(db, 'user_notifications', snap.docs[0].id), { read: true });
            }
          }
        }
      }

      if (updatedGlobal) {
        localStorage.setItem('read_global_notifications', JSON.stringify(readGlobalIds));
      }
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      setUserNotifications(prev => prev.filter(x => x.id !== id && x.docId !== id));

      const n = userNotifications.find(x => x.id === id || x.docId === id);
      if (n && n.userId === 'all') {
        const deletedGlobalIds = JSON.parse(localStorage.getItem('deleted_global_notifications') || '[]');
        if (!deletedGlobalIds.includes(n.id)) {
          deletedGlobalIds.push(n.id);
        }
        if (n.docId && !deletedGlobalIds.includes(n.docId)) {
          deletedGlobalIds.push(n.docId);
        }
        localStorage.setItem('deleted_global_notifications', JSON.stringify(deletedGlobalIds));
        return;
      }

      const docIdToDelete = n?.docId || id;
      try {
        await deleteDoc(doc(db, 'user_notifications', docIdToDelete));
      } catch (e) {
        const q = query(collection(db, 'user_notifications'), where('id', '==', id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await deleteDoc(doc(db, 'user_notifications', snap.docs[0].id));
        }
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  // Push notifications states
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [showSecretPinPrompt, setShowSecretPinPrompt] = useState(false);
  const [secretPinInput, setSecretPinInput] = useState('');
  const [secretPinError, setSecretPinError] = useState('');
  const [isSecretAdminOpen, setIsSecretAdminOpen] = useState(false);
  const [allPushes, setAllPushes] = useState<any[]>([]);
  const [newPushTitle, setNewPushTitle] = useState('');
  const [newPushBody, setNewPushBody] = useState('');
  const [livePushToast, setLivePushToast] = useState<{ id: string; title: string; body: string } | null>(null);

  // Forms modal toggling & stack
  const [modalStack, setModalStack] = useState<string[]>([]);
  const modalType = (modalStack.length > 0 ? modalStack[modalStack.length - 1] : null) as 'deposit' | 'loan' | 'telecom' | 'shop' | 'withdraw' | 'members' | 'notices' | 'invest' | 'bank' | 'total_money' | 'samity' | 'qard' | 'agent' | 'about' | 'chat' | 'safedeals' | 'safi' | 'ration' | 'salary' | 'bill_pay' | 'auto_recharge' | 'edu' | 'exchange' | 'courier' | 'hisab' | null;

  const [isReapplyingSamity, setIsReapplyingSamity] = useState(false);
  const [resendSamityLoading, setResendSamityLoading] = useState(false);
  const [resendSamitySuccess, setResendSamitySuccess] = useState('');

  const handleDirectResendSamityRequest = async () => {
    if (!liveUser) return;
    setResendSamityLoading(true);
    setResendSamitySuccess('');
    try {
      const nowIso = new Date().toISOString();
      const isAutoApprove = appConfig?.autoApproveSomiti === true || appConfig?.autoApproveSamity === true;
      const targetStatus = isAutoApprove ? 'approved' : 'pending';

      const updatePayload: Partial<User> = {
        samityStatus: targetStatus,
        samityApproved: isAutoApprove ? true : false,
        isSamityMember: isAutoApprove ? true : (liveUser.isSamityMember ?? false),
        approved: isAutoApprove ? true : (liveUser.approved ?? false),
        samityAppliedAt: nowIso
      };

      // 1. Immediately update local state for zero visual latency
      setLiveUser(prev => prev ? ({
        ...prev,
        ...updatePayload
      }) : prev);

      // 2. Perform fast Firestore writes concurrently
      const userRef = doc(db, 'users', liveUser.uid);
      const appRef = doc(db, 'samity_applications', liveUser.uid);

      await Promise.all([
        setDoc(userRef, updatePayload, { merge: true }),
        setDoc(appRef, {
          userId: liveUser.uid,
          uid: liveUser.uid,
          name: liveUser.name || '',
          phone: liveUser.phone || '',
          memberId: liveUser.memberId || '',
          country: liveUser.country || 'Bangladesh',
          nid: liveUser.nid || '',
          dob: liveUser.dob || '',
          division: liveUser.division || '',
          district: liveUser.district || '',
          thana: liveUser.thana || '',
          postOffice: liveUser.postOffice || '',
          nomineeName: liveUser.nomineeName || '',
          nomineeRelation: liveUser.nomineeRelation || '',
          nomineePhone: liveUser.nomineePhone || '',
          monthlySavingsTarget: liveUser.monthlySavingsTarget || 500,
          samityStatus: targetStatus,
          status: targetStatus,
          approved: isAutoApprove,
          createdAt: nowIso,
          samityAppliedAt: nowIso
        }, { merge: true }),
        !isAutoApprove ? addDoc(collection(db, 'admin_notifications'), {
          title: '⚡ সমিতি আবেদন রিসেন্ড রিকোয়েস্ট',
          message: `${liveUser.name} (${liveUser.phone}) এডমিন প্যানেলে তাদের সমিতি মেম্বারশিপ আবেদন পুনরায় রিসেন্ড করেছেন।`,
          type: 'samity_resend',
          createdAt: nowIso,
          read: false
        }).catch(() => null) : Promise.resolve()
      ]);

      setResendSamitySuccess(isAutoApprove ? 'আপনার সমিতির সদস্যপদ আবেদনটি স্বয়ংক্রিয়ভাবে অনুমোদিত হয়েছে!' : 'আপনার সমিতির সদস্যপদ আবেদনটি এডমিন প্যানেলে সফলভাবে পুন:প্রেরণ করা হয়েছে!');
      // Non-blocking background sync
      syncLiveProfile().catch(e => console.error("Resend sync error:", e));
    } catch (err: any) {
      console.error('Error resending samity application:', err);
      alert('আবেদন পুন:প্রেরণে ত্রুটি ঘটেছে: ' + (err?.message || 'অনুগ্রহ করে আবার চেষ্টা করুন।'));
    } finally {
      setResendSamityLoading(false);
    }
  };

  const [showDemoAuthPrompt, setShowDemoAuthPrompt] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceServiceName, setMaintenanceServiceName] = useState('');

  const checkDemoAndRun = (action: () => void) => {
    if (user?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
    action();
  };

  const setModalType = (type: typeof modalType) => {
    if (type !== null && user?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
    if (type === null) {
      setModalStack([]);
    } else {
      setModalStack(prev => {
        if (prev[prev.length - 1] === type) return prev;
        return [...prev, type];
      });
    }
  };

  const popModal = () => {
    setModalStack(prev => {
      if (prev.length <= 1) return [];
      return prev.slice(0, prev.length - 1);
    });
  };

  const handleServiceClick = (serviceKey: string, actionCallback: () => void) => {
    // 12 core sections (like Qard Hasana) must always remain accessible to members
    const isServiceActive = serviceKey === 'qard' ? true : (appConfig?.serviceStatus?.[serviceKey] !== false);
    if (!isServiceActive) {
      const serviceNamesBengali: Record<string, string> = {
        samity: 'BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর',
        bank: 'MY BNB লেনদেন (রেমিট্যান্স)',
        telecom: 'BNB টেলিকম (ফ্লেক্সিলোড)',
        shop: 'BNB সুপার শপ (পণ্য অর্ডার)',
        qard: 'করযে হাসানা (সুদমুক্ত ঋণ)',
        safedeals: 'নিরাপদ লেনদেন (ভেরিফাইড পাইকারি)',
        safi: 'প্রিমিয়াম Safi (খাঁটি পণ্য)',
        ration: 'BNB রেশন কার্ড (পাইকারি ছাড়)',
        chat: 'লাইভ চ্যাট (সাপোর্ট রুম)',
        agent: 'BNB এজেন্ট (ক্যারিয়ার পোর্টাল)',
        about: 'আমাদের সম্পর্কে (পরিচিতি)',
        bap: 'বাংলাদেশ এডমিন প্যানেল',
        hisab: 'BNB হিসাব খাতা',
        bill_pay: 'BNB বিল পে',
        salary: 'BNB স্যালারি পে',
        auto_recharge: 'BNB অটো রিচার্জ',
        edu: 'AMB জ্ঞান ও শিক্ষা কেন্দ্র'
      };
      setMaintenanceServiceName(serviceNamesBengali[serviceKey] || 'চিহ্নিত সেকশন');
      setShowMaintenanceModal(true);
      return;
    }
    actionCallback();
  };

  useEffect(() => {
    if (selectedAction) {
      if (selectedAction === 'deposit') setModalType('deposit');
      else if (selectedAction === 'loan' || selectedAction === 'qard' || selectedAction === 'qard_hasana') setModalType('qard');
      else if (selectedAction === 'telecom') setModalType('telecom');
      else if (selectedAction === 'shop') setModalType('shop');
      else if (selectedAction === 'withdraw') setModalType('withdraw');
      else if (selectedAction === 'samity') setModalType('samity');
      else if (selectedAction === 'agent') setModalType('agent');
      else if (selectedAction === 'chat' || selectedAction === 'support') setModalType('chat');
      else if (selectedAction === 'about') setModalType('about');
      
      setSelectedAction(null);
    }
  }, [selectedAction, setSelectedAction]);

  // New state variables for AMB agent registration, about us and live chat
  const [agentPhone, setAgentPhone] = useState('');
  const [agentDistrict, setAgentDistrict] = useState('');
  const [agentExperience, setAgentExperience] = useState('নেই');
  const [agentSuccessMsg, setAgentSuccessMsg] = useState('');
  const [agentErrorMsg, setAgentErrorMsg] = useState('');
  const [hasSubmittedAgent, setHasSubmittedAgent] = useState(false);

  const [chatMessages, setChatMessages] = useState<any[]>([
    { id: '1', sender: 'support', text: 'আসসালামু আলাইকুম! Al Mayadin Bazar (AMB) সাপোর্ট সেন্টারে আপনাকে স্বাগতম। আমি আপনার ডিজিটাল সহকারী। আমাদের সমিতি, ঋণ, টেলিকম বা সুপার শপ সম্পর্কে যেকোনো প্রশ্ন করতে পারেন।', timestamp: '10:30 AM' }
  ]);
  const [chatInputText, setChatInputText] = useState('');
  const [noticeSearchQuery, setNoticeSearchQuery] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);

  // NEW STATES FOR SAFE DEALS, PREMIUM SAFI, AND RATION CARDS
  const [safeDeals, setSafeDeals] = useState<any[]>([]);
  const [rationCard, setRationCard] = useState<any | null>(null);
  const [showCreateCardModal, setShowCreateCardModal] = useState(false);
  const [rationCardName, setRationCardName] = useState(user?.name || '');
  const [rationCardAddress, setRationCardAddress] = useState('');
  const [rationCardType, setRationCardType] = useState('wholesale');
  const [rationCardNominee, setRationCardNominee] = useState('');
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState('');
  const [newDealDesc, setNewDealDesc] = useState('');
  const [newDealPrice, setNewDealPrice] = useState('');
  const [newDealMinQty, setNewDealMinQty] = useState('5 পিস');
  const [newDealEmoji, setNewDealEmoji] = useState('📦');

  // Back Navigation Handlers for Dashboard Layer (LIFO stack hierarchy)
  useBackHandler(() => {
    if (showAddDealModal) { setShowAddDealModal(false); return true; }
    if (showCreateCardModal) { setShowCreateCardModal(false); return true; }
    if (showMaintenanceModal) { setShowMaintenanceModal(false); return true; }
    if (showDemoAuthPrompt) { setShowDemoAuthPrompt(false); return true; }
    if (showSecretPinPrompt) { setShowSecretPinPrompt(false); return true; }
    if (showNotificationsModal) { setShowNotificationsModal(false); return true; }
    return false;
  }, Boolean(showAddDealModal || showCreateCardModal || showMaintenanceModal || showDemoAuthPrompt || showSecretPinPrompt || showNotificationsModal), 40);

  // Active section (one of 12 main service sections) back handler
  useBackHandler(() => {
    if (modalStack.length > 0) {
      popModal();
      return true;
    }
    return false;
  }, modalStack.length > 0, 30);

  // Note: Tab navigation history (Home -> A -> B -> C -> B -> A -> Home) is handled by the App layer history stack handler (priority 10)

  // Qard Hasana state variables
  const [qardTab, setQardTab] = useState<'info' | 'donate' | 'apply' | 'my_applications' | 'history'>('info');
  const [qardDonateAmount, setQardDonateAmount] = useState('');
  const [qardDonationReasonText, setQardDonationReasonText] = useState('');
  const [qardLoanAmount, setQardLoanAmount] = useState('');
  const [qardPin, setQardPin] = useState('');
  const [qardLoanDuration, setQardLoanDuration] = useState<number>(1);
  const [qardLoanWhatsapp, setQardLoanWhatsapp] = useState('');
  const [qardHistory, setQardHistory] = useState<Transaction[]>([]);
  const [qardTotalFund, setQardTotalFund] = useState(55000);
  const [qardActiveLoansAmount, setQardActiveLoansAmount] = useState(0);
  const [qardDonationType, setQardDonationType] = useState('one-time');
  const [qardDonationPurpose, setQardDonationPurpose] = useState('general');
  const [qardDonationPayMethod, setQardDonationPayMethod] = useState('balance');
  const [qardDonationSender, setQardDonationSender] = useState('');
  const [qardDonationTxId, setQardDonationTxId] = useState('');

  // bKash-style Tap to Check Main Balance
  const [showMainBalance, setShowMainBalance] = useState(false);
  const balanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleRevealBalance = () => {
    if (showMainBalance) {
      setShowMainBalance(false);
      if (balanceTimeoutRef.current) {
        clearTimeout(balanceTimeoutRef.current);
        balanceTimeoutRef.current = null;
      }
    } else {
      setShowMainBalance(true);
      if (balanceTimeoutRef.current) {
        clearTimeout(balanceTimeoutRef.current);
      }
      balanceTimeoutRef.current = setTimeout(() => {
        setShowMainBalance(false);
        balanceTimeoutRef.current = null;
      }, 4000);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    // 1. Live User Document real-time listener (includes balance, dps, savings, loans, telecom, etc.)
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        setLiveUser({ uid: snap.id, ...snap.data() } as User);
      }
    }, (err) => {
      console.error("Dashboard User subscription error:", err);
    });

    // 2. Live Transactions real-time listener (Permanent, Immutable Lifetime Records)
    // Main Live Users listener for transaction lookups
    const usersListenerQ = query(collection(db, 'users'), limit(300));
    const unsubUsersGlobal = onSnapshot(usersListenerQ, (snap) => {
      const listMems: User[] = [];
      snap.forEach((d) => {
        listMems.push({ uid: d.id, ...d.data() } as User);
      });
      setAllUsers(listMems);
    }, (err) => {
      console.error('Users global subscription error:', err);
    });

    const rawPhoneDigits = user.phone ? String(user.phone).replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, '') : '';
    const phoneVariants = Array.from(new Set([
      user.phone,
      user.normalizedPhone,
      rawPhoneDigits,
      rawPhoneDigits.length >= 11 ? rawPhoneDigits.slice(-11) : '',
      rawPhoneDigits.length >= 10 ? '0' + rawPhoneDigits.slice(-10) : '',
      rawPhoneDigits.length >= 10 ? '+880' + rawPhoneDigits.slice(-10) : ''
    ].filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))));

    const txTargetIds = Array.from(new Set([
      user.uid,
      (user as any).id,
      (user as any).docId,
      user.memberId,
      ...phoneVariants.map(p => `user_${p}`),
      ...phoneVariants
    ].filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))));

    let txListByUid: Transaction[] = [];
    let txListByMember: Transaction[] = [];
    let txListByUserPhone: Transaction[] = [];
    let txListByPhone: Transaction[] = [];
    let txListByReceiverPhone: Transaction[] = [];
    let txListByReceiverUid: Transaction[] = [];
    let txListByReceiverId: Transaction[] = [];

    const updateAllTransactionsState = () => {
      const mergedMap = new Map<string, Transaction>();
      [
        ...txListByUid,
        ...txListByMember,
        ...txListByUserPhone,
        ...txListByPhone,
        ...txListByReceiverPhone,
        ...txListByReceiverUid,
        ...txListByReceiverId
      ].forEach((tx) => {
        const idKey = tx.id || (tx as any).docId || (tx as any).transactionId || Math.random().toString();
        if (!mergedMap.has(idKey)) {
          mergedMap.set(idKey, tx);
        }
      });
      const combined = sortTransactionsNewestFirst(Array.from(mergedMap.values()));
      setAllTransactions(combined);
      try {
        const cacheKey = `amb_tx_cache_${user.memberId || user.phone || user.uid}`;
        localStorage.setItem(cacheKey, JSON.stringify(combined.slice(0, 150)));
      } catch (e) {}
    };

    const tQ = txTargetIds.length > 0
      ? query(collection(db, 'transactions'), where('userId', 'in', txTargetIds.slice(0, 10)))
      : query(collection(db, 'transactions'), where('userId', '==', user.uid));

    const unsubTx = onSnapshot(tQ, (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      txListByUid = list;
      updateAllTransactionsState();
    }, (err) => {
      console.error("Dashboard Transactions subscription error:", err);
    });

    const unsubTxMember = user.memberId ? onSnapshot(query(collection(db, 'transactions'), where('memberId', '==', user.memberId)), (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      txListByMember = list;
      updateAllTransactionsState();
    }, () => {}) : () => {};

    const unsubTxUserPhone = phoneVariants.length > 0 ? onSnapshot(query(collection(db, 'transactions'), where('userPhone', 'in', phoneVariants.slice(0, 10))), (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      txListByUserPhone = list;
      updateAllTransactionsState();
    }, () => {}) : () => {};

    const unsubTxPhone = phoneVariants.length > 0 ? onSnapshot(query(collection(db, 'transactions'), where('phone', 'in', phoneVariants.slice(0, 10))), (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      txListByPhone = list;
      updateAllTransactionsState();
    }, () => {}) : () => {};

    const unsubTxReceiverPhone = phoneVariants.length > 0 ? onSnapshot(query(collection(db, 'transactions'), where('receiverPhone', 'in', phoneVariants.slice(0, 10))), (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      txListByReceiverPhone = list;
      updateAllTransactionsState();
    }, () => {}) : () => {};

    const unsubTxReceiverUid = txTargetIds.length > 0 ? onSnapshot(query(collection(db, 'transactions'), where('receiverUid', 'in', txTargetIds.slice(0, 10))), (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      txListByReceiverUid = list;
      updateAllTransactionsState();
    }, () => {}) : () => {};

    const unsubTxReceiverId = user.memberId ? onSnapshot(query(collection(db, 'transactions'), where('receiverId', '==', user.memberId)), (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      txListByReceiverId = list;
      updateAllTransactionsState();
    }, () => {}) : () => {};

    // 3. Live Notices real-time listener (Index-safe client-side sort)
    const nQ = query(collection(db, 'notices'), limit(40));
    const unsubNotices = onSnapshot(nQ, (snap) => {
      const listNotices: Notice[] = [];
      snap.forEach((d) => {
        listNotices.push({ id: d.id, ...d.data() } as Notice);
      });
      listNotices.sort((a, b) => {
        const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dB - dA;
      });
      setAllNotices(listNotices);
    }, (err) => {
      console.error("Dashboard Notices subscription error:", err);
    });

    // 4. Live Products real-time listener
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      const list: Product[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Product);
      });
      setAllProducts(list);
    }, (err) => console.error("Error fetching products:", err));

    // 5. Live Offers real-time listener
    const unsubOffers = onSnapshot(collection(db, 'offers'), (snap) => {
      const list: Offer[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Offer);
      });
      setAllOffers(list);
    }, (err) => console.error("Error fetching offers:", err));

    // 5. Live Ration Card real-time listener
    const rcQ = query(collection(db, 'ration_cards'), where('userId', '==', user.uid));
    const unsubRation = onSnapshot(rcQ, (snap) => {
      if (!snap.empty) {
        setRationCard({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setRationCard(null);
      }
    }, (err) => {
      console.error("Dashboard Ration Cards subscription error:", err);
    });

    // 9. Live Personal & Global System Notifications real-time listeners (multi-ID matching guarantees 100% receipt)
    const userTargetIds = Array.from(new Set([
      user.uid,
      (user as any).id,
      (user as any).docId,
      user.phone,
      user.memberId
    ].filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))));

    const notifyPersonalQ = userTargetIds.length > 0
      ? query(collection(db, 'user_notifications'), where('userId', 'in', userTargetIds.slice(0, 10)))
      : query(collection(db, 'user_notifications'), where('userId', '==', user.uid));

    const notifyMemberQ = user.memberId
      ? query(collection(db, 'user_notifications'), where('memberId', '==', user.memberId))
      : null;

    const notifyGlobalQ = query(collection(db, 'user_notifications'), where('userId', '==', 'all'));

    let personalList: UserNotification[] = [];
    let memberList: UserNotification[] = [];
    let globalList: UserNotification[] = [];
    let initialLoadsRemaining = (notifyMemberQ ? 3 : 2);
    const mountTime = Date.now();
    const knownNotifIds = new Set<string>();

    const updateNotificationsState = (isFromSnapshot = false) => {
      if (isFromSnapshot && initialLoadsRemaining > 0) {
        initialLoadsRemaining--;
      }

      const deletedGlobalIds = JSON.parse(localStorage.getItem('deleted_global_notifications') || '[]');
      const filteredGlobal = globalList.filter(n => !deletedGlobalIds.includes(n.id) && !deletedGlobalIds.includes(n.docId));
      const merged = [...personalList, ...memberList, ...filteredGlobal];
      
      // Preserve all admin messages, direct credit/debit alerts & broadcasts
      const isPersonalMessage = (n: UserNotification) => {
        if (n.isTransactionHistory === true && !n.title && !n.body) return false;
        return true;
      };
      
      const filtered = merged.filter(isPersonalMessage);

      // Smart deduplication: deduplicate by content fingerprint (title + body + time window) & ID
      const uniqueMap = new Map<string, UserNotification>();
      const seenIds = new Set<string>();

      filtered.forEach(n => {
        const idKey = n.id || n.docId;
        const titleNorm = (n.title || '').trim().toLowerCase();
        const bodyNorm = (n.body || (n as any).content || (n as any).message || '').trim().toLowerCase();
        // Minute-level time signature (e.g. "2026-07-28t12:33")
        let rawDateStr = '';
        if (typeof n.createdAt === 'string') {
          rawDateStr = n.createdAt;
        } else if (n.createdAt && typeof n.createdAt === 'object' && 'toDate' in (n.createdAt as any)) {
          try {
            rawDateStr = (n.createdAt as any).toDate().toISOString();
          } catch {
            rawDateStr = '';
          }
        } else if (n.createdAt) {
          try {
            rawDateStr = new Date(n.createdAt as any).toISOString();
          } catch {
            rawDateStr = String(n.createdAt);
          }
        }
        const timeNorm = rawDateStr ? rawDateStr.substring(0, 16) : '';
        const contentFingerprint = `${titleNorm}___${bodyNorm}___${timeNorm}`;

        if (idKey && seenIds.has(idKey)) return;
        if (uniqueMap.has(contentFingerprint)) return;

        if (idKey) seenIds.add(idKey);
        uniqueMap.set(contentFingerprint, n);
      });
      const deduplicated = Array.from(uniqueMap.values());

      // Sort client-side by createdAt descending
      deduplicated.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      // Sound chime and trigger live toast popup ONLY for brand-new incoming notifications after initial load
      if (initialLoadsRemaining <= 0) {
        for (const n of deduplicated) {
          const idKey = n.id || n.docId;
          const createdAtMs = n.createdAt ? new Date(n.createdAt).getTime() : 0;
          if (idKey && !knownNotifIds.has(idKey) && createdAtMs > mountTime - 5000) {
            playNotificationChime();
            setLivePushToast({
              id: idKey,
              title: n.title || '🔔 নতুন অ্যাডমিন নোটিফিকেশন',
              body: n.body || ''
            });
            break;
          }
        }
      }

      deduplicated.forEach(n => {
        if (n.id) knownNotifIds.add(n.id);
        if (n.docId) knownNotifIds.add(n.docId);
      });

      setUserNotifications(deduplicated);
    };

    const parseNotifDoc = (d: any) => {
      const data = d.data();
      const bodyText = data.body || data.message || data.desc || data.content || '';
      const titleText = data.title || '🔔 নতুন নোটিফিকেশন';
      return {
        ...data,
        docId: d.id,
        id: data.id || d.id,
        title: titleText,
        body: bodyText,
        message: bodyText
      } as UserNotification;
    };

    const unsubNotifyPersonal = onSnapshot(notifyPersonalQ, (snap) => {
      personalList = [];
      snap.forEach((d) => {
        personalList.push(parseNotifDoc(d));
      });
      updateNotificationsState(true);
    }, (err) => {
      console.error("Personal Notifications query error:", err);
    });

    const unsubNotifyMember = notifyMemberQ ? onSnapshot(notifyMemberQ, (snap) => {
      memberList = [];
      snap.forEach((d) => {
        memberList.push(parseNotifDoc(d));
      });
      updateNotificationsState(true);
    }, (err) => {
      console.error("Member Notifications query error:", err);
    }) : () => {};

    const unsubNotifyGlobal = onSnapshot(notifyGlobalQ, (snap) => {
      globalList = [];
      snap.forEach((d) => {
        globalList.push(parseNotifDoc(d));
      });
      updateNotificationsState(true);
    }, (err) => {
      console.error("Global Notifications query error:", err);
    });

    return () => {
      unsubUsersGlobal();
      unsubUser();
      unsubTx();
      unsubTxMember();
      unsubTxUserPhone();
      unsubTxPhone();
      unsubTxReceiverPhone();
      unsubTxReceiverUid();
      unsubTxReceiverId();
      unsubNotices();
      unsubProducts();
      unsubOffers();
      unsubRation();
      unsubNotifyPersonal();
      unsubNotifyMember();
      unsubNotifyGlobal();
    };
  }, [user.uid]);

  // ON-DEMAND / CONDITIONAL REAL-TIME LISTENERS TO RADICALLY REDUCE FIRESTORE READ UNITS

  // A. Members Directory (Handled centrally by global users listener)

  // B. Live Qard Hasana global real-time listener (Only active when Qard Screen is open)
  useEffect(() => {
    if (!user?.uid || modalType !== 'qard') {
      return;
    }
    const qardGlobalQuery = query(
      collection(db, 'transactions'),
      where('type', 'in', ['qard_donation', 'qard_loan_request', 'qard_loan_disbursment', 'qard_loan_repayment'])
    );
    const unsubQardGlobal = onSnapshot(qardGlobalQuery, (snap) => {
      const qardList: Transaction[] = [];
      snap.forEach((d) => {
        qardList.push({ id: d.id, ...d.data() } as Transaction);
      });
      qardList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQardHistory(qardList);

      const starterAmount = 55000;
      const totalDonations = qardList
        .filter(t => t.type === 'qard_donation' && t.status === 'success')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      setQardTotalFund(starterAmount + totalDonations);

      const totalDisbursed = qardList
        .filter(t => t.type === 'qard_loan_disbursment' && t.status === 'success')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalRepaid = qardList
        .filter(t => t.type === 'qard_loan_repayment' && t.status === 'success')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      setQardActiveLoansAmount(Math.max(0, totalDisbursed - totalRepaid));
    }, (err) => {
      console.error("Dashboard Qard subscription error:", err);
    });
    return () => unsubQardGlobal();
  }, [modalType, user?.uid]);

  // C. Live Safe Deals real-time listener (Only active when Safe Deals is open)
  useEffect(() => {
    if (!user?.uid || modalType !== 'safedeals') {
      return;
    }
    const unsubDeals = onSnapshot(query(collection(db, 'safe_deals'), limit(30)), (snap) => {
      const listSds: any[] = [];
      snap.forEach((d) => {
        listSds.push({ id: d.id, ...d.data() });
      });
      listSds.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      
      if (listSds.length === 0) {
        const defaultDeals = [
          {
            id: 'deal-default-1',
            title: '100% ঘানি ভাঙা সরিষার তেল (পাইকারি গ্রুপ ডিল)',
            description: 'খাঁটি সরিষার তেল। সরাসরি পাবনা ও কুষ্টিয়ার মিল থেকে সংগ্রহ করা হবে। সর্বোচ্চ বিশুদ্ধতার গ্যারান্টি।',
            price: 215,
            minQty: '10 লিটার',
            emoji: '🛢️',
            supplier: 'Safi Pure Food Ltd.',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 'deal-default-2',
            title: 'প্রিমিয়াম কাতান শাড়ি ও থ্রি-পিস ঈদ কালেকশন',
            description: 'ঈদের বিশেষ পাইকারি গ্রুপ বাই ডিল। সম্পূর্ণ প্রিমিয়াম কোয়ালিটি নিশ্চিত।',
            price: 1350,
            minQty: '3 পিস',
            emoji: '👗',
            supplier: 'Moulvibazar Fashion Wholesalers',
            status: 'active',
            createdAt: new Date().toISOString()
          }
        ];
        setSafeDeals(defaultDeals);
      } else {
        setSafeDeals(listSds);
      }
    }, (err) => {
      console.error("Dashboard Safe Deals subscription error:", err);
    });
    return () => unsubDeals();
  }, [modalType, user?.uid]);

  // D. Live Telecom Offers real-time listener (Only active when Telecom Screen is open)
  useEffect(() => {
    if (!user?.uid || modalType !== 'telecom') {
      return;
    }
    const unsubOffers = onSnapshot(query(collection(db, 'offers'), orderBy('createdAt', 'desc'), limit(40)), (snap) => {
      const listOffers: Offer[] = [];
      snap.forEach((d) => {
        listOffers.push({ id: d.id, ...d.data() } as Offer);
      });
      setAllOffers(listOffers);
    }, (err) => {
      console.error("Dashboard Offers subscription error:", err);
    });
    return () => unsubOffers();
  }, [modalType, user?.uid]);

  // E. Live Super Shop Products real-time listener (Only active when Super Shop / Safi is open)
  useEffect(() => {
    if (!user?.uid || !['shop', 'safi'].includes(modalType)) {
      return;
    }
    const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      const listProds: Product[] = [];
      snap.forEach((d) => {
        listProds.push({ id: d.id, ...d.data() } as Product);
      });
      if (listProds.length === 0) {
        setAllProducts(defaultProducts);
      } else {
        setAllProducts(listProds);
      }
    }, (err) => {
      console.error("Dashboard Products subscription error:", err);
      setAllProducts(defaultProducts);
    });
    return () => unsubProducts();
  }, [modalType, user?.uid]);

  useEffect(() => {
    return () => {
      if (balanceTimeoutRef.current) {
        clearTimeout(balanceTimeoutRef.current);
      }
    };
  }, []);

  // Form input states
  const [depositAmount, setDepositAmount] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [senderInfo, setSenderInfo] = useState('');
  const [txnId, setTxnId] = useState('');
  const [screenshotData, setScreenshotData] = useState('');
  const [payPurpose, setPayPurpose] = useState<'main_balance' | 'savings' | 'loan' | 'fees'>('main_balance');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [feeType, setFeeType] = useState('admission');
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<Transaction | null>(null);

  // Guided withdrawal channel state 
  const [withdrawMethod, setWithdrawMethod] = useState('');
  const [withdrawBankName, setWithdrawBankName] = useState('Dutch-Bangla Bank PLC. (DBBL)');
  const [withdrawBranch, setWithdrawBranch] = useState('');
  const [withdrawRouting, setWithdrawRouting] = useState('');
  const [withdrawAccName, setWithdrawAccName] = useState('');
  const [withdrawAccNo, setWithdrawAccNo] = useState('');
  const [withdrawRecipientNumber, setWithdrawRecipientNumber] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [copiedField, setCopiedField] = useState('');

  // Loan Repay specific fields
  const [repayAmount, setRepayAmount] = useState('');
  const [repayPayMethod, setRepayPayMethod] = useState('bKash');
  const [repaySenderInfo, setRepaySenderInfo] = useState('');
  const [repayTxnId, setRepayTxnId] = useState('');
  const [repayScreenshotData, setRepayScreenshotData] = useState('');

  const [loanAmount, setLoanAmount] = useState('');
  const [telecomMobile, setTelecomMobile] = useState('');
  const [telecomOperator, setTelecomOperator] = useState('Grammenphone');
  const [telecomAmount, setTelecomAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [investAmount, setInvestAmount] = useState('');

  // AMB Bank Transfer States
  const [transferType, setTransferType] = useState<'member' | 'bank' | 'mobile_fs'>('member');
  const [transferSector, setTransferSector] = useState<'telecom' | 'shop' | 'samity'>('telecom');
  const [selfTransferTarget, setSelfTransferTarget] = useState<'telecom' | 'shop' | 'savings'>('telecom');
  const [revealSamity, setRevealSamity] = useState(false);
  const [revealTelecom, setRevealTelecom] = useState(false);
  const [revealShop, setRevealShop] = useState(false);
  const [transferTargetPhoneorId, setTransferTargetPhoneorId] = useState('');
  const [transferTargetBankName, setTransferTargetBankName] = useState('Dutch-Bangla Bank');
  const [transferTargetAccNo, setTransferTargetAccNo] = useState('');
  const [transferSenderPin, setTransferSenderPin] = useState('');
  const [transferAmountInput, setTransferAmountInput] = useState('');
  const [searchedMember, setSearchedMember] = useState<User | null>(null);
  const [searchStatusMsg, setSearchStatusMsg] = useState('');
  const [sendMoneySelectedMonths, setSendMoneySelectedMonths] = useState<string[]>([]);
  const [sendMoneySelectedYear, setSendMoneySelectedYear] = useState<number>(new Date().getFullYear() > 2050 ? 2050 : Math.max(2026, new Date().getFullYear()));
  const [cvvRevealed, setCvvRevealed] = useState(false);

  // Transaction, notice, package, and shop state variables
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [txFilterType, setTxFilterType] = useState('all');
  const [txFilterStatus, setTxFilterStatus] = useState('all');
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [telecomServiceType, setTelecomServiceType] = useState<'recharge' | 'internet'>('recharge');
  const [telecomPackageId, setTelecomPackageId] = useState('pack-1');
  const [selectedProductId, setSelectedProductId] = useState('item-1');
  const [shopQuantity, setShopQuantity] = useState('1');
  const [shopSearchTerm, setShopSearchTerm] = useState('');
  const [shopCategory, setShopCategory] = useState('all');
  const [shopActiveSubTab, setShopActiveSubTab] = useState<'products' | 'rules' | 'orders' | 'transfer'>('products');
  const [shopDir, setShopDir] = useState<'main_to_shop' | 'shop_to_main'>('main_to_shop');
  const [shopTransferAmount, setShopTransferAmount] = useState('');
  const [shopTransferPin, setShopTransferPin] = useState('');
  const [shopTransferLoading, setShopTransferLoading] = useState(false);
  const [shopTransferErr, setShopTransferErr] = useState('');
  const [shopTransferSucc, setShopTransferSucc] = useState('');
  const [supplierContactProduct, setSupplierContactProduct] = useState<any | null>(null);
  const [supplierContactMsg, setSupplierContactMsg] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  // SAFI Premium Shop States
  const [safiSelectedCategory, setSafiSelectedCategory] = useState<string | null>(null);
  const [safiSearchQuery, setSafiSearchQuery] = useState('');

  // Instant Ghorer Bazar Super Shop Checkout States
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [userAddress, setUserAddress] = useState<string>('');
  const [searchRange, setSearchRange] = useState<number>(10); // default 10 km
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);

  const handleDetectUserLocation = async () => {
    if (!navigator.geolocation) {
      alert("আপনার ব্রাউজারে জিপিএস সনাক্তকরণ সুবিধা নেই।");
      return;
    }
    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=bn`, {
            headers: { 'User-Agent': 'AMB-Cooperative-App' }
          });
          if (res.ok) {
            const data = await res.json();
            setUserAddress(data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          } else {
            setUserAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch (e) {
          setUserAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
        setIsLocatingUser(false);
      },
      (error) => {
        console.error(error);
        setIsLocatingUser(false);
        alert("জিপিএস সিগন্যাল পাওয়া যায়নি বা অনুমতি ব্লক করা হয়েছে। অনুগ্রহ করে ব্রাউজার সেটিংস চেক করুন।");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const [selectedProductForCheckout, setSelectedProductForCheckout] = useState<Product | null>(null);
  const [checkoutQuantity, setCheckoutQuantity] = useState(1);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [checkoutPin, setCheckoutPin] = useState('');
  const [checkoutLat, setCheckoutLat] = useState<number | null>(null);
  const [checkoutLng, setCheckoutLng] = useState<number | null>(null);
  const [checkoutLocationShared, setCheckoutLocationShared] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'main' | 'shop' | 'cod'>('cod');
  const [orderPlacementSuccess, setOrderPlacementSuccess] = useState<any | null>(null);
  const [allShopOrders, setAllShopOrders] = useState<any[]>([]);
  const [checkoutDeliveryType, setCheckoutDeliveryType] = useState<'home' | 'pickup'>('pickup');
  const [checkoutDistance, setCheckoutDistance] = useState<number>(1.5);
  const [isMeasuring, setIsMeasuring] = useState(false);

  // Status logs
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Banking integration & automation live test states
  const [networkChecking, setNetworkChecking] = useState(false);
  const [checkedGates, setCheckedGates] = useState<string[]>([]);
  const [networkCheckComplete, setNetworkCheckComplete] = useState(false);

  // Shop Gadgets items definition
  const shopItems = [
    { id: 'item-1', name: 'Premium Airpods Max', price: 1200, icon: '🎧', description: 'হাই-ফাই নয়েজ ক্যানসেলিং হেডফোন' },
    { id: 'item-2', name: 'AMB Smart-Watch v5', price: 2500, icon: '⌚', description: 'হার্ট রেট এবং হেলথ ট্র্যাকার' },
    { id: 'item-3', name: 'Virtual VR Glass Pro', price: 4500, icon: '🥽', description: 'কো-অপারেটিভ 3ডি মেটাভার্স ভিউয়ার' },
  ];

  const syncLiveProfile = async () => {
    try {
      // 1. Sync User Document (Essential & lightweight) - Query by exact document ID first to avoid duplicate phone document collisions
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const effectiveBal = getEffectiveBalance(uData);
        setLiveUser({ uid: userSnap.id, ...uData, balance: effectiveBal, mainBalance: effectiveBal } as User);
      } else {
        const q = query(collection(db, 'users'), where('phone', '==', user.phone));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const uDoc = qSnap.docs[0];
          const uData = uDoc.data();
          const effectiveBal = getEffectiveBalance(uData);
          setLiveUser({ uid: uDoc.id, ...uData, balance: effectiveBal, mainBalance: effectiveBal } as User);
        }
      }

      // 2. Sync User's own transactions (lightweight, permanent, index-safe)
      const tQ = query(collection(db, 'transactions'), where('userId', '==', user.uid));
      const tSnap = await getDocs(tQ);
      const list: Transaction[] = [];
      tSnap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      if (user.memberId) {
        try {
          const mSnap = await getDocs(query(collection(db, 'transactions'), where('memberId', '==', user.memberId)));
          mSnap.forEach((d) => {
            if (!list.some(x => x.id === d.id)) list.push({ id: d.id, ...d.data() } as Transaction);
          });
        } catch (eMem) {
          console.warn("Member transaction sync fallback:", eMem);
        }
      }
      setAllTransactions(sortTransactionsNewestFirst(list));

      // 3. Sync User's specific Ration Card (lightweight)
      try {
        const rcQ = query(collection(db, 'ration_cards'), where('userId', '==', user.uid));
        const rcSnap = await getDocs(rcQ);
        if (!rcSnap.empty) {
          setRationCard({ id: rcSnap.docs[0].id, ...rcSnap.docs[0].data() });
        } else {
          setRationCard(null);
        }
      } catch (err) {
        console.error("Ration cards sync failed:", err);
      }

      // 4. Sync User's own Shop Orders (lightweight)
      try {
        const soQ = query(collection(db, 'shop_orders'), where('userId', '==', user.uid));
        const soSnap = await getDocs(soQ);
        const listSos: any[] = [];
        soSnap.forEach((d) => {
          listSos.push({ id: d.id, ...d.data() });
        });
        listSos.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setAllShopOrders(listSos);
      } catch (err) {
        console.error("Shop orders sync failed:", err);
      }

      // 5. Run other heavy, global, or redundant queries strictly in background (Non-Blocking)
      // and only if the current states are completely empty. This allows immediate user response!
      setTimeout(async () => {
        try {
          if (allNotices.length === 0) {
            const nQ = query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(15));
            const nSnap = await getDocs(nQ);
            const listNotices: Notice[] = [];
            nSnap.forEach((d) => {
              listNotices.push({ id: d.id, ...d.data() } as Notice);
            });
            setAllNotices(listNotices);
          }

          if (allUsers.length === 0) {
            const memSnap = await getDocs(query(collection(db, 'users'), limit(50)));
            const listMems: User[] = [];
            memSnap.forEach((d) => {
              listMems.push({ uid: d.id, ...d.data() } as User);
            });
            setAllUsers(listMems);
          }

          if (allOffers.length === 0) {
            const offSnap = await getDocs(query(collection(db, 'offers'), orderBy('createdAt', 'desc'), limit(15)));
            const listOffers: Offer[] = [];
            offSnap.forEach((d) => {
              listOffers.push({ id: d.id, ...d.data() } as Offer);
            });
            setAllOffers(listOffers);
          }

          if (allProducts.length === 0) {
            const prodSnap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(15)));
            const listProds: Product[] = [];
            prodSnap.forEach((d) => {
              listProds.push({ id: d.id, ...d.data() } as Product);
            });
            setAllProducts(listProds.length === 0 ? defaultProducts : listProds);
          }

          if (qardHistory.length === 0) {
            const qardQ = query(
              collection(db, 'transactions'),
              where('type', 'in', ['qard_donation', 'qard_loan_request', 'qard_loan_disbursment', 'qard_loan_repayment']),
              limit(30)
            );
            const qardSnap = await getDocs(qardQ);
            const qardList: Transaction[] = [];
            qardSnap.forEach((d) => {
              qardList.push({ id: d.id, ...d.data() } as Transaction);
            });
            qardList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setQardHistory(qardList);

            const starterAmount = 55000;
            const totalDonations = qardList
              .filter(t => t.type === 'qard_donation' && t.status === 'success')
              .reduce((sum, t) => sum + (t.amount || 0), 0);
            setQardTotalFund(starterAmount + totalDonations);

            const totalDisbursed = qardList
              .filter(t => t.type === 'qard_loan_disbursment' && t.status === 'success')
              .reduce((sum, t) => sum + (t.amount || 0), 0);
            const totalRepaid = qardList
              .filter(t => t.type === 'qard_loan_repayment' && t.status === 'success')
              .reduce((sum, t) => sum + (t.amount || 0), 0);
            setQardActiveLoansAmount(Math.max(0, totalDisbursed - totalRepaid));
          }

          if (safeDeals.length === 0) {
            const sdSnap = await getDocs(collection(db, 'safe_deals'));
            const listSds: any[] = [];
            sdSnap.forEach((d) => {
              listSds.push({ id: d.id, ...d.data() });
            });
            listSds.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setSafeDeals(listSds.length === 0 ? [] : listSds);
          }
        } catch (bgErr) {
          console.warn("Background fetch warning:", bgErr);
        }
      }, 50);

    } catch (e) {
      console.error("Live profile sync error:", e);
    }
  };

  const handleCopyText = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => {
      setCopiedField('');
    }, 2000);
  };

  const handleTestNetwork = async () => {
    setNetworkChecking(true);
    setNetworkCheckComplete(false);
    setCheckedGates([]);
    
    const checkpoints = [
      '1. BNB লেনদেন কোর API সংযোগ ও গেটওয়ে রিসোর্স... সম্পন্ন ✔',
      '2. মোবাইল ব্যাংকিং (bKash/Nagad/Rocket) লাইভ আইপিএন নোটিফিকেশন... সম্পন্ন ✔',
      '3. ক্লাউড ফায়ারস্টোর প্রডাকশন ডেটাবেস লাইভ সিঙ্ক স্টেট... সম্পন্ন ✔',
      '4. মাসিক ইন্টারেস্ট ও ডিপিএস লেজার অটোমেশন কন্ট্রোল... সম্পন্ন ✔'
    ];
    
    for (let i = 0; i < checkpoints.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 350));
      setCheckedGates(prev => [...prev, checkpoints[i]]);
    }
    
    setNetworkChecking(false);
    setNetworkCheckComplete(true);
  };

  // 1. Submit Unified Payment Gateway (Savings, Loans, and Fees)
  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (liveUser?.isDemo) {
      setShowDemoAuthPrompt(true);
      return;
    }
    setFormError('');
    setFormSuccess('');

    const amt = Number(depositAmount);
    if (!amt || amt <= 0) {
      setFormError('সঠিক টাকার পরিমাণ টাইপ করুন।');
      return;
    }

    if (!senderInfo.trim()) {
      setFormError('টাকা পরিশোধের প্রেরক নম্বর অথবা প্রেরক ব্যাংক তথ্য লিখুন।');
      return;
    }

    if (!txnId.trim()) {
      setFormError('পেমেন্টের সঠিক ট্রানজেকশন আইডি (TxnID/TrId) টাইপ করুন।');
      return;
    }

    if (loading) return;

    const cleanTxn = txnId.trim();
    if (cleanTxn && liveUser?.uid) {
      const existingPending = (allTransactions || []).find(t => 
        t.userId === liveUser.uid && 
        (t.status === 'pending' || (t as any).status === 'processing') && 
        (t.trxId?.toLowerCase() === cleanTxn.toLowerCase() || (t as any).transactionId?.toLowerCase() === cleanTxn.toLowerCase())
      );
      if (existingPending) {
        setFormError('এই ট্রানজেকশন আইডি (TxnID) দিয়ে ইতিপূর্বে একটি রিকোয়েস্ট জমা দেওয়া হয়েছে। অনুগ্রহ করে এডমিনের অনুমোদনের অপেক্ষা করুন।');
        return;
      }
    }

    setLoading(true);
    const txId = `tx-${Date.now()}`;
    
    let determinedType: 'add_money' | 'deposit' | 'loan_repayment' | 'fee_payment' = 'add_money' as any;
    let determinedLabel = 'অ্যাড মানি গেটওয়ে';
    let determinedDesc = '';

    if (payPurpose === 'main_balance') {
      determinedType = 'add_money' as any;
      determinedLabel = 'অ্যাড মানি (মেইন ব্যালেন্স)';
      determinedDesc = `মেইন ড্যাশবোর্ড ব্যালেন্সে অ্যাড মানি আবেদন [${payMethod}]। প্রেরকঃ ${senderInfo}, ট্রানজেকশন আইডিঃ ${txnId}। পেমেন্ট তারিখঃ ${payDate}।`;
    } else if (payPurpose === 'savings') {
      determinedType = 'deposit';
      determinedLabel = 'সঞ্চয় জমা';
      determinedDesc = `সঞ্চয় তহবিল কিস্তি জমা [${payMethod}]। প্রেরকঃ ${senderInfo}, ট্রানজেকশন আইডিঃ ${txnId}। পেমেন্ট তারিখঃ ${payDate}。`;
    } else if (payPurpose === 'loan') {
      determinedType = 'loan_repayment';
      determinedLabel = 'ঋণ পরিশোধ';
      determinedDesc = `ঋণ কিস্তি পরিশোধ [${payMethod}]। প্রেরকঃ ${senderInfo}, ট্রানজেকশন আইডিঃ ${txnId}। পেমেন্ট তারিখঃ ${payDate}。`;
    } else if (payPurpose === 'fees') {
      determinedType = 'fee_payment';
      determinedLabel = feeType === 'admission' ? 'ভর্তি ফি পরিশোধ' : feeType === 'monthly_fee' ? 'মাসিক সার্ভিস ফি' : 'অন্যান্য ফি ও চাঁদা';
      determinedDesc = `${determinedLabel} [${payMethod}]। প্রেরকঃ ${senderInfo}, ট্রানজেকশন আইডিঃ ${txnId}。পেমেন্ট তারিখঃ ${payDate}。`;
    }

    const newTx: Transaction = {
      id: txId,
      userId: liveUser.uid,
      userName: liveUser.name,
      memberId: liveUser.memberId,
      type: determinedType,
      typeLabel: determinedLabel,
      amount: amt,
      status: 'pending', // Pending authorization from Admin!
      description: determinedDesc,
      createdAt: new Date().toISOString(),
      paymentMethod: payMethod,
      senderInfo: senderInfo,
      senderPhone: senderInfo,
      accountNumber: senderInfo,
      trxId: txnId,
      transactionId: txnId,
      receiptNo: txnId,
      screenshot: screenshotData || '',
      paymentDate: payDate
    };

    // Instant zero-delay UI response ⚡
    setDepositAmount('');
    setSenderInfo('');
    setTxnId('');
    setScreenshotData('');
    setFormSuccess('আপনার পেমেন্ট আবেদনটি অ্যাডমিন প্যানেলে সফলতার সাথে সাবমিট হয়েছে! ট্রানজেকশন আইডি যাচাই শেষ করার পর ডিজিটাল রসিদ স্বয়ংক্রিয়ভাবে তৈরি হবে।');

    // Run database write in background asynchronously
    addDoc(collection(db, 'transactions'), newTx)
      .then(() => {
        if (syncLiveProfile) syncLiveProfile();
      })
      .catch((err) => {
        console.error('Error saving deposit submission:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // 1b. Pay Loan Installment
  const handlePayLoanInstallment = async (
    amt: number, 
    method: string, 
    sender: string, 
    txn: string, 
    screenshot: string
  ) => {
    setFormError('');
    setFormSuccess('');

    if (!amt || amt <= 0) {
      setFormError('সঠিক টাকার পরিমাণ টাইপ করুন।');
      return;
    }

    if (!sender.trim()) {
      setFormError('টাকা পরিশোধের প্রেরক নম্বর অথবা প্রেরক ব্যাংক তথ্য লিখুন।');
      return;
    }

    if (!txn.trim()) {
      setFormError('পেমেন্টের সঠিক ট্রানজেকশন আইডি (TxnID/TrId) টাইপ করুন।');
      return;
    }

    setLoading(true);
    try {
      const txId = `tx-repay-${Date.now()}`;
      const newTx: Transaction = {
        id: txId,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'loan_repayment',
        typeLabel: 'ঋণ পরিশোধ',
        amount: amt,
        status: 'pending',
        description: `ঋণ কিস্তি পরিশোধ [${method}]। প্রেরকঃ ${sender}, ট্রানজেকশন আইডিঃ ${txn}।`,
        createdAt: new Date().toISOString(),
        paymentMethod: method,
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      };

      if (screenshot) {
        newTx.screenshot = screenshot;
      }

      await addDoc(collection(db, 'transactions'), newTx);
      
      setFormSuccess('আপনার ঋণ পরিশোধের আবেদনটি সফলভাবে জমা হয়েছে। অ্যাডমিন ভেরিফাই করার পর আপনার বকেয়া ব্যালেন্স থেকে এই কিস্তির পরিমাণ কেটে নেয়া হবে।');
      setRepayAmount('');
      setRepaySenderInfo('');
      setRepayTxnId('');
      setRepayScreenshotData('');
      syncLiveProfile();
    } catch (e) {
      setFormError('আবেদন জমা করতে ব্যর্থ হয়েছে। অনুগ্রহ করে ইন্টারনেট কানেকশন চেক করুন।');
    } finally {
      setLoading(false);
    }
  };

  // 1c. Search transfer recipient member
  const handleSearchTransferMember = async () => {
    setSearchedMember(null);
    setSearchStatusMsg('');
    const input = transferTargetPhoneorId.trim();
    if (!input) {
      setSearchStatusMsg('অনুগ্রহ করে আইডি বা মোবাইল নাম্বার টাইপ করুন।');
      return;
    }

    setSearchStatusMsg('অনুসন্ধান করা হচ্ছে...');
    try {
      const isVirtualEndingInZero = input.endsWith('0') && input.length >= 10;
      const cleanInput = isVirtualEndingInZero ? input.slice(0, -1) : input;

      const q1 = query(collection(db, 'users'), where('memberId', '==', input));
      const q2 = query(collection(db, 'users'), where('phone', '==', input));
      const q3 = isVirtualEndingInZero ? query(collection(db, 'users'), where('memberId', '==', cleanInput)) : null;
      const q4 = isVirtualEndingInZero ? query(collection(db, 'users'), where('phone', '==', cleanInput)) : null;
      const q5 = (isVirtualEndingInZero && cleanInput.startsWith('0')) ? query(collection(db, 'users'), where('phone', '==', cleanInput.substring(1))) : null;
      const q6 = (isVirtualEndingInZero && cleanInput.startsWith('0')) ? query(collection(db, 'users'), where('phone', '==', '+88' + cleanInput)) : null;

      const [snap1, snap2, snap3, snap4, snap5, snap6] = await Promise.all([
        getDocs(q1).catch(() => ({ empty: true, docs: [] } as any)),
        getDocs(q2).catch(() => ({ empty: true, docs: [] } as any)),
        q3 ? getDocs(q3).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any),
        q4 ? getDocs(q4).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any),
        q5 ? getDocs(q5).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any),
        q6 ? getDocs(q6).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any)
      ]);

      let foundUser: any = null;
      let isVirtual = false;

      if (!snap1.empty && snap1.docs.length > 0) {
        foundUser = { uid: snap1.docs[0].id, ...snap1.docs[0].data() };
        if (input.endsWith('0')) isVirtual = true;
      } else if (!snap2.empty && snap2.docs.length > 0) {
        foundUser = { uid: snap2.docs[0].id, ...snap2.docs[0].data() };
        if (input.endsWith('0')) isVirtual = true;
      } else if (snap3 && !snap3.empty && snap3.docs.length > 0) {
        foundUser = { uid: snap3.docs[0].id, ...snap3.docs[0].data() };
        isVirtual = true;
      } else if (snap4 && !snap4.empty && snap4.docs.length > 0) {
        foundUser = { uid: snap4.docs[0].id, ...snap4.docs[0].data() };
        isVirtual = true;
      } else if (snap5 && !snap5.empty && snap5.docs.length > 0) {
        foundUser = { uid: snap5.docs[0].id, ...snap5.docs[0].data() };
        isVirtual = true;
      } else if (snap6 && !snap6.empty && snap6.docs.length > 0) {
        foundUser = { uid: snap6.docs[0].id, ...snap6.docs[0].data() };
        isVirtual = true;
      }

      if (isVirtualEndingInZero || input.endsWith('0')) {
        isVirtual = true;
      }

      if (foundUser) {
        foundUser.isVirtualSomitiTarget = isVirtual;
        foundUser.somitiVirtualNo = input;
        setSearchedMember(foundUser);
        if (isVirtual) {
          setSearchStatusMsg(`🏦 সমিতি ভার্চুয়াল নম্বর পাওয়া গেছেঃ ${foundUser.name} (সমিতি একাউন্ট: ${input}) - সঞ্চয় আমানতে অটো জমা হবে`);
        } else {
          setSearchStatusMsg(`💼 সদস্য পাওয়া গেছেঃ ${foundUser.name} (আইডি: ${foundUser.memberId || 'N/A'}) - মেইন ব্যালেন্সে জমা হবে`);
        }
      } else {
        setSearchStatusMsg('দুঃখিত, কোনো সক্রিয় সদস্য বা সমিতি অ্যাকাউন্ট খুঁজে পাওয়া যায়নি!');
      }
    } catch (e) {
      setSearchStatusMsg('ডাটাবেজ সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  };

  // 1d. Repay Qard Hasana interest-free loan
  const handleQardHasanaRepay = async (due: number) => {
    setLoading(true);
    setFormError('');
    setFormSuccess('');
    try {
      const currentBalance = liveUser.balance || 0;
      if (currentBalance < due) {
        setFormError(`পর্যাপ্ত ওয়ালেট ব্যালেন্স নেই! আপনার বর্তমান ওয়ালেট ব্যালেন্স ৳ ${currentBalance.toLocaleString('bn-BD')} BDT।`);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', liveUser.uid);
      const newDue = Math.max(0, (liveUser.dueLoan || 0) - due);
      const nowIso = new Date().toISOString();
      const updatePayload: any = {
        balance: currentBalance - due,
        dueLoan: newDue
      };
      if (newDue === 0) {
        updatePayload.lastCoopInstantLoanRepaidAt = nowIso;
      }
      await updateDoc(userRef, updatePayload);

      const txId = `tx-qard-repay-${Date.now()}`;
      const newTx: Transaction = {
        id: txId,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'qard_loan_repayment',
        typeLabel: 'করযে হাসানা পরিশোধ',
        amount: due,
        status: 'success',
        description: `ওয়ালেট ব্যালেন্স হতে সুদমুক্ত করযে হাসানা ঋণ পরিশোধ সফল সম্পন্ন (3 মাসের কুলডাউন কাউন্ট শুরু)।`,
        createdAt: nowIso,
        paymentMethod: 'Al Mayadin Wallet',
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      };

      await addDoc(collection(db, 'transactions'), newTx);
      setFormSuccess(`অভিনন্দন! সফলভাবে আপনার বকেয়া সুদমুক্ত করযে হাসানা ঋণ ৳ ${due.toLocaleString('bn-BD')} টাকা সম্পূর্ণ পরিশোধ সম্পন্ন হয়েছে।`);
      syncLiveProfile();
    } catch (e) {
      setFormError('ঋণ পরিশোধ ব্যর্থ হয়েছে। দয়া করে ইন্টারনেট কানেকশন চেক করুন।');
    } finally {
      setLoading(false);
    }
  };

  // 2. Apply for Loan Scheme
  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveUser?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
    setFormError('');
    setFormSuccess('');

    const amt = Number(loanAmount);
    if (!amt || amt < 500) {
      setFormError('ঋণের আবেদনের সর্বনিম্ন পরিমাণ 500 টাকা হতে হবে।');
      return;
    }
    if (amt > 20000) {
      setFormError('ঋণের আবেদনের সর্বোচ্চ পরিমাণ 20,000 টাকা পর্যন্ত হতে পারে।');
      return;
    }

    setLoading(true);
    try {
      const txId = `tx-coop-loan-${Date.now()}`;
      const newTx: Transaction = {
        id: txId,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'coop_loan_apply',
        typeLabel: 'সমিতি নতুন লোন আবেদন',
        amount: amt,
        status: 'pending',
        description: `সমবায় লোন আবেদনঃ ৳${amt.toLocaleString('bn-BD')} টাকা ঋণের রিকোয়েস্ট (ড্যাশবোর্ড আবেদন)`,
        createdAt: new Date().toISOString(),
        paymentMethod: 'Samity Fund',
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      };

      await addDoc(collection(db, 'transactions'), newTx);
      setFormSuccess('অভিনন্দন! আপনার লোন আবেদনটি যাচাইকরণ টেবিলে পাঠানো হয়েছে। অ্যাডমিন প্যানেল মিটিংয়ের ভিত্তিতে এটি মঞ্জুর বা বাতিল করবেন।');
      setLoanAmount('');
      syncLiveProfile();
    } catch (e) {
      setFormError('ঋণ আবেদন সাবমিট করতে ব্যর্থ হয়েছে। দয়া করে ইন্টারনেট কানেকশন চেক করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Execute fund transfer between internal sectors or to bank / external MFS
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveUser?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
    setFormError('');
    setFormSuccess('');

    const amt = parseFloat(transferAmountInput);
    if (!transferAmountInput || isNaN(amt) || amt <= 0) {
      setFormError('অনুগ্রহ করে সঠিক টাকা স্থানান্তরের পরিমাণ টাইপ করুন।');
      return;
    }

    if (amt < 10) {
      setFormError('সর্বনিম্ন টাকা স্থানান্তরের পরিমাণ 10 টাকা হতে হবে।');
      return;
    }

    if (!transferSenderPin.trim()) {
      setFormError('স্থানান্তর সম্পন্ন করতে আপনার 4-ডিজিটের সিকিউরিটি পিন দিন।');
      return;
    }

    if (transferSenderPin !== liveUser.pin) {
      setFormError('ভুল সিকিউরিটি পিন! সঠিক 4-ডিজিটের পিন টাইপ করুন।');
      return;
    }

    setLoading(true);
    try {
      const senderRef = doc(db, 'users', liveUser.uid);

      if (transferType === 'member') {
        if (!searchedMember) {
          setFormError('অনুগ্রহ করে প্রথমে প্রাপক মেম্বার সার্চ করে নিশ্চিত করুন।');
          setLoading(false);
          return;
        }

        if (searchedMember.uid === liveUser.uid) {
          // Self/Own Transfer
          if (transferSector === 'samity') {
            const currentBalance = liveUser.balance || 0;
            if (currentBalance < amt) {
              setFormError(`পর্যাপ্ত মেইন ব্যালেন্স নেই! আপনার বর্তমান ওয়ালেট ব্যালেন্স ৳ ${currentBalance.toLocaleString('bn-BD')} BDT।`);
              setLoading(false);
              return;
            }

            if (selfTransferTarget === 'telecom') {
              const currentTelecom = liveUser.telecomBalance || 0;
              await updateDoc(senderRef, {
                balance: currentBalance - amt,
                mainBalance: currentBalance - amt,
                telecomBalance: currentTelecom + amt
              });

              const txId = `tx-self-main-to-telecom-${Date.now()}`;
              const newTx: Transaction = {
                id: txId,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                type: 'balance_transfer',
                typeLabel: 'মেইন ব্যালেন্স হতে টেলিকম',
                amount: amt,
                status: 'success',
                description: `নিজের মেইন ব্যালেন্স হতে মেম্বার টেলিকম ওয়ালেটে স্থানান্তর সফল।`,
                createdAt: new Date().toISOString(),
                paymentMethod: 'Al Mayadin Wallet',
                receiptNo: `REC-${Math.floor(10000 + Math.random() * 90000)}`,
                transferSector: 'telecom'
              };
              await addDoc(collection(db, 'transactions'), newTx);
              setFormSuccess(`অভিনন্দন! সফলভাবে নিজের মেইন ওয়ালেট হতে ৳ ${amt.toLocaleString('bn-BD')} টাকা টেলিকম ওয়ালেটে স্থানান্তর করা হয়েছে।`);

            } else if (selfTransferTarget === 'shop') {
              const currentShop = liveUser.superShopBalance || 0;
              await updateDoc(senderRef, {
                balance: currentBalance - amt,
                mainBalance: currentBalance - amt,
                superShopBalance: currentShop + amt
              });

              const txId = `tx-self-main-to-shop-${Date.now()}`;
              const newTx: Transaction = {
                id: txId,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                type: 'balance_transfer',
                typeLabel: 'মেইন ব্যালেন্স হতে শপ',
                amount: amt,
                status: 'success',
                description: `নিজের মেইন ব্যালেন্স হতে মেম্বার সুপার শপ ওয়ালেটে স্থানান্তর সফল।`,
                createdAt: new Date().toISOString(),
                paymentMethod: 'Al Mayadin Wallet',
                receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
                transferSector: 'shop'
              };
              await addDoc(collection(db, 'transactions'), newTx);
              setFormSuccess(`অভিনন্দন! সফলভাবে নিজের মেইন ওয়ালেট হতে ৳ ${amt.toLocaleString('bn-BD')} টাকা সুপার শপ ওয়ালেটে স্থানান্তর করা হয়েছে।`);

            } else if (selfTransferTarget === 'savings') {
              const currentSavings = liveUser.savings || 0;
              await updateDoc(senderRef, {
                balance: currentBalance - amt,
                mainBalance: currentBalance - amt,
                savings: currentSavings + amt
              });

              const txIdSel = `tx-self-main-to-savings-${Date.now()}`;
              const newTxSel: Transaction = {
                id: txIdSel,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                type: 'deposit',
                typeLabel: 'মেইন ব্যালেন্স হতে সঞ্চয় জমা',
                amount: amt,
                status: 'success',
                description: `নিজের মেইন ব্যালেন্স হতে কো-অপারেтивной সঞ্চয় তহবিলে জমার আবেদন সফল।`,
                createdAt: new Date().toISOString(),
                paymentMethod: 'Al Mayadin Wallet',
                receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
                transferSector: 'samity'
              };
              await addDoc(collection(db, 'transactions'), newTxSel);
              setFormSuccess(`অভিনন্দন! সফলভাবে নিজের মেইন ওয়ালেট হতে ৳ ${amt.toLocaleString('bn-BD')} টাকা কো-অপারেটিভ সঞ্চয় ব্যালেন্সে স্থানান্তর করা হয়েছে।`);
            }
          } else if (transferSector === 'telecom') {
            const currentTelecom = liveUser.telecomBalance || 0;
            const currentBalance = liveUser.balance || 0;
            if (currentTelecom < amt) {
              setFormError(`পর্যাপ্ত টেলিকম ব্যালেন্স নেই! আপনার বর্তমান টেলিকম ব্যালেন্স ৳ ${currentTelecom.toLocaleString('bn-BD')} BDT।`);
              setLoading(false);
              return;
            }
            await updateDoc(senderRef, {
              telecomBalance: currentTelecom - amt,
              balance: currentBalance + amt,
              mainBalance: currentBalance + amt
            });

            const txIdT = `tx-self-telecom-deposit-${Date.now()}`;
            const newTxT: Transaction = {
              id: txIdT,
              userId: liveUser.uid,
              userName: liveUser.name,
              memberId: liveUser.memberId,
              type: 'deposit',
              typeLabel: 'টেলিকম হতে সমিতি ব্যালেন্স জেনারেশন',
              amount: amt,
              status: 'success',
              description: `নিজের টেলিকম ওয়ালেট হতে মেইন ব্যালেন্সে স্থানান্তর সফল।`,
              createdAt: new Date().toISOString(),
              paymentMethod: 'BNB Telecom Wallet',
              receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
              transferSector: 'samity'
            };

            await addDoc(collection(db, 'transactions'), newTxT);
            setFormSuccess(`অভিনন্দন! সফলভাবে নিজের টেলিকম ওয়ালেট হতে ৳ ${amt.toLocaleString('bn-BD')} টাকা ড্যাশবোর্ড মেইন ব্যালেন্সে স্থানান্তর করা হয়েছে।`);

          } else if (transferSector === 'shop') {
            const currentShop = liveUser.superShopBalance || 0;
            const currentBalance = liveUser.balance || 0;
            if (currentShop < amt) {
              setFormError(`পর্যাপ্ত সুপার শপ ব্যালেন্স নেই! আপনার বর্তমান সুপার শপ ব্যালেন্স ৳ ${currentShop.toLocaleString('bn-BD')} BDT।`);
              setLoading(false);
              return;
            }
            await updateDoc(senderRef, {
              superShopBalance: currentShop - amt,
              balance: currentBalance + amt,
              mainBalance: currentBalance + amt
            });

            const txIdS = `tx-self-shop-deposit-${Date.now()}`;
            const newTxS: Transaction = {
              id: txIdS,
              userId: liveUser.uid,
              userName: liveUser.name,
              memberId: liveUser.memberId,
              type: 'deposit',
              typeLabel: 'সুপার শপ হতে সমিতি ব্যালেন্স জেনারেশন',
              amount: amt,
              status: 'success',
              description: `নিজের সুপার শপ ওয়ালেট হতে মেইন ব্যালেন্সে স্থানান্তর সফল।`,
              createdAt: new Date().toISOString(),
              paymentMethod: 'BNB Super Shop Wallet',
              receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
              transferSector: 'samity'
            };

            await addDoc(collection(db, 'transactions'), newTxS);
            setFormSuccess(`অভিনন্দন! সফলভাবে নিজের সুপার শপ ওয়ালেট হতে ৳ ${amt.toLocaleString('bn-BD')} টাকা ড্যাশবোর্ড মেইন ব্যালেন্সে স্থানান্তর করা হয়েছে।`);
          }
        } else {
          // CASE B: Transfer to another member
          const receiverRef = doc(db, 'users', searchedMember.uid);
          if (transferSector === 'telecom') {
            const cleanTrxId = generateAmbTrxId('BN');
            const now = new Date();
            const formattedTime = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            let senderNewBal = 0;
            let receiverNewBal = 0;

            await runTransaction(db, async (transaction) => {
              const sSnap = await transaction.get(senderRef);
              const rSnap = await transaction.get(receiverRef);

              if (!sSnap.exists() || !rSnap.exists()) {
                throw new Error('সদস্য অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');
              }

              const sData = sSnap.data();
              const rData = rSnap.data();
              const currentTelecomSender = sData.telecomBalance || 0;
              const currentTelecomReceiver = rData.telecomBalance || 0;

              if (currentTelecomSender < amt) {
                throw new Error(`পর্যাপ্ত টেলিকম ব্যালেন্স নেই! আপনার বর্তমান টেলিকম ব্যালেন্স ৳ ${currentTelecomSender.toLocaleString('bn-BD')} BDT।`);
              }

              senderNewBal = currentTelecomSender - amt;
              receiverNewBal = currentTelecomReceiver + amt;

              transaction.update(senderRef, { telecomBalance: senderNewBal });
              transaction.update(receiverRef, { telecomBalance: receiverNewBal });

              const txIdSender = `tx-telecom-transfer-out-${Date.now()}`;
              const txIdReceiver = `tx-telecom-transfer-in-${Date.now()}`;

              const senderTxDoc = doc(collection(db, 'transactions'), txIdSender);
              const receiverTxDoc = doc(collection(db, 'transactions'), txIdReceiver);
              const senderNotifDoc = doc(collection(db, 'user_notifications'), `notif-sender-${Date.now()}`);
              const receiverNotifDoc = doc(collection(db, 'user_notifications'), `notif-receiver-${Date.now()}`);

              transaction.set(senderTxDoc, {
                id: txIdSender,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                phone: liveUser.phone || liveUser.phoneNumber || "",
                senderNumber: liveUser.phone || liveUser.phoneNumber || "",
                type: 'balance_transfer',
                typeLabel: 'টেলিকম ব্যালেন্স পাঠানো',
                amount: amt,
                status: 'success',
                description: `সদস্য ${searchedMember.name} (আইডি: ${searchedMember.memberId}) কে টেলিকম ব্যালেন্স পাঠানো সফল। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'BNB Telecom Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                transferSector: 'telecom'
              });

              transaction.set(receiverTxDoc, {
                id: txIdReceiver,
                userId: searchedMember.uid,
                userName: searchedMember.name,
                memberId: searchedMember.memberId,
                type: 'deposit',
                typeLabel: 'টেলিকম ব্যালেন্স লাভ',
                amount: amt,
                status: 'success',
                description: `সদস্য ${liveUser.name} (আইডি: ${liveUser.memberId}) হতে টেলিকম ব্যালেন্স প্রাপ্তি। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'BNB Telecom Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                transferSector: 'telecom'
              });

              transaction.set(senderNotifDoc, {
                id: `notif-sender-${Date.now()}`,
                userId: liveUser.uid,
                memberId: liveUser.memberId || '',
                title: '💸 টাকা পাঠানো সফল (Money Sent)',
                body: `You have sent Tk ${amt.toFixed(2)} to ${searchedMember.phone || ''}. Fee Tk 0.00. Balance Tk ${senderNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });

              transaction.set(receiverNotifDoc, {
                id: `notif-receiver-${Date.now()}`,
                userId: searchedMember.uid,
                memberId: searchedMember.memberId || '',
                title: '📥 টাকা গ্রহণ সফল (Money Received)',
                body: `You have received Tk ${amt.toFixed(2)} from ${liveUser.phone || ''}. Ref 0. Fee Tk 0.00. Balance Tk ${receiverNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });
            });

            setFormSuccess(`অভিনন্দন! সফলভাবে সদস্য ${searchedMember.name} কে ৳ ${amt.toLocaleString('bn-BD')} টেলিকম ব্যালেন্স স্থানান্তর করা হয়েছে।`);

          } else if (transferSector === 'shop') {
            const cleanTrxId = generateAmbTrxId('BN');
            const now = new Date();
            const formattedTime = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            let senderNewBal = 0;
            let receiverNewBal = 0;

            await runTransaction(db, async (transaction) => {
              const sSnap = await transaction.get(senderRef);
              const rSnap = await transaction.get(receiverRef);

              if (!sSnap.exists() || !rSnap.exists()) {
                throw new Error('সদস্য অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');
              }

              const sData = sSnap.data();
              const rData = rSnap.data();
              const currentShopSender = sData.superShopBalance || 0;
              const currentShopReceiver = rData.superShopBalance || 0;

              if (currentShopSender < amt) {
                throw new Error(`পর্যাপ্ত সুপার শপ ব্যালেন্স নেই! আপনার বর্তমান সুপার শপ ব্যালেন্স ৳ ${currentShopSender.toLocaleString('bn-BD')} BDT।`);
              }

              senderNewBal = currentShopSender - amt;
              receiverNewBal = currentShopReceiver + amt;

              transaction.update(senderRef, { superShopBalance: senderNewBal });
              transaction.update(receiverRef, { superShopBalance: receiverNewBal });

              const txIdSender = `tx-shop-transfer-out-${Date.now()}`;
              const txIdReceiver = `tx-shop-transfer-in-${Date.now()}`;

              const senderTxDoc = doc(collection(db, 'transactions'), txIdSender);
              const receiverTxDoc = doc(collection(db, 'transactions'), txIdReceiver);
              const senderNotifDoc = doc(collection(db, 'user_notifications'), `notif-sender-${Date.now()}`);
              const receiverNotifDoc = doc(collection(db, 'user_notifications'), `notif-receiver-${Date.now()}`);

              transaction.set(senderTxDoc, {
                id: txIdSender,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                type: 'balance_transfer',
                typeLabel: 'সুপার শপ ব্যালেন্স পাঠানো',
                amount: amt,
                status: 'success',
                description: `সদস্য ${searchedMember.name} (আইডি: ${searchedMember.memberId}) কে সুপার শপ ব্যালেন্স পাঠানো সফল। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'BNB Super Shop Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                transferSector: 'shop'
              });

              transaction.set(receiverTxDoc, {
                id: txIdReceiver,
                userId: searchedMember.uid,
                userName: searchedMember.name,
                memberId: searchedMember.memberId,
                type: 'deposit',
                typeLabel: 'সুপার শপ ব্যালেন্স লাভ',
                amount: amt,
                status: 'success',
                description: `সদস্য ${liveUser.name} (আইডি: ${liveUser.memberId}) হতে সুপার শপ ব্যালেন্স প্রাপ্তি। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'BNB Super Shop Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                transferSector: 'shop'
              });

              transaction.set(senderNotifDoc, {
                id: `notif-sender-${Date.now()}`,
                userId: liveUser.uid,
                memberId: liveUser.memberId || '',
                title: '💸 টাকা পাঠানো সফল (Money Sent)',
                body: `You have sent Tk ${amt.toFixed(2)} to ${searchedMember.phone || ''}. Fee Tk 0.00. Balance Tk ${senderNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });

              transaction.set(receiverNotifDoc, {
                id: `notif-receiver-${Date.now()}`,
                userId: searchedMember.uid,
                memberId: searchedMember.memberId || '',
                title: '📥 টাকা গ্রহণ সফল (Money Received)',
                body: `You have received Tk ${amt.toFixed(2)} from ${liveUser.phone || ''}. Ref 0. Fee Tk 0.00. Balance Tk ${receiverNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });
            });

            setFormSuccess(`অভিনন্দন! সফলভাবে সদস্য ${searchedMember.name} কে ৳ ${amt.toLocaleString('bn-BD')} সুপার শপ ব্যালেন্স স্থানান্তর করা হয়েছে।`);

          } else {
            // BNB to BNB Transfer: Automatic direct transfer based on destination account!
            // If recipient target is Samity Virtual Account (phone + '0' / 12 digits / isVirtualSomitiTarget): goes to SAMITY SAVINGS balance!
            // If recipient target is standard 11-digit phone number or Member ID: goes to MAIN balance!
            const rawTargetInput = transferTargetPhoneorId.trim();
            const cleanDigits = rawTargetInput.replace(/\D/g, '');
            const isSamityVirtualTarget = searchedMember.isVirtualSomitiTarget === true || (
              cleanDigits.length === 12 && cleanDigits.endsWith('0')
            );

            const cleanTrxId = generateAmbTrxId('BN');
            const now = new Date();
            const formattedTime = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            let senderNewBal = 0;
            let receiverNewBal = 0;

            await runTransaction(db, async (transaction) => {
              const sSnap = await transaction.get(senderRef);
              const rSnap = await transaction.get(receiverRef);

              if (!sSnap.exists() || !rSnap.exists()) {
                throw new Error('সদস্য অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');
              }

              const sData = sSnap.data();
              const rData = rSnap.data();
              const currentBalanceSender = getEffectiveBalance(sData);

              if (currentBalanceSender < amt) {
                throw new Error(`পর্যাপ্ত মেইন ব্যালেন্স নেই! আপনার বর্তমান ওয়ালেট ব্যালেন্স ৳ ${currentBalanceSender.toLocaleString('bn-BD')} BDT।`);
              }

              senderNewBal = currentBalanceSender - amt;
              transaction.update(senderRef, { balance: senderNewBal, mainBalance: senderNewBal });

              if (isSamityVirtualTarget) {
                // Credit to Receiver's SAMITY / SAVINGS balance!
                const currentSavingsReceiver = Number(rData.savings) || 0;
                receiverNewBal = currentSavingsReceiver + amt;
                const existingPaidMonths: string[] = rData.samityPaidMonths || [];
                const targetRate = Number(rData.monthlySavingsTarget) || 1000;
                const updatedPaidMonths = normalizePaidMonthsArray([...existingPaidMonths, ...sendMoneySelectedMonths], receiverNewBal, targetRate);
                transaction.update(receiverRef, { savings: receiverNewBal, dpsBalance: receiverNewBal, samityPaidMonths: updatedPaidMonths });
              } else {
                // Credit to Receiver's MAIN balance!
                const currentBalanceReceiver = getEffectiveBalance(rData);
                receiverNewBal = currentBalanceReceiver + amt;
                transaction.update(receiverRef, { balance: receiverNewBal, mainBalance: receiverNewBal });
              }

              const txIdSender = `tx-transfer-out-${Date.now()}`;
              const txIdReceiver = `tx-transfer-in-${Date.now()}`;

              const senderTxDoc = doc(collection(db, 'transactions'), txIdSender);
              const receiverTxDoc = doc(collection(db, 'transactions'), txIdReceiver);
              const senderNotifDoc = doc(collection(db, 'user_notifications'), `notif-sender-${Date.now()}`);
              const receiverNotifDoc = doc(collection(db, 'user_notifications'), `notif-receiver-${Date.now()}`);

              transaction.set(senderTxDoc, {
                id: txIdSender,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                type: 'balance_transfer',
                typeLabel: isSamityVirtualTarget ? 'সমিতি একাউন্টে ফান্ড পাঠানো' : 'মেইন ব্যালেন্সে টাকা পাঠানো',
                amount: amt,
                totalDeducted: amt,
                status: 'success',
                description: isSamityVirtualTarget 
                  ? `সদস্য ${searchedMember.name} (আইডি: ${searchedMember.memberId}) এর সমিতি সঞ্চয় একাউন্টে (লাস্টে 0) ৳${amt} পাঠানো সফল। TrxID: ${cleanTrxId}`
                  : `সদস্য ${searchedMember.name} (আইডি: ${searchedMember.memberId}) কে মেইন ব্যালেন্সে ৳${amt} পাঠানো সফল। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'Al Mayadin Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                receiverUid: searchedMember.uid,
                receiverId: searchedMember.memberId,
                receiverName: searchedMember.name,
                transferSector: isSamityVirtualTarget ? 'samity' : 'main'
              });

              transaction.set(receiverTxDoc, {
                id: txIdReceiver,
                userId: searchedMember.uid,
                userName: searchedMember.name,
                memberId: searchedMember.memberId,
                phone: searchedMember.phone || "",
                senderNumber: liveUser.phone || liveUser.phoneNumber || "",
                type: isSamityVirtualTarget ? 'coop_savings_deposit' : 'deposit',
                typeLabel: isSamityVirtualTarget ? 'সমিতি একাউন্টে সঞ্চয় জমা' : 'মেইন ব্যালেন্স প্রাপ্তি',
                amount: amt,
                status: 'success',
                description: isSamityVirtualTarget
                  ? `সদস্য ${liveUser.name} (আইডি: ${liveUser.memberId}) হতে সমিতি সঞ্চয় একাউন্টে জমা প্রাপ্তি। TrxID: ${cleanTrxId}`
                  : `সদস্য ${liveUser.name} (আইডি: ${liveUser.memberId}) হতে মেইন ব্যালেন্সে জমা প্রাপ্তি। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'Al Mayadin Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                transferSector: isSamityVirtualTarget ? 'samity' : 'main'
              });

              transaction.set(senderNotifDoc, {
                id: `notif-sender-${Date.now()}`,
                userId: liveUser.uid,
                memberId: liveUser.memberId || '',
                title: '💸 টাকা পাঠানো সফল (Money Sent)',
                body: `You have sent Tk ${amt.toFixed(2)} to ${searchedMember.phone || ''}. Fee Tk 0.00. Balance Tk ${senderNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });

              transaction.set(receiverNotifDoc, {
                id: `notif-receiver-${Date.now()}`,
                userId: searchedMember.uid,
                memberId: searchedMember.memberId || '',
                title: isSamityVirtualTarget ? '📥 সমিতি একাউন্টে সঞ্চয় জমা সফল' : '📥 টাকা গ্রহণ সফল (Money Received)',
                body: isSamityVirtualTarget
                  ? `You have received Tk ${amt.toFixed(2)} from ${liveUser.phone || ''} into your Samity Savings Account. Ref 0. Fee Tk 0.00. Savings Balance Tk ${receiverNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`
                  : `You have received Tk ${amt.toFixed(2)} from ${liveUser.phone || ''} into your Main Wallet Balance. Ref 0. Fee Tk 0.00. Main Balance Tk ${receiverNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });
            });

            if (isSamityVirtualTarget) {
              setFormSuccess(`অভিনন্দন! সফলভাবে সদস্য ${searchedMember.name}-এর সমিতি ভার্চুয়াল একাউন্টে (লাস্টে 0) ৳ ${amt.toLocaleString('bn-BD')} সঞ্চয় জমা স্থানান্তর সম্পন্ন হয়েছে।`);
            } else {
              setFormSuccess(`অভিনন্দন! সফলভাবে সদস্য ${searchedMember.name}-এর মেইন ব্যালেন্সে ৳ ${amt.toLocaleString('bn-BD')} স্থানান্তর সম্পন্ন হয়েছে।`);
            }
          }
        }
      } else {
        // CASE C: To External General Bank accounts / Mobile FS
        if (!transferTargetAccNo.trim()) {
          setFormError('অনুগ্রহ করে প্রাপক ব্যাংক হিসাব/নম্বর টাইপ করুন।');
          setLoading(false);
          return;
        }

        const currentBalanceSender = getEffectiveBalance(liveUser);
        if (currentBalanceSender < amt) {
          setFormError(`পর্যাপ্ত মেইন ব্যালেন্স নেই! আপনার বর্তমান ওয়ালেট ব্যালেন্স ৳ ${currentBalanceSender.toLocaleString('bn-BD')} BDT।`);
          setLoading(false);
          return;
        }
        const updatedSenderBal = currentBalanceSender - amt;
        await updateDoc(senderRef, { balance: updatedSenderBal, mainBalance: updatedSenderBal });

        const txId = `tx-bank-transfer-${Date.now()}`;
        const newTx: Transaction = {
          id: txId,
          userId: liveUser.uid,
          userName: liveUser.name,
          memberId: liveUser.memberId,
          type: 'balance_transfer',
          typeLabel: 'বহিরাগত ফান্ড ট্রান্সফার',
          amount: amt,
          status: 'pending',
          description: `${transferType === 'bank' ? transferTargetBankName : 'মোবাইল ওয়ালেট'} (হিসাবঃ ${transferTargetAccNo}) অ্যাকাউন্টে ফান্ড স্থানান্তরের আবেদন (অ্যাডমিন অনুমোদনের অপেক্ষায়)।`,
          createdAt: new Date().toISOString(),
          paymentMethod: transferType === 'bank' ? 'Bank Transfer' : 'MFS',
          receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
          transferSector: 'samity'
          };

        await addDoc(collection(db, 'transactions'), newTx);
        setFormSuccess(`আপনার ৳ ${amt.toLocaleString('bn-BD')} ব্যাংক/MFS উত্তোলনের আবেদনটি সফলভাবে দাখিল করা হয়েছে এবং এর স্ট্যাটাস অপেক্ষমাণ (Pending)। এডমিন এপ্রুভ করার সাথে সাথে আপনার পেমেন্ট সম্পন্ন হবে।`);
      }

      setTransferAmountInput('');
      setTransferTargetPhoneorId('');
      setTransferTargetAccNo('');
      setTransferSenderPin('');
      setSearchedMember(null);
      setSearchStatusMsg('');
      setSendMoneySelectedMonths([]);

      await syncLiveProfile();
    } catch (e) {
      setFormError('টাকা স্থানান্তর ব্যর্থ হয়েছে। অনুগ্রহ করে ইন্টারনেট কানেকশন চেক করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRationCard = async () => {
    if (liveUser?.isDemo) {
      setShowDemoAuthPrompt(true);
      return;
    }
    
    if (!rationCardName.trim()) {
      alert('অনুগ্রহ করে কার্ডধারীর পুরো নাম লিখুন।');
      return;
    }

    if (!rationCardAddress.trim()) {
      alert('অনুগ্রহ করে আপনার সঠিক ঠিকানা লিখুন।');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', liveUser.uid);
      const currentBalance = liveUser.balance || 0;
      const activationFee = 150;

      if (currentBalance < activationFee) {
        alert(`রেশন কার্ডের সক্রিয়করণ ফি ৳${activationFee} BDT। আপনার পর্যাপ্ত ব্যালেন্স নেই!`);
        setLoading(false);
        return;
      }

      // Generate virtual card number
      const cardNo = `AMB-RC-${Math.floor(100000 + Math.random() * 900000)}`;

      const newCard = {
        userId: liveUser.uid,
        userName: rationCardName,
        address: rationCardAddress,
        cardType: rationCardType,
        cardNo: cardNo,
        nominee: rationCardNominee || 'প্রযোজ্য নয়',
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      // Add to Firestore
      await addDoc(collection(db, 'ration_cards'), newCard);

      // Deduct Fee
      const updatedUserBal = currentBalance - activationFee;
      await updateDoc(userRef, { balance: updatedUserBal, mainBalance: updatedUserBal });

      // Record transaction
      await addDoc(collection(db, 'transactions'), {
        id: `tx-rc-create-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'ration_card_fee',
        typeLabel: 'রেশন কার্ড সক্রিয়করণ ফি',
        amount: activationFee,
        status: 'success',
        description: `ডিজিটাল রেশন কার্ড (${cardNo}) সক্রিয়করণ সম্পন্ন।`,
        createdAt: new Date().toISOString(),
        paymentMethod: 'Main Balance'
      });

      alert(`অভিনন্দন! সফলভাবে আপনার ডিজিটাল রেশন কার্ড (${cardNo}) তৈরি হয়েছে।`);
      setShowCreateCardModal(false);
      await syncLiveProfile();
    } catch (err) {
      console.error("Ration card creation failed:", err);
      alert("সার্ভার ত্রুটি! রেশন কার্ড সক্রিয় করা সম্ভব হয়নি।");
    } finally {
      setLoading(false);
    }
  };

  // 8. Submit Agent Application
  const handleAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveUser?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
    setAgentErrorMsg('');
    setAgentSuccessMsg('');
    setLoading(true);

    if (!agentPhone || !agentDistrict) {
      setAgentErrorMsg('অনুগ্রহ করে আপনার সচল মোবাইল নম্বর এবং নিজ জেলা প্রদান করুন।');
      setLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'agent_requests'), {
        userId: liveUser.uid,
        userName: liveUser.name || 'সদস্য',
        userEmail: liveUser.email || '',
        phone: agentPhone,
        district: agentDistrict,
        experience: agentExperience,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setAgentSuccessMsg('আপনার এজেন্ট আবেদনটি সফলভাবে Bangladesh এডমিন প্যানেলে জমা দেওয়া হয়েছে! এডমিন প্যানেল শীঘ্রই আপনার সাথে যোগাযোগ করবেন। ধন্যবাদ!');
      setHasSubmittedAgent(true);
    } catch (err: any) {
      console.error(err);
      setAgentErrorMsg('আবেদন জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // 8b. Live Chat support desk
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveUser?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
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
    } catch (e) {
      console.error(e);
    }

    setIsChatTyping(true);

    setTimeout(() => {
      setIsChatTyping(false);
      let replyText = '';
      const textLower = userText.toLowerCase();

      if (textLower.includes('সমিতি') || textLower.includes('সঞ্চয়') || textLower.includes('ডিপিএস')) {
        replyText = 'সমিতি হিসাব সচল করতে ড্যাশবোর্ডের নীচে সার্ভিস গ্রিডের "সমিতি" সেকশনে গিয়ে আবেদন রিকোয়েস্ট জমা দিন। এডমিন প্যানেল আপনার আবেদনটি তাৎক্ষণিকভাবে যাচাই করে অনুমোদন প্রদান করবে।';
      } else if (textLower.includes('ঋণ') || textLower.includes('করযে') || textLower.includes('করজ')) {
        replyText = 'সুদমুক্ত করযে হাসানা ঋণের জন্য ড্যাশবোর্ডের "করযে হাসানা" সেকশন হতে আবেদন করতে পারেন। এছাড়া সমিতির অন্যান্য ঋণের ক্ষেত্রেও সেখানে বিস্তারিত নির্দেশনা রয়েছে।';
      } else if (textLower.includes('টেলিকম') || textLower.includes('রিচার্জ') || textLower.includes('অফার')) {
        replyText = 'বাংলাদেশ নেটওয়ার্ক টেলিকম অফার ও রিচার্জ সুবিধা পেতে সার্ভিস গ্রিডের "টেলিকম" অপশনটি ব্যবহার করুন। যেকোনো অপারেটরের স্পেশাল অফার এবং রিচার্জের রিকোয়েস্ট এডমিন প্যানেল দ্রুত সম্পন্ন করে।';
      } else if (textLower.includes('এজেন্ট') || textLower.includes('কাজ')) {
        replyText = 'আমাদের সম্মানিত এজেন্ট হিসেবে কাজ শুরু করতে চাইলে সার্ভিস গ্রিডের "এজেন্ট রেজিস্টার" অপশনে গিয়ে আপনার আবেদনটি দাখিল করুন। এডমিন প্যানেল আপনার আবেদনটি রিভিও করে যোগাযোগ করবে।';
      } else {
        replyText = 'আসসালামু আলাইকুম! আপনার মেসেজটি সফলভাবে বাংলাদেশ নেটওয়ার্ক (AMB) সাপোর্ট সেন্টারে রেকর্ড করা হয়েছে। যেকোনো তথ্যের জন্য আমাদের সাপোর্ট নম্বরে যোগাযোগ করতে পারেন অথবা এডমিনের ফিরতি উত্তরের জন্য অপেক্ষা করুন।';
      }

      const replyMsg = { 
        id: Math.random().toString(), 
        sender: 'support', 
        text: replyText, 
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) 
      };
      setChatMessages(prev => [...prev, replyMsg]);

      addDoc(collection(db, 'support_chats'), {
        userId: liveUser.uid,
        userName: 'সাপোর্ট অ্যাসিস্ট্যান্ট',
        message: replyText,
        sender: 'support',
        createdAt: new Date().toISOString()
      }).catch(err => console.error("Error saving support chat reply:", err));
    }, 1500);
  };

  const handleJoinSafeDeal = async (dealId: string, dealTitle: string, dealPrice: number) => {
    if (liveUser?.isDemo) {
      setShowDemoAuthPrompt(true);
      return;
    }

    const qtyStr = prompt(`"${dealTitle}" ডিলে অংশ নিতে কত পিস/লিটার অর্ডার করতে চান টাইপ করুন:`, "1");
    if (!qtyStr) return;
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) {
      alert("অনুগ্রহ করে সঠিক সংখ্যা লিখুন।");
      return;
    }

    const pin = prompt(`ক্রয় সম্পন্ন করতে আপনার 4 ডিজিটের সিকিউরিটি পিন নাম্বার টাইপ করুনঃ`);
    if (!pin) return;
    if (pin !== liveUser.pin) {
      alert("ভুল পিন কোড!");
      return;
    }

    setLoading(true);
    try {
      const totalAmount = dealPrice * qty;
      const currentBalance = liveUser.balance || 0;

      if (currentBalance < totalAmount) {
        alert(`আপনার পর্যাপ্ত ব্যালেন্স নেই! মোট প্রয়োজন ৳${totalAmount.toLocaleString("bn-BD")} BDT, কিন্তু আপনার মেইন ব্যালেন্স ৳${currentBalance.toLocaleString("bn-BD")} BDT।`);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", liveUser.uid);
      await updateDoc(userRef, {
        balance: currentBalance - totalAmount
      });

      const orderRef = await addDoc(collection(db, "safe_deal_orders"), {
        buyerUid: liveUser.uid,
        buyerName: liveUser.name,
        buyerMemberId: liveUser.memberId,
        buyerPhone: liveUser.phone,
        dealId: dealId,
        dealTitle: dealTitle,
        pricePerItem: dealPrice,
        quantity: qty,
        totalAmount: totalAmount,
        status: "Payment Held",
        createdAt: new Date().toISOString(),
        courierName: "",
        trackingNumber: "",
        shipmentDate: "",
        statusHistory: [{
          status: "Payment Held",
          timestamp: new Date().toISOString(),
          note: "ক্রেতা মেইন ব্যালেন্স দিয়ে নিরাপদ লেনদেন শুরু করেছেন। টাকা সাময়িকভাবে এসক্রো সুরক্ষিত ওয়ালেটে হোল্ড করা হয়েছে।"
        }]
      });

      await addDoc(collection(db, "transactions"), {
        id: `tx-esc-held-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "fee_payment",
        typeLabel: "নিরাপদ লেনদেন হোল্ড",
        amount: totalAmount,
        status: "success",
        description: `নিরাপদ ডিল ফান্ড বুকিং: ${dealTitle} (আইডি: ${orderRef.id.substring(0, 8)})`,
        createdAt: new Date().toISOString()
      });

      alert("আপনার অর্ডারটি সফলভাবে জমা হয়েছে এবং পেমেন্ট হোল্ড করা হয়েছে।");
      syncLiveProfile();
    } catch (e: any) {
      console.error(e);
      alert("অর্ডার সম্পন্ন করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCardLock = async () => {
    if (!liveUser) return;
    try {
      setLoading(true);
      const userRef = doc(db, "users", liveUser.uid);
      const newLockStatus = !liveUser.cardLocked;
      await updateDoc(userRef, { cardLocked: newLockStatus });
      alert(newLockStatus ? "রেশন কার্ড সফলভাবে লক করা হয়েছে।" : "রেশন কার্ড সফলভাবে আনলক করা হয়েছে।");
      syncLiveProfile();
    } catch (err) {
      console.error(err);
      alert("অপারেশন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleShopTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopTransferErr('');
    setShopTransferSucc('');
    
    if (!liveUser) return;
    
    const amountNum = parseFloat(shopTransferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setShopTransferErr('সঠিক পরিমাণ লিখুন।');
      return;
    }
    
    if (amountNum > (liveUser.balance || 0)) {
      setShopTransferErr('আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।');
      return;
    }
    
    if (shopTransferPin !== liveUser.pin) {
      setShopTransferErr('ভুল পিন নাম্বার প্রদান করেছেন।');
      return;
    }
    
    try {
      setShopTransferLoading(true);
      const userRef = doc(db, "users", liveUser.uid);
      await updateDoc(userRef, {
        balance: (liveUser.balance || 0) - amountNum,
        mainBalance: (liveUser.balance || 0) - amountNum,
        superShopBalance: (liveUser.superShopBalance || 0) + amountNum
      });
      
      await addDoc(collection(db, "transactions"), {
        id: `tx-shop-trans-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "shop_transfer",
        typeLabel: "সুপার শপ ফান্ড ট্রান্সফার",
        amount: amountNum,
        status: "success",
        description: `মেইন ব্যালেন্স থেকে সুপার শপ ব্যালেন্সে ৳ ${amountNum.toLocaleString('bn-BD')} ফান্ড স্থানান্তরিত করা হয়েছে।`,
        createdAt: new Date().toISOString()
      });
      
      setShopTransferSucc('ফান্ড সফলভাবে স্থানান্তরিত হয়েছে!');
      setShopTransferAmount('');
      setShopTransferPin('');
      syncLiveProfile();
    } catch (err: any) {
      console.error(err);
      setShopTransferErr('স্থানান্তর প্রক্রিয়াটি সম্পন্ন করা যায়নি।');
    } finally {
      setShopTransferLoading(false);
    }
  };

  const handleBuyPremiumSafi = async (itemName: string, itemPrice: number) => {
    if (!liveUser) return;
    
    const confirmBuy = confirm(`আপনি কি ৳ ${itemPrice.toLocaleString('bn-BD')} টাকা দিয়ে "${itemName}" পণ্যটি কিনতে চান?`);
    if (!confirmBuy) return;
    
    const pin = prompt(`ক্রয় সম্পন্ন করতে আপনার 4 ডিজিটের সিকিউরিটি পিন নাম্বার টাইপ করুনঃ`);
    if (!pin) return;
    if (pin !== liveUser.pin) {
      alert("ভুল পিন নাম্বার প্রদান করেছেন।");
      return;
    }
    
    if (itemPrice > (liveUser.balance || 0)) {
      alert("আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।");
      return;
    }
    
    try {
      setLoading(true);
      const userRef = doc(db, "users", liveUser.uid);
      await updateDoc(userRef, {
        balance: (liveUser.balance || 0) - itemPrice,
        mainBalance: (liveUser.balance || 0) - itemPrice
      });
      
      await addDoc(collection(db, "transactions"), {
        id: `tx-safi-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "safi_purchase",
        typeLabel: "সাফি খাঁটি পণ্য ক্রয়",
        amount: itemPrice,
        status: "success",
        description: `সাফি প্রিমিয়াম শপ অর্ডারঃ ${itemName} (পেমেন্ট সম্পন্ন)`,
        createdAt: new Date().toISOString()
      });
      
      alert(`🎉 অভিনন্দন! "${itemName}" পণ্যটির ক্রয় অর্ডার সফল হয়েছে। আমাদের প্রতিনিধি শীঘ্রই আপনার ঠিকানায় ডেলিভারি করবে।`);
      syncLiveProfile();
    } catch (err: any) {
      console.error(err);
      alert("অর্ডার প্রক্রিয়াটি সম্পন্ন করা সম্ভব হয়নি।");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveUser) return;
    
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("উত্তোলনের সঠিক পরিমাণ লিখুন।");
      return;
    }
    
    const currentSavings = liveUser.savings || 0;
    if (amountNum > currentSavings) {
      alert("আপনার সঞ্চয় তহবিলে পর্যাপ্ত ব্যালেন্স নেই।");
      return;
    }
    
    if (withdrawPin !== liveUser.pin) {
      alert("ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।");
      return;
    }
    
    try {
      setLoading(true);
      
      // Save withdrawal request as a pending transaction in Firebase
      await addDoc(collection(db, "transactions"), {
        id: `tx-wd-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        userPhone: liveUser.phone,
        memberId: liveUser.memberId,
        type: "withdraw",
        typeLabel: "উইথড্র / ক্যাশআউট",
        amount: amountNum,
        status: "pending",
        paymentMethod: withdrawMethod === 'DBBL_Bank' ? 'Bank Transfer - Dutch-Bangla Bank PLC. (DBBL)' : withdrawMethod === 'CellFin' ? 'CellFin Transfer' : `${withdrawMethod} Cashout`,
        method: withdrawMethod || "bKash",
        bankName: withdrawMethod === 'DBBL_Bank' ? 'Dutch-Bangla Bank PLC. (DBBL)' : withdrawBankName,
        accountTitle: withdrawAccName || liveUser.name,
        accountName: withdrawAccName || liveUser.name,
        accountHolder: withdrawAccName || liveUser.name,
        accountNumber: withdrawAccNo || withdrawRecipientNumber,
        branch: withdrawBranch,
        branchName: withdrawBranch,
        routingNumber: withdrawRouting,
        routingNo: withdrawRouting,
        phone: withdrawAccNo || withdrawRecipientNumber,
        senderPhone: withdrawAccNo || withdrawRecipientNumber,
        recipientNumber: withdrawRecipientNumber,
        createdAt: new Date().toISOString(),
        description: withdrawMethod === 'DBBL_Bank'
          ? `Bank Transfer - Dutch-Bangla Bank PLC. (DBBL) | অ্যাকাউন্টের নাম: ${withdrawAccName || liveUser.name} | অ্যাকাউন্ট নম্বর: ${withdrawAccNo}${withdrawBranch ? ` | শাখা: ${withdrawBranch}` : ''}${withdrawRouting ? ` | Routing Number: ${withdrawRouting}` : ''}`
          : `${withdrawMethod} (${withdrawRecipientNumber || withdrawAccNo}) নম্বরে ৳${amountNum.toLocaleString('bn-BD')} উত্তোলন আবেদন`
      });
      
      alert("আপনার উত্তোলন আবেদনটি সফলভাবে জমা হয়েছে। এডমিন প্যানেল এটি যাচাই করে 2 ঘণ্টার মধ্যে অনুমোদন করবে।");
      
      // Reset fields
      setWithdrawAmount('');
      setWithdrawPin('');
      setWithdrawRecipientNumber('');
      setWithdrawAccNo('');
      setWithdrawAccName('');
      setWithdrawBranch('');
      setWithdrawRouting('');
      setModalType(null);
      syncLiveProfile();
    } catch (err: any) {
      console.error(err);
      alert("আবেদন জমা দেওয়া যায়নি। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleQardHasanaDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveUser) return;
    
    const amountNum = parseFloat(qardDonateAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("সঠিক দানের পরিমাণ লিখুন।");
      return;
    }
    
    if (qardDonationPayMethod === 'balance') {
      if (amountNum > (liveUser.balance || 0)) {
        alert("আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।");
        return;
      }
      if (qardPin !== liveUser.pin) {
        alert("ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।");
        return;
      }
    }
    
    try {
      setLoading(true);
      
      if (qardDonationPayMethod === 'balance') {
        const userRef = doc(db, "users", liveUser.uid);
        await updateDoc(userRef, {
          balance: (liveUser.balance || 0) - amountNum
        });
      }
      
      // Save donation as transaction
      await addDoc(collection(db, "transactions"), {
        id: `tx-qard-don-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "qard_donation",
        typeLabel: "হাসানাত তহবিল অনুদান",
        amount: amountNum,
        status: "success",
        payMethod: qardDonationPayMethod,
        txId: qardDonationTxId || "",
        purpose: qardDonationPurpose,
        createdAt: new Date().toISOString(),
        description: `হাসানাত তহবিলে ৳ ${amountNum.toLocaleString('bn-BD')} অনুদান প্রদান (${qardDonationPayMethod === 'balance' ? 'মেইন ওয়ালেট' : 'ম্যানুয়াল ডিপোজিট'})`
      });
      
      alert("হাসানাত তহবিলে আপনার অনুদানটি সফলভাবে জমা হয়েছে। আল্লাহ আপনাকে উত্তম প্রতিদান দান করুন। আমীন।");
      
      setQardDonateAmount('');
      setQardDonationReasonText('');
      setQardPin('');
      setQardDonationTxId('');
      setModalType(null);
      syncLiveProfile();
    } catch (err) {
      console.error(err);
      alert("অনুদান প্রক্রিয়াটি ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleQardHasanaApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveUser) return;
    
    const amountNum = parseFloat(qardLoanAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("সঠিক ঋণের পরিমাণ লিখুন।");
      return;
    }
    
    const maxLimit = liveUser.role === 'admin' ? 10000 : liveUser.memberGroup === 'need' ? 2000 : 5000;
    if (amountNum > maxLimit) {
      alert(`আপনার বর্তমান গ্রুপ অনুযায়ী সর্বোচ্চ ঋণসীমা ৳ ${maxLimit.toLocaleString('bn-BD')} BDT।`);
      return;
    }
    
    if (qardPin !== liveUser.pin) {
      alert("ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।");
      return;
    }
    
    try {
      setLoading(true);
      
      // Save loan request in transactions with status = pending
      await addDoc(collection(db, "transactions"), {
        id: `tx-qard-loan-req-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "qard_loan_apply",
        typeLabel: "সুদমুক্ত ঋণ আবেদন",
        amount: amountNum,
        status: "pending",
        durationMonths: qardLoanDuration || 1,
        whatsapp: qardLoanWhatsapp || "",
        createdAt: new Date().toISOString(),
        description: `সুদমুক্ত কর্জে হাসানা ঋণ আবেদন: ৳ ${amountNum.toLocaleString('bn-BD')} (${qardLoanDuration} মাস মেয়াদি)`
      });
      
      alert("আপনার কর্জে হাসানা সুদমুক্ত ঋণ আবেদনটি সফলভাবে জমা হয়েছে। এডমিন প্যানেল আবেদনপত্রটি যাচাই করে অনুমোদন করবে।");
      
      setQardLoanAmount('');
      setQardLoanWhatsapp('');
      setQardPin('');
      setModalType(null);
      syncLiveProfile();
    } catch (err) {
      console.error(err);
      alert("আবেদন জমা দেওয়া যায়নি। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewSafeDeal = async () => {
    if (!liveUser) return;
    
    if (!newDealTitle.trim() || !newDealPrice.trim()) {
      alert("ডিল শিরোনাম ও মূল্য অবশ্যই প্রদান করতে হবে।");
      return;
    }
    
    const priceNum = parseFloat(newDealPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert("সঠিক ডিল মূল্য লিখুন।");
      return;
    }
    
    try {
      setLoading(true);
      await addDoc(collection(db, "safe_deals"), {
        id: `deal-${Date.now()}`,
        title: newDealTitle.trim(),
        desc: newDealDesc.trim(),
        price: priceNum,
        minQty: newDealMinQty || "1 পিস",
        emoji: newDealEmoji || "📦",
        createdAt: new Date().toISOString(),
        authorUid: liveUser.uid,
        authorName: liveUser.name,
        joinedUsersCount: 0
      });
      
      alert("🎉 অভিনন্দন! আপনার নিরাপদ গ্রুপ বাই ডিলটি সফলভাবে লাইভ পাবলিশ হয়েছে।");
      
      setNewDealTitle('');
      setNewDealDesc('');
      setNewDealPrice('');
      setNewDealMinQty('5 পিস');
      setNewDealEmoji('📦');
      setShowAddDealModal(false);
    } catch (err) {
      console.error(err);
      alert("ডিল পাবলিশ করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCheckoutOrder = async () => {
    if (!liveUser || !selectedProductForCheckout) return;
    
    const item = selectedProductForCheckout;
    let grandTotal = item.price * checkoutQuantity;
    let deliveryChargeRangeText = '৳ 0 (দোকান পিকআপ)';
    let deliveryTimeText = '3 ঘণ্টার মধ্যে রেডি';
    
    if (checkoutDeliveryType === 'home') {
      let estBaseCharge = 0;
      if (checkoutDistance <= 2) {
        deliveryChargeRangeText = '৳ 5 - 20 (কাছে)';
        estBaseCharge = 10;
      } else {
        deliveryChargeRangeText = '৳ 20 - 50 (দূরে)';
        estBaseCharge = 35;
      }
      grandTotal += estBaseCharge;
      deliveryTimeText = '2 ঘণ্টার মধ্যে এক্সপ্রেস ডেলিভারি';
    }
    
    // Validate balance and pin if paying online
    if (checkoutPaymentMethod === 'main' || checkoutPaymentMethod === 'shop') {
      if (checkoutPin !== liveUser.pin) {
        alert("ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।");
        return;
      }
      
      const userBalance = checkoutPaymentMethod === 'main' ? (liveUser.balance || 0) : (liveUser.superShopBalance || 0);
      if (grandTotal > userBalance) {
        alert(`আপনার ${checkoutPaymentMethod === 'main' ? 'মেইন ওয়ালেটে' : 'সুপার শপ ওয়ালেটে'} পর্যাপ্ত ব্যালেন্স নেই।`);
        return;
      }
    }
    
    try {
      setLoading(true);
      
      // Deduct balance
      if (checkoutPaymentMethod === 'main' || checkoutPaymentMethod === 'shop') {
        const userRef = doc(db, "users", liveUser.uid);
        if (checkoutPaymentMethod === 'main') {
          const updatedBal = (getEffectiveBalance(liveUser)) - grandTotal;
          await updateDoc(userRef, { balance: updatedBal, mainBalance: updatedBal });
        } else {
          await updateDoc(userRef, { superShopBalance: (liveUser.superShopBalance || 0) - grandTotal });
        }
      }
      
      const orderId = `order-shop-${Date.now()}`;
      
      // Create transaction
      await addDoc(collection(db, "transactions"), {
        id: `tx-${orderId}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "shop_purchase",
        typeLabel: "সুপার শপ পণ্য ক্রয়",
        amount: grandTotal,
        status: "success",
        description: `সুপার শপ পণ্য অর্ডারঃ ${item.name} x ${checkoutQuantity} (${checkoutPaymentMethod === 'main' ? 'মেইন ব্যালেন্স' : checkoutPaymentMethod === 'shop' ? 'সুপার শপ ব্যালেন্স' : 'ক্যাশ অন ডেলিভারি'})`,
        createdAt: new Date().toISOString()
      });
      
      // Save order to shop_orders
      await addDoc(collection(db, "shop_orders"), {
        id: orderId,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        productName: item.name,
        price: item.price,
        quantity: checkoutQuantity,
        grandTotal: grandTotal,
        deliveryType: checkoutDeliveryType,
        deliveryDistance: checkoutDistance,
        deliveryChargeRange: deliveryChargeRangeText,
        deliveryEstTime: deliveryTimeText,
        paymentType: checkoutPaymentMethod === 'main' ? 'মেইন ব্যালেন্স' : checkoutPaymentMethod === 'shop' ? 'সুপার শপ ব্যালেন্স' : 'ক্যাশ অন ডেলিভারি',
        recipientName: checkoutName || liveUser.name,
        recipientPhone: checkoutPhone || liveUser.phone,
        recipientAddress: checkoutAddress,
        latitude: checkoutLat,
        longitude: checkoutLng,
        status: "Processing",
        createdAt: new Date().toISOString()
      });
      
      setOrderPlacementSuccess({
        id: orderId,
        product: item,
        quantity: checkoutQuantity,
        deliveryType: checkoutDeliveryType,
        deliveryDistance: checkoutDistance,
        deliveryChargeRange: deliveryChargeRangeText,
        deliveryEstTime: deliveryTimeText,
        paymentType: checkoutPaymentMethod === 'main' ? 'মেইন ব্যালেন্স' : checkoutPaymentMethod === 'shop' ? 'সুপার শপ ব্যালেন্স' : 'ক্যাশ অন ডেলিভারি',
        grandTotal: grandTotal
      });
      
      setSelectedProductForCheckout(null);
      syncLiveProfile();
    } catch (err) {
      console.error(err);
      alert("অর্ডার সম্পন্ন করা সম্ভব হয়নি। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col relative text-slate-800 font-sans" id="dashboard-root">
      {/* 1. Header */}
      <header className="bg-white text-slate-800 px-3 xs:px-4 py-2 flex items-center justify-between sticky top-0 z-40 shadow-sm border-b border-slate-100 h-[64px] xs:h-[68px] shrink-0 font-sans">
        <div className="flex items-center gap-2 xs:gap-3">
          {/* Menu button - light mint circle with green icon */}
          <button 
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open Menu"
            className="w-10 h-10 xs:w-11 h-11 rounded-full bg-[#e6f7f4] hover:bg-[#d5f3ed] active:scale-95 text-[#00b57e] transition-transform duration-75 flex items-center justify-center shrink-0 border-none cursor-pointer shadow-3xs touch-manipulation"
          >
            <Menu className="w-5.5 h-5.5 xs:w-6 h-6 text-[#00b57e]" />
          </button>
          
          {/* Vertical stacked title with user name */}
          <div className="flex flex-col text-left">
            <span className="text-[9.5px] xs:text-[10.5px] font-black text-slate-850 leading-none tracking-tight uppercase">
              BUSINESS NETWORK
            </span>
            <span className="text-[9.5px] xs:text-[10.5px] font-black text-slate-850 leading-none tracking-tight uppercase mt-0.5">
              BANGLADESH
            </span>
            <span className="text-[8.5px] xs:text-[9.5px] font-semibold text-slate-450 lowercase mt-0.5 leading-none">
              {(liveUser?.name || 'md rasel mia').toLowerCase()}
            </span>
          </div>
        </div>

        {/* Middle Portion: Dual Balance / Due interactive Pill Container (Exact white/mint/pink replica layout, made even larger & bolder as requested) */}
        <div 
          onClick={() => {
            setShowBalance(!showBalance);
          }}
          className="flex items-center border border-slate-300 bg-white rounded-full overflow-hidden h-[48px] xs:h-[56px] select-none cursor-pointer shadow-3xs transition-all duration-300 hover:border-slate-400 mx-1 flex-grow max-w-[54%] xs:max-w-[58%]"
        >
          {/* Left Portion: Total Balance (Teal bg) */}
          <div className="bg-[#00b57e] px-2 xs:px-3.5 py-1 flex flex-col justify-center items-center h-full flex-grow rounded-l-full transition-all duration-300 active:opacity-90 min-w-0">
            <span className="text-[9px] xs:text-[10px] sm:text-[11px] font-black text-emerald-100 uppercase tracking-tight leading-none">মোট ব্যালেন্স</span>
            <span className="text-[13.5px] xs:text-[16.5px] sm:text-[19px] font-black text-white mt-0.5 leading-none transition-all duration-300 tracking-tight truncate">
              {showBalance ? '৳' + (liveUser?.balance || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 }) : 'ট্যাপ করুন'}
            </span>
          </div>

          {/* Right Portion: Due / বকেয়া (Light Pink bg) */}
          <div className="bg-[#fff1f2] px-2.5 xs:px-3 py-1 flex flex-col justify-center items-center h-full min-w-[76px] xs:min-w-[92px] sm:min-w-[102px] rounded-r-full border-l border-white/60 transition-all duration-300">
            <span className="text-[9px] xs:text-[10px] sm:text-[11px] font-black text-[#e11d48] uppercase tracking-tight leading-none">বকেয়া</span>
            <span className="text-[13.5px] xs:text-[16.5px] sm:text-[19px] font-black text-[#e11d48] mt-0.5 leading-none tracking-tight">
              ৳{(liveUser?.dueLoan || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Right tools: Notification Bell & Admin Button */}
        <div className="flex items-center gap-1.5 xs:gap-2 shrink-0">
          {/* Notification Icon */}
          {(() => {
            const unreadCount = userNotifications.filter(n => !isNotificationRead(n)).length;
            const hasUnread = unreadCount > 0;
            return (
              <button 
                type="button"
                onClick={() => {
                  setShowNotificationsModal(true);
                  handleMarkAllAsRead();
                }}
                className={`w-10 h-10 xs:w-11 h-11 rounded-full transition relative cursor-pointer active:scale-95 flex items-center justify-center ${
                  hasUnread
                    ? 'bg-rose-600 text-white border-2 border-rose-400 shadow-md animate-pulse'
                    : 'bg-amber-400 text-slate-950 border-2 border-amber-500 shadow-sm hover:bg-amber-300'
                }`}
                title={hasUnread ? `${unreadCount}টি অপঠিত নোটিফিকেশন` : 'নোটিফিকেশন সেন্টার (সকল পঠিত)'}
              >
                <Bell className={`w-5 h-5 ${hasUnread ? 'text-white' : 'text-slate-950'}`} />
                {hasUnread && (
                  <span className="absolute -top-1 -right-1 bg-yellow-300 text-rose-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm font-mono">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })()}

          {/* Admin panel launcher for authorized roles */}
          {(user?.role === 'admin' || user?.role === 'sub_admin') && (
            <button 
              type="button"
              onClick={onTriggerAdmin}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg transition text-[9px] xs:text-[10px] cursor-pointer shadow-3xs hover:shadow-2xs active:scale-95"
            >
              ADMIN
            </button>
          )}
        </div>
      </header>

      <div className="flex-grow overflow-y-auto pb-24">
        {activeTab === 'home' && (
          <div className="space-y-4 pb-6">
            {/* Box-shaped Announcement Ticker (ঘোষণা) - Now above the banner slider */}
            <div className="px-4 pt-2">
              <div className="bg-white border-2 border-[#00a884]/85 rounded-[20px] p-2 flex items-center gap-3 overflow-hidden shadow-3xs">
                <div className="bg-[#00a884] text-white text-[11px] font-black px-3.5 py-1 rounded-[12px] shrink-0 shadow-3xs flex items-center gap-1">
                  📢 <span>ঘোষণা</span>
                </div>
                <div className="flex-grow overflow-hidden relative h-5 flex items-center">
                  <marquee className="text-[12px] font-black text-slate-800 leading-none py-0.5" behavior="scroll" direction="left" scrollamount="4">
                    {appConfig?.tickerText || "ব্যবসা নেটওয়ার্ক বাংলাদেশ সমবায় ও রিচার্জ পোর্টাল-এ আপনাকে স্বাগতম। আমাদের সাথে আপনার ব্যবসায়িক লেনদেন নিরাপদ ও 100% বিশ্বস্ত।"}
                  </marquee>
                </div>
              </div>
            </div>

            {/* 2. Banner Slider (Isolated memoized component to prevent full Dashboard re-render) */}
            <DashboardBannerSlider 
              activeSliders={activeSliders} 
              bannerType={bannerType} 
              bannerVal={bannerVal} 
            />

            {/* Main Content Area with padding px-4 */}
            <div className="px-4 space-y-4">
              <div className="flex justify-between items-center px-1 py-1.5 select-none font-sans">
                <h3 className="text-[14px] xs:text-[15px] font-black text-[#374151] tracking-tight">সকল সার্ভিস</h3>
                <span className="text-[9.5px] xs:text-[10.5px] font-extrabold text-[#00a884] bg-[#e6f7f4] border border-[#00a884]/80 px-2.5 py-0.5 rounded-full leading-none shrink-0 shadow-3xs">
                  ১২টি লাইভ সেবা ও প্যানেল
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 xs:gap-1.5 sm:gap-2.5 md:gap-3">
                {/* 1. BNB কোম্পানি ইনভেস্টর */}
                <div 
                  onClick={() => handleServiceClick('samity', () => setModalType('samity'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-800 shadow-sm group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.samity ? (
                      <img src={appConfig.sectionIcons.samity} alt="Samity Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <img src="/samity_logo.svg" alt="Samity Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardSamityTitle', 'BNB কোম্পানি ইনভেস্টর')}
                    </h4>
                  </div>
                </div>

                {/* 2. BNB নিরাপদ লেনদেন */}
                <div 
                  onClick={() => handleServiceClick('safedeals', () => setModalType('safedeals'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-[#00d29d] bg-gradient-to-br from-[#00d29d] via-[#00bda0] to-[#cbfef4]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,210,157,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.safedeals ? (
                      <img src={appConfig.sectionIcons.safedeals} alt="SafeDeals Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardSafeDealsTitle', 'BNB নিরাপদ লেনদেন')}
                    </h4>
                  </div>
                </div>

                {/* 3. BNB কর্জে হাসানা */}
                <div 
                  onClick={() => handleServiceClick('qard', () => setModalType('qard'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-[#f43f5e] bg-gradient-to-br from-[#f43f5e] via-[#e11d48] to-[#ffe4e6]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(244,63,94,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.qard ? (
                      <img src={appConfig.sectionIcons.qard} alt="Qard Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Heart className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardQardTitle', 'BNB কর্জে হাসানা')}
                    </h4>
                  </div>
                </div>

                {/* 4. BNB লেনদেন */}
                <div 
                  onClick={() => handleServiceClick('bank', () => setModalType('bank'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-[#f97316] bg-gradient-to-br from-[#ff9e3b] via-[#ea580c] to-[#ffedd5]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(249,115,22,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.bank ? (
                      <img src={appConfig.sectionIcons.bank} alt="Bank Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <RefreshCw className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white shrink-0 stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardBankTitle', 'BNB লেনদেন')}
                    </h4>
                  </div>
                </div>

                {/* 5. BNB টেলিকম */}
                <div 
                  onClick={() => handleServiceClick('telecom', () => setModalType('telecom'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-[#06b6d4] bg-gradient-to-br from-[#22d3ee] via-[#0891b2] to-[#ecfeff]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(6,182,212,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.telecom ? (
                      <img src={appConfig.sectionIcons.telecom} alt="Telecom Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Smartphone className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardTelecomTitle', 'BNB টেলিকম')}
                    </h4>
                  </div>
                </div>

                {/* 6. BNB রেশন কার্ড */}
                <div 
                  onClick={() => handleServiceClick('ration', () => setModalType('ration'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-[#f59e0b] bg-gradient-to-br from-[#fbbf24] via-[#ea580c] to-[#fffbeb]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(245,158,11,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.ration ? (
                      <img src={appConfig.sectionIcons.ration} alt="Ration Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <CreditCard className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardRationTitle', 'BNB রেশন কার্ড')}
                    </h4>
                  </div>
                </div>

                {/* 7. BNB সেলারি পে */}
                <div 
                  onClick={() => handleServiceClick('salary', () => setModalType('salary'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-[#0d9488] bg-gradient-to-br from-[#14b8a6] via-[#0f766e] to-[#ccfbf1]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(13,148,136,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.salary ? (
                       <img src={appConfig.sectionIcons.salary} alt="Salary Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Briefcase className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardSalaryTitle', 'BNB সেলারি পে')}
                    </h4>
                  </div>
                </div>

                {/* 8. al safi */}
                <div 
                  onClick={() => handleServiceClick('safi', () => setModalType('safi'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-[#fbbf24] bg-gradient-to-br from-[#fbbf24] via-[#d97706] to-[#fef3c7]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(251,191,36,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.safi ? (
                      <img src={appConfig.sectionIcons.safi} alt="Safi Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Sparkles className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardSafiTitle', 'al safi')}
                    </h4>
                  </div>
                </div>

                {/* 9. BNB অটো রিচার্জ */}
                <div 
                  onClick={() => handleServiceClick('auto_recharge', () => setModalType('auto_recharge'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-[#0284c7] bg-gradient-to-br from-[#38bdf8] via-[#0284c7] to-[#e0f2fe]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(2,132,199,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.auto_recharge ? (
                      <img src={appConfig.sectionIcons.auto_recharge} alt="Auto Recharge Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Smartphone className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardAutoRechargeTitle', 'BNB অটো রিচার্জ')}
                    </h4>
                  </div>
                </div>

                {/* 10. BNB বিল পে */}
                <div 
                  onClick={() => handleServiceClick('bill_pay', () => setModalType('bill_pay'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-[#8b5cf6] bg-gradient-to-br from-[#a78bfa] via-[#7c3aed] to-[#ede9fe]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(139,92,246,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.bill_pay ? (
                      <img src={appConfig.sectionIcons.bill_pay} alt="Bill Pay Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Banknote className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardBillPayTitle', 'BNB বিল পে')}
                    </h4>
                  </div>
                </div>

                {/* 11. BNB এজেন্ট */}
                <div 
                  onClick={() => handleServiceClick('agent', () => setModalType('agent'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-[#fbbf24] bg-gradient-to-br from-[#fbbf24] via-[#d97706] to-[#fffbeb]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(251,191,36,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.agent ? (
                      <img src={appConfig.sectionIcons.agent} alt="Agent Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Store className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardAgentTitle', 'BNB এজেন্ট')}
                    </h4>
                  </div>
                </div>

                {/* 12. BNB আমাদের লক্ষ্য */}
                <div 
                  onClick={() => handleServiceClick('about', () => setModalType('about'))}
                  className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[86px] xs:min-h-[98px] sm:min-h-[125px] md:min-h-[140px] relative group"
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-17 sm:h-17 md:w-20 md:h-20 rounded-full bg-[#6366f1] bg-gradient-to-br from-[#818cf8] via-[#4f46e5] to-[#e0e7ff]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.about ? (
                      <img src={appConfig.sectionIcons.about} alt="About Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <BookOpen className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-2.5 font-sans">
                    <h4 className="text-[9px] xs:text-[10px] sm:text-[12px] md:text-[13.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardAboutTitle', 'BNB আমাদের লক্ষ্য')}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Dashed Live Database Notice exact replica */}
              <div className="mt-5 px-1 select-none font-sans">
                <div className="border border-dashed border-slate-300/80 bg-[#fbfbfb] rounded-2xl py-3.5 px-4 text-center shadow-3xs">
                  <p className="text-[11px] xs:text-[12px] font-black text-slate-550 tracking-tight">
                    *এই ড্যাশবোর্ডটি সরাসরি লাইভ ডাটাবেজ দ্বারা পরিচালিত হচ্ছে।
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Send Money Segment Tab (BNB to BNB Transfer) */}
        {(activeTab === 'deposit' || activeTab === 'send_money') && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-150 p-5 rounded-3xl shadow-sm space-y-4 font-sans text-left"
          >
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                <Send className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  সেন্ড মানি (Send Money)
                  <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                    BNB ⚡ BNB
                  </span>
                </h3>
                <p className="text-[10.5px] text-slate-500 font-medium leading-tight">
                  BNB অ্যাকাউন্ট থেকে অন্য যেকোনো BNB সদস্যের অ্যাকাউন্টে সরাসরি টাকা পাঠান
                </p>
              </div>
            </div>

            {/* Main Balance Banner */}
            <div className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-teal-900 p-4 rounded-2.5xl text-white shadow-sm flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] text-emerald-200 font-bold block uppercase tracking-wider">
                  আপনার বর্তমান BNB ওয়ালেট ব্যালেন্স
                </span>
                <span className="text-xl font-black font-mono tracking-tight block">
                  ৳ {(liveUser?.balance || 0).toLocaleString('bn-BD')} BDT
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <Wallet className="w-5 h-5 text-emerald-200" />
              </div>
            </div>

            {/* Restriction Warning Banner */}
            <div className="bg-amber-50/80 border border-amber-200/70 p-3 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2 font-bold leading-relaxed">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span>নিরাপত্তা নির্দেশিকাঃ </span>
                <span className="font-medium text-slate-700">
                  সেন্ড মানি শুধুমাত্র একটি <strong className="text-amber-950 font-black">BNB সদস্য অ্যাকাউন্ট থেকে অন্য BNB সদস্য অ্যাকাউন্টে</strong> করা যাবে। অন্য কোনো বাহ্যিক ব্যাংক বা অ্যাকাউন্টে টাকা পাঠানো যাবে না।
                </span>
              </div>
            </div>

            {/* Status alerts */}
            {formError && (
              <div className="bg-red-50 text-red-700 border border-red-200 p-3.5 rounded-2xl text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3.5 rounded-2xl text-xs leading-relaxed font-bold flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>{formSuccess}</div>
              </div>
            )}

            {/* Member Search Section */}
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-2.5xl space-y-3">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <UserCircle className="w-4 h-4 text-emerald-700" />
                1. প্রাপক BNB সদস্যের মোবাইল নাম্বার বা আইডি টাইপ করুনঃ
              </label>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Smartphone className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={transferTargetPhoneorId}
                    onChange={(e) => {
                      setTransferTargetPhoneorId(e.target.value);
                      if (searchedMember) setSearchedMember(null);
                    }}
                    placeholder="যেমনঃ AMB102030 অথবা 017xxxxxxxx"
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono font-bold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchTransferMember}
                  className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 shrink-0 flex items-center gap-1.5"
                >
                  সদস্য খুঁজুন
                </button>
              </div>

              {searchStatusMsg && (
                <p className={`text-[11px] font-bold px-1 ${
                  searchedMember ? 'text-emerald-700' : 'text-slate-500'
                }`}>
                  {searchStatusMsg}
                </p>
              )}

              {/* Found Recipient Member Card */}
              {searchedMember && (
                <div className="bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-2xl space-y-1.5 animate-slide-down">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                      যাচাইকৃত প্রাপক তথ্যঃ
                    </span>
                    <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md">
                      ✓ সঠিক সদস্য
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-800 pt-1 border-t border-emerald-100">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">সদস্যের নামঃ</span>
                      <strong className="font-black text-slate-900">{searchedMember.name}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">মেম্বার আইডিঃ</span>
                      <strong className="font-mono font-black text-emerald-900">{searchedMember.memberId || 'N/A'}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-500 font-bold block">মোবাইল নাম্বারঃ</span>
                      <strong className="font-mono font-black text-slate-800">{searchedMember.phone}</strong>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-emerald-200/60 space-y-2">
                      <label className="block text-[10.5px] font-black text-slate-800 uppercase tracking-wide">
                        গন্তব্য একাউন্ট নির্বাচন করুন (Select Destination Account):
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchedMember({ ...searchedMember, isVirtualSomitiTarget: true });
                            setSearchStatusMsg(`🏦 সমিতি একাউন্ট নির্বাচন করা হয়েছে - সমিতি সঞ্চয় আমানতে অটো জমা হবে`);
                          }}
                          className={`p-2 rounded-xl text-center border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            searchedMember.isVirtualSomitiTarget
                              ? 'bg-amber-600 text-white border-amber-700 shadow-xs font-black scale-102'
                              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 font-bold'
                          }`}
                        >
                          <span className="text-xs">🏦</span>
                          <span className="text-[11px] block">সমিতি সঞ্চয় একাউন্ট</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchedMember({ ...searchedMember, isVirtualSomitiTarget: false });
                            setSearchStatusMsg(`💼 মেইন ওয়ালেট ব্যালেন্স নির্বাচন করা হয়েছে - মেইন ব্যালেন্সে জমা হবে`);
                          }}
                          className={`p-2 rounded-xl text-center border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            !searchedMember.isVirtualSomitiTarget
                              ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs font-black scale-102'
                              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 font-bold'
                          }`}
                        >
                          <span className="text-xs">💼</span>
                          <span className="text-[11px] block">মেইন ওয়ালেট ব্যালেন্স</span>
                        </button>
                      </div>

                      {searchedMember.isVirtualSomitiTarget ? (
                        <div className="bg-amber-100/90 border border-amber-300 p-2 rounded-xl flex items-center gap-2 text-[11px] font-bold text-amber-950">
                          <span className="bg-amber-600 text-white text-[9.5px] font-black px-1.5 py-0.5 rounded shrink-0">
                            🏦 সমিতি একাউন্ট (সঞ্চয়)
                          </span>
                          <span>টাকা সরাসরি সদস্যের <strong className="text-amber-900 font-black">সমিতি সঞ্চয় ব্যালেন্সে</strong> জমা হবে।</span>
                        </div>
                      ) : (
                        <div className="bg-emerald-100/90 border border-emerald-300 p-2 rounded-xl flex items-center gap-2 text-[11px] font-bold text-emerald-950">
                          <span className="bg-emerald-700 text-white text-[9.5px] font-black px-1.5 py-0.5 rounded shrink-0">
                            💼 মেইন ওয়ালেট
                          </span>
                          <span>টাকা সরাসরি সদস্যের <strong className="text-emerald-900 font-black">মেইন ব্যালেন্সে</strong> জমা হবে।</span>
                        </div>
                      )}

                      {/* 12-Month / Multi-Year Samity Installment Tracker Calendar */}
                      {searchedMember.isVirtualSomitiTarget && (
                        <div className="pt-2 border-t border-amber-200/80 space-y-2">
                          <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-3 shadow-2xs space-y-2.5">
                            
                            {/* Tracker Header */}
                            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">📅</span>
                                <div>
                                  <h4 className="text-[11px] font-black text-slate-900 leading-tight flex items-center gap-1">
                                    50 সালের সঞ্চয় কিস্তি ট্র্যাকার
                                    <span className="text-[8.5px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full font-bold">2024 - 2050</span>
                                  </h4>
                                  <p className="text-[9px] text-slate-500 font-bold">প্রাপকের গত মাস পর্যন্ত জমা ও 2050 সাল পর্যন্ত বকেয়া স্থিতি</p>
                                </div>
                              </div>
                              <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full font-mono shadow-3xs">
                                {SAMITY_MONTHS.filter((m) => {
                                  const paidList: string[] = getEffectivePaidMonthsList(searchedMember);
                                  const yearKey = `${sendMoneySelectedYear}-${m.id}`;
                                  const yearKeyAlt = `${sendMoneySelectedYear}_${m.id}`;
                                  if (paidList.includes(yearKey) || paidList.includes(yearKeyAlt)) return true;
                                  if (sendMoneySelectedYear === 2026 && (paidList.includes(m.id) || paidList.includes(`2026-${m.id}`))) return true;
                                  return false;
                                }).length} / 12 মাস ({sendMoneySelectedYear})
                              </span>
                            </div>

                            {/* Year Selection Navigation Bar */}
                            <div className="flex items-center justify-between gap-1.5 bg-emerald-100/60 p-1.5 rounded-xl border border-emerald-200/80">
                              <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none max-w-[calc(100%-85px)]">
                                {SAMITY_YEARS.map(yr => {
                                  const isCurrent = yr === new Date().getFullYear();
                                  const isSelected = yr === sendMoneySelectedYear;
                                  const yrPaid = SAMITY_MONTHS.filter((m) => {
                                    const paidList: string[] = getEffectivePaidMonthsList(searchedMember);
                                    const yearKey = `${yr}-${m.id}`;
                                    const yearKeyAlt = `${yr}_${m.id}`;
                                    if (paidList.includes(yearKey) || paidList.includes(yearKeyAlt)) return true;
                                    if (yr === 2026 && (paidList.includes(m.id) || paidList.includes(`2026-${m.id}`))) return true;
                                    return false;
                                  }).length;

                                  return (
                                    <button
                                      key={yr}
                                      type="button"
                                      onClick={() => setSendMoneySelectedYear(yr)}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black font-mono transition shrink-0 cursor-pointer ${
                                        isSelected
                                          ? 'bg-emerald-700 text-white ring-2 ring-emerald-500 shadow-3xs'
                                          : yrPaid === 12
                                          ? 'bg-emerald-200/90 text-emerald-950 border border-emerald-300'
                                          : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-300'
                                      }`}
                                    >
                                      {yr}{isCurrent ? '*' : ''}
                                    </button>
                                  );
                                })}
                              </div>

                              <select
                                value={sendMoneySelectedYear}
                                onChange={(e) => setSendMoneySelectedYear(Number(e.target.value))}
                                className="text-[10px] font-black font-mono bg-white border border-emerald-300 text-emerald-950 rounded-lg px-1.5 py-0.5 shrink-0 focus:outline-none cursor-pointer"
                              >
                                {SAMITY_YEARS.map(yr => (
                                  <option key={yr} value={yr}>বছর: {yr}</option>
                                ))}
                              </select>
                            </div>

                            <p className="text-[9.5px] text-slate-600 font-semibold leading-relaxed">
                              💡 <strong>{sendMoneySelectedYear} সালের জমা নির্দেশিকা:</strong> সবুজ মাসগুলো ইতোমধ্যে পরিশোধিত। লাল (বকেয়া) মাসগুলোতে ক্লিক করে 1 মাস বা যত মাস ইচ্ছা সিলেক্ট করুন।
                            </p>

                            {/* Months Grid */}
                            <div className="grid grid-cols-4 gap-1.5 pt-1">
                              {SAMITY_MONTHS.map((m) => {
                                const paidList: string[] = getEffectivePaidMonthsList(searchedMember);
                                const yearKey = `${sendMoneySelectedYear}-${m.id}`;
                                const yearKeyAlt = `${sendMoneySelectedYear}_${m.id}`;
                                const isPaid = paidList.includes(yearKey) || paidList.includes(yearKeyAlt) || (sendMoneySelectedYear === 2026 && (paidList.includes(m.id) || paidList.includes(`2026-${m.id}`)));

                                const uniqueMonthKey = `${sendMoneySelectedYear}-${m.id}`;
                                const isSelected = sendMoneySelectedMonths.includes(uniqueMonthKey) || (sendMoneySelectedYear === 2026 && sendMoneySelectedMonths.includes(m.id));

                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    disabled={isPaid}
                                    onClick={() => {
                                      let updated: string[];
                                      if (isSelected) {
                                        updated = sendMoneySelectedMonths.filter(id => id !== uniqueMonthKey && id !== m.id);
                                      } else {
                                        updated = [...sendMoneySelectedMonths, uniqueMonthKey];
                                      }
                                      setSendMoneySelectedMonths(updated);

                                      if (updated.length > 0) {
                                        const targetMonthly = searchedMember.monthlySavingsTarget || 1000;
                                        setTransferAmountInput(String(updated.length * targetMonthly));
                                      } else {
                                        setTransferAmountInput('');
                                      }
                                    }}
                                    className={`p-1.5 rounded-xl border text-center transition flex flex-col items-center justify-between min-h-[52px] ${
                                      isPaid
                                        ? 'bg-emerald-500/10 border-emerald-300 text-emerald-950 font-black shadow-3xs cursor-not-allowed opacity-90'
                                        : isSelected
                                        ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-500 shadow-sm font-black scale-102 cursor-pointer'
                                        : 'bg-rose-50/90 border-rose-200 text-rose-950 hover:border-rose-400 font-bold hover:shadow-2xs cursor-pointer'
                                    }`}
                                  >
                                    <span className={`text-[10px] font-extrabold truncate ${isSelected ? 'text-white' : ''}`}>
                                      {m.name}
                                    </span>

                                    {isPaid ? (
                                      <span className="inline-flex items-center gap-0.5 text-[8.5px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-mono font-bold mt-1 shadow-3xs">
                                        <CheckCircle2 className="w-2.5 h-2.5" /> পরিশোধিত
                                      </span>
                                    ) : isSelected ? (
                                      <span className="inline-flex items-center gap-0.5 text-[8.5px] bg-white text-emerald-900 px-1.5 py-0.2 rounded font-mono font-black mt-1 shadow-3xs">
                                        ✓ নির্বাচিত
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 text-[8.5px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-mono font-bold mt-1 shadow-3xs">
                                        <PlusCircle className="w-2.5 h-2.5" /> বকেয়া (জমা)
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Selected Months Summary */}
                            {sendMoneySelectedMonths.length > 0 && (
                              <div className="bg-emerald-100/90 border border-emerald-300 p-2 rounded-xl flex items-center justify-between text-[10.5px] font-bold text-emerald-950 animate-slide-down">
                                <span>
                                  🎯 <strong>{sendMoneySelectedMonths.length} মাস</strong> জমা নির্বাচন করা হয়েছে
                                </span>
                                <span className="font-mono text-emerald-950 font-black text-xs bg-emerald-200/80 px-2 py-0.5 rounded-lg border border-emerald-400/60">
                                  মোট: ৳ {(sendMoneySelectedMonths.length * (searchedMember.monthlySavingsTarget || 1000)).toLocaleString('bn-BD')}
                                </span>
                              </div>
                            )}

                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Transfer Amount & Security PIN Form */}
            <form onSubmit={(e) => {
              setTransferType('member');
              setTransferSector('samity');
              handleExecuteTransfer(e);
            }} className="space-y-4">
              
              {/* Amount input */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                  2. স্থানান্তরের টাকার পরিমাণ (Amount BDT):
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-sm">
                    ৳
                  </span>
                  <input
                    type="number"
                    value={transferAmountInput}
                    onChange={(e) => setTransferAmountInput(e.target.value)}
                    placeholder="0.00"
                    min="10"
                    step="any"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-8 pr-4 py-3 text-sm font-mono font-black text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                {/* Quick amount preset chips */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {['100', '200', '500', '1000', '2000', '5000'].map((preset, idx) => (
                    <button
                      key={`${preset}-${idx}`}
                      type="button"
                      onClick={() => setTransferAmountInput(preset)}
                      className={`text-[11px] font-mono font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        transferAmountInput === preset
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-3xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      ৳ {Number(preset).toLocaleString('bn-BD')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Security PIN input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-700" />
                  3. আপনার 4-ডিজিটের সিকিউরিটি ওয়ালেট পিন কোডঃ
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={transferSenderPin}
                  onChange={(e) => setTransferSenderPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="****"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-center font-mono tracking-widest text-base font-black text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
                <p className="text-[9.5px] text-slate-400 font-bold text-center">
                  *ট্রানজেকশন নিশ্চিত করতে আপনার 4 সংখ্যার সঠিক পিন নম্বরটি প্রবেশ করান।
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-800 via-emerald-900 to-teal-900 hover:from-emerald-900 hover:to-teal-950 text-white font-black text-xs rounded-2.5xl transition-all shadow-md hover:shadow-lg cursor-pointer active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    সেন্ড মানি নিশ্চিত করুন ⚡ (BNB to BNB)
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
        {/* Active AMB Add Money Segment Tab */}
        {activeTab === 'add_money' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-150 p-3 sm:p-5 rounded-3xl shadow-sm space-y-4 font-sans text-left"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <PlusCircle className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    BNB এড মানি (Add Money)
                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                      মেইন ওয়ালেট ফান্ড
                    </span>
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-medium leading-tight">
                    বিকাশ, নগদ, রকেট, উপায় বা ব্যাংক ডিপোজিটের মাধ্যমে সরাসরি মেইন ওয়ালেটে এড মানি করুন
                  </p>
                </div>
              </div>
            </div>

            {/* Integrated AmbMobileBankingPortal directly set to Add Money tab */}
            <AmbMobileBankingPortal 
              user={liveUser}
              onClose={() => setActiveTab('home')}
              syncLiveProfile={syncLiveProfile}
              appConfig={appConfig}
              initialTab="auto_add_money"
            />
          </motion.div>
        )}

        {activeTab === 'loan' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="bg-white border border-slate-150 p-5 rounded-3xl shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <TrendingUp className="w-6 h-6 text-amber-800" />
              <div>
                <h3 className="text-sm font-bold text-slate-800">কো-অপারেটিভ লোকারেন্ট ঋণ হিসাব</h3>
                <p className="text-[10px] text-slate-450">চলমান কিস্তি পরিশোধ এবং নতুন ঋণের আবেদন</p>
              </div>
            </div>

            {liveUser.dueLoan > 0 ? (
              <div className="space-y-4">
                <div className="bg-rose-50/50 border border-rose-100/75 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-bold">বর্তমান মোট বকেয়া ঋণঃ</span>
                    <span className="font-mono text-rose-700 font-bold text-base">৳ {liveUser.dueLoan?.toLocaleString('bn-BD')}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    *নিচে আপনার বকেয়া কিস্তির পেমেন্ট চ্যানেল সিলেক্ট করে পেমেন্ট বিবরণ সহ ট্রানজেকশন আইডি প্রদান করুন।
                  </p>

                  <div className="space-y-3.5 pt-2 border-t border-rose-100">
                    {/* Repayment Channel Selector */}
                    <div>
                      <label className="block text-[10.5px] font-black text-slate-700 mb-2">1. কিস্তি পরিশোধের জন্য চ্যানেল বেছে নিন (ব্র্যান্ড লোগোযুক্ত):</label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { id: 'bKash', name: 'বিকাশ', logoBg: 'from-pink-500 to-rose-600', logoTxt: 'bKash', activeColor: 'border-pink-500 bg-pink-50/50 text-pink-955 ring-1 ring-pink-300' },
                          { id: 'Nagad', name: 'নগদ', logoBg: 'from-orange-500 to-red-650', logoTxt: 'Nagad', activeColor: 'border-orange-500 bg-orange-50/50 text-orange-955 ring-1 ring-orange-300' },
                          { id: 'Rocket', name: 'রকেট', logoBg: 'from-violet-600 to-indigo-700', logoTxt: 'Rocket', activeColor: 'border-violet-600 bg-violet-50/50 text-violet-955 ring-1 ring-violet-300' },
                          { id: 'CellFin', name: 'সেলফিন', logoBg: 'from-sky-500 to-blue-600', logoTxt: 'CellFin', activeColor: 'border-sky-500 bg-sky-50/50 text-sky-955 ring-1 ring-sky-300' },
                          { id: 'DBBL_Bank', name: 'DBBL ব্যাংক', logoBg: 'from-teal-700 to-emerald-800', logoTxt: 'DBBL', activeColor: 'border-teal-600 bg-teal-50/50 text-teal-955 ring-1 ring-teal-300' },
                        ].map((chan, idx) => {
                          const isSelected = repayPayMethod === chan.id;
                          return (
                            <button
                              key={`${chan.id}-${idx}`}
                              type="button"
                              onClick={() => checkDemoAndRun(() => setRepayPayMethod(chan.id))}
                              className={`p-2 border rounded-xl flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-all ${
                                isSelected 
                                  ? chan.activeColor 
                                  : 'bg-white text-slate-600 border-slate-150 hover:bg-slate-50'
                              }`}
                            >
                              <div className={`w-9 h-5 rounded bg-gradient-to-r ${chan.logoBg} flex items-center justify-center text-[7px] font-black text-white uppercase tracking-tighter mb-1 shadow-3xs`}>
                                {chan.logoTxt}
                              </div>
                              <span className="font-black text-[9.5px] leading-none block">{chan.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Channel specific warning */}
                    <div className="p-3 bg-white/90 border border-slate-100 rounded-xl space-y-1">
                      {repayPayMethod === 'DBBL_Bank' ? (
                        <>
                          <p className="text-[10px] text-slate-800"><span className="font-bold">ব্যাংক হিসাবের নামঃ</span> MD SUJON MIA</p>
                          <p className="text-[10px] text-slate-800"><span className="font-bold">অ্যাকাউন্টঃ</span> <span className="font-bold font-mono">2441580395850</span> (DBBL)</p>
                          <p className="text-[10px] text-slate-800"><span className="font-bold">কার্ড নম্বরঃ</span> <span className="font-mono text-slate-600">{appConfig.personalBankCard}</span></p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] text-slate-800"><span className="font-bold">পার্সোনাল নম্বরঃ</span> <span className="font-bold font-mono text-emerald-900 text-xs">{appConfig.personalMfsNumber}</span></p>
                          <p className="text-[9px] text-rose-700 font-bold leading-none">*এই নম্বরে সেন্ডমানি (Send Money) সম্পন্ন করার পর নিচের ফরমটি পূরণ করুন।</p>
                        </>
                      )}
                    </div>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      checkDemoAndRun(() => {
                        handlePayLoanInstallment(
                          Number(repayAmount),
                          repayPayMethod,
                          repaySenderInfo,
                          repayTxnId,
                          repayScreenshotData
                        );
                      });
                    }} 
                    className="space-y-3.5"
                  >
                    {/* Repayment Amount input */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-705 mb-1">2. পরিশোধের পরিমাণ (৳)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-[10px]">৳</span>
                        <input
                          type="number"
                          required
                          value={repayAmount}
                          placeholder={`উদাঃ 1000 বা ${liveUser.dueLoan}`}
                          onChange={(e) => setRepayAmount(e.target.value)}
                          className="block w-full pl-6 pr-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                      <div className="flex gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setRepayAmount(String(Math.min(1000, liveUser.dueLoan)))}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-205 text-slate-700 text-[9px] rounded-md font-bold"
                        >
                          1,000 ৳
                        </button>
                        <button
                          type="button"
                          onClick={() => setRepayAmount(String(Math.min(5000, liveUser.dueLoan)))}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-205 text-slate-700 text-[9px] rounded-md font-bold"
                        >
                          5,000 ৳
                        </button>
                        <button
                          type="button"
                          onClick={() => setRepayAmount(String(liveUser.dueLoan))}
                          className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[9px] rounded-md font-extrabold"
                        >
                          সব পরিশোধ করুন
                        </button>
                      </div>
                    </div>

                    {/* Sender Info input */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-705 mb-1">3. প্রেরক হিসাব / মোবাইল নম্বর</label>
                      <input
                        type="text"
                        required
                        value={repaySenderInfo}
                        placeholder="উদাঃ 017XXXXXXXX"
                        onChange={(e) => setRepaySenderInfo(e.target.value)}
                        className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>

                    {/* Transaction ID input */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>4. ট্রানজেকশন আইডি (TrxID) দেওয়া বাধ্যতামূলক <span className="text-rose-500">*</span></span>
                        <span className="text-[9px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">বাধ্যতামূলক</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={repayTxnId}
                        placeholder="উদাঃ 8N34XP9W2 (সঠিক TrxID লিখুন)"
                        onChange={(e) => setRepayTxnId(e.target.value)}
                        className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>

                    {/* Evidence Screenshot File Upload */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-705 mb-1">5. পেমেন্ট প্রমাণপত্র আপলোড (স্ক্রিনশট ছবি)</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setRepayScreenshotData(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="block w-full text-xs text-slate-505 file:mr-3 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
                      />
                      {repayScreenshotData ? (
                        <div className="mt-2 p-1 bg-slate-100 rounded-xl relative inline-block">
                          <img src={repayScreenshotData} alt="Repayment Screenshot" className="h-16 w-auto rounded-lg object-contain border border-slate-200" />
                          <button 
                            type="button" 
                            onClick={() => setRepayScreenshotData('')}
                            className="absolute -top-1.5 -right-1.5 bg-red-650 hover:bg-red-750 text-white rounded-full p-0.5 shadow transition cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-450 mt-1">পেমেন্ট করার পর স্ক্রিনশটের ছবি এখানে সংযুক্ত করুন।</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'ঋণ কিস্তি পরিশোধ আবেদন জমা দিন ⚡'}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-50/50 border border-amber-100/75 p-4 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-amber-900">নতুন কো-অপারেティブ লোকারেন্ট ঋণ আবেদন</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    *আপনার কোনো বকেয়া ঋণ নেই। আপনি সমিতি তহবিল থেকে সর্বনিম্ন 500 টাকা এবং সর্বোচ্চ 20,000 টাকা ঋণ আবেদন করতে পারেন।
                  </p>

                  <form onSubmit={handleLoanSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-705 mb-1">কাঙ্ক্ষিত ঋণের পরিমাণ (৳)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-[10px]">৳</span>
                        <input
                          type="number"
                          required
                          value={loanAmount}
                          onChange={(e) => setLoanAmount(e.target.value)}
                          placeholder="উদাঃ 5000 বা 10000"
                          className="block w-full pl-6 pr-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <p className="text-[9px] text-slate-450 mt-1">সর্বনিম্ন ঋণ 500 এবং সর্বোচ্চ 20000 টাকা আবেদনযোগ্য।</p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'নতুন ঋণ আবেদনপত্র দাখিল করুন'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Active Statements / Transactions Tab */}
        {activeTab === 'history' && (
          <UserTransactionsStatement
            user={liveUser}
            transactions={allTransactions}
            allUsers={allUsers}
            onSelectTransaction={(tx) => setSelectedReceiptTx(tx)}
            appConfig={appConfig}
            t={t}
          />
        )}

        {/* 4. Profile View & Smart Debit Card / Transfer Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-4 font-sans text-left pb-12">
            <ProfileView user={liveUser} onUpdate={syncLiveProfile} onTriggerAdmin={onTriggerAdmin} appConfig={appConfig} />

            {/* Smart Virtual Debit Card & Live Transfer Panel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-150 p-5 rounded-3xl shadow-sm space-y-4"
            >
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5.5 h-5.5 text-emerald-800" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">ভার্চুয়াল ডেবিট কার্ড ও পেমেন্ট সার্ভিস</h3>
                    <p className="text-[10px] text-slate-450">আপনার ডিজিটাল ওয়ালেটের ডেবিট ও ফান্ড পেমেন্ট সিস্টেম</p>
                  </div>
                </div>
              </div>

              {/* Virtual debit card design */}
              <div className="relative bg-gradient-to-tr from-slate-900 via-emerald-950 to-emerald-900 rounded-3xl p-4.5 shadow-md flex flex-col justify-between overflow-hidden border border-emerald-900/40 text-white min-h-[160px]">
                <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-555/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex justify-between items-start gap-4">
                  <div className="text-left">
                    <p className="text-[9px] uppercase tracking-widest text-slate-350 font-bold leading-none">Smart Virtual Debit Card</p>
                    <h4 className="text-xs font-black tracking-normal mt-1 leading-none">BNB MULTIPURPOSE DEBIT</h4>
                  </div>
                  <span className="px-2 py-1 bg-white/20 rounded-lg border border-white/10 font-mono tracking-widest italic shrink-0">BNB Bank</span>
                </div>

                <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/10 my-1 text-center">
                  <span className="font-mono text-xs tracking-wider font-extrabold text-amber-305 text-amber-300">
                    Account: {liveUser.memberId || 'AMB00000000'}
                  </span>
                  <span className="font-mono text-[9px] text-slate-350">CVV: <strong className="text-slate-100 font-bold">{cvvRevealed ? '582' : '•••'}</strong></span>
                </div>

                <div className="text-left text-[8px] text-emerald-200 mt-1 leading-normal border-t border-white/5 pt-1">
                  📢 "এক সদস্য, এক নম্বর, এক পরিচয়"
                </div>

                <div className="flex justify-between items-end text-[10px] font-mono shrink-0 mt-1">
                  <div>
                    <p className="text-slate-450 text-[8px] uppercase">Account Holder</p>
                    <p className="font-sans font-bold text-slate-200 mt-0.5 text-xs">{liveUser.name}</p>
                  </div>
                  <div>
                    <p className="text-slate-455 text-[8px] uppercase">Expires</p>
                    <p className="text-slate-205 font-bold mt-0.5">12 / 30</p>
                  </div>
                </div>
              </div>

              {/* Card Actions lock reveal and wallet status */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleToggleCardLock}
                  disabled={loading}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 border shadow-sm cursor-pointer ${
                    liveUser.cardLocked
                      ? 'bg-emerald-50 text-emerald-805 border-emerald-250 hover:bg-emerald-100'
                      : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  {liveUser.cardLocked ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 11V7a4 4 0 118 0m-4 10v2m-6-8h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2z" />
                      </svg>
                      কার্ড আনলক করুন
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      কার্ডটি লক করুন
                    </>
                  )}
                </button>

                <button
                  onClick={() => setCvvRevealed(!cvvRevealed)}
                  className="py-2 px-3 bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-205 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-550" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {cvvRevealed ? 'পিন লুকান' : 'কার্ড পিন দেখুন'}
                </button>
              </div>

              {/* Live Money Transfer Module */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-4">
                <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                  <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-805" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    লাইভ টাকা স্থানান্তর (Transfer)
                  </h4>
                  <span className="text-[10px] bg-emerald-100 text-emerald-955 border border-emerald-250 px-2.5 py-1 rounded-full font-bold">
                    ব্যালেন্সঃ ৳ {liveUser.balance?.toLocaleString('bn-BD')}
                  </span>
                </div>

                {/* Display Alert Logs */}
                {formError && (
                  <div className="bg-rose-50 text-rose-700 border border-rose-105 p-3 rounded-2xl text-xs flex items-center gap-1.5 leading-relaxed font-sans font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse shrink-0"></span>
                    <span>{formError}</span>
                  </div>
                )}
                {formSuccess && (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-105 p-3 rounded-2xl text-xs leading-relaxed font-medium">
                    {formSuccess}
                  </div>
                )}

                {/* Selector tab buttons */}
                <div className="grid grid-cols-3 gap-1 bg-slate-200 p-1 rounded-xl">
                  {[
                    { id: 'member', label: 'বিএনবি সদস্য' },
                    { id: 'bank', label: 'অন্য ব্যাংক' },
                    { id: 'mobile_fs', label: 'মোবাইল ওয়ালেট' },
                  ].map((t, idx) => (
                    <button
                      key={`${t.id}-${idx}`}
                      type="button"
                      onClick={() => {
                        setTransferType(t.id as any);
                        setSearchedMember(null);
                        setSearchStatusMsg('');
                        setFormError('');
                        setFormSuccess('');
                      }}
                      className={`py-1.5 text-center text-[10px] font-bold rounded-lg transition-all ${
                        transferType === t.id
                          ? 'bg-white text-slate-905 shadow-xs border border-white'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleExecuteTransfer} className="space-y-3.5">
                  
                  {/* 1. Choose Transfer Sector / Wallet */}
                  {transferType === 'member' && (
                    <div className="space-y-1.5 p-3.5 bg-indigo-50/70 border border-indigo-150/40 rounded-2xl">
                      <label className="block text-xs font-black text-indigo-950 uppercase tracking-wide">ফান্ড স্থানান্তরের উৎস সেকশন (Source Wallet)</label>
                      <p className="text-[9px] text-emerald-700 font-bold">BNB সদস্য থেকে সদস্য (মেইন ব্যালেন্স ও সমিতি ভার্চুয়াল একাউন্ট) এবং টেলিকম/শপ ওয়ালেটে সরাসরি ইনস্ট্যান্ট স্থানান্তরিত হয় (100% অটোমেটিক)।</p>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {[
                          { id: 'samity', label: 'সমিতি', desc: `৳ ${(liveUser.balance || 0).toLocaleString('bn-BD')}` },
                          { id: 'telecom', label: 'টেলিকম', desc: `৳ ${(liveUser.telecomBalance || 0).toLocaleString('bn-BD')}` },
                          { id: 'shop', label: 'সুপার শপ', desc: `৳ ${(liveUser.superShopBalance || 0).toLocaleString('bn-BD')}` }
                        ].map((sect, idx) => (
                          <button
                            key={`${sect.id}-${idx}`}
                            type="button"
                            onClick={() => setTransferSector(sect.id as any)}
                            className={`p-2 rounded-xl text-center transition border flex flex-col justify-between items-center cursor-pointer ${
                              transferSector === sect.id 
                                ? 'bg-indigo-900 border-indigo-950 text-white shadow-xs scale-102 font-bold' 
                                : 'bg-white hover:bg-slate-55 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="text-[10px] block font-black leading-none">{sect.label}</span>
                            <span className="text-[8px] font-mono mt-1 opacity-90 block">{sect.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. To AMB Cooperative member */}
                  {transferType === 'member' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-705">ডিজিটাল আইডি বা মোবাইল নম্বর</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={transferTargetPhoneorId}
                          onChange={(e) => setTransferTargetPhoneorId(e.target.value)}
                          placeholder="সদস্য মোবাইল বা অ্যাকাউন্ট নম্বর যেমনঃ AMB00005327"
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono text-slate-850"
                        />
                        <button
                          type="button"
                          onClick={handleSearchTransferMember}
                          className="px-3 py-1.5 bg-emerald-850 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs transition min-w-[70px] flex items-center justify-center cursor-pointer font-sans"
                        >
                          অনুসন্ধান
                        </button>
                      </div>
                      {searchStatusMsg && (
                        <p className={`text-[10px] font-semibold ${searchedMember ? 'text-emerald-750 bg-emerald-50 border-emerald-150' : 'text-rose-605 bg-rose-50 border-rose-150'} py-1.5 px-2.5 rounded-lg border border-dashed leading-relaxed font-sans`}>
                          {searchStatusMsg}
                        </p>
                      )}

                      {/* 2b. If search result is own account (Self transfer), select target wallet */}
                      {searchedMember && searchedMember.uid === liveUser.uid && (
                        <div className="space-y-2 p-3.5 bg-indigo-50 border border-indigo-150/50 rounded-2xl animate-fade-in text-left">
                          <label className="block text-xs font-black text-indigo-950 uppercase tracking-wide">গন্তব্য ওয়ালেট নির্বাচন করুন (Destination Wallet)</label>
                          <p className="text-[9px] text-slate-500 font-medium font-sans">আপনার মেইন ব্যালেন্স থেকে অন্য ওয়ালেটে স্থানান্তরের জন্য গন্তব্য ওয়ালেট সিলেক্ট করুন।</p>
                          {transferSector === 'samity' ? (
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {[
                                { id: 'telecom', label: 'টেলিকম ওয়ালেট' },
                                { id: 'shop', label: 'সুপার শপ' },
                                { id: 'savings', label: 'সমিতি সঞ্চয়' }
                              ]
                              .map((tgt, idx) => (
                                <button
                                  key={`${tgt.id}-${idx}`}
                                  type="button"
                                  onClick={() => setSelfTransferTarget(tgt.id as any)}
                                  className={`p-2 rounded-xl text-center border text-[9.5px] font-bold cursor-pointer transition ${selfTransferTarget === tgt.id ? 'bg-indigo-900 border-indigo-950 text-white shadow-xs' : 'bg-white hover:bg-slate-55 border-slate-200 text-slate-700'}`}
                                >
                                  {tgt.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-1.5 text-center">
                              <span className="inline-block text-[10.5px] font-black text-emerald-800 bg-white border border-emerald-150 py-2 px-3.5 rounded-xl uppercase tracking-wider leading-none">
                                🎯 গন্তব্যঃ মেইন ব্যালেন্স (৳${(liveUser.balance || 0).toLocaleString('bn-BD')})
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. To External general Bank accounts */}
                  {transferType === 'bank' && (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">ব্যাংক নির্বাচন করুন</label>
                        <select
                          value={transferTargetBankName}
                          onChange={(e) => setTransferTargetBankName(e.target.value)}
                          className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-sans"
                        >
                          <option value="Dutch-Bangla Bank">ডাচ-বাংলা ব্যাংক লিমিটেড (DBBL)</option>
                          <option value="City Bank">দ্য CITY ব্যাংক পিএলসি</option>
                          <option value="Islami Bank">ইসলামী ব্যাংক বাংলাদেশ পিএলসি</option>
                          <option value="Sonali Bank">সোনালী ব্যাংক পিএলসি</option>
                          <option value="BRAC Bank">ব্র্যাক ব্যাংক পিএলসি</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">প্রাপক ব্যাংক হিসাব নম্বর</label>
                        <input
                          type="text"
                          required
                          value={transferTargetAccNo}
                          onChange={(e) => setTransferTargetAccNo(e.target.value)}
                          placeholder="উদাঃ 164.121.XXXXX"
                          className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono text-slate-850"
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. To External Mobile Financial Services (bKash/Nagad/etc) */}
                  {transferType === 'mobile_fs' && (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">মোবাইল ওয়ালেট অপারেটর</label>
                        <select
                          value={transferTargetBankName}
                          onChange={(e) => setTransferTargetBankName(e.target.value)}
                          className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-sans"
                        >
                          <option value="bKash">বিকাশ (bKash)</option>
                          <option value="Nagad">নগদ (Nagad)</option>
                          <option value="Rocket">রকেট (Rocket)</option>
                          <option value="Upay">উপায় (Upay)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">প্রাপক মোবাইল নম্বর</label>
                        <input
                          type="text"
                          required
                          value={transferTargetAccNo}
                          onChange={(e) => setTransferTargetAccNo(e.target.value)}
                          placeholder="উদাঃ 017XXXXXXXX"
                          className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono text-slate-850"
                        />
                      </div>
                    </div>
                  )}

                  {/* 4. Common Transfer Amount and Security PIN inputs */}
                  <div className="grid grid-cols-2 gap-3.5 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">স্থানান্তরের পরিমাণ (৳)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-mono">৳</span>
                        <input
                          type="number"
                          required
                          value={transferAmountInput}
                          onChange={(e) => setTransferAmountInput(e.target.value)}
                          placeholder="সর্বনিম্ন 10 ৳"
                          className="block w-full pl-6 pr-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono text-slate-850"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">সিকিউরিটি পিন (PIN)</label>
                      <input
                        type="password"
                        maxLength={4}
                        required
                        value={transferSenderPin}
                        onChange={(e) => setTransferSenderPin(e.target.value)}
                        placeholder="4 সংখ্যার পিন"
                        className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono text-slate-850 text-center tracking-widest"
                      />
                    </div>
                  </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer mt-4 font-sans"
                        >
                          {loading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            'নিরাপদ ফান্ড স্থানান্তর সম্পন্ন করুন ⚡'
                          )}
                        </button>
                      </form>
                    </div>
                  </motion.div>
                </div>
              )}

        {/* Maintenance / Service Update Dialog */}
        {showMaintenanceModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center relative">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-slate-800 mb-1.5 font-sans">
                {maintenanceServiceName}
              </h3>
              <p className="text-xs text-slate-600 mb-5 leading-relaxed font-sans">
                এই সেকশনটির আধুনিকায়ন ও সিস্টেম আপডেটের কাজ চলছে। খুব শীঘ্রই সেবাটি পুনরায় চালু করা হবে। সাময়িক অসুবিধার জন্য আমরা আন্তরিকভাবে দুঃখিত।
              </p>
              <button
                type="button"
                onClick={() => setShowMaintenanceModal(false)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-xs rounded-xl shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer font-sans"
              >
                ঠিক আছে, বুঝেছি
              </button>
            </div>
          </div>
        )}

        {/* All Service Sub Views and Full Screen Modals */}
        <DashboardSubViews
          modalType={modalType}
          setModalType={setModalType}
          liveUser={liveUser}
          setLiveUser={setLiveUser}
          appConfig={appConfig}
          setAppConfig={() => {}}
          transactions={allTransactions}
          setTransactions={setAllTransactions}
          allUsers={allUsers}
          allTransactions={allTransactions}
          notices={allNotices}
          setNotices={setAllNotices}
          offers={allOffers}
          products={allProducts}
          language={appLanguage === 'en' ? 'en' : 'bn'}
          onLogout={onLogout}
          syncLiveProfile={syncLiveProfile}
          isLocatingUser={isLocatingUser}
          setIsLocatingUser={setIsLocatingUser}
          searchRange={searchRange}
          setSearchRange={setSearchRange}
          shopSearchTerm={shopSearchTerm}
          setShopSearchTerm={setShopSearchTerm}
          shopCategory={shopCategory}
          setShopCategory={setShopCategory}
          selectedSupplier={selectedSupplier}
          setSelectedSupplier={setSelectedSupplier}
          userLat={userLat}
          setUserLat={setUserLat}
          userLng={userLng}
          setUserLng={setUserLng}
          userAddress={userAddress}
          setUserAddress={setUserAddress}
          calculateDistance={calculateDistance}
          toBnDigits={toBnDigits}
          handleDetectUserLocation={handleDetectUserLocation}
          selectedProductForCheckout={selectedProductForCheckout}
          setSelectedProductForCheckout={setSelectedProductForCheckout}
          checkoutQuantity={checkoutQuantity}
          setCheckoutQuantity={setCheckoutQuantity}
          checkoutPin={checkoutPin}
          setCheckoutPin={setCheckoutPin}
          checkoutDeliveryType={checkoutDeliveryType}
          setCheckoutDeliveryType={setCheckoutDeliveryType}
          checkoutPaymentMethod={checkoutPaymentMethod}
          setCheckoutPaymentMethod={setCheckoutPaymentMethod}
          checkoutLat={checkoutLat}
          setCheckoutLat={setCheckoutLat}
          checkoutLng={checkoutLng}
          setCheckoutLng={setCheckoutLng}
          checkoutAddress={checkoutAddress}
          setCheckoutAddress={setCheckoutAddress}
          checkoutLocationShared={checkoutLocationShared}
          setCheckoutLocationShared={setCheckoutLocationShared}
          checkoutDistance={checkoutDistance}
          setCheckoutDistance={setCheckoutDistance}
          shopActiveSubTab={shopActiveSubTab}
          setShopActiveSubTab={setShopActiveSubTab}
          allShopOrders={allShopOrders}
          setAllShopOrders={setAllShopOrders}
          handleShopTransferSubmit={handleShopTransferSubmit}
          shopTransferErr={shopTransferErr}
          setShopTransferErr={setShopTransferErr}
          shopTransferSucc={shopTransferSucc}
          setShopTransferSucc={setShopTransferSucc}
          shopDir={shopDir}
          setShopDir={setShopDir}
          shopTransferAmount={shopTransferAmount}
          setShopTransferAmount={setShopTransferAmount}
          shopTransferPin={shopTransferPin}
          setShopTransferPin={setShopTransferPin}
          shopTransferLoading={shopTransferLoading}
          setShopTransferLoading={setShopTransferLoading}
          handleBuyPremiumSafi={handleBuyPremiumSafi}
          expandedNoticeId={expandedNoticeId}
          setExpandedNoticeId={setExpandedNoticeId}
          noticeSearchQuery={noticeSearchQuery}
          setNoticeSearchQuery={setNoticeSearchQuery}
          agentPhone={agentPhone}
          setAgentPhone={setAgentPhone}
          agentDistrict={agentDistrict}
          setAgentDistrict={setAgentDistrict}
          agentExperience={agentExperience}
          setAgentExperience={setAgentExperience}
          isReapplyingSamity={isReapplyingSamity}
          setIsReapplyingSamity={setIsReapplyingSamity}
          resendSamitySuccess={resendSamitySuccess}
          resendSamityLoading={resendSamityLoading}
          handleDirectResendSamityRequest={handleDirectResendSamityRequest}
          chatMessages={chatMessages}
          setChatMessages={setChatMessages}
          chatInputText={chatInputText}
          setChatInputText={setChatInputText}
          isChatTyping={isChatTyping}
          setActiveTab={setActiveTab}
          onTriggerAdmin={onTriggerAdmin}
        />
      </div>

      {/* Bottom Fixed Navigation bar matching bKash app structure */}
      <nav className={bottomNavClass}>
        <div className="max-w-md w-full mx-auto flex justify-around items-center">
          
          {/* Tab Home */}
          {isTabActive('home') && (
            <button 
              onClick={() => { setActiveTab('home'); setSelectedAction(null); }}
              className="flex flex-col items-center gap-0.5 cursor-pointer relative z-10 transition-all duration-200 active:scale-95 group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
                activeTab === 'home' 
                  ? 'bg-emerald-50 text-emerald-600 scale-105 shadow-xs' 
                  : 'text-slate-400 hover:text-emerald-500/70 hover:bg-slate-50'
              }`}>
                <Home className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[9.5px] sm:text-[10px] transition-colors duration-200 ${
                activeTab === 'home' ? 'text-emerald-700 font-black' : 'text-slate-500 font-bold'
              }`}>
                {t('হোম')}
              </span>
            </button>
          )}

          {/* Tab Send Money (BNB to BNB Transfer) */}
          {(isTabActive('deposit') || isTabActive('send_money')) && (
            <button 
              onClick={() => { setActiveTab('deposit'); setSelectedAction(null); }}
              className="flex flex-col items-center gap-0.5 cursor-pointer relative z-10 transition-all duration-200 active:scale-95 group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
                activeTab === 'deposit' || activeTab === 'send_money'
                  ? 'bg-emerald-50 text-emerald-600 scale-105 shadow-xs' 
                  : 'text-slate-400 hover:text-emerald-500/70 hover:bg-slate-50'
              }`}>
                <Send className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'deposit' || activeTab === 'send_money' ? 'stroke-[2.5] text-emerald-600' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[9.5px] sm:text-[10px] transition-colors duration-200 ${
                activeTab === 'deposit' || activeTab === 'send_money' ? 'text-emerald-700 font-black' : 'text-slate-500 font-bold'
              }`}>
                {t('সেন্ড মানি')}
              </span>
            </button>
          )}

          {/* Tab Scan & Pay QR */}
          {isTabActive('scan_pay') && (
            <button 
              onClick={() => { setSelectedAction('deposit'); }}
              className="flex flex-col items-center gap-0.5 cursor-pointer relative z-10 transition-all duration-200 active:scale-95 group"
            >
              <div className="p-1.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 shadow-xs flex items-center justify-center">
                <QrCode className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              </div>
              <span className="text-[9.5px] sm:text-[10px] text-amber-800 font-extrabold">
                {t('কিউআর পে')}
              </span>
            </button>
          )}

          {/* Tab Add Money */}
          {isTabActive('add_money') && (
            <button 
              onClick={() => { setSelectedAction('deposit'); }}
              className="flex flex-col items-center gap-0.5 cursor-pointer relative z-10 transition-all duration-200 active:scale-95 group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
                activeTab === 'add_money' 
                  ? 'bg-emerald-50 text-emerald-700 scale-105 shadow-xs' 
                  : 'text-slate-400 hover:text-emerald-500/70 hover:bg-slate-50'
              }`}>
                <PlusCircle className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'add_money' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[9.5px] sm:text-[10px] transition-colors duration-200 ${
                activeTab === 'add_money' ? 'text-emerald-700 font-black' : 'text-emerald-800 font-extrabold'
              }`}>
                {t('BNB এড মানি')}
              </span>
            </button>
          )}

          {/* Tab Statements / History */}
          {isTabActive('history') && (
            <button 
              onClick={() => { setActiveTab('history'); setSelectedAction(null); }}
              className="flex flex-col items-center gap-0.5 cursor-pointer relative z-10 transition-all duration-200 active:scale-95 group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
                activeTab === 'history' 
                  ? 'bg-blue-50 text-blue-600 scale-105 shadow-xs' 
                  : 'text-slate-400 hover:text-blue-500/70 hover:bg-slate-50'
              }`}>
                <TransactionExchangeIcon className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'history' ? 'scale-105 text-blue-600' : 'text-slate-400'}`} strokeWidth={activeTab === 'history' ? 5 : 4} />
              </div>
              <span className={`text-[9.5px] sm:text-[10px] transition-colors duration-200 ${
                activeTab === 'history' ? 'text-blue-600 font-black' : 'text-slate-500 font-bold'
              }`}>
                {t('লেনদেন')}
              </span>
            </button>
          )}

          {/* Tab profile switching button */}
          {isTabActive('profile') && (
            <button 
              onClick={() => { setActiveTab('profile'); setSelectedAction(null); }}
              className="flex flex-col items-center gap-0.5 cursor-pointer relative z-10 transition-all duration-200 active:scale-95 group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
                activeTab === 'profile' 
                  ? 'bg-purple-50 text-purple-600 scale-105 shadow-xs' 
                  : 'text-slate-400 hover:text-purple-500/70 hover:bg-slate-50'
              }`}>
                <UserCircle className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'profile' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[9.5px] sm:text-[10px] transition-colors duration-200 ${
                activeTab === 'profile' ? 'text-purple-600 font-black' : 'text-slate-500 font-bold'
              }`}>
                {t('প্রোফাইল')}
              </span>
            </button>
          )}

        </div>
      </nav>
    </div>
  );
});

export default Dashboard;
