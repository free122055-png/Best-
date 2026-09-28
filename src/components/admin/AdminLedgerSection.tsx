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

export function AdminLedgerSection(props: any) {
  const appConfig = props.appConfig || {};
  const onChangeConfig = props.onChangeConfig || (() => {});

  const {
    adminTab,
    y,
    text,
    left,
    type,
    isRunningWalletTests,
    setIsRunningWalletTests,
    setWalletTestResults,
    results,
    alert,
    walletTestResults,
    item,
    key,
    transactions,
    users,
    u,
    name,
    uid,
    userId,
    totalCount,
    amount,
    setHistorySearch,
    setHistoryType,
    setHistoryStatus,
    setHistorySort,
    historySearch,
    target,
    historyType,
    historyStatus,
    id,
    historySort,
    tx,
    description,
    list,
    img,
    typeLabel,
    setHistoryActiveScreenshot,
    handleAdminDeleteTransaction
  } = props;

  return (
    <>
        {adminTab === 'all_history_admin' && (
          <div className="space-y-6 animate-fade-in text-slate-800">
            {/* Title Banner */}
            <div className="bg-gradient-to-r from-rose-900 to-indigo-950 p-6 rounded-3xl text-white relative overflow-hidden shadow-lg border border-rose-800 text-left">
              <div className="relative z-10 space-y-1.5">
                <div className="inline-flex items-center gap-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full text-[11px] font-bold">
                  <span>📜 Master Audit Ledger</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black">📜 সর্বমোট লেনদেন ইতিহাস ও অ্যাকাউন্টস অডিট মাস্টার খাতা</h2>
                <p className="text-xs text-rose-100 max-w-2xl leading-relaxed">
                  পুরো সিস্টেমের সব সদস্যদের জমা, উত্তোলন, রিচার্জ, কিস্তি আদায় এবং ডিজিটাল শপের কেনাকাটাসহ সব লেনদেন ও ঠিকানা এই সেকশন থেকে সরাসরি ট্র্যাক, ফিল্টার এবং হিসাব অডিট করতে পারবেন।
                </p>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl" />
              <div className="absolute bottom-0 right-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl" />
            </div>

            {/* 🌟 WALLET LEDGER INTEGRITY & E2E TEST SUITE (TESTS 1-8) */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/40 p-4 sm:p-6 rounded-3xl text-white shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">⚡</span>
                    ওয়ালেট লেজার ইনটেগ্রিটি ও এন্ড-টু-এন্ড টেস্ট স্যুট (Tests 1–8)
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1">
                    বাস্তব ডাটাবেজ ও লেজারের মাধ্যমে Add Money, Payment, AMB-to-AMB Transfer, Idempotency, Concurrency এবং Reconciliation টেস্ট করুন।
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isRunningWalletTests}
                  onClick={async () => {
                    setIsRunningWalletTests(true);
                    setWalletTestResults(null);
                    try {
                      const results = await runWalletEndToEndTests();
                      setWalletTestResults(results);
                    } catch (e: any) {
                      alert('টেস্ট চালাতে ত্রুটি হয়েছে: ' + e.message);
                    } finally {
                      setIsRunningWalletTests(false);
                    }
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-2xl shadow-lg transition cursor-pointer flex items-center gap-2 active:scale-95 shrink-0 uppercase tracking-wide"
                >
                  {isRunningWalletTests ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>টেস্ট এক্সিকিউট হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <span>▶️ 8টি টেস্ট রান করুন (Run Tests)</span>
                    </>
                  )}
                </button>
              </div>

              {walletTestResults && (
                <div className="space-y-3 pt-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                    <span>ফলাফল সারাংশ: <strong className="text-emerald-400">{walletTestResults.filter(r => r.status === 'PASS').length} / {walletTestResults.length} পাস হয়েছে</strong></span>
                    <span className="text-[10px] text-slate-400 font-mono">Timestamp: {new Date().toLocaleTimeString()}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {walletTestResults.map((item) => (
                      <div 
                        key={item.testNumber}
                        className={`p-3 rounded-2xl border text-xs flex flex-col justify-between gap-2 shadow-sm ${
                          item.status === 'PASS' 
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100' 
                            : 'bg-rose-950/40 border-rose-500/50 text-rose-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-black flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center text-[10px] font-mono text-slate-300">{item.testNumber}</span>
                            {item.testName}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.status === 'PASS' ? 'bg-emerald-500 text-slate-950 shadow-xs' : 'bg-rose-500 text-white'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 font-medium leading-relaxed pl-6">
                          {item.details}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* History Retention System Controls */}
            <HistoryRetentionSettings appConfig={appConfig} onChangeConfig={onChangeConfig} />

            {/* Financial Overview Cards Grid (হিসাব সারাংশ) */}
            {(() => {
              // Precalculate stats from all transactions in system (excluding demo accounts)
              const demoUserIds = new Set(
                users
                  .filter(u => u.isDemo || u.name?.toLowerCase().includes('demo') || u.name?.includes('ডেমো') || u.name?.toLowerCase().includes('guest') || u.name?.includes('গেস্ট') || u.phone?.includes('01700000000') || u.memberId?.includes('DEMO'))
                  .map((u, idx) => u.uid)
              );
              const txs = transactions.filter(t => {
                const isDemo = (t.userId && demoUserIds.has(t.userId)) || 
                  t.userName?.toLowerCase().includes('demo') || 
                  t.userName?.includes('ডেমো') || 
                  t.userName?.toLowerCase().includes('guest') || 
                  t.userName?.includes('গেস্ট') || 
                  t.memberId?.toLowerCase().includes('demo') || 
                  t.memberId?.includes('ডেমো');
                
                // Exclude any pre-live/demo transactions before 2026-07-06T02:07:00-07:00
                const isPreLiveDemo = new Date(t.createdAt || 0) < new Date("2026-07-06T02:07:00-07:00");
                
                return !isDemo && !isPreLiveDemo;
              });
              const totalCount = txs.length;
              
              const totalDeposit = txs
                .filter(t => t.status === 'success' && t.type === 'coop_savings_deposit')
                .reduce((sum, t) => sum + (t.amount || 0), 0);

              const totalWithdraw = txs
                .filter(t => t.status === 'success' && (t.type === 'withdraw' || t.type === 'qard_withdrawal'))
                .reduce((sum, t) => sum + (t.amount || 0), 0);

              const totalRepayment = txs
                .filter(t => t.status === 'success' && (t.type === 'loan_repayment' || t.type === 'qard_loan_repayment'))
                .reduce((sum, t) => sum + (t.amount || 0), 0);

              const totalTelecom = txs
                .filter(t => t.status === 'success' && t.type === 'telecom_recharge')
                .reduce((sum, t) => sum + (t.amount || 0), 0);

              const totalPendingCount = txs.filter(t => t.status === 'pending').length;
              const totalPendingAmount = txs
                .filter(t => t.status === 'pending')
                .reduce((sum, t) => sum + (t.amount || 0), 0);

              return (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 text-left">
                  <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">মোট লেনদেন সংখ্যা</p>
                    <p className="text-xl font-black text-indigo-900 mt-1 font-mono">{totalCount.toLocaleString()}</p>
                    <span className="text-[9px] text-slate-400 font-bold block mt-0.5">সব সফল ও পেন্ডিং</span>
                  </div>

                  <div className="bg-emerald-50/60 border border-emerald-150 p-4 rounded-2xl shadow-xs">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">মোট সফল জমা (টাকা)</p>
                    <p className="text-xl font-black text-emerald-800 mt-1 font-mono">৳{totalDeposit.toLocaleString()}</p>
                    <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">ডিপোজিট ও টাকা যোগ</span>
                  </div>

                  <div className="bg-rose-50/60 border border-rose-150 p-4 rounded-2xl shadow-xs">
                    <p className="text-[10px] font-bold text-rose-700 uppercase">মোট সফল উত্তোলন (টাকা)</p>
                    <p className="text-xl font-black text-rose-800 mt-1 font-mono">৳{totalWithdraw.toLocaleString()}</p>
                    <span className="text-[9px] text-rose-600 font-bold block mt-0.5">মেম্বারদের ক্যাশআউট</span>
                  </div>

                  <div className="bg-amber-50/60 border border-amber-150 p-4 rounded-2xl shadow-xs">
                    <p className="text-[10px] font-bold text-amber-700 uppercase">মোট কিস্তি আদায় (টাকা)</p>
                    <p className="text-xl font-black text-amber-800 mt-1 font-mono">৳{totalRepayment.toLocaleString()}</p>
                    <span className="text-[9px] text-amber-600 font-bold block mt-0.5">লোন পরিশোধ কিস্তি</span>
                  </div>

                  <div className="bg-sky-50/60 border border-sky-150 p-4 rounded-2xl shadow-xs">
                    <p className="text-[10px] font-bold text-sky-700 uppercase">টেলিকম রিচার্জ (টাকা)</p>
                    <p className="text-xl font-black text-sky-800 mt-1 font-mono">৳{totalTelecom.toLocaleString()}</p>
                    <span className="text-[9px] text-sky-600 font-bold block mt-0.5">ফ্লেক্সিলোড ও প্যাক সফল</span>
                  </div>

                  <div className="bg-indigo-50/70 border border-indigo-150 p-4 rounded-2xl shadow-xs">
                    <p className="text-[10px] font-bold text-indigo-700 uppercase">পেন্ডিং অবরুদ্ধ (টাকা)</p>
                    <p className="text-xl font-black text-indigo-800 mt-1 font-mono">৳{totalPendingAmount.toLocaleString()}</p>
                    <span className="text-[9px] text-indigo-600 font-bold block mt-0.5">{totalPendingCount} টি অনুমোদন অপেক্ষমাণ</span>
                  </div>
                </div>
              );
            })()}

            {/* Filter controls card */}
            <div className="bg-white border border-slate-200 p-5 rounded-3xl text-left space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-rose-500" />
                  <span>স্মার্ট ট্রানজেকশন ফিল্টার এবং অ্যাকাউন্টস হিসাব</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearch('');
                    setHistoryType('all');
                    setHistoryStatus('all');
                    setHistorySort('newest');
                  }}
                  className="text-[10.5px] font-bold text-rose-500 hover:underline flex items-center gap-1"
                >
                  🔄 ফিল্টার মুছুন (Clear All)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                {/* Search Text Input */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">সদস্যের নাম, আইডি, ফোন বা TXN ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="যেমন: MD SUJON, AMB-1025, 01815..."
                      className="w-full pl-8 pr-3 py-2 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:ring-1 focus:ring-rose-500/50"
                    />
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">লেনদেনের খাত / ধরন</label>
                  <select
                    value={historyType}
                    onChange={(e) => setHistoryType(e.target.value)}
                    className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                  >
                    <option value="all">সব ধরন (All Types)</option>
                    <option value="deposit">সমবায় মূল ডিপোজিট (Deposit)</option>
                    <option value="coop_savings_deposit">সমিতি সঞ্চয় জমা (Savings Deposit)</option>
                    <option value="add_money">ওয়ালেট ব্যালেন্স যোগ (Add Money)</option>
                    <option value="withdraw">ক্যাশআউট উত্তোলন (Cash Out)</option>
                    <option value="telecom_recharge">টেলিকম ফ্লেক্সিলোড (Telecom Recharge)</option>
                    <option value="loan_repayment">সমবায় লোন কিস্তি পরিশোধ</option>
                    <option value="qard_loan_repayment">করযে হাসানা ঋণ কিস্তি</option>
                    <option value="qard_loan_request">করযে হাসানা ঋণ আবেদন</option>
                    <option value="shop_purchase">সুপার শপ অর্ডার (Super Shop)</option>
                    <option value="money_exchange">মানি এক্সচেঞ্জ (Money Exchange)</option>
                    <option value="balance_transfer">ব্যালেন্স ট্রান্সফার (Transfer Send)</option>
                    <option value="received_transfer">ব্যালেন্স ট্রান্সফার (Transfer Recv)</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">লেনদেন স্থিতি / স্ট্যাটাস</label>
                  <select
                    value={historyStatus}
                    onChange={(e) => setHistoryStatus(e.target.value)}
                    className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                  >
                    <option value="all">সব স্ট্যাটাস (All Status)</option>
                    <option value="pending">🟡 পেন্ডিং অপেক্ষমাণ (Pending)</option>
                    <option value="success">🟢 সফল অনুমোদিত (Success)</option>
                    <option value="failed">🔴 বাতিল বা রিজেক্টেড (Failed)</option>
                  </select>
                </div>
              </div>

              {/* Extra Sorting Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-slate-500">লেনদেন সাজানো খতিয়ান:</span>
                  <div className="flex gap-1.5">
                    {[
                      { id: 'newest', label: '🕒 নতুন আগে' },
                      { id: 'oldest', label: '⏳ পুরাতন আগে' },
                      { id: 'highest', label: '💰 বড় অংক' },
                      { id: 'lowest', label: '📉 ছোট অংক' }
                    ].map((opt, idx) => (
                      <button
                        key={`${opt.id}-${idx}`}
                        type="button"
                        onClick={() => setHistorySort(opt.id)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition ${
                          historySort === opt.id
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instant Audit Calculation Display */}
                {(() => {
                  const demoUserIds = new Set(
                    users
                      .filter(u => u.isDemo || u.name?.toLowerCase().includes('demo') || u.name?.includes('ডেমো') || u.name?.toLowerCase().includes('guest') || u.name?.includes('গেস্ট') || u.phone?.includes('01700000000') || u.memberId?.includes('DEMO'))
                      .map((u, idx) => u.uid)
                  );
                  // Filter transactions based on active states
                  let filtered = transactions.filter((tx) => {
                    const isDemo = (tx.userId && demoUserIds.has(tx.userId)) || 
                      tx.userName?.toLowerCase().includes('demo') || 
                      tx.userName?.includes('ডেমো') || 
                      tx.userName?.toLowerCase().includes('guest') || 
                      tx.userName?.includes('গেস্ট') || 
                      tx.memberId?.toLowerCase().includes('demo') || 
                      tx.memberId?.includes('ডেমো');
                    
                    // Exclude any pre-live/demo transactions before 2026-07-06T02:07:00-07:00
                    const isPreLiveDemo = new Date(tx.createdAt || 0) < new Date("2026-07-06T02:07:00-07:00");
                    
                    if (isDemo || isPreLiveDemo) return false;

                    // Search term matcher
                    const s = historySearch.toLowerCase().trim();
                    const nameMatch = tx.userName?.toLowerCase().includes(s) || false;
                    const idMatch = tx.memberId?.toLowerCase().includes(s) || tx.userId?.toLowerCase().includes(s) || false;
                    const descMatch = tx.description?.toLowerCase().includes(s) || false;
                    const trxMatch = tx.transactionId?.toLowerCase().includes(s) || false;
                    const phoneMatch = tx.senderInfo?.toLowerCase().includes(s) || false;
                    const amountStr = String(tx.amount).includes(s);

                    const matchesSearch = !s || nameMatch || idMatch || descMatch || trxMatch || phoneMatch || amountStr;

                    // Type matcher
                    const matchesType = historyType === 'all' || tx.type === historyType;

                    // Status matcher
                    const matchesStatus = historyStatus === 'all' || 
                      (historyStatus === 'failed' ? (tx.status === 'failed' || tx.status === 'rejected') : tx.status === historyStatus);

                    return matchesSearch && matchesType && matchesStatus;
                  });

                  const filteredCount = filtered.length;
                  const filteredSum = filtered.reduce((sum, tx) => sum + (tx.amount || 0), 0);
                  const successSum = filtered.filter(tx => tx.status === 'success').reduce((sum, tx) => sum + (tx.amount || 0), 0);
                  const pendingSum = filtered.filter(tx => tx.status === 'pending').reduce((sum, tx) => sum + (tx.amount || 0), 0);

                  return (
                    <div className="text-right text-[11px] font-bold text-slate-700 bg-rose-50/40 border border-rose-100 px-4 py-2 rounded-2xl flex flex-wrap gap-x-4 gap-y-1 justify-end">
                      <span>মোট রেকর্ড: <strong className="text-indigo-900 font-mono text-xs">{filteredCount} টি</strong></span>
                      <span>ফিল্টারকৃত সর্বমোট পরিমাণ: <strong className="text-rose-700 font-mono text-xs">৳{filteredSum.toLocaleString()}</strong></span>
                      <span>সফল: <strong className="text-emerald-700 font-mono text-xs">৳{successSum.toLocaleString()}</strong></span>
                      {pendingSum > 0 && <span>পেন্ডিং: <strong className="text-amber-700 font-mono text-xs">৳{pendingSum.toLocaleString()}</strong></span>}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Main Ledger List Card */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs text-left">
              <div className="bg-slate-50 border-b p-4 px-6 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">সদস্য ট্রানজেকশন খতিয়ান রেজিস্টার</h3>
                <span className="text-[10px] font-bold text-slate-400">রিয়েল-টাইম ডাটা সিঙ্ক</span>
              </div>

              {(() => {
                // Apply filters to display list (excluding demo accounts)
                const demoUserIds = new Set(
                  users
                    .filter(u => u.isDemo || u.name?.toLowerCase().includes('demo') || u.name?.includes('ডেমো') || u.name?.toLowerCase().includes('guest') || u.name?.includes('গেস্ট') || u.phone?.includes('01700000000') || u.memberId?.includes('DEMO'))
                    .map((u, idx) => u.uid)
                );
                let filtered = transactions.filter((tx) => {
                  const isDemo = (tx.userId && demoUserIds.has(tx.userId)) || 
                    tx.userName?.toLowerCase().includes('demo') || 
                    tx.userName?.includes('ডেমো') || 
                    tx.userName?.toLowerCase().includes('guest') || 
                    tx.userName?.includes('গেস্ট') || 
                    tx.memberId?.toLowerCase().includes('demo') || 
                    tx.memberId?.includes('ডেমো');
                  
                  // Exclude any pre-live/demo transactions before 2026-07-06T02:07:00-07:00
                  const isPreLiveDemo = new Date(tx.createdAt || 0) < new Date("2026-07-06T02:07:00-07:00");
                  
                  if (isDemo || isPreLiveDemo) return false;

                  const s = historySearch.toLowerCase().trim();
                  const nameMatch = tx.userName?.toLowerCase().includes(s) || false;
                  const idMatch = tx.memberId?.toLowerCase().includes(s) || tx.userId?.toLowerCase().includes(s) || false;
                  const descMatch = tx.description?.toLowerCase().includes(s) || false;
                  const trxMatch = tx.transactionId?.toLowerCase().includes(s) || false;
                  const phoneMatch = tx.senderInfo?.toLowerCase().includes(s) || false;
                  const amountStr = String(tx.amount).includes(s);

                  const matchesSearch = !s || nameMatch || idMatch || descMatch || trxMatch || phoneMatch || amountStr;
                  const matchesType = historyType === 'all' || tx.type === historyType;
                  const matchesStatus = historyStatus === 'all' || 
                    (historyStatus === 'failed' ? (tx.status === 'failed' || tx.status === 'rejected') : tx.status === historyStatus);

                  return matchesSearch && matchesType && matchesStatus;
                });

                // Apply sorting
                if (historySort === 'newest') {
                  filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                } else if (historySort === 'oldest') {
                  filtered.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
                } else if (historySort === 'highest') {
                  filtered.sort((a, b) => (b.amount || 0) - (a.amount || 0));
                } else if (historySort === 'lowest') {
                  filtered.sort((a, b) => (a.amount || 0) - (b.amount || 0));
                }

                if (filtered.length === 0) {
                  return (
                    <div className="py-24 text-center text-slate-500 text-xs font-bold space-y-2">
                      <p className="text-2xl">🔍</p>
                      <p>বর্তমান সার্চ এবং ফিল্টার অনুযায়ী কোনো ট্রানজেকশন ডাটা পাওয়া যায়নি।</p>
                      <p className="text-[10px] text-slate-400">সার্চ কী-ওয়ার্ড পরিবর্তন করুন বা অন্য ক্যাটাগরি ফিল্টার করুন।</p>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100 max-h-[800px] overflow-y-auto">
                    {filtered.map((tx, index) => {
                      // Lookup sender user details dynamically to print full address and contact
                      const senderProfile = users.find(u => u.uid === tx.userId || u.memberId === tx.memberId);
                      
                      const hasAddress = senderProfile && (
                        senderProfile.village || 
                        senderProfile.postOffice || 
                        senderProfile.thana || 
                        senderProfile.district || 
                        senderProfile.division
                      );

                      // Helper badge styling based on type
                      let typeColor = 'bg-slate-100 text-slate-700';
                      if (tx.type === 'deposit' || tx.type === 'coop_savings_deposit') {
                        typeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-150';
                      } else if (tx.type === 'add_money') {
                        typeColor = 'bg-blue-50 text-blue-700 border border-blue-150';
                      } else if (tx.type === 'withdraw' || tx.type === 'qard_withdrawal') {
                        typeColor = 'bg-rose-50 text-rose-700 border border-rose-150';
                      } else if (tx.type === 'telecom_recharge') {
                        typeColor = 'bg-sky-50 text-sky-700 border border-sky-150';
                      } else if (tx.type === 'loan_repayment' || tx.type === 'qard_loan_repayment') {
                        typeColor = 'bg-amber-50 text-amber-700 border border-amber-150';
                      }

                      return (
                        <div key={`${tx.id || "tx"}-${index}`} className="p-5 hover:bg-slate-50 transition space-y-3.5 text-left">
                          {/* Row 1: Header (User basic info + Type label + Status) */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                              {/* Member profile image or avatar */}
                              {senderProfile?.profilePic ? (
                                <img
                                  src={senderProfile.profilePic}
                                  alt=""
                                  className="w-9 h-9 rounded-full object-cover border border-slate-200"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center text-rose-700 font-extrabold text-xs">
                                  {tx.userName ? tx.userName.substring(0, 2).toUpperCase() : 'BN'}
                                </div>
                              )}
                              
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-xs font-black text-slate-800">{tx.userName || 'অজানা মেম্বার'}</h4>
                                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">{tx.memberId || 'N/A'}</span>
                                  {senderProfile?.phone && (
                                    <span className="text-[9px] text-slate-500 font-mono font-bold">({senderProfile.phone})</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  তারিখঃ {tx.createdAt ? new Date(tx.createdAt).toLocaleString('bn-BD', { hour12: true }) : 'N/A'}
                                </p>
                              </div>
                            </div>

                            {/* Badge & Amount */}
                            <div className="flex items-center gap-3 justify-between sm:justify-end">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl ${typeColor}`}>
                                {tx.typeLabel || tx.type}
                              </span>

                              <div className="text-right">
                                <span className={`text-sm font-black font-mono ${
                                  tx.status === 'failed'
                                    ? 'text-slate-400 line-through'
                                    : (tx.type === 'withdraw' || tx.type === 'telecom_recharge' || tx.type === 'qard_withdrawal')
                                      ? 'text-rose-600'
                                      : 'text-emerald-600'
                                }`}>
                                  {(tx.type === 'withdraw' || tx.type === 'telecom_recharge' || tx.type === 'qard_withdrawal') ? '-' : '+'}
                                  ৳{tx.amount?.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Row 2: Complete Location Address (This answers the core user request about member's address!) */}
                          <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl space-y-1.5">
                            <div className="flex items-center gap-1 text-[10px] font-black text-rose-800">
                              <span>📍</span>
                              <span>প্রেরকের স্থায়ী ও বর্তমান ঠিকানা খতিয়ান (Member Address & Contact Profile)</span>
                            </div>
                            
                            {hasAddress ? (
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-y-1.5 gap-x-3 text-[10.5px] text-slate-700 leading-relaxed font-semibold">
                                <div><span className="text-slate-400 block text-[9px] font-bold">গ্রাম/মহল্লাঃ</span> {senderProfile.village || 'N/A'}</div>
                                <div><span className="text-slate-400 block text-[9px] font-bold">ডাকঘরঃ</span> {senderProfile.postOffice || 'N/A'}</div>
                                <div><span className="text-slate-400 block text-[9px] font-bold">থানা/উপজেলাঃ</span> {senderProfile.thana || 'N/A'}</div>
                                <div><span className="text-slate-400 block text-[9px] font-bold">জেলাঃ</span> {senderProfile.district || 'N/A'}</div>
                                <div><span className="text-slate-400 block text-[9px] font-bold">বিভাগঃ</span> {senderProfile.division || 'N/A'}</div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 italic">
                                ⚠️ এই সদস্যটি এখনো তার স্থায়ী ঠিকানা ও প্রোফাইল খতিয়ান পূরণ করেননি। (যোগাযোগ মোবাইলঃ {senderProfile?.phone || tx.senderInfo || 'N/A'})
                              </p>
                            )}
                          </div>

                          {/* Row 3: Transaction execution properties & Proof screenshots */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs leading-relaxed text-slate-600">
                            {/* Left part: Method, TxnID, Comment */}
                            <div className="sm:col-span-8 space-y-1.5">
                              {tx.description && (
                                <p className="text-[11px] font-semibold text-slate-700">
                                  💬 <strong>লেনদেনের বিবরণঃ</strong> {tx.description}
                                </p>
                              )}
                              
                              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10.5px] font-medium text-slate-500">
                                {tx.paymentMethod && (
                                  <span>🏦 <strong>পেমেন্ট গেটওয়েঃ</strong> <strong className="text-indigo-950">{tx.paymentMethod}</strong></span>
                                )}
                                {tx.senderInfo && (
                                  <span>📱 <strong>প্রেরক নম্বর/হিসাবঃ</strong> <strong className="text-slate-800">{tx.senderInfo}</strong></span>
                                )}
                                {tx.transactionId && (
                                  <span className="flex items-center gap-1">
                                    🔑 <strong>ট্রানজেকশন ID:</strong>
                                    <strong className="text-rose-900 font-mono select-all bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/40 text-[10px]">
                                      {tx.transactionId}
                                    </strong>
                                  </span>
                                )}
                              </div>

                              {tx.adminNotice && (
                                <p className="text-[10.5px] bg-slate-100 p-2 rounded-xl text-slate-600 font-bold border border-slate-200/60">
                                  📢 <strong>অ্যাডমিন রিমার্কস বা রিজেক্ট কারণঃ</strong> {tx.adminNotice}
                                </p>
                              )}
                            </div>

                            {/* Right part: Status badge + Screenshot thumb if exists */}
                            <div className="sm:col-span-4 flex flex-col justify-between items-end gap-2.5">
                              {/* Status badge */}
                              {tx.status === 'pending' ? (
                                <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 animate-pulse">
                                  🟡 PENDING (অপেক্ষমাণ)
                                </span>
                              ) : tx.status === 'success' ? (
                                <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                  🟢 SUCCESS (অনুমোদিত)
                                </span>
                              ) : (
                                <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                                  🔴 REJECTED (বাতিলকৃত)
                                </span>
                              )}

                              {/* Screenshot Receipt proof preview */}
                              {tx.screenshot ? (
                                <button
                                  type="button"
                                  onClick={() => setHistoryActiveScreenshot(tx.screenshot || null)}
                                  className="group relative flex items-center gap-1 bg-rose-50 border border-rose-100 hover:bg-rose-100 px-2 py-1.5 rounded-xl transition cursor-zoom-in"
                                >
                                  <img
                                    src={tx.screenshot}
                                    alt=""
                                    className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                                  />
                                  <div className="text-left">
                                    <span className="text-[9px] font-bold text-rose-800 block">রিসিপ্ট প্রুফ</span>
                                    <span className="text-[7.5px] text-rose-600 block leading-none">ক্লিক করুন দেখতে</span>
                                  </div>
                                </button>
                              ) : (
                                <span className="text-[9px] text-slate-400">কোনো পেমেন্ট ইমেজ স্ক্রিনশট নেই</span>
                              )}

                              {/* Admin Direct Delete Transaction Button */}
                              <button
                                type="button"
                                onClick={() => handleAdminDeleteTransaction(tx.id, `${tx.userName || tx.memberId || 'মেম্বার'} - ${tx.typeLabel || tx.type || 'লেনদেন'} (৳${tx.amount})`)}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-[10.5px] rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs border border-rose-500/40 mt-1 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>মুছে ফেলুন</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

    </>
  );
}
