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

export function AdminConfigSection(props: any) {
  const appConfig = props.appConfig || {};
  const onChangeConfig = props.onChangeConfig || (() => {});

  const {
    adminTab,
    y,
    text,
    left,
    oneSignalSuccess,
    oneSignalError,
    type,
    cfgOneSignalAppId,
    setCfgOneSignalAppId,
    target,
    showOneSignalKey,
    cfgOneSignalRestApiKey,
    setCfgOneSignalRestApiKey,
    setShowOneSignalKey,
    handleUnlockOneSignalSettings,
    oneSignalSaving,
    handleSaveOneSignalSettings,
    handleSendPush,
    id,
    key,
    setPushTargetType,
    setPushTargetValue,
    pushTargetType,
    pushTargetValue,
    pushTitle,
    setPushTitle,
    pushMessage,
    setPushMessage,
    url,
    pushImageUrl,
    setPushImageUrl,
    file,
    alert,
    reader,
    img,
    MAX_WIDTH,
    MAX_HEIGHT,
    width,
    height,
    canvas,
    ctx,
    d,
    compressedBase64,
    data,
    pushDeepLink,
    setPushDeepLink,
    pushSending,
    adminNotifications,
    userId,
    targetUser,
    users,
    u,
    uid,
    name,
    handleDeleteAdminNotification,
    handleSaveConfig,
    cfgSuccess,
    cfgError,
    cfgLogoUrl,
    setCfgLogoUrl,
    cfgAppName,
    setCfgAppName,
    cfgSupportPhone,
    setCfgSupportPhone,
    cfgPersonalMfsNumber,
    setCfgPersonalMfsNumber,
    cfgPersonalBankCard,
    setCfgPersonalBankCard,
    cfgTickerText,
    setCfgTickerText,
    cfgSamityTicker,
    setCfgSamityTicker,
    cfgQardTicker,
    setCfgQardTicker,
    cfgSafiTicker,
    setCfgSafiTicker,
    cfgEscrowTicker,
    setCfgEscrowTicker,
    cfgRationTicker,
    setCfgRationTicker,
    cfgSamityTerms,
    setCfgSamityTerms,
    setCfgMaintenanceMode,
    cfgMaintenanceMode,
    cfgMaintenanceTitle,
    setCfgMaintenanceTitle,
    cfgMaintenanceDescription,
    setCfgMaintenanceDescription,
    cfgMaintenanceEstimatedTime,
    setCfgMaintenanceEstimatedTime,
    setCfgForceUpdateActive,
    cfgForceUpdateActive,
    cfgMinAppVersion,
    setCfgMinAppVersion,
    cfgLatestAppVersion,
    setCfgLatestAppVersion,
    cfgDownloadLink,
    setCfgDownloadLink,
    cfgUpdateTitle,
    setCfgUpdateTitle,
    cfgUpdateDescription,
    setCfgUpdateDescription,
    cfgServiceStatus,
    setCfgServiceStatus,
    cfgBannerHeightType,
    setCfgBannerHeightType,
    cfgBannerHeightValue,
    setCfgBannerHeightValue,
    cfgGridColsCount,
    setCfgGridColsCount,
    cfgGridIconSize,
    setCfgGridIconSize,
    cfgGridIconSizeValue,
    setCfgGridIconSizeValue,
    cfgBottomNavHeightType,
    setCfgBottomNavHeightType,
    cfgBottomNavTabs,
    setCfgBottomNavTabs,
    setAdminTab,
    cfgSaving
  } = props;

  return (
    <>
        {adminTab === 'push_admin' && (
          <div className="space-y-6 text-left">
            {/* 1. ONESIGNAL SYSTEM SETUP & LOCK CONTAINER */}
            <div className="bg-slate-955 border border-slate-200/80 rounded-3xl p-6 space-y-6">
              <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2 text-white text-left">
                    <BellRing className="w-5 h-5 text-red-500 animate-pulse" />
                    OneSignal পুশ নোটিফিকেশন হাব (Push Notification Hub)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 text-left">
                    গ্রাহকদের মোবাইলে ও ব্রাউজারে রিয়েল-টাইম পুশ নোটিফিকেশন ব্রডকাস্ট এবং টার্গেটেড এলার্ট পাঠান
                  </p>
                </div>
                {appConfig?.oneSignalAppId ? (
                  <span className="px-3.5 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-900/60 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1 shrink-0">
                    🔒 চিরস্থায়ীভাবে লকড ও সক্রিয় (Active & Locked)
                  </span>
                ) : (
                  <span className="px-3.5 py-1 bg-amber-950/80 text-amber-400 border border-amber-900/60 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1 shrink-0 animate-pulse">
                    ⚠️ সেটআপ অপরিপক্ব (Setup Pending)
                  </span>
                )}
              </div>

              {/* CREDENTIALS CARD */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="border-b border-slate-800 pb-2.5">
                  <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    ⚙️ ওয়ান সিগন্যাল এপিআই ক্রেডেনশিয়াল (OneSignal Configuration API)
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    একবার দেওয়ার সাথে সাথে এটি আপনার ডেটাবেজে এবং ব্রাউজারে চিরজীবনের জন্য সুরক্ষিতভাবে লক হয়ে যাবে।
                  </p>
                </div>

                {oneSignalSuccess && (
                  <div className="bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 p-3 rounded-xl text-[11px] font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    অভিনন্দন! OneSignal ক্রেডেনশিয়াল সফলভাবে এবং চিরস্থায়ীভাবে ডেটাবেজে সংরক্ষিত ও লক করা হয়েছে।
                  </div>
                )}

                {oneSignalError && (
                  <div className="bg-rose-950/40 text-rose-400 border border-rose-800/60 p-3 rounded-xl text-[11px] font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-450" />
                    {oneSignalError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* OneSignal App ID */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      OneSignal App ID {appConfig?.oneSignalAppId && "🔒 (সুরক্ষিত)"}
                    </label>
                    <input
                      type="text"
                      value={appConfig?.oneSignalAppId ? appConfig.oneSignalAppId.replace(/^(.{6}).+(.{4})$/, "$1******$2") : cfgOneSignalAppId}
                      onChange={(e) => {
                        if (!appConfig?.oneSignalAppId) {
                          setCfgOneSignalAppId(e.target.value);
                        }
                      }}
                      disabled={!!appConfig?.oneSignalAppId}
                      className={`w-full bg-slate-950 border focus:border-emerald-500 rounded-xl p-3 text-sm font-mono font-bold outline-none transition ${
                        appConfig?.oneSignalAppId 
                          ? 'border-slate-800 text-slate-400 cursor-not-allowed bg-slate-950/40' 
                          : 'border-slate-800 text-white'
                      }`}
                      placeholder="যেমন: abcdef12-3456-7890-abcd-ef1234567890"
                    />
                    <p className="text-[10px] text-slate-500 font-medium">মোবাইল পুশ নোটিফিকেশনের জন্য OneSignal App ID।</p>
                  </div>

                  {/* OneSignal REST API Key */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      OneSignal REST API Key {appConfig?.oneSignalAppId && "🔒 (লকড)"}
                    </label>
                    <div className="relative">
                      <input
                        type={showOneSignalKey ? "text" : "password"}
                        value={appConfig?.oneSignalAppId ? "****************************************" : cfgOneSignalRestApiKey}
                        onChange={(e) => {
                          if (!appConfig?.oneSignalAppId) {
                            setCfgOneSignalRestApiKey(e.target.value);
                          }
                        }}
                        disabled={!!appConfig?.oneSignalAppId}
                        className={`w-full bg-slate-950 border focus:border-emerald-500 rounded-xl pl-3 pr-10 py-3 text-sm font-mono font-bold outline-none transition ${
                          appConfig?.oneSignalAppId 
                            ? 'border-slate-800 text-slate-400 cursor-not-allowed bg-slate-950/40' 
                            : 'border-slate-800 text-white'
                        }`}
                        placeholder="সিক্রেট REST API Key দিন"
                      />
                      {!appConfig?.oneSignalAppId && (
                        <button
                          type="button"
                          onClick={() => setShowOneSignalKey(!showOneSignalKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition focus:outline-none cursor-pointer"
                        >
                          {showOneSignalKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">ব্যাকএন্ড থেকে পুশ নোটিফিকেশন ডেলিভারি করার জন্য OneSignal REST API Key।</p>
                  </div>
                </div>

                {appConfig?.oneSignalAppId ? (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleUnlockOneSignalSettings}
                      disabled={oneSignalSaving}
                      className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-black transition-all hover:scale-101 active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer font-sans disabled:opacity-40 animate-pulse"
                    >
                      {oneSignalSaving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> আনলক করা হচ্ছে...
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5" /> ক্রেডেনশিয়াল আনলক করুন (🔓 পরিবর্তন করুন)
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveOneSignalSettings}
                      disabled={oneSignalSaving || !cfgOneSignalAppId.trim() || !cfgOneSignalRestApiKey.trim()}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-black transition-all hover:scale-101 active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer font-sans disabled:opacity-40"
                    >
                      {oneSignalSaving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> সংরক্ষণ করা হচ্ছে...
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" /> ক্রেডেনশিয়াল সেভ করুন (🔒 এটি সারা জীবনের জন্য লক হয়ে যাবে)
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* BROADCAST AND DISPATCH SYSTEM */}
              <div className="pt-3">
                <div className="border-t border-slate-800 pt-5 pb-3">
                  <div className="mb-4 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 text-left">
                    <h5 className="text-xs font-black text-emerald-400 flex items-center gap-1.5 mb-1">
                      💡 মোবাইল স্ক্রিনে সরাসরি পুশ নোটিফিকেশন পাওয়ার গাইডলাইন (Real Phone Push Guide)
                    </h5>
                    <p className="text-[11px] text-slate-300 leading-relaxed space-y-1">
                      <span>1. <strong>আইফ্রেম বা প্রিভিউ সীমাবদ্ধতা:</strong> AI Studio এর ভেতরে (ডানপাশের ডিভাইস প্রিভিউতে) ব্রাউজারের সিকিউরিটি পলিসির কারণে ফোনের স্ক্রিনে সরাসরি পুশ নোটিফিকেশন আসবে না।</span><br />
                      <span>2. <strong>কিভাবে টেস্ট করবেন:</strong> এই পেজের উপরে ডানপাশে থাকা <strong>"Device" বা "Remix"</strong>-এর পাশে <strong>"Open in a new tab" (নতুন ট্যাবে ওপেন)</strong> আইকনে ক্লিক করে সরাসরি নতুন ট্যাবে অথবা আপনার মোবাইলের ব্রাউজারে (Chrome বা Safari) এই লিংকটি ওপেন করুন:</span>
                      <a 
                        href="https://ais-pre-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="block mt-1 text-emerald-400 font-mono font-bold underline hover:text-emerald-300 break-all"
                      >
                        https://ais-pre-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app
                      </a>
                      <span className="block mt-1">3. <strong>অনুমতি দিন (Allow):</strong> ব্রাউজারে ওপেন করার পর ফোনের স্ক্রিনে নোটিফিকেশনের পারমিশন চাইলে অবশ্যই <strong>"Allow" বা "অনুমতি দিন"</strong> সিলেক্ট করুন। তাহলে আপনার ডিভাইসটি সাবস্ক্রাইব হয়ে যাবে।</span>
                      <span className="block mt-1">4. <strong>টেস্ট মেসেজ পাঠান:</strong> ডিভাইস সাবস্ক্রাইব করার পর এই এডমিন প্যানেল থেকে টেস্ট নোটিফিকেশন পাঠালে তা সরাসরি আপনার মোবাইলের নোটিফিকেশন বারে/লক স্ক্রিনে ভেসে উঠবে!</span>
                    </p>
                  </div>

                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-red-500" />
                    নতুন পুশ নোটিফিকেশন ড্রাফট ও প্রচার (Push Broadcaster)
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">সব মেম্বার বা নির্দিষ্ট মেম্বারদের টার্গেট করে সরাসরি ডিভাইসে পুশ ফ্ল্যাশ মেসেজ পাঠান</p>
                </div>

                <form onSubmit={handleSendPush} className="grid grid-cols-1 md:grid-cols-2 gap-5 font-sans">
                  {/* Target Audience Selector */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">টার্গেট গ্রাহক (Target Audience)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { id: 'all', label: '📢 সকল সদস্য' },
                        { id: 'user', label: '👤 নির্দিষ্ট আইডি' },
                        { id: 'role', label: '🛡️ নির্দিষ্ট রোল' },
                        { id: 'group', label: '👥 নির্দিষ্ট গ্রুপ' },
                        { id: 'division', label: '🏢 নির্দিষ্ট বিভাগ' }
                      ].map((target, idx) => (
                        <button
                          key={`${target.id}-${idx}`}
                          type="button"
                          disabled={!appConfig?.oneSignalAppId}
                          onClick={() => {
                            setPushTargetType(target.id);
                            setPushTargetValue('');
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                            !appConfig?.oneSignalAppId ? 'opacity-40 cursor-not-allowed bg-slate-900/20 border-slate-900 text-slate-650' :
                            pushTargetType === target.id
                              ? 'bg-red-950/40 border-red-500 text-red-400'
                              : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {target.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target Value Input */}
                  {pushTargetType !== 'all' && (
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-400">
                        {pushTargetType === 'user' && 'গ্রাহকের ইউনিক আইডি / Firebase UID (একাধিক হলে কমা দিয়ে লিখুন)'}
                        {pushTargetType === 'role' && 'গ্রাহক রোল (যেমন: admin, user, agent)'}
                        {pushTargetType === 'group' && 'গ্রুপ নাম / ক্যাটাগরি'}
                        {pushTargetType === 'division' && 'বিভাগ / রিজিয়ন নাম'}
                      </label>
                      <input
                        type="text"
                        value={pushTargetValue}
                        onChange={(e) => setPushTargetValue(e.target.value)}
                        required
                        disabled={!appConfig?.oneSignalAppId}
                        placeholder={
                          pushTargetType === 'user' ? 'যেমন: user_abc123, user_xyz789' :
                          pushTargetType === 'role' ? 'admin অথবা user' : 'মান টাইপ করুন'
                        }
                        className="w-full bg-slate-900/50 border border-slate-800 focus:border-red-500 rounded-xl p-3 text-sm text-white font-mono outline-none transition disabled:opacity-40"
                      />
                    </div>
                  )}

                  {/* Notification Title */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400">পুশ নোটিফিকেশন টাইটেল (Notification Title)</label>
                    <input
                      type="text"
                      value={pushTitle}
                      onChange={(e) => setPushTitle(e.target.value)}
                      required
                      disabled={!appConfig?.oneSignalAppId}
                      maxLength={100}
                      placeholder="যেমন: 📢 নতুন অফার ধামাকা!"
                      className="w-full bg-slate-900/50 border border-slate-800 focus:border-red-500 rounded-xl p-3 text-sm text-white outline-none transition disabled:opacity-40"
                    />
                  </div>

                  {/* Notification Message */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400">পুশ নোটিফিকেশন বার্তা (Message Body)</label>
                    <textarea
                      value={pushMessage}
                      onChange={(e) => setPushMessage(e.target.value)}
                      required
                      rows={3}
                      disabled={!appConfig?.oneSignalAppId}
                      maxLength={500}
                      placeholder="নোটিফিকেশনের বিস্তারিত টেক্সট এখানে লিখুন..."
                      className="w-full bg-slate-900/50 border border-slate-800 focus:border-red-500 rounded-xl p-3 text-sm text-white outline-none transition resize-none disabled:opacity-40"
                    />
                  </div>

                  {/* Optional Image URL & Upload from Gallery */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400">অপশনাল ব্যানার ইমেজ (Optional Banner Image)</label>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      <div className="md:col-span-8">
                        <input
                          type="url"
                          value={pushImageUrl}
                          onChange={(e) => setPushImageUrl(e.target.value)}
                          disabled={!appConfig?.oneSignalAppId}
                          placeholder="যেমন: https://example.com/banner.jpg অথবা সরাসরি গ্যালারি থেকে সিলেক্ট করুন"
                          className="w-full bg-slate-900/50 border border-slate-800 focus:border-red-500 rounded-xl p-3 text-sm text-white font-mono outline-none transition disabled:opacity-40"
                        />
                      </div>
                      <div className="md:col-span-4 flex items-center gap-2">
                        <label className={`w-full text-center bg-slate-850 hover:bg-slate-800 text-white text-xs font-black px-4 py-3 rounded-xl border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5 ${!appConfig?.oneSignalAppId ? 'opacity-40 cursor-not-allowed' : ''}`}>
                          <Upload className="w-3.5 h-3.5 text-red-500" />
                          গ্যালারি থেকে ছবি নিন
                          <input
                            type="file"
                            accept="image/*"
                            disabled={!appConfig?.oneSignalAppId}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 20 * 1024 * 1024) {
                                  alert("ইমেজ সাইজ 20 এমবি এর চেয়ে ছোট হতে হবে!");
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const img = new Image();
                                  img.onload = () => {
                                    const MAX_WIDTH = 800;
                                    const MAX_HEIGHT = 450;
                                    let width = img.width;
                                    let height = img.height;
                                    if (width > height) {
                                      if (width > MAX_WIDTH) {
                                        height *= MAX_WIDTH / width;
                                        width = MAX_WIDTH;
                                      }
                                    } else {
                                      if (height > MAX_HEIGHT) {
                                        width *= MAX_HEIGHT / height;
                                        height = MAX_HEIGHT;
                                      }
                                    }
                                    const canvas = document.createElement('canvas');
                                    canvas.width = width;
                                    canvas.height = height;
                                    const ctx = canvas.getContext('2d');
                                    if (ctx) {
                                      ctx.drawImage(img, 0, 0, width, height);
                                      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.60);
                                      setPushImageUrl(compressedBase64);
                                    } else {
                                      if (typeof event.target?.result === 'string') {
                                        setPushImageUrl(event.target.result);
                                      }
                                    }
                                  };
                                  img.src = event.target?.result as string;
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        {pushImageUrl && (
                          <button
                            type="button"
                            onClick={() => setPushImageUrl('')}
                            className="p-3 bg-red-950/40 border border-red-900/50 hover:bg-red-900/60 text-red-400 rounded-xl transition cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    {pushImageUrl && (
                      <div className="mt-2 border border-slate-800 rounded-xl p-2 bg-slate-950/40 flex items-center gap-3">
                        <img
                          src={pushImageUrl}
                          alt="Push Preview"
                          className="h-14 w-24 object-cover rounded-lg border border-slate-800"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block">ব্যানার প্রিভিউ</span>
                          <span className="text-[10px] font-mono text-slate-400 line-clamp-1">{pushImageUrl.startsWith('data:') ? 'গ্যালারি থেকে সিলেক্টেড ইমেজ (Base64)' : pushImageUrl}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Deep Link Dropdown */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400">ক্লিক অ্যাকশন স্ক্রিন (Deep Linking Screen)</label>
                    <select
                      value={pushDeepLink}
                      onChange={(e) => setPushDeepLink(e.target.value)}
                      disabled={!appConfig?.oneSignalAppId}
                      className="w-full bg-slate-900/50 border border-slate-800 focus:border-red-500 rounded-xl p-3 text-sm text-white outline-none transition cursor-pointer disabled:opacity-40"
                    >
                      <option value="">কোনোটিই নয় (হোম স্ক্রিন খুলবে)</option>
                      <option value="telecom">AMB টেলিকম / রিচার্জ স্ক্রিন</option>
                      <option value="samity">AMB সমবায় / সঞ্চয় স্ক্রিন</option>
                      <option value="qard">AMB কর্জে হাসানা ঋণ স্ক্রিন</option>
                      <option value="shop">AMB সুপার শপ ও অর্ডার</option>
                      <option value="agent">AMB এজেন্ট ক্যাশআউট পয়েন্ট</option>
                      <option value="escrow">AMB নিরাপদ লেনদেন এসক্রো</option>
                      <option value="ration">AMB রেশন কার্ড সিস্টেম</option>
                      <option value="courier">AMB ইনস্ট্যান্ট কুরিয়ার</option>
                      <option value="history">গ্রাহকের লেনদেনের ইতিহাস</option>
                      <option value="profile">গ্রাহক প্রোফাইল ও কেওয়াইসি</option>
                    </select>
                  </div>

                  {/* Submit button */}
                  <div className="md:col-span-2 pt-3">
                    <button
                      type="submit"
                      disabled={pushSending || !appConfig?.oneSignalAppId}
                      className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition duration-200 cursor-pointer ${
                        pushSending
                          ? 'bg-slate-800 text-slate-500 border border-slate-700'
                          : !appConfig?.oneSignalAppId
                          ? 'bg-red-950/20 text-red-500/50 border border-red-950 cursor-not-allowed'
                          : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20 active:scale-98'
                      }`}
                    >
                      <Send className="w-5 h-5" />
                      {pushSending ? 'পুশ নোটিফিকেশন পাঠানো হচ্ছে...' : 'OneSignal পুশ নোটিফিকেশন ব্রডকাস্ট করুন 🚀'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* 2. RECENTLY SENT PUSH NOTIFICATION HISTORY LOGS */}
            <div className="bg-slate-955 border border-slate-200/80 rounded-3xl p-6 space-y-4">
              <div className="border-b border-slate-200/80 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <History className="w-4.5 h-4.5 text-amber-500" />
                    সম্প্রতি প্রেরিত পুশ নোটিফিকেশন ইতিহাস ও রেকর্ড
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">সব মেম্বার বা নির্দিষ্ট গ্রাহকদের পাঠানো পুশ মেসেজের তালিকা (সর্বশেষ 100টি)</p>
                </div>
                <span className="px-3 py-1 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg text-[10px] font-bold font-mono">
                  সর্বমোট: {adminNotifications.filter(n => n.category === 'admin_msg').length}টি
                </span>
              </div>

              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {adminNotifications.filter(n => n.category === 'admin_msg').length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-12 font-bold font-sans bg-slate-900/25 border border-slate-900/30 rounded-2xl">
                    বর্তমানে কোনো পুশ নোটিফিকেশন রেকর্ড পাওয়া যায়নি।
                  </p>
                ) : (
                  adminNotifications
                    .filter(n => n.category === 'admin_msg')
                    .map((n, idx) => {
                      const isBroadcast = n.userId === 'all';
                      const targetUser = users.find(u => u.uid === n.userId);
                      return (
                        <div key={`${n.id}-${idx}`} className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-start justify-between gap-3 hover:bg-slate-900/80 transition duration-150">
                          <div className="space-y-2 max-w-[85%] text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[8.5px] font-black px-2 py-0.5 rounded border ${
                                isBroadcast 
                                  ? 'bg-amber-950/80 text-amber-400 border-amber-900/60' 
                                  : 'bg-emerald-950/80 text-emerald-400 border-emerald-900/60'
                              }`}>
                                {isBroadcast ? '📢 BROADCAST' : `👤 TO: ${targetUser ? targetUser.name : (n.memberId || n.userId || 'N/A')}`}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono font-bold">
                                {n.createdAt ? new Date(n.createdAt).toLocaleString('bn-BD') : ''}
                              </span>
                              {n.deepLink && (
                                <span className="text-[8px] bg-indigo-950/60 text-indigo-400 border border-indigo-900/40 px-1.5 py-0.5 rounded font-bold uppercase">
                                  🔗 স্ক্রিন: {n.deepLink}
                                </span>
                              )}
                            </div>
                            <h5 className="text-xs font-bold text-white">{n.title}</h5>
                            <p className="text-[11px] text-slate-400 font-medium whitespace-pre-line leading-relaxed">{n.body}</p>
                            {n.imageUrl && (
                              <div className="mt-2 rounded-lg overflow-hidden max-w-sm border border-slate-850">
                                <img src={n.imageUrl} alt="Notification Banner" className="w-full h-24 object-cover" referrerPolicy="no-referrer" />
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleDeleteAdminNotification(n.id)}
                            className="text-red-400 hover:text-red-300 p-2 bg-red-950/20 border border-red-900/30 rounded-xl hover:bg-red-900/30 shrink-0 cursor-pointer transition"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SYSTEM CONFIGURATION */}
        {adminTab === 'config' && (
          <div className="space-y-6">
            <form onSubmit={handleSaveConfig} className="space-y-6">
            <div className="bg-slate-955 border border-slate-200/80 rounded-3xl p-6 space-y-6">
              <div className="border-b border-slate-200/80 pb-4">
                <h3 className="text-base font-bold flex items-center gap-2 text-white text-left">
                  <Settings className="w-5 h-5 text-emerald-450 animate-spin" />
                  সিস্টেম প্যারামিটার ও অ্যাপ কনফিগারেশন (App Parameters)
                </h3>
                <p className="text-xs text-slate-500 mt-1 text-left">মো바일 নম্বর, ব্যাংক কার্ড, হেল্পডেস্ক কন্টাক্ট এবং সমিতির ভর্তি নিয়মাবলী পরিবর্তন করুন</p>
              </div>

              {cfgSuccess && (
                <div className="bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                  অভিনন্দন! অ্যাপের কনফিগারেশন সফলভাবে আপডেট করা হয়েছে।
                </div>
              )}

              {cfgError && (
                <div className="bg-rose-950/40 text-rose-400 border border-rose-800/60 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4.5 h-4.5 text-rose-450" />
                  {cfgError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Brand Logo Upload (Base64) */}
                <div className="md:col-span-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-5">
                  <div className="w-24 h-24 bg-white/5 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/10 shadow-lg relative overflow-hidden group">
                    {cfgLogoUrl ? (
                      <img src={cfgLogoUrl} alt="App Logo" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                    ) : (
                      <AMBLogo size={70} variant="white" />
                    )}
                    {cfgLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setCfgLogoUrl('')}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-[10px] text-red-400 font-bold uppercase cursor-pointer"
                      >
                        রিমুভ করুন
                      </button>
                    )}
                  </div>
                  <div className="flex-1 text-left space-y-1.5 w-full">
                    <label className="block text-xs font-extrabold text-slate-350 uppercase tracking-widest font-mono">কোম্পানি ব্র্যান্ড লোগো পরিবর্তন (Dynamic Brand Logo)</label>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      গ্যালারি থেকে আপনার কাস্টম ব্র্যান্ড লোগো বা পিএনজি (PNG/JPG) ফাইল আপলোড করুন। লোগোটি সরাসরি লগইন স্ক্রিন ও পিন লক স্ক্রিনে সেট হয়ে যাবে। (ফাইলের সাইজ 250 কিলোবাইটের কম বাঞ্ছনীয়)।
                    </p>
                    <div className="flex items-center gap-3">
                      <label className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        লোগো আপলোড করুন
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 300 * 1024) {
                                alert("ফাইল সাইজ খুব বেশি! দয়া করে 300 কেবির কম সাইজের ছবি আপলোড করুন।");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                if (event.target?.result) {
                                  setCfgLogoUrl(event.target.result as string);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {cfgLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setCfgLogoUrl('')}
                          className="text-xs text-rose-450 hover:text-rose-400 font-bold transition"
                        >
                          ডিফল্ট লোগোতে ফিরে যান
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* App Name */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-extrabold text-slate-350 uppercase tracking-widest font-mono">নেটওয়ার্ক ব্রান্ডিং নাম (App Name)</label>
                  <input
                    type="text"
                    value={cfgAppName}
                    onChange={(e) => setCfgAppName(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-emerald-500 rounded-xl p-3 text-sm text-slate-900 font-bold outline-none transition"
                    placeholder="যেমন: AMB Business Network"
                  />
                  <p className="text-[10px] text-slate-500">ড্যাশবোর্ড এবং হোম স্ক্রিনে প্রদর্শিত মূল ব্র্যান্ডের নাম।</p>
                </div>

                {/* Support Hotline / WhatsApp */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-extrabold text-slate-350 uppercase tracking-widest font-mono">হেল্পডেস্ক সাপোর্ট নম্বর (WhatsApp Hotline)</label>
                  <input
                    type="text"
                    value={cfgSupportPhone}
                    onChange={(e) => setCfgSupportPhone(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-emerald-500 rounded-xl p-3 text-sm text-slate-900 font-mono font-bold outline-none transition"
                    placeholder="যেমন: +8801865911728"
                  />
                  <p className="text-[10px] text-slate-500">হেল্প লিংকে ক্লিক করলে এই হোয়াটসঅ্যাপ নাম্বারে চ্যাট রিডাইরেক্ট হবে।</p>
                </div>

                {/* OneSignal Configuration Panel (Standalone Card) */}
                <div className="md:col-span-2 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                  <div className="border-b border-slate-800 pb-2.5">
                    <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2 text-left font-sans">
                      <BellRing className="w-4 h-4 text-amber-400" />
                      OneSignal পুশ নোটিফিকেশন সিস্টেম কনফিগারেশন (OneSignal Credentials)
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 text-left">
                      ডিভাইস-ভিত্তিক নোটিফিকেশন সিঙ্ক ও এলার্ট প্রেরণের জন্য আপনার OneSignal ক্রেডেনশিয়াল নিচে নির্ভুলভাবে দিন।
                    </p>
                  </div>

                  {oneSignalSuccess && (
                    <div className="bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 p-3 rounded-xl text-[11px] font-bold flex items-center gap-2 text-left">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      অভিনন্দন! OneSignal ক্রেডেনশিয়াল সফলভাবে এবং চিরস্থায়ীভাবে ডেটাবেজে সংরক্ষিত হয়েছে।
                    </div>
                  )}

                  {oneSignalError && (
                    <div className="bg-rose-950/40 text-rose-400 border border-rose-800/60 p-3 rounded-xl text-[11px] font-bold flex items-center gap-2 text-left">
                      <AlertTriangle className="w-4 h-4 text-rose-450" />
                      {oneSignalError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* OneSignal App ID */}
                    <div className="space-y-1.5 text-left">
                      <label className="block text-xs font-extrabold text-slate-350 uppercase tracking-widest font-mono">OneSignal App ID (পুশ নোটিফিকেশন অ্যাপ আইডি)</label>
                      <input
                        type="text"
                        value={cfgOneSignalAppId}
                        onChange={(e) => setCfgOneSignalAppId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-sm text-white font-mono font-bold outline-none transition"
                        placeholder="যেমন: abcdef12-3456-7890-abcd-ef1234567890"
                      />
                      <p className="text-[10px] text-slate-500 font-medium">মোবাইল ও ওয়েব পুশ নোটিফিকেশনের জন্য OneSignal App ID।</p>
                    </div>

                    {/* OneSignal REST API Key */}
                    <div className="space-y-1.5 text-left">
                      <label className="block text-xs font-extrabold text-slate-350 uppercase tracking-widest font-mono">OneSignal REST API Key (পুশ নোটিফিকেশন সিক্রেট কি)</label>
                      <div className="relative">
                        <input
                          type={showOneSignalKey ? "text" : "password"}
                          value={cfgOneSignalRestApiKey}
                          onChange={(e) => setCfgOneSignalRestApiKey(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-3 pr-10 py-3 text-sm text-white font-mono font-bold outline-none transition"
                          placeholder="সিক্রেট REST API Key দিন"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOneSignalKey(!showOneSignalKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition focus:outline-none cursor-pointer"
                        >
                          {showOneSignalKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">ব্যাকএন্ড থেকে পুশ প্রেরণের জন্য OneSignal API Key। এটি ব্যাকএন্ডে সুরক্ষিত থাকবে।</p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveOneSignalSettings}
                      disabled={oneSignalSaving}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-black transition-all hover:scale-101 active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      {oneSignalSaving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> সংরক্ষণ করা হচ্ছে...
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" /> ওয়ান সিগন্যাল ক্রেডেনশিয়াল সেভ করুন (Save OneSignal)
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Collection MFS phone */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-extrabold text-slate-350 uppercase tracking-widest font-mono">পেমেন্ট কালেকশন মোবাইল (MFS Personal Number)</label>
                  <input
                    type="text"
                    value={cfgPersonalMfsNumber}
                    onChange={(e) => setCfgPersonalMfsNumber(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-emerald-500 rounded-xl p-3 text-sm text-slate-900 font-mono font-bold outline-none transition"
                    placeholder="যেমন: 01865911728"
                  />
                  <p className="text-[10px] text-slate-500">সদস্যরা ডিপোজিট ও লোন কিস্তি পরিশোধের জন্য এই নম্বরে সেন্ডমানি করবে।</p>
                </div>

                {/* DBBL Bank Card */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-extrabold text-slate-350 uppercase tracking-widest font-mono">কালেকশন ব্যাংক কার্ড নম্বর (DBBL Card ID)</label>
                  <input
                    type="text"
                    value={cfgPersonalBankCard}
                    onChange={(e) => setCfgPersonalBankCard(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-emerald-500 rounded-xl p-3 text-sm text-slate-900 font-mono font-bold outline-none transition"
                    placeholder="যেমন: 4840610010369801"
                  />
                  <p className="text-[10px] text-slate-500">ব্যাংক ট্রান্সফার ডিপোজিট ও লোন পরিশোধের ক্ষেত্রে প্রযোজ্য কার্ড নম্বর।</p>
                </div>

                {/* Scrolling Ticker Notices for All Sections */}
                <div className="space-y-4 text-left md:col-span-2 pt-4 border-t border-slate-200/80">
                  <h4 className="text-sm font-bold text-amber-400">📢 সকল সেকশনের স্ক্রলিং নোটিশ (ঘোষণা) সমূহ</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-600">📱 মূল ড্যাশবোর্ড নোটিশ (Dashboard Ticker)</label>
                      <input
                        type="text"
                        value={cfgTickerText}
                        onChange={(e) => setCfgTickerText(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200/80 focus:border-amber-500 rounded-xl p-3 text-xs text-slate-900 font-semibold outline-none transition"
                        placeholder="ড্যাশবোর্ড ঘোষণা..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-600">🏢 ইনভেস্টর খাতা নোটিশ (Investor/Samity Ticker)</label>
                      <input
                        type="text"
                        value={cfgSamityTicker}
                        onChange={(e) => setCfgSamityTicker(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200/80 focus:border-amber-500 rounded-xl p-3 text-xs text-slate-900 font-semibold outline-none transition"
                        placeholder="সমবায় সমিতি ঘোষণা..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-600">🤝 করযে হাসানা তহবিল নোটিশ (Qard Ticker)</label>
                      <input
                        type="text"
                        value={cfgQardTicker}
                        onChange={(e) => setCfgQardTicker(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200/80 focus:border-amber-500 rounded-xl p-3 text-xs text-slate-900 font-semibold outline-none transition"
                        placeholder="করযে হাসানা ঘোষণা..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-600">🛍️ সুপার শপ পণ্য নোটিশ (Safi Shop Ticker)</label>
                      <input
                        type="text"
                        value={cfgSafiTicker}
                        onChange={(e) => setCfgSafiTicker(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200/80 focus:border-amber-500 rounded-xl p-3 text-xs text-slate-900 font-semibold outline-none transition"
                        placeholder="Safi সুপার শপ ঘোষণা..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-600">🛡️ নিরাপদ লেনদেন এসক্রো নোটিশ (SafeDeals Ticker)</label>
                      <input
                        type="text"
                        value={cfgEscrowTicker}
                        onChange={(e) => setCfgEscrowTicker(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200/80 focus:border-amber-500 rounded-xl p-3 text-xs text-slate-900 font-semibold outline-none transition"
                        placeholder="নিরাপদ এসক্রো ঘোষণা..."
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600">🥗 কো-অপারেটিভ রেশন কার্ড নোটিশ (Ration Ticker)</label>
                      <input
                        type="text"
                        value={cfgRationTicker}
                        onChange={(e) => setCfgRationTicker(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200/80 focus:border-amber-500 rounded-xl p-3 text-xs text-slate-900 font-semibold outline-none transition"
                        placeholder="রেশন কার্ড ঘোষণা..."
                      />
                    </div>
                  </div>
                </div>

                {/* Samity Terms */}
                <div className="space-y-1.5 text-left md:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-350 uppercase tracking-widest font-mono">ভর্তি নিয়মাবলী ও নির্দেশাবলী (Samity Registration Rules)</label>
                  <textarea
                    rows={4}
                    value={cfgSamityTerms}
                    onChange={(e) => setCfgSamityTerms(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-emerald-500 rounded-xl p-3 text-sm text-slate-900 font-semibold outline-none transition leading-relaxed"
                    placeholder="সদস্যপদ নিয়ামাবলী..."
                  />
                  <p className="text-[10px] text-slate-500">সমিতি ফরম পূরণের শুরুতে সদস্যদের উদ্দেশ্যে প্রদর্শনযোগ্য আবেদনের নিয়মাবলী ও সার্ভিস ফি নির্দেশাবলী।</p>
                </div>

                {/* Maintenance Mode & App Update Controls */}
                <div className="space-y-6 md:col-span-2 pt-6 border-t border-slate-200/80">
                  <div className="flex flex-col text-left">
                    <h4 className="text-sm font-bold text-rose-450 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-450" />
                      রক্ষণাবেক্ষণ মোড ও অ্যাপ আপডেট সেটিংস (Maintenance & App Updates)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      অ্যাপ্লিকেশন সাময়িকভাবে বন্ধ রাখতে রক্ষণাবেক্ষণ মোড চালু করুন অথবা নতুন সংস্করণের জন্য বাধ্যতামূলক আপডেট উইন্ডো চালু করুন।
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
                    
                    {/* 1. Maintenance Mode Section */}
                    <div className="space-y-4 border-r border-slate-800/60 pr-0 md:pr-6">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-white">⚙️ রক্ষণাবেক্ষণ মোড (Maintenance Mode)</span>
                          <span className="text-[10px] text-slate-500">চালু করলে সাধারণ গ্রাহকদের জন্য সম্পূর্ণ অ্যাপ সাময়িক বন্ধ থাকবে</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setCfgMaintenanceMode(!cfgMaintenanceMode)}
                          className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer select-none shrink-0 ${
                            cfgMaintenanceMode ? 'bg-rose-500' : 'bg-slate-700'
                          }`}
                        >
                          <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                            cfgMaintenanceMode ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {cfgMaintenanceMode && (
                        <div className="space-y-3 pt-2">
                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] font-bold text-slate-400">রক্ষণাবেক্ষণ শিরোনাম (Title)</label>
                            <input
                              type="text"
                              value={cfgMaintenanceTitle}
                              onChange={(e) => setCfgMaintenanceTitle(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl p-2.5 text-xs text-white outline-none transition"
                              placeholder="যেমনঃ আমরা আপডেট করছি"
                            />
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] font-bold text-slate-400">রক্ষণাবেক্ষণ বিবরণ (Description)</label>
                            <textarea
                              rows={3}
                              value={cfgMaintenanceDescription}
                              onChange={(e) => setCfgMaintenanceDescription(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl p-2.5 text-xs text-white outline-none transition"
                              placeholder="কেন সিস্টেম বন্ধ আছে..."
                            />
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] font-bold text-slate-400">সম্ভাব্য সময়সীমা (Estimated Time)</label>
                            <input
                              type="text"
                              value={cfgMaintenanceEstimatedTime}
                              onChange={(e) => setCfgMaintenanceEstimatedTime(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl p-2.5 text-xs text-white outline-none transition"
                              placeholder="যেমনঃ 30 - 60 মিনিট"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Force Update Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-white">🚀 বাধ্যতামূলক আপডেট (Force Update)</span>
                          <span className="text-[10px] text-slate-500">নতুন ভার্সনে আপডেট করার জন্য গ্রাহকদের বাধ্য করা হবে</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setCfgForceUpdateActive(!cfgForceUpdateActive)}
                          className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer select-none shrink-0 ${
                            cfgForceUpdateActive ? 'bg-amber-500' : 'bg-slate-700'
                          }`}
                        >
                          <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                            cfgForceUpdateActive ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {cfgForceUpdateActive && (
                        <div className="space-y-3 pt-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1 text-left">
                              <label className="block text-[10px] font-bold text-slate-400">সর্বনিম্ন ভার্সন (Min Version)</label>
                              <input
                                type="text"
                                value={cfgMinAppVersion}
                                onChange={(e) => setCfgMinAppVersion(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white font-mono outline-none transition"
                                placeholder="যেমনঃ 2.0"
                              />
                            </div>
                            <div className="space-y-1 text-left">
                              <label className="block text-[10px] font-bold text-slate-400">সর্বশেষ ভার্সন (Latest Version)</label>
                              <input
                                type="text"
                                value={cfgLatestAppVersion}
                                onChange={(e) => setCfgLatestAppVersion(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white font-mono outline-none transition"
                                placeholder="যেমনঃ 2.0"
                              />
                            </div>
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] font-bold text-slate-400">ডাউনলোড লিংক (Download Link)</label>
                            <input
                              type="text"
                              value={cfgDownloadLink}
                              onChange={(e) => setCfgDownloadLink(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white font-mono outline-none transition"
                              placeholder="প্লে-স্টোর বা ড্রাইভ লিংক"
                            />
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] font-bold text-slate-400">আপডেট টাইটেল (Update Title)</label>
                            <input
                              type="text"
                              value={cfgUpdateTitle}
                              onChange={(e) => setCfgUpdateTitle(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white outline-none transition"
                              placeholder="যেমনঃ নতুন সংস্করণ উপলব্ধ!"
                            />
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="block text-[10px] font-bold text-slate-400">আপডেট বিবরণ (Description)</label>
                            <textarea
                              rows={2}
                              value={cfgUpdateDescription}
                              onChange={(e) => setCfgUpdateDescription(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white outline-none transition"
                              placeholder="আপডেটে কি কি নতুন ফিচার রয়েছে..."
                            />
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* 12 Live Services On/Off Toggle Matrix */}
                <div className="space-y-4 md:col-span-2 pt-6 border-t border-slate-200/80">
                  <div className="flex flex-col text-left">
                    <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      সেবা ও মেনু কন্ট্রোল প্যানেল (Service Feature Flags)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      যে সকল সেবার কাজ চলমান আছে বা সাময়িকভাবে বন্ধ রাখতে চান, সেগুলো এখান থেকে চালু (ON) অথবা বন্ধ (OFF) করতে পারবেন। বন্ধ করা সার্ভিসে ক্লিক করলে ব্যবহারকারীদের "কাজ চলতেছে, খুব শীঘ্রই চালু হবে" নোটিফিকেশন প্রদর্শন করা হবে।
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                    {[
                      { key: 'samity', label: 'AMB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর' },
                      { key: 'bank', label: 'MY AMB লেনদেন (রেমিট্যান্স)' },
                      { key: 'telecom', label: 'AMB টেলিকম (ফ্লেক্সিলোড)' },
                      { key: 'shop', label: 'AMB সুপার শপ (পণ্য অর্ডার)' },
                      { key: 'qard', label: 'করযে হাসানা (সুদমুক্ত ঋণ)' },
                      { key: 'safedeals', label: 'নিরাপদ লেনদেন (ভেরিফাইড পাইকারি)' },
                      { key: 'safi', label: 'প্রিমিয়াম Safi (খাঁটি পণ্য)' },
                      { key: 'ration', label: 'AMB রেশন কার্ড (পাইকারি ছাড়)' },
                      { key: 'chat', label: 'লাইভ চ্যাট (সাপোর্ট রুম)' },
                      { key: 'agent', label: 'AMB এজেন্ট (ক্যারিয়ার পোর্টাল)' },
                      { key: 'about', label: 'আমাদের সম্পর্কে (পরিচিতি)' },
                      { key: 'bap', label: 'বাংলাদেশ এডমিন প্যানেল' },
                    ].map((svc) => {
                      const isActive = cfgServiceStatus[svc.key] !== false; // Default true if undefined
                      return (
                        <div 
                          key={svc.key}
                          onClick={() => {
                            setCfgServiceStatus(prev => ({
                              ...prev,
                              [svc.key]: !isActive
                            }));
                          }}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                            isActive 
                              ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50' 
                              : 'bg-slate-900 border-slate-800 hover:border-slate-750'
                          }`}
                        >
                          <div className="flex flex-col text-left min-w-0 pr-2">
                            <span className="text-xs font-bold text-white truncate">{svc.label}</span>
                            <span className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${
                              isActive ? 'text-emerald-400' : 'text-slate-500 font-mono'
                            }`}>
                              {isActive ? '● সক্রিয় (ACTIVE)' : '○ নিষ্ক্রিয় (OFF)'}
                            </span>
                          </div>
                          
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
                            isActive ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                              isActive ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

                {/* 🎨 ড্যাশবোর্ড লেআউট ও ইউজার ইন্টারফেস কাস্টমাইজেশন প্যানেল */}
                <div className="space-y-4 md:col-span-2 pt-6 border-t border-slate-200/80">
                  <div className="flex flex-col text-left">
                    <h4 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                      <LayoutGrid className="w-4 h-4 text-amber-400 animate-pulse" />
                      🎨 ড্যাশবোর্ড লেআউট ও ডিজাইন কাস্টমাইজেশন (Dynamic UI Engine)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      গ্রাহকদের ড্যাশবোর্ড হোমস্ক্রীনের ব্যানার অনুপাত, সার্ভিস বক্স গ্রিড কলাম, লোগো সাইজ এবং নিচের নেভিগেশন বারের চিকন/মোটা ও অপশনগুলো এখান থেকে সম্পূর্ণ নিয়ন্ত্রণ করতে পারবেন।
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
                    
                    {/* 1. Banner Controls */}
                    <div className="space-y-4 text-left border-b md:border-b-0 md:border-r border-slate-800/65 pb-4 md:pb-0 md:pr-6">
                      <span className="text-xs font-bold text-slate-350 block mb-2">🖼️ ব্যানার সেটিংস (Banner Configuration)</span>
                      
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400">ব্যানারের আকৃতি ও উচ্চতা (Banner Aspect Ratio)</label>
                        <select
                          value={cfgBannerHeightType}
                          onChange={(e: any) => setCfgBannerHeightType(e.target.value)}
                          className="w-full bg-slate-955 border border-slate-200/80 focus:border-emerald-500 rounded-xl p-2.5 text-xs text-slate-700 font-bold outline-none transition"
                        >
                          <option value="16:9">YouTube Standard (16:9)</option>
                          <option value="21:9">Landscape Wide (21:9)</option>
                          <option value="32:9">Panoramic Wide (32:9)</option>
                          <option value="thin">চিকন ব্যানার (Thin)</option>
                          <option value="medium">মাঝারি ব্যানার (Medium)</option>
                          <option value="thick">মোটা ব্যানার (Thick)</option>
                          <option value="custom">কাস্টম উচ্চতা (Custom Height)</option>
                        </select>
                      </div>

                      {cfgBannerHeightType === 'custom' && (
                        <div className="space-y-1 animate-fade-in">
                          <label className="block text-[10px] font-bold text-slate-400">কাস্টম উচ্চতা (পিক্সেল): {cfgBannerHeightValue}px</label>
                          <input
                            type="range"
                            min="80"
                            max="350"
                            step="5"
                            value={cfgBannerHeightValue}
                            onChange={(e) => setCfgBannerHeightValue(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* 2. Service Grid & Icon Controls */}
                    <div className="space-y-4 text-left border-b md:border-b-0 md:border-r border-slate-800/65 pb-4 md:pb-0 md:px-6">
                      <span className="text-xs font-bold text-slate-350 block mb-2">⊞ সার্ভিস গ্রিড সেটিংস (Service Grid Layout)</span>
                      
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400">ড্যাশবোর্ড গ্রিড কলাম সংখ্যা (Service Grid Columns)</label>
                        <select
                          value={cfgGridColsCount}
                          onChange={(e: any) => setCfgGridColsCount(Number(e.target.value))}
                          className="w-full bg-slate-955 border border-slate-200/80 focus:border-emerald-500 rounded-xl p-2.5 text-xs text-slate-700 font-bold outline-none transition font-semibold"
                        >
                          <option value={2}>2 টি করে বক্স (2 Columns)</option>
                          <option value={3}>3 টি করে বক্স (3 Columns - Default)</option>
                          <option value={4}>4 টি করে বক্স (4 Columns)</option>
                          <option value={5}>5 টি করে বক্স (5 Columns)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400">গ্রিড আইকন/লোগোর আকার (Icon Size Type)</label>
                        <select
                          value={cfgGridIconSize}
                          onChange={(e: any) => setCfgGridIconSize(e.target.value as any)}
                          className="w-full bg-slate-955 border border-slate-200/80 focus:border-emerald-500 rounded-xl p-2.5 text-xs text-slate-700 font-bold outline-none transition"
                        >
                          <option value="small">ছোট লোগো (Small)</option>
                          <option value="medium">মাঝারি লোগো (Medium - Default)</option>
                          <option value="large">বড় লোগো (Large - Highly Readable)</option>
                          <option value="custom">কাস্টম আকার (Custom Pixels)</option>
                        </select>
                      </div>

                      {cfgGridIconSize === 'custom' && (
                        <div className="space-y-1 animate-fade-in">
                          <label className="block text-[10px] font-bold text-slate-400">কাস্টম আইকন সাইজ (পিক্সেল): {cfgGridIconSizeValue}px</label>
                          <input
                            type="range"
                            min="32"
                            max="120"
                            step="2"
                            value={cfgGridIconSizeValue}
                            onChange={(e) => setCfgGridIconSizeValue(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* 3. Bottom Navigation Controls */}
                    <div className="space-y-4 text-left md:pl-6">
                      <span className="text-xs font-bold text-slate-350 block mb-2">📌 নিচের নেভিগেশন বার সেটিংস (Bottom Navigation)</span>
                      
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400">নেভিগেশন বারের থিকনেস (Navigation Height)</label>
                        <select
                          value={cfgBottomNavHeightType}
                          onChange={(e: any) => setCfgBottomNavHeightType(e.target.value)}
                          className="w-full bg-slate-955 border border-slate-200/80 focus:border-emerald-500 rounded-xl p-2.5 text-xs text-slate-700 font-bold outline-none transition"
                        >
                          <option value="thin">চিকন বার (Thin - Space Saver)</option>
                          <option value="medium">মাঝারি বার (Medium - Default)</option>
                          <option value="thick">মোটা বার (Thick)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400">সক্রিয় ট্যাব সমূহ (Active Tabs Selection)</label>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {[
                            { key: 'home', label: '🏠 হোম (Home)' },
                            { key: 'deposit', label: '💸 সেন্ড মানি (Send)' },
                            { key: 'add_money', label: '➕ AMB এড মানি (Add Money)' },
                            { key: 'history', label: '📋 লেনদেন (Transactions)' },
                            { key: 'profile', label: '👤 প্রোফাইল (Card)' }
                          ].map((tab) => {
                            const isSelected = cfgBottomNavTabs.includes(tab.key);
                            return (
                              <button
                                type="button"
                                key={tab.key}
                                onClick={() => {
                                  if (isSelected) {
                                    if (cfgBottomNavTabs.length > 1) {
                                      setCfgBottomNavTabs(cfgBottomNavTabs.filter(k => k !== tab.key));
                                    } else {
                                      alert("কমপক্ষে একটি ট্যাব অবশ্যই সক্রিয় রাখতে হবে!");
                                    }
                                  } else {
                                    setCfgBottomNavTabs([...cfgBottomNavTabs, tab.key]);
                                  }
                                }}
                                className={`p-2 rounded-lg text-[10px] font-black text-left border transition-all truncate flex items-center justify-between cursor-pointer ${
                                  isSelected 
                                    ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-600 font-extrabold' 
                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                              >
                                <span>{tab.label}</span>
                                <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 🔄 System Reset Quick Launcher Banner */}
                <div className="space-y-3 md:col-span-2 pt-6 border-t border-slate-200/80">
                  <div className="bg-gradient-to-r from-rose-900 via-red-950 to-slate-900 p-5 rounded-2xl border border-rose-800/60 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-500/40 flex items-center justify-center shrink-0">
                        <RefreshCw className="w-5 h-5 text-rose-300" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white flex items-center gap-2">
                          ⚙️ সিস্টেম ও হিসাব রিসেট প্যানেল (System Reset & Initialization)
                        </h4>
                        <p className="text-[11px] text-rose-200/80 mt-0.5">
                          অ্যাপ পাবলিশের পূর্বে সমস্ত টেস্ট ব্যালেন্স ও ট্রানজেকশন ক্লিয়ার করতে অথবা ফ্রেশ স্টার্ট করতে এখানে যান।
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdminTab('system_reset')}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> রিসেট পেজে যান
                    </button>
                  </div>
                </div>

              <div className="pt-4 border-t border-slate-200/80 flex justify-end">
                <button
                  type="submit"
                  disabled={cfgSaving}
                  className="py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 active:scale-98 transition shadow-lg shadow-emerald-950/20 cursor-pointer"
                >
                  {cfgSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> কনফিগারেশন সেভ করা হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> কনফিগারেশন আপডেট সেভ করুন (Save Settings)
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* HISTORY RETENTION SETTINGS & CLEANUP CONTROL */}
          <HistoryRetentionSettings appConfig={appConfig} onChangeConfig={onChangeConfig} />
        </div>
        )}

        {/* TAB 7.5: RECEIPT & VOUCHER THEME DESIGNER */}
    </>
  );
}
