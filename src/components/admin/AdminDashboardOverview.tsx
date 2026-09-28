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
import { saveAppConfig, saveSectionIcon, DEFAULT_QARD_CONFIG } from '../../lib/config';
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

export function AdminDashboardOverview(props: any) {
  const appConfig = props.appConfig || {};
  const onChangeConfig = props.onChangeConfig || (() => {});

  const [editingSection, setEditingSection] = useState<{
    key: string;
    titleKey: string;
    defaultTitle: string;
    currentTitle: string;
    labelEng: string;
  } | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [editEngInput, setEditEngInput] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);

  const handleUploadIcon = async (sectionKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.alert('অনুগ্রহ করে একটি সঠিক ইমেজ ফাইল (JPG, PNG, WebP) সিলেক্ট করুন।');
      e.target.value = '';
      return;
    }

    setUploadingSection(sectionKey);

    try {
      // 1. Read file as Data URL with Promise
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      // 2. Compress & resize image to crisp 200x200 square preserving transparency
      const compressedBase64 = await new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const SIZE = 128;
            const canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              const minSide = Math.min(img.width, img.height);
              const sx = (img.width - minSide) / 2;
              const sy = (img.height - minSide) / 2;
              ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, SIZE, SIZE);

              let res = canvas.toDataURL('image/webp', 0.82);
              if (!res || !res.startsWith('data:image/webp')) {
                res = canvas.toDataURL('image/jpeg', 0.82);
              }
              resolve(res);
            } else {
              resolve(dataUrl);
            }
          } catch (err) {
            console.warn("Canvas compression failed, falling back to dataUrl", err);
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });

      // 3. Instant Optimistic State Update for zero-latency preview
      const updatedIcons = {
        ...(appConfig?.sectionIcons || {}),
        [sectionKey]: compressedBase64
      };
      const updatedConfig: AppConfig = {
        ...appConfig,
        sectionIcons: updatedIcons
      };
      onChangeConfig(updatedConfig);

      // 4. Authoritative Firestore persistence
      await saveSectionIcon(sectionKey, compressedBase64);

    } catch (err: any) {
      console.error("Error saving section icon:", err);
      window.alert('লোগো পরিবর্তন করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setUploadingSection(null);
      e.target.value = '';
    }
  };

  const handleResetIcon = async (sectionKey: string, sectionTitle: string) => {
    if (!window.confirm(`${sectionTitle}-এর লোগোটি রিমুভ করে কি ডিফল্ট আইকনে ফিরে যেতে চান?`)) {
      return;
    }
    setUploadingSection(sectionKey);
    try {
      const updatedIcons = { ...(appConfig?.sectionIcons || {}) };
      if (sectionKey === 'samity') {
        updatedIcons.samity = '/samity_logo.svg';
      } else {
        delete updatedIcons[sectionKey];
      }
      const updatedConfig: AppConfig = {
        ...appConfig,
        sectionIcons: updatedIcons
      };
      onChangeConfig(updatedConfig);
      await saveSectionIcon(sectionKey, '');
    } catch (err) {
      console.error("Error resetting section icon:", err);
      window.alert('লোগো রিসেট করতে সমস্যা হয়েছে');
    } finally {
      setUploadingSection(null);
    }
  };

  const handleSaveSectionTitle = async () => {
    if (!editingSection) return;
    if (!editTitleInput.trim()) {
      window.alert('অনুগ্রহ করে সেকশনের একটি নাম দিন');
      return;
    }
    setIsSavingTitle(true);
    try {
      const updatedGlobalTexts = {
        ...(appConfig?.globalTexts || {}),
        [editingSection.titleKey]: editTitleInput.trim(),
        [editingSection.titleKey + '_eng']: editEngInput.trim() || editingSection.labelEng,
      };
      const updatedCfg: AppConfig = {
        ...appConfig,
        globalTexts: updatedGlobalTexts,
      };
      await saveAppConfig(updatedCfg);
      onChangeConfig(updatedCfg);
      setEditingSection(null);
    } catch (err) {
      console.error('Error saving section title:', err);
      window.alert('নাম পরিবর্তন সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const {
    valFineFund,
    fineHistoryItems,
    users,
    u,
    userId,
    id,
    name,
    getUserMainWalletBalance,
    amount,
    type,
    transactions,
    description,
    uid,
    amt,
    year,
    day,
    trxId,
    reason,
    timeA,
    timeB,
    valSamityFund,
    valQardFund,
    cashback,
    valMobileCashbackFund,
    adminSeenNoticeIds,
    q,
    setSelectedAutoNoticeCategory,
    setShowAutoNoticeModal,
    text,
    isMasterAdmin,
    hasPermission,
    alert,
    setAdminTab,
    setViewingGrid,
    left,
    y,
    setAdjustFundKey,
    setAdjustCustomValue,
    valMasterFund,
    setShowFundAdjustModal,
    requestPrompt,
    initialCompanyFund,
    val,
    updated,
    setDrillDownModalData,
    masterAccounts,
    valMobileRechargeFund,
    setQardBoxViewHawlat,
    qardBoxViewHawlat,
    valQardMainFund,
    qardAllTransactions,
    valCashAndBankBalance,
    valIncome,
    isApproved,
    fee,
    profit,
    typeLabel,
    item,
    valExpense,
    valNetAsset,
    totalMemberBalance,
    totalExpenses,
    valLiabilities,
    setShowSection12ReportModal,
    img,
    adminAgentRequests,
    notices,
    phoneChangeRequests,
    cfgLogoUrl,
    file,
    target,
    reader,
    canvas,
    width,
    height,
    ctx,
    d,
    compressedBase64,
    data,
    handleDirectUpdateLogo,
    key,
    updatedConfig,
    handleGoBack,
    adminTab
  } = props;

  return (
    <>
                            {/* 2. 4-Section Auto-Tracking & Live Fine Hub (সবুজ দাগে চিহ্নিত 4টি অটো সেকশন) */}
              {(() => {
                // 1. Auto Fine & Late Fee Data
                const autoFineTotal = valFineFund;
                const autoFineCount = fineHistoryItems.length;

                // 2. Auto Savings & Installment Deduct Data
                const savingUsers = users.filter(u => (u.savings || 0) > 0);
                const autoSavingsMembersList = (savingUsers.length > 0 ? savingUsers : users).map(u => ({
                  userId: u.id,
                  userObj: u,
                  name: u.name || u.phone || 'সমিতি সদস্য',
                  phone: u.phone || '—',
                  memberId: u.memberId || 'N/A',
                  profilePic: u.profilePic,
                  balance: getUserMainWalletBalance(u),
                  savings: Number(u.savings) || 0,
                  dueLoan: Number(u.dueLoan) || 0,
                  amount: Number(u.savings) || 0,
                  date: (u as any).lastSavingsDate || (u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US') : 'চলতি'),
                  type: '🔄 অটো সঞ্চয় স্থিতি',
                  status: (u.savings || 0) > 0 ? 'সঞ্চয় জমা রয়েছে' : 'নিয়মিত'
                })).sort((a, b) => b.savings - a.savings);

                const autoSavingsTxList = transactions
                  .filter(t => (
                    t.type === 'coop_savings_deposit' || 
                    (t.type === 'samity_deposit' && (t.description?.includes('অটো') || t.description?.includes('কিস্তি'))) || 
                    (t.type === 'savings_deposit' && (t.description?.includes('অটো') || t.description?.includes('কিস্তি'))) || 
                    (t.category === 'savings' && (t.description?.includes('অটো') || t.description?.includes('কিস্তি'))) ||
                    (t.description && (t.description.includes('অটো') || t.description.includes('কিস্তি')))
                  ) && (t.status === 'success' || t.status === 'approved' || !t.status))
                  .map(t => {
                    const u = users.find(usr => usr.uid === t.userId || usr.id === t.userId || usr.phone === t.userPhone || usr.phone === t.phoneNumber);
                    const amt = Number(t.amount || 0);
                    const formattedDate = t.createdAt 
                      ? new Date(t.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) 
                      : (t.date || 'আজ');
                    return {
                      userId: u?.id || t.userId,
                      userObj: u,
                      name: t.userName || t.senderName || u?.name || 'সমিতি সদস্য',
                      phone: t.userPhone || t.senderPhone || u?.phone || '—',
                      memberId: u?.memberId || t.memberId || t.trxId || 'SAV-AUTO',
                      profilePic: u?.profilePic,
                      balance: u ? getUserMainWalletBalance(u) : 0,
                      savings: u?.savings || 0,
                      date: formattedDate,
                      rawCreatedAt: t.createdAt || '',
                      amount: amt,
                      reason: t.description || `মেইন ব্যালেন্স হতে ৳${amt.toLocaleString('en-US')} কেটে সমবায় সমিতি সঞ্চয় তহবিলে সফলভাবে জমা করা হয়েছে।`,
                      noticeText: `মেইন ব্যালেন্স হতে ৳${amt.toLocaleString('en-US')} কেটে সমবায় সমিতি সঞ্চয় তহবিলে ক্রেডিট করা হয়েছে।`,
                      type: '🔄 অটো সঞ্চয় কর্তন নোটিশ',
                      category: 'auto',
                      status: 'সফলভাবে কর্তন ও ক্রেডিট'
                    };
                  })
                  .sort((a, b) => {
                    const timeA = a.rawCreatedAt ? new Date(a.rawCreatedAt).getTime() : 0;
                    const timeB = b.rawCreatedAt ? new Date(b.rawCreatedAt).getTime() : 0;
                    return timeB - timeA;
                  });

                const autoSavingsCombined = autoSavingsTxList.length > 0 ? autoSavingsTxList : autoSavingsMembersList;
                const autoSavingsTotal = savingUsers.reduce((s, u) => s + (Number(u.savings) || 0), 0) || valSamityFund;

                // 3. Auto Qard & Loan Data
                const autoQardBorrowers = users.filter(u => (u.dueLoan || 0) > 0 || (u.loanAmount || 0) > 0).map(u => ({
                  userId: u.id,
                  userObj: u,
                  name: u.name || u.phone || 'হাওলাত গ্রহীতা',
                  phone: u.phone || '—',
                  memberId: u.memberId || 'N/A',
                  profilePic: u.profilePic,
                  balance: getUserMainWalletBalance(u),
                  savings: u.savings || 0,
                  loanAmount: u.loanAmount || 0,
                  paidLoan: u.paidLoan || 0,
                  dueLoan: u.dueLoan || 0,
                  amount: u.dueLoan || 0,
                  category: 'borrower',
                  type: '🔴 হাওলাত ঋণ (বকেয়া)',
                  status: (u.dueLoan || 0) > 0 ? 'বকেয়া ঋণ রয়েছে' : 'পরিশোধিত',
                  date: (u as any).lastLoanDate || (u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US') : 'চলতি')
                })).sort((a, b) => b.dueLoan - a.dueLoan);
                const autoQardTotal = valQardFund;

                // 4. Auto Refund, Cashback & Payout Data
                const autoRefundList = transactions
                  .filter(t => (
                    ['cashback', 'refund', 'bonus', 'telecom_cashback', 'commission'].includes(t.type) || 
                    (t.description && (t.description.includes('ক্যাশব্যাক') || t.description.includes('রিফান্ড') || t.description.includes('বোনাস') || t.description.includes('ডিসেম্বর')))
                  ) && (t.status === 'success' || t.status === 'approved'))
                  .map(t => {
                    const u = users.find(usr => usr.uid === t.userId || usr.phone === t.userPhone || usr.phone === t.phoneNumber);
                    return {
                      userId: u?.id || t.userId,
                      userObj: u,
                      name: t.userName || u?.name || 'গ্রাহক',
                      phone: t.userPhone || u?.phone || '—',
                      memberId: u?.memberId || t.trxId || 'RFD-LOG',
                      profilePic: u?.profilePic,
                      balance: u ? getUserMainWalletBalance(u) : 0,
                      date: t.date || (t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US') : 'আজ'),
                      amount: Number(t.amount || 0),
                      reason: t.description || 'অটোমেটিক ক্যাশব্যাক / রিফান্ড ক্রেডিট',
                      type: '🎁 অটো রিফান্ড / ক্যাশব্যাক',
                      status: 'সফলভাবে ক্রেডিট'
                    };
                  });
                const autoRefundTotal = autoRefundList.reduce((s, i) => s + i.amount, 0) || valMobileCashbackFund;

                // Calculate Live Unseen Counts for each of the 4 boxes
                const unseenFineCount = fineHistoryItems.filter((f: any) => !adminSeenNoticeIds.includes('fine-' + (f.id || f.phone || f.memberId || '') + '-' + f.date)).length;
                const unseenSavingsCount = autoSavingsCombined.filter((s, idx) => !adminSeenNoticeIds.includes('savings-' + (s.userId || s.memberId || idx) + '-' + s.date)).length;
                const unseenLoanCount = autoQardBorrowers.filter(q => !adminSeenNoticeIds.includes('loan-' + (q.userId || q.memberId || '') + '-' + q.date)).length;
                const unseenRefundCount = autoRefundList.filter((r, idx) => !adminSeenNoticeIds.includes('refund-' + (r.userId || r.memberId || idx) + '-' + r.date)).length;

                return (
                  <div className="grid grid-cols-4 gap-1 sm:gap-2 mb-2.5">
                    {/* Box 1: অটো জরিমানা */}
                    <div 
                      onClick={() => {
                        setSelectedAutoNoticeCategory('fine');
                        setShowAutoNoticeModal(true);
                      }}
                      className="bg-gradient-to-br from-rose-950 via-slate-900 to-rose-900 border border-rose-700/50 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 text-white shadow-xs cursor-pointer hover:border-rose-400 transition active:scale-98 flex flex-col justify-between overflow-hidden relative group"
                    >
                      <div className="flex items-center justify-between gap-0.5 text-[8px] sm:text-[10px] md:text-xs font-black text-rose-300">
                        <span className="flex items-center gap-0.5 sm:gap-1 truncate">
                          <ShieldAlert className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-rose-400 shrink-0" />
                          <span className="truncate">অটো জরিমানা</span>
                        </span>
                        <span className={`text-[7.5px] sm:text-[9px] px-1 py-0.2 rounded-full font-mono font-black border shrink-0 transition ${
                          unseenFineCount > 0 
                            ? 'bg-rose-500 text-white border-rose-400 animate-pulse ring-1 ring-rose-300' 
                            : 'bg-slate-800/80 text-rose-200 border-rose-500/40'
                        }`}>
                          {unseenFineCount > 0 ? `${unseenFineCount}টি` : `${autoFineCount}টি`}
                        </span>
                      </div>
                      <div className="mt-1">
                        <div className="text-[9.5px] sm:text-xs md:text-sm font-black text-white font-mono tracking-tight truncate">
                          ৳{autoFineTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                        </div>
                        <div className="text-[6.5px] sm:text-[8px] md:text-[9px] text-rose-200/80 font-bold truncate mt-0.5 flex items-center justify-between">
                          <span>লেট ফি ও পেনাল্টি</span>
                          {unseenFineCount > 0 && <span className="text-[6.5px] bg-rose-500/80 text-white px-0.8 py-0.2 rounded-xs font-black">নতুন</span>}
                        </div>
                      </div>
                    </div>

                    {/* Box 2: অটো সঞ্চয় ও কিস্তি কর্তন */}
                    <div 
                      onClick={() => {
                        setSelectedAutoNoticeCategory('savings');
                        setShowAutoNoticeModal(true);
                      }}
                      className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-900 border border-emerald-700/50 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 text-white shadow-xs cursor-pointer hover:border-emerald-400 transition active:scale-98 flex flex-col justify-between overflow-hidden relative group"
                    >
                      <div className="flex items-center justify-between gap-0.5 text-[8px] sm:text-[10px] md:text-xs font-black text-emerald-300">
                        <span className="flex items-center gap-0.5 sm:gap-1 truncate">
                          <RefreshCw className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">অটো সঞ্চয়</span>
                        </span>
                        <span className={`text-[7.5px] sm:text-[9px] px-1 py-0.2 rounded-full font-mono font-black border shrink-0 transition ${
                          unseenSavingsCount > 0 
                            ? 'bg-emerald-500 text-white border-emerald-300 animate-pulse ring-1 ring-emerald-300' 
                            : 'bg-slate-800/80 text-emerald-200 border-emerald-500/40'
                        }`}>
                          {unseenSavingsCount > 0 ? `${unseenSavingsCount}টি` : `${savingUsers.length || autoSavingsCombined.length}জন`}
                        </span>
                      </div>
                      <div className="mt-1">
                        <div className="text-[9.5px] sm:text-xs md:text-sm font-black text-white font-mono tracking-tight truncate">
                          ৳{autoSavingsTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                        </div>
                        <div className="text-[6.5px] sm:text-[8px] md:text-[9px] text-emerald-200/80 font-bold truncate mt-0.5 flex items-center justify-between">
                          <span>ব্যালেন্স হতে সঞ্চয়</span>
                          {unseenSavingsCount > 0 && <span className="text-[6.5px] bg-emerald-500/80 text-white px-0.8 py-0.2 rounded-xs font-black">নতুন</span>}
                        </div>
                      </div>
                    </div>

                    {/* Box 3: সুদমুক্ত হাওলাত ও ঋণ */}
                    <div 
                      onClick={() => {
                        setSelectedAutoNoticeCategory('loan');
                        setShowAutoNoticeModal(true);
                      }}
                      className="bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-900 border border-indigo-700/50 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 text-white shadow-xs cursor-pointer hover:border-indigo-400 transition active:scale-98 flex flex-col justify-between overflow-hidden relative group"
                    >
                      <div className="flex items-center justify-between gap-0.5 text-[8px] sm:text-[10px] md:text-xs font-black text-indigo-300">
                        <span className="flex items-center gap-0.5 sm:gap-1 truncate">
                          <TrendingUp className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate">হাওলাত ঋণ</span>
                        </span>
                        <span className={`text-[7.5px] sm:text-[9px] px-1 py-0.2 rounded-full font-mono font-black border shrink-0 transition ${
                          unseenLoanCount > 0 
                            ? 'bg-indigo-500 text-white border-indigo-300 animate-pulse ring-1 ring-indigo-300' 
                            : 'bg-slate-800/80 text-indigo-200 border-indigo-500/40'
                        }`}>
                          {unseenLoanCount > 0 ? `${unseenLoanCount}টি` : `${autoQardBorrowers.length}জন`}
                        </span>
                      </div>
                      <div className="mt-1">
                        <div className="text-[9.5px] sm:text-xs md:text-sm font-black text-white font-mono tracking-tight truncate">
                          ৳{autoQardTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                        </div>
                        <div className="text-[6.5px] sm:text-[8px] md:text-[9px] text-indigo-200/80 font-bold truncate mt-0.5 flex items-center justify-between">
                          <span>বকেয়া ও রিকভারি</span>
                          {unseenLoanCount > 0 && <span className="text-[6.5px] bg-indigo-500/80 text-white px-0.8 py-0.2 rounded-xs font-black">নতুন</span>}
                        </div>
                      </div>
                    </div>

                    {/* Box 4: অটো রিফান্ড ও ক্যাশব্যাক */}
                    <div 
                      onClick={() => {
                        setSelectedAutoNoticeCategory('refund');
                        setShowAutoNoticeModal(true);
                      }}
                      className="bg-gradient-to-br from-amber-950 via-slate-900 to-yellow-900 border border-amber-700/50 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 text-white shadow-xs cursor-pointer hover:border-amber-400 transition active:scale-98 flex flex-col justify-between overflow-hidden relative group"
                    >
                      <div className="flex items-center justify-between gap-0.5 text-[8px] sm:text-[10px] md:text-xs font-black text-amber-300">
                        <span className="flex items-center gap-0.5 sm:gap-1 truncate">
                          <Sparkles className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">অটো রিফান্ড</span>
                        </span>
                        <span className={`text-[7.5px] sm:text-[9px] px-1 py-0.2 rounded-full font-mono font-black border shrink-0 transition ${
                          unseenRefundCount > 0 
                            ? 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse ring-1 ring-amber-300' 
                            : 'bg-slate-800/80 text-amber-200 border-amber-500/40'
                        }`}>
                          {unseenRefundCount > 0 ? `${unseenRefundCount}টি` : `${autoRefundList.length}টি`}
                        </span>
                      </div>
                      <div className="mt-1">
                        <div className="text-[9.5px] sm:text-xs md:text-sm font-black text-white font-mono tracking-tight truncate">
                          ৳{autoRefundTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                        </div>
                        <div className="text-[6.5px] sm:text-[8px] md:text-[9px] text-amber-200/80 font-bold truncate mt-0.5 flex items-center justify-between">
                          <span>ক্যাশব্যাক / বোনাস</span>
                          {unseenRefundCount > 0 && <span className="text-[6.5px] bg-amber-500 text-slate-950 px-0.8 py-0.2 rounded-xs font-black">নতুন</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Notice Ticker Bar ("ঘোষণা") */}
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-2 sm:p-2.5 flex items-center gap-3 mb-3 shadow-3xs">
                <button 
                  type="button"
                  onClick={() => { 
                    if (!isMasterAdmin && !hasPermission('config')) {
                      alert('🔒 শুধুমাত্র মাস্টার এডমিন ঘোষণা ও নোটিশ এডিট করতে পারবেন।');
                      return;
                    }
                    setAdminTab('config'); 
                    setViewingGrid(false); 
                  }}
                  className="bg-[#00a884] hover:bg-[#009675] text-white text-[11px] font-black px-3 py-1 rounded-xl flex items-center gap-1 shadow-2xs shrink-0 cursor-pointer"
                >
                  ঘোষণা {isMasterAdmin ? <Pencil className="w-3 h-3 text-emerald-100" /> : '📢'}
                </button>
                <div className="text-xs font-black text-slate-800 truncate flex items-center gap-1.5">
                  <span className="text-slate-600 font-bold">ন না</span>
                  <span className="text-rose-600 font-black">❌ {appConfig?.noticeText || "আপস টেস্ট চলতেছে"}</span>
                </div>
              </div>

              {/* ✨ 3 x 4 = 12 Box Financial Dashboard & Balance Control */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs text-left mb-4 font-sans space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-1.5">
                        🏛️ কোম্পানির আর্থিক স্থিতি ও ব্যালেন্স কন্ট্রোল
                      </h3>
                      <span className="text-[10px] text-slate-500 font-bold block">3 × 4 লেআউট • 12টি মূল ব্যালেন্স মডিউল (সংখ্যা ইংলিশে, বিবরণ বাংলায়)</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {isMasterAdmin ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustFundKey('master_fund');
                            setAdjustCustomValue(String(valMasterFund));
                            setShowFundAdjustModal(true);
                          }}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Settings className="w-3.5 h-3.5 text-amber-600" /> ⚙️ ম্যানুয়াল ব্যালেন্স টিউন/এডিট
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            requestPrompt(
                              'প্রারম্ভিক কোম্পানি ফান্ড পরিবর্তন',
                              'সর্বমোট প্রারম্ভিক কোম্পানি ফান্ডের মূল অংক (টাকায়) প্রবেশ করান:',
                              String(appConfig?.initialCompanyFund || 1200000),
                              async (val) => {
                                const parsed = Number(val);
                                if (!isNaN(parsed) && parsed >= 0) {
                                  const updated = { ...appConfig, initialCompanyFund: parsed };
                                  await saveAppConfig(updated);
                                  onChangeConfig(updated);
                                  alert('কোম্পানি প্রারম্ভিক ফান্ড সফলভাবে আপডেট করা হয়েছে!');
                                }
                              }
                            );
                          }}
                          className="bg-emerald-50 hover:bg-emerald-100 text-[#00a884] border border-emerald-200 text-xs font-black px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" /> প্রারম্ভিক ফান্ড
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-xl border border-slate-200 flex items-center gap-1">
                        🔒 মাস্টার এডমিন ব্যালেন্স কন্ট্রোল (রিড-অনলি ভিউ)
                      </span>
                    )}
                  </div>
                </div>

                {/* 3 x 4 = 12 Metric Cards Grid (Strictly 4 cols per row across all screens - Slim & Clean) */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
                  {/* Row 1, Box 1: Master Fund */}
                  <div 
                    onClick={() => setDrillDownModalData({
                      title: '1. কোম্পানির সর্বমোট ফান্ড (Master Fund)',
                      amount: valMasterFund,
                      type: 'master_fund',
                      history: masterAccounts
                    })}
                    className="bg-gradient-to-br from-[#008769] to-[#006e55] text-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-2xs flex flex-col justify-between cursor-pointer hover:opacity-95 transition active:scale-98 min-h-[56px] sm:min-h-[68px]"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold text-teal-100">
                      <span className="truncate">1. মাস্টার ফান্ড</span>
                      <span className="text-[11px] sm:text-sm shrink-0">🏛️</span>
                    </div>
                    <div className="text-xs sm:text-lg font-black text-white tracking-tighter sm:tracking-tight font-mono">
                      ৳ {valMasterFund.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Row 1, Box 2: Samity Fund */}
                  <div 
                    onClick={() => setDrillDownModalData({
                      title: '2. সমবায় সমিতি ফান্ড (সদস্য আমানত ও শেয়ার)',
                      amount: valSamityFund,
                      type: 'samity_fund',
                      history: users.map((u, idx) => ({
                        userId: u.id,
                        userObj: u,
                        name: u.name,
                        phone: u.phone,
                        memberId: u.memberId,
                        savings: Number(u.savings !== undefined ? u.savings : u.dpsBalance) || 0,
                        amount: Number(u.savings !== undefined ? u.savings : u.dpsBalance) || 0,
                        type: 'সমিতি আমানত',
                        status: (u.samityStatus === 'approved' || u.samityApproved === true || u.isSamityMember === true) ? 'সমবায় সমিতি সদস্য' : 'নরমাল সদস্য (AMB ইনভেস্টার)'
                      })).sort((a, b) => b.amount - a.amount)
                    })}
                    className="bg-teal-50/90 border border-teal-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-teal-100/90 transition active:scale-98 min-h-[56px] sm:min-h-[68px]"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold text-teal-900">
                      <span className="truncate">2. সমিতি ফান্ড</span>
                      <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-teal-700 shrink-0" />
                    </div>
                    <div className="text-xs sm:text-lg font-black text-teal-950 tracking-tighter sm:tracking-tight font-mono">
                      ৳ {valSamityFund.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Row 1, Box 3: Mobile Recharge Fund */}
                  <div 
                    onClick={() => setDrillDownModalData({
                      title: '3. মোবাইল রিচার্জ ফান্ড ও টেলিকম লেনদেন',
                      amount: valMobileRechargeFund,
                      type: 'telecom_fund',
                      history: transactions.filter(t => t.type === 'telecom' || t.type === 'telecom_recharge' || (t.type as any) === 'recharge').map((t, idx) => ({
                        name: t.userName || t.phoneNumber || 'টেলিকম রিচার্জ',
                        phone: t.phoneNumber || t.userPhone || '—',
                        memberId: t.operator ? `${t.operator.toUpperCase()} - ${t.packageType || 'Recharge'}` : 'Telecom',
                        date: t.date || (t.createdAt ? new Date(t.createdAt).toLocaleDateString('bn-BD') : 'আজ'),
                        amount: t.amount || 0,
                        status: t.status === 'success' ? 'সফল' : t.status === 'pending' ? 'পেন্ডিং' : 'বাতিল',
                        type: 'মোবাইল রিচার্জ'
                      })).sort((a, b) => b.amount - a.amount)
                    })}
                    className="bg-sky-50/90 border border-sky-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-sky-100/90 transition active:scale-98 min-h-[56px] sm:min-h-[68px]"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold text-sky-900">
                      <span className="truncate">3. রিচার্জ ফান্ড</span>
                      <Smartphone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-700 shrink-0" />
                    </div>
                    <div className="text-xs sm:text-lg font-black text-sky-950 tracking-tighter sm:tracking-tight font-mono">
                      ৳ {valMobileRechargeFund.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Row 1, Box 4: Mobile Cashback/Bonus Fund */}
                  <div 
                    onClick={() => setDrillDownModalData({
                      title: '4. মোবাইল ক্যাশব্যাক/বোনাস ফান্ড (সদস্য অনুযায়ী)',
                      amount: valMobileCashbackFund,
                      type: 'cashback_fund',
                      history: users.map((u, idx) => ({
                        userId: u.id,
                        userObj: u,
                        name: u.name,
                        phone: u.phone,
                        memberId: u.memberId,
                        cashback: u.cashback || 0,
                        amount: u.cashback || 0,
                        type: 'সদস্য অর্জিত ক্যাশব্যাক',
                        status: (u.cashback || 0) > 0 ? 'ক্যাশব্যাক প্রাপ্ত' : 'শূন্য ক্যাশব্যাক'
                      })).sort((a, b) => b.amount - a.amount)
                    })}
                    className="bg-emerald-50/90 border border-emerald-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-emerald-100/90 transition active:scale-98 min-h-[56px] sm:min-h-[68px]"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold text-emerald-900">
                      <span className="truncate">4. ক্যাশব্যাক ফান্ড</span>
                      <Gift className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-700 shrink-0" />
                    </div>
                    <div className="text-xs sm:text-lg font-black text-emerald-950 tracking-tighter sm:tracking-tight font-mono">
                      ৳ {valMobileCashbackFund.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Row 2, Box 5: Qard Hasana Loan & Main Fund */}
                  <div 
                    onClick={() => {
                      setDrillDownModalData({
                        title: qardBoxViewHawlat ? '5. কর্জে হাসানা (বিতরণকৃত হাওলাত ঋণ)' : '5. কর্জে হাসানা (মূল কল্যাণ তহবিল)',
                        amount: qardBoxViewHawlat ? valQardFund : valQardMainFund,
                        loanAmount: valQardFund,
                        type: 'qard_fund',
                        history: [
                          ...users.filter(u => (u.dueLoan || 0) > 0 || (u.loanAmount || 0) > 0).map((u) => ({
                            userId: u.id,
                            userObj: u,
                            name: u.name,
                            phone: u.phone,
                            memberId: u.memberId,
                            loanAmount: u.loanAmount || 0,
                            paidLoan: u.paidLoan || 0,
                            dueLoan: u.dueLoan || 0,
                            amount: u.dueLoan || 0,
                            category: 'borrower',
                            type: 'হাওলাত ঋণ (বকেয়া)',
                            status: (u.dueLoan || 0) > 0 ? 'বকেয়া ঋণ রয়েছে' : 'পরিশোধিত',
                            date: (u as any).lastLoanDate || (u.createdAt ? new Date(u.createdAt).toLocaleDateString('bn-BD') : 'চলতি')
                          })),
                          ...qardAllTransactions.filter(t => t.type === 'qard_donation' && (t.status === 'success' || t.status === 'approved')).map(t => {
                            const pId = (t as any).donationPurpose || (t as any).purpose || '';
                            const desc = (t.description || t.details || '').toLowerCase();
                            let sId = 'general';
                            let sTitle = 'সাধারণ করযে হাসানা ফান্ড';
                            let sEmoji = '🤝';
                            if (pId === 'medical' || desc.includes('চিকিৎসা') || desc.includes('ঔষধ') || desc.includes('ওষুধ') || desc.includes('রোগী') || desc.includes('medicine')) {
                              sId = 'medical';
                              sTitle = 'চিকিৎসা সহায়তা খাতের দান';
                              sEmoji = '🩺';
                            } else if (pId === 'education' || desc.includes('শিক্ষা') || desc.includes('শিক্ষার্থী') || desc.includes('ছাত্র') || desc.includes('education')) {
                              sId = 'education';
                              sTitle = 'দরিদ্র শিক্ষার্থীদের শিক্ষা';
                              sEmoji = '🎓';
                            } else if (pId === 'micro' || desc.includes('ক্ষুদ্র') || desc.includes('স্বনির্ভর') || desc.includes('ভ্যান') || desc.includes('সেলাই') || desc.includes('micro')) {
                              sId = 'micro';
                              sTitle = 'ক্ষুদ্র স্বনির্ভর ব্যবসা';
                              sEmoji = '🚜';
                            } else if (pId === 'emergency' || desc.includes('জরুরি') || desc.includes('ত্রাণ') || desc.includes('বন্যা') || desc.includes('দুর্যোগ') || desc.includes('emergency')) {
                              sId = 'emergency';
                              sTitle = 'জরুরি মানবিক ও ত্রাণ সহায়তা';
                              sEmoji = '🚨';
                            }
                            return {
                              userId: t.userId,
                              name: t.senderName || t.userName || 'দাতা সদস্য',
                              phone: t.senderPhone || t.userPhone || t.mobileNumber || t.accountNumber || '—',
                              memberId: t.memberId || t.trxId,
                              amount: t.amount || 0,
                              category: 'donor',
                              sectorId: sId,
                              sectorTitle: sTitle,
                              sectorEmoji: sEmoji,
                              type: `🎁 ${sEmoji} ${sTitle}`,
                              status: 'তহবিলে জমা (+)',
                              date: t.date || (t.createdAt ? new Date(t.createdAt).toLocaleDateString('bn-BD') : 'আজ')
                            };
                          }),
                          ...qardAllTransactions.filter(t => t.type === 'qard_loan_repayment' && t.status === 'success').map(t => ({
                            userId: t.userId,
                            name: t.senderName || t.userName || 'ঋণ গ্রহীতা',
                            phone: t.senderPhone || t.userPhone || t.mobileNumber || '—',
                            memberId: t.memberId || t.trxId,
                            amount: t.amount || 0,
                            category: 'repayment',
                            type: '🔄 ঋণ ফেরত/পরিশোধ (+)',
                            status: 'ফান্ডে ফেরত (+)',
                            date: t.date || (t.createdAt ? new Date(t.createdAt).toLocaleDateString('bn-BD') : 'আজ')
                          }))
                        ]
                      });
                    }}
                    className="bg-amber-50/90 border border-amber-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-amber-100/90 transition active:scale-98 min-h-[56px] sm:min-h-[68px]"
                    title="টিপ দিয়ে মূল তহবিল ও হাওলাত ঋণ দেখুন"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold text-amber-900">
                      <span className="truncate">{qardBoxViewHawlat ? '5. কর্জে (হাওলাত)' : '5. কর্জে হাসানা'}</span>
                      <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-700 shrink-0" />
                    </div>
                    <div className={`text-xs sm:text-lg font-black tracking-tighter sm:tracking-tight font-mono ${qardBoxViewHawlat ? 'text-rose-900' : 'text-emerald-900'}`}>
                      ৳ {(qardBoxViewHawlat ? valQardFund : valQardMainFund).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Row 2, Box 6: Cash & Bank Balance */}
                  <div 
                    onClick={() => setDrillDownModalData({
                      title: '6. ক্যাশ, ব্যাংক ও অ্যাপস একাউন্ট ব্যালেন্স (কার একাউন্টে কত আছে)',
                      amount: valCashAndBankBalance,
                      type: 'cash_bank_fund',
                      history: users.map((u, idx) => ({
                        userId: u.id,
                        userObj: u,
                        name: u.name,
                        phone: u.phone,
                        memberId: u.memberId,
                        balance: u.balance || 0,
                        amount: u.balance || 0,
                        type: 'মেইন অ্যাপস ব্যালেন্স',
                        status: (u.balance || 0) > 0 ? 'জমা ব্যালেন্স' : 'শূন্য ব্যালেন্স'
                      })).sort((a, b) => b.amount - a.amount)
                    })}
                    className="bg-indigo-50/90 border border-indigo-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-indigo-100/90 transition active:scale-98 min-h-[56px] sm:min-h-[68px]"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold text-indigo-900">
                      <span className="truncate">6. ক্যাশ ও ব্যাংক</span>
                      <CreditCard className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-700 shrink-0" />
                    </div>
                    <div className="text-xs sm:text-lg font-black text-indigo-950 tracking-tighter sm:tracking-tight font-mono">
                      ৳ {valCashAndBankBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Row 2, Box 7: Income */}
                  <div 
                    onClick={() => setDrillDownModalData({
                      title: '7. কোম্পানির আয় ও অর্জিত লাভ (Income & Profit Ledger)',
                      amount: valIncome,
                      type: 'income_fund',
                      history: transactions.filter(t => (t.status === 'success' || t.status === 'approved' || (t as any).isApproved) && (
                        Number((t as any).adminProfit || (t as any).companyProfit || (t as any).profitAmount || 0) > 0 ||
                        Number(t.charge || t.fee || 0) > 0 ||
                        t.type === 'deposit' || (t.type as any) === 'add_money' || (t.type as any) === 'fee' || (t.type as any) === 'fee_payment'
                      )).map((t, idx) => {
                        const profit = Number((t as any).adminProfit || (t as any).companyProfit || (t as any).profitAmount || 0);
                        const fee = Number(t.charge || t.fee || (t.type === 'fee' || (t.type as any) === 'fee_payment' ? t.amount : 0) || 0);
                        const effectiveAmt = profit > 0 ? profit : fee;
                        return {
                          name: (t as any).profitNote || t.userName || t.description || 'সার্ভিস ফি / ট্রানজেকশন লাভ',
                          phone: t.userPhone || (t as any).phone || 'সিস্টেম আয়',
                          memberId: t.trxId || (t as any).transactionId || t.type?.toUpperCase() || 'PROFIT',
                          date: t.date || (t.createdAt ? new Date(t.createdAt).toLocaleDateString('bn-BD') : 'আজ'),
                          amount: effectiveAmt,
                          status: profit > 0 ? 'অর্জিত লাভ (Admin Profit)' : 'সার্ভিস ফি / আয়',
                          type: t.typeLabel || t.type || 'Income'
                        };
                      }).filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount)
                    })}
                    className="bg-emerald-100/80 border border-emerald-300 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-emerald-200/80 transition active:scale-98 min-h-[56px] sm:min-h-[68px]"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold text-emerald-950">
                      <span className="truncate">7. আয় (Income)</span>
                      <span className="text-[11px] sm:text-sm shrink-0">💰</span>
                    </div>
                    <div className="text-xs sm:text-lg font-black text-emerald-950 tracking-tighter sm:tracking-tight font-mono">
                      ৳ {valIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Row 2, Box 8: Expense */}
                  <div 
                    onClick={() => setDrillDownModalData({
                      title: '8. কোম্পানির ব্যয় (Expense Ledger)',
                      amount: valExpense,
                      type: 'expense_fund',
                      history: transactions.filter(t => t.type === 'expense' as any || t.type === 'withdraw' || t.type === 'payout' as any).map((t, idx) => ({
                        name: t.description || t.userName || 'অফিস স্যালারি ও পরিচালনা ব্যয়',
                        phone: t.userPhone || 'সিস্টেম ব্যয়',
                        memberId: 'EXPENSE',
                        date: t.date || (t.createdAt ? new Date(t.createdAt).toLocaleDateString('bn-BD') : 'আজ'),
                        amount: t.amount || 0,
                        status: 'পরিশোধিত ব্যয়',
                        type: 'Expense'
                      })).sort((a, b) => b.amount - a.amount)
                    })}
                    className="bg-rose-50/90 border border-rose-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-rose-100/90 transition active:scale-98 min-h-[56px] sm:min-h-[68px]"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold text-rose-900">
                      <span className="truncate">8. ব্যয় (Expense)</span>
                      <span className="text-[11px] sm:text-sm shrink-0">📉</span>
                    </div>
                    <div className="text-xs sm:text-lg font-black text-rose-950 tracking-tighter sm:tracking-tight font-mono">
                      ৳ {valExpense.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Row 3, Box 9: Fine & Penalty Fund */}
                  <div 
                    onClick={() => setDrillDownModalData({
                      title: '9. জরিমানা ও পেনাল্টি ফান্ড খতিয়ান (কার থেকে কেন কত টাকা কাটা হলো)',
                      amount: valFineFund,
                      type: 'fine_fund',
                      history: fineHistoryItems
                    })}
                    className="bg-rose-50/90 border border-rose-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-rose-100/90 transition active:scale-98 min-h-[56px] sm:min-h-[68px]"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold text-rose-900">
                      <span className="truncate">9. জরিমানা ফান্ড</span>
                      <ShieldAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-700 shrink-0" />
                    </div>
                    <div className="text-xs sm:text-lg font-black text-rose-950 tracking-tighter sm:tracking-tight font-mono">
                      ৳ {valFineFund.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Row 3, Box 10: Net Asset / Surplus */}
                  <div 
                    onClick={() => setDrillDownModalData({
                      title: '10. নেট উদ্বৃত্ত / মূলধন (Net Asset Calculation)',
                      amount: valNetAsset,
                      type: 'net_asset_fund',
                      history: [
                        { name: '1. মাস্টার ফান্ড মোট গচ্ছিত অর্থ', phone: 'কোম্পানি ফান্ড', memberId: 'ASSET-1', amount: valMasterFund, type: 'Credit Asset', status: 'Asset' },
                        { name: '2. বিয়োগ: সকল মেম্বার ওয়ালেট ব্যালেন্স পাওনা', phone: 'সদস্যদের মেইন ব্যালেন্স', memberId: 'LIAB-1', amount: -totalMemberBalance, type: 'Debit Liability', status: 'Liability' },
                        { name: '3. বিয়োগ: মেম্বার সঞ্চয় ও ডিপিএস আমানত', phone: 'সমিতি আমানত', memberId: 'LIAB-2', amount: -valSamityFund, type: 'Debit Liability', status: 'Liability' },
                        { name: '4. বিয়োগ: কোম্পানির মোট ব্যয় ও বোনাস', phone: 'পরিচালনা খরচ', memberId: 'LIAB-3', amount: -totalExpenses, type: 'Debit Liability', status: 'Liability' },
                      ]
                    })}
                    className="bg-slate-900 text-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-2xs flex flex-col justify-between cursor-pointer hover:bg-slate-800 transition active:scale-98 min-h-[56px] sm:min-h-[68px]"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold text-emerald-400">
                      <span className="truncate">10. নেট মূলধন</span>
                      <PieChart className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
                    </div>
                    <div className="text-xs sm:text-lg font-black text-emerald-400 tracking-tighter sm:tracking-tight font-mono">
                      ৳ {valNetAsset.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Row 3, Box 11: Liabilities & Receivables */}
                  <div 
                    onClick={() => setDrillDownModalData({
                      title: '11. দায় ও পাওনা (সদস্য ও কোম্পানি দেনা-পাওনা)',
                      amount: valLiabilities,
                      type: 'liabilities_fund',
                      history: [
                        { name: '1. সদস্য মেইন ওয়ালেট ব্যালেন্স পাওনা', phone: `মোট ${users.length} জন সদস্য`, memberId: 'WALLET-LIAB', amount: totalMemberBalance, type: 'সদস্য পাওনা', status: 'নির্ধারিত দায়' },
                        { name: '2. সদস্য সঞ্চয় ও DPS আমানত পাওনা', phone: 'সমবায় আমানত', memberId: 'SAVINGS-LIAB', amount: valSamityFund, type: 'সদস্য পাওনা', status: 'নির্ধারিত দায়' },
                        { name: '3. ক্যাশব্যাক ও পরিচালনা খরচ দায়', phone: 'বোনাস ফান্ড', memberId: 'EXP-LIAB', amount: totalExpenses, type: 'কোম্পানি দায়', status: 'নির্ধারিত দায়' }
                      ]
                    })}
                    className="bg-amber-100/90 border border-amber-300 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-amber-200/90 transition active:scale-98 min-h-[56px] sm:min-h-[68px]"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold text-amber-950">
                      <span className="truncate">11. দায় ও পাওনা</span>
                      <Scale className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-800 shrink-0" />
                    </div>
                    <div className="text-xs sm:text-lg font-black text-amber-950 tracking-tighter sm:tracking-tight font-mono">
                      ৳ {valLiabilities.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Row 3, Box 12: Reports, Audit & Business Modules */}
                  <div 
                    onClick={() => setShowSection12ReportModal(true)}
                    className="bg-gradient-to-br from-teal-700 via-emerald-800 to-slate-900 text-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-md flex flex-col justify-between cursor-pointer hover:brightness-110 transition active:scale-98 border sm:border-2 border-amber-400 min-h-[56px] sm:min-h-[68px]"
                  >
                    <div className="flex justify-between items-center text-[9px] sm:text-[11px] font-extrabold text-amber-300">
                      <span className="truncate">12. রিপোর্ট/লেজার</span>
                      <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0 animate-bounce" />
                    </div>
                    <div className="text-[11px] sm:text-lg font-black text-white tracking-tighter sm:tracking-tight truncate font-mono">
                      12টি লেজার
                    </div>
                  </div>
                </div>
              </div>



              {/* 4. Grid Header (Green Circle Bottom) */}
              <div className="flex justify-between items-center pr-1 mt-1 text-left">
                <p className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">সকল এডমিন মডিউল ও লাইভ প্যানেল</p>
                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-150 px-2.5 py-0.5 rounded-full font-bold">22টি সক্রিয় এডমিন কন্ট্রোল কার্ড</span>
              </div>

              {/* Strictly 4 items per row matching user image green box */}
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {/* 1. Samity/Investor Admin */}
                {(hasPermission('samity') || hasPermission('general')) && (
                  <div 
                    onClick={() => { setAdminTab('samity'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-emerald-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    {users.filter(u => u.samityStatus === 'pending' || u.approved === false).length > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-xs z-10">
                        {users.filter(u => u.samityStatus === 'pending' || u.approved === false).length} পেন্ডিং
                      </span>
                    )}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-800 shadow-sm group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.samity ? (
                        <img src={appConfig.sectionIcons.samity} alt="Samity" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <img src="/samity_logo.svg" alt="Samity" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        সমবায় পোর্টাল
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardSamityTitle || 'BNB কোম্পানি ইনভেস্টর'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        মুনাফা ও সঞ্চয় কন্ট্রোল
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. Safe Deals (Escrow) */}
                {hasPermission('safedeals_admin') && (
                  <div 
                    onClick={() => { setAdminTab('safedeals_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-emerald-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-emerald-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.safedeals ? (
                        <img src={appConfig.sectionIcons.safedeals} alt="Safe Deals" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        গ্রুপ বাই ডিল
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardSafeDealsTitle || 'BNB নিরাপদ লেনদেন'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        পাইকারি লেনদেন এডমিন
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Qard Hasana Welfare */}
                {hasPermission('qard_admin') && (
                  <div 
                    onClick={() => { setAdminTab('qard_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-rose-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-rose-500 to-red-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-rose-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.qard ? (
                        <img src={appConfig.sectionIcons.qard} alt="Qard" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <HeartHandshake className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        সুদমুক্ত ঋণ
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardQardTitle || 'BNB কর্জে হাসানা'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        কল্যাণ তহবিল লেজার
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. Bank Admin / Remittance */}
                {hasPermission('bank_admin') && (
                  <div 
                    onClick={() => { setAdminTab('bank_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-amber-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.bank ? (
                        <img src={appConfig.sectionIcons.bank} alt="Bank" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-spin" style={{ animationDuration: '6s' }} />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        রেমিট্যান্স & ব্যাংকিং
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardBankTitle || 'BNB লেনদেন'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        লেনদেন ও ডিপোজিট
                      </p>
                    </div>
                  </div>
                )}

                {/* 5. Telecom Admin */}
                {hasPermission('telecom') && (
                  <div 
                    onClick={() => { setAdminTab('telecom'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-cyan-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-cyan-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.telecom ? (
                        <img src={appConfig.sectionIcons.telecom} alt="Telecom" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        রিচার্জ প্যাক
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardTelecomTitle || 'BNB টেলিকম'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        ফ্লেক্সিলোড ও অফার
                      </p>
                    </div>
                  </div>
                )}

                {/* 6. Ration Card Admin */}
                {hasPermission('ration_admin') && (
                  <div 
                    onClick={() => { setAdminTab('ration_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-yellow-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-yellow-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.ration ? (
                        <img src={appConfig.sectionIcons.ration} alt="Ration" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-amber-800 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        কার্ড হোল্ডার
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardRationTitle || 'BNB রেশন কার্ড'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        রেশন কার্ড বন্টন সেটিংস
                      </p>
                    </div>
                  </div>
                )}

                {/* 7. Auto Salary Pay */}
                {(hasPermission('salary_admin') || hasPermission('general')) && (
                  <div 
                    onClick={() => { setAdminTab('salary_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-teal-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-teal-600 to-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-md shadow-teal-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.salary ? (
                        <img src={appConfig.sectionIcons.salary} alt="Salary" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        স্যালারি পে
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardSalaryTitle || 'BNB সেলারি পে'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        প্রতিষ্ঠানের কর্মী বেতন
                      </p>
                    </div>
                  </div>
                )}

                {/* 8. Safi Admin */}
                {hasPermission('safi_admin') && (
                  <div 
                    onClick={() => { setAdminTab('safi_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-amber-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.safi ? (
                        <img src={appConfig.sectionIcons.safi} alt="Safi" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        ইন-হাউস ব্র্যান্ড
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardSafiTitle || 'al safi'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        খাঁটি পণ্য ও স্টক কন্ট্রোল
                      </p>
                    </div>
                  </div>
                )}

                {/* 9. AMB Auto Recharge Admin */}
                {(hasPermission('auto_recharge_admin') || hasPermission('telecom') || hasPermission('general')) && (
                  <div 
                    onClick={() => { setAdminTab('auto_recharge_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-sky-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-sky-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.auto_recharge ? (
                        <img src={appConfig.sectionIcons.auto_recharge} alt="Auto Recharge" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-sky-700 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        অটো রিচার্জ গেটওয়ে
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardAutoRechargeTitle || 'BNB অটো রিচার্জ'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        স্বয়ংক্রিয় রিচার্জ সেটিংস
                      </p>
                    </div>
                  </div>
                )}

                {/* 10. AMB Bill Pay Admin */}
                {(hasPermission('bill_pay_admin') || hasPermission('bank_admin') || hasPermission('config') || hasPermission('general')) && (
                  <div 
                    onClick={() => { setAdminTab('bill_pay_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-purple-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-purple-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.bill_pay ? (
                        <img src={appConfig.sectionIcons.bill_pay} alt="Bill Pay" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <Banknote className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        ইউটিলিটি বিল
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardBillPayTitle || 'BNB বিল পে'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        বিদ্যুৎ ও গ্যাস বিল
                      </p>
                    </div>
                  </div>
                )}

                {/* 11. Agent Admin */}
                {hasPermission('agent_admin') && (
                  <div 
                    onClick={() => { setAdminTab('agent_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    {adminAgentRequests.filter(r => r.status === 'pending').length > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-xs z-10">
                        {adminAgentRequests.filter(r => r.status === 'pending').length} পেন্ডিং
                      </span>
                    )}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-amber-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.agent ? (
                        <img src={appConfig.sectionIcons.agent} alt="Agent" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <Store className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-amber-800 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        এজেন্ট পোর্টাল
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardAgentTitle || 'BNB এজেন্ট'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        ড্রপ পয়েন্ট ও সেটিংস
                      </p>
                    </div>
                  </div>
                )}

                {/* 12. Company Profile / Notices (BNB আমাদের লক্ষ্য) */}
                {hasPermission('notices') && (
                  <div 
                    onClick={() => { setAdminTab('notices'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.about ? (
                        <img src={appConfig.sectionIcons.about} alt="About" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        পরিচিতি ও গাইড
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center truncate">
                        {appConfig?.globalTexts?.cardAboutTitle || 'BNB আমাদের লক্ষ্য'}
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        কোম্পানি প্রোফাইল এডিট
                      </p>
                    </div>
                  </div>
                )}

                {/* 13. Super Shop Admin */}
                {hasPermission('shop_admin') && (
                  <div 
                    onClick={() => { setAdminTab('shop_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-pink-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-pink-100 group-hover:scale-105 transition-transform shrink-0 relative overflow-hidden">
                      {appConfig?.sectionIcons?.shop ? (
                        <img src={appConfig.sectionIcons.shop} alt="Shop" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                      ) : (
                        <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      )}
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-pink-700 bg-pink-50 border border-pink-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        পণ্য অর্ডার
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center">
                        BNB সুপার শপ
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        আমানত দিয়ে ক্রয়
                      </p>
                    </div>
                  </div>
                )}



                {/* 13. Member Directory */}
                {hasPermission('general') && (
                  <div 
                    onClick={() => { setAdminTab('general'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-emerald-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-[#00a884] to-teal-750 rounded-2xl flex items-center justify-center text-white shadow-md shadow-emerald-100 group-hover:scale-105 transition-transform shrink-0">
                      <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-[#00a884] bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        সদস্য খাতা
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center">
                        সদস্য ডিরেক্টরি
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        প্রোফাইল ও পিন এডিট
                      </p>
                    </div>
                  </div>
                )}

                {/* 14. Approvals */}
                {hasPermission('approvals') && (
                  <div 
                    onClick={() => { setAdminTab('approvals'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-teal-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    {(() => {
                      const nonFinancialPendingCount = 
                        users.filter(u => u.approved === false || u.samityStatus === 'pending' || u.deviceChangeRequested === true).length + 
                        adminAgentRequests.filter(r => r.status === 'pending').length + 
                        phoneChangeRequests.filter(r => r.status === 'pending').length;
                      if (nonFinancialPendingCount <= 0) return null;
                      return (
                        <span className="absolute top-1.5 right-1.5 bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-bounce shadow-xs z-10">
                          {nonFinancialPendingCount} পেন্ডিং
                        </span>
                      );
                    })()}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-teal-500 to-emerald-700 rounded-2xl flex items-center justify-center text-white shadow-md shadow-teal-100 group-hover:scale-105 transition-transform shrink-0">
                      <Send className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        আবেদন অনুমোদন
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center">
                        নতুন সদস্য অনুমোদন
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        সদস্য ও সিকিউরিটি অনুমোদন
                      </p>
                    </div>
                  </div>
                )}

                {/* 15. Dynamic Config */}
                {hasPermission('config') && (
                  <div 
                    onClick={() => { setAdminTab('config'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-slate-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-slate-600 to-slate-800 rounded-2xl flex items-center justify-center text-white shadow-md shadow-slate-100 group-hover:scale-105 transition-transform shrink-0">
                      <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-slate-700 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        সিস্টেম সেটিংস
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center">
                        ডায়নামিক কনফিগ
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        নম্বর ও গেটওয়ে এডিট
                      </p>
                    </div>
                  </div>
                )}

                {/* 15.5 System Reset & Initialization (Master Admin Only) */}
                {isMasterAdmin && (
                  <div 
                    onClick={() => { setAdminTab('system_reset'); setViewingGrid(false); }}
                    className="bg-rose-50/80 border border-rose-200 hover:border-rose-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-rose-600 to-red-800 rounded-2xl flex items-center justify-center text-white shadow-md shadow-rose-200 group-hover:scale-105 transition-transform shrink-0">
                      <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-rose-800 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        নতুন সূচনা (Publish Start)
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-rose-900 leading-tight block tracking-tight text-center">
                        সিস্টেম ও হিসাব রিসেট
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-rose-500 font-extrabold leading-none truncate">
                        ব্যালেন্স ও হিস্টোরি জিরো
                      </p>
                    </div>
                  </div>
                )}

                {/* 16. Banner Settings */}
                {hasPermission('banners_admin') && (
                  <div 
                    onClick={() => { setAdminTab('banners_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-amber-100 group-hover:scale-105 transition-transform shrink-0">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-amber-800 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        স্লাইডার ব্যানার
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center">
                        ব্যানার সেটিংস
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        হোম স্লাইডার পরিবর্তন
                      </p>
                    </div>
                  </div>
                )}

                {/* 17. Receipt Designer */}
                {hasPermission('receipt_admin') && (
                  <div 
                    onClick={() => { setAdminTab('receipt_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-purple-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-md shadow-purple-100 group-hover:scale-105 transition-transform shrink-0">
                      <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        রসিদ ও ভাউচার
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center">
                        রসিদ থিম ডিজাইন
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        কালার ও টেক্সট কাস্টমাইজ
                      </p>
                    </div>
                  </div>
                )}

                {/* 18. All Transaction Audit */}
                {hasPermission('all_history_admin') && (
                  <div 
                    onClick={() => { setAdminTab('all_history_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-rose-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-rose-600 to-indigo-950 rounded-2xl flex items-center justify-center text-white shadow-md shadow-rose-100 group-hover:scale-105 transition-transform shrink-0">
                      <History className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        লেনদেন ও অডিট খাতা
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center">
                        সর্বমোট লেনদেন ইতিহাস
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        পুরো সিস্টেম অডিট
                      </p>
                    </div>
                  </div>
                )}

                {/* 19. Push Notification */}
                {(hasPermission('push_admin') || hasPermission('config')) && (
                  <div 
                    onClick={() => { setAdminTab('push_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-red-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-red-100 group-hover:scale-105 transition-transform shrink-0">
                      <BellRing className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        পুশ নোটিফিকেশন
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center">
                        OneSignal ব্রডকাস্ট
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        টার্গেটেড পুশ মেসেজ
                      </p>
                    </div>
                  </div>
                )}



                {/* 22. Software Integration Gateway */}
                {(hasPermission('integration_admin') || hasPermission('config')) && (
                  <div 
                    onClick={() => { setAdminTab('integration_admin'); setViewingGrid(false); }}
                    className="bg-white border border-slate-200 hover:border-cyan-400 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 cursor-pointer text-center items-center group active:scale-95 min-h-[130px] sm:min-h-[145px] shadow-2xs relative overflow-hidden"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-indigo-900 rounded-2xl flex items-center justify-center text-white shadow-md shadow-cyan-100 group-hover:scale-105 transition-transform shrink-0">
                      <Cpu className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-200 animate-pulse" />
                    </div>
                    <div className="space-y-1 w-full text-center mt-2 font-sans">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-cyan-800 bg-cyan-50 border border-cyan-100 px-1.5 py-0.5 rounded-md inline-block leading-none truncate max-w-full">
                        সফ্টওয়্যার গেটওয়ে
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight block tracking-tight text-center">
                        সফটওয়্যার ইন্টিগ্রেশন
                      </h4>
                      <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-extrabold leading-none truncate">
                        জেসন ফাইল অটো-ফিট
                      </p>
                    </div>
                  </div>
                )}
              </div>

            {/* 4. Logo set uploader box */}
            <div className="bg-gradient-to-r from-[#e6f7f3] to-teal-50 border-2 border-[#00a884]/20 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-5 text-left shadow-2xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#00a884]/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shrink-0 border border-slate-150 shadow-sm relative overflow-hidden">
                  {cfgLogoUrl ? (
                    <img src={cfgLogoUrl} alt="App Logo" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                  ) : (
                    <AMBLogo size={42} variant="emerald" />
                  )}
                </div>
                <div>
                  <h3 className="text-xs xs:text-sm font-black text-slate-800 flex items-center gap-1.5">
                    🎨 ড্রয়ার মেনু ও অ্যাপের মেইন লোগো সেট করুন (Branding Box)
                  </h3>
                  <p className="text-[11px] text-slate-550 mt-1 leading-relaxed font-sans">
                    সরাসরি মোবাইল গ্যালারি থেকে নতুন কাস্টম লোগো সিলেক্ট করে আপলোড করুন। এটি ড্রয়ার মেনু ও লগইন স্ক্রিনে সেট হয়ে যাবে।
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 self-stretch sm:self-center shrink-0">
                <div className="relative overflow-hidden rounded-xl self-stretch sm:self-auto flex-1 sm:flex-none">
                  <button
                    type="button"
                    className="w-full bg-[#00a884] hover:bg-[#009675] active:scale-95 text-white text-xs font-black px-4 py-3 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap justify-center shadow-xs pointer-events-none"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    গ্যালারি থেকে লোগো সেট করুন
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    title="গ্যালারি থেকে লোগো সেট করুন"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result as string);
                          reader.onerror = (err) => reject(err);
                          reader.readAsDataURL(file);
                        });
                        const img = new Image();
                        img.onload = () => {
                          const SIZE = 250;
                          const canvas = document.createElement('canvas');
                          canvas.width = SIZE;
                          canvas.height = SIZE;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                            const minSide = Math.min(img.width, img.height);
                            const sx = (img.width - minSide) / 2;
                            const sy = (img.height - minSide) / 2;
                            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, SIZE, SIZE);
                            let compressedBase64 = canvas.toDataURL('image/webp', 0.90);
                            if (!compressedBase64 || !compressedBase64.startsWith('data:image/webp')) {
                              compressedBase64 = canvas.toDataURL('image/png');
                            }
                            handleDirectUpdateLogo(compressedBase64);
                          } else {
                            handleDirectUpdateLogo(dataUrl);
                          }
                        };
                        img.onerror = () => handleDirectUpdateLogo(dataUrl);
                        img.src = dataUrl;
                      } catch (err) {
                        console.error("Error reading logo file:", err);
                        alert("লোগো ফাইল পড়তে সমস্যা হয়েছে");
                      } finally {
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
                {cfgLogoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("আপনি কি লোগোটি রিমুভ করে ডিফল্ট লোগোতে ফিরে যেতে চান?")) {
                        handleDirectUpdateLogo('');
                      }
                    }}
                    className="p-3 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-xl transition cursor-pointer"
                    title="রিমুভ করে ডিফল্ট লোগোতে ফিরে যান"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* ✨ ইউজার ড্যাশবোর্ড লোগো ও নাম কাস্টমাইজেশন ম্যানেজার (User Dashboard Icon & Name Manager) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 xs:p-6 shadow-xs text-left font-sans text-slate-800">
              <div className="border-b border-slate-100 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-xs xs:text-sm font-black flex items-center gap-2 text-slate-800">
                    ✨ ইউজার ড্যাশবোর্ড লোগো ও নাম কাস্টমাইজেশন ম্যানেজার
                  </h2>
                  <p className="text-[11px] text-slate-550 mt-1 leading-relaxed">
                    ইউজার ড্যাশবোর্ডের ১২টি সেকশনের নাম পরিবর্তন এবং সরাসরি গ্যালারি থেকে কাস্টম লোগো আপলোড করুন। যেকোনো নাম বা লোগো পরিবর্তন করলে তাৎক্ষণিকভাবে ইউজার ড্যাশবোর্ডে রিয়েল-টাইম আপডেট হয়ে যাবে।
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { key: 'samity', titleKey: 'cardSamityTitle', labelBng: 'BNB কোম্পানি ইনভেস্টর', labelEng: 'AMB Company Investor' },
                  { key: 'safedeals', titleKey: 'cardSafeDealsTitle', labelBng: 'BNB নিরাপদ লেনদেন', labelEng: 'AMB Safe Deals' },
                  { key: 'qard', titleKey: 'cardQardTitle', labelBng: 'BNB কর্জে হাসানা', labelEng: 'AMB Qard Hasana' },
                  { key: 'bank', titleKey: 'cardBankTitle', labelBng: 'BNB লেনদেন', labelEng: 'AMB Transactions' },
                  { key: 'telecom', titleKey: 'cardTelecomTitle', labelBng: 'BNB টেলিকম', labelEng: 'AMB Telecom' },
                  { key: 'ration', titleKey: 'cardRationTitle', labelBng: 'BNB রেশন কার্ড', labelEng: 'AMB Ration Card' },
                  { key: 'salary', titleKey: 'cardSalaryTitle', labelBng: 'BNB সেলারি পে', labelEng: 'AMB Salary Pay' },
                  { key: 'safi', titleKey: 'cardSafiTitle', labelBng: 'al safi', labelEng: 'Al Safi Brand' },
                  { key: 'auto_recharge', titleKey: 'cardAutoRechargeTitle', labelBng: 'BNB অটো রিচার্জ', labelEng: 'AMB Auto Recharge' },
                  { key: 'bill_pay', titleKey: 'cardBillPayTitle', labelBng: 'BNB বিল পে', labelEng: 'AMB Bill Pay' },
                  { key: 'agent', titleKey: 'cardAgentTitle', labelBng: 'BNB এজেন্ট', labelEng: 'AMB Agent' },
                  { key: 'about', titleKey: 'cardAboutTitle', labelBng: 'BNB আমাদের লক্ষ্য', labelEng: 'AMB Target & Mission' },
                ].map((sect) => {
                  const customIcon = appConfig?.sectionIcons?.[sect.key];
                  const currentTitle = appConfig?.globalTexts?.[sect.titleKey] || sect.labelBng;
                  const currentEng = appConfig?.globalTexts?.[sect.titleKey + '_eng'] || sect.labelEng;
                  const isCustomTitle = !!(appConfig?.globalTexts?.[sect.titleKey] && appConfig.globalTexts[sect.titleKey] !== sect.labelBng);

                  return (
                    <div key={sect.key} className="bg-slate-50 hover:bg-slate-50/80 border border-slate-150 rounded-2xl p-3.5 flex flex-col justify-between gap-3 transition shadow-3xs relative group/card">
                      <div>
                        <div className="flex items-start gap-2.5">
                          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shrink-0 shadow-3xs relative overflow-hidden">
                            {uploadingSection === sect.key ? (
                              <div className="w-full h-full bg-emerald-50 flex items-center justify-center">
                                <RefreshCw className="w-4 h-4 text-[#00a884] animate-spin" />
                              </div>
                            ) : customIcon && (sect.key !== 'samity' || customIcon !== '/samity_logo.svg') ? (
                              <img src={customIcon} alt={currentEng} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : sect.key === 'samity' ? (
                              <img src={customIcon || "/samity_logo.svg"} alt="Samity" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="text-slate-400 font-bold text-xs uppercase flex items-center justify-center bg-slate-100 w-full h-full">
                                DF
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="text-xs font-black text-slate-800 leading-tight truncate" title={currentTitle}>
                                {currentTitle}
                              </h4>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSection({
                                    key: sect.key,
                                    titleKey: sect.titleKey,
                                    defaultTitle: sect.labelBng,
                                    currentTitle: currentTitle,
                                    labelEng: currentEng
                                  });
                                  setEditTitleInput(currentTitle);
                                  setEditEngInput(currentEng);
                                }}
                                className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer shrink-0"
                                title="নাম পরিবর্তন / এডিট করুন"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 block truncate">{currentEng}</span>
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {uploadingSection === sect.key ? (
                                <span className="text-[7.5px] sm:text-[8px] text-emerald-700 font-black bg-emerald-100 px-1.5 py-0.5 rounded animate-pulse">সংরক্ষণ হচ্ছে...</span>
                              ) : customIcon && (sect.key !== 'samity' || customIcon !== '/samity_logo.svg') ? (
                                <span className="text-[7.5px] sm:text-[8px] text-[#00a884] font-black bg-emerald-50 px-1.5 py-0.5 rounded">কাস্টম লোগো</span>
                              ) : (
                                <span className="text-[7.5px] sm:text-[8px] text-slate-400 font-black bg-slate-100 px-1.5 py-0.5 rounded">ডিফল্ট লোগো</span>
                              )}
                              {isCustomTitle && (
                                <span className="text-[7.5px] sm:text-[8px] text-blue-600 font-black bg-blue-50 px-1.5 py-0.5 rounded">কাস্টম নাম</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-150/70">
                        {/* Edit Name Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSection({
                              key: sect.key,
                              titleKey: sect.titleKey,
                              defaultTitle: sect.labelBng,
                              currentTitle: currentTitle,
                              labelEng: currentEng
                            });
                            setEditTitleInput(currentTitle);
                            setEditEngInput(currentEng);
                          }}
                          className="bg-white hover:bg-slate-100 active:scale-98 text-slate-700 border border-slate-250 text-[10px] font-bold px-2 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 shadow-3xs shrink-0"
                          title="নাম এডিট করুন"
                        >
                          <Edit3 className="w-3 h-3 text-emerald-600" />
                          <span>এডিট</span>
                        </button>

                        {/* Touch-Safe Upload Logo Button */}
                        <div className="flex-1 relative overflow-hidden rounded-lg">
                          <button
                            type="button"
                            disabled={uploadingSection === sect.key}
                            className="w-full bg-white hover:bg-slate-50 active:scale-98 text-slate-700 border border-slate-250 text-[10px] font-black px-2 py-1.5 rounded-lg transition flex items-center justify-center gap-1 shadow-3xs truncate pointer-events-none"
                          >
                            {uploadingSection === sect.key ? (
                              <>
                                <RefreshCw className="w-3 h-3 text-[#00a884] animate-spin shrink-0" />
                                <span className="truncate">আপলোড হচ্ছে...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-3 h-3 text-[#00a884] shrink-0" />
                                <span className="truncate">আপলোড</span>
                              </>
                            )}
                          </button>
                          <input
                            type="file"
                            accept="image/*"
                            title="গ্যালারি থেকে ছবি আপলোড করুন"
                            disabled={uploadingSection === sect.key}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={(e) => handleUploadIcon(sect.key, e)}
                          />
                        </div>

                        {/* Reset Logo Button */}
                        {customIcon && (sect.key !== 'samity' || customIcon !== '/samity_logo.svg') && (
                          <button
                            type="button"
                            onClick={() => handleResetIcon(sect.key, currentTitle)}
                            disabled={uploadingSection === sect.key}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg transition cursor-pointer shrink-0"
                            title="লোগো ডিফল্ট রিসেট করুন"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal: সেকশনের নাম পরিবর্তন ও এডিট (Edit Section Name Dialog) */}
            {editingSection && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-150 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-100 shadow-3xs">
                        <Edit3 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800 leading-tight">সেকশনের নাম পরিবর্তন ও এডিট</h3>
                        <p className="text-[10px] text-slate-400 font-bold">ইউজার ড্যাশবোর্ড ও এডমিন প্যানেলে রিয়েল-টাইম আপডেট হবে</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingSection(null)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4 text-left">
                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1.5">
                        মূল বাংলা নাম (Main Title)
                      </label>
                      <input
                        type="text"
                        value={editTitleInput}
                        onChange={(e) => setEditTitleInput(e.target.value)}
                        placeholder="যেমন: BNB কোম্পানি ইনভেস্টর"
                        className="w-full bg-slate-50 focus:bg-white border border-slate-250 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none transition shadow-inner"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1.5">
                        সাব-টাইটেল / ইংলিশ নাম (Subtitle / English)
                      </label>
                      <input
                        type="text"
                        value={editEngInput}
                        onChange={(e) => setEditEngInput(e.target.value)}
                        placeholder="যেমন: AMB Company Investor"
                        className="w-full bg-slate-50 focus:bg-white border border-slate-250 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none transition shadow-inner"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditTitleInput(editingSection.defaultTitle);
                          setEditEngInput(editingSection.labelEng);
                        }}
                        className="text-[11px] font-black text-rose-500 hover:text-rose-700 flex items-center gap-1.5 transition cursor-pointer bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-100"
                      >
                        <RotateCcw className="w-3 h-3" />
                        ডিফল্ট নামে রিসেট করুন ({editingSection.defaultTitle})
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-slate-150">
                      <button
                        type="button"
                        onClick={() => setEditingSection(null)}
                        disabled={isSavingTitle}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSectionTitle}
                        disabled={isSavingTitle}
                        className="flex-1 bg-[#00a884] hover:bg-[#008f6f] active:scale-98 text-white font-bold text-xs py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200"
                      >
                        {isSavingTitle ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        সংরক্ষণ করুন
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
    </>
  );
}
