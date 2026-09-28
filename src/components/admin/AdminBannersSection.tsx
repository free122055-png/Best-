import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { SAMITY_MONTHS, SAMITY_YEARS, getUniquePaidMonthsCount, normalizePaidMonthsArray, getEffectiveBalance } from '../../types';
import { processUserSamitySavingsAutoDeduction, processBulkSamitySavingsAutoDeduction } from '../../lib/samitySavingsEngine';
console.log("AdminPanel: DB initialized:", !!db);
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  setDoc,
  query, 
  orderBy,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import { User, Transaction, Notice, Offer, BapReport, BapGroup, BapAdminRequest, AppConfig, Product, UserNotification, CompanyFundAccount, AdminBroadcastLog, QardRuleItem, QardConfig, PhoneChangeRequest, SamityPolicyConfig, SamityFineTier } from '../../types';
import { normalizeMemberId, formatBanglaAmount, normalizePhoneNumber, findUserInFirestoreByPhone, getNextSequentialMemberId, deleteUserCompletelyFromDatabase, convertBengaliToEnglishDigits } from '../../lib/memberUtils';
import { sortTransactionsNewestFirst, getTxTime } from '../../lib/transactionUtils';
import { saveAppConfig, DEFAULT_QARD_CONFIG } from '../../lib/config';
import { AMBLogo } from '../AMBLogo';
import { HeaderPendingModal } from '../HeaderPendingModal';
import SamityScreen from '../SamityScreen';
import UnifiedBackButton from '../UnifiedBackButton';
import SamityAdmin from '../SamityAdmin';
import SafiPremiumShop from '../SafiPremiumShop';
import TelecomAdmin from '../TelecomAdmin';
import AmbSalaryAdmin from '../AmbSalaryAdmin';
import { HistoryRetentionSettings } from '../HistoryRetentionSettings';
import { runWalletEndToEndTests, TestResultItem } from '../../lib/walletTests';
import { 
  ExternalLink,
  ShieldCheck, 
  Users, 
  PiggyBank, 
  BadgeAlert, 
  Activity, 
  Briefcase, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Send,
  ArrowLeft, 
  RefreshCw,
  RotateCcw,
  Search,
  Lock,
  Unlock,
  Megaphone,
  Check,
  Smartphone,
  Sparkles,
  UserPlus,
  Coins,
  History,
  FolderSync,
  AlertTriangle,
  AlertCircle,
  UserCheck,
  ChevronDown,
  SlidersHorizontal,
  CheckSquare,
  Save,
  Zap,
  ListOrdered,
  Settings,
  Bell,
  BellRing,
  Menu,
  Phone,
  Shield,
  ShieldAlert,
  FileText,
  ChevronRight,
  User as UserIcon,
  List,
  TrendingUp,
  ThumbsUp,
  HelpCircle,
  Home,
  Banknote,
  Wifi,
  Upload,
  Edit3,
  X,
  Scale,
  Printer,
  Building2,
  LayoutGrid,
  HeartHandshake,
  Heart,
  ClipboardList,
  Volume2,
  ShoppingBag,
  CreditCard,
  Truck,
  Store,
  BookOpen,
  Gift,
  Sliders,
  Wallet,
  Clock,
  Eye,
  EyeOff,
  Globe,
  PlusCircle,
  Calculator,
  Receipt,
  MapPin,
  Map as MapIcon,
  Cpu,
  FileJson,
  Pencil,
  PieChart,
  Copy,
  Calendar,
  ChevronLeft,
  CalendarDays
} from 'lucide-react';
import { motion } from 'motion/react';
import LeafletActiveMap from '../LeafletActiveMap';

export const copyTextToClipboard = (text: string, label: string = 'নম্বর') => {
  if (!text) return;
  const cleanText = String(text).trim();
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(cleanText).then(() => {
      alert(`✅ ${label} (${cleanText}) সফলভাবে কপি করা হয়েছে!`);
    }).catch(() => {
      fallbackCopyText(cleanText, label);
    });
  } else {
    fallbackCopyText(cleanText, label);
  }
};

