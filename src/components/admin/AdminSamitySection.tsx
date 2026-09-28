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

export function AdminSamitySection(props: any) {

  const currentUser = props.currentUser || props.user || props.liveUser || {};
  const appConfig = props.appConfig || {};

  const {
    adminTab,
    y,
    text,
    users,
    setViewingGrid,
    type,
    notices,
    left,
    now,
    curYear,
    curMonthDef,
    BENGALI_MONTH_DEFS,
    isCurExempt,
    isMonthExemptedInConfig,
    key,
    getMonthExemptConfig,
    policyFormState,
    setQuickPenaltyDay,
    setQuickPenaltyNote,
    setIsQuickPenaltyModalOpen,
    setIsPolicyModalOpen,
    cfgAllowProfileSelfEdit,
    handleToggleProfileSelfEdit,
    u,
    isSubAdmin,
    setGeneralMemberFilterTab,
    generalMemberFilterTab,
    setAdminTab,
    uid,
    name,
    handleApproveUserAccount,
    handleRejectUserAccount,
    isResequencing,
    handleResequenceAllMemberIds,
    setShowAddMemberForm,
    showAddMemberForm,
    regSuccess,
    regError,
    handleManualMemberRegistration,
    newMemberName,
    setNewMemberName,
    target,
    newMemberPhone,
    setNewMemberPhone,
    newMemberPin,
    setNewMemberPin,
    newMemberId,
    setNewMemberId,
    autoGenerateMemberId,
    newRole,
    setNewRole,
    newMemberGroup,
    setNewMemberGroup,
    newMainsBal,
    setNewMainsBal,
    newTelBal,
    setNewTelBal,
    newShopBal,
    setNewShopBal,
    newSavings,
    setNewSavings,
    newDueLoan,
    setNewDueLoan,
    setRegSuccess,
    setRegError,
    generalMemberSearch,
    setGeneralMemberSearch,
    memberSortOrder,
    setMemberSortOrder,
    q,
    numA,
    numB,
    timeA,
    timeB,
    adminAgentRequests,
    img,
    getUserMainWalletBalance,
    handleApproveAppLockReset,
    handleRejectAppLockReset,
    showAppLockCodeMap,
    id,
    docId,
    setShowAppLockCodeMap,
    setCopiedAppLockUid,
    copiedAppLockUid,
    handleAdminInstantUnlockUser,
    openUserEditModal,
    handleDeleteUser
  } = props;

  const [processingRefundUid, setProcessingRefundUid] = useState<string | null>(null);

  const handleApproveSamityRefund = async (memberUser: any) => {
    const refundAmt = Number(memberUser.savings !== undefined ? memberUser.savings : (memberUser as any).dpsBalance) || 0;
    if (!window.confirm(`${memberUser.name || 'সদস্য'} (আইডি: ${memberUser.memberId || 'N/A'}) এর জমানো মোট ৳${refundAmt.toLocaleString('bn-BD')} টাকা মেইন ওয়ালেটে রিফান্ড অনুমোদন করতে চান?`)) {
      return;
    }
    setProcessingRefundUid(memberUser.uid);
    try {
      const userRef = doc(db, 'users', memberUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        alert("ব্যবহারকারী ডাটাবেজে পাওয়া যায়নি!");
        return;
      }
      const freshData = userSnap.data();
      const currentBal = Number(freshData.balance !== undefined ? freshData.balance : freshData.mainBalance) || 0;
      const newBal = currentBal + refundAmt;
      const nowIso = new Date().toISOString();

      await updateDoc(userRef, {
        balance: newBal,
        mainBalance: newBal,
        savings: 0,
        dpsBalance: 0,
        samityAutoSavingsActive: false,
        samitySwitchStatus: 'OFF',
        samityDeactivateStatus: 'released',
        samityReleasedDate: nowIso,
        updatedAt: serverTimestamp()
      });

      // Create transaction log
      const txDocRef = doc(collection(db, 'transactions'));
      await setDoc(txDocRef, {
        id: txDocRef.id,
        userId: memberUser.uid,
        userName: memberUser.name || '',
        userPhone: memberUser.phone || '',
        memberId: memberUser.memberId || '',
        type: 'withdraw',
        typeLabel: 'সমবায় সঞ্চয় উত্তোলন ও রিফান্ড অনুমোদন',
        category: 'samity_withdraw',
        amount: refundAmt,
        status: 'success',
        isApproved: true,
        paymentMethod: 'মেইন ওয়ালেট রিফান্ড',
        description: `এডমিন কর্তৃক সমবায় সঞ্চয় বন্ধের আবেদন অনুমোদন ও মেইন ওয়ালেটে ৳${refundAmt.toLocaleString('bn-BD')} টাকা রিফান্ড প্রদান সম্পন্ন।`,
        createdAt: nowIso,
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        receiptNo: `REC-SAMITY-APP-${Date.now()}`
      });

      // Update any pending transactions for this user
      try {
        const qPending = query(
          collection(db, 'transactions'),
          where('userId', '==', memberUser.uid),
          where('status', '==', 'pending')
        );
        const snapPending = await getDocs(qPending);
        await Promise.all(snapPending.docs.map(async (d) => {
          const dData = d.data();
          if (dData.category === 'samity_withdraw' || dData.type === 'withdraw' || (dData as any).isSavingsWithdraw || (dData.typeLabel || '').includes('সমবায়') || (dData.typeLabel || '').includes('সঞ্চয়')) {
            await updateDoc(doc(db, 'transactions', d.id), {
              status: 'success',
              isApproved: true,
              reviewStatus: 'approved',
              approvedAt: nowIso,
              updatedAt: nowIso
            });
          }
        }));
      } catch (e) {}

      // Dispatch User Notification
      await addDoc(collection(db, 'user_notifications'), {
        userId: memberUser.uid,
        memberId: memberUser.memberId || '',
        title: '🎉 সঞ্চয় উত্তোলন ও রিফান্ড অনুমোদন সম্পন্ন',
        message: `আপনার সঞ্চয় বন্ধ ও ৳${refundAmt.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন এডমিন কর্তৃক সফলভাবে অনুমোদন করা হয়েছে এবং টাকা আপনার মেইন ব্যালেন্সে যুক্ত হয়েছে।`,
        body: `আপনার সঞ্চয় বন্ধ ও ৳${refundAmt.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন এডমিন কর্তৃক সফলভাবে অনুমোদন করা হয়েছে এবং টাকা আপনার মেইন ব্যালেন্সে যুক্ত হয়েছে।`,
        isPersonal: true,
        read: false,
        type: 'samity',
        category: 'transaction',
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        createdAt: serverTimestamp()
      });

      alert(`✅ সফল! ${memberUser.name || 'সদস্য'} এর ৳${refundAmt.toLocaleString('bn-BD')} টাকা মেইন ওয়ালেটে রিফান্ড অনুমোদন সম্পন্ন হয়েছে।`);
    } catch (err: any) {
      console.error("Refund approval error:", err);
      alert("অনুমোদনে সমস্যা হয়েছে: " + (err.message || err));
    } finally {
      setProcessingRefundUid(null);
    }
  };

  const handleApproveSamityCashPayout = async (memberUser: any) => {
    const payoutAmt = Number(memberUser.savings !== undefined ? memberUser.savings : (memberUser as any).dpsBalance) || 0;
    if (!window.confirm(`${memberUser.name || 'সদস্য'} কে কি সরাসরি ক্যাশ/হাতে ৳${payoutAmt.toLocaleString('bn-BD')} টাকা প্রদান করে একাউন্ট সেটেল করতে চান?`)) {
      return;
    }
    setProcessingRefundUid(memberUser.uid);
    try {
      const userRef = doc(db, 'users', memberUser.uid);
      const nowIso = new Date().toISOString();

      await updateDoc(userRef, {
        savings: 0,
        dpsBalance: 0,
        samityAutoSavingsActive: false,
        samitySwitchStatus: 'OFF',
        samityDeactivateStatus: 'released',
        samityReleasedDate: nowIso,
        updatedAt: serverTimestamp()
      });

      const txDocRef = doc(collection(db, 'transactions'));
      await setDoc(txDocRef, {
        id: txDocRef.id,
        userId: memberUser.uid,
        userName: memberUser.name || '',
        userPhone: memberUser.phone || '',
        memberId: memberUser.memberId || '',
        type: 'withdraw',
        typeLabel: 'সমবায় সঞ্চয় ক্যাশ প্রদান ও সেটেল',
        category: 'samity_withdraw',
        amount: payoutAmt,
        status: 'success',
        isApproved: true,
        paymentMethod: 'ক্যাশ / হাতে প্রদান',
        description: `এডমিন কর্তৃক সমবায় সঞ্চয় আমানত ৳${payoutAmt.toLocaleString('bn-BD')} টাকা সরাসরি ক্যাশ/হাতে প্রদান করে একাউন্ট ক্লোজ করা হয়েছে।`,
        createdAt: nowIso,
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        receiptNo: `REC-SAMITY-CASH-${Date.now()}`
      });

      await addDoc(collection(db, 'user_notifications'), {
        userId: memberUser.uid,
        memberId: memberUser.memberId || '',
        title: '💵 সঞ্চয় আমানত ক্যাশ প্রদান সম্পন্ন',
        message: `আপনার সমবায় সমিতির সঞ্চয় আমানত মোট ৳${payoutAmt.toLocaleString('bn-BD')} টাকা সরাসরি ক্যাশে প্রদান করে একাউন্ট সেটেল করা হয়েছে।`,
        body: `আপনার সমবায় সমিতির সঞ্চয় আমানত মোট ৳${payoutAmt.toLocaleString('bn-BD')} টাকা সরাসরি ক্যাশে প্রদান করে একাউন্ট সেটেল করা হয়েছে।`,
        isPersonal: true,
        read: false,
        type: 'samity',
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        createdAt: serverTimestamp()
      });

      alert(`✅ সফল! ${memberUser.name || 'সদস্য'} কে ক্যাশ প্রদান ও সেটেল সম্পন্ন হয়েছে।`);
    } catch (err: any) {
      console.error("Cash payout error:", err);
      alert("ক্যাশ সেটেলমেন্টে সমস্যা হয়েছে: " + (err.message || err));
    } finally {
      setProcessingRefundUid(null);
    }
  };

  const handleReactivateSamitySavings = async (memberUser: any) => {
    if (!window.confirm(`${memberUser.name || 'সদস্য'} এর জন্য অটো সঞ্চয় পুনরায় চালু (ON) করতে চান?`)) {
      return;
    }
    try {
      const userRef = doc(db, 'users', memberUser.uid);
      await updateDoc(userRef, {
        samityAutoSavingsActive: true,
        samitySwitchStatus: 'ON',
        samityDeactivateStatus: 'active',
        samityOptInReason: 'এডমিন কর্তৃক পুনরায় সঞ্চয় চালু করা হয়েছে',
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'user_notifications'), {
        userId: memberUser.uid,
        memberId: memberUser.memberId || '',
        title: '🔄 সমবায় সমিতি সঞ্চয় পুনরায় সচল (ON)',
        message: `আপনার সমিতির অটো সঞ্চয় এডমিন কর্তৃক পুনরায় সক্রিয় (ON) করা হয়েছে। প্রতিমাসের নির্দিষ্ট দিনে নিয়মিত সঞ্চয় জমা অব্যাহত থাকবে।`,
        body: `আপনার সমিতির অটো সঞ্চয় এডমিন কর্তৃক পুনরায় সক্রিয় (ON) করা হয়েছে। প্রতিমাসের নির্দিষ্ট দিনে নিয়মিত সঞ্চয় জমা অব্যাহত থাকবে।`,
        isPersonal: true,
        read: false,
        type: 'samity',
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        createdAt: serverTimestamp()
      });

      alert(`✅ সফল! ${memberUser.name || 'সদস্য'} এর সঞ্চয় সফলভাবে পুনরায় চালু হয়েছে।`);
    } catch (err: any) {
      alert("সঞ্চয় পুনরায় চালু করতে সমস্যা হয়েছে: " + (err.message || err));
    }
  };

  const handleRejectSamityOptOut = async (memberUser: any) => {
    const reason = window.prompt("সঞ্চয় বন্ধের আবেদন বাতিলের কারণ লিখুন:", "নিয়ম অনুযায়ী চলতি মেয়াদ শেষে আবেদন প্রযোজ্য হবে");
    if (reason === null) return;
    try {
      const userRef = doc(db, 'users', memberUser.uid);
      const nowIso = new Date().toISOString();

      await updateDoc(userRef, {
        samityAutoSavingsActive: true,
        samitySwitchStatus: 'ON',
        samityDeactivateStatus: 'rejected',
        samityRejectReason: reason.trim(),
        updatedAt: serverTimestamp()
      });

      try {
        const qPending = query(
          collection(db, 'transactions'),
          where('userId', '==', memberUser.uid),
          where('status', '==', 'pending')
        );
        const snapPending = await getDocs(qPending);
        await Promise.all(snapPending.docs.map(async (d) => {
          const dData = d.data();
          if (dData.category === 'samity_withdraw' || dData.type === 'withdraw' || (dData as any).isSavingsWithdraw || (dData.typeLabel || '').includes('সমবায়') || (dData.typeLabel || '').includes('সঞ্চয়')) {
            await updateDoc(doc(db, 'transactions', d.id), {
              status: 'rejected',
              isApproved: false,
              reviewStatus: 'rejected',
              rejectReason: reason.trim(),
              rejectionReason: reason.trim(),
              updatedAt: nowIso
            });
          }
        }));
      } catch (e) {}

      await addDoc(collection(db, 'user_notifications'), {
        userId: memberUser.uid,
        memberId: memberUser.memberId || '',
        title: '❌ সঞ্চয় বন্ধের আবেদন বাতিল',
        message: `আপনার সঞ্চয় বন্ধের আবেদনটি এডমিন কর্তৃক বাতিল করা হয়েছে এবং সঞ্চয় সচল রাখা হয়েছে।\nকারণ: ${reason.trim()}`,
        body: `আপনার সঞ্চয় বন্ধের আবেদনটি এডমিন কর্তৃক বাতিল করা হয়েছে এবং সঞ্চয় সচল রাখা হয়েছে।\nকারণ: ${reason.trim()}`,
        isPersonal: true,
        read: false,
        type: 'samity',
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        createdAt: serverTimestamp()
      });

      alert(`✅ আবেদন বাতিল সম্পন্ন হয়েছে এবং সদস্যকে অবহিত করা হয়েছে।`);
    } catch (err: any) {
      alert("বাতিল করতে সমস্যা হয়েছে: " + (err.message || err));
    }
  };

  return (
    <>
        {adminTab === 'samity' && (
          <div className="space-y-4 animate-fade-in text-slate-800 font-sans">
            <SamityScreen
              user={currentUser}
              allUsers={users}
              onBack={() => setViewingGrid(true)}
              syncLiveProfile={() => {}}
              setActiveTab={() => {}}
              setModalType={(type) => { if (!type) setViewingGrid(true); }}
              appConfig={appConfig}
              allNotices={notices}
            />
          </div>
        )}

        {adminTab === 'general' && (
          <div className="space-y-2.5 animate-fade-in text-slate-800 font-sans text-left pb-96 sm:pb-[480px]">
            {/* 1. Header Title Banner with Quick Controls - Slim & High-Density */}
            <div className="bg-gradient-to-r from-teal-700 via-emerald-800 to-teal-900 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-white relative overflow-hidden shadow-xs border border-teal-600/60">
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 bg-teal-500/20 text-teal-200 border border-teal-500/30 px-2 py-0.2 rounded-full text-[9.5px] font-bold">
                      👥 সদস্য ডিরেক্টরি ও নিয়ন্ত্রণ
                    </span>
                    <h2 className="text-xs sm:text-sm font-black text-white leading-tight">
                      সমিতি সদস্য ডিরেক্টরি খাতা ও নিয়ন্ত্রণ প্যানেল
                    </h2>
                  </div>
                  <p className="text-[10px] text-teal-100/90 truncate">
                    সকল সদস্যের তথ্য, চার ডিজিটের পিন, ওয়ালেট ব্যালেন্স ও ক্যাটাগরি সরাসরি সংশোধন করুন।
                  </p>
                </div>

                {/* 🚀 Header Quick Actions (Waiver & Policy) - Slim Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                  {(() => {
                    const now = new Date();
                    const curYear = now.getFullYear();
                    const curMonthDef = BENGALI_MONTH_DEFS[now.getMonth()];
                    const isCurExempt = isMonthExemptedInConfig(curYear, curMonthDef?.key || '08');
                    const curMonthCfg = getMonthExemptConfig(curYear, curMonthDef?.key || '08');
                    const exemptDay = curMonthCfg.exemptUntilDay || policyFormState?.penaltyExemptionUntilDay || (isCurExempt ? 31 : 9);
                    const dayLabel = exemptDay === 31 ? 'পুরো মাস' : `${exemptDay}ই পর্যন্ত`;

                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickPenaltyDay(exemptDay > 9 ? exemptDay : 15);
                          setQuickPenaltyNote(curMonthCfg.note || policyFormState?.penaltyExemptionNote || '');
                          setIsQuickPenaltyModalOpen(true);
                        }}
                        className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5 border active:scale-95 ${
                          isCurExempt
                            ? 'bg-amber-400 text-slate-950 border-amber-300 ring-1 ring-amber-300/40'
                            : 'bg-teal-950/70 hover:bg-teal-900 text-amber-200 border-teal-500/60'
                        }`}
                        title="জরিমানা স্থগিতের তারিখ পরিবর্তন করুন"
                      >
                        <span>🛡️</span>
                        <span>{isCurExempt ? `🟢 ${dayLabel} জরিমানা স্থগিত` : `🔴 জরিমানা স্বাভাবিক (9ই)`}</span>
                        <span className="text-[9px] bg-black/20 px-1 py-0.2 rounded font-bold">⚙️</span>
                      </button>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => setIsPolicyModalOpen(true)}
                    className="flex-1 sm:flex-initial px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-lg text-[10.5px] font-black shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-300/40 active:scale-95"
                    title="সমিতির নিয়ম-কানুন ও পলিসি ওপেন করুন"
                  >
                    <span>📜</span>
                    <span>নিয়ম-কানুন পলিসি</span>
                    <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded-full font-mono">এডিট</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. ⚙️ গ্লোবাল সদস্য তথ্য নিজস্ব আপডেট সুইচ (Member Profile Self-Edit Switch) - Slim Bar */}
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-emerald-50 border border-amber-200/90 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 text-left">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm">⚙️</span>
                  <h3 className="text-[11px] sm:text-xs font-black text-slate-900">
                    সদস্যদের নিজ প্রোফাইল তথ্য সংশোধন পাওয়ার সুইচ
                  </h3>
                  <span className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                    cfgAllowProfileSelfEdit 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}>
                    {cfgAllowProfileSelfEdit ? '🟢 অন (ON)' : '🔴 অফ (OFF)'}
                  </span>
                </div>
                <p className="text-[9.5px] sm:text-[10px] text-slate-600 truncate">
                  {cfgAllowProfileSelfEdit 
                    ? 'অন থাকায় সদস্যরা প্রোফাইল থেকে নাম, এনআইডি, ঠিকানা, ছবি ও নমিনি নিজেরা পরিবর্তন করতে পারবে।'
                    : 'অফ থাকায় সদস্যরা নিজেরা কোনো তথ্য এডিট করতে পারবে না (শুধুমাত্র এডমিন এডিট করতে পারবে)।'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleProfileSelfEdit(!cfgAllowProfileSelfEdit)}
                className={`w-full sm:w-auto px-3 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer shrink-0 shadow-2xs flex items-center justify-center gap-1 ${
                  cfgAllowProfileSelfEdit
                    ? 'bg-rose-600 hover:bg-rose-700 active:scale-95 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white'
                }`}
              >
                <span>{cfgAllowProfileSelfEdit ? '🔒 অফ করুন (Disable)' : '🔓 অন করুন (Enable)'}</span>
              </button>
            </div>

            {/* 3. 🌟 8-Category Member Statistics & Control Hub (১ লাইনে ৪টি করে মোট ৮টি সেকশন) - Slim Grid */}
            {(() => {
              const isSubAdminUser = (u: any) => Boolean(
                u.role === 'sub_admin' ||
                (Array.isArray(u.subAdminPermissions) && u.subAdminPermissions.length > 0) ||
                u.isSubAdmin === true
              );

              const isInvestorUser = (u: any) => Boolean(
                u.memberCategory === 'investor' ||
                u.memberGroup === 'investor' ||
                u.isInvestor === true ||
                u.role === 'investor' ||
                (Array.isArray(u.investments) && u.investments.length > 0) ||
                u.investorApproved === true
              );

              const isSamityMemberUser = (u: any) => Boolean(
                u.samityApproved === true ||
                u.samityStatus === 'approved' ||
                u.isSamityMember === true ||
                (Number(u.savings) > 0) ||
                u.memberCategory === 'shareholder' ||
                u.memberGroup === 'shareholder' ||
                u.memberGroup === 'samity'
              );

              const isSwitchOffUser = (u: any) => Boolean(
                u.samityAutoSavingsActive === false ||
                u.samityDeactivateStatus === 'self_opted_out' ||
                u.samitySwitchStatus === 'OFF'
              );

              const isSwitchOnUser = (u: any) => Boolean(
                (u.samityAutoSavingsActive === true || u.samitySwitchStatus === 'ON' || u.samityDeactivateStatus === 'active') &&
                isSamityMemberUser(u)
              );

              const isResetRequestedUser = (u: any) => Boolean(
                u.appLockResetRequested === true ||
                u.appLockResetStatus === 'pending' ||
                u.forgotPinRequested === true ||
                u.pinResetRequested === true ||
                (u.isAppLocked && (u.appLockResetStatus === 'pending' || u.appLockResetRequested === true))
              );

              const subAdminUsers = users.filter(isSubAdminUser);
              const investorUsers = users.filter(u => isInvestorUser(u) && !isSubAdminUser(u));
              const samityShareholderUsers = users.filter(u => isSamityMemberUser(u) && !isInvestorUser(u) && !isSubAdminUser(u));
              const generalAppUsers = users.filter(u => !isSamityMemberUser(u) && !isInvestorUser(u) && !isSubAdminUser(u) && u.role !== 'admin');
              const switchOffUsers = users.filter(isSwitchOffUser);
              const switchOnUsers = users.filter(isSwitchOnUser);
              const appLockResetUsers = users.filter(isResetRequestedUser);
              const totalSwitchOffRefundAmount = switchOffUsers.reduce((sum, u) => sum + (Number(u.savings) || 0) + (Number(u.samityBalance) || 0), 0);

              return (
                <div className="bg-slate-900 border border-slate-800 p-2 sm:p-2.5 rounded-xl text-white space-y-1.5 shadow-md">
                  {/* Hub Header - Slim 1-line */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <h3 className="text-[11px] sm:text-xs font-bold text-slate-200 truncate">
                        📊 সদস্য ক্যাটাগরি ও রিকোয়েস্ট হাব (১ লাইনে ৪টি করে ৮টি সেকশন)
                      </h3>
                    </div>

                    {appLockResetUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab('reset_requests')}
                        className="bg-rose-950 hover:bg-rose-900 border border-rose-500/60 px-2 py-0.5 rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs transition animate-pulse shrink-0"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                        <span className="text-[10px] font-black text-rose-200">
                          🔒 {appLockResetUsers.length}টি রিসেট রিকোয়েস্ট!
                        </span>
                      </button>
                    )}
                  </div>

                  {/* 8 Sections STRICTLY in 4-per-row grid (Row 1: 4 Cards, Row 2: 4 Cards) */}
                  <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                    {/* 1. সর্বমোট সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('all')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'all'
                          ? 'bg-slate-800 border-slate-500 text-white shadow-xs ring-1 ring-emerald-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className={`text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate ${
                          generalMemberFilterTab === 'all' ? 'text-emerald-300' : 'text-slate-400'
                        }`}>
                          🌐 সর্বমোট সদস্য
                        </span>
                        {generalMemberFilterTab === 'all' && (
                          <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-white font-mono truncate">
                        {users.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-slate-400 truncate">
                        সকল নিবন্ধিত
                      </p>
                    </button>

                    {/* 2. সমিতি / শেয়ার সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('samity')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'samity'
                          ? 'bg-emerald-950 border-emerald-500 text-white shadow-xs ring-1 ring-emerald-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-emerald-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className={`text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate ${
                          generalMemberFilterTab === 'samity' ? 'text-emerald-300' : 'text-emerald-400'
                        }`}>
                          👥 সমিতি / শেয়ার
                        </span>
                        {generalMemberFilterTab === 'samity' && (
                          <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-emerald-300 font-mono truncate">
                        {samityShareholderUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-emerald-400/80 truncate">
                        শেয়ার ও সঞ্চয়ী
                      </p>
                    </button>

                    {/* 3. 🔴 সুইচ অফ সদস্য (রিফান্ড ফান্ড সহ) */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('switch_off')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'switch_off'
                          ? 'bg-rose-950 border-rose-500 text-white shadow-xs ring-1 ring-rose-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-rose-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-rose-300">
                          🔴 সুইচ অফ
                        </span>
                        <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-rose-200 font-mono truncate">
                        {switchOffUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-rose-400/80 truncate">
                        ৳{totalSwitchOffRefundAmount.toLocaleString('bn-BD')} রিফান্ড
                      </p>
                    </button>

                    {/* 4. 🟢 সুইচ অন সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('switch_on')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'switch_on'
                          ? 'bg-teal-950 border-teal-500 text-white shadow-xs ring-1 ring-teal-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-teal-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-teal-300">
                          🟢 সুইচ অন
                        </span>
                        <span className="w-1 h-1 rounded-full bg-teal-400 animate-pulse shrink-0" />
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-teal-200 font-mono truncate">
                        {switchOnUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-teal-400/80 truncate">
                        নিয়মিত সঞ্চয়ী
                      </p>
                    </button>

                    {/* 5. 🌱 সাধারণ সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('general')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'general'
                          ? 'bg-sky-950 border-sky-500 text-white shadow-xs ring-1 ring-sky-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-sky-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-sky-300">
                          🌱 সাধারণ সদস্য
                        </span>
                        {generalMemberFilterTab === 'general' && (
                          <span className="w-1 h-1 rounded-full bg-sky-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-sky-200 font-mono truncate">
                        {generalAppUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-sky-400/80 truncate">
                        ফ্রি/বেসিক
                      </p>
                    </button>

                    {/* 6. 💼 ইনভেস্টর সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('investor')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'investor'
                          ? 'bg-amber-950 border-amber-500 text-white shadow-xs ring-1 ring-amber-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-amber-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-amber-300">
                          💼 ইনভেস্টর
                        </span>
                        {generalMemberFilterTab === 'investor' && (
                          <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-amber-200 font-mono truncate">
                        {investorUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-amber-400/80 truncate">
                        কোম্পানি পার্টনার
                      </p>
                    </button>

                    {/* 7. 🛡️ সাব এডমিন */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('sub_admin')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'sub_admin'
                          ? 'bg-purple-950 border-purple-500 text-white shadow-xs ring-1 ring-purple-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-purple-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-purple-300">
                          🛡️ সাব এডমিন
                        </span>
                        {generalMemberFilterTab === 'sub_admin' && (
                          <span className="w-1 h-1 rounded-full bg-purple-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-purple-200 font-mono truncate">
                        {subAdminUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-purple-400/80 truncate">
                        অ্যাসাইনড এডমিন
                      </p>
                    </button>

                    {/* 8. 🔒 পাসওয়ার্ড / পিন রিসেট */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('reset_requests')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'reset_requests'
                          ? 'bg-rose-950 border-rose-400 text-white shadow-xs ring-1 ring-rose-400'
                          : appLockResetUsers.length > 0
                          ? 'bg-rose-950/90 border-rose-500/60 text-rose-200 animate-pulse'
                          : 'bg-slate-950/70 border-slate-800 hover:border-rose-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-rose-300">
                          🔒 পাসওয়ার্ড/পিন
                        </span>
                        {appLockResetUsers.length > 0 ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping shrink-0" />
                        ) : (
                          <span className="text-[8px] text-slate-500 shrink-0">০</span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-rose-300 font-mono truncate">
                        {appLockResetUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-rose-400/90 truncate">
                        রিসেট রিকোয়েস্ট
                      </p>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 4. ⏳ পেন্ডিং সমবায় সদস্য আবেদনপত্র দ্রুত নিয়ন্ত্রণ বক্স - Slim Box */}
            {(() => {
              const samityPendingUsers = users.filter(u => u.samityStatus === 'pending' || u.approved === false);
              const totalPendingCount = samityPendingUsers.length;
              if (totalPendingCount === 0) return null;

              return (
                <div className="bg-gradient-to-r from-teal-900/90 via-slate-900 to-teal-950 border border-teal-500/80 p-3 sm:p-3.5 rounded-2xl text-white space-y-2 shadow-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-teal-500/30 pb-2">
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-teal-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                        ⏳ সদস্য অ্যাকাউন্ট ও আবেদন অপেক্ষমান ({totalPendingCount} জন)
                      </h3>
                      <p className="text-[10px] text-teal-100/80">
                        নতুন সদস্যদের মেম্বারশিপ আবেদন রিভিউয়ের অপেক্ষায় রয়েছে।
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdminTab('approvals')}
                      className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-[11px] rounded-lg transition cursor-pointer shadow-xs shrink-0"
                    >
                      🚀 সকল আবেদন দেখুন
                    </button>
                  </div>

                  {/* Pending Users List */}
                  {samityPendingUsers.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                      {samityPendingUsers.slice(0, 6).map((pu, idx) => (
                        <div key={`${pu.uid}-${idx}`} className="bg-slate-900/80 border border-teal-500/30 p-2.5 rounded-xl flex flex-col justify-between gap-2">
                          <div className="space-y-0.5 text-left min-w-0">
                            <div className="flex justify-between items-center gap-1">
                              <h5 className="text-xs font-black text-white truncate">{pu.name}</h5>
                              <span className="text-[8.5px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30 px-1.5 py-0.2 rounded font-bold">
                                {pu.memberId || 'N/A'}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-slate-300 font-mono">📱 {pu.phone}</p>
                          </div>
                          <div className="flex gap-1.5 border-t border-slate-800 pt-1.5">
                            <button
                              type="button"
                              onClick={() => handleApproveUserAccount(pu)}
                              className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] rounded-lg transition cursor-pointer"
                            >
                              ✓ অনুমোদন
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectUserAccount(pu)}
                              className="px-2 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/40 text-[10.5px] font-bold rounded-lg transition cursor-pointer"
                            >
                              ❌ বাতিল
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 5. Header controls for Manual Member Registration Toggle & Serial ID Resequence - Slim Bar */}
            <div className="bg-white border border-slate-150 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <span>📌 সদস্য সিরিয়াল ও রেজিষ্ট্রেশন কন্ট্রোল</span>
                </h4>
                <p className="text-[10px] text-slate-500 truncate">
                  সদস্যদের সিরিয়াল আইডি 1 থেকে পরপর (AMB00000001 - 1,00,000) সুবিন্যস্ত রাখুন বা নতুন সদস্য যোগ করুন।
                </p>
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  disabled={isResequencing}
                  onClick={handleResequenceAllMemberIds}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-1 disabled:opacity-50"
                  title="সকল সদস্যের সিরিয়াল নম্বর 1 থেকে পরপর ঠিক করুন"
                >
                  <RefreshCw className={`w-3 h-3 ${isResequencing ? 'animate-spin' : ''}`} />
                  {isResequencing ? 'ফিক্স হচ্ছে...' : '🔢 সিরিয়াল 1 থেকে ঠিক করুন'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddMemberForm(!showAddMemberForm)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                    showAddMemberForm
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                      : 'bg-[#00a884] hover:bg-[#009675] text-white shadow-xs active:scale-95'
                  }`}
                >
                  {showAddMemberForm ? '✕ ফর্ম বন্ধ' : '➕ নতুন সদস্য নিবন্ধন'}
                </button>
              </div>
            </div>

            {/* Collapsing New Member Registration Form */}
            {showAddMemberForm && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 animate-fade-in">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                    👥 নতুন সমবায় সদস্য ম্যানুয়াল রেজিষ্ট্রেশন
                  </h3>
                  <p className="text-[10px] text-slate-500">মেম্বার আইডি, মোবাইল নম্বর, 4 ডিজিটের পিন ও প্রারম্ভিক শেয়ার সঞ্চয় দিয়ে সরাসরি যুক্ত করুন।</p>
                </div>

                {regSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-[#00a884] text-xs p-2.5 rounded-xl font-bold">
                    {regSuccess}
                  </div>
                )}
                {regError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-2.5 rounded-xl font-bold">
                    {regError}
                  </div>
                )}

                <form onSubmit={handleManualMemberRegistration} className="space-y-3">
                  {/* Row 1: Name, Phone, PIN */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">সদস্যের নাম (বাংলায়/ইংরেজিতে)</label>
                      <input
                        type="text"
                        required
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="যেমন: মোঃ রাজিব আহমেদ"
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">মোবাইল নাম্বার (11 ডিজিট)</label>
                      <input
                        type="tel"
                        required
                        maxLength={11}
                        value={newMemberPhone}
                        onChange={(e) => setNewMemberPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="017XXXXXXXX"
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">4 ডিজিটের সিকিউরিটি পিন</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={newMemberPin}
                        onChange={(e) => setNewMemberPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="XXXX"
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 text-center tracking-widest outline-none focus:border-[#00a884]"
                      />
                    </div>
                  </div>

                  {/* Row 2: Member ID Normalization & Groups */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">সদস্য আইডি (AMB ফরম্যাট)</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          required
                          value={newMemberId}
                          onChange={(e) => setNewMemberId(e.target.value.toUpperCase())}
                          placeholder="AMB00000001"
                          className="flex-1 bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-850 outline-none focus:border-[#00a884]"
                        />
                        <button
                          type="button"
                          onClick={autoGenerateMemberId}
                          className="px-2.5 bg-teal-50 hover:bg-teal-100 text-[#00a884] border border-teal-200 text-[11px] font-black rounded-xl transition cursor-pointer"
                        >
                          অটো
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">অ্যাকাউন্ট ক্যাটাগরি রোল</label>
                      <select
                        value={newRole}
                        onChange={(e: any) => setNewRole(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      >
                        <option value="user">USER (কো-অপারেটিভ সাধারণ সদস্য)</option>
                        <option value="admin">ADMIN (মাস্টার ডিরেক্টর/পরিচালক)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">সদস্য গ্রুপ ক্যাটাগরি</label>
                      <select
                        value={newMemberGroup}
                        onChange={(e: any) => setNewMemberGroup(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      >
                        <option value="general">সাধারণ সদস্য (5,000 টাকা লোন ক্যাটাগরি)</option>
                        <option value="admin">ভিআইপি গ্রুপ (বিশেষ ক্যাটাগরি লোন)</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Initial Balances */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">মেইন ওয়ালেট (৳)</label>
                      <input
                        type="number"
                        value={newMainsBal}
                        onChange={(e) => setNewMainsBal(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">টেলিকম ব্যালেন্স (৳)</label>
                      <input
                        type="number"
                        value={newTelBal}
                        onChange={(e) => setNewTelBal(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">সুপার শপ ব্যালেন্স (৳)</label>
                      <input
                        type="number"
                        value={newShopBal}
                        onChange={(e) => setNewShopBal(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">শেয়ার সঞ্চয়/DPS (৳)</label>
                      <input
                        type="number"
                        value={newSavings}
                        onChange={(e) => setNewSavings(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">বকেয়া ঋণ স্থিতি (৳)</label>
                      <input
                        type="number"
                        value={newDueLoan}
                        onChange={(e) => setNewDueLoan(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 text-red-700"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMemberForm(false);
                        setRegSuccess('');
                        setRegError('');
                      }}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black rounded-lg transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#00a884] hover:bg-[#009675] text-white text-xs font-black rounded-lg shadow-xs transition cursor-pointer"
                    >
                      নিশ্চিত মেম্বারশিপ এড করুন
                    </button>
                  </div>
                </form>
              </div>
            )}
            {/* Filter and Search Section for Directory */}
            {(() => {
              const isSamityMemberUser = (u: any) => Boolean(
                u.samityApproved === true ||
                u.samityStatus === 'approved' ||
                u.isSamityMember === true
              );

              const samityRegisteredCount = users.filter(isSamityMemberUser).length;
              const generalAppCount = users.filter(u => !isSamityMemberUser(u) && u.samityStatus !== 'pending' && u.approved !== false).length;
              const samityPendingCount = users.filter(u => u.samityStatus === 'pending' || u.approved === false).length;

              return (
                <div className="bg-white border border-slate-150 rounded-3xl p-4.5 space-y-4 pb-96 sm:pb-[480px]">

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="w-full sm:flex-1 relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={generalMemberSearch}
                        onChange={(e) => setGeneralMemberSearch(e.target.value)}
                        onFocus={(e) => {
                          setTimeout(() => {
                            e.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 250);
                        }}
                        placeholder="সদস্যের নাম, মোবাইল নাম্বার অথবা মেম্বার আইডি (যেমন: AMB00000030) দিয়ে খুঁজুন..."
                        className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-[#00a884] focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none transition shadow-2xs"
                      />
                      {generalMemberSearch && (
                        <button
                          type="button"
                          onClick={() => setGeneralMemberSearch('')}
                          className="absolute right-2.5 top-2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                          title="সার্চ মুছুন"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">সাজান:</span>
                      <select
                        value={memberSortOrder}
                        onChange={(e: any) => setMemberSortOrder(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-[#00a884] cursor-pointer"
                      >
                        <option value="id_asc">🔢 সিরিয়াল নম্বর (1 ➔ N)</option>
                        <option value="id_desc">🔢 উল্টো সিরিয়াল (N ➔ 1)</option>
                        <option value="newest">🕒 নতুন নিবন্ধন প্রথম</option>
                        <option value="balance_desc">💰 মোট ব্যালেন্স অনুযায়ী</option>
                      </select>
                    </div>
                  </div>

                  {/* Members Grid/List - Sleek, Slim & Compact */}
                  <div className="space-y-2">
                    {(() => {
                      const isSubAdminUser = (u: any) => Boolean(
                        u.role === 'sub_admin' ||
                        (Array.isArray(u.subAdminPermissions) && u.subAdminPermissions.length > 0) ||
                        u.isSubAdmin === true
                      );

                      const isInvestorUser = (u: any) => Boolean(
                        u.memberCategory === 'investor' ||
                        u.memberGroup === 'investor' ||
                        u.isInvestor === true ||
                        u.role === 'investor' ||
                        (Array.isArray(u.investments) && u.investments.length > 0) ||
                        u.investorApproved === true
                      );

                      const isSamityMemberUser = (u: any) => Boolean(
                        u.samityApproved === true ||
                        u.samityStatus === 'approved' ||
                        u.isSamityMember === true ||
                        (Number(u.savings) > 0) ||
                        u.memberCategory === 'shareholder' ||
                        u.memberGroup === 'shareholder' ||
                        u.memberGroup === 'samity'
                      );

                      const isSwitchOffUser = (u: any) => Boolean(
                        u.samityAutoSavingsActive === false ||
                        u.samityDeactivateStatus === 'self_opted_out' ||
                        u.samitySwitchStatus === 'OFF'
                      );

                      const isSwitchOnUser = (u: any) => Boolean(
                        (u.samityAutoSavingsActive === true || u.samitySwitchStatus === 'ON' || u.samityDeactivateStatus === 'active') &&
                        isSamityMemberUser(u)
                      );

                      const isResetRequestedUser = (u: any) => Boolean(
                        u.appLockResetRequested === true ||
                        u.appLockResetStatus === 'pending' ||
                        u.forgotPinRequested === true ||
                        u.pinResetRequested === true ||
                        (u.isAppLocked && (u.appLockResetStatus === 'pending' || u.appLockResetRequested === true))
                      );

                      const totalSwitchOffRefundAmount = users
                        .filter(isSwitchOffUser)
                        .reduce((sum, u) => sum + (Number(u.savings) || 0) + (Number(u.samityBalance) || 0), 0);

                      const filtered = users
                        .filter((u) => {
                          const isSubAdmin = isSubAdminUser(u);
                          const isInvestor = isInvestorUser(u);
                          const isSamity = isSamityMemberUser(u);
                          const isSwOff = isSwitchOffUser(u);
                          const isSwOn = isSwitchOnUser(u);
                          const isResetReq = isResetRequestedUser(u);

                          if (generalMemberFilterTab === 'reset_requests' && !isResetReq) return false;
                          if (generalMemberFilterTab === 'switch_off' && !isSwOff) return false;
                          if (generalMemberFilterTab === 'switch_on' && !isSwOn) return false;
                          if (generalMemberFilterTab === 'sub_admin' && !isSubAdmin) return false;
                          if (generalMemberFilterTab === 'investor' && !isInvestor) return false;
                          if (generalMemberFilterTab === 'samity' && !isSamity) return false;
                          if (generalMemberFilterTab === 'general' && (isSamity || isInvestor || isSubAdmin || u.role === 'admin')) return false;

                          if (!generalMemberSearch.trim()) return true;
                          const q = generalMemberSearch.toLowerCase();
                          return (
                            (u.name || '').toLowerCase().includes(q) ||
                            (u.phone || '').includes(q) ||
                            (u.memberId || '').toLowerCase().includes(q)
                          );
                        })
                        .sort((a, b) => {
                          if (memberSortOrder === 'id_asc') {
                            const numA = parseInt((a.memberId || '').replace(/\D/g, ''), 10) || 0;
                            const numB = parseInt((b.memberId || '').replace(/\D/g, ''), 10) || 0;
                            return numA - numB;
                          } else if (memberSortOrder === 'id_desc') {
                            const numA = parseInt((a.memberId || '').replace(/\D/g, ''), 10) || 0;
                            const numB = parseInt((b.memberId || '').replace(/\D/g, ''), 10) || 0;
                            return numB - numA;
                          } else if (memberSortOrder === 'newest') {
                            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                            return timeB - timeA;
                          } else {
                            const valA = (Number(a.balance) || 0) + (Number(a.savings) || 0) + (Number(a.telecomBalance) || 0) + (Number(a.superShopBalance) || 0);
                            const valB = (Number(b.balance) || 0) + (Number(b.savings) || 0) + (Number(b.telecomBalance) || 0) + (Number(b.superShopBalance) || 0);
                            return valB - valA;
                          }
                        });

                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-10 text-slate-400">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-xs font-black">নির্ধারিত ক্যাটাগরিতে কোনো সদস্য পাওয়া যায়নি!</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          {/* 📢 Contextual Banner for Switch OFF (25 Dec Refund) */}
                          {generalMemberFilterTab === 'switch_off' && (
                            <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-amber-950/90 border border-amber-500/40 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-white shadow-lg">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-amber-400 text-xl shrink-0">🛡️</span>
                                <div>
                                  <h4 className="font-black text-amber-300 text-xs sm:text-sm">
                                    ২৫শে ডিসেম্বর রিফান্ড ফান্ড পলিসি ও সুইচ অফ সদস্য তালিকা
                                  </h4>
                                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                                    সুইচ অফ সদস্যদের জমাকৃত মোট <strong className="text-amber-300">৳{totalSwitchOffRefundAmount.toLocaleString('bn-BD')}</strong> টাকা আগামী <strong>২৫শে ডিসেম্বর</strong> কোনো প্রকার ফি ছাড়াই স্ব-স্ব মেইন ওয়ালেটে স্বয়ংক্রিয়ভাবে রিফান্ড প্রদান করা হবে।
                                  </p>
                                </div>
                              </div>
                              <div className="bg-slate-950/90 border border-amber-500/40 px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-2">
                                <span className="text-[10px] text-amber-400 font-bold uppercase">মোট রিফান্ড তহবিলঃ</span>
                                <span className="text-sm font-black text-amber-300 font-mono">৳{totalSwitchOffRefundAmount.toLocaleString('bn-BD')}</span>
                              </div>
                            </div>
                          )}

                          {/* 📢 Contextual Banner for Password/PIN Reset Requests */}
                          {generalMemberFilterTab === 'reset_requests' && (
                            <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-950/90 border border-rose-500/50 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-white shadow-lg">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-rose-400 text-xl shrink-0">🔒</span>
                                <div>
                                  <h4 className="font-black text-rose-300 text-xs sm:text-sm">
                                    পাসওয়ার্ড / পিন ও অ্যাপ লক রিসেট রিকোয়েস্ট তালিকা
                                  </h4>
                                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                                    যেসব সদস্য পাসওয়ার্ড বা পিন ভুলে গিয়ে অ্যাপ লক আনলকের রিকোয়েস্ট পাঠিয়েছেন তাদের তালিকা নিচে প্রদর্শিত হচ্ছে।
                                  </p>
                                </div>
                              </div>
                              <div className="bg-slate-950/90 border border-rose-500/50 px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-2">
                                <span className="text-[10px] text-rose-300 font-bold uppercase">অপেক্ষমান রিকোয়েস্টঃ</span>
                                <span className="text-sm font-black text-rose-200 font-mono">{filtered.length} জন</span>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                          {filtered.map((u, idx) => {
                            const isAgentUser = Boolean(u.role === 'agent' || (u as any).isAgent || (u as any).agentApproved || adminAgentRequests.some(r => r.phone === u.phone && r.status === 'approved'));
                            const isSamityUser = isSamityMemberUser(u);
                            const isPendingUser = u.samityStatus === 'pending' || u.approved === false;

                            let cardTheme = 'bg-sky-50/60 hover:bg-sky-50/90 border-sky-200 hover:border-sky-400 border-l-4 border-l-sky-600 shadow-2xs';
                            let idBadgeTheme = 'bg-sky-700 text-white';
                            let avatarTheme = 'bg-sky-100 text-sky-900 border-sky-300';

                            if (isAgentUser) {
                              cardTheme = 'bg-amber-50/60 hover:bg-amber-50/90 border-amber-200 hover:border-amber-400 border-l-4 border-l-amber-600 shadow-2xs';
                              idBadgeTheme = 'bg-amber-700 text-white';
                              avatarTheme = 'bg-amber-100 text-amber-900 border-amber-300';
                            } else if (isSamityUser) {
                              cardTheme = 'bg-emerald-50/60 hover:bg-emerald-50/90 border-emerald-200 hover:border-emerald-400 border-l-4 border-l-emerald-600 shadow-2xs';
                              idBadgeTheme = 'bg-emerald-700 text-white';
                              avatarTheme = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                            } else if (isPendingUser) {
                              cardTheme = 'bg-orange-50/60 hover:bg-orange-50/90 border-orange-200 hover:border-orange-400 border-l-4 border-l-orange-500 shadow-2xs';
                              idBadgeTheme = 'bg-orange-700 text-white';
                              avatarTheme = 'bg-orange-100 text-orange-900 border-orange-300';
                            }

                            return (
                              <div 
                                key={`${u.uid}-${idx}`} 
                                className={`rounded-2xl p-2.5 sm:p-3 transition-all duration-150 flex flex-col justify-between gap-2 ${cardTheme}`}
                              >
                                {/* Top Header Info */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {/* Avatar */}
                                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center font-black text-xs shrink-0 overflow-hidden ${avatarTheme}`}>
                                      {u.profilePic ? (
                                        <img src={u.profilePic} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        (u.name || 'M').charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <div className="min-w-0 text-left">
                                      <h4 className="font-black text-xs sm:text-sm text-slate-900 leading-tight truncate">{u.name || u.phone || u.memberId || 'সম্মানিত সদস্য'}</h4>
                                      <span className="text-[10px] text-slate-600 font-extrabold font-mono block tracking-tight mt-0.5">{u.phone}</span>
                                      
                                      {/* Membership Type & GPS Badges */}
                                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                        {isAgentUser ? (
                                          <span className="text-[8.5px] font-black bg-amber-600 text-white border border-amber-700 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            ⭐ এজেন্ট / প্রতিনিধি
                                          </span>
                                        ) : isSamityUser ? (
                                          <span className="text-[8.5px] font-black bg-emerald-600 text-white border border-emerald-700 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            🏢 সমবায় সমিতি সদস্য (ফরম ফিলাপকৃত)
                                          </span>
                                        ) : isPendingUser ? (
                                          <span className="text-[8.5px] font-black bg-orange-600 text-white border border-orange-700 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            ⏳ সমিতি আবেদন পেন্ডিং
                                          </span>
                                        ) : (
                                          <span className="text-[8.5px] font-black bg-sky-600 text-white border border-sky-700 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            📱 নরমাল সদস্য (BNB কোম্পানি ইনভেস্টার)
                                          </span>
                                        )}

                                        {((u.latitude || (u as any).lat) && (u.longitude || (u as any).lng)) ? (() => {
                                          const latNum = Number(u.latitude || (u as any).lat);
                                          const lngNum = Number(u.longitude || (u as any).lng);
                                          const isOldDefaultDhaka = Math.abs(latNum - 23.8103) < 0.0001 && Math.abs(lngNum - 90.4125) < 0.0001;
                                          const locText = u.fullAddress || (u as any).lastLocation;

                                          return (
                                            <div className="flex flex-col gap-0.5">
                                              <span className={`text-[8.5px] font-mono font-black px-1.5 py-0.5 rounded inline-flex items-center gap-1 border shadow-2xs ${
                                                isOldDefaultDhaka 
                                                  ? 'bg-amber-50 text-amber-800 border-amber-300' 
                                                  : 'bg-emerald-50 text-emerald-850 border-emerald-300'
                                              }`}>
                                                <span>{isOldDefaultDhaka ? '📍' : '🟢'}</span> 
                                                <span className="font-extrabold">{latNum.toFixed(6)}, {lngNum.toFixed(6)}</span>
                                                <a
                                                  href={`https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-teal-700 hover:underline font-black ml-0.5"
                                                >
                                                  (গুগল ম্যাপে ↗)
                                                </a>
                                              </span>
                                              {locText && !isOldDefaultDhaka && (
                                                <span className="text-[8px] font-bold text-slate-600 truncate max-w-[200px]">
                                                  📍 {locText}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })() : null}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Status & ID Badges */}
                                  <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                    {u.uid === 'admin_master' || u.phone === '+8800011112222' || u.memberId === 'MAIN_ADMIN' ? (
                                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md inline-block uppercase leading-none font-mono shadow-2xs bg-purple-700 text-white">
                                        👑 মেইন এডমিন
                                      </span>
                                    ) : (
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md inline-block uppercase leading-none font-mono shadow-2xs ${idBadgeTheme}`}>
                                        ID: {u.memberId || 'N/A'}
                                      </span>
                                    )}
                                    <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded ${
                                      u.status === 'active' 
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                                    } uppercase`}>
                                      {u.status === 'active' ? '🔴 সচল' : '⚪ নিষ্ক্রিয়'}
                                    </span>
                                  </div>
                                </div>

                                {/* Quick Wallet Balances Panel */}
                                <div className="bg-white/90 border border-slate-200/80 rounded-xl p-2 grid grid-cols-3 gap-1 text-center shadow-2xs">
                                  <div>
                                    <span className="text-[8.5px] font-bold text-slate-500 block uppercase leading-none">
                                      মেইন ওয়ালেট
                                    </span>
                                    <span className="text-xs font-black text-slate-900 block mt-0.5">৳{getUserMainWalletBalance(u).toLocaleString('bn-BD')}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8.5px] font-bold text-slate-500 block uppercase leading-none">শেয়ার সঞ্চয়</span>
                                    <span className="text-xs font-black text-emerald-700 block mt-0.5">৳{(u.savings || 0).toLocaleString('bn-BD')}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8.5px] font-bold text-slate-500 block uppercase leading-none">বকেয়া ঋণ</span>
                                    <span className={`text-xs font-black block mt-0.5 ${u.dueLoan > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                      ৳{(u.dueLoan || 0).toLocaleString('bn-BD')}
                                    </span>
                                  </div>
                                </div>

                                {/* Secondary Balances */}
                                <div className="flex flex-wrap items-center gap-1 text-[9px] font-bold text-slate-600">
                                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded">
                                    📱 টেলিকমঃ ৳{(u.telecomBalance || 0).toLocaleString('bn-BD')}
                                  </span>
                                  <span className="bg-amber-50 border border-amber-100 text-amber-900 px-1.5 py-0.2 rounded">
                                    🛒 শপ ওয়ালেটঃ ৳{(u.superShopBalance || 0).toLocaleString('bn-BD')}
                                  </span>
                                  <span className="bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.2 rounded uppercase">
                                    🛡️ {u.role === 'admin' ? 'মাস্টার এডমিন' : u.role === 'sub_admin' ? 'ছাপ এডমিন' : 'কো-অপারেティブ সদস্য'}
                                  </span>
                                </div>

                                 {/* Samity Switch Status & Admin Action Box */}
                                 {(u.samityAutoSavingsActive === false || u.samityDeactivateStatus === 'self_opted_out' || u.samitySwitchStatus === 'OFF') ? (
                                   <div className="bg-gradient-to-r from-rose-950 via-slate-950 to-amber-950 border-2 border-rose-500/80 rounded-xl p-2.5 text-left space-y-2 text-white shadow-md">
                                     <div className="flex items-center justify-between flex-wrap gap-1">
                                       <span className="text-[11px] font-black text-rose-300 flex items-center gap-1.5">
                                         <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                                         ⏸️ সঞ্চয় বন্ধ ও টাকা উত্তোলন আবেদন
                                       </span>
                                       <span className="text-[10px] font-mono font-black text-amber-300 bg-black/40 px-2 py-0.5 rounded border border-amber-500/40">
                                         জমানো মোট: ৳{(Number(u.savings !== undefined ? u.savings : (u as any).dpsBalance) || 0).toLocaleString('bn-BD')} টাকা
                                       </span>
                                     </div>
                                     {u.samityOptOutReason && (
                                       <div className="bg-black/30 p-1.5 rounded-lg border border-amber-500/20 text-[10px] text-amber-200 leading-tight">
                                         <strong className="text-amber-400">📝 আবেদনের কারণ:</strong> "{u.samityOptOutReason}"
                                       </div>
                                     )}

                                     {/* 🚀 Interactive Action Buttons for Admin */}
                                     <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-rose-900/60">
                                       {(Number(u.savings !== undefined ? u.savings : (u as any).dpsBalance) || 0) > 0 ? (
                                         <>
                                           {/* Button 1: Refund to Main Wallet */}
                                           <button
                                             type="button"
                                             disabled={processingRefundUid === u.uid}
                                             onClick={() => handleApproveSamityRefund(u)}
                                             className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-1 disabled:opacity-50 active:scale-95"
                                             title="জমানো টাকা মেইন ওয়ালেটে রিফান্ড অনুমোদন করুন"
                                           >
                                             <span>✅ মেইন ব্যালেন্সে রিফান্ড অনুমোদন</span>
                                           </button>

                                           {/* Button 2: Cash Payout Settlement */}
                                           <button
                                             type="button"
                                             disabled={processingRefundUid === u.uid}
                                             onClick={() => handleApproveSamityCashPayout(u)}
                                             className="py-1.5 px-2 bg-amber-700 hover:bg-amber-600 text-amber-100 font-black text-[10.5px] rounded-lg transition cursor-pointer border border-amber-500/60 flex items-center justify-center gap-1 disabled:opacity-50 active:scale-95"
                                             title="সরাসরি ক্যাশ দিয়ে একাউন্ট সেটেল করুন"
                                           >
                                             <span>💵 ক্যাশ প্রদান ও সেটেল</span>
                                           </button>
                                         </>
                                       ) : (
                                         <div className="text-[10px] text-emerald-300 font-bold bg-emerald-950/60 px-2 py-1 rounded border border-emerald-700/60 flex items-center gap-1">
                                           <span>✓</span>
                                           <span>সঞ্চয় রিফান্ড / সেটেল সম্পন্ন হয়েছে (ব্যালেন্স ৳০)</span>
                                         </div>
                                       )}

                                       {/* Button 3: Reactivate Savings */}
                                       <button
                                         type="button"
                                         onClick={() => handleReactivateSamitySavings(u)}
                                         className="py-1.5 px-2 bg-sky-800 hover:bg-sky-700 text-white font-bold text-[10.5px] rounded-lg transition cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                                         title="পুনরায় অটো সঞ্চয় সচল করুন"
                                       >
                                         <span>🔄 পুনরায় চালু (ON)</span>
                                       </button>

                                       {/* Button 4: Reject request */}
                                       <button
                                         type="button"
                                         onClick={() => handleRejectSamityOptOut(u)}
                                         className="py-1.5 px-2 bg-rose-900 hover:bg-rose-800 text-rose-200 font-bold text-[10.5px] rounded-lg transition cursor-pointer border border-rose-700/60 active:scale-95"
                                         title="আবেদন বাতিল করুন"
                                       >
                                         <span>❌ বাতিল</span>
                                       </button>

                                       <a
                                         href={`tel:${u.phone}`}
                                         className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10.5px] rounded-lg transition cursor-pointer flex items-center gap-1"
                                       >
                                         <span>📞 কল</span>
                                       </a>
                                     </div>
                                   </div>
                                 ) : u.samityOptInReason ? (
                                   <div className="bg-teal-950/80 border border-teal-500/40 rounded-xl p-1.5 text-left text-teal-200 text-[9.5px]">
                                     <span className="font-bold text-teal-400">🔄 সচল কারণ:</span> "{u.samityOptInReason}"
                                   </div>
                                 ) : null}

                                {/* 🚨 পেন্ডিং পাসওয়ার্ড / পিন / অ্যাপ লক রিসেট বক্স */}
                                 {(u.appLockResetRequested || u.appLockResetStatus === 'pending' || u.forgotPinRequested || u.pinResetRequested) && (
                                   <div className="bg-gradient-to-r from-rose-950 to-slate-950 border-2 border-rose-500 rounded-xl p-2.5 text-white space-y-2 shadow-md">
                                     <div className="flex items-center justify-between">
                                       <span className="text-[10.5px] font-black text-rose-300 flex items-center gap-1.5">
                                         <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                         🔒 পাসওয়ার্ড / পিন ভুলে গেছেন (লক রিকোয়েস্ট)
                                       </span>
                                       {u.appLockResetRequestedAt && (
                                         <span className="text-[8.5px] text-slate-400 font-mono">
                                           🕒 {new Date(u.appLockResetRequestedAt).toLocaleTimeString('bn-BD')}
                                         </span>
                                       )}
                                     </div>
                                     <p className="text-[10px] text-rose-200/90 leading-tight">
                                       সদস্য পাসওয়ার্ড/পিন মনে নেই বলে রিকোয়েস্ট পাঠিয়েছেন। অনুমোদন দিলে অ্যাপ তাৎক্ষণিক আনলক হবে এবং পিন <strong className="text-amber-300">১২৩৪</strong> এ রিসেট হবে।
                                     </p>
                                     <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-rose-900/60">
                                       <button
                                         type="button"
                                         onClick={() => handleApproveAppLockReset(u)}
                                         className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-1"
                                       >
                                         <span>✓ অনুমোদন ও আনলক (পিন ১২৩৪)</span>
                                       </button>
                                       <button
                                         type="button"
                                         onClick={() => handleRejectAppLockReset(u)}
                                         className="px-2 py-1.5 bg-rose-900 hover:bg-rose-800 text-rose-200 font-bold text-[10.5px] rounded-lg transition cursor-pointer border border-rose-700/60"
                                       >
                                         ❌ বাতিল
                                       </button>
                                       <a
                                         href={`tel:${u.phone}`}
                                         className="px-2.5 py-1.5 bg-sky-800 hover:bg-sky-700 text-white font-bold text-[10.5px] rounded-lg transition cursor-pointer flex items-center gap-1"
                                       >
                                         <span>📞 কল</span>
                                       </a>
                                     </div>
                                   </div>
                                 )}

                                 {/* 🔐 সদস্য সিকিউরিটি ও লাস্ট গোপন অ্যাপ লক পাসওয়ার্ড বার */}
                                <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-2 space-y-1.5 shadow-2xs text-left">
                                  <div className="flex items-center justify-between gap-1 text-[10px]">
                                    <div className="flex items-center gap-1.5 font-mono">
                                      <span className="text-amber-400 font-bold">🔑 পিন:</span>
                                      <span className="font-black bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 border border-slate-700 tracking-wider">
                                        {u.pin || '1234'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                        u.isAppLocked 
                                          ? 'bg-rose-900/90 text-rose-200 border border-rose-600 animate-pulse' 
                                          : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                      }`}>
                                        {u.isAppLocked ? '🔒 লক সক্রিয়' : '🔓 আনলক'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-1 text-[10px] pt-1 border-t border-slate-800/80">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-cyan-300 font-bold shrink-0">🔒 লাস্ট লক পাসওয়ার্ড:</span>
                                      {u.appLockCode ? (
                                        <span className="font-mono font-black text-cyan-200 bg-cyan-950/90 px-1.5 py-0.5 rounded border border-cyan-700/60 truncate">
                                          {showAppLockCodeMap[u.uid || u.id || (u as any).docId] ? u.appLockCode : '••••••'}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic text-[9px]">সেট করা নেই</span>
                                      )}
                                    </div>

                                    {u.appLockCode ? (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const uidKey = u.uid || u.id || (u as any).docId;
                                            setShowAppLockCodeMap(prev => ({ ...prev, [uidKey]: !prev[uidKey] }));
                                          }}
                                          className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer text-[9px]"
                                          title="পাসওয়ার্ড দেখুন/লুকান"
                                        >
                                          {showAppLockCodeMap[u.uid || u.id || (u as any).docId] ? '🙈' : '👁️'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (u.appLockCode) {
                                              navigator.clipboard?.writeText(u.appLockCode);
                                              const uidKey = u.uid || u.id || (u as any).docId;
                                              setCopiedAppLockUid(uidKey);
                                              setTimeout(() => setCopiedAppLockUid(null), 2000);
                                            }
                                          }}
                                          className="px-1.5 py-0.5 bg-cyan-800 hover:bg-cyan-700 text-cyan-100 font-bold rounded text-[9px] transition cursor-pointer flex items-center gap-0.5"
                                          title="পাসওয়ার্ড কপি করুন"
                                        >
                                          {copiedAppLockUid === (u.uid || u.id || (u as any).docId) ? '✓ কপিড' : '📋 কপি'}
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>

                                  {u.isAppLocked && (
                                    <div className="pt-1 flex items-center justify-between gap-1 border-t border-slate-800/80">
                                      <span className="text-[9px] text-amber-300/90 font-medium">গ্রাহক লক খুলতে না পারলে:</span>
                                      <button
                                        type="button"
                                        onClick={() => handleAdminInstantUnlockUser(u)}
                                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] rounded-md transition cursor-pointer shadow-2xs"
                                      >
                                        🔓 সরাসরি আনলক করুন
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Actions Bar */}
                                <div className="flex gap-1.5 pt-1.5 border-t border-slate-200/80">
                                  <button
                                    type="button"
                                    onClick={() => openUserEditModal(u)}
                                    className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] rounded-lg transition cursor-pointer text-center flex items-center justify-center gap-1 active:scale-98 shadow-2xs"
                                  >
                                    ✏️ তথ্য ও ব্যালেন্স সংশোধন
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg transition cursor-pointer active:scale-95"
                                    title="মেম্বার অ্যাকাউন্ট ডিলিট করুন"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

                {/* TAB 1.5: PENDING MEMBER APPROVALS */}
    </>
  );
}
