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

export const isPendingTransaction = (t: any): boolean => {
  if (!t) return false;
  const s = String(t.status || '').trim().toLowerCase();
  const rev = String(t.reviewStatus || '').trim().toLowerCase();
  if (s === 'approved' || s === 'success' || s === 'completed' || t.isApproved === true) return false;
  if (s === 'rejected' || s === 'failed' || s === 'cancelled' || s === 'canceled' || rev === 'rejected') return false;
  return s === 'pending' || s === 'processing' || s === 'on_hold' || s === 'hold' || s === 'waiting' || rev === 'pending' || (t.isApproved === false && s !== 'rejected');
};

export const matchesBankPendingCategory = (t: any, filter: string): boolean => {
  if (filter === 'all') return true;
  const type = String(t.type || '').toLowerCase();
  const label = String(t.typeLabel || '').toLowerCase();
  const desc = String(t.description || '').toLowerCase();

  if (filter === 'add_money') {
    return ['add_money', 'deposit', 'samity_deposit', 'add_money_request', 'balance_load', 'coop_savings_deposit'].includes(type) || 
      label.includes('অ্যাড মানি') || label.includes('ডিপোজিট') || label.includes('জমা') ||
      desc.includes('অ্যাড মানি') || desc.includes('ডিপোজিট') || desc.includes('জমা');
  }
  if (filter === 'withdraw') {
    return ['cash_out', 'withdraw', 'samity_withdraw'].includes(type) || 
      label.includes('উইথড্র') || label.includes('উত্তোলন') || label.includes('ক্যাশ আউট') || label.includes('ক্যাশআউট') ||
      desc.includes('উইথড্র') || desc.includes('উত্তোলন') || desc.includes('ক্যাশ আউট');
  }
  if (filter === 'transfer') {
    return ['remittance', 'balance_transfer', 'transfer', 'send_money', 'money_exchange'].includes(type) || 
      label.includes('ট্রান্সফার') || label.includes('রেমিট্যান্স') || label.includes('স্থানান্তর') || label.includes('সেন্ড মানি') ||
      desc.includes('ট্রান্সফার') || desc.includes('রেমিট্যান্স') || desc.includes('স্থানান্তর') || String(t.paymentMethod || '').toLowerCase().includes('transfer');
  }
  if (filter === 'loan') {
    return ['coop_loan_apply', 'loan_repayment', 'qard_loan_request', 'loan'].includes(type) || 
      label.includes('ঋণ') || label.includes('লোন') || label.includes('কর্জ');
  }
  if (filter === 'recharge') {
    return ['telecom_recharge', 'bill_pay'].includes(type) || 
      label.includes('রিচার্জ') || label.includes('বিল');
  }
  if (filter === 'other') {
    const isAdd = ['add_money', 'deposit', 'samity_deposit', 'add_money_request'].includes(type) || label.includes('অ্যাড মানি') || label.includes('ডিপোজিট');
    const isWithdraw = ['cash_out', 'withdraw'].includes(type) || label.includes('উইথড্র') || label.includes('ক্যাশ আউট');
    const isTransfer = ['remittance', 'balance_transfer', 'transfer', 'send_money'].includes(type) || label.includes('ট্রান্সফার') || label.includes('রেমিট্যান্স');
    const isLoan = ['coop_loan_apply', 'loan_repayment', 'qard_loan_request', 'loan'].includes(type) || label.includes('ঋণ') || label.includes('লোন');
    const isRecharge = ['telecom_recharge', 'bill_pay'].includes(type) || label.includes('রিচার্জ') || label.includes('বিল');
    return !isAdd && !isWithdraw && !isTransfer && !isLoan && !isRecharge;
  }
  return false;
};