const fallbackCopyText = (text: string, label: string) => {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
    alert(`✅ ${label} (${text}) সফলভাবে কপি করা হয়েছে!`);
  } catch (err) {
    prompt(`নিচে আপনার ${label} টি দেওয়া হলো, ম্যানুয়ালি কপি করুন:`, text);
  }
};

export const extractNumbersFromTx = (tx: any, targetUserPhone?: string) => {
  const foundNumbers: Array<{ number: string; label: string }> = [];
  const added = new Set<string>();

  const add = (numStr: any, labelStr: string) => {
    if (!numStr) return;
    const cleaned = String(numStr).trim();
    if (cleaned && cleaned !== 'N/A' && cleaned !== 'undefined' && cleaned !== 'null' && !added.has(cleaned)) {
      added.add(cleaned);
      foundNumbers.push({ number: cleaned, label: labelStr });
    }
  };

  // 1. Primary phone/account fields
  if (tx.userPhone) add(tx.userPhone, 'মেম্বার ফোন');
  if (targetUserPhone) add(targetUserPhone, 'মেম্বার ফোন');
  if (tx.senderPhone) add(tx.senderPhone, 'প্রেরক নম্বর');
  if (tx.senderInfo) add(tx.senderInfo, 'প্রেরক নম্বর');
  if (tx.accountNumber) add(tx.accountNumber, 'একাউন্ট/প্রেরক');
  if (tx.phoneNumber) add(tx.phoneNumber, 'টার্গেট নম্বর');
  if (tx.phone) add(tx.phone, 'ফোন নম্বর');

  // 2. Extract Bangladeshi mobile numbers (013-019XXXXXXXX) from description or paymentMethod
  const textBlob = `${tx.description || ''} ${tx.paymentMethod || ''}`;
  const bdPhoneMatches = textBlob.match(/(?:01[3-9]\d{8})/g);
  if (bdPhoneMatches) {
    bdPhoneMatches.forEach(num => add(num, 'পেমেন্ট নম্বর'));
  }

  // 3. Extract 10-18 digit account numbers
  const genNumMatches = textBlob.match(/\b\d{10,18}\b/g);
  if (genNumMatches) {
    genNumMatches.forEach(num => add(num, 'একাউন্ট নম্বর'));
  }

  // 4. TrxID
  if (tx.trxId) add(tx.trxId, 'TrxID');
  else if (tx.transactionId) add(tx.transactionId, 'TrxID');
  else if (tx.receiptNo) add(tx.receiptNo, 'TrxID');

  return foundNumbers;
};

interface AdminPanelProps {
  onBack: () => void;
  currentUser: User;
  appConfig: AppConfig;
  onChangeConfig: (newConfig: AppConfig) => void;
  appLanguage?: string;
  darkMode?: boolean;
}

export interface DispatchReport {
  id: string;
  timestamp: string;
  actionType: 'bonus' | 'fine' | 'notice';
  targetType: 'all' | 'single';
  targetName: string;
  targetCount: number;
  amount: number;
  reason: string;
  status: string;
}

