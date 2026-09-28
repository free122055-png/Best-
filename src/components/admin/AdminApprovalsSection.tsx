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

export function AdminApprovalsSection(props: any) {
  const appConfig = props.appConfig || {};
  const onChangeConfig = props.onChangeConfig || (() => {});

  const {
    adminTab,
    y,
    text,
    left,
    users,
    u,
    adminAgentRequests,
    phoneChangeRequests,
    id,
    key,
    type,
    setApprovalsSubTab,
    approvalsSubTab,
    configRef,
    updatedConfig,
    alert,
    uid,
    name,
    handleApproveDeviceReset,
    handleReleaseAccountDeviceAndLogout,
    handleRejectDeviceReset,
    expandedReqIds,
    toggleReqExpanded,
    handleApproveUserAccount,
    handleRejectUserAccount,
    setCfgPhoneChangeEnabled,
    cfgPhoneChangeEnabled,
    cfgPhoneChangeFreeDays,
    setCfgPhoneChangeFreeDays,
    target,
    cfgPhoneChangeFeeIncrement,
    setCfgPhoneChangeFeeIncrement,
    cfgPhoneChangeMaxFee,
    setCfgPhoneChangeMaxFee,
    handleSavePhoneChangeConfig,
    cfgSaving,
    handleApprovePhoneRequest,
    handleRejectPhoneRequest,
    reason,
    handleUpdateAgentRequestStatus
  } = props;

  return (
    <>
        {adminTab === 'approvals' && (
          <div className="space-y-6 max-w-6xl mx-auto animate-fade-in text-slate-800 text-left font-sans">
            {/* Header section */}
            <div className="bg-white border border-slate-150 p-6 rounded-3xl space-y-2">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                🆕 কেন্দ্রীয় আবেদন ভেরিফিকেশন ও সেকশন-ভিত্তিক অটো/ম্যানুয়াল এপ্রুভাল প্যানেল
              </h2>
              <p className="text-xs text-slate-650 leading-relaxed font-sans font-medium">
                নিচের যেকোনো সেকশনে চাপ দিন। যে সেকশনে টিপ দিবেন, ওই সেকশনের জন্য স্বতন্ত্র অটো/ম্যানুয়াল অন-অফ সুইচ সুইচবোর্ড চলে আসবে। সুইচ অন থাকলে এডমিন পারমিশন ছাড়াই অটো এপ্রুভ কাজ করবে, আর সুইচ অফ থাকলে ম্যানুয়ালি এডমিন অনুমোদনের আবেদন হিসেবে জমা থাকবে।
              </p>
            </div>

            {/* List block - Unified Central Pending Inbox */}
            <div className="bg-white border border-slate-150 rounded-3xl p-6 space-y-6">
              {(() => {
                const pendingUsers = users.filter(u => u.approved === false);
                const pendingSamityMembers = users.filter(u => u.samityStatus === 'pending');
                const pendingDeviceLocks = users.filter(u => u.deviceChangeRequested === true);
                const pendingAgents = adminAgentRequests.filter(r => r.status === 'pending');
                const pendingPhoneReqs = phoneChangeRequests.filter(r => r.status === 'pending');
                const grandTotalPending = pendingUsers.length + pendingSamityMembers.length + pendingDeviceLocks.length + pendingAgents.length + pendingPhoneReqs.length;

                return (
                  <div className="space-y-6">
                    {/* Sub-tabs Selector */}
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-100 rounded-2xl border border-slate-200">
                      {[
                        { id: 'all' as const, label: '🔔 সকল আবেদনপত্র', count: grandTotalPending },
                        { id: 'users' as const, label: '👥 সদস্য অ্যাকাউন্ট', count: pendingUsers.length },
                        { id: 'samity_members' as const, label: '🏢 সমবায় সমিতি সদস্য আবেদন', count: pendingSamityMembers.length },
                        { id: 'device_locks' as const, label: '🔐 ডিভাইস আনলক ও সিকিউরিটি', count: pendingDeviceLocks.length },
                        { id: 'phone_requests' as const, label: '📱 নম্বর পরিবর্তন আবেদন', count: pendingPhoneReqs.length },
                        { id: 'agents' as const, label: '💼 এজেন্ট ও প্রতিনিধি আবেদন', count: pendingAgents.length },
                      ].map((sub, idx) => (
                        <button
                          key={`${sub.id}-${idx}`}
                          type="button"
                          onClick={() => setApprovalsSubTab(sub.id)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                            approvalsSubTab === sub.id
                              ? 'bg-[#00a884] text-white shadow-md'
                              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/80'
                          }`}
                        >
                          <span>{sub.label}</span>
                          {sub.count > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              approvalsSubTab === sub.id ? 'bg-white text-[#00a884]' : 'bg-rose-500 text-white'
                            }`}>
                              {sub.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* ⚡ DYNAMIC SECTION SWITCH BOARD (Changes based on selected tab above) */}
                    {(() => {
                      const getSwitchDetails = () => {
                        switch (approvalsSubTab) {
                          case 'users':
                            return {
                              title: '👥 সদস্য ও সমবায় অ্যাকাউন্ট রেজিস্ট্রেশন অটো-অ্যাপ্রুভ সুইচ',
                              subtitle: 'নতুন সদস্য রেজিস্ট্রেশন ফরম পূরণ করলে এডমিন পারমিশন লাগবে নাকি অটো অ্যাকাউন্ট হয়ে যাবে',
                              isAuto: appConfig?.manualApprovalEnabled === false,
                              onLabel: '🟢 অটোমেটিক রেজিস্ট্রেশন এপ্রুভ (Auto ON)',
                              offLabel: '🔴 ম্যানুয়াল এডমিন অনুমোদন (Manual ON)',
                              onDesc: 'সুইচ অন থাকলে তথ্য দিয়ে রেজিস্ট্রেশন করার সাথে সাথেই অ্যাকাউন্ট অটোমেটিক সক্রিয় হয়ে সরাসরি লগইন করতে পারবে।',
                              offDesc: 'সুইচ অফ থাকলে নতুন অ্যাকাউন্ট রেজিস্টার করলে পেন্ডিং থাকবে এবং এডমিন এখান থেকে এপ্রুভ করলে তবেই লগইন করতে পারবে।',
                              onToggle: async () => {
                                const currentIsAuto = appConfig?.manualApprovalEnabled === false;
                                const newManualVal = currentIsAuto;
                                const configRef = doc(db, 'system_settings', 'app_config');
                                const updatedConfig = { ...appConfig, manualApprovalEnabled: newManualVal };
                                await setDoc(configRef, updatedConfig, { merge: true });
                                onChangeConfig(updatedConfig);
                                alert(`সদস্য অ্যাকাউন্ট রেজিস্ট্রেশন মোড পরিবর্তন সম্পন্ন! এখনঃ ${!newManualVal ? '🟢 অটোমেটিক এপ্রুভাল চালু' : '🔴 ম্যানুয়াল এডমিন রিভিউ চালু'}`);
                              }
                            };
                          case 'samity_members':
                            return {
                              title: '🏢 সমবায় সমিতি সদস্য আবেদন অটো-অ্যাপ্রুভ সুইচ',
                              subtitle: 'গ্রাহক সমবায় সমিতি সদস্য হওয়ার আবেদন ফরম সাবমিট করলে এডমিন পারমিশন ছাড়াই অটো এপ্রুভ হবে নাকি এডমিন অনুমোদনের জন্য পেন্ডিং থাকবে',
                              isAuto: appConfig?.autoApproveSomiti === true || appConfig?.autoApproveSamity === true,
                              onLabel: '🟢 অটো সমিতি সদস্যপদ অন (Auto Approve ON)',
                              offLabel: '🔴 ম্যানুয়াল এডমিন অনুমোদন (Manual Review ON)',
                              onDesc: 'সুইচ অন থাকলে গ্রাহক সমিতির মেম্বারশিপ ফরম জমা দেওয়ার সাথে সাথেই কোনো এডমিন পারমিশন ছাড়াই অটোমেটিক সদস্যপদ চালু হয়ে যাবে।',
                              offDesc: 'সুইচ অফ থাকলে সমিতির সদস্যপদ আবেদন এডমিন প্যানেলে জমা পড়বে এবং এডমিন ভেরিফাই করে এপ্রুভ দিলে তবেই সমিতি পেজ খুলবে।',
                              onToggle: async () => {
                                const currentIsAuto = appConfig?.autoApproveSomiti === true || appConfig?.autoApproveSamity === true;
                                const newVal = !currentIsAuto;
                                const configRef = doc(db, 'system_settings', 'app_config');
                                const updatedConfig = { 
                                  ...appConfig, 
                                  autoApproveSomiti: newVal, 
                                  autoApproveSamity: newVal
                                };
                                await setDoc(configRef, updatedConfig, { merge: true });
                                onChangeConfig(updatedConfig);
                                alert(`সমিতি সদস্যপদ আবেদন মোড পরিবর্তন সম্পন্ন! এখনঃ ${newVal ? '🟢 অটো সমিতি সদস্যপদ চালু' : '🔴 ম্যানুয়াল এডমিন রিভিউ চালু'}`);
                              }
                            };
                          case 'samity_txs':
                            return {
                              title: '🏦 সমবায় সঞ্চয় ও ডিপোজিট পেমেন্ট ট্রানজেকশন অটো-অ্যাপ্রুভ সুইচ',
                              subtitle: 'গ্রাহক সমবায় সঞ্চয় জমা বা ডিপোজিট পেমেন্ট লেনদেন করলে স্বয়ংক্রিয়ভাবে ব্যালেন্স জমা হবে নাকি এডমিন যাচাই ও অনুমোদনের পেন্ডিং লিস্টে থাকবে',
                              isAuto: appConfig?.autoApproveSamityTxs === true,
                              onLabel: '🟢 অটো সঞ্চয় ও পেমেন্ট অন (Auto Approve ON)',
                              offLabel: '🔴 ম্যানুয়াল পেমেন্ট ভেরিফিকেশন (Manual Review ON)',
                              onDesc: 'সুইচ অন থাকলে গ্রাহক সঞ্চয় বা ডিপোজিট পেমেন্ট করার সাথে সাথেই কোনো এডমিন অনুমোদন ছাড়াই স্বয়ংক্রিয়ভাবে একাউন্টে জমা হয়ে যাবে।',
                              offDesc: 'সুইচ অফ থাকলে সঞ্চয় ও পেমেন্ট লেনদেন এডমিন প্যানেলে পেন্ডিং হিসেবে আসবে এবং এডমিন টাকা ভেরিফাই করে এপ্রুভ দিলে ব্যালেন্স জমা হবে।',
                              onToggle: async () => {
                                const currentIsAuto = appConfig?.autoApproveSamityTxs === true;
                                const newVal = !currentIsAuto;
                                const configRef = doc(db, 'system_settings', 'app_config');
                                const updatedConfig = { 
                                  ...appConfig, 
                                  autoApproveSamityTxs: newVal
                                };
                                await setDoc(configRef, updatedConfig, { merge: true });
                                onChangeConfig(updatedConfig);
                                alert(`সমবায় সঞ্চয় ও পেমেন্ট ট্রানজেকশন মোড পরিবর্তন সম্পন্ন! এখনঃ ${newVal ? '🟢 অটো সঞ্চয় ও পেমেন্ট চালু' : '🔴 ম্যানুয়াল পেমেন্ট ভেরিফিকেশন চালু'}`);
                              }
                            };
                          case 'device_locks':
                            return {
                              title: '🔐 ডিভাইস আনলক ও নতুন ডিভাইস রিকোয়েস্ট সুইচ',
                              subtitle: 'অন্য ডিভাইসে লগইন চেষ্টা ও ডিভাইস সিকিউরিটি আনলক আবেদনের অটো এপ্রুভাল মোড',
                              isAuto: appConfig?.autoApproveDeviceLocks === true,
                              onLabel: '🟢 অটো ডিভাইস আনলক চালু (Auto Unlock ON)',
                              offLabel: '🔴 ম্যানুয়াল ডিভাইস সিকিউরিটি (Manual Lock ON)',
                              onDesc: 'সুইচ অন থাকলে গ্রাহক নতুন ডিভাইসে রিকোয়েস্ট করার সাথে সাথেই অটোমেটিক ডিভাইস আনলক ও এপ্রুভ হয়ে যাবে।',
                              offDesc: 'সুইচ অফ থাকলে নতুন ডিভাইসে লগইন চেষ্টা করলে এডমিন প্যানেলে আবেদন আসবে এবং এডমিন এপ্রুভ না করা পর্যন্ত লক থাকবে।',
                              onToggle: async () => {
                                const currentIsAuto = appConfig?.autoApproveDeviceLocks === true;
                                const newVal = !currentIsAuto;
                                const configRef = doc(db, 'system_settings', 'app_config');
                                const updatedConfig = { ...appConfig, autoApproveDeviceLocks: newVal };
                                await setDoc(configRef, updatedConfig, { merge: true });
                                onChangeConfig(updatedConfig);
                                alert(`ডিভাইস আনলক রিকোয়েস্ট মোড পরিবর্তন সম্পন্ন! এখনঃ ${newVal ? '🟢 অটো ডিভাইস আনলক চালু' : '🔴 ম্যানুয়াল ডিভাইস সিকিউরিটি চালু'}`);
                              }
                            };
                          case 'phone_requests':
                            return {
                              title: '📱 মোবাইল নম্বর পরিবর্তন আবেদন অটো-অ্যাপ্রুভ সুইচ',
                              subtitle: 'সদস্যদের মোবাইল নম্বর পরিবর্তনের আবেদনপত্রের অটোমেটিক অনুমোদন কন্ট্রোল',
                              isAuto: appConfig?.autoApprovePhoneChange === true,
                              onLabel: '🟢 অটো নম্বর পরিবর্তন অন (Auto Approve ON)',
                              offLabel: '🔴 ম্যানুয়াল অ্যাডমিন ভেরিফিকেশন (Manual Review ON)',
                              onDesc: 'সুইচ অন থাকলে গ্রাহক নম্বর পরিবর্তনের জন্য সাবমিট করার সাথে সাথেই অটোমেটিক ডাটাবেজে নতুন মোবাইল নম্বর আপডেট হয়ে যাবে।',
                              offDesc: 'সুইচ অফ থাকলে নম্বর পরিবর্তনের আবেদন এডমিন প্যানেলে জমা পড়বে এবং এডমিন ভেরিফাই করে এপ্রুভ দিলে নতুন নম্বর সচল হবে।',
                              onToggle: async () => {
                                const currentIsAuto = appConfig?.autoApprovePhoneChange === true;
                                const newVal = !currentIsAuto;
                                const configRef = doc(db, 'system_settings', 'app_config');
                                const updatedConfig = { ...appConfig, autoApprovePhoneChange: newVal };
                                await setDoc(configRef, updatedConfig, { merge: true });
                                onChangeConfig(updatedConfig);
                                alert(`মোবাইল নম্বর পরিবর্তন আবেদন মোড পরিবর্তন সম্পন্ন! এখনঃ ${newVal ? '🟢 অটো নম্বর পরিবর্তন চালু' : '🔴 ম্যানুয়াল এডমিন ভেরিফিকেশন চালু'}`);
                              }
                            };
                          case 'agents':
                            return {
                              title: '💼 এজেন্ট ও প্রতিনিধি আবেদন অটো-অ্যাপ্রুভ সুইচ',
                              subtitle: 'এজেন্ট পার্টনার, প্রতিনিধি ও কুরিয়ার ক্যারিয়ার আবেদনপত্রের স্বয়ংক্রিয় অনুমোদন ড্রাইভার',
                              isAuto: appConfig?.autoApproveAgentRequests === true,
                              onLabel: '🟢 অটো এজেন্ট এপ্রুভাল অন (Auto Approve ON)',
                              offLabel: '🔴 ম্যানুয়াল প্রতিনিধি রিভিউ (Manual Review ON)',
                              onDesc: 'সুইচ অন থাকলে এজেন্ট বা প্রতিনিধির ফরম জমা দেওয়ার সাথে সাথেই সিস্টেম দ্বারা অটোমেটিক এপ্রুভ ও সক্রিয় হয়ে যাবে।',
                              offDesc: 'সুইচ অফ থাকলে এজেন্ট ও প্রতিনিধির আবেদন এডমিন প্যানেলে জমা হবে এবং এডমিন ফাইল রিভিউ করে অনুমোদন দেবেন।',
                              onToggle: async () => {
                                const currentIsAuto = appConfig?.autoApproveAgentRequests === true;
                                const newVal = !currentIsAuto;
                                const configRef = doc(db, 'system_settings', 'app_config');
                                const updatedConfig = { ...appConfig, autoApproveAgentRequests: newVal };
                                await setDoc(configRef, updatedConfig, { merge: true });
                                onChangeConfig(updatedConfig);
                                alert(`এজেন্ট ও প্রতিনিধি আবেদন মোড পরিবর্তন সম্পন্ন! এখনঃ ${newVal ? '🟢 অটো এজেন্ট এপ্রুভাল চালু' : '🔴 ম্যানুয়াল প্রতিনিধি রিভিউ চালু'}`);
                              }
                            };
                          default:
                            return null;
                        }
                      };

                      const sw = getSwitchDetails();

                      if (!sw) {
                        return (
                          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-2 border-slate-800 text-white rounded-3xl p-5 shadow-xl space-y-4 font-sans">
                            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800 flex-wrap">
                              <div>
                                <h3 className="text-sm font-black text-white flex items-center gap-2">
                                  ⚙️ সকল সেকশনের অটো / ম্যানুয়াল অনুমোদন মাস্টার বোর্ড (Master Controls)
                                </h3>
                                <p className="text-xs text-slate-400">
                                  নিচের যেকোনো সেকশন ট্যাবে ক্লিক করে নির্দিষ্ট সেকশনের বিস্তারিত সুইচ দেখুন, অথবা এখান থেকে এক নজরে সব সেকশন অন/অফ করুন:
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {/* 1. Member Registration */}
                              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-amber-300">👥 সদস্য অ্যাকাউন্ট রেজিস্ট্রেশন</span>
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${appConfig?.manualApprovalEnabled === false ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'}`}>
                                    {appConfig?.manualApprovalEnabled === false ? '🟢 অটোমেটিক' : '🔴 ম্যানুয়াল'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const currentIsAuto = appConfig?.manualApprovalEnabled === false;
                                    const newManualVal = currentIsAuto;
                                    const configRef = doc(db, 'system_settings', 'app_config');
                                    const updatedConfig = { ...appConfig, manualApprovalEnabled: newManualVal };
                                    await setDoc(configRef, updatedConfig, { merge: true });
                                    onChangeConfig(updatedConfig);
                                  }}
                                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition cursor-pointer"
                                >
                                  {appConfig?.manualApprovalEnabled === false ? '🔴 ম্যানুয়াল মোড চালু করুন' : '🟢 অটোমেটিক মোড চালু করুন'}
                                </button>
                              </div>

                              {/* 2. Samity Member Application */}
                              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-emerald-300">🏢 সমবায় সমিতি সদস্য আবেদন</span>
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${(appConfig?.autoApproveSomiti === true || appConfig?.autoApproveSamity === true) ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'}`}>
                                    {(appConfig?.autoApproveSomiti === true || appConfig?.autoApproveSamity === true) ? '🟢 অটোমেটিক' : '🔴 ম্যানুয়াল'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const currentIsAuto = appConfig?.autoApproveSomiti === true || appConfig?.autoApproveSamity === true;
                                    const newVal = !currentIsAuto;
                                    const configRef = doc(db, 'system_settings', 'app_config');
                                    const updatedConfig = { ...appConfig, autoApproveSomiti: newVal, autoApproveSamity: newVal };
                                    await setDoc(configRef, updatedConfig, { merge: true });
                                    onChangeConfig(updatedConfig);
                                  }}
                                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition cursor-pointer"
                                >
                                  {(appConfig?.autoApproveSomiti === true || appConfig?.autoApproveSamity === true) ? '🔴 ম্যানুয়াল মোড চালু করুন' : '🟢 অটোমেটিক মোড চালু করুন'}
                                </button>
                              </div>

                              {/* 3. Savings & Deposit Payment Transactions */}
                              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-teal-300">🏦 সমবায় সঞ্চয় ও ট্রানজেকশন</span>
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${appConfig?.autoApproveSamityTxs === true ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'}`}>
                                    {appConfig?.autoApproveSamityTxs === true ? '🟢 অটোমেটিক' : '🔴 ম্যানুয়াল'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const currentIsAuto = appConfig?.autoApproveSamityTxs === true;
                                    const newVal = !currentIsAuto;
                                    const configRef = doc(db, 'system_settings', 'app_config');
                                    const updatedConfig = { ...appConfig, autoApproveSamityTxs: newVal };
                                    await setDoc(configRef, updatedConfig, { merge: true });
                                    onChangeConfig(updatedConfig);
                                  }}
                                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition cursor-pointer"
                                >
                                  {appConfig?.autoApproveSamityTxs === true ? '🔴 ম্যানুয়াল মোড চালু করুন' : '🟢 অটোমেটিক মোড চালু করুন'}
                                </button>
                              </div>

                              {/* 3. Device Locks */}
                              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-rose-300">🔐 ডিভাইস আনলক রিকোয়েস্ট</span>
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${appConfig?.autoApproveDeviceLocks === true ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'}`}>
                                    {appConfig?.autoApproveDeviceLocks === true ? '🟢 অটোমেটিক' : '🔴 ম্যানুয়াল'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const currentIsAuto = appConfig?.autoApproveDeviceLocks === true;
                                    const newVal = !currentIsAuto;
                                    const configRef = doc(db, 'system_settings', 'app_config');
                                    const updatedConfig = { ...appConfig, autoApproveDeviceLocks: newVal };
                                    await setDoc(configRef, updatedConfig, { merge: true });
                                    onChangeConfig(updatedConfig);
                                  }}
                                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition cursor-pointer"
                                >
                                  {appConfig?.autoApproveDeviceLocks === true ? '🔴 ম্যানুয়াল মোড চালু করুন' : '🟢 অটোমেটিক মোড চালু করুন'}
                                </button>
                              </div>

                              {/* 4. Phone Requests */}
                              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-cyan-300">📱 নম্বর পরিবর্তন আবেদন</span>
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${appConfig?.autoApprovePhoneChange === true ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'}`}>
                                    {appConfig?.autoApprovePhoneChange === true ? '🟢 অটোমেটিক' : '🔴 ম্যানুয়াল'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const currentIsAuto = appConfig?.autoApprovePhoneChange === true;
                                    const newVal = !currentIsAuto;
                                    const configRef = doc(db, 'system_settings', 'app_config');
                                    const updatedConfig = { ...appConfig, autoApprovePhoneChange: newVal };
                                    await setDoc(configRef, updatedConfig, { merge: true });
                                    onChangeConfig(updatedConfig);
                                  }}
                                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition cursor-pointer"
                                >
                                  {appConfig?.autoApprovePhoneChange === true ? '🔴 ম্যানুয়াল মোড চালু করুন' : '🟢 অটোমেটিক মোড চালু করুন'}
                                </button>
                              </div>

                              {/* 5. Agent Requests */}
                              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-purple-300">💼 এজেন্ট ও প্রতিনিধি আবেদন</span>
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${appConfig?.autoApproveAgentRequests === true ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'}`}>
                                    {appConfig?.autoApproveAgentRequests === true ? '🟢 অটোমেটিক' : '🔴 ম্যানুয়াল'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const currentIsAuto = appConfig?.autoApproveAgentRequests === true;
                                    const newVal = !currentIsAuto;
                                    const configRef = doc(db, 'system_settings', 'app_config');
                                    const updatedConfig = { ...appConfig, autoApproveAgentRequests: newVal };
                                    await setDoc(configRef, updatedConfig, { merge: true });
                                    onChangeConfig(updatedConfig);
                                  }}
                                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition cursor-pointer"
                                >
                                  {appConfig?.autoApproveAgentRequests === true ? '🔴 ম্যানুয়াল মোড চালু করুন' : '🟢 অটোমেটিক মোড চালু করুন'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-2 border-emerald-500/70 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden space-y-4 font-sans">
                          <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-slate-800">
                            <div className="space-y-1 max-w-xl">
                              <div className="flex items-center gap-2">
                                <span className={`w-3.5 h-3.5 rounded-full animate-pulse ${sw.isAuto ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                <h3 className="text-sm font-black text-white flex items-center gap-2 font-sans">
                                  {sw.title}
                                </h3>
                              </div>
                              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                                {sw.subtitle}
                              </p>
                            </div>

                            {/* Toggle Switch Button */}
                            <div className="flex items-center gap-3 bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700 shadow-inner">
                              <div className="text-right font-sans">
                                <p className="text-xs font-black text-white">
                                  {sw.isAuto ? sw.onLabel : sw.offLabel}
                                </p>
                                <p className="text-[10px] text-slate-300">
                                  {sw.isAuto ? 'এডমিন অনুমোদন ছাড়াই কাজ হবে' : 'এডমিনের কাছে পেন্ডিং রিভিউ জমা হবে'}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={sw.onToggle}
                                className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                                  sw.isAuto ? 'bg-emerald-500 justify-end' : 'bg-amber-500 justify-start'
                                }`}
                              >
                                <div className="w-6 h-6 rounded-full bg-white shadow-md transform transition-transform" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans">
                            <div className={`p-3.5 rounded-2xl border transition ${
                              sw.isAuto ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow-inner' : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
                            }`}>
                              <div className="flex items-center gap-2 font-black mb-1">
                                <span>🟢 অটোমেটিক মোড (Auto Approve Switch ON)</span>
                                {sw.isAuto && <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full">সক্রিয়</span>}
                              </div>
                              <p className="text-[11px] leading-relaxed">
                                {sw.onDesc}
                              </p>
                            </div>

                            <div className={`p-3.5 rounded-2xl border transition ${
                              !sw.isAuto ? 'bg-amber-950/60 border-amber-500/60 text-amber-200 shadow-inner' : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
                            }`}>
                              <div className="flex items-center gap-2 font-black mb-1">
                                <span>🔴 ম্যানুয়াল মোড (Manual Approval Switch ON)</span>
                                {!sw.isAuto && <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full">সক্রিয়</span>}
                              </div>
                              <p className="text-[11px] leading-relaxed">
                                {sw.offDesc}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {grandTotalPending === 0 ? (
                      <div className="text-center py-16 space-y-3">
                        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl border border-emerald-100">
                          ✓
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 font-sans">কোনো আবেদন বর্তমানে অপেক্ষমান নেই</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto font-sans leading-relaxed">
                          নতুন সদস্য, এজেন্ট পার্টনার এবং সমবায় সঞ্চয় সংক্রান্ত সকল কার্যক্রম সচল ও অনুমোদিত রয়েছে।
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* 0.5 DEVICE LOCK UNLOCK REQUESTS */}
                        {(approvalsSubTab === 'all' || approvalsSubTab === 'device_locks') && pendingDeviceLocks.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                              <h3 className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                🔐 ডিভাইস আনলক ও নতুন ডিভাইস অনুমোদন আবেদনসমূহ ({pendingDeviceLocks.length} টি)
                              </h3>
                            </div>
                            <div className="space-y-2.5">
                              {pendingDeviceLocks.map((u, idx) => (
                                <div 
                                  key={`dev_lock_${u.uid}_${idx}`}
                                  className="p-4 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 border border-rose-800/60 rounded-2xl text-white shadow-md space-y-3 font-sans"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                        🔒 নতুন ডিভাইস রিকোয়েস্ট
                                      </span>
                                      <h4 className="text-sm font-black text-white">{u.name}</h4>
                                      <span className="text-xs font-mono font-bold text-amber-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md">
                                        📱 {u.phone}
                                      </span>
                                      {u.memberId && (
                                        <span className="text-xs font-mono text-slate-400 font-bold">
                                          ID: #{u.memberId}
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-[10px] font-mono text-slate-400">
                                      {u.deviceChangeRequestedAt ? new Date(u.deviceChangeRequestedAt).toLocaleString('bn-BD') : 'সম্প্রতি প্রেরিত'}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 font-mono">
                                    <div>
                                      <span className="text-slate-500 text-[10px] uppercase block">পূর্বে রেজিস্টার্ড ডিভাইস আইডি (Registered):</span>
                                      <span className="text-rose-400 font-bold truncate block">{u.currentDeviceId || 'কোনো ডিভাইস সেট করা নেই'}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500 text-[10px] uppercase block">নতুন অনুরোধকৃত ডিভাইস আইডি (Requested):</span>
                                      <span className="text-emerald-400 font-bold truncate block">{u.requestedDeviceId || 'ডিভাইস আইডি পাওয়া যায়নি'}</span>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                                    <button
                                      type="button"
                                      onClick={() => handleApproveDeviceReset(u)}
                                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md"
                                    >
                                      ✓ নতুন ডিভাইস অনুমোদন করুন
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleReleaseAccountDeviceAndLogout(u)}
                                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md flex items-center gap-1 border border-rose-400/40"
                                    >
                                      ⚡ জিরো ডিভাইস ও ইনস্ট্যান্ট লগআউট (Force Logout)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRejectDeviceReset(u.uid)}
                                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                                    >
                                      ❌ বাতিল
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 1.2 SAMITY MEMBER APPROVALS */}
                        {(approvalsSubTab === 'all' || approvalsSubTab === 'samity_members') && pendingSamityMembers.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                              <h3 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                                🏢 সমবায় সমিতি সদস্য পদ আবেদনসমূহ ({pendingSamityMembers.length} টি)
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {pendingSamityMembers.map((u, idx) => {
                                const reqKey = `samity_mem_${u.uid || u.phone}`;
                                const isExpanded = expandedReqIds[reqKey] || false;

                                return (
                                  <div 
                                    key={`samity_m_${u.uid}-${idx}`} 
                                    className="p-3 border rounded-2xl transition duration-150 space-y-2 bg-emerald-50/50 border-emerald-300 hover:border-emerald-400 border-l-4 border-l-emerald-600"
                                  >
                                    {/* Top Bar */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <span className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs bg-emerald-600 text-white border-emerald-700">
                                          🏢 সমবায় সমিতি মেম্বারশিপ আবেদন
                                        </span>
                                        <h4 className="text-xs font-black text-slate-900 truncate">{u.name}</h4>
                                        <span className="text-[10px] font-mono font-extrabold text-slate-600 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-md">
                                          📱 {u.phone}
                                        </span>
                                        {u.memberId && (
                                          <span className="text-[10px] font-mono text-slate-500 font-bold">
                                            ID: #{u.memberId}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => toggleReqExpanded(reqKey)}
                                          className="px-2.5 py-1 text-[10px] font-black bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                        >
                                          {isExpanded ? 'সংক্ষিপ্ত করুন 🔼' : 'আরো দেখুন 🔽'}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Expanded Detailed View */}
                                    {isExpanded && (
                                      <div className="pt-2 border-t border-slate-200/80 space-y-2 animate-fadeIn text-xs">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white/90 p-2.5 rounded-xl border border-slate-200">
                                          <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase block">মেম্বার আইডি</span>
                                            <span className="font-bold text-slate-800">{u.memberId || 'N/A'}</span>
                                          </div>
                                          <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase block">জেলা/ঠিকানা</span>
                                            <span className="font-bold text-slate-800">{u.district || 'বাংলাদেশ'}</span>
                                          </div>
                                          <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase block">পেশা / এনআইডি</span>
                                            <span className="font-bold text-slate-800">{u.occupation || u.nid || 'তথ্য প্রদান করা হয়েছে'}</span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 justify-end pt-1">
                                          <button
                                            type="button"
                                            onClick={() => handleApproveUserAccount(u)}
                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                                          >
                                            ✓ সমিতি মেম্বারশিপ এপ্রুভ করুন (Approve Samity)
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRejectUserAccount(u)}
                                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl transition cursor-pointer"
                                          >
                                            বাতিল
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Collapsed Compact Action Buttons */}
                                    {!isExpanded && (
                                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                                        <span className="text-[10px] font-bold text-slate-500">
                                          📍 জেলা: {u.district || 'N/A'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleApproveUserAccount(u)}
                                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer shadow-2xs"
                                          >
                                            ✓ সমিতি মেম্বারশিপ অনুমোদন
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRejectUserAccount(u)}
                                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold rounded-lg transition cursor-pointer"
                                          >
                                            বাতিল
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {approvalsSubTab === 'samity_members' && pendingSamityMembers.length === 0 && (
                          <div className="text-center py-12 space-y-2">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl border border-emerald-100">
                              🏢
                            </div>
                            <h4 className="text-xs font-bold text-slate-800">কোনো সমিতি মেম্বারশিপ আবেদন নেই</h4>
                            <p className="text-[11px] text-slate-500">সকল আবেদনসমূহ প্রক্রিয়া সম্পন্ন করা হয়েছে।</p>
                          </div>
                        )}

                        {approvalsSubTab === 'device_locks' && pendingDeviceLocks.length === 0 && (
                          <div className="text-center py-12 space-y-2">
                            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl border border-rose-100">
                              🔒
                            </div>
                            <h4 className="text-xs font-bold text-slate-800">কোনো ডিভাইস পরিবর্তনের অনুরোধ নেই</h4>
                            <p className="text-[11px] text-slate-500">সকল সদস্যদের ডিভাইস অনুমোদিত ও নিরাপদ অবস্থায় রয়েছে।</p>
                          </div>
                        )}

                        {/* 1. MEMBER & SAMITY USER APPROVALS */}
                        {(approvalsSubTab === 'all' || approvalsSubTab === 'users') && pendingUsers.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                👥 সদস্য ও সমবায় মেম্বারশিপ অ্যাকাউন্টস ({pendingUsers.length} টি)
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {pendingUsers.map((u, idx) => {
                                const isSamity = Boolean(u.samityStatus === 'approved' || u.samityApproved === true || u.isSamityMember === true);
                                const reqKey = u.uid || `user_${u.phone}`;
                                const isExpanded = expandedReqIds[reqKey] || false;

                                const badgeText = isSamity ? '🏢 সমবায় সমিতি সদস্য আবেদন' : '📱 নরমাল সদস্য (BNB কোম্পানি ইনভেস্টার) আবেদন';
                                const badgeStyle = isSamity ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-sky-600 text-white border-sky-700';
                                const cardThemeStyle = isSamity 
                                  ? 'bg-emerald-50/40 border-emerald-300 hover:border-emerald-400 border-l-4 border-l-emerald-600'
                                  : 'bg-sky-50/40 border-sky-300 hover:border-sky-400 border-l-4 border-l-sky-600';

                                return (
                                  <div 
                                    key={`${u.uid}-${idx}`} 
                                    className={`p-3 border rounded-2xl transition duration-150 space-y-2 ${cardThemeStyle}`}
                                  >
                                    {/* Top Bar */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs ${badgeStyle}`}>
                                          {badgeText}
                                        </span>
                                        <h4 className="text-xs font-black text-slate-900 truncate">{u.name}</h4>
                                        <span className="text-[10px] font-mono font-extrabold text-slate-600 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-md">
                                          📱 {u.phone}
                                        </span>
                                        {u.memberId && (
                                          <span className="text-[10px] font-mono text-slate-500 font-bold">
                                            ID: #{u.memberId}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => toggleReqExpanded(reqKey)}
                                          className="px-2.5 py-1 text-[10px] font-black bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                        >
                                          {isExpanded ? 'সংক্ষিপ্ত করুন 🔼' : 'আরো দেখুন 🔽'}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Expanded Detailed View */}
                                    {isExpanded && (
                                      <div className="pt-2 border-t border-slate-200/80 space-y-2 animate-fadeIn text-xs">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white/90 p-2.5 rounded-xl border border-slate-200">
                                          <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase block">মেম্বার আইডি</span>
                                            <span className="font-bold text-slate-800">{u.memberId || 'N/A'}</span>
                                          </div>
                                          <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase block">জেলা/ঠিকানা</span>
                                            <span className="font-bold text-slate-800">{u.district || 'বাংলাদেশ'}</span>
                                          </div>
                                          <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase block">বর্তমান ওয়ালেট ব্যালেন্স</span>
                                            <span className="font-extrabold text-emerald-700 font-mono">৳{(u.balance || 0).toLocaleString('bn-BD')}</span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 justify-end pt-1">
                                          <button
                                            type="button"
                                            onClick={() => handleApproveUserAccount(u)}
                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                                          >
                                            ✓ অনুমোদন করুন (Approve)
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRejectUserAccount(u)}
                                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl transition cursor-pointer"
                                          >
                                            বাতিল
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Collapsed Compact Action Buttons */}
                                    {!isExpanded && (
                                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                                        <span className="text-[10px] font-bold text-slate-500">
                                          📍 জেলা: {u.district || 'N/A'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleApproveUserAccount(u)}
                                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer shadow-2xs"
                                          >
                                            ✓ অনুমোদন
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRejectUserAccount(u)}
                                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold rounded-lg transition cursor-pointer"
                                          >
                                            বাতিল
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 1.2 SAMITY MEMBER APPROVALS */}
                        {(approvalsSubTab === 'all' || approvalsSubTab === 'samity_members') && pendingSamityMembers.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                              <h3 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                                🏢 সমবায় সমিতি সদস্য পদ আবেদনসমূহ ({pendingSamityMembers.length} টি)
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {pendingSamityMembers.map((u, idx) => {
                                const reqKey = `samity_mem_${u.uid || u.phone}`;
                                const isExpanded = expandedReqIds[reqKey] || false;

                                return (
                                  <div 
                                    key={`samity_m_${u.uid}-${idx}`} 
                                    className="p-3 border rounded-2xl transition duration-150 space-y-2 bg-emerald-50/50 border-emerald-300 hover:border-emerald-400 border-l-4 border-l-emerald-600"
                                  >
                                    {/* Top Bar */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <span className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs bg-emerald-600 text-white border-emerald-700">
                                          🏢 সমবায় সমিতি মেম্বারশিপ আবেদন
                                        </span>
                                        <h4 className="text-xs font-black text-slate-900 truncate">{u.name}</h4>
                                        <span className="text-[10px] font-mono font-extrabold text-slate-600 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-md">
                                          📱 {u.phone}
                                        </span>
                                        {u.memberId && (
                                          <span className="text-[10px] font-mono text-slate-500 font-bold">
                                            ID: #{u.memberId}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => toggleReqExpanded(reqKey)}
                                          className="px-2.5 py-1 text-[10px] font-black bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                        >
                                          {isExpanded ? 'সংক্ষিপ্ত করুন 🔼' : 'আরো দেখুন 🔽'}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Expanded Detailed View */}
                                    {isExpanded && (
                                      <div className="pt-2 border-t border-slate-200/80 space-y-2 animate-fadeIn text-xs">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white/90 p-2.5 rounded-xl border border-slate-200">
                                          <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase block">মেম্বার আইডি</span>
                                            <span className="font-bold text-slate-800">{u.memberId || 'N/A'}</span>
                                          </div>
                                          <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase block">জেলা/ঠিকানা</span>
                                            <span className="font-bold text-slate-800">{u.district || 'বাংলাদেশ'}</span>
                                          </div>
                                          <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase block">পেশা / এনআইডি</span>
                                            <span className="font-bold text-slate-800">{u.occupation || u.nid || 'তথ্য প্রদান করা হয়েছে'}</span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 justify-end pt-1">
                                          <button
                                            type="button"
                                            onClick={() => handleApproveUserAccount(u)}
                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                                          >
                                            ✓ সমিতি মেম্বারশিপ এপ্রুভ করুন (Approve Samity)
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRejectUserAccount(u)}
                                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl transition cursor-pointer"
                                          >
                                            বাতিল
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Collapsed Compact Action Buttons */}
                                    {!isExpanded && (
                                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                                        <span className="text-[10px] font-bold text-slate-500">
                                          📍 জেলা: {u.district || 'N/A'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleApproveUserAccount(u)}
                                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer shadow-2xs"
                                          >
                                            ✓ সমিতি মেম্বারশিপ অনুমোদন
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRejectUserAccount(u)}
                                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold rounded-lg transition cursor-pointer"
                                          >
                                            বাতিল
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {approvalsSubTab === 'samity_members' && pendingSamityMembers.length === 0 && (
                          <div className="text-center py-12 space-y-2">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl border border-emerald-100">
                              🏢
                            </div>
                            <h4 className="text-xs font-bold text-slate-800">কোনো সমিতি মেম্বারশিপ আবেদন নেই</h4>
                            <p className="text-[11px] text-slate-500">সকল আবেদনসমূহ প্রক্রিয়া সম্পন্ন করা হয়েছে।</p>
                          </div>
                        )}

                        {/* 1.5 PHONE CHANGE REQUESTS & CONFIGURATION */}
                        {approvalsSubTab === 'phone_requests' && (
                          <div className="bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-slate-50 border border-amber-200 rounded-3xl p-5 shadow-xs space-y-4 text-left mb-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-amber-200/80">
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-xs">
                                  📱
                                </div>
                                <div>
                                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                    মোবাইল নম্বর পরিবর্তন চার্জ ও ফ্রি সার্ভিস কনফিগারেশন
                                  </h3>
                                  <p className="text-[11px] text-slate-600 font-medium">
                                    সদস্যদের নম্বর পরিবর্তন ফি, বিনামূল্যে পরিবর্তনের সুযোগ এবং সর্বোচ্চ ফি সীমা এডমিন প্যানেল থেকে পছন্দমতো কাস্টমাইজ করুন।
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setCfgPhoneChangeEnabled(!cfgPhoneChangeEnabled)}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                    cfgPhoneChangeEnabled
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                                  }`}
                                >
                                  <span>{cfgPhoneChangeEnabled ? '🟢 সার্ভিস সচল (ACTIVE)' : '🔴 সার্ভিস সাময়িক বন্ধ (PAUSED)'}</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* 1. Free Days After Registration */}
                              <div className="bg-white/90 p-3.5 rounded-2xl border border-amber-200/80 space-y-1.5">
                                <label className="text-[11px] font-black text-slate-800 block">
                                  🎁 রেজিস্ট্রেশনের পর কতদিন ইনস্ট্যান্ট ফ্রি (Days)
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={cfgPhoneChangeFreeDays}
                                    onChange={(e) => setCfgPhoneChangeFreeDays(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-amber-500"
                                  />
                                  <span className="text-xs font-bold text-slate-600 shrink-0">দিন</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  {cfgPhoneChangeFreeDays === 0 ? '1ম দিন থেকেই এডমিন রিকোয়েস্ট ও চার্জ প্রযোজ্য' : `অ্যাকাউন্ট তৈরির ${cfgPhoneChangeFreeDays} দিন পর্যন্ত ফ্রিতে ও বিনা রিকোয়েস্টে পরিবর্তন`}
                                </p>
                              </div>

                              {/* 2. Fee Step Increment */}
                              <div className="bg-white/90 p-3.5 rounded-2xl border border-amber-200/80 space-y-1.5">
                                <label className="text-[11px] font-black text-slate-800 block">
                                  📈 5 দিন পার হলে পরিবর্তন সার্ভিস চার্জ (Fee)
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-amber-700">৳</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="5"
                                    value={cfgPhoneChangeFeeIncrement}
                                    onChange={(e) => setCfgPhoneChangeFeeIncrement(Math.max(0, parseFloat(e.target.value) || 0))}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-amber-500"
                                  />
                                  <span className="text-xs font-bold text-slate-600 shrink-0">টাকা</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  {cfgPhoneChangeFreeDays} দিন অতিক্রম করার পর প্রতি পরিবর্তনে ৳{cfgPhoneChangeFeeIncrement} সার্ভিস চার্জ
                                </p>
                              </div>

                              {/* 3. Maximum Fee Cap */}
                              <div className="bg-white/90 p-3.5 rounded-2xl border border-amber-200/80 space-y-1.5">
                                <label className="text-[11px] font-black text-slate-800 block">
                                  🛡️ সর্বোচ্চ চার্জ সীমা (Maximum Fee)
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-amber-700">৳</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="5"
                                    value={cfgPhoneChangeMaxFee}
                                    onChange={(e) => setCfgPhoneChangeMaxFee(Math.max(0, parseFloat(e.target.value) || 0))}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-amber-500"
                                  />
                                  <span className="text-xs font-bold text-slate-600 shrink-0">টাকা</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  ফি যতই বাড়ুক, সর্বোচ্চ ৳{cfgPhoneChangeMaxFee} টাকার বেশি কাটা হবে না
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <div className="text-[11px] text-amber-900 font-bold bg-amber-100/80 border border-amber-300 px-3 py-1.5 rounded-xl">
                                💡 <strong>কার্যকর নীতি:</strong> অ্যাকাউন্ট তৈরির প্রথম {cfgPhoneChangeFreeDays} দিন কোনো এডমিন রিকোয়েস্ট ছাড়াই ইনস্ট্যান্ট ফ্রিতে নম্বর পরিবর্তন করা যাবে। {cfgPhoneChangeFreeDays} দিন পার হলে এডমিন রিকোয়েস্ট ও ৳{cfgPhoneChangeFeeIncrement} চার্জ প্রযোজ্য হবে।
                              </div>
                              <button
                                type="button"
                                onClick={handleSavePhoneChangeConfig}
                                disabled={cfgSaving}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <span>💾 কনফিগারেশন সেভ করুন</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {(approvalsSubTab === 'all' || approvalsSubTab === 'phone_requests') && pendingPhoneReqs.length > 0 && (
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                📱 মোবাইল নম্বর পরিবর্তনের আবেদনসমূহ ({pendingPhoneReqs.length} টি)
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {pendingPhoneReqs.map((pr, idx) => (
                                <div 
                                  key={`${pr.id}-${idx}`}
                                  className="p-3 bg-amber-50/50 border border-amber-300 hover:border-amber-400 border-l-4 border-l-amber-500 rounded-2xl transition duration-150 space-y-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                      <span className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full border border-amber-600 bg-amber-500 text-slate-950 shadow-2xs">
                                        📱 নম্বর পরিবর্তন
                                      </span>
                                      <h4 className="text-xs font-black text-slate-900">{pr.userName}</h4>
                                      {pr.memberId && (
                                        <span className="text-[10px] font-mono font-bold text-slate-600 bg-white border border-amber-200 px-2 py-0.5 rounded-md">
                                          ID: {pr.memberId}
                                        </span>
                                      )}
                                      <span className="text-xs font-mono font-black text-rose-700 bg-white border border-rose-200 px-2 py-0.5 rounded-lg line-through">
                                        {pr.currentPhone}
                                      </span>
                                      <span className="text-xs font-black text-slate-400">➔</span>
                                      <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-lg">
                                        {pr.newPhone}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleApprovePhoneRequest(pr)}
                                        className="px-3 py-1.5 bg-[#009273] hover:bg-[#007b61] text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1"
                                      >
                                        ✓ নম্বর পরিবর্তন অনুমোদন
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRejectPhoneRequest(pr)}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer"
                                      >
                                        বাতিল
                                      </button>
                                    </div>
                                  </div>

                                  {pr.reason && (
                                    <div className="bg-white/90 p-2 rounded-xl border border-amber-200 text-[11px] text-slate-700">
                                      💬 <strong>পরিবর্তনের কারণ:</strong> {pr.reason}
                                    </div>
                                  )}
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    আবেদনের সময়: {pr.requestedAt ? new Date(pr.requestedAt).toLocaleString('bn-BD') : 'N/A'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {approvalsSubTab === 'phone_requests' && pendingPhoneReqs.length === 0 && (
                          <div className="text-center py-12 space-y-2">
                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl border border-amber-100">
                              📱
                            </div>
                            <h4 className="text-xs font-bold text-slate-800">কোনো মোবাইল নম্বর পরিবর্তনের আবেদন নেই</h4>
                            <p className="text-[11px] text-slate-500">সকল আবেদন অনুমোদিত বা নিষ্পত্তি করা হয়েছে।</p>
                          </div>
                        )}

                        {/* 2. AGENT & REPRESENTATIVE APPLICATIONS */}
                        {(approvalsSubTab === 'all' || approvalsSubTab === 'agents') && pendingAgents.length > 0 && (
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                💼 BNB এজেন্ট ও প্রতিনিধি আবেদনসমূহ ({pendingAgents.length} টি)
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {pendingAgents.map((ag, idx) => {
                                const reqKey = ag.id || `agent_${ag.phone}`;
                                const isExpanded = expandedReqIds[reqKey] || false;

                                return (
                                  <div 
                                    key={`${ag.id}-${idx}`} 
                                    className="p-3 bg-amber-50/40 border border-amber-300 hover:border-amber-400 border-l-4 border-l-amber-600 rounded-2xl transition duration-150 space-y-2"
                                  >
                                    {/* Top Bar */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <span className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full border border-amber-700 bg-amber-600 text-white shadow-2xs">
                                          ⭐ এজেন্ট / প্রতিনিধি আবেদন
                                        </span>
                                        <h4 className="text-xs font-black text-slate-900 truncate">{ag.name || ag.fullName || 'এজেন্ট আবেদনকারী'}</h4>
                                        <span className="text-[10px] font-mono font-extrabold text-slate-600 bg-white/80 border border-amber-200 px-2 py-0.5 rounded-md">
                                          📱 {ag.phone || ag.mobile}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => toggleReqExpanded(reqKey)}
                                          className="px-2.5 py-1 text-[10px] font-black bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                        >
                                          {isExpanded ? 'সংক্ষিপ্ত করুন 🔼' : 'আরো দেখুন 🔽'}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                      <div className="pt-2 border-t border-amber-200/80 space-y-2 text-xs">
                                        <div className="bg-white p-2.5 rounded-xl border border-amber-200 space-y-1">
                                          <p className="text-slate-700 font-medium">📍 এলাকা/ঠিকানাঃ <strong className="text-slate-900">{ag.address || ag.district || 'N/A'}</strong></p>
                                          {ag.experience && <p className="text-slate-600 text-[11px]">💼 কাজের অভিজ্ঞতাঃ {ag.experience}</p>}
                                          {ag.lat && ag.lng && (
                                            <p className="text-emerald-700 font-mono text-[10px] font-bold flex items-center gap-1">
                                              🌐 জিপিএস জিউ-লোকেশনঃ {ag.lat}, {ag.lng}
                                              <a 
                                                href={`https://www.google.com/maps/search/?api=1&query=${ag.lat},${ag.lng}`} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="text-teal-600 hover:underline font-extrabold ml-1"
                                              >
                                                (ম্যাপে দেখুন ↗)
                                              </a>
                                            </p>
                                          )}
                                        </div>

                                        <div className="flex gap-2 justify-end pt-1">
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateAgentRequestStatus(ag.id, 'approved')}
                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1"
                                          >
                                            ✓ অনুমোদন ও ম্যাপে যুক্ত করুন
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateAgentRequestStatus(ag.id, 'rejected')}
                                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl transition cursor-pointer"
                                          >
                                            বাতিল
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Collapsed Bar */}
                                    {!isExpanded && (
                                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-200/60">
                                        <span className="text-[10px] font-bold text-slate-600">
                                          📍 এলাকা: {ag.district || ag.address || 'N/A'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateAgentRequestStatus(ag.id, 'approved')}
                                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer shadow-2xs"
                                          >
                                            ✓ অনুমোদন
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateAgentRequestStatus(ag.id, 'rejected')}
                                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold rounded-lg transition cursor-pointer"
                                          >
                                            বাতিল
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 2. AGENT & REPRESENTATIVE APPLICATIONS */}
                        {(approvalsSubTab === 'all' || approvalsSubTab === 'agents') && pendingAgents.length > 0 && (
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                💼 BNB এজেন্ট ও প্রতিনিধি আবেদনসমূহ ({pendingAgents.length} টি)
                              </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {pendingAgents.map((ag, idx) => (
                                <div key={`${ag.id}-${idx}`} className="bg-amber-50/50 border border-amber-200 p-5 rounded-2xl space-y-3 hover:shadow-2xs transition">
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <h4 className="text-sm font-bold text-slate-900">{ag.name || ag.fullName || 'এজেন্ট আবেদনকারী'}</h4>
                                      <p className="text-xs text-slate-600 font-mono">📱 {ag.phone || ag.mobile}</p>
                                    </div>
                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full uppercase shrink-0">
                                      💼 এজেন্ট আবেদন
                                    </span>
                                  </div>

                                  <div className="bg-white p-3 rounded-xl border border-amber-150 text-xs space-y-1">
                                    <p className="text-slate-700 font-medium">📍 ঠিকানা/এলাকাঃ <span className="font-bold">{ag.address || ag.district || 'N/A'}</span></p>
                                    {ag.experience && <p className="text-slate-600 text-[11px]">📝 বিবরণঃ {ag.experience}</p>}
                                    {ag.lat && ag.lng && (
                                      <p className="text-emerald-700 font-mono text-[10px] font-bold">
                                        🌐 জিও-লোকেশনঃ {ag.lat}, {ag.lng}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateAgentRequestStatus(ag.id, 'approved')}
                                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                                    >
                                      ✓ অনুমোদন ও ম্যাপে যুক্ত করুন
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateAgentRequestStatus(ag.id, 'rejected')}
                                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl transition cursor-pointer"
                                    >
                                      বাতিল
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TELECOM ADMIN SECTION */}
    </>
  );
}
