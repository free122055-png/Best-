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

export function AdminAgentSection(props: any) {
  const {
    adminTab,
    y,
    text,
    left,
    agentRequestSuccessMsg,
    agentRequestErrorMsg,
    cfgAllowManualAgentLocation,
    type,
    handleToggleAllowManualAgentLocation,
    setAgentAdminSubTab,
    agentAdminSubTab,
    adminAgentRequests,
    list,
    adminAgents,
    loadingAgentRequests,
    isPending,
    isApproved,
    isRejected,
    id,
    docId,
    expandedReqIds,
    users,
    targetUser,
    u,
    uid,
    userId,
    key,
    toggleReqExpanded,
    target,
    agentActionId,
    handleUpdateAgentRequestStatus,
    handleAddAgent,
    newAgentName,
    setNewAgentName,
    newAgentPhone,
    setNewAgentPhone,
    newAgentRole,
    setNewAgentRole,
    newAgentCountry,
    setNewAgentCountry,
    newAgentCity,
    setNewAgentCity,
    newAgentImg,
    setNewAgentImg,
    newAgentDistrict,
    setNewAgentDistrict,
    newAgentThana,
    setNewAgentThana,
    newAgentPostOffice,
    setNewAgentPostOffice,
    newAgentBdX,
    setNewAgentBdX,
    newAgentBdY,
    setNewAgentBdY,
    newAgentLat,
    setNewAgentLat,
    newAgentLng,
    setNewAgentLng,
    addingAgent,
    loadingAdminAgents,
    img,
    q,
    name,
    setTrackingAgent,
    setShowTrackingModal,
    handleDeleteAgent
  } = props;

  return (
    <>
        {adminTab === 'agent_admin' && (
          <div className="space-y-6 animate-fade-in text-slate-255 text-left font-sans">
            <div className="bg-slate-50 border border-slate-200/80 p-6 rounded-3xl">
              <div className="border-b border-slate-200/80 pb-4 mb-5">
                <h2 className="text-base sm:text-lg font-black text-emerald-450 flex items-center gap-2">
                  💼 AMB কো-অপারেティブ ক্যারিয়ার ও এজেন্ট রিক্রুটিং সেল
                </h2>
                <p className="text-xs text-slate-450 mt-1 font-semibold leading-relaxed">
                  এখানে সারা বাংলাদেশ ও বিশ্বজুড়ে সমবায় সদস্যদের সাবমিট করা AMB এজেন্ট পার্টনারশিপ আবেদনগুলো অনুমোদন করতে পারবেন এবং সরাসরি নতুন এজেন্টদের পজিশন সেট ও ডিলিট করতে পারবেন।
                </p>
              </div>

              {/* Success and Error messages */}
              {agentRequestSuccessMsg && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl text-xs text-emerald-400 font-bold mb-4">
                  ✓ {agentRequestSuccessMsg}
                </div>
              )}

              {agentRequestErrorMsg && (
                <div className="bg-rose-950/40 border border-rose-500/30 p-4 rounded-xl text-xs text-rose-450 font-bold mb-4">
                  ⚠️ {agentRequestErrorMsg}
                </div>
              )}

              {/* GPS Auto Location vs Manual Input Toggle Card */}
              <div className="bg-white border border-emerald-200 p-4.5 rounded-2xl mb-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-black">📍</span>
                    <h3 className="text-xs font-black text-slate-800">
                      আবেদনপত্র সেটিংসঃ এজেন্ট ফর্মের জেলা ও থানা ইনপুট পদ্ধতি
                    </h3>
                    <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full border ${
                      cfgAllowManualAgentLocation 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {cfgAllowManualAgentLocation ? '✍️ ম্যানুয়াল ইনপুট চালু' : '🌐 অটো জিপিএস সিলেক্ট (ডিফল্ট)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    {cfgAllowManualAgentLocation 
                      ? 'চালু রয়েছেঃ সদস্যরা জেলা ও থানা ম্যানুয়ালি টাইপ করে লিখতে পারছে (যেসব ফোনে জিপিএস অচল তাদের জন্য অনুমোদিত)।' 
                      : 'বন্ধ রয়েছে (ডিফল্ট): সদস্যরা ম্যানুয়ালি টাইপ করতে পারবে না। আবেদনকারীদের জেলা ও থানা সরাসরি ম্যাপ জিপিএস থেকে অটো সিলেক্ট হবে।'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleAllowManualAgentLocation(!cfgAllowManualAgentLocation)}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center gap-2 ${
                    cfgAllowManualAgentLocation
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  {cfgAllowManualAgentLocation ? (
                    <span>🔒 বন্ধ করুন (অটো জিপিএস মোড সক্রিয় করুন)</span>
                  ) : (
                    <span>🔓 ম্যানুয়াল টাইপিং অনুমোদন দিন</span>
                  )}
                </button>
              </div>

              {/* Segmented control for Recruitment cell */}
              <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200/80 mb-6 gap-2">
                <button
                  type="button"
                  onClick={() => setAgentAdminSubTab('requests')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    agentAdminSubTab === 'requests' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⏳ আবেদনপত্র সমূহ ({adminAgentRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAgentAdminSubTab('list')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    agentAdminSubTab === 'list' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ➕ এজেন্ট যুক্ত ও পজিশন সেটআপ ({adminAgents.length})
                </button>
              </div>

              {/* Sub-tab 1: Applications list */}
              {agentAdminSubTab === 'requests' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-2">সমবায়ীদের এজেন্ট পার্টনারশিপ নিবেদন</h3>
                  
                  {loadingAgentRequests ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-2">
                      <span className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-500 font-bold">আবেদনপত্র তালিকা রিফ্রেশ হচ্ছে...</span>
                    </div>
                  ) : adminAgentRequests.length > 0 ? (
                    <div className="space-y-2">
                      {adminAgentRequests.map((req, idx) => {
                        const isPending = req.status === 'pending';
                        const isApproved = req.status === 'approved';
                        const isRejected = req.status === 'rejected';

                        const reqKey = req.id || (req as any).docId || `agent_${req.phone}_${req.appliedAtStr}`;
                        const isExpanded = expandedReqIds[reqKey] || false;

                        // Match applicant from users list to determine category
                        const targetUser = users.find(u => u.uid === req.userId || u.phone === req.phone || (req.mobile && u.phone === req.mobile));
                        const isSamityApplicant = Boolean(
                          (targetUser && (targetUser.samityStatus === 'approved' || targetUser.samitySchemeActive || (targetUser.savings && targetUser.savings > 0) || (targetUser.shares && targetUser.shares > 0))) ||
                          req.applicantType === 'samity' || req.isSamityUser || req.userCategory === 'samity' || req.isSamityMember
                        );

                        let categoryBadgeText = '⭐ এজেন্ট / প্রতিনিধি আবেদন';
                        let categoryBadgeStyle = 'bg-amber-600 text-white border-amber-700 shadow-2xs';
                        let cardThemeStyle = 'bg-amber-50/40 border-amber-300 hover:border-amber-400 border-l-4 border-l-amber-600';

                        if (isSamityApplicant) {
                          categoryBadgeText = '🏢 সমবায় সমিতি সদস্য আবেদন';
                          categoryBadgeStyle = 'bg-emerald-600 text-white border-emerald-700 shadow-2xs';
                          cardThemeStyle = 'bg-emerald-50/40 border-emerald-300 hover:border-emerald-400 border-l-4 border-l-emerald-600';
                        } else if (targetUser) {
                          categoryBadgeText = '📱 সাধারণ সদস্যের এজেন্ট আবেদন';
                          categoryBadgeStyle = 'bg-sky-600 text-white border-sky-700 shadow-2xs';
                          cardThemeStyle = 'bg-sky-50/40 border-sky-300 hover:border-sky-400 border-l-4 border-l-sky-600';
                        }

                        return (
                          <div 
                            key={`${req.id}-${idx}`} 
                            className={`p-3.5 border rounded-2xl transition duration-150 space-y-2 ${cardThemeStyle}`}
                          >
                            {/* Top Bar: Badges, Name, Phone & Toggle */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full border ${categoryBadgeStyle}`}>
                                  {categoryBadgeText}
                                </span>
                                <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full border ${
                                  isPending 
                                    ? 'bg-amber-100 text-amber-900 border-amber-300' 
                                    : isApproved 
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                                      : 'bg-rose-100 text-rose-900 border-rose-300'
                                }`}>
                                  {isPending ? '⏳ রিভিউ পেন্ডিং' : isApproved ? '✓ অনুমোদিত এজেন্ট (ম্যাপে সচল)' : '❌ বাতিল'}
                                </span>
                                <h4 className="text-xs font-black text-slate-900 truncate">{req.userName || req.fullName || 'নামহীন আবেদনকারী'}</h4>
                                <span className="text-[10px] font-mono font-extrabold text-slate-600 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-md">
                                  📱 {req.phone}
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

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="pt-2 border-t border-slate-200/80 space-y-2.5 animate-fadeIn text-xs">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 bg-white/90 p-2.5 rounded-xl border border-slate-200 text-xs">
                                  <p className="flex items-center gap-1.5">
                                    <span>📱</span> 
                                    <strong className="text-slate-500">ফোনঃ</strong> 
                                    <span className="text-slate-900 font-mono font-extrabold select-all">{req.phone}</span>
                                  </p>
                                  <p className="flex items-center gap-1.5">
                                    <span>💬</span> 
                                    <strong className="text-slate-500">হোয়াটসঅ্যাপঃ</strong> 
                                    <span className="text-slate-900 font-mono font-extrabold select-all">{req.whatsapp || req.phone}</span>
                                  </p>
                                  <p className="flex items-center gap-1.5">
                                    <span>📧</span> 
                                    <strong className="text-slate-500">ইমেইলঃ</strong> 
                                    <span className="text-slate-900 font-semibold">{req.email || 'দেওয়া হয়নি'}</span>
                                  </p>
                                  <p className="flex items-center gap-1.5">
                                    <span>📍</span> 
                                    <strong className="text-slate-500">এলাকা ও জেলাঃ</strong> 
                                    <span className="text-slate-900 font-extrabold">{req.area || 'N/A'}, {req.district || 'N/A'}</span>
                                  </p>
                                  <p className="flex items-center gap-1.5 col-span-1 md:col-span-2">
                                    <span>🛰️</span> 
                                    <strong className="text-slate-500">জিপিএস স্থানাঙ্ক (GPS):</strong> 
                                    {req.lat && req.lng ? (
                                      <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 select-all font-mono">
                                        {Number(req.lat).toFixed(6)}, {Number(req.lng).toFixed(6)}
                                        <a 
                                          href={`https://www.google.com/maps/search/?api=1&query=${req.lat},${req.lng}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-teal-600 hover:underline font-black text-[10px] ml-1"
                                        >
                                          (ম্যাপে দেখুন ↗)
                                        </a>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-semibold italic">সনাক্ত করা হয়নি</span>
                                    )}
                                  </p>
                                </div>

                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1">
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">অভিজ্ঞতা ও মোটিভেশন বিবরণীঃ</p>
                                  <p className="text-xs text-slate-700 font-medium">
                                    💼 <strong className="text-slate-800">কাজের অভিজ্ঞতাঃ</strong> <span className="font-extrabold text-amber-700">{req.experience || 'কোনো পূর্ব অভিজ্ঞতা নেই'}</span>
                                  </p>
                                  <p className="text-xs text-slate-600 bg-slate-50 p-2 border border-slate-200 rounded-lg font-medium leading-relaxed">
                                    "{req.motivation || 'কোনো মোটিভেশনাল বিবরণী দেওয়া হয়নি'}"
                                  </p>
                                </div>

                                {isPending && (
                                  <div className="flex justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      disabled={agentActionId === req.id}
                                      onClick={() => handleUpdateAgentRequestStatus(req.id, 'approved')}
                                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                                    >
                                      {agentActionId === req.id ? (
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <>✓ অনুমোদন ও সচল করুন</>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={agentActionId === req.id}
                                      onClick={() => handleUpdateAgentRequestStatus(req.id, 'rejected')}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                                    >
                                      বাতিল করুন
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Collapsed Compact View */}
                            {!isExpanded && (
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                                <span className="text-[10px] font-bold text-slate-600">
                                  📍 এলাকা: {req.area || 'N/A'}, {req.district || 'N/A'}
                                </span>
                                {isPending ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={agentActionId === req.id}
                                      onClick={() => handleUpdateAgentRequestStatus(req.id, 'approved')}
                                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer shadow-2xs"
                                    >
                                      ✓ অনুমোদন
                                    </button>
                                    <button
                                      type="button"
                                      disabled={agentActionId === req.id}
                                      onClick={() => handleUpdateAgentRequestStatus(req.id, 'rejected')}
                                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold rounded-lg transition cursor-pointer"
                                    >
                                      বাতিল
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {isApproved ? 'অনুমোদিত' : 'বাতিলকৃত'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 border border-dashed border-slate-200/80 rounded-3xl text-center text-slate-500 text-xs font-extrabold">
                      কোনো এজেন্ট আবেদনপত্র জমা পাওয়া যায়নি।
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 2: Direct Agent Management and Positioning */}
              {agentAdminSubTab === 'list' && (
                <div className="space-y-6">
                  {/* Part A: Add new Agent Form */}
                  <form onSubmit={handleAddAgent} className="p-5 bg-white border border-slate-200/80 rounded-3xl space-y-4">
                    <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                      ➕ নতুন লাইভ এজেন্ট পজিশন সেটআপ খতিয়ান
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">এজেন্টের নাম (Name)*</label>
                        <input
                          type="text"
                          required
                          value={newAgentName}
                          onChange={(e) => setNewAgentName(e.target.value)}
                          placeholder="উদাঃ শাকিল আহমেদ"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-900 rounded-xl focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">মোবাইল নম্বর (Phone)*</label>
                        <input
                          type="text"
                          required
                          value={newAgentPhone}
                          onChange={(e) => setNewAgentPhone(e.target.value)}
                          placeholder="+880 1XXXXXXXXX"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-900 rounded-xl focus:outline-none focus:border-emerald-500 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">রোল (Role)</label>
                        <select
                          value={newAgentRole}
                          onChange={(e) => setNewAgentRole(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-900 rounded-xl focus:outline-none focus:border-emerald-500 text-xs"
                        >
                          <option value="এজেন্ট">এজেন্ট (Agent)</option>
                          <option value="পরিচিত সদস্য">পরিচিত সদস্য (Trusted Member)</option>
                          <option value="সদস্য">কো-অপারেটিভ সদস্য (Member)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">দেশ (Country)</label>
                        <select
                          value={newAgentCountry}
                          onChange={(e) => setNewAgentCountry(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-900 rounded-xl focus:outline-none focus:border-emerald-500 text-xs"
                        >
                          <option value="Bangladesh">🇧🇩 Bangladesh</option>
                          <option value="UAE">🇦🇪 UAE</option>
                          <option value="Singapore">🇸🇬 Singapore</option>
                          <option value="Malaysia">🇲🇾 Malaysia</option>
                          <option value="United States">🇺🇸 United States</option>
                          <option value="United Kingdom">🇬🇧 United Kingdom</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">শহর ও অবস্থান (City/Location)*</label>
                        <input
                          type="text"
                          required
                          value={newAgentCity}
                          onChange={(e) => setNewAgentCity(e.target.value)}
                          placeholder="উদাঃ গুলশান 1, ঢাকা"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-900 rounded-xl focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">ছবি লিঙ্ক (Avatar URL - Optional)</label>
                        <input
                          type="text"
                          value={newAgentImg}
                          onChange={(e) => setNewAgentImg(e.target.value)}
                          placeholder="ফাঁকা রাখলে ডিফল্ট প্রোফাইল ছবি ব্যবহৃত হবে"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-900 rounded-xl focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>
                    </div>

                    {/* বিস্তারিত ঠিকানা মডিউল (Detailed Address Section) */}
                    <div className="border-t border-slate-900 pt-3">
                      <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        📍 এজেন্টের বিস্তারিত স্থায়ী ঠিকানা (Detailed Address)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">জেলা (District)*</label>
                          <input
                            type="text"
                            required
                            value={newAgentDistrict}
                            onChange={(e) => setNewAgentDistrict(e.target.value)}
                            placeholder="উদাঃ ঢাকা"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-900 rounded-xl focus:outline-none focus:border-emerald-500 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">থানা / উপজেলা (Thana)*</label>
                          <input
                            type="text"
                            required
                            value={newAgentThana}
                            onChange={(e) => setNewAgentThana(e.target.value)}
                            placeholder="উদাঃ গুলশান"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-900 rounded-xl focus:outline-none focus:border-emerald-500 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">পোস্ট অফিস / গ্রাম (Post Office / Village)*</label>
                          <input
                            type="text"
                            required
                            value={newAgentPostOffice}
                            onChange={(e) => setNewAgentPostOffice(e.target.value)}
                            placeholder="উদাঃ গুলশান 1"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 text-slate-900 rounded-xl focus:outline-none focus:border-emerald-500 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                      <h4 className="text-[10.5px] font-black text-amber-400 uppercase tracking-wider">
                        📍 ইন্টারেক্টিভ ম্যাপ কো-অর্ডিনেট পজিশনিং (Map Coordinates %):
                      </h4>
                      <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                        এজেন্টকে ম্যাপের নির্দিষ্ট অবস্থানে পিন করতে নিচের ডিস্ট্যান্স রুল পার্সেন্টেজ লিখুন (0-100 এর মান)। বাংলাদেশ ম্যাপের অবস্থানই অগ্রাধিকার পাবে।
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 mb-0.5">বাংলাদেশ ম্যাপে X (45-80)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={newAgentBdX}
                            onChange={(e) => setNewAgentBdX(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200/80 text-amber-300 rounded-lg text-xs font-mono text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 mb-0.5">বাংলাদেশ ম্যাপে Y (40-80)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={newAgentBdY}
                            onChange={(e) => setNewAgentBdY(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200/80 text-amber-300 rounded-lg text-xs font-mono text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 mb-0.5">বিশ্ব ম্যাপে Lat % (40-70)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={newAgentLat}
                            onChange={(e) => setNewAgentLat(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200/80 text-slate-350 rounded-lg text-xs font-mono text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 mb-0.5">বিশ্ব ম্যাপে Lng % (30-70)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={newAgentLng}
                            onChange={(e) => setNewAgentLng(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200/80 text-slate-350 rounded-lg text-xs font-mono text-center"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={addingAgent}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-55 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20"
                    >
                      {addingAgent ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          সংরক্ষণ হচ্ছে...
                        </>
                      ) : (
                        <>✓ নতুন এজেন্ট যুক্ত করুন</>
                      )}
                    </button>
                  </form>

                  {/* Part B: Enrolled live agents list and deleting capability */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest border-b border-slate-100 pb-2">
                      📋 বর্তমান সচল ডাটাবেস লাইভ এজেন্টসমূহ ({adminAgents.length} জন)
                    </h3>

                    {loadingAdminAgents ? (
                      <div className="py-8 text-center text-xs text-slate-500 font-bold">এজেন্ট ক্যাটালগ রিলোড হচ্ছে...</div>
                    ) : adminAgents.length > 0 ? (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200/80 font-black">
                              <th className="p-3">এজেন্ট</th>
                              <th className="p-3">অবস্থান ও দেশ</th>
                              <th className="p-3">যোগাযোগ (মোবাইল)</th>
                              <th className="p-3 text-center">স্ট্যাটাস ও জিপিএস স্থানাঙ্ক</th>
                              <th className="p-3 text-right">অ্যাকশন</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {adminAgents.map((agent, idx) => (
                              <tr key={`${agent.id}-${idx}`} className="hover:bg-slate-50 transition">
                                <td className="p-3 font-semibold text-slate-800">
                                  <div className="flex items-center gap-2">
                                    <img src={agent.img || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'} className="w-7 h-7 rounded-full object-cover border border-slate-200/80" referrerPolicy="no-referrer" />
                                    <div>
                                      <p className="font-extrabold text-xs text-slate-950">{agent.name}</p>
                                      <span className="text-[9px] text-[#0D9488] font-bold">{agent.role}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 text-slate-600">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1">
                                      <span>{agent.flag}</span>
                                      <span className="font-bold text-slate-800">{agent.city}</span>
                                    </div>
                                    {(agent.district || agent.thana || agent.postOffice) && (
                                      <p className="text-[10px] text-slate-500 font-medium">
                                        📍 {[agent.postOffice, agent.thana, agent.district].filter(Boolean).join(', ')}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 font-mono font-bold text-slate-800">{agent.phone}</td>
                                <td className="p-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="flex items-center gap-1">
                                      {agent.isOnline ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full animate-pulse">
                                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                          🟢 অ্যাপে সক্রিয় (লাইভ)
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-full">
                                          ⚪ অফলাইন
                                        </span>
                                      )}
                                    </div>
                                    {agent.lat && agent.lng ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-[10px] font-mono font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                          {Number(agent.lat).toFixed(6)}, {Number(agent.lng).toFixed(6)}
                                        </span>
                                        <a 
                                          href={`https://www.google.com/maps/search/?api=1&query=${agent.lat},${agent.lng}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[9px] text-[#0D9488] hover:underline font-extrabold"
                                        >
                                          গুগল ম্যাপে দেখুন ↗
                                        </a>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-450 font-bold font-mono">
                                        bdX:{agent.bdX} | bdY:{agent.bdY}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {agent.lat && agent.lng && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTrackingAgent(agent);
                                          setShowTrackingModal(true);
                                        }}
                                        className="p-1.5 text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-lg border border-emerald-150 hover:border-emerald-600 transition flex items-center gap-1 text-[10px] font-black cursor-pointer"
                                        title="লাইভ ট্র্যাক করুন"
                                      >
                                        <MapIcon className="w-3 h-3" />
                                        <span>লাইভ ট্র্যাক</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAgent(agent.id)}
                                      className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg border border-rose-100 hover:border-rose-500 transition cursor-pointer"
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
                      <div className="py-12 border border-dashed border-slate-200/80 rounded-3xl text-center text-slate-500 text-xs font-extrabold">
                        কোনো কাস্টম লাইভ এজেন্ট এখনো ডাটাবেসে নিবন্ধিত নেই। ডিফল্ট মডিউল এজেন্টগুলো ম্যাপে সচল থাকবে।
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* TAB 13: CO-OPERATIVE RATION CARD ADMINISTRATION */}
    </>
  );
}
