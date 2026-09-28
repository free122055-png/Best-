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

export function AdminReceiptSection(props: any) {
  const {
    adminTab,
    y,
    text,
    left,
    receiptSuccess,
    setReceiptSuccess,
    receiptError,
    setReceiptError,
    type,
    handleSaveReceiptConfig,
    isSavingReceiptConfig,
    receiptHeaderTitle,
    setReceiptHeaderTitle,
    target,
    receiptCompanyName,
    setReceiptCompanyName,
    receiptOrganizationDetails,
    setReceiptOrganizationDetails,
    receiptOfficialTagText,
    setReceiptOfficialTagText,
    receiptAdminSignatureName,
    setReceiptAdminSignatureName,
    receiptAdminSignatureTitle,
    setReceiptAdminSignatureTitle,
    receiptFooterVerificationText,
    setReceiptFooterVerificationText,
    rcptAddMoneyTheme,
    key,
    name,
    setRcptAddMoneyTheme,
    setReceiptPreviewCat,
    rcptAddMoneyTitle,
    setRcptAddMoneyTitle,
    rcptAddMoneyNotice,
    setRcptAddMoneyNotice,
    rcptSendMoneyTheme,
    setRcptSendMoneyTheme,
    rcptSendMoneyTitle,
    setRcptSendMoneyTitle,
    rcptSendMoneyNotice,
    setRcptSendMoneyNotice,
    rcptWithdrawTheme,
    setRcptWithdrawTheme,
    rcptWithdrawTitle,
    setRcptWithdrawTitle,
    rcptWithdrawNotice,
    setRcptWithdrawNotice,
    rcptTelecomTheme,
    setRcptTelecomTheme,
    rcptTelecomTitle,
    setRcptTelecomTitle,
    rcptTelecomNotice,
    setRcptTelecomNotice,
    rcptShopTheme,
    setRcptShopTheme,
    rcptShopTitle,
    setRcptShopTitle,
    rcptShopNotice,
    setRcptShopNotice,
    setRcptQardTheme,
    rcptQardTheme,
    rcptQardTitle,
    setRcptQardTitle,
    rcptQardNotice,
    setRcptQardNotice,
    cat,
    receiptPreviewCat,
    rcptDepositTheme,
    rcptDepositTitle,
    rcptDepositNotice,
    receiptFooterComputerGeneratedText
  } = props;

  return (
    <>
        {adminTab === 'receipt_admin' && (
          <div className="space-y-6 text-left text-slate-800">
            {/* Success & Error alerts */}
            {receiptSuccess && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs animate-fade-in">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {receiptSuccess}
                </span>
                <button onClick={() => setReceiptSuccess('')} className="text-emerald-600 hover:text-emerald-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {receiptError && (
              <div className="bg-rose-50 border border-rose-300 text-rose-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs animate-fade-in">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  {receiptError}
                </span>
                <button onClick={() => setReceiptError('')} className="text-rose-600 hover:text-rose-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Header Banner */}
            <div className="bg-white border border-slate-200 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Receipt className="w-6 h-6 text-purple-600" />
                  🧾 রসিদ ও ভাউচার থিম কনফিগারেটর (Receipt & Voucher Designer)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  সেন্ড মানি, অ্যাড মানি, ক্যাশ আউট, রিচার্জ ও কেনাকাটার ডিজিটাল রসিদের কালার থিম, শিরোনাম, নোটিশ এবং কোম্পানি সিল কাস্টমাইজ করুন।
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleSaveReceiptConfig()}
                disabled={isSavingReceiptConfig}
                className="py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-900/20 active:scale-95 transition cursor-pointer shrink-0"
              >
                {isSavingReceiptConfig ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> সেভ হচ্ছে...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> রসিদ সেটিংস সেভ করুন
                  </>
                )}
              </button>
            </div>

            {/* Main 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Form Controls (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 1. Global Receipt Settings */}
                <div className="bg-white border border-slate-200 p-5 rounded-3xl space-y-4 shadow-3xs">
                  <div className="border-b border-slate-150 pb-3 flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      কোম্পানি বিবরণ ও অফিসিয়াল ডিজিটাল তথ্য
                    </h3>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-extrabold border border-indigo-150">
                      সকল রসিদে প্রযোজ্য
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        রসিদ মূল শিরোনাম (Header Title)
                      </label>
                      <input
                        type="text"
                        value={receiptHeaderTitle}
                        onChange={(e) => setReceiptHeaderTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white"
                        placeholder="ডিজিটাল পেমেন্ট রসিদ"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        কোম্পানি নাম (Company Name)
                      </label>
                      <input
                        type="text"
                        value={receiptCompanyName}
                        onChange={(e) => setReceiptCompanyName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white"
                        placeholder="বিজনেস নেটওয়ার্ক বাংলাদেশ (AMB)"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      প্রতিষ্ঠান পরিচিতি ও ঠিকানা (Organization Subtitle/Address)
                    </label>
                    <textarea
                      rows={2}
                      value={receiptOrganizationDetails}
                      onChange={(e) => setReceiptOrganizationDetails(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white"
                      placeholder="মাল্টিপারপাস কো-অপারেটিভ সোসাইটি লিমিটেড..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        ওয়াটারমার্ক ও অফিসিয়াল ব্যাজ টেক্সট
                      </label>
                      <input
                        type="text"
                        value={receiptOfficialTagText}
                        onChange={(e) => setReceiptOfficialTagText(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white"
                        placeholder="অফিসিয়াল কপি"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        এডমিন সিগনেচার নাম (Signatory)
                      </label>
                      <input
                        type="text"
                        value={receiptAdminSignatureName}
                        onChange={(e) => setReceiptAdminSignatureName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white"
                        placeholder="MD SUJON MIA"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        এডমিন সিগনেচার পদবি (Title)
                      </label>
                      <input
                        type="text"
                        value={receiptAdminSignatureTitle}
                        onChange={(e) => setReceiptAdminSignatureTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white"
                        placeholder="অ্যাডমিন সিগনেচার"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        ডিজিটাল ভেরিফিকেশন মেসেজ (Footer)
                      </label>
                      <input
                        type="text"
                        value={receiptFooterVerificationText}
                        onChange={(e) => setReceiptFooterVerificationText(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white"
                        placeholder="ডিজিটালভাবে অনুমোদিত ও ভেরিফাইড"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Category Wise Color Themes & Custom Header/Notices */}
                <div className="bg-white border border-slate-200 p-5 rounded-3xl space-y-5 shadow-3xs">
                  <div className="border-b border-slate-150 pb-3 flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-purple-600" />
                      লেনদেন টাইপ অনুযায়ী কালার থিম ও কাস্টম টেক্সট
                    </h3>
                    <span className="text-[10px] bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full font-extrabold border border-purple-150">
                      7টি ক্যাটাগরি
                    </span>
                  </div>

                  {/* Transaction Category Accordion / Cards */}
                  <div className="space-y-4">
                    
                    {/* Category 1: Add Money */}
                    <div className="border border-purple-200 bg-purple-50/30 p-4 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                          🟣 1. অ্যাড মানি (Add Money)
                        </span>
                        <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                          থিম: {rcptAddMoneyTheme.toUpperCase()}
                        </span>
                      </div>
                      
                      {/* Color Selector */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 mb-1">রসিদের থিম কালার সিলেক্ট করুন:</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'purple', name: '🟣 পার্পল (Purple)', bg: 'bg-purple-600' },
                            { key: 'emerald', name: '🟢 ইমারাল্ড সবুজ', bg: 'bg-[#00a884]' },
                            { key: 'indigo', name: '🔷 ইন্ডিগো নীল', bg: 'bg-indigo-600' },
                            { key: 'amber', name: '🟧 আম্বার গোল্ড', bg: 'bg-amber-600' },
                            { key: 'rose', name: '🔴 রোজ রেড', bg: 'bg-rose-600' },
                            { key: 'slate', name: '🖤 স্লেট ডার্ক', bg: 'bg-slate-800' },
                          ].map(color => (
                            <button
                              key={color.key}
                              type="button"
                              onClick={() => { setRcptAddMoneyTheme(color.key as any); setReceiptPreviewCat('add_money'); }}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1.5 border transition cursor-pointer ${
                                rcptAddMoneyTheme === color.key ? 'bg-purple-600 text-white border-purple-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                              {color.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">কাস্টম হেডার শিরোনাম:</label>
                          <input
                            type="text"
                            value={rcptAddMoneyTitle}
                            onChange={(e) => { setRcptAddMoneyTitle(e.target.value); setReceiptPreviewCat('add_money'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">নিচের কাস্টম মেসেজ/নোটিশ:</label>
                          <input
                            type="text"
                            value={rcptAddMoneyNotice}
                            onChange={(e) => { setRcptAddMoneyNotice(e.target.value); setReceiptPreviewCat('add_money'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Category 2: Send Money */}
                    <div className="border border-emerald-200 bg-emerald-50/30 p-4 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          🟢 2. সেন্ড মানি / ওয়ালেট ট্রান্সফার (Send Money)
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                          থিম: {rcptSendMoneyTheme.toUpperCase()}
                        </span>
                      </div>

                      {/* Color Selector */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 mb-1">রসিদের থিম কালার সিলেক্ট করুন:</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'emerald', name: '🟢 ইমারাল্ড সবুজ', bg: 'bg-[#00a884]' },
                            { key: 'purple', name: '🟣 পার্পল (Purple)', bg: 'bg-purple-600' },
                            { key: 'indigo', name: '🔷 ইন্ডিগো নীল', bg: 'bg-indigo-600' },
                            { key: 'amber', name: '🟧 আম্বার গোল্ড', bg: 'bg-amber-600' },
                            { key: 'rose', name: '🔴 রোজ রেড', bg: 'bg-rose-600' },
                            { key: 'slate', name: '🖤 স্লেট ডার্ক', bg: 'bg-slate-800' },
                          ].map(color => (
                            <button
                              key={color.key}
                              type="button"
                              onClick={() => { setRcptSendMoneyTheme(color.key as any); setReceiptPreviewCat('send_money'); }}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1.5 border transition cursor-pointer ${
                                rcptSendMoneyTheme === color.key ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                              {color.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">কাস্টম হেডার শিরোনাম:</label>
                          <input
                            type="text"
                            value={rcptSendMoneyTitle}
                            onChange={(e) => { setRcptSendMoneyTitle(e.target.value); setReceiptPreviewCat('send_money'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">নিচের কাস্টম মেসেজ/নোটিশ:</label>
                          <input
                            type="text"
                            value={rcptSendMoneyNotice}
                            onChange={(e) => { setRcptSendMoneyNotice(e.target.value); setReceiptPreviewCat('send_money'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Category 3: Withdraw / Cash Out */}
                    <div className="border border-rose-200 bg-rose-50/30 p-4 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                          🔴 3. ক্যাশ আউট / উইথড্র (Withdraw)
                        </span>
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
                          থিম: {rcptWithdrawTheme.toUpperCase()}
                        </span>
                      </div>

                      {/* Color Selector */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 mb-1">রসিদের থিম কালার সিলেক্ট করুন:</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'rose', name: '🔴 রোজ রেড', bg: 'bg-rose-600' },
                            { key: 'emerald', name: '🟢 ইমারাল্ড সবুজ', bg: 'bg-[#00a884]' },
                            { key: 'purple', name: '🟣 পার্পল', bg: 'bg-purple-600' },
                            { key: 'indigo', name: '🔷 ইন্ডিগো নীল', bg: 'bg-indigo-600' },
                            { key: 'amber', name: '🟧 আম্বার গোল্ড', bg: 'bg-amber-600' },
                            { key: 'slate', name: '🖤 স্লেট ডার্ক', bg: 'bg-slate-800' },
                          ].map(color => (
                            <button
                              key={color.key}
                              type="button"
                              onClick={() => { setRcptWithdrawTheme(color.key as any); setReceiptPreviewCat('withdraw'); }}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1.5 border transition cursor-pointer ${
                                rcptWithdrawTheme === color.key ? 'bg-rose-600 text-white border-rose-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                              {color.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">কাস্টম হেডার শিরোনাম:</label>
                          <input
                            type="text"
                            value={rcptWithdrawTitle}
                            onChange={(e) => { setRcptWithdrawTitle(e.target.value); setReceiptPreviewCat('withdraw'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">নিচের কাস্টম মেসেজ/নোটিশ:</label>
                          <input
                            type="text"
                            value={rcptWithdrawNotice}
                            onChange={(e) => { setRcptWithdrawNotice(e.target.value); setReceiptPreviewCat('withdraw'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Category 4: Telecom */}
                    <div className="border border-indigo-200 bg-indigo-50/30 p-4 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                          🔷 4. টেলিকম ও ফ্লেক্সিলোড (Telecom Recharge)
                        </span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                          থিম: {rcptTelecomTheme.toUpperCase()}
                        </span>
                      </div>

                      {/* Color Selector */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 mb-1">রসিদের থিম কালার সিলেক্ট করুন:</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'indigo', name: '🔷 ইন্ডিগো নীল', bg: 'bg-indigo-600' },
                            { key: 'emerald', name: '🟢 ইমারাল্ড সবুজ', bg: 'bg-[#00a884]' },
                            { key: 'purple', name: '🟣 পার্পল', bg: 'bg-purple-600' },
                            { key: 'amber', name: '🟧 আম্বার গোল্ড', bg: 'bg-amber-600' },
                            { key: 'rose', name: '🔴 রোজ রেড', bg: 'bg-rose-600' },
                            { key: 'slate', name: '🖤 স্লেট ডার্ক', bg: 'bg-slate-800' },
                          ].map(color => (
                            <button
                              key={color.key}
                              type="button"
                              onClick={() => { setRcptTelecomTheme(color.key as any); setReceiptPreviewCat('telecom_recharge'); }}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1.5 border transition cursor-pointer ${
                                rcptTelecomTheme === color.key ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                              {color.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">কাস্টম হেডার শিরোনাম:</label>
                          <input
                            type="text"
                            value={rcptTelecomTitle}
                            onChange={(e) => { setRcptTelecomTitle(e.target.value); setReceiptPreviewCat('telecom_recharge'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">নিচের কাস্টম মেসেজ/নোটিশ:</label>
                          <input
                            type="text"
                            value={rcptTelecomNotice}
                            onChange={(e) => { setRcptTelecomNotice(e.target.value); setReceiptPreviewCat('telecom_recharge'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Category 5: Super Shop */}
                    <div className="border border-amber-200 bg-amber-50/30 p-4 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                          🟧 5. সুপার শপ অর্ডার (Super Shop Order)
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                          থিম: {rcptShopTheme.toUpperCase()}
                        </span>
                      </div>

                      {/* Color Selector */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 mb-1">রসিদের থিম কালার সিলেক্ট করুন:</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'amber', name: '🟧 আম্বার গোল্ড', bg: 'bg-amber-600' },
                            { key: 'emerald', name: '🟢 ইমারাল্ড সবুজ', bg: 'bg-[#00a884]' },
                            { key: 'purple', name: '🟣 পার্পল', bg: 'bg-purple-600' },
                            { key: 'indigo', name: '🔷 ইন্ডিগো নীল', bg: 'bg-indigo-600' },
                            { key: 'rose', name: '🔴 রোজ রেড', bg: 'bg-rose-600' },
                            { key: 'slate', name: '🖤 স্লেট ডার্ক', bg: 'bg-slate-800' },
                          ].map(color => (
                            <button
                              key={color.key}
                              type="button"
                              onClick={() => { setRcptShopTheme(color.key as any); setReceiptPreviewCat('shop_purchase'); }}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1.5 border transition cursor-pointer ${
                                rcptShopTheme === color.key ? 'bg-amber-600 text-white border-amber-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                              {color.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">কাস্টম হেডার শিরোনাম:</label>
                          <input
                            type="text"
                            value={rcptShopTitle}
                            onChange={(e) => { setRcptShopTitle(e.target.value); setReceiptPreviewCat('shop_purchase'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">নিচের কাস্টম মেসেজ/নোটিশ:</label>
                          <input
                            type="text"
                            value={rcptShopNotice}
                            onChange={(e) => { setRcptShopNotice(e.target.value); setReceiptPreviewCat('shop_purchase'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                      </div>
                    </div>

                    {/* Category 7: Qard Hasana */}
                    <div className="border border-slate-200 bg-slate-50/50 p-4 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">

                      {/* Color Selector */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 mb-1">রসিদের থিম কালার সিলেক্ট করুন:</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'slate', name: '🖤 স্লেট ডার্ক', bg: 'bg-slate-800' },
                            { key: 'emerald', name: '🟢 ইমারাল্ড সবুজ', bg: 'bg-[#00a884]' },
                            { key: 'purple', name: '🟣 পার্পল', bg: 'bg-purple-600' },
                            { key: 'indigo', name: '🔷 ইন্ডিগো নীল', bg: 'bg-indigo-600' },
                            { key: 'amber', name: '🟧 আম্বার গোল্ড', bg: 'bg-amber-600' },
                            { key: 'rose', name: '🔴 রোজ রেড', bg: 'bg-rose-600' },
                          ].map(color => (
                            <button
                              key={color.key}
                              type="button"
                              onClick={() => { setRcptQardTheme(color.key as any); setReceiptPreviewCat('qard_loan'); }}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1.5 border transition cursor-pointer ${
                                rcptQardTheme === color.key ? 'bg-slate-800 text-white border-slate-900 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                              {color.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">কাস্টম হেডার শিরোনাম:</label>
                          <input
                            type="text"
                            value={rcptQardTitle}
                            onChange={(e) => { setRcptQardTitle(e.target.value); setReceiptPreviewCat('qard_loan'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">নিচের কাস্টম মেসেজ/নোটিশ:</label>
                          <input
                            type="text"
                            value={rcptQardNotice}
                            onChange={(e) => { setRcptQardNotice(e.target.value); setReceiptPreviewCat('qard_loan'); }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-500"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* Right Column: Live Interactive Receipt Preview (5 cols) */}
              <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4 h-fit">
                <div className="bg-white border-2 border-slate-300 p-4 sm:p-5 rounded-3xl shadow-xl space-y-4 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-150 pb-2.5">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-purple-600 animate-pulse" />
                      লাইভ রসিদ প্রিভিউ (Live Preview)
                    </span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-extrabold px-2 py-0.5 rounded-full border border-purple-200">
                      রিয়েল-টাইম সিঙ্ক
                    </span>
                  </div>

                  {/* Category Switcher Buttons for Quick Preview */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'add_money', label: '🟣 অ্যাড মানি' },
                      { key: 'send_money', label: '🟢 সেন্ড মানি' },
                      { key: 'withdraw', label: '🔴 ক্যাশ আউট' },
                      { key: 'telecom_recharge', label: '🔷 রিচার্জ' },
                      { key: 'shop_purchase', label: '🟧 শপ' },
                      { key: 'deposit', label: '💼 সঞ্চয়' },
                      { key: 'qard_loan', label: '🤝 করযে হাসানা' },
                    ].map((cat, idx) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setReceiptPreviewCat(cat.key as any)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                          receiptPreviewCat === cat.key ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Render Mock Receipt Card */}
                  {(() => {
                    let activeTheme = 'purple';
                    let activeTitle = receiptHeaderTitle;
                    let activeNotice = 'আপনার ওয়ালেটে সফলভাবে অর্থ জমা করা হয়েছে। ধন্যবাদ।';
                    let mockTxName = 'অ্যাড মানি (বিকাশ)';
                    let mockTxAmount = '৳5,000.00';

                    if (receiptPreviewCat === 'add_money') {
                      activeTheme = rcptAddMoneyTheme;
                      activeTitle = rcptAddMoneyTitle;
                      activeNotice = rcptAddMoneyNotice;
                      mockTxName = 'অ্যাড মানি (ব্যাংক/বিকাশ)';
                      mockTxAmount = '৳5,000.00';
                    } else if (receiptPreviewCat === 'send_money') {
                      activeTheme = rcptSendMoneyTheme;
                      activeTitle = rcptSendMoneyTitle;
                      activeNotice = rcptSendMoneyNotice;
                      mockTxName = 'সেন্ড মানি ট্রান্সফার';
                      mockTxAmount = '৳2,500.00';
                    } else if (receiptPreviewCat === 'withdraw') {
                      activeTheme = rcptWithdrawTheme;
                      activeTitle = rcptWithdrawTitle;
                      activeNotice = rcptWithdrawNotice;
                      mockTxName = 'ক্যাশ আউট রিকোয়েস্ট';
                      mockTxAmount = '৳1,000.00';
                    } else if (receiptPreviewCat === 'telecom_recharge') {
                      activeTheme = rcptTelecomTheme;
                      activeTitle = rcptTelecomTitle;
                      activeNotice = rcptTelecomNotice;
                      mockTxName = 'গ্রামীণফোন মিনিট প্যাক';
                      mockTxAmount = '৳488.00';
                    } else if (receiptPreviewCat === 'shop_purchase') {
                      activeTheme = rcptShopTheme;
                      activeTitle = rcptShopTitle;
                      activeNotice = rcptShopNotice;
                      mockTxName = 'সুপার শপ খাঁটি সরিষার তেল 5 লিটার';
                      mockTxAmount = '৳950.00';
                    } else if (receiptPreviewCat === 'deposit') {
                      activeTheme = rcptDepositTheme;
                      activeTitle = rcptDepositTitle;
                      activeNotice = rcptDepositNotice;
                      mockTxName = 'ডিপিএস কিস্তি জমা';
                      mockTxAmount = '৳1,000.00';
                    } else if (receiptPreviewCat === 'qard_loan') {
                      activeTheme = rcptQardTheme;
                      activeTitle = rcptQardTitle;
                      activeNotice = rcptQardNotice;
                      mockTxName = 'করযে হাসানা কল্যাণ তহবিল';
                      mockTxAmount = '৳10,000.00';
                    }

                    // Theme styles helper
                    const getPreviewStyles = (col: string) => {
                      switch (col) {
                        case 'emerald':
                          return {
                            headerBg: 'bg-[#00a884] text-white',
                            border: 'border-[#00a884]',
                            amountBg: 'bg-[#00a884]/10 border-[#00a884]/30 text-[#00a884]',
                            badgeBg: 'bg-[#00a884]/15 text-[#00a884] border-[#00a884]/30'
                          };
                        case 'purple':
                          return {
                            headerBg: 'bg-purple-600 text-white',
                            border: 'border-purple-600',
                            amountBg: 'bg-purple-50 border-purple-200 text-purple-700',
                            badgeBg: 'bg-purple-100 text-purple-800 border-purple-200'
                          };
                        case 'indigo':
                          return {
                            headerBg: 'bg-indigo-600 text-white',
                            border: 'border-indigo-600',
                            amountBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
                            badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200'
                          };
                        case 'amber':
                          return {
                            headerBg: 'bg-amber-600 text-white',
                            border: 'border-amber-600',
                            amountBg: 'bg-amber-50 border-amber-200 text-amber-800',
                            badgeBg: 'bg-amber-100 text-amber-800 border-amber-200'
                          };
                        case 'rose':
                          return {
                            headerBg: 'bg-rose-600 text-white',
                            border: 'border-rose-600',
                            amountBg: 'bg-rose-50 border-rose-200 text-rose-700',
                            badgeBg: 'bg-rose-100 text-rose-800 border-rose-200'
                          };
                        case 'slate':
                        default:
                          return {
                            headerBg: 'bg-slate-800 text-white',
                            border: 'border-slate-800',
                            amountBg: 'bg-slate-100 border-slate-300 text-slate-800',
                            badgeBg: 'bg-slate-100 text-slate-800 border-slate-300'
                          };
                      }
                    };

                    const style = getPreviewStyles(activeTheme);

                    return (
                      <div className={`bg-white rounded-2xl border-2 ${style.border} overflow-hidden shadow-md text-slate-800 text-left`}>
                        {/* Header Box */}
                        <div className={`${style.headerBg} p-4 text-center relative space-y-1`}>
                          <div className="w-10 h-10 mx-auto bg-white/20 rounded-full flex items-center justify-center font-black text-sm">
                            AMB
                          </div>
                          <h4 className="text-sm font-black tracking-tight">{activeTitle}</h4>
                          <p className="text-[10px] font-medium opacity-90">{receiptCompanyName}</p>
                          <p className="text-[8.5px] opacity-75 whitespace-pre-line leading-tight">{receiptOrganizationDetails}</p>
                        </div>

                        {/* Receipt Body */}
                        <div className="p-4 space-y-3 bg-slate-50/50">
                          {/* Watermark Tag */}
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="text-[10px] font-bold text-slate-500">ট্রানজেকশন আইডি: AMB-9821873</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${style.badgeBg}`}>
                              {receiptOfficialTagText}
                            </span>
                          </div>

                          {/* Transaction Name & Amount Box */}
                          <div className={`p-3 rounded-xl border text-center space-y-0.5 ${style.amountBg}`}>
                            <span className="text-[10px] font-bold block opacity-80">{mockTxName}</span>
                            <span className="text-lg font-black block font-mono">{mockTxAmount}</span>
                            <span className="text-[9px] font-extrabold block text-emerald-600">● সফলভাবে সম্পন্ন</span>
                          </div>

                          {/* Details Table */}
                          <div className="space-y-1.5 text-[10px] font-bold text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80">
                            <div className="flex justify-between">
                              <span className="text-slate-400">প্রাপক/সদস্য:</span>
                              <span className="text-slate-800 font-extrabold">সুজন মিয়া (AMB-1082)</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">তারিখ ও সময়:</span>
                              <span className="text-slate-800">{new Date().toLocaleDateString('bn-BD')} | 12:30 PM</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">পূর্ববর্তী মেইন ব্যালেন্স:</span>
                              <span className="text-slate-800 font-mono">৳1,500.00</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">বর্তমান মেইন ব্যালেন্স:</span>
                              <span className="text-emerald-700 font-mono font-black">৳6,500.00</span>
                            </div>
                          </div>

                          {/* Custom Notice Box */}
                          {activeNotice && (
                            <div className="bg-amber-50 border border-amber-200/80 p-2 rounded-xl text-[9.5px] font-bold text-amber-900 text-center">
                              💡 {activeNotice}
                            </div>
                          )}

                          {/* Signature & Verification Footer */}
                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                            <div className="text-left space-y-0.5">
                              <span className="text-[8px] text-slate-400 block font-bold">{receiptFooterVerificationText}</span>
                              <span className="text-[8px] text-slate-400 block">{receiptFooterComputerGeneratedText}</span>
                            </div>

                            <div className="text-center border-t border-slate-300 pt-1 min-w-[90px]">
                              <span className="text-[9px] font-black text-slate-800 block uppercase">{receiptAdminSignatureName}</span>
                              <span className="text-[8px] font-bold text-slate-500 block">{receiptAdminSignatureTitle}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
        )}

        {/* TAB 8: COOPERATIVE SUPER SHOP ADMIN */}
    </>
  );
}