export function AdminBankSection(props: any) {
  const appConfig = props.appConfig || {};
  const onChangeConfig = props.onChangeConfig || (() => {});

  const {
    adminTab,
    y,
    text,
    left,
    id,
    item,
    adminBankBoxTab,
    key,
    type,
    setAdminBankBoxTab,
    transactions,
    list,
    setBankPendingFilter,
    bankPendingFilter,
    tx,
    typeLabel,
    description,
    setPreviewImage,
    amount,
    handleApproveTransaction,
    handleRejectTransaction,
    setEditingTxModal,
    setLoading,
    alert,
    targetUid,
    targetUser,
    users,
    u,
    uid,
    currentBal,
    notifTitle,
    notifBody,
    now,
    userId,
    name,
    loading,
    reason,
    handleSaveGlobalRulesAndFees,
    cfgCoopInterestRate,
    setCfgCoopInterestRate,
    target,
    cfgRemittanceFeePercent,
    setCfgRemittanceFeePercent,
    handleInitDefaultBanks,
    openAddBankModal,
    adminAddMoneySubTab,
    setAdminAddMoneySubTab,
    showAddBank,
    editingBank,
    setEditingBank,
    setShowAddBank,
    handleSaveBank,
    setEbAccountType,
    setEbIsMobileBank,
    setEbIsInternational,
    setEbAcronym,
    setEbBgClass,
    setEbTextClass,
    setEbLogoBgClass,
    ebAccountType,
    ebIsMobileBank,
    ebIsInternational,
    ebBgClass,
    ebName,
    setEbName,
    ebHolder,
    setEbHolder,
    ebAccNum,
    setEbAccNum,
    ebAcronym,
    ebBranch,
    setEbBranch,
    ebRoutingNum,
    setEbRoutingNum,
    ebIban,
    setEbIban,
    ebCurrency = 'SAR',
    setEbCurrency = () => {},
    ebCountry = 'সৌদি আরব',
    setEbCountry = () => {},
    ebTransferFee = '15',
    setEbTransferFee = () => {},
    ebCustomRate = '',
    setEbCustomRate = () => {},
    remitTransferFeeVal = '15',
    setRemitTransferFeeVal = () => {},
    file,
    handleBankQrUpload,
    ebQrCodeUrl,
    setEbQrCodeUrl,
    img,
    ebActive,
    setEbActive,
    handleSaveMfsGateways,
    cfgMfsBkashActive,
    setCfgMfsBkashActive,
    cfgMfsBkashNumber,
    setCfgMfsBkashNumber,
    cfgMfsNagadActive,
    setCfgMfsNagadActive,
    cfgMfsNagadNumber,
    setCfgMfsNagadNumber,
    cfgMfsRocketActive,
    setCfgMfsRocketActive,
    cfgMfsRocketNumber,
    setCfgMfsRocketNumber,
    cfgMfsUpayActive,
    setCfgMfsUpayActive,
    cfgMfsUpayNumber,
    setCfgMfsUpayNumber,
    openEditBankModal,
    handleDeleteBank,
    currentBanks,
    updatedBanks,
    updatedConfig,
    handleInitDefaultIntlBanks,
    adminSendMoneySubTab,
    setAdminSendMoneySubTab,
    setEbVisaNum,
    handleSaveBankRulesSettings,
    cfgBankCbPerThousand,
    setCfgBankCbPerThousand,
    cfgSendMobileFlat,
    setCfgSendMobileFlat,
    cfgSendMobileSvc,
    setCfgSendMobileSvc,
    cfgSendBankFlat,
    setCfgSendBankFlat,
    cfgSendBankSvc,
    setCfgSendBankSvc,
    cfgIntExchangeRate,
    setCfgIntExchangeRate,
    cfgRemittanceFee = 10,
    setCfgRemittanceFee = () => {},
    ebVisaNum,
    filteredUsers,
    globalWelcomeTitle,
    setGlobalWelcomeTitle,
    globalWelcomeSub,
    setGlobalWelcomeSub,
    globalContactLabel,
    setGlobalContactLabel,
    globalSupportDeskInfo,
    setGlobalSupportDeskInfo,
    globalLoanBtn,
    setGlobalLoanBtn,
    globalRationBtn,
    setGlobalRationBtn,
    cardSearchQuery,
    setCardSearchQuery,
    setEditingCardUser,
    setEditCardNo,
    setEditCardAcc,
    setEditCardHolder,
    setEditCardExpiry,
    setEditCardCvv,
    setEditCardStatus,
    handleRenewUserCard,
    editingCardUser,
    handleSaveCardDetails,
    editCardNo,
    editCardAcc,
    editCardHolder,
    editCardExpiry,
    editCardCvv,
    editCardStatus,
    docId,
    realId,
    handleSaveRemitRate,
    editingRemitId,
    remitCountryFlag,
    setRemitCountryFlag,
    remitCountryName,
    setRemitCountryName,
    remitRateBDT,
    setRemitRateBDT,
    addMoneyRateBDT,
    setAddMoneyRateBDT,
    remitMultiplier,
    setRemitMultiplier,
    remitOrder,
    setRemitOrder,
    setEditingRemitId,
    remitSaving,
    rates,
    remitRates,
    handleEditRemitRate,
    handleDeleteRemitRate
  } = props;

  return (
    <>
        {adminTab === 'bank_admin' && (
          <div className="space-y-6">
            {/* 🌟 USER DASHBOARD REPLICA: MY AMB TRANSACTION BOX NAVIGATOR */}
            <div className="bg-[#0B1528] p-5 rounded-3xl border border-slate-800 space-y-4 shadow-xl text-left animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-800/80 pb-3">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    MY AMB লেনদেন ও সার্ভিস প্যানেল (Dashboard Interactive Replica)
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    ইউজার ড্যাশবোর্ডের এড মানি, সেন্ড মানি ও রেমিট্যান্স সার্ভিস বক্স। যেকোনো বক্সে ক্লিক করে সেই লেনদেন বা সার্ভিসের ফি, সেটিংস, রেট এডিট ও আপডেট করুন।
                  </p>
                </div>
                <div className="bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 rounded-full text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  এডমিন ফুল কন্ট্রোল (Add, Edit, Update, Delete)
                </div>
              </div>

              {/* 4 Circular Box Icons in 1 single row */}
              <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
                {[
                  { id: 'pending' as const, label: 'পেন্ডিং খাতা', icon: <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />, bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40', count: transactions.filter(isPendingTransaction).length },
                  { id: 'amb_to_amb' as const, label: 'এড মানি', icon: <PlusCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />, bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
                  { id: 'send_money' as const, label: 'সেন্ড মানি', icon: <Send className="w-4 h-4 sm:w-4.5 sm:h-4.5" />, bg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' },
                  { id: 'remittance' as const, label: 'রেমিট্যান্স', icon: <Globe className="w-4 h-4 sm:w-4.5 sm:h-4.5" />, bg: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
                ].map((item) => {
                  const isActive = adminBankBoxTab === (item.id as any) || (item.id === 'pending' && adminBankBoxTab === 'dashboard');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAdminBankBoxTab(item.id as any)}
                      className={`relative flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl border transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-slate-800 border-emerald-400 shadow-lg ring-2 ring-emerald-400/30 text-white'
                          : 'bg-slate-900/90 border-slate-800/80 text-slate-400 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      {item.count !== undefined && item.count > 0 && (
                        <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full ring-2 ring-slate-950 animate-pulse">
                          {item.count}
                        </span>
                      )}
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border shadow-md transition-transform ${
                        isActive ? 'bg-indigo-900 border-indigo-400 text-white scale-105' : item.bg
                      }`}>
                        {item.icon}
                      </div>
                      <span className={`text-[9.5px] sm:text-[11px] tracking-tight font-black truncate max-w-full ${isActive ? 'text-emerald-300' : 'text-slate-300'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1. DASHBOARD / PENDING TAB SECTION */}
            {(adminBankBoxTab === 'dashboard' || (adminBankBoxTab as any) === 'pending') && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left shadow-xs space-y-4 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    💵 অমীমাংসিত ব্যাংক ও রেমিট্যান্স লেনদেন অনুমোদন খাতা (Pending Transactions Center)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">সমগ্র বিশ্বের সমবায় সদস্যদের পাঠানো ডিপোজিট, উইথড্রয়াল, ক্যাশ-আউট, মোবাইল রিচার্জ এবং লোন পরিশোধ রিকোয়েস্টগুলো এখান থেকে ঝটপট পর্যবেক্ষণ ও নিয়ন্ত্রণ করুন।</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-2xl text-xs font-bold text-amber-800 shrink-0">
                  মোট পেন্ডিংঃ <span className="text-amber-700 font-black font-mono text-sm">{transactions.filter(isPendingTransaction).length}</span> টি
                </div>
              </div>

              {/* Responsive Sub-tabs list */}
              <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200 overflow-x-auto">
                {[
                  { id: 'all' as const, label: '🔔 সকল অমিমাংসিত', count: transactions.filter(t => isPendingTransaction(t)).length },
                  { id: 'add_money' as const, label: '💰 ডিপোজিট/অ্যাড মানি', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'add_money')).length },
                  { id: 'withdraw' as const, label: '💸 ক্যাশ আউট/উইথড্র', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'withdraw')).length },
                  { id: 'transfer' as const, label: '🔄 রেমিট্যান্স/ট্রান্সফার', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'transfer')).length },
                  { id: 'loan' as const, label: '🤝 লোন ও কর্জে হাসানা', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'loan')).length },
                  { id: 'recharge' as const, label: '📱 রিচার্জ ও বিল পে', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'recharge')).length },
                  { id: 'other' as const, label: '⚙️ অন্যান্য', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'other')).length }
                ].map((ptab, idx) => (
                  <button
                    key={`${ptab.id}-${idx}`}
                    type="button"
                    onClick={() => setBankPendingFilter(ptab.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      bankPendingFilter === ptab.id
                        ? 'bg-amber-500 text-white font-black shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    <span>{ptab.label}</span>
                    {ptab.count > 0 && (
                      <span className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[8.5px] font-mono font-black animate-pulse leading-none">
                        {ptab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Transactions List */}
              <div className="space-y-3 pt-1">
                {(() => {
                  const filteredPendingTxs = transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, bankPendingFilter));

                  if (filteredPendingTxs.length === 0) {
                    return (
                      <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl text-center space-y-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
                        <h4 className="text-xs font-black text-slate-800">অভিনন্দন! কোনো পেন্ডিং আবেদন নেই</h4>
                        <p className="text-[11px] text-slate-500">এই ক্যাটাগরিতে বর্তমানে কোনো অমিমাংসিত লেনদেন বা রিকোয়েস্ট পেন্ডিং অবস্থায় নেই।</p>
                      </div>
                    );
                  }

                  return filteredPendingTxs.map((tx, idx) => {
                    // Type styling config
                    let badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
                    if (['add_money', 'deposit', 'loan_repayment'].includes(tx.type)) {
                      badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                    } else if (['cash_out', 'withdraw'].includes(tx.type)) {
                      badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
                    } else if (['telecom_recharge', 'bill_pay'].includes(tx.type)) {
                      badgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-300';
                    }

                    return (
                      <div key={`${tx.id}-${idx}`} className="bg-slate-50 border border-slate-200/90 p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-amber-400 transition text-slate-800">
                        <div className="space-y-1.5 text-left flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-black uppercase border px-2 py-0.5 rounded leading-none ${badgeColor}`}>
                              {tx.typeLabel || 'লেনদেন'}
                            </span>
                            <h4 className="text-xs font-black text-slate-900">{tx.userName}</h4>
                            <span className="text-[10px] text-slate-500 font-mono font-bold">({tx.memberId || 'N/A'})</span>
                            <span className="text-[9.5px] text-slate-500 font-mono font-bold ml-auto lg:ml-0">
                              🕒 {tx.createdAt ? new Date(tx.createdAt).toLocaleString('bn-BD') : '—'}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-700 leading-relaxed font-sans select-all">{tx.description}</p>
                          
                          {tx.billImage && (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => setPreviewImage(tx.billImage)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-[10px] font-black border border-slate-300 transition cursor-pointer"
                              >
                                <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                                🖼️ সংযুক্ত রশিদের ছবি দেখুন (Click to View Receipt)
                              </button>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500">
                            {tx.senderInfo && <div>হিসাবঃ <span className="text-slate-800 font-semibold select-all">{tx.senderInfo}</span></div>}
                            {tx.transactionId && <div>TxIDঃ <span className="text-amber-700 font-extrabold select-all">{tx.transactionId}</span></div>}
                            {tx.paymentMethod && <div>পদ্ধতিঃ <span className="text-emerald-700 font-black select-all">{tx.paymentMethod}</span></div>}
                            {tx.operator && <div>অপারেটরঃ <span className="text-indigo-700 font-bold select-all">{tx.operator}</span></div>}
                            {tx.phone && <div>নম্বরঃ <span className="text-sky-700 font-bold select-all">{tx.phone}</span></div>}
                          </div>

                          {/* Quick Copy Panel */}
                          {(() => {
                            const nums = extractNumbersFromTx(tx);
                            if (nums.length === 0) return null;
                            return (
                              <div className="bg-white border border-slate-200 p-2 rounded-xl flex flex-wrap gap-1.5 items-center text-xs mt-1">
                                <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1 shrink-0">
                                  <Copy className="w-3 h-3 text-amber-600" /> নম্বর কপিঃ
                                </span>
                                {nums.map((item, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => copyTextToClipboard(item.number, item.label)}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 border border-slate-200 rounded text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                                  >
                                    <span className="text-slate-500 text-[9.5px]">{item.label}:</span>
                                    <span className="text-emerald-700 font-extrabold select-all">{item.number}</span>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 border-t lg:border-t-0 border-slate-200/80 pt-3 lg:pt-0">
                          <div className="text-left lg:text-right">
                            <span className="text-sm font-black font-mono text-amber-700 block">৳ {(tx.amount || 0).toLocaleString('bn-BD')} BDT</span>
                            <span className="text-[9px] text-slate-500 font-extrabold">পেন্ডিং আবেদন</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleApproveTransaction(tx)}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-md hover:scale-103 active:scale-97"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> অনুমোদন করুন
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectTransaction(tx.id)}
                              className="px-3 py-2 bg-slate-200 hover:bg-rose-600 hover:text-white text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer hover:scale-103 active:scale-97"
                            >
                              বাতিল করুন
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTxModal(tx)}
                              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition cursor-pointer hover:scale-103 active:scale-97"
                            >
                              ✏️ এডিট
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm('আপনি কি এই লেনদেনটি চিরতরে মুছে ফেলতে (DELETE) চান?')) {
                                  try {
                                    setLoading(true);
                                    await deleteDoc(doc(db, 'transactions', tx.id!));
                                    alert('লেনদেনটি স্থায়ীভাবে মুছে ফেলা হয়েছে!');
                                  } catch (err: any) {
                                    alert('ডিলেট করতে সমস্যা হয়েছে: ' + err.message);
                                  } finally {
                                    setLoading(false);
                                  }
                                }
                              }}
                              className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                              🗑️ ডিলেট
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>



            {/* Manual Banker Cash Balance Voucher Form (ম্যানুয়াল ব্যাংকার ক্যাশ ব্যালেন্স ভাউচার) */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                const formData = new FormData(e.currentTarget);
                const targetUid = formData.get('memUid') as string;
                const flowDirection = formData.get('flowDirection') as string || 'credit';
                const amount = parseFloat(formData.get('flowAmt') as string);
                const note = formData.get('flowNote') as string || 'অ্যাডমিন ভাউচার এডজাস্টমেন্ট';

                if (!targetUid || isNaN(amount) || amount <= 0) {
                  alert('দয়া করে সঠিক মেম্বার এবং ধনাত্মক টাকার পরিমাণ লিখুন!');
                  return;
                }

                const targetUser = users.find(u => u.uid === targetUid);
                if (!targetUser) {
                  alert('মেম্বার খুঁজে পাওয়া যায়নি!');
                  return;
                }

                const currentBal = Number(targetUser.balance !== undefined ? targetUser.balance : (targetUser as any).mainBalance) || Number((targetUser as any).mainBalance) || 0;
                let finalBal = currentBal;
                let txType = 'deposit';
                let txLabel = 'ক্যাশ ভাউচার যোগ';
                let paymentMethod = 'Software Banker Voucher';
                let description = '';
                let notifTitle = '';
                let notifBody = '';

                if (flowDirection === 'debit') {
                  finalBal = Math.max(0, currentBal - amount);
                  txType = 'withdraw';
                  txLabel = 'ক্যাশ ভাউচার কর্তন';
                  paymentMethod = 'Software Banker Debit Voucher';
                  description = `এডমিন প্যানেল কর্তৃক ম্যানুয়াল ডেবিট ভাউচার চার্জ কর্তন। সমন্বয় নোট: ${note}। পূর্বের ব্যালেন্সঃ ৳${currentBal} | নতুন ব্যালেন্সঃ ৳${finalBal}।`;
                  notifTitle = '⚠️ ভাউচার অনুযায়ী ব্যালেন্স বিয়োগ করা হয়েছে';
                  notifBody = `আপনার ওয়ালেট থেকে ৳${amount.toLocaleString('bn-BD')} টাকা সমন্বয়/কর্তন করা হয়েছে। বর্তমান নতুন ব্যালেন্স ৳${finalBal.toLocaleString('bn-BD')} টাকা।${note ? `\n\nসমন্বয় নোট: ${note}` : ''}`;
                } else {
                  finalBal = currentBal + amount;
                  txType = 'deposit';
                  txLabel = 'ক্যাশ ভাউচার যোগ';
                  paymentMethod = 'Software Banker Credit Voucher';
                  description = `এডমিন প্যানেল কর্তৃক ম্যানুয়াল ক্রেডিট ভাউচার ক্যাশ যোগ। সমন্বয় নোট: ${note}। পূর্বের ব্যালেন্সঃ ৳${currentBal} | নতুন ব্যালেন্সঃ ৳${finalBal}।`;
                  notifTitle = '🟢 ওয়ালেটে ভাউচার ক্যাশ ব্যালেন্স যোগ হয়েছে!';
                  notifBody = `আপনার ওয়ালেটে ৳${amount.toLocaleString('bn-BD')} টাকা ক্যাশ জমা ভাউচার যুক্ত করা হয়েছে। বর্তমান নতুন ব্যালেন্স ৳${finalBal.toLocaleString('bn-BD')} টাকা।${note ? `\n\nসমন্বয় নোট: ${note}` : ''}`;
                }

                await updateDoc(doc(db, 'users', targetUser.uid), { balance: finalBal, mainBalance: finalBal });

                await addDoc(collection(db, 'transactions'), {
                  id: `tx-voucher-${Date.now()}`,
                  userId: targetUser.uid,
                  userName: targetUser.name,
                  memberId: targetUser.memberId,
                  type: txType,
                  typeLabel: txLabel,
                  amount: amount,
                  status: 'success',
                  createdAt: new Date().toISOString(),
                  paymentMethod: paymentMethod,
                  description: description
                });

                await addDoc(collection(db, 'user_notifications'), {
                  userId: targetUser.uid,
                  memberId: targetUser.memberId,
                  title: notifTitle,
                  body: notifBody,
                  category: flowDirection === 'credit' ? 'deposit' : 'withdraw',
                  type: flowDirection === 'credit' ? 'deposit' : 'withdraw',
                  amount: amount,
                  isPersonal: true,
                  read: false,
                  createdAt: new Date().toISOString()
                });

                alert(`সফলভাবে সদস্য ${targetUser.name}-এর ব্যালেন্স সমন্বয় সম্পন্ন হয়েছে।`);
                e.currentTarget.reset();
              } catch (err) {
                console.error("Error processing banker voucher:", err);
                alert('ভাউচার অনুমোদন করতে সমস্যা হয়েছে!');
              } finally {
                setLoading(false);
              }
            }} className="bg-white border border-slate-200 rounded-3xl p-6 text-left space-y-4 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                🏦 ম্যানুয়াল ব্যাংকার ক্যাশ ব্যালেন্স ভাউচার (Banker Cash Flow Voucher)
              </h3>
              <p className="text-xs text-slate-500">বিশেষ কোনো ক্যাশ ডিপোজিট বা চার্জ কাটার ক্ষেত্রে সরাসরি ব্যাংক ভাউচারের ন্যায় ওয়ালেট ম্যানুয়ালি ডেবিট অথবা ক্রেডিট করতে ভাউচার তৈরি করুন।</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">সমবায় সদস্য বা মেম্বার আইডি</label>
                  <select name="memUid" required className="w-full bg-white border border-slate-200 text-xs text-slate-900 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold">
                    <option value="">সদস্য নির্বাচন করুন...</option>
                    {users.map((u, idx) => (
                      <option key={`${u.uid}-${idx}`} value={u.uid}>
                        {u.name} ({u.memberId || 'N/A'}) - ৳{u.balance || 0}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">দিকনির্দেশনা (Credit vs Debit)</label>
                  <select name="flowDirection" required className="w-full bg-white border border-slate-200 text-xs text-slate-900 p-2.5 rounded-xl outline-none font-bold focus:ring-2 focus:ring-emerald-500">
                    <option value="credit">🟢 ওয়ালেট ব্যালেন্স যোগ করুন (Credit Account)</option>
                    <option value="debit">🔴 ওয়ালেট ব্যালেন্স বিয়োগ করুন (Debit Account)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">টাকার পরিমাণ (Voucher Amount)</label>
                  <input
                    type="number"
                    name="flowAmt"
                    required
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-900 font-mono outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    placeholder="যেমন: 1000"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-extrabold text-slate-600">সমন্বয়ের স্পষ্ট কারণ বা ভাউচার রেফারেন্স নোট (Voucher Reference notes)</label>
                <input
                  type="text"
                  name="flowNote"
                  required
                  className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="যেমন: ক্যাশ ডিপোজিট বা ভুল ট্রানজেকশন চার্জ রিফান্ড"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all hover:scale-102 active:scale-97 cursor-pointer shadow-sm"
                >
                  ক্যাশ ব্যালেন্স ভাউচার অনুমোদন করুন
                </button>
              </div>
            </form>

            {/* 💸 মেম্বার বোনাস ও চার্জ কর্তন কেন্দ্র (Admin Member Bonus & Debit Panel) */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                const formData = new FormData(e.currentTarget);
                const targetUid = formData.get('bonusUid') as string;
                const amount = parseFloat(formData.get('bonusAmt') as string);
                const reason = formData.get('bonusReason') as string || 'বিশেষ উৎসব বা কার্যকারিতা বোনাস';
                const actionType = formData.get('actionType') as string || 'bonus';

                if (!targetUid || isNaN(amount) || amount <= 0) {
                  alert('দয়া করে সঠিক মেম্বার এবং ধনাত্মক টাকার পরিমাণ লিখুন!');
                  return;
                }

                const targetUser = users.find(u => u.uid === targetUid);
                if (!targetUser) {
                  alert('মেম্বার খুঁজে পাওয়া যায়নি!');
                  return;
                }

                const currentBal = targetUser.balance || 0;
                let finalBal = currentBal;
                let txType = 'deposit';
                let txLabel = 'অ্যাডমিন বোনাস';
                let paymentMethod = 'Software Admin Bonus';
                let description = '';
                let notifTitle = '';
                let notifBody = '';

                if (actionType === 'deduct') {
                  finalBal = Math.max(0, currentBal - amount);
                  txType = 'withdraw';
                  txLabel = 'অ্যাডমিন চার্জ কর্তন';
                  paymentMethod = 'Software Admin Debit';
                  description = `এডমিন প্যানেল কর্তৃক বিশেষ চার্জ কর্তন। কর্তন নোট: ${reason}। পূর্বের ব্যালেন্সঃ ৳${currentBal} | নতুন ব্যালেন্সঃ ৳${finalBal}।`;
                  notifTitle = '⚠️ অ্যাকাউন্ট থেকে টাকা কেটে নেওয়া হয়েছে';
                  notifBody = `আপনার পূর্বে ওয়ালেট ব্যালেন্স ছিল ৳${currentBal.toLocaleString('bn-BD')} টাকা। বর্তমান -৳${amount.toLocaleString('bn-BD')} টাকা কর্তন করায় আপনার সর্বমোট নতুন ব্যালেন্স ৳${finalBal.toLocaleString('bn-BD')} টাকা।${reason ? `\n\nকারণ/নোট: ${reason}` : ''}`;
                } else {
                  finalBal = currentBal + amount;
                  txType = 'deposit';
                  txLabel = 'অ্যাডমিন বোনাস';
                  paymentMethod = 'Software Admin Bonus';
                  description = `এডমিন প্যানেল কর্তৃক বিশেষ বোনাস প্রদান। বোনাস নোট: ${reason}। পূর্বের ব্যালেন্সঃ ৳${currentBal} | নতুন ব্যালেন্সঃ ৳${finalBal}।`;
                  notifTitle = '🎉 বিশেষ বোনাস ব্যালেন্স যুক্ত হয়েছে!';
                  notifBody = `আপনার পূর্বে ওয়ালেট ব্যালেন্স ছিল ৳${currentBal.toLocaleString('bn-BD')} টাকা। বর্তমান +৳${amount.toLocaleString('bn-BD')} টাকা বোনাস প্রদান করায় আপনার সর্বমোট নতুন ব্যালেন্স ৳${finalBal.toLocaleString('bn-BD')} টাকা।${reason ? `\n\nবোনাস নোট: ${reason}` : ''}`;
                }

                // Update Firestore balance
                await updateDoc(doc(db, 'users', targetUser.uid), { balance: finalBal, mainBalance: finalBal });

                // Create Transaction Log
                await addDoc(collection(db, 'transactions'), {
                  id: `tx-${actionType}-${Date.now()}`,
                  userId: targetUser.uid,
                  userName: targetUser.name,
                  memberId: targetUser.memberId,
                  type: txType,
                  typeLabel: txLabel,
                  amount: amount,
                  status: 'success',
                  createdAt: new Date().toISOString(),
                  paymentMethod: paymentMethod,
                  description: description
                });

                // Send Real-time Push Notification
                await addDoc(collection(db, 'user_notifications'), {
                  userId: targetUser.uid,
                  memberId: targetUser.memberId,
                  title: notifTitle,
                  body: notifBody,
                  category: actionType === 'add' ? 'bonus' : 'fine',
                  type: actionType === 'add' ? 'bonus' : 'fine',
                  amount: amount,
                  isPersonal: true,
                  read: false,
                  createdAt: new Date().toISOString()
                });

                if (actionType === 'deduct') {
                  alert(`সফলভাবে সদস্য ${targetUser.name}-এর অ্যাকাউন্ট থেকে ৳${amount} কেটে নেওয়া হয়েছে এবং নোটিফিকেশন পাঠানো হয়েছে।`);
                } else {
                  alert(`অভিনন্দন! সদস্য ${targetUser.name}-কে সফলভাবে ৳${amount} বোনাস প্রদান করা হয়েছে এবং নোটিফিকেশন পাঠানো হয়েছে।`);
                }
                e.currentTarget.reset();
              } catch (err) {
                console.error("Error processing admin balance action:", err);
                alert('লেনদেন সম্পন্ন করতে সমস্যা হয়েছে, দয়া করে আবার চেষ্টা করুন।');
              } finally {
                setLoading(false);
              }
            }} className="bg-white border border-slate-200 rounded-3xl p-6 text-left space-y-4 shadow-xs">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                💸 মেম্বার বোনাস ও চার্জ কর্তন কেন্দ্র (Admin Member Bonus & Charge Deduction Panel)
              </h3>
              <p className="text-xs text-slate-500">সফটওয়্যার প্যানেলের পক্ষ থেকে যেকোনো নির্বাচিত সমবায় সদস্যকে সরাসরি বিশেষ উপহার/বোনাস অর্থ প্রদান করুন অথবা তাদের অ্যাকাউন্ট থেকে যেকোনো সার্ভিস চার্জ কর্তন করুন। এর ফলে সদস্যের ব্যালেন্স আপডেট হবে এবং সাথে সাথে একটি নোটিশ ও পুশ নোটিফিকেশন সদস্যের ড্যাশবোর্ডে চলে যাবে।</p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">লেনদেনের ধরন (Transaction Type)</label>
                  <select name="actionType" required className="w-full bg-white border border-slate-200 text-xs text-slate-900 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold">
                    <option value="bonus" className="text-slate-900">🎉 বোনাস প্রদান (Credit/Bonus)</option>
                    <option value="deduct" className="text-slate-900">💸 ব্যালেন্স কেটে নেওয়া (Debit/Deduction)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">প্রাপক সমবায় সদস্য</label>
                  <select name="bonusUid" required className="w-full bg-white border border-slate-200 text-xs text-slate-900 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold">
                    <option value="" className="text-slate-900">সদস্য নির্বাচন করুন...</option>
                    {users.map((u, idx) => (
                      <option key={`${u.uid}-${idx}`} value={u.uid} className="text-slate-900">
                        {u.name} ({u.memberId || 'N/A'}) - ৳{u.balance || 0}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">টাকার পরিমাণ (Amount)</label>
                  <input
                    type="number"
                    name="bonusAmt"
                    required
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-900 font-mono outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                    placeholder="যেমন: 50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">কারণ / নোট (Reason/Notes)</label>
                  <input
                    type="text"
                    name="bonusReason"
                    required
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="যেমন: রেফারেল বোনাস বা অ্যাকাউন্ট চার্জ কর্তন"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-6 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-xl text-xs font-bold transition-all hover:scale-102 active:scale-97 cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  লেনদেন সম্পন্ন করুন ও নোটিফিকেশন পাঠান
                </button>
              </div>
            </form>

            {/* Cooperative Configuration & Rates */}
            <form onSubmit={handleSaveGlobalRulesAndFees} className="bg-white border border-slate-200 rounded-3xl p-6 text-left space-y-4 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                ⚙️ কো-অপারেটিভ লোন ইন্টারেস্ট ও রেমিট্যান্স ফি রেট এবং গ্লোবাল টেক্সট
              </h3>
              <p className="text-xs text-slate-500">এখান থেকে ঋণ ও রেমিট্যান্স পার্সেন্টেজ এবং অ্যাপের সার্বজনীন ছোট-বড় সকল লেখা মাইক্রো-ম্যানেজমেন্ট করতে পারবেন।</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-600">কো-অপারেটিভ লোন ইন্টারেস্ট রেট (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfgCoopInterestRate}
                    onChange={(e) => setCfgCoopInterestRate(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-900 font-mono outline-none font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-600">রেমিট্যান্স কমিশন ফি (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfgRemittanceFeePercent}
                    onChange={(e) => setCfgRemittanceFeePercent(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-900 font-mono outline-none font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all hover:scale-102 active:scale-97 cursor-pointer shadow-sm"
                >
                  গ্লোবাল নিয়ম ও ফি রেট সংরক্ষণ করুন
                </button>
              </div>
            </form>
            {/* Header Title Card */}
            <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left text-slate-800 shadow-xs">
              <h2 className="text-base sm:text-lg font-black text-emerald-600 flex items-center gap-2">
                💳 ডিজিটাল ব্যাংকিং, এটিএম ও ভার্চুয়াল ডেবিট কার্ড এডমিন
              </h2>
              <p className="text-xs text-slate-500 mt-1">সব সমবায় সদস্যদের জন্য ইস্যুকৃত ভার্চুয়াল ডেবিট ও ক্রেডিট প্রি-পেইড কার্ড ফ্রিজ, আনফ্রিজ এবং এটিএম দৈনিক লিমিট নির্ধারণ করুন।</p>
            </div>

            {/* Al Mayadin Payment Method & Import Controls Box */}
            <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left shadow-xs space-y-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    🏦 AMB পেমেন্ট মেথড গেটওয়ে ও অ্যাকাউন্ট সেটিংস ম্যানেজার
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    সদস্যদের ডিপোজিট ও উইথড্র পেইজের মোবাইল ব্যাংকিং, বাংলাদেশ ব্যাংক সমূহের অ্যাকাউন্ট এবং আন্তর্জাতিক প্রবাসী ব্যাংকের তথ্য ও সচল অবস্থা এখান থেকে নিয়ন্ত্রণ করুন।
                  </p>
                </div>
                {(!appConfig.paymentBanks || appConfig.paymentBanks.length === 0) && (
                  <button
                    type="button"
                    onClick={handleInitDefaultBanks}
                    className="px-4 py-2.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-2xl cursor-pointer transition-all active:scale-95 flex items-center gap-2 shrink-0 shadow-xs"
                  >
                    ⚡ ডিফল্ট ব্যাংকিং মেথডসমূহ ইমপোর্ট করুন
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

            {/* 1. ADD MONEY TAB SECTION (amb_to_amb) */}
            {adminBankBoxTab === 'amb_to_amb' && (
              <div className="space-y-6 animate-fade-in">
                {/* 🌟 USER DASHBOARD MATCHING SUB-NAVIGATOR FOR ADD MONEY */}
                <div className="bg-[#0B1528] border border-slate-800 p-3 rounded-3xl shadow-xl text-left space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1 pt-1">
                    <div>
                      <h4 className="text-xs font-black text-white flex items-center gap-2">
                        <PlusCircle className="w-4 h-4 text-emerald-400" />
                        এড মানি পেমেন্ট মেথড ও ব্যাংক এডমিন ম্যানেজার (Add Money Gateways Control)
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        ইউজার ড্যাশবোর্ডের হুবহু 3টি চ্যানেল। মেম্বারদের ওয়ালেটে টাকা জমার মোবাইল ব্যাংকিং (বিকাশ/নগদ/রকেট), বাংলাদেশি ব্যাংকিং ও প্রবাসী ব্যাংকসমূহ নিয়ন্ত্রণ করুন।
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          openAddBankModal(adminAddMoneySubTab === 'abroad' ? 'foreign_bank' : adminAddMoneySubTab === 'mobile_bank' ? 'mobile_bank' : 'local_bank');
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-full transition cursor-pointer flex items-center gap-1 shadow-md active:scale-95"
                      >
                        ➕ নতুন ব্যাংক / মেথড যোগ করুন
                      </button>
                    </div>
                  </div>

                  {/* 3 Channels Navigation Bar */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
                    {[
                      { id: 'mobile_bank' as const, label: 'লোকাল মোবাইল', icon: '📱', count: 4 + (appConfig.paymentBanks || []).filter(b => b.isMobileBank === true).length },
                      { id: 'bank_wallet' as const, label: 'ব্যাংক ডিপোজিট', icon: '🏛️', count: (appConfig.paymentBanks || []).filter(b => !b.isInternational && !b.isMobileBank).length },
                      { id: 'abroad' as const, label: 'বিদেশি ব্যাংক', icon: '🌍', count: (appConfig.paymentBanks || []).filter(b => b.isInternational === true).length }
                    ].map((ch) => {
                      const isActive = adminAddMoneySubTab === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setAdminAddMoneySubTab(ch.id)}
                          className={`py-3 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 scale-[1.02]'
                              : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-sm">{ch.icon}</span>
                          <span>{ch.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                            isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {ch.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 🌟 PROMINENT ADD/EDIT BANK METHOD FORM BOX */}
                {showAddBank && (
                  <div id="admin-add-bank-form-box" className="bg-white border-2 border-emerald-500 p-6 rounded-3xl text-left space-y-4 shadow-2xl ring-4 ring-emerald-100/80 animate-fade-in scroll-mt-24">
                    <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                      <div>
                        <h5 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                          🏦 {editingBank ? 'পেমেন্ট মেথড এডিট / পরিবর্তন খাতা' : 'নতুন পেমেন্ট মেথড ও ব্যাংক অ্যাকাউন্ট ফরম'}
                        </h5>
                        <p className="text-xs text-slate-500 mt-0.5">মোবাইল ব্যাংকিং (MFS), বাংলাদেশি লোকাল ব্যাংক অথবা আন্তর্জাতিক প্রবাসী ব্যাংক অ্যাকাউন্ট যোগ করুন</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBank(null);
                          setShowAddBank(false);
                        }}
                        className="text-slate-400 hover:text-red-500 font-extrabold text-sm px-3 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                      >
                        ✕ বন্ধ করুন
                      </button>
                    </div>

                    <form onSubmit={handleSaveBank} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Category Selector */}
                      <div className="md:col-span-3 bg-slate-50 p-3.5 rounded-2.5xl border border-slate-200 space-y-2">
                        <span className="text-xs font-black text-slate-800 block">1. অ্যাকাউন্ট ধরন ও ক্যাটাগরি সিলেক্ট করুনঃ</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEbAccountType('mobile_bank');
                              setEbIsMobileBank(true);
                              setEbIsInternational(false);
                              setEbAcronym('MFS');
                              setEbBgClass('bg-pink-50 hover:bg-pink-100 border-pink-200');
                              setEbTextClass('text-pink-800');
                              setEbLogoBgClass('bg-pink-200');
                            }}
                            className={`px-3.5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              ebAccountType === 'mobile_bank' || ebIsMobileBank
                                ? 'bg-pink-600 text-white shadow-md scale-[1.02]'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            📱 লোকাল মোবাইল ব্যাংকিং (MFS)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEbAccountType('local_bank');
                              setEbIsMobileBank(false);
                              setEbIsInternational(false);
                              setEbAcronym('DB');
                              setEbBgClass('bg-blue-50 hover:bg-blue-100 border-blue-200');
                              setEbTextClass('text-blue-700');
                              setEbLogoBgClass('bg-blue-100');
                            }}
                            className={`px-3.5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              ebAccountType === 'local_bank' && !ebIsMobileBank && !ebIsInternational
                                ? 'bg-emerald-600 text-white shadow-md scale-[1.02]'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            🇧🇩 বাংলাদেশি ব্যাংক (Local Bank)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEbAccountType('foreign_bank');
                              setEbIsMobileBank(false);
                              setEbIsInternational(true);
                              setEbAcronym('INTL');
                              setEbBgClass('bg-indigo-50 hover:bg-indigo-100 border-indigo-200');
                              setEbTextClass('text-indigo-800');
                              setEbLogoBgClass('bg-indigo-200');
                            }}
                            className={`px-3.5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              ebAccountType === 'foreign_bank' || (ebIsInternational && !ebIsMobileBank)
                                ? 'bg-indigo-600 text-white shadow-md scale-[1.02]'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            🌐 আন্তর্জাতিক / প্রবাসী ব্যাংক (Foreign Bank)
                          </button>
                        </div>
                      </div>

                      {/* Select Theme Preset */}
                      <div className="md:col-span-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
                        <span className="text-[10px] font-extrabold text-indigo-700 block uppercase tracking-wider">2. কার্ড রঙ ও ব্র‍্যান্ডিং থিম সিলেক্ট করুন</span>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {[
                            { label: 'bKash / Mobile (গোলাপী)', bg: 'bg-pink-50 hover:bg-pink-100 border-pink-200', text: 'text-pink-800', logoBg: 'bg-pink-200', acr: 'MFS' },
                            { label: 'Dutch Bangla (নীল)', bg: 'bg-blue-50 hover:bg-blue-100 border-blue-150', text: 'text-blue-700', logoBg: 'bg-blue-100', acr: 'DB' },
                            { label: 'Sonali Bank (সবুজ)', bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-150', text: 'text-emerald-700', logoBg: 'bg-emerald-100', acr: 'SB' },
                            { label: 'Islami Bank (টিয়া)', bg: 'bg-teal-50 hover:bg-teal-100 border-teal-150', text: 'text-teal-700', logoBg: 'bg-teal-100', acr: 'IB' },
                            { label: 'Western / Int\'l (বেগুনি)', bg: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200', text: 'text-indigo-800', logoBg: 'bg-indigo-200', acr: 'WU' }
                          ].map((preset, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setEbBgClass(preset.bg);
                                setEbTextClass(preset.text);
                                setEbLogoBgClass(preset.logoBg);
                                setEbAcronym(preset.acr);
                              }}
                              className={`p-2.5 text-[10px] font-bold border rounded-xl flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all ${
                                ebBgClass === preset.bg ? 'ring-2 ring-indigo-500 scale-102 border-transparent bg-white shadow-xs' : 'border-slate-200 hover:bg-white'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${preset.logoBg} ${preset.text}`}>
                                {preset.acr}
                              </div>
                              <span>{preset.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Bank / Method Name */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          {ebIsMobileBank ? 'মোবাইল ব্যাংক/ওয়ালেটের নাম (যেমন: বিকাশ মার্চেন্ট / নগদ এজেন্ট / CellFin)' : ebIsInternational ? 'ব্যাংকের নাম (যেমন: SAUDI NATIONAL BANK)' : 'ব্যাংকের নাম (যেমন: Dutch-Bangla Bank PLC.)'}
                        </label>
                        <input
                          type="text"
                          value={ebName}
                          onChange={(e) => setEbName(e.target.value)}
                          placeholder={ebIsMobileBank ? 'বিকাশ মার্চেন্ট' : ebIsInternational ? 'SAUDI NATIONAL BANK (SNB)' : 'Dutch-Bangla Bank PLC.'}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>

                      {/* Holder Name */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-indigo-900 block">
                          হিসাবধারীর নাম (Account / Wallet Holder Name)
                        </label>
                        <input
                          type="text"
                          value={ebHolder}
                          onChange={(e) => setEbHolder(e.target.value.toUpperCase())}
                          placeholder="BUSINESS NETWORK BANGLADESH"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase bg-white"
                        />
                      </div>

                      {/* Account / Wallet Number */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-indigo-900 block">
                          {ebIsMobileBank ? 'মোবাইল নম্বর / ওয়ালেট আইডেন্টিটি' : 'হিসাব নম্বর / কার্ড নম্বর (Account No)'}
                        </label>
                        <input
                          type="text"
                          value={ebAccNum}
                          onChange={(e) => setEbAccNum(e.target.value)}
                          placeholder={ebIsMobileBank ? '01700000000' : '2441580395850'}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                        />
                      </div>

                      {/* Short Acronym */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">সংক্ষিপ্ত কোড (Acronym - ঐচ্ছিক)</label>
                        <input
                          type="text"
                          value={ebAcronym}
                          onChange={(e) => setEbAcronym(e.target.value)}
                          placeholder={ebIsMobileBank ? 'BK' : ebIsInternational ? 'SNB' : 'DB'}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                        />
                      </div>

                      {/* Branch / Type */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">শাখা / অ্যাকাউন্ট টাইপ (Branch / Wallet Type - ঐচ্ছিক)</label>
                        <input
                          type="text"
                          value={ebBranch}
                          onChange={(e) => setEbBranch(e.target.value)}
                          placeholder={ebIsMobileBank ? 'পার্সোনাল / মার্চেন্ট' : 'হেমায়েতপুর শাখা'}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>

                      {/* Routing Number */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">রাউটিং নম্বর (Routing Code - ঐচ্ছিক)</label>
                        <input
                          type="text"
                          value={ebRoutingNum}
                          onChange={(e) => setEbRoutingNum(e.target.value)}
                          placeholder="090261545"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                        />
                      </div>

                      {/* IBAN for International */}
                      {ebIsInternational && (
                        <>
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-[11px] font-bold text-indigo-900 block">আইবান নম্বর (IBAN Code - ঐচ্ছিক)</label>
                            <input
                              type="text"
                              value={ebIban}
                              onChange={(e) => setEbIban(e.target.value)}
                              placeholder="SA50 8000 0640 6080 1788 1869"
                              className="w-full px-3 py-2 rounded-xl border border-indigo-300 text-xs font-extrabold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-indigo-50/40"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-indigo-900 block">দেশ ও কারেন্সি (Country & Currency)</label>
                            <select
                              value={ebCurrency}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEbCurrency(val);
                                const countryMap: Record<string, string> = {
                                  SAR: 'সৌদি আরব',
                                  AED: 'দুবাই (সংযুক্ত আরব আমিরাত)',
                                  QAR: 'কাতার',
                                  KWD: 'কুয়েত',
                                  OMR: 'ওমান',
                                  BHD: 'বাহরাইন',
                                  MYR: 'মালয়েশিয়া',
                                  SGD: 'সিঙ্গাপুর',
                                  USD: 'আমেরিকা (USA)',
                                  EUR: 'ইউরোপ (EU)',
                                  GBP: 'যুক্তরাজ্য (UK)'
                                };
                                if (countryMap[val]) {
                                  setEbCountry(countryMap[val]);
                                }
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-indigo-300 text-xs font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                              <option value="SAR">🇸🇦 সৌদি আরব (SAR - রিয়াল)</option>
                              <option value="AED">🇦🇪 দুবাই / UAE (AED - দিরহাম)</option>
                              <option value="QAR">🇶🇦 কাতার (QAR - রিয়াল)</option>
                              <option value="KWD">🇰🇼 কুয়েত (KWD - দিনার)</option>
                              <option value="OMR">🇴🇲 ওমান (OMR - রিয়াল)</option>
                              <option value="BHD">🇧🇭 বাহরাইন (BHD - দিনার)</option>
                              <option value="MYR">🇲🇾 মালয়েশিয়া (MYR - রিঙ্গিত)</option>
                              <option value="SGD">🇸🇬 সিঙ্গাপুর (SGD - ডলার)</option>
                              <option value="USD">🇺🇸 আমেরিকা (USD - ডলার)</option>
                              <option value="EUR">🇪🇺 ইউরোপ (EUR - ইউরো)</option>
                              <option value="GBP">🇬🇧 যুক্তরাজ্য (GBP - পাউন্ড)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-indigo-900 block">দেশের নাম (Country Name)</label>
                            <input
                              type="text"
                              value={ebCountry}
                              onChange={(e) => setEbCountry(e.target.value)}
                              placeholder="সৌদি আরব"
                              className="w-full px-3 py-2 rounded-xl border border-indigo-300 text-xs font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-amber-900 block">ট্রান্সফার চার্জ / ফি ({ebCurrency})</label>
                            <input
                              type="number"
                              step="any"
                              value={ebTransferFee}
                              onChange={(e) => setEbTransferFee(e.target.value)}
                              placeholder="15"
                              className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-amber-50/30 font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 block">কাস্টম এক্সচেঞ্জ রেট BDT (ঐচ্ছিক)</label>
                            <input
                              type="number"
                              step="any"
                              value={ebCustomRate}
                              onChange={(e) => setEbCustomRate(e.target.value)}
                              placeholder="লাইভ রেট ব্যবহার করতে ফাঁকা রাখুন"
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                            />
                          </div>
                        </>
                      )}

                      {/* QR Code Scan Photo Upload */}
                      <div className="md:col-span-3 bg-indigo-50/70 p-4 rounded-2.5xl border border-indigo-200/90 space-y-3">
                        <label className="text-xs font-black text-indigo-950 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">📷 অ্যাকাউন্ট কিউআর কোড বা পেপার স্ক্যানার ছবি (Bank QR Scan Image)</span>
                          <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 px-2 py-0.5 rounded-full font-sans">গ্যালারি থেকে সিলেক্ট করুন</span>
                        </label>
                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                          মোবাইল ব্যাংকিং অথবা ব্যাংক একাউন্টের কিউআর কোড স্ক্যানার ছবি আপলোড করুন। ইউজার পেমেন্ট করার সময় স্ক্যান করে টাকা পাঠাতে পারবে।
                        </p>
                        
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <label className="flex-1 cursor-pointer bg-white hover:bg-indigo-50/40 border-2 border-dashed border-indigo-300 hover:border-indigo-500 p-3.5 rounded-2xl flex items-center justify-center gap-2 text-indigo-800 text-xs font-black transition group shadow-xs">
                            <span className="text-lg group-hover:scale-110 transition-transform">🖼️</span>
                            <span>গ্যালারি থেকে ছবি আপলোড করুন</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleBankQrUpload} 
                              className="hidden" 
                            />
                          </label>
                          
                          {ebQrCodeUrl && (
                            <button 
                              type="button" 
                              onClick={() => setEbQrCodeUrl('')}
                              className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 font-extrabold text-xs rounded-2xl transition flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                            >
                              ❌ ছবি রিমুভ করুন
                            </button>
                          )}
                        </div>

                        {ebQrCodeUrl && (
                          <div className="bg-white p-3.5 rounded-2xl border border-indigo-200 max-w-sm space-y-2">
                            <span className="text-[10px] text-indigo-900 font-extrabold block uppercase tracking-wider">📷 প্রিভিউ</span>
                            <img 
                              src={ebQrCodeUrl} 
                              alt="Bank QR Preview" 
                              className="max-h-56 rounded-xl object-contain mx-auto border border-slate-150 shadow-sm" 
                            />
                          </div>
                        )}
                      </div>

                      {/* Active checkbox */}
                      <div className="md:col-span-3 flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="ebActive"
                          checked={ebActive}
                          onChange={(e) => setEbActive(e.target.checked)}
                          className="w-4.5 h-4.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                        />
                        <label htmlFor="ebActive" className="text-xs font-black text-slate-800 cursor-pointer">এই পেমেন্ট মেথডটি সদস্যদের জন্য সচল (Active) রাখুন</label>
                      </div>

                      {/* Submit / Cancel Buttons */}
                      <div className="md:col-span-3 flex items-center justify-end gap-3 border-t border-slate-200/60 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBank(null);
                            setShowAddBank(false);
                          }}
                          className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-300 transition active:scale-95"
                        >
                          বাতিল (Cancel)
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl cursor-pointer transition active:scale-95 shadow-md flex items-center gap-1 disabled:opacity-50"
                        >
                          💾 সেভ ও কনফার্ম করুন
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* SUB-TAB 1: LOCAL MOBILE BANKING (MFS) */}
                {adminAddMoneySubTab === 'mobile_bank' && (
                  <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left shadow-xs space-y-4 animate-fade-in">
                    <form onSubmit={handleSaveMfsGateways} className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            📱 এড মানি - মোবাইল ব্যাংকিং (MFS) গেটওয়ে ম্যানেজার
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">বিকাশ, নগদ, রকেট ও উপায় মোবাইল ব্যাংক অ্যাকাউন্ট অন/অফ এবং সরাসরি পার্সোনাল/মার্চেন্ট নম্বর আপডেট করুন</p>
                        </div>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-2 bg-slate-900 text-white text-xs font-extrabold rounded-2xl hover:bg-slate-800 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          💾 মোবাইল ব্যাংক গেটওয়ে সেভ করুন
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* bKash */}
                        <div className="bg-pink-50/60 p-4 rounded-2.5xl border border-pink-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-pink-900 flex items-center gap-1.5">
                              <span className="w-6 h-6 rounded-full bg-pink-500 text-white flex items-center justify-center text-[10px]">ব</span>
                              বিকাশ (bKash Wallet)
                            </span>
                            <input
                              type="checkbox"
                              checked={cfgMfsBkashActive}
                              onChange={e => setCfgMfsBkashActive(e.target.checked)}
                              className="w-4 h-4 text-pink-600 rounded cursor-pointer"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-pink-800">বিকাশ অ্যাকাউন্ট নম্বর</label>
                            <input
                              type="text"
                              value={cfgMfsBkashNumber}
                              onChange={e => setCfgMfsBkashNumber(e.target.value)}
                              placeholder="01700000000"
                              className="w-full px-3 py-2 rounded-xl border border-pink-200 text-xs font-mono font-bold bg-white text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                          </div>
                        </div>

                        {/* Nagad */}
                        <div className="bg-amber-50/60 p-4 rounded-2.5xl border border-amber-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                              <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">ন</span>
                              নগদ (Nagad Wallet)
                            </span>
                            <input
                              type="checkbox"
                              checked={cfgMfsNagadActive}
                              onChange={e => setCfgMfsNagadActive(e.target.checked)}
                              className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-800">নগদ অ্যাকাউন্ট নম্বর</label>
                            <input
                              type="text"
                              value={cfgMfsNagadNumber}
                              onChange={e => setCfgMfsNagadNumber(e.target.value)}
                              placeholder="01700000000"
                              className="w-full px-3 py-2 rounded-xl border border-amber-200 text-xs font-mono font-bold bg-white text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        </div>

                        {/* Rocket */}
                        <div className="bg-purple-50/60 p-4 rounded-2.5xl border border-purple-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                              <span className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px]">র</span>
                              রকেট (Rocket Wallet)
                            </span>
                            <input
                              type="checkbox"
                              checked={cfgMfsRocketActive}
                              onChange={e => setCfgMfsRocketActive(e.target.checked)}
                              className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-purple-800">রকেট অ্যাকাউন্ট নম্বর</label>
                            <input
                              type="text"
                              value={cfgMfsRocketNumber}
                              onChange={e => setCfgMfsRocketNumber(e.target.value)}
                              placeholder="01700000000-7"
                              className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs font-mono font-bold bg-white text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        </div>

                        {/* Upay */}
                        <div className="bg-indigo-50/60 p-4 rounded-2.5xl border border-indigo-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                              <span className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">উ</span>
                              উপায় (Upay Wallet)
                            </span>
                            <input
                              type="checkbox"
                              checked={cfgMfsUpayActive}
                              onChange={e => setCfgMfsUpayActive(e.target.checked)}
                              className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-indigo-800">উপায় অ্যাকাউন্ট নম্বর</label>
                            <input
                              type="text"
                              value={cfgMfsUpayNumber}
                              onChange={e => setCfgMfsUpayNumber(e.target.value)}
                              placeholder="01700000000"
                              className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-xs font-mono font-bold bg-white text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    </form>

                    {/* Extra custom Mobile Wallets added by Admin */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">
                          📱 এডমিন কর্তৃক যুক্ত অতিরিক্ত মোবাইল ব্যাংক / ওয়ালেটসমূহ ({(appConfig.paymentBanks || []).filter(b => b.isMobileBank === true).length})
                        </span>
                        <button
                          type="button"
                          onClick={() => openAddBankModal('mobile_bank')}
                          className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-black rounded-xl cursor-pointer transition shadow-xs flex items-center gap-1"
                        >
                          ➕ নতুন মোবাইল ওয়ালেট যোগ করুন
                        </button>
                      </div>

                      {(appConfig.paymentBanks || []).filter(b => b.isMobileBank === true).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(appConfig.paymentBanks || []).filter(b => b.isMobileBank === true).map((b) => (
                            <div key={b.id} className="p-3.5 rounded-2xl border border-pink-200 bg-pink-50/40 space-y-2 text-left">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-xl bg-pink-200 text-pink-900 font-black text-xs flex items-center justify-center font-mono">
                                    {b.acronym || 'MFS'}
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-black text-slate-900">{b.name}</h5>
                                    <span className="text-[10px] text-pink-700 font-bold font-mono">{b.accNum}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditBankModal(b)}
                                    className="px-2.5 py-1 bg-white border border-slate-200 text-blue-700 text-[10px] font-black rounded-lg hover:bg-slate-50 cursor-pointer"
                                  >
                                    ✏️ এডিট
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBank(b.id)}
                                    className="px-2.5 py-1 bg-white border border-slate-200 text-red-600 text-[10px] font-black rounded-lg hover:bg-slate-50 cursor-pointer"
                                  >
                                    ❌ মুছে ফেলুন
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 font-medium italic">
                          উপরের বিকাশ, নগদ, রকেট ছাড়া অতিরিক্ত কোনো মোবাইল ওয়ালেট যুক্ত করা নেই। "নতুন মোবাইল ওয়ালেট যোগ করুন" বাটনে ক্লিক করে ইচ্ছেমতো যেকোনো ওয়ালেট যোগ করতে পারেন।
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* SUB-TAB 2: LOCAL BD BANKS */}
                {adminAddMoneySubTab === 'bank_wallet' && (
                  <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left shadow-xs space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          🏛️ এড মানি - বাংলাদেশি ব্যাংক অ্যাকাউন্ট খাতা
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">ডাচ বাংলা, সোনালী, ইসলামী ব্যাংক সহ সকল লোকাল ব্যাংক অ্যাকাউন্ট এডিট বা নতুন যোগ করুন</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openAddBankModal('local_bank')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-2xl active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        ➕ নতুন লোকাল ব্যাংক যোগ করুন
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(appConfig.paymentBanks || []).filter(b => !b.isInternational && !b.isMobileBank).map((b) => (
                        <div key={b.id} className={`p-4 rounded-2.5xl border transition-all ${b.bgClass || 'bg-slate-50 border-slate-200'} space-y-3`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs ${b.logoBgClass || 'bg-slate-200'} ${b.textClass || 'text-slate-700'}`}>
                                {b.acronym || 'BK'}
                              </div>
                              <div>
                                <h5 className="text-xs font-black text-slate-850">{b.name}</h5>
                                <span className={`text-[9px] px-2 py-0.2 rounded-full font-bold ${b.active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                                  {b.active !== false ? '🟢 সক্রিয় (Active)' : '🔴 বন্ধ (Inactive)'}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                const currentBanks = appConfig.paymentBanks || [];
                                const updatedBanks = currentBanks.map(item => item.id === b.id ? { ...item, active: item.active === false } : item);
                                const updatedConfig = { ...appConfig, paymentBanks: updatedBanks };
                                await saveAppConfig(updatedConfig);
                                onChangeConfig(updatedConfig);
                              }}
                              className="text-[10px] font-extrabold px-2.5 py-1 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 cursor-pointer"
                            >
                              {b.active !== false ? 'বন্ধ করুন' : 'সক্রিয় করুন'}
                            </button>
                          </div>

                          <div className="bg-white/80 p-3 rounded-2xl border border-slate-100 text-[11px] space-y-1 font-mono">
                            <div><span className="text-slate-500 font-sans">হিসাবধারীর নাম:</span> <strong>{b.holder}</strong></div>
                            <div><span className="text-slate-500 font-sans">হিসাব নম্বর:</span> <strong className="text-emerald-700">{b.accNum}</strong></div>
                            {b.branch && <div><span className="text-slate-500 font-sans">শাখা:</span> <span>{b.branch}</span></div>}
                            {b.routingNum && <div><span className="text-slate-500 font-sans">রাউটিং:</span> <span>{b.routingNum}</span></div>}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => openEditBankModal(b)}
                              className="px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-[10px] font-extrabold rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                            >
                              ✏️ সম্পাদনা
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBank(b.id)}
                              className="px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-[10px] font-extrabold rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                            >
                              ❌ মুছে ফেলুন
                            </button>
                          </div>
                        </div>
                      ))}
                      {(appConfig.paymentBanks || []).filter(b => !b.isInternational && !b.isMobileBank).length === 0 && (
                        <div className="col-span-1 md:col-span-2 text-center py-6 text-slate-400 font-extrabold text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          কোনো বাংলাদেশি লোকাল ব্যাংক অ্যাকাউন্ট যোগ করা নেই। "নতুন লোকাল ব্যাংক যোগ করুন" বাটনে ক্লিক করে যোগ করুন।
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUB-TAB 3: FOREIGN INTERNATIONAL BANKS */}
                {adminAddMoneySubTab === 'abroad' && (
                  <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left shadow-xs space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          🌍 এড মানি - আন্তর্জাতিক প্রবাসী ব্যাংক খাতা
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">সৌদি ন্যাশনাল ব্যাংক (SNB), দুবাই এনবিডি (ENBD) সহ আন্তর্জাতিক পেমেন্ট মেথড ও কিউআর ছবি এডিট করুন</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openAddBankModal('foreign_bank')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-2xl active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        ➕ নতুন বিদেশি ব্যাংক যোগ করুন
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(appConfig.paymentBanks || []).filter(b => b.isInternational === true).map((b) => (
                        <div key={b.id} className="p-4 rounded-2.5xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs bg-indigo-200 text-indigo-800">
                                {b.acronym || 'INT'}
                              </div>
                              <div>
                                <h5 className="text-xs font-black text-slate-850">{b.name}</h5>
                                <span className={`text-[9px] px-2 py-0.2 rounded-full font-bold ${b.active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                                  {b.active !== false ? '🟢 সক্রিয় (Active)' : '🔴 বন্ধ (Inactive)'}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                const currentBanks = appConfig.paymentBanks || [];
                                const updatedBanks = currentBanks.map(item => item.id === b.id ? { ...item, active: item.active === false } : item);
                                const updatedConfig = { ...appConfig, paymentBanks: updatedBanks };
                                await saveAppConfig(updatedConfig);
                                onChangeConfig(updatedConfig);
                              }}
                              className="text-[10px] font-extrabold px-2.5 py-1 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 cursor-pointer"
                            >
                              {b.active !== false ? 'বন্ধ করুন' : 'সক্রিয় করুন'}
                            </button>
                          </div>

                          <div className="bg-white p-3 rounded-2xl border border-indigo-100 text-[11px] space-y-1 font-mono">
                            <div><span className="text-slate-500 font-sans">Beneficiary:</span> <strong>{b.holder}</strong></div>
                            <div><span className="text-slate-500 font-sans">Account No:</span> <strong className="text-indigo-700">{b.accNum}</strong></div>
                            {b.iban && <div><span className="text-slate-500 font-sans">IBAN:</span> <strong className="text-emerald-700">{b.iban}</strong></div>}
                          </div>

                          {b.qrCodeUrl && (
                            <div className="bg-white p-2 rounded-xl border border-indigo-150 flex items-center gap-3">
                              <img src={b.qrCodeUrl} alt="QR Scanner" className="w-12 h-12 rounded-lg object-contain border border-slate-200 shrink-0" />
                              <span className="text-[10px] font-bold text-emerald-700">✅ কিউআর কোড স্ক্যান ছবি যুক্ত রয়েছে</span>
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => openEditBankModal(b)}
                              className="px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-[10px] font-extrabold rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                            >
                              ✏️ সম্পাদনা
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBank(b.id)}
                              className="px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-[10px] font-extrabold rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                            >
                              ❌ মুছে ফেলুন
                            </button>
                          </div>
                        </div>
                      ))}
                      {(appConfig.paymentBanks || []).filter(b => b.isInternational === true).length === 0 && (
                        <div className="col-span-1 md:col-span-2 text-center py-8 bg-indigo-50/50 rounded-2.5xl border-2 border-dashed border-indigo-200 space-y-3">
                          <p className="text-xs text-indigo-950 font-black">
                            🌐 সৌদি ন্যাশনাল ব্যাংক (SNB) ও দুবাই ব্যাংক (ENBD) সহ আন্তর্জাতিক গেটওয়ে যুক্ত করা হয়নি!
                          </p>
                          <button
                            type="button"
                            onClick={handleInitDefaultIntlBanks}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl cursor-pointer transition-all active:scale-95 inline-flex items-center gap-2 shadow-md"
                          >
                            ⚡ সৌদী (SNB) ও দুবাই (ENBD) প্রবাসী ব্যাংকসমূহ এডমিনে ইমপোর্ট করুন
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. SEND MONEY TAB SECTION */}
            {adminBankBoxTab === 'send_money' && (
              <div className="space-y-6 animate-fade-in">
                {/* 🌟 USER DASHBOARD MATCHING SUB-NAVIGATOR (3 Channels: Mobile Bank, BD Bank, Foreign Bank) */}
                <div className="bg-[#0B1528] border border-slate-800 p-3 rounded-3xl shadow-xl text-left space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1 pt-1">
                    <div>
                      <h4 className="text-xs font-black text-white flex items-center gap-2">
                        <Send className="w-4 h-4 text-emerald-400" />
                        সেন্ড মানি এডমিন চ্যানেল সিলেকশন (Send Money Gateways Control)
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        ইউজার ড্যাশবোর্ডের হুবহু 3টি চ্যানেল। চ্যানেল পরিবর্তন করে মোবাইল ওয়ালেট, বাংলাদেশি বা বিদেশি ব্যাংকের তথ্য এডমিন থেকে যোগ, এডিট বা আপডেট করুন।
                      </p>
                    </div>
                    <div className="bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-bold text-emerald-400 flex items-center gap-1 shrink-0">
                      ⚡ এডমিন ফুল এডিট মোড
                    </div>
                  </div>

                  {/* 3 Channels Navigation Bar (Matching User Dashboard Send Money Top Sub-nav) */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
                    {[
                      { id: 'mobile_bank' as const, label: 'মোবাইল ব্যাংক', icon: '📱', count: 4 },
                      { id: 'bank_wallet' as const, label: 'বাংলাদেশি ব্যাংক', icon: '🏛️', count: (appConfig.paymentBanks || []).filter(b => !b.isInternational).length },
                      { id: 'abroad' as const, label: 'বিদেশি ব্যাংক', icon: '🌍', count: (appConfig.paymentBanks || []).filter(b => b.isInternational).length }
                    ].map((ch) => {
                      const isActive = adminSendMoneySubTab === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setAdminSendMoneySubTab(ch.id)}
                          className={`py-3 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 scale-[1.02]'
                              : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-sm">{ch.icon}</span>
                          <span>{ch.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                            isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {ch.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* TAB 1: MOBILE BANKING */}
                {adminSendMoneySubTab === 'mobile_bank' && (
                  <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left shadow-xs space-y-4 animate-fade-in">
                    <form onSubmit={handleSaveMfsGateways} className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            📱 মোবাইল ব্যাংকিং (MFS) অ্যাকাউন্ট এডমিন কন্ট্রোল
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">বিকাশ, নগদ, রকেট ও উপায় মোবাইল ব্যাংক অ্যাকাউন্ট অন/অফ এবং সরাসরি নম্বর আপডেট করুন</p>
                        </div>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-2 bg-slate-900 text-white text-xs font-extrabold rounded-2xl hover:bg-slate-800 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          💾 MFS গেটওয়ে সেটিংস আপডেট করুন
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                        {/* bKash */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-pink-100 text-pink-700 font-black text-xs flex items-center justify-center">BK</div>
                              <span className="text-xs font-extrabold text-pink-600">বিকাশ (bKash)</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cfgMfsBkashActive}
                                onChange={(e) => setCfgMfsBkashActive(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={cfgMfsBkashNumber}
                            onChange={(e) => setCfgMfsBkashNumber(e.target.value)}
                            placeholder="বিকাশ অ্যাকাউন্ট নম্বর"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono bg-white"
                          />
                        </div>

                        {/* Nagad */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-black text-xs flex items-center justify-center">ন</div>
                              <span className="text-xs font-extrabold text-orange-600">নগদ (Nagad)</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cfgMfsNagadActive}
                                onChange={(e) => setCfgMfsNagadActive(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={cfgMfsNagadNumber}
                            onChange={(e) => setCfgMfsNagadNumber(e.target.value)}
                            placeholder="নগদ অ্যাকাউন্ট নম্বর"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono bg-white"
                          />
                        </div>

                        {/* Rocket */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center">র</div>
                              <span className="text-xs font-extrabold text-purple-600">রকেট (Rocket)</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cfgMfsRocketActive}
                                onChange={(e) => setCfgMfsRocketActive(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={cfgMfsRocketNumber}
                            onChange={(e) => setCfgMfsRocketNumber(e.target.value)}
                            placeholder="রকেট অ্যাকাউন্ট নম্বর"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono bg-white"
                          />
                        </div>

                        {/* Upay */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">উ</div>
                              <span className="text-xs font-extrabold text-blue-600">উপায় (Upay)</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cfgMfsUpayActive}
                                onChange={(e) => setCfgMfsUpayActive(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={cfgMfsUpayNumber}
                            onChange={(e) => setCfgMfsUpayNumber(e.target.value)}
                            placeholder="উপায় অ্যাকাউন্ট নম্বর"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                          />
                        </div>
                      </div>
                    </form>
                  </div>
                )}

                {/* TAB 2: BANGLADESHI BANK */}
                {adminSendMoneySubTab === 'bank_wallet' && (
                  <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left shadow-xs space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          🏛️ বাংলাদেশ ব্যাংক পেমেন্ট গেটওয়ে তালিকা ({(appConfig.paymentBanks || []).filter(b => !b.isInternational).length})
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">দেশীয় ব্যাংকিং মেথডসমূহ এডমিন কর্তৃক যোগ, এডিট, ডিলিট ও সচল রাখুন</p>
                      </div>
                      {!showAddBank && !editingBank && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBank(null);
                            setEbName('');
                            setEbAcronym('');
                            setEbBranch('');
                            setEbRoutingNum('');
                            setEbHolder('');
                            setEbAccNum('');
                            setEbVisaNum('');
                            setEbActive(true);
                            setEbIsInternational(false);
                            setEbBgClass('bg-blue-50 hover:bg-blue-100 border-blue-150');
                            setEbTextClass('text-blue-700');
                            setEbLogoBgClass('bg-blue-100');
                            setShowAddBank(true);
                          }}
                          className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-2xl cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
                        >
                          ➕ নতুন বাংলাদেশি ব্যাংক মেথড যুক্ত করুন
                        </button>
                      )}
                    </div>

                    {/* দেশীয় ব্যাংক গ্রিড */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(appConfig.paymentBanks || []).filter(b => !b.isInternational).map((b, idx) => (
                        <div
                          key={`${b.id}-${idx}`}
                          className={`p-4 sm:p-5 rounded-3xl border text-left space-y-3 relative shadow-xs transition-all duration-300 ${
                            b.active === false ? 'opacity-65 border-dashed border-slate-300 bg-slate-55' : b.bgClass || 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          {/* Top status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${b.logoBgClass || 'bg-slate-250'} ${b.textClass || 'text-slate-700'}`}>
                                {b.acronym}
                              </div>
                              <div>
                                <h5 className="text-xs font-black text-slate-800">{b.name}</h5>
                                <span className="text-[10px] text-slate-500 font-bold">{b.branch}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <label className="relative inline-flex items-center cursor-pointer" title="সক্রিয় / বন্ধ টগল করুন">
                                <input
                                  type="checkbox"
                                  checked={b.active !== false}
                                  onChange={async () => {
                                    const currentBanks = appConfig.paymentBanks || [];
                                    const updatedBanks = currentBanks.map(item => item.id === b.id ? { ...item, active: item.active === false ? true : false } : item);
                                    const updatedConfig = { ...appConfig, paymentBanks: updatedBanks };
                                    await saveAppConfig(updatedConfig);
                                    onChangeConfig(updatedConfig);
                                  }}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                              </label>
                              {b.active !== false ? (
                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">সক্রিয়</span>
                              ) : (
                                <span className="text-[9px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">বন্ধ</span>
                              )}
                            </div>
                          </div>

                          {/* Info lines */}
                          <div className="grid grid-cols-2 gap-3 text-xs bg-white/80 p-3 rounded-2xl border border-slate-100/80">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block">হিসাব নম্বর</span>
                              <span className="font-extrabold text-slate-700 font-mono">{b.accNum}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block">হিসাবধারীর নাম</span>
                              <span className="font-extrabold text-slate-700">{b.holder}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block">রাউটিং নম্বর</span>
                              <span className="font-extrabold text-slate-700 font-mono">{b.routingNum || 'N/A'}</span>
                            </div>
                            {b.visaNum ? (
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold block">ভিসা কার্ড নম্বর</span>
                                <span className="font-extrabold text-slate-700 font-mono text-[10px]">{b.visaNum}</span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold block">অ্যাক্রোনিম কোড</span>
                                <span className="font-extrabold text-slate-700 font-mono">{b.acronym}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBank(b);
                                setEbName(b.name);
                                setEbAcronym(b.acronym);
                                setEbBranch(b.branch);
                                setEbRoutingNum(b.routingNum || '');
                                setEbHolder(b.holder);
                                setEbAccNum(b.accNum);
                                setEbVisaNum(b.visaNum || '');
                                setEbActive(b.active !== false);
                                setEbIsInternational(false);
                                setEbBgClass(b.bgClass || 'bg-blue-50 hover:bg-blue-100 border-blue-150');
                                setEbTextClass(b.textClass || 'text-blue-700');
                                setEbLogoBgClass(b.logoBgClass || 'bg-blue-100');
                                setEbQrCodeUrl(b.qrCodeUrl || '');
                                setShowAddBank(true);
                              }}
                              className="px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-[10px] font-extrabold rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                            >
                              ✏️ সম্পাদনা
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBank(b.id)}
                              className="px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-[10px] font-extrabold rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                            >
                              ❌ মুছে ফেলুন
                            </button>
                          </div>
                        </div>
                      ))}
                      {(appConfig.paymentBanks || []).filter(b => !b.isInternational).length === 0 && (
                        <div className="col-span-1 md:col-span-2 text-center py-6 text-slate-400 font-extrabold text-xs">
                          কোনো বাংলাদেশি ব্যাংক পেমেন্ট মেথড সেটআপ করা নেই!
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: FOREIGN BANK */}
                {adminSendMoneySubTab === 'abroad' && (
                  <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left shadow-xs space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          🌐 আন্তর্জাতিক ও প্রবাসী ব্যাংক পেমেন্ট নেটওয়ার্ক ({(appConfig.paymentBanks || []).filter(b => b.isInternational === true).length})
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">রেমিট্যান্স ও প্রবাসী সমবায় সদস্যদের গ্লোবাল ব্যাংক তালিকা (নাম, একাউন্ট, আইবান ও কিউআর ছবি) এডমিন থেকে পরিবর্তন ও নিয়ন্ত্রণ করুন</p>
                      </div>
                      {!showAddBank && !editingBank && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {(appConfig.paymentBanks || []).filter(b => b.isInternational === true).length === 0 && (
                            <button
                              type="button"
                              onClick={handleInitDefaultIntlBanks}
                              className="px-3.5 py-2 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-2xl cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 shrink-0 shadow-2xs"
                            >
                              ⚡ ডিফল্ট প্রবাসী ব্যাংকসমূহ ইমপোর্ট করুন (SNB ও ENBD)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBank(null);
                              setEbName('');
                              setEbAcronym('INTL');
                              setEbBranch('');
                              setEbRoutingNum('');
                              setEbHolder('');
                              setEbAccNum('');
                              setEbIban('');
                              setEbVisaNum('');
                              setEbActive(true);
                              setEbIsInternational(true);
                              setEbBgClass('bg-indigo-50 hover:bg-indigo-100 border-indigo-200');
                              setEbTextClass('text-indigo-800');
                              setEbLogoBgClass('bg-indigo-200');
                              setEbQrCodeUrl('');
                              setShowAddBank(true);
                            }}
                            className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-2xl cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
                          >
                            ➕ নতুন আন্তর্জাতিক ব্যাংক যুক্ত করুন
                          </button>
                        </div>
                      )}
                    </div>

                    {/* আন্তর্জাতিক ব্যাংক গ্রিড (4টি নির্দিষ্ট সিস্টেম তথ্য) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(appConfig.paymentBanks || []).filter(b => b.isInternational === true).map((b, idx) => (
                        <div
                          key={`${b.id}-${idx}`}
                          className={`p-4 sm:p-5 rounded-3xl border text-left space-y-3 relative shadow-xs transition-all duration-300 ${
                            b.active === false ? 'opacity-65 border-dashed border-slate-300 bg-slate-55' : b.bgClass || 'bg-indigo-50/50 border-indigo-200'
                          }`}
                        >
                          {/* Top Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${b.logoBgClass || 'bg-indigo-200'} ${b.textClass || 'text-indigo-800'}`}>
                                {b.acronym || 'INT'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h5 className="text-xs font-black text-slate-900 uppercase">{b.name}</h5>
                                  <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-md uppercase">PROVASI IBAN</span>
                                </div>
                                <span className="text-[9.5px] text-slate-500 font-bold block">গ্লোবাল অনলাইন রেমিট্যান্স</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <label className="relative inline-flex items-center cursor-pointer" title="সক্রিয় / বন্ধ টগল করুন">
                                <input
                                  type="checkbox"
                                  checked={b.active !== false}
                                  onChange={async () => {
                                    const currentBanks = appConfig.paymentBanks || [];
                                    const updatedBanks = currentBanks.map(item => item.id === b.id ? { ...item, active: item.active === false ? true : false } : item);
                                    const updatedConfig = { ...appConfig, paymentBanks: updatedBanks };
                                    await saveAppConfig(updatedConfig);
                                    onChangeConfig(updatedConfig);
                                  }}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                              </label>
                              {b.active !== false ? (
                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">সক্রিয়</span>
                              ) : (
                                <span className="text-[9px] font-black bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full">বন্ধ</span>
                              )}
                            </div>
                          </div>

                          {/* 4 Core System Info List */}
                          <div className="space-y-2 text-xs bg-white p-3.5 rounded-2xl border border-indigo-150 shadow-2xs">
                            {/* Country & Currency */}
                            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                              <span className="text-[10px] text-indigo-900 font-extrabold flex items-center gap-1">
                                🌍 দেশ ও কারেন্সি:
                              </span>
                              <span className="font-extrabold text-indigo-700 font-sans">
                                {b.country || (b.name?.toLowerCase().includes('dubai') || b.name?.toLowerCase().includes('enbd') ? 'দুবাই / UAE' : 'সৌদি আরব')} ({b.currency || (b.name?.toLowerCase().includes('dubai') || b.name?.toLowerCase().includes('enbd') ? 'AED' : 'SAR')})
                              </span>
                            </div>

                            {/* Transfer Fee */}
                            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                              <span className="text-[10px] text-amber-900 font-extrabold flex items-center gap-1">
                                ⚡ ট্রান্সফার ফি ও চার্জ:
                              </span>
                              <span className="font-black text-amber-800 font-mono bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                {b.transferFee !== undefined && b.transferFee !== null ? b.transferFee : 15} {b.currency || 'SAR'}
                              </span>
                            </div>

                            {/* Rate */}
                            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                              <span className="text-[10px] text-emerald-900 font-extrabold flex items-center gap-1">
                                💱 রেমিট্যান্স রেট:
                              </span>
                              <span className="font-bold text-emerald-800 font-mono">
                                {b.customRate || b.exchangeRate ? `১ ${b.currency || 'SAR'} = ৳${b.customRate || b.exchangeRate}` : 'গ্লোবাল রেট অনুযায়ী'}
                              </span>
                            </div>

                            {/* 1. Beneficiary Name */}
                            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                              <span className="text-[10px] text-indigo-900 font-extrabold flex items-center gap-1">
                                1. নাম (Beneficiary):
                              </span>
                              <span className="font-extrabold text-slate-850 uppercase font-mono">{b.holder}</span>
                            </div>

                            {/* 2. Account Number */}
                            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                              <span className="text-[10px] text-indigo-900 font-extrabold flex items-center gap-1">
                                2. অ্যাকাউন্ট নম্বর:
                              </span>
                              <span className="font-extrabold text-slate-900 font-mono tracking-tight">{b.accNum}</span>
                            </div>

                            {/* 3. IBAN Number */}
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-indigo-900 font-extrabold flex items-center gap-1">
                                3. হিসাব নম্বর (IBAN):
                              </span>
                              <span className="font-extrabold text-slate-900 font-mono text-[11px] tracking-tight">{b.iban || b.accNum}</span>
                            </div>
                          </div>

                          {/* 4. QR Code Screenshot Photo Preview */}
                          <div className="bg-indigo-50/80 p-3 rounded-2xl border border-indigo-200/90 space-y-1.5">
                            <span className="text-[10px] font-extrabold text-indigo-950 block uppercase">4. কিউআর কোড স্ক্যান ছবি:</span>
                            {b.qrCodeUrl ? (
                              <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-indigo-150">
                                <img src={b.qrCodeUrl} alt="QR Code Scan" className="w-14 h-14 rounded-lg object-contain border border-slate-200 shadow-2xs shrink-0" />
                                <div className="text-[10px] space-y-0.5">
                                  <span className="font-extrabold text-emerald-700 block">✅ গ্যালারি ছবি যুক্ত আছে</span>
                                  <span className="text-slate-500 block leading-tight">ইউজার পেমেন্টের সময় এই কিউআর স্ক্যান দেখতে পাবে।</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-amber-700 font-bold bg-amber-50 p-2 rounded-xl border border-amber-200">
                                ⚠️ কোনো কিউআর স্ক্যানার ছবি আপলোড করা নেই। সম্পাদনা (Edit) বাটনে ক্লিক করে গ্যালারি থেকে ছবি আপলোড করুন।
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBank(b);
                                setEbName(b.name);
                                setEbAcronym(b.acronym || 'INT');
                                setEbBranch(b.branch || '');
                                setEbRoutingNum(b.routingNum || '');
                                setEbHolder(b.holder);
                                setEbAccNum(b.accNum);
                                setEbIban(b.iban || b.accNum || '');
                                setEbVisaNum(b.visaNum || '');
                                setEbActive(b.active !== false);
                                setEbIsInternational(true);
                                setEbCurrency?.(b.currency || (b.name?.toLowerCase().includes('dubai') || b.name?.toLowerCase().includes('enbd') ? 'AED' : 'SAR'));
                                setEbCountry?.(b.country || (b.name?.toLowerCase().includes('dubai') || b.name?.toLowerCase().includes('enbd') ? 'সংযুক্ত আরব আমিরাত / দুবাই' : 'সৌদি আরব'));
                                setEbTransferFee?.(b.transferFee !== undefined && b.transferFee !== null ? String(b.transferFee) : '15');
                                setEbCustomRate?.(b.customRate || b.exchangeRate ? String(b.customRate || b.exchangeRate) : '');
                                setEbBgClass(b.bgClass || 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200');
                                setEbTextClass(b.textClass || 'text-indigo-800');
                                setEbLogoBgClass(b.logoBgClass || 'bg-indigo-200');
                                setEbQrCodeUrl(b.qrCodeUrl || '');
                                setShowAddBank(true);
                              }}
                              className="px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-[10px] font-extrabold rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                            >
                              ✏️ সম্পাদনা
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBank(b.id)}
                              className="px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-[10px] font-extrabold rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                            >
                              ❌ মুছে ফেলুন
                            </button>
                          </div>
                        </div>
                      ))}
                      {(appConfig.paymentBanks || []).filter(b => b.isInternational === true).length === 0 && (
                        <div className="col-span-1 md:col-span-2 text-center py-8 bg-indigo-50/50 rounded-2.5xl border-2 border-dashed border-indigo-200 space-y-3">
                          <p className="text-xs text-indigo-950 font-black">
                            🌐 এডমিন প্যানেলে সৌদি ন্যাশনাল ব্যাংক (SNB) ও দুবাই ব্যাংক (ENBD) সহ আন্তর্জাতিক গেটওয়ে যুক্ত করা হয়নি!
                          </p>
                          <p className="text-[11px] text-slate-500 font-bold max-w-md mx-auto">
                            নিচের বাটনে ক্লিক করে ইউজার ড্যাশবোর্ডে প্রদর্শিত সৌদি ব্যাংক ও দুবাই ব্যাংক এডমিন প্যানেলে ইমপোর্ট করুন, যাতে নাম, হিসাব নম্বর, আইবান ও কিউআর ছবি ইচ্ছেমতো সম্পাদনা (Edit) বা মুছে (Delete) ফেলতে পারেন।
                          </p>
                          <button
                            type="button"
                            onClick={handleInitDefaultIntlBanks}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl cursor-pointer transition-all active:scale-95 inline-flex items-center gap-2 shadow-md"
                          >
                            ⚡ সৌদী (SNB) ও দুবাই (ENBD) প্রবাসী ব্যাংকসমূহ এডমিনে ইমপোর্ট করুন
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ⚙️ ব্যাংক ট্রানজেকশন রুলস ও চার্জ সেটিংস (Global Charge Rates) */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left shadow-xs space-y-4">
                  <form onSubmit={handleSaveBankRulesSettings} className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                          ⚙️ ব্যাংক ট্রানজেকশন রুলস ও চার্জ সেটিংস
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">এডমিন কর্তৃক চার্জ কমিয়ে/বাড়িয়ে আপডেট করলে ইউজার ড্যাশবোর্ডে সরাসরি রিয়েল-টাইমে কার্যকর হবে।</p>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-extrabold rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                      >
                        💾 ব্যাংক ও চার্জ সেটিংস আপডেট করুন
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                      <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 shadow-2xs">
                        <label className="text-[10px] font-black text-amber-900 block uppercase font-sans">ব্যাংক থেকে এডমানি বোনাস (/1000)</label>
                        <input type="number" step="0.1" value={cfgBankCbPerThousand} onChange={e => setCfgBankCbPerThousand(Number(e.target.value))} className="w-full mt-1.5 px-3 py-1.5 rounded-lg border border-amber-300 text-xs font-black text-amber-800 font-mono focus:border-amber-500 focus:outline-none bg-white" />
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                        <label className="text-[10px] font-black text-slate-600 block uppercase font-sans">মোবাইল ব্যাংক ফ্ল্যাট চার্জ</label>
                        <input type="number" step="0.1" value={cfgSendMobileFlat} onChange={e => setCfgSendMobileFlat(Number(e.target.value))} className="w-full mt-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black text-pink-700 font-mono focus:border-pink-500 focus:outline-none bg-white" />
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                        <label className="text-[10px] font-black text-slate-600 block uppercase font-sans">মোবাইল ব্যাংক সার্ভিস চার্জ (/1000)</label>
                        <input type="number" step="0.1" value={cfgSendMobileSvc} onChange={e => setCfgSendMobileSvc(Number(e.target.value))} className="w-full mt-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black text-pink-700 font-mono focus:border-pink-500 focus:outline-none bg-white" />
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                        <label className="text-[10px] font-black text-slate-600 block uppercase font-sans">NPSB ব্যাংক ফ্ল্যাট ফি (Flat)</label>
                        <input type="number" step="0.1" value={cfgSendBankFlat} onChange={e => setCfgSendBankFlat(Number(e.target.value))} className="w-full mt-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black text-indigo-700 font-mono focus:border-indigo-500 focus:outline-none bg-white" />
                      </div>
                      <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200/80 shadow-2xs">
                        <label className="text-[10px] font-black text-indigo-900 block uppercase font-sans">AMB টু ব্যাংক সার্ভিস/ক্যাশ আউট চার্জ (/1000)</label>
                        <input type="number" step="0.1" value={cfgSendBankSvc} onChange={e => setCfgSendBankSvc(Number(e.target.value))} className="w-full mt-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 text-xs font-black text-indigo-800 font-mono focus:border-indigo-500 focus:outline-none bg-white" />
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                        <label className="text-[10px] font-black text-slate-600 block uppercase font-sans">ইন্টারন্যাশনাল এক্সচেঞ্জ রেট</label>
                        <input type="number" step="0.1" value={cfgIntExchangeRate} onChange={e => setCfgIntExchangeRate(Number(e.target.value))} className="w-full mt-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black text-slate-800 font-mono focus:border-slate-500 focus:outline-none bg-white" />
                      </div>
                      <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs">
                        <label className="text-[10px] font-black text-emerald-900 block uppercase font-sans">রেমিট্যান্স ট্রান্সফার ফি / খরচ (Flat BDT)</label>
                        <input type="number" step="1" value={cfgRemittanceFee} onChange={e => setCfgRemittanceFee(Number(e.target.value))} className="w-full mt-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 text-xs font-black text-emerald-900 font-mono focus:border-emerald-500 focus:outline-none bg-white" />
                      </div>
                    </div>
                  </form>
                </div>

            {/* 5. ব্যাংক এডমিন ফর্ম বক্স */}
            {showAddBank && (
              <div className="bg-white border-2 border-indigo-300 p-6 rounded-3xl text-left space-y-4 shadow-xl animate-fade-in">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-black text-slate-850 flex items-center gap-1.5">
                      🏦 {editingBank ? 'ব্যাংক মেথড সংশোধন খাতা (Edit Bank Account)' : 'নতুন ব্যাংক পেমেন্ট মেথড ফরম (Add New Bank)'}
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">বাংলাদেশি স্থানীয় ব্যাংক অথবা আন্তর্জাতিক রেমিট্যান্স প্রসেসর সিলেক্ট করুন</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBank(null);
                      setShowAddBank(false);
                    }}
                    className="text-slate-400 hover:text-red-500 font-extrabold text-sm px-2 py-1 rounded-lg hover:bg-slate-100"
                  >
                    ✕ বন্ধ
                  </button>
                </div>

                <form onSubmit={handleSaveBank} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Category Switcher */}
                  <div className="md:col-span-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center gap-3">
                    <span className="text-xs font-black text-slate-700">ব্যাংক ধরন (Category):</span>
                    <button
                      type="button"
                      onClick={() => setEbIsInternational(false)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        !ebIsInternational ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      🇧🇩 বাংলাদেশি ব্যাংক (Local Bank)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEbIsInternational(true)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        ebIsInternational ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      🌐 আন্তর্জাতিক / প্রবাসী ব্যাংক (Foreign Bank)
                    </button>
                  </div>

                  {/* Select Theme Preset */}
                  <div className="md:col-span-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
                    <span className="text-[10px] font-extrabold text-indigo-700 block uppercase tracking-wider">রঙ ও ব্র্যান্ডিং থিম প্রিসেট (Theme Selector)</span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { label: 'Dutch Bangla (নীল)', bg: 'bg-blue-50 hover:bg-blue-100 border-blue-150', text: 'text-blue-700', logoBg: 'bg-blue-100', acr: 'DB' },
                        { label: 'Sonali Bank (সবুজ)', bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-150', text: 'text-emerald-700', logoBg: 'bg-emerald-100', acr: 'SB' },
                        { label: 'Islami Bank (টিয়া)', bg: 'bg-teal-50 hover:bg-teal-100 border-teal-150', text: 'text-teal-700', logoBg: 'bg-teal-100', acr: 'IB' },
                        { label: 'City Bank (আকাশী)', bg: 'bg-sky-50 hover:bg-sky-100 border-sky-150', text: 'text-sky-700', logoBg: 'bg-sky-100', acr: 'CB' },
                        { label: 'Western / Int\'l (বেগুনি)', bg: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200', text: 'text-indigo-800', logoBg: 'bg-indigo-200', acr: 'WU' }
                      ].map((preset, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setEbBgClass(preset.bg);
                            setEbTextClass(preset.text);
                            setEbLogoBgClass(preset.logoBg);
                            setEbAcronym(preset.acr);
                          }}
                          className={`p-2.5 text-[10px] font-bold border rounded-xl flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all ${
                            ebBgClass === preset.bg ? 'ring-2 ring-indigo-500 scale-102 border-transparent bg-white' : 'border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${preset.logoBg} ${preset.text}`}>
                            {preset.acr}
                          </div>
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bank Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      {ebIsInternational ? 'ব্যাংকের পুরো নাম (যেমন: SAUDI NATIONAL BANK / EMIRATES NBD)' : 'ব্যাংকের পুরো নাম (যেমন: Dutch-Bangla Bank PLC.)'}
                    </label>
                    <input
                      type="text"
                      value={ebName}
                      onChange={(e) => setEbName(e.target.value)}
                      placeholder={ebIsInternational ? 'SAUDI NATIONAL BANK (SNB)' : 'Dutch-Bangla Bank PLC. (DBBL)'}
                      className="w-full px-3 py-2 rounded-xl border border-slate-250 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  {/* Holder / Beneficiary Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-indigo-900 block">
                      {ebIsInternational ? '1. নাম (Beneficiary / Account Name)' : 'হিসাবধারীর নাম (Account Name)'}
                    </label>
                    <input
                      type="text"
                      value={ebHolder}
                      onChange={(e) => setEbHolder(e.target.value.toUpperCase())}
                      placeholder="BUSINESS NETWORK BANGLADESH"
                      className="w-full px-3 py-2 rounded-xl border border-slate-250 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase bg-white"
                    />
                  </div>

                  {/* Account Number */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-indigo-900 block">
                      {ebIsInternational ? '2. অ্যাকাউন্ট নম্বর (Account Number)' : 'হিসাব নম্বর / কার্ড নম্বর'}
                    </label>
                    <input
                      type="text"
                      value={ebAccNum}
                      onChange={(e) => setEbAccNum(e.target.value)}
                      placeholder={ebIsInternational ? '640000010006087881869' : '2441580395850'}
                      className="w-full px-3 py-2 rounded-xl border border-slate-250 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono bg-white"
                    />
                  </div>

                  {/* IBAN Number and Details for International Banks */}
                  {ebIsInternational ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-indigo-900 block">দেশ (Country) *</label>
                        <select
                          value={ebCountry || 'সৌদি আরব'}
                          onChange={(e) => {
                            setEbCountry?.(e.target.value);
                            if (e.target.value === 'সৌদি আরব') setEbCurrency?.('SAR');
                            else if (e.target.value.includes('আমিরাত') || e.target.value.includes('দুবাই')) setEbCurrency?.('AED');
                            else if (e.target.value.includes('কাতার')) setEbCurrency?.('QAR');
                            else if (e.target.value.includes('কুয়েত')) setEbCurrency?.('KWD');
                            else if (e.target.value.includes('ওমান')) setEbCurrency?.('OMR');
                            else if (e.target.value.includes('বাহরাইন')) setEbCurrency?.('BHD');
                            else if (e.target.value.includes('মালয়েশিয়া')) setEbCurrency?.('MYR');
                            else if (e.target.value.includes('সিঙ্গাপুর')) setEbCurrency?.('SGD');
                            else if (e.target.value.includes('আমেরিকা')) setEbCurrency?.('USD');
                            else if (e.target.value.includes('যুক্তরাজ্য')) setEbCurrency?.('GBP');
                            else if (e.target.value.includes('ইউরোপ')) setEbCurrency?.('EUR');
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-indigo-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="সৌদি আরব">🇸🇦 সৌদি আরব (Saudi Arabia)</option>
                          <option value="সংযুক্ত আরব আমিরাত / দুবাই">🇦🇪 সংযুক্ত আরব আমিরাত / দুবাই (UAE)</option>
                          <option value="কাতার">🇶🇦 কাতার (Qatar)</option>
                          <option value="কুয়েত">🇰🇼 কুয়েত (Kuwait)</option>
                          <option value="ওমান">🇴🇲 ওমান (Oman)</option>
                          <option value="বাহরাইন">🇧🇭 বাহরাইন (Bahrain)</option>
                          <option value="মালয়েশিয়া">🇲🇾 মালয়েশিয়া (Malaysia)</option>
                          <option value="সিঙ্গাপুর">🇸🇬 সিঙ্গাপুর (Singapore)</option>
                          <option value="আমেরিকা">🇺🇸 আমেরিকা (USA)</option>
                          <option value="যুক্তরাজ্য">🇬🇧 যুক্তরাজ্য (UK)</option>
                          <option value="ইউরোপ">🇪🇺 ইউরোপ (Eurozone)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-indigo-900 block">মুদ্রা কোড (Currency Code) *</label>
                        <input
                          type="text"
                          value={ebCurrency || 'SAR'}
                          onChange={(e) => setEbCurrency?.(e.target.value.toUpperCase())}
                          placeholder="SAR, AED, QAR, KWD..."
                          className="w-full px-3 py-2 rounded-xl border border-indigo-300 text-xs font-bold text-indigo-950 font-mono uppercase bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-amber-900 block">ট্রান্সফার ফি / সার্ভিস চার্জ *</label>
                          <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-mono font-bold">ঐ দেশের কারেন্সিতে</span>
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={ebTransferFee ?? '15'}
                          onChange={(e) => setEbTransferFee?.(e.target.value)}
                          placeholder="উদাঃ 15 (SAR / দিনার / দিরহাম)"
                          className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-bold text-amber-950 bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-emerald-900 block">কাস্টম রেট BDT (ঐচ্ছিক)</label>
                          <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-mono">ফাঁকা রাখলে গ্লোবাল রেট</span>
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={ebCustomRate || ''}
                          onChange={(e) => setEbCustomRate?.(e.target.value)}
                          placeholder="উদাঃ 30.00 (ফাঁকা রাখলে রেট টেবিল অনুযায়ী)"
                          className="w-full px-3 py-2 rounded-xl border border-emerald-300 text-xs font-bold text-emerald-950 bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-indigo-900 block">
                          3. হিসাব নম্বর অর্থাৎ আইবান (IBAN Number)
                        </label>
                        <input
                          type="text"
                          value={ebIban}
                          onChange={(e) => setEbIban(e.target.value)}
                          placeholder="SA50 8000 0640 6080 1788 1869"
                          className="w-full px-3 py-2 rounded-xl border border-indigo-300 text-xs font-extrabold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono bg-indigo-50/40"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Acronym */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">সংক্ষিপ্ত কোড (যেমন: DB, IB)</label>
                        <input
                          type="text"
                          value={ebAcronym}
                          onChange={(e) => setEbAcronym(e.target.value)}
                          placeholder="DB"
                          className="w-full px-3 py-2 rounded-xl border border-slate-250 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono bg-white"
                        />
                      </div>

                      {/* Branch */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">শাখার নাম (যেমন: হেমায়েতপুর শাখা)</label>
                        <input
                          type="text"
                          value={ebBranch}
                          onChange={(e) => setEbBranch(e.target.value)}
                          placeholder="হেমায়েতপুর শাখা"
                          className="w-full px-3 py-2 rounded-xl border border-slate-250 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                      </div>

                      {/* Routing Number */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">রাউটিং নাম্বার (Routing Code)</label>
                        <input
                          type="text"
                          value={ebRoutingNum}
                          onChange={(e) => setEbRoutingNum(e.target.value)}
                          placeholder="090261545"
                          className="w-full px-3 py-2 rounded-xl border border-slate-250 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono bg-white"
                        />
                      </div>

                      {/* Visa Card Number */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">ভিসা কার্ড নম্বর (ঐচ্ছিক)</label>
                        <input
                          type="text"
                          value={ebVisaNum}
                          onChange={(e) => setEbVisaNum(e.target.value)}
                          placeholder="4840 6100 1036 9801"
                          className="w-full px-3 py-2 rounded-xl border border-slate-250 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono bg-white"
                        />
                      </div>
                    </>
                  )}

                  {/* Bank Account QR Code / Screenshot Image Upload */}
                  <div className="md:col-span-3 bg-indigo-50/70 p-4 rounded-2.5xl border border-indigo-200/90 space-y-3">
                    <label className="text-xs font-black text-indigo-950 block flex items-center justify-between">
                      <span className="flex items-center gap-1.5">📷 অ্যাকাউন্ট কিউআর কোড বা পেপার স্ক্যানার ছবি (Bank QR / Account Scan Photo)</span>
                      <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 px-2 py-0.5 rounded-full font-sans">গ্যালারি থেকে সিলেক্ট করুন</span>
                    </label>
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                      বিদেশি/আন্তর্জাতিক অথবা লোকাল ব্যাংক একাউন্টের স্ক্যান অথবা গ্যালারি থেকে ছবি সিলেক্ট করুন। ইউজার পেমেন্ট করার সময় এই কিউআর কোড/ছবি দেখে স্ক্যান করে সরাসরি ফান্ড পাঠাতে পারবে।
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <label className="flex-1 cursor-pointer bg-white hover:bg-indigo-50/40 border-2 border-dashed border-indigo-300 hover:border-indigo-500 p-3.5 rounded-2xl flex items-center justify-center gap-2 text-indigo-800 text-xs font-black transition group shadow-xs">
                        <span className="text-lg group-hover:scale-110 transition-transform">🖼️</span>
                        <span>গ্যালারি বা ফাইল থেকে একাউন্টের স্ক্যানার ছবি আপলোড করুন</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleBankQrUpload} 
                          className="hidden" 
                        />
                      </label>
                      
                      {ebQrCodeUrl && (
                        <button 
                          type="button" 
                          onClick={() => setEbQrCodeUrl('')}
                          className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 font-extrabold text-xs rounded-2xl transition flex items-center justify-center gap-1 shrink-0"
                        >
                          ❌ ছবি রিমুভ করুন
                        </button>
                      )}
                    </div>

                    {ebQrCodeUrl && (
                      <div className="bg-white p-3.5 rounded-2xl border border-indigo-200 max-w-sm space-y-2">
                        <span className="text-[10px] text-indigo-900 font-extrabold block uppercase tracking-wider">📷 আপলোডকৃত কিউআর কোড স্ক্যানার প্রিভিউ</span>
                        <img 
                          src={ebQrCodeUrl} 
                          alt="Bank QR Preview" 
                          className="max-h-56 rounded-xl object-contain mx-auto border border-slate-150 shadow-sm" 
                        />
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="ebActive"
                      checked={ebActive}
                      onChange={(e) => setEbActive(e.target.checked)}
                      className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="ebActive" className="text-xs font-black text-slate-700 cursor-pointer">এই ব্যাংক পেমেন্ট মেথডটি সচল (Active) রাখুন</label>
                  </div>

                  {/* Submit buttons */}
                  <div className="md:col-span-3 flex items-center justify-end gap-3 border-t border-slate-200/60 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBank(null);
                        setShowAddBank(false);
                      }}
                      className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-300 transition-all active:scale-95"
                    >
                      বাতিল (Cancel)
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl cursor-pointer transition-all active:scale-95 shadow-md flex items-center gap-1 disabled:opacity-50"
                    >
                      💾 সংরক্ষণ করুন (Save Account)
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

            {/* 💵 অমীমাংসিত ব্যাংক ও রেমিট্যান্স লেনদেন অনুমোদন খাতা (Sub-tabbed Pending Transactions Center) */}
            <div className="bg-slate-955 border border-slate-200/80 p-5 rounded-3xl text-left space-y-4 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/20 pb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    💵 অমীমাংসিত ব্যাংক ও রেমিট্যান্স লেনদেন অনুমোদন খাতা (Pending Transactions Center)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">সমগ্র বিশ্বের সমবায় সদস্যদের পাঠানো ডিপোজিট, উইথড্রয়াল, ক্যাশ-আউট, মোবাইল রিচার্জ এবং লোন পরিশোধ রিকোয়েস্টগুলো এখান থেকে ঝটপট পর্যবেক্ষণ ও নিয়ন্ত্রণ করুন।</p>
                </div>
                <div className="bg-slate-900 border border-slate-200/20 px-3 py-1.5 rounded-2xl text-xs font-bold text-slate-300 shrink-0">
                  মোট পেন্ডিংঃ <span className="text-amber-450 font-black font-mono text-sm">{transactions.filter(isPendingTransaction).length}</span> টি
                </div>
              </div>

              {/* Responsive Sub-tabs list */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900/60 rounded-2xl border border-slate-200/10 overflow-x-auto">
                {[
                  { id: 'all' as const, label: '🔔 সকল অমিমাংসিত', count: transactions.filter(t => isPendingTransaction(t)).length },
                  { id: 'add_money' as const, label: '💰 ডিপোজিট/অ্যাড মানি', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'add_money')).length },
                  { id: 'withdraw' as const, label: '💸 ক্যাশ আউট/উইথড্র', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'withdraw')).length },
                  { id: 'transfer' as const, label: '🔄 রেমিট্যান্স/ট্রান্সফার', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'transfer')).length },
                  { id: 'loan' as const, label: '🤝 লোন ও কর্জে হাসানা', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'loan')).length },
                  { id: 'recharge' as const, label: '📱 রিচার্জ ও বিল পে', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'recharge')).length },
                  { id: 'other' as const, label: '⚙️ অন্যান্য', count: transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, 'other')).length }
                ].map((ptab, idx) => (
                  <button
                    key={`${ptab.id}-${idx}`}
                    type="button"
                    onClick={() => setBankPendingFilter(ptab.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      bankPendingFilter === ptab.id
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    <span>{ptab.label}</span>
                    {ptab.count > 0 && (
                      <span className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[8.5px] font-mono font-black animate-pulse leading-none">
                        {ptab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Transactions List */}
              <div className="space-y-3 pt-1">
                {(() => {
                  const filteredPendingTxs = transactions.filter(t => isPendingTransaction(t) && matchesBankPendingCategory(t, bankPendingFilter));

                  if (filteredPendingTxs.length === 0) {
                    return (
                      <div className="bg-slate-900 border border-slate-200/10 p-8 rounded-2xl text-center space-y-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                        <h4 className="text-xs font-extrabold text-white">অভিনন্দন! কোনো পেন্ডিং আবেদন নেই</h4>
                        <p className="text-[11px] text-slate-500">এই ক্যাটাগরিতে বর্তমানে কোনো অমিমাংসিত লেনদেন বা রিকোয়েস্ট পেন্ডিং অবস্থায় নেই।</p>
                      </div>
                    );
                  }

                  return filteredPendingTxs.map((tx, idx) => {
                    // Type styling config
                    let badgeColor = 'bg-amber-950 text-amber-400 border-amber-800/40';
                    if (['add_money', 'deposit', 'loan_repayment'].includes(tx.type)) {
                      badgeColor = 'bg-emerald-950 text-emerald-400 border-emerald-800/40';
                    } else if (['cash_out', 'withdraw'].includes(tx.type)) {
                      badgeColor = 'bg-rose-950 text-rose-450 border-rose-800/40';
                    } else if (['telecom_recharge', 'bill_pay'].includes(tx.type)) {
                      badgeColor = 'bg-indigo-950 text-indigo-400 border-indigo-800/40';
                    }

                    return (
                      <div key={`${tx.id}-${idx}`} className="bg-slate-900 border border-slate-200/10 p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-amber-500/30 transition text-slate-300">
                        <div className="space-y-1.5 text-left flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-black uppercase border px-2 py-0.5 rounded leading-none ${badgeColor}`}>
                              {tx.typeLabel || 'লেনদেন'}
                            </span>
                            <h4 className="text-xs font-extrabold text-white">{tx.userName}</h4>
                            <span className="text-[10px] text-slate-500 font-mono font-bold">({tx.memberId || 'N/A'})</span>
                            <span className="text-[9.5px] text-slate-500 font-mono font-bold ml-auto lg:ml-0">
                              🕒 {tx.createdAt ? new Date(tx.createdAt).toLocaleString('bn-BD') : '—'}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-300 leading-relaxed font-sans select-all">{tx.description}</p>
                          
                          {tx.billImage && (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => setPreviewImage(tx.billImage)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-[10px] font-black border border-slate-700 transition cursor-pointer"
                              >
                                <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                                🖼️ সংযুক্ত রশিদের ছবি দেখুন (Click to View Receipt)
                              </button>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-400">
                            {tx.senderInfo && <div>হিসাবঃ <span className="text-slate-200 font-semibold select-all">{tx.senderInfo}</span></div>}
                            {tx.transactionId && <div>TxIDঃ <span className="text-amber-400 font-extrabold select-all">{tx.transactionId}</span></div>}
                            {tx.paymentMethod && <div>পদ্ধতিঃ <span className="text-emerald-400 font-black select-all">{tx.paymentMethod}</span></div>}
                            {tx.operator && <div>অপারেটরঃ <span className="text-indigo-400 font-bold select-all">{tx.operator}</span></div>}
                            {tx.phone && <div>নম্বরঃ <span className="text-sky-400 font-bold select-all">{tx.phone}</span></div>}
                          </div>

                          {/* Quick Copy Panel */}
                          {(() => {
                            const nums = extractNumbersFromTx(tx);
                            if (nums.length === 0) return null;
                            return (
                              <div className="bg-slate-950/80 border border-slate-800 p-2 rounded-xl flex flex-wrap gap-1.5 items-center text-xs mt-1">
                                <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 shrink-0">
                                  <Copy className="w-3 h-3 text-amber-400" /> নম্বর কপিঃ
                                </span>
                                {nums.map((item, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => copyTextToClipboard(item.number, item.label)}
                                    className="px-2 py-0.5 bg-slate-800 hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-slate-700 rounded text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                                  >
                                    <span className="text-slate-400 text-[9.5px]">{item.label}:</span>
                                    <span className="text-emerald-400 font-extrabold select-all">{item.number}</span>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 border-t lg:border-t-0 border-slate-800/40 pt-3 lg:pt-0">
                          <div className="text-left lg:text-right">
                            <span className="text-sm font-black font-mono text-amber-450 block">৳ {(tx.amount || 0).toLocaleString('bn-BD')} BDT</span>
                            <span className="text-[9px] text-slate-500 font-extrabold">পেন্ডিং আবেদন</span>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleApproveTransaction(tx)}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-md hover:scale-103 active:scale-97"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> অনুমোদন করুন
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectTransaction(tx.id)}
                              className="px-3 py-2 bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 rounded-xl text-xs font-bold transition cursor-pointer hover:scale-103 active:scale-97"
                            >
                              বাতিল করুন
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Quick Card Controls List */}
            <div className="bg-slate-955 border border-slate-200/80 rounded-3xl p-6 text-left">
              <h3 className="text-sm font-extrabold text-white mb-4">💳 মেম্বার এটিএম ডেবিট কার্ড ডাইরেক্টরি খাতা (Cards Control & ATM Limits)</h3>
              
              <div className="space-y-3">
                {filteredUsers.slice(0, 15).map((u, idx) => {
                  const hasCard = u.memberId ? true : false;
                  return (
                    <div key={`${u.uid}-${idx}`} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-800/80 transition">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                          u.cardLocked ? 'bg-red-500/10 border border-red-500/20 text-red-500' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                        }`}>
                          💳
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-800 flex items-center gap-2">
                            {u.name}
                            <span className={`px-2 py-0.5 rounded text-[8px] tracking-widest font-mono font-bold uppercase border ${
                              u.cardLocked ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {u.cardLocked ? 'ফ্রিজ করা (Blocked)' : 'এক্টিভ (Active Card)'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-600 font-sans mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                            <span>আইডি: <strong className="text-indigo-700 font-extrabold font-mono">{u.memberId || 'N/A'}</strong></span>
                            <span>ফ্রি মোবাইল ব্যালেন্স: <strong className="text-emerald-700 font-extrabold font-mono">৳{(u.balance || 0).toLocaleString()}</strong></span>
                            <span>দৈনিক ক্যাশআউট লিমিট: <strong className="text-amber-700 font-extrabold font-mono">৳{(u.cardAtmLimit !== undefined ? u.cardAtmLimit : 10000).toLocaleString()}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Toggle card status */}
                        <button
                          onClick={async () => {
                            try {
                              setLoading(true);
                              const newStatus = !u.cardLocked;
                              await updateDoc(doc(db, 'users', u.uid), { cardLocked: newStatus });
                              alert(`কার্ড সফলভাবে ${newStatus ? 'লক (Blocked)' : 'আনলক (Activated)'} করা হয়েছে!`);
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                            u.cardLocked 
                              ? 'bg-emerald-900/40 hover:bg-emerald-800 text-emerald-400 border border-emerald-800/40' 
                              : 'bg-red-900/40 hover:bg-red-800 text-red-400 border border-red-800/40'
                          }`}
                        >
                          {u.cardLocked ? '🔓 আনলক করুন' : '🔒 লক/ফ্রিজ করুন'}
                        </button>

                        {/* Adjust limit */}
                        <button
                          onClick={async () => {
                            const newLimStr = prompt('মেম্বারের দৈনিক এটিএম ক্যাশআউট লিমিট প্রবেশ করান (টাকা):', String(u.cardAtmLimit !== undefined ? u.cardAtmLimit : 10000));
                            if (newLimStr !== null) {
                              const newLim = Number(newLimStr);
                              if (!isNaN(newLim) && newLim >= 0) {
                                try {
                                  setLoading(true);
                                  await updateDoc(doc(db, 'users', u.uid), { cardAtmLimit: newLim });
                                  alert('মেম্বারের দৈনিক এটিএম ক্যাশআউট লিমিট আপডেট করা হয়েছে!');
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setLoading(false);
                                }
                              } else {
                                alert('দয়া করে সঠিক সংখ্যা প্রদান করুন!');
                              }
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-750 text-slate-600 hover:text-white border border-slate-200 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          ⚙️ লিমিট সেট করুন
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Manual Banker Cash Balance Voucher Form (ম্যানুয়াল ব্যাংকার ক্যাশ ব্যালেন্স ভাউচার) */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                const formData = new FormData(e.currentTarget);
                const targetUid = formData.get('memUid') as string;
                const flowDirection = formData.get('flowDirection') as string || 'credit';
                const amount = parseFloat(formData.get('flowAmt') as string);
                const note = formData.get('flowNote') as string || 'অ্যাডমিন ভাউচার এডজাস্টমেন্ট';

                if (!targetUid || isNaN(amount) || amount <= 0) {
                  alert('দয়া করে সঠিক মেম্বার এবং ধনাত্মক টাকার পরিমাণ লিখুন!');
                  return;
                }

                const targetUser = users.find(u => u.uid === targetUid);
                if (!targetUser) {
                  alert('মেম্বার খুঁজে পাওয়া যায়নি!');
                  return;
                }

                const currentBal = Number(targetUser.balance !== undefined ? targetUser.balance : (targetUser as any).mainBalance) || Number((targetUser as any).mainBalance) || 0;
                let finalBal = currentBal;
                let txType = 'deposit';
                let txLabel = 'ক্যাশ ভাউচার যোগ';
                let paymentMethod = 'Software Banker Voucher';
                let description = '';
                let notifTitle = '';
                let notifBody = '';

                if (flowDirection === 'debit') {
                  finalBal = Math.max(0, currentBal - amount);
                  txType = 'withdraw';
                  txLabel = 'ক্যাশ ভাউচার কর্তন';
                  paymentMethod = 'Software Banker Debit Voucher';
                  description = `এডমিন প্যানেল কর্তৃক ম্যানুয়াল ডেবিট ভাউচার চার্জ কর্তন। সমন্বয় নোট: ${note}। পূর্বের ব্যালেন্সঃ ৳${currentBal} | নতুন ব্যালেন্সঃ ৳${finalBal}।`;
                  notifTitle = '⚠️ ভাউচার অনুযায়ী ব্যালেন্স বিয়োগ করা হয়েছে';
                  notifBody = `আপনার ওয়ালেট থেকে ৳${amount.toLocaleString('bn-BD')} টাকা সমন্বয়/কর্তন করা হয়েছে। বর্তমান নতুন ব্যালেন্স ৳${finalBal.toLocaleString('bn-BD')} টাকা।${note ? `\n\nসমন্বয় নোট: ${note}` : ''}`;
                } else {
                  finalBal = currentBal + amount;
                  txType = 'deposit';
                  txLabel = 'ক্যাশ ভাউচার যোগ';
                  paymentMethod = 'Software Banker Credit Voucher';
                  description = `এডমিন প্যানেল কর্তৃক ম্যানুয়াল ক্রেডিট ভাউচার ক্যাশ যোগ। সমন্বয় নোট: ${note}। পূর্বের ব্যালেন্সঃ ৳${currentBal} | নতুন ব্যালেন্সঃ ৳${finalBal}।`;
                  notifTitle = '🟢 ওয়ালেটে ভাউচার ক্যাশ ব্যালেন্স যোগ হয়েছে!';
                  notifBody = `আপনার ওয়ালেটে ৳${amount.toLocaleString('bn-BD')} টাকা ক্যাশ জমা ভাউচার যুক্ত করা হয়েছে। বর্তমান নতুন ব্যালেন্স ৳${finalBal.toLocaleString('bn-BD')} টাকা।${note ? `\n\nসমন্বয় নোট: ${note}` : ''}`;
                }

                await updateDoc(doc(db, 'users', targetUser.uid), { balance: finalBal, mainBalance: finalBal });

                await addDoc(collection(db, 'transactions'), {
                  id: `tx-voucher-${Date.now()}`,
                  userId: targetUser.uid,
                  userName: targetUser.name,
                  memberId: targetUser.memberId,
                  type: txType,
                  typeLabel: txLabel,
                  amount: amount,
                  status: 'success',
                  createdAt: new Date().toISOString(),
                  paymentMethod: paymentMethod,
                  description: description
                });

                await addDoc(collection(db, 'user_notifications'), {
                  userId: targetUser.uid,
                  memberId: targetUser.memberId,
                  title: notifTitle,
                  body: notifBody,
                  category: flowDirection === 'credit' ? 'deposit' : 'withdraw',
                  type: flowDirection === 'credit' ? 'deposit' : 'withdraw',
                  amount: amount,
                  isPersonal: true,
                  read: false,
                  createdAt: new Date().toISOString()
                });

                alert(`সফলভাবে সদস্য ${targetUser.name}-এর ব্যালেন্স সমন্বয় সম্পন্ন হয়েছে।`);
                e.currentTarget.reset();
              } catch (err) {
                console.error("Error processing banker voucher:", err);
                alert('ভাউচার অনুমোদন করতে সমস্যা হয়েছে!');
              } finally {
                setLoading(false);
              }
            }} className="bg-white border border-slate-200 rounded-3xl p-6 text-left space-y-4 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                🏦 ম্যানুয়াল ব্যাংকার ক্যাশ ব্যালেন্স ভাউচার (Banker Cash Flow Voucher)
              </h3>
              <p className="text-xs text-slate-500">বিশেষ কোনো ক্যাশ ডিপোজিট বা চার্জ কাটার ক্ষেত্রে সরাসরি ব্যাংক ভাউচারের ন্যায় ওয়ালেট ম্যানুয়ালি ডেবিট অথবা ক্রেডিট করতে ভাউচার তৈরি করুন।</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">সমবায় সদস্য বা মেম্বার আইডি</label>
                  <select name="memUid" required className="w-full bg-white border border-slate-200 text-xs text-slate-900 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold">
                    <option value="">সদস্য নির্বাচন করুন...</option>
                    {users.map((u, idx) => (
                      <option key={`${u.uid}-${idx}`} value={u.uid}>
                        {u.name} ({u.memberId || 'N/A'}) - ৳{u.balance || 0}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">দিকনির্দেশনা (Credit vs Debit)</label>
                  <select name="flowDirection" required className="w-full bg-white border border-slate-200 text-xs text-slate-900 p-2.5 rounded-xl outline-none font-bold focus:ring-2 focus:ring-emerald-500">
                    <option value="credit">🟢 ওয়ালেট ব্যালেন্স যোগ করুন (Credit Account)</option>
                    <option value="debit">🔴 ওয়ালেট ব্যালেন্স বিয়োগ করুন (Debit Account)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">টাকার পরিমাণ (Voucher Amount)</label>
                  <input
                    type="number"
                    name="flowAmt"
                    required
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-900 font-mono outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    placeholder="যেমন: 1000"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-extrabold text-slate-600">সমন্বয়ের স্পষ্ট কারণ বা ভাউচার রেফারেন্স নোট (Voucher Reference notes)</label>
                <input
                  type="text"
                  name="flowNote"
                  required
                  className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="যেমন: ক্যাশ ডিপোজিট বা ভুল ট্রানজেকশন চার্জ রিফান্ড"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all hover:scale-102 active:scale-97 cursor-pointer shadow-sm"
                >
                  ক্যাশ ব্যালেন্স ভাউচার অনুমোদন করুন
                </button>
              </div>
            </form>

            {/* 💸 মেম্বার বোনাস ও চার্জ কর্তন কেন্দ্র (Admin Member Bonus & Debit Panel) */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                const formData = new FormData(e.currentTarget);
                const targetUid = formData.get('bonusUid') as string;
                const amount = parseFloat(formData.get('bonusAmt') as string);
                const reason = formData.get('bonusReason') as string || 'বিশেষ উৎসব বা কার্যকারিতা বোনাস';
                const actionType = formData.get('actionType') as string || 'bonus';

                if (!targetUid || isNaN(amount) || amount <= 0) {
                  alert('দয়া করে সঠিক মেম্বার এবং ধনাত্মক টাকার পরিমাণ লিখুন!');
                  return;
                }

                const targetUser = users.find(u => u.uid === targetUid);
                if (!targetUser) {
                  alert('মেম্বার খুঁজে পাওয়া যায়নি!');
                  return;
                }

                const currentBal = targetUser.balance || 0;
                let finalBal = currentBal;
                let txType = 'deposit';
                let txLabel = 'অ্যাডমিন বোনাস';
                let paymentMethod = 'Software Admin Bonus';
                let description = '';
                let notifTitle = '';
                let notifBody = '';

                if (actionType === 'deduct') {
                  finalBal = Math.max(0, currentBal - amount);
                  txType = 'withdraw';
                  txLabel = 'অ্যাডমিন চার্জ কর্তন';
                  paymentMethod = 'Software Admin Debit';
                  description = `এডমিন প্যানেল কর্তৃক বিশেষ চার্জ কর্তন। কর্তন নোট: ${reason}। পূর্বের ব্যালেন্সঃ ৳${currentBal} | নতুন ব্যালেন্সঃ ৳${finalBal}।`;
                  notifTitle = '⚠️ অ্যাকাউন্ট থেকে টাকা কেটে নেওয়া হয়েছে';
                  notifBody = `আপনার পূর্বে ওয়ালেট ব্যালেন্স ছিল ৳${currentBal.toLocaleString('bn-BD')} টাকা। বর্তমান -৳${amount.toLocaleString('bn-BD')} টাকা কর্তন করায় আপনার সর্বমোট নতুন ব্যালেন্স ৳${finalBal.toLocaleString('bn-BD')} টাকা।${reason ? `\n\nকারণ/নোট: ${reason}` : ''}`;
                } else {
                  finalBal = currentBal + amount;
                  txType = 'deposit';
                  txLabel = 'অ্যাডমিন বোনাস';
                  paymentMethod = 'Software Admin Bonus';
                  description = `এডমিন প্যানেল কর্তৃক বিশেষ বোনাস প্রদান। বোনাস নোট: ${reason}। পূর্বের ব্যালেন্সঃ ৳${currentBal} | নতুন ব্যালেন্সঃ ৳${finalBal}।`;
                  notifTitle = '🎉 বিশেষ বোনাস ব্যালেন্স যুক্ত হয়েছে!';
                  notifBody = `আপনার পূর্বে ওয়ালেট ব্যালেন্স ছিল ৳${currentBal.toLocaleString('bn-BD')} টাকা। বর্তমান +৳${amount.toLocaleString('bn-BD')} টাকা বোনাস প্রদান করায় আপনার সর্বমোট নতুন ব্যালেন্স ৳${finalBal.toLocaleString('bn-BD')} টাকা।${reason ? `\n\nবোনাস নোট: ${reason}` : ''}`;
                }

                // Update Firestore balance
                await updateDoc(doc(db, 'users', targetUser.uid), { balance: finalBal, mainBalance: finalBal });

                // Create Transaction Log
                await addDoc(collection(db, 'transactions'), {
                  id: `tx-${actionType}-${Date.now()}`,
                  userId: targetUser.uid,
                  userName: targetUser.name,
                  memberId: targetUser.memberId,
                  type: txType,
                  typeLabel: txLabel,
                  amount: amount,
                  status: 'success',
                  createdAt: new Date().toISOString(),
                  paymentMethod: paymentMethod,
                  description: description
                });

                // Send Real-time Push Notification
                await addDoc(collection(db, 'user_notifications'), {
                  userId: targetUser.uid,
                  memberId: targetUser.memberId,
                  title: notifTitle,
                  body: notifBody,
                  category: actionType === 'add' ? 'bonus' : 'fine',
                  type: actionType === 'add' ? 'bonus' : 'fine',
                  amount: amount,
                  isPersonal: true,
                  read: false,
                  createdAt: new Date().toISOString()
                });

                if (actionType === 'deduct') {
                  alert(`সফলভাবে সদস্য ${targetUser.name}-এর অ্যাকাউন্ট থেকে ৳${amount} কেটে নেওয়া হয়েছে এবং নোটিফিকেশন পাঠানো হয়েছে।`);
                } else {
                  alert(`অভিনন্দন! সদস্য ${targetUser.name}-কে সফলভাবে ৳${amount} বোনাস প্রদান করা হয়েছে এবং নোটিফিকেশন পাঠানো হয়েছে।`);
                }
                e.currentTarget.reset();
              } catch (err) {
                console.error("Error processing admin balance action:", err);
                alert('লেনদেন সম্পন্ন করতে সমস্যা হয়েছে, দয়া করে আবার চেষ্টা করুন।');
              } finally {
                setLoading(false);
              }
            }} className="bg-white border border-slate-200 rounded-3xl p-6 text-left space-y-4 shadow-xs">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                💸 মেম্বার বোনাস ও চার্জ কর্তন কেন্দ্র (Admin Member Bonus & Charge Deduction Panel)
              </h3>
              <p className="text-xs text-slate-500">সফটওয়্যার প্যানেলের পক্ষ থেকে যেকোনো নির্বাচিত সমবায় সদস্যকে সরাসরি বিশেষ উপহার/বোনাস অর্থ প্রদান করুন অথবা তাদের অ্যাকাউন্ট থেকে যেকোনো সার্ভিস চার্জ কর্তন করুন। এর ফলে সদস্যের ব্যালেন্স আপডেট হবে এবং সাথে সাথে একটি নোটিশ ও পুশ নোটিফিকেশন সদস্যের ড্যাশবোর্ডে চলে যাবে।</p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">লেনদেনের ধরন (Transaction Type)</label>
                  <select name="actionType" required className="w-full bg-white border border-slate-200 text-xs text-slate-900 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold">
                    <option value="bonus" className="text-slate-900">🎉 বোনাস প্রদান (Credit/Bonus)</option>
                    <option value="deduct" className="text-slate-900">💸 ব্যালেন্স কেটে নেওয়া (Debit/Deduction)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">প্রাপক সমবায় সদস্য</label>
                  <select name="bonusUid" required className="w-full bg-white border border-slate-200 text-xs text-slate-900 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold">
                    <option value="" className="text-slate-900">সদস্য নির্বাচন করুন...</option>
                    {users.map((u, idx) => (
                      <option key={`${u.uid}-${idx}`} value={u.uid} className="text-slate-900">
                        {u.name} ({u.memberId || 'N/A'}) - ৳{u.balance || 0}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">টাকার পরিমাণ (Amount)</label>
                  <input
                    type="number"
                    name="bonusAmt"
                    required
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-900 font-mono outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                    placeholder="যেমন: 50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600">কারণ / নোট (Reason/Notes)</label>
                  <input
                    type="text"
                    name="bonusReason"
                    required
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="যেমন: রেফারেল বোনাস বা অ্যাকাউন্ট চার্জ কর্তন"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-6 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-xl text-xs font-bold transition-all hover:scale-102 active:scale-97 cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  লেনদেন সম্পন্ন করুন ও নোটিফিকেশন পাঠান
                </button>
              </div>
            </form>

            {/* Cooperative Configuration & Rates */}
            <form onSubmit={handleSaveGlobalRulesAndFees} className="bg-white border border-slate-200 rounded-3xl p-6 text-left space-y-4 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                ⚙️ কো-অপারেটিভ লোন ইন্টারেস্ট ও রেমিট্যান্স ফি রেট এবং গ্লোবাল টেক্সট
              </h3>
              <p className="text-xs text-slate-500">এখান থেকে ঋণ ও রেমিট্যান্স পার্সেন্টেজ এবং অ্যাপের সার্বজনীন ছোট-বড় সকল লেখা মাইক্রো-ম্যানেজমেন্ট করতে পারবেন।</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-600">কো-অপারেটিভ লোন ইন্টারেস্ট রেট (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfgCoopInterestRate}
                    onChange={(e) => setCfgCoopInterestRate(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-900 font-mono outline-none font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-600">রেমিট্যান্স কমিশন ফি (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfgRemittanceFeePercent}
                    onChange={(e) => setCfgRemittanceFeePercent(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-900 font-mono outline-none font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-500">হোম স্ক্রিন মেইন টাইটেল (Bangla)</label>
                  <input
                    type="text"
                    value={globalWelcomeTitle}
                    onChange={(e) => setGlobalWelcomeTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs text-slate-900 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-500">হোম স্ক্রিন সাব-টাইটেল (Bangla)</label>
                  <input
                    type="text"
                    value={globalWelcomeSub}
                    onChange={(e) => setGlobalWelcomeSub(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-500">হেল্প ডেস্ক কন্টাক্ট বাটন টেক্সট</label>
                  <input
                    type="text"
                    value={globalContactLabel}
                    onChange={(e) => setGlobalContactLabel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs text-slate-900 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-500">হেল্প ডেস্ক বিবরণী ইনফো</label>
                  <input
                    type="text"
                    value={globalSupportDeskInfo}
                    onChange={(e) => setGlobalSupportDeskInfo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-500">ঋণ বা লোন আবেদন বাটন টেক্সট</label>
                  <input
                    type="text"
                    value={globalLoanBtn}
                    onChange={(e) => setGlobalLoanBtn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs text-slate-900 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-500">রেশন কার্ড আবেদন বাটন টেক্সট</label>
                  <input
                    type="text"
                    value={globalRationBtn}
                    onChange={(e) => setGlobalRationBtn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  ✓ গ্লোবাল প্যারামিটার ও রেটসমূহ সেভ করুন
                </button>
              </div>
            </form>

            {/* 💳 সদস্যদের ভার্চুয়াল ডেবিট কার্ড ও অ্যাকাউন্ট ম্যানেজার */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 text-left space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <span>💳 সদস্যদের ভার্চুয়াল ডেবিট কার্ড ও অ্যাকাউন্ট ম্যানেজার (রিয়েল-টাইম কাস্টমাইজ)</span>
                  <span className="text-slate-500 text-xs font-mono">মোট সদস্য: {users.length} জন</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  সদস্যদের ভার্চুয়াল কার্ড নম্বর, অ্যাকাউন্ট নম্বর, কার্ডহোল্ডারের নাম, মেয়াদ উত্তীর্ণের তারিখ (Expiry Date) এবং সিভিভি (CVV) সরাসরি এডিট ও প্রতি বছর মেয়াদ নবায়ন (Renew) করতে নিচের মেম্বার তালিকা ব্যবহার করুন।
                </p>
              </div>

              {/* Card Search query bar */}
              <div className="flex gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-150">
                <input
                  type="text"
                  value={cardSearchQuery}
                  onChange={(e) => setCardSearchQuery(e.target.value)}
                  placeholder="মেম্বারের নাম, আইডি বা মোবাইল নম্বর দিয়ে খুঁজুন..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                />
              </div>

              {/* Members Cards list */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
                <table className="w-full text-left border-collapse text-xs font-sans">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200/80 font-black">
                      <th className="p-3">সদস্য তথ্য</th>
                      <th className="p-3">কার্ড নম্বর ও অ্যাকাউন্ট</th>
                      <th className="p-3">কার্ডহোল্ডার</th>
                      <th className="p-3">মেয়াদ ও সিভিভি</th>
                      <th className="p-3">স্ট্যাটাস</th>
                      <th className="p-3 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {users
                      .filter(u => {
                        if (!cardSearchQuery) return true;
                        const queryLower = cardSearchQuery.toLowerCase().trim();
                        return (
                          (u.name || '').toLowerCase().includes(queryLower) ||
                          (u.phone || '').includes(queryLower) ||
                          (u.memberId || '').toLowerCase().includes(queryLower)
                        );
                      })
                      .map((u, idx) => {
                        const cardNum = u.ambCardNumber || 'তৈরি করা হয়নি';
                        const accNum = u.ambAccountNumber || '—';
                        const holder = u.ambCardHolderName || u.name || '—';
                        const expiry = u.ambCardExpiry || '—';
                        const cvv = u.ambCardCvv || '—';
                        const status = u.ambCardStatus || 'active';

                        return (
                          <tr key={`${u.uid}-${idx}`} className="hover:bg-slate-50 transition">
                            <td className="p-3">
                              <p className="font-extrabold text-slate-900">{u.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono font-bold">ID: {u.memberId || 'N/A'}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{u.phone}</p>
                            </td>
                            <td className="p-3">
                              <p className="font-mono font-black text-indigo-900 text-[11px] tracking-wide">{cardNum}</p>
                              <p className="text-[10px] text-slate-500 font-mono font-bold">A/C: {accNum}</p>
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-slate-700 uppercase font-mono text-[10.5px]">{holder}</span>
                            </td>
                            <td className="p-3">
                              <p className="font-bold font-mono">মেয়াদ: <span className="text-emerald-700 font-black">{expiry}</span></p>
                              <p className="text-[10px] text-slate-500 font-mono font-bold">CVV: {cvv}</p>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {status === 'active' ? 'Active' : 'Locked'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingCardUser(u);
                                    setEditCardNo(u.ambCardNumber || '');
                                    setEditCardAcc(u.ambAccountNumber || '');
                                    setEditCardHolder(u.ambCardHolderName || u.name || '');
                                    setEditCardExpiry(u.ambCardExpiry || '');
                                    setEditCardCvv(u.ambCardCvv || '');
                                    setEditCardStatus((u.ambCardStatus as 'active' | 'inactive') || 'active');
                                  }}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  ✏️ কাস্টমাইজ করুন
                                </button>
                                <button
                                  onClick={() => handleRenewUserCard(u)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  🔄 1 বছর নবায়ন
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Editing Card overlay modal pop-up */}
            {editingCardUser && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fade-in">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl text-left space-y-4 border border-slate-100">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="font-black text-slate-800 text-sm">
                      💳 ভার্চুয়াল ডেবিট কার্ড কাস্টমাইজেশন খাতা
                    </h3>
                    <button 
                      onClick={() => setEditingCardUser(null)} 
                      className="p-1 hover:bg-slate-100 rounded-full font-bold text-slate-400 hover:text-slate-600 transition"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500">
                    মেম্বার <strong className="text-slate-800">{editingCardUser.name} ({editingCardUser.memberId})</strong> এর কার্ডের তথ্য পরিবর্তন করছেন। পরিবর্তনগুলো সেভ করার সাথে সাথেই তার অ্যাকাউন্টে রিয়েল-টাইমে আপডেট হবে।
                  </p>

                  <form onSubmit={handleSaveCardDetails} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-bold text-slate-600 block">ভার্চুয়াল কার্ড নম্বর</label>
                      <input
                        type="text"
                        required
                        value={editCardNo}
                        onChange={(e) => setEditCardNo(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-mono font-bold text-indigo-950 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10.5px] font-bold text-slate-600 block">ব্যাংক অ্যাকাউন্ট নম্বর</label>
                      <input
                        type="text"
                        required
                        value={editCardAcc}
                        onChange={(e) => setEditCardAcc(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-mono font-bold text-indigo-950 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10.5px] font-bold text-slate-600 block">কার্ডহোল্ডারের নাম</label>
                      <input
                        type="text"
                        required
                        value={editCardHolder}
                        onChange={(e) => setEditCardHolder(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none uppercase"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-600 block">মেয়াদ (Expiry Date)</label>
                        <input
                          type="text"
                          required
                          placeholder="MM/YY"
                          value={editCardExpiry}
                          onChange={(e) => setEditCardExpiry(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-mono font-bold text-center text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-600 block">সিভিভি (CVV)</label>
                        <input
                          type="text"
                          required
                          value={editCardCvv}
                          onChange={(e) => setEditCardCvv(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-mono font-bold text-center text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10.5px] font-bold text-slate-600 block">কার্ড স্ট্যাটাস</label>
                      <select
                        value={editCardStatus}
                        onChange={(e) => setEditCardStatus(e.target.value as 'active' | 'inactive')}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value="active">Active (সক্রিয়)</option>
                        <option value="inactive">Locked (ব্লক / নিষ্ক্রিয়)</option>
                      </select>
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingCardUser(null)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs text-center cursor-pointer transition"
                      >
                        বন্ধ করুন
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs text-center cursor-pointer transition"
                      >
                        ✓ সংরক্ষণ করুন
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Universal Transaction Ledger History micro-management */}
            <div className="bg-slate-955 border border-slate-200/80 rounded-3xl p-6 text-left space-y-4">
              <h3 className="text-sm font-black text-white flex items-center justify-between">
                <span>📑 সার্বজনীন ট্রানজেকশন খতিয়ান ও রেকর্ড সংশোধন প্যানেল</span>
                <span className="text-slate-500 text-xs font-mono">মোট রেকর্ড: {transactions.length} টি</span>
              </h3>
              <p className="text-xs text-slate-500">সদস্যদের সম্পন্ন বা পেন্ডিং ট্রানজেকশন ম্যানুয়ালি এডিট, রিভার্স (Reverse) বা ডিলিট করতে খতিয়ান থেকে সরাসরি নিয়ন্ত্রণ করুন।</p>

              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
                <table className="w-full text-left border-collapse text-xs font-sans">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200/80 font-black">
                      <th className="p-3">তারিখ ও সময়</th>
                      <th className="p-3">মেম্বার</th>
                      <th className="p-3">টাইপ / বিবরণী</th>
                      <th className="p-3">টাকার পরিমাণ</th>
                      <th className="p-3">স্ট্যাটাস</th>
                      <th className="p-3 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {transactions.slice(0, 30).map((tx, idx) => (
                      <tr key={`${tx.id}-${idx}`} className="hover:bg-slate-900/40 transition">
                        <td className="p-3 font-mono text-[10px] text-slate-500">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleString('bn-BD') : '—'}
                        </td>
                        <td className="p-3">
                          <p className="font-extrabold text-white">{tx.userName}</p>
                          <p className="text-[10px] text-slate-450 font-mono font-bold">id: {tx.memberId || 'N/A'}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-slate-600">{tx.typeLabel}</p>
                          <p className="text-[10px] text-slate-450 max-w-[200px] truncate">{tx.description}</p>
                          {tx.billImage && (
                            <button
                              type="button"
                              onClick={() => setPreviewImage(tx.billImage)}
                              className="mt-1 text-[9px] text-pink-400 hover:text-pink-300 font-extrabold flex items-center gap-1 cursor-pointer bg-pink-955/40 px-1.5 py-0.5 rounded border border-pink-900/30"
                            >
                              🖼️ রশিদ দেখুন
                            </button>
                          )}
                        </td>
                        <td className="p-3 font-mono font-black text-indigo-400">
                          ৳{(tx.amount || 0).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            tx.status === 'success' ? 'bg-emerald-950 text-emerald-450' :
                            tx.status === 'pending' ? 'bg-amber-950 text-amber-450' :
                            'bg-rose-950 text-rose-450'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            {/* Toggle/Edit status directly */}
                            <button
                              onClick={async () => {
                                const newStatus = prompt("নতুন স্ট্যাটাস প্রবেশ করান (success, pending, rejected, hold):", tx.status);
                                if (newStatus && ['success', 'pending', 'rejected', 'hold'].includes(newStatus)) {
                                  try {
                                    await setDoc(doc(db, 'transactions', (tx as any).docId || tx.id), { status: newStatus }, { merge: true });
                                    alert("ট্রানজেকশন স্ট্যাটাস সফলভাবে আপডেট করা হয়েছে!");
                                  } catch (err: any) {
                                    alert("ত্রুটি: " + err.message);
                                  }
                                }
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-750 text-slate-600 rounded text-[9px] font-bold cursor-pointer"
                            >
                              ✏️ স্ট্যাটাস
                            </button>

                            {/* Delete/Reverse */}
                            <button
                              onClick={async () => {
                                if (window.confirm("আপনি কি নিশ্চিতভাবে এই ট্রানজেকশনটি সম্পূর্ণ ডিলিট / রিভার্স করতে চান?")) {
                                  try {
                                    const realId = (tx as any).docId || tx.id;
                                    await deleteDoc(doc(db, 'transactions', realId));
                                    if ((tx as any).docId && tx.id && (tx as any).docId !== tx.id) {
                                      await deleteDoc(doc(db, 'transactions', tx.id)).catch(() => {});
                                    }
                                    alert("ট্রানজেকশনটি সফলভাবে রিভার্স / মুছে ফেলা হয়েছে।");
                                  } catch (err: any) {
                                    alert("ত্রুটি: " + err.message);
                                  }
                                }
                              }}
                              className="p-1 text-rose-450 hover:text-rose-400 hover:bg-rose-950/20 rounded cursor-pointer"
                              title="রিভার্স করুন"
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
            </div>

            {/* 🌐 রেমিট্যান্স লাইভ রেট খাতা কাস্টমাইজেশন ম্যানেজার */}
            <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left space-y-6 mt-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-600 animate-spin" style={{ animationDuration: '10s' }} />
                  🌐 গ্লোবাল রেমিট্যান্স রেট খাতা এবং কান্ট্রি ম্যানেজার
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  সদস্যদের মোবাইল ব্যাংকিং পোর্টাল ড্যাশবোর্ডে প্রদর্শিত বৈদেশিক মুদ্রার বিনিময় হার (রেমিট্যান্স রেট) এখান থেকে রিয়েল-টাইমে নিয়ন্ত্রণ করুন। নতুন দেশ যোগ করতে পারেন অথবা যেকোনো দেশের রেট পরিবর্তন/মুছে ফেলতে পারেন।
                </p>
              </div>

              {/* 💸 রেমিট্যান্স ট্রান্সফার ফি / সার্ভিস চার্জ সেটিংস (Transfer Fee / Exchange Charge) */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/90 p-4.5 rounded-2xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <span>⚡ রেমিট্যান্স ট্রান্সফার ফি / সার্ভিস চার্জ (খরচ বাবদ কর্তন)</span>
                      <span className="text-[10px] bg-amber-200/80 text-amber-950 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                        বর্তমান ফি: ৳{appConfig?.remittanceTransferFee ?? 15} টাকা
                      </span>
                    </h4>
                    <p className="text-[11px] text-amber-800/90 font-medium mt-0.5">
                      সদস্যরা বিদেশ থেকে রেমিট্যান্স পাঠালে প্রতি ট্রানজেকশনে নির্ধারিত ট্রান্সফার ফি খরচ বাবদ কাটা হবে (যেমন ১০ টাকা, ১৫ টাকা)। এডমিন চাইলে যেকোনো সময় এই ফি পরিবর্তন করতে পারবেন।
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <input 
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={appConfig?.remittanceTransferFee ?? 15}
                        id="adminRemittanceTransferFeeInput"
                        placeholder="উদাঃ 15"
                        className="w-28 px-3 py-2 bg-white border-2 border-amber-300 focus:border-amber-600 rounded-xl text-xs font-mono font-black text-slate-800 outline-none shadow-2xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-800">BDT</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const input = document.getElementById('adminRemittanceTransferFeeInput') as HTMLInputElement;
                          const newFee = input ? parseFloat(input.value) : 15;
                          if (isNaN(newFee) || newFee < 0) {
                            alert("দয়া করে সঠিক ফি লিখুন (০ বা তার বেশি)।");
                            return;
                          }
                          await setDoc(doc(db, 'system_settings', 'app_config'), { remittanceTransferFee: newFee }, { merge: true });
                          onChangeConfig({ ...appConfig, remittanceTransferFee: newFee });
                          alert(`রেমিট্যান্স ট্রান্সফার ফি সফলভাবে ৳${newFee} BDT নির্ধারণ করা হয়েছে!`);
                        } catch (err: any) {
                          alert("ত্রুটি: " + err.message);
                        }
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" /> ফি সংরক্ষণ করুন
                    </button>
                  </div>
                </div>
              </div>

              {/* Form to add or edit Country */}
              <form onSubmit={handleSaveRemitRate} className="bg-slate-50 border border-slate-150 p-4.5 rounded-2xl space-y-4">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>{editingRemitId ? '📝 রেমিট্যান্স রেট এডিট করুন' : '➕ নতুন রেমিট্যান্স দেশ যোগ করুন'}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
                  {/* Flag */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold block">পতাকা (Emoji Flag)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={remitCountryFlag}
                        onChange={(e) => setRemitCountryFlag(e.target.value)}
                        placeholder="উদাঃ 🇸🇦"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                      />
                      {/* Presets */}
                      <select 
                        className="p-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                        onChange={(e) => setRemitCountryFlag(e.target.value)}
                        value=""
                      >
                        <option value="" disabled>বাছাই...</option>
                        <option value="🇸🇦">🇸🇦 KSA</option>
                        <option value="🇦🇪">🇦🇪 UAE</option>
                        <option value="🇰🇼">🇰🇼 Kuwait</option>
                        <option value="🇧🇭">🇧🇭 Bahrain</option>
                        <option value="🇲🇾">🇲🇾 Malaysia</option>
                        <option value="🇶🇦">🇶🇦 Qatar</option>
                        <option value="🇴🇲">🇴🇲 Oman</option>
                        <option value="🇸🇬">🇸🇬 Singapore</option>
                        <option value="🇺🇸">🇺🇸 USA</option>
                        <option value="🇬🇧">🇬🇧 UK</option>
                        <option value="🇪🇺">🇪🇺 EU</option>
                      </select>
                    </div>
                  </div>

                  {/* Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold block">দেশের নাম ও কারেন্সি</label>
                    <input
                      type="text"
                      value={remitCountryName}
                      onChange={(e) => setRemitCountryName(e.target.value)}
                      placeholder="উদাঃ সৌদি রিয়াল (SAR)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                      required
                    />
                  </div>

                  {/* Remittance Rate in BDT */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-emerald-800 font-extrabold block">প্রবাসী রেমিট্যান্স রেট (BDT)</label>
                      <span className="text-[8.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">+২.৫% প্রণোদনা</span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={remitRateBDT}
                      onChange={(e) => setRemitRateBDT(e.target.value)}
                      placeholder="উদাঃ 32.50"
                      className="w-full px-3 py-2 rounded-xl border border-emerald-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-emerald-50/20"
                      required
                    />
                  </div>

                  {/* Add Money Rate in BDT */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-indigo-800 font-extrabold block">বিদেশ থেকে এড মানি রেট (BDT)</label>
                      <span className="text-[8.5px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">ওয়ালেটে জমা</span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={addMoneyRateBDT}
                      onChange={(e) => setAddMoneyRateBDT(e.target.value)}
                      placeholder="উদাঃ 30.00"
                      className="w-full px-3 py-2 rounded-xl border border-indigo-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-indigo-50/20"
                    />
                  </div>

                  {/* Remit Transfer Fee */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-amber-800 font-extrabold block">ট্রান্সফার ফি / চার্জ (বৈদেশিক কারেন্সি)</label>
                      <span className="text-[8.5px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">উদাঃ 15 SAR</span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={remitTransferFeeVal}
                      onChange={(e) => setRemitTransferFeeVal(e.target.value)}
                      placeholder="উদাঃ 15"
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-amber-50/20"
                    />
                  </div>

                  {/* Multiplier / unit */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold block">কারেন্সি একক টেক্সট</label>
                    <input
                      type="text"
                      value={remitMultiplier}
                      onChange={(e) => setRemitMultiplier(e.target.value)}
                      placeholder="উদাঃ 1 রিয়াল (অথবা ফাঁকা)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>

                  {/* Display order */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold block">সিরিয়াল অর্ডার (Sorting)</label>
                    <input
                      type="number"
                      value={remitOrder}
                      onChange={(e) => setRemitOrder(e.target.value)}
                      placeholder="উদাঃ 1, 2, 3"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  {editingRemitId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRemitId(null);
                        setRemitCountryName('');
                        setRemitCountryFlag('');
                        setRemitRateBDT('');
                        setAddMoneyRateBDT('');
                        setRemitTransferFeeVal('15');
                        setRemitMultiplier('');
                        setRemitOrder('');
                      }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      বাতিল করুন
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={remitSaving}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {remitSaving ? 'সংরক্ষণ হচ্ছে...' : editingRemitId ? 'আপডেট রেট সেভ করুন' : 'নতুন দেশ যুক্ত করুন'}
                  </button>
                </div>
              </form>

              {/* Active rates table */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black border-b border-slate-150">
                    <tr>
                      <th className="p-3">অর্ডার</th>
                      <th className="p-3">পতাকা</th>
                      <th className="p-3">দেশের নাম ও কারেন্সি</th>
                      <th className="p-3">রেমিট্যান্স রেট</th>
                      <th className="p-3">এড মানি রেট</th>
                      <th className="p-3">চার্জ / ফি</th>
                      <th className="p-3 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {remitRates.map((rate, idx) => {
                      const remitVal = Number(rate.remittanceRate || rate.value) || 0;
                      const addVal = Number(rate.addMoneyRate) || (remitVal ? Math.max(0, remitVal - 2.5) : 0);
                      const feeVal = Number(rate.transferFee ?? 15);
                      return (
                        <tr key={`${rate.id}-${idx}`} className="hover:bg-slate-50/50 transition">
                          <td className="p-3 font-mono font-bold text-slate-400">#{rate.order || 0}</td>
                          <td className="p-3 text-2xl">{rate.flag}</td>
                          <td className="p-3 font-bold text-slate-800">
                            {rate.name}
                            {rate.multiplier && <span className="text-[9.5px] text-slate-400 font-normal block">এককঃ {rate.multiplier}</span>}
                          </td>
                          <td className="p-3">
                            <span className="font-mono font-black text-emerald-700 text-sm block">৳ {remitVal.toFixed(2)}</span>
                            <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">+২.৫% প্রণোদনা</span>
                          </td>
                          <td className="p-3">
                            <span className="font-mono font-black text-indigo-700 text-sm block">৳ {addVal.toFixed(2)}</span>
                            <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200">ওয়ালেটে জমা</span>
                          </td>
                          <td className="p-3">
                            <span className="font-mono font-bold text-amber-800 text-xs block">{feeVal}</span>
                            <span className="text-[9px] text-slate-400 font-normal">চার্জ</span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleEditRemitRate(rate)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                ✏️ এডিট
                              </button>
                              <button
                                onClick={() => handleDeleteRemitRate(rate.id)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                ❌ মুছুন
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {remitRates.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">কোনো দেশের রেমিট্যান্স রেট ডেটাবেজে যুক্ত করা নেই।</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 10: BENEVOLENT QARD-E-HASANA WELFARE FUND ADMIN REPLICA & MANAGEMENT */}
    </>
  );
}
