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
import { User, Transaction, Notice, Offer, BapReport, BapGroup, BapAdminRequest, AppConfig, Product, UserNotification, CompanyFundAccount, AdminBroadcastLog, QardRuleItem, QardConfig, PhoneChangeRequest, SamityPolicyConfig, SamityFineTier, MandatoryNoticeConsent, MandatoryNoticeSlide, MandatoryNoticeMemberResponse } from '../../types';
import { normalizeMemberId, formatBanglaAmount, normalizePhoneNumber, findUserInFirestoreByPhone, getNextSequentialMemberId, deleteUserCompletelyFromDatabase, convertBengaliToEnglishDigits } from '../../lib/memberUtils';
import { sortTransactionsNewestFirst, getTxTime } from '../../lib/transactionUtils';
import { saveAppConfig, DEFAULT_QARD_CONFIG, DEFAULT_MANDATORY_NOTICE } from '../../lib/config';
import { AMBLogo } from '../AMBLogo';
import { HeaderPendingModal } from '../HeaderPendingModal';
import { MandatoryNoticeModal } from '../MandatoryNoticeModal';
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
  CalendarDays,
  Vote,
  MessageSquare
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

export function AdminNoticesBapSection(props: any) {
  const {
    currentUser = props.user || props.liveUser || {},
    setViewingGrid = () => {},
    transactions = [],
    handleApproveTransaction = () => {},
    handleRejectTransaction = () => {},
    handleSendPersonalNotification = () => {},
    personalNotifySuccess = false,
    personalNotifyError = '',
    personalNotifyMemberId = '',
    setPersonalNotifyMemberId = () => {},
    personalNotifyActionType = 'notice',
    setPersonalNotifyActionType = () => {},
    personalNotifyTitle = '',
    setPersonalNotifyTitle = () => {},
    personalNotifyBody = '',
    setPersonalNotifyBody = () => {},
    personalNotifyAmount = '',
    setPersonalNotifyAmount = () => {},
    loading = false,
    adminNotifications = [],
    handleDeleteAdminNotification = () => {},
    handlePostNotice = () => {},
    noticeSuccess = false,
    noticeTitle = '',
    setNoticeTitle = () => {},
    noticeSection = 'general',
    setNoticeSection = () => {},
    noticeContent = '',
    setNoticeContent = () => {},
    bapAdminReqs = [],
    handleApproveBapAdminRequest = () => {},
    handleRejectBapAdminRequest = () => {},
    bapGroups = [],
    handleApproveBapGroup = () => {},
    handleRejectBapGroup = () => {},
    bapReports = [],
    handleDeleteBapReport = () => {},
  } = props;

  const { ...rest } = props;
  const {
    adminTab,
    selectedUser,
    appConfig,
    users,
    notices,
    setNotices,
    noticeText,
    setNoticeText,
    noticeType,
    setNoticeType,
    handleAddNotice,
    handleDeleteNotice,
    handleToggleNoticeActive,
    formatBanglaAmount,
    ...allRest
  } = props;

  // Mandatory Notice & Poll System State
  const defaultNotice = appConfig?.mandatoryNotice || DEFAULT_MANDATORY_NOTICE;
  const [mandatoryNoticeState, setMandatoryNoticeState] = useState<MandatoryNoticeConsent>(defaultNotice);
  const [mandatorySaving, setMandatorySaving] = useState<boolean>(false);
  const [mandatorySuccess, setMandatorySuccess] = useState<boolean>(false);
  const [mandatoryError, setMandatoryError] = useState<string>('');
  const [showAdminNoticePreview, setShowAdminNoticePreview] = useState<boolean>(false);
  const [activeMandatorySubTab, setActiveMandatorySubTab] = useState<'settings' | 'slides' | 'responses'>('settings');
  const [mandatorySearchQuery, setMandatorySearchQuery] = useState<string>('');
  const [mandatoryResponseFilter, setMandatoryResponseFilter] = useState<'all' | 'agreed' | 'disagreed'>('all');
  const [expandedSlideIndex, setExpandedSlideIndex] = useState<number | null>(0);

  // Sync state if appConfig changes from Firestore
  useEffect(() => {
    if (appConfig?.mandatoryNotice) {
      setMandatoryNoticeState(appConfig.mandatoryNotice);
    }
  }, [appConfig?.mandatoryNotice]);

  const handleSaveMandatoryConfig = async (customState?: MandatoryNoticeConsent) => {
    setMandatorySaving(true);
    setMandatorySuccess(false);
    setMandatoryError('');
    const stateToSave = customState || mandatoryNoticeState;
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      await updateDoc(configRef, {
        mandatoryNotice: {
          ...stateToSave,
          updatedAt: new Date().toISOString()
        }
      });
      setMandatorySuccess(true);
      setTimeout(() => setMandatorySuccess(false), 3500);
    } catch (err: any) {
      console.error('Failed to save mandatory notice config:', err);
      setMandatoryError(err?.message || 'সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setMandatorySaving(false);
    }
  };

  const handleBroadcastMandatoryNotice = async () => {
    if (!window.confirm('⚠️ আপনি কি নিশ্চিত যে এই নিয়ম/মতামত পপআপটি সকল সদস্যদের অ্যাপে রিয়েল-টাইমে পাঠাতে চান?\n\nসদস্যরা অ্যাপে প্রবেশ করলেই এটি দেখতে পাবেন এবং মতামত না দিয়ে কোনো ফিচার ব্যবহার করতে পারবেন না।')) {
      return;
    }

    setMandatorySaving(true);
    try {
      const newVersion = (mandatoryNoticeState.version || 1) + 1;
      const newNoticeId = `notice_rule_${Date.now()}_v${newVersion}`;
      const updatedNotice: MandatoryNoticeConsent = {
        ...mandatoryNoticeState,
        id: newNoticeId,
        active: true,
        version: newVersion,
        updatedAt: new Date().toISOString()
      };

      setMandatoryNoticeState(updatedNotice);

      const configRef = doc(db, 'system_settings', 'app_config');
      await updateDoc(configRef, {
        mandatoryNotice: updatedNotice,
        mandatoryNoticeResponses: {} // Reset responses for the fresh notice version
      });

      alert('🎉 সফলভাবে সকল সদস্যদের অ্যাপে বাধ্যতামূলক পপআপ নোটিফিকেশন সম্প্রচার করা হয়েছে!');
      setMandatorySuccess(true);
      setTimeout(() => setMandatorySuccess(false), 3500);
    } catch (err: any) {
      console.error('Failed to broadcast mandatory notice:', err);
      alert('ত্রুটি হয়েছে: ' + err?.message);
    } finally {
      setMandatorySaving(false);
    }
  };

  const handleClearAllResponses = async () => {
    if (!window.confirm('আপনি কি সকল সদস্যের দেওয়া রেসপন্স ও মতামতের হিস্ট্রি ডিলিট করতে চান?')) return;
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      await updateDoc(configRef, {
        mandatoryNoticeResponses: {}
      });
      alert('✅ সফলভাবে সকল রেসপন্স ডেটা ক্লিয়ার করা হয়েছে।');
    } catch (err: any) {
      alert('ত্রুটি: ' + err?.message);
    }
  };

  const handleAddSlide = () => {
    const currentSlides = mandatoryNoticeState.slides || [];
    const newSlideNum = currentSlides.length + 1;
    const newSlide: MandatoryNoticeSlide = {
      id: `slide_${Date.now()}`,
      badge: mandatoryNoticeState.categoryBadge || 'নতুন নিয়ম',
      iconType: 'rules',
      title: `${newSlideNum}. নতুন নিয়ম শিরোনাম`,
      description: 'এই নিয়ম সম্পর্কে বিস্তারিত বিবরণ এখানে লিখুন...',
      bulletPoints: []
    };
    const updated = {
      ...mandatoryNoticeState,
      slides: [...currentSlides, newSlide]
    };
    setMandatoryNoticeState(updated);
    setExpandedSlideIndex(currentSlides.length);
  };

  const handleDeleteSlide = (index: number) => {
    const currentSlides = mandatoryNoticeState.slides || [];
    if (currentSlides.length <= 1) {
      alert('কমপক্ষে ১টি স্লাইড থাকতে হবে!');
      return;
    }
    const updated = {
      ...mandatoryNoticeState,
      slides: currentSlides.filter((_, idx) => idx !== index)
    };
    setMandatoryNoticeState(updated);
  };

  const handleUpdateSlide = (index: number, field: keyof MandatoryNoticeSlide, value: any) => {
    const currentSlides = [...(mandatoryNoticeState.slides || [])];
    currentSlides[index] = {
      ...currentSlides[index],
      [field]: value
    };
    setMandatoryNoticeState({
      ...mandatoryNoticeState,
      slides: currentSlides
    });
  };

  const responsesMap = appConfig?.mandatoryNoticeResponses || {};
  const allResponses: MandatoryNoticeMemberResponse[] = Object.values(responsesMap);
  const totalMandatoryResponses = allResponses.length;
  const totalAgreedResponses = allResponses.filter(r => r.agreed).length;
  const totalDisagreedResponses = allResponses.filter(r => !r.agreed).length;
  const agreementRate = totalMandatoryResponses > 0 ? Math.round((totalAgreedResponses / totalMandatoryResponses) * 100) : 0;

  const filteredResponses = allResponses.filter(r => {
    if (mandatoryResponseFilter === 'agreed' && !r.agreed) return false;
    if (mandatoryResponseFilter === 'disagreed' && r.agreed) return false;
    if (mandatorySearchQuery.trim()) {
      const q = mandatorySearchQuery.toLowerCase().trim();
      const matchName = r.userName?.toLowerCase().includes(q);
      const matchPhone = r.phone?.includes(q);
      const matchMemberId = r.memberId?.toLowerCase().includes(q);
      const matchFeedback = r.feedbackText?.toLowerCase().includes(q);
      return matchName || matchPhone || matchMemberId || matchFeedback;
    }
    return true;
  });

  return (
    <>
        {adminTab === 'telecom' && (
          <div className="space-y-6 animate-fade-in text-slate-800">
            <TelecomAdmin
              appConfig={appConfig}
              user={currentUser}
              onClose={() => setViewingGrid(true)}
              users={users}
              transactions={transactions}
              handleApproveTransaction={handleApproveTransaction}
              handleRejectTransaction={handleRejectTransaction}
            />
          </div>
        )}

        {/* TAB 5: OFFICIAL ANNOUNCEMENT BOARD / NOTICES */}
        {adminTab === 'notices' && (
          <div className="space-y-6 max-w-6xl mx-auto animate-fade-in text-slate-800 text-left font-sans">
            
            {/* 🔴 Section A: Bell Icon Notification & Balance Control Center */}
            <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center shrink-0">
                  <Bell className="w-6 h-6 animate-swing" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-black flex items-center gap-2 text-emerald-300">
                    🔔 সদস্যদের ওয়ালেট ব্যালেন্স কর্তন, বোনাস ও ইন-অ্যাপ নোটিফিকেশন সেন্টার
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans font-medium">
                    নির্দিষ্ট সদস্য বা সকল মেম্বারদের কাছে সরাসরি লাইভ নোটিফিকেশন পাঠান। বোনাস বা জরিমানার পরিমাণ প্রবেশ করালে রিয়েল-টাইমে ওয়ালেট ব্যালেন্স আপডেট হবে এবং সদস্যের অ্যাপে নোটিফিকেশন পৌঁছে যাবে।
                  </p>
                </div>
              </div>

              {/* Form container */}
              <div className="mt-6 bg-slate-850 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                <form onSubmit={handleSendPersonalNotification} className="space-y-4 text-left">
                  {personalNotifySuccess && (
                    <div className="bg-emerald-950 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-xl font-bold animate-pulse">
                      🎉 সফলভাবে নোটিফিকেশন পাঠানো হয়েছে এবং সদস্যদের ওয়ালেট ব্যালেন্স আপডেট হয়েছে!
                    </div>
                  )}

                  {personalNotifyError && (
                    <div className="bg-rose-955 border border-rose-500/30 text-rose-450 text-xs p-3 rounded-xl font-bold">
                      ⚠️ ভুল হয়েছে: {personalNotifyError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Select Member */}
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-extrabold text-slate-300 uppercase tracking-widest mb-1.5 font-sans">
                        মেম্বার নির্বাচন করুন (Target User)
                      </label>
                      <select
                        required
                        value={personalNotifyMemberId}
                        onChange={(e) => setPersonalNotifyMemberId(e.target.value)}
                        className="block w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-sans font-extrabold"
                      >
                        <option value="">-- মেম্বার সিলেক্ট করুন --</option>
                        <option value="all">📢 সকল মেম্বার (Broadcast to All)</option>
                        {users.map((u, idx) => (
                          <option key={`${u.uid}-${idx}`} value={u.uid}>
                            👤 {u.name} - {u.memberId || 'N/A'} ({u.phone})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Action Type */}
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-extrabold text-slate-300 uppercase tracking-widest mb-1.5 font-sans">
                        অ্যাকশন বা কাজের ধরণ
                      </label>
                      <select
                        required
                        value={personalNotifyActionType}
                        onChange={(e) => {
                          setPersonalNotifyActionType(e.target.value as any);
                          // Default body suggestions
                          if (e.target.value === 'bonus') {
                            setPersonalNotifyTitle('ঈদ উপলক্ষে বিশেষ বোনাস!');
                            setPersonalNotifyBody('প্রিয় কো-অপারেটিভ সদস্য, খুশির ঈদ উপলক্ষে আপনাকে বিশেষ বোনাস প্রদান করা হয়েছে। আপনার মেম্বার ড্যাশবোর্ডে গিয়ে ওয়ালেট ব্যালেন্স চেক করুন। আমাদের সাথে থাকার জন্য ধন্যবাদ!');
                          } else if (e.target.value === 'fine') {
                            setPersonalNotifyTitle('সদস্য নিয়ম ভঙ্গের জন্য ব্যালেন্স কর্তন');
                            setPersonalNotifyBody('প্রিয় সদস্য, কো-অপারেটিভের নীতিমালা লংঘন করার দরুন আপনার অ্যাকাউন্ট থেকে চার্জ কর্তন করা হয়েছে। বিস্তারিত জানতে অ্যাডমিন সাপোর্টে যোগাযোগ করুন।');
                          } else {
                            setPersonalNotifyTitle('কো-অপারেটিভের নতুন নির্দেশনা');
                            setPersonalNotifyBody('প্রিয় সদস্য, আপনার জন্য নতুন গুরুত্বপূর্ণ নির্দেশনা জারি করা হয়েছে। দয়া করে এটি মেনে চলুন।');
                          }
                        }}
                        className="block w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-sans font-extrabold"
                      >
                        <option value="notice">📢 সাধারণ ইন-আপ নোটিফিকেশন (No Wallet Update)</option>
                        <option value="bonus">🎁 বোনাস প্রদান করুন (Add to Wallet Balance)</option>
                        <option value="fine">⚠️ জরিমানা কর্তন করুন (Deduct from Wallet Balance)</option>
                      </select>
                    </div>

                    {/* Amount */}
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-extrabold text-slate-300 uppercase tracking-widest mb-1.5 font-sans">
                        টাকার পরিমাণ (Amount ৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={personalNotifyActionType === 'notice'}
                        value={personalNotifyAmount}
                        onChange={(e) => setPersonalNotifyAmount(e.target.value)}
                        placeholder={personalNotifyActionType === 'notice' ? 'প্রযোজ্য নয়' : 'যেমন: 50, 100, 500...'}
                        className="block w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-sans font-extrabold disabled:opacity-40"
                      />
                    </div>
                  </div>

                  {/* Title & Body Inputs (High contrast, clearly readable with no overlap) */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-300 uppercase tracking-widest mb-1.5 font-sans">
                        **নোটিফিকেশন শিরোনাম (Title) - টাইপ করার সময় লেখাটি ক্লিয়ার দেখা যাবে**
                      </label>
                      <input
                        type="text"
                        required
                        value={personalNotifyTitle}
                        onChange={(e) => setPersonalNotifyTitle(e.target.value)}
                        placeholder="যেমন: খুশির ঈদ উপলক্ষে বিশেষ বোনাস 50 টাকা"
                        className="block w-full px-4 py-3 bg-white border border-slate-350 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-sans font-extrabold shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-300 uppercase tracking-widest mb-1.5 font-sans">
                        **বিস্তারিত নোটিফিকেশন বার্তা (Message Body) - টাইপ করার সময় লেখাটি ক্লিয়ার দেখা যাবে**
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={personalNotifyBody}
                        onChange={(e) => setPersonalNotifyBody(e.target.value)}
                        placeholder="নোটিশের বিস্তারিত বিবরণ এখানে লিখুন..."
                        className="block w-full px-4 py-3 bg-white border border-slate-350 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-sans font-bold leading-relaxed shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Buttons (কুইক বাটনসমূহ) */}
                  <div className="flex flex-wrap gap-2 pt-1 font-sans">
                    <span className="text-[10px] font-black text-slate-400 self-center uppercase tracking-wide mr-1 font-sans">কুইক প্রিসেটঃ</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPersonalNotifyActionType('bonus');
                        setPersonalNotifyAmount('50');
                        setPersonalNotifyTitle('ঈদ উৎসব উপলক্ষে বিশেষ উপহার 50 টাকা!');
                        setPersonalNotifyBody('প্রিয় কো-অপারেটিভ সদস্য, পবিত্র ঈদ-উল-ফিতর উপলক্ষে কোম্পানি থেকে আপনাকে বিশেষ উপহার হিসেবে 50 টাকা ওয়ালেট বোনাস দেওয়া হয়েছে। মেম্বার ড্যাশবোর্ডে ব্যালেন্স চেক করুন!');
                      }}
                      className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-900/50 rounded-lg text-[10px] font-bold transition active:scale-95 cursor-pointer font-sans"
                    >
                      🎁 ঈদ উপহার (৳50)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPersonalNotifyActionType('bonus');
                        setPersonalNotifyAmount('100');
                        setPersonalNotifyTitle('কোম্পানি বাৎসরিক প্রফিট বোনাস 100 টাকা!');
                        setPersonalNotifyBody('প্রিয় কো-অপারেটিভ সদস্য, অভিনন্দন! আমাদের কোম্পানির বাৎসরিক অর্জিত মুনাফা হতে আপনার জন্য বিশেষ প্রফিট বোনাস হিসেবে 100 টাকা ওয়ালেট ব্যালেন্সে যোগ করা হয়েছে।');
                      }}
                      className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-900/50 rounded-lg text-[10px] font-bold transition active:scale-95 cursor-pointer font-sans"
                    >
                      🎁 প্রফিট বোনাস (৳100)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPersonalNotifyActionType('fine');
                        setPersonalNotifyAmount('20');
                        setPersonalNotifyTitle('সাপ্তাহিক কিস্তি খেলাপ করার জরিমানা');
                        setPersonalNotifyBody('প্রিয় সদস্য, আপনার নির্ধারিত কো-অপারেটিভ কিস্তি সময়মতো পরিশোধ না করায় নিয়মানুযায়ী 20 টাকা বিলম্ব জরিমানা কর্তন করা হয়েছে। দয়া করে কিস্তি পরিশোধ করুন।');
                      }}
                      className="px-3 py-1.5 bg-rose-955 hover:bg-rose-900 text-rose-400 border border-rose-900/50 rounded-lg text-[10px] font-bold transition active:scale-95 cursor-pointer font-sans"
                    >
                      ⚠️ কিস্তি জরিমানা (৳20)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPersonalNotifyActionType('notice');
                        setPersonalNotifyAmount('');
                        setPersonalNotifyTitle('কো-অপারেটিভ মাসিক মিটিং সংক্রান্ত নোটিশ');
                        setPersonalNotifyBody('প্রিয় সঞ্চয় ও ঋণ সমবায় সদস্যবৃন্দ, আগামী সাধারণ মিটিং অনুষ্ঠিত হবে। সকল সম্মানিত সদস্যদের উপস্থিতি একান্ত কাম্য।');
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-lg text-[10px] font-bold transition active:scale-95 cursor-pointer font-sans"
                    >
                      📢 সাধারণ মিটিং নোটিশ
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3.5 text-white font-extrabold rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md ${
                      personalNotifyActionType === 'bonus'
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'
                        : personalNotifyActionType === 'fine'
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    {personalNotifyActionType === 'bonus'
                      ? '🎁 সদস্যদের ওয়ালেটে বোনাস যোগ ও নোটিফিকেশন সম্প্রচার করুন'
                      : personalNotifyActionType === 'fine'
                      ? '⚠️ ওয়ালেট থেকে টাকা কর্তন ও সতর্কবার্তা প্রেরণ করুন'
                      : '📢 ইন-অ্যাপ নোটিফিকেশন বার্তা প্রেরণ করুন'}
                  </button>
                </form>
              </div>

              {/* Sent Personal/Admin Notifications Log */}
              <div className="mt-6 border-t border-slate-800 pt-6">
                <h4 className="text-xs font-black text-slate-300 flex items-center gap-1.5 uppercase tracking-wide mb-3 font-sans">
                  📜 সম্প্রতি প্রেরিত নোটিফিকেশন ও ব্যালেন্স এডজাস্টমেন্ট লগ ({adminNotifications.length})
                </h4>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {adminNotifications.length === 0 ? (
                    <p className="text-slate-500 text-xs text-center py-8 font-bold font-sans">বর্তমানে প্রেরিত কোনো ইন-অ্যাপ নোটিফিকেশন নেই।</p>
                  ) : (
                    adminNotifications.map((n, idx) => {
                      const isBroadcast = n.userId === 'all';
                      const targetUser = users.find(u => u.uid === n.userId);
                      return (
                        <div key={`${n.id}-${idx}`} className="bg-slate-850 border border-slate-800 p-3 rounded-xl flex items-start justify-between gap-3 shadow-3xs">
                          <div className="space-y-1.5 max-w-[85%] text-left">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded ${
                                isBroadcast ? 'bg-amber-950 text-amber-400 border border-amber-900/40' : 'bg-emerald-950 text-emerald-400 border border-emerald-900/40'
                              }`}>
                                {isBroadcast ? '📢 BROADCAST' : `👤 TO: ${targetUser ? targetUser.name : (n.memberId || 'UNKNOWN')}`}
                              </span>
                              {n.amount && (
                                <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded ${
                                  n.type === 'bonus' ? 'bg-emerald-955 text-emerald-400 border border-emerald-900/40' : 'bg-rose-955 text-rose-400 border border-rose-900/40'
                                }`}>
                                  {n.type === 'bonus' ? '+' : '-'} ৳{formatBanglaAmount(n.amount)}
                                </span>
                              )}
                              <span className="text-[8px] text-slate-500 font-mono">
                                {n.createdAt ? new Date(n.createdAt).toLocaleDateString('bn-BD') : ''}
                              </span>
                            </div>
                            <h5 className="text-[11px] font-black text-white">{n.title}</h5>
                            <p className="text-[10px] text-slate-400 font-medium whitespace-pre-line leading-relaxed font-sans">{n.body}</p>
                          </div>

                          <button
                            onClick={() => handleDeleteAdminNotification(n.id)}
                            className="text-rose-400 hover:text-white p-1.5 hover:bg-rose-950 border border-rose-900/30 rounded-lg shrink-0 cursor-pointer transition duration-150"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* 📢 Section B: General Slider Notice Manager */}
            <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Form */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="border-b border-slate-100 pb-3 text-left">
                    <h3 className="text-sm font-extrabold flex items-center gap-2 text-slate-900">
                      <Megaphone className="w-4 h-4 text-emerald-600" />
                      নতুন সাধারণ নোটিশ প্রকাশ (Home Slider)
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed font-sans">
                      অ্যাপের মেইন ড্যাশবোর্ড স্ক্রিনে স্লাইডার হিসেবে সচল থাকবে।
                    </p>
                  </div>

                  <form onSubmit={handlePostNotice} className="space-y-4 text-left">
                    {noticeSuccess && (
                      <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 text-xs p-2.5 rounded-xl font-bold animate-pulse">
                        ✓ নোটিশটি সফলভাবে লাইভ স্লাইডারে প্রকাশ করা হয়েছে!
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-650 uppercase tracking-widest mb-1.5 font-sans">
                        **নোটিশের শিরোনাম - টাইপ করার সময় লেখাটি ক্লিয়ার দেখা যাবে**
                      </label>
                      <input
                        type="text"
                        required
                        value={noticeTitle}
                        onChange={(e) => setNoticeTitle(e.target.value)}
                        placeholder="উদাঃ সঞ্চয় জমার সময়সূচি বদল"
                        className="block w-full px-4 py-3 bg-white border border-slate-350 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-sans font-extrabold shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-650 uppercase tracking-widest mb-1.5 font-sans">
                        নির্ধারিত সেকশন (Target Section)
                      </label>
                      <select
                        value={noticeSection}
                        onChange={(e) => setNoticeSection(e.target.value as any)}
                        className="block w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-sans font-extrabold"
                      >
                        <option value="general">সাধারণ নোটিশ (General Dashboard)</option>
                        <option value="telecom">টেলিকম নোটিশ (AMB Telecom)</option>
                        <option value="safe_deal">নিরাপদ ডিল নোটিশ (Safe Deals Escrow)</option>
                        <option value="samity">সমবায় সমিতি নোটিশ (Samity)</option>
                        <option value="bank">ব্যাংক নোটিশ (Bank Admin)</option>
                        <option value="shop">সুপার শপ নোটিশ (Super Shop)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-650 uppercase tracking-widest mb-1.5 font-sans">
                        **নোটিশের বিস্তারিত বিবরণ - টাইপ করার সময় লেখাটি ক্লিয়ার দেখা যাবে**
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={noticeContent}
                        onChange={(e) => setNoticeContent(e.target.value)}
                        placeholder="নোটিশের সবিস্তার বিবরণ এখানে লিখুন যা গ্রাহক স্লাইডারে ক্লিক করলে পড়তে পারবেন..."
                        className="block w-full px-4 py-3 bg-white border border-slate-350 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-sans font-bold leading-relaxed shadow-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      নতুন স্লাইডার নোটিশ পাবলিশ করুন
                    </button>
                  </form>
                </div>

                {/* Right Active List */}
                <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-5 lg:p-6 space-y-4 text-left font-sans">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-200 pb-2">
                    📢 লাইভ ড্যাশবোর্ড স্লাইডার নোটিশ বোর্ড ({notices.length})
                  </h4>

                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {notices.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-12 font-bold font-sans">বর্তমানে স্লাইডার নোটিশবোর্ডে কোনো নোটিশ নেই।</p>
                    ) : (
                      notices.map((n, idx) => (
                        <div key={`${n.id}-${idx}`} className="bg-white border border-slate-200 p-4 rounded-xl flex items-start justify-between gap-3 shadow-3xs">
                          <div className="space-y-1.5 max-w-[85%] text-left">
                            <div className="flex items-center gap-2">
                              <h5 className="text-[11.5px] font-black text-slate-900 leading-snug">{n.title}</h5>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded shrink-0 ${
                                n.section === 'telecom' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                                n.section === 'safe_deal' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                n.section === 'samity' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                n.section === 'bank' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                n.section === 'shop' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                                'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {n.section === 'telecom' ? 'Telecom' :
                                 n.section === 'safe_deal' ? 'Safe Deals' :
                                 n.section === 'samity' ? 'Samity' :
                                 n.section === 'bank' ? 'Bank' :
                                 n.section === 'shop' ? 'Shop' : 'General'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-sans font-medium whitespace-pre-line leading-relaxed">{n.content}</p>
                            {n.createdAt && (
                              <p className="text-[9px] text-slate-400 font-mono">
                                তারিখঃ {new Date(n.createdAt).toLocaleString('bn-BD')}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => handleDeleteNotice(n.id)}
                            className="text-rose-600 hover:text-white p-2 hover:bg-rose-650 border border-rose-200 rounded-lg shrink-0 cursor-pointer transition duration-150"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* 📋 Section C: সদস্যদের বাধ্যতামূলক নিয়ম কানুন সম্মতি ও লাইভ মতামত পপআপ কন্ট্রোল (Mandatory Rule & Poll Popup Manager) */}
            <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden text-left font-sans">
              <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 bg-teal-500/15 border border-teal-500/30 text-teal-300 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                    <Vote className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        📋 বাধ্যতামূলক নিয়ম-কানুন ও সদস্য মতামত পপআপ কন্ট্রোল
                      </h3>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        mandatoryNoticeState.active 
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40 animate-pulse' 
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {mandatoryNoticeState.active ? '● লাইভ সক্রিয় (Active)' : '○ নিষ্ক্রিয় (Off)'}
                      </span>
                      <span className="text-[10px] font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-900/50">
                        ভার্সন: v{mandatoryNoticeState.version || 1}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed mt-1">
                      এটি সক্রিয় থাকলে সদস্যরা অ্যাপ ওপেন করা মাত্রই স্ক্রিনে পূর্ণাঙ্গ পপআপ দেখতে পাবেন এবং মতামত/অনুমতি না দিয়ে কোনো অপশন চালাতে পারবেন না।
                    </p>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowAdminNoticePreview(true)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Eye className="w-4 h-4" />
                    <span>লাইভ প্রিভিউ দেখুন</span>
                  </button>

                  <button
                    type="button"
                    disabled={mandatorySaving}
                    onClick={handleBroadcastMandatoryNotice}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-900/30 active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>সবার জন্য নতুন করে পাঠান</span>
                  </button>

                  <button
                    type="button"
                    disabled={mandatorySaving}
                    onClick={() => handleSaveMandatoryConfig()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-900/30 active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{mandatorySaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সেভ করুন'}</span>
                  </button>
                </div>
              </div>

              {/* Notifications Messages */}
              {mandatorySuccess && (
                <div className="mt-4 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs p-3 rounded-xl font-bold flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>✓ পপআপ নোটিশ ও মতামত সেটিংস সফলভাবে রিয়েল-টাইমে সংরক্ষিত হয়েছে!</span>
                </div>
              )}
              {mandatoryError && (
                <div className="mt-4 bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs p-3 rounded-xl font-bold flex items-center gap-2 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>⚠️ ত্রুটি: {mandatoryError}</span>
                </div>
              )}

              {/* Stats Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                <div className="bg-slate-850 border border-slate-800 p-3.5 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">মোট মতামত রেসপন্স</span>
                  <span className="text-xl font-black text-white mt-1 block">{totalMandatoryResponses} জন</span>
                </div>
                <div className="bg-slate-850 border border-slate-800 p-3.5 rounded-2xl">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">✅ হ্যাঁ, সম্মত হয়েছেন</span>
                  <span className="text-xl font-black text-emerald-400 mt-1 block">{totalAgreedResponses} জন</span>
                </div>
                <div className="bg-slate-850 border border-slate-800 p-3.5 rounded-2xl">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">❌ না, অসম্মতি জানিয়েছেন</span>
                  <span className="text-xl font-black text-rose-400 mt-1 block">{totalDisagreedResponses} জন</span>
                </div>
                <div className="bg-slate-850 border border-slate-800 p-3.5 rounded-2xl">
                  <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">সম্মতির হার (Rate)</span>
                  <span className="text-xl font-black text-teal-300 mt-1 block">{agreementRate}%</span>
                </div>
              </div>

              {/* Sub-Tabs Switcher */}
              <div className="flex items-center gap-2 border-b border-slate-800 pt-6 pb-3 mt-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveMandatorySubTab('settings')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activeMandatorySubTab === 'settings'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'bg-slate-850 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>১. মূল সেটিংস ও প্রশ্নাবলী</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMandatorySubTab('slides')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activeMandatorySubTab === 'slides'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'bg-slate-850 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>২. স্লাইড কার্ড ম্যানেজার ({mandatoryNoticeState.slides?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMandatorySubTab('responses')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activeMandatorySubTab === 'responses'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'bg-slate-850 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>৩. সদস্যদের মতামতের অডিট তালিকা ({totalMandatoryResponses})</span>
                </button>
              </div>

              {/* Sub-Tab 1: Basic Settings & Question Form */}
              {activeMandatorySubTab === 'settings' && (
                <div className="mt-5 space-y-5 bg-slate-850 p-5 sm:p-6 rounded-2xl border border-slate-800">
                  
                  {/* Active State Toggle */}
                  <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-xs font-black text-white block">বাধ্যতামূলক পপআপ সক্রিয়করণ সুইচ</span>
                      <span className="text-[11px] text-slate-400 font-medium">সক্রিয় রাখলে নতুন নিয়মে সদস্যদের সম্মতি নেওয়া বাধ্যতামূলক হবে</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mandatoryNoticeState.active}
                        onChange={(e) => setMandatoryNoticeState({
                          ...mandatoryNoticeState,
                          active: e.target.checked
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5">
                        ক্যাটাগরি ব্যাজ (Top Badge)
                      </label>
                      <input
                        type="text"
                        value={mandatoryNoticeState.categoryBadge || ''}
                        onChange={(e) => setMandatoryNoticeState({
                          ...mandatoryNoticeState,
                          categoryBadge: e.target.value
                        })}
                        placeholder="যেমন: নতুন নিয়ম, সদস্য মতামত, জরুরি নোটিশ"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5">
                        পপআপের উদ্দেশ্য / ধরণ
                      </label>
                      <select
                        value={mandatoryNoticeState.type || 'rules_consent'}
                        onChange={(e) => setMandatoryNoticeState({
                          ...mandatoryNoticeState,
                          type: e.target.value as any
                        })}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      >
                        <option value="rules_consent">📜 নতুন নিয়ম ও শর্তাবলী সম্মতি (Rules Consent)</option>
                        <option value="poll_feedback">🗳️ সদস্য মতামত / ভোটিং (Member Poll)</option>
                        <option value="announcement">📢 গুরুত্বপূর্ণ ঘোষণা (Important Notice)</option>
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5">
                        স্টার্ট বাটন টেক্সট
                      </label>
                      <input
                        type="text"
                        value={mandatoryNoticeState.startButtonText || ''}
                        onChange={(e) => setMandatoryNoticeState({
                          ...mandatoryNoticeState,
                          startButtonText: e.target.value
                        })}
                        placeholder="যেমন: চলুন দেখি"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-12">
                      <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5">
                        ইন্ট্রো স্ক্রিন শিরোনাম (Welcome Title)
                      </label>
                      <input
                        type="text"
                        value={mandatoryNoticeState.title || ''}
                        onChange={(e) => setMandatoryNoticeState({
                          ...mandatoryNoticeState,
                          title: e.target.value
                        })}
                        placeholder="যেমন: নতুন নিয়মে আপনার অনুমতি প্রয়োজন"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-12">
                      <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5">
                        ইন্ট্রো স্ক্রিন বিবরণী (Welcome Description)
                      </label>
                      <textarea
                        rows={3}
                        value={mandatoryNoticeState.introText || ''}
                        onChange={(e) => setMandatoryNoticeState({
                          ...mandatoryNoticeState,
                          introText: e.target.value
                        })}
                        placeholder="আমাদের সেবার মান উন্নয়ন এবং সদস্যদের নিরাপত্তা নিশ্চিত করতে..."
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Final Question & Decision Buttons */}
                  <div className="border-t border-slate-800 pt-4 space-y-4">
                    <h4 className="text-xs font-black text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Vote className="w-4 h-4" />
                      চূড়ান্ত মতামত প্রশ্ন ও বাটন সেটিংস
                    </h4>

                    <div>
                      <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5">
                        চূড়ান্ত সম্মতি / মতামত প্রশ্ন (Final Question)
                      </label>
                      <input
                        type="text"
                        value={mandatoryNoticeState.finalQuestion || ''}
                        onChange={(e) => setMandatoryNoticeState({
                          ...mandatoryNoticeState,
                          finalQuestion: e.target.value
                        })}
                        placeholder="যেমন: আপনি কি উপরোক্ত নতুন নিয়ম ও শর্তাবলী মেনে নিতে সম্মত?"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">
                          সম্মতি বাটন টেক্সট (Agree Button)
                        </label>
                        <input
                          type="text"
                          value={mandatoryNoticeState.agreeButtonText || ''}
                          onChange={(e) => setMandatoryNoticeState({
                            ...mandatoryNoticeState,
                            agreeButtonText: e.target.value
                          })}
                          placeholder="হ্যাঁ, আমি সম্মত"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-black focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1.5">
                          অসম্মতি বাটন টেক্সট (Disagree Button)
                        </label>
                        <input
                          type="text"
                          value={mandatoryNoticeState.disagreeButtonText || ''}
                          onChange={(e) => setMandatoryNoticeState({
                            ...mandatoryNoticeState,
                            disagreeButtonText: e.target.value
                          })}
                          placeholder="না, আমি সম্মত নই"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-black focus:ring-1 focus:ring-rose-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Success & Disagree outcome messages */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-black text-emerald-400 uppercase block">সম্মতি দিলে যে মেসেজ দেখাবে</span>
                        <input
                          type="text"
                          value={mandatoryNoticeState.successTitle || ''}
                          onChange={(e) => setMandatoryNoticeState({
                            ...mandatoryNoticeState,
                            successTitle: e.target.value
                          })}
                          placeholder="ধন্যবাদ!"
                          className="w-full px-3 py-2 bg-slate-855 border border-slate-700 rounded-lg text-white text-xs font-bold"
                        />
                        <textarea
                          rows={2}
                          value={mandatoryNoticeState.successMessage || ''}
                          onChange={(e) => setMandatoryNoticeState({
                            ...mandatoryNoticeState,
                            successMessage: e.target.value
                          })}
                          placeholder="আপনি নতুন নিয়মে সম্মতি দিয়েছেন..."
                          className="w-full px-3 py-2 bg-slate-855 border border-slate-700 rounded-lg text-slate-300 text-xs font-medium"
                        />
                      </div>

                      <div className="space-y-2 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-black text-rose-400 uppercase block">অসম্মতি জানালে যে মেসেজ দেখাবে</span>
                        <input
                          type="text"
                          value={mandatoryNoticeState.disagreeTitle || ''}
                          onChange={(e) => setMandatoryNoticeState({
                            ...mandatoryNoticeState,
                            disagreeTitle: e.target.value
                          })}
                          placeholder="আপনি সম্মত হননি"
                          className="w-full px-3 py-2 bg-slate-855 border border-slate-700 rounded-lg text-white text-xs font-bold"
                        />
                        <textarea
                          rows={2}
                          value={mandatoryNoticeState.disagreeMessage || ''}
                          onChange={(e) => setMandatoryNoticeState({
                            ...mandatoryNoticeState,
                            disagreeMessage: e.target.value
                          })}
                          placeholder="আপনি নতুন নিয়মে সম্মতি না দেওয়ায় কিছু সেবা সীমিত থাকতে পারে..."
                          className="w-full px-3 py-2 bg-slate-855 border border-slate-700 rounded-lg text-slate-300 text-xs font-medium"
                        />
                      </div>
                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveMandatoryConfig()}
                    disabled={mandatorySaving}
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{mandatorySaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}</span>
                  </button>
                </div>
              )}

              {/* Sub-Tab 2: Slide Cards Manager */}
              {activeMandatorySubTab === 'slides' && (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-300">
                      স্লাইড তালিকা ({mandatoryNoticeState.slides?.length || 0} টি স্লাইড)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddSlide}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>নতুন স্লাইড যোগ করুন</span>
                    </button>
                  </div>

                  {/* Slides Accordion List */}
                  <div className="space-y-3">
                    {(mandatoryNoticeState.slides || []).map((slide, sIdx) => {
                      const isExpanded = expandedSlideIndex === sIdx;
                      return (
                        <div key={slide.id || sIdx} className="bg-slate-850 border border-slate-800 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedSlideIndex(isExpanded ? null : sIdx)}
                              className="flex items-center gap-2 text-left font-black text-xs text-white hover:text-teal-300 cursor-pointer flex-1"
                            >
                              <span className="w-6 h-6 bg-slate-800 text-teal-400 rounded-lg flex items-center justify-center text-[10px] shrink-0 border border-slate-700">
                                {sIdx + 1}
                              </span>
                              <span>{slide.title || `স্লাইড #${sIdx + 1}`}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({slide.iconType || 'rules'})</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteSlide(sIdx)}
                                className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-950 rounded-lg transition cursor-pointer"
                                title="স্লাইড মুছে ফেলুন"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setExpandedSlideIndex(isExpanded ? null : sIdx)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Slide Edit Form */}
                          {isExpanded && (
                            <div className="space-y-3 border-t border-slate-800 pt-3">
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div className="sm:col-span-8">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                    স্লাইড শিরোনাম
                                  </label>
                                  <input
                                    type="text"
                                    value={slide.title || ''}
                                    onChange={(e) => handleUpdateSlide(sIdx, 'title', e.target.value)}
                                    placeholder="যেমন: ১. একাউন্ট নিরাপত্তা"
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none"
                                  />
                                </div>

                                <div className="sm:col-span-4">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                    আইকন / গ্রাফিক্স টাইপ
                                  </label>
                                  <select
                                    value={slide.iconType || 'rules'}
                                    onChange={(e) => handleUpdateSlide(sIdx, 'iconType', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none"
                                  >
                                    <option value="rules">📖 নিয়মাবলী বই (Rules Book)</option>
                                    <option value="security">🛡️ একাউন্ট নিরাপত্তা ও লক (Security)</option>
                                    <option value="limits">📱 লেনদেন সীমা ও মুদ্রা (Limits & Coins)</option>
                                    <option value="handshake">🤝 আমাদের প্রত্যাশা ও চুক্তি (Handshake)</option>
                                    <option value="announcement">📢 সাধারণ ঘোষণা (Megaphone)</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                  বিস্তারিত বিবরণ (Description)
                                </label>
                                <textarea
                                  rows={3}
                                  value={slide.description || ''}
                                  onChange={(e) => handleUpdateSlide(sIdx, 'description', e.target.value)}
                                  placeholder="সদস্যদের সহজে বোঝার জন্য বিস্তারিত বিবরণ লিখুন..."
                                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none leading-relaxed"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                  বুলেট পয়েন্টসমূহ (প্রতি লাইনে একটি করে পয়েন্ট)
                                </label>
                                <textarea
                                  rows={2}
                                  value={(slide.bulletPoints || []).join('\n')}
                                  onChange={(e) => {
                                    const lines = e.target.value.split('\n').filter(l => l.trim().length > 0);
                                    handleUpdateSlide(sIdx, 'bulletPoints', lines);
                                  }}
                                  placeholder="• সাধারণ সদস্য: ৳ ৫০,০০০&#10;• ভেরিফাইড সদস্য: ৳ ১০০,০০০"
                                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none leading-relaxed font-mono"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveMandatoryConfig()}
                    disabled={mandatorySaving}
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{mandatorySaving ? 'সংরক্ষণ হচ্ছে...' : 'স্লাইড কনফিগারেশন সংরক্ষণ করুন'}</span>
                  </button>
                </div>
              )}

              {/* Sub-Tab 3: Member Responses & Audit List */}
              {activeMandatorySubTab === 'responses' && (
                <div className="mt-5 space-y-4">
                  {/* Filter & Search Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-850 p-4 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setMandatoryResponseFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          mandatoryResponseFilter === 'all'
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        সকল ({totalMandatoryResponses})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMandatoryResponseFilter('agreed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          mandatoryResponseFilter === 'agreed'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        ✅ সম্মত ({totalAgreedResponses})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMandatoryResponseFilter('disagreed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          mandatoryResponseFilter === 'disagreed'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        ❌ অসম্মত ({totalDisagreedResponses})
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={mandatorySearchQuery}
                          onChange={(e) => setMandatorySearchQuery(e.target.value)}
                          placeholder="নাম বা ফোন দিয়ে খুঁজুন..."
                          className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
                        />
                      </div>

                      {totalMandatoryResponses > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllResponses}
                          className="p-2 text-rose-400 hover:text-white hover:bg-rose-950 border border-rose-900/40 rounded-xl transition cursor-pointer"
                          title="সকল রেসপন্স ক্লিয়ার করুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Responses Table / List */}
                  <div className="bg-slate-850 border border-slate-800 rounded-2xl overflow-hidden">
                    {filteredResponses.length === 0 ? (
                      <div className="py-12 text-center text-slate-500 text-xs font-bold">
                        বর্তমানে কোনো সদস্যের রেসপন্স ডেটা পাওয়া যায়নি।
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800 max-h-[420px] overflow-y-auto">
                        {filteredResponses.map((resp, rIdx) => (
                          <div key={resp.userId || rIdx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/50 transition">
                            <div className="space-y-1 text-left">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-white">{resp.userName || 'সদস্য'}</span>
                                <span className="text-[10px] text-teal-400 font-mono bg-teal-950 px-1.5 py-0.5 rounded border border-teal-900/50">
                                  {resp.memberId || 'N/A'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {resp.phone}
                                </span>
                              </div>
                              {resp.feedbackText && (
                                <p className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded-lg border border-slate-800 mt-1">
                                  💬 মতামত: {resp.feedbackText}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                                resp.agreed
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-950 text-rose-300 border-rose-500/40'
                              }`}>
                                {resp.agreed ? <Check className="w-3 h-3 text-emerald-400 stroke-[3]" /> : <X className="w-3 h-3 text-rose-400 stroke-[3]" />}
                                <span>{resp.agreed ? 'সম্মতি দিয়েছেন' : 'অসম্মত হয়েছেন'}</span>
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {resp.respondedAt ? new Date(resp.respondedAt).toLocaleString('bn-BD') : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Live Preview Modal */}
              {showAdminNoticePreview && (
                <MandatoryNoticeModal
                  isOpen={showAdminNoticePreview}
                  user={currentUser}
                  appConfig={appConfig}
                  noticeConfig={mandatoryNoticeState}
                  previewMode={true}
                  onClose={() => setShowAdminNoticePreview(false)}
                  onConsentSubmitted={(agreed) => {
                    setShowAdminNoticePreview(false);
                    alert(`✅ এডমিন টেস্ট সম্পন্ন! সদস্যের সিদ্ধান্ত ছিল: ${agreed ? 'সম্মতি (Agreed)' : 'অসম্মতি (Disagreed)'}`);
                  }}
                />
              )}

            </div>
          </div>
        )}
    </>
  );
}
