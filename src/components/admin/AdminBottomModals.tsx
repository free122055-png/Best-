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

export function AdminBottomModals(props: any) {
  const appConfig = props.appConfig || {};

  const {
    userToDelete,
    text,
    y,
    name,
    left,
    type,
    deletePinInput,
    setDeletePinInput,
    target,
    setDeleteErrorMsg,
    key,
    confirmDeleteUserWithPin,
    deleteErrorMsg,
    isDeletingUser,
    setUserToDelete,
    historyActiveScreenshot,
    img,
    width,
    height,
    setHistoryActiveScreenshot,
    editingTxModal,
    id,
    setEditingTxModal,
    setLoading,
    transactions,
    amount,
    description,
    alert,
    loading,
    editProductModalOpen,
    selectedProduct,
    handleSaveEditProduct,
    epName,
    setEpName,
    epCategory,
    setEpCategory,
    epPrice,
    setEpPrice,
    epOldPrice,
    setEpOldPrice,
    epIcon,
    setEpIcon,
    epMinOrder,
    setEpMinOrder,
    epSupplier,
    setEpSupplier,
    epFlag,
    setEpFlag,
    epShipTime,
    setEpShipTime,
    epImageUrl,
    setEpImageUrl,
    epDescription,
    setEpDescription,
    setEditProductModalOpen,
    editRationModalOpen,
    selectedRationCard,
    handleSaveEditRationCard,
    rcEditName,
    setRcEditName,
    rcEditPhone,
    setRcEditPhone,
    rcEditVillage,
    setRcEditVillage,
    rcEditUpazila,
    setRcEditUpazila,
    rcEditDistrict,
    setRcEditDistrict,
    rcEditCardNo,
    setRcEditCardNo,
    rcEditCardType,
    setRcEditCardType,
    rcEditNomineeName,
    setRcEditNomineeName,
    rcEditStatus,
    setRcEditStatus,
    file,
    reader,
    setRcEditPhoto,
    rcEditPhoto,
    rcEditVipCardBg,
    setRcEditVipCardBg,
    rcEditVipBorderColor,
    setRcEditVipBorderColor,
    rcEditVipPrimaryColor,
    setRcEditVipPrimaryColor,
    rcEditVipTextColor,
    setRcEditVipTextColor,
    rcEditIssueDate,
    setRcEditIssueDate,
    rcEditExpiryDate,
    setRcEditExpiryDate,
    rcEditDuration,
    setRcEditDuration,
    rcEditSignature,
    setRcEditSignature,
    setEditRationModalOpen,
    editingRationItem,
    isAddingRationItem,
    handleSaveRationItem,
    riName,
    setRiName,
    riQty,
    setRiQty,
    setRiEmoji,
    riEmoji,
    data,
    riPrice,
    setRiPrice,
    riMarketPrice,
    setRiMarketPrice,
    riColor,
    setRiColor,
    setEditingRationItem,
    setIsAddingRationItem,
    isQuickPenaltyModalOpen,
    now,
    curYear,
    curMonthDef,
    BENGALI_MONTH_DEFS,
    curMonthKey,
    isCurExempt,
    isMonthExemptedInConfig,
    getMonthExemptConfig,
    policyFormState,
    setIsQuickPenaltyModalOpen,
    day,
    handleToggleMonthPenaltyExemption,
    requestAlert,
    showNetOperatingModal,
    setShowNetOperatingModal,
    netOperatingCash,
    companyReserveFund,
    totalMemberSavings,
    totalMemberMainBalance,
    // Modals & Handlers
    showHeaderPendingModal,
    setShowHeaderPendingModal,
    headerPendingTab,
    setHeaderPendingTab,
    headerPendingAddMoneyMethod,
    setHeaderPendingAddMoneyMethod,
    headerPendingStatusFilter,
    setHeaderPendingStatusFilter,
    headerPendingSearchQuery,
    setHeaderPendingSearchQuery,
    headerPendingDateFilter,
    setHeaderPendingDateFilter,
    headerPendingCustomDate,
    setHeaderPendingCustomDate,
    handleApproveTransaction,
    handleRejectTransaction,
    handleHoldTransaction,
    handleResumePendingTransaction,
    onRefreshTransactions,
    showMemberListModal,
    setShowMemberListModal,
    showAdminNotifyModal,
    setShowAdminNotifyModal,
    showAutoNoticeModal,
    setShowAutoNoticeModal,
    selectedAutoNoticeCategory,
    setSelectedAutoNoticeCategory,
    drillDownModalData,
    setDrillDownModalData,
    showSection12ReportModal,
    setShowSection12ReportModal,
    showFundAdjustModal,
    setShowFundAdjustModal,
    adjustFundKey,
    setAdjustFundKey,
    adjustCustomValue,
    setAdjustCustomValue,
    fundModulesList,
    fineHistoryItems,
    users = [],
    broadcastLogs = [],
    openUserEditModal,
    onChangeConfig,
    isMasterAdmin,
    adminSeenNoticeIds = [],
    markNoticeAsSeen,
    markAllNoticesAsSeen,
    valMasterFund = 0,
    valSamityFund = 0,
    valMobileRechargeFund = 0,
    valMobileCashbackFund = 0,
    valQardMainFund = 0,
    valQardFund = 0,
    valCashAndBankBalance = 0,
    valIncome = 0,
    valExpense = 0,
    valFineFund = 0,
    valNetAsset = 0,
    valLiabilities = 0,
    reportPreset = 'monthly',
    setReportPreset,
    reportCustomStart,
    setReportCustomStart,
    reportCustomEnd,
    setReportCustomEnd,
    pendingRequests = []
  } = props;

  // Local states for member list modal & reports
  const [memberListSearch, setMemberListSearch] = useState('');
  const [memberListFilter, setMemberListFilter] = useState<'all' | 'samity' | 'loan' | 'savings' | 'locked'>('all');
  const [autoNoticeSearch, setAutoNoticeSearch] = useState('');
  const [drillDownSearch, setDrillDownSearch] = useState('');
  const [selectedReportLedgerTab, setSelectedReportLedgerTab] = useState<string>('all');
  const [reportSearch, setReportSearch] = useState('');
  const [copiedTextNotice, setCopiedTextNotice] = useState<string | null>(null);

  // Master Fund Entry & Edit States
  const [showMasterEntryModal, setShowMasterEntryModal] = useState(false);
  const [editingMasterId, setEditingMasterId] = useState<string | null>(null);
  const [masterFormAccountName, setMasterFormAccountName] = useState('');
  const [masterFormCategory, setMasterFormCategory] = useState<'land' | 'gold' | 'bank' | 'business' | 'cash' | 'receivable' | 'mfs' | 'other'>('bank');
  const [masterFormHolderName, setMasterFormHolderName] = useState('');
  const [masterFormHolderPhone, setMasterFormHolderPhone] = useState('');
  const [masterFormAccountNumber, setMasterFormAccountNumber] = useState('');
  const [masterFormLocation, setMasterFormLocation] = useState('');
  const [masterFormAmount, setMasterFormAmount] = useState('');
  const [masterFormNote, setMasterFormNote] = useState('');
  const [masterCategoryFilter, setMasterCategoryFilter] = useState<string>('all');
  const [isSavingMasterAccount, setIsSavingMasterAccount] = useState(false);
  const [masterSaveSuccessMsg, setMasterSaveSuccessMsg] = useState<string | null>(null);

  const MASTER_CATEGORY_MAP: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
    land: { label: 'জমি ও স্থাবর সম্পত্তি', icon: '🏞️', bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200' },
    gold: { label: 'স্বর্ণ ও সোনা ক্রয়', icon: '🪙', bg: 'bg-yellow-50', text: 'text-yellow-900', border: 'border-yellow-200' },
    bank: { label: 'ব্যাংক ডিপোজিট ও হিসাব', icon: '🏦', bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200' },
    business: { label: 'ব্যবসা ও পণ্য ইনভেস্টমেন্ট', icon: '💼', bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-200' },
    cash: { label: 'নগদ ক্যাশ ইন হ্যান্ড', icon: '💵', bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-200' },
    receivable: { label: 'অন্যের নিকট গচ্ছিত / পাওনা', icon: '🤝', bg: 'bg-teal-50', text: 'text-teal-900', border: 'border-teal-200' },
    mfs: { label: 'বিকাশ / নগদ মার্চেন্ট', icon: '📱', bg: 'bg-pink-50', text: 'text-pink-900', border: 'border-pink-200' },
    other: { label: 'অন্যান্য স্থায়ী সম্পদ', icon: '🏢', bg: 'bg-slate-50', text: 'text-slate-900', border: 'border-slate-200' }
  };

  const handleOpenAddMasterEntry = () => {
    setEditingMasterId(null);
    setMasterFormAccountName('');
    setMasterFormCategory('bank');
    setMasterFormHolderName('');
    setMasterFormHolderPhone('');
    setMasterFormAccountNumber('');
    setMasterFormLocation('');
    setMasterFormAmount('');
    setMasterFormNote('');
    setShowMasterEntryModal(true);
  };

  const handleOpenEditMasterEntry = (item: any) => {
    setEditingMasterId(item.id || null);
    setMasterFormAccountName(item.accountName || item.name || '');
    setMasterFormCategory(item.category || 'bank');
    setMasterFormHolderName(item.holderName || '');
    setMasterFormHolderPhone(item.holderPhone || '');
    setMasterFormAccountNumber(item.accountNumber || '');
    setMasterFormLocation(item.location || '');
    setMasterFormAmount(String(item.amount !== undefined ? item.amount : ''));
    setMasterFormNote(item.note || '');
    setShowMasterEntryModal(true);
  };

  const handleSaveMasterEntry = async () => {
    if (!masterFormAccountName.trim()) {
      alert('অনুগ্রহ করে সম্পদের নাম বা খাতের বিবরণ প্রদান করুন (যেমন: উত্তরা জমি ক্রয়, ইসলামী ব্যাংক ইত্যাদি)');
      return;
    }
    const numAmount = parseFloat(masterFormAmount);
    if (isNaN(numAmount) || numAmount < 0) {
      alert('অনুগ্রহ করে সঠিক টাকার অংক প্রদান করুন');
      return;
    }

    setIsSavingMasterAccount(true);
    try {
      const currentList: any[] = (appConfig?.masterFundAccounts && appConfig.masterFundAccounts.length > 0)
        ? [...appConfig.masterFundAccounts]
        : (drillDownModalData?.history && drillDownModalData.history.length > 0)
          ? [...drillDownModalData.history]
          : [];

      let updatedList: any[] = [];
      const newEntryData = {
        id: editingMasterId || `mf-${Date.now()}`,
        accountName: masterFormAccountName.trim(),
        category: masterFormCategory,
        holderName: masterFormHolderName.trim(),
        holderPhone: masterFormHolderPhone.trim(),
        accountNumber: masterFormAccountNumber.trim(),
        location: masterFormLocation.trim(),
        amount: numAmount,
        note: masterFormNote.trim(),
        updatedAt: new Date().toLocaleDateString('bn-BD')
      };

      if (editingMasterId) {
        let found = false;
        updatedList = currentList.map((item) => {
          if (item.id === editingMasterId) {
            found = true;
            return { ...item, ...newEntryData };
          }
          return item;
        });
        if (!found) {
          updatedList.push(newEntryData);
        }
      } else {
        updatedList = [newEntryData, ...currentList];
      }

      const newTotal = updatedList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const updatedConfig = {
        ...appConfig,
        masterFundAccounts: updatedList,
        initialCompanyFund: newTotal
      };

      await saveAppConfig(updatedConfig);
      if (onChangeConfig) {
        onChangeConfig(updatedConfig);
      }

      if (drillDownModalData) {
        setDrillDownModalData({
          ...drillDownModalData,
          amount: newTotal,
          history: updatedList
        });
      }

      setShowMasterEntryModal(false);
      setMasterSaveSuccessMsg(editingMasterId ? '✅ মাস্টার ফান্ড এন্ট্রি সফলভাবে আপডেট হয়েছে!' : '✅ নতুন মাস্টার ফান্ড এন্ট্রি সফলভাবে যুক্ত হয়েছে!');
      setTimeout(() => setMasterSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error('Error saving master fund entry:', err);
      alert('মাস্টার ফান্ড সংরক্ষণ করতে সমস্যা হয়েছে: ' + (err?.message || err));
    } finally {
      setIsSavingMasterAccount(false);
    }
  };

  const handleDeleteMasterEntry = async (itemToDelete: any) => {
    const itemName = itemToDelete.accountName || itemToDelete.name || 'এই এন্ট্রি';
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${itemName}" মাস্টার ফান্ড থেকে মুছে ফেলতে চান?`)) {
      return;
    }

    try {
      const currentList: any[] = (appConfig?.masterFundAccounts && appConfig.masterFundAccounts.length > 0)
        ? [...appConfig.masterFundAccounts]
        : (drillDownModalData?.history && drillDownModalData.history.length > 0)
          ? [...drillDownModalData.history]
          : [];

      const updatedList = currentList.filter(item => item.id !== itemToDelete.id);
      const newTotal = updatedList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      const updatedConfig = {
        ...appConfig,
        masterFundAccounts: updatedList,
        initialCompanyFund: newTotal
      };

      await saveAppConfig(updatedConfig);
      if (onChangeConfig) {
        onChangeConfig(updatedConfig);
      }

      if (drillDownModalData) {
        setDrillDownModalData({
          ...drillDownModalData,
          amount: newTotal,
          history: updatedList
        });
      }

      setMasterSaveSuccessMsg('🗑️ এন্ট্রি সফলভাবে মুছে ফেলা হয়েছে!');
      setTimeout(() => setMasterSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error('Error deleting master fund entry:', err);
      alert('এন্ট্রি মুছতে সমস্যা হয়েছে: ' + (err?.message || err));
    }
  };

  const copyToClipboard = (txt: string, label: string) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    setCopiedTextNotice(`${label} কপি হয়েছে!`);
    setTimeout(() => setCopiedTextNotice(null), 2200);
  };

  const getUserAvatar = (u: any) => u?.profilePic || u?.photoURL || u?.avatar || u?.photo || null;

  return (
    <>
      {/* Delete User Modal with 4-Digit Admin PIN */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4 backdrop-blur-xs font-sans text-slate-800 animate-fade-in">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-sm border border-slate-100 space-y-0">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-900 via-red-800 to-rose-950 text-white p-5 text-center relative">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-white/20">
                <Trash2 className="w-6 h-6 text-rose-300" />
              </div>
              <h3 className="text-base font-black tracking-tight">সদস্য অ্যাকাউন্ট স্থায়ীভাবে ডিলিট</h3>
              <p className="text-[11px] text-rose-200/90 mt-0.5 font-bold">
                আইডিঃ {userToDelete.memberId || 'N/A'} | {userToDelete.name || userToDelete.phone || 'সম্মানিত সদস্য'}
              </p>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-left">
              {/* Member details preview card */}
              <div className="bg-rose-50/70 border border-rose-200/80 p-3 rounded-2xl text-xs space-y-1">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>নামঃ</span>
                  <span className="font-extrabold text-slate-900">{userToDelete.name || 'বেনামী'}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-700">
                  <span>মোবাইলঃ</span>
                  <span className="font-mono text-slate-900">{userToDelete.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-700">
                  <span>মেইন ওয়ালেটঃ</span>
                  <span className="font-mono text-emerald-700 font-extrabold">৳{(userToDelete.balance || 0).toLocaleString('bn-BD')}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-800">
                  🔒 4 ডিজিট এডমিন সিকিউরিটি পিন দিন (Admin Security PIN) <span className="text-rose-600">*</span>
                </label>
                <p className="text-[10px] text-slate-500 leading-tight">
                  দুর্ঘটনাবশত ভুলবশত হাত লেগে মেম্বার ডিলিট রোধ করতে আপনার 4 ডিজিটের এডমিন সিকিউরিটি পিন লিখুন:
                </p>
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  value={deletePinInput}
                  onChange={(e) => {
                    setDeletePinInput(e.target.value.replace(/\D/g, ''));
                    setDeleteErrorMsg('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmDeleteUserWithPin();
                  }}
                  placeholder="• • • •"
                  className="block w-full px-4 py-3 bg-slate-50 border-2 border-rose-300 rounded-2xl focus:outline-none focus:border-rose-600 text-center font-mono text-xl text-rose-950 font-black tracking-[0.5em]"
                />
              </div>

              {deleteErrorMsg && (
                <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 text-center animate-shake">
                  {deleteErrorMsg}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isDeletingUser}
                  onClick={() => {
                    setUserToDelete(null);
                    setDeletePinInput('');
                    setDeleteErrorMsg('');
                  }}
                  className="flex-1 py-3 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-extrabold rounded-2xl transition cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="button"
                  disabled={isDeletingUser || !deletePinInput}
                  onClick={confirmDeleteUserWithPin}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white text-xs font-black rounded-2xl transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                >
                  {isDeletingUser ? (
                    <span className="animate-pulse">ডিলিট হচ্ছে...</span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>ডিলিট নিশ্চিত করুন</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Receipt proof Modal */}
      {historyActiveScreenshot && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[100] p-4 backdrop-blur-sm text-white font-sans text-left">
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const w = window.open();
                if (w) {
                  w.document.write(`<img src="${historyActiveScreenshot}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
                  w.document.close();
                }
              }}
              className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              🌐 নতুন ট্যাবে খুলুন (Open)
            </button>
            <button
              type="button"
              onClick={() => setHistoryActiveScreenshot(null)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              ✕ বন্ধ করুন (Close)
            </button>
          </div>
          <div className="relative max-w-2xl w-full max-h-[80vh] flex items-center justify-center border border-slate-800/40 rounded-3xl overflow-hidden bg-slate-950">
            <img
              src={historyActiveScreenshot}
              alt="Payment receipt proof"
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
          <p className="mt-4 text-xs font-bold text-slate-400">
            পেমেন্টের প্রমাণ স্ক্রিনশট রিয়েল ইমেজ খতিয়ান
          </p>
        </div>
      )}

      {/* ✏️ Transaction Edit & Delete Modal (Admin Control) */}
      {editingTxModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-xs font-sans text-slate-800">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-lg border border-slate-100 animate-fade-in text-left">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  লেনদেন এডিট ও তথ্য পরিবর্তন (Admin Edit Tx)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  আইডি: <span className="font-mono text-amber-300">{editingTxModal.id}</span> | মেম্বার: {editingTxModal.userName} ({editingTxModal.memberId})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTxModal(null)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setLoading(true);
                  const formData = new FormData(e.currentTarget);
                  const newAmt = parseFloat(formData.get('txAmt') as string);
                  const newPhone = formData.get('txPhone') as string;
                  const newStatus = formData.get('txStatus') as string;
                  const newMethod = formData.get('txMethod') as string;
                  const newDesc = formData.get('txDesc') as string;

                  await updateDoc(doc(db, 'transactions', editingTxModal.id!), {
                    amount: isNaN(newAmt) ? editingTxModal.amount : newAmt,
                    phone: newPhone || editingTxModal.phone || '',
                    status: newStatus || editingTxModal.status,
                    paymentMethod: newMethod || editingTxModal.paymentMethod || '',
                    description: newDesc || editingTxModal.description || ''
                  });

                  alert('লেনদেনের তথ্য সফলভাবে আপডেট করা হয়েছে!');
                  setEditingTxModal(null);
                } catch (err: any) {
                  console.error("Error updating transaction:", err);
                  alert('লেনদেন আপডেট করতে ব্যর্থ হয়েছে: ' + err.message);
                } finally {
                  setLoading(false);
                }
              }}
              className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">টাকার পরিমাণ (Amount ৳)</label>
                  <input
                    type="number"
                    name="txAmt"
                    defaultValue={editingTxModal.amount}
                    required
                    className="w-full bg-slate-50 border border-slate-250 p-2.5 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">স্ট্যাটাস (Status)</label>
                  <select
                    name="txStatus"
                    defaultValue={editingTxModal.status}
                    className="w-full bg-slate-50 border border-slate-250 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="pending">⏳ পেন্ডিং (Pending)</option>
                    <option value="success">🟢 সফল / অনুমোদিত (Approved)</option>
                    <option value="rejected">🔴 বাতিল / রিজেক্টেড (Rejected)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">ফোন / একাউন্ট নম্বর (Phone/Account)</label>
                  <input
                    type="text"
                    name="txPhone"
                    defaultValue={editingTxModal.phone || ''}
                    className="w-full bg-slate-50 border border-slate-250 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">পেমেন্ট মেথড (Payment Method)</label>
                  <input
                    type="text"
                    name="txMethod"
                    defaultValue={editingTxModal.paymentMethod || ''}
                    className="w-full bg-slate-50 border border-slate-250 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">বিস্তারিত বিবরণ (Description)</label>
                <textarea
                  name="txDesc"
                  rows={3}
                  defaultValue={editingTxModal.description || ''}
                  className="w-full bg-slate-50 border border-slate-250 p-2.5 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('আপনি কি এই লেনদেনটি চিরতরে মুছে ফেলতে (DELETE) চান?')) {
                      try {
                        setLoading(true);
                        await deleteDoc(doc(db, 'transactions', editingTxModal.id!));
                        alert('লেনদেনটি স্থায়ীভাবে মুছে ফেলা হয়েছে!');
                        setEditingTxModal(null);
                      } catch (err: any) {
                        alert('মুছে ফেলতে সমস্যা হয়েছে: ' + err.message);
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  🗑️ স্থায়ীভাবে ডিলেট করুন
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTxModal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
                  >
                    তথ্য সংরক্ষণ করুন
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal Window */}
      {editProductModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-xs font-sans text-slate-800 text-left">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-lg border border-slate-100 animate-fade-in">
            <div className="bg-emerald-900 text-white p-5">
              <h3 className="text-base font-bold flex items-center gap-1.5">
                🛒 প্রোডাক্ট বিবরণী ও সুপার শপ ইনভেন্টরি ম্যানেজমেন্ট
              </h3>
              <p className="text-xs text-emerald-250 mt-1">প্রোডাক্ট আইডি: {selectedProduct.id}</p>
            </div>

            <form onSubmit={handleSaveEditProduct} className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">প্রোডাক্ট নাম *</label>
                  <input
                    type="text"
                    required
                    value={epName}
                    onChange={(e) => setEpName(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ক্যাটাগরি ID *</label>
                  <select
                    value={epCategory}
                    onChange={(e) => setEpCategory(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-850"
                  >
                    <option value="organic">Organic/ভেষজ খাদ্য</option>
                    <option value="daily">Daily/নিত্যপ্রয়োজনীয় সামগ্রী</option>
                    <option value="clothing">Clothing/পোশাক পরিচ্ছদ</option>
                    <option value="electronics">Electronics/ইলেকট্রনিক্স</option>
                    {appConfig?.shopCategories?.map((sc, idx) => (
                      <option key={`${sc.id}-${idx}`} value={sc.id}>{sc.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">বিক্রয় মূল্য (৳) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={epPrice}
                    onChange={(e) => setEpPrice(Number(e.target.value))}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono font-bold text-slate-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">পূর্বের মূল্য (৳)</label>
                  <input
                    type="number"
                    min="0"
                    value={epOldPrice || ''}
                    onChange={(e) => setEpOldPrice(e.target.value ? Number(e.target.value) : undefined)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-mono font-bold text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">প্রোডাক্ট ইমোজি</label>
                  <input
                    type="text"
                    value={epIcon}
                    onChange={(e) => setEpIcon(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">সর্বনিম্ন অর্ডার লিমিট</label>
                  <input
                    type="text"
                    value={epMinOrder}
                    onChange={(e) => setEpMinOrder(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">সরবরাহকারী (Supplier)</label>
                  <input
                    type="text"
                    value={epSupplier}
                    onChange={(e) => setEpSupplier(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">উৎপাদনকারী দেশের ফ্ল্যাগ</label>
                  <input
                    type="text"
                    value={epFlag}
                    onChange={(e) => setEpFlag(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ডেলিভারি সময়সীমা</label>
                  <input
                    type="text"
                    value={epShipTime}
                    onChange={(e) => setEpShipTime(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ফটো ইমেজ ইউআরএল (Product Photo URL)</label>
                <input
                  type="text"
                  value={epImageUrl}
                  onChange={(e) => setEpImageUrl(e.target.value)}
                  className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-mono text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">প্রোডাক্টের বিবরণ (Description)</label>
                <textarea
                  value={epDescription}
                  onChange={(e) => setEpDescription(e.target.value)}
                  rows={2}
                  className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs text-slate-850"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditProductModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-extrabold rounded-xl transition cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-emerald-800/10 cursor-pointer"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ration Card Modal Window */}
      {editRationModalOpen && selectedRationCard && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-xs font-sans text-slate-800 text-left">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-md border border-slate-100 animate-fade-in">
            <div className="bg-emerald-900 text-white p-5">
              <h3 className="text-base font-bold flex items-center gap-1.5">
                🥗 ডিজিটাল রেশন কার্ড তথ্য সংশোধন উইন্ডো
              </h3>
              <p className="text-xs text-emerald-250 mt-1">কার্ড আইডি: {selectedRationCard.id}</p>
            </div>

            <form onSubmit={handleSaveEditRationCard} className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto scrollbar-thin">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">কার্ডধারীর পূর্ণ নাম *</label>
                <input
                  type="text"
                  required
                  value={rcEditName}
                  onChange={(e) => setRcEditName(e.target.value)}
                  className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-850"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">নিবন্ধিত মোবাইল নম্বর *</label>
                <input
                  type="text"
                  required
                  value={rcEditPhone}
                  onChange={(e) => setRcEditPhone(e.target.value)}
                  className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono font-bold text-slate-850"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">গ্রাম/মহল্লা</label>
                  <input
                    type="text"
                    value={rcEditVillage}
                    onChange={(e) => setRcEditVillage(e.target.value)}
                    className="block w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">উপজেলা</label>
                  <input
                    type="text"
                    value={rcEditUpazila}
                    onChange={(e) => setRcEditUpazila(e.target.value)}
                    className="block w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">জেলা</label>
                  <input
                    type="text"
                    value={rcEditDistrict}
                    onChange={(e) => setRcEditDistrict(e.target.value)}
                    className="block w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">কার্ড নম্বর *</label>
                  <input
                    type="text"
                    required
                    value={rcEditCardNo}
                    onChange={(e) => setRcEditCardNo(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-mono font-bold text-slate-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">কার্ড ক্যাটাগরি *</label>
                  <select
                    value={rcEditCardType}
                    onChange={(e) => setRcEditCardType(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  >
                    <option value="Premium">Premium Card</option>
                    <option value="Standard">Standard Card</option>
                    <option value="Platinum">Platinum Card</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">নমিনীর নাম</label>
                  <input
                    type="text"
                    value={rcEditNomineeName}
                    onChange={(e) => setRcEditNomineeName(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">কার্ড স্ট্যাটাস</label>
                  <select
                    value={rcEditStatus}
                    onChange={(e) => setRcEditStatus(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  >
                    <option value="active">🟢 ACTIVE (সক্রিয়)</option>
                    <option value="pending">🟡 PENDING (অপেক্ষমান)</option>
                    <option value="rejected">🔴 REJECTED (বাতিলকৃত)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">সদস্যের ছবি (গ্যালারি থেকে পরিবর্তন করুন)</label>
                <div className="flex items-center gap-2 mt-1">
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
                          setRcEditPhoto(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden" 
                    id="admin-edit-user-photo-upload" 
                  />
                  <label 
                    htmlFor="admin-edit-edit-user-photo-upload"
                    className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-[#015335] text-[11px] font-black rounded-xl cursor-pointer transition flex items-center gap-1 border border-emerald-500/20"
                  >
                    🖼️ নতুন ছবি আপলোড
                  </label>
                  {rcEditPhoto ? (
                    <div className="flex items-center gap-1.5">
                      <img src={rcEditPhoto} alt="Preview" className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-xs" />
                      <button type="button" onClick={() => setRcEditPhoto('')} className="text-[10px] text-rose-500 font-bold hover:underline">রিসেট</button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400">কোনো ছবি নেই</span>
                  )}
                </div>
              </div>

              {rcEditCardType === 'Platinum' && (
                <div className="bg-purple-950/10 border border-purple-500/20 p-3.5 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest leading-none">💎 ভিআইপি কাস্টমাইজেশন উইন্ডো</p>
                  
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-1">কার্ডের ব্যাকগ্রাউন্ড গ্রেডিয়েন্ট</label>
                    <select
                      value={rcEditVipCardBg}
                      onChange={(e) => setRcEditVipCardBg(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg outline-none"
                    >
                      <option value="from-slate-950 via-purple-950/70 to-slate-900">🔮 রাজকীয় বেগুনি (Royal Midnight)</option>
                      <option value="from-zinc-900 via-zinc-950 to-zinc-900">🖤 ডার্ক অবসিডিয়ান (Shadow Obsidian)</option>
                      <option value="from-indigo-950 via-indigo-900 to-indigo-950">🌌 মহাজাগতিক নীল (Cosmic Indigo)</option>
                      <option value="from-red-950 via-rose-950 to-zinc-900">🍷 বারগান্ডি ভেলভেট (Burgundy Velvet)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-1">সীমানা/বর্ডার কালার (Hex)</label>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded border border-slate-300 shrink-0" style={{ backgroundColor: rcEditVipBorderColor }} />
                        <input
                          type="text"
                          value={rcEditVipBorderColor}
                          onChange={(e) => setRcEditVipBorderColor(e.target.value)}
                          placeholder="#EC4899"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 text-[11px] font-mono font-bold text-slate-800 rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-1">ব্র্যান্ড কালার (Hex)</label>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded border border-slate-300 shrink-0" style={{ backgroundColor: rcEditVipPrimaryColor }} />
                        <input
                          type="text"
                          value={rcEditVipPrimaryColor}
                          onChange={(e) => setRcEditVipPrimaryColor(e.target.value)}
                          placeholder="#6D28D9"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 text-[11px] font-mono font-bold text-slate-800 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-1">টেক্সট কালার (Tailwind ক্লাস)</label>
                    <select
                      value={rcEditVipTextColor}
                      onChange={(e) => setRcEditVipTextColor(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg outline-none"
                    >
                      <option value="text-purple-100">🔮 হালকা বেগুনি (Lavender Soft)</option>
                      <option value="text-amber-100">🟡 সোনালী টেক্সট (Gold Soft)</option>
                      <option value="text-white">⚪ ধবধবে সাদা (Pure White)</option>
                      <option value="text-slate-200">🩶 হালকা ধূসর (Light Slate)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ইস্যু তারিখ *</label>
                  <input
                    type="text"
                    required
                    value={rcEditIssueDate}
                    onChange={(e) => setRcEditIssueDate(e.target.value)}
                    placeholder="যেমনঃ 07/06/2026"
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs text-slate-850 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">মেয়াদ শেষ হওয়ার তারিখ *</label>
                  <input
                    type="text"
                    required
                    value={rcEditExpiryDate}
                    onChange={(e) => setRcEditExpiryDate(e.target.value)}
                    placeholder="যেমনঃ 06/06/2027"
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs text-slate-850 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">কার্ডের মেয়াদ (বছর) *</label>
                  <select
                    value={rcEditDuration}
                    onChange={(e) => setRcEditDuration(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  >
                    <option value="1">1 বছর (1 Year)</option>
                    <option value="2">2 বছর (2 Years)</option>
                    <option value="3">3 বছর (3 Years)</option>
                    <option value="5">5 বছর (5 Years)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">অনুমোদনকারী স্বাক্ষর *</label>
                  <input
                    type="text"
                    required
                    value={rcEditSignature}
                    onChange={(e) => setRcEditSignature(e.target.value)}
                    placeholder="যেমনঃ S.Hasan"
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs text-slate-850"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditRationModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-extrabold rounded-xl transition cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-emerald-800/10 cursor-pointer"
                >
                  তথ্য সেভ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ration Item Modal Window */}
      {editingRationItem && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[200] p-4 backdrop-blur-xs font-sans text-slate-800 text-left">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-md border border-slate-100 animate-fade-in">
            <div className="bg-emerald-900 text-white p-5">
              <h3 className="text-base font-bold flex items-center gap-1.5">
                {isAddingRationItem ? '🍚 নতুন সাশ্রয়ী রেশন পণ্য সংযুক্তকরণ উইন্ডো' : '🍚 সাশ্রয়ী রেশন পণ্য তথ্য সংশোধন উইন্ডো'}
              </h3>
              <p className="text-xs text-emerald-250 mt-1">পণ্য আইডি: {isAddingRationItem ? 'নতুন' : editingRationItem.id}</p>
            </div>

            <form onSubmit={handleSaveRationItem} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">পণ্যের নাম *</label>
                <input
                  type="text"
                  required
                  value={riName}
                  onChange={(e) => setRiName(e.target.value)}
                  className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-850"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">প্যাক সাইজ / পরিমাণ *</label>
                  <input
                    type="text"
                    required
                    value={riQty}
                    onChange={(e) => setRiQty(e.target.value)}
                    placeholder="যেমন: 5 KG, 1 লিটার"
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-bold text-slate-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">পণ্য ইমোজি বা ছবি (গ্যালারি বা টেক্সট) *</label>
                  <div className="flex items-center gap-2 mt-1">
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
                            setRiEmoji(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden" 
                      id="admin-edit-ri-photo-upload" 
                    />
                    <label 
                      htmlFor="admin-edit-ri-photo-upload"
                      className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-[#015335] text-[11px] font-black rounded-xl cursor-pointer transition flex items-center gap-1 border border-emerald-500/20 shrink-0"
                    >
                      🖼️ ছবি নির্বাচন
                    </label>
                    <input
                      type="text"
                      required
                      value={riEmoji.startsWith('data:image') ? 'ছবি আপলোড করা হয়েছে' : riEmoji}
                      onChange={(e) => setRiEmoji(e.target.value)}
                      placeholder="যেমন: 🍚 বা https://..."
                      className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs text-slate-850"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ডিসকাউন্ট দর (আমাদের দাম) *</label>
                  <input
                    type="number"
                    required
                    value={riPrice}
                    onChange={(e) => setRiPrice(Number(e.target.value))}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-mono font-bold text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">রেগুলার দর (বাজার দর) *</label>
                  <input
                    type="number"
                    required
                    value={riMarketPrice}
                    onChange={(e) => setRiMarketPrice(Number(e.target.value))}
                    className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-mono font-bold text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ব্যাকগ্রাউন্ড কালার ক্লাস</label>
                <input
                  type="text"
                  value={riColor}
                  onChange={(e) => setRiColor(e.target.value)}
                  className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-mono text-slate-500"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRationItem(null);
                    setIsAddingRationItem(false);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-extrabold rounded-xl transition cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-emerald-800/10 cursor-pointer"
                >
                  {isAddingRationItem ? 'পণ্যটি যুক্ত করুন' : 'তথ্য সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📜 SAMITY RULES & REGULATIONS POLICY MANAGER - 100% FULL SCREEN PAGE */}
                  {/* 🛡️ QUICK SAMITY PENALTY WAIVER & CUSTOM DATE CONTROLLER MODAL */}
      {isQuickPenaltyModalOpen && (() => {
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonthDef = BENGALI_MONTH_DEFS[now.getMonth()];
        const curMonthKey = `${curYear}-${curMonthDef?.key || '08'}`;
        const isCurExempt = isMonthExemptedInConfig(curYear, curMonthDef?.key || '08');
        const curMonthCfg = getMonthExemptConfig(curYear, curMonthDef?.key || '08');
        const activeExemptDay = curMonthCfg.exemptUntilDay || policyFormState?.penaltyExemptionUntilDay || (isCurExempt ? 31 : 9);

        return (
          <div className="fixed inset-0 z-[1050] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in text-left">
            <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-scale-up flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-teal-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 border-b border-teal-700/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-xl font-black shadow-md">
                    🛡️
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white leading-tight flex items-center gap-2">
                      <span>জরিমানা স্থগিত ও মেয়াদ বৃদ্ধি কন্ট্রোল</span>
                    </h3>
                    <p className="text-[11px] text-teal-200 font-medium">
                      {curMonthDef?.name || 'চলতি মাস'} {curYear} • সমিতির কিস্তি বিলম্ব জরিমানা ছাড়
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickPenaltyModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
                <div className="p-3.5 bg-amber-50 border border-amber-250 rounded-2xl flex items-start gap-2.5 text-amber-900 leading-relaxed font-medium">
                  <span className="text-base shrink-0">💡</span>
                  <div>
                    <p className="font-bold">সদস্যদের সুবিধার্থে কিস্তি জমার শেষ তারিখ ও জরিমানা স্থগিত করুন।</p>
                    <p className="text-[10.5px] text-amber-800/90 mt-0.5">
                      নির্ধারিত তারিখ পর্যন্ত সকল সদস্য স্বয়ংক্রিয় জরিমানা ছাড়াই নিয়মিত কিস্তি পরিশোধ করতে পারবেন।
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-800">
                    কত তারিখ পর্যন্ত জরিমানা ছাড়া জমা দেওয়া যাবে?
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 15, 20, 25].map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={async () => {
                          try {
                            await handleToggleMonthPenaltyExemption(curYear, curMonthDef?.key || '08', day);
                            requestAlert('সফল', `${curMonthDef?.name} মাসের জরিমানা ${day} তারিখ পর্যন্ত স্থগিত করা হয়েছে।`);
                            setIsQuickPenaltyModalOpen(false);
                          } catch (err: any) {
                            requestAlert('ত্রুটি', err.message);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-center font-black transition cursor-pointer active:scale-95 ${
                          activeExemptDay === day 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {day} তারিখ
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsQuickPenaltyModalOpen(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Net Operating Cash Reserve Audit & Breakdown Modal */}
      {showNetOperatingModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in text-left">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden font-sans">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-black tracking-wide">📊 নিট অবশিষ্ট উদ্বৃত্ত তহবিল হিসাবের গাণিতিক ব্রেকডাউন</h3>
                  <p className="text-[10px] text-slate-300">কোম্পানির মোট তরল তহবিল ও দায় সমন্বয়ের পূর্ণাঙ্গ হিসাব</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNetOperatingModal(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hero Net Amount Display */}
            <div className="p-4 bg-slate-900 text-white text-center shrink-0 border-b border-slate-800">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">নিট অবশিষ্ট ক্যাশ উদ্বৃত্ত</span>
              <span className={`text-2xl sm:text-3xl font-black font-mono mt-1 block ${netOperatingCash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ৳{netOperatingCash.toLocaleString('bn-BD')}
              </span>
            </div>

            {/* Math Breakdown List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-2">
                <span className="font-black text-emerald-950 text-xs">1. সর্বমোট কোম্পানি প্রারম্ভিক ক্যাশ ফান্ড</span>
                <span className="font-black text-emerald-900 text-sm font-mono">+৳{companyReserveFund.toLocaleString('bn-BD')}</span>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-2">
                <span className="font-black text-indigo-950 text-xs">2. সদস্যদের মোট সংগৃহীত সঞ্চয় স্থিতি</span>
                <span className="font-black text-indigo-900 text-sm font-mono">-৳{totalMemberSavings.toLocaleString('bn-BD')}</span>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-2">
                <span className="font-black text-rose-950 text-xs">3. সদস্যদের চলমান মোট ওয়ালেট ব্যালেন্স (কোম্পানির দায়)</span>
                <span className="font-black text-rose-900 text-sm font-mono">-৳{totalMemberMainBalance.toLocaleString('bn-BD')}</span>
              </div>

              <div className="p-3 bg-slate-100 border border-slate-300 rounded-2xl flex items-center justify-between gap-2">
                <span className="font-black text-slate-900 text-xs font-sans">গাণিতিক সূত্র</span>
                <span className="font-extrabold text-[11px] text-slate-700 font-mono">1 - (2 + 3 + অন্যান্য দায়) = নিট উদ্বৃত্ত</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowNetOperatingModal(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. 🕒 HEADER PENDING PROCESSING CENTER MODAL */}
      {showHeaderPendingModal && (
        <HeaderPendingModal
          isOpen={showHeaderPendingModal}
          onClose={() => setShowHeaderPendingModal(false)}
          transactions={transactions || []}
          users={users || []}
          headerPendingTab={headerPendingTab || 'all'}
          setHeaderPendingTab={setHeaderPendingTab || (() => {})}
          headerPendingAddMoneyMethod={headerPendingAddMoneyMethod || 'all'}
          setHeaderPendingAddMoneyMethod={setHeaderPendingAddMoneyMethod || (() => {})}
          headerPendingStatusFilter={headerPendingStatusFilter || 'pending'}
          setHeaderPendingStatusFilter={setHeaderPendingStatusFilter || (() => {})}
          headerPendingSearchQuery={headerPendingSearchQuery || ''}
          setHeaderPendingSearchQuery={setHeaderPendingSearchQuery || (() => {})}
          headerPendingDateFilter={headerPendingDateFilter || 'all'}
          setHeaderPendingDateFilter={setHeaderPendingDateFilter || (() => {})}
          headerPendingCustomDate={headerPendingCustomDate || ''}
          setHeaderPendingCustomDate={setHeaderPendingCustomDate || (() => {})}
          handleApproveTransaction={handleApproveTransaction || (async () => {})}
          handleRejectTransaction={handleRejectTransaction || (async () => {})}
          handleHoldTransaction={handleHoldTransaction}
          handleResumePendingTransaction={handleResumePendingTransaction}
          onRefreshTransactions={onRefreshTransactions}
          onViewUserProfile={openUserEditModal}
          isMasterAdmin={true}
        />
      )}

      {/* 2. 👥 COMPLETE MEMBER DIRECTORY & SERIAL LIST MODAL (M 176 জন) */}
      {showMemberListModal && (() => {
        const filteredMembers = users.filter((u: any) => {
          if (memberListFilter === 'samity') return u.samityStatus === 'approved' || (u.savings || 0) > 0;
          if (memberListFilter === 'loan') return (u.dueLoan || 0) > 0 || (u.loanAmount || 0) > 0;
          if (memberListFilter === 'savings') return (u.savings || 0) > 0;
          if (memberListFilter === 'locked') return u.isAppLocked === true;
          return true;
        }).filter((u: any) => {
          if (!memberListSearch) return true;
          const q = memberListSearch.toLowerCase();
          return (
            (u.name || '').toLowerCase().includes(q) ||
            (u.phone || '').toLowerCase().includes(q) ||
            (u.memberId || '').toLowerCase().includes(q) ||
            (u.village || '').toLowerCase().includes(q)
          );
        });

        const totalFilteredBalance = filteredMembers.reduce((sum: number, u: any) => sum + (Number(u.balance) || 0), 0);
        const totalFilteredSavings = filteredMembers.reduce((sum: number, u: any) => sum + (Number(u.savings) || 0), 0);
        const totalFilteredDueLoan = filteredMembers.reduce((sum: number, u: any) => sum + (Number(u.dueLoan) || 0), 0);

        return (
          <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans text-slate-800 text-left">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-black shadow-md shrink-0">
                    M
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                      <span>সকল সম্মানিত সদস্যের তালিকা ও একাউন্ট স্থিতি</span>
                      <span className="bg-white/20 text-amber-300 text-xs px-2 py-0.5 rounded-full font-mono">
                        {users.length} জন
                      </span>
                    </h3>
                    <p className="text-[11px] text-teal-200 font-medium">
                      সিরিয়াল নম্বর, আইডি, ব্যালেন্স এবং সরাসরি তথ্য সংশোধন ডিরেক্টরি
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMemberListModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* KPI Bar */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border-b border-slate-200 text-center shrink-0">
                <div className="p-2 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-bold block">মোট ওয়ালেট ব্যালেন্স</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-950 font-mono">
                    ৳{totalFilteredBalance.toLocaleString('bn-BD')}
                  </span>
                </div>
                <div className="p-2 bg-indigo-50 rounded-2xl border border-indigo-200">
                  <span className="text-[10px] text-indigo-800 font-bold block">মোট সঞ্চয় স্থিতি</span>
                  <span className="text-xs sm:text-sm font-black text-indigo-950 font-mono">
                    ৳{totalFilteredSavings.toLocaleString('bn-BD')}
                  </span>
                </div>
                <div className="p-2 bg-rose-50 rounded-2xl border border-rose-200">
                  <span className="text-[10px] text-rose-800 font-bold block">মোট বকেয়া ঋণ</span>
                  <span className="text-xs sm:text-sm font-black text-rose-950 font-mono">
                    ৳{totalFilteredDueLoan.toLocaleString('bn-BD')}
                  </span>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="p-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-2 items-center justify-between shrink-0">
                {/* Filter Pills */}
                <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
                  {[
                    { id: 'all', label: 'সকল মেম্বার', count: users.length },
                    { id: 'samity', label: 'সমিতি মেম্বার', count: users.filter((u: any) => u.samityStatus === 'approved' || (u.savings || 0) > 0).length },
                    { id: 'loan', label: 'ঋণ গ্রহীতা', count: users.filter((u: any) => (u.dueLoan || 0) > 0).length },
                    { id: 'locked', label: '🔒 লকড মেম্বার', count: users.filter((u: any) => u.isAppLocked).length }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMemberListFilter(tab.id as any)}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                        memberListFilter === tab.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={memberListSearch}
                    onChange={(e) => setMemberListSearch(e.target.value)}
                    placeholder="নাম, মোবাইল বা মেম্বার আইডি..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-teal-600"
                  />
                  {memberListSearch && (
                    <button
                      type="button"
                      onClick={() => setMemberListSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Members List */}
              <div className="overflow-y-auto flex-1 p-3 space-y-2">
                {filteredMembers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <UserCheck className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold">কোনো সদস্য পাওয়া যায়নি!</p>
                  </div>
                ) : (
                  filteredMembers.map((u: any, idx: number) => {
                    const avatar = getUserAvatar(u);
                    const initial = (u.name || u.phone || 'M').trim().charAt(0).toUpperCase();

                    return (
                      <div
                        key={u.id || u.uid || idx}
                        className="bg-white border border-slate-200/90 hover:border-teal-400 hover:shadow-md p-3 rounded-2xl transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 text-[10px] font-mono font-black text-slate-400 shrink-0 text-center">
                            #{idx + 1}
                          </span>

                          {/* Profile Picture with First Letter Fallback */}
                          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center font-black text-sm text-teal-800 shrink-0 overflow-hidden">
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={u.name || 'Member'}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-900 text-xs truncate">
                                {u.name || 'বেনামী সদস্য'}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold text-[10px] rounded-md">
                                {u.memberId || 'N/A'}
                              </span>
                              {u.isAppLocked && (
                                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 font-bold text-[9px] rounded-md flex items-center gap-0.5">
                                  🔒 লকড
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-mono">
                              <span>{u.phone || 'মোবাইল নেই'}</span>
                              {u.phone && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(u.phone, 'ফোন নম্বর')}
                                  className="text-teal-600 hover:text-teal-800 text-[10px] font-bold cursor-pointer"
                                >
                                  📋 কপি
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Balances & Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 block font-sans">ওয়ালেট</span>
                              <span className="font-black text-emerald-700">
                                ৳{(Number(u.balance) || 0).toLocaleString('bn-BD')}
                              </span>
                            </div>
                            <div className="h-4 w-[1px] bg-slate-200" />
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 block font-sans">সঞ্চয়</span>
                              <span className="font-black text-indigo-700">
                                ৳{(Number(u.savings) || 0).toLocaleString('bn-BD')}
                              </span>
                            </div>
                            {(u.dueLoan || 0) > 0 && (
                              <>
                                <div className="h-4 w-[1px] bg-slate-200" />
                                <div className="text-right">
                                  <span className="text-[9px] text-slate-400 block font-sans">বকেয়া ঋণ</span>
                                  <span className="font-black text-rose-700">
                                    ৳{(Number(u.dueLoan) || 0).toLocaleString('bn-BD')}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setShowMemberListModal(false);
                              if (openUserEditModal) openUserEditModal(u);
                            }}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-black transition cursor-pointer flex items-center gap-1 shrink-0 active:scale-95 shadow-xs"
                          >
                            <Edit3 className="w-3 h-3 text-amber-300" />
                            <span>সংশোধন</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">
                  প্রদর্শিতঃ {filteredMembers.length} জন (মোটঃ {users.length} জন)
                </span>
                <button
                  type="button"
                  onClick={() => setShowMemberListModal(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-black transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. 🔔 ADMIN NOTIFICATION & ACTIVITY ALERT CENTER MODAL */}
      {showAdminNotifyModal && (() => {
        const pendingTxs = transactions.filter((t: any) => t.status === 'pending');
        const recentSuccessTxs = transactions.filter((t: any) => t.status === 'success').slice(0, 10);

        return (
          <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans text-slate-800 text-left">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 border-b border-amber-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-black shadow-md shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black flex items-center gap-2 text-white">
                      <span>এডমিন নোটিফিকেশন ও অ্যাক্টিভিটি অ্যালার্ট সেন্টার</span>
                      {pendingTxs.length > 0 && (
                        <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-black animate-pulse">
                          {pendingTxs.length} পেন্ডিং
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-amber-200 font-medium">
                      রিয়েল-টাইম লেনদেন নোটিশ, সিস্টেম ব্রডকাস্ট ও লাইভ অ্যাকশন
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdminNotifyModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Notification List */}
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {/* Pending Requests Alert Box */}
                {pendingTxs.length > 0 && (
                  <div className="bg-amber-50 border-2 border-amber-300/80 rounded-2xl p-3.5 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-amber-950 text-xs flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-700 animate-spin" />
                        <span>অনুমোদনের অপেক্ষায় থাকা পেন্ডিং লেনদেন সমূহ</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminNotifyModal(false);
                          setShowHeaderPendingModal(true);
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] rounded-lg transition cursor-pointer shadow-2xs"
                      >
                        সবগুলো প্রসেস করুন ➔
                      </button>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {pendingTxs.slice(0, 5).map((t: any) => (
                        <div
                          key={t.id || t.trxId}
                          className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-black text-slate-800 block">
                              {t.userName || t.senderName || 'সম্মানিত সদস্য'} • {t.userPhone || t.senderPhone || ''}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {t.description || t.type || 'লেনদেন'} • {t.date || 'আজ'}
                            </span>
                          </div>
                          <span className="font-black font-mono text-emerald-800 text-xs">
                            ৳{(Number(t.amount) || 0).toLocaleString('bn-BD')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Broadcast Logs */}
                {broadcastLogs.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-700 flex items-center gap-1">
                      <Megaphone className="w-3.5 h-3.5 text-teal-600" />
                      <span>সাম্প্রতিক প্রেরিত ব্রডকাস্ট ও নোটিশ লগ</span>
                    </h4>
                    <div className="space-y-1.5">
                      {broadcastLogs.slice(0, 5).map((l: any, idx: number) => (
                        <div
                          key={l.id || idx}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-slate-900">{l.title || 'নোটিশ'}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{l.createdAt ? new Date(l.createdAt).toLocaleDateString('bn-BD') : 'আজ'}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{l.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Activities */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-700 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    <span>সাম্প্রতিক সফল লেনদেন কার্যক্রম</span>
                  </h4>
                  <div className="space-y-1.5">
                    {recentSuccessTxs.map((t: any) => (
                      <div
                        key={t.id || t.trxId}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-black text-slate-900 block">{t.userName || 'গ্রাহক'}</span>
                            <span className="text-[10px] text-slate-500">{t.description || t.type}</span>
                          </div>
                        </div>
                        <span className="font-black font-mono text-emerald-700">
                          ৳{(Number(t.amount) || 0).toLocaleString('bn-BD')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAdminNotifyModal(false)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. 🛡️ AUTO-TRACKING & 4-CATEGORY LIVE NOTICES MODAL (অটো জরিমানা, অটো সঞ্চয়, হাওলাত ঋণ, অটো রিফান্ড) */}
      {showAutoNoticeModal && (() => {
        // Prepare 4 dataset categories
        // Category 1: Fines & Penalties
        const fineList = fineHistoryItems || [];

        // Category 2: Auto Savings Deductions
        const savingsList = users.filter((u: any) => (u.savings || 0) > 0 || (u.samityMonthlySavings || 0) > 0).map((u: any) => ({
          userId: u.id,
          userObj: u,
          name: u.name || 'সদস্য',
          phone: u.phone || '—',
          memberId: u.memberId || 'N/A',
          amount: u.savings || 0,
          monthlyTarget: u.samityMonthlySavings || 500,
          date: u.lastSavingsDate || (u.createdAt ? new Date(u.createdAt).toLocaleDateString('bn-BD') : 'চলতি মাস'),
          reason: 'সমিতির মাসিক অটো সঞ্চয় জমা',
          type: '🏦 অটো সঞ্চয়',
          status: 'সংগৃহীত'
        }));

        // Category 3: Active Hawlat Loans
        const hawlatList = users.filter((u: any) => (u.dueLoan || 0) > 0 || (u.loanAmount || 0) > 0).map((u: any) => ({
          userId: u.id,
          userObj: u,
          name: u.name || 'ঋণ গ্রহীতা',
          phone: u.phone || '—',
          memberId: u.memberId || 'N/A',
          amount: u.dueLoan || 0,
          loanAmount: u.loanAmount || 0,
          paidLoan: u.paidLoan || 0,
          date: u.lastLoanDate || (u.createdAt ? new Date(u.createdAt).toLocaleDateString('bn-BD') : 'চলতি'),
          reason: 'কর্জে হাসানা সুদমুক্ত হাওলাত ঋণ',
          type: '🤝 হাওলাত ঋণ',
          status: (u.dueLoan || 0) > 0 ? 'বকেয়া রয়েছে' : 'পরিশোধিত'
        }));

        // Category 4: Auto Refunds & Cashbacks
        const refundList = transactions
          .filter((t: any) => (t.status === 'success' || t.status === 'approved') && ((t.type as any) === 'cashback' || t.rechargeCashback || (t.type as any) === 'refund'))
          .map((t: any) => {
            const u = users.find((usr: any) => usr.phone === t.userPhone || usr.phone === t.phoneNumber);
            return {
              userId: u?.id || t.userId,
              userObj: u,
              name: t.userName || u?.name || 'গ্রাহক',
              phone: t.userPhone || t.phoneNumber || u?.phone || '—',
              memberId: u?.memberId || t.trxId || 'REFUND-TX',
              amount: Number(t.rechargeCashback || t.amount || 0),
              date: t.date || (t.createdAt ? new Date(t.createdAt).toLocaleDateString('bn-BD') : 'আজ'),
              reason: t.description || 'রিচার্জ ক্যাশব্যাক / ব্যালেন্স রিফান্ড',
              type: '🎁 রিফান্ড ও ক্যাশব্যাক',
              status: 'পরিশোধিত'
            };
          });

        let activeItems = fineList;
        let categoryTitle = 'অটো জরিমানা ও বিলম্ব ফি নোটিশ তালিকা';
        let categoryBadge = 'জরিমানা';
        let badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';

        if (selectedAutoNoticeCategory === 'savings') {
          activeItems = savingsList;
          categoryTitle = 'সদস্যদের অটো সঞ্চয় কর্তন ও জমা হিস্টোরি';
          categoryBadge = 'সঞ্চয়';
          badgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';
        } else if (selectedAutoNoticeCategory === 'loan') {
          activeItems = hawlatList;
          categoryTitle = 'হাওলাত ঋণ গ্রহণকারী সদস্যদের তালিকা ও বকেয়া';
          categoryBadge = 'হাওলাত';
          badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
        } else if (selectedAutoNoticeCategory === 'refund') {
          activeItems = refundList;
          categoryTitle = 'স্বয়ংক্রিয় রিফান্ড ও ক্যাশব্যাক বিতরণ বিবরণী';
          categoryBadge = 'রিফান্ড';
          badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
        }

        const filteredItems = activeItems.filter((item: any) => {
          if (!autoNoticeSearch) return true;
          const q = autoNoticeSearch.toLowerCase();
          return (
            (item.name || '').toLowerCase().includes(q) ||
            (item.phone || '').toLowerCase().includes(q) ||
            (item.memberId || '').toLowerCase().includes(q) ||
            (item.reason || '').toLowerCase().includes(q)
          );
        });

        const totalCategoryAmount = filteredItems.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0);

        return (
          <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans text-slate-800 text-left">
            <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-black shadow-md shrink-0">
                    ⚡
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                      <span>{categoryTitle}</span>
                      <span className="bg-white/20 text-amber-300 text-xs px-2 py-0.5 rounded-full font-mono">
                        {filteredItems.length} টি রেকর্ড
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-300 font-medium">
                      স্বয়ংক্রিয় প্রসেসিং, পরিমাণ, কারণ ও সংশ্লিষ্ট মেম্বারদের বিবরণী
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAutoNoticeModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 4 Category Switcher Tabs */}
              <div className="grid grid-cols-4 p-2 bg-slate-100 border-b border-slate-200 gap-1.5 shrink-0">
                {[
                  { id: 'fine', label: '১. অটো জরিমানা', count: fineList.length, emoji: '⚠️' },
                  { id: 'savings', label: '২. অটো সঞ্চয়', count: savingsList.length, emoji: '🏦' },
                  { id: 'loan', label: '৩. হাওলাত ঋণ', count: hawlatList.length, emoji: '🤝' },
                  { id: 'refund', label: '৪. অটো রিফান্ড', count: refundList.length, emoji: '🎁' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (setSelectedAutoNoticeCategory) setSelectedAutoNoticeCategory(tab.id as any);
                    }}
                    className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-black transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      selectedAutoNoticeCategory === tab.id
                        ? 'bg-white text-slate-900 shadow-md ring-2 ring-teal-600'
                        : 'bg-transparent text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <span>{tab.emoji} {tab.label}</span>
                    <span className="text-[10px] font-mono font-bold text-teal-700">({tab.count})</span>
                  </button>
                ))}
              </div>

              {/* Summary Bar & Search */}
              <div className="p-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${badgeColor}`}>
                    মোট টাকাঃ ৳{totalCategoryAmount.toLocaleString('bn-BD')}
                  </span>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={autoNoticeSearch}
                    onChange={(e) => setAutoNoticeSearch(e.target.value)}
                    placeholder="নাম, মোবাইল বা কারণ খুঁজুন..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-teal-600"
                  />
                  {autoNoticeSearch && (
                    <button
                      type="button"
                      onClick={() => setAutoNoticeSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Records List */}
              <div className="overflow-y-auto flex-1 p-3 space-y-2">
                {filteredItems.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Activity className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold">এই ক্যাটাগরিতে কোনো ডাটা পাওয়া যায়নি!</p>
                  </div>
                ) : (
                  filteredItems.map((item: any, idx: number) => {
                    const u = item.userObj || users.find((usr: any) => usr.phone === item.phone || usr.name === item.name);
                    const avatar = getUserAvatar(u);
                    const initial = (item.name || item.phone || 'M').trim().charAt(0).toUpperCase();

                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200/90 hover:border-teal-400 hover:shadow-md p-3 rounded-2xl transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 text-[10px] font-mono font-black text-slate-400 shrink-0 text-center">
                            #{idx + 1}
                          </span>

                          {/* Profile Picture with First Letter Fallback */}
                          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center font-black text-sm text-teal-800 shrink-0 overflow-hidden">
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={item.name || 'Member'}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-900 text-xs truncate">
                                {item.name || 'সদস্য'}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold text-[10px] rounded-md">
                                {item.memberId || 'N/A'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${badgeColor}`}>
                                {item.type || categoryBadge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                              {item.reason}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              তারিখঃ {item.date} • ফোনঃ {item.phone}
                            </span>
                          </div>
                        </div>

                        {/* Amount and Profile Button */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="text-right font-mono">
                            <span className="text-[9px] text-slate-400 block font-sans">পরিমাণ</span>
                            <span className="text-sm font-black text-slate-950 font-mono">
                              ৳{(Number(item.amount) || 0).toLocaleString('bn-BD')}
                            </span>
                          </div>

                          {u && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowAutoNoticeModal(false);
                                if (openUserEditModal) openUserEditModal(u);
                              }}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-black transition cursor-pointer flex items-center gap-1 shrink-0 active:scale-95 shadow-xs"
                            >
                              <Edit3 className="w-3 h-3 text-amber-300" />
                              <span>সংশোধন</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAutoNoticeModal(false)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. 📊 12-BOX FINANCIAL DRILL-DOWN LEDGER MODAL */}
      {drillDownModalData && (() => {
        const isMasterFund = drillDownModalData.type === 'master_fund';

        if (isMasterFund) {
          const rawMasterList: any[] = (appConfig?.masterFundAccounts && appConfig.masterFundAccounts.length > 0)
            ? appConfig.masterFundAccounts
            : (drillDownModalData.history || []);

          const counts: Record<string, number> = {
            all: rawMasterList.length,
            land: rawMasterList.filter(it => it.category === 'land').length,
            gold: rawMasterList.filter(it => it.category === 'gold').length,
            bank: rawMasterList.filter(it => it.category === 'bank').length,
            business: rawMasterList.filter(it => it.category === 'business' || it.category === 'investment').length,
            cash: rawMasterList.filter(it => it.category === 'cash').length,
            receivable: rawMasterList.filter(it => it.category === 'receivable').length,
            mfs: rawMasterList.filter(it => it.category === 'mfs').length,
            other: rawMasterList.filter(it => it.category === 'other' || !it.category).length,
          };

          const filteredMasterList = rawMasterList.filter((item: any) => {
            const matchesCategory = masterCategoryFilter === 'all' || 
              (masterCategoryFilter === 'business' ? (item.category === 'business' || item.category === 'investment') : item.category === masterCategoryFilter);
            if (!matchesCategory) return false;

            if (!drillDownSearch) return true;
            const q = drillDownSearch.toLowerCase();
            return (
              (item.accountName || item.name || '').toLowerCase().includes(q) ||
              (item.holderName || '').toLowerCase().includes(q) ||
              (item.holderPhone || '').toLowerCase().includes(q) ||
              (item.accountNumber || '').toLowerCase().includes(q) ||
              (item.location || '').toLowerCase().includes(q) ||
              (item.note || '').toLowerCase().includes(q) ||
              (item.category || '').toLowerCase().includes(q)
            );
          });

          const totalMasterCalculated = rawMasterList.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0);

          return (
            <div className="fixed inset-0 z-[10000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans text-slate-800 text-left">
              <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-emerald-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-xl font-black shadow-lg shrink-0 border border-amber-300">
                      🏛️
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black flex items-center gap-2 tracking-tight">
                        <span>১. কোম্পানির সর্বমোট ফান্ড (Master Fund) সম্পদ খতিয়ান</span>
                      </h3>
                      <p className="text-[11px] text-teal-200 font-medium">
                        টাকা কোথায় কোথায় আছে (জমি, স্বর্ণ, ব্যাংক, ক্যাশ) এবং কার কাছে কত টাকা জমা আছে তার পূর্ণাঙ্গ হিসাব
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrillDownModalData(null)}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Big Amount Card & Action Button */}
                <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 shrink-0">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">
                        মোট মাস্টার ফান্ড ব্যালেন্স (সর্বমোট)
                      </span>
                      <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 drop-shadow-sm">
                        ৳{totalMasterCalculated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pl-4 border-l border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold">মোট সম্পদ ও খাতের সংখ্যা</span>
                      <span className="text-sm font-black font-mono text-amber-300">
                        {rawMasterList.length} টি খাত
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenAddMasterEntry}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-black shadow-lg hover:shadow-emerald-900/40 flex items-center justify-center gap-2 transition cursor-pointer shrink-0 active:scale-98 border border-emerald-400/30"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ নতুন ফান্ড / সম্পদ এন্ট্রি যুক্ত করুন</span>
                  </button>
                </div>

                {/* Save Success Alert */}
                {masterSaveSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fade-in shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{masterSaveSuccessMsg}</span>
                  </div>
                )}

                {/* Category Pills Filter Bar */}
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                  <button
                    type="button"
                    onClick={() => setMasterCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      masterCategoryFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>🌟 সকল খাত</span>
                    <span className="px-1.5 py-0.2 bg-white/20 text-[10px] rounded-full font-mono">{counts.all}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMasterCategoryFilter('land')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      masterCategoryFilter === 'land'
                        ? 'bg-amber-800 text-white shadow-xs'
                        : 'bg-white text-amber-900 hover:bg-amber-50 border border-amber-200'
                    }`}
                  >
                    <span>🏞️ জমি ও সম্পত্তি</span>
                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 text-[10px] rounded-full font-mono">{counts.land}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMasterCategoryFilter('gold')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      masterCategoryFilter === 'gold'
                        ? 'bg-yellow-700 text-white shadow-xs'
                        : 'bg-white text-yellow-900 hover:bg-yellow-50 border border-yellow-200'
                    }`}
                  >
                    <span>🪙 স্বর্ণ ও সোনা</span>
                    <span className="px-1.5 py-0.2 bg-yellow-100 text-yellow-900 text-[10px] rounded-full font-mono">{counts.gold}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMasterCategoryFilter('bank')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      masterCategoryFilter === 'bank'
                        ? 'bg-blue-800 text-white shadow-xs'
                        : 'bg-white text-blue-900 hover:bg-blue-50 border border-blue-200'
                    }`}
                  >
                    <span>🏦 ব্যাংক হিসাব</span>
                    <span className="px-1.5 py-0.2 bg-blue-100 text-blue-900 text-[10px] rounded-full font-mono">{counts.bank}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMasterCategoryFilter('business')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      masterCategoryFilter === 'business'
                        ? 'bg-purple-800 text-white shadow-xs'
                        : 'bg-white text-purple-900 hover:bg-purple-50 border border-purple-200'
                    }`}
                  >
                    <span>💼 ব্যবসা ইনভেস্টমেন্ট</span>
                    <span className="px-1.5 py-0.2 bg-purple-100 text-purple-900 text-[10px] rounded-full font-mono">{counts.business}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMasterCategoryFilter('cash')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      masterCategoryFilter === 'cash'
                        ? 'bg-emerald-800 text-white shadow-xs'
                        : 'bg-white text-emerald-900 hover:bg-emerald-50 border border-emerald-200'
                    }`}
                  >
                    <span>💵 নগদ ক্যাশ</span>
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-900 text-[10px] rounded-full font-mono">{counts.cash}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMasterCategoryFilter('receivable')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      masterCategoryFilter === 'receivable'
                        ? 'bg-teal-800 text-white shadow-xs'
                        : 'bg-white text-teal-900 hover:bg-teal-50 border border-teal-200'
                    }`}
                  >
                    <span>🤝 অন্যের কাছে পাওনা</span>
                    <span className="px-1.5 py-0.2 bg-teal-100 text-teal-900 text-[10px] rounded-full font-mono">{counts.receivable}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMasterCategoryFilter('mfs')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      masterCategoryFilter === 'mfs'
                        ? 'bg-pink-800 text-white shadow-xs'
                        : 'bg-white text-pink-900 hover:bg-pink-50 border border-pink-200'
                    }`}
                  >
                    <span>📱 বিকাশ/নগদ মার্চেন্ট</span>
                    <span className="px-1.5 py-0.2 bg-pink-100 text-pink-900 text-[10px] rounded-full font-mono">{counts.mfs}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMasterCategoryFilter('other')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      masterCategoryFilter === 'other'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>🏢 অন্যান্য</span>
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 text-[10px] rounded-full font-mono">{counts.other}</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="p-3 bg-white border-b border-slate-100 flex justify-between items-center gap-2 shrink-0">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={drillDownSearch}
                      onChange={(e) => setDrillDownSearch(e.target.value)}
                      placeholder="সম্পদের নাম, কার কাছে আছে, দলিল নং, ব্যাংক বা বিবরণ দিয়ে খুঁজুন..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                    />
                    {drillDownSearch && (
                      <button
                        type="button"
                        onClick={() => setDrillDownSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded-md hover:bg-slate-100"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Asset Entries List */}
                <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-3 bg-slate-50/50">
                  {filteredMasterList.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 space-y-3 bg-white rounded-2xl border border-dashed border-slate-300">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl font-bold">
                        🏛️
                      </div>
                      <p className="text-xs font-bold text-slate-600">কোনো সম্পদ বা ফান্ডের এন্ট্রি পাওয়া যায়নি!</p>
                      <button
                        type="button"
                        onClick={handleOpenAddMasterEntry}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>প্রথম এন্ট্রি যুক্ত করুন</span>
                      </button>
                    </div>
                  ) : (
                    filteredMasterList.map((item: any, idx: number) => {
                      const catInfo = MASTER_CATEGORY_MAP[item.category] || MASTER_CATEGORY_MAP.other;

                      return (
                        <div
                          key={item.id || idx}
                          className="bg-white border border-slate-200 hover:border-teal-500 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-md transition space-y-3 text-xs relative group"
                        >
                          {/* Top Row: Index, Category Badge, Title & Amount */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>

                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border flex items-center gap-1 shrink-0 ${catInfo.bg} ${catInfo.text} ${catInfo.border}`}>
                                <span>{catInfo.icon}</span>
                                <span>{catInfo.label}</span>
                              </span>

                              <h4 className="font-black text-slate-900 text-sm truncate">
                                {item.accountName || item.name || 'নামহীন সম্পদ/খাত'}
                              </h4>
                            </div>

                            <div className="text-right sm:text-right shrink-0">
                              <span className="text-[10px] text-slate-400 block font-bold">টাকার পরিমাণ</span>
                              <span className="text-base sm:text-lg font-black font-mono text-emerald-600">
                                ৳{(Number(item.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Middle Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-[11px] text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                            {/* Holder Name */}
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md bg-teal-100 text-teal-800 flex items-center justify-center text-xs shrink-0">
                                👤
                              </span>
                              <div className="min-w-0">
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">কার কাছে আছে / কার নামে</span>
                                <span className="font-bold text-slate-900 text-xs truncate block">
                                  {item.holderName || 'অফিসিয়াল ফান্ড'}
                                </span>
                              </div>
                            </div>

                            {/* Deed / Account Number / Phone */}
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center text-xs shrink-0">
                                📄
                              </span>
                              <div className="min-w-0">
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">দলিল / হিসাব / মোবাইল নং</span>
                                <span className="font-mono font-bold text-slate-900 truncate block">
                                  {item.accountNumber || item.holderPhone || 'তথ্য নেই'}
                                </span>
                              </div>
                            </div>

                            {/* Location */}
                            {item.location && (
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center text-xs shrink-0">
                                  📍
                                </span>
                                <div className="min-w-0">
                                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">অবস্থান / ঠিকানা</span>
                                  <span className="font-semibold text-slate-800 truncate block">
                                    {item.location}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Note */}
                            {item.note && (
                              <div className="flex items-center gap-2 sm:col-span-2">
                                <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-800 flex items-center justify-center text-xs shrink-0">
                                  📝
                                </span>
                                <div className="min-w-0">
                                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">বিবরণ / নোট</span>
                                  <span className="text-slate-700 truncate block">
                                    {item.note}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Last updated */}
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center text-xs shrink-0">
                                🕒
                              </span>
                              <div className="min-w-0">
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">সর্বশেষ আপডেট</span>
                                <span className="font-mono text-slate-600 truncate block">
                                  {item.updatedAt || 'সক্রিয়'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleOpenEditMasterEntry(item)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 active:scale-98"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-teal-700" />
                              <span>✏️ এডিট / পরিবর্তন</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMasterEntry(item)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 active:scale-98"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>🗑️ মুছুন</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
                  <div className="text-xs text-slate-400">
                    <span>সর্বশেষ মোট ফান্ড: </span>
                    <strong className="text-emerald-400 font-mono text-sm">৳{totalMasterCalculated.toLocaleString('en-US')}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrillDownModalData(null)}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                </div>

                {/* Add / Edit Master Fund Entry Popup Modal */}
                {showMasterEntryModal && (
                  <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in text-left">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                      
                      {/* Modal Header */}
                      <div className="bg-gradient-to-r from-slate-900 to-teal-950 p-4 text-white flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-bold shadow-md">
                            {editingMasterId ? '✏️' : '➕'}
                          </div>
                          <div>
                            <h4 className="text-sm font-black">
                              {editingMasterId ? 'মাস্টার ফান্ড এন্ট্রি এডিট ও সংশোধন' : 'নতুন মাস্টার ফান্ড / সম্পদ এন্ট্রি যুক্ত করুন'}
                            </h4>
                            <p className="text-[10px] text-teal-200">
                              টাকা কোথায় রাখা হয়েছে এবং কার কাছে আছে তা লিপিবদ্ধ করুন
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowMasterEntryModal(false)}
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Modal Form Body */}
                      <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
                        
                        {/* 1. Account Name / Title */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            সম্পদের নাম বা খাতের বিবরণ <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={masterFormAccountName}
                            onChange={(e) => setMasterFormAccountName(e.target.value)}
                            placeholder="যেমন: উত্তরা ৩ কাঠা জমি বায়না / ইসলামী ব্যাংক ডিপোজিট / ২০ ভরি স্বর্ণ ক্রয়"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                          />
                        </div>

                        {/* 2. Category */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            ফান্ডের খাত / ক্যাটাগরি <span className="text-rose-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {[
                              { key: 'land', label: '🏞️ জমি ও ফ্ল্যাট' },
                              { key: 'gold', label: '🪙 স্বর্ণ ও সোনা' },
                              { key: 'bank', label: '🏦 ব্যাংক ডিপোজিট' },
                              { key: 'business', label: '💼 ব্যবসা বিনিয়োগ' },
                              { key: 'cash', label: '💵 ক্যাশ ইন হ্যান্ড' },
                              { key: 'receivable', label: '🤝 অন্যের কাছে পাওনা' },
                              { key: 'mfs', label: '📱 মার্চেন্ট ওয়ালেট' },
                              { key: 'other', label: '🏢 অন্যান্য সম্পদ' }
                            ].map((cat) => (
                              <button
                                key={cat.key}
                                type="button"
                                onClick={() => setMasterFormCategory(cat.key as any)}
                                className={`px-2 py-2 rounded-xl text-[11px] font-bold border transition text-center ${
                                  masterFormCategory === cat.key
                                    ? 'bg-teal-900 text-white border-teal-900 shadow-xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3. Amount */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            টাকার পরিমাণ (৳) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={masterFormAmount}
                            onChange={(e) => setMasterFormAmount(e.target.value)}
                            placeholder="যেমন: 500000"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-emerald-700 focus:outline-none focus:border-teal-600 focus:bg-white text-sm transition"
                          />
                        </div>

                        {/* 4. Holder Name (কার কাছে আছে) */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            কার কাছে আছে / কার নামে (দায়িত্বপ্রাপ্ত ব্যক্তি)
                          </label>
                          <input
                            type="text"
                            value={masterFormHolderName}
                            onChange={(e) => setMasterFormHolderName(e.target.value)}
                            placeholder="যেমন: মোঃ মোস্তাফিজুর রহমান (চেয়ারম্যান) / ইসলামী ব্যাংক মতিঝিল / আব্দুল করিম"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                          />
                        </div>

                        {/* 5. Deed / Account Number / Phone */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              দলিল / ব্যাংক হিসাব / রসিদ নং
                            </label>
                            <input
                              type="text"
                              value={masterFormAccountNumber}
                              onChange={(e) => setMasterFormAccountNumber(e.target.value)}
                              placeholder="যেমন: দলিল নং: ৪৫৮/২০২৬ / A/C: 20501234"
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              মোবাইল নম্বর
                            </label>
                            <input
                              type="text"
                              value={masterFormHolderPhone}
                              onChange={(e) => setMasterFormHolderPhone(e.target.value)}
                              placeholder="যেমন: 01712345678"
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                            />
                          </div>
                        </div>

                        {/* 6. Location / Address */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            অবস্থান / ঠিকানা / লোকেশন
                          </label>
                          <input
                            type="text"
                            value={masterFormLocation}
                            onChange={(e) => setMasterFormLocation(e.target.value)}
                            placeholder="যেমন: উত্তরা সেক্টর ১১, ঢাকা / মতিঝিল হেড অফিস ভল্ট"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                          />
                        </div>

                        {/* 7. Extra Note / Description */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            অতিরিক্ত বিবরণ বা বিশেষ নোট
                          </label>
                          <textarea
                            rows={2}
                            value={masterFormNote}
                            onChange={(e) => setMasterFormNote(e.target.value)}
                            placeholder="যেমন: জমির বায়না রেজিস্ট্রি করা হয়েছে, আগামী মাসে মূল দলিল সম্পন্ন হবে"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition text-xs"
                          />
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowMasterEntryModal(false)}
                          disabled={isSavingMasterAccount}
                          className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-300"
                        >
                          বাতিল
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveMasterEntry}
                          disabled={isSavingMasterAccount}
                          className="px-6 py-2 bg-teal-900 hover:bg-teal-800 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          <span>{isSavingMasterAccount ? 'সংরক্ষণ হচ্ছে...' : '✅ সংরক্ষণ ও আপডেট করুন'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }

        // Standard transaction drill-down modal for other modules
        const historyList = drillDownModalData.history || [];
        const filteredHistory = historyList.filter((item: any) => {
          if (!drillDownSearch) return true;
          const q = drillDownSearch.toLowerCase();
          return (
            (item.name || item.accountName || '').toLowerCase().includes(q) ||
            (item.phone || item.holderPhone || '').toLowerCase().includes(q) ||
            (item.type || '').toLowerCase().includes(q) ||
            (item.status || '').toLowerCase().includes(q)
          );
        });

        const totalAmount = filteredHistory.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0);

        return (
          <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans text-slate-800 text-left">
            <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-black shadow-md shrink-0">
                    📊
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                      <span>{drillDownModalData.title}</span>
                    </h3>
                    <p className="text-[11px] text-teal-200 font-medium">
                      পূর্ণাঙ্গ লেনদেন ও ব্যালেন্স অডিট হিস্টোরি
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrillDownModalData(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Big Amount Card */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">মোট তহবিলের স্থিতি</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                    ৳{drillDownModalData.amount.toLocaleString('bn-BD')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-bold">মোট এন্ট্রি সংখ্যা</span>
                  <span className="text-sm font-black font-mono text-white">
                    {historyList.length} টি
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="p-3 bg-white border-b border-slate-100 flex justify-between items-center gap-2 shrink-0">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={drillDownSearch}
                    onChange={(e) => setDrillDownSearch(e.target.value)}
                    placeholder="হিস্টোরিতে খুঁজুন..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-teal-600"
                  />
                  {drillDownSearch && (
                    <button
                      type="button"
                      onClick={() => setDrillDownSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* History Table */}
              <div className="overflow-y-auto flex-1 p-3 space-y-2">
                {filteredHistory.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <History className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold">এই ফান্ডের কোনো হিস্টোরি এন্ট্রি পাওয়া যায়নি!</p>
                  </div>
                ) : (
                  filteredHistory.map((item: any, idx: number) => {
                    const u = item.userObj || users.find((usr: any) => usr.phone === item.phone || usr.name === item.name);
                    const avatar = getUserAvatar(u);
                    const initial = (item.name || item.accountName || item.phone || 'M').trim().charAt(0).toUpperCase();

                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200/90 hover:border-teal-400 hover:shadow-md p-3 rounded-2xl transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 text-[10px] font-mono font-black text-slate-400 shrink-0 text-center">
                            #{idx + 1}
                          </span>

                          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center font-black text-xs text-teal-800 shrink-0 overflow-hidden">
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={item.name || 'Member'}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-900 text-xs truncate">
                                {item.name || item.accountName || 'অজ্ঞাত'}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold text-[10px] rounded-md">
                                {item.memberId || item.phone || item.accountNumber || 'N/A'}
                              </span>
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold text-[9px] rounded-md border border-emerald-100">
                                {item.type || 'লেনদেন'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              তারিখঃ {item.date || 'আজ'} • স্ট্যাটাসঃ {item.status || 'সফল'}
                            </span>
                          </div>
                        </div>

                        {/* Amount and Action */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <span className="text-sm font-black text-emerald-800 font-mono">
                            ৳{(Number(item.amount) || 0).toLocaleString('bn-BD')}
                          </span>

                          {u && (
                            <button
                              type="button"
                              onClick={() => {
                                setDrillDownModalData(null);
                                if (openUserEditModal) openUserEditModal(u);
                              }}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-black transition cursor-pointer"
                            >
                              ✏️ সংশোধন
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDrillDownModalData(null)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 6. 📜 SECTION 12 REPORT & COMPLETE 12-IN-1 AUDIT CENTER MODAL */}
      {showSection12ReportModal && (() => {
        const ledgers = [
          { id: '1', name: '১. মাস্টার ফান্ড লেজার', amount: valMasterFund, icon: '🏦' },
          { id: '2', name: '২. সমবায় সমিতি লেজার', amount: valSamityFund, icon: '👥' },
          { id: '3', name: '৩. রিচার্জ ফান্ড লেজার', amount: valMobileRechargeFund, icon: '📱' },
          { id: '4', name: '৪. ক্যাশব্যাক লেজার', amount: valMobileCashbackFund, icon: '🎁' },
          { id: '5', name: '৫. কর্জে হাসানা লেজার', amount: valQardMainFund, icon: '🤝' },
          { id: '6', name: '৬. ক্যাশ ও ব্যাংক লেজার', amount: valCashAndBankBalance, icon: '💳' },
          { id: '7', name: '৭. আয় ও কমিশন লেজার', amount: valIncome, icon: '📈' },
          { id: '8', name: '৮. ব্যয় লেজার', amount: valExpense, icon: '📉' },
          { id: '9', name: '৯. জরিমানা লেজার', amount: valFineFund, icon: '⚠️' },
          { id: '10', name: '১০. নেট মূলধন লেজার', amount: valNetAsset, icon: '⚖️' },
          { id: '11', name: '১১. দায় ও পাওনা লেজার', amount: valLiabilities, icon: '📋' },
          { id: '12', name: '১২. পূর্ণাঙ্গ অডিট শিট', amount: valNetAsset, icon: '📜' }
        ];

        return (
          <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans text-slate-800 text-left">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-black shadow-md shrink-0">
                    📜
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                      <span>১২. কোম্পানি পূর্ণাঙ্গ রিপোর্ট ও সমন্বিত লেজার কেন্দ্র</span>
                    </h3>
                    <p className="text-[11px] text-teal-200 font-medium">
                      সকল ১২টি ফান্ডের সম্পূর্ণ ব্যালেন্স শিট, আয়ের হিসাব ও অডিট স্টেটমেন্ট
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSection12ReportModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid of 12 Ledgers */}
              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ledgers.map((l) => (
                    <div
                      key={l.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition flex flex-col justify-between space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs font-black text-slate-800">
                        <span>{l.icon} {l.name}</span>
                      </div>
                      <span className="text-base sm:text-lg font-black font-mono text-teal-900">
                        ৳{l.amount.toLocaleString('bn-BD')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Audit Formula Summary */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                  <h4 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>কোম্পানির সমন্বিত ব্যালেন্স শিট সারাংশ</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <span className="text-[10px] text-slate-500 block font-bold">মোট সম্পদ (Assets)</span>
                      <span className="font-black text-emerald-800 font-mono">৳{(valMasterFund + valIncome + valFineFund).toLocaleString('bn-BD')}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <span className="text-[10px] text-slate-500 block font-bold">মোট দায় (Liabilities)</span>
                      <span className="font-black text-rose-800 font-mono">৳{valLiabilities.toLocaleString('bn-BD')}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <span className="text-[10px] text-slate-500 block font-bold">নিট মূলধন (Equity)</span>
                      <span className="font-black text-indigo-800 font-mono">৳{valNetAsset.toLocaleString('bn-BD')}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <span className="text-[10px] text-slate-500 block font-bold">মোট সংগৃহীত সঞ্চয়</span>
                      <span className="font-black text-teal-800 font-mono">৳{valSamityFund.toLocaleString('bn-BD')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSection12ReportModal(false)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 7. ⚙️ MASTER ADMIN 12-FUND MANUAL TUNING & OVERRIDE MODAL */}
      {showFundAdjustModal && (() => {
        const modules = fundModulesList || [];
        const currentSelectedMod = modules.find((m: any) => m.key === adjustFundKey) || modules[0];

        return (
          <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans text-slate-800 text-left">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-black shadow-md shrink-0">
                    ⚙️
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                      <span>ম্যানুয়াল ব্যালেন্স টিউন ও সমন্বয় ম্যানেজার</span>
                    </h3>
                    <p className="text-[11px] text-teal-200 font-medium">
                      ১২টি ফান্ডের স্বয়ংক্রিয় হিসাবের ওপর কাস্টম মান সেট করুন
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFundAdjustModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1.5">
                    কোন ফান্ডটি টিউন বা পরিবর্তন করতে চান?
                  </label>
                  <select
                    value={adjustFundKey}
                    onChange={(e) => {
                      if (setAdjustFundKey) setAdjustFundKey(e.target.value);
                      const mod = modules.find((m: any) => m.key === e.target.value);
                      if (setAdjustCustomValue) setAdjustCustomValue(mod?.isManual ? String(mod.currentVal) : '');
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:border-teal-600"
                  >
                    {modules.map((m: any) => (
                      <option key={m.key} value={m.key}>
                        {m.name} (বর্তমানঃ ৳{Number(m.currentVal).toLocaleString('bn-BD')})
                      </option>
                    ))}
                  </select>
                </div>

                {currentSelectedMod && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex justify-between font-bold text-slate-600">
                      <span>সিস্টেম অটো ক্যালকুলেশন মানঃ</span>
                      <span className="font-mono text-slate-900">৳{Number(currentSelectedMod.autoVal).toLocaleString('bn-BD')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-600">
                      <span>বর্তমান সক্রিয় স্ট্যাটাসঃ</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        currentSelectedMod.isManual ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        {currentSelectedMod.isManual ? '🛠️ ম্যানুয়াল কাস্টম মান' : '🤖 অটোমেটিক সিস্টেম মান'}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1.5">
                    নতুন ম্যানুয়াল কাস্টম ব্যালেন্স লিখুন (৳)
                  </label>
                  <input
                    type="number"
                    value={adjustCustomValue}
                    onChange={(e) => {
                      if (setAdjustCustomValue) setAdjustCustomValue(e.target.value);
                    }}
                    placeholder="উদাহরণঃ 1500000"
                    className="w-full p-3 bg-slate-50 border-2 border-teal-300 rounded-2xl text-base font-black font-mono text-slate-900 focus:outline-none focus:border-teal-600"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    খালি রেখে সেভ করলে বা রিসেট দিলে স্বয়ংক্রিয় সিস্টেম হিসাবে ফিরে যাবে।
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const nextAdjustments = { ...(appConfig?.manualFundAdjustments || {}) };
                    delete nextAdjustments[adjustFundKey];
                    const updatedConfig = { ...appConfig, manualFundAdjustments: nextAdjustments };
                    if (onChangeConfig) onChangeConfig(updatedConfig);
                    await saveAppConfig(updatedConfig);
                    if (requestAlert) requestAlert('রিসেট সফল', 'ফান্ডটি পুনরায় স্বয়ংক্রিয় হিসেবে ফিরিয়ে নেওয়া হয়েছে!');
                    setShowFundAdjustModal(false);
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black transition cursor-pointer"
                >
                  🔄 অটোতে রিসেট
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFundAdjustModal(false)}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const numVal = parseFloat(adjustCustomValue);
                      const nextAdjustments = { ...(appConfig?.manualFundAdjustments || {}) };
                      if (!isNaN(numVal) && numVal >= 0) {
                        nextAdjustments[adjustFundKey] = numVal;
                      } else {
                        delete nextAdjustments[adjustFundKey];
                      }
                      const updatedConfig = { ...appConfig, manualFundAdjustments: nextAdjustments };
                      if (onChangeConfig) onChangeConfig(updatedConfig);
                      await saveAppConfig(updatedConfig);
                      if (requestAlert) requestAlert('সেভ সফল', 'ফান্ড ব্যালেন্স সফলভাবে আপডেট করা হয়েছে!');
                      setShowFundAdjustModal(false);
                    }}
                    className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md"
                  >
                    💾 সেভ করুন
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Copied Notice */}
      {copiedTextNotice && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100000] bg-slate-900 text-amber-300 border border-amber-400/50 shadow-2xl px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 animate-bounce">
          <span>{copiedTextNotice}</span>
        </div>
      )}
    </>
  );
}