export function AdminBannersSection(props: any) {
  const {
    adminTab,
    y,
    text,
    left,
    handleSaveBanners,
    bannersSaving,
    cfgTickerText,
    setCfgTickerText,
    target,
    cfgQardTicker,
    setCfgQardTicker,
    cfgSamityTicker,
    setCfgSamityTicker,
    cfgTelecomTicker,
    setCfgTelecomTicker,
    cfgSafiTicker,
    setCfgSafiTicker,
    cfgRationTicker,
    setCfgRationTicker,
    cfgEscrowTicker,
    setCfgEscrowTicker,
    cfgAgentTicker,
    setCfgAgentTicker,
    cfgCourierTicker,
    setCfgCourierTicker,
    cfgGatewayTicker,
    setCfgGatewayTicker,
    bannersSuccess,
    bannersError,
    type,
    setBannerSubSection,
    bannerSubSection,
    renderBannerEditorList,
    dbDashboardBanners,
    setDbDashboardBanners,
    defaultDashboardSlides,
    dbQardBanners,
    setDbQardBanners,
    defaultQardSlides,
    dbSamityBanners,
    setDbSamityBanners,
    defaultSamitySlides,
    dbTelecomBanners,
    setDbTelecomBanners,
    defaultTelecomSlides,
    dbMoneyExchangeBanners,
    setDbMoneyExchangeBanners,
    defaultMoneyExchangeSlides,
    dbRationBanners,
    setDbRationBanners,
    defaultRationSlides,
    dbSafiBanners,
    setDbSafiBanners,
    defaultSafiSlides,
    dbAgentBanners,
    setDbAgentBanners,
    defaultAgentSlides,
    dbCourierBanners,
    setDbCourierBanners,
    defaultCourierSlides,
    file,
    handleFileChange,
    setDbEscrowCoverUrl,
    dbEscrowCoverUrl,
    img
  } = props;

  return (
    <>
        {adminTab === 'banners_admin' && (
          <div className="space-y-6 animate-fade-in text-slate-255">
            {/* CENTRAL ANNOUNCEMENTS / TICKERS EDITING CARD */}
            <div className="bg-slate-900 border border-slate-700/80 p-5 rounded-3xl text-left space-y-4 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-amber-400 flex items-center gap-2">
                    📢 সকল সেকশনের স্ক্রলিং ঘোষণা (Ticker Notices) কাস্টমাইজ প্যানেল
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    ইউজার প্যানেলের যে সেকশনগুলো রয়েছে সেগুলোতে নিজের ইচ্ছামতো স্ক্রলিং ঘোষণা লিখে লাইভ চেঞ্জ করতে পারবেন।
                  </p>
                </div>

                <button
                  onClick={handleSaveBanners}
                  disabled={bannersSaving}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {bannersSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      সংরক্ষণ হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      সকল ব্যানার ও ঘোষণা লাইভ সেভ করুন
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                <div>
                  <label className="block text-[11px] font-bold text-amber-300 mb-1">
                    📱 1. হোম ড্যাশবোর্ড স্ক্রলিং নোটিশ (Main Ticker)
                  </label>
                  <textarea
                    rows={2}
                    value={cfgTickerText}
                    onChange={(e) => setCfgTickerText(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl focus:ring-1 focus:ring-amber-500 text-xs leading-relaxed"
                    placeholder="হোম ড্যাশবোর্ডের স্ক্রলিং ঘোষণা..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-300 mb-1">
                    🤝 2. করযে হাসানা কল্যাণ তহবিল ঘোষণা
                  </label>
                  <textarea
                    rows={2}
                    value={cfgQardTicker}
                    onChange={(e) => setCfgQardTicker(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl focus:ring-1 focus:ring-emerald-500 text-xs leading-relaxed"
                    placeholder="করযে হাসানা সেকশনের ঘোষণা..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-sky-300 mb-1">
                    🏢 3. সমবায় কোম্পানি ইনভেস্টর ঘোষণা
                  </label>
                  <textarea
                    rows={2}
                    value={cfgSamityTicker}
                    onChange={(e) => setCfgSamityTicker(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl focus:ring-1 focus:ring-sky-500 text-xs leading-relaxed"
                    placeholder="ইনভেস্টর খাতার ঘোষণা..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-purple-300 mb-1">
                    📶 4. টেলিকম ও রিচার্জ ঘোষণা
                  </label>
                  <textarea
                    rows={2}
                    value={cfgTelecomTicker}
                    onChange={(e) => setCfgTelecomTicker(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl focus:ring-1 focus:ring-purple-500 text-xs leading-relaxed"
                    placeholder="টেলিকম ও ড্রাইভ অফারের ঘোষণা..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-teal-300 mb-1">
                    🛒 5. সাফি সুপার শপ ঘোষণা
                  </label>
                  <textarea
                    rows={2}
                    value={cfgSafiTicker}
                    onChange={(e) => setCfgSafiTicker(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl focus:ring-1 focus:ring-teal-500 text-xs leading-relaxed"
                    placeholder="সাফি ইন-হাউস ব্র্যান্ডের ঘোষণা..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-orange-300 mb-1">
                    🥗 6. কো-অপারেটিভ রেশন কার্ড ঘোষণা
                  </label>
                  <textarea
                    rows={2}
                    value={cfgRationTicker}
                    onChange={(e) => setCfgRationTicker(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl focus:ring-1 focus:ring-orange-500 text-xs leading-relaxed"
                    placeholder="রেশন কার্ড ভর্তুকি অফার ঘোষণা..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-indigo-300 mb-1">
                    🛡️ 7. নিরাপদ লেনদেন (এসক্রো) ঘোষণা
                  </label>
                  <textarea
                    rows={2}
                    value={cfgEscrowTicker}
                    onChange={(e) => setCfgEscrowTicker(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl focus:ring-1 focus:ring-indigo-500 text-xs leading-relaxed"
                    placeholder="নিরাপদ সেফ ডিলস ঘোষণা..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-pink-300 mb-1">
                    💼 8. এজেন্ট প্যানেল ঘোষণা
                  </label>
                  <textarea
                    rows={2}
                    value={cfgAgentTicker}
                    onChange={(e) => setCfgAgentTicker(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl focus:ring-1 focus:ring-pink-500 text-xs leading-relaxed"
                    placeholder="এজেন্ট পোর্টাল ঘোষণা..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-cyan-300 mb-1">
                    🚚 9. কুরিয়ার পার্সেল সেবা ঘোষণা
                  </label>
                  <textarea
                    rows={2}
                    value={cfgCourierTicker}
                    onChange={(e) => setCfgCourierTicker(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl focus:ring-1 focus:ring-cyan-500 text-xs leading-relaxed"
                    placeholder="ইনস্ট্যান্ট কুরিয়ার ঘোষণা..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-yellow-300 mb-1">
                    🏦 10. ন্যাশনাল গেটওয়ে ঘোষণা
                  </label>
                  <textarea
                    rows={2}
                    value={cfgGatewayTicker}
                    onChange={(e) => setCfgGatewayTicker(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl focus:ring-1 focus:ring-yellow-500 text-xs leading-relaxed"
                    placeholder="বাংলাদেশ গেটওয়ে ঘোষণা..."
                  />
                </div>
              </div>
            </div>

            {/* BANNERS AND COVER PHOTOS CONTROL PANEL */}
            <div className="bg-slate-955 border border-slate-200/80 p-6 rounded-3xl text-left">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-amber-400 flex items-center gap-2">
                    🖼️ AMB স্লাইডার ব্যানার ও কভার ছবি আপলোড প্যানেল
                  </h2>
                  <p className="text-xs text-slate-450 mt-1">সব সেকশনের জন্য ছবি গ্যালারি থেকে কভার ব্যানার ছবি আপলোড করুন ও কাস্টমাইজ করুন।</p>
                </div>
                
                <button
                  onClick={handleSaveBanners}
                  disabled={bannersSaving}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {bannersSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      সংরক্ষণ হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      সকল ব্যানার লাইভ সংরক্ষণ করুন
                    </>
                  )}
                </button>
              </div>

              {bannersSuccess && (
                <div className="bg-emerald-950/80 text-emerald-400 border border-emerald-900/50 p-4 rounded-xl text-xs font-bold mt-4 animate-bounce flex items-center gap-2">
                  <span className="text-base">✓</span> সকল ক্যাটাগরির ব্যানার ও কভার ফটো সফলভাবে সংরক্ষিত এবং লাইভ পুশ করা হয়েছে!
                </div>
              )}

              {bannersError && (
                <div className="bg-rose-950/80 text-rose-400 border border-rose-900/50 p-4 rounded-xl text-xs font-bold mt-4">
                  ⚠ {bannersError}
                </div>
              )}

              {/* Sub-navigation inside Banner tab which groups each section */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-6 border-b border-slate-200/80 pb-4">
                <button
                  type="button"
                  onClick={() => setBannerSubSection('dashboard')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight text-center truncate ${bannerSubSection === 'dashboard' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-850 hover:text-white'}`}
                >
                  📱 1. ড্যাশবোর্ড ব্যানার
                </button>
                <button
                  type="button"
                  onClick={() => setBannerSubSection('qard')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight text-center truncate ${bannerSubSection === 'qard' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-850 hover:text-white'}`}
                >
                  🤝 2. করযে হাসানা ব্যানার
                </button>
                <button
                  type="button"
                  onClick={() => setBannerSubSection('samity')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight text-center truncate ${bannerSubSection === 'samity' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-850 hover:text-white'}`}
                >
                  🏢 3. ইনভেস্টর খাতা
                </button>
                <button
                  type="button"
                  onClick={() => setBannerSubSection('telecom')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight text-center truncate ${bannerSubSection === 'telecom' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-850 hover:text-white'}`}
                >
                  📶 4. টেলিকম ব্যানার
                </button>
                <button
                  type="button"
                  onClick={() => setBannerSubSection('money')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight text-center truncate ${bannerSubSection === 'money' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-850 hover:text-white'}`}
                >
                  💳 5. মানি এক্সচেঞ্জ ব্যানার
                </button>
                <button
                  type="button"
                  onClick={() => setBannerSubSection('ration')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight text-center truncate ${bannerSubSection === 'ration' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-850 hover:text-white'}`}
                >
                  🥗 6. রেশন ব্যানার
                </button>
                <button
                  type="button"
                  onClick={() => setBannerSubSection('safi')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight text-center truncate ${bannerSubSection === 'safi' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-850 hover:text-white'}`}
                >
                  🛒 7. সাফি শপ ব্যানার
                </button>
                <button
                  type="button"
                  onClick={() => setBannerSubSection('agent')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight text-center truncate ${bannerSubSection === 'agent' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-850 hover:text-white'}`}
                >
                  💼 8. এজেন্ট প্যানেল
                </button>
                <button
                  type="button"
                  onClick={() => setBannerSubSection('courier')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight text-center truncate ${bannerSubSection === 'courier' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-850 hover:text-white'}`}
                >
                  🚚 9. কুরিয়ার সার্ভিস
                </button>
                <button
                  type="button"
                  onClick={() => setBannerSubSection('escrow')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight text-center truncate ${bannerSubSection === 'escrow' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-transparent text-slate-400 hover:bg-slate-850 hover:text-white'}`}
                >
                  🛡️ 10. সেফ ডিলস কভার
                </button>
              </div>

              {/* Sub-sections Rendering logic */}
              <div className="mt-6 space-y-4 text-left">
                {bannerSubSection === 'dashboard' && renderBannerEditorList('📱 মূল হোম ড্যাশবোর্ড স্লাইডার ব্যানার সমূহ', dbDashboardBanners, setDbDashboardBanners, defaultDashboardSlides)}
                {bannerSubSection === 'qard' && renderBannerEditorList('🤝 করযে হাসানা কল্যাণ তহবিল ব্যানার সমূহ', dbQardBanners, setDbQardBanners, defaultQardSlides)}
                {bannerSubSection === 'samity' && renderBannerEditorList('🏢 সমবায় কোম্পানি ইনভেস্টর খাতা ব্যানার সমূহ', dbSamityBanners, setDbSamityBanners, defaultSamitySlides)}
                {bannerSubSection === 'telecom' && renderBannerEditorList('📶 বিএনবি টেলিকম অফার ব্যানার সমূহ', dbTelecomBanners, setDbTelecomBanners, defaultTelecomSlides)}
                {bannerSubSection === 'money' && renderBannerEditorList('💳 মানি এক্সচেঞ্জ ক্যাশব্যাক ব্যানার সমূহ', dbMoneyExchangeBanners, setDbMoneyExchangeBanners, defaultMoneyExchangeSlides)}
                {bannerSubSection === 'ration' && renderBannerEditorList('🥗 কো-অপারেটিভ রেশন কার্ড ব্যানার সমূহ', dbRationBanners, setDbRationBanners, defaultRationSlides)}
                {bannerSubSection === 'safi' && renderBannerEditorList('🛒 সাফি ইন-হাউস ব্র্যান্ড শপ ব্যানার সমূহ', dbSafiBanners, setDbSafiBanners, defaultSafiSlides)}
                {bannerSubSection === 'agent' && renderBannerEditorList('💼 বিএনবি এজেন্ট পোর্টাল ব্যানার সমূহ', dbAgentBanners, setDbAgentBanners, defaultAgentSlides)}
                {bannerSubSection === 'courier' && renderBannerEditorList('🚚 বিএনবি কুরিয়ার সেবা ব্যানার সমূহ', dbCourierBanners, setDbCourierBanners, defaultCourierSlides)}
                
                {/* 6. Escrow Cover Image Specific Sub-section */}
                {bannerSubSection === 'escrow' && (
                  <div className="space-y-4 animate-fade-in text-slate-700">
                    <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">🛡️ পাইকারি সেফ ডিলস ইএসক্রো কভার ফটো</h3>
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-350 mb-1.5 font-sans">কাস্টম কভার ব্যানার ছবি আপলোড (গ্যালারি থেকে সরাসরি)</label>
                            <div className="flex items-center gap-3">
                              <label className="flex-1 px-4 py-2.5 bg-indigo-650 hover:bg-indigo-700 border border-indigo-600/35 font-extrabold text-xs rounded-xl cursor-pointer text-white text-center transition-all duration-150 shadow-md">
                                📁 গ্যালারি থেকে ছবি আপলোড করুন
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFileChange(e, (base64) => setDbEscrowCoverUrl(base64))}
                                  className="hidden"
                                />
                              </label>
                              {dbEscrowCoverUrl && (
                                <button
                                  type="button"
                                  onClick={() => setDbEscrowCoverUrl('')}
                                  className="px-4 py-2.5 bg-rose-950/80 text-rose-450 hover:bg-rose-900 border border-rose-900/40 text-xs font-extrabold rounded-xl transition"
                                >
                                  মুছে ফেলুন
                                </button>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-350 mb-1.5 font-sans">অথবা ইমেজ ইউআরএল লিংক প্রদান করুন (Web Image URL)</label>
                            <input
                              type="text"
                              placeholder="পেস্টিং বা কাস্টম ছবির ইউআরএল লিখতে পারেন"
                              value={dbEscrowCoverUrl || ''}
                              onChange={(e) => setDbEscrowCoverUrl(e.target.value)}
                              className="block w-full px-3.5 py-2.5 bg-slate-955 border border-slate-200/80 text-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold"
                            />
                          </div>
                        </div>

                        {/* Live Cover Preview aspect ratios matching YouTube size */}
                        <div className="space-y-2 text-left">
                          <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">বাস্তব লাইভ প্রিভিউ (YouTube 16:9 Aspect Ratio)</label>
                          <div className="relative w-full aspect-[16/9] bg-gradient-to-r from-emerald-955 to-teal-955 rounded-2xl overflow-hidden border border-slate-200/80 flex items-center justify-center p-4 shadow-inner">
                            {dbEscrowCoverUrl ? (
                              <img src={dbEscrowCoverUrl} alt="Escrow Cover Preview" className="absolute inset-0 w-full h-full object-cover opacity-75" />
                            ) : (
                              <div className="text-center text-slate-500 font-bold p-6">
                                <p className="text-slate-500 text-xs text-bold">কোনো কাস্টম কভার ফটো সেট করা নেই</p>
                                <p className="text-[10px] mt-1 text-slate-500 font-normal">ডিফল্ট গ্রেডিয়েন্ট কভারটি সচল থাকবে (ডিফল্ট ব্যাকগ্রাউন্ড)</p>
                              </div>
                            )}

                            {/* Demo Overlay of Escrow Cover Banner Text to show how text sits on top of images */}
                            <div className="absolute left-4 bottom-4 text-left max-w-[80%] z-10 select-none">
                              <span className="px-1.5 py-0.5 bg-emerald-850/80 text-[6.5px] font-extrabold uppercase rounded text-emerald-300">ভেরিফাইড এসক্রো মার্কেটপ্লেস</span>
                              <h4 className="text-[11px] font-black leading-tight mt-0.5 text-white">AMB নিরাপদ লেনদেন · লাইভ গ্রুপ বাই</h4>
                              <p className="text-[8px] text-emerald-100/90 leading-normal mt-0.5 max-w-sm truncate">হোম ও সমবায়ীদের প্রথম সুরক্ষাবলয় সহায়ক এসক্রো...</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 12: AGENT MANAGEMENT SECTION */}
    </>
  );
}
