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

export function AdminQardSection(props: any) {
  const {
    adminTab,
    y,
    text,
    left,
    type,
    setQardTickerInput,
    cfgQardTicker,
    setQardShowTickerModal,
    setBannerSubSection,
    setAdminTab,
    getFundValueAndStatus,
    setQardFundInput,
    val,
    setQardShowFundModal,
    setQardShowDirectLoanModal,
    setQardShowDonateModal,
    transactions,
    amount,
    users,
    u,
    description,
    day,
    id,
    monthNamesBn,
    getUserMainWalletBalance,
    targetUser,
    currentDue,
    requestAlert,
    newTx,
    now,
    trxId,
    userId,
    uid,
    name,
    currentBal,
    newBal,
    newDue,
    setTransactions,
    setUsers,
    setIsBulkPenaltyDeducting,
    item,
    curBal,
    setIsDeductingSinglePenalty,
    setIsBulkDeductingQard,
    setIsSendingQardNotice,
    notices,
    key,
    adminGoldLoans,
    qardActiveSection,
    setQardActiveSection,
    list,
    tx,
    openUserEditModal,
    width,
    setQardTenureFilter,
    qardTenureFilter,
    reason,
    img,
    handleApproveTransaction,
    executeRejectTransaction,
    qardGoldFilter,
    qardGoldSearchQuery,
    q,
    alert,
    setQardGoldFilter,
    setQardGoldSearchQuery,
    target,
    isBulkPenaltyDeducting,
    qardCalendarFilter,
    isBulkDeductingQard,
    setQardCalendarFilter,
    setQardCalendarSpecificDay,
    qardCalendarSpecificDay,
    isSendingQardNotice,
    isDeductingSinglePenalty,
    setQardFilterType,
    qardFilterType,
    qardSearchQuery,
    setQardSearchQuery,
    amt,
    setQardEditingTx,
    setQardEditAmt,
    setQardEditStatus,
    setQardEditDesc,
    setQardEditWhatsapp,
    typeLabel,
    year,
    handleOpenAddRuleModal,
    handleSaveQardRulesConfig,
    qardRulesTitle,
    setQardRulesTitle,
    qardRulesSubtitle,
    setQardRulesSubtitle,
    qardReqDays,
    setQardReqDays,
    qardReqTxVol,
    setQardReqTxVol,
    qardRulesList,
    setQardRulesList,
    handleMoveRuleItem,
    handleOpenEditRuleModal,
    handleDeleteRuleItem,
    qardCoopInstantEnabled,
    setQardCoopInstantEnabled,
    qardCoopInstantTitle,
    setQardCoopInstantTitle,
    qardCoopInstantPercent,
    setQardCoopInstantPercent,
    qardCoopInstantMaxDuration,
    setQardCoopInstantMaxDuration,
    qardCoopInstantDesc,
    setQardCoopInstantDesc,
    qardGoldLoanEnabled,
    setQardGoldLoanEnabled,
    qardGoldNoticeTitle,
    setQardGoldNoticeTitle,
    qardGoldNoticeSubtitle,
    setQardGoldNoticeSubtitle,
    qardGoldProtectionMonths,
    setQardGoldProtectionMonths,
    qardGoldProtectionDays,
    setQardGoldProtectionDays,
    qardGoldRateK24,
    setQardGoldRateK24,
    qardGoldRateK22,
    setQardGoldRateK22,
    qardGoldRateK21,
    setQardGoldRateK21,
    qardGoldRateK18,
    setQardGoldRateK18,
    qardGoldRateTraditional,
    setQardGoldRateTraditional,
    qardGoldGuidelines,
    setQardGoldGuidelines,
    updated,
    qardShowTickerModal,
    qardTickerInput,
    handleSaveQardTicker,
    qardShowFundModal,
    qardFundInput,
    handleSaveQardFundVal,
    qardShowDirectLoanModal,
    handleDirectQardLoanDisburse,
    qardDirectUserUid,
    setQardDirectUserUid,
    setQardDirectWhatsapp,
    qardDirectAmt,
    setQardDirectAmt,
    qardDirectDuration,
    setQardDirectDuration,
    qardDirectMonthly,
    setQardDirectMonthly,
    qardDirectWhatsapp,
    qardShowDonateModal,
    handleManualQardDonate,
    qardDonateUserUid,
    setQardDonateUserUid,
    qardDonateAmt,
    setQardDonateAmt,
    qardDonatePurpose,
    setQardDonatePurpose,
    qardDonateAnon,
    setQardDonateAnon,
    qardEditingTx,
    handleUpdateQardTx,
    qardEditAmt,
    qardEditStatus,
    qardEditDesc,
    qardEditWhatsapp,
    qardShowBreakdownModal,
    setQardShowBreakdownModal,
    showRuleModal,
    handleSaveSingleRuleItem,
    editingRuleIndex,
    setShowRuleModal,
    ruleIconInput,
    setRuleIconInput,
    ruleTitleInput,
    setRuleTitleInput,
    ruleDescInput,
    setRuleDescInput,
    ruleIsWarningInput,
    setRuleIsWarningInput
  } = props;

  const [qardSelectedMonth, setQardSelectedMonth] = useState<number>(new Date().getMonth());

  return (
    <>
        {adminTab === 'qard_admin' && (
          <div className="space-y-6 animate-fade-in text-slate-800">
            {/* Admin Control Bar & Title (Slim & High-Density) */}
            <div className="bg-slate-900 border border-slate-700/80 p-3 sm:p-4 rounded-2xl text-left space-y-2.5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-2.5">
                <div>
                  <h2 className="text-sm sm:text-base font-black text-amber-400 flex items-center gap-1.5">
                    🤝 করযে হাসানা বিনা সুদে কল্যাণ ঋণ ফান্ড (এডমিন প্যানেল)
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                    ফান্ড ব্যালেন্স, ঘোষণা, ব্যানার, সুদমুক্ত ঋণ আবেদন, ডাইরেক্ট বিতরণ ও খাতভিত্তিক হিসাব পরিচালনা।
                  </p>
                </div>

                {/* Quick Action Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setQardTickerInput(cfgQardTicker);
                      setQardShowTickerModal(true);
                    }}
                    className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    🔊 ঘোষণা এডিট
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBannerSubSection('qard');
                      setAdminTab('banners_admin');
                    }}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    🖼️ ব্যানার পরিচালনা
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const objQ = getFundValueAndStatus('qard_fund', 0);
                      setQardFundInput(objQ.val.toString());
                      setQardShowFundModal(true);
                    }}
                    className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    💰 ফান্ড ব্যালেন্স এডিট
                  </button>
                  <button
                    type="button"
                    onClick={() => setQardShowDirectLoanModal(true)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    ➕ ডাইরেক্ট ঋণ
                  </button>
                  <button
                    type="button"
                    onClick={() => setQardShowDonateModal(true)}
                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    ❤️ দান রেজিস্টার
                  </button>
                </div>
              </div>
              {/* ==================== 12-CARD UNIFIED GRID & SMART AUTO OPERATIONAL SECTIONS (QARD HASANA) ==================== */}
              {(() => {
                // Filter transactions for Qard Hasana
                const qardTxs = transactions.filter(t => [
                  'qard_donation', 'qard_loan_request', 'qard_loan_disbursment', 'qard_loan_repayment',
                  'coop_loan_apply', 'loan_apply', 'loan_repayment', 'qard_fine', 'qard_penalty_fine', 'qard_withdrawal'
                ].includes(t.type));

                const totalDonations = qardTxs.filter(t => t.type === 'qard_donation' && (t.status === 'success' || t.status === 'approved')).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                const totalDisbursed = qardTxs.filter(t => (t.type === 'qard_loan_disbursment' || t.type === 'qard_loan_request') && (t.status === 'success' || t.status === 'approved')).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                const totalRepaid = qardTxs.filter(t => (t.type === 'qard_loan_repayment' || t.type === 'loan_repayment') && (t.status === 'success' || t.status === 'approved')).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

                const userDueHawlat = users.reduce((sum, u) => sum + Math.max(0, Number(u.dueLoan) || 0), 0);
                const activeLoanBal = userDueHawlat > 0 ? userDueHawlat : Math.max(0, totalDisbursed - totalRepaid);

                const objQard = getFundValueAndStatus('qard_fund', 0);
                const fundTot = objQard.val > 0 ? objQard.val : totalDonations;
                const availableLiquidity = Math.max(0, fundTot - activeLoanBal);

                const donorList = qardTxs.filter(t => t.type === 'qard_donation' && (t.status === 'success' || t.status === 'approved'));

                const getSectorStats = (secId: string) => {
                  const items = donorList.filter(t => {
                    const pId = (t as any).donationPurpose || (t as any).purpose || '';
                    const desc = (t.description || t.details || '').toLowerCase();
                    if (secId === 'medical') return pId === 'medical' || desc.includes('চিকিৎসা') || desc.includes('ঔষধ') || desc.includes('ওষুধ') || desc.includes('রোগী') || desc.includes('medicine');
                    if (secId === 'education') return pId === 'education' || desc.includes('শিক্ষা') || desc.includes('শিক্ষার্থী') || desc.includes('ছাত্র') || desc.includes('education');
                    if (secId === 'micro') return pId === 'micro' || desc.includes('ক্ষুদ্র') || desc.includes('স্বনির্ভর') || desc.includes('ভ্যান') || desc.includes('সেলাই') || desc.includes('micro');
                    if (secId === 'emergency') return pId === 'emergency' || desc.includes('জরুরি') || desc.includes('ত্রাণ') || desc.includes('বন্যা') || desc.includes('দুর্যোগ') || desc.includes('emergency');
                    return pId === 'general' || (!['medical', 'education', 'micro', 'emergency'].some(s => {
                      if (s === 'medical') return desc.includes('চিকিৎসা') || desc.includes('ঔষধ') || desc.includes('ওষুধ') || desc.includes('রোগী') || desc.includes('medicine');
                      if (s === 'education') return desc.includes('শিক্ষা') || desc.includes('শিক্ষার্থী') || desc.includes('ছাত্র') || desc.includes('education');
                      if (s === 'micro') return desc.includes('ক্ষুদ্র') || desc.includes('স্বনির্ভর') || desc.includes('ভ্যান') || desc.includes('সেলাই') || desc.includes('micro');
                      if (s === 'emergency') return desc.includes('জরুরি') || desc.includes('ত্রাণ') || desc.includes('বন্যা') || desc.includes('দুর্যোগ') || desc.includes('emergency');
                      return false;
                    }));
                  });
                  const sumAmt = items.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                  return { count: items.length, amount: sumAmt, items };
                };

                const generalStats = getSectorStats('general');
                const medicalStats = getSectorStats('medical');
                const educationStats = getSectorStats('education');
                const microStats = getSectorStats('micro');
                const emergencyStats = getSectorStats('emergency');

                const pendingQardLoanRequests = transactions.filter(t => (
                  t.type === 'qard_loan_request' || t.type === 'coop_loan_apply' || t.type === 'loan_apply'
                ) && (t.status === 'pending' || !t.status));

                const pendingQardRequestedTotal = pendingQardLoanRequests.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                const samityEligibleUsers = users.filter(u => (Number(u.savings) || 0) > 0);

                // Users with active due loan
                const activeBorrowersList = users.filter(u => (Number(u.dueLoan) || 0) > 0);
                const totalActiveLoansAmt = activeBorrowersList.reduce((sum, u) => sum + (Number(u.dueLoan) || 0), 0);

                const oneMonthBorrowers = activeBorrowersList.filter(u => Number((u as any).instantLoanDurationMonths || (u as any).loanDurationMonths || (u as any).loanDuration || 1) === 1);
                const threeMonthBorrowers = activeBorrowersList.filter(u => Number((u as any).instantLoanDurationMonths || (u as any).loanDurationMonths || (u as any).loanDuration || 1) === 3);

                // Derive daily repayment due schedule based on day of month (1-31) and tenure
                const todayDate = new Date();
                const currentDayOfMonth = todayDate.getDate(); // 1-31
                const currentMonth = todayDate.getMonth();
                const currentYear = todayDate.getFullYear();

                // Compute borrower repayment schedule & overdue fine info
                const scheduleList = activeBorrowersList.map(u => {
                  const dueAmt = Number(u.dueLoan) || 0;
                  const tenureMonths = Number((u as any).instantLoanDurationMonths || (u as any).loanDurationMonths || (u as any).qardDuration || (u as any).loanDuration || (u as any).durationMonths || 1);
                  const tenureLabel = tenureMonths === 3 ? '৩ মাস মেয়াদি (৩ কিস্তি)' : tenureMonths === 1 ? '১ মাস মেয়াদি (৩০ দিন)' : `${tenureMonths} মাস মেয়াদি`;
                  
                  // Repayment Day in Month (1-31) based on exact loan taken date
                  const takenDateStr = (u as any).instantLoanTakenAt || (u as any).lastCoopInstantLoanAt || (u as any).loanTakenAt || (u as any).createdAt;
                  let assignedDueDay = 5;
                  let daysElapsed = 0;
                  if (takenDateStr) {
                    const takenDateObj = new Date(takenDateStr);
                    assignedDueDay = takenDateObj.getDate();
                    daysElapsed = Math.floor((Date.now() - takenDateObj.getTime()) / (1000 * 60 * 60 * 24));
                  } else if ((u as any).loanRepaymentDay) {
                    assignedDueDay = Number((u as any).loanRepaymentDay);
                  }

                  // 30 days deadline: Next month same date
                  const isOverdue = daysElapsed > 30 || (daysElapsed === 0 && currentDayOfMonth > assignedDueDay);
                  const overdueDays = daysElapsed > 30 ? (daysElapsed - 30) : 0;
                  const daysRemaining = isOverdue ? 0 : Math.max(0, 30 - daysElapsed);
                  
                  let diffDays = assignedDueDay - currentDayOfMonth;
                  let isToday = diffDays === 0;
                  let isTomorrow = diffDays === 1;
                  let isYesterday = diffDays === -1;
                  let isUpcoming = diffDays > 1 && diffDays <= 7;

                  // Overdue Penalty Rate: 10 TK per 1000 TK per day late
                  const calculatedPenalty = overdueDays > 0 ? Math.max(10, Math.floor((dueAmt / 1000) * 10 * overdueDays)) : 0;

                  // Date format string
                  const monthNamesBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
                  const nextDueDateStr = `${assignedDueDay}ই ${monthNamesBn[currentMonth]} ${currentYear}`;

                  const mainBal = getUserMainWalletBalance(u);
                  const canAutoDeduct = mainBal >= dueAmt || mainBal >= 500;
                  const canAutoDeductPenalty = overdueDays > 0 && mainBal >= calculatedPenalty;

                  return {
                    user: u,
                    dueAmt,
                    tenureMonths,
                    tenureLabel,
                    assignedDueDay,
                    daysElapsed,
                    daysRemaining,
                    diffDays,
                    isToday,
                    isTomorrow,
                    isYesterday,
                    isOverdue,
                    overdueDays,
                    isUpcoming,
                    calculatedPenalty,
                    nextDueDateStr,
                    mainBal,
                    canAutoDeduct,
                    canAutoDeductPenalty
                  };
                });

                const overdueList = scheduleList.filter(s => s.isOverdue);
                const todayDueList = scheduleList.filter(s => s.isToday);
                const tomorrowDueList = scheduleList.filter(s => s.isTomorrow);
                const yesterdayDueList = scheduleList.filter(s => s.isYesterday);
                const upcomingDueList = scheduleList.filter(s => s.isUpcoming);
                const totalOverduePenaltySum = overdueList.reduce((sum, s) => sum + s.calculatedPenalty, 0);

                // Auto Instant Loan Disburse Handler for Samity Members (50% of savings limit)
                const handleInstantDisburseSamityLoan = async (targetUser: User, maxAutoLoan: number, durationMonths: number = 1) => {
                  try {
                    const memberSavings = Number(targetUser.savings) || 0;
                    const currentDue = Number(targetUser.dueLoan) || 0;

                    if (memberSavings <= 0) {
                      requestAlert('সঞ্চয় নেই', 'এই সদস্যের কোনো সমিতি সঞ্চয় নেই। সঞ্চয়ের ৫০% ঋণ দেওয়া সম্ভব নয়।');
                      return;
                    }

                    if (maxAutoLoan < 100) {
                      requestAlert('অপর্যাপ্ত সীমা', `সর্বনিম্ন ১০০ টাকা ঋণ দেওয়া যাবে। সঞ্চয়ের ৫০% লিমিট: ৳${maxAutoLoan}`);
                      return;
                    }

                    const loanAmount = maxAutoLoan;
                    const tenureText = durationMonths === 3 ? '3 মাস মেয়াদি (3 কিস্তি)' : '1 মাস মেয়াদি (30 দিন)';
                    const repaymentDay = Math.min(28, currentDayOfMonth);

                    // 1. Create Transaction for Instant Disbursment
                    const newTx: any = {
                      id: `qard_inst_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                      trxId: `QARD-${Date.now().toString().slice(-8)}`,
                      type: 'qard_loan_disbursment',
                      userId: targetUser.id || targetUser.uid,
                      userName: targetUser.name,
                      userPhone: targetUser.phone,
                      amount: loanAmount,
                      status: 'success',
                      durationMonths: durationMonths,
                      loanDuration: durationMonths,
                      repaymentDueDay: repaymentDay,
                      category: 'instant_samity_loan',
                      description: `সমিতি সঞ্চয়ের ৫০% ইনস্ট্যান্ট করজে হাসানা ঋণ (৳${memberSavings.toLocaleString('en-US')} সঞ্চয়ের বিপরীতে) - মেয়াদ: ${tenureText}`,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };

                    if (db) {
                      await addDoc(collection(db, 'transactions'), newTx);
                    }

                    // 2. Update User Wallet and Loan Due
                    const currentBal = getUserMainWalletBalance(targetUser);
                    const newBal = currentBal + loanAmount;
                    const newDue = currentDue + loanAmount;

                    if (db) {
                      await updateDoc(doc(db, 'users', targetUser.id || targetUser.uid), {
                        balance: newBal,
                        mainBalance: newBal,
                        dueLoan: newDue,
                        instantLoanDurationMonths: durationMonths,
                        loanDuration: durationMonths,
                        loanRepaymentDay: repaymentDay,
                        lastLoanDate: new Date().toISOString()
                      });
                    }

                    // 3. Update local state
                    setTransactions(prev => [newTx, ...prev]);
                    setUsers(prev => prev.map(u => (u.id === targetUser.id || u.uid === targetUser.uid) ? {
                      ...u,
                      balance: newBal,
                      mainBalance: newBal,
                      dueLoan: newDue,
                      instantLoanDurationMonths: durationMonths,
                      loanDuration: durationMonths
                    } : u));

                    requestAlert('ঋণ বিতরণ সম্পন্ন ⚡', `৳${loanAmount.toLocaleString('en-US')} (${tenureText}) সফলভাবে ${targetUser.name} এর মেইন ওয়ালেটে ক্যাশ ক্রেডিট করা হয়েছে!`);
                  } catch (err: any) {
                    console.error('Instant loan error:', err);
                    requestAlert('ত্রুটি', 'ঋণ বিতরণে সমস্যা: ' + (err?.message || err));
                  }
                };

                // Bulk auto penalty deduct handler
                const handleBulkAutoPenaltyDeduct = async (items: typeof overdueList) => {
                  if (items.length === 0) {
                    requestAlert('কোনো বকেয়া নেই', 'বর্তমানে জরিমানা কর্তনযোগ্য কোনো ওভারডিউ সদস্য নেই।');
                    return;
                  }
                  setIsBulkPenaltyDeducting(true);
                  try {
                    let successCount = 0;
                    for (const item of items) {
                      const u = item.user;
                      const penalty = item.calculatedPenalty;
                      if (penalty <= 0) continue;
                      const curBal = getUserMainWalletBalance(u);
                      if (curBal >= penalty) {
                        const newBal = curBal - penalty;
                        const fineTx: any = {
                          id: `qard_fine_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                          trxId: `FINE-${Date.now().toString().slice(-8)}`,
                          type: 'qard_penalty_fine',
                          category: 'fine',
                          userId: u.id || u.uid,
                          userName: u.name,
                          userPhone: u.phone,
                          amount: penalty,
                          status: 'success',
                          description: `করজে হাসানা ঋণ কিস্তি ওভারডিউ জরিমানা (${item.overdueDays} দিন বিলম্ব - কিস্তি বকেয়া: ৳${item.dueAmt})`,
                          createdAt: new Date().toISOString()
                        };
                        if (db) {
                          await addDoc(collection(db, 'transactions'), fineTx);
                          await updateDoc(doc(db, 'users', u.id || u.uid), {
                            balance: newBal,
                            mainBalance: newBal
                          });
                        }
                        setTransactions(prev => [fineTx, ...prev]);
                        setUsers(prev => prev.map(usr => (usr.id === u.id || usr.uid === u.uid) ? { ...usr, balance: newBal, mainBalance: newBal } : usr));
                        successCount++;
                      }
                    }
                    requestAlert('জরিমানা অটো-কর্তন সম্পন্ন', `${successCount} জন সদস্যের ওয়ালেট থেকে সফলভাবে ওভারডিউ জরিমানা কর্তন করা হয়েছে।`);
                  } catch (err: any) {
                    console.error('Bulk penalty deduct error:', err);
                    requestAlert('ত্রুটি', 'জরিমানা কর্তনে সমস্যা: ' + (err?.message || err));
                  } finally {
                    setIsBulkPenaltyDeducting(false);
                  }
                };

                // Single auto penalty deduct handler
                const handleSingleAutoPenaltyDeduct = async (targetUser: User, penaltyAmt: number, lateDays: number) => {
                  if (penaltyAmt <= 0) return;
                  setIsDeductingSinglePenalty(targetUser.id || targetUser.uid);
                  try {
                    const curBal = getUserMainWalletBalance(targetUser);
                    if (curBal < penaltyAmt) {
                      requestAlert('অপর্যাপ্ত ব্যালেন্স', `${targetUser.name} এর মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই (ব্যালেন্স: ৳${curBal}, জরিমানা: ৳${penaltyAmt})`);
                      return;
                    }
                    const newBal = curBal - penaltyAmt;
                    const fineTx: any = {
                      id: `qard_fine_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                      trxId: `FINE-${Date.now().toString().slice(-8)}`,
                      type: 'qard_penalty_fine',
                      category: 'fine',
                      userId: targetUser.id || targetUser.uid,
                      userName: targetUser.name,
                      userPhone: targetUser.phone,
                      amount: penaltyAmt,
                      status: 'success',
                      description: `করজে হাসানা ঋণ ওভারডিউ জরিমানা (${lateDays} দিন বিলম্ব)`,
                      createdAt: new Date().toISOString()
                    };
                    if (db) {
                      await addDoc(collection(db, 'transactions'), fineTx);
                      await updateDoc(doc(db, 'users', targetUser.id || targetUser.uid), {
                        balance: newBal,
                        mainBalance: newBal
                      });
                    }
                    setTransactions(prev => [fineTx, ...prev]);
                    setUsers(prev => prev.map(u => (u.id === targetUser.id || u.uid === targetUser.uid) ? { ...u, balance: newBal, mainBalance: newBal } : u));
                    requestAlert('জরিমানা কর্তন সম্পন্ন', `${targetUser.name} এর ওয়ালেট থেকে ৳${penaltyAmt} জরিমানা কর্তন করা হয়েছে।`);
                  } catch (err: any) {
                    console.error('Single penalty error:', err);
                    requestAlert('ত্রুটি', 'জরিমানা কর্তনে সমস্যা: ' + (err?.message || err));
                  } finally {
                    setIsDeductingSinglePenalty(null);
                  }
                };

                // Bulk deduct all due loans
                const handleBulkDeductAllDue = async (targetItems: typeof scheduleList) => {
                  if (targetItems.length === 0) {
                    requestAlert('কোনো তালিকা নেই', 'কর্তনযোগ্য কোনো ঋণগ্রহীতা পাওয়া যায়নি।');
                    return;
                  }
                  setIsBulkDeductingQard(true);
                  try {
                    let deductedCount = 0;
                    for (const item of targetItems) {
                      const u = item.user;
                      const curDue = item.dueAmt;
                      const curBal = getUserMainWalletBalance(u);
                      if (curDue <= 0 || curBal <= 0) continue;
                      const deductAmount = Math.min(curDue, curBal);
                      const newBal = curBal - deductAmount;
                      const newDue = curDue - deductAmount;

                      const repayTx: any = {
                        id: `qard_repay_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                        trxId: `REPAY-${Date.now().toString().slice(-8)}`,
                        type: 'qard_loan_repayment',
                        userId: u.id || u.uid,
                        userName: u.name,
                        userPhone: u.phone,
                        amount: deductAmount,
                        status: 'success',
                        description: `করজে হাসানা ঋণ কিস্তি অটো কর্তন (${deductAmount === curDue ? 'সম্পূর্ণ পরিশোধ' : 'আংশিক পরিশোধ'})`,
                        createdAt: new Date().toISOString()
                      };

                      if (db) {
                        await addDoc(collection(db, 'transactions'), repayTx);
                        await updateDoc(doc(db, 'users', u.id || u.uid), {
                          balance: newBal,
                          mainBalance: newBal,
                          dueLoan: newDue,
                          paidLoan: (Number(u.paidLoan) || 0) + deductAmount
                        });
                      }

                      setTransactions(prev => [repayTx, ...prev]);
                      setUsers(prev => prev.map(usr => (usr.id === u.id || usr.uid === u.uid) ? {
                        ...usr,
                        balance: newBal,
                        mainBalance: newBal,
                        dueLoan: newDue,
                        paidLoan: (Number(usr.paidLoan) || 0) + deductAmount
                      } : usr));

                      deductedCount++;
                    }
                    requestAlert('কিস্তি অটো-কর্তন সম্পন্ন', `${deductedCount} জন সদস্যের ওয়ালেট থেকে ঋণ কিস্তি সফলভাবে সমন্বয় করা হয়েছে।`);
                  } catch (err: any) {
                    console.error('Bulk deduct due error:', err);
                    requestAlert('ত্রুটি', 'কিস্তি কর্তনে সমস্যা: ' + (err?.message || err));
                  } finally {
                    setIsBulkDeductingQard(false);
                  }
                };

                // Send single SMS/Push notification for due loan
                const handleSendSingleNotice = async (targetUser: User, dueAmt: number, dueDateStr: string) => {
                  setIsSendingQardNotice(targetUser.id || targetUser.uid);
                  try {
                    const noticeText = `প্রিয় ${targetUser.name}, করজে হাসানা সুদমুক্ত ঋণ কিস্তি বাবদ আপনার ৳${dueAmt.toLocaleString('en-US')} বকেয়া রয়েছে (পরিশোধের তারিখ: ${dueDateStr})। জরিমানা এড়াতে মেইন ওয়ালেটে ব্যালেন্স রাখুন বা পরিশোধ করুন।`;
                    if (db) {
                      await addDoc(collection(db, 'notices'), {
                        userId: targetUser.id || targetUser.uid,
                        title: '⚠️ করজে হাসানা কিস্তি পরিশোধ তাগাদা',
                        content: noticeText,
                        type: 'loan_reminder',
                        isRead: false,
                        createdAt: new Date().toISOString()
                      });
                    }
                    requestAlert('তাগাদা পাঠানো হয়েছে', `${targetUser.name} (${targetUser.phone}) এর ইনবক্সে তাগাদা নোটিশ সফলভাবে পাঠানো হয়েছে।`);
                  } catch (err: any) {
                    console.error('Notice error:', err);
                    requestAlert('ত্রুটি', 'নোটিশ পাঠাতে সমস্যা: ' + (err?.message || err));
                  } finally {
                    setIsSendingQardNotice(null);
                  }
                };

                const cardItems = [
                  // ROW 1: 4 Cards (Master Funds & Core Operations)
                  {
                    key: 'main_fund',
                    title: '1. মোট মূল তহবিল',
                    sub: 'সর্বমোট সংগৃহীত ফান্ড',
                    amount: fundTot,
                    isCurrency: true,
                    countText: `${donorList.length} টি দান`,
                    color: 'emerald',
                    icon: '💰',
                    textColor: 'text-emerald-400',
                    badge: 'bg-emerald-500/20 text-emerald-300'
                  },
                  {
                    key: 'active_loans',
                    title: '2. চলতি ঋণ (হাওলাত)',
                    sub: 'সদস্যদের কাছে বকেয়া',
                    amount: activeLoanBal,
                    isCurrency: true,
                    countText: `${activeBorrowersList.length} জন গ্রহীতা`,
                    color: 'amber',
                    icon: '👥',
                    textColor: 'text-amber-400',
                    badge: 'bg-amber-500/20 text-amber-300'
                  },
                  {
                    key: 'liquidity',
                    title: '3. বর্তমান লিকুইডিটি',
                    sub: 'মজুত অবশিষ্ট নগদ ব্যালেন্স',
                    amount: availableLiquidity,
                    isCurrency: true,
                    countText: 'নগদ মজুত',
                    color: 'sky',
                    icon: '💧',
                    textColor: 'text-sky-400',
                    badge: 'bg-sky-500/20 text-sky-300'
                  },
                  {
                    key: 'applications',
                    title: '4. ১. সাধারণ ঋণ আবেদন',
                    sub: '১ ও ৩ মাস মেয়াদি যাচাই',
                    amount: pendingQardRequestedTotal,
                    isCurrency: true,
                    countText: `${pendingQardLoanRequests.length} টি আবেদন`,
                    color: 'blue',
                    icon: '📋',
                    textColor: 'text-blue-400',
                    badge: pendingQardLoanRequests.length > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-blue-500/20 text-blue-300'
                  },

                  // ROW 2: 4 Cards (Welfare & Sector-wise Funds)
                  {
                    key: 'general',
                    title: '5. সাধারণ করযে হাসানা 🤝',
                    sub: 'সুদমুক্ত ঋণ বিতরণ ফান্ড',
                    amount: generalStats.amount,
                    isCurrency: true,
                    countText: `${generalStats.count} জন দাতা`,
                    color: 'teal',
                    icon: '🤝',
                    textColor: 'text-teal-300',
                    badge: 'bg-teal-500/20 text-teal-300'
                  },
                  {
                    key: 'medical',
                    title: '6. চিকিৎসা সহায়তা খাত 🩺',
                    sub: 'রোগী ও ঔষধ সাহায্য',
                    amount: medicalStats.amount,
                    isCurrency: true,
                    countText: `${medicalStats.count} জন দাতা`,
                    color: 'rose',
                    icon: '🩺',
                    textColor: 'text-rose-400',
                    badge: 'bg-rose-500/20 text-rose-300'
                  },
                  {
                    key: 'education',
                    title: '7. দরিদ্র শিক্ষার্থী শিক্ষা 🎓',
                    sub: 'শিক্ষা উপকরণ ও মেধা বিকাশ',
                    amount: educationStats.amount,
                    isCurrency: true,
                    countText: `${educationStats.count} জন দাতা`,
                    color: 'indigo',
                    icon: '🎓',
                    textColor: 'text-indigo-400',
                    badge: 'bg-indigo-500/20 text-indigo-300'
                  },
                  {
                    key: 'micro',
                    title: '8. ক্ষুদ্র স্বনির্ভর ব্যবসা 🚜',
                    sub: 'ভ্যান / সেলাই মেশিন অনুদান',
                    amount: microStats.amount,
                    isCurrency: true,
                    countText: `${microStats.count} জন দাতা`,
                    color: 'cyan',
                    icon: '🚜',
                    textColor: 'text-cyan-400',
                    badge: 'bg-cyan-500/20 text-cyan-300'
                  },

                  // ROW 3: 4 Cards (Emergency, Samity Instant, Gold Loan, Schedule Calendar & Ledger)
                  {
                    key: 'emergency',
                    title: '9. জরুরি মানবিক ও ত্রাণ 🚨',
                    sub: 'বন্যা ও দুর্যোগ পুনর্বাসন',
                    amount: emergencyStats.amount,
                    isCurrency: true,
                    countText: `${emergencyStats.count} জন দাতা`,
                    color: 'orange',
                    icon: '🚨',
                    textColor: 'text-orange-400',
                    badge: 'bg-orange-500/20 text-orange-300'
                  },
                  {
                    key: 'samity_auto',
                    title: '10. ২. সমিতি ইনস্ট্যান্ট ঋণ ⚡',
                    sub: '৫০% সঞ্চয় লিমিট ১-ক্লিক',
                    amount: '৫০% সঞ্চয়',
                    isCurrency: false,
                    countText: `${samityEligibleUsers.length} জন যোগ্য`,
                    color: 'emerald',
                    icon: '⚡',
                    textColor: 'text-emerald-300',
                    badge: 'bg-emerald-500/20 text-emerald-300'
                  },
                  {
                    key: 'gold_loan',
                    title: '11. ৩. স্বর্ণ লোন ও ভল্ট 💎',
                    sub: '১০০% বাজারমূল্য ও ভল্ট',
                    amount: adminGoldLoans.reduce((sum, g) => sum + (Number(g.requestedAmount || g.disbursedAmount || g.estimatedMarketValue) || 0), 0),
                    isCurrency: true,
                    countText: `${adminGoldLoans.length} টি লোন`,
                    color: 'amber',
                    icon: '💎',
                    textColor: 'text-amber-400',
                    badge: 'bg-amber-500/20 text-amber-300'
                  },
                  {
                    key: 'calendar',
                    title: '12. ৪. মেয়াদ, শিডিউল ও লেজার 📅',
                    sub: 'অটো জরিমানা ও খতিয়ান',
                    amount: totalActiveLoansAmt,
                    isCurrency: true,
                    countText: overdueList.length > 0 ? `${overdueList.length} জন বকেয়া` : `${scheduleList.length} জন`,
                    color: 'purple',
                    icon: '📅',
                    textColor: 'text-purple-300',
                    badge: overdueList.length > 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-purple-500/20 text-purple-300'
                  }
                ];

                return (
                  <div className="space-y-3 pt-0.5">
                    {/* Header Bar */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                        <span>📊 করযে হাসানা ১২টি পূর্ণাঙ্গ সেকশন কন্ট্রোল হাব (১ লাইনে ৪টি):</span>
                      </span>
                      <span className="text-[9.5px] text-slate-400 font-bold bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                        যেকোনো সেকশনে ট্যাপ করলে নিচে বিস্তারিত পেজ ওপেন হবে
                      </span>
                    </div>

                    {/* 12-Card Grid: 4 Columns on all screen sizes */}
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                      {cardItems.map((card) => {
                        const isActive = qardActiveSection === card.key || (card.key === 'calendar' && qardActiveSection === 'ledger');
                        return (
                          <div
                            key={card.key}
                            onClick={() => {
                              setQardActiveSection(card.key);
                            }}
                            className={`border p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer select-none active:scale-98 flex flex-col justify-between min-h-[60px] sm:min-h-[68px] ${
                              isActive
                                ? 'bg-slate-900 ring-2 ring-amber-400 border-amber-400 shadow-md shadow-amber-500/20 scale-[1.01]'
                                : 'bg-slate-900/60 hover:bg-slate-900/90 border-slate-700/60 hover:border-slate-500 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-[8px] sm:text-[9.5px] font-bold truncate leading-tight flex items-center gap-1 ${
                                isActive ? 'text-amber-300' : 'text-slate-200'
                              }`}>
                                <span>{card.icon}</span>
                                <span className="truncate">{card.title}</span>
                              </span>
                              <span className={`text-[7px] sm:text-[8px] font-bold px-1 py-0.5 rounded shrink-0 ${
                                isActive ? 'bg-amber-400 text-slate-950 font-black' : card.badge
                              }`}>
                                {card.countText}
                              </span>
                            </div>
                            <div className="mt-1">
                              <span className={`text-xs sm:text-sm font-mono font-black ${
                                isActive ? 'text-amber-300' : card.textColor
                              } block leading-tight`}>
                                {card.isCurrency ? `৳ ${(card.amount as number).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : card.amount}
                              </span>
                              <span className="text-[7px] sm:text-[8px] text-slate-400 font-medium block mt-0.5 truncate">
                                {card.sub}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ========================================================
                        SECTION: 💰 ১. মোট মূল তহবিল ও ক্যাশ ফ্লো অডিট (MAIN FUND)
                       ======================================================== */}
                    {qardActiveSection === 'main_fund' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-emerald-300 shadow-2xs space-y-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                              💰 1. করজে হাসানা মোট মূল তহবিল ও ক্যাশ ফ্লো অডিট
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                              সর্বমোট সংগৃহীত অনুদান, তহবিল জমা ও হিসাব খতিয়ান
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const objQ = getFundValueAndStatus('qard_fund', 0);
                                setQardFundInput(objQ.val.toString());
                                setQardShowFundModal(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                            >
                              💰 তহবিল ব্যালেন্স এডিট
                            </button>
                            <button
                              type="button"
                              onClick={() => setQardShowDonateModal(true)}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                            >
                              ❤️ নতুন দান রেজিস্টার
                            </button>
                          </div>
                        </div>

                        {/* Top Summary Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-emerald-800 font-bold block">মোট মূল তহবিল</span>
                            <span className="text-sm sm:text-base font-mono font-black text-emerald-700">৳ {fundTot.toLocaleString('en-US')}</span>
                          </div>
                          <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-amber-800 font-bold block">চলতি ঋণ (হাওলাত)</span>
                            <span className="text-sm sm:text-base font-mono font-black text-amber-700">৳ {activeLoanBal.toLocaleString('en-US')}</span>
                          </div>
                          <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-sky-800 font-bold block">অবশিষ্ট নগদ মজুত</span>
                            <span className="text-sm sm:text-base font-mono font-black text-sky-700">৳ {availableLiquidity.toLocaleString('en-US')}</span>
                          </div>
                          <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-purple-800 font-bold block">মোট দান সংগ্রহ</span>
                            <span className="text-sm sm:text-base font-mono font-black text-purple-700">{donorList.length} টি রেকর্ড</span>
                          </div>
                        </div>

                        {/* Donor list table */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-800">📋 তহবিল জমাকারী ও দাতাদের সম্পূর্ণ খতিয়ান ({donorList.length} জন):</span>
                          </div>
                          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                            {donorList.length === 0 ? (
                              <div className="p-6 text-center text-slate-400 text-xs font-bold">কোনো দানের রেকর্ড পাওয়া যায়নি</div>
                            ) : (
                              donorList.map((tx, idx) => (
                                <div key={tx.id || idx} className="p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[9px] font-bold inline-flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </span>
                                    <div>
                                      <span className="font-black text-slate-900 block">{tx.senderName || tx.userName || 'দাতা সদস্য'}</span>
                                      <span className="text-[10px] text-slate-500 font-mono">{tx.senderPhone || tx.userPhone || '—'} • {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('bn-BD') : 'আজ'}</span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-mono font-black text-emerald-700 block">৳ {(Number(tx.amount) || 0).toLocaleString('en-US')}</span>
                                    <span className="text-[9px] text-slate-400">{tx.description || 'করজে হাসানা অনুদান'}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ========================================================
                        SECTION: 👥 ২. সদস্যদের কাছে চলতি ঋণ (হাওলাত) রেজিস্টার (ACTIVE LOANS)
                       ======================================================== */}
                    {qardActiveSection === 'active_loans' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-amber-300 shadow-2xs space-y-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                              👥 2. সদস্যদের কাছে চলতি ঋণ (হাওলাত) ও বকেয়া রেজিস্টার ({activeBorrowersList.length} জন)
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                              চলতি ঋণগ্রহীতাদের তালিকা, বকেয়া হাওলাত ও কিস্তি পরিশোধ স্ট্যাটাস
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setQardShowDirectLoanModal(true)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                            >
                              ➕ নতুন ঋণ প্রদান
                            </button>
                            <button
                              type="button"
                              onClick={() => setQardActiveSection('calendar')}
                              className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                            >
                              📅 কিস্তি শিডিউল
                            </button>
                          </div>
                        </div>

                        {/* Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-amber-800 font-bold block">মোট চলতি ঋণ বকেয়া</span>
                            <span className="text-sm sm:text-base font-mono font-black text-amber-700">৳ {totalActiveLoansAmt.toLocaleString('en-US')}</span>
                          </div>
                          <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-rose-800 font-bold block">ওভারডিউ বকেয়া গ্রহীতা</span>
                            <span className="text-sm sm:text-base font-mono font-black text-rose-700">{overdueList.length} জন</span>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl col-span-2 sm:col-span-1">
                            <span className="text-[10px] text-blue-800 font-bold block">আজকের পরিশোধ শিডিউল</span>
                            <span className="text-sm sm:text-base font-mono font-black text-blue-700">{todayDueList.length} জন</span>
                          </div>
                        </div>

                        {/* Borrowers list */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                          {activeBorrowersList.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-xs font-bold">বর্তমানে কোনো সদস্যের বকেয়া ঋণ নেই</div>
                          ) : (
                            activeBorrowersList.map((u, idx) => (
                              <div key={u.id || idx} className="p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-mono text-[9px] font-bold inline-flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div className="truncate">
                                    <span className="font-black text-slate-900 block truncate">{u.name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono truncate">{u.phone} • আইডি: {u.memberId || u.id}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 flex items-center gap-2">
                                  <div>
                                    <span className="font-mono font-black text-rose-700 block">৳ {(Number(u.dueLoan) || 0).toLocaleString('en-US')}</span>
                                    <span className="text-[9px] text-slate-400">বকেয়া ঋণ</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openUserEditModal(u)}
                                    className="text-[10px] bg-slate-800 hover:bg-slate-900 text-white font-bold px-2 py-1 rounded-lg"
                                  >
                                    প্রোফাইল
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* ========================================================
                        SECTION: 💧 ৩. বর্তমান লিকুইডিটি ও নগদ তহবিল মজুত অডিট (LIQUIDITY)
                       ======================================================== */}
                    {qardActiveSection === 'liquidity' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-sky-300 shadow-2xs space-y-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                              💧 3. করজে হাসানা লিকুইডিটি ও নগদ তহবিল মজুত অডিট
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                              হাতে মজুত নগদ ব্যালেন্স ও বিতরণযোগ্য উদ্বৃত্ত তহবিল
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const objQ = getFundValueAndStatus('qard_fund', 0);
                                setQardFundInput(objQ.val.toString());
                                setQardShowFundModal(true);
                              }}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                            >
                              💰 নগদ তহবিল রি-ব্যালেন্স
                            </button>
                          </div>
                        </div>

                        {/* Liquidity Breakdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl text-center">
                            <span className="text-xs text-sky-800 font-bold block">বর্তমান লিকুইডিটি (নগদ মজুত)</span>
                            <span className="text-lg sm:text-xl font-mono font-black text-sky-700 mt-1 block">৳ {availableLiquidity.toLocaleString('en-US')}</span>
                            <span className="text-[10px] text-sky-600 font-medium mt-1 block">তাত্ক্ষণিক ঋণ বিতরণযোগ্য</span>
                          </div>
                          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                            <span className="text-xs text-emerald-800 font-bold block">মোট মূল তহবিল</span>
                            <span className="text-lg sm:text-xl font-mono font-black text-emerald-700 mt-1 block">৳ {fundTot.toLocaleString('en-US')}</span>
                            <span className="text-[10px] text-emerald-600 font-medium mt-1 block">সর্বমোট সংগৃহীত সম্পদ</span>
                          </div>
                          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
                            <span className="text-xs text-amber-800 font-bold block">মাঠে চলতি ঋণ (হাওলাত)</span>
                            <span className="text-lg sm:text-xl font-mono font-black text-amber-700 mt-1 block">৳ {activeLoanBal.toLocaleString('en-US')}</span>
                            <span className="text-[10px] text-amber-600 font-medium mt-1 block">সদস্যদের কাছে বকেয়া</span>
                          </div>
                        </div>

                        {/* Health Index Bar */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>লিকুইডিটি স্বাস্থ্য অনুপাত:</span>
                            <span className="text-emerald-700 font-mono font-black">
                              {fundTot > 0 ? `${((availableLiquidity / fundTot) * 100).toFixed(1)}%` : '100%'} নিরাপদ মজুত
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden flex">
                            <div
                              className="bg-sky-500 h-full transition-all"
                              style={{ width: `${fundTot > 0 ? Math.min(100, (availableLiquidity / fundTot) * 100) : 100}%` }}
                            />
                            <div
                              className="bg-amber-500 h-full transition-all"
                              style={{ width: `${fundTot > 0 ? Math.min(100, (activeLoanBal / fundTot) * 100) : 0}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                            <span className="text-sky-600">💧 নগদ মজুত (নীল)</span>
                            <span className="text-amber-600">👥 মাঠে ঋণ (হলুদ)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ========================================================
                        SECTION: 🤝 ৫. সাধারণ করযে হাসানা ফান্ড (GENERAL WELFARE)
                       ======================================================== */}
                    {qardActiveSection === 'general' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-teal-300 shadow-2xs space-y-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                              🤝 5. সাধারণ করযে হাসানা ফান্ড (সুদমুক্ত কল্যাণ ঋণ খাত)
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                              বিনা সুদে ঋণ বিতরণ ও সাধারণ দানকারীদের তালিকা
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQardShowDonateModal(true)}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                          >
                            ❤️ সাধারণ ফান্ডে দান যুক্ত করুন
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-teal-50 border border-teal-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-teal-800 font-bold block">মোট সাধারণ ফান্ড</span>
                            <span className="text-base font-mono font-black text-teal-700">৳ {generalStats.amount.toLocaleString('en-US')}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-slate-700 font-bold block">মোট দাতা সংখ্যা</span>
                            <span className="text-base font-mono font-black text-slate-800">{generalStats.count} জন দাতা</span>
                          </div>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                          {generalStats.items.length === 0 ? (
                            <div className="p-5 text-center text-slate-400 text-xs font-bold">এই খাতে কোনো দানের রেকর্ড নেই</div>
                          ) : (
                            generalStats.items.map((tx, idx) => (
                              <div key={tx.id || idx} className="p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-black text-slate-900 block">{tx.senderName || tx.userName || 'সাধারণ দাতা'}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{tx.senderPhone || tx.userPhone || '—'} • {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('bn-BD') : 'আজ'}</span>
                                </div>
                                <span className="font-mono font-black text-teal-700">৳ {(Number(tx.amount) || 0).toLocaleString('en-US')}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* ========================================================
                        SECTION: 🩺 ৬. চিকিৎসা সহায়তা খাত (MEDICAL WELFARE)
                       ======================================================== */}
                    {qardActiveSection === 'medical' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-rose-300 shadow-2xs space-y-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                              🩺 6. চিকিৎসা সহায়তা খাত (মুমূর্ষু ও অসুস্থদের ঔষধ অনুদান)
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                              অসুস্থ ও অসহায় সদস্যদের চিকিৎসা সহায়তা ও অনুদান খতিয়ান
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQardShowDonateModal(true)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                          >
                            ❤️ চিকিৎসা ফান্ডে দান যুক্ত করুন
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-rose-800 font-bold block">মোট চিকিৎসা ফান্ড</span>
                            <span className="text-base font-mono font-black text-rose-700">৳ {medicalStats.amount.toLocaleString('en-US')}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-slate-700 font-bold block">মোট দাতা সংখ্যা</span>
                            <span className="text-base font-mono font-black text-slate-800">{medicalStats.count} জন দাতা</span>
                          </div>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                          {medicalStats.items.length === 0 ? (
                            <div className="p-5 text-center text-slate-400 text-xs font-bold">এই খাতে কোনো দানের রেকর্ড নেই</div>
                          ) : (
                            medicalStats.items.map((tx, idx) => (
                              <div key={tx.id || idx} className="p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-black text-slate-900 block">{tx.senderName || tx.userName || 'চিকিৎসা দাতা'}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{tx.senderPhone || tx.userPhone || '—'} • {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('bn-BD') : 'আজ'}</span>
                                </div>
                                <span className="font-mono font-black text-rose-700">৳ {(Number(tx.amount) || 0).toLocaleString('en-US')}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* ========================================================
                        SECTION: 🎓 ৭. দরিদ্র শিক্ষার্থীদের শিক্ষা ফান্ড (EDUCATION)
                       ======================================================== */}
                    {qardActiveSection === 'education' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-indigo-300 shadow-2xs space-y-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                              🎓 7. দরিদ্র শিক্ষার্থীদের শিক্ষা ফান্ড (বৃত্তি ও উপকরণ)
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                              অসচ্ছল ও মেধাবী শিক্ষার্থীদের বই, খাতা ও শিক্ষা বৃত্তি সহায়তা
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQardShowDonateModal(true)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                          >
                            ❤️ শিক্ষা ফান্ডে দান যুক্ত করুন
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-indigo-800 font-bold block">মোট শিক্ষা ফান্ড</span>
                            <span className="text-base font-mono font-black text-indigo-700">৳ {educationStats.amount.toLocaleString('en-US')}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-slate-700 font-bold block">মোট দাতা সংখ্যা</span>
                            <span className="text-base font-mono font-black text-slate-800">{educationStats.count} জন দাতা</span>
                          </div>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                          {educationStats.items.length === 0 ? (
                            <div className="p-5 text-center text-slate-400 text-xs font-bold">এই খাতে কোনো দানের রেকর্ড নেই</div>
                          ) : (
                            educationStats.items.map((tx, idx) => (
                              <div key={tx.id || idx} className="p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-black text-slate-900 block">{tx.senderName || tx.userName || 'শিক্ষা দাতা'}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{tx.senderPhone || tx.userPhone || '—'} • {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('bn-BD') : 'আজ'}</span>
                                </div>
                                <span className="font-mono font-black text-indigo-700">৳ {(Number(tx.amount) || 0).toLocaleString('en-US')}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* ========================================================
                        SECTION: 🚜 ৮. ক্ষুদ্র স্বনির্ভর ব্যবসা ফান্ড (MICRO BUSINESS)
                       ======================================================== */}
                    {qardActiveSection === 'micro' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-cyan-300 shadow-2xs space-y-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                              🚜 8. ক্ষুদ্র স্বনির্ভর ব্যবসা ফান্ড (ভ্যান / সেলাই মেশিন)
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                              হতদরিদ্রদের আত্মকর্মসংস্থান ও ক্ষুদ্র উপকরণ প্রদান রেজিস্টার
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQardShowDonateModal(true)}
                            className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                          >
                            ❤️ ক্ষুদ্র ব্যবসা ফান্ডে দান যুক্ত করুন
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-cyan-50 border border-cyan-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-cyan-800 font-bold block">মোট স্বনির্ভর ফান্ড</span>
                            <span className="text-base font-mono font-black text-cyan-700">৳ {microStats.amount.toLocaleString('en-US')}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-slate-700 font-bold block">মোট দাতা সংখ্যা</span>
                            <span className="text-base font-mono font-black text-slate-800">{microStats.count} জন দাতা</span>
                          </div>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                          {microStats.items.length === 0 ? (
                            <div className="p-5 text-center text-slate-400 text-xs font-bold">এই খাতে কোনো দানের রেকর্ড নেই</div>
                          ) : (
                            microStats.items.map((tx, idx) => (
                              <div key={tx.id || idx} className="p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-black text-slate-900 block">{tx.senderName || tx.userName || 'স্বনির্ভর দাতা'}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{tx.senderPhone || tx.userPhone || '—'} • {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('bn-BD') : 'আজ'}</span>
                                </div>
                                <span className="font-mono font-black text-cyan-700">৳ {(Number(tx.amount) || 0).toLocaleString('en-US')}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* ========================================================
                        SECTION: 🚨 ৯. জরুরি মানবিক ও দুর্যোগ ত্রাণ ফান্ড (EMERGENCY)
                       ======================================================== */}
                    {qardActiveSection === 'emergency' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-orange-300 shadow-2xs space-y-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                              🚨 9. জরুরি মানবিক ও দুর্যোগ ত্রাণ ফান্ড
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                              বন্যা, দুর্যোগ ও আকস্মিক দুর্ঘটনায় জরুরি ত্রাণ ও পুনর্বাসন
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQardShowDonateModal(true)}
                            className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                          >
                            ❤️ ত্রাণ ফান্ডে দান যুক্ত করুন
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-orange-50 border border-orange-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-orange-800 font-bold block">মোট জরুরি ত্রাণ ফান্ড</span>
                            <span className="text-base font-mono font-black text-orange-700">৳ {emergencyStats.amount.toLocaleString('en-US')}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                            <span className="text-[10px] text-slate-700 font-bold block">মোট দাতা সংখ্যা</span>
                            <span className="text-base font-mono font-black text-slate-800">{emergencyStats.count} জন দাতা</span>
                          </div>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                          {emergencyStats.items.length === 0 ? (
                            <div className="p-5 text-center text-slate-400 text-xs font-bold">এই খাতে কোনো দানের রেকর্ড নেই</div>
                          ) : (
                            emergencyStats.items.map((tx, idx) => (
                              <div key={tx.id || idx} className="p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-black text-slate-900 block">{tx.senderName || tx.userName || 'ত্রাণ দাতা'}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{tx.senderPhone || tx.userPhone || '—'} • {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('bn-BD') : 'আজ'}</span>
                                </div>
                                <span className="font-mono font-black text-orange-700">৳ {(Number(tx.amount) || 0).toLocaleString('en-US')}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

{/* ========================================================
                        SECTION 1: 📋 নতুন ঋণ আবেদন ও যাচাই
                       ======================================================== */}
                    {qardActiveSection === 'applications' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                              📋 1. করজে হাসানা ঋণ আবেদন ও যাচাই ({pendingQardLoanRequests.length} টি অপেক্ষমাণ আবেদন)
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                              1 মাস ও 3 মাস মেয়াদে নেওয়া আবেদনসমূহ যাচাই, গ্রহণের তারিখ ও সরাসরি অনুমোদন করুন
                            </span>
                          </div>

                          {/* Tenure Filter for Applications */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setQardTenureFilter('all')}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                qardTenureFilter === 'all'
                                  ? 'bg-slate-900 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              সকল ({pendingQardLoanRequests.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setQardTenureFilter('1month')}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                qardTenureFilter === '1month'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              1 মাস মেয়াদি ({pendingQardLoanRequests.filter(t => (t as any).durationMonths === 1 || (t as any).loanDuration === 1 || !(t as any).durationMonths || (t as any).durationMonths === '1').length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setQardTenureFilter('3months')}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                qardTenureFilter === '3months'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              3 মাস মেয়াদি ({pendingQardLoanRequests.filter(t => (t as any).durationMonths === 3 || (t as any).loanDuration === 3 || (t as any).durationMonths === '3').length})
                            </button>
                          </div>
                        </div>

                        {/* Dense List of Pending Loan Requests */}
                        <div className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                          {(() => {
                            const filteredApps = pendingQardLoanRequests.filter(tx => {
                              const dur = Number((tx as any).durationMonths || (tx as any).loanDuration || 1);
                              if (qardTenureFilter === '1month') return dur === 1;
                              if (qardTenureFilter === '3months') return dur === 3;
                              return true;
                            });

                            if (filteredApps.length === 0) {
                              return (
                                <div className="py-12 text-center text-slate-400 font-bold text-xs">
                                  🎉 কোনো অপেক্ষমাণ ঋণ আবেদন নেই!
                                </div>
                              );
                            }

                            return filteredApps.map((tx, idx) => {
                              const targetUser = users.find(u => u.id === tx.userId || u.uid === tx.userId || u.phone === tx.userPhone);
                              const reqAmt = Number(tx.amount) || 0;
                              const desiredDate = (tx as any).desiredDate || (tx as any).receivingDate || (tx as any).requestedDate || 'তাৎক্ষণিক';
                              const loanReason = (tx as any).loanReason || (tx as any).reason || tx.description || 'জরুরি প্রয়োজন';
                              const appDuration = Number((tx as any).durationMonths || (tx as any).loanDuration || 1);
                              const tenureBadge = appDuration === 3 ? '⏱️ 3 মাস মেয়াদি (90 দিন / 3 সমান কিস্তি)' : '⏱️ 1 মাস মেয়াদি (30 দিন)';

                              return (
                                <div
                                  key={tx.id || idx}
                                  className="px-3 py-2.5 hover:bg-blue-50/50 transition flex flex-col justify-center gap-1.5 group/row border-b border-slate-100 last:border-b-0"
                                >
                                  {/* Line 1: User details + Tenure + Amount + Actions */}
                                  <div className="flex items-center justify-between gap-2 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                                      <span className="w-4 h-4 rounded-full bg-slate-100 group-hover/row:bg-blue-200 text-slate-600 group-hover/row:text-blue-900 font-mono text-[9px] font-black shrink-0 inline-flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      {targetUser?.profilePic ? (
                                        <img
                                          src={targetUser.profilePic}
                                          alt={tx.userName || 'আবেদনকারী'}
                                          className="w-5 h-5 rounded-full object-cover border border-slate-200 shrink-0"
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-black text-[9px] shrink-0 inline-flex items-center justify-center">
                                          {(tx.userName || targetUser?.name || 'স')[0]}
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1 min-w-0 truncate">
                                        <button
                                          type="button"
                                          onClick={() => targetUser && openUserEditModal(targetUser)}
                                          className="font-black text-xs text-slate-900 hover:text-blue-700 hover:underline truncate cursor-pointer text-left"
                                        >
                                          {tx.userName || targetUser?.name || 'আবেদনকারী'}
                                        </button>
                                        {targetUser && (
                                          <button
                                            type="button"
                                            onClick={() => openUserEditModal(targetUser)}
                                            className="text-[8px] bg-blue-700 hover:bg-blue-800 text-white font-black px-1.5 py-0.2 rounded shrink-0 cursor-pointer shadow-2xs"
                                          >
                                            👤 প্রোফাইল
                                          </button>
                                        )}
                                      </div>

                                      <span className="text-slate-400 font-mono text-[10px]">
                                        {tx.userPhone || targetUser?.phone || '—'}
                                      </span>

                                      {/* Tenure Badge */}
                                      <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                                        appDuration === 3 ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      }`}>
                                        {tenureBadge}
                                      </span>
                                    </div>

                                    {/* Right Group: Amount Badge + Approve/Reject Buttons */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-800 shadow-2xs">
                                        ৳ {reqAmt.toLocaleString('en-US')} BDT
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() => handleApproveTransaction(tx)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                                      >
                                        <CheckCircle2 className="w-3 h-3" /> ✅ অনুমোদন
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const r = window.prompt('আবেদন বাতিলের কারণ লিখুন:');
                                          if (r !== null) executeRejectTransaction(tx, r || 'আবেদনটি মঞ্জুর করা হয়নি');
                                        }}
                                        className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 font-black text-[10px] rounded-lg transition cursor-pointer"
                                      >
                                        ✕ বাতিল
                                      </button>
                                    </div>
                                  </div>

                                  {/* Line 2: Desired Date + Reason + Balances */}
                                  <div className="flex items-center justify-between gap-2 text-[10px] leading-tight min-w-0">
                                    <div className="truncate flex-1 min-w-0 text-slate-700">
                                      <span className="font-bold text-blue-800">
                                        🗓️ নিতে চায় (Desired Date): <strong className="text-slate-900 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">{desiredDate}</strong>
                                      </span>
                                      <span className="mx-1 text-slate-300">|</span>
                                      <span className="font-medium text-slate-600">
                                        📝 কারণ: {loanReason}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 text-slate-500 font-mono text-[9px]">
                                      {targetUser && (
                                        <span className="text-slate-600 font-bold bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                          মেইন: ৳{getUserMainWalletBalance(targetUser).toLocaleString('en-US')} | সঞ্চয়: ৳{(targetUser.savings || 0).toLocaleString('en-US')}
                                        </span>
                                      )}
                                      <span>
                                        আবেদন: {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-US') : 'চলতি'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}

                    {/* ========================================================
                        SECTION 2: ⚡ সমিতি মেম্বার অটো-লোন ও ইনস্ট্যান্ট অনুমোদন
                       ======================================================== */}
                    {qardActiveSection === 'samity_auto' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                              ⚡ 2. সমিতি মেম্বার অটো-ঋণ ও ইনস্ট্যান্ট অনুমোদন হাব ({samityEligibleUsers.length} জন সঞ্চয়ী সদস্য)
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                              সমিতি সঞ্চয় জমার বিপরীতে 1% হতে 50% তাৎক্ষণিক সুদমুক্ত ঋণ প্রদান (1 মাস বা 3 মাস মেয়াদে) ও ওয়ালেটে ক্যাশ ক্রেডিট
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg">
                              📌 অটো-নীতিমালা: সঞ্চয়ের সর্বোচ্চ 50% পর্যন্ত ইনস্ট্যান্ট অটো-ঋণ
                            </span>
                          </div>
                        </div>

                        {/* Eligible Samity Members List */}
                        <div className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                          {samityEligibleUsers.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 font-bold text-xs">
                              কোনো সঞ্চয়ী সদস্য পাওয়া যায়নি
                            </div>
                          ) : (
                            samityEligibleUsers.map((u, idx) => {
                              const savingsAmt = Number(u.savings) || 0;
                              const maxAutoLoan = Math.round(savingsAmt * 0.5); // 50% instant limit
                              const currentDue = Number(u.dueLoan) || 0;
                              const mainBal = getUserMainWalletBalance(u);
                              const existingDuration = Number((u as any).instantLoanDurationMonths || (u as any).loanDuration || 1);

                              return (
                                <div
                                  key={u.id || idx}
                                  className="px-3 py-2 hover:bg-emerald-50/60 transition flex flex-col justify-center gap-1 group/row border-b border-slate-100 last:border-b-0"
                                >
                                  {/* Line 1 */}
                                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className="w-4 h-4 rounded-full bg-slate-100 group-hover/row:bg-emerald-200 text-slate-600 group-hover/row:text-emerald-900 font-mono text-[9px] font-black shrink-0 inline-flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      {u.profilePic ? (
                                        <img
                                          src={u.profilePic}
                                          alt={u.name}
                                          className="w-5 h-5 rounded-full object-cover border border-slate-200 shrink-0"
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-black text-[9px] shrink-0 inline-flex items-center justify-center">
                                          {(u.name || 'স')[0]}
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1 min-w-0 truncate">
                                        <button
                                          type="button"
                                          onClick={() => openUserEditModal(u)}
                                          className="font-black text-xs text-slate-900 hover:text-emerald-700 hover:underline truncate cursor-pointer text-left"
                                        >
                                          {u.name || u.phone || 'সমিতি সদস্য'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openUserEditModal(u)}
                                          className="text-[8px] bg-emerald-700 hover:bg-emerald-800 text-white font-black px-1.5 py-0.2 rounded shrink-0 cursor-pointer shadow-2xs"
                                        >
                                          👤 প্রোফাইল
                                        </button>
                                      </div>
                                    </div>

                                    {/* Action Buttons: 1 Month vs 3 Months Instant Loan Disburse */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleInstantDisburseSamityLoan(u, maxAutoLoan, 1)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9.5px] rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                                      >
                                        ⚡ 1 মাস মেয়াদে 50% ঋণ (৳{maxAutoLoan.toLocaleString('en-US')})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleInstantDisburseSamityLoan(u, maxAutoLoan, 3)}
                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-black text-[9.5px] rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                                      >
                                        ⚡ 3 মাস মেয়াদে 50% ঋণ
                                      </button>
                                    </div>
                                  </div>

                                  {/* Line 2 */}
                                  <div className="flex items-center justify-between gap-2 text-[10px] leading-tight min-w-0">
                                    <div className="truncate flex-1 min-w-0 text-slate-600">
                                      <span>📱 {u.phone || '—'}</span>
                                      <span className="mx-1 text-slate-300">|</span>
                                      <span className="font-bold text-emerald-800">
                                        মোট সঞ্চয়: ৳{savingsAmt.toLocaleString('en-US')}
                                      </span>
                                      <span className="mx-1 text-slate-300">|</span>
                                      <span>মেইন ব্যালেন্স: ৳{mainBal.toLocaleString('en-US')}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 text-slate-500 font-mono text-[9px]">
                                      {currentDue > 0 ? (
                                        <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                          বর্তমান বকেয়া: ৳{currentDue.toLocaleString('en-US')} ({existingDuration === 3 ? '3 মাস' : '1 মাস'})
                                        </span>
                                      ) : (
                                        <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                          কোনো বকেয়া নেই
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* ========================================================
                        SECTION 3: 💎 স্বর্ণ রেখে ইমার্জেন্সি লোন ও ভল্ট কন্ট্রোল প্যানেল
                       ======================================================== */}
                    {qardActiveSection === 'gold_loan' && (() => {
                      const safeInVaultLoans = adminGoldLoans.filter(g => (g.collateralStatus === 'safe_in_vault' || g.status === 'active' || g.status === 'approved') && g.status !== 'redeemed' && g.status !== 'cancelled');
                      const redeemedLoans = adminGoldLoans.filter(g => g.status === 'redeemed' || g.collateralStatus === 'returned');
                      const cancelledLoans = adminGoldLoans.filter(g => g.status === 'cancelled' || g.status === 'rejected');
                      
                      const totalGoldDisbursed = adminGoldLoans.reduce((sum, g) => sum + (Number(g.requestedAmount || g.disbursedAmount || g.estimatedMarketValue) || 0), 0);
                      const totalGoldMarketValue = adminGoldLoans.reduce((sum, g) => sum + (Number(g.estimatedMarketValue) || 0), 0);

                      const filteredGoldLoans = adminGoldLoans.filter(g => {
                        if (qardGoldFilter === 'safe_in_vault') {
                          if (!((g.collateralStatus === 'safe_in_vault' || g.status === 'active' || g.status === 'approved') && g.status !== 'redeemed' && g.status !== 'cancelled')) return false;
                        } else if (qardGoldFilter === 'redeemed') {
                          if (g.status !== 'redeemed' && g.collateralStatus !== 'returned') return false;
                        } else if (qardGoldFilter === 'cancelled') {
                          if (g.status !== 'cancelled' && g.status !== 'rejected') return false;
                        }

                        if (qardGoldSearchQuery.trim()) {
                          const q = qardGoldSearchQuery.toLowerCase();
                          const matchName = (g.userName || '').toLowerCase().includes(q);
                          const matchPhone = (g.userPhone || '').toLowerCase().includes(q);
                          const matchMemberId = (g.memberId || '').toLowerCase().includes(q);
                          const matchItem = (g.jewelryType || g.goldItemName || '').toLowerCase().includes(q);
                          const matchId = (g.id || '').toLowerCase().includes(q);
                          return matchName || matchPhone || matchMemberId || matchItem || matchId;
                        }
                        return true;
                      });

                      const handleAdjustGoldExpiryDate = async (loan: any, daysDelta: number, customDateStr?: string) => {
                        try {
                          let newDate: Date;
                          if (customDateStr) {
                            newDate = new Date(customDateStr);
                          } else {
                            const current = loan.expiryDate ? new Date(loan.expiryDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                            newDate = new Date(current.getTime() + daysDelta * 24 * 60 * 60 * 1000);
                          }

                          if (isNaN(newDate.getTime())) {
                            alert('সঠিক তারিখ নির্বাচন করুন');
                            return;
                          }

                          const newDateIso = newDate.toISOString();
                          const loanRef = doc(db, 'gold_loans', loan.id);
                          await updateDoc(loanRef, {
                            expiryDate: newDateIso,
                            updatedAt: new Date().toISOString(),
                            lastModifiedBy: 'admin'
                          });

                          // Send notification to member
                          if (loan.userId) {
                            await addDoc(collection(db, 'user_notifications'), {
                              id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                              userId: loan.userId,
                              title: '💎 স্বর্ণের সুরক্ষার মেয়াদ আপডেট',
                              message: `আপনার "${loan.jewelryType || 'স্বর্ণালংকার'}" এর ভল্ট সুরক্ষার মেয়াদ এডমিন কর্তৃক পরিবর্তিত হয়েছে। নতুন শেষ তারিখ: ${newDate.toLocaleDateString('bn-BD')}`,
                              body: `আপনার "${loan.jewelryType || 'স্বর্ণালংকার'}" এর ভল্ট সুরক্ষার মেয়াদ এডমিন কর্তৃক পরিবর্তিত হয়েছে। নতুন শেষ তারিখ: ${newDate.toLocaleDateString('bn-BD')}`,
                              type: 'info',
                              read: false,
                              isPersonal: true,
                              createdAt: new Date().toISOString()
                            });
                          }

                          alert(`মেয়াদ সফলভাবে আপডেট করা হয়েছে। নতুন তারিখ: ${newDate.toLocaleDateString('bn-BD')}`);
                        } catch (err: any) {
                          console.error("Error updating gold expiry:", err);
                          alert('মেয়াদ পরিবর্তন করতে সমস্যা হয়েছে: ' + err.message);
                        }
                      };

                      const handleUpdateGoldStatus = async (loan: any, newStatus: string, newCollateralStatus: string, actionLabel: string) => {
                        try {
                          const confirmAction = window.confirm(`আপনি কি নিশ্চিতভাবে এই স্বর্ণ লোনের অবস্থা "${actionLabel}" করতে চান?`);
                          if (!confirmAction) return;

                          const loanRef = doc(db, 'gold_loans', loan.id);
                          await updateDoc(loanRef, {
                            status: newStatus,
                            collateralStatus: newCollateralStatus,
                            updatedAt: new Date().toISOString(),
                            lastModifiedBy: 'admin'
                          });

                          if (loan.userId) {
                            await addDoc(collection(db, 'user_notifications'), {
                              id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                              userId: loan.userId,
                              title: `💎 স্বর্ণ লোন স্ট্যাটাস: ${actionLabel}`,
                              message: `আপনার স্বর্ণ লোনের স্ট্যাটাস পরিবর্তিত হয়ে "${actionLabel}" হয়েছে।`,
                              body: `আপনার স্বর্ণ লোনের স্ট্যাটাস পরিবর্তিত হয়ে "${actionLabel}" হয়েছে।`,
                              type: newStatus === 'redeemed' ? 'success' : newStatus === 'cancelled' ? 'warning' : 'info',
                              read: false,
                              isPersonal: true,
                              createdAt: new Date().toISOString()
                            });
                          }

                          alert(`স্ট্যাটাস সফলভাবে "${actionLabel}" করা হয়েছে!`);
                        } catch (err: any) {
                          console.error("Error updating gold status:", err);
                          alert('স্ট্যাটাস পরিবর্তনে সমস্যা হয়েছে: ' + err.message);
                        }
                      };

                      return (
                        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                          {/* Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                            <div>
                              <h4 className="text-xs sm:text-sm font-black text-amber-700 flex items-center gap-2">
                                💎 3. স্বর্ণ রেখে জরুরি টাকা (গোল্ড লোন) ও ভল্ট কন্ট্রোল ({adminGoldLoans.length} টি রেকর্ড)
                              </h4>
                              <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                                সদস্যদের স্বর্ণ ভল্ট হেফাজত, 100% সমান বাজারদর অডিট, সুরক্ষার মেয়াদ/তারিখ কমানো-বাড়ানো ও খালাস অনুমোদন
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
                                মোট স্বর্ণ লোন: ৳{totalGoldDisbursed.toLocaleString('en-US')}
                              </span>
                            </div>
                          </div>

                          {/* Quick Summary Cards */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="bg-amber-50/60 border border-amber-200/80 p-2.5 rounded-xl text-left">
                              <span className="text-[10px] font-black text-amber-800 block">মোট আবেদন / রেকর্ড</span>
                              <span className="text-sm font-mono font-black text-amber-900">{adminGoldLoans.length} টি</span>
                            </div>
                            <div className="bg-emerald-50/60 border border-emerald-200/80 p-2.5 rounded-xl text-left">
                              <span className="text-[10px] font-black text-emerald-800 block">🔒 ভল্টে সুরক্ষিত</span>
                              <span className="text-sm font-mono font-black text-emerald-900">{safeInVaultLoans.length} টি</span>
                            </div>
                            <div className="bg-blue-50/60 border border-blue-200/80 p-2.5 rounded-xl text-left">
                              <span className="text-[10px] font-black text-blue-800 block">🤝 খালাসকৃত / ফেরত</span>
                              <span className="text-sm font-mono font-black text-blue-900">{redeemedLoans.length} টি</span>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-left">
                              <span className="text-[10px] font-black text-slate-700 block">মোট বাজারমূল্য (100%)</span>
                              <span className="text-sm font-mono font-black text-slate-900">৳ {totalGoldMarketValue.toLocaleString('en-US')}</span>
                            </div>
                          </div>

                          {/* Search & Filter Bar */}
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black text-slate-700">ফিল্টারঃ</span>
                              <button
                                type="button"
                                onClick={() => setQardGoldFilter('all')}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                  qardGoldFilter === 'all'
                                    ? 'bg-amber-600 text-white shadow-xs font-black'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                }`}
                              >
                                সকল ({adminGoldLoans.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setQardGoldFilter('safe_in_vault')}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                  qardGoldFilter === 'safe_in_vault'
                                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                }`}
                              >
                                🔒 ভল্টে সুরক্ষিত ({safeInVaultLoans.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setQardGoldFilter('redeemed')}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                  qardGoldFilter === 'redeemed'
                                    ? 'bg-blue-600 text-white shadow-xs font-black'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                }`}
                              >
                                🤝 খালাসকৃত ({redeemedLoans.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setQardGoldFilter('cancelled')}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                  qardGoldFilter === 'cancelled'
                                    ? 'bg-rose-600 text-white shadow-xs font-black'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                }`}
                              >
                                ❌ বাতিল ({cancelledLoans.length})
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={qardGoldSearchQuery}
                                onChange={(e) => setQardGoldSearchQuery(e.target.value)}
                                placeholder="সদস্য নাম, ফোন, মেম্বার আইডি বা গহনা..."
                                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-amber-500 w-48 sm:w-60"
                              />
                              {qardGoldSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setQardGoldSearchQuery('')}
                                  className="text-[10px] text-slate-400 hover:text-slate-600 font-bold px-1"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>

                          {/* List of Gold Loans */}
                          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                            {filteredGoldLoans.length === 0 ? (
                              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs font-bold space-y-1">
                                <span className="text-2xl block">💎</span>
                                <span>কোনো স্বর্ণ লোন রেকর্ড পাওয়া যায়নি</span>
                              </div>
                            ) : (
                              filteredGoldLoans.map((loan, idx) => {
                                const isSafeInVault = (loan.collateralStatus === 'safe_in_vault' || loan.status === 'active' || loan.status === 'approved') && loan.status !== 'redeemed' && loan.status !== 'cancelled';
                                const isRedeemed = loan.status === 'redeemed' || loan.collateralStatus === 'returned';
                                const isCancelled = loan.status === 'cancelled' || loan.status === 'rejected';

                                const marketVal = Number(loan.estimatedMarketValue || loan.requestedAmount) || 0;
                                const cashDisbursed = Number(loan.disbursedAmount || loan.requestedAmount || marketVal);
                                
                                const expDate = loan.expiryDate ? new Date(loan.expiryDate) : null;
                                const isOverdue = expDate ? expDate.getTime() < Date.now() : false;
                                const daysLeft = expDate ? Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 90;

                                return (
                                  <div
                                    key={loan.id || idx}
                                    className={`p-3.5 rounded-2xl border transition text-left space-y-3 ${
                                      isSafeInVault
                                        ? 'bg-amber-50/30 border-amber-200 hover:border-amber-400'
                                        : isRedeemed
                                        ? 'bg-blue-50/30 border-blue-200 hover:border-blue-300'
                                        : isCancelled
                                        ? 'bg-slate-50 border-slate-200 opacity-75'
                                        : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    {/* Top Row: User & Gold info */}
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                                      <div className="flex items-start gap-2.5 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 font-black flex items-center justify-center text-base shrink-0 shadow-2xs">
                                          💎
                                        </div>
                                        <div className="min-w-0 space-y-0.5">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-black text-slate-900">
                                              {loan.userName || 'গ্রাহক'}
                                            </span>
                                            {loan.memberId && (
                                              <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                                                ID: {loan.memberId}
                                              </span>
                                            )}
                                            <span className="text-[9px] font-bold text-slate-500 font-mono">
                                              📱 {loan.userPhone || '—'}
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-amber-900 font-bold flex items-center gap-2 flex-wrap">
                                            <span>💍 {loan.jewelryType || 'স্বর্ণালংকার'}</span>
                                            <span>• ক্যারেট: {loan.carat || '22K'}</span>
                                            <span>• ওজন: {loan.weightVori ? `${loan.weightVori} ভরি` : ''} {loan.weightAna ? `${loan.weightAna} আনা` : ''} {loan.weightGram ? `(${loan.weightGram} গ্রাম)` : ''}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Status Badge */}
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-[9.5px] font-black px-2.5 py-1 rounded-full border ${
                                          isSafeInVault
                                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                            : isRedeemed
                                            ? 'bg-blue-100 text-blue-900 border-blue-300'
                                            : isCancelled
                                            ? 'bg-rose-100 text-rose-900 border-rose-200'
                                            : 'bg-amber-100 text-amber-900 border-amber-300'
                                        }`}>
                                          {isSafeInVault ? '🔒 ভল্টে সুরক্ষিত' : isRedeemed ? '🤝 খালাসকৃত / ফেরত' : isCancelled ? '❌ বাতিল' : '⏳ প্রক্রিয়াদিন'}
                                        </span>

                                        <span className="font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 shadow-2xs">
                                          ৳ {cashDisbursed.toLocaleString('en-US')}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Middle Row: Financials & Protection Expiry Timeline */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                                      <div className="bg-white/80 p-2 rounded-xl border border-slate-200 space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-600">বাজারদর হিসাব (100%):</span>
                                          <span className="font-mono font-bold text-slate-900">৳ {marketVal.toLocaleString('en-US')}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-600">সুদের হার:</span>
                                          <span className="font-bold text-emerald-700">0% (সুদমুক্ত করযে হাসানা)</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-600">আবেদনের তারিখ:</span>
                                          <span className="font-mono text-slate-500 text-[10px]">
                                            {loan.createdAt ? new Date(loan.createdAt).toLocaleDateString('bn-BD') : '—'}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="bg-white/80 p-2 rounded-xl border border-slate-200 space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-600">ভল্ট সুরক্ষার শেষ তারিখ:</span>
                                          <span className={`font-mono font-bold ${isOverdue && isSafeInVault ? 'text-rose-600' : 'text-slate-900'}`}>
                                            {expDate ? expDate.toLocaleDateString('bn-BD') : '3 মাস মেয়াদে'}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-600">অবশিষ্ট সুরক্ষা সময়:</span>
                                          <span className={`font-bold ${isOverdue && isSafeInVault ? 'text-rose-600' : 'text-emerald-700'}`}>
                                            {isOverdue && isSafeInVault ? `⚠️ মেয়াদ শেষ (${Math.abs(daysLeft)} দিন অতিক্রম)` : `${daysLeft} দিন অবশিষ্ট`}
                                          </span>
                                        </div>
                                        {loan.branchOrVaultLocation && (
                                          <div className="flex items-center justify-between">
                                            <span className="text-slate-600">ভল্ট হেফাজত শাখা:</span>
                                            <span className="font-bold text-slate-800">{loan.branchOrVaultLocation}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Bottom Row: Expiry Date Control (কমানো / বাড়ানো) & Status Operations */}
                                    <div className="pt-1 flex flex-col lg:flex-row lg:items-center justify-between gap-2 bg-slate-50/70 p-2 rounded-xl border border-slate-200/80">
                                      {/* Left: Date Adjuster Buttons */}
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[9.5px] font-black text-slate-700 flex items-center gap-1">
                                          ⏱️ সুরক্ষার ডেট কন্ট্রোলঃ
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleAdjustGoldExpiryDate(loan, 15)}
                                          className="px-2 py-0.8 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[9.5px] rounded-lg transition cursor-pointer active:scale-95"
                                        >
                                          +15 দিন বাড়ান
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleAdjustGoldExpiryDate(loan, 30)}
                                          className="px-2 py-0.8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9.5px] rounded-lg transition cursor-pointer active:scale-95 shadow-2xs"
                                        >
                                          +30 দিন বাড়ান
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleAdjustGoldExpiryDate(loan, -15)}
                                          className="px-2 py-0.8 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-[9.5px] rounded-lg transition cursor-pointer active:scale-95"
                                        >
                                          -15 দিন কমান
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleAdjustGoldExpiryDate(loan, -30)}
                                          className="px-2 py-0.8 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-[9.5px] rounded-lg transition cursor-pointer active:scale-95"
                                        >
                                          -30 দিন কমান
                                        </button>
                                      </div>

                                      {/* Right: Status Action Buttons */}
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {!isSafeInVault && (
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateGoldStatus(loan, 'active', 'safe_in_vault', 'ভল্টে সুরক্ষিত')}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                                          >
                                            🔒 ভল্টে হেফাজত নিশ্চিত করুন
                                          </button>
                                        )}

                                        {!isRedeemed && (
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateGoldStatus(loan, 'redeemed', 'returned', 'স্বর্ণ খালাস ও ফেরত')}
                                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                                          >
                                            🤝 টাকা পরিশোধপূর্বক স্বর্ণ ফেরত দিন
                                          </button>
                                        )}

                                        {!isCancelled && (
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateGoldStatus(loan, 'cancelled', 'cancelled', 'আবেদন বাতিল')}
                                            className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 font-black text-[10px] rounded-lg transition cursor-pointer active:scale-95"
                                          >
                                            ❌ বাতিল
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ========================================================
                        SECTION 4: 📅 ঋণ মেয়াদ, পরিশোধ শিডিউল ও ওভারডিউ জরিমানা হাব
                       ======================================================== */}
                    {qardActiveSection === 'calendar' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                              📅 4. ঋণ মেয়াদ, পরিশোধ শিডিউল ও ওভারডিউ জরিমানা হাব ({scheduleList.length} জন মোট ঋণগ্রহীতা)
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                              1 মাস মেয়াদি ও 3 মাস মেয়াদি ঋণগ্রহীতাদের তালিকা, পরবর্তী কিস্তির ডেট ট্র্যাকিং এবং নির্ধারিত সময়ে টাকা না দিলে অটো-জরিমানা কর্তন
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {/* Bulk Auto Fine Deduct */}
                            {overdueList.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleBulkAutoPenaltyDeduct(overdueList)}
                                disabled={isBulkPenaltyDeducting}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 animate-pulse"
                              >
                                <AlertTriangle className={`w-3.5 h-3.5 ${isBulkPenaltyDeducting ? 'animate-spin' : ''}`} />
                                <span>{isBulkPenaltyDeducting ? 'জরিমানা কর্তন চলছে...' : `🚨 1-ক্লিকে ওভারডিউ জরিমানা অটো-কর্তন (${overdueList.length} জন • ৳${totalOverduePenaltySum})`}</span>
                              </button>
                            )}

                            {/* Bulk Auto Repayment Deduct */}
                            <button
                              type="button"
                              onClick={() => {
                                const targetList = qardCalendarFilter === 'today' ? todayDueList
                                  : qardCalendarFilter === 'tomorrow' ? tomorrowDueList
                                  : qardCalendarFilter === 'overdue' ? overdueList
                                  : scheduleList;
                                handleBulkDeductAllDue(targetList);
                              }}
                              disabled={isBulkDeductingQard}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isBulkDeductingQard ? 'animate-spin' : ''}`} />
                              <span>{isBulkDeductingQard ? 'অটো কর্তন চলছে...' : '⚡ 1-ক্লিকে মেইন ব্যালেন্স হতে কিস্তি অটো-কর্তন'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Top Tenure Filter Tabs (1 মাস মেয়াদি / 3 মাস মেয়াদি / সকল) */}
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-slate-700 flex items-center gap-1">
                              ⏱️ ঋণের মেয়াদ ফিল্টারঃ
                            </span>
                            <button
                              type="button"
                              onClick={() => setQardTenureFilter('all')}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                qardTenureFilter === 'all'
                                  ? 'bg-slate-900 text-white shadow-xs'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              সকল মেয়াদ ({scheduleList.length} জন)
                            </button>
                            <button
                              type="button"
                              onClick={() => setQardTenureFilter('1month')}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                qardTenureFilter === '1month'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              <span>🟢 1 মাস মেয়াদি</span>
                              <span className="font-mono">({oneMonthBorrowers.length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setQardTenureFilter('3months')}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                qardTenureFilter === '3months'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              <span>🔵 3 মাস মেয়াদি</span>
                              <span className="font-mono">({threeMonthBorrowers.length})</span>
                            </button>
                          </div>

                          <div className="text-[9.5px] text-slate-500 font-bold">
                            ⚠️ বিলম্ব জরিমানা নিয়ম: নির্ধারিত দিন পার হলে প্রতিদিন প্রতি 1,000 টাকায় 10৳ অটো-জরিমানা ধার্য
                          </div>
                        </div>

                        {/* Calendar Quick Status Filter Tabs */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setQardCalendarFilter('today');
                              setQardCalendarSpecificDay('all');
                            }}
                            className={`text-[10.5px] font-extrabold px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                              qardCalendarFilter === 'today' && qardCalendarSpecificDay === 'all'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            🔴 আজকের পাওনা ({todayDueList.length} জন • ৳{todayDueList.reduce((s, x) => s + x.dueAmt, 0).toLocaleString('en-US')})
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setQardCalendarFilter('tomorrow');
                              setQardCalendarSpecificDay('all');
                            }}
                            className={`text-[10.5px] font-extrabold px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                              qardCalendarFilter === 'tomorrow' && qardCalendarSpecificDay === 'all'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                            }`}
                          >
                            🟡 আগামীকালের পাওনা ({tomorrowDueList.length} জন • ৳{tomorrowDueList.reduce((s, x) => s + x.dueAmt, 0).toLocaleString('en-US')})
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setQardCalendarFilter('upcoming');
                              setQardCalendarSpecificDay('all');
                            }}
                            className={`text-[10.5px] font-extrabold px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                              qardCalendarFilter === 'upcoming' && qardCalendarSpecificDay === 'all'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            🔵 পরশু ও আগামী 7 দিন ({upcomingDueList.length} জন)
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setQardCalendarFilter('yesterday');
                              setQardCalendarSpecificDay('all');
                            }}
                            className={`text-[10.5px] font-extrabold px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                              qardCalendarFilter === 'yesterday' && qardCalendarSpecificDay === 'all'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            🟢 গতকাল ও বিগত ({yesterdayDueList.length} জন)
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setQardCalendarFilter('overdue');
                              setQardCalendarSpecificDay('all');
                            }}
                            className={`text-[10.5px] font-extrabold px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                              qardCalendarFilter === 'overdue' && qardCalendarSpecificDay === 'all'
                                ? 'bg-red-700 text-white shadow-xs'
                                : 'bg-red-50 hover:bg-red-100 text-red-900 border border-red-200'
                            }`}
                          >
                            🚨 ওভারডিউ ও বকেয়া জরিমানা ({overdueList.length} জন • জরিমানা ৳{totalOverduePenaltySum})
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setQardCalendarFilter('all');
                              setQardCalendarSpecificDay('all');
                            }}
                            className={`text-[10.5px] font-extrabold px-3 py-1 rounded-lg transition cursor-pointer ${
                              qardCalendarFilter === 'all' && qardCalendarSpecificDay === 'all'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            সকল শিডিউল ({scheduleList.length} জন)
                          </button>
                        </div>

                        {/* Monthly Summary & Month Selector Banner ("কোন মাসে কত টাকা যেমন অগাস্ট মাসে ৩ জন থেকে ৳১৬,০০০ টাকা") */}
                        {(() => {
                          const bengaliMonthNames = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
                          
                          const monthlyStats = bengaliMonthNames.map((mName, mIdx) => {
                            const matchingBorrowers = scheduleList.filter(s => {
                              if (mIdx === currentMonth) return true;
                              if (s.tenureMonths === 3) {
                                const offset = (mIdx - currentMonth + 12) % 12;
                                return offset >= 0 && offset < 3;
                              }
                              return false;
                            });

                            const count = matchingBorrowers.length;
                            const totalAmt = matchingBorrowers.reduce((sum, s) => {
                              if (s.tenureMonths === 3 && mIdx !== currentMonth) {
                                return sum + Math.ceil(s.dueAmt / 3);
                              }
                              return sum + (s.tenureMonths === 3 ? Math.ceil(s.dueAmt / (3 - (s.daysElapsed > 60 ? 2 : (s.daysElapsed > 30 ? 1 : 0)))) : s.dueAmt);
                            }, 0);

                            return {
                              monthIndex: mIdx,
                              monthName: mName,
                              count,
                              totalAmt,
                              isCurrent: mIdx === currentMonth
                            };
                          });

                          const activeMonthData = monthlyStats[qardSelectedMonth] || monthlyStats[currentMonth];

                          return (
                            <div className="space-y-2">
                              {/* 12 Months Navigation Strip */}
                              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                                <span className="text-[10px] font-black text-slate-500 shrink-0 mr-1 flex items-center gap-1">
                                  <span>🗓️ মাস নির্বাচন:</span>
                                </span>
                                {monthlyStats.map((m) => {
                                  const isSelected = qardSelectedMonth === m.monthIndex;
                                  return (
                                    <button
                                      key={m.monthIndex}
                                      type="button"
                                      onClick={() => {
                                        setQardSelectedMonth(m.monthIndex);
                                        setQardCalendarSpecificDay('all');
                                      }}
                                      className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold shrink-0 transition cursor-pointer flex items-center gap-1 border ${
                                        isSelected
                                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                          : m.isCurrent
                                          ? 'bg-amber-50 text-amber-900 border-amber-300 font-black'
                                          : m.count > 0
                                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                      }`}
                                    >
                                      <span>{m.monthName}</span>
                                      {m.count > 0 && (
                                        <span className={`text-[9px] px-1 rounded font-black ${
                                          isSelected ? 'bg-amber-400 text-slate-950' : 'bg-emerald-200 text-emerald-900'
                                        }`}>
                                          {m.count.toLocaleString('bn-BD')} জন
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Highlighted Monthly Summary Card (যেমন: আগস্ট মাসে ৩ জন থেকে ৳১৬,০০০ টাকা) */}
                              <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white p-3.5 rounded-2xl border border-amber-400/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                      📊 মাসিক ঋণ আদায় হিসাব
                                    </span>
                                    <span className="text-xs text-amber-200 font-extrabold">
                                      {activeMonthData.monthName} {currentYear}
                                    </span>
                                    {activeMonthData.isCurrent && (
                                      <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.2 rounded font-black">
                                        চলতি মাস
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm sm:text-base font-black text-white flex items-center gap-1.5 flex-wrap">
                                    <span>📌</span>
                                    <span className="text-amber-300 font-sans">{activeMonthData.monthName}</span>
                                    <span>মাসে</span>
                                    <span className="text-emerald-400 font-mono bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40 font-black">
                                      {activeMonthData.count.toLocaleString('bn-BD')} জন
                                    </span>
                                    <span>সদস্য থেকে মোট পাওনা</span>
                                    <span className="text-amber-300 font-mono bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40 font-black text-base sm:text-lg">
                                      ৳{activeMonthData.totalAmt.toLocaleString('bn-BD')}
                                    </span>
                                    <span>টাকা</span>
                                  </div>
                                  <p className="text-[10.5px] text-slate-300 font-bold pt-0.5">
                                    {activeMonthData.isCurrent
                                      ? `নিচে ১-৩১ তারিখের ডেট নির্বাচন করে দেখুন কোন তারিখে কতজন সদস্যের টাকা পরিশোধের ডেট রয়েছে।`
                                      : `${activeMonthData.monthName} মাসের নির্ধারিত কিস্তির সম্ভাব্য তালিকা ও পরিসংখ্যান।`}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="bg-white/10 backdrop-blur-xs border border-white/20 p-2.5 rounded-2xl text-center min-w-[80px]">
                                    <span className="text-[9px] text-slate-300 font-bold block">মোট সদস্য</span>
                                    <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                                      {activeMonthData.count.toLocaleString('bn-BD')} জন
                                    </span>
                                  </div>
                                  <div className="bg-white/10 backdrop-blur-xs border border-white/20 p-2.5 rounded-2xl text-center min-w-[100px]">
                                    <span className="text-[9px] text-slate-300 font-bold block">মোট টাকা</span>
                                    <span className="text-sm sm:text-base font-black text-amber-300 font-mono">
                                      ৳{activeMonthData.totalAmt.toLocaleString('bn-BD')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Calendar Day Picker (1-31 Days Selector for Exact Repayment Date Tracking with "এত তারিখে এতজন" under each date) */}
                        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-black text-slate-700">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>
                                📆 ১-৩১ তারিখের ডেট শিডিউল নির্বাচন (কবে কার টাকা দেওয়ার ডেট):
                              </span>
                              {qardCalendarSpecificDay !== 'all' && (
                                <span className="text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                                  <span>👉 নির্বাচিত: {qardCalendarSpecificDay}ই তারিখ</span>
                                  <span className="font-black">
                                    ({scheduleList.filter(s => s.assignedDueDay === qardCalendarSpecificDay).length.toLocaleString('bn-BD')} জন • ৳{scheduleList.filter(s => s.assignedDueDay === qardCalendarSpecificDay).reduce((sum, s) => sum + s.dueAmt, 0).toLocaleString('bn-BD')})
                                  </span>
                                </span>
                              )}
                            </div>
                            {qardCalendarSpecificDay !== 'all' && (
                              <button
                                type="button"
                                onClick={() => setQardCalendarSpecificDay('all')}
                                className="text-[10px] font-black text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
                              >
                                ✖ ফিল্টার রিসেট
                              </button>
                            )}
                          </div>

                          {/* 1 to 31 Date Buttons Bar */}
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                              const dayBorrowers = scheduleList.filter(s => s.assignedDueDay === day);
                              const matchCount = dayBorrowers.length;
                              const dayTotalAmt = dayBorrowers.reduce((sum, s) => sum + s.dueAmt, 0);
                              const isSelected = qardCalendarSpecificDay === day;
                              const isToday = day === currentDayOfMonth && qardSelectedMonth === currentMonth;

                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => setQardCalendarSpecificDay(day)}
                                  title={`${day}ই তারিখ: ${matchCount} জন গ্রহীতা, মোট ৳${dayTotalAmt.toLocaleString('bn-BD')}`}
                                  className={`px-2 py-1.5 rounded-xl text-[11px] shrink-0 transition cursor-pointer flex flex-col items-center justify-center min-w-[50px] border ${
                                    isSelected
                                      ? 'bg-slate-900 text-white ring-2 ring-emerald-500 border-slate-900 shadow-md scale-105'
                                      : isToday
                                      ? 'bg-amber-50 text-amber-950 border-amber-400 font-black shadow-xs ring-1 ring-amber-300'
                                      : matchCount > 0
                                      ? 'bg-white text-slate-800 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/60 shadow-xs'
                                      : 'bg-slate-100/80 text-slate-400 border-slate-200 hover:bg-slate-200/60'
                                  }`}
                                >
                                  {/* Date Number on top */}
                                  <div className="flex items-center gap-0.5">
                                    <span className={`font-black font-sans text-xs ${
                                      isSelected
                                        ? 'text-white'
                                        : isToday
                                        ? 'text-amber-900 font-black'
                                        : matchCount > 0
                                        ? 'text-slate-900 font-black'
                                        : 'text-slate-500'
                                    }`}>
                                      {day.toLocaleString('bn-BD')}
                                    </span>
                                    {isToday && (
                                      <span className="text-[7px] bg-rose-600 text-white px-0.5 py-0.2 rounded font-black">
                                        আজ
                                      </span>
                                    )}
                                  </div>

                                  {/* Borrower count directly beneath date number (যেমন: ৩ জন / ৫ জন / ০ জন) */}
                                  <span
                                    className={`text-[8.5px] font-bold mt-0.5 px-1 py-0.2 rounded transition whitespace-nowrap ${
                                      isSelected
                                        ? 'bg-emerald-500 text-slate-950 font-black'
                                        : matchCount > 0
                                        ? 'bg-emerald-100 text-emerald-800 font-black border border-emerald-200'
                                        : 'text-slate-400 font-medium'
                                    }`}
                                  >
                                    {matchCount > 0 ? `${matchCount.toLocaleString('bn-BD')} জন` : '০ জন'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Calendar Repayment Schedule List (Dense Layout with Tenure & Overdue Penalty Actions) */}
                        <div className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                          {(() => {
                            let displayList = scheduleList;

                            // Apply tenure filter
                            if (qardTenureFilter === '1month') {
                              displayList = displayList.filter(s => s.tenureMonths === 1);
                            } else if (qardTenureFilter === '3months') {
                              displayList = displayList.filter(s => s.tenureMonths === 3);
                            }

                            // Apply calendar status filter
                            if (qardCalendarSpecificDay !== 'all') {
                              displayList = displayList.filter(s => s.assignedDueDay === qardCalendarSpecificDay);
                            } else if (qardCalendarFilter === 'today') {
                              displayList = displayList.filter(s => s.isToday);
                            } else if (qardCalendarFilter === 'tomorrow') {
                              displayList = displayList.filter(s => s.isTomorrow);
                            } else if (qardCalendarFilter === 'upcoming') {
                              displayList = displayList.filter(s => s.isUpcoming || s.diffDays > 0);
                            } else if (qardCalendarFilter === 'yesterday') {
                              displayList = displayList.filter(s => s.isYesterday);
                            } else if (qardCalendarFilter === 'overdue') {
                              displayList = displayList.filter(s => s.isOverdue);
                            }

                            if (displayList.length === 0) {
                              return (
                                <div className="py-12 text-center text-slate-400 font-bold text-xs space-y-1">
                                  <div>🔍 নির্বাচিত ফিল্টারে কোনো ঋণ পরিশোধের শিডিউল নেই</div>
                                  <div className="text-[10px] text-slate-400">অন্য কোনো মেয়াদ বা ফিল্টার সিলেক্ট করুন</div>
                                </div>
                              );
                            }

                            return displayList.map((item, idx) => {
                              const u = item.user;
                              const isSending = isSendingQardNotice === (u.id || u.uid);
                              const isDeductingPenalty = isDeductingSinglePenalty === (u.id || u.uid);

                              return (
                                <div
                                  key={u.id || idx}
                                  className={`px-3 py-2.5 hover:bg-slate-50 transition flex flex-col justify-center gap-1.5 group/row border-b border-slate-100 last:border-b-0 ${
                                    item.isOverdue ? 'bg-rose-50/30' : ''
                                  }`}
                                >
                                  {/* Line 1: User details, Tenure badge, Next Due Date badge, Balances & Action buttons */}
                                  <div className="flex items-center justify-between gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className="w-4 h-4 rounded-full bg-slate-100 group-hover/row:bg-slate-200 text-slate-600 font-mono text-[9px] font-black shrink-0 inline-flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      {u.profilePic ? (
                                        <img
                                          src={u.profilePic}
                                          alt={u.name}
                                          className="w-5 h-5 rounded-full object-cover border border-slate-200 shrink-0"
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-black text-[9px] shrink-0 inline-flex items-center justify-center">
                                          {(u.name || 'স')[0]}
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1 min-w-0 truncate">
                                        <button
                                          type="button"
                                          onClick={() => openUserEditModal(u)}
                                          className="font-black text-xs text-slate-900 hover:text-emerald-700 hover:underline truncate cursor-pointer text-left"
                                        >
                                          {u.name || u.phone || 'সমিতি সদস্য'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openUserEditModal(u)}
                                          className="text-[8px] bg-emerald-700 hover:bg-emerald-800 text-white font-black px-1.5 py-0.2 rounded shrink-0 cursor-pointer shadow-2xs"
                                        >
                                          👤 প্রোফাইল
                                        </button>
                                      </div>

                                      {/* Tenure Badge */}
                                      <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                                        item.tenureMonths === 3
                                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      }`}>
                                        ⏱️ {item.tenureLabel}
                                      </span>

                                      {/* Next Repayment Date & Overdue Status */}
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                                        item.isOverdue
                                          ? 'bg-rose-600 text-white animate-pulse shadow-2xs'
                                          : item.isToday
                                          ? 'bg-amber-500 text-white shadow-2xs'
                                          : item.isTomorrow
                                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}>
                                        {item.isOverdue
                                          ? `⚠️ মেয়াদোত্তীর্ণ (${item.overdueDays} দিন ওভারডিউ)`
                                          : item.isToday
                                          ? `🚨 আজ শেষ দিন (${item.assignedDueDay}ই)`
                                          : item.isTomorrow
                                          ? `🟡 আগামীকাল (${item.assignedDueDay}ই)`
                                          : `📅 পরবর্তী ডেট: ${item.nextDueDateStr}`}
                                      </span>
                                    </div>

                                    {/* Action Buttons: Auto Repay, Auto Penalty Deduct, Send Notice */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* Auto Fine Deduct Button for Overdue Members */}
                                      {item.isOverdue && item.calculatedPenalty > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => handleSingleAutoPenaltyDeduct(u, item.calculatedPenalty, item.overdueDays)}
                                          disabled={isDeductingPenalty}
                                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-black text-[9.5px] rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                        >
                                          <AlertTriangle className={`w-3 h-3 ${isDeductingPenalty ? 'animate-spin' : ''}`} />
                                          <span>{isDeductingPenalty ? 'কর্তন হচ্ছে...' : `🚨 জরিমানা কাটুন (৳${item.calculatedPenalty})`}</span>
                                        </button>
                                      )}

                                      {/* Auto Repay Installment Button */}
                                      <button
                                        type="button"
                                        onClick={() => handleBulkDeductAllDue([item])}
                                        disabled={isBulkDeductingQard || !item.canAutoDeduct}
                                        className={`px-2 py-1 font-black text-[9.5px] rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer ${
                                          item.canAutoDeduct
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                      >
                                        <Zap className="w-3 h-3" />
                                        <span>⚡ কিস্তি কাটুন</span>
                                      </button>

                                      {/* Send Notice Button */}
                                      <button
                                        type="button"
                                        onClick={() => handleSendSingleNotice(u, item.dueAmt, `${item.assignedDueDay} তারিখ`)}
                                        disabled={isSending}
                                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-black text-[9.5px] rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                      >
                                        <Bell className={`w-3 h-3 ${isSending ? 'animate-spin' : ''}`} />
                                        <span>📢 তাগাদা</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Line 2: Financial Breakdown (Due Amount, Main Wallet, Overdue Fine) */}
                                  <div className="flex items-center justify-between gap-2 text-[10px] leading-tight min-w-0">
                                    <div className="truncate flex-1 min-w-0 text-slate-600">
                                      <span>📱 {u.phone || '—'}</span>
                                      <span className="mx-1 text-slate-300">|</span>
                                      <span className="font-bold text-slate-900">
                                        মূল ঋণ বকেয়া: <strong className="font-mono text-rose-700">৳{item.dueAmt.toLocaleString('en-US')}</strong>
                                      </span>
                                      <span className="mx-1 text-slate-300">|</span>
                                      <span>
                                        মেইন ওয়ালেট: <strong className="font-mono text-emerald-700">৳{item.mainBal.toLocaleString('en-US')}</strong>
                                      </span>
                                      {item.isOverdue && item.calculatedPenalty > 0 && (
                                        <>
                                          <span className="mx-1 text-slate-300">|</span>
                                          <span className="font-bold text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                                            বিলম্ব জরিমানা: ৳{item.calculatedPenalty} ({item.overdueDays} দিন × 10৳/হাজার)
                                          </span>
                                        </>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 text-slate-500 font-mono text-[9px]">
                                      {item.canAutoDeduct ? (
                                        <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                          ✅ ব্যালেন্স পর্যাপ্ত
                                        </span>
                                      ) : (
                                        <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                          ⚠️ ব্যালেন্স কম
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}

                    {/* ========================================================
                        SECTION 4: 📜 সম্পূর্ণ অডিট লেজার ও ট্রানজেকশন খতিয়ান
                       ======================================================== */}
                    {qardActiveSection === 'ledger' && (
                      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setQardFilterType('all')}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                qardFilterType === 'all'
                                  ? 'bg-slate-900 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              সকল ({qardTxs.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setQardFilterType('borrowers')}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                qardFilterType === 'borrowers'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              ঋণ সংক্রান্ত ({qardTxs.filter(t => t.type !== 'qard_donation').length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setQardFilterType('donors')}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                qardFilterType === 'donors'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              দানকারী সদস্য ({qardTxs.filter(t => t.type === 'qard_donation').length})
                            </button>
                          </div>

                          <div className="relative w-full sm:w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              value={qardSearchQuery}
                              onChange={(e) => setQardSearchQuery(e.target.value)}
                              placeholder="নাম, ফোন বা ট্রানজেকশন খুঁজুন..."
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                            />
                          </div>
                        </div>

                        {/* Full Ledger List (Dense Layout) */}
                        <div className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                          {(() => {
                            const filteredTxs = qardTxs.filter(tx => {
                              if (qardFilterType === 'borrowers' && !(tx.type === 'qard_loan_disbursment' || tx.type === 'qard_loan_request' || tx.type === 'qard_penalty_fine' || tx.category === 'borrower' || tx.category === 'fine')) return false;
                              if (qardFilterType === 'donors' && tx.type !== 'qard_donation') return false;
                              if (!qardSearchQuery.trim()) return true;
                              const q = qardSearchQuery.toLowerCase();
                              return (
                                (tx.userName || '').toLowerCase().includes(q) ||
                                (tx.userPhone || '').toLowerCase().includes(q) ||
                                (tx.trxId || '').toLowerCase().includes(q) ||
                                (tx.description || '').toLowerCase().includes(q)
                              );
                            });

                            if (filteredTxs.length === 0) {
                              return (
                                <div className="py-12 text-center text-slate-400 font-bold text-xs">
                                  🔍 কোনো লেনদেন রেকর্ড পাওয়া যায়নি
                                </div>
                              );
                            }

                            return filteredTxs.map((tx, idx) => {
                              const isDonation = tx.type === 'qard_donation';
                              const isFine = tx.type === 'qard_penalty_fine' || tx.type === 'qard_fine' || tx.category === 'fine';
                              const isRepay = tx.type === 'qard_loan_repayment' || tx.type === 'loan_repayment';
                              const isDisburse = tx.type === 'qard_loan_disbursment' || tx.type === 'qard_loan_request';
                              const targetUser = users.find(u => u.id === tx.userId || u.uid === tx.userId || u.phone === tx.userPhone);
                              const amt = Number(tx.amount) || 0;

                              return (
                                <div
                                  key={tx.id || idx}
                                  className="px-3 py-2 hover:bg-slate-50 transition flex flex-col justify-center gap-1 group/row border-b border-slate-100 last:border-b-0"
                                >
                                  {/* Line 1 */}
                                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className="w-4 h-4 rounded-full bg-slate-100 group-hover/row:bg-slate-200 text-slate-600 font-mono text-[9px] font-black shrink-0 inline-flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      {targetUser?.profilePic ? (
                                        <img
                                          src={targetUser.profilePic}
                                          alt={tx.userName || 'মেম্বার'}
                                          className="w-5 h-5 rounded-full object-cover border border-slate-200 shrink-0"
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-black text-[9px] shrink-0 inline-flex items-center justify-center">
                                          {(tx.userName || 'স')[0]}
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1 min-w-0 truncate">
                                        <span className="font-black text-xs text-slate-900 truncate">
                                          {tx.userName || targetUser?.name || 'সমিতি সদস্য'}
                                        </span>
                                        {targetUser && (
                                          <button
                                            type="button"
                                            onClick={() => openUserEditModal(targetUser)}
                                            className="text-[8px] bg-emerald-700 hover:bg-emerald-800 text-white font-black px-1.5 py-0.2 rounded shrink-0 cursor-pointer shadow-2xs"
                                          >
                                            👤 প্রোফাইল
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className={`font-mono font-black text-xs px-2 py-0.5 rounded border shadow-2xs ${
                                        isFine
                                          ? 'border-red-300 bg-red-50 text-red-800'
                                          : isDonation
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                          : isRepay
                                          ? 'border-teal-200 bg-teal-50 text-teal-800'
                                          : 'border-blue-200 bg-blue-50 text-blue-800'
                                      }`}>
                                        {isFine ? '⚠️ ৳ ' : isDonation ? '❤️ ৳ ' : isRepay ? '📥 ৳ ' : '📤 ৳ '}
                                        {amt.toLocaleString('en-US')}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setQardEditingTx(tx);
                                          setQardEditAmt(String(tx.amount || ''));
                                          setQardEditStatus(tx.status || 'success');
                                          setQardEditDesc(tx.description || '');
                                          setQardEditWhatsapp(tx.userPhone || '');
                                        }}
                                        className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition cursor-pointer"
                                      >
                                        ✏️
                                      </button>
                                    </div>
                                  </div>

                                  {/* Line 2 */}
                                  <div className="flex items-center justify-between gap-2 text-[10px] leading-tight min-w-0">
                                    <div className="truncate flex-1 min-w-0 text-slate-600 font-medium">
                                      📝 {tx.description || tx.typeLabel || 'নিয়মিত লেনদেন'}
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 text-slate-500 font-mono text-[9px]">
                                      <span>
                                        ⏱️ {tx.createdAt ? new Date(tx.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'চলতি'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}

                    {/* =========================================================================
                        📜 কর্জে হাসানা সুদমুক্ত ঋণ নীতিমালা ও নিয়মাবলী কন্ট্রোল হাব (LIVE RULES MANAGER)
                        (এডমিন প্যানেল থেকে নিয়মকানুন তৈরি ও লাইভ ইউজার ড্যাশবোর্ডে কার্যকর হওয়ার সম্পূর্ণ সিস্টেম)
                       ========================================================================= */}
                    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-700/90 rounded-3xl p-4 sm:p-6 shadow-2xl text-left space-y-5 text-white">
                      {/* Header with Title and Live Save Button */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">📜</span>
                            <h3 className="text-base sm:text-lg font-black text-amber-300">
                              করজে হাসানা সুদমুক্ত ঋণ নীতিমালা ও নিয়মাবলী কন্ট্রোল হাব
                            </h3>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            এডমিন প্যানেল থেকে করজে হাসানার সমস্ত শর্তাবলী, নীতিমালা, ঋণ পাওয়ার নিয়ম ও জরিমানা রেট তৈরি ও পরিবর্তন করুন। এখানে পরিবর্তন করলে সদস্যদের অ্যাপে ও ইউজার ড্যাশবোর্ডে লাইভ ও রিয়েল-টাইমে কার্যকর হবে।
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleOpenAddRuleModal}
                            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                            <span>+ নতুন নিয়ম যুক্ত করুন</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSaveQardRulesConfig}
                            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer active:scale-95 ring-2 ring-amber-400/50"
                          >
                            <Save className="w-4 h-4 text-slate-950" />
                            <span>💾 নীতিমালা সেভ ও লাইভ করুন</span>
                          </button>
                        </div>
                      </div>

                      {/* Header Titles & Eligibility Parameters */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-black text-amber-200 block">নীতিমালার মূল শিরোনাম:</label>
                          <input
                            type="text"
                            value={qardRulesTitle}
                            onChange={(e) => setQardRulesTitle(e.target.value)}
                            placeholder="যেমন: কল্যাণমুখী করজে হাসানা নীতিমালা"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-black text-amber-200 block">সাব-টাইটেল (সংক্ষেপে):</label>
                          <input
                            type="text"
                            value={qardRulesSubtitle}
                            onChange={(e) => setQardRulesSubtitle(e.target.value)}
                            placeholder="যেমন: করযে হাসানা শর্তাবলি (সংক্ষেপে)"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-black text-amber-200 block">প্রয়োজনীয় সক্রিয় দিন (দিন):</label>
                          <input
                            type="number"
                            value={qardReqDays}
                            onChange={(e) => setQardReqDays(Number(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-black text-amber-200 block">প্রয়োজনীয় লেনদেন ভলিউম (৳):</label>
                          <input
                            type="number"
                            value={qardReqTxVol}
                            onChange={(e) => setQardReqTxVol(Number(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </div>
                      </div>

                      {/* Interactive Rules Item List */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                            📋 লাইভ নিয়ম ও শর্তাবলীর তালিকা ({qardRulesList.length} টি শর্ত কার্যকর আছে):
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('আপনি কি ডিফল্ট নীতিমালায় রিসেট করতে চান?')) {
                                setQardRulesList(DEFAULT_QARD_CONFIG.rulesList);
                              }
                            }}
                            className="text-[10px] text-slate-400 hover:text-amber-300 font-bold underline cursor-pointer"
                          >
                            🔄 ডিফল্ট নিয়মে রিসেট
                          </button>
                        </div>

                        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                          {qardRulesList.map((rule, idx) => (
                            <div
                              key={rule.id || idx}
                              className={`p-3 rounded-2xl border transition flex items-start justify-between gap-3 ${
                                rule.isWarning
                                  ? 'bg-rose-950/40 border-rose-500/40 hover:border-rose-400'
                                  : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <span className="text-xl shrink-0 mt-0.5">{rule.icon || '📌'}</span>
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black text-white">
                                      {idx + 1}. {rule.title}
                                    </span>
                                    {rule.isWarning && (
                                      <span className="text-[8.5px] font-black bg-rose-500/30 text-rose-300 border border-rose-500/40 px-2 py-0.2 rounded-full">
                                        ⚠️ বিশেষ সতর্কতা / জরিমানা নিয়ম
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                    {rule.description}
                                  </p>
                                </div>
                              </div>

                              {/* Rule Actions: Move Up, Move Down, Edit, Delete */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleMoveRuleItem(idx, 'up')}
                                  disabled={idx === 0}
                                  title="উপরে নিন"
                                  className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-[10px] transition cursor-pointer disabled:opacity-30"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveRuleItem(idx, 'down')}
                                  disabled={idx === qardRulesList.length - 1}
                                  title="নিচে নিন"
                                  className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-[10px] transition cursor-pointer disabled:opacity-30"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditRuleModal(idx)}
                                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-[10.5px] rounded-lg transition cursor-pointer"
                                >
                                  ✏️ এডিট
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRuleItem(idx)}
                                  className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-[10.5px] rounded-lg transition cursor-pointer"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ========================================================
                          🏢 সমবায় আমানতের 1% - 50% ইনস্ট্যান্ট অটো-ঋণ সেটিংস হাব
                         ======================================================== */}
                      <div className="bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🏢</span>
                            <div>
                              <h4 className="text-sm font-black text-emerald-300">
                                সমবায় আমানতের 1% - 50% ইনস্ট্যান্ট অটো-ঋণ সেটিংস হাব
                              </h4>
                              <span className="text-[10.5px] text-slate-400 font-medium">
                                সমিতিতে সঞ্চয়কারীদের জন্য 24/7 ইনস্ট্যান্ট অটো অনুমোদন ও পরিশোধ নীতিমালা
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                              <input
                                type="checkbox"
                                checked={qardCoopInstantEnabled}
                                onChange={(e) => setQardCoopInstantEnabled(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-800 border-slate-600"
                              />
                              <span className={`text-xs font-black ${qardCoopInstantEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {qardCoopInstantEnabled ? '🟢 অটো-ঋণ চালু' : '🔴 অটো-ঋণ বন্ধ'}
                              </span>
                            </label>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-black text-emerald-200 block">শিরোনাম:</label>
                            <input
                              type="text"
                              value={qardCoopInstantTitle}
                              onChange={(e) => setQardCoopInstantTitle(e.target.value)}
                              placeholder="🏢 সমবায় আমানতের 1% - 50% ইনস্ট্যান্ট অটো-ঋণ"
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-emerald-400"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-black text-emerald-200 block">সর্বোচ্চ ঋণের শতকরা হার (%):</label>
                            <input
                              type="number"
                              value={qardCoopInstantPercent}
                              onChange={(e) => setQardCoopInstantPercent(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:ring-1 focus:ring-emerald-400"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-black text-emerald-200 block">সর্বোচ্চ মেয়াদ (মাস):</label>
                            <input
                              type="number"
                              value={qardCoopInstantMaxDuration}
                              onChange={(e) => setQardCoopInstantMaxDuration(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:ring-1 focus:ring-emerald-400"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-black text-emerald-200 block">নীতিমালা ও নির্দেশিকা টেক্সট:</label>
                          <textarea
                            rows={3}
                            value={qardCoopInstantDesc}
                            onChange={(e) => setQardCoopInstantDesc(e.target.value)}
                            placeholder="সমিতিতে যাদের একাউন্ট/সঞ্চয় রয়েছে, তারা তাদের জমানো সঞ্চয়ের 1% থেকে 50% টাকা..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-400 leading-relaxed"
                          />
                        </div>
                      </div>

                      {/* ========================================================
                          💎 স্বর্ণ রেখে জরুরি টাকা (গোল্ড লোন) সেটিংস ও বাজারদর হাব
                         ======================================================== */}
                      <div className="bg-slate-950/80 border border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">💎</span>
                            <div>
                              <h4 className="text-sm font-black text-amber-300">
                                স্বর্ণ রেখে জরুরি টাকা (গোল্ড লোন) সেটিংস ও বাজারদর হাব
                              </h4>
                              <span className="text-[10.5px] text-slate-400 font-medium">
                                100% সমান বাজারমূল্যে সুদমুক্ত ঋণ, সুরক্ষা মেয়াদের দিন/মাস এবং প্রতি ভরি স্বর্ণের রেট
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                              <input
                                type="checkbox"
                                checked={qardGoldLoanEnabled}
                                onChange={(e) => setQardGoldLoanEnabled(e.target.checked)}
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-800 border-slate-600"
                              />
                              <span className={`text-xs font-black ${qardGoldLoanEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {qardGoldLoanEnabled ? '🟢 গোল্ড লোন চালু' : '🔴 গোল্ড লোন বন্ধ'}
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Title, Subtitle & Protection Timelines */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-black text-amber-200 block">গোল্ড লোন শিরোনাম:</label>
                            <input
                              type="text"
                              value={qardGoldNoticeTitle}
                              onChange={(e) => setQardGoldNoticeTitle(e.target.value)}
                              placeholder="🏦 স্বর্ণ রেখে জরুরি টাকা"
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-black text-amber-200 block">সাব-টাইটেল / সারসংক্ষেপ:</label>
                            <input
                              type="text"
                              value={qardGoldNoticeSubtitle}
                              onChange={(e) => setQardGoldNoticeSubtitle(e.target.value)}
                              placeholder="কারও হঠাৎ টাকার প্রয়োজন হলে, সে তার স্বর্ণ আমাদের কাছে রেখে জরুরি টাকা নিতে পারবে।"
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-black text-amber-200 block">সুরক্ষার মেয়াদ (মাস):</label>
                            <input
                              type="number"
                              value={qardGoldProtectionMonths}
                              onChange={(e) => setQardGoldProtectionMonths(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-black text-amber-200 block">সুরক্ষার মেয়াদ (মোট দিন):</label>
                            <input
                              type="number"
                              value={qardGoldProtectionDays}
                              onChange={(e) => setQardGoldProtectionDays(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>
                        </div>

                        {/* Gold Market Rates per Vori */}
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <span className="text-xs font-black text-amber-300 block">
                            🪙 প্রতি ভরি স্বর্ণের লাইভ বাজারদর (৳ BDT - সমান সমান ক্যাশ ঋণ দেওয়া হবে):
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                              <span className="text-[10px] font-bold text-amber-300 block">24 ক্যারেট (24K)</span>
                              <input
                                type="number"
                                value={qardGoldRateK24}
                                onChange={(e) => setQardGoldRateK24(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                              />
                            </div>
                            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                              <span className="text-[10px] font-bold text-amber-300 block">22 ক্যারেট (22K)</span>
                              <input
                                type="number"
                                value={qardGoldRateK22}
                                onChange={(e) => setQardGoldRateK22(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                              />
                            </div>
                            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                              <span className="text-[10px] font-bold text-amber-300 block">21 ক্যারেট (21K)</span>
                              <input
                                type="number"
                                value={qardGoldRateK21}
                                onChange={(e) => setQardGoldRateK21(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                              />
                            </div>
                            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                              <span className="text-[10px] font-bold text-amber-300 block">18 ক্যারেট (18K)</span>
                              <input
                                type="number"
                                value={qardGoldRateK18}
                                onChange={(e) => setQardGoldRateK18(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                              />
                            </div>
                            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                              <span className="text-[10px] font-bold text-amber-300 block">সনাতন পদ্ধতি (Traditional)</span>
                              <input
                                type="number"
                                value={qardGoldRateTraditional}
                                onChange={(e) => setQardGoldRateTraditional(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Gold Loan Guidelines Editor */}
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-300 block">
                              📜 গোল্ড লোন নিয়মাবলী ও শর্তাবলীর তালিকা ({qardGoldGuidelines.length} টি পয়েন্ট):
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const newText = window.prompt('নতুন শর্ত বা পয়েন্টটি লিখুন:');
                                  if (newText && newText.trim()) {
                                    setQardGoldGuidelines([...qardGoldGuidelines, newText.trim()]);
                                  }
                                }}
                                className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded-lg transition cursor-pointer"
                              >
                                + পয়েন্ট যোগ করুন
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('ডিফল্ট গোল্ড লোন নিয়মাবলীতে রিসেট করতে চান?')) {
                                    setQardGoldGuidelines(DEFAULT_QARD_CONFIG.goldLoanConfig?.guidelines || []);
                                  }
                                }}
                                className="text-[10px] text-slate-400 hover:text-amber-300 font-bold underline cursor-pointer"
                              >
                                🔄 ডিফল্টে রিসেট
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {qardGoldGuidelines.map((guide, gIdx) => (
                              <div
                                key={gIdx}
                                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-amber-400 font-black shrink-0">{gIdx + 1}.</span>
                                  <input
                                    type="text"
                                    value={guide}
                                    onChange={(e) => {
                                      const updated = [...qardGoldGuidelines];
                                      updated[gIdx] = e.target.value;
                                      setQardGoldGuidelines(updated);
                                    }}
                                    className="bg-transparent text-slate-200 w-full outline-none focus:text-white"
                                  />
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = qardGoldGuidelines.filter((_, i) => i !== gIdx);
                                      setQardGoldGuidelines(updated);
                                    }}
                                    className="text-rose-400 hover:text-rose-300 p-1 text-xs cursor-pointer"
                                    title="মুছে ফেলুন"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* MODAL 1: EDIT TICKER ANNOUNCEMENT */}
            {qardShowTickerModal && (
              <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-rose-600 flex items-center gap-2">
                      <Volume2 className="w-4 h-4" /> করযে হাসানা ঘোষণা টিংকার এডিট
                    </h3>
                    <button
                      type="button"
                      onClick={() => setQardShowTickerModal(false)}
                      className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-700 block">ঘোষণা বার্তা টেক্সট:</label>
                    <textarea
                      rows={3}
                      value={qardTickerInput}
                      onChange={(e) => setQardTickerInput(e.target.value)}
                      placeholder="ঘোষণাটি লিখুন..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <p className="text-[10px] text-slate-400">এই ঘোষণা বার্তাটি সদস্যদের অ্যাপে করযে হাসানা স্ক্রিনের উপরে স্ক্রোল করবে।</p>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setQardShowTickerModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveQardTicker}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md"
                    >
                      💾 সেভ করুন
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 2: EDIT FUND BALANCE */}
            {qardShowFundModal && (
              <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-emerald-600 flex items-center gap-2">
                      <Coins className="w-4 h-4" /> করযে হাসানা ফান্ড ব্যালেন্স সমন্বয়
                    </h3>
                    <button
                      type="button"
                      onClick={() => setQardShowFundModal(false)}
                      className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-700 block">ম্যানুয়াল ফান্ডের মোট পরিমাণ (৳ BDT):</label>
                    <input
                      type="number"
                      value={qardFundInput}
                      onChange={(e) => setQardFundInput(e.target.value)}
                      placeholder="যেমন: 50000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-400">0 রাখলে স্বয়ংক্রিয়ভাবে সংগৃহীত মোট দান হিসাব করা হবে। নির্দিষ্ট সংখ্যা দিলে সেটিই ফান্ডে প্রদর্শন করবে।</p>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setQardShowFundModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveQardFundVal}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md"
                    >
                      💾 আপডেট করুন
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 3: DIRECT QARD LOAN DISBURSEMENT */}
            {qardShowDirectLoanModal && (
              <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
                <form onSubmit={handleDirectQardLoanDisburse} className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 text-left max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-emerald-600 flex items-center gap-2">
                      ➕ সদস্যকে সুদমুক্ত করযে হাসানা ঋণ প্রদান
                    </h3>
                    <button
                      type="button"
                      onClick={() => setQardShowDirectLoanModal(false)}
                      className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs font-bold text-slate-700">
                    <div>
                      <label className="block mb-1">গ্রহীতা সদস্য নির্বাচন করুন:</label>
                      <select
                        value={qardDirectUserUid}
                        onChange={(e) => {
                          setQardDirectUserUid(e.target.value);
                          const u = users.find(x => x.uid === e.target.value);
                          if (u) setQardDirectWhatsapp(u.phone || '');
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500"
                        required
                      >
                        <option value="">-- সদস্য নির্বাচন করুন --</option>
                        {users.map((u, idx) => (
                          <option key={`${u.uid || u.id}-${idx}`} value={u.uid}>
                            {u.name} ({u.memberId || u.phone}) - ওয়ালেট ৳{(u.balance || 0).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1">ঋণের পরিমাণ (৳ BDT):</label>
                        <input
                          type="number"
                          placeholder="যেমন: 5000"
                          value={qardDirectAmt}
                          onChange={(e) => setQardDirectAmt(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">পরিশোধের মেয়াদ:</label>
                        <select
                          value={qardDirectDuration}
                          onChange={(e) => setQardDirectDuration(Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value={1}>1 মাস (30 দিন)</option>
                          <option value={3}>3 মাস (3 কিস্তি)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1">মাসিক আনুমানিক আয় (টাকা):</label>
                      <input
                        type="number"
                        placeholder="যেমন: 15000"
                        value={qardDirectMonthly}
                        onChange={(e) => setQardDirectMonthly(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block mb-1">যোগাযোগের WhatsApp / ফোন:</label>
                      <input
                        type="text"
                        placeholder="017xxxxxxxx"
                        value={qardDirectWhatsapp}
                        onChange={(e) => setQardDirectWhatsapp(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setQardShowDirectLoanModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md"
                    >
                      ✅ ঋণ মঞ্জুর ও বিতরণ করুন
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* MODAL 4: DONATION REGISTRATION */}
            {qardShowDonateModal && (
              <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
                <form onSubmit={handleManualQardDonate} className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 text-left max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-rose-600 flex items-center gap-2">
                      ❤️ করযে হাসানা ফান্ডে অনুদান যুক্ত করুন
                    </h3>
                    <button
                      type="button"
                      onClick={() => setQardShowDonateModal(false)}
                      className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs font-bold text-slate-700">
                    <div>
                      <label className="block mb-1">দাতা সদস্য নির্বাচন করুন:</label>
                      <select
                        value={qardDonateUserUid}
                        onChange={(e) => setQardDonateUserUid(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-rose-500"
                        required
                      >
                        <option value="">-- সদস্য নির্বাচন করুন --</option>
                        {users.map((u, idx) => (
                          <option key={`${u.uid || u.id}-${idx}`} value={u.uid}>
                            {u.name} ({u.memberId || u.phone})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1">অনুদানের পরিমাণ (৳ BDT):</label>
                        <input
                          type="number"
                          placeholder="যেমন: 1000"
                          value={qardDonateAmt}
                          onChange={(e) => setQardDonateAmt(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">অনুদানের খাত:</label>
                        <select
                          value={qardDonatePurpose}
                          onChange={(e) => setQardDonatePurpose(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-rose-500"
                        >
                          <option value="general">সাধারণ কল্যাণ ফান্ড</option>
                          <option value="medical">চিকিৎসা সহায়তা</option>
                          <option value="education">শিক্ষা সহায়তা</option>
                          <option value="micro">ক্ষুদ্র ব্যবসা সহায়তা</option>
                          <option value="emergency">জরুরি ত্রাণ সাহায্য</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="qardAnonCheck"
                        checked={qardDonateAnon}
                        onChange={(e) => setQardDonateAnon(e.target.checked)}
                        className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                      />
                      <label htmlFor="qardAnonCheck" className="text-xs text-slate-700 font-bold cursor-pointer">
                        গোপন দাতা হিসেবে সেভ করুন
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setQardShowDonateModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md"
                    >
                      ❤️ দান রেজিস্টার করুন
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* MODAL 5: EDIT TRANSACTION DETAILS */}
            {qardEditingTx && (
              <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
                <form onSubmit={handleUpdateQardTx} className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-amber-600 flex items-center gap-2">
                      <Edit3 className="w-4 h-4" /> করযে হাসানা লেনদেন এডিট
                    </h3>
                    <button
                      type="button"
                      onClick={() => setQardEditingTx(null)}
                      className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs font-bold text-slate-700">
                    <div>
                      <label className="block mb-1">লেনদেনের পরিমাণ (৳):</label>
                      <input
                        type="number"
                        value={qardEditAmt}
                        onChange={(e) => setQardEditAmt(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block mb-1">স্ট্যাটাস:</label>
                      <select
                        value={qardEditStatus}
                        onChange={(e) => setQardEditStatus(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="success">✅ সফল (Success / Approved)</option>
                        <option value="pending">⏳ অপেক্ষমাণ (Pending)</option>
                        <option value="rejected">❌ বাতিল (Rejected)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block mb-1">বিবরণ / নোট:</label>
                      <input
                        type="text"
                        value={qardEditDesc}
                        onChange={(e) => setQardEditDesc(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block mb-1">সদস্যের ফোন:</label>
                      <input
                        type="text"
                        value={qardEditWhatsapp}
                        onChange={(e) => setQardEditWhatsapp(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setQardEditingTx(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md"
                    >
                      💾 পরিবর্তন সংরক্ষণ করুন
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* MODAL 6: FUND BREAKDOWN DETAIL MODAL */}
            {qardShowBreakdownModal && (
              <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" /> করযে হাসানা ফান্ডের হিসাব বিবরণী
                    </h3>
                    <button
                      type="button"
                      onClick={() => setQardShowBreakdownModal(false)}
                      className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {(() => {
                    const qardTxs = transactions.filter(t => ['qard_donation', 'qard_loan_request', 'qard_loan_disbursment', 'qard_loan_repayment'].includes(t.type));
                    const totalDonations = qardTxs.filter(t => t.type === 'qard_donation' && t.status === 'success').reduce((sum, t) => sum + (t.amount || 0), 0);
                    const totalDisbursed = qardTxs.filter(t => (t.type === 'qard_loan_disbursment' || t.type === 'qard_loan_request') && t.status === 'success').reduce((sum, t) => sum + (t.amount || 0), 0);
                    const totalRepaid = qardTxs.filter(t => t.type === 'qard_loan_repayment' && t.status === 'success').reduce((sum, t) => sum + (t.amount || 0), 0);
                    const activeLoansAmount = Math.max(0, totalDisbursed - totalRepaid);
                    const objQ = getFundValueAndStatus('qard_fund', 0);

                    return (
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="font-bold text-slate-600">মোট সংগৃহীত অনুদান:</span>
                          <span className="font-black font-mono text-emerald-600">৳ {totalDonations.toLocaleString('en-US')}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="font-bold text-slate-600">বিতরণকৃত ঋণ:</span>
                          <span className="font-black font-mono text-blue-600">৳ {totalDisbursed.toLocaleString('en-US')}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="font-bold text-slate-600">পরিশোধিত ঋণ:</span>
                          <span className="font-black font-mono text-teal-600">৳ {totalRepaid.toLocaleString('en-US')}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="font-bold text-slate-600">বর্তমানে ঋণগ্রহীতাদের কাছে বকেয়া:</span>
                          <span className="font-black font-mono text-rose-600">৳ {activeLoansAmount.toLocaleString('en-US')}</span>
                        </div>
                        <div className="flex justify-between py-2 bg-emerald-50 px-3 rounded-xl">
                          <span className="font-black text-emerald-900">ফান্ডের বর্তমান নীট ব্যালেন্স:</span>
                          <span className="font-black font-mono text-emerald-700 text-sm">৳ {objQ.val.toLocaleString('en-US')}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setQardShowBreakdownModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition cursor-pointer"
                    >
                      বন্ধ করুন
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 7: ADD / EDIT SINGLE QARD RULE ITEM */}
            {showRuleModal && (
              <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
                <form onSubmit={handleSaveSingleRuleItem} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span>📜</span>
                      <span>{editingRuleIndex !== null ? 'নিয়ম/শর্ত এডিট করুন' : 'নতুন নিয়ম/শর্ত যুক্ত করুন'}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowRuleModal(false)}
                      className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs font-bold text-slate-700">
                    <div className="grid grid-cols-4 gap-2">
                      <div className="col-span-1">
                        <label className="block mb-1">আইকন/ইমোজি:</label>
                        <input
                          type="text"
                          value={ruleIconInput}
                          onChange={(e) => setRuleIconInput(e.target.value)}
                          placeholder="🤝"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center text-base font-bold outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block mb-1">নিয়মের শিরোনাম:</label>
                        <input
                          type="text"
                          value={ruleTitleInput}
                          onChange={(e) => setRuleTitleInput(e.target.value)}
                          placeholder="যেমন: সম্পূর্ণ বিনা সুদে"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1">নিয়মের বিস্তারিত বিবরণ:</label>
                      <textarea
                        rows={4}
                        value={ruleDescInput}
                        onChange={(e) => setRuleDescInput(e.target.value)}
                        placeholder="নিয়মের সম্পূর্ণ শর্ত বা বিবরণ লিখুন..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed"
                        required
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1 bg-amber-50/70 border border-amber-200 p-2.5 rounded-xl">
                      <input
                        type="checkbox"
                        id="ruleIsWarningCheck"
                        checked={ruleIsWarningInput}
                        onChange={(e) => setRuleIsWarningInput(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                      />
                      <label htmlFor="ruleIsWarningCheck" className="text-[11px] text-amber-950 font-bold cursor-pointer">
                        ⚠️ এটি একটি বিশেষ সতর্কতা বা জরিমানা সংক্রান্ত নিয়ম (লাল বক্সে হাইলাইট হবে)
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowRuleModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md"
                    >
                      {editingRuleIndex !== null ? '💾 আপডেট করুন' : '➕ নিয়ম যোগ করুন'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}


        {/* TAB 11: DYNAMIC BANNERS AND COVER PHOTO GALLERY */}
    </>
  );
}
