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

export function AdminSystemResetSection(props: any) {
  const {
    adminTab,
    y,
    text,
    left,
    setAdminTab,
    resetSuccess,
    setResetSuccess,
    resetError,
    setResetError,
    setSystemResetEnabled,
    systemResetEnabled,
    setResetMode,
    resetMode,
    type,
    setResetConfirmInput,
    setResetPinInput,
    setShowResetModal
  } = props;

  return (
    <>
        {adminTab === 'system_reset' && (
          <div className="space-y-6 text-left text-slate-800 font-sans animate-fade-in">
            {/* Header Alert Banner */}
            <div className="bg-gradient-to-r from-rose-900 via-red-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-rose-700/50 relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-600/30 border border-rose-500/50 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-6 h-6 text-rose-300" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                      ⚙️ রিসেট ও পাবলিশ ইনিশিয়ালাইজেশন (System Reset)
                    </h2>
                    <p className="text-xs text-rose-200 mt-1 max-w-2xl font-medium leading-relaxed">
                      অ্যাপটি সর্বসাধারণের জন্য পাবলিশ করার আগে বা নতুন ফিন্যান্সিয়াল টার্মে প্রবেশের সময় সমস্ত টেস্ট ব্যালেন্স ও লেনদেন ইতিহাস জিরো (0) করে ফ্রেশ স্টার্ট করুন।
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setAdminTab('config'); }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" /> ব্যাক কনফিগ
                </button>
              </div>
            </div>

            {/* Success & Error alerts */}
            {resetSuccess && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-5 py-4 rounded-2xl text-xs font-black flex items-center justify-between shadow-xs animate-fade-in">
                <span className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  {resetSuccess}
                </span>
                <button onClick={() => setResetSuccess('')} className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {resetError && (
              <div className="bg-rose-50 border border-rose-300 text-rose-900 px-5 py-4 rounded-2xl text-xs font-black flex items-center justify-between shadow-xs animate-fade-in">
                <span className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  {resetError}
                </span>
                <button onClick={() => setResetError('')} className="text-rose-700 hover:text-rose-900 font-bold cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Main Configuration Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
              
              {/* Step 1: Switch Controls */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      1. সিস্টেম রিসেট এনাবল সুইচ (Enable System Reset)
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      দুর্ঘটনাবশত রিসেট বাটনে ক্লিক হওয়া ঠেকাতে এই সুইচটি চালু করুন।
                    </p>
                  </div>
                  <div
                    onClick={() => {
                      setSystemResetEnabled(!systemResetEnabled);
                      setResetError('');
                    }}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer select-none shrink-0 ${
                      systemResetEnabled ? 'bg-rose-600' : 'bg-slate-300'
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      systemResetEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </div>
                </div>

                {systemResetEnabled && (
                  <div className="bg-rose-100/70 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                    <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>সিস্টেম রিসেট মোড এখন আনলক করা হয়েছে। অনুগ্রহ করে রিসেটের প্রকারভেদ নির্বাচন করুন।</span>
                  </div>
                )}
              </div>

              {/* Step 2: Select Reset Mode */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide">
                  2. রিসেটের মোড নির্বাচন করুন (Select Reset Type)
                </label>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Mode A: Financial Balances & Transactions Only */}
                  <div
                    onClick={() => setResetMode('financial_only')}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                      resetMode === 'financial_only'
                        ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                          হিসাব ক্লিয়ার (Balances Only)
                        </span>
                        {resetMode === 'financial_only' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                      </div>
                      <h4 className="text-sm font-black">আর্থিক ব্যালেন্স ও লেনদেন ক্লিয়ার</h4>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        • সকল ইউজারের Wallet Balance = 0 ৳<br />
                        • সকল Pending, Loan & Income = 0 ৳<br />
                        • ট্রান্সফার ও নোটিফিকেশন ক্লিয়ার হবে।<br />
                        • <strong className="text-emerald-700 font-bold">সকল ইউজার আইডি অক্ষত থাকবে।</strong>
                      </p>
                    </div>
                  </div>

                  {/* Mode B: Lifetime Permanent Account Policy Protected */}
                  <div
                    className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-500 relative flex flex-col justify-between opacity-80 cursor-not-allowed"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> আজীবন স্থায়ী একাউন্ট
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-700">সদস্য অ্যাকাউন্ট চিরস্থায়ী সুরক্ষিত</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        • সদস্যদের অ্যাকাউন্ট আজীবন চিরস্থায়ী এবং ডাটাবেজ থেকে মোছা সম্পূর্ণ নিষিদ্ধ।<br />
                        • <strong className="text-emerald-800 font-bold">একবার অ্যাকাউন্ট খোলা হলে তা সারা জীবন সক্রিয় থাকে।</strong><br />
                        • কোনো সদস্যের অ্যাকাউন্ট কখনো ডিলিট হবে না।
                      </p>
                    </div>
                  </div>

                  {/* Mode C: Security Rule Enforced */}
                  <div
                    className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-500 relative flex flex-col justify-between opacity-80 cursor-not-allowed"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> ফায়ারস্টোর রুলস সুরক্ষিত
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-700">অপরিবর্তনীয় ডেটা নিরাপত্তা</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        • ফায়ারস্টোর সিকিউরিটি রুলস দ্বারা ইউজার ডিলিটেশন বন্ধ করা হয়েছে।<br />
                        • <strong className="text-blue-800 font-bold">আজীবন মেম্বারশিপ ও হিস্টোরি শতভাগ সংরক্ষিত।</strong><br />
                        • দুর্ঘটনাবশত ডিলিট হওয়ার কোনো সুযোগ নেই।
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Trigger Reset Button */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 font-medium">
                  {systemResetEnabled ? (
                    <span className="text-rose-600 font-bold flex items-center gap-1">
                      <Lock className="w-4 h-4" /> রিসেট করতে নিচের বাটনে ক্লিক করুন এবং পিন ইনপুট দিন।
                    </span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1">
                      🔒 রিসেট বাটন লক অবস্থায় আছে। উপরে 1 নং সুইচটি চালু করুন।
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!systemResetEnabled}
                  onClick={() => {
                    setResetConfirmInput('');
                    setResetPinInput('');
                    setResetError('');
                    setShowResetModal(true);
                  }}
                  className={`px-6 py-3.5 rounded-2xl font-black text-xs flex items-center gap-2 transition shadow-md cursor-pointer ${
                    systemResetEnabled
                      ? 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white shadow-rose-950/20 active:scale-98'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  রিসেট ডাটা প্রসেস করুন (Reset All Financial Data)
                </button>
              </div>

            </div>

            {/* Summary & Guidance */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  সিস্টেম রিসেট এবং পাবলিশ গাইডলাইন (Production Release Checklist)
                </h3>
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-bold">
                  সিকিউরিটি গাইড
                </span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 font-medium leading-relaxed space-y-2">
                <p>
                  🛡️ <strong>সিকিউরিটি গ্যারান্টি:</strong> সিস্টেম রিসেট সম্পাদন করার পূর্বে নিশ্চিতকরণ হিসেবে <code>"RESET"</code> টাইপ করতে হবে এবং আপনার এডমিন পিন ভেরিফাই করতে হবে।
                </p>
                <p>
                  📊 <strong>লাইভ অ্যাপ রিয়েল-টাইম আপডেট:</strong> রিসেট সম্পন্ন হওয়ার সঙ্গে সঙ্গে ফায়ারবেস ফায়ারস্টোর ডাটাবেসের মাধ্যমে সমস্ত ইউজারের ব্যালেন্স অটোমেটিক 0 হয়ে যাবে।
                </p>
              </div>
            </div>

          </div>
        )}
    </>
  );
}
