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

export function AdminRationSection(props: any) {
  const {
    adminTab,
    y,
    text,
    left,
    type,
    setRationAdminTab,
    rationAdminTab,
    rationCards,
    rc,
    key,
    id,
    name,
    approvingRationId,
    newCardNumber,
    setNewCardNumber,
    target,
    newCardExpiry,
    setNewCardExpiry,
    handleApproveRationCardWithDetails,
    setApprovingRationId,
    handleRejectRationCardDirect,
    handleCreateRationCardManually,
    rcNewUserId,
    setRcNewUserId,
    rcNewName,
    setRcNewName,
    rcNewPhone,
    setRcNewPhone,
    rcNewCardNo,
    setRcNewCardNo,
    rcNewCardType,
    setRcNewCardType,
    rcNewVipCardBg,
    setRcNewVipCardBg,
    rcNewVipBorderColor,
    setRcNewVipBorderColor,
    rcNewVipPrimaryColor,
    setRcNewVipPrimaryColor,
    rcNewVipTextColor,
    setRcNewVipTextColor,
    rcNewVillage,
    setRcNewVillage,
    rcNewUpazila,
    setRcNewUpazila,
    rcNewDistrict,
    setRcNewDistrict,
    rcNewNomineeName,
    setRcNewNomineeName,
    file,
    alert,
    reader,
    setRcNewPhoto,
    rcNewPhoto,
    img,
    list,
    fetchRationCards,
    rationSearchQuery,
    setRationSearchQuery,
    loadingRationCards,
    handleOpenEditRation,
    handleDeleteRationCard,
    rationAdminItems,
    handleOpenAddRationItem,
    item,
    data,
    handleOpenEditRationItem,
    handleDeleteRationItem,
    handleSaveRationSettings,
    cfgRationTicker,
    setCfgRationTicker,
    cfgRationTitleText,
    setCfgRationTitleText,
    cfgRationMaxSelectLimit,
    setCfgRationMaxSelectLimit,
    cfgRationTotalItemsText,
    setCfgRationTotalItemsText
  } = props;

  return (
    <>
        {adminTab === 'ration_admin' && (
          <div className="space-y-6 animate-fade-in text-slate-700 text-left font-sans">
            {/* Header section */}
            <div className="bg-slate-50 border border-slate-200/80 p-6 rounded-3xl">
              <div className="border-b border-slate-200/80 pb-4 mb-3">
                <h2 className="text-base sm:text-lg font-black text-emerald-450 flex items-center gap-2">
                  🥗 কো-অপারেティブ ডিজিটাল রেশন কার্ড এডমিন সেল
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-semibold leading-relaxed">
                  এখানে সমবায় সদস্যদের জন্য ডিজিটাল রেশন কার্ডের ডাটাবেস পরিচালনা করতে পারবেন। পেন্ডিং আবেদন সংশোধন বা বাতিল, নতুন কার্ড ম্যানুয়ালি সংযুক্তকরণ এবং সকল অ্যাকশন সম্পাদন সম্ভব।
                </p>
              </div>

              <div className="flex gap-2 pt-1 pb-1">
                <button
                  type="button"
                  onClick={() => setRationAdminTab('cards')}
                  className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer ${rationAdminTab === 'cards' ? 'bg-emerald-800 text-white shadow-sm' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                >
                  📋 রেশন কার্ড ও আবেদনপত্র
                </button>
                <button
                  type="button"
                  onClick={() => setRationAdminTab('products')}
                  className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer ${rationAdminTab === 'products' ? 'bg-emerald-800 text-white shadow-sm' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                >
                  🍚 সাশ্রয়ী রেশন পণ্য তালিকা
                </button>
                <button
                  type="button"
                  onClick={() => setRationAdminTab('settings')}
                  className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer ${rationAdminTab === 'settings' ? 'bg-emerald-800 text-white shadow-sm' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                >
                  ⚙️ রেশন কার্ড সেটিংস
                </button>
              </div>
            </div>

            {rationAdminTab === 'cards' && (
              <>
                {/* 🥗 অমীমাংসিত ডিজিটাল রেশন কার্ড আবেদনসমূহ (Contextual Approvals) */}
                {rationCards.filter(rc => rc.status === 'pending').length > 0 && (
                <div className="mb-6 bg-emerald-955/20 border border-emerald-500/30 p-5 rounded-3xl text-left space-y-4 animate-fade-in text-slate-800">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        🥗 অমীমাংসিত ডিজিটাল রেশন কার্ড আবেদনসমূহ ({rationCards.filter(rc => rc.status === 'pending').length}  টি)
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">সদস্যদের পাঠানো রেশন কার্ড আবেদনপত্রগুলো যাচাই করে এখান থেকে অনুমোদন বা বাতিল করুন।</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {rationCards.filter(rc => rc.status === 'pending').map((rc, idx) => (
                      <div key={`${rc.id}-${idx}`} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-emerald-500/40 transition">
                        <div className="space-y-1.5 text-left flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded leading-none">
                              রেশন কার্ড আবেদন
                            </span>
                            <h4 className="text-xs font-black text-slate-850">{rc.name || rc.userName}</h4>
                            <span className="text-[10px] text-slate-500 font-mono font-bold">({rc.cardNumber || rc.cardNo})</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 font-sans">
                            <div>📱 ফোনঃ <span className="font-mono text-slate-800 font-semibold">{rc.phone}</span></div>
                            <div>📍 এলাকাঃ <span className="text-slate-800">{rc.village}, {rc.upazila}, {rc.district}</span></div>
                            <div>🏷️ কার্ডের ধরণঃ <span className="text-amber-600 font-bold">{rc.cardType || 'Standard'}</span></div>
                            {rc.nomineeName && <div>নমিনীঃ <span className="text-slate-800 font-medium">{rc.nomineeName}</span></div>}
                          </div>
                        </div>

                        <div className="flex gap-1.5 shrink-0 justify-end">
                          {approvingRationId === rc.id ? (
                            <div className="flex flex-col gap-2 p-2 bg-white rounded-xl border border-slate-200">
                              <input 
                                placeholder="কার্ড নম্বর" 
                                value={newCardNumber} 
                                onChange={(e) => setNewCardNumber(e.target.value)}
                                className="text-xs p-1 border rounded"
                              />
                              <input 
                                placeholder="মেয়াদ (যেমন: 2028)" 
                                value={newCardExpiry} 
                                onChange={(e) => setNewCardExpiry(e.target.value)}
                                className="text-xs p-1 border rounded"
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleApproveRationCardWithDetails(rc.id)}
                                  className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold"
                                >
                                  সেভ ও অনুমোদন
                                </button>
                                <button
                                  onClick={() => setApprovingRationId(null)}
                                  className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                                >
                                  বাতিল
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setApprovingRationId(rc.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black transition cursor-pointer flex items-center gap-1 shadow-md"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> অনুমোদন দিন
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectRationCardDirect(rc.id)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-rose-650 text-slate-500 hover:text-white rounded-xl text-[11px] font-bold transition cursor-pointer"
                              >
                                বাতিল
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats overview banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 border border-slate-800/85 rounded-2xl">
                  <span className="block text-[10px] text-slate-450 uppercase font-black tracking-wider">মোট আবেদন ও কার্ড</span>
                  <p className="text-xl font-mono font-black text-white mt-1">{rationCards.length} টি</p>
                </div>
                <div className="bg-white p-4 border border-slate-800/85 rounded-2xl">
                  <span className="block text-[10px] text-emerald-450 uppercase font-black tracking-wider">সক্রিয় কার্ডসমূহ</span>
                  <p className="text-xl font-mono font-black text-emerald-400 mt-1">
                    {rationCards.filter(r => r.status === 'active' || r.status === 'approved').length} টি
                  </p>
                </div>
                <div className="bg-white p-4 border border-slate-800/85 rounded-2xl">
                  <span className="block text-[10px] text-amber-450 uppercase font-black tracking-wider">পেন্ডিং যাচাইকরণ</span>
                  <p className="text-xl font-mono font-black text-amber-400 mt-1">
                    {rationCards.filter(r => r.status === 'pending').length} টি
                  </p>
                </div>
                <div className="bg-white p-4 border border-slate-800/85 rounded-2xl">
                  <span className="block text-[10px] text-rose-450 uppercase font-black tracking-wider">বাতিলকৃত কার্ড</span>
                  <p className="text-xl font-mono font-black text-rose-450 mt-1">
                    {rationCards.filter(r => r.status === 'rejected' || r.status === 'inactive').length} : 0 টি
                  </p>
                </div>
              </div>

              {/* Dynamic split view */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left side: Add manually */}
                <div className="lg:col-span-4 bg-slate-950/70 border border-slate-100 p-5 rounded-2xl">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2.5 mb-4 flex items-center gap-1">
                    ➕ ম্যানুয়ালি রেশন কার্ড সংযোজন
                  </h3>

                  <form onSubmit={handleCreateRationCardManually} className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1">সদস্য ইউআইডি (UserId - ঐচ্ছিক)</label>
                      <input
                        type="text"
                        value={rcNewUserId}
                        onChange={(e) => setRcNewUserId(e.target.value)}
                        placeholder="সদস্যের UID (যেমন: s66Adf...)"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1">সদস্যের পূর্ণ নাম *</label>
                      <input
                        type="text"
                        value={rcNewName}
                        onChange={(e) => setRcNewName(e.target.value)}
                        required
                        placeholder="যেমন: মোঃ সাকিব হাসান"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-xl text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1">মোবাইল নম্বর *</label>
                      <input
                        type="text"
                        value={rcNewPhone}
                        onChange={(e) => setRcNewPhone(e.target.value)}
                        required
                        placeholder="যেমন: 017XXXXXXXX"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-xl text-xs font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 mb-1">কার্ড নম্বর *</label>
                        <input
                          type="text"
                          value={rcNewCardNo}
                          onChange={(e) => setRcNewCardNo(e.target.value)}
                          required
                          placeholder="AMBRC-746"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-xl text-xs font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 mb-1">কার্ড ক্যাটাগরি *</label>
                        <select
                          value={rcNewCardType}
                          onChange={(e) => setRcNewCardType(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-xl text-xs font-bold text-slate-900"
                        >
                          <option value="Premium">Premium Card</option>
                          <option value="Standard">Standard Card</option>
                          <option value="Platinum">Platinum Card</option>
                        </select>
                      </div>
                    </div>

                    {rcNewCardType === 'Platinum' && (
                      <div className="bg-purple-950/20 border border-purple-500/20 p-3.5 rounded-2xl space-y-3">
                        <p className="text-[10px] font-black text-purple-300 uppercase tracking-widest leading-none">💎 ভিআইপি কার্ড কাস্টমাইজেশন</p>
                        
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 mb-1">কার্ডের ব্যাকগ্রাউন্ড গ্রেডিয়েন্ট</label>
                          <select
                            value={rcNewVipCardBg}
                            onChange={(e) => setRcNewVipCardBg(e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 rounded-lg outline-none"
                          >
                            <option value="from-slate-950 via-purple-950/70 to-slate-900">🔮 রাজকীয় বেগুনি (Royal Midnight)</option>
                            <option value="from-zinc-900 via-zinc-950 to-zinc-900">🖤 ডার্ক অবসিডিয়ান (Shadow Obsidian)</option>
                            <option value="from-indigo-950 via-indigo-900 to-indigo-950">🌌 মহাজাগতিক নীল (Cosmic Indigo)</option>
                            <option value="from-red-950 via-rose-950 to-zinc-900">🍷 বারগান্ডি ভেলভেট (Burgundy Velvet)</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 mb-1">সীমানা/বর্ডার কালার (Hex)</label>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded border border-slate-800 shrink-0" style={{ backgroundColor: rcNewVipBorderColor }} />
                              <input
                                type="text"
                                value={rcNewVipBorderColor}
                                onChange={(e) => setRcNewVipBorderColor(e.target.value)}
                                placeholder="#EC4899"
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-200 rounded-lg"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 mb-1">ব্র্যান্ড কালার (Hex)</label>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded border border-slate-800 shrink-0" style={{ backgroundColor: rcNewVipPrimaryColor }} />
                              <input
                                type="text"
                                value={rcNewVipPrimaryColor}
                                onChange={(e) => setRcNewVipPrimaryColor(e.target.value)}
                                placeholder="#6D28D9"
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-200 rounded-lg"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 mb-1">টেক্সট কালার (ক্লাস)</label>
                          <select
                            value={rcNewVipTextColor}
                            onChange={(e) => setRcNewVipTextColor(e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 rounded-lg outline-none"
                          >
                            <option value="text-purple-100">🔮 হালকা বেগুনি (Lavender Soft)</option>
                            <option value="text-amber-100">🟡 সোনালী টেক্সট (Gold Soft)</option>
                            <option value="text-white">⚪ ধবধবে সাদা (Pure White)</option>
                            <option value="text-slate-200">🩶 হালকা ধূসর (Light Slate)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 mb-1">গ্রাম/মহল্লা</label>
                        <input
                          type="text"
                          value={rcNewVillage}
                          onChange={(e) => setRcNewVillage(e.target.value)}
                          placeholder="গ্রাম"
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-xl text-[11px] text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 mb-1">উপজেলা</label>
                        <input
                          type="text"
                          value={rcNewUpazila}
                          onChange={(e) => setRcNewUpazila(e.target.value)}
                          placeholder="উপজেলা"
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-xl text-[11px] text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 mb-1">জেলা</label>
                        <input
                          type="text"
                          value={rcNewDistrict}
                          onChange={(e) => setRcNewDistrict(e.target.value)}
                          placeholder="জেলা"
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-xl text-[11px] text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1">মনোনীত নমিনীর নাম</label>
                      <input
                        type="text"
                        value={rcNewNomineeName}
                        onChange={(e) => setRcNewNomineeName(e.target.value)}
                        placeholder="যেমন: মোসাম্মৎ জাবেদা খাতুন"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-xl text-xs text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1">সদস্যের ছবি (গ্যালারি থেকে ছবি নির্বাচন করুন)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 1.5 * 1024 * 1024) {
                                alert("অনুগ্রহ করে 1.5 মেগাবাইটের কম সাইজের ছবি নির্বাচন করুন।");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setRcNewPhoto(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden" 
                          id="admin-new-user-photo-upload" 
                        />
                        <label 
                          htmlFor="admin-new-user-photo-upload"
                          className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-[#015335] text-[11px] font-black rounded-xl cursor-pointer transition flex items-center gap-1 border border-emerald-500/20"
                        >
                          🖼️ গ্যালারি থেকে ছবি নিন
                        </label>
                        {rcNewPhoto ? (
                          <div className="flex items-center gap-1.5">
                            <img src={rcNewPhoto} alt="Preview" className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-sm" />
                            <button type="button" onClick={() => setRcNewPhoto('')} className="text-[10px] text-rose-500 font-bold hover:underline">রিসেট</button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">কোনো ছবি নির্বাচন করা হয়নি</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20"
                    >
                      ✓ নতুন কার্ড অনুমোদন করুন
                    </button>
                  </form>
                </div>

                {/* Right side: Cards list table */}
                <div className="lg:col-span-8 space-y-4">
                  <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest border-b border-slate-100 pb-2.5 flex items-center justify-between">
                    <span>📋 ডিজিটাল রেশন কার্ড ডাটাবেস তালিকা ({rationCards.length})</span>
                    <button 
                      onClick={fetchRationCards} 
                      className="text-[10px] font-black text-emerald-400 hover:underline"
                    >
                      🔄 রিফ্রেশ তালিকা
                    </button>
                  </h3>

                  {/* Search Filter Bar */}
                  <div className="relative">
                    <input
                      type="text"
                      value={rationSearchQuery}
                      onChange={(e) => setRationSearchQuery(e.target.value)}
                      placeholder="🔍 নাম, কার্ড নম্বর অথবা মোবাইল দিয়ে খুঁজুন..."
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl text-xs outline-none focus:border-emerald-500/50 transition font-medium"
                    />
                    {rationSearchQuery && (
                      <button
                        onClick={() => setRationSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-bold font-sans cursor-pointer"
                      >
                        মুছুন
                      </button>
                    )}
                  </div>

                  {loadingRationCards ? (
                    <div className="py-12 text-center text-xs text-slate-500 font-bold">রেশন কার্ড ডাটাবেস লোড হচ্ছে...</div>
                  ) : (() => {
                    const filteredRationCards = rationCards.filter((rc: any) => {
                      const query = rationSearchQuery.toLowerCase().trim();
                      if (!query) return true;
                      const name = (rc.name || rc.userName || '').toLowerCase();
                      const cardNo = (rc.cardNo || rc.cardNumber || '').toLowerCase();
                      const phone = (rc.phone || '').toLowerCase();
                      return name.includes(query) || cardNo.includes(query) || phone.includes(query);
                    });

                    return filteredRationCards.length > 0 ? (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200/80 font-black">
                              <th className="p-3">কার্ডধারী</th>
                              <th className="p-3">কার্ড নম্বর / টাইপ</th>
                              <th className="p-3">ঠিকানা / গ্রাম</th>
                              <th className="p-3">নমিনী</th>
                              <th className="p-3">স্ট্যাটাস</th>
                              <th className="p-3 text-right">অ্যাকশন</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {filteredRationCards.map((rc, idx) => (

                            <tr key={`${rc.id}-${idx}`} className="hover:bg-slate-900/40 transition">
                              <td className="p-3">
                                <div className="flex items-center gap-2.5">
                                  <img 
                                    src={rc.photoUrl || rc.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150'} 
                                    className="w-7.5 h-7.5 rounded-full object-cover border border-slate-200/80" 
                                    referrerPolicy="no-referrer" 
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150';
                                    }}
                                  />
                                  <div>
                                    <p className="font-extrabold text-white">{rc.name || rc.userName}</p>
                                    <p className="text-[10px] text-slate-500 font-mono font-bold">{rc.phone}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3">
                                <p className="font-mono font-bold text-slate-600">{rc.cardNumber || rc.cardNo}</p>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                  rc.cardType === 'Platinum' ? 'bg-purple-950/40 text-purple-300 border border-purple-800/50' :
                                  rc.cardType === 'Premium' ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-800/50' :
                                  'bg-slate-900 text-slate-300 border border-slate-800'
                                }`}>
                                  {rc.cardType || 'Standard'}
                                </span>
                              </td>
                              <td className="p-3 text-slate-350 leading-relaxed max-w-[150px] truncate">
                                {rc.village || rc.address || '—'}
                              </td>
                              <td className="p-3 text-slate-350">{rc.nomineeName || '—'}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black ${
                                  rc.status === 'active' || rc.status === 'approved'
                                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                                    : rc.status === 'pending'
                                      ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40 animate-pulse'
                                      : 'bg-rose-950/40 text-rose-400 border border-rose-800/40'
                                }`}>
                                  {rc.status === 'active' || rc.status === 'approved' ? 'সক্রিয় কার্ড' :
                                   rc.status === 'pending' ? 'পেন্ডিং ভেরিফিকেশন' : 'বাতিলকৃত'}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditRation(rc)}
                                    className="p-1.5 text-indigo-400 hover:text-indigo-350 hover:bg-indigo-950/30 rounded-lg transition"
                                    title="সংশোধন করুন"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRationCard(rc.id)}
                                    className="p-1.5 text-rose-450 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                                    title="মুছে ফেলুন"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 border border-dashed border-slate-800/80 rounded-3xl text-center text-slate-500 text-xs font-black">
                      কোনো রেশন কার্ড বা আবেদন পাওয়া যায়নি।
                    </div>
                  );
                })()}
                </div>

              </div>
            </>
          )}

          {rationAdminTab === 'products' && (
            <div className="space-y-6 animate-fade-in text-slate-800 bg-slate-50 border border-slate-200/80 p-6 rounded-3xl mt-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
                    🍚 সাশ্রয়ী রেশন পণ্য ক্যাটালগ ({rationAdminItems.length} টি পণ্য)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">এখানে রেশন স্টোরে প্রদর্শিত নিত্যপ্রয়োজনীয় পণ্যের নাম, প্যাক সাইজ/পরিমাণ, বাজার দর এবং সাশ্রয়ী দর সংশোধন বা ডিলিট করতে পারবেন।</p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddRationItem}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-800/10"
                >
                  ➕ নতুন পণ্য যোগ করুন
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rationAdminItems.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="bg-white border border-slate-200/80 p-5 rounded-3xl flex items-center gap-4 hover:border-emerald-500/40 transition relative group">
                    <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-4xl shadow-sm shrink-0 overflow-hidden">
                      {item.emoji && (item.emoji.startsWith('http') || item.emoji.startsWith('data:image')) ? (
                        <img src={item.emoji} alt={item.name} className="w-12 h-12 object-contain rounded-lg" referrerPolicy="no-referrer" />
                      ) : (
                        <span>{item.emoji || '🍚'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <h4 className="text-sm font-black text-slate-800 truncate">{item.name}</h4>
                      <p className="text-[10px] text-emerald-800 font-extrabold mt-0.5">প্যাক সাইজঃ {item.qty || '1 কেজি'}</p>
                      <div className="flex items-center gap-3 mt-1.5 font-mono text-xs">
                        <div>
                          <span className="text-[9px] text-slate-500 block leading-none font-sans font-bold">আমাদের দর</span>
                          <span className="text-emerald-700 font-black text-sm">৳{item.price}</span>
                        </div>
                        <div className="border-l border-slate-250 pl-3">
                          <span className="text-[9px] text-slate-500 block leading-none font-sans font-bold">বাজার দর</span>
                          <span className="text-slate-400 line-through">৳{item.marketPrice}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditRationItem(item)}
                        className="px-3 py-1 bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-black rounded-xl transition cursor-pointer"
                      >
                        সংশোধন
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRationItem(item.id)}
                        className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-black rounded-xl transition cursor-pointer"
                      >
                        মুছে ফেলুন
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rationAdminTab === 'settings' && (
            <div className="space-y-6 animate-fade-in text-slate-800 bg-slate-50 border border-slate-200/80 p-6 rounded-3xl mt-4">
              <div className="border-b border-slate-200 pb-3 mb-4 text-left">
                <h3 className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
                  ⚙️ ডিজিটাল রেশন কার্ড জেনারেল সেটিংস ও লেখা পরিবর্তন
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">রেশন সেকশনের বিভিন্ন নির্দেশনা, নির্বাচন সীমা এবং মূল টাইটেল টেক্সট সমূহ এখান থেকে মডিফাই করতে পারবেন।</p>
              </div>

              <form onSubmit={handleSaveRationSettings} className="space-y-4 max-w-xl text-left">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600">রেশন ব্যানার স্ক্রল নোটিশ (Ration Ticker) *</label>
                  <textarea
                    required
                    rows={3}
                    value={cfgRationTicker}
                    onChange={(e) => setCfgRationTicker(e.target.value)}
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-850"
                    placeholder="যেমন: কো-অপারেティブ ডিজিটাল রেশন কার্ড সেবাঃ ভর্তুকি মূল্যে..."
                  />
                  <p className="text-[10px] text-slate-500">মেম্বার রেশন পেজের স্ক্রলিং হেডলাইনে প্রদর্শিত বার্তা।</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600">আইটেম সিলেকশন নির্দেশিকা টাইটেল (Title Text) *</label>
                  <input
                    type="text"
                    required
                    value={cfgRationTitleText}
                    onChange={(e) => setCfgRationTitleText(e.target.value)}
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-850"
                    placeholder="যেমন: 10টি আইটেমের মধ্যে থেকে যেকোনো 5টি নিতে পারবেন"
                  />
                  <p className="text-[10px] text-slate-500">মেম্বার পেজে আইটেম সিলেক্টর বক্সের উপরে প্রদর্শিত টাইটেল টেক্সট।</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-600">মেম্বারদের জন্য সর্বোচ্চ আইটেম নির্বাচন সীমা *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={50}
                      value={cfgRationMaxSelectLimit}
                      onChange={(e) => setCfgRationMaxSelectLimit(Number(e.target.value))}
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-850"
                    />
                    <p className="text-[10px] text-slate-500">মেম্বাররা এক অর্ডারে সর্বোচ্চ কতটি আইটেম সিলেক্ট করতে পারবে।</p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-600">মোট রেশন আইটেম ডেসক্রিপশন টেক্সট (যেমন: 10) *</label>
                    <input
                      type="text"
                      required
                      value={cfgRationTotalItemsText}
                      onChange={(e) => setCfgRationTotalItemsText(e.target.value)}
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-850"
                    />
                    <p className="text-[10px] text-slate-500">মেম্বার পেজে 'সর্বমোট 10টি আইটেম' লেখার পরিবর্তে কতটি আইটেম টেক্সট দেখাবে।</p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black rounded-xl transition shadow-md cursor-pointer inline-flex items-center gap-1.5 font-sans"
                >
                  💾 রেশন সেটিংস সংরক্ষণ করুন
                </button>
              </form>
            </div>
          )}
        </div>
      )}

    </>
  );
}
