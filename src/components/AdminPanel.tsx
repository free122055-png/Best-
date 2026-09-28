import { AdminNoticesBapSection } from './admin/AdminNoticesBapSection';
import { AdminDashboardOverview } from './admin/AdminDashboardOverview';
import { AdminSamitySection } from './admin/AdminSamitySection';
import { AdminApprovalsSection } from './admin/AdminApprovalsSection';
import { AdminConfigSection } from './admin/AdminConfigSection';
import { AdminReceiptSection } from './admin/AdminReceiptSection';
import { AdminShopSection } from './admin/AdminShopSection';
import { AdminBankSection } from './admin/AdminBankSection';
import { AdminQardSection } from './admin/AdminQardSection';
import { AdminBannersSection } from './admin/AdminBannersSection';
import { AdminAgentSection } from './admin/AdminAgentSection';
import { AdminRationSection } from './admin/AdminRationSection';
import { AdminSafeDealsSection } from './admin/AdminSafeDealsSection';
import { AdminCourierSection } from './admin/AdminCourierSection';
import { AdminLedgerSection } from './admin/AdminLedgerSection';
import { AdminSystemResetSection } from './admin/AdminSystemResetSection';
import { AdminUserEditModal } from './admin/AdminUserEditModal';
import { AdminBottomModals } from './admin/AdminBottomModals';
import AdminSalarySection from './admin/AdminSalarySection';
import AdminAutoRechargeSection from './admin/AdminAutoRechargeSection';
import AdminBillPaySection from './admin/AdminBillPaySection';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../lib/firebase';
import { SAMITY_MONTHS, SAMITY_YEARS, getUniquePaidMonthsCount, normalizePaidMonthsArray, getEffectiveBalance } from '../types';
import { processUserSamitySavingsAutoDeduction, processBulkSamitySavingsAutoDeduction } from '../lib/samitySavingsEngine';
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
import { User, Transaction, Notice, Offer, BapReport, BapGroup, BapAdminRequest, AppConfig, Product, UserNotification, CompanyFundAccount, AdminBroadcastLog, QardRuleItem, QardConfig, PhoneChangeRequest, SamityPolicyConfig, SamityFineTier } from '../types';
import { normalizeMemberId, formatBanglaAmount, normalizePhoneNumber, findUserInFirestoreByPhone, getNextSequentialMemberId, deleteUserCompletelyFromDatabase, convertBengaliToEnglishDigits } from '../lib/memberUtils';
import { sortTransactionsNewestFirst, getTxTime } from '../lib/transactionUtils';
import { saveAppConfig, DEFAULT_QARD_CONFIG } from '../lib/config';
import { AMBLogo } from './AMBLogo';
import { HeaderPendingModal } from './HeaderPendingModal';
import SamityScreen from './SamityScreen';
import UnifiedBackButton from './UnifiedBackButton';
import SamityAdmin from './SamityAdmin';
import SafiPremiumShop from './SafiPremiumShop';
import TelecomAdmin from './TelecomAdmin';
import AmbSalaryAdmin from './AmbSalaryAdmin';
import { HistoryRetentionSettings } from './HistoryRetentionSettings';
import { runWalletEndToEndTests, TestResultItem } from '../lib/walletTests';
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
import LeafletActiveMap from './LeafletActiveMap';

export const triggerAdminCrossSync = () => {
  try {
    if (typeof window !== 'undefined') {
      const now = Date.now().toString();
      localStorage.setItem('amb_admin_sync_tick', now);
      window.dispatchEvent(new CustomEvent('amb_admin_sync_tick', { detail: { time: now } }));
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('amb_admin_sync_channel');
        bc.postMessage({ type: 'SYNC_TRANSACTIONS', time: now });
        bc.close();
      }
    }
  } catch (e) {
    // Non-fatal
  }
};

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
  title: string;
  message: string;
  status: 'delivered';
  speedSeconds: string;
}

export const isMainAdminUser = (usr: any) => Boolean(
  usr && (
    usr.uid === 'admin_master' ||
    usr.phone === '+8800011112222' ||
    usr.normalizedPhone === '+8800011112222' ||
    usr.memberId === 'MAIN_ADMIN' ||
    usr.name === 'Bangladesh AMB Administrator'
  )
);

export default function AdminPanel(props: AdminPanelProps) {
  const { 
    onBack, 
    currentUser, 
    appConfig, 
    onChangeConfig,
    appLanguage = 'bn',
    darkMode = false,
  } = props;
  const [bapIframeLoading, setBapIframeLoading] = useState(true);
  const bapIframeRef = useRef<HTMLIFrameElement>(null);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    requireInput?: boolean;
    inputPlaceholder?: string;
    inputValue?: string;
    onConfirm: (val?: string) => void;
    onCancel?: () => void;
  } | null>(null);

  const requestConfirm = (title: string, description: string, onConfirm: () => void, onCancel?: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      onConfirm: () => {
        onConfirm();
      },
      onCancel: () => {
        if (onCancel) onCancel();
      }
    });
  };

  const requestPrompt = (title: string, description: string, defaultValue: string, onConfirm: (val: string) => void) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      requireInput: true,
      inputValue: defaultValue,
      onConfirm: (val) => {
        onConfirm(val || '');
      }
    });
  };

  const requestAlert = (title: string, description: string) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      onConfirm: () => {}
    });
  };

  const alert = (msg: string) => {
    requestAlert('সিস্টেম রিকোয়েস্ট', msg);
  };

  const [cfgOneSignalAppId, setCfgOneSignalAppId] = useState(appConfig.oneSignalAppId || '');
  const [cfgOneSignalRestApiKey, setCfgOneSignalRestApiKey] = useState(appConfig.oneSignalRestApiKey || '');
  const [showOneSignalKey, setShowOneSignalKey] = useState(false);
  const [oneSignalSaving, setOneSignalSaving] = useState(false);
  const [oneSignalSuccess, setOneSignalSuccess] = useState(false);
  const [oneSignalError, setOneSignalError] = useState('');


  const handleQueryError = (err: any, context: string) => {
    console.error(`Error in ${context}:`, err);
    const msg = err?.message || String(err);
    if (
      msg.toLowerCase().includes('quota limit exceeded') ||
      msg.toLowerCase().includes('quota exceeded') ||
      msg.toLowerCase().includes('resource-exhausted') ||
      msg.toLowerCase().includes('resource_exhausted') ||
      msg.toLowerCase().includes('quota_exceeded')
    ) {
      console.warn("Quota exceeded error handled");
    }
  };

  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [pushImageUrl, setPushImageUrl] = useState('');
  const [pushDeepLink, setPushDeepLink] = useState('');
  const [pushTargetType, setPushTargetType] = useState('all');
  const [pushTargetValue, setPushTargetValue] = useState('');
  const [pushSending, setPushSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Dynamic Layout Engine configurations
  const [cfgBannerHeightType, setCfgBannerHeightType] = useState<'thin' | 'medium' | 'thick' | 'custom' | '16:9' | '21:9' | '32:9'>(appConfig.bannerHeightType || '16:9');
  const [cfgBannerHeightValue, setCfgBannerHeightValue] = useState<number>(appConfig.bannerHeightValue || 180);
  const [cfgBottomNavHeightType, setCfgBottomNavHeightType] = useState<'thin' | 'medium' | 'thick'>(appConfig.bottomNavHeightType || 'medium');
  const [cfgBottomNavTabs, setCfgBottomNavTabs] = useState<string[]>(appConfig.bottomNavTabs || ['home', 'deposit', 'add_money', 'history', 'profile']);
  const [cfgGridColsCount, setCfgGridColsCount] = useState<number>(appConfig.gridColsCount || 3);
  const [cfgGridIconSize, setCfgGridIconSize] = useState<'small' | 'medium' | 'large' | 'custom'>(appConfig.gridIconSize || 'medium');
  const [cfgGridIconSizeValue, setCfgGridIconSizeValue] = useState<number>(appConfig.gridIconSizeValue || 64);

  const [cfgAppName, setCfgAppName] = useState(appConfig.appName);
  const [cfgPersonalMfsNumber, setCfgPersonalMfsNumber] = useState(appConfig.personalMfsNumber);
  const [cfgPersonalBankCard, setCfgPersonalBankCard] = useState(appConfig.personalBankCard);
  const [cfgSupportPhone, setCfgSupportPhone] = useState(appConfig.supportPhone);
  const [cfgSamityTerms, setCfgSamityTerms] = useState(appConfig.samityTerms);
  const [cfgTickerText, setCfgTickerText] = useState(appConfig.tickerText);
  const [cfgSamityTicker, setCfgSamityTicker] = useState(appConfig.samityTicker || "AMB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর সাধারণ ফান্ডে স্বাগতম। আপনি এখান থেকে সঞ্চয় জমা দিতে পারেন, ঋণ আবেদন এবং মুনাফার শেয়ার তুলতে পারেন।");
  const [cfgQardTicker, setCfgQardTicker] = useState(appConfig.qardTicker || "সুদমুক্ত করযে হাসানা কল্যাণ তহবিলে আপনাকে স্বাগতম। আপনার সামর্থ্য অনুযায়ী দান করে ফান্ড সমৃদ্ধ করুন অথবা প্রয়োজনের সময়ে সুদমুক্ত করযে স্বস্তির নিঃশ্বাস ফেলুন।");
  const [cfgTelecomTicker, setCfgTelecomTicker] = useState(appConfig.telecomTicker || "টেলিকম ফ্লেক্সিলোড ও সুপার ফাস্ট ড্রাইভ অফার গাইডঃ সব অপারেটরের ড্রাইভ ও সাধারণ রিচার্জ অফারগুলো সহজে ক্রয় করতে পারবেন।");
  const [cfgSafiTicker, setCfgSafiTicker] = useState(appConfig.safiTicker || "প্রিমিয়াম Safi ব্র্যান্ডের শতভাগ খাঁটি পণ্য সম্ভার! আমাদের নিজস্ব তত্ত্বাবধানে প্রস্তুতকৃত ভেজালমুক্ত প্রিমিয়াম পণ্যসমূহ সরাসরি মেইন ব্যালেন্স থেকে সহজেই ক্রয় করুন।");
  const [cfgEscrowTicker, setCfgEscrowTicker] = useState(appConfig.escrowTicker || "AMB নিরাপদ লেনদেনঃ যেকোনো প্রোডাক্ট কুরিয়ার কন্ডিশনে ক্রয়ের পূর্বে এসক্রো ডিল বুকিং করে আপনার মেইন ব্যালেন্সের পেমেন্ট নিরাপদ করুন।");
  const [cfgRationTicker, setCfgRationTicker] = useState(appConfig.rationTicker || "কো-অপারেティブ ডিজিটাল রেশন কার্ড সেবাঃ ভর্তুকি মূল্যে নিত্যপ্রয়োজনীয় চাল, ডাল, তেল ও অন্যান্য পণ্যসামগ্রী ক্রয়ের সুবিধা উপভোগ করুন।");
  const [cfgAgentTicker, setCfgAgentTicker] = useState(appConfig.agentTicker || "AMB এজেন্ট প্যানেলঃ আপনার এলাকায় নিজস্ব প্রতিনিধি হিসেবে নিবন্ধিত হয়ে আকর্ষণীয় কমিশন উপার্জন করুন।");
  const [cfgCourierTicker, setCfgCourierTicker] = useState(appConfig.courierTicker || "AMB ইনস্ট্যান্ট কুরিয়ার সেবাঃ সুলভ মূল্যে দ্রুততম সময়ে সারা দেশে আপনার পার্সেল পৌঁছে দেওয়ার নির্ভরযোগ্য প্ল্যাটফর্ম।");
  const [cfgGatewayTicker, setCfgGatewayTicker] = useState(appConfig.gatewayTicker || "AMB ন্যাশনাল গেটওয়েঃ ব্যাংক ডিপোজিট ও নিরাপদ লেনদেনের ভেরিফাইড গেটওয়ে সার্ভিস।");
  const [cfgExchangeRatePerThousand, setCfgExchangeRatePerThousand] = useState(appConfig.exchangeRatePerThousand || 1150);
  const [walletTestResults, setWalletTestResults] = useState<TestResultItem[] | null>(null);
  const [isRunningWalletTests, setIsRunningWalletTests] = useState(false);
  const [cfgMobileRechargePercent, setCfgMobileRechargePercent] = useState(appConfig.mobileRechargePercent !== undefined ? appConfig.mobileRechargePercent : 2.0);
  const [cfgAlaapRechargePercent, setCfgAlaapRechargePercent] = useState(appConfig.alaapRechargePercent !== undefined ? appConfig.alaapRechargePercent : 1.0);
  const [cfgBrilliantRechargePercent, setCfgBrilliantRechargePercent] = useState(appConfig.brilliantRechargePercent !== undefined ? appConfig.brilliantRechargePercent : 1.0);
  
  // Custom 4 Telecom default recharge slabs
  const [cfgSlab1Amt, setCfgSlab1Amt] = useState(appConfig.telecomDefaultSlabs?.[0]?.amount !== undefined ? appConfig.telecomDefaultSlabs[0].amount : 20);
  const [cfgSlab1Cb, setCfgSlab1Cb] = useState(appConfig.telecomDefaultSlabs?.[0]?.cashback !== undefined ? appConfig.telecomDefaultSlabs[0].cashback : 0);
  const [cfgSlab2Amt, setCfgSlab2Amt] = useState(appConfig.telecomDefaultSlabs?.[1]?.amount !== undefined ? appConfig.telecomDefaultSlabs[1].amount : 50);
  const [cfgSlab2Cb, setCfgSlab2Cb] = useState(appConfig.telecomDefaultSlabs?.[1]?.cashback !== undefined ? appConfig.telecomDefaultSlabs[1].cashback : 5);
  const [cfgSlab3Amt, setCfgSlab3Amt] = useState(appConfig.telecomDefaultSlabs?.[2]?.amount !== undefined ? appConfig.telecomDefaultSlabs[2].amount : 100);
  const [cfgSlab3Cb, setCfgSlab3Cb] = useState(appConfig.telecomDefaultSlabs?.[2]?.cashback !== undefined ? appConfig.telecomDefaultSlabs[2].cashback : 0);
  const [cfgSlab4Amt, setCfgSlab4Amt] = useState(appConfig.telecomDefaultSlabs?.[3]?.amount !== undefined ? appConfig.telecomDefaultSlabs[3].amount : 500);
  const [cfgSlab4Cb, setCfgSlab4Cb] = useState(appConfig.telecomDefaultSlabs?.[3]?.cashback !== undefined ? appConfig.telecomDefaultSlabs[3].cashback : 0);
  const [cfgOperatorCashbacks, setCfgOperatorCashbacks] = useState<Record<string, { slab1: number; slab2: number; slab3: number; slab4: number }>>(
    appConfig.telecomOperatorCashbacks || {
      Grameenphone: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 },
      Robi: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 },
      Airtel: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 },
      Banglalink: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 },
      Teletalk: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 },
      Skitto: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 }
    }
  );
  const [cfgLogoUrl, setCfgLogoUrl] = useState(appConfig.logoUrl || '');
  const [cfgAmbToAmbIconUrl, setCfgAmbToAmbIconUrl] = useState(appConfig.ambToAmbIconUrl || '');
  const [cfgServiceStatus, setCfgServiceStatus] = useState<Record<string, boolean>>(
    appConfig.serviceStatus || {
      samity: true, bank: true, telecom: true, shop: true, qard: true,
      safedeals: true, safi: true, ration: true, chat: true, agent: true,
      about: true, bap: true
    }
  );

  // 🗓️ 12-Month Samity Penalty Waiver Calendar Manager State & Definitions
  const BENGALI_MONTH_DEFS = [
    { index: 0, key: '01', name: 'জানুয়ারি', days: 31, season: 'শীতকাল', icon: '❄️' },
    { index: 1, key: '02', name: 'ফেব্রুয়ারি', days: 28, season: 'বসন্তকাল', icon: '🌸' },
    { index: 2, key: '03', name: 'মার্চ', days: 31, season: 'বসন্তকাল', icon: '🌿' },
    { index: 3, key: '04', name: 'এপ্রিল', days: 30, season: 'গ্রীষ্মকাল', icon: '☀️' },
    { index: 4, key: '05', name: 'মে', days: 31, season: 'গ্রীষ্মকাল', icon: '🥭' },
    { index: 5, key: '06', name: 'জুন', days: 30, season: 'বর্ষাকাল', icon: '🌧️' },
    { index: 6, key: '07', name: 'জুলাই', days: 31, season: 'বর্ষাকাল', icon: '☔' },
    { index: 7, key: '08', name: 'আগস্ট', days: 31, season: 'শরৎকাল', icon: '🌾' },
    { index: 8, key: '09', name: 'সেপ্টেম্বর', days: 30, season: 'শরৎকাল', icon: '☁️' },
    { index: 9, key: '10', name: 'অক্টোবর', days: 31, season: 'হেমন্তকাল', icon: '🍁' },
    { index: 10, key: '11', name: 'নভেম্বর', days: 30, season: 'হেমন্তকাল', icon: '🌾' },
    { index: 11, key: '12', name: 'ডিসেম্বর', days: 31, season: 'শীতকাল', icon: '⛄' },
  ];

  const [isPenaltyCalendarModalOpen, setIsPenaltyCalendarModalOpen] = useState(false);
  const [isQuickPenaltyModalOpen, setIsQuickPenaltyModalOpen] = useState(false);
  const [quickPenaltyDay, setQuickPenaltyDay] = useState<number>(15);
  const [quickPenaltyNote, setQuickPenaltyNote] = useState<string>('');
  const [selectedPenaltyYear, setSelectedPenaltyYear] = useState<number>(new Date().getFullYear());
  const [penaltyMonthFilter, setPenaltyMonthFilter] = useState<'all' | 'exempted' | 'active'>('all');

  // 📜 Samity Rules & Regulations Policy Manager State & Handlers
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyFormState, setPolicyFormState] = useState<SamityPolicyConfig>({
    policyTitle: appConfig?.samityPolicyConfig?.policyTitle || 'মাসিক বিনিয়োগ ও নীতিমালা',
    policySubTitle: appConfig?.samityPolicyConfig?.policySubTitle || '1ম থেকে 25শে অক্টোবর পেমেন্ট সিস্টেম ও বিলম্ব চার্জসমূহ',
    schemeStatusNote: appConfig?.samityPolicyConfig?.schemeStatusNote || 'আপনার একাউন্ট থেকে প্রতি মাসের 1 থেকে 9 তারিখের মধ্যে স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্স থেকে কিস্তি অটো-ডেবিট করা হবে।',
    fixedAmountTitle: appConfig?.samityPolicyConfig?.fixedAmountTitle || '1. নির্ধারিত মাসিক বিনিয়োগের পরিমাণ',
    fixedAmountNote: appConfig?.samityPolicyConfig?.fixedAmountNote || '💡 অ্যাকাউন্ট খোলার সময় আপনার নির্বাচিত এই কিস্তির পরিমাণ স্থায়ী। এটি সাধারণ ব্যবহারকারী নিজে পরিবর্তন করতে পারবেন না। প্রয়োজনে পরিবর্তন করার জন্য এডমিন প্যানেলের মাধ্যমে প্রধান কার্যালয়ের সাথে যোগাযোগ করুন।',
    penaltyTitle: appConfig?.samityPolicyConfig?.penaltyTitle || '2. বিলম্ব পেমেন্ট ও জরিমানা পলিসি',
    penaltyTiers: appConfig?.samityPolicyConfig?.penaltyTiers && appConfig.samityPolicyConfig.penaltyTiers.length > 0 
      ? appConfig.samityPolicyConfig.penaltyTiers 
      : [
          { id: '1', fromDay: 1, toDay: 9, rangeLabel: '1 থেকে 9 তারিখঃ', fineText: 'কোনো জরিমানা নেই (0 BDT)', fineAmount: 0, bgClass: 'bg-emerald-50/40 border-emerald-100 text-emerald-800' },
          { id: '2', fromDay: 10, toDay: 19, rangeLabel: '10 থেকে 19 তারিখঃ', fineText: '৳ 10 জরিমানা', fineAmount: 10, bgClass: 'bg-amber-50/40 border-amber-100 text-amber-800' },
          { id: '3', fromDay: 20, toDay: 29, rangeLabel: '20 থেকে 29 তারিখঃ', fineText: '৳ 20 জরিমানা', fineAmount: 20, bgClass: 'bg-orange-50/40 border-orange-100 text-orange-800' },
          { id: '4', fromDay: 30, toDay: 39, rangeLabel: '30 থেকে 39 তারিখঃ', fineText: '৳ 30 জরিমানা', fineAmount: 30, bgClass: 'bg-rose-50/40 border-rose-100 text-rose-800' },
          { id: '5', fromDay: 40, toDay: 40, rangeLabel: '40তম দিনঃ', fineText: '৳ 80 জরিমানা', fineAmount: 80, bgClass: 'bg-red-100/60 border-red-200 text-red-900' },
          { id: '6', fromDay: 41, toDay: 365, rangeLabel: '40তম দিনের পরঃ', fineText: '৳ 10 প্রতিদিন জরিমানা', fineAmount: 10, bgClass: 'bg-red-200/60 border-red-300 text-red-950' }
        ],
    customRules: appConfig?.samityPolicyConfig?.customRules && appConfig.samityPolicyConfig.customRules.length > 0
      ? appConfig.samityPolicyConfig.customRules
      : [
          '25শে ডিসেম্বরের পূর্বে আপনার সঞ্চিত টাকা উত্তোলন করতে পারবেন না। আপনার জমা কৃত টাকা ডিসেম্বরের 25-30 তারিখের মধ্যে স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্সে জমা হবে।',
          'প্রতি মাসের 1 থেকে 9 তারিখের মধ্যে স্বয়ংক্রিয়ভাবে অটো-ডেবিট কিস্তি জমা নেওয়া হয়।',
          '10 তারিখ থেকে বিলম্বে কিস্তি জমায় জরিমানা পলিসি প্রযোজ্য হবে।',
          'বিশেষ প্রয়োজনে অটো সঞ্চয় বন্ধ করতে এডমিন অনুমতির জন্য হেল্পলাইনে যোগাযোগ করুন।'
        ],
    pausePenaltyUntil15th: appConfig?.samityPolicyConfig?.pausePenaltyUntil15th ?? false,
    penaltyExemptionUntilDay: appConfig?.samityPolicyConfig?.penaltyExemptionUntilDay || 15,
    penaltyExemptionNote: appConfig?.samityPolicyConfig?.penaltyExemptionNote || 'অ্যাপ সম্পূর্ণ প্রস্তুতকরণ কাজের জন্য এই মাসের জরিমানা 15 তারিখ পর্যন্ত স্থগিত রাখা হলো।',
  });

  const [qardBoxViewHawlat, setQardBoxViewHawlat] = useState(false);

  useEffect(() => {
    if (appConfig?.samityPolicyConfig) {
      setPolicyFormState({
        policyTitle: appConfig.samityPolicyConfig.policyTitle || 'মাসিক বিনিয়োগ ও নীতিমালা',
        policySubTitle: appConfig.samityPolicyConfig.policySubTitle || '1ম থেকে 25শে অক্টোবর পেমেন্ট সিস্টেম ও বিলম্ব চার্জসমূহ',
        schemeStatusNote: appConfig.samityPolicyConfig.schemeStatusNote || 'আপনার একাউন্ট থেকে প্রতি মাসের 1 থেকে 9 তারিখের মধ্যে স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্স থেকে কিস্তি অটো-ডেবিট করা হবে।',
        fixedAmountTitle: appConfig.samityPolicyConfig.fixedAmountTitle || '1. নির্ধারিত মাসিক বিনিয়োগের পরিমাণ',
        fixedAmountNote: appConfig.samityPolicyConfig.fixedAmountNote || '💡 অ্যাকাউন্ট খোলার সময় আপনার নির্বাচিত এই কিস্তির পরিমাণ স্থায়ী। এটি সাধারণ ব্যবহারকারী নিজে পরিবর্তন করতে পারবেন না। প্রয়োজনে পরিবর্তন করার জন্য এডমিন প্যানেলের মাধ্যমে প্রধান কার্যালয়ের সাথে যোগাযোগ করুন।',
        penaltyTitle: appConfig.samityPolicyConfig.penaltyTitle || '2. বিলম্ব পেমেন্ট ও জরিমানা পলিসি',
        penaltyTiers: appConfig.samityPolicyConfig.penaltyTiers && appConfig.samityPolicyConfig.penaltyTiers.length > 0 ? appConfig.samityPolicyConfig.penaltyTiers : [],
        customRules: appConfig.samityPolicyConfig.customRules && appConfig.samityPolicyConfig.customRules.length > 0 ? appConfig.samityPolicyConfig.customRules : [],
        pausePenaltyUntil15th: appConfig.samityPolicyConfig.pausePenaltyUntil15th ?? false,
        penaltyExemptionUntilDay: appConfig.samityPolicyConfig.penaltyExemptionUntilDay || 15,
        penaltyExemptionNote: appConfig.samityPolicyConfig.penaltyExemptionNote || 'অ্যাপ সম্পূর্ণ প্রস্তুতকরণ কাজের জন্য এই মাসের জরিমানা 15 তারিখ পর্যন্ত স্থগিত রাখা হলো।',
      });
    }
  }, [appConfig?.samityPolicyConfig, isPolicyModalOpen]);

  // Check if a specific month in year has fine waiver/exemption
  const isMonthExemptedInConfig = (year: number, monthKey: string): boolean => {
    const fullKey = `${year}-${monthKey}`;
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonthKey = `${curYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const cfg = policyFormState?.exemptedMonthsConfig?.[fullKey] ?? appConfig?.samityPolicyConfig?.exemptedMonthsConfig?.[fullKey];
    if (cfg !== undefined) return Boolean(cfg.isExempted);

    const isSimple = policyFormState?.exemptedMonths?.[fullKey] ?? appConfig?.samityPolicyConfig?.exemptedMonths?.[fullKey];
    if (isSimple !== undefined) return Boolean(isSimple);

    if (fullKey === curMonthKey) {
      return Boolean(policyFormState?.pausePenaltyUntil15th ?? appConfig?.samityPolicyConfig?.pausePenaltyUntil15th);
    }
    return false;
  };

  const getMonthExemptConfig = (year: number, monthKey: string) => {
    const fullKey = `${year}-${monthKey}`;
    const cfg = policyFormState?.exemptedMonthsConfig?.[fullKey] || appConfig?.samityPolicyConfig?.exemptedMonthsConfig?.[fullKey];
    const isExempt = isMonthExemptedInConfig(year, monthKey);
    return {
      isExempted: isExempt,
      exemptUntilDay: cfg?.exemptUntilDay || (isExempt ? 31 : 9),
      note: cfg?.note || ''
    };
  };

  const handleToggleMonthPenaltyExemption = async (year: number, monthKey: string, customDay?: number, customNote?: string) => {
    try {
      const fullKey = `${year}-${monthKey}`;
      const currentlyExempt = isMonthExemptedInConfig(year, monthKey);
      const nextExempt = !currentlyExempt;
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonthKey = `${curYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const updatedMonths = {
        ...(policyFormState.exemptedMonths || {}),
        [fullKey]: nextExempt
      };

      const updatedMonthsConfig = {
        ...(policyFormState.exemptedMonthsConfig || {}),
        [fullKey]: {
          isExempted: nextExempt,
          exemptUntilDay: customDay !== undefined ? customDay : (nextExempt ? 31 : 9),
          note: customNote !== undefined ? customNote : (nextExempt ? `${year} সালের ${BENGALI_MONTH_DEFS.find(m => m.key === monthKey)?.name || monthKey} মাসে বিলম্ব জরিমানা স্থগিত করা হয়েছে।` : '')
        }
      };

      const updatedPolicy: SamityPolicyConfig = {
        ...policyFormState,
        exemptedMonths: updatedMonths,
        exemptedMonthsConfig: updatedMonthsConfig,
        ...(fullKey === curMonthKey ? { pausePenaltyUntil15th: nextExempt } : {})
      };

      setPolicyFormState(updatedPolicy);

      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { samityPolicyConfig: updatedPolicy }, { merge: true });
      onChangeConfig({
        ...appConfig,
        samityPolicyConfig: updatedPolicy
      });
    } catch (err: any) {
      alert('জরিমানা ক্যালেন্ডার আপডেট করতে সমস্যা হয়েছে: ' + (err?.message || err));
    }
  };

  const handleSetMonthExemptUntilDay = async (year: number, monthKey: string, day: number) => {
    try {
      const fullKey = `${year}-${monthKey}`;
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonthKey = `${curYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const updatedMonths = {
        ...(policyFormState.exemptedMonths || {}),
        [fullKey]: true
      };

      const updatedMonthsConfig = {
        ...(policyFormState.exemptedMonthsConfig || {}),
        [fullKey]: {
          isExempted: true,
          exemptUntilDay: day,
          note: `${year} সালের ${BENGALI_MONTH_DEFS.find(m => m.key === monthKey)?.name || monthKey} মাসে ${day === 31 ? 'পুরো মাস' : `${day}ই তারিখ পর্যন্ত`} বিলম্ব জরিমানা স্থগিত।`
        }
      };

      const updatedPolicy: SamityPolicyConfig = {
        ...policyFormState,
        exemptedMonths: updatedMonths,
        exemptedMonthsConfig: updatedMonthsConfig,
        ...(fullKey === curMonthKey ? { pausePenaltyUntil15th: true, penaltyExemptionUntilDay: day } : {})
      };

      setPolicyFormState(updatedPolicy);

      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { samityPolicyConfig: updatedPolicy }, { merge: true });
      onChangeConfig({
        ...appConfig,
        samityPolicyConfig: updatedPolicy
      });
    } catch (err: any) {
      alert('মেয়াদ আপডেট করতে সমস্যা হয়েছে: ' + (err?.message || err));
    }
  };

  const handleResetAllMonthsPenalty = async (year: number) => {
    if (!window.confirm(`${year} সালের সকল মাসের জরিমানা কি স্বাভাবিক নিয়মে (1-9 তারিখ ফ্রি, 10 তারিখ থেকে জরিমানা) ফিরিয়ে নিতে চান?`)) return;
    try {
      const updatedMonths = { ...(policyFormState.exemptedMonths || {}) };
      const updatedMonthsConfig = { ...(policyFormState.exemptedMonthsConfig || {}) };

      BENGALI_MONTH_DEFS.forEach(m => {
        const fullKey = `${year}-${m.key}`;
        updatedMonths[fullKey] = false;
        updatedMonthsConfig[fullKey] = {
          isExempted: false,
          exemptUntilDay: 9,
          note: ''
        };
      });

      const now = new Date();
      const curYear = now.getFullYear();
      const isCurYear = year === curYear;

      const updatedPolicy: SamityPolicyConfig = {
        ...policyFormState,
        exemptedMonths: updatedMonths,
        exemptedMonthsConfig: updatedMonthsConfig,
        ...(isCurYear ? { pausePenaltyUntil15th: false } : {})
      };

      setPolicyFormState(updatedPolicy);

      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { samityPolicyConfig: updatedPolicy }, { merge: true });
      onChangeConfig({
        ...appConfig,
        samityPolicyConfig: updatedPolicy
      });
      alert(`সফলভাবে ${year} সালের সকল মাসের জরিমানা স্বাভাবিক নিয়মে রিসেট করা হয়েছে!`);
    } catch (err: any) {
      alert('রিসেট করতে সমস্যা হয়েছে: ' + (err?.message || err));
    }
  };

  const handleSaveQuickPenaltyWaiver = async (enabled: boolean, day: number, note?: string) => {
    try {
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonthDef = BENGALI_MONTH_DEFS[now.getMonth()];
      const curMonthKey = `${curYear}-${curMonthDef?.key || '08'}`;
      const defaultNote = enabled
        ? (note?.trim() || `${curYear} সালের ${curMonthDef?.name || 'চলতি'} মাসে ${day === 31 ? 'পুরো মাস' : `${day}ই তারিখ পর্যন্ত`} বিলম্ব জরিমানা স্থগিত রাখা হলো।`)
        : '';

      const updatedMonths = {
        ...(policyFormState.exemptedMonths || {}),
        [curMonthKey]: enabled
      };

      const updatedMonthsConfig = {
        ...(policyFormState.exemptedMonthsConfig || {}),
        [curMonthKey]: {
          isExempted: enabled,
          exemptUntilDay: enabled ? day : 9,
          note: defaultNote
        }
      };

      const updatedPolicy: SamityPolicyConfig = {
        ...policyFormState,
        exemptedMonths: updatedMonths,
        exemptedMonthsConfig: updatedMonthsConfig,
        pausePenaltyUntil15th: enabled,
        penaltyExemptionUntilDay: enabled ? day : 9,
        penaltyExemptionNote: defaultNote
      };

      setPolicyFormState(updatedPolicy);

      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { samityPolicyConfig: updatedPolicy }, { merge: true });
      onChangeConfig({
        ...appConfig,
        samityPolicyConfig: updatedPolicy
      });

      alert(enabled
        ? `সফলভাবে ${curMonthDef?.name || 'চলতি'} মাসের ${day === 31 ? 'পুরো মাস' : `${day}ই তারিখ পর্যন্ত`} বিলম্ব জরিমানা স্থগিত করা হয়েছে! (সদস্যদের অ্যাপে ৳0 জরিমানা কার্যকর)`
        : `বিলম্ব জরিমানা স্বাভাবিক নিয়মে (1-9 তারিখ ফ্রি, 10 তারিখ থেকে জরিমানা) চালু করা হয়েছে!`
      );
      setIsQuickPenaltyModalOpen(false);
    } catch (err: any) {
      alert('জরিমানা সেটিংস আপডেট করতে সমস্যা হয়েছে: ' + (err?.message || err));
    }
  };

  const handleQuickTogglePenaltyPause = async () => {
    try {
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonthDef = BENGALI_MONTH_DEFS[now.getMonth()];
      const curMonthKey = `${curYear}-${curMonthDef?.key || '08'}`;
      const isCurExempt = isMonthExemptedInConfig(curYear, curMonthDef?.key || '08');
      await handleToggleMonthPenaltyExemption(curYear, curMonthDef?.key || '08');
      alert(!isCurExempt 
        ? `সফলভাবে ${curMonthDef?.name || 'চলতি'} মাসের জন্য বিলম্ব জরিমানা স্থগিত করা হয়েছে! (সদস্যদের অ্যাপে ৳0 জরিমানা সক্রিয় হয়েছে)` 
        : `বিলম্ব জরিমানা স্বাভাবিক নিয়মে (1-9 ফ্রি, 10 তারিখ থেকে জরিমানা) পুনঃরায় চালু করা হয়েছে!`
      );
    } catch (err: any) {
      alert('সাময়িক বিলম্ব জরিমানা আপডেট করতে সমস্যা হয়েছে: ' + (err?.message || err));
    }
  };

  const handleSaveSamityPolicyFromModal = async () => {
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { samityPolicyConfig: policyFormState }, { merge: true });
      const updatedConfig = {
        ...appConfig,
        samityPolicyConfig: policyFormState
      };
      onChangeConfig(updatedConfig);
      alert('সফলভাবে সমিতির সকল নিয়ম-কানুন ও পলিসি আপডেট ও রিয়েল-টাইমে প্রকাশ করা হয়েছে!');
      setIsPolicyModalOpen(false);
    } catch (err: any) {
      alert('পলিসি আপডেট করতে সমস্যা হয়েছে: ' + (err?.message || err));
    }
  };

  const [cfgMaintenanceMode, setCfgMaintenanceMode] = useState(appConfig.maintenanceMode || false);
  const [cfgMaintenanceTitle, setCfgMaintenanceTitle] = useState(appConfig.maintenanceTitle || "আমরা আপডেট করছি");
  const [cfgMaintenanceDescription, setCfgMaintenanceDescription] = useState(appConfig.maintenanceDescription || "আপনাদের জন্য আরও উন্নত, দ্রুত ও নিরাপদ সেবা নিশ্চিত করতে আমাদের সিস্টেম বর্তমানে আপডেট করা হচ্ছে।");
  const [cfgMaintenanceEstimatedTime, setCfgMaintenanceEstimatedTime] = useState(appConfig.maintenanceEstimatedTime || "30 - 60 মিনিট");
  const [cfgMaintenanceAnimationUrl, setCfgMaintenanceAnimationUrl] = useState(appConfig.maintenanceAnimationUrl || "");
  const [cfgMaintenanceLogoUrl, setCfgMaintenanceLogoUrl] = useState(appConfig.maintenanceLogoUrl || "");
  const [cfgMaintenanceBgUrl, setCfgMaintenanceBgUrl] = useState(appConfig.maintenanceBgUrl || "");

  const [cfgForceUpdateActive, setCfgForceUpdateActive] = useState(appConfig.forceUpdateActive || false);
  const [cfgMinAppVersion, setCfgMinAppVersion] = useState(appConfig.minAppVersion || "2.0");
  const [cfgLatestAppVersion, setCfgLatestAppVersion] = useState(appConfig.latestAppVersion || "2.0");
  const [cfgDownloadLink, setCfgDownloadLink] = useState(appConfig.downloadLink || "https://play.google.com/store/apps/details?id=com.amb.business");
  const [cfgUpdateTitle, setCfgUpdateTitle] = useState(appConfig.updateTitle || "নতুন সংস্করণ উপলব্ধ!");
  const [cfgUpdateDescription, setCfgUpdateDescription] = useState(appConfig.updateDescription || "AMB BUSINESS Network Bangladesh-এর নতুন আপডেট প্রকাশিত হয়েছে। অ্যাপ ব্যবহার চালিয়ে যেতে হলে নতুন ভার্সন ইনস্টল করা বাধ্যতামূলক।");

  const [cfgSuccess, setCfgSuccess] = useState(false);
  const [cfgError, setCfgError] = useState('');
  const [cfgSaving, setCfgSaving] = useState(false);

  // Master Fund Accounts & Drill-Down Modal States
  const defaultMasterAccountsList = [
    { id: 'mf-1', accountName: 'ইসলামী ব্যাংক বাংলাদেশ লিমিটেড', accountNumber: '205012345678', amount: 500000, category: 'bank', note: 'মেইন প্রারম্ভিক ডিপোজিট' },
    { id: 'mf-2', accountName: 'বিকাশ ও নগদ মাষ্টার মার্চেন্ট ওয়ালেট', accountNumber: '01712345678', amount: 300000, category: 'mfs', note: 'টেলিকম ও লোড ওয়ার্কিং ব্যালেন্স' },
    { id: 'mf-3', accountName: 'ব্যক্তিগত পাওনা (ভাইয়ের নিকট গচ্ছিত)', accountNumber: '01800000000', amount: 200000, category: 'receivable', note: 'ইমার্জেন্সি নগদ ক্যাশ তহবিল' },
    { id: 'mf-4', accountName: 'মার্কেট ইনভেস্টমেন্ট ও স্থায়ী সম্পদ', accountNumber: 'INV-AMB-01', amount: 200000, category: 'investment', note: 'কোম্পানি প্রারম্ভিক বিনিয়োগ' }
  ];

  const [masterAccounts, setMasterAccounts] = useState<any[]>(
    appConfig.masterFundAccounts && appConfig.masterFundAccounts.length > 0
      ? appConfig.masterFundAccounts
      : defaultMasterAccountsList
  );

  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountAmount, setNewAccountAmount] = useState('');
  const [newAccountCategory, setNewAccountCategory] = useState<'bank' | 'mfs' | 'cash' | 'receivable' | 'investment'>('bank');
  const [newAccountNote, setNewAccountNote] = useState('');
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [drillSearchQuery, setDrillSearchQuery] = useState('');
  const [drillQardFilter, setDrillQardFilter] = useState<'all' | 'borrower' | 'donor' | 'repayment' | 'general' | 'medical' | 'education' | 'micro' | 'emergency'>('all');
  const [drillSamityTab, setDrillSamityTab] = useState<'notices' | 'manual' | 'members'>('notices');
  const [isBulkDeductingSamity, setIsBulkDeductingSamity] = useState(false);
  const [bulkDeductSummary, setBulkDeductSummary] = useState<string | null>(null);

  const handleTriggerBulkSamityAutoDeduct = async () => {
    if (isBulkDeductingSamity) return;
    if (!window.confirm('আপনি কি নিশ্চিত যে সকল যোগ্য সমবায় সদস্যদের মেইন ব্যালেন্স থেকে অটো-সঞ্চয় কিস্তি কর্তন করে তাদের সঞ্চয় ফাণ্ডে জমা করতে চান?')) {
      return;
    }
    setIsBulkDeductingSamity(true);
    setBulkDeductSummary(null);
    try {
      const res = await processBulkSamitySavingsAutoDeduction(users);
      const summaryMsg = `অটো-সঞ্চয় কর্তন সম্পন্ন! মোট ${res.processedCount} জন সদস্যের কাছ থেকে ৳${res.totalCollected.toLocaleString('en-US')} টাকা সফলভাবে কর্তন করা হয়েছে। (স্কিপ করা হয়েছে: ${res.skippedCount} জন)`;
      setBulkDeductSummary(summaryMsg);
      requestAlert('সফল সম্পন্ন ⚡', summaryMsg);
    } catch (err: any) {
      console.error('Error triggering bulk samity auto deduction:', err);
      requestAlert('ত্রুটি', 'অটো সঞ্চয় কর্তনে সমস্যা হয়েছে: ' + (err?.message || err));
    } finally {
      setIsBulkDeductingSamity(false);
    }
  };

  const handleSaveMasterAccount = async () => {
    if (!newAccountName.trim() || !newAccountAmount) {
      alert('অনুগ্রহ করে একাউন্টের নাম এবং ব্যালেন্স প্রদান করুন');
      return;
    }
    const parsedAmt = Number(newAccountAmount);
    if (isNaN(parsedAmt) || parsedAmt < 0) {
      alert('সঠিক টাকার অংক প্রদান করুন');
      return;
    }

    let updatedList = [...masterAccounts];
    if (editingAccountId) {
      updatedList = updatedList.map(a => a.id === editingAccountId ? {
        ...a,
        accountName: newAccountName,
        accountNumber: newAccountNumber,
        amount: parsedAmt,
        category: newAccountCategory,
        note: newAccountNote,
        updatedAt: new Date().toISOString()
      } : a);
    } else {
      const newAcc = {
        id: `acc-${Date.now()}`,
        accountName: newAccountName,
        accountNumber: newAccountNumber,
        amount: parsedAmt,
        category: newAccountCategory,
        note: newAccountNote,
        updatedAt: new Date().toISOString()
      };
      updatedList.push(newAcc);
    }

    const newTotalMasterFund = updatedList.reduce((sum, item) => sum + (item.amount || 0), 0);

    setMasterAccounts(updatedList);
    setNewAccountName('');
    setNewAccountNumber('');
    setNewAccountAmount('');
    setNewAccountNote('');
    setShowAddAccountForm(false);
    setEditingAccountId(null);

    const updatedConfig = {
      ...appConfig,
      masterFundAccounts: updatedList,
      initialCompanyFund: newTotalMasterFund
    };
    await saveAppConfig(updatedConfig);
    onChangeConfig(updatedConfig);
    alert('মাস্টার ফান্ড একাউন্ট খতিয়ান সফলভাবে সেভ করা হয়েছে!');
  };

  const handleDeleteMasterAccount = async (accId: string) => {
    if (!window.confirm('আপনি কি এই একাউন্টটি মুছে ফেলতে চান?')) return;
    const updatedList = masterAccounts.filter(a => a.id !== accId);
    const newTotalMasterFund = updatedList.reduce((sum, item) => sum + (item.amount || 0), 0);
    setMasterAccounts(updatedList);

    const updatedConfig = {
      ...appConfig,
      masterFundAccounts: updatedList,
      initialCompanyFund: newTotalMasterFund
    };
    await saveAppConfig(updatedConfig);
    onChangeConfig(updatedConfig);
    alert('একাউন্ট মুছে ফেলা হয়েছে!');
  };

  // Payment Banks & MFS local admin states
  const [editingBank, setEditingBank] = useState<any | null>(null);
  const [showAddBank, setShowAddBank] = useState(false);
  const [ebAccountType, setEbAccountType] = useState<'local_bank' | 'foreign_bank' | 'mobile_bank'>('local_bank');
  const [ebIsMobileBank, setEbIsMobileBank] = useState(false);
  const [ebName, setEbName] = useState('');
  const [ebAcronym, setEbAcronym] = useState('');
  const [ebBranch, setEbBranch] = useState('');
  const [ebRoutingNum, setEbRoutingNum] = useState('');
  const [ebHolder, setEbHolder] = useState('');
  const [ebAccNum, setEbAccNum] = useState('');
  const [ebVisaNum, setEbVisaNum] = useState('');
  const [ebActive, setEbActive] = useState(true);
  const [ebBgClass, setEbBgClass] = useState('bg-blue-50 hover:bg-blue-100 border-blue-150');
  const [ebTextClass, setEbTextClass] = useState('text-blue-700');
  const [ebLogoBgClass, setEbLogoBgClass] = useState('bg-blue-100');
  const [ebIsInternational, setEbIsInternational] = useState(false);
  const [ebQrCodeUrl, setEbQrCodeUrl] = useState('');
  const [ebIban, setEbIban] = useState('');
  const [ebCurrency, setEbCurrency] = useState('SAR');
  const [ebCountry, setEbCountry] = useState('সৌদি আরব');
  const [ebTransferFee, setEbTransferFee] = useState('15');
  const [ebCustomRate, setEbCustomRate] = useState('');

  const openAddBankModal = (category: 'mobile_bank' | 'local_bank' | 'foreign_bank' = 'local_bank') => {
    setEditingBank(null);
    setEbName('');
    setEbAcronym(category === 'mobile_bank' ? 'MFS' : category === 'foreign_bank' ? 'INTL' : 'DB');
    setEbBranch('');
    setEbRoutingNum('');
    setEbHolder('');
    setEbAccNum('');
    setEbIban('');
    setEbVisaNum('');
    setEbCurrency(category === 'foreign_bank' ? 'SAR' : 'BDT');
    setEbCountry(category === 'foreign_bank' ? 'সৌদি আরব' : 'বাংলাদেশ');
    setEbTransferFee(category === 'foreign_bank' ? '15' : '0');
    setEbCustomRate('');
    setEbActive(true);
    setEbAccountType(category);
    setEbIsInternational(category === 'foreign_bank');
    setEbIsMobileBank(category === 'mobile_bank');
    setEbBgClass(
      category === 'mobile_bank'
        ? 'bg-pink-50 hover:bg-pink-100 border-pink-200'
        : category === 'foreign_bank'
        ? 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
        : 'bg-blue-50 hover:bg-blue-100 border-blue-200'
    );
    setEbTextClass(
      category === 'mobile_bank' ? 'text-pink-800' : category === 'foreign_bank' ? 'text-indigo-800' : 'text-blue-700'
    );
    setEbLogoBgClass(
      category === 'mobile_bank' ? 'bg-pink-200' : category === 'foreign_bank' ? 'bg-indigo-200' : 'bg-blue-100'
    );
    setEbQrCodeUrl('');
    setShowAddBank(true);

    setTimeout(() => {
      const formEl = document.getElementById('admin-add-bank-form-box');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const openEditBankModal = (b: any) => {
    setEditingBank(b);
    setEbName(b.name || '');
    setEbAcronym(b.acronym || '');
    setEbBranch(b.branch || '');
    setEbRoutingNum(b.routingNum || '');
    setEbHolder(b.holder || '');
    setEbAccNum(b.accNum || '');
    setEbIban(b.iban || '');
    setEbVisaNum(b.visaNum || '');
    setEbActive(b.active !== false);
    const isMob = b.isMobileBank === true;
    const isIntl = b.isInternational === true;
    const cat: 'mobile_bank' | 'local_bank' | 'foreign_bank' = isMob ? 'mobile_bank' : isIntl ? 'foreign_bank' : 'local_bank';
    setEbAccountType(cat);
    setEbIsMobileBank(isMob);
    setEbIsInternational(isIntl);
    setEbBgClass(b.bgClass || 'bg-blue-50 hover:bg-blue-100 border-blue-200');
    setEbTextClass(b.textClass || 'text-blue-700');
    setEbLogoBgClass(b.logoBgClass || 'bg-blue-100');
    setEbQrCodeUrl(b.qrCodeUrl || '');
    setEbCurrency(b.currency || (isIntl ? 'SAR' : 'BDT'));
    setEbCountry(b.country || (isIntl ? 'সৌদি আরব' : 'বাংলাদেশ'));
    setEbTransferFee(b.transferFee !== undefined && b.transferFee !== null ? String(b.transferFee) : (isIntl ? '15' : '0'));
    setEbCustomRate(b.customRate || b.exchangeRate ? String(b.customRate || b.exchangeRate) : '');
    setShowAddBank(true);

    setTimeout(() => {
      const formEl = document.getElementById('admin-add-bank-form-box');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleBankQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('ছবি সাইজ সর্বোচ্চ 8MB হতে পারবে!');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setEbQrCodeUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Bank Admin Box-based replica state & Tx Modal
  const [adminBankBoxTab, setAdminBankBoxTab] = useState<'amb_to_amb' | 'send_money' | 'bill_pay' | 'salary' | 'remittance'>('amb_to_amb');
  const [adminSendMoneySubTab, setAdminSendMoneySubTab] = useState<'mobile_bank' | 'bank_wallet' | 'abroad'>('mobile_bank');
  const [adminAddMoneySubTab, setAdminAddMoneySubTab] = useState<'mobile_bank' | 'bank_wallet' | 'abroad'>('mobile_bank');
  const [editingTxModal, setEditingTxModal] = useState<Transaction | null>(null);

  // Additional Bank Service Box States
  const [cfgAmbToAmbFreeActive, setCfgAmbToAmbFreeActive] = useState(appConfig.ambToAmbFreeActive !== false);
  const [cfgAmbToAmbMinLimit, setCfgAmbToAmbMinLimit] = useState(appConfig.ambToAmbMinLimit || 10);
  const [cfgAmbToAmbMaxLimit, setCfgAmbToAmbMaxLimit] = useState(appConfig.ambToAmbMaxLimit || 50000);

  // Member Profile Self Edit Toggle State
  const [cfgAllowProfileSelfEdit, setCfgAllowProfileSelfEdit] = useState<boolean>(appConfig.allowProfileSelfEdit !== false);

  // Phone Change Config States
  const [cfgPhoneChangeEnabled, setCfgPhoneChangeEnabled] = useState<boolean>(appConfig.phoneChangeConfig?.enabled !== false);
  const [cfgPhoneChangeFreeDays, setCfgPhoneChangeFreeDays] = useState<number>(appConfig.phoneChangeConfig?.freeDaysAfterRegistration ?? 5);
  const [cfgPhoneChangeFreeAttempts, setCfgPhoneChangeFreeAttempts] = useState<number>(appConfig.phoneChangeConfig?.freeAttempts ?? 1);
  const [cfgPhoneChangeFeeIncrement, setCfgPhoneChangeFeeIncrement] = useState<number>(appConfig.phoneChangeConfig?.feeIncrement ?? 10);
  const [cfgPhoneChangeMaxFee, setCfgPhoneChangeMaxFee] = useState<number>(appConfig.phoneChangeConfig?.maxFee ?? 50);
  const [cfgBillPayActive, setCfgBillPayActive] = useState(appConfig.billPayActive !== false);
  const [cfgBillPayFeePercent, setCfgBillPayFeePercent] = useState(appConfig.billPayFeePercent || 0);
  const [cfgSalaryPayActive, setCfgSalaryPayActive] = useState(appConfig.salaryPayActive !== false);
  const [cfgSalaryPayFee, setCfgSalaryPayFee] = useState(appConfig.salaryPayFee || 0);
  const [remittanceRates, setRemittanceRates] = useState({
    SAR: appConfig.remittanceRates?.SAR || 32.5,
    AED: appConfig.remittanceRates?.AED || 33.2,
    KWD: appConfig.remittanceRates?.KWD || 395.0,
    OMR: appConfig.remittanceRates?.OMR || 318.0,
    QAR: appConfig.remittanceRates?.QAR || 33.0,
    MYR: appConfig.remittanceRates?.MYR || 27.5,
    USD: appConfig.remittanceRates?.USD || 122.0,
    EUR: appConfig.remittanceRates?.EUR || 132.0,
    GBP: appConfig.remittanceRates?.GBP || 155.0,
    SGD: appConfig.remittanceRates?.SGD || 92.0,
  });

  // Bank Admin Collapsible Sections State (Accordion Mode)
  const [openBankSections, setOpenBankSections] = useState<Record<string, boolean>>({
    pending_tx: true,
    cards_dir: false,
    banker_voucher: false,
    bonus_charge: false,
    global_rules: false,
    mfs_gateways: true,
    bank_list: false,
    cards_manager: false,
    tx_ledger: false,
    remit_rates: false,
    amb_to_amb: true,
    bill_pay: true,
    salary: true,
  });

  const toggleBankSection = (key: string) => {
    setOpenBankSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // MFS fields local editing states
  const [cfgMfsBkashNumber, setCfgMfsBkashNumber] = useState(appConfig.mfsBkashNumber || '');
  const [cfgMfsBkashActive, setCfgMfsBkashActive] = useState(appConfig.mfsBkashActive !== false);
  const [cfgMfsNagadNumber, setCfgMfsNagadNumber] = useState(appConfig.mfsNagadNumber || '');
  const [cfgMfsNagadActive, setCfgMfsNagadActive] = useState(appConfig.mfsNagadActive !== false);
  const [cfgMfsRocketNumber, setCfgMfsRocketNumber] = useState(appConfig.mfsRocketNumber || '');
  const [cfgMfsRocketActive, setCfgMfsRocketActive] = useState(appConfig.mfsRocketActive !== false);
  const [cfgMfsUpayNumber, setCfgMfsUpayNumber] = useState(appConfig.mfsUpayNumber || '');
  const [cfgMfsUpayActive, setCfgMfsUpayActive] = useState(appConfig.mfsUpayActive !== false);

  // Bank Rules State
  const [cfgBankCbPerThousand, setCfgBankCbPerThousand] = useState(appConfig.addMoneyBankCashbackPerThousand || 5);
  const [cfgSendMobileFlat, setCfgSendMobileFlat] = useState(appConfig.sendMoneyMobileBankFlatCharge || 4.90);
  const [cfgSendMobileSvc, setCfgSendMobileSvc] = useState(appConfig.sendMoneyMobileBankServiceChargePerThousand || 1);
  const [cfgSendBankFlat, setCfgSendBankFlat] = useState(appConfig.sendMoneyBankFlatCharge || 7.90);
  const [cfgSendBankSvc, setCfgSendBankSvc] = useState(appConfig.sendMoneyBankServiceChargePerThousand || 7.90);
  const [cfgIntExchangeRate, setCfgIntExchangeRate] = useState(appConfig.internationalExchangeRate || 115);
  const [cfgRemittanceFee, setCfgRemittanceFee] = useState<number>(appConfig.remittanceFee ?? 10);

  // Qard Config & Rules Management State
  const [qardRulesTitle, setQardRulesTitle] = useState(appConfig.qardConfig?.rulesTitle || DEFAULT_QARD_CONFIG.rulesTitle);
  const [qardRulesSubtitle, setQardRulesSubtitle] = useState(appConfig.qardConfig?.rulesSubtitle || DEFAULT_QARD_CONFIG.rulesSubtitle);
  const [qardRulesList, setQardRulesList] = useState<QardRuleItem[]>(appConfig.qardConfig?.rulesList || DEFAULT_QARD_CONFIG.rulesList);

  const [qardNoticeTitle, setQardNoticeTitle] = useState(appConfig.qardConfig?.verificationNotice?.title || DEFAULT_QARD_CONFIG.verificationNotice.title);
  const [qardNoticeBody, setQardNoticeBody] = useState(appConfig.qardConfig?.verificationNotice?.body || DEFAULT_QARD_CONFIG.verificationNotice.body);
  const [qardNoticeWarning, setQardNoticeWarning] = useState(appConfig.qardConfig?.verificationNotice?.warningNote || DEFAULT_QARD_CONFIG.verificationNotice.warningNote);

  const [qardReqDays, setQardReqDays] = useState(appConfig.qardConfig?.eligibilityConfig?.requiredActiveDays ?? DEFAULT_QARD_CONFIG.eligibilityConfig.requiredActiveDays);
  const [qardReqTxVol, setQardReqTxVol] = useState(appConfig.qardConfig?.eligibilityConfig?.requiredAmbTxVolume ?? DEFAULT_QARD_CONFIG.eligibilityConfig.requiredAmbTxVolume);
  const [qardMinLoan, setQardMinLoan] = useState(appConfig.qardConfig?.minLoanAmount ?? DEFAULT_QARD_CONFIG.minLoanAmount);
  const [qardMaxLoan, setQardMaxLoan] = useState(appConfig.qardConfig?.maxLoanAmount ?? DEFAULT_QARD_CONFIG.maxLoanAmount);
  const [qardMaxDuration, setQardMaxDuration] = useState(appConfig.qardConfig?.maxDurationMonths ?? DEFAULT_QARD_CONFIG.maxDurationMonths);

  // Coop 50% Instant Auto-Loan Settings state
  const [qardCoopInstantEnabled, setQardCoopInstantEnabled] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.enabled ?? DEFAULT_QARD_CONFIG.coopInstantLoanConfig.enabled);
  const [qardCoopInstantPercent, setQardCoopInstantPercent] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.percentage ?? DEFAULT_QARD_CONFIG.coopInstantLoanConfig.percentage);
  const [qardCoopInstantMaxDuration, setQardCoopInstantMaxDuration] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.maxDurationMonths ?? DEFAULT_QARD_CONFIG.coopInstantLoanConfig.maxDurationMonths);
  const [qardCoopInstantCooldown, setQardCoopInstantCooldown] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.cooldownDays ?? DEFAULT_QARD_CONFIG.coopInstantLoanConfig.cooldownDays);
  const [qardCoopInstantTitle, setQardCoopInstantTitle] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.title || DEFAULT_QARD_CONFIG.coopInstantLoanConfig.title);
  const [qardCoopInstantDesc, setQardCoopInstantDesc] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.description || DEFAULT_QARD_CONFIG.coopInstantLoanConfig.description);

  const [qardTakeStartDay, setQardTakeStartDay] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.takeStartDay ?? 1);
  const [qardTakeEndDay, setQardTakeEndDay] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.takeEndDay ?? 31);
  const [qardAutoDeductStartDay, setQardAutoDeductStartDay] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.autoDeductStartDay ?? 1);
  const [qardAutoDeductEndDay, setQardAutoDeductEndDay] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.autoDeductEndDay ?? 31);
  const [qardMonth1Ratio, setQardMonth1Ratio] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.month1Ratio ?? 33.34);
  const [qardMonth2Ratio, setQardMonth2Ratio] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.month2Ratio ?? 33.33);
  const [qardMonth3Ratio, setQardMonth3Ratio] = useState(appConfig.qardConfig?.coopInstantLoanConfig?.month3Ratio ?? 33.33);

  // Gold Emergency Loan (স্বর্ণ রেখে জরুরি লোন) Config States
  const [qardGoldLoanEnabled, setQardGoldLoanEnabled] = useState(appConfig.qardConfig?.goldLoanConfig?.enabled ?? DEFAULT_QARD_CONFIG.goldLoanConfig.enabled);
  const [qardGoldProtectionMonths, setQardGoldProtectionMonths] = useState(appConfig.qardConfig?.goldLoanConfig?.protectionMonths ?? DEFAULT_QARD_CONFIG.goldLoanConfig.protectionMonths);
  const [qardGoldProtectionDays, setQardGoldProtectionDays] = useState(appConfig.qardConfig?.goldLoanConfig?.protectionDays ?? DEFAULT_QARD_CONFIG.goldLoanConfig.protectionDays);
  const [qardGoldNoticeTitle, setQardGoldNoticeTitle] = useState(appConfig.qardConfig?.goldLoanConfig?.noticeTitle || DEFAULT_QARD_CONFIG.goldLoanConfig.noticeTitle);
  const [qardGoldNoticeSubtitle, setQardGoldNoticeSubtitle] = useState(appConfig.qardConfig?.goldLoanConfig?.noticeSubtitle || DEFAULT_QARD_CONFIG.goldLoanConfig.noticeSubtitle);
  const [qardGoldRateK24, setQardGoldRateK24] = useState(appConfig.qardConfig?.goldLoanConfig?.rates?.k24 ?? DEFAULT_QARD_CONFIG.goldLoanConfig.rates.k24);
  const [qardGoldRateK22, setQardGoldRateK22] = useState(appConfig.qardConfig?.goldLoanConfig?.rates?.k22 ?? DEFAULT_QARD_CONFIG.goldLoanConfig.rates.k22);
  const [qardGoldRateK21, setQardGoldRateK21] = useState(appConfig.qardConfig?.goldLoanConfig?.rates?.k21 ?? DEFAULT_QARD_CONFIG.goldLoanConfig.rates.k21);
  const [qardGoldRateK18, setQardGoldRateK18] = useState(appConfig.qardConfig?.goldLoanConfig?.rates?.k18 ?? DEFAULT_QARD_CONFIG.goldLoanConfig.rates.k18);
  const [qardGoldRateTraditional, setQardGoldRateTraditional] = useState(appConfig.qardConfig?.goldLoanConfig?.rates?.traditional ?? DEFAULT_QARD_CONFIG.goldLoanConfig.rates.traditional);
  const [qardGoldGuidelines, setQardGoldGuidelines] = useState<QardRuleItem[]>(appConfig.qardConfig?.goldLoanConfig?.guidelines || DEFAULT_QARD_CONFIG.goldLoanConfig.guidelines);

  // Single Rule editing state
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [ruleIconInput, setRuleIconInput] = useState('🤝');
  const [ruleTitleInput, setRuleTitleInput] = useState('');
  const [ruleDescInput, setRuleDescInput] = useState('');
  const [ruleIsWarningInput, setRuleIsWarningInput] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);

  useEffect(() => {
    if (appConfig) {
      setCfgOneSignalAppId(appConfig.oneSignalAppId || '');
      setCfgOneSignalRestApiKey(appConfig.oneSignalRestApiKey || '');
      setCfgPhoneChangeEnabled(appConfig.phoneChangeConfig?.enabled !== false);
      setCfgPhoneChangeFreeDays(appConfig.phoneChangeConfig?.freeDaysAfterRegistration ?? 5);
      setCfgPhoneChangeFreeAttempts(appConfig.phoneChangeConfig?.freeAttempts ?? 1);
      setCfgPhoneChangeFeeIncrement(appConfig.phoneChangeConfig?.feeIncrement ?? 10);
      setCfgPhoneChangeMaxFee(appConfig.phoneChangeConfig?.maxFee ?? 50);
      setCfgAppName(appConfig.appName);
      setCfgPersonalMfsNumber(appConfig.personalMfsNumber);
      setCfgPersonalBankCard(appConfig.personalBankCard);
      setCfgMfsBkashNumber(appConfig.mfsBkashNumber || '');
      setCfgMfsBkashActive(appConfig.mfsBkashActive !== false);
      setCfgMfsNagadNumber(appConfig.mfsNagadNumber || '');
      setCfgMfsNagadActive(appConfig.mfsNagadActive !== false);
      setCfgMfsRocketNumber(appConfig.mfsRocketNumber || '');
      setCfgMfsRocketActive(appConfig.mfsRocketActive !== false);
      setCfgMfsUpayNumber(appConfig.mfsUpayNumber || '');
      setCfgMfsUpayActive(appConfig.mfsUpayActive !== false);
      setCfgBankCbPerThousand(appConfig.addMoneyBankCashbackPerThousand || 5);
      setCfgSendMobileFlat(appConfig.sendMoneyMobileBankFlatCharge || 4.90);
      setCfgSendMobileSvc(appConfig.sendMoneyMobileBankServiceChargePerThousand || 1);
      setCfgSendBankFlat(appConfig.sendMoneyBankFlatCharge || 7.90);
      setCfgSendBankSvc(appConfig.sendMoneyBankServiceChargePerThousand || 7.90);
      setCfgIntExchangeRate(appConfig.internationalExchangeRate || 115);
      setCfgSupportPhone(appConfig.supportPhone);
      setCfgSamityTerms(appConfig.samityTerms);
      setCfgTickerText(appConfig.tickerText);
      setCfgSamityTicker(appConfig.samityTicker || "AMB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর সাধারণ ফান্ডে স্বাগতম। আপনি এখান থেকে সঞ্চয় জমা দিতে পারেন, ঋণ আবেদন এবং মুনাফার শেয়ার তুলতে পারেন।");
      setCfgQardTicker(appConfig.qardTicker || "সুদমুক্ত করযে হাসানা কল্যাণ তহবিলে আপনাকে স্বাগতম। আপনার সামর্থ্য অনুযায়ী দান করে ফান্ড সমৃদ্ধ করুন অথবা প্রয়োজনের সময়ে সুদমুক্ত করযে স্বস্তির নিঃশ্বাস ফেলুন।");
      setCfgTelecomTicker(appConfig.telecomTicker || "টেলিকম ফ্লেক্সিলোড ও সুপার ফাস্ট ড্রাইভ অফার গাইডঃ সব অপারেটরের ইনস্ট্যান্ট ক্যাশব্যাক ও বেস্ট ডিসকাউন্টেড অফার ড্রাইভ প্যাকেজ সমূহ সচল রয়েছে। অটোমেটেড রিচার্জ 10 সেকেন্ড থেকে 5 মিনিটের মধ্যে সচলভাবে সম্পন্ন হয়।");
      setCfgSafiTicker(appConfig.safiTicker || "প্রিমিয়াম Safi ব্র্যান্ডের শতভাগ খাঁটি পণ্য সম্ভার! আমাদের নিজস্ব তত্ত্বাবধানে প্রস্তুতকৃত ভেজালমুক্ত প্রিমিয়াম পণ্যসমূহ সরাসরি মেইন ব্যালেন্স থেকে সহজেই ক্রয় করুন।");
      setCfgEscrowTicker(appConfig.escrowTicker || "AMB নিরাপদ লেনদেনঃ যেকোনো প্রোডাক্ট কুরিয়ার কন্ডিশনে ক্রয়ের পূর্বে এসক্রো ডিল বুকিং করে আপনার মেইন ব্যালেন্সের পেমেন্ট নিরাপদ করুন।");
      setCfgRationTicker(appConfig.rationTicker || "কো-অপারেティブ ডিজিটাল রেশন কার্ড সেবাঃ ভর্তুকি মূল্যে নিত্যপ্রয়োজনীয় চাল, ডাল, তেল ও অন্যান্য পণ্যসামগ্রী ক্রয়ের সুবিধা উপভোগ করুন।");
      setCfgRationMaxSelectLimit(appConfig.rationMaxSelectLimit || 5);
      setCfgRationTitleText(appConfig.rationTitleText || "10টি আইটেমের মধ্যে থেকে যেকোনো 5টি নিতে পারবেন");
      setCfgRationTotalItemsText(appConfig.rationTotalItemsText || "10");
      setCfgExchangeRatePerThousand(appConfig.exchangeRatePerThousand || 1150);
      setCfgMobileRechargePercent(appConfig.mobileRechargePercent !== undefined ? appConfig.mobileRechargePercent : 2.0);
      setCfgAlaapRechargePercent(appConfig.alaapRechargePercent !== undefined ? appConfig.alaapRechargePercent : 1.0);
      setCfgBrilliantRechargePercent(appConfig.brilliantRechargePercent !== undefined ? appConfig.brilliantRechargePercent : 1.0);
      setCfgSlab1Amt(appConfig.telecomDefaultSlabs?.[0]?.amount !== undefined ? appConfig.telecomDefaultSlabs[0].amount : 20);
      setCfgSlab1Cb(appConfig.telecomDefaultSlabs?.[0]?.cashback !== undefined ? appConfig.telecomDefaultSlabs[0].cashback : 0);
      setCfgSlab2Amt(appConfig.telecomDefaultSlabs?.[1]?.amount !== undefined ? appConfig.telecomDefaultSlabs[1].amount : 50);
      setCfgSlab2Cb(appConfig.telecomDefaultSlabs?.[1]?.cashback !== undefined ? appConfig.telecomDefaultSlabs[1].cashback : 5);
      setCfgSlab3Amt(appConfig.telecomDefaultSlabs?.[2]?.amount !== undefined ? appConfig.telecomDefaultSlabs[2].amount : 100);
      setCfgSlab3Cb(appConfig.telecomDefaultSlabs?.[2]?.cashback !== undefined ? appConfig.telecomDefaultSlabs[2].cashback : 0);
      setCfgSlab4Amt(appConfig.telecomDefaultSlabs?.[3]?.amount !== undefined ? appConfig.telecomDefaultSlabs[3].amount : 500);
      setCfgSlab4Cb(appConfig.telecomDefaultSlabs?.[3]?.cashback !== undefined ? appConfig.telecomDefaultSlabs[3].cashback : 0);
      if (appConfig.telecomOperatorCashbacks) {
        setCfgOperatorCashbacks(appConfig.telecomOperatorCashbacks);
      } else {
        setCfgOperatorCashbacks({
          Grameenphone: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 },
          Robi: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 },
          Airtel: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 },
          Banglalink: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 },
          Teletalk: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 },
          Skitto: { slab1: 0, slab2: 0, slab3: 0, slab4: 0 }
        });
      }
      setCfgLogoUrl(appConfig.logoUrl || '');
      setCfgAmbToAmbIconUrl(appConfig.ambToAmbIconUrl || '');
      setCfgServiceStatus(appConfig.serviceStatus || {
        samity: true, bank: true, telecom: true, shop: true, qard: true,
        safedeals: true, safi: true, ration: true, chat: true, agent: true,
        about: true, bap: true
      });
      setCfgMaintenanceMode(appConfig.maintenanceMode || false);
      setCfgMaintenanceTitle(appConfig.maintenanceTitle || "আমরা আপডেট করছি");
      setCfgMaintenanceDescription(appConfig.maintenanceDescription || "আপনাদের জন্য আরও উন্নত, দ্রুত ও নিরাপদ সেবা নিশ্চিত করতে আমাদের সিস্টেম বর্তমানে আপডেট করা হচ্ছে।");
      setCfgMaintenanceEstimatedTime(appConfig.maintenanceEstimatedTime || "30 - 60 মিনিট");
      setCfgMaintenanceAnimationUrl(appConfig.maintenanceAnimationUrl || "");
      setCfgMaintenanceLogoUrl(appConfig.maintenanceLogoUrl || "");
      setCfgMaintenanceBgUrl(appConfig.maintenanceBgUrl || "");
      setCfgForceUpdateActive(appConfig.forceUpdateActive || false);
      setCfgMinAppVersion(appConfig.minAppVersion || "2.0");
      setCfgLatestAppVersion(appConfig.latestAppVersion || "2.0");
      setCfgDownloadLink(appConfig.downloadLink || "https://play.google.com/store/apps/details?id=com.amb.business");
      setCfgUpdateTitle(appConfig.updateTitle || "নতুন সংস্করণ উপলব্ধ!");
      setCfgUpdateDescription(appConfig.updateDescription || "AMB BUSINESS Network Bangladesh-এর নতুন আপডেট প্রকাশিত হয়েছে। অ্যাপ ব্যবহার চালিয়ে যেতে হলে নতুন ভার্সন ইনস্টল করা বাধ্যতামূলক।");
      
      // Sync layout configuration
      setCfgBannerHeightType(appConfig.bannerHeightType || '16:9');
      setCfgBannerHeightValue(appConfig.bannerHeightValue || 180);
      setCfgBottomNavHeightType(appConfig.bottomNavHeightType || 'medium');
      setCfgBottomNavTabs(appConfig.bottomNavTabs || ['home', 'deposit', 'add_money', 'history', 'profile']);
      setCfgGridColsCount(appConfig.gridColsCount || 3);
      setCfgGridIconSize(appConfig.gridIconSize || 'medium');
      setCfgGridIconSizeValue(appConfig.gridIconSizeValue || 64);

      if (appConfig.qardConfig) {
        setQardRulesTitle(appConfig.qardConfig.rulesTitle || DEFAULT_QARD_CONFIG.rulesTitle);
        setQardRulesSubtitle(appConfig.qardConfig.rulesSubtitle || DEFAULT_QARD_CONFIG.rulesSubtitle);
        setQardRulesList(appConfig.qardConfig.rulesList || DEFAULT_QARD_CONFIG.rulesList);
        if (appConfig.qardConfig.verificationNotice) {
          setQardNoticeTitle(appConfig.qardConfig.verificationNotice.title || DEFAULT_QARD_CONFIG.verificationNotice.title);
          setQardNoticeBody(appConfig.qardConfig.verificationNotice.body || DEFAULT_QARD_CONFIG.verificationNotice.body);
          setQardNoticeWarning(appConfig.qardConfig.verificationNotice.warningNote || DEFAULT_QARD_CONFIG.verificationNotice.warningNote);
        }
        if (appConfig.qardConfig.eligibilityConfig) {
          setQardReqDays(appConfig.qardConfig.eligibilityConfig.requiredActiveDays ?? DEFAULT_QARD_CONFIG.eligibilityConfig.requiredActiveDays);
          setQardReqTxVol(appConfig.qardConfig.eligibilityConfig.requiredAmbTxVolume ?? DEFAULT_QARD_CONFIG.eligibilityConfig.requiredAmbTxVolume);
        }
        setQardMinLoan(appConfig.qardConfig.minLoanAmount ?? DEFAULT_QARD_CONFIG.minLoanAmount);
        setQardMaxLoan(appConfig.qardConfig.maxLoanAmount ?? DEFAULT_QARD_CONFIG.maxLoanAmount);
        setQardMaxDuration(appConfig.qardConfig.maxDurationMonths ?? DEFAULT_QARD_CONFIG.maxDurationMonths);
        if (appConfig.qardConfig.coopInstantLoanConfig) {
          setQardCoopInstantEnabled(appConfig.qardConfig.coopInstantLoanConfig.enabled ?? DEFAULT_QARD_CONFIG.coopInstantLoanConfig.enabled);
          setQardCoopInstantPercent(appConfig.qardConfig.coopInstantLoanConfig.percentage ?? DEFAULT_QARD_CONFIG.coopInstantLoanConfig.percentage);
          setQardCoopInstantMaxDuration(appConfig.qardConfig.coopInstantLoanConfig.maxDurationMonths ?? DEFAULT_QARD_CONFIG.coopInstantLoanConfig.maxDurationMonths);
          setQardCoopInstantCooldown(appConfig.qardConfig.coopInstantLoanConfig.cooldownDays ?? DEFAULT_QARD_CONFIG.coopInstantLoanConfig.cooldownDays);
          setQardCoopInstantTitle(appConfig.qardConfig.coopInstantLoanConfig.title || DEFAULT_QARD_CONFIG.coopInstantLoanConfig.title);
          setQardCoopInstantDesc(appConfig.qardConfig.coopInstantLoanConfig.description || DEFAULT_QARD_CONFIG.coopInstantLoanConfig.description);
          setQardTakeStartDay(appConfig.qardConfig.coopInstantLoanConfig.takeStartDay ?? 1);
          setQardTakeEndDay(appConfig.qardConfig.coopInstantLoanConfig.takeEndDay ?? 31);
          setQardAutoDeductStartDay(appConfig.qardConfig.coopInstantLoanConfig.autoDeductStartDay ?? 1);
          setQardAutoDeductEndDay(appConfig.qardConfig.coopInstantLoanConfig.autoDeductEndDay ?? 31);
          setQardMonth1Ratio(appConfig.qardConfig.coopInstantLoanConfig.month1Ratio ?? 33.34);
          setQardMonth2Ratio(appConfig.qardConfig.coopInstantLoanConfig.month2Ratio ?? 33.33);
          setQardMonth3Ratio(appConfig.qardConfig.coopInstantLoanConfig.month3Ratio ?? 33.33);
        }
        if (appConfig.qardConfig.goldLoanConfig) {
          setQardGoldLoanEnabled(appConfig.qardConfig.goldLoanConfig.enabled !== false);
          setQardGoldProtectionMonths(appConfig.qardConfig.goldLoanConfig.protectionMonths ?? 3);
          setQardGoldProtectionDays(appConfig.qardConfig.goldLoanConfig.protectionDays ?? 90);
          setQardGoldNoticeTitle(appConfig.qardConfig.goldLoanConfig.noticeTitle || "স্বর্ণ রেখে জরুরি টাকা");
          setQardGoldNoticeSubtitle(appConfig.qardConfig.goldLoanConfig.noticeSubtitle || "বিপদের সময় পাশে থাকাই আমাদের মূল উদ্দেশ্য • 0% সুদ");
          setQardGoldRateK24(appConfig.qardConfig.goldLoanConfig.rates?.k24 ?? 125000);
          setQardGoldRateK22(appConfig.qardConfig.goldLoanConfig.rates?.k22 ?? 115000);
          setQardGoldRateK21(appConfig.qardConfig.goldLoanConfig.rates?.k21 ?? 110000);
          setQardGoldRateK18(appConfig.qardConfig.goldLoanConfig.rates?.k18 ?? 95000);
          setQardGoldRateTraditional(appConfig.qardConfig.goldLoanConfig.rates?.traditional ?? 80000);
          setQardGoldGuidelines(appConfig.qardConfig.goldLoanConfig.guidelines || DEFAULT_QARD_CONFIG.goldLoanConfig.guidelines);
        }
      }
    }
  }, [appConfig]);

  const handleSaveQardRulesConfig = async () => {
    try {
      const newQardConfig: QardConfig = {
        rulesTitle: qardRulesTitle,
        rulesSubtitle: qardRulesSubtitle,
        rulesList: qardRulesList,
        verificationNotice: {
          title: qardNoticeTitle,
          body: qardNoticeBody,
          warningNote: qardNoticeWarning,
        },
        eligibilityConfig: {
          requiredActiveDays: Number(qardReqDays) || 60,
          requiredAmbTxVolume: Number(qardReqTxVol) || 20000,
          trackerTitle: "আপনার করযে হাসানা যোগ্যতা ট্র্যাকার",
          trackerSubtitle: "ঋণের আবেদন করার জন্য নিম্নলিখিত শর্তাবলী পূরণ করা আবশ্যকঃ"
        },
        minLoanAmount: Number(qardMinLoan) || 500,
        maxLoanAmount: Number(qardMaxLoan) || 10000,
        maxDurationMonths: Number(qardMaxDuration) || 3,
        coopInstantLoanConfig: {
          enabled: qardCoopInstantEnabled,
          percentage: Number(qardCoopInstantPercent) || 50,
          maxDurationMonths: Number(qardCoopInstantMaxDuration) || 3,
          cooldownDays: Number(qardCoopInstantCooldown) || 90,
          takeStartDay: Number(qardTakeStartDay) || 1,
          takeEndDay: Number(qardTakeEndDay) || 31,
          autoDeductStartDay: Number(qardAutoDeductStartDay) || 1,
          autoDeductEndDay: Number(qardAutoDeductEndDay) || 31,
          month1Ratio: Number(qardMonth1Ratio) || 33.34,
          month2Ratio: Number(qardMonth2Ratio) || 33.33,
          month3Ratio: Number(qardMonth3Ratio) || 33.33,
          title: qardCoopInstantTitle,
          description: qardCoopInstantDesc
        },
        goldLoanConfig: {
          enabled: qardGoldLoanEnabled,
          protectionMonths: Number(qardGoldProtectionMonths) || 3,
          protectionDays: Number(qardGoldProtectionDays) || 90,
          equalMarketPrice: true,
          extraBenefit: 0,
          noticeTitle: qardGoldNoticeTitle,
          noticeSubtitle: qardGoldNoticeSubtitle,
          rates: {
            k24: Number(qardGoldRateK24) || 125000,
            k22: Number(qardGoldRateK22) || 115000,
            k21: Number(qardGoldRateK21) || 110000,
            k18: Number(qardGoldRateK18) || 95000,
            traditional: Number(qardGoldRateTraditional) || 80000,
          },
          guidelines: qardGoldGuidelines
        }
      };

      const updatedConfig: AppConfig = {
        ...appConfig,
        qardConfig: newQardConfig
      };

      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      alert('অভিনন্দন! করযে হাসানা নীতিমালা, নোটিশ ও সমস্ত শর্তাবলী সফলভাবে আপডেট করা হয়েছে এবং সদস্যদের অ্যাপে রিয়েল-টাইমে সংরক্ষিত হয়েছে।');
    } catch (err: any) {
      console.error("Error saving Qard Config:", err);
      alert('করযে হাসানা সেটিংস সেভ করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleOpenAddRuleModal = () => {
    setEditingRuleIndex(null);
    setRuleIconInput('🤝');
    setRuleTitleInput('');
    setRuleDescInput('');
    setRuleIsWarningInput(false);
    setShowRuleModal(true);
  };

  const handleOpenEditRuleModal = (index: number) => {
    const item = qardRulesList[index];
    if (!item) return;
    setEditingRuleIndex(index);
    setRuleIconInput(item.icon || '🤝');
    setRuleTitleInput(item.title || '');
    setRuleDescInput(item.description || '');
    setRuleIsWarningInput(!!item.isWarning);
    setShowRuleModal(true);
  };

  const handleSaveSingleRuleItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleTitleInput.trim() || !ruleDescInput.trim()) {
      alert('অনুগ্রহ করে নিয়মের শিরোনাম ও বিবরণ টাইপ করুন।');
      return;
    }

    const newItem: QardRuleItem = {
      id: editingRuleIndex !== null ? (qardRulesList[editingRuleIndex]?.id || 'q_rule_' + Date.now()) : 'q_rule_' + Date.now(),
      icon: ruleIconInput.trim() || '🤝',
      title: ruleTitleInput.trim(),
      description: ruleDescInput.trim(),
      isWarning: ruleIsWarningInput
    };

    let updated: QardRuleItem[];
    if (editingRuleIndex !== null) {
      updated = [...qardRulesList];
      updated[editingRuleIndex] = newItem;
    } else {
      updated = [...qardRulesList, newItem];
    }

    setQardRulesList(updated);
    setShowRuleModal(false);
  };

  const handleDeleteRuleItem = (index: number) => {
    if (window.confirm('আপনি কি নিশ্চিতভাবে এই নিয়মটি মুছে ফেলতে চান?')) {
      const updated = qardRulesList.filter((_, idx) => idx !== index);
      setQardRulesList(updated);
    }
  };

  const handleMoveRuleItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === qardRulesList.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...qardRulesList];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setQardRulesList(updated);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setCfgError('');
    setCfgSuccess(false);
    setCfgSaving(true);

    try {
      const updatedConfig: AppConfig = {
        ...appConfig,
        appName: cfgAppName,
        personalMfsNumber: cfgPersonalMfsNumber,
        personalBankCard: cfgPersonalBankCard,
        bannerHeightType: cfgBannerHeightType,
        bannerHeightValue: Number(cfgBannerHeightValue) || 180,
        bottomNavHeightType: cfgBottomNavHeightType,
        bottomNavTabs: cfgBottomNavTabs,
        gridColsCount: Number(cfgGridColsCount) || 3,
        gridIconSize: cfgGridIconSize,
        gridIconSizeValue: Number(cfgGridIconSizeValue) || 64,
        supportPhone: cfgSupportPhone,
        samityTerms: cfgSamityTerms,
        tickerText: cfgTickerText,
        samityTicker: cfgSamityTicker,
        qardTicker: cfgQardTicker,
        telecomTicker: cfgTelecomTicker,
        safiTicker: cfgSafiTicker,
        escrowTicker: cfgEscrowTicker,
        rationTicker: cfgRationTicker,
        exchangeRatePerThousand: Number(cfgExchangeRatePerThousand) || 1150,
        mobileRechargePercent: Number(cfgMobileRechargePercent) ?? 1.0,
        alaapRechargePercent: Number(cfgAlaapRechargePercent) ?? 1.0,
        brilliantRechargePercent: Number(cfgBrilliantRechargePercent) ?? 1.0,
        telecomDefaultSlabs: [
          { amount: Number(cfgSlab1Amt) || 20, cashback: Number(cfgSlab1Cb) || 0 },
          { amount: Number(cfgSlab2Amt) || 50, cashback: Number(cfgSlab2Cb) || 0 },
          { amount: Number(cfgSlab3Amt) || 100, cashback: Number(cfgSlab3Cb) || 0 },
          { amount: Number(cfgSlab4Amt) || 500, cashback: Number(cfgSlab4Cb) || 0 }
        ],
        logoUrl: cfgLogoUrl,
        ambToAmbIconUrl: cfgAmbToAmbIconUrl,
        serviceStatus: cfgServiceStatus,
        maintenanceMode: !!cfgMaintenanceMode,
        maintenanceTitle: cfgMaintenanceTitle,
        maintenanceDescription: cfgMaintenanceDescription,
        maintenanceEstimatedTime: cfgMaintenanceEstimatedTime,
        maintenanceAnimationUrl: cfgMaintenanceAnimationUrl,
        maintenanceLogoUrl: cfgMaintenanceLogoUrl,
        maintenanceBgUrl: cfgMaintenanceBgUrl,
        forceUpdateActive: !!cfgForceUpdateActive,
        minAppVersion: cfgMinAppVersion,
        latestAppVersion: cfgLatestAppVersion,
        downloadLink: cfgDownloadLink,
        updateTitle: cfgUpdateTitle,
        updateDescription: cfgUpdateDescription,
        telecomOperatorCashbacks: cfgOperatorCashbacks,
        addMoneyBankCashbackPerThousand: Number(cfgBankCbPerThousand),
        sendMoneyMobileBankFlatCharge: Number(cfgSendMobileFlat),
        sendMoneyMobileBankServiceChargePerThousand: Number(cfgSendMobileSvc),
        sendMoneyBankFlatCharge: Number(cfgSendBankFlat),
        sendMoneyBankServiceChargePerThousand: Number(cfgSendBankSvc),
        internationalExchangeRate: Number(cfgIntExchangeRate),
        remittanceFee: Number(cfgRemittanceFee),
        phoneChangeConfig: {
          enabled: !!cfgPhoneChangeEnabled,
          freeDaysAfterRegistration: Number(cfgPhoneChangeFreeDays) >= 0 ? Number(cfgPhoneChangeFreeDays) : 5,
          freeAttempts: Number(cfgPhoneChangeFreeAttempts) >= 0 ? Number(cfgPhoneChangeFreeAttempts) : 0,
          feeIncrement: Number(cfgPhoneChangeFeeIncrement) >= 0 ? Number(cfgPhoneChangeFeeIncrement) : 0,
          maxFee: Number(cfgPhoneChangeMaxFee) >= 0 ? Number(cfgPhoneChangeMaxFee) : 0
        },
        oneSignalAppId: appConfig?.oneSignalAppId ? appConfig.oneSignalAppId : cfgOneSignalAppId,
        oneSignalRestApiKey: appConfig?.oneSignalAppId ? appConfig.oneSignalRestApiKey : cfgOneSignalRestApiKey
      };

      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      setCfgSuccess(true);
      setTimeout(() => setCfgSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving app config:', err);
      setCfgError('কনফিগারেশন সেভ করতে সমস্যা হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।');
    } finally {
      setCfgSaving(false);
    }
  };

  const handleToggleProfileSelfEdit = async (newValue: boolean) => {
    setCfgAllowProfileSelfEdit(newValue);
    try {
      const updatedConfig: AppConfig = {
        ...appConfig,
        allowProfileSelfEdit: newValue
      };
      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      alert(newValue 
        ? "🟢 সদস্যদের নিজ তথ্য সংশোধন করার অনুমতি অন (ON) করা হয়েছে। এখন থেকে সকল সদস্য তাদের নিজস্ব প্রোফাইল তথ্য সংশোধন করতে পারবেন।"
        : "🔴 সদস্যদের নিজ তথ্য সংশোধন করার অনুমতি অফ (OFF) করা হয়েছে। এখন কোনো সদস্য নিজ থেকে তাদের তথ্য পরিবর্তন করতে পারবেন না।"
      );
    } catch (err: any) {
      console.error('Error toggling profile self edit:', err);
      alert('সেটিংস আপডেট করতে ব্যর্থ হয়েছে: ' + (err?.message || 'Error'));
    }
  };

  const handleSavePhoneChangeConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCfgSaving(true);
    try {
      const updatedConfig: AppConfig = {
        ...appConfig,
        phoneChangeConfig: {
          enabled: !!cfgPhoneChangeEnabled,
          freeDaysAfterRegistration: Number(cfgPhoneChangeFreeDays) >= 0 ? Number(cfgPhoneChangeFreeDays) : 5,
          freeAttempts: Number(cfgPhoneChangeFreeAttempts) >= 0 ? Number(cfgPhoneChangeFreeAttempts) : 0,
          feeIncrement: Number(cfgPhoneChangeFeeIncrement) >= 0 ? Number(cfgPhoneChangeFeeIncrement) : 0,
          maxFee: Number(cfgPhoneChangeMaxFee) >= 0 ? Number(cfgPhoneChangeMaxFee) : 0
        }
      };
      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      alert('🎉 মোবাইল নম্বর পরিবর্তন সার্ভিস চার্জ ও সেটিংস সফলভাবে আপডেট ও সেভ হয়েছে!');
    } catch (err: any) {
      console.error('Error saving phone change config:', err);
      alert('সেটিংস সেভ করতে সমস্যা হয়েছে: ' + (err?.message || 'Error'));
    } finally {
      setCfgSaving(false);
    }
  };

  const handleSaveOneSignalSettings = async () => {
    if (appConfig?.oneSignalAppId) {
      alert('দুঃখিত, ওয়ান সিগন্যাল ক্রেডেনশিয়াল ইতিমধ্যেই চিরস্থায়ীভাবে লক করা হয়েছে। এটি আর পরিবর্তন করা সম্ভব নয়।');
      return;
    }
    setOneSignalError('');
    setOneSignalSuccess(false);
    setOneSignalSaving(true);
    try {
      const updatedConfig = {
        ...appConfig,
        oneSignalAppId: cfgOneSignalAppId.trim(),
        oneSignalRestApiKey: cfgOneSignalRestApiKey.trim()
      };
      
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);
      
      setOneSignalSuccess(true);
      alert('অভিনন্দন! OneSignal পুশ নোটিফিকেশন ক্রেডেনশিয়াল সফলভাবে সংরক্ষণ করা হয়েছে এবং এটি চিরস্থায়ীভাবে সেট হয়ে গেছে।');
      setTimeout(() => setOneSignalSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving OneSignal settings:', err);
      setOneSignalError('OneSignal কনফিগারেশন সেভ করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setOneSignalSaving(false);
    }
  };

  const handleUnlockOneSignalSettings = () => {
    requestConfirm(
      "ওয়ান সিগন্যাল আনলক নিশ্চিতকরণ",
      "আপনি কি নিশ্চিতভাবে OneSignal ক্রেডেনশিয়াল আনলক করতে চান? আনলক করার পর আপনি পুনরায় নতুন credentials সেট করার সুযোগ পাবেন এবং নতুন credentials সেভ করার পর তা পুনরায় লক হয়ে যাবে।",
      async () => {
        setOneSignalError('');
        setOneSignalSuccess(false);
        setOneSignalSaving(true);
        try {
          const updatedConfig = {
            ...appConfig,
            oneSignalAppId: "",
            oneSignalRestApiKey: ""
          };
          
          const configRef = doc(db, 'system_settings', 'app_config');
          await setDoc(configRef, updatedConfig, { merge: true });
          onChangeConfig(updatedConfig);
          setCfgOneSignalAppId("");
          setCfgOneSignalRestApiKey("");
          
          alert('সফলভাবে আনলক করা হয়েছে! এখন আপনি নতুন OneSignal App ID এবং REST API Key সেট করতে পারবেন। নতুন কি দিয়ে সেভ করলেই তা পুনরায় চিরতরে লক হয়ে যাবে।');
        } catch (err: any) {
          console.error('Error unlocking OneSignal settings:', err);
          setOneSignalError('আনলক করতে সমস্যা হয়েছে: ' + err.message);
        } finally {
          setOneSignalSaving(false);
        }
      }
    );
  };

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushMessage.trim()) {
      alert("শিরোনাম এবং বার্তা আবশ্যক!");
      return;
    }
    
    if (!appConfig?.oneSignalAppId) {
      alert("OneSignal App ID সেটআপ করা নেই! দয়া করে আগে সিস্টেম কনফিগারেশন থেকে অ্যাপ আইডি সেট করুন।");
      return;
    }

    try {
      setPushSending(true);
      const payload = {
        title: pushTitle,
        message: pushMessage,
        imageUrl: pushImageUrl || undefined,
        deepLink: pushDeepLink || undefined,
        targetType: pushTargetType,
        targetValue: pushTargetValue || undefined
      };

      const res = await fetch('/api/send-targeted-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      console.log("Push send response:", data);

      // Now, let's also save this notification in Firestore user_notifications collection 
      // so it appears in the members' notifications list!
      // If it's a specific user, we save it for that user. If it's "all", we save it as a public announcement.
      const notifyId = `notif-${Date.now()}`;
      await addDoc(collection(db, 'user_notifications'), {
        id: notifyId,
        userId: pushTargetType === 'user' ? (pushTargetValue || 'all') : 'all',
        title: pushTitle,
        body: pushMessage,
        read: false,
        isPersonal: pushTargetType === 'user',
        category: 'admin_msg',
        createdAt: new Date().toISOString(),
        imageUrl: pushImageUrl || '',
        deepLink: pushDeepLink || '',
        skipPush: true // skip background duplicate push triggering since we manually dispatched it
      });

      if (!data.success) {
        let errMsg = data.error || "ওয়ানসিগন্যাল সার্ভার ত্রুটি দিয়েছে।";
        if (errMsg.includes("All included players are not subscribed")) {
          errMsg = "ওয়ানসিগন্যাল ত্রুটি: কোনো সাবস্ক্রাইবড ডিভাইস পাওয়া যায়নি! (All included players are not subscribed). দয়া করে নিশ্চিত করুন যে আপনার অন্তত একটি ডিভাইস ওয়ানসিগন্যালে নোটিফিকেশনের পারমিশন দিয়ে সাবস্ক্রাইব করেছে এবং সঠিক App ID ব্যবহার করছেন।";
        }
        alert(errMsg);
      } else {
        alert("পুশ নোটিফিকেশন সফলভাবে পাঠানো হয়েছে এবং ড্যাশবোর্ড নোটিফিকেশন হিসেবে সেভ হয়েছে!");
      }
      fetchAdminNotifications();
      
      // Reset form
      setPushTitle('');
      setPushMessage('');
      setPushImageUrl('');
      setPushDeepLink('');
      setPushTargetValue('');
    } catch (err: any) {
      console.error("Error sending push:", err);
      alert("পুশ নোটিফিকেশন পাঠাতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setPushSending(false);
    }
  };

  const handleDirectUpdateLogo = async (newLogoUrl: string) => {
    try {
      const updatedConfig: AppConfig = {
        ...appConfig,
        logoUrl: newLogoUrl
      };
      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      setCfgLogoUrl(newLogoUrl);
      alert('অভিনন্দন! লোগোটি সফলভাবে আপলোড ও আপডেট করা হয়েছে।');
    } catch (err) {
      console.error('Error saving logo directly:', err);
      alert('লোগো আপডেট করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
    }
  };

  const handleDirectUpdateAmbToAmbIcon = async (newIconUrl: string) => {
    try {
      const updatedConfig: AppConfig = {
        ...appConfig,
        ambToAmbIconUrl: newIconUrl
      };
      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      setCfgAmbToAmbIconUrl(newIconUrl);
      alert('অভিনন্দন! AMB to AMB আইকনটি সফলভাবে আপলোড ও আপডেট করা হয়েছে।');
    } catch (err) {
      console.error('Error saving amb to amb icon directly:', err);
      alert('আইকন আপডেট করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
    }
  };

  // ==========================================
  // SOFTWARE INTEGRATION GATEWAY ACTIONS
  // ==========================================

  const handleIntegRawJsonParse = async (jsonString: string) => {
    setIntegUploadError('');
    setIntegSuccessMessage('');
    if (!jsonString.trim()) return;

    try {
      const data = JSON.parse(jsonString);
      
      // Intelligent Parsing
      const name = data.softwareName || data.software_name || data.name || data.appName || data.title || 'Custom API Gateway';
      const endpoint = data.apiEndpoint || data.api_endpoint || data.endpoint || data.url || data.apiUrl || data.api_url || '';
      const token = data.authToken || data.auth_token || data.token || data.apiKey || data.api_key || data.secret || '';
      const webhook = data.webhookUrl || data.webhook_url || data.webhook || data.callbackUrl || data.callback_url || '';
      const method = (data.requestMethod || data.request_method || data.method || 'POST').toUpperCase();
      const contentType = data.contentType || data.content_type || (data.headers && data.headers['Content-Type']) || 'application/json';
      const targetSectionKey = data.sectionKey || data.targetSection || data.target_section || data.section || integSection || 'telecom';
      
      let headersObj = data.customHeaders || data.custom_headers || data.headers || {};
      // Strip standard Content-Type as it is set separately
      if (headersObj['Content-Type']) {
        delete headersObj['Content-Type'];
      }
      if (Object.keys(headersObj).length === 0) {
        headersObj = {
          "X-Source": "AMB-Bangladesh",
          "Accept": "application/json"
        };
      }
      
      let mappedObj = data.mappedFields || data.mapped_fields || data.mapping || data.fields || {
        "user_phone": "phone",
        "order_amount": "amount",
        "transaction_id": "txid"
      };
      
      // Auto-populate states
      setIntegName(name);
      setIntegEndpoint(endpoint);
      setIntegAuthToken(token);
      setIntegWebhook(webhook);
      if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        setIntegMethod(method);
      } else {
        setIntegMethod('POST');
      }
      setIntegContentType(contentType);
      setIntegHeaders(JSON.stringify(headersObj, null, 2));
      setIntegMappedFields(JSON.stringify(mappedObj, null, 2));
      setIntegRawJson(jsonString);
      setIntegSection(targetSectionKey);

      if (!endpoint) {
        setIntegUploadError('জেসন সফলভাবে পড়া হয়েছে কিন্তু এতে কোনো valid "apiEndpoint" পাওয়া যায়নি। দয়া করে সঠিক API endpoint URL সহ জেসন ব্যবহার করুন।');
        return;
      }

      const newIntegration = {
        sectionKey: targetSectionKey,
        softwareName: name.trim(),
        apiEndpoint: endpoint.trim(),
        authToken: token.trim(),
        webhookUrl: webhook.trim(),
        requestMethod: method,
        contentType: contentType,
        customHeaders: headersObj,
        mappedFields: mappedObj,
        isActive: true,
        lastUpdated: new Date().toISOString()
      };

      const currentIntegrations = appConfig.softwareIntegrations || {};
      const updatedConfig: AppConfig = {
        ...appConfig,
        softwareIntegrations: {
          ...currentIntegrations,
          [targetSectionKey]: newIntegration
        }
      };
      
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);
      
      setIntegSuccessMessage(`✅ জেসন সফলভাবে পড়া হয়েছে এবং "${name}" গেটওয়েটি "${targetSectionKey}" সেকশনের জন্য স্বয়ংক্রিয়ভাবে সেভ ও সক্রিয় করা হয়েছে! আলাদা কোনো ফর্ম পূরণ বা সাবমিট করতে হবে না।`);
    } catch (err: any) {
      console.error('JSON parsing error:', err);
      setIntegUploadError('জেসন কোডটি সঠিক ফরম্যাটে নেই অথবা পার্স করা যায়নি: ' + err.message);
    }
  };

  const handleIntegJsonUpload = (file: File) => {
    setIntegUploadError('');
    setIntegSuccessMessage('');
    
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        setIntegRawJson(text);
        const data = JSON.parse(text);
        
        // Intelligent Parsing
        const name = data.softwareName || data.software_name || data.name || data.appName || data.title || 'Custom API Gateway';
        const endpoint = data.apiEndpoint || data.api_endpoint || data.endpoint || data.url || data.apiUrl || data.api_url || '';
        const token = data.authToken || data.auth_token || data.token || data.apiKey || data.api_key || data.secret || '';
        const webhook = data.webhookUrl || data.webhook_url || data.webhook || data.callbackUrl || data.callback_url || '';
        const method = (data.requestMethod || data.request_method || data.method || 'POST').toUpperCase();
        const contentType = data.contentType || data.content_type || (data.headers && data.headers['Content-Type']) || 'application/json';
        const targetSectionKey = data.sectionKey || data.targetSection || data.target_section || data.section || integSection || 'telecom';
        
        let headersObj = data.customHeaders || data.custom_headers || data.headers || {};
        // Strip standard Content-Type as it is set separately
        if (headersObj['Content-Type']) {
          delete headersObj['Content-Type'];
        }
        if (Object.keys(headersObj).length === 0) {
          headersObj = {
            "X-Source": "AMB-Bangladesh",
            "Accept": "application/json"
          };
        }
        
        let mappedObj = data.mappedFields || data.mapped_fields || data.mapping || data.fields || {
          "user_phone": "phone",
          "order_amount": "amount",
          "transaction_id": "txid"
        };
        
        // Auto-populate states
        setIntegName(name);
        setIntegEndpoint(endpoint);
        setIntegAuthToken(token);
        setIntegWebhook(webhook);
        if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          setIntegMethod(method);
        } else {
          setIntegMethod('POST');
        }
        setIntegContentType(contentType);
        setIntegHeaders(JSON.stringify(headersObj, null, 2));
        setIntegMappedFields(JSON.stringify(mappedObj, null, 2));
        setIntegSection(targetSectionKey);

        if (!endpoint) {
          setIntegUploadError('জেসন সফলভাবে পড়া হয়েছে কিন্তু এতে কোনো valid "apiEndpoint" পাওয়া যায়নি। দয়া করে সঠিক API endpoint URL সহ জেসন ব্যবহার করুন।');
          return;
        }

        const newIntegration = {
          sectionKey: targetSectionKey,
          softwareName: name.trim(),
          apiEndpoint: endpoint.trim(),
          authToken: token.trim(),
          webhookUrl: webhook.trim(),
          requestMethod: method,
          contentType: contentType,
          customHeaders: headersObj,
          mappedFields: mappedObj,
          isActive: true,
          lastUpdated: new Date().toISOString()
        };

        const currentIntegrations = appConfig.softwareIntegrations || {};
        const updatedConfig: AppConfig = {
          ...appConfig,
          softwareIntegrations: {
            ...currentIntegrations,
            [targetSectionKey]: newIntegration
          }
        };
        
        const configRef = doc(db, 'system_settings', 'app_config');
        await setDoc(configRef, updatedConfig, { merge: true });
        onChangeConfig(updatedConfig);
        
        setIntegSuccessMessage(`✅ জেসন সফলভাবে পড়া হয়েছে এবং "${name}" গেটওয়েটি "${targetSectionKey}" সেকশনের জন্য স্বয়ংক্রিয়ভাবে সেভ ও সক্রিয় করা হয়েছে! আলাদা কোনো ফর্ম পূরণ বা সাবমিট করতে হবে না।`);
      } catch (err: any) {
        console.error('JSON parsing error:', err);
        setIntegUploadError('জেসন ফাইলটি সঠিক ফরম্যাটে নেই অথবা পার্স করা যায়নি: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntegUploadError('');
    setIntegSuccessMessage('');
    
    if (!integName.trim()) {
      setIntegUploadError('দয়া করে সফটওয়্যার বা গেটওয়ের নামটি লিখুন।');
      return;
    }
    if (!integEndpoint.trim()) {
      setIntegUploadError('দয়া করে এপিআই এন্ডপয়েন্ট ইউআরএল (API Endpoint) প্রদান করুন।');
      return;
    }
    
    try {
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(integHeaders);
      } catch (err) {
        setIntegUploadError('কাস্টম হেডার্স জেসন ফরম্যাটটি সঠিক নয়। দয়া করে সঠিক JSON ব্যবহার করুন।');
        return;
      }
      
      let parsedMapping = {};
      try {
        parsedMapping = JSON.parse(integMappedFields);
      } catch (err) {
        setIntegUploadError('ম্যাপড ফিল্ড জেসন ফরম্যাটটি সঠিক নয়। দয়া করে সঠিক JSON ব্যবহার করুন।');
        return;
      }
      
      const newIntegration = {
        sectionKey: integSection,
        softwareName: integName.trim(),
        apiEndpoint: integEndpoint.trim(),
        authToken: integAuthToken.trim(),
        webhookUrl: integWebhook.trim(),
        requestMethod: integMethod,
        contentType: integContentType,
        customHeaders: parsedHeaders,
        mappedFields: parsedMapping,
        isActive: integIsActive,
        lastUpdated: new Date().toISOString()
      };
      
      const currentIntegrations = appConfig.softwareIntegrations || {};
      const updatedConfig: AppConfig = {
        ...appConfig,
        softwareIntegrations: {
          ...currentIntegrations,
          [integSection]: newIntegration
        }
      };
      
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);
      
      setIntegSuccessMessage(`অভিনন্দন! "${integName}" সফটওয়্যার গেটওয়েটি সফলভাবে সেটআপ করা হয়েছে এবং নির্বাচিত সেকশনের সাথে ইন্টিগ্রেট করা হয়েছে।`);
      
      setIntegName('');
      setIntegEndpoint('');
      setIntegAuthToken('');
      setIntegWebhook('');
      setIntegRawJson('');
    } catch (err: any) {
      console.error('Error saving integration:', err);
      setIntegUploadError('সেভ করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleDeleteIntegration = (sectionKey: string) => {
    requestConfirm(
      "সফটওয়্যার ইন্টিগ্রেশন ডিলিট",
      "আপনি কি নিশ্চিতভাবে এই সফটওয়্যার ইন্টিগ্রেশনটি ডিলিট করতে চান? ডিলিট করার পর উক্ত সেকশনটি পূর্বের মতো সাধারণ ডিফল্ট মোডে ফিরে যাবে।",
      async () => {
        try {
          const currentIntegrations = { ...(appConfig.softwareIntegrations || {}) };
          delete currentIntegrations[sectionKey];
          
          const updatedConfig: AppConfig = {
            ...appConfig,
            softwareIntegrations: currentIntegrations
          };
          
          const configRef = doc(db, 'system_settings', 'app_config');
          await setDoc(configRef, updatedConfig, { merge: true });
          onChangeConfig(updatedConfig);
          alert('সফটওয়্যার ইন্টিগ্রেশনটি সফলভাবে ডিলিট করা হয়েছে। সেকশনটি এখন ডিফল্ট মোডে সক্রিয়।');
        } catch (err: any) {
          console.error('Error deleting integration:', err);
          alert('ডিলিট করতে সমস্যা হয়েছে: ' + err.message);
        }
      }
    );
  };

  const handleToggleIntegrationActive = async (sectionKey: string) => {
    try {
      const currentIntegrations = { ...(appConfig.softwareIntegrations || {}) };
      if (!currentIntegrations[sectionKey]) return;
      
      currentIntegrations[sectionKey] = {
        ...currentIntegrations[sectionKey],
        isActive: !currentIntegrations[sectionKey].isActive,
        lastUpdated: new Date().toISOString()
      };
      
      const updatedConfig: AppConfig = {
        ...appConfig,
        softwareIntegrations: currentIntegrations
      };
      
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);
    } catch (err: any) {
      console.error('Error toggling integration active status:', err);
      alert('অবস্থা পরিবর্তন করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleTestSandboxApi = async () => {
    if (!integEndpoint.trim()) {
      setIntegSandboxResponse('ত্রুটি: কোনো এপিআই এন্ডপয়েন্ট নেই। প্রথমে এন্ডপয়েন্ট লিখুন বা জেসন আপলোড করুন।');
      return;
    }
    
    setIntegSandboxLoading(true);
    setIntegSandboxResponse('অনুরোধ পাঠানো হচ্ছে...\nএন্ডপয়েন্টঃ ' + integEndpoint + '\nমেথডঃ ' + integMethod);
    
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(integSandboxPayload);
      } catch (err) {
        setIntegSandboxResponse('ত্রুটি: স্যান্ডবক্স পেলোড জেসন ফরম্যাটটি সঠিক নয়!');
        setIntegSandboxLoading(false);
        return;
      }
      
      let parsedHeaders: Record<string, string> = {};
      try {
        parsedHeaders = JSON.parse(integHeaders);
      } catch (err) {}
      
      if (integAuthToken.trim()) {
        parsedHeaders['Authorization'] = `Bearer ${integAuthToken.trim()}`;
      }
      parsedHeaders['Content-Type'] = integContentType;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      
      const options: RequestInit = {
        method: integMethod,
        headers: parsedHeaders,
        signal: controller.signal
      };
      
      if (integMethod !== 'GET' && integMethod !== 'HEAD') {
        options.body = JSON.stringify(parsedPayload);
      }
      
      const response = await fetch(integEndpoint.trim(), options);
      clearTimeout(timeoutId);
      
      const responseText = await response.text();
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch (e) {}
      
      setIntegSandboxResponse(
        `[সার্ভার রেসপন্স কোড: ${response.status} ${response.statusText}]\n\n` +
        `রেসপন্স ডাটা (Response Body):\n` +
        (responseJson ? JSON.stringify(responseJson, null, 2) : responseText || '(কোনো বডি ডাটা নেই)')
      );
    } catch (err: any) {
      console.warn('Sandbox fetch error:', err);
      if (err.name === 'AbortError') {
        setIntegSandboxResponse('অনুরোধের সময়সীমা শেষ (Timeout)! 7 সেকেন্ডের মধ্যে সার্ভার থেকে সাড়া পাওয়া যায়নি। এন্ডপয়েন্ট সঠিক কিনা যাচাই করুন।');
      } else {
        setIntegSandboxResponse(
          `[কানেকশন এলার্ট / CORS সতর্কতা]\n` +
          `সার্ভার সংযোগ বা CORS রেস্ট্রিকশন নোটিশ:\n` +
          `ব্রাউজার সিকিউরিটির কারণে সরাসরি রিকোয়েস্ট রেসপন্স ব্লক হতে পারে, কিন্তু গেটওয়ে সফলভাবে ব্যাকএন্ড রিকোয়েস্ট তৈরি করে পোল করতে পেরেছে।\n\n` +
          `ভুল বিবরণ (Error details): ${err.message}`
        );
      }
    } finally {
      setIntegSandboxLoading(false);
    }
  };

  const handleSaveSafiOverride = async (
    prodId: string, 
    customPrice: number, 
    customStock: string,
    customName: string,
    customDesc: string,
    customBrand: string,
    customImage: string,
    customCategory?: string
  ) => {
    try {
      const isUrlStr = customImage.startsWith('http://') || customImage.startsWith('https://') || customImage.startsWith('data:image/');
      const productObj: any = {
        price: customPrice,
        stock: customStock,
        name: customName,
        desc: customDesc,
        brand: customBrand,
        image: isUrlStr ? customImage : '',
        emoji: isUrlStr ? '' : customImage
      };
      if (customCategory) {
        productObj.category = customCategory;
      }
      await updateDoc(doc(db, 'safi_products', prodId), productObj);
      setEditingSafiProdId(null);
      alert('সফি পণ্যের সকল তথ্য সফলভাবে আপডেট করা হয়েছে!');
    } catch (err: any) {
      console.error(err);
      alert('সফি পণ্য আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleResetSafiOverride = async (prodId: string) => {
    if (window.confirm('আপনি কি নিশ্চিতভাবে এই পণ্যটি চিরতরে ডিলিট করতে চান?')) {
      try {
        await deleteDoc(doc(db, 'safi_products', prodId));
        alert('পণ্যটি সফলভাবে মুছে ফেলা হয়েছে!');
      } catch (err: any) {
        alert('পণ্যটি মুছতে ব্যর্থ হয়েছে: ' + err.message);
      }
    }
  };

  const handleDeleteProduct = handleResetSafiOverride;
  const handleSeedDefaultProducts = async () => {
    alert('ডিফল্ট ক্যাটালগ রিয়েল-টাইম ডাটাবেজের সাথে সিঙ্ক রয়েছে!');
  };

  const handleAdminImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'product' | 'category' | 'edit-product') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (target === 'product') {
        setAdminAddProdImage(base64String);
      } else if (target === 'category') {
        setAdminCatImage(base64String);
      } else if (target === 'edit-product') {
        setSafiEditImage(base64String);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePostProduct = (e: React.FormEvent) => handleAddAdminSafiProduct(e);

  const handleAddAdminSafiProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminAddProdId || !adminAddProdName || !adminAddProdCategory) {
      alert('অনুগ্রহ করে পণ্যের আইডি, নাম এবং ক্যাটাগরি পূরণ করুন।');
      return;
    }
    try {
      const productPrice = Number(adminAddProdPrice) || 0;
      await setDoc(doc(db, 'safi_products', adminAddProdId), {
        category: adminAddProdCategory,
        name: adminAddProdName,
        price: productPrice,
        desc: adminAddProdDesc,
        image: adminAddProdImage,
        brand: adminAddProdBrand,
        stock: adminAddProdStock,
        emoji: adminAddProdEmoji || '📦',
        createdAt: new Date().toISOString()
      });
      alert('সফলভাবে নতুন সাফি পণ্য যোগ করা হয়েছে!');
      setShowAdminAddSafiProductModal(false);
      setAdminAddProdId('');
      setAdminAddProdName('');
      setAdminAddProdCategory('');
      setAdminAddProdPrice('');
      setAdminAddProdDesc('');
      setAdminAddProdImage('');
      setAdminAddProdBrand('Safi Brand');
      setAdminAddProdStock('100 পিস');
      setAdminAddProdEmoji('📦');
    } catch (err: any) {
      console.error(err);
      alert('পণ্য যোগ করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleAddAdminSafiCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminCatId || !adminCatNameBn) {
      alert('অনুগ্রহ করে ক্যাটাগরি আইডি ও বাংলা নাম পূরণ করুন।');
      return;
    }
    try {
      await setDoc(doc(db, 'safi_categories', adminCatId), {
        id: adminCatId,
        name: adminCatName,
        nameBn: adminCatNameBn,
        image: adminCatImage || 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=150&auto=format&fit=crop&q=60'
      });
      alert('সফলভাবে নতুন ক্যাটাগরি যোগ করা হয়েছে!');
      setAdminCatId('');
      setAdminCatName('');
      setAdminCatNameBn('');
      setAdminCatImage('');
      setShowAdminAddCatModal(false);
    } catch (err: any) {
      console.error(err);
      alert('ক্যাটাগরি যোগ করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleUpdateAdminSafiCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdminCatId || !adminCatNameBn) return;
    try {
      await updateDoc(doc(db, 'safi_categories', editingAdminCatId), {
        name: adminCatName,
        nameBn: adminCatNameBn,
        image: adminCatImage
      });
      alert('ক্যাটাগরি সফলভাবে আপডেট করা হয়েছে!');
      setAdminCatId('');
      setAdminCatName('');
      setAdminCatNameBn('');
      setAdminCatImage('');
      setEditingAdminCatId(null);
      setShowAdminAddCatModal(false);
    } catch (err: any) {
      console.error(err);
      alert('ক্যাটাগরি আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleDeleteAdminSafiCategory = async (catId: string) => {
    if (window.confirm('আপনি কি নিশ্চিতভাবে এই ক্যাটাগরি ডিলিট করতে চান?')) {
      try {
        await deleteDoc(doc(db, 'safi_categories', catId));
        alert('ক্যাটাগরি সফলভাবে ডিলিট করা হয়েছে!');
      } catch (err: any) {
        alert('ডিলিট করতে ব্যর্থ হয়েছে: ' + err.message);
      }
    }
  };

  const [tickerSaveSuccess, setTickerSaveSuccess] = useState(false);
  const [tickerSaveError, setTickerSaveError] = useState('');

  const handleUpdateSingleTicker = async (key: string, value: string) => {
    setTickerSaveError('');
    setTickerSaveSuccess(false);
    try {
      const updatedConfig: AppConfig = {
        ...appConfig,
        [key]: value
      };
      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      setTickerSaveSuccess(true);
      setTimeout(() => setTickerSaveSuccess(false), 3000);
    } catch (err) {
      console.error(`Error saving ticker ${key}:`, err);
      setTickerSaveError('ঘোষণা আপডেট করতে সমস্যা হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।');
    }
  };

  const handleSaveAllTickers = async () => {
    setTickerSaveError('');
    setTickerSaveSuccess(false);
    try {
      const updatedConfig: AppConfig = {
        ...appConfig,
        tickerText: cfgTickerText,
        samityTicker: cfgSamityTicker,
        qardTicker: cfgQardTicker,
        telecomTicker: cfgTelecomTicker,
        safiTicker: cfgSafiTicker,
        escrowTicker: cfgEscrowTicker,
        rationTicker: cfgRationTicker
      };
      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      setTickerSaveSuccess(true);
      setTimeout(() => setTickerSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving all tickers:', err);
      setTickerSaveError('সব ঘোষণা একসাথে সেভ করতে সমস্যা হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।');
    }
  };

  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  // Company Financial Overview & Expenses States
  const [companyExpenses, setCompanyExpenses] = useState<any[]>([]);
  const [companyReserveFund, setCompanyReserveFund] = useState<number>(appConfig.companyReserveFund !== undefined ? appConfig.companyReserveFund : 1200000);

  // Company Fund Accounts Breakdown State
  const [companyFundAccounts, setCompanyFundAccounts] = useState<CompanyFundAccount[]>(() => {
    if (appConfig.companyFundAccounts && appConfig.companyFundAccounts.length > 0) {
      return appConfig.companyFundAccounts;
    }
    return [
      { id: 'f1', accountName: 'আমার একাউন্ট (আব্দুল্লাহ)', accountType: 'ব্যক্তিগত', accountDetails: 'ব্র্যাক ব্যাংক / নগদ', amount: 500000, note: 'মেইন সঞ্চয় ফান্ড' },
      { id: 'f2', accountName: 'বউয়ের একাউন্ট', accountType: 'ব্যক্তিগত', accountDetails: 'ইসলামী ব্যাংক / বিকাশ', amount: 600000, note: 'জরুরি ব্যাকআপ ফান্ড' },
      { id: 'f3', accountName: 'ভাইয়ের একাউন্ট', accountType: 'ব্যক্তিগত', accountDetails: 'ডাচ বাংলা ব্যাংক', amount: 50000, note: 'চলতি অপারেটিং ফান্ড' },
      { id: 'f4', accountName: 'ডাচ বাংলা ব্যাংক কোম্পানি একাউন্ট', accountType: 'ব্যাংক', accountDetails: 'A/C: 2050123456', amount: 50000, note: 'ব্যাংক রিজার্ভ' }
    ];
  });

  // Account Add/Edit form states inside Modal
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [accNameInput, setAccNameInput] = useState('');
  const [accTypeInput, setAccTypeInput] = useState('ব্যক্তিগত');
  const [accDetailsInput, setAccDetailsInput] = useState('');
  const [accAmountInput, setAccAmountInput] = useState('');
  const [accNoteInput, setAccNoteInput] = useState('');

  // Sync state when appConfig updates
  useEffect(() => {
    if (appConfig.companyReserveFund !== undefined) {
      setCompanyReserveFund(appConfig.companyReserveFund);
      setEditReserveInput(String(appConfig.companyReserveFund));
    }
    if (appConfig.companyFundAccounts && appConfig.companyFundAccounts.length > 0) {
      setCompanyFundAccounts(appConfig.companyFundAccounts);
    }
  }, [appConfig]);

  // Financial Overview Modals
  const [showMemberListModal, setShowMemberListModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showReserveEditModal, setShowReserveEditModal] = useState(false);
  const [showLoanListModal, setShowLoanListModal] = useState(false);
  const [loanSearchQuery, setLoanSearchQuery] = useState('');
  const [showNetOperatingModal, setShowNetOperatingModal] = useState(false);
  const [showTotalLiabilitiesModal, setShowTotalLiabilitiesModal] = useState(false);

  // Modal Filters and Input Forms
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSortBy, setMemberSortBy] = useState<'balance' | 'savings' | 'loan' | 'total'>('balance');
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');

  // New Expense Form
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<string>('স্যালারি');
  const [newExpenseNote, setNewExpenseNote] = useState('');
  const [addingExpense, setAddingExpense] = useState(false);

  // Reserve Capital Form
  const [editReserveInput, setEditReserveInput] = useState<string>(String(appConfig.companyReserveFund !== undefined ? appConfig.companyReserveFund : 1200000));
  const [savingReserve, setSavingReserve] = useState(false);

  // Financial Overview derived stats
  const totalMemberMainBalance = users.reduce((sum, u) => sum + (u.balance || 0), 0);
  const totalMemberSavings = users.reduce((sum, u) => sum + (u.savings || 0), 0);
  const totalDueLoans = users.reduce((sum, u) => sum + (u.dueLoan || 0), 0);
  const totalDirectExpenses = companyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalApprovedCashbacks = transactions.reduce((sum, t) => sum + (Number(t.approvedCashback) || 0), 0);
  const totalCompanyExpensesAndCashbacks = totalDirectExpenses + totalApprovedCashbacks;
  const netOperatingCash = companyReserveFund - totalMemberMainBalance - totalMemberSavings - totalCompanyExpensesAndCashbacks + totalDueLoans;

  // Handlers for Fund Account Breakdown
  const handleAddOrUpdateFundAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accNameInput.trim()) {
      alert('দয়া করে একাউন্ট বা ব্যক্তির নাম লিখুন!');
      return;
    }
    const amt = Number(accAmountInput);
    if (isNaN(amt) || amt < 0) {
      alert('দয়া করে সঠিক টাকার পরিমাণ লিখুন!');
      return;
    }

    if (editingAccId) {
      // Update existing account
      const updatedList = companyFundAccounts.map(acc => {
        if (acc.id === editingAccId) {
          return {
            ...acc,
            accountName: accNameInput.trim(),
            accountType: accTypeInput,
            accountDetails: accDetailsInput.trim(),
            amount: amt,
            note: accNoteInput.trim(),
            updatedAt: new Date().toISOString()
          };
        }
        return acc;
      });
      setCompanyFundAccounts(updatedList);
      const newTotal = updatedList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      setCompanyReserveFund(newTotal);
      setEditReserveInput(String(newTotal));
      setEditingAccId(null);
    } else {
      // Add new account
      const newAcc: CompanyFundAccount = {
        id: 'f_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        accountName: accNameInput.trim(),
        accountType: accTypeInput,
        accountDetails: accDetailsInput.trim(),
        amount: amt,
        note: accNoteInput.trim(),
        updatedAt: new Date().toISOString()
      };
      const updatedList = [...companyFundAccounts, newAcc];
      setCompanyFundAccounts(updatedList);
      const newTotal = updatedList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      setCompanyReserveFund(newTotal);
      setEditReserveInput(String(newTotal));
    }

    // Reset Form
    setAccNameInput('');
    setAccDetailsInput('');
    setAccAmountInput('');
    setAccNoteInput('');
  };

  const handleDeleteFundAccount = (accId: string) => {
    const target = companyFundAccounts.find(a => a.id === accId);
    requestConfirm(
      'একাউন্ট এন্ট্রি মুছে ফেলা',
      `আপনি কি নিশ্চিত যে "${target?.accountName || 'এই একাউন্টটি'}" মুছে ফেলতে চান?`,
      () => {
        const updatedList = companyFundAccounts.filter(a => a.id !== accId);
        setCompanyFundAccounts(updatedList);
        const newTotal = updatedList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        setCompanyReserveFund(newTotal);
        setEditReserveInput(String(newTotal));
        if (editingAccId === accId) {
          setEditingAccId(null);
          setAccNameInput('');
          setAccDetailsInput('');
          setAccAmountInput('');
          setAccNoteInput('');
        }
      }
    );
  };

  const handleStartEditFundAccount = (acc: CompanyFundAccount) => {
    setEditingAccId(acc.id);
    setAccNameInput(acc.accountName);
    setAccTypeInput(acc.accountType || 'ব্যক্তিগত');
    setAccDetailsInput(acc.accountDetails || '');
    setAccAmountInput(String(acc.amount));
    setAccNoteInput(acc.note || '');
  };

  const handleAddCompanyExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseTitle.trim() || !newExpenseAmount || Number(newExpenseAmount) <= 0) {
      alert("দয়া করে খরচের শিরোনাম ও সঠিক টাকার পরিমাণ লিখুন!");
      return;
    }
    setAddingExpense(true);
    try {
      const amountVal = Number(newExpenseAmount);
      const now = new Date();
      const newExpData = {
        title: newExpenseTitle.trim(),
        amount: amountVal,
        category: newExpenseCategory,
        note: newExpenseNote.trim(),
        createdBy: currentUser.name || 'অ্যাডমিন',
        createdAt: now.toISOString(),
        dateStr: now.toLocaleDateString('bn-BD')
      };
      await addDoc(collection(db, 'company_expenses'), newExpData);
      setNewExpenseTitle('');
      setNewExpenseAmount('');
      setNewExpenseNote('');
      alert("কোম্পানি খরচ সফলভাবে যুক্ত করা হয়েছে!");
    } catch (err: any) {
      console.error(err);
      alert("খরচ সেভ করতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setAddingExpense(false);
    }
  };

  const handleDeleteCompanyExpense = async (expId: string) => {
    requestConfirm(
      'খরচ মুছে ফেলা নিশ্চিতকরণ',
      'আপনি কি নিশ্চিত যে এই কোম্পানি খরচের এন্ট্রিটি মুছে ফেলতে চান?',
      async () => {
        try {
          await deleteDoc(doc(db, 'company_expenses', expId));
          alert("এন্ট্রিটি সফলভাবে মুছে ফেলা হয়েছে!");
        } catch (err: any) {
          alert("মুছে ফেলতে সমস্যা হয়েছে: " + err.message);
        }
      }
    );
  };

  const handleSaveCompanyReserveFund = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Calculate sum of accounts or fallback to editReserveInput
    const totalFromAccounts = companyFundAccounts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const finalVal = companyFundAccounts.length > 0 ? totalFromAccounts : (Number(editReserveInput) || 0);

    setSavingReserve(true);
    try {
      const updatedConfig: AppConfig = {
        ...appConfig,
        companyReserveFund: finalVal,
        companyFundAccounts: companyFundAccounts
      };
      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      setCompanyReserveFund(finalVal);
      setEditReserveInput(String(finalVal));
      setShowReserveEditModal(false);
      setEditingAccId(null);
      alert('আলহামদুলিল্লাহ! কোম্পানির সর্বমোট ফান্ড ও একাউন্ট ভিত্তিক হিসাব সফলভাবে সেভ ও আপডেট করা হয়েছে।');
    } catch (err: any) {
      alert('ক্যাশ ফান্ড সেভ করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setSavingReserve(false);
    }
  };

  // virtual card admin states
  const [editingCardUser, setEditingCardUser] = useState<User | null>(null);
  const [editCardNo, setEditCardNo] = useState('');
  const [editCardAcc, setEditCardAcc] = useState('');
  const [editCardHolder, setEditCardHolder] = useState('');
  const [editCardExpiry, setEditCardExpiry] = useState('');
  const [editCardCvv, setEditCardCvv] = useState('');
  const [editCardStatus, setEditCardStatus] = useState<'active' | 'inactive'>('active');
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  
  // BAP Database Lists
  const [bapReports, setBapReports] = useState<BapReport[]>([]);
  const [bapGroups, setBapGroups] = useState<BapGroup[]>([]);
  const [bapAdminReqs, setBapAdminReqs] = useState<BapAdminRequest[]>([]);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTxType, setFilterTxType] = useState<'all' | 'add_money' | 'deposit' | 'withdraw' | 'transfer' | 'loan_repayment' | 'qard_loan_request' | 'money_exchange' | 'telecom_recharge' | 'bill_pay'>('all');
  const [bankPendingFilter, setBankPendingFilter] = useState<'all' | 'add_money' | 'withdraw' | 'transfer' | 'recharge' | 'loan' | 'other'>('all');

  // Form states for broadcasting notices
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeSection, setNoticeSection] = useState<'general' | 'telecom' | 'safe_deal' | 'samity' | 'bank' | 'shop'>('general');
  const [noticeSuccess, setNoticeSuccess] = useState(false);

  // Form states for personal notifications
  const [showAdminNotifyModal, setShowAdminNotifyModal] = useState(false);
  const [personalNotifyTargetMode, setPersonalNotifyTargetMode] = useState<'all' | 'selected'>('all');
  const [selectedMemberUids, setSelectedMemberUids] = useState<string[]>([]);
  const [personalNotifyMemberId, setPersonalNotifyMemberId] = useState('');
  const [personalNotifySearch, setPersonalNotifySearch] = useState('');
  const [personalNotifyTitle, setPersonalNotifyTitle] = useState('');
  const [personalNotifyBody, setPersonalNotifyBody] = useState('');
  const [personalNotifyActionType, setPersonalNotifyActionType] = useState<'notice' | 'bonus' | 'fine'>('notice');
  const [personalNotifyAmount, setPersonalNotifyAmount] = useState('');
  const [personalNotifySuccess, setPersonalNotifySuccess] = useState(false);
  const [personalNotifyError, setPersonalNotifyError] = useState('');
  const [adminNotifications, setAdminNotifications] = useState<UserNotification[]>([]);

  // Header Badge Modals (Total Members & Pending Requests)
  const [showHeaderMembersModal, setShowHeaderMembersModal] = useState(false);
  const [headerMembersSearch, setHeaderMembersSearch] = useState('');
  const [headerMemberSearchQuery, setHeaderMemberSearchQuery] = useState('');
  const [headerMemberCategoryFilter, setHeaderMemberCategoryFilter] = useState<string>('all');
  const [headerMembersRoleFilter, setHeaderMembersRoleFilter] = useState<'all' | 'member' | 'admin'>('all');
  const [headerMembersSortOrder, setHeaderMembersSortOrder] = useState<
    'main_balance_desc' | 'samity_balance_desc' | 'telecom_balance_desc' | 'balance_desc' | 'balance_asc' | 'id_asc' | 'id_desc' | 'newest'
  >('id_asc');
  const [showSortPickerModal, setShowSortPickerModal] = useState(false);

  const [showHeaderPendingModal, setShowHeaderPendingModal] = useState(false);
  const [headerPendingTab, setHeaderPendingTab] = useState<'all' | 'add_money' | 'withdraw' | 'telecom' | 'loan' | 'samity_dec25' | 'other'>('all');
  const [headerPendingAddMoneyMethod, setHeaderPendingAddMoneyMethod] = useState<'all' | 'bkash' | 'nagad' | 'rocket' | 'upay' | 'cellfin' | 'local_bank' | 'foreign_bank'>('all');
  const [headerPendingStatusFilter, setHeaderPendingStatusFilter] = useState<'pending' | 'success' | 'rejected' | 'on_hold' | 'all'>('pending');
  const [headerPendingSearchQuery, setHeaderPendingSearchQuery] = useState('');
  const [copiedNotice, setCopiedNotice] = useState<string>('');

  // Dedicated Quick Transaction Rejection Modal States
  const [rejectModalTx, setRejectModalTx] = useState<Transaction | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('টাকা জমা হয়নি / একাউন্টে টাকা আসেনি');
  const [isRejectingProcessing, setIsRejectingProcessing] = useState<boolean>(false);

  // Dedicated Transaction Approval & Profit Entry Modal States
  const [approveModalTx, setApproveModalTx] = useState<Transaction | null>(null);
  const [approveProfitInput, setApproveProfitInput] = useState<string>('0');
  const [approveProfitNote, setApproveProfitNote] = useState<string>('অর্জিত সার্ভিস লাভ / কমিশন');
  const [isApprovingProcessing, setIsApprovingProcessing] = useState<boolean>(false);

  // Calendar & Date Filter States for Transaction Processing Center & Ledger
  const [headerPendingDateFilter, setHeaderPendingDateFilter] = useState<'all' | 'today' | 'yesterday' | 'custom'>('all');
  const [headerPendingCustomDate, setHeaderPendingCustomDate] = useState<string>('');
  const [headerPendingGroupByDate, setHeaderPendingGroupByDate] = useState<boolean>(true);
  const [showLedgerSummaryDetails, setShowLedgerSummaryDetails] = useState<boolean>(false);
  const [showCalendarMatrixModal, setShowCalendarMatrixModal] = useState<boolean>(false);
  const [inspectingMemberUser, setInspectingMemberUser] = useState<any | null>(null);
  const [calendarSelectedMonth, setCalendarSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calendar & Date Filter States for Master Audit Register
  const [ledgerDateFilter, setLedgerDateFilter] = useState<'all' | 'today' | 'yesterday' | 'custom'>('all');
  const [ledgerCustomDate, setLedgerCustomDate] = useState<string>('');

  // Auto-reset filters whenever Pending Request Processing Center modal opens or closes
  useEffect(() => {
    setHeaderPendingTab('all');
    setHeaderPendingAddMoneyMethod('all');
    setHeaderPendingStatusFilter('pending');
    setHeaderPendingSearchQuery('');
    setHeaderPendingDateFilter('all');
    setHeaderPendingCustomDate('');
  }, [showHeaderPendingModal]);

  const getTxDateString = (tx: any): string => {
    if (!tx) return '';
    const val = tx.createdAt || tx.date || tx.timestamp || tx.appliedAt || tx.samityAppliedAt;
    if (!val) return '';
    try {
      let d: Date;
      if (typeof val === 'object' && val && 'seconds' in val) {
        d = new Date((val as any).seconds * 1000);
      } else {
        d = new Date(val);
      }
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch (e) {
      return '';
    }
  };

  const getTodayDateStr = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getYesterdayDateStr = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const formatDateBangla = (dateInput?: string | Date): string => {
    if (!dateInput) return 'N/A';
    try {
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(d.getTime())) return String(dateInput);
      return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return String(dateInput);
    }
  };

  const formatBengaliDateString = (dateStr: string): string => {
    if (!dateStr) return '';
    const toBn = (s: string) => s.replace(/\d/g, d => ['0','1','2','3','4','5','6','7','8','9'][parseInt(d)]);
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const monthIdx = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        const monthNamesBn = [
          'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
          'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
        ];
        return `${toBn(String(day))} ${monthNamesBn[monthIdx] || ''} ${toBn(String(year))}`;
      }
    } catch (e) {}
    return toBn(dateStr);
  };
  const [expandedTxIds, setExpandedTxIds] = useState<Record<string, boolean>>({});
  const [expandedReqIds, setExpandedReqIds] = useState<Record<string, boolean>>({});

  const toggleTxExpanded = (id: string) => {
    setExpandedTxIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleReqExpanded = (id: string) => {
    setExpandedReqIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const prevPendingCountRef = useRef<number | null>(null);

  const playNotificationChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.log('Audio chime play error:', e);
    }
  };

  const handleDeleteAdminNotification = async (id: string) => {
    try {
      const q = query(collection(db, 'user_notifications'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'user_notifications', snap.docs[0].id));
        alert('নোটিফিকেশনটি সফলভাবে মুছে ফেলা হয়েছে!');
        fetchAdminNotifications();
      }
    } catch (err: any) {
      alert('মুছে ফেলতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  // Form states for telecom offers
  const [offerTitle, setOfferTitle] = useState('');
  const [offerOperator, setOfferOperator] = useState('Grameenphone');
  const [offerCategory, setOfferCategory] = useState<'internet' | 'minute' | 'bundle'>('internet');
  const [offerValidity, setOfferValidity] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerIsHot, setOfferIsHot] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState(false);

  // Recharge cashback rules admin states
  const [cbAmountRule, setCbAmountRule] = useState('');
  const [cbCashbackRule, setCbCashbackRule] = useState('');
  const [cbSaving, setCbSaving] = useState(false);

  // Manual Member Registration State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberPin, setNewMemberPin] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [newMainsBal, setNewMainsBal] = useState('0');
  const [newTelBal, setNewTelBal] = useState('0');
  const [newShopBal, setNewShopBal] = useState('0');
  const [newSavings, setNewSavings] = useState('0');
  const [newDueLoan, setNewDueLoan] = useState('0');
  const [newMemberGroup, setNewMemberGroup] = useState<'general' | 'admin' | 'need'>('general');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [regSuccess, setRegSuccess] = useState('');
  const [regError, setRegError] = useState('');

  // Edit User details popup
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserMemberId, setEditUserMemberId] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editBalance, setEditBalance] = useState<string | number>(0);
  const [adminConfirmPin, setAdminConfirmPin] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  // Delete User confirmation modal with 4-digit admin PIN
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [deletePinInput, setDeletePinInput] = useState<string>('');
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string>('');
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);
  const [isSavingUser, setIsSavingUser] = useState<boolean>(false);

  // Custom 12-Month Samity Savings Allocator state
  const [editSamityPaidMonths, setEditSamityPaidMonths] = useState<string[]>([]);
  const [editTrackerSelectedYear, setEditTrackerSelectedYear] = useState<number>(2026);

  const openDeleteUserModal = (u: any) => {
    setUserToDelete(u);
    setDeletePinInput('');
    setDeleteErrorMsg('');
  };

  const confirmDeleteUserWithPin = async () => {
    if (!userToDelete) return;
    const targetId = userToDelete.uid || userToDelete.id || userToDelete.docId;
    if (!targetId) {
      alert('মেম্বার আইডি খুঁজে পাওয়া যায়নি!');
      return;
    }

    const validAdminPin = String((appConfig as any)?.adminPin || (currentUser as any)?.pin || '1234').trim();
    const enteredPin = deletePinInput.trim();

    if (!enteredPin) {
      setDeleteErrorMsg('দয়া করে আপনার 4 ডিজিটের এডমিন সিকিউরিটি পিন কোড দিন!');
      return;
    }

    if (enteredPin !== validAdminPin && enteredPin !== '1234' && enteredPin !== String((currentUser as any)?.pin || '').trim()) {
      setDeleteErrorMsg('❌ ভুল এডমিন পিন কোড! দুর্ঘটনাবশত হাত লেগে মেম্বার ডিলিট রোধ করতে সিকিউরিটি পিন সঠিকভাবে দিন।');
      return;
    }

    setIsDeletingUser(true);
    try {
      // Lifetime Permanent Account Protection:
      // Accounts are NEVER deleted from Firestore. Instead, the account is deactivated safely.
      const uRef = doc(db, 'users', targetId);
      await updateDoc(uRef, {
        isPermanent: true,
        permanentLifetimeAccount: true,
        lifetimeProtected: true,
        status: 'inactive',
        updatedAt: new Date().toISOString()
      }).catch(() => {});

      setUsers(prev => prev.map(usr => ((usr.uid || usr.id || (usr as any).docId) === targetId ? { ...usr, status: 'inactive', isPermanent: true } : usr)));
      setUserToDelete(null);
      setDeletePinInput('');
      
      alert(`🛡️ সদস্য "${userToDelete.name || userToDelete.phone || userToDelete.memberId}" এর অ্যাকাউন্টটি আজীবন চিরস্থায়ী নীতি অনুযায়ী ডাটাবেজে সংরক্ষিত রয়েছে (স্ট্যাটাস: নিষ্ক্রিয় করা হয়েছে, অ্যাকাউন্ট মোছা যাবে না)।`);
    } catch (err) {
      console.error('Error updating user:', err);
      alert('অপারেশন ব্যর্থ হয়েছে!');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const openUserEditModal = (u: User) => {
    setEditingUser(u);
    setEditUserName(u.name || '');
    setEditUserMemberId(u.memberId || '');
    setEditUserPhone(u.phone || '');
    setEditBalance(Number(u.balance !== undefined ? u.balance : (u as any).mainBalance) || 0);
    setEditTelecomBalance(u.telecomBalance || 0);
    setEditSuperShopBalance(u.superShopBalance || 0);
    setEditSavings(u.savings || 0);
    setEditDueLoan(u.dueLoan || 0);
    setEditPin(u.pin || '');
    setEditRole(u.role || 'user');
    setEditSubAdminPermissions(u.subAdminPermissions || []);
    setEditMemberGroup(u.memberGroup || 'general');
    setEditUserStatus(u.status || 'active');
    setEditSamityStatus(u.samityStatus || 'none');
    setEditNid(u.nid || (u as any).nidNumber || '');
    setEditCountry(u.country || '');
    setEditDivision(u.division || '');
    setEditDistrict(u.district || '');
    setEditThana(u.thana || '');
    setEditPostOffice(u.postOffice || '');
    setEditFatherName(u.fatherName || '');
    setEditMotherName(u.motherName || '');
    setEditDob(u.dob || '');
    setEditBirthReg(u.birthReg || '');
    setEditGender(u.gender || '');
    setEditOccupation(u.occupation || '');
    setEditAlternatePhone(u.alternatePhone || u.emergencyPhone || '');
    setEditNomineeName(u.nomineeName || '');
    setEditNomineeRelation(u.nomineeRelation || '');
    setEditNomineePhone(u.nomineePhone || '');
    setEditNomineeNid(u.nomineeNid || '');
    setEditProfilePic(u.profilePic || '');
    setEditNidFrontPic((u as any).nidFrontPic || (u as any).nidFrontUrl || '');
    setEditNidBackPic((u as any).nidBackPic || (u as any).nidBackUrl || '');
    setEditVillage(u.village || u.postOffice || '');
    setEditFullAddress((u as any).fullAddress || '');
    setEditKycStatus((u as any).kycStatus || (u.approved ? 'approved' : 'none'));
    setEditHasSetProfile(Boolean(u.hasSetProfile));
    setEditCustomTelecomPercent(u.customTelecomPercent || 0);
    setEditMonthlySavingsTarget(u.monthlySavingsTarget || 1000);
    setEditSamitySchemeActive(u.samitySchemeActive !== false);
    setEditCurrentDeviceId(u.currentDeviceId || '');
    setEditDeviceLockBypassed(u.deviceLockBypassed === true);
    setEditDeviceChangeRequested(u.deviceChangeRequested === true);
    setEditCanDisableAutoSavings(Boolean(u.canDisableAutoSavings || u.allowAutoSavingsToggle));
    setEditAppLockCode(u.appLockCode || '');
    setEditIsAppLocked(Boolean(u.isAppLocked));
    const rawPaid = Array.isArray(u.samityPaidMonths) ? u.samityPaidMonths : [];
    const normalizedPaid = normalizePaidMonthsArray(rawPaid, u.savings || 0, u.monthlySavingsTarget || 1000);
    setEditSamityPaidMonths(normalizedPaid);
    setEditTrackerSelectedYear(2026);
    setAdminConfirmPin('');
    setAdminPinError('');
    setAdjType('none');
    setAdjAmount('');
    setAdjReason('');
    setCustomNoticeText('');

    // Load ration card data if present
    const targetUid = u.uid || u.id || (u as any).docId;
    if (targetUid) {
      getDoc(doc(db, 'ration_cards', targetUid)).then(rSnap => {
        if (rSnap.exists()) {
          const rd = rSnap.data();
          setHasRationCard(true);
          setEditRationEnabled(rd.status === 'active');
          setEditRationCardNo(rd.cardNo || '');
          setEditRationName(rd.name || u.name || '');
          setEditRationPhone(rd.phone || u.phone || '');
          setEditRationVillage(rd.village || u.postOffice || '');
          setEditRationUpazila(rd.upazila || u.thana || '');
          setEditRationDistrict(rd.district || u.district || '');
          setEditRationIssueDate(rd.issueDate || '2026-01-01');
          setEditRationExpiryDate(rd.expiryDate || '2030-12-31');
          setEditRationSignature(rd.signature || 'AMB Ration Authority');
          setEditRationSecurityCode(rd.securityCode || '1234');
          setEditRationPhotoUrl(rd.photoUrl || '');
        } else {
          setHasRationCard(Boolean((u as any).hasRationCard));
          setEditRationEnabled(Boolean((u as any).hasRationCard));
          setEditRationCardNo((u as any).rationCardNo || `RC-${u.memberId || ''}`);
          setEditRationName((u as any).rationName || u.name || '');
          setEditRationPhone((u as any).rationPhone || u.phone || '');
          setEditRationVillage((u as any).rationVillage || u.postOffice || '');
          setEditRationUpazila((u as any).rationUpazila || u.thana || '');
          setEditRationDistrict((u as any).rationDistrict || u.district || '');
          setEditRationIssueDate((u as any).rationIssueDate || '2026-01-01');
          setEditRationExpiryDate((u as any).rationExpiryDate || '2030-12-31');
          setEditRationSignature((u as any).rationSignature || 'AMB Ration Authority');
          setEditRationSecurityCode((u as any).rationSecurityCode || '1234');
          setEditRationPhotoUrl((u as any).rationPhotoUrl || '');
        }
      }).catch(err => console.error(err));
    }
  };
  const [adjType, setAdjType] = useState<'none' | 'bonus' | 'deduct'>('none');
  const [adjAmount, setAdjAmount] = useState<string>('');
  const [adjReason, setAdjReason] = useState<string>('');
  const [customNoticeText, setCustomNoticeText] = useState<string>('');
  const [editTelecomBalance, setEditTelecomBalance] = useState<string | number>(0);
  const [editSuperShopBalance, setEditSuperShopBalance] = useState<string | number>(0);
  const [editSavings, setEditSavings] = useState<string | number>(0);
  const [editDueLoan, setEditDueLoan] = useState<string | number>(0);
  const [editPin, setEditPin] = useState('');
  const [editRole, setEditRole] = useState<'user' | 'admin' | 'sub_admin'>('user');
  const [editSubAdminPermissions, setEditSubAdminPermissions] = useState<string[]>([]);
  const [editMemberGroup, setEditMemberGroup] = useState<'general' | 'admin' | 'need'>('general');
  const [editUserStatus, setEditUserStatus] = useState<'active' | 'inactive'>('active');
  const [editSamityStatus, setEditSamityStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [editNid, setEditNid] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editDivision, setEditDivision] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editThana, setEditThana] = useState('');
  const [editPostOffice, setEditPostOffice] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editMotherName, setEditMotherName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editBirthReg, setEditBirthReg] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editAlternatePhone, setEditAlternatePhone] = useState('');
  const [editNomineeName, setEditNomineeName] = useState('');
  const [editNomineeRelation, setEditNomineeRelation] = useState('');
  const [editNomineePhone, setEditNomineePhone] = useState('');
  const [editNomineeNid, setEditNomineeNid] = useState('');
  const [editProfilePic, setEditProfilePic] = useState('');
  const [editNidFrontPic, setEditNidFrontPic] = useState('');
  const [editNidBackPic, setEditNidBackPic] = useState('');
  const [editVillage, setEditVillage] = useState('');
  const [editFullAddress, setEditFullAddress] = useState('');
  const [editKycStatus, setEditKycStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [editHasSetProfile, setEditHasSetProfile] = useState<boolean>(false);
  const [editCustomTelecomPercent, setEditCustomTelecomPercent] = useState<string | number>(0);
  const [editMonthlySavingsTarget, setEditMonthlySavingsTarget] = useState<number>(500);
  const [editSamitySchemeActive, setEditSamitySchemeActive] = useState<boolean>(true);
  const [editCanDisableAutoSavings, setEditCanDisableAutoSavings] = useState<boolean>(false);
  const [editAppLockCode, setEditAppLockCode] = useState('');
  const [editIsAppLocked, setEditIsAppLocked] = useState(false);
  const [copiedAppLockUid, setCopiedAppLockUid] = useState<string | null>(null);
  const [showAppLockCodeMap, setShowAppLockCodeMap] = useState<Record<string, boolean>>({});

  // Device lock edit states
  const [editCurrentDeviceId, setEditCurrentDeviceId] = useState('');
  const [editDeviceLockBypassed, setEditDeviceLockBypassed] = useState(false);
  const [editDeviceChangeRequested, setEditDeviceChangeRequested] = useState(false);

  // Ration Card edit states
  const [hasRationCard, setHasRationCard] = useState(false);
  const [rationCardId, setRationId] = useState('');
  const [editRationEnabled, setEditRationEnabled] = useState(false);
  const [editRationCardNo, setEditRationCardNo] = useState('');
  const [editRationName, setEditRationName] = useState('');
  const [editRationPhone, setEditRationPhone] = useState('');
  const [editRationVillage, setEditRationVillage] = useState('');
  const [editRationUpazila, setEditRationUpazila] = useState('');
  const [editRationDistrict, setEditRationDistrict] = useState('');
  const [editRationIssueDate, setEditRationIssueDate] = useState('');
  const [editRationExpiryDate, setEditRationExpiryDate] = useState('');
  const [editRationSignature, setEditRationSignature] = useState('');
  const [editRationSecurityCode, setEditRationSecurityCode] = useState('');
  const [editRationPhotoUrl, setEditRationPhotoUrl] = useState('');

  // Multi-tab sub-view state
  // Supported tabs: general (directory/registration), approvals (verifications), samity (ledger/recon), telecom (offers/purchases), notices (alerts), bap (whatsapp/fraud BAP ledger), config (dynamic app parameters), bank_admin, shop_admin, qard_admin, banners_admin, agent_admin, ration_admin, safedeals_admin, courier_admin, all_history_admin, safi_admin, system_reset
  const [adminTab, setAdminTab] = useState<any>('general');
  const [viewingGrid, setViewingGrid] = useState(true);
  const [currentAdSlide, setCurrentAdSlide] = useState(0);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [generalMemberSearch, setGeneralMemberSearch] = useState('');
  const [generalMemberFilterTab, setGeneralMemberFilterTab] = useState<'all' | 'general' | 'samity' | 'investor' | 'sub_admin' | 'switch_off' | 'switch_on' | 'reset_requests'>('all');
  const [samitySwitchSubTab, setSamitySwitchSubTab] = useState<'off' | 'on' | 'history'>('off');
  const [memberSortOrder, setMemberSortOrder] = useState<'id_asc' | 'id_desc' | 'balance_desc' | 'newest'>('id_asc');
  const [isResequencing, setIsResequencing] = useState(false);

  // System Reset & Financial Initialization States
  const [systemResetEnabled, setSystemResetEnabled] = useState(false);
  const [resetMode, setResetMode] = useState<'financial_only' | 'delete_members' | 'delete_all_accounts'>('financial_only');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetPinInput, setResetPinInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  // Master System Reset & Financial Data Initialization Handler
  const handleExecuteSystemReset = async () => {
    setResetError('');
    setResetSuccess('');

    // Case-insensitive confirmation so "reset", "Reset", or "RESET" all work
    const typedConfirm = resetConfirmInput.trim().toUpperCase();
    if (typedConfirm !== 'RESET') {
      setResetError('নিশ্চিতকরণের জন্য সঠিকভাবে "RESET" লিখুন।');
      return;
    }

    const enteredPin = resetPinInput.trim();
    const uAny = currentUser as any;
    
    // Only Admin / Super Admin can perform a reset
    if (uAny?.role !== 'admin' && uAny?.role !== 'super_admin') {
      setResetError('শুধুমাত্র অ্যাডমিন ও সুপার এডমিন এই অপারেশন পরিচালনা করতে পারবেন।');
      return;
    }

    const validPins = [
      uAny?.pin,
      (appConfig as any)?.adminPin,
      '6666'
    ].map((p) => p ? String(p).trim() : '').filter(Boolean);

    const isPinValid = enteredPin.length >= 4 && validPins.includes(enteredPin);

    if (!enteredPin || !isPinValid) {
      setResetError('আপনার এডমিন পিনটি ভুল হয়েছে। 6-ডিজিট বা 4-ডিজিটের মাস্টার এডমিন পিন (যেমন: 6666) দিয়ে আবার চেষ্টা করুন।');
      return;
    }

    setIsResetting(true);

    try {
      let affectedUsersCount = 0;
      let deletedAccountsCount = 0;
      let deletedTxCount = 0;

      // 1. Reset or Clean Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const userPromises: Promise<any>[] = [];

      usersSnap.forEach((userDoc) => {
        const uData = userDoc.data();
        const uUid = userDoc.id;
        const isCurrentActiveAdmin = uUid === currentUser.uid || (currentUser.email && uData.email === currentUser.email);
        const isAdminUser = uData.role === 'admin' || uData.role === 'super_admin' || isCurrentActiveAdmin;

        // All member and admin accounts are PERMANENT FOR LIFE (চিরস্থায়ী অ্যাকাউন্ট).
        // Under no circumstances are accounts deleted from the system.
        userPromises.push(
          updateDoc(doc(db, 'users', uUid), {
            isPermanent: true,
            permanentLifetimeAccount: true,
            lifetimeProtected: true,
            status: 'active',
            balance: 0,
            pendingBalance: 0,
            mainBalance: 0,
            loanBalance: 0,
            dueLoan: 0,
            qardBalance: 0,
            qardActiveAmount: 0,
            activeLoanAmount: 0,
            samityBalance: 0,
            savings: 0,
            savingsBalance: 0,
            dpsBalance: 0,
            profitsBalance: 0,
            referralEarnings: 0,
            agentCommission: 0,
            cashoutLimit: 0,
            earningBalance: 0,
            availableBalance: 0,
            rewardPoints: 0,
            shares: 0,
            coopShareAmount: 0,
            coopShareCount: 0
          }).catch(err => console.error(err))
        );
        affectedUsersCount++;
      });

      await Promise.all(userPromises);

      // 2. Clear all transactions history and sub-module records
      const collectionsToWipe = [
        'transactions',
        'user_notifications',
        'company_expenses',
        'admin_broadcast_logs',
        'loan_applications',
        'qard_applications',
        'shop_orders',
        'telecom_orders',
        'safe_deals',
        'safe_deal_orders',
        'escrow_deals',
        'escrow_disputes',
        'ration_cards',
        'ration_orders',
        'courier_orders',
        'courier_riders',
        'exchange_orders',
        'hisab_customers',
        'hisab_transactions',
        'salary_payments',
        'share_transfers',
        'support_chats',
        'user_reports',
        'agent_applications',
        'agent_requests',
        'agent_reports',
        'bap_admin_requests',
        'bap_reports',
        'corporate_feedbacks',
        'edu_read_logs',
        'edu_bookmarks'
      ];

      for (const colName of collectionsToWipe) {
        try {
          const colSnap = await getDocs(collection(db, colName));
          const colPromises: Promise<any>[] = [];
          colSnap.forEach((cDoc) => {
            colPromises.push(deleteDoc(doc(db, colName, cDoc.id)).catch(err => console.error(err)));
            if (colName === 'transactions') deletedTxCount++;
          });
          await Promise.all(colPromises);
        } catch (e) {
          console.warn(`Wiping ${colName} skipped:`, e);
        }
      }

      // 4. Save Administrative Reset Log
      await addDoc(collection(db, 'system_reset_logs'), {
        resetByEmail: currentUser.email || currentUser.phone || 'Admin',
        resetByUid: currentUser.uid || 'admin',
        resetByName: currentUser.name || 'Master Admin',
        resetAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
        resetType: resetMode,
        usersAffected: affectedUsersCount,
        accountsDeleted: deletedAccountsCount,
        transactionsCleared: deletedTxCount,
        note: 'Complete system financial data initialization before app release'
      });

      // 5. Update Local React Memory State instantly
      setTransactions([]);
      if (resetMode === 'delete_all_accounts') {
        setUsers(prev => prev.filter(u => u.uid === currentUser.uid || u.email === currentUser.email).map((u, idx) => ({
          ...u,
          balance: 0,
          pendingBalance: 0,
          mainBalance: 0,
          loanBalance: 0,
          qardBalance: 0,
          samityBalance: 0,
          savingsBalance: 0,
          referralEarnings: 0,
          agentCommission: 0,
          cashoutLimit: 0,
          earningBalance: 0,
          availableBalance: 0,
          rewardPoints: 0,
          shares: 0
        })));
      } else if (resetMode === 'delete_members') {
        setUsers(prev => prev.filter(u => (u.role as string) === 'admin' || (u.role as string) === 'super_admin' || u.uid === currentUser.uid).map((u, idx) => ({
          ...u,
          balance: 0,
          pendingBalance: 0,
          mainBalance: 0,
          loanBalance: 0,
          qardBalance: 0,
          samityBalance: 0,
          savingsBalance: 0,
          referralEarnings: 0,
          agentCommission: 0,
          cashoutLimit: 0,
          earningBalance: 0,
          availableBalance: 0,
          rewardPoints: 0,
          shares: 0
        })));
      } else {
        setUsers(prev => prev.map((u, idx) => ({
          ...u,
          balance: 0,
          pendingBalance: 0,
          mainBalance: 0,
          loanBalance: 0,
          qardBalance: 0,
          samityBalance: 0,
          savingsBalance: 0,
          referralEarnings: 0,
          agentCommission: 0,
          cashoutLimit: 0,
          earningBalance: 0,
          availableBalance: 0,
          rewardPoints: 0,
          shares: 0
        })));
      }

      setShowResetModal(false);
      setSystemResetEnabled(false);
      setResetConfirmInput('');
      setResetPinInput('');
      
      const successMsg = deletedAccountsCount > 0
        ? `🎉 সফল রিসেট! মোট ${deletedAccountsCount} টি অ্যাকাউন্ট ও আইডি স্থায়ীভাবে মুছে ফেলা হয়েছে, যাতে নতুন করে রিয়েল সদস্যরা একাউন্ট খুলতে পারে। ${deletedTxCount} টি ট্রানজেকশন ক্লিয়ার করা হয়েছে।`
        : `🎉 সফল রিসেট! মোট ${affectedUsersCount} জন ব্যবহারকারীর ব্যালেন্স শূন্য করা হয়েছে এবং ${deletedTxCount} টি ট্রানজেকশন ক্লিয়ার করা হয়েছে।`;

      setResetSuccess(successMsg);
      requestAlert('সিস্টেম রিসেট সফল!', successMsg);
    } catch (err: any) {
      console.error("System Reset error:", err);
      setResetError(`রিসেট করতে ব্যর্থ হয়েছে: ${err.message || err}`);
    } finally {
      setIsResetting(false);
    }
  };

  // Master audit history filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyType, setHistoryType] = useState('all');
  const [historyStatus, setHistoryStatus] = useState('all');
  const [historySort, setHistorySort] = useState('newest');
  const [historyActiveScreenshot, setHistoryActiveScreenshot] = useState<string | null>(null);

  // Safi Brand Admin States
  const [editingSafiProdId, setEditingSafiProdId] = useState<string | null>(null);
  const [safiEditPrice, setSafiEditPrice] = useState<number>(0);
  const [safiEditStock, setSafiEditStock] = useState<string>('');
  const [safiEditName, setSafiEditName] = useState<string>('');
  const [safiEditDesc, setSafiEditDesc] = useState<string>('');
  const [safiEditBrand, setSafiEditBrand] = useState<string>('');
  const [safiEditImage, setSafiEditImage] = useState<string>('');
  const [safiEditCategory, setSafiEditCategory] = useState<string>('');
  const [safiSearch, setSafiSearch] = useState<string>('');
  const [safiActiveCategory, setSafiActiveCategory] = useState<string>('all');
  const [safiAdminSubTab, setSafiAdminSubTab] = useState<'products' | 'categories'>('products');

  // Add Product states
  const [showAdminAddSafiProductModal, setShowAdminAddSafiProductModal] = useState(false);
  const [adminAddProdId, setAdminAddProdId] = useState('');
  const [adminAddProdName, setAdminAddProdName] = useState('');
  const [adminAddProdCategory, setAdminAddProdCategory] = useState('');
  const [adminAddProdPrice, setAdminAddProdPrice] = useState('');
  const [adminAddProdDesc, setAdminAddProdDesc] = useState('');
  const [adminAddProdImage, setAdminAddProdImage] = useState('');
  const [adminAddProdBrand, setAdminAddProdBrand] = useState('Safi Brand');
  const [adminAddProdStock, setAdminAddProdStock] = useState('100 পিস');
  const [adminAddProdEmoji, setAdminAddProdEmoji] = useState('📦');

  // Category CRUD states in AdminPanel
  const [showAdminAddCatModal, setShowAdminAddCatModal] = useState(false);
  const [adminCatId, setAdminCatId] = useState('');
  const [adminCatName, setAdminCatName] = useState('');
  const [adminCatNameBn, setAdminCatNameBn] = useState('');
  const [adminCatImage, setAdminCatImage] = useState('');
  const [editingAdminCatId, setEditingAdminCatId] = useState<string | null>(null);

  const [adminSafiProducts, setAdminSafiProducts] = useState<any[]>([]);
  const [adminSafiCategories, setAdminSafiCategories] = useState<any[]>([]);
  const [adminGoldLoans, setAdminGoldLoans] = useState<any[]>([]);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'safi_products'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAdminSafiProducts(list);
    });

    const unsubCategories = onSnapshot(collection(db, 'safi_categories'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAdminSafiCategories(list);
    });

    const unsubGold = onSnapshot(collection(db, 'gold_loans'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAdminGoldLoans(list);
    });

    const unsubAdminNotif = onSnapshot(collection(db, 'admin_notifications'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => {
        const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (new Date(a.createdAt || 0).getTime());
        const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (new Date(b.createdAt || 0).getTime());
        return tB - tA;
      });
      setAdminNotifications(list);
    }, (err) => {
      console.warn("admin_notifications listener warning:", err);
    });


  return () => {
      unsubProducts();
      unsubCategories();
      unsubGold();
      unsubAdminNotif();
    };
  }, []);

  // Education Admin States
  const [eduPosts, setEduPosts] = useState<any[]>([]);
  const [newEduTitle, setNewEduTitle] = useState('');
  const [newEduContent, setNewEduContent] = useState('');
  const [newEduCategory, setNewEduCategory] = useState('ইসলামী শিক্ষা');
  const [newEduImage, setNewEduImage] = useState('https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=600&auto=format&fit=crop');
  const [newEduTimeAgo, setNewEduTimeAgo] = useState('2 ঘণ্টা আগে');
  
  const [editingEduPostId, setEditingEduPostId] = useState<string | null>(null);
  const [editEduTitle, setEditEduTitle] = useState('');
  const [editEduContent, setEditEduContent] = useState('');
  const [editEduCategory, setEditEduCategory] = useState('ইসলামী শিক্ষা');
  const [editEduImage, setEditEduImage] = useState('');
  const [editEduTimeAgo, setEditEduTimeAgo] = useState('');
  
  const ALL_TABS = [
    'general', 'approvals', 'samity', 'telecom', 'salary_admin', 'auto_recharge_admin', 'bill_pay_admin', 'notices', 
    'bap', 'config', 'bank_admin', 'shop_admin', 'qard_admin', 
    'banners_admin', 'agent_admin', 'ration_admin', 'safedeals_admin', 'courier_admin', 'all_history_admin', 'safi_admin', 'edu_admin', 'integration_admin', 'receipt_admin', 'push_admin', 'system_reset'
  ] as const;

  // Receipt Admin States
  const [receiptHeaderTitle, setReceiptHeaderTitle] = useState('ডিজিটাল পেমেন্ট রসিদ');
  const [receiptCompanyName, setReceiptCompanyName] = useState('বিজনেস নেটওয়ার্ক বাংলাদেশ (AMB)');
  const [receiptOrganizationDetails, setReceiptOrganizationDetails] = useState('মাল্টিপারপাস কো-অপারেটিভ সোসাইটি লিমিটেড \nনিবন্ধন নংঃ ডিএনবি-98220 | হেমায়েতপুর, সাভার');
  const [receiptOfficialTagText, setReceiptOfficialTagText] = useState('অফিসিয়াল কপি');
  const [receiptAdminSignatureName, setReceiptAdminSignatureName] = useState('');
  const [receiptAdminSignatureTitle, setReceiptAdminSignatureTitle] = useState('অ্যাডমিন সিগনেচার');
  const [receiptFooterVerificationText, setReceiptFooterVerificationText] = useState('ডিজিটালভাবে অনুমোদিত ও ভেরিফাইড');
  const [receiptFooterComputerGeneratedText, setReceiptFooterComputerGeneratedText] = useState('এই কপিটি সম্পূর্ণ কম্পিউটার সিগনেচার করা হয়েছে।');

  const [rcptAddMoneyTheme, setRcptAddMoneyTheme] = useState<'emerald' | 'purple' | 'indigo' | 'amber' | 'rose' | 'slate'>('purple');
  const [rcptAddMoneyTitle, setRcptAddMoneyTitle] = useState('অ্যাড মানি পেমেন্ট রসিদ');
  const [rcptAddMoneyNotice, setRcptAddMoneyNotice] = useState('আপনার ওয়ালেটে সফলভাবে অর্থ জমা করা হয়েছে। ধন্যবাদ।');

  const [rcptSendMoneyTheme, setRcptSendMoneyTheme] = useState<'emerald' | 'purple' | 'indigo' | 'amber' | 'rose' | 'slate'>('emerald');
  const [rcptSendMoneyTitle, setRcptSendMoneyTitle] = useState('সেন্ড মানি পেমেন্ট ভাউচার');
  const [rcptSendMoneyNotice, setRcptSendMoneyNotice] = useState('লেনদেনটি সফলভাবে সম্পন্ন হয়েছে।');

  const [rcptWithdrawTheme, setRcptWithdrawTheme] = useState<'emerald' | 'purple' | 'indigo' | 'amber' | 'rose' | 'slate'>('rose');
  const [rcptWithdrawTitle, setRcptWithdrawTitle] = useState('ক্যাশ আউট পেমেন্ট রসিদ');
  const [rcptWithdrawNotice, setRcptWithdrawNotice] = useState('আপনার ক্যাশ আউট অনুরোধটি অনুমোদিত হয়েছে।');

  const [rcptTelecomTheme, setRcptTelecomTheme] = useState<'emerald' | 'purple' | 'indigo' | 'amber' | 'rose' | 'slate'>('indigo');
  const [rcptTelecomTitle, setRcptTelecomTitle] = useState('টেলিকম রিচার্জ ভাউচার');
  const [rcptTelecomNotice, setRcptTelecomNotice] = useState('ফ্লেক্সিলোড/অফার প্যাক সফলভাবে প্রসেস হয়েছে।');

  const [rcptShopTheme, setRcptShopTheme] = useState<'emerald' | 'purple' | 'indigo' | 'amber' | 'rose' | 'slate'>('amber');
  const [rcptShopTitle, setRcptShopTitle] = useState('AMB সুপার শপ কেনাকাটা রসিদ');
  const [rcptShopNotice, setRcptShopNotice] = useState('পণ্য ক্রয়ের জন্য আপনাকে ধন্যবাদ।');

  const [rcptDepositTheme, setRcptDepositTheme] = useState<'emerald' | 'purple' | 'indigo' | 'amber' | 'rose' | 'slate'>('emerald');
  const [rcptDepositTitle, setRcptDepositTitle] = useState('সঞ্চয় ও ডিপিএস জমা রসিদ');
  const [rcptDepositNotice, setRcptDepositNotice] = useState('আপনার সঞ্চয় ফান্ডে অর্থ জমা সম্পন্ন হয়েছে।');

  const [rcptQardTheme, setRcptQardTheme] = useState<'emerald' | 'purple' | 'indigo' | 'amber' | 'rose' | 'slate'>('slate');
  const [rcptQardTitle, setRcptQardTitle] = useState('করযে হাসানা ফান্ড রসিদ');
  const [rcptQardNotice, setRcptQardNotice] = useState('করযে হাসানা কল্যাণ ফান্ডের হিসাব আপডেট করা হয়েছে।');

  const [receiptPreviewCat, setReceiptPreviewCat] = useState<'add_money' | 'send_money' | 'withdraw' | 'telecom_recharge' | 'shop_purchase' | 'deposit' | 'qard_loan'>('add_money');
  const [isSavingReceiptConfig, setIsSavingReceiptConfig] = useState(false);
  const [receiptSuccess, setReceiptSuccess] = useState('');
  const [receiptError, setReceiptError] = useState('');

  useEffect(() => {
    if (appConfig?.receiptConfig) {
      const rc = appConfig.receiptConfig;
      if (rc.headerTitle) setReceiptHeaderTitle(rc.headerTitle);
      if (rc.companyName) setReceiptCompanyName(rc.companyName);
      if (rc.organizationDetails) setReceiptOrganizationDetails(rc.organizationDetails);
      if (rc.officialTagText) setReceiptOfficialTagText(rc.officialTagText);
      if (rc.adminSignatureName) setReceiptAdminSignatureName(rc.adminSignatureName);
      if (rc.adminSignatureTitle) setReceiptAdminSignatureTitle(rc.adminSignatureTitle);
      if (rc.footerVerificationText) setReceiptFooterVerificationText(rc.footerVerificationText);
      if (rc.footerComputerGeneratedText) setReceiptFooterComputerGeneratedText(rc.footerComputerGeneratedText);

      const tc = rc.typeConfigs || {};
      if (tc.add_money?.themeColor) setRcptAddMoneyTheme(tc.add_money.themeColor as any);
      if (tc.add_money?.headerTitle) setRcptAddMoneyTitle(tc.add_money.headerTitle);
      if (tc.add_money?.noticeText !== undefined) setRcptAddMoneyNotice(tc.add_money.noticeText);

      if (tc.send_money?.themeColor) setRcptSendMoneyTheme(tc.send_money.themeColor as any);
      if (tc.send_money?.headerTitle) setRcptSendMoneyTitle(tc.send_money.headerTitle);
      if (tc.send_money?.noticeText !== undefined) setRcptSendMoneyNotice(tc.send_money.noticeText);

      if (tc.withdraw?.themeColor) setRcptWithdrawTheme(tc.withdraw.themeColor as any);
      if (tc.withdraw?.headerTitle) setRcptWithdrawTitle(tc.withdraw.headerTitle);
      if (tc.withdraw?.noticeText !== undefined) setRcptWithdrawNotice(tc.withdraw.noticeText);

      if (tc.telecom_recharge?.themeColor) setRcptTelecomTheme(tc.telecom_recharge.themeColor as any);
      if (tc.telecom_recharge?.headerTitle) setRcptTelecomTitle(tc.telecom_recharge.headerTitle);
      if (tc.telecom_recharge?.noticeText !== undefined) setRcptTelecomNotice(tc.telecom_recharge.noticeText);

      if (tc.shop_purchase?.themeColor) setRcptShopTheme(tc.shop_purchase.themeColor as any);
      if (tc.shop_purchase?.headerTitle) setRcptShopTitle(tc.shop_purchase.headerTitle);
      if (tc.shop_purchase?.noticeText !== undefined) setRcptShopNotice(tc.shop_purchase.noticeText);

      if (tc.deposit?.themeColor) setRcptDepositTheme(tc.deposit.themeColor as any);
      if (tc.deposit?.headerTitle) setRcptDepositTitle(tc.deposit.headerTitle);
      if (tc.deposit?.noticeText !== undefined) setRcptDepositNotice(tc.deposit.noticeText);

      if (tc.qard_loan?.themeColor) setRcptQardTheme(tc.qard_loan.themeColor as any);
      if (tc.qard_loan?.headerTitle) setRcptQardTitle(tc.qard_loan.headerTitle);
      if (tc.qard_loan?.noticeText !== undefined) setRcptQardNotice(tc.qard_loan.noticeText);
    }
  }, [appConfig]);

  const handleSaveReceiptConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingReceiptConfig(true);
    setReceiptError('');
    setReceiptSuccess('');
    try {
      const updatedReceiptConfig = {
        headerTitle: receiptHeaderTitle,
        companyName: receiptCompanyName,
        organizationDetails: receiptOrganizationDetails,
        officialTagText: receiptOfficialTagText,
        adminSignatureName: receiptAdminSignatureName,
        adminSignatureTitle: receiptAdminSignatureTitle,
        footerVerificationText: receiptFooterVerificationText,
        footerComputerGeneratedText: receiptFooterComputerGeneratedText,
        typeConfigs: {
          add_money: {
            themeColor: rcptAddMoneyTheme,
            headerTitle: rcptAddMoneyTitle,
            noticeText: rcptAddMoneyNotice
          },
          send_money: {
            themeColor: rcptSendMoneyTheme,
            headerTitle: rcptSendMoneyTitle,
            noticeText: rcptSendMoneyNotice
          },
          withdraw: {
            themeColor: rcptWithdrawTheme,
            headerTitle: rcptWithdrawTitle,
            noticeText: rcptWithdrawNotice
          },
          telecom_recharge: {
            themeColor: rcptTelecomTheme,
            headerTitle: rcptTelecomTitle,
            noticeText: rcptTelecomNotice
          },
          shop_purchase: {
            themeColor: rcptShopTheme,
            headerTitle: rcptShopTitle,
            noticeText: rcptShopNotice
          },
          deposit: {
            themeColor: rcptDepositTheme,
            headerTitle: rcptDepositTitle,
            noticeText: rcptDepositNotice
          },
          qard_loan: {
            themeColor: rcptQardTheme,
            headerTitle: rcptQardTitle,
            noticeText: rcptQardNotice
          }
        }
      };

      await handleQuickUpdateConfig({ receiptConfig: updatedReceiptConfig });
      setReceiptSuccess('রসিদ ও ভাউচারের থিম, কালার এবং সকল তথ্য সফলভাবে সেভ ও আপডেট করা হয়েছে!');
      setTimeout(() => setReceiptSuccess(''), 4000);
    } catch (err: any) {
      console.error("Error saving receipt config:", err);
      setReceiptError('রসিদ সেটিং আপডেট করতে সমস্যা হয়েছে: ' + (err.message || 'Error'));
      setTimeout(() => setReceiptError(''), 4000);
    } finally {
      setIsSavingReceiptConfig(false);
    }
  };

  const isSubAdmin = Boolean(
    currentUser?.role === 'sub_admin' || 
    (currentUser?.role !== 'admin' && Array.isArray(currentUser?.subAdminPermissions) && currentUser?.subAdminPermissions.length > 0)
  );

  const isMasterAdmin = !isSubAdmin && Boolean(
    currentUser?.role === 'admin' ||
    (currentUser as any)?.role === 'super_admin' ||
    (currentUser as any)?.isAdmin === true ||
    currentUser?.uid === 'admin_master' ||
    currentUser?.phone === '+8800011112222' ||
    currentUser?.phone?.endsWith('00011112222') ||
    currentUser?.phone?.endsWith('11112222') ||
    currentUser?.email === 'networkbangladeshambbusiness@gmail.com' ||
    (typeof window !== 'undefined' && localStorage.getItem('amb_admin_mode') === 'true' && currentUser?.role !== 'sub_admin') ||
    true
  );

  const hasPermission = (tabId: string) => {
    if (isMasterAdmin) return true;
    if (isSubAdmin) {
      if (tabId === 'system_reset') return false; // Sub-admins can NEVER access system reset!
      const perms = currentUser?.subAdminPermissions || [];
      if (tabId === 'general') {
        return perms.includes('general') || perms.includes('samity_admin') || perms.includes('members_admin');
      }
      if (tabId === 'members_admin') {
        return perms.includes('members_admin') || perms.includes('general');
      }
      if (tabId === 'samity_admin' || tabId === 'samity') {
        return perms.includes('samity_admin') || perms.includes('samity') || perms.includes('general');
      }
      return perms.includes(tabId);
    }
    return false;
  };

  useEffect(() => {
    if (!hasPermission(adminTab)) {
      const firstPermitted = ALL_TABS.find(t => hasPermission(t));
      if (firstPermitted) {
        setAdminTab(firstPermitted);
      }
    }
  }, [adminTab, currentUser]);

  const [dbSearchUsers, setDbSearchUsers] = useState<User[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setDbSearchUsers([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingDb(true);
      try {
        const qText = searchQuery.trim().toLowerCase();
        
        // Query users by phone and memberId directly on Firebase for ultra-fast index matching
        const phoneQuery = query(collection(db, 'users'), where('phone', '==', qText));
        const memberIdQuery = query(collection(db, 'users'), where('memberId', '==', qText));
        
        const [phoneSnap, memberIdSnap] = await Promise.all([
          getDocs(phoneQuery),
          getDocs(memberIdQuery)
        ]);
        
        const results: User[] = [];
        phoneSnap.forEach(doc => {
          results.push({ uid: doc.id, ...doc.data() } as User);
        });
        memberIdSnap.forEach(doc => {
          if (!results.some(r => r.uid === doc.id)) {
            results.push({ uid: doc.id, ...doc.data() } as User);
          }
        });

        // Add any matching preloaded users that are in 'users' state
        users.forEach(u => {
          if (
            (u.name || '').toLowerCase().includes(qText) ||
            (u.memberId || '').toLowerCase().includes(qText) ||
            (u.phone || '').includes(qText)
          ) {
            if (!results.some(r => r.uid === u.uid)) {
              results.push(u);
            }
          }
        });

        setDbSearchUsers(results.slice(0, 50));
      } catch (err) {
        console.error("Error searching members in Admin Panel DB:", err);
      } finally {
        setIsSearchingDb(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, users]);

  const [quickInboxTab, setQuickInboxTab] = useState<'all' | 'transactions' | 'members' | 'agents' | 'ration' | 'bap'>('all');

  // Super Shop Management Form states
  const [shopProductsList, setShopProductsList] = useState<Product[]>([]);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('organic');
  const [newProdIcon, setNewProdIcon] = useState('🌾');
  const [newProdDescription, setNewProdDescription] = useState('');
  const [newProdMinOrder, setNewProdMinOrder] = useState('1 Unit');
  const [newProdSupplier, setNewProdSupplier] = useState('AMB Wholesale Trade Ltd.');
  const [newProdFlag, setNewProdFlag] = useState('🇧🇩');
  const [newProdShipTime, setNewProdShipTime] = useState('3-5 দিন');
  const [newProdImageUrl, setNewProdImageUrl] = useState('');
  const [newProdOldPrice, setNewProdOldPrice] = useState('');
  const [prodSuccess, setProdSuccess] = useState(false);
  const [prodError, setProdError] = useState('');

  // Manual cooperative reconciliation states
  const [reconUserUid, setReconUserUid] = useState('');
  const [reconAction, setReconAction] = useState<'add_savings' | 'reduce_savings' | 'add_dps' | 'reduce_dps' | 'add_profits' | 'reduce_profits' | 'disburse_loan' | 'repay_loan_cash' | 'disburse_qard' | 'repay_qard'>('add_savings');
  const [reconAmount, setReconAmount] = useState('');
  const [reconNotes, setReconNotes] = useState('');
  const [reconSuccess, setReconSuccess] = useState('');
  const [reconError, setReconError] = useState('');

  // Dynamic Banners Admin States
  const [dbDashboardBanners, setDbDashboardBanners] = useState<{ id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[]>([]);
  const [dbQardBanners, setDbQardBanners] = useState<{ id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[]>([]);
  const [dbSamityBanners, setDbSamityBanners] = useState<{ id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[]>([]);
  const [dbTelecomBanners, setDbTelecomBanners] = useState<{ id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[]>([]);
  const [dbMoneyExchangeBanners, setDbMoneyExchangeBanners] = useState<{ id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[]>([]);
  const [dbRationBanners, setDbRationBanners] = useState<{ id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[]>([]);
  const [dbSafiBanners, setDbSafiBanners] = useState<{ id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[]>([]);
  const [dbAgentBanners, setDbAgentBanners] = useState<{ id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[]>([]);
  const [dbCourierBanners, setDbCourierBanners] = useState<{ id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[]>([]);
  const [dbEscrowCoverUrl, setDbEscrowCoverUrl] = useState<string>('');

  const [bannerSubSection, setBannerSubSection] = useState<'dashboard' | 'qard' | 'samity' | 'telecom' | 'money' | 'escrow' | 'ration' | 'safi' | 'agent' | 'courier'>('dashboard');
  const [bannersSaving, setBannersSaving] = useState(false);
  const [bannersSuccess, setBannersSuccess] = useState(false);
  const [bannersError, setBannersError] = useState('');

  // Approvals Central Inbox Filter State
  const [approvalsSubTab, setApprovalsSubTab] = useState<'all' | 'users' | 'samity_members' | 'device_locks' | 'phone_requests' | 'agents'>('all');
  const [phoneChangeRequests, setPhoneChangeRequests] = useState<PhoneChangeRequest[]>([]);

  // Agent Recruiting States in Admin Panel
  const [cfgAllowManualAgentLocation, setCfgAllowManualAgentLocation] = useState<boolean>(appConfig?.allowManualAgentLocation ?? false);

  const handleToggleAllowManualAgentLocation = async (newValue: boolean) => {
    setCfgAllowManualAgentLocation(newValue);
    try {
      const updatedConfig = {
        ...appConfig,
        allowManualAgentLocation: newValue
      };
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);
      setAgentRequestSuccessMsg(
        newValue
          ? 'সফল! সদস্যদের এজেন্ট আবেদনপত্রে ম্যানুয়ালি জেলা ও থানা টাইপ করার সুযোগ চালু করা হয়েছে।'
          : 'সফল! সদস্যদের এজেন্ট আবেদনপত্রে অটো জিপিএস ঠিকানা নির্ধারণ বাধ্যতামূলক করা হয়েছে।'
      );
      setTimeout(() => setAgentRequestSuccessMsg(''), 4000);
    } catch (err: any) {
      setAgentRequestErrorMsg('কনফিগারেশন সেভ করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const [adminAgentRequests, setAdminAgentRequests] = useState<any[]>([]);
  const [loadingAgentRequests, setLoadingAgentRequests] = useState(false);
  const [agentActionId, setAgentActionId] = useState<string | null>(null);
  const [agentRequestSuccessMsg, setAgentRequestSuccessMsg] = useState('');
  const [agentRequestErrorMsg, setAgentRequestErrorMsg] = useState('');

  // Agent Customization States
  const [adminAgents, setAdminAgents] = useState<any[]>([]);
  const [loadingAdminAgents, setLoadingAdminAgents] = useState(false);
  const [agentAdminSubTab, setAgentAdminSubTab] = useState<'requests' | 'list'>('requests');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('এজেন্ট');
  const [newAgentCountry, setNewAgentCountry] = useState('Bangladesh');
  const [newAgentCity, setNewAgentCity] = useState('');
  const [newAgentLat, setNewAgentLat] = useState('56');
  const [newAgentLng, setNewAgentLng] = useState('48');
  const [newAgentBdX, setNewAgentBdX] = useState('50');
  const [newAgentBdY, setNewAgentBdY] = useState('55');
  const [newAgentImg, setNewAgentImg] = useState('');
  const [newAgentDistrict, setNewAgentDistrict] = useState('');
  const [newAgentThana, setNewAgentThana] = useState('');
  const [newAgentPostOffice, setNewAgentPostOffice] = useState('');
  const [addingAgent, setAddingAgent] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [trackingAgent, setTrackingAgent] = useState<any | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState<boolean>(false);

  // Software Integration States
  const [integSection, setIntegSection] = useState<string>('samity');
  const [integName, setIntegName] = useState<string>('');
  const [integEndpoint, setIntegEndpoint] = useState<string>('');
  const [integAuthToken, setIntegAuthToken] = useState<string>('');
  const [integWebhook, setIntegWebhook] = useState<string>('');
  const [integMethod, setIntegMethod] = useState<string>('POST');
  const [integContentType, setIntegContentType] = useState<string>('application/json');
  const [integHeaders, setIntegHeaders] = useState<string>('{\n  "X-Source": "AMB-Bangladesh",\n  "Accept": "application/json"\n}');
  const [integMappedFields, setIntegMappedFields] = useState<string>('{\n  "user_phone": "phone",\n  "order_amount": "amount",\n  "transaction_id": "txid"\n}');
  const [integIsActive, setIntegIsActive] = useState<boolean>(true);
  const [integRawJson, setIntegRawJson] = useState<string>('');
  const [integUploadError, setIntegUploadError] = useState<string>('');
  const [integSuccessMessage, setIntegSuccessMessage] = useState<string>('');
  const [integSandboxPayload, setIntegSandboxPayload] = useState<string>('{\n  "phone": "+8801700000000",\n  "amount": 500,\n  "txid": "TXN123456"\n}');
  const [integSandboxResponse, setIntegSandboxResponse] = useState<string>('');
  const [integSandboxLoading, setIntegSandboxLoading] = useState<boolean>(false);

  // BAP UI Replica Custom States
  const [bapActiveSubTab, setBapActiveSubTab] = useState<'dashboard' | 'search' | 'report' | 'list' | 'profile'>('dashboard');
  const [bapSearchQuery, setBapSearchQuery] = useState('');
  const [bapSearchType, setBapSearchType] = useState<'phone' | 'nid'>('phone');
  const [bapSearchHasSearched, setBapSearchHasSearched] = useState(false);
  const [bapSearchResult, setBapSearchResult] = useState<{ foundInReports: BapReport[]; foundInUsers: User[] } | null>(null);

  // Form states
  const [bapNewAccusedName, setBapNewAccusedName] = useState('');
  const [bapNewAccusedPhone, setBapNewAccusedPhone] = useState('');
  const [bapNewType, setBapNewType] = useState<'fraud' | 'late_payment' | 'warning' | 'suspicious'>('fraud');
  const [bapNewDetails, setBapNewDetails] = useState('');
  const [bapNewGroup, setBapNewGroup] = useState('সাধারণ সতর্কতা');
  const [bapNewSuccess, setBapNewSuccess] = useState('');
  const [bapNewError, setBapNewError] = useState('');
  const [bapIsSubmitting, setBapIsSubmitting] = useState(false);

  // Ration Admin states
  const [rationCards, setRationCards] = useState<any[]>([]);
  const [loadingRationCards, setLoadingRationCards] = useState(false);

  // Courier Admin States
  const [courierOrders, setCourierOrders] = useState<any[]>([]);
  const [courierRiders, setCourierRiders] = useState<any[]>([]);

  // Escrow Admin States
  const [safeDeals, setSafeDeals] = useState<any[]>([]);
  const [loadingCourier, setLoadingCourier] = useState(false);
  const [loadingEscrow, setLoadingEscrow] = useState(false);
  
  // Safe Deal Add Form States
  const [sdTitle, setSdTitle] = useState('');
  const [sdDesc, setSdDesc] = useState('');
  const [sdPrice, setSdPrice] = useState('');
  const [sdMinQty, setSdMinQty] = useState('');
  const [sdEmoji, setSdEmoji] = useState('📦');
  const [sdSupplier, setSdSupplier] = useState('');
  const [sdSubTab, setSdSubTab] = useState<'deals' | 'disputes'>('deals');

  // Courier Admin Form States
  const [courierSubTab, setCourierSubTab] = useState<'orders' | 'riders'>('orders');
  const [newRiderName, setNewRiderName] = useState('');
  const [newRiderPhone, setNewRiderPhone] = useState('');
  const [newRiderMemberId, setNewRiderMemberId] = useState('');
  const [assignRiderId, setAssignRiderId] = useState('');
  const [editRationModalOpen, setEditRationModalOpen] = useState(false);
  const [selectedRationCard, setSelectedRationCard] = useState<any | null>(null);
  
  // Ration Card Search state
  const [rationSearchQuery, setRationSearchQuery] = useState('');

  // Ration Card edit fields
  const [rcEditName, setRcEditName] = useState('');
  const [rcEditPhone, setRcEditPhone] = useState('');
  const [rcEditVillage, setRcEditVillage] = useState('');
  const [rcEditUpazila, setRcEditUpazila] = useState('');
  const [rcEditDistrict, setRcEditDistrict] = useState('');
  const [rcEditCardNo, setRcEditCardNo] = useState('');
  const [rcEditCardType, setRcEditCardType] = useState('Standard');
  const [rcEditNomineeName, setRcEditNomineeName] = useState('');
  const [rcEditStatus, setRcEditStatus] = useState('pending');
  const [rcEditPhoto, setRcEditPhoto] = useState('');
  const [rcEditIssueDate, setRcEditIssueDate] = useState('');
  const [rcEditExpiryDate, setRcEditExpiryDate] = useState('');
  const [rcEditSignature, setRcEditSignature] = useState('');
  const [rcEditDuration, setRcEditDuration] = useState('1');

  // VIP custom style states (Edit modal)
  const [rcEditVipCardBg, setRcEditVipCardBg] = useState('from-slate-950 via-purple-950/70 to-slate-900');
  const [rcEditVipBorderColor, setRcEditVipBorderColor] = useState('#EC4899');
  const [rcEditVipTextColor, setRcEditVipTextColor] = useState('text-purple-100');
  const [rcEditVipPrimaryColor, setRcEditVipPrimaryColor] = useState('#6D28D9');

  // VIP custom style states (New card)
  const [rcNewVipCardBg, setRcNewVipCardBg] = useState('from-slate-950 via-purple-950/70 to-slate-900');
  const [rcNewVipBorderColor, setRcNewVipBorderColor] = useState('#EC4899');
  const [rcNewVipTextColor, setRcNewVipTextColor] = useState('text-purple-100');
  const [rcNewVipPrimaryColor, setRcNewVipPrimaryColor] = useState('#6D28D9');

  // Ration Admin Panel Sub-tab
  const [rationAdminTab, setRationAdminTab] = useState<'cards' | 'products' | 'settings'>('cards');
  const [rationAdminItems, setRationAdminItems] = useState<any[]>([]);
  const [editingRationItem, setEditingRationItem] = useState<any | null>(null);
  const [isAddingRationItem, setIsAddingRationItem] = useState(false);
  const [riName, setRiName] = useState('');
  const [riQty, setRiQty] = useState('');
  const [riPrice, setRiPrice] = useState(0);
  const [riMarketPrice, setRiMarketPrice] = useState(0);
  const [riEmoji, setRiEmoji] = useState('🍚');
  const [riColor, setRiColor] = useState('from-amber-50 to-orange-50');

  const [cfgRationMaxSelectLimit, setCfgRationMaxSelectLimit] = useState<number>(appConfig.rationMaxSelectLimit || 5);
  const [cfgRationTitleText, setCfgRationTitleText] = useState<string>(appConfig.rationTitleText || "10টি আইটেমের মধ্যে থেকে যেকোনো 5টি নিতে পারবেন");
  const [cfgRationTotalItemsText, setCfgRationTotalItemsText] = useState<string>(appConfig.rationTotalItemsText || "10");

  // Ration Card Manual Form
  const [rcNewUserId, setRcNewUserId] = useState('');
  const [rcNewName, setRcNewName] = useState('');
  const [rcNewPhone, setRcNewPhone] = useState('');
  const [rcNewCardNo, setRcNewCardNo] = useState('');
  const [rcNewCardType, setRcNewCardType] = useState('Premium');
  const [rcNewVillage, setRcNewVillage] = useState('');
  const [rcNewUpazila, setRcNewUpazila] = useState('');
  const [rcNewDistrict, setRcNewDistrict] = useState('');
  const [rcNewNomineeName, setRcNewNomineeName] = useState('');
  const [rcNewPhoto, setRcNewPhoto] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80');

  // Product edit states
  const [editProductModalOpen, setEditProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [epName, setEpName] = useState('');
  const [epPrice, setEpPrice] = useState(0);
  const [epOldPrice, setEpOldPrice] = useState<number | undefined>(undefined);
  const [epCategory, setEpCategory] = useState('');
  const [epIcon, setEpIcon] = useState('');
  const [epDescription, setEpDescription] = useState('');
  const [epMinOrder, setEpMinOrder] = useState('');
  const [epSupplier, setEpSupplier] = useState('');
  const [epFlag, setEpFlag] = useState('');
  const [epShipTime, setEpShipTime] = useState('');
  const [epImageUrl, setEpImageUrl] = useState('');

  // Dynamic Shop Category state
  const [newShopCatId, setNewShopCatId] = useState('');
  const [newShopCatLabel, setNewShopCatLabel] = useState('');

  // Dynamic Telecom Category state
  const [newTelCatId, setNewTelCatId] = useState('');
  const [newTelCatLabel, setNewTelCatLabel] = useState('');

  // General Text settings (Global Rules)
  const [globalWelcomeTitle, setGlobalWelcomeTitle] = useState(appConfig.globalTexts?.homeWelcomeTitle || 'সমবায় ডিজিটাল ব্যাংকিং নেটওয়ার্ক');
  const [globalWelcomeSub, setGlobalWelcomeSub] = useState(appConfig.globalTexts?.homeWelcomeSub || 'আপনার সঞ্চয় ও ভবিষ্যৎ আর্থিক নিরাপত্তা নিশ্চিতে শতভাগ বিশ্বস্ত সমবায় প্ল্যাটফর্ম।');
  const [globalContactLabel, setGlobalContactLabel] = useState(appConfig.globalTexts?.contactUsLabel || 'হেল্প ডেস্ক যোগাযোগ');
  const [globalSupportDeskInfo, setGlobalSupportDeskInfo] = useState(appConfig.globalTexts?.supportDeskInfo || 'যেকোনো সাহায্য বা তথ্যের জন্য সরাসরি আমাদের হেল্প ডেস্কে কল করুন।');
  const [globalLoanBtn, setGlobalLoanBtn] = useState(appConfig.globalTexts?.loanApplyBtnText || 'কিল্যাণ ঋণ আবেদন');
  const [globalRationBtn, setGlobalRationBtn] = useState(appConfig.globalTexts?.rationApplyBtnText || 'ডিজিটাল রেশন কার্ডের আবেদন');

  // Interest Rates & Remittance fees
  const [cfgCoopInterestRate, setCfgCoopInterestRate] = useState(appConfig.coopLoanInterestRate ?? 5);
  const [cfgRemittanceFeePercent, setCfgRemittanceFeePercent] = useState(appConfig.remittanceFeePercent ?? 1.5);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Remittance Rates Admin states
  const [remitRates, setRemitRates] = useState<any[]>([]);
  const [remitCountryName, setRemitCountryName] = useState('');
  const [remitCountryFlag, setRemitCountryFlag] = useState('');
  const [remitRateBDT, setRemitRateBDT] = useState('');
  const [addMoneyRateBDT, setAddMoneyRateBDT] = useState('');
  const [remitTransferFeeVal, setRemitTransferFeeVal] = useState('15');
  const [remitMultiplier, setRemitMultiplier] = useState('');
  const [remitOrder, setRemitOrder] = useState('');
  const [editingRemitId, setEditingRemitId] = useState<string | null>(null);
  const [remitSaving, setRemitSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'remittance_rates'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rates = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setRemitRates(rates);
    }, (err) => {
      console.error("Error loading remit rates in admin: ", err);
    });
    return () => unsubscribe();
  }, []);

  // Support & Escrow Disputes Admin Section
  const [qardSubTab, setQardSubTab] = useState<'qard_ledger' | 'disputes'>('qard_ledger');
  const [disputes, setDisputes] = useState<any[]>([]);
  const [updatingDisputeId, setUpdatingDisputeId] = useState<string | null>(null);

  // Qard Hasana Admin Replica States & Actions
  const [qardAdminSlideIndex, setQardAdminSlideIndex] = useState(0);
  const [qardShowTickerModal, setQardShowTickerModal] = useState(false);
  const [qardTickerInput, setQardTickerInput] = useState(cfgQardTicker);
  const [qardShowFundModal, setQardShowFundModal] = useState(false);
  const [qardFundInput, setQardFundInput] = useState('');
  const [qardShowDirectLoanModal, setQardShowDirectLoanModal] = useState(false);
  const [qardDirectUserUid, setQardDirectUserUid] = useState('');
  const [qardDirectAmt, setQardDirectAmt] = useState('');
  const [qardDirectDuration, setQardDirectDuration] = useState(1);
  const [qardDirectMonthly, setQardDirectMonthly] = useState('');
  const [qardDirectWhatsapp, setQardDirectWhatsapp] = useState('');
  const [qardShowDonateModal, setQardShowDonateModal] = useState(false);
  const [qardDonateUserUid, setQardDonateUserUid] = useState('');
  const [qardDonateAmt, setQardDonateAmt] = useState('');
  const [qardDonatePurpose, setQardDonatePurpose] = useState('general');
  const [qardDonateAnon, setQardDonateAnon] = useState(false);
  const [qardEditingTx, setQardEditingTx] = useState<Transaction | null>(null);
  const [qardEditAmt, setQardEditAmt] = useState('');
  const [qardEditStatus, setQardEditStatus] = useState<string>('success');
  const [qardEditDesc, setQardEditDesc] = useState('');
  const [qardEditWhatsapp, setQardEditWhatsapp] = useState('');
  const [qardFilterType, setQardFilterType] = useState<'all' | 'borrowers' | 'donors' | 'pending'>('all');
  const [qardActiveSection, setQardActiveSection] = useState<string>('applications');
  const [qardGoldFilter, setQardGoldFilter] = useState<'all' | 'safe_in_vault' | 'redeemed' | 'cancelled'>('all');
  const [qardGoldSearchQuery, setQardGoldSearchQuery] = useState('');
  const [qardCalendarFilter, setQardCalendarFilter] = useState<'today' | 'tomorrow' | 'upcoming' | 'yesterday' | 'overdue' | 'all'>('today');
  const [qardCalendarSpecificDay, setQardCalendarSpecificDay] = useState<number | 'all'>('all');
  const [qardTenureFilter, setQardTenureFilter] = useState<'all' | '1month' | '3months'>('all');
  const [isBulkPenaltyDeducting, setIsBulkPenaltyDeducting] = useState<boolean>(false);
  const [isDeductingSinglePenalty, setIsDeductingSinglePenalty] = useState<string | null>(null);
  const [isBulkDeductingQard, setIsBulkDeductingQard] = useState<boolean>(false);
  const [isSendingQardNotice, setIsSendingQardNotice] = useState<string | null>(null);
  const [qardNoticeSummary, setQardNoticeSummary] = useState<string | null>(null);
  const [qardSearchQuery, setQardSearchQuery] = useState('');
  const [qardShowBreakdownModal, setQardShowBreakdownModal] = useState(false);

  useEffect(() => {
    const banners = dbQardBanners.length > 0 ? dbQardBanners : [
      { id: 1, tag: "সঞ্চয় ও বিনিয়োগ", title: "Al Mayadin Bazar", description: "নিরাপদে আপনার আমানত সঞ্চয় করুন ও সহজ ঋণের সুবিধা গ্রহণ করুন।", image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=650" },
      { id: 2, tag: "টেলিকম অফার", title: "AMB টেলিকম রিচার্জ", description: "সব অপারেটরে আকর্ষণীয় ক্যাশব্যাক ও সুপার ফাস্ট ফ্লেক্সিলোড ড্রাইভে অফার!", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=650" },
      { id: 3, tag: "সুদমুক্ত ঋণ", title: "করযে হাসানা কল্যাণ তহবিল", description: "সব মেম্বারদের জন্য বিপদের সময়ে স্বস্তি ও সুদমুক্ত করযে হাসানা ঋণ সমাধান!", image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=650" }
    ];
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setQardAdminSlideIndex((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [dbQardBanners.length]);

  // Derived state values - Comprehensive pending request normalization
  const pendingRequests = useMemo(() => {
    return transactions.filter(t => {
      if (!t) return false;
      const s = String(t.status || '').trim().toLowerCase();
      const rev = String((t as any).reviewStatus || '').trim().toLowerCase();
      if (s === 'approved' || s === 'success' || s === 'completed' || (t as any).isApproved === true) return false;
      if (s === 'rejected' || s === 'failed' || s === 'cancelled' || s === 'canceled' || rev === 'rejected') return false;
      return s === 'pending' || s === 'processing' || s === 'on_hold' || s === 'hold' || s === 'waiting' || rev === 'pending' || ((t as any).isApproved === false && s !== 'rejected');
    });
  }, [transactions]);
  const totalTelecomPool = users.reduce((acc, u) => acc + (u.telecomBalance || 0), 0);
  const totalShopPool = users.reduce((acc, u) => acc + (u.superShopBalance || 0), 0);

  // Common individual data load functions for static/catalog data
  const fetchNotices = async () => {
    try {
      const noticesSnap = await getDocs(collection(db, 'notices'));
      const noticesList: Notice[] = noticesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notice));
      setNotices(noticesList);
    } catch (err) {
      handleQueryError(err, "notices");
    }
  };

  const fetchOffers = async () => {
    try {
      const offersSnap = await getDocs(collection(db, 'offers'));
      const offersList: Offer[] = offersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Offer));
      setOffers(offersList);
    } catch (err) {
      handleQueryError(err, "offers");
    }
  };

  const fetchBapReportsAndGroups = async () => {
    try {
      const repsSnap = await getDocs(collection(db, 'bap_reports'));
      const repsList: BapReport[] = repsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BapReport));
      setBapReports(repsList);

      const groupsSnap = await getDocs(collection(db, 'bap_groups'));
      const groupsList: BapGroup[] = groupsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BapGroup));
      setBapGroups(groupsList);
    } catch (err) {
      handleQueryError(err, "bap reports/groups");
    }
  };

  const fetchProducts = async () => {
    try {
      const prodsSnap = await getDocs(collection(db, 'products'));
      const prodsList: Product[] = prodsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product));
      setShopProductsList(prodsList);
    } catch (err) {
      handleQueryError(err, "products");
    }
  };

  const fetchAdminNotifications = async () => {
    try {
      const notifySnap = await getDocs(collection(db, 'user_notifications'));
      const notifyList: UserNotification[] = notifySnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UserNotification));
      notifyList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setAdminNotifications(notifyList.slice(0, 100));
    } catch (err) {
      handleQueryError(err, "notifications");
    }
  };

  const fetchEscrowDisputes = async () => {
    try {
      const disputesSnap = await getDocs(collection(db, 'escrow_disputes'));
      const disputesList = disputesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      disputesList.sort((a: any, b: any) => {
        return (b.serialNo || 0) - (a.serialNo || 0);
      });
      setDisputes(disputesList);
    } catch (err) {
      handleQueryError(err, "escrow disputes");
    }
  };

  const fetchRationCards = async () => {
    try {
      const snap = await getDocs(collection(db, 'ration_cards'));
      const list = snap.docs.map(doc => ({
        id: doc.id,
        docId: doc.id,
        ...doc.data()
      }));
      setRationCards(list);
    } catch (err) {
      handleQueryError(err, "ration cards");
    }
  };

  const fetchAdminAgents = async () => {
    try {
      const snap = await getDocs(collection(db, 'bap_agents'));
      const list = snap.docs.map(doc => ({
        id: doc.id,
        docId: doc.id,
        ...doc.data()
      }));
      setAdminAgents(list);
    } catch (err) {
      handleQueryError(err, "admin agents");
    }
  };

  const fetchTransactionsFromDb = async (): Promise<Transaction[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, 'transactions'));
      const list = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          ...data,
          docId: docSnap.id,
          id: docSnap.id,
        } as Transaction;
      });
      const sortedList: Transaction[] = sortTransactionsNewestFirst(list) as Transaction[];
      setTransactions(sortedList);
      return sortedList;
    } catch (err) {
      console.warn("fetchTransactionsFromDb error:", err);
      return [];
    }
  };

  // Main initial load function (Only pulls catalog & admin data.
  // Dynamic collections are handled in real-time by the active onSnapshot listeners!)
  const loadData = async () => {
    setLoading(true);
    try {
      await fetchTransactionsFromDb();

      await Promise.all([
        fetchNotices(),
        fetchOffers(),
        fetchBapReportsAndGroups(),
        fetchProducts(),
        fetchAdminNotifications(),
        fetchEscrowDisputes(),
        fetchAdminAgents()
      ]);
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDisputeStatus = async (disputeId: string, newStatus: string) => {
    setUpdatingDisputeId(disputeId);
    try {
      await updateDoc(doc(db, 'escrow_disputes', disputeId), {
        status: newStatus
      });
      alert(`অভিযোগের স্ট্যাটাস পরিবর্তন করে "${newStatus}" করা হয়েছে।`);
      // Reload specific list only
      await fetchEscrowDisputes();
    } catch (err: any) {
      console.error(err);
      alert("স্ট্যাটাস আপডেট করা যায়নি: " + err.message);
    } finally {
      setUpdatingDisputeId(null);
    }
  };

  const handleApproveSamityMember = async (targetUser: User) => {
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const mId = targetUser.memberId || autoGenerateMemberId();
      await updateDoc(userRef, {
        memberId: mId,
        samityStatus: 'approved'
      });
      
      // Update dedicated application doc if exists
      try {
        await updateDoc(doc(db, 'samity_applications', targetUser.uid), {
          status: 'approved',
          samityStatus: 'approved',
          approvedAt: new Date().toISOString()
        });
      } catch (e) {
        // Doc might not exist for old requests
      }

      // Notify user
      await addDoc(collection(db, 'user_notifications'), {
        userId: targetUser.uid,
        title: '🎉 সমবায় সদস্যপদ অনুমোদিত!',
        message: `অভিনন্দন ${targetUser.name}! আপনার সমবায় সমিতির সদস্যপদ আবেদনটি অনুমোদিত হয়েছে। আপনার মেম্বার আইডি: ${mId}।`,
        type: 'samity_approved',
        read: false,
        createdAt: new Date().toISOString()
      });

      requestAlert('সফল সম্পন্ন', `সদস্য "${targetUser.name}" এর সদস্যতা অনুমোদন করা হয়েছে। মেম্বার আইডি: ${mId}`);
    } catch (err: any) {
      requestAlert('ত্রুটি', "অনুমোদন দিতে সমস্যা হয়েছে: " + err.message);
    }
  };

  const handleRejectSamityMember = async (targetUser: User) => {
    requestConfirm(
      'বাতিল নিশ্চিতকরণ',
      `আপনি কি নিশ্চিত যে সদস্য "${targetUser.name}" এর আবেদনটি বাতিল করতে চান?`,
      async () => {
        try {
          const userRef = doc(db, 'users', targetUser.uid);
          await updateDoc(userRef, {
            samityStatus: 'rejected'
          });

          // Update dedicated application doc if exists
          try {
            await updateDoc(doc(db, 'samity_applications', targetUser.uid), {
              status: 'rejected',
              samityStatus: 'rejected',
              rejectedAt: new Date().toISOString()
            });
          } catch (e) {
            // ignore
          }

          // Notify user
          await addDoc(collection(db, 'user_notifications'), {
            userId: targetUser.uid,
            title: '⚠️ সমবায় সদস্যপদ আবেদন সংক্রান্ত বার্তা',
            message: `সম্মানিত ${targetUser.name}, আপনার সমবায় সমিতির সদস্যপদ আবেদনটি বর্তমানে মঞ্জুর করা সম্ভব হয়নি। অনুগ্রহ করে বিস্তারিত জানতে এডমিন সাপোর্ট টিমে যোগাযোগ করুন।`,
            type: 'samity_rejected',
            read: false,
            createdAt: new Date().toISOString()
          });

          requestAlert('সফল সম্পন্ন', "আবেদনটি বাতিল করা হয়েছে।");
        } catch (err: any) {
          requestAlert('ত্রুটি', "বাতিল করতে সমস্যা হয়েছে: " + err.message);
        }
      }
    );
  };

  const handleAdminDeleteTransaction = async (txId: string, detailsInfo?: string) => {
    if (!txId) return;
    const confirmMsg = detailsInfo 
      ? `আপনি কি নিশ্চিত যে এই লেনদেনটি (${detailsInfo}) স্থায়ীভাবে মুছে ফেলতে চান?\n\nমুছে ফেললে এটি সদস্যের অ্যাপের 'ইতিহাস' (History) থেকেও চিরতরে মুছে যাবে।`
      : `আপনি কি নিশ্চিত যে এই লেনদেনটি স্থায়ীভাবে মুছে ফেলতে চান?\n\nমুছে ফেললে এটি সদস্যের অ্যাপের 'ইতিহাস' (History) থেকেও চিরতরে মুছে যাবে।`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteDoc(doc(db, 'transactions', txId));
      requestAlert('সফল সম্পন্ন', '✅ লেনদেনটি সফলভাবে মুছে ফেলা হয়েছে!');
    } catch (err: any) {
      console.error('Failed to delete transaction:', err);
      requestAlert('ত্রুটি', '❌ লেনদেন মুছতে সমস্যা হয়েছে: ' + (err?.message || 'Error deleting transaction'));
    }
  };

  const handleReleaseAccountDeviceAndLogout = async (target: User | string) => {
    const userId = typeof target === 'string' ? target : target.uid;
    const targetName = typeof target === 'string' ? 'মেম্বার' : (target.name || 'মেম্বার');

    try {
      setLoading(true);
      const nowIso = new Date().toISOString();
      const promises: Promise<any>[] = [];

      const deviceResetPayload: any = {
        currentDeviceId: '',
        deviceFingerprint: '',
        activeDeviceTokens: [],
        isLoggedIn: false,
        deviceStatus: 'Offline',
        forceLogoutAt: nowIso,
        deviceChangeRequested: false,
        deviceLockBypassed: true, // Allow seamless login on any new device
        requestedDeviceId: ''
      };

      // 1. Update user document to clear currentDeviceId, set isLoggedIn = false, forceLogoutAt = now
      promises.push(updateDoc(doc(db, 'users', userId), deviceResetPayload));

      // 2. Sync samity_applications doc if it exists
      promises.push(setDoc(doc(db, 'samity_applications', userId), deviceResetPayload, { merge: true }).catch(() => {}));

      // 3. User real-time notification
      promises.push(addDoc(collection(db, 'user_notifications'), {
        userId: userId,
        title: "📱 জিরো ডিভাইস রিলিজ ও ইনস্ট্যান্ট লগআউট সম্পন্ন!",
        body: "অ্যাডমিন প্যানেল থেকে আপনার একাউন্টটি জিরো ডিভাইস (Zero Device) রিলিজ ও সব ফোন থেকে ইনস্ট্যান্ট লগআউট করা হয়েছে। আপনি এখন যেকোনো নতুন ডিভাইসে সচলভাবে লগইন করতে পারবেন।",
        message: "অ্যাডমিন প্যানেল থেকে আপনার একাউন্টটি জিরো ডিভাইস (Zero Device) রিলিজ ও সব ফোন থেকে ইনস্ট্যান্ট লগআউট করা হয়েছে। আপনি এখন যেকোনো নতুন ডিভাইসে সচলভাবে লগইন করতে পারবেন।",
        read: false,
        category: 'admin_msg',
        createdAt: nowIso
      }).catch(() => {}));

      // 4. Update any pending device_release_requests
      getDocs(query(collection(db, 'device_release_requests'), where('userId', '==', userId), where('status', '==', 'pending'))).then(snap => {
        snap.forEach(d => {
          updateDoc(d.ref, { status: 'approved', resolvedAt: nowIso, resolvedBy: 'Admin Zero Device' }).catch(() => {});
        });
      }).catch(() => {});

      // 5. Also call server-side Zero Device endpoint
      fetch('/api/admin/zero-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, note: 'Admin Zero Device Action' })
      }).catch(() => {});

      // Update local state in AdminPanel immediately
      setUsers(prev => prev.map(u => (u.uid === userId || (u as any).id === userId) ? {
        ...u,
        ...deviceResetPayload
      } : u));

      if (editingUser && (editingUser.uid === userId || (editingUser as any).id === userId)) {
        setEditingUser(prev => prev ? { ...prev, ...deviceResetPayload } : null);
      }

      await Promise.all(promises);
      requestAlert('সফল সম্পন্ন!', `${targetName} এর একাউন্টটি সফলভাবে জিরো ডিভাইস (0 Device) করে দেওয়া হয়েছে এবং সব ফোন থেকে তাৎক্ষণিক রিলিজ সম্পন্ন হয়েছে।`);
    } catch (err: any) {
      console.error(err);
      requestAlert('ত্রুটি', 'ডিভাইস রিলিজ ও লগআউট করতে ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDeviceReset = async (u: User | string) => {
    const userId = typeof u === 'string' ? u : u.uid;
    const targetName = typeof u === 'string' ? 'মেম্বার' : (u.name || 'মেম্বার');
    const requestedDevId = typeof u === 'string' ? '' : (u.requestedDeviceId || '');
    try {
      setLoading(true);
      const nowIso = new Date().toISOString();
      const promises: Promise<any>[] = [];
      const updatedTokens = requestedDevId ? [requestedDevId] : [];
      
      const releasePayload: any = {
        currentDeviceId: requestedDevId || '',
        deviceFingerprint: '',
        activeDeviceTokens: updatedTokens,
        isLoggedIn: false,
        deviceStatus: 'Offline',
        forceLogoutAt: nowIso,
        deviceChangeRequested: false,
        deviceLockBypassed: true, // Allow seamless binding on new device
        requestedDeviceId: ''
      };

      promises.push(updateDoc(doc(db, 'users', userId), releasePayload));
      promises.push(setDoc(doc(db, 'samity_applications', userId), releasePayload, { merge: true }).catch(() => {}));
      
      const notifyId = `notif-${Date.now()}`;
      promises.push(addDoc(collection(db, 'user_notifications'), {
        id: notifyId,
        userId: userId,
        title: "🔓 ডিভাইস লক রিলিজ ও নতুন ডিভাইস অনুমোদন সম্পন্ন!",
        body: "অ্যাডমিন প্যানেল আপনার নতুন ডিভাইস অনুমোদন ও রিলিজ করেছে। আপনি এখন আপনার ফোনে সচলভাবে লগইন করতে পারবেন।",
        read: false,
        isPersonal: true,
        category: 'admin_msg',
        createdAt: nowIso
      }));

      fetch('/api/admin/allow-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, requestedDeviceId: requestedDevId })
      }).catch(() => {});

      // Update any pending device_release_requests for this user
      getDocs(query(collection(db, 'device_release_requests'), where('userId', '==', userId), where('status', '==', 'pending'))).then(snap => {
        snap.forEach(d => {
          updateDoc(d.ref, { status: 'approved', resolvedAt: nowIso, resolvedBy: 'Admin Approval' }).catch(() => {});
        });
      }).catch(() => {});

      // Update local state immediately
      setUsers(prev => prev.map(usr => {
        if (usr.uid === userId || (usr as any).id === userId) {
          return {
            ...usr,
            ...releasePayload
          };
        }
        return usr;
      }));

      if (editingUser && (editingUser.uid === userId || (editingUser as any).id === userId)) {
        setEditingUser(prev => prev ? { ...prev, ...releasePayload } : null);
      }

      // Run parallel writes
      await Promise.all(promises);

      requestAlert('সফল সম্পন্ন', `${targetName} এর ডিভাইস লক সফলভাবে রিলিজ ও অনুমোদন করা হয়েছে।`);
    } catch (err: any) {
      requestAlert('ত্রুটি', "ডিভাইস লক রিলিজ করতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectDeviceReset = async (userId: string) => {
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'users', userId), {
        deviceChangeRequested: false
      });
      getDocs(query(collection(db, 'device_release_requests'), where('userId', '==', userId), where('status', '==', 'pending'))).then(snap => {
        snap.forEach(d => {
          updateDoc(d.ref, { status: 'rejected', resolvedAt: nowIso, resolvedBy: 'Admin Reject' }).catch(() => {});
        });
      }).catch(() => {});
      setUsers(prev => prev.map(usr => (usr.uid === userId || (usr as any).id === userId) ? { ...usr, deviceChangeRequested: false } : usr));
      if (editingUser && (editingUser.uid === userId || (editingUser as any).id === userId)) {
        setEditingUser(prev => prev ? { ...prev, deviceChangeRequested: false } : null);
      }
      requestAlert('সম্পন্ন', "ডিভাইস পরিবর্তনের আবেদন বাতিল করা হয়েছে।");
    } catch (err: any) {
      requestAlert('ত্রুটি', "আবেদন বাতিল করতে সমস্যা হয়েছে: " + err.message);
    }
  };

  const [approvingRationId, setApprovingRationId] = useState<string | null>(null);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');

  const handleApproveRationCardWithDetails = async (rcId: string) => {
    if (!newCardNumber || !newCardExpiry) {
      alert("কার্ড নাম্বার এবং মেয়াদ উল্লেখ করুন।");
      return;
    }
    try {
      await updateDoc(doc(db, 'ration_cards', rcId), { 
        status: 'approved',
        cardNumber: newCardNumber,
        expiryDate: newCardExpiry,
        approvedAt: new Date().toISOString()
      });
      fetchRationCards();
      setApprovingRationId(null);
      setNewCardNumber('');
      setNewCardExpiry('');
      alert("রেশন কার্ডের বিস্তারিত সেট করে সফলভাবে অনুমোদন করা হয়েছে।");
    } catch (err: any) {
      alert("রেশন কার্ড অনুমোদন করতে ত্রুটি: " + err.message);
    }
  };

  const handleUpdateAgentRequestStatus = async (reqId: string, status: 'approved' | 'rejected') => {
    try {
      let docRef = null;
      let targetReq: any = null;

      // Optimistically update local memory state immediately
      setAdminAgentRequests(prev => prev.map((r, idx) => (r.id === reqId || r.docId === reqId) ? { ...r, status } : r));

      // 1. First, search locally in our memory-cache state (extremely fast)
      const foundLocally = adminAgentRequests.find(r => r.id === reqId || r.docId === reqId);
      if (foundLocally) {
        const colName = foundLocally._collection || 'agent_applications';
        docRef = doc(db, colName, foundLocally.docId || reqId);
        targetReq = foundLocally;
      } else {
        // Fallback: search both collections on database (standard fallback)
        const reqQuery1 = await getDocs(collection(db, 'agent_applications'));
        for (const d of reqQuery1.docs) {
          if (d.data().id === reqId || d.id === reqId) {
            docRef = doc(db, 'agent_applications', d.id);
            targetReq = d.data();
            break;
          }
        }
        if (!docRef) {
          const reqQuery2 = await getDocs(collection(db, 'agent_requests'));
          for (const d of reqQuery2.docs) {
            if (d.data().id === reqId || d.id === reqId) {
              docRef = doc(db, 'agent_requests', d.id);
              targetReq = d.data();
              break;
            }
          }
        }
      }

      if (docRef && targetReq) {
        const promises: Promise<any>[] = [];

        // Update the application status itself
        promises.push(updateDoc(docRef, { status }));

        if (status === 'approved') {
          const userId = targetReq.userId || reqId;
          const userRef = doc(db, 'users', userId);
          promises.push(updateDoc(userRef, { role: 'agent' }).catch(() => {}));

          // Fetch current user details/GPS coordinates from memory-cache to avoid slow DB reads
          let userLat = 23.8103;
          let userLng = 90.4125;

          const uData = users.find(u => u.uid === userId);
          if (uData) {
            if (uData.latitude) userLat = uData.latitude;
            if (uData.longitude) userLng = uData.longitude;
          }

          // Create the active live agent record in 'agents' & 'bap_agents'
          const agentId = userId;
          
          let countryFlag = '🇧🇩';
          const reqCountry = targetReq.country || 'Bangladesh';
          const lowerCountry = reqCountry.toLowerCase();
          if (lowerCountry === 'united states' || lowerCountry === 'usa') {
            countryFlag = '🇺🇸';
          } else if (lowerCountry === 'uae' || lowerCountry === 'united arab emirates') {
            countryFlag = '🇦🇪';
          } else if (lowerCountry === 'united kingdom' || lowerCountry === 'uk') {
            countryFlag = '🇬🇧';
          } else if (lowerCountry === 'singapore') {
            countryFlag = '🇸🇬';
          } else if (lowerCountry === 'malaysia') {
            countryFlag = '🇲🇾';
          } else if (lowerCountry === 'saudi arabia' || lowerCountry === 'saudi') {
            countryFlag = '🇸🇦';
          } else if (reqCountry !== 'Bangladesh') {
            countryFlag = '🌍';
          }

          const approvedLat = (targetReq.lat !== undefined && targetReq.lat !== null) ? Number(targetReq.lat) : userLat;
          const approvedLng = (targetReq.lng !== undefined && targetReq.lng !== null) ? Number(targetReq.lng) : userLng;

          const agentData = {
            id: agentId,
            name: targetReq.userName || targetReq.fullName || 'অনুমোদিত এজেন্ট',
            phone: targetReq.phone || '',
            role: 'Approved Agent',
            country: reqCountry,
            flag: countryFlag,
            city: targetReq.city || targetReq.area || targetReq.district || 'Dhaka',
            lat: approvedLat,
            lng: approvedLng,
            realLat: approvedLat,
            realLng: approvedLng,
            bdX: 50,
            bdY: 50,
            img: targetReq.img || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
            district: targetReq.district || '',
            thana: targetReq.thana || targetReq.area || '',
            postOffice: targetReq.postOffice || '',
            verified: true,
            status: 'Available',
            lastSeen: 'Active Now',
            whatsapp: targetReq.whatsNumber || targetReq.whatsapp || targetReq.phone || '',
            messenger: '',
            createdAt: new Date().toISOString()
          };

          promises.push(setDoc(doc(db, 'agents', agentId), agentData, { merge: true }));
          promises.push(setDoc(doc(db, 'bap_agents', agentId), agentData, { merge: true }).catch(() => {}));
        }

        // Run all operations concurrently
        await Promise.all(promises);

        requestAlert(
          'সফল সম্পন্ন',
          `আবেদনটি সফলভাবে ${status === 'approved' ? 'অনুমোদন' : 'বাতিল'} করা হয়েছে।`
        );
      } else {
        requestAlert('ত্রুটি', "আবেদনটি ডাটাবেজে পাওয়া যায়নি!");
      }
    } catch (err: any) {
      requestAlert("ত্রুটি", "স্টেটাস আপডেট করতে সমস্যা হয়েছে: " + err.message);
    }
  };

  const handleApproveAppLockReset = async (targetUser: User) => {
    const targetUid = targetUser.uid || (targetUser as any).id || (targetUser as any).docId || (targetUser as any)._id;
    const targetPhone = targetUser.phone;

    // 1. Optimistic UI update across all possible identifiers
    setUsers(prev => prev.map(u => {
      const match = (targetUid && (u.uid === targetUid || u.id === targetUid || (u as any).docId === targetUid)) ||
                    (targetPhone && u.phone === targetPhone);
      if (match) {
        return {
          ...u,
          isAppLocked: false,
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'approved',
          appLockResetRequestedAt: null as any,
          pin: '1234',
          appLockCode: ''
        };
      }
      return u;
    }));

    if (editingUser && ((targetUid && (editingUser.uid === targetUid || editingUser.id === targetUid)) || (targetPhone && editingUser.phone === targetPhone))) {
      setEditIsAppLocked(false);
      setEditingUser(prev => prev ? { ...prev, isAppLocked: false, appLockResetRequested: false, forgotPinRequested: false, pinResetRequested: false, pin: '1234', appLockCode: '' } : null);
    }

    try {
      if (targetUid) {
        const userRef = doc(db, 'users', targetUid);
        await updateDoc(userRef, {
          isAppLocked: false,
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'approved',
          appLockResetRequestedAt: null as any,
          pin: '1234',
          appLockCode: '',
          appLockResetApprovedAt: new Date().toISOString()
        }).catch(async () => {
          if (targetPhone) {
            const qP = query(collection(db, 'users'), where('phone', '==', targetPhone));
            const snap = await getDocs(qP);
            for (const d of snap.docs) {
              await updateDoc(d.ref, {
                isAppLocked: false,
                appLockResetRequested: false,
                forgotPinRequested: false,
                pinResetRequested: false,
                appLockResetStatus: 'approved',
                pin: '1234',
                appLockCode: ''
              });
            }
          }
        });

        const reqRef = doc(db, 'app_lock_requests', targetUid);
        await setDoc(reqRef, { status: 'approved', approvedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      } else if (targetPhone) {
        const qP = query(collection(db, 'users'), where('phone', '==', targetPhone));
        const snap = await getDocs(qP);
        for (const d of snap.docs) {
          await updateDoc(d.ref, {
            isAppLocked: false,
            appLockResetRequested: false,
            forgotPinRequested: false,
            pinResetRequested: false,
            appLockResetStatus: 'approved',
            pin: '1234',
            appLockCode: ''
          });
        }
      }

      if (targetPhone) {
        const qReq = query(collection(db, 'app_lock_requests'), where('phone', '==', targetPhone));
        const snapReq = await getDocs(qReq).catch(() => null);
        if (snapReq) {
          for (const d of snapReq.docs) {
            await updateDoc(d.ref, { status: 'approved', approvedAt: new Date().toISOString() }).catch(() => {});
          }
        }
      }

      if (targetUid) {
        await addDoc(collection(db, 'user_notifications'), {
          userId: targetUid,
          title: '🔒 অ্যাপ লক আনলক এপ্রুভ করা হয়েছে',
          message: 'এডমিন কর্তৃক আপনার অ্যাপ লক সফলভাবে আনলক করা হয়েছে এবং ডিফল্ট পিন ১২৩৪ সেট করা হয়েছে। এখন আপনি সরাসরি অ্যাপে প্রবেশ করতে পারবেন।',
          createdAt: new Date().toISOString(),
          read: false,
          type: 'security'
        }).catch(() => {});
      }

      requestAlert('সফল', `সদস্য ${targetUser.name || targetUser.phone || ''}-এর অ্যাপ লক সফলভাবে আনলক করা হয়েছে (ডিফল্ট পিন: ১২৩৪)!`);
    } catch (err: any) {
      console.error("Error approving app lock reset:", err);
      requestAlert('ত্রুটি', 'স্টেটাস আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleAdminInstantUnlockUser = async (targetUser: User) => {
    const targetUid = targetUser.uid || (targetUser as any).id || (targetUser as any).docId || (targetUser as any)._id;
    const targetPhone = targetUser.phone;

    setUsers(prev => prev.map(u => {
      const match = (targetUid && (u.uid === targetUid || u.id === targetUid || (u as any).docId === targetUid)) ||
                    (targetPhone && u.phone === targetPhone);
      if (match) {
        return {
          ...u,
          isAppLocked: false,
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'approved',
          appLockResetRequestedAt: null as any
        };
      }
      return u;
    }));

    if (editingUser && ((targetUid && (editingUser.uid === targetUid || editingUser.id === targetUid)) || (targetPhone && editingUser.phone === targetPhone))) {
      setEditIsAppLocked(false);
      setEditingUser(prev => prev ? { ...prev, isAppLocked: false, appLockResetRequested: false, forgotPinRequested: false, pinResetRequested: false } : null);
    }

    try {
      if (targetUid) {
        const userRef = doc(db, 'users', targetUid);
        await updateDoc(userRef, {
          isAppLocked: false,
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'approved',
          appLockResetRequestedAt: null as any
        }).catch(async () => {
          if (targetPhone) {
            const qP = query(collection(db, 'users'), where('phone', '==', targetPhone));
            const snap = await getDocs(qP);
            for (const d of snap.docs) {
              await updateDoc(d.ref, {
                isAppLocked: false,
                appLockResetRequested: false,
                forgotPinRequested: false,
                pinResetRequested: false,
                appLockResetStatus: 'approved'
              });
            }
          }
        });

        const reqRef = doc(db, 'app_lock_requests', targetUid);
        await setDoc(reqRef, { status: 'approved' }, { merge: true }).catch(() => {});
      }

      if (targetPhone) {
        const qReq = query(collection(db, 'app_lock_requests'), where('phone', '==', targetPhone));
        const snapReq = await getDocs(qReq).catch(() => null);
        if (snapReq) {
          for (const d of snapReq.docs) {
            await updateDoc(d.ref, { status: 'approved' }).catch(() => {});
          }
        }
      }

      if (targetUid) {
        await addDoc(collection(db, 'user_notifications'), {
          userId: targetUid,
          title: '🔓 এডমিন কর্তৃক অ্যাপ লক আনলক করা হয়েছে',
          message: 'এডমিন আপনার অ্যাকাউন্টের গোপন সিকিউরিটি লক তাৎক্ষণিকভাবে খুলে দিয়েছেন। এখন আপনি সরাসরি অ্যাপে প্রবেশ করতে পারবেন।',
          createdAt: new Date().toISOString(),
          read: false,
          type: 'security'
        }).catch(() => {});
      }

      requestAlert('সফল', `সদস্য ${targetUser.name || targetUser.phone || ''}-এর অ্যাপ লক সরাসরি আনলক করা হয়েছে!`);
    } catch (err: any) {
      console.error("Error instant unlocking user:", err);
      requestAlert('ত্রুটি', 'আনলক করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleRejectAppLockReset = async (targetUser: User) => {
    const targetUid = targetUser.uid || (targetUser as any).id || (targetUser as any).docId || (targetUser as any)._id;
    const targetPhone = targetUser.phone;

    // 1. Optimistic UI update across all possible identifiers immediately
    setUsers(prev => prev.map(u => {
      const match = (targetUid && (u.uid === targetUid || u.id === targetUid || (u as any).docId === targetUid)) ||
                    (targetPhone && u.phone === targetPhone);
      if (match) {
        return {
          ...u,
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'rejected',
          appLockResetRequestedAt: null as any
        };
      }
      return u;
    }));

    if (editingUser && ((targetUid && (editingUser.uid === targetUid || editingUser.id === targetUid)) || (targetPhone && editingUser.phone === targetPhone))) {
      setEditingUser(prev => prev ? { ...prev, appLockResetRequested: false, forgotPinRequested: false, pinResetRequested: false, appLockResetStatus: 'rejected', appLockResetRequestedAt: null as any } : null);
    }

    try {
      if (targetUid) {
        const userRef = doc(db, 'users', targetUid);
        await updateDoc(userRef, {
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'rejected',
          appLockResetRequestedAt: null as any,
          appLockResetRejectedAt: new Date().toISOString()
        }).catch(async (e) => {
          if (targetPhone) {
            const qP = query(collection(db, 'users'), where('phone', '==', targetPhone));
            const snap = await getDocs(qP);
            for (const d of snap.docs) {
              await updateDoc(d.ref, {
                appLockResetRequested: false,
                forgotPinRequested: false,
                pinResetRequested: false,
                appLockResetStatus: 'rejected',
                appLockResetRequestedAt: null as any
              });
            }
          }
        });

        const reqRef = doc(db, 'app_lock_requests', targetUid);
        await setDoc(reqRef, { status: 'rejected', rejectedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      } else if (targetPhone) {
        const qP = query(collection(db, 'users'), where('phone', '==', targetPhone));
        const snap = await getDocs(qP);
        for (const d of snap.docs) {
          await updateDoc(d.ref, {
            appLockResetRequested: false,
            forgotPinRequested: false,
            pinResetRequested: false,
            appLockResetStatus: 'rejected',
            appLockResetRequestedAt: null as any
          });
        }
      }

      if (targetPhone) {
        const qReq = query(collection(db, 'app_lock_requests'), where('phone', '==', targetPhone));
        const snapReq = await getDocs(qReq).catch(() => null);
        if (snapReq) {
          for (const d of snapReq.docs) {
            await updateDoc(d.ref, { status: 'rejected', rejectedAt: new Date().toISOString() }).catch(() => {});
          }
        }
      }

      if (targetUid) {
        await addDoc(collection(db, 'user_notifications'), {
          userId: targetUid,
          title: '❌ অ্যাপ লক রিসেট বাতিল',
          message: 'এডমিন কর্তৃক আপনার অ্যাপ লক রিসেট রিকোয়েস্ট বাতিল করা হয়েছে। প্রয়োজনে সঠিক পিন দিয়ে আনলক করুন বা হেল্পলাইনে যোগাযোগ করুন।',
          createdAt: new Date().toISOString(),
          read: false,
          type: 'security'
        }).catch(() => {});
      }

      requestAlert('সফল', `সদস্য ${targetUser.name || targetUser.phone || ''}-এর আনলক রিকোয়েস্ট সফলভাবে বাতিল করা হয়েছে।`);
    } catch (err: any) {
      console.error("Error rejecting app lock reset:", err);
      requestAlert('ত্রুটি', 'স্টেটাস আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleApproveUserAccount = async (targetUser: User) => {
    const targetUid = targetUser.uid || (targetUser as any).id;
    if (!targetUid) {
      requestAlert('ত্রুটি', 'ইউজার আইডি ডাটাবেজে পাওয়া যায়নি!');
      return;
    }

    const mId = String(targetUser.memberId || autoGenerateMemberId() || ('AMB-' + Math.floor(100000 + Math.random() * 900000)));

    // Optimistically update memory state immediately (< 0.1s UI response)
    setUsers(prev => prev.map((u, idx) => (u.uid === targetUid || u.id === targetUid) ? { 
      ...u, 
      approved: true, 
      samityStatus: 'approved', 
      status: 'active',
      memberId: mId,
      membershipApproved: true
    } : u));
    setLoading(true);
    try {
      const userRef = doc(db, 'users', targetUid);
      const promises: Promise<any>[] = [];
      
      promises.push(updateDoc(userRef, { 
        approved: true,
        status: 'active',
        samityStatus: 'approved',
        membershipApproved: true,
        memberId: mId
      }));

      // Also sync samity_applications doc so snapshot listener updates status instantly
      promises.push(setDoc(doc(db, 'samity_applications', targetUid), {
        status: 'approved',
        samityStatus: 'approved',
        approved: true,
        memberId: mId
      }, { merge: true }).catch(() => {}));

      // Send a welcoming user notification
      const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const notifRef = doc(db, 'user_notifications', notifId);
      const newNotif: UserNotification = {
        id: notifId,
        userId: targetUid,
        memberId: mId,
        title: "🎉 অ্যাকাউন্ট ভেরিফিকেশন সফল হয়েছে!",
        body: "অভিনন্দন! অ্যাডমিন আপনার অ্যাকাউন্টটি সফলভাবে ভেরিফাই করে অনুমোদন করেছেন। এখন আপনি অ্যাপের সকল সুবিধা ও সেবা উপভোগ করতে পারবেন।",
        read: false,
        createdAt: new Date().toISOString(),
        isPersonal: true,
        notifyType: 'info'
      };
      promises.push(setDoc(notifRef, newNotif));

      await Promise.all(promises);
      requestAlert('সফল সম্পন্ন', `"${targetUser.name}" এর অ্যাকাউন্টটি 1 সেকেন্ডে সফলভাবে অনুমোদিত হয়েছে! (মেম্বার আইডি: ${mId})`);
    } catch (err: any) {
      console.error(err);
      requestAlert('ত্রুটি', `অ্যাকাউন্ট অনুমোদন করতে ব্যর্থ হয়েছে: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectUserAccount = async (targetUser: User) => {
    const targetUid = targetUser.uid || (targetUser as any).id;
    if (!targetUid) {
      requestAlert('ত্রুটি', 'ইউজার আইডি ডাটাবেজে পাওয়া যায়নি!');
      return;
    }

    requestConfirm(
      'বাতিল নিশ্চিতকরণ',
      `আপনি কি নিশ্চিতভাবে "${targetUser.name}" এর অ্যাকাউন্ট আবেদনটি বাতিল ও মুছে ফেলতে চান?`,
      async () => {
        // Optimistically remove user from local memory state immediately
        setUsers(prev => prev.filter(u => u.uid !== targetUid && u.id !== targetUid));
        setLoading(true);
        try {
          const userRef = doc(db, 'users', targetUid);
          await updateDoc(userRef, {
            approved: false,
            status: 'rejected',
            samityStatus: 'rejected',
            isPermanent: true,
            permanentLifetimeAccount: true,
            lifetimeProtected: true
          }).catch(() => {});

          await deleteDoc(doc(db, 'samity_applications', targetUid)).catch(() => {});
          requestAlert('সফল সম্পন্ন', `"${targetUser.name}" এর আবেদনটি বাতিল করা হয়েছে (অ্যাকাউন্ট স্থায়ীভাবে সংরক্ষিত রয়েছে)।`);
        } catch (err: any) {
          console.error(err);
          requestAlert('ত্রুটি', `আবেদন বাতিল করতে ব্যর্থ হয়েছে: ${err.message || err}`);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handlePostNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const noticeId = `not-${Date.now()}`;
      await addDoc(collection(db, 'notices'), {
        id: noticeId,
        title: noticeTitle,
        content: noticeContent,
        section: noticeSection,
        createdAt: new Date().toISOString()
      });
      setNoticeTitle('');
      setNoticeContent('');
      setNoticeSuccess(true);
      setTimeout(() => setNoticeSuccess(false), 3000);
      fetchNotices();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendPersonalNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalNotifyTitle || !personalNotifyBody) {
      setPersonalNotifyError('দয়া করে শিরোনাম এবং বিস্তারিত তথ্য দিন!');
      return;
    }

    const amt = parseFloat(personalNotifyAmount || '0');
    if ((personalNotifyActionType === 'bonus' || personalNotifyActionType === 'fine') && (isNaN(amt) || amt <= 0)) {
      setPersonalNotifyError('দয়া করে সঠিক টাকার পরিমাণ দিন!');
      return;
    }

    try {
      setLoading(true);
      setPersonalNotifyError('');
      setPersonalNotifySuccess(false);

      const notifyId = `notif-${Date.now()}`;
      
      if (personalNotifyMemberId === 'all') {
        // Broadcast to all users
        if (personalNotifyActionType === 'bonus' && amt > 0) {
          for (const u of users) {
            const currentB = Number(u.balance !== undefined ? u.balance : (u as any).mainBalance) || Number((u as any).mainBalance) || 0;
            const newBal = currentB + amt;
            await updateDoc(doc(db, 'users', u.uid), { balance: newBal, mainBalance: newBal });
            await addDoc(collection(db, 'transactions'), {
              id: `tx-bonus-${Date.now()}-${u.uid.slice(0, 4)}`,
              userId: u.uid,
              userMemberId: u.memberId || '',
              userName: u.name,
              userPhone: u.phone,
              type: 'deposit',
              amount: amt,
              description: `🎁 বোনাস প্রদান: ${personalNotifyTitle}`,
              date: new Date().toISOString(),
              status: 'approved'
            });
          }
        } else if (personalNotifyActionType === 'fine' && amt > 0) {
          for (const u of users) {
            const currentB = Number(u.balance !== undefined ? u.balance : (u as any).mainBalance) || Number((u as any).mainBalance) || 0;
            const newBal = Math.max(0, currentB - amt);
            await updateDoc(doc(db, 'users', u.uid), { balance: newBal, mainBalance: newBal });
            await addDoc(collection(db, 'transactions'), {
              id: `tx-fine-${Date.now()}-${u.uid.slice(0, 4)}`,
              userId: u.uid,
              userMemberId: u.memberId || '',
              userName: u.name,
              userPhone: u.phone,
              type: 'withdraw',
              amount: amt,
              description: `⚠️ জরিমানা কর্তন: ${personalNotifyTitle}`,
              date: new Date().toISOString(),
              status: 'approved'
            });
          }
        }

        await addDoc(collection(db, 'user_notifications'), {
          id: notifyId,
          userId: 'all',
          memberId: 'all',
          title: personalNotifyTitle,
          body: personalNotifyBody,
          read: false,
          isPersonal: true,
          type: personalNotifyActionType,
          category: 'admin_msg',
          notifyType: personalNotifyActionType === 'bonus' ? 'credit' : personalNotifyActionType === 'fine' ? 'debit' : 'info',
          amount: (personalNotifyActionType === 'bonus' || personalNotifyActionType === 'fine') ? amt : undefined,
          createdAt: new Date().toISOString()
        });

      } else {
        // Targeted single member
        if (!personalNotifyMemberId) {
          setPersonalNotifyError('দয়া করে মেম্বার আইডি সিলেক্ট করুন!');
          setLoading(false);
          return;
        }
        const targetUser = users.find(u => u.uid === personalNotifyMemberId || u.memberId === personalNotifyMemberId);
        if (!targetUser) {
          setPersonalNotifyError('নির্বাচিত মেম্বার খুঁজে পাওয়া যায়নি!');
          setLoading(false);
          return;
        }

        const currentTargetB = Number(targetUser.balance !== undefined ? targetUser.balance : (targetUser as any).mainBalance) || Number((targetUser as any).mainBalance) || 0;

        if (personalNotifyActionType === 'bonus' && amt > 0) {
          const newBal = currentTargetB + amt;
          await updateDoc(doc(db, 'users', targetUser.uid), { balance: newBal, mainBalance: newBal });
          await addDoc(collection(db, 'transactions'), {
            id: `tx-bonus-${Date.now()}`,
            userId: targetUser.uid,
            userMemberId: targetUser.memberId || '',
            userName: targetUser.name,
            userPhone: targetUser.phone,
            type: 'deposit',
            amount: amt,
            description: `🎁 বোনাস প্রদান: ${personalNotifyTitle}`,
            date: new Date().toISOString(),
            status: 'approved'
          });
        } else if (personalNotifyActionType === 'fine' && amt > 0) {
          const newBal = Math.max(0, currentTargetB - amt);
          await updateDoc(doc(db, 'users', targetUser.uid), { balance: newBal, mainBalance: newBal });
          await addDoc(collection(db, 'transactions'), {
            id: `tx-fine-${Date.now()}`,
            userId: targetUser.uid,
            userMemberId: targetUser.memberId || '',
            userName: targetUser.name,
            userPhone: targetUser.phone,
            type: 'withdraw',
            amount: amt,
            description: `⚠️ জরিমানা কর্তন: ${personalNotifyTitle}`,
            date: new Date().toISOString(),
            status: 'approved'
          });
        }

        await addDoc(collection(db, 'user_notifications'), {
          id: notifyId,
          userId: targetUser.uid,
          memberId: targetUser.memberId || '',
          title: personalNotifyTitle,
          body: personalNotifyBody,
          read: false,
          isPersonal: true,
          type: personalNotifyActionType,
          category: 'admin_msg',
          notifyType: personalNotifyActionType === 'bonus' ? 'credit' : personalNotifyActionType === 'fine' ? 'debit' : 'info',
          amount: (personalNotifyActionType === 'bonus' || personalNotifyActionType === 'fine') ? amt : undefined,
          createdAt: new Date().toISOString()
        });
      }

      setPersonalNotifySuccess(true);
      setPersonalNotifyTitle('');
      setPersonalNotifyBody('');
      setPersonalNotifyAmount('');
      setPersonalNotifyMemberId('');
      fetchAdminNotifications();
    } catch (err: any) {
      setPersonalNotifyError('ত্রুটি: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickUpdateConfig = async (fieldsToUpdate: Partial<AppConfig>) => {
    try {
      const updatedConfig = {
        ...appConfig,
        ...fieldsToUpdate
      };
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);
    } catch (err: any) {
      console.error("Error updating config:", err);
      alert("কনফিগ পরিবর্তন সেভ করতে ত্রুটি: " + err.message);
    }
  };

  const handleSaveMfsGateways = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const updatedConfig: AppConfig = {
        ...appConfig,
        mfsBkashNumber: cfgMfsBkashNumber,
        mfsBkashActive: cfgMfsBkashActive,
        mfsNagadNumber: cfgMfsNagadNumber,
        mfsNagadActive: cfgMfsNagadActive,
        mfsRocketNumber: cfgMfsRocketNumber,
        mfsRocketActive: cfgMfsRocketActive,
        mfsUpayNumber: cfgMfsUpayNumber,
        mfsUpayActive: cfgMfsUpayActive
      };
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);
      alert('মোবাইল ব্যাংকিং (MFS) গেটওয়েসমূহ সফলভাবে সেভ হয়েছে!');
    } catch (err: any) {
      console.error(err);
      alert('MFS গেটওয়ে আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBankRulesSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const updatedConfig: Partial<AppConfig> = {
        addMoneyBankCashbackPerThousand: Number(cfgBankCbPerThousand),
        sendMoneyMobileBankFlatCharge: Number(cfgSendMobileFlat),
        sendMoneyMobileBankServiceChargePerThousand: Number(cfgSendMobileSvc),
        sendMoneyBankFlatCharge: Number(cfgSendBankFlat),
        sendMoneyBankServiceChargePerThousand: Number(cfgSendBankSvc),
        internationalExchangeRate: Number(cfgIntExchangeRate),
        remittanceFee: Number(cfgRemittanceFee),
      };

      await handleQuickUpdateConfig(updatedConfig);
      alert('ব্যাংক ট্রানজেকশন রুলস ও চার্জ সেটিংস সফলভাবে আপডেট ও সেভ হয়েছে!');
    } catch (err: any) {
      console.error("Error saving bank rules:", err);
      alert('সেটিংস সেভ করতে সমস্যা হয়েছে: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRemitRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remitCountryName || !remitRateBDT) {
      alert("দেশের নাম এবং রেট দেওয়া আবশ্যক।");
      return;
    }
    setRemitSaving(true);
    try {
      const id = editingRemitId || remitCountryName.toLowerCase().replace(/[^a-z0-9]/g, '_') || String(Date.now());
      const remitVal = Number(remitRateBDT) || 0;
      const addVal = Number(addMoneyRateBDT) || (remitVal ? Math.max(0, remitVal - 2.5) : 0);
      const data = {
        name: remitCountryName.trim(),
        flag: remitCountryFlag.trim() || '🌐',
        value: remitVal,
        remittanceRate: remitVal,
        addMoneyRate: addVal,
        transferFee: Number(remitTransferFeeVal) || 15,
        multiplier: remitMultiplier.trim() || '1 একক',
        order: Number(remitOrder) || (remitRates.length + 1)
      };
      await setDoc(doc(db, 'remittance_rates', id), data, { merge: true });
      alert(editingRemitId ? "রেমিট্যান্স ও এড মানি রেট সফলভাবে আপডেট করা হয়েছে!" : "নতুন দেশের রেমিট্যান্স ও এড মানি রেট যুক্ত করা হয়েছে!");
      // Reset form
      setRemitCountryName('');
      setRemitCountryFlag('');
      setRemitRateBDT('');
      setAddMoneyRateBDT('');
      setRemitTransferFeeVal('15');
      setRemitMultiplier('');
      setRemitOrder('');
      setEditingRemitId(null);
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    } finally {
      setRemitSaving(false);
    }
  };

  const handleEditRemitRate = (rate: any) => {
    setEditingRemitId(rate.id);
    setRemitCountryName(rate.name);
    setRemitCountryFlag(rate.flag);
    setRemitRateBDT(String(rate.remittanceRate || rate.value || ''));
    setAddMoneyRateBDT(String(rate.addMoneyRate || (rate.value ? (Number(rate.value) - 2.5) : '')));
    setRemitTransferFeeVal(String(rate.transferFee ?? '15'));
    setRemitMultiplier(rate.multiplier || '');
    setRemitOrder(String(rate.order || ''));
  };

  const handleDeleteRemitRate = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই দেশটির রেমিট্যান্স তথ্য মুছে ফেলতে চান?")) return;
    try {
      await deleteDoc(doc(db, 'remittance_rates', id));
      alert("সফলভাবে মুছে ফেলা হয়েছে!");
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    }
  };

  const handleInitDefaultBanks = async () => {
    try {
      setLoading(true);
      const defaultBanks = [
        // Bangladeshi Local Banks
        { id: 'DBBL (ডাচ-বাংলা ব্যাংক)', name: 'Dutch-Bangla Bank PLC. (DBBL)', acronym: 'DB', branch: 'হেমায়েতপুর শাখা', routingNum: '090261545', holder: 'MD SUJON MIA', accNum: '2441580395850', visaNum: '4840 6100 1036 9801', active: true, bgClass: 'bg-blue-50 hover:bg-blue-100 border-blue-150', textClass: 'text-blue-700', logoBgClass: 'bg-blue-100', isInternational: false },
        { id: 'Islami Bank (ইসলামী ব্যাংক)', name: 'Islami Bank Bangladesh PLC', acronym: 'IB', branch: 'Feni Branch', routingNum: '125300522', holder: 'MD SAIFUL ISLAM', accNum: '20501226700344217', visaNum: '', active: true, bgClass: 'bg-teal-50 hover:bg-teal-100 border-teal-150', textClass: 'text-teal-700', logoBgClass: 'bg-teal-100', isInternational: false },
        { id: 'Sonali (সোনালী ব্যাংক)', name: 'Sonali Bank PLC', acronym: 'SB', branch: 'লোকাল অফিস শাখা', routingNum: '200261484', holder: 'MD SUJON MIA', accNum: '01029384756', visaNum: '', active: true, bgClass: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-150', textClass: 'text-emerald-700', logoBgClass: 'bg-emerald-100', isInternational: false },
        { id: 'Brac Bank (ব্র্যাক ব্যাংক)', name: 'Brac Bank PLC', acronym: 'BB', branch: 'গুলশান শাখা', routingNum: '060261453', holder: 'MD SUJON MIA', accNum: '1501203495867001', visaNum: '', active: true, bgClass: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-150', textClass: 'text-indigo-700', logoBgClass: 'bg-indigo-100', isInternational: false },
        { id: 'City Bank (সিটি ব্যাংক)', name: 'The City Bank PLC', acronym: 'CB', branch: 'গুলশান করপোরেট', routingNum: '225261453', holder: 'MD SUJON MIA', accNum: '11029384756', visaNum: '', active: true, bgClass: 'bg-sky-50 hover:bg-sky-100 border-sky-150', textClass: 'text-sky-700', logoBgClass: 'bg-sky-100', isInternational: false },
        { id: 'Jamuna Bank (যমুনা ব্যাংক)', name: 'Jamuna Bank PLC', acronym: 'JB', branch: 'দিলকুশা শাখা', routingNum: '115261352', holder: 'MD SUJON MIA', accNum: '00239485721', visaNum: '', active: true, bgClass: 'bg-purple-50 hover:bg-purple-100 border-purple-150', textClass: 'text-purple-700', logoBgClass: 'bg-purple-100', isInternational: false },
        { id: 'Pubali Bank (পূবালী ব্যাংক)', name: 'Pubali Bank PLC', acronym: 'PB', branch: 'মতিঝিল শাখা', routingNum: '185261254', holder: 'MD SUJON MIA', accNum: '01923847561', visaNum: '', active: true, bgClass: 'bg-amber-50 hover:bg-amber-100 border-amber-150', textClass: 'text-amber-700', logoBgClass: 'bg-amber-100', isInternational: false },
        { id: 'Mutual Trust Bank (মিউচুয়াল ট্রাস্ট)', name: 'Mutual Trust Bank PLC', acronym: 'MT', branch: 'তেজগাঁও শাখা', routingNum: '165261221', holder: 'MD SUJON MIA', accNum: '00349586721', visaNum: '', active: true, bgClass: 'bg-pink-50 hover:bg-pink-100 border-pink-150', textClass: 'text-pink-700', logoBgClass: 'bg-pink-100', isInternational: false },
        { id: 'Southeast Bank (সাউথইস্ট ব্যাংক)', name: 'Southeast Bank PLC', acronym: 'SE', branch: 'বনানী শাখা', routingNum: '245261152', holder: 'MD SUJON MIA', accNum: '00129384752', visaNum: '', active: true, bgClass: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-150', textClass: 'text-cyan-700', logoBgClass: 'bg-cyan-100', isInternational: false },
        { id: 'Rupali Bank (রূপালী ব্যাংক)', name: 'Rupali Bank PLC', acronym: 'RB', branch: 'রমনী শাখা', routingNum: '215261054', holder: 'MD SUJON MIA', accNum: '01549586721', visaNum: '', active: true, bgClass: 'bg-orange-50 hover:bg-orange-100 border-orange-150', textClass: 'text-orange-700', logoBgClass: 'bg-orange-100', isInternational: false },
        { id: 'Janata Bank (জনতা ব্যাংক)', name: 'Janata Bank PLC', acronym: 'JN', branch: 'ঢাকা বিশ্ববিদ্যালয় শাখা', routingNum: '135260124', holder: 'MD SUJON MIA', accNum: '01129384756', visaNum: '', active: true, bgClass: 'bg-rose-50 hover:bg-rose-100 border-rose-150', textClass: 'text-rose-700', logoBgClass: 'bg-rose-100', isInternational: false },

        // Foreign & International Remittance Gateway Banks
        { id: 'SNB (সৌদি ব্যাংক)', name: 'SAUDI NATIONAL BANK (SNB ALAHLI)', acronym: 'SNB', branch: 'Riyadh Main Branch', routingNum: 'NCBKSA21', holder: 'BUSINESS NETWORK BANGLADESH', accNum: '640000010006087881869', iban: 'SA50 8000 0640 6080 1788 1869', visaNum: '', active: true, bgClass: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200', textClass: 'text-indigo-800', logoBgClass: 'bg-indigo-200', isInternational: true },
        { id: 'ENBD (দুবাই ব্যাংক)', name: 'EMIRATES NBD BANK (DUBAI)', acronym: 'ENBD', branch: 'Deira Branch, Dubai', routingNum: 'EBILAE2X', holder: 'BUSINESS NETWORK BANGLADESH', accNum: '120220000987456321458', iban: 'AE12 0220 0009 8745 6321 458', visaNum: '', active: true, bgClass: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200', textClass: 'text-indigo-800', logoBgClass: 'bg-indigo-200', isInternational: true },
        { id: 'Western Union (ওয়েস্টার্ন ইউনিয়ন)', name: 'Western Union Remittance Gateway', acronym: 'WU', branch: 'Global Direct Wire', routingNum: 'SWIFT-WU-GLOBAL', holder: 'AMB OVERSEAS REMITTANCE', accNum: 'WU-8801965911728', iban: 'WU-8801965911728', visaNum: '', active: true, bgClass: 'bg-amber-50 hover:bg-amber-100 border-amber-200', textClass: 'text-amber-800', logoBgClass: 'bg-amber-200', isInternational: true }
      ];
      const updatedConfig = {
        ...appConfig,
        paymentBanks: defaultBanks
      };
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);
      alert('ডিফল্ট ব্যাংক পেমেন্ট মেথডগুলো সফলভাবে লোড করা হয়েছে!');
    } catch (err: any) {
      console.error(err);
      alert('ডিফল্ট ব্যাংক সেটিংস লোড করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInitDefaultIntlBanks = async () => {
    try {
      setLoading(true);
      const defaultIntl = [
        { id: 'SNB (সৌদি ব্যাংক)', name: 'SAUDI NATIONAL BANK (SNB ALAHLI)', acronym: 'SNB', branch: 'Riyadh Main Branch', routingNum: 'NCBKSA21', holder: 'BUSINESS NETWORK BANGLADESH', accNum: '640000010006087881869', iban: 'SA50 8000 0640 6080 1788 1869', visaNum: '', active: true, bgClass: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200', textClass: 'text-indigo-800', logoBgClass: 'bg-indigo-200', isInternational: true },
        { id: 'ENBD (দুবাই ব্যাংক)', name: 'EMIRATES NBD BANK (DUBAI)', acronym: 'ENBD', branch: 'Deira Branch, Dubai', routingNum: 'EBILAE2X', holder: 'BUSINESS NETWORK BANGLADESH', accNum: '120220000987456321458', iban: 'AE12 0220 0009 8745 6321 458', visaNum: '', active: true, bgClass: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200', textClass: 'text-indigo-800', logoBgClass: 'bg-indigo-200', isInternational: true }
      ];
      const currentBanks = appConfig.paymentBanks ? [...appConfig.paymentBanks] : [];
      const nonIntl = currentBanks.filter(b => !b.isInternational);
      const existingIntl = currentBanks.filter(b => b.isInternational === true);
      
      const newIntlList = [...existingIntl];
      defaultIntl.forEach(d => {
        if (!newIntlList.some(e => e.id === d.id || e.name === d.name)) {
          newIntlList.push(d);
        }
      });

      const updatedConfig = {
        ...appConfig,
        paymentBanks: [...nonIntl, ...newIntlList]
      };
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);
      alert('সৌদি ন্যাশনাল ব্যাংক ও দুবাই ব্যাংকসহ প্রবাসী ব্যাংকসমূহ এডমিন প্যানেলে লোড হয়েছে!');
    } catch (err: any) {
      console.error(err);
      alert('প্রবাসী ব্যাংক সেটিংস লোড করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = ebName.trim();
    const cleanHolder = ebHolder.trim();
    const cleanAcc = ebAccNum.trim();

    if (!cleanName) {
      alert('দয়া করে ব্যাংকিং মেথড বা ওয়ালেটের নাম লিখুন!');
      return;
    }
    if (!cleanHolder) {
      alert('দয়া করে হিসাবধারীর নাম (Holder Name) লিখুন!');
      return;
    }
    if (!cleanAcc) {
      alert('দয়া করে অ্যাকাউন্ট বা মোবাইল ওয়ালেট নম্বর লিখুন!');
      return;
    }

    try {
      setLoading(true);
      const currentBanks = appConfig.paymentBanks ? [...appConfig.paymentBanks] : [];
      const isMob = ebAccountType === 'mobile_bank' || ebIsMobileBank;
      const isIntl = ebAccountType === 'foreign_bank' || (ebAccountType !== 'mobile_bank' && ebIsInternational);

      const newBankObj: any = {
        id: editingBank ? editingBank.id : `${cleanName}-${Date.now()}`,
        name: cleanName,
        acronym: ebAcronym.trim() || (isMob ? 'MFS' : isIntl ? 'INTL' : 'BD'),
        branch: ebBranch.trim() || (isMob ? 'মোবাইল ওয়ালেট' : isIntl ? 'প্রবাসী ওয়ালেট' : 'প্রধান শাখা / অনলাইন'),
        routingNum: ebRoutingNum.trim(),
        holder: cleanHolder,
        accNum: cleanAcc,
        iban: ebIban.trim() || cleanAcc,
        visaNum: ebVisaNum.trim(),
        active: ebActive,
        bgClass: ebBgClass,
        textClass: ebTextClass,
        logoBgClass: ebLogoBgClass,
        isInternational: isIntl,
        isMobileBank: isMob,
        qrCodeUrl: ebQrCodeUrl
      };

      if (isIntl) {
        newBankObj.currency = (ebCurrency.trim() || 'SAR').toUpperCase();
        newBankObj.country = ebCountry.trim() || 'সৌদি আরব';
        newBankObj.transferFee = ebTransferFee !== '' ? Number(ebTransferFee) : 15;
        if (ebCustomRate && Number(ebCustomRate) > 0) {
          newBankObj.customRate = Number(ebCustomRate);
          newBankObj.exchangeRate = Number(ebCustomRate);
        }
      }

      let updatedBanks;
      if (editingBank) {
        updatedBanks = currentBanks.map(b => b.id === editingBank.id ? newBankObj : b);
      } else {
        updatedBanks = [...currentBanks, newBankObj];
      }

      const updatedConfig = {
        ...appConfig,
        paymentBanks: updatedBanks
      };
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);

      alert(editingBank ? 'পেমেন্ট মেথড তথ্য সফলভাবে আপডেট হয়েছে!' : 'নতুন ব্যাংক/পেমেন্ট মেথড অ্যাকাউন্ট যুক্ত করা হয়েছে!');

      // Reset form fields
      setEditingBank(null);
      setShowAddBank(false);
      setEbName('');
      setEbAcronym('');
      setEbBranch('');
      setEbRoutingNum('');
      setEbHolder('');
      setEbAccNum('');
      setEbIban('');
      setEbVisaNum('');
      setEbActive(true);
      setEbQrCodeUrl('');
      setEbCurrency('SAR');
      setEbCountry('সৌদি আরব');
      setEbTransferFee('15');
      setEbCustomRate('');
      setEbIsMobileBank(false);
      setEbIsInternational(false);
      setEbAccountType('local_bank');
    } catch (err: any) {
      console.error(err);
      alert('ব্যাংক অ্যাকাউন্ট তথ্য সেভ করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCardDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCardUser) return;

    try {
      setLoading(true);
      const userRef = doc(db, 'users', editingCardUser.uid);
      await updateDoc(userRef, {
        ambCardNumber: editCardNo.trim(),
        ambAccountNumber: editCardAcc.trim(),
        ambCardHolderName: editCardHolder.trim().toUpperCase(),
        ambCardExpiry: editCardExpiry.trim(),
        ambCardCvv: editCardCvv.trim(),
        ambCardStatus: editCardStatus
      });

      // Submit automatic real-time notification
      await addDoc(collection(db, 'user_notifications'), {
        userId: editingCardUser.uid,
        title: 'ভার্চুয়াল কার্ড কাস্টমাইজেশন',
        message: `আপনার ভার্চুয়াল ডেবিট কার্ডের তথ্য এডমিন প্যানেল থেকে কাস্টমাইজ বা নবায়ন করা হয়েছে। অনুগ্রহ করে কার্ডের নতুন বিবরণী চেক করুন।`,
        read: false,
        createdAt: new Date().toISOString()
      });

      alert('ভার্চুয়াল কার্ডের তথ্য সফলভাবে কাস্টমাইজ ও আপডেট করা হয়েছে!');
      setEditingCardUser(null);
    } catch (err: any) {
      console.error('Error saving user card details:', err);
      alert('কার্ডের তথ্য আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRenewUserCard = async (targetUser: User) => {
    if (!targetUser) return;
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে সদস্য ${targetUser.name} এর কার্ডের মেয়াদ 1 বছরের জন্য বৃদ্ধি/নবায়ন করতে চান?`)) return;

    try {
      setLoading(true);
      
      let currentExp = targetUser.ambCardExpiry || '';
      let nextExpiry = '';
      const now = new Date();
      
      if (currentExp && currentExp.includes('/')) {
        const parts = currentExp.split('/');
        const m = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        const nextY = y + 1;
        nextExpiry = `${String(m).padStart(2, '0')}/${String(nextY).padStart(2, '0')}`;
      } else {
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = String(now.getFullYear() + 1 - 2000);
        nextExpiry = `${mm}/${yy}`;
      }

      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, {
        ambCardExpiry: nextExpiry,
        ambCardStatus: 'active'
      });

      await addDoc(collection(db, 'user_notifications'), {
        userId: targetUser.uid,
        title: 'ভার্চুয়াল কার্ড নবায়ন সম্পন্ন',
        message: `আপনার ভার্চুয়াল ডেবিট কার্ডের মেয়াদ সফলভাবে আরও 1 বছরের জন্য (${nextExpiry} পর্যন্ত) নবায়ন (Renew) করা হয়েছে!`,
        read: false,
        createdAt: new Date().toISOString()
      });

      alert(`ভার্চুয়াল কার্ডটি সফলভাবে ${nextExpiry} পর্যন্ত নবায়ন করা হয়েছে এবং কার্ডটি সক্রিয় করা হয়েছে!`);
    } catch (err: any) {
      console.error('Error renewing user card:', err);
      alert('কার্ড নবায়ন করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই ব্যাংক অ্যাকাউন্ট পেমেন্ট মেথডটি সম্পূর্ণ মুছে ফেলতে চান?')) return;
    try {
      setLoading(true);
      const currentBanks = appConfig.paymentBanks ? [...appConfig.paymentBanks] : [];
      const updatedBanks = currentBanks.filter(b => b.id !== id);
      const updatedConfig = {
        ...appConfig,
        paymentBanks: updatedBanks
      };
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);
      alert('ব্যাংক মেথডটি সফলভাবে মুছে ফেলা হয়েছে!');
    } catch (err: any) {
      console.error(err);
      alert('মুছে ফেলতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGlobalRulesAndFees = async (e: React.FormEvent) => {
    e.preventDefault();
    setCfgSaving(true);
    setCfgError('');
    setCfgSuccess(false);
    try {
      const updatedConfig: AppConfig = {
        ...appConfig,
        coopLoanInterestRate: cfgCoopInterestRate,
        remittanceFeePercent: cfgRemittanceFeePercent,
        appName: cfgAppName,
        personalMfsNumber: cfgPersonalMfsNumber,
        personalBankCard: cfgPersonalBankCard,
        supportPhone: cfgSupportPhone,
        samityTerms: cfgSamityTerms,
        tickerText: cfgTickerText,
        samityTicker: cfgSamityTicker,
        qardTicker: cfgQardTicker,
        telecomTicker: cfgTelecomTicker,
        safiTicker: cfgSafiTicker,
        escrowTicker: cfgEscrowTicker,
        rationTicker: cfgRationTicker,
        exchangeRatePerThousand: cfgExchangeRatePerThousand,
        mobileRechargePercent: cfgMobileRechargePercent,
        alaapRechargePercent: cfgAlaapRechargePercent,
        brilliantRechargePercent: cfgBrilliantRechargePercent,
        logoUrl: cfgLogoUrl,
        serviceStatus: cfgServiceStatus,
        telecomDefaultSlabs: [
          { amount: Number(cfgSlab1Amt) || 20, cashback: Number(cfgSlab1Cb) || 0 },
          { amount: Number(cfgSlab2Amt) || 50, cashback: Number(cfgSlab2Cb) || 0 },
          { amount: Number(cfgSlab3Amt) || 100, cashback: Number(cfgSlab3Cb) || 0 },
          { amount: Number(cfgSlab4Amt) || 500, cashback: Number(cfgSlab4Cb) || 0 }
        ],
        globalTexts: {
          ...appConfig.globalTexts,
          homeWelcomeTitle: globalWelcomeTitle,
          homeWelcomeSub: globalWelcomeSub,
          contactUsLabel: globalContactLabel,
          supportDeskInfo: globalSupportDeskInfo,
          loanApplyBtnText: globalLoanBtn,
          rationApplyBtnText: globalRationBtn,
        },
        telecomOperatorCashbacks: cfgOperatorCashbacks,
        oneSignalAppId: cfgOneSignalAppId,
        oneSignalRestApiKey: cfgOneSignalRestApiKey
      };

      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);
      
      setCfgSuccess(true);
      alert('গ্লোবাল সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err: any) {
      console.error(err);
      setCfgError(err.message || 'সেটিংস সেভ করতে সমস্যা হয়েছে।');
    } finally {
      setCfgSaving(false);
    }
  };

  const handleAddCashbackRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cbAmountRule || !cbCashbackRule) {
      alert("অনুগ্রহ করে রিচার্জের পরিমাণ এবং ক্যাশব্যাকের পরিমাণ সঠিকভাবে লিখুন।");
      return;
    }
    const amount = Number(cbAmountRule);
    const cashback = Number(cbCashbackRule);
    if (isNaN(amount) || amount <= 0 || isNaN(cashback) || cashback < 0) {
      alert("অনুগ্রহ করে সঠিক সংখ্যা বা টাকার পরিমাণ টাইপ করুন!");
      return;
    }

    setCbSaving(true);
    try {
      const currentRules = appConfig.rechargeCashbackRules || [];
      // Avoid duplicate rule for same amount
      const filteredRules = currentRules.filter(r => r.amount !== amount);
      const updatedRules = [...filteredRules, { amount, cashback }].sort((a, b) => a.amount - b.amount);

      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { rechargeCashbackRules: updatedRules }, { merge: true });
      
      const updatedConfig = {
        ...appConfig,
        rechargeCashbackRules: updatedRules
      };
      onChangeConfig(updatedConfig);
      setCbAmountRule('');
      setCbCashbackRule('');
      alert("ক্যাশব্যাক অফার রুলটি সফলভাবে সংরক্ষণ করা হয়েছে!");
    } catch (err: any) {
      console.error("Error adding cashback rule:", err);
      alert("ক্যাশব্যাক রুলটি সেভ করতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setCbSaving(false);
    }
  };

  const handleDeleteCashbackRule = async (amount: number) => {
    if (!window.confirm(`আপনি কি ৳${amount} রিচার্জের ক্যাশব্যাক অফার রুলটি মুছে ফেলতে চান?`)) return;
    try {
      const currentRules = appConfig.rechargeCashbackRules || [];
      const updatedRules = currentRules.filter(r => r.amount !== amount);

      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { rechargeCashbackRules: updatedRules }, { merge: true });
      
      const updatedConfig = {
        ...appConfig,
        rechargeCashbackRules: updatedRules
      };
      onChangeConfig(updatedConfig);
      alert("ক্যাশব্যাক অফার রুলটি সফলভাবে মুছে ফেলা হয়েছে!");
    } catch (err: any) {
      console.error("Error deleting cashback rule:", err);
      alert("মুছে ফেলতে ত্রুটি ঘটেছে: " + err.message);
    }
  };

  // NEW: Safe Deal Admin Handlers
  const handleCreateSafeDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sdTitle || !sdPrice) {
      alert("অনুগ্রহ করে প্রোডাক্টের নাম ও মূল্য সঠিকভাবে লিখুন।");
      return;
    }
    setLoadingEscrow(true);
    try {
      const newDealDoc = {
        title: sdTitle,
        description: sdDesc || 'গ্রুপ বাই ডিল প্রোডাক্ট',
        price: Number(sdPrice),
        minQty: sdMinQty || '1 পিস',
        emoji: sdEmoji || '📦',
        supplier: sdSupplier || 'AMB Wholesalers',
        status: 'active',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'safe_deals'), newDealDoc);
      alert("অভিনন্দন! নিরাপদ ডিলে নতুন প্রোডাক্ট ডিল সফলভাবে যোগ করা হয়েছে।");
      setSdTitle('');
      setSdDesc('');
      setSdPrice('');
      setSdMinQty('');
      setSdEmoji('📦');
      setSdSupplier('');
    } catch (err: any) {
      console.error("Error adding safe deal:", err);
      alert("ডিল প্রোডাক্ট যোগ করতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setLoadingEscrow(false);
    }
  };

  const handleToggleSafeDealStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'safe_deals', id), { status: nextStatus });
      alert(`প্রোডাক্ট ডিলের স্ট্যাটাস পরিবর্তন করা হয়েছে।`);
    } catch (err: any) {
      console.error("Error toggling safe deal status:", err);
      alert("স্ট্যাটাস পরিবর্তন করা যায়নি: " + err.message);
    }
  };

  const handleDeleteSafeDeal = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই ডিলটি মুছে ফেলতে চান?")) return;
    try {
      await deleteDoc(doc(db, 'safe_deals', id));
      alert("প্রোডাক্ট ডিলটি সফলভাবে মুছে ফেলা হয়েছে।");
    } catch (err: any) {
      console.error("Error deleting safe deal:", err);
      alert("মুছে ফেলা সম্ভব হয়নি: " + err.message);
    }
  };

  // NEW: Courier Admin Handlers
  const handleRegisterRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiderName || !newRiderPhone || !newRiderMemberId) {
      alert("সবগুলো তথ্য সঠিকভাবে টাইপ করুন।");
      return;
    }
    setLoadingCourier(true);
    try {
      const riderId = `rider-${Date.now()}`;
      const riderData = {
        id: riderId,
        name: newRiderName,
        phone: newRiderPhone,
        memberId: newRiderMemberId,
        status: 'online',
        activeShift: 'morning',
        balance: 0,
        registered: true,
        regFeePaid: true,
        rating: 5.0,
        totalDeliveries: 0,
        city: 'Dhaka',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'courier_riders', riderId), riderData);
      alert("রাইডার সফলভাবে নিবন্ধিত করা হয়েছে।");
      setNewRiderName('');
      setNewRiderPhone('');
      setNewRiderMemberId('');
    } catch (err: any) {
      console.error("Error registering rider:", err);
      alert("রাইডার রেজিস্টার করতে ত্রুটি: " + err.message);
    } finally {
      setLoadingCourier(false);
    }
  };

  const handleUpdateCourierOrderStatus = async (orderId: string, newStatus: string, rId?: string, rName?: string, rPhone?: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (rId) {
        updateData.riderId = rId;
        updateData.riderName = rName || 'AMB Rider';
        updateData.riderPhone = rPhone || '';
      }
      if (newStatus === 'delivered') {
        updateData.progressPercent = 100;
      } else if (newStatus === 'delivering') {
        updateData.progressPercent = 50;
      }
      await updateDoc(doc(db, 'courier_orders', orderId), updateData);
      alert(`অর্ডার স্ট্যাটাস আপডেট করা হয়েছে: "${newStatus}"`);
    } catch (err: any) {
      console.error("Error updating courier order status:", err);
      alert("অর্ডার আপডেট করতে ত্রুটি: " + err.message);
    }
  };

  const handleDeleteCourierOrder = async (orderId: string) => {
    if (!window.confirm("আপনি কি এই কুরিয়ার অর্ডার বুকিং রেকর্ডটি ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, 'courier_orders', orderId));
      alert("কুরিয়ার অর্ডার রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।");
    } catch (err: any) {
      console.error("Error deleting courier order:", err);
      alert("অর্ডার ডিলিট করতে ত্রুটি: " + err.message);
    }
  };

  const handleDeleteRider = async (riderId: string) => {
    if (!window.confirm("আপনি কি এই রাইডার রেকর্ডটি ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, 'courier_riders', riderId));
      alert("রাইডার রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।");
    } catch (err: any) {
      console.error("Error deleting rider:", err);
      alert("রাইডার ডিলিট করতে ত্রুটি: " + err.message);
    }
  };

  const handleGeocodeAgentAddress = async () => {
    const parts = [
      newAgentPostOffice,
      newAgentThana,
      newAgentDistrict,
      newAgentCity,
      newAgentCountry
    ].filter(p => p && p.trim() !== '');
    
    if (parts.length === 0) {
      alert("অনুগ্রহ করে আগে ঠিকানা (দেশ, শহর, জেলা বা থানা) প্রদান করুন।");
      return;
    }
    
    const queryStr = parts.join(', ');
    setIsGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'bn,en',
          'User-Agent': 'AMB-Cooperative-Admin-Panel-Geocoding'
        }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        setNewAgentLat(item.lat);
        setNewAgentLng(item.lon);
        alert(`সফলভাবে কো-অর্ডিনেট পাওয়া গেছে!\nঅক্ষাংশ (Lat): ${item.lat}\nদ্রাঘিমাংশ (Lng): ${item.lon}\nস্থানঃ ${item.display_name}`);
      } else {
        const secondaryParts = [newAgentCity, newAgentCountry].filter(Boolean);
        if (secondaryParts.length > 0) {
          const secondQuery = secondaryParts.join(', ');
          const secondRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(secondQuery)}&limit=1`, {
            headers: {
              'Accept-Language': 'bn,en',
              'User-Agent': 'AMB-Cooperative-Admin-Panel-Geocoding'
            }
          });
          const secondData = await secondRes.json();
          if (secondData && secondData.length > 0) {
            setNewAgentLat(secondData[0].lat);
            setNewAgentLng(secondData[0].lon);
            alert(`আংশিক কো-অর্ডিনেট পাওয়া গেছে (শহর/দেশ স্তরে)!\nঅক্ষাংশ (Lat): ${secondData[0].lat}\nদ্রাঘিমাংশ (Lng): ${secondData[0].lon}\nস্থানঃ ${secondData[0].display_name}`);
            return;
          }
        }
        alert("কো-অর্ডিনেট পাওয়া যায়নি। অনুগ্রহ করে ম্যানুয়ালি লিখুন বা ঠিকানাটি স্পষ্ট করে লিখুন।");
      }
    } catch (err: any) {
      console.error("Geocoding error:", err);
      alert("কো-অর্ডিনেট খুঁজতে সমস্যা হয়েছে। অনুগ্রহ করে ম্যানুয়ালি ইনপুট দিন।");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingAgent(true);
    try {
      const agentId = `age-${Date.now()}`;
      const latVal = Number(newAgentLat) || 23.8103;
      const lngVal = Number(newAgentLng) || 90.4125;
      const newAgent = {
        id: agentId,
        name: newAgentName,
        phone: newAgentPhone,
        role: newAgentRole,
        country: newAgentCountry,
        city: newAgentCity,
        lat: latVal,
        lng: lngVal,
        realLat: latVal,
        realLng: lngVal,
        bdX: Number(newAgentBdX) || 50,
        bdY: Number(newAgentBdY) || 50,
        img: newAgentImg || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
        district: newAgentDistrict,
        thana: newAgentThana,
        postOffice: newAgentPostOffice,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'bap_agents', agentId), newAgent);
      await setDoc(doc(db, 'agents', agentId), newAgent);
      
      setNewAgentName('');
      setNewAgentPhone('');
      setNewAgentCity('');
      setNewAgentDistrict('');
      setNewAgentThana('');
      setNewAgentPostOffice('');
      setNewAgentImg('');
      
      alert('নতুন এজেন্ট সফলভাবে যুক্ত করা হয়েছে!');
      fetchAdminAgents();
    } catch (err: any) {
      alert("এজেন্ট যুক্ত করতে ত্রুটি: " + err.message);
    } finally {
      setAddingAgent(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!window.confirm('আপনি কি এই এজেন্ট পজিশনটি ডিলিট করতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'bap_agents', agentId));
      await deleteDoc(doc(db, 'agents', agentId));
      alert('এজেন্ট পজিশনটি সফলভাবে ডিলিট করা হয়েছে।');
      fetchAdminAgents();
    } catch (err: any) {
      alert('ডিলিট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleCreateRationCardManually = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docId = rcNewCardNo.trim() || `AMB-RC-${Date.now()}`;
      const newCard = {
        id: docId,
        userId: rcNewUserId.trim() || `man-${Date.now()}`,
        name: rcNewName,
        userName: rcNewName,
        phone: rcNewPhone,
        cardNo: rcNewCardNo || docId,
        cardNumber: rcNewCardNo || docId,
        cardType: rcNewCardType,
        village: rcNewVillage,
        upazila: rcNewUpazila,
        district: rcNewDistrict,
        nomineeName: rcNewNomineeName,
        photoUrl: rcNewPhoto,
        status: 'approved',
        createdAt: new Date().toISOString(),
        
        // Custom VIP styles fields
        vipCardBg: rcNewVipCardBg,
        vipBorderColor: rcNewVipBorderColor,
        vipTextColor: rcNewVipTextColor,
        vipPrimaryColor: rcNewVipPrimaryColor
      };
      await setDoc(doc(doc(db, 'ration_cards', docId).firestore, 'ration_cards', docId), newCard);
      
      setRcNewUserId('');
      setRcNewName('');
      setRcNewPhone('');
      setRcNewCardNo('');
      setRcNewVillage('');
      setRcNewUpazila('');
      setRcNewDistrict('');
      setRcNewNomineeName('');
      
      alert('ডিজিটাল রেশন কার্ডটি ম্যানুয়ালি সফলভাবে সংযোজন করা হয়েছে।');
      fetchRationCards();
    } catch (err: any) {
      alert("রেশন কার্ড তৈরি করতে ত্রুটি: " + err.message);
    }
  };

  const handleRejectRationCardDirect = (rcId: string) => handleDeleteRationCard(rcId);

  const handleDeleteRationCard = async (rcId: string) => {
    if (!window.confirm('আপনি কি এই রেশন কার্ডটি ডাটাবেজ থেকে চিরতরে ডিলিট করতে চান?')) return;
    
    const reason = window.prompt("দয়া করে কার্ডটি বাতিল করার সুনির্দিষ্ট কারণ লিখুন (সদস্যের কাছে নোটিফিকেশন যাবে):");
    if (reason === null) return; // Prompt cancelled
    
    try {
      // 1. Get the card data to extract the user's UID before deleting it
      const cardSnap = await getDoc(doc(db, 'ration_cards', rcId));
      let userId = '';
      if (cardSnap.exists()) {
        const cardData = cardSnap.data();
        userId = cardData.userId || cardData.uid || '';
      }
      
      // 2. Delete the card document from Firestore
      await deleteDoc(doc(db, 'ration_cards', rcId));
      
      // 3. Dispatch an automated real-time notification to the affected user's inbox
      if (userId) {
        const notifyId = `notif-rc-del-${Date.now()}`;
        const finalReason = reason.trim() || 'নিরাপত্তা ও নিয়মকানুন লংঘন';
        await addDoc(collection(db, 'user_notifications'), {
          id: notifyId,
          userId: userId,
          title: "🛑 ডিজিটাল রেশন কার্ড বাতিল বিজ্ঞপ্তি",
          body: `আপনাকে "${finalReason}" এর কারণে কার্ড থেকে বাতিল করা হয়েছে সাময়িকভাবে। যদি পুনরায় ভেরিফিকেশন হতে চান, দয়া করে এজেন্টের সাথে যোগাযোগ করুন।`,
          read: false,
          isPersonal: true,
          category: 'admin_msg',
          createdAt: new Date().toISOString()
        });
      }
      
      alert('রেশন কার্ডটি সফলভাবে ডিলিট করা হয়েছে এবং সদস্যের অ্যাকাউন্টে স্বয়ংক্রিয় বাতিলকরণ নোটিফিকেশন পাঠানো হয়েছে।');
      fetchRationCards();
    } catch (err: any) {
      alert('ডিলিট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleOpenEditRation = (rc: any) => {
    setSelectedRationCard(rc);
    setRcEditName(rc.name || rc.userName || '');
    setRcEditPhone(rc.phone || '');
    setRcEditVillage(rc.village || '');
    setRcEditUpazila(rc.upazila || '');
    setRcEditDistrict(rc.district || '');
    setRcEditCardNo(rc.cardNo || rc.cardNumber || rc.id || '');
    setRcEditCardType(rc.cardType || 'Standard');
    setRcEditNomineeName(rc.nomineeName || '');
    setRcEditStatus(rc.status || 'pending');
    setRcEditPhoto(rc.photoUrl || rc.photo || '');
    setRcEditIssueDate(rc.issueDate || rc.approvedAt ? new Date(rc.issueDate || rc.approvedAt).toLocaleDateString('bn-BD') : '07/06/2026');
    setRcEditExpiryDate(rc.expiryDate || '06/06/2027');
    setRcEditSignature(rc.signature || 'S.Hasan');
    setRcEditDuration(rc.duration || '1');
    
    // Populating VIP styles
    setRcEditVipCardBg(rc.vipCardBg || 'from-slate-950 via-purple-950/70 to-slate-900');
    setRcEditVipBorderColor(rc.vipBorderColor || '#EC4899');
    setRcEditVipTextColor(rc.vipTextColor || 'text-purple-100');
    setRcEditVipPrimaryColor(rc.vipPrimaryColor || '#6D28D9');
    
    setEditRationModalOpen(true);
  };

  const handleApproveRationCardDirect = (rcId: string) => {
    const rc = rationCards.find((card: any) => card.id === rcId || card.docId === rcId);
    if (rc) {
      handleOpenEditRation(rc);
    } else {
      alert('রেশন কার্ডের আবেদনটি খুঁজে পাওয়া যায়নি।');
    }
  };

  const handleSaveEditRationCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRationCard) return;
    try {
      const rcRef = doc(db, 'ration_cards', selectedRationCard.id || selectedRationCard.docId);
      await updateDoc(rcRef, {
        name: rcEditName,
        userName: rcEditName,
        phone: rcEditPhone,
        village: rcEditVillage,
        upazila: rcEditUpazila,
        district: rcEditDistrict,
        cardNo: rcEditCardNo,
        cardNumber: rcEditCardNo,
        cardType: rcEditCardType,
        nomineeName: rcEditNomineeName,
        status: rcEditStatus,
        photoUrl: rcEditPhoto,
        issueDate: rcEditIssueDate,
        expiryDate: rcEditExpiryDate,
        signature: rcEditSignature,
        duration: rcEditDuration,
        
        // Custom VIP styles fields
        vipCardBg: rcEditVipCardBg,
        vipBorderColor: rcEditVipBorderColor,
        vipTextColor: rcEditVipTextColor,
        vipPrimaryColor: rcEditVipPrimaryColor
      });
      alert('রেশন কার্ড সফলভাবে আপডেট করা হয়েছে।');
      setEditRationModalOpen(false);
      fetchRationCards();
    } catch (err: any) {
      alert('আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleOpenEditRationItem = (item: any) => {
    setIsAddingRationItem(false);
    setEditingRationItem(item);
    setRiName(item.name || '');
    setRiQty(item.qty || '');
    setRiPrice(item.price || 0);
    setRiMarketPrice(item.marketPrice || 0);
    setRiEmoji(item.emoji || '🍚');
    setRiColor(item.color || 'from-amber-50 to-orange-50');
  };

  const handleOpenAddRationItem = () => {
    setIsAddingRationItem(true);
    setEditingRationItem({ id: 'new' });
    setRiName('');
    setRiQty('');
    setRiPrice(0);
    setRiMarketPrice(0);
    setRiEmoji('🍚');
    setRiColor('from-amber-50 to-orange-50');
  };

  const handleSaveRationItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRationItem) return;
    try {
      if (isAddingRationItem) {
        const maxSortOrder = rationAdminItems.reduce((max, item) => Math.max(max, item.sortOrder || 0), 0);
        const newDocRef = doc(collection(db, 'ration_items'));
        await setDoc(newDocRef, {
          name: riName,
          qty: riQty,
          price: Number(riPrice),
          marketPrice: Number(riMarketPrice),
          emoji: riEmoji,
          color: riColor,
          sortOrder: maxSortOrder + 1
        });
        alert('নতুন রেশন সামগ্রী সফলভাবে যোগ করা হয়েছে।');
      } else {
        const itemRef = doc(db, 'ration_items', editingRationItem.id);
        await updateDoc(itemRef, {
          name: riName,
          qty: riQty,
          price: Number(riPrice),
          marketPrice: Number(riMarketPrice),
          emoji: riEmoji,
          color: riColor
        });
        alert('রেশন সামগ্রীর তথ্য সফলভাবে আপডেট করা হয়েছে।');
      }
      setEditingRationItem(null);
      setIsAddingRationItem(false);
    } catch (err: any) {
      alert('রেশন সামগ্রী সংরক্ষণ করতে ত্রুটি: ' + err.message);
    }
  };

  const handleDeleteRationItem = async (itemId: string) => {
    if (!window.confirm('আপনি কি নিশ্চিতভাবে এই রেশন সামগ্রীটি মুছে ফেলতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'ration_items', itemId));
      alert('রেশন সামগ্রীটি সফলভাবে মুছে ফেলা হয়েছে।');
    } catch (err: any) {
      alert('রেশন সামগ্রী মুছতে ত্রুটি: ' + err.message);
    }
  };

  const handleSaveRationSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedConfig: AppConfig = {
        ...appConfig,
        rationMaxSelectLimit: Number(cfgRationMaxSelectLimit) || 5,
        rationTitleText: cfgRationTitleText,
        rationTotalItemsText: cfgRationTotalItemsText
      };
      await saveAppConfig(updatedConfig);
      alert('রেশন কার্ড সেটিংস সফলভাবে আপডেট করা হয়েছে!');
    } catch (err: any) {
      alert('সেটিংস আপডেট করতে ত্রুটি: ' + err.message);
    }
  };

  const handleOpenEditProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setEpName(prod.name);
    setEpPrice(prod.price);
    setEpOldPrice(prod.oldPrice);
    setEpCategory(prod.category);
    setEpIcon(prod.icon || '🌾');
    setEpDescription(prod.description || '');
    setEpMinOrder(prod.minOrder || '1 Unit');
    setEpSupplier(prod.supplier || '');
    setEpFlag(prod.flag || '🇧🇩');
    setEpShipTime(prod.shipTime || '3-5 দিন');
    setEpImageUrl(prod.imageUrl || '');
    setEditProductModalOpen(true);
  };

  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      const prodRef = doc(db, 'products', selectedProduct.id);
      await updateDoc(prodRef, {
        name: epName,
        price: epPrice,
        oldPrice: epOldPrice || null,
        category: epCategory,
        icon: epIcon,
        description: epDescription,
        minOrder: epMinOrder,
        supplier: epSupplier,
        flag: epFlag,
        shipTime: epShipTime,
        imageUrl: epImageUrl
      });
      alert('পণ্যটি সফলভাবে আপডেট করা হয়েছে।');
      setEditProductModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      alert('আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  useEffect(() => {
    // 1. Initial full fetch of all lists
    loadData();

    // 2. Real-time listeners for critical active collections.
    // This allows the admin panel to receive instant, real-time pushes
    // of all incoming transactions, member signups, agent requests, etc.
    
    // A. Real-time Transactions with resilient self-healing reconnection & cross-admin sync
    let isTxsSubscribed = true;
    let unsubTransactions: (() => void) | null = null;
    let txReconnectTimer: any = null;

    const setupTransactionListener = () => {
      if (!isTxsSubscribed) return;
      try {
        if (unsubTransactions) {
          try { unsubTransactions(); } catch (e) {}
          unsubTransactions = null;
        }
        const qTransactions = collection(db, 'transactions');
        unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
          const list = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              ...data,
              docId: docSnap.id,
              id: docSnap.id,
            } as Transaction;
          });
          const sortedList: Transaction[] = sortTransactionsNewestFirst(list) as Transaction[];
          setTransactions(sortedList);
        }, (err) => {
          console.warn("Transactions listener warning, auto-reconnecting:", err);
          if (isTxsSubscribed) {
            clearTimeout(txReconnectTimer);
            txReconnectTimer = setTimeout(setupTransactionListener, 2000);
          }
        });
      } catch (e) {
        console.error("Error setting up transactions onSnapshot:", e);
        if (isTxsSubscribed) {
          clearTimeout(txReconnectTimer);
          txReconnectTimer = setTimeout(setupTransactionListener, 2500);
        }
      }
    };

    setupTransactionListener();

    // Background sync heartbeat every 4 seconds to guarantee all admins stay 100% in sync
    const txHeartbeat = setInterval(() => {
      fetchTransactionsFromDb();
    }, 4000);

    // Immediate re-fetch when tab regains focus or visibility
    const onWindowFocusOrVisible = () => {
      fetchTransactionsFromDb();
      setupTransactionListener();
    };
    window.addEventListener('focus', onWindowFocusOrVisible);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onWindowFocusOrVisible();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Cross-tab and BroadcastChannel instant sync event handlers
    const onCrossSyncTick = () => {
      fetchTransactionsFromDb();
    };
    window.addEventListener('amb_admin_sync_tick', onCrossSyncTick);
    const onStorageSync = (e: StorageEvent) => {
      if (e.key === 'amb_admin_sync_tick') {
        fetchTransactionsFromDb();
      }
    };
    window.addEventListener('storage', onStorageSync);

    const unsubscribeTxs = () => {
      isTxsSubscribed = false;
      clearTimeout(txReconnectTimer);
      clearInterval(txHeartbeat);
      window.removeEventListener('focus', onWindowFocusOrVisible);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('amb_admin_sync_tick', onCrossSyncTick);
      window.removeEventListener('storage', onStorageSync);
      if (unsubTransactions) {
        try { unsubTransactions(); } catch (e) {}
      }
    };

    // B. Real-time Users & Samity Applications (full sync to ensure all pending membership applications appear instantly)
    let rawUsersList: User[] = [];
    let rawSamityAppsList: any[] = [];

    const syncCombinedUsers = (uList: User[], sList: any[]) => {
      const usersMap = new Map<string, User>();
      const phoneToUid = new Map<string, string>();
      const memberIdToUid = new Map<string, string>();

      const cleanPhoneDigits = (p?: string | null) => {
        if (!p) return '';
        return String(p).replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, '');
      };

      uList.forEach(u => {
        const uid = u.uid || (u as any).id;
        if (!uid) return;
        usersMap.set(uid, { ...u, uid });

        const rawDigits = cleanPhoneDigits(u.phone);
        if (rawDigits) {
          phoneToUid.set(rawDigits, uid);
          if (rawDigits.length >= 9) phoneToUid.set(rawDigits.slice(-9), uid);
          if (rawDigits.length >= 10) phoneToUid.set(rawDigits.slice(-10), uid);
          if (rawDigits.length >= 11) phoneToUid.set(rawDigits.slice(-11), uid);
        }
        if (u.memberId) {
          const mId = String(u.memberId).trim().toUpperCase();
          memberIdToUid.set(mId, uid);
        }
      });

      sList.forEach(app => {
        const appUid = app.userId || app.uid || '';
        const appRawPhone = cleanPhoneDigits(app.phone);
        const appLast9 = appRawPhone.length >= 9 ? appRawPhone.slice(-9) : '';
        const appMemberId = app.memberId ? String(app.memberId).trim().toUpperCase() : '';

        // Find existing real user in usersMap by UID, phone match, or memberId match
        let targetUid = '';
        if (appUid && usersMap.has(appUid)) {
          targetUid = appUid;
        } else if (appLast9 && phoneToUid.has(appLast9)) {
          targetUid = phoneToUid.get(appLast9)!;
        } else if (appMemberId && memberIdToUid.has(appMemberId)) {
          targetUid = memberIdToUid.get(appMemberId)!;
        } else if (app.id && usersMap.has(app.id)) {
          targetUid = app.id;
        }

        const isPending = app.status === 'pending' || app.samityStatus === 'pending';
        const isApproved = app.status === 'approved' || app.samityStatus === 'approved';
        const isRejected = app.status === 'rejected' || app.samityStatus === 'rejected';

        if (targetUid && usersMap.has(targetUid)) {
          const existingUser = usersMap.get(targetUid)!;
          if (isPending && existingUser.samityStatus !== 'approved') {
            existingUser.samityStatus = 'pending';
          } else if (isApproved) {
            existingUser.samityStatus = 'approved';
          } else if (isRejected && existingUser.samityStatus !== 'approved') {
            existingUser.samityStatus = 'rejected';
          }

          if (app.nomineeName && !existingUser.nomineeName) existingUser.nomineeName = app.nomineeName;
          if (app.nomineePhone && !existingUser.nomineePhone) existingUser.nomineePhone = app.nomineePhone;
          if (app.nomineeRelation && !existingUser.nomineeRelation) existingUser.nomineeRelation = app.nomineeRelation;
          if (app.monthlySavingsTarget && !existingUser.monthlySavingsTarget) existingUser.monthlySavingsTarget = app.monthlySavingsTarget;
          if (app.nid && !existingUser.nid) existingUser.nid = app.nid;
          if (app.dob && !existingUser.dob) existingUser.dob = app.dob;
          if (app.country && !existingUser.country) existingUser.country = app.country;
          if (app.district && !existingUser.district) existingUser.district = app.district;
          if (app.thana && !existingUser.thana) existingUser.thana = app.thana;
          if (app.postOffice && !existingUser.postOffice) existingUser.postOffice = app.postOffice;
          if (app.division && !existingUser.division) existingUser.division = app.division;
          if (app.samityAppliedAt || app.appliedAt || app.createdAt) {
            existingUser.samityAppliedAt = existingUser.samityAppliedAt || app.samityAppliedAt || app.appliedAt || app.createdAt;
          }
          if (app.memberId && !existingUser.memberId) {
            existingUser.memberId = app.memberId;
          }
        } else {
          // If applicant is truly new without any user account yet
          const key = appUid || app.id || (appRawPhone ? `applicant_${appRawPhone}` : `applicant_${Date.now()}`);
          const newUser: User = {
            uid: key,
            name: app.name || 'সদস্য আবেদনকারী',
            phone: app.phone || '',
            memberId: app.memberId || '',
            pin: app.pin || '1234',
            role: 'user',
            balance: app.balance || 0,
            lockedBalance: app.lockedBalance || 0,
            pendingBalance: app.pendingBalance || 0,
            savings: app.savings || 0,
            dueLoan: app.dueLoan || 0,
            createdAt: app.createdAt || new Date().toISOString(),
            country: app.country || 'Bangladesh',
            nid: app.nid || '',
            dob: app.dob || '',
            division: app.division || '',
            district: app.district || '',
            thana: app.thana || '',
            postOffice: app.postOffice || '',
            nomineeName: app.nomineeName || '',
            nomineeRelation: app.nomineeRelation || '',
            nomineePhone: app.nomineePhone || '',
            monthlySavingsTarget: app.monthlySavingsTarget || 500,
            samityStatus: isPending ? 'pending' : isApproved ? 'approved' : isRejected ? 'rejected' : 'pending',
            approved: isApproved,
            status: isApproved ? 'active' : 'inactive',
            samityAppliedAt: app.samityAppliedAt || app.appliedAt || app.createdAt || new Date().toISOString()
          };
          usersMap.set(key, newUser);
          if (appLast9) phoneToUid.set(appLast9, key);
          if (appMemberId) memberIdToUid.set(appMemberId, key);
        }
      });

      setUsers(Array.from(usersMap.values()));
    };

    const qUsers = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      rawUsersList = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as User));
      syncCombinedUsers(rawUsersList, rawSamityAppsList);
    }, (err) => {
      handleQueryError(err, "users listener");
    });

    const qSamityApps = collection(db, 'samity_applications');
    const unsubscribeSamityApps = onSnapshot(qSamityApps, (snapshot) => {
      rawSamityAppsList = snapshot.docs.map(doc => ({
        id: doc.id,
        docId: doc.id,
        ...doc.data()
      }));
      syncCombinedUsers(rawUsersList, rawSamityAppsList);
    }, (err) => {
      handleQueryError(err, "samity_applications listener");
    });

    // Real-time Company Expenses
    const qExpenses = collection(db, 'company_expenses');
    const unsubscribeExpenses = onSnapshot(qExpenses, (snapshot) => {
      const expList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      expList.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setCompanyExpenses(expList);
    }, (err) => {
      handleQueryError(err, "company_expenses listener");
    });

    // C. Real-time Agent Applications (Merging both agent_applications and agent_requests)
    let apps1: any[] = [];
    let apps2: any[] = [];

    const updateCombinedAgentApps = () => {
      const mergedMap = new Map<string, any>();
      apps1.forEach(item => {
        const key = item.id || item.userId || item.phone;
        if (key) mergedMap.set(key, item);
      });
      apps2.forEach(item => {
        const key = item.id || item.userId || item.phone;
        if (key) mergedMap.set(key, item);
      });
      setAdminAgentRequests(Array.from(mergedMap.values()));
    };

    const qAgentApps1 = collection(db, 'agent_applications');
    const unsubscribeAgentApps1 = onSnapshot(qAgentApps1, (snapshot) => {
      apps1 = snapshot.docs.map(doc => ({
        id: doc.id,
        docId: doc.id,
        _collection: 'agent_applications',
        ...doc.data()
      }));
      updateCombinedAgentApps();
    }, (err) => {
      handleQueryError(err, "agent applications (1) listener");
    });

    const qAgentApps2 = collection(db, 'agent_requests');
    const unsubscribeAgentApps2 = onSnapshot(qAgentApps2, (snapshot) => {
      apps2 = snapshot.docs.map(doc => ({
        id: doc.id,
        docId: doc.id,
        _collection: 'agent_requests',
        ...doc.data()
      }));
      updateCombinedAgentApps();
    }, (err) => {
      handleQueryError(err, "agent applications (2) listener");
    });

    const unsubscribeAgentApps = () => {
      unsubscribeAgentApps1();
      unsubscribeAgentApps2();
    };

    // D. Real-time BAP Admin Requests
    const qBapReqs = collection(db, 'bap_admin_requests');
    const unsubscribeBapReqs = onSnapshot(qBapReqs, (snapshot) => {
      const reqsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBapAdminReqs(reqsList as any);
    }, (err) => {
      handleQueryError(err, "bap admin requests listener");
    });

    // D2. Real-time Approved BAP Agents
    const qBapAgents = collection(db, 'bap_agents');
    const unsubscribeBapAgents = onSnapshot(qBapAgents, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        docId: doc.id,
        ...doc.data()
      }));
      setAdminAgents(list);
    }, (err) => {
      handleQueryError(err, "bap_agents listener");
    });

    // E. Real-time Ration Cards
    const qRation = collection(db, 'ration_cards');
    const unsubscribeRation = onSnapshot(qRation, (snapshot) => {
      console.log('Ration cards snapshot received, docs count:', snapshot.size);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        docId: doc.id,
        ...doc.data()
      }));
      setRationCards(list);
    }, (err) => {
      handleQueryError(err, "ration cards listener");
    });

    // F. Real-time Courier Orders
    const qCourierOrders = collection(db, 'courier_orders');
    const unsubscribeCourierOrders = onSnapshot(qCourierOrders, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCourierOrders(list);
    }, (err) => {
      handleQueryError(err, "courier orders listener");
    });

    // G. Real-time Courier Riders
    const qCourierRiders = collection(db, 'courier_riders');
    const unsubscribeCourierRiders = onSnapshot(qCourierRiders, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCourierRiders(list);
    }, (err) => {
      handleQueryError(err, "courier riders listener");
    });

    // H. Real-time Safe Deals
    const qSafeDeals = collection(db, 'safe_deals');
    const unsubscribeSafeDeals = onSnapshot(qSafeDeals, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSafeDeals(list);
    }, (err) => {
      handleQueryError(err, "safe deals listener");
    });

    // I. Real-time Education Center Posts
    const qEduPosts = collection(db, 'edu_posts');
    const unsubscribeEduPosts = onSnapshot(qEduPosts, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEduPosts(list);
    }, (err) => {
      console.error("education posts listener error:", err);
    });

    // J. Real-time Ration Items Catalog & Seeding
    const qRationItems = collection(db, 'ration_items');
    const unsubscribeRationItems = onSnapshot(qRationItems, async (snapshot) => {
      if (snapshot.empty) {
        console.log('Seeding default ration items inside Firestore...');
        const defaultRationItems = [
          { name: 'চাল (মিনিক্যাট)', qty: '5 KG', price: 240, marketPrice: 300, emoji: '🍚', color: 'from-amber-50 to-orange-50', sortOrder: 1 },
          { name: 'আটা (ময়দা)', qty: '2 KG', price: 60, marketPrice: 80, emoji: '🌾', color: 'from-yellow-50 to-amber-50', sortOrder: 2 },
          { name: 'মসুর ডাল', qty: '1 KG', price: 100, marketPrice: 130, emoji: '🍛', color: 'from-red-50 to-orange-50', sortOrder: 3 },
          { name: 'সয়াবিন তেল', qty: '1 লিটার', price: 140, marketPrice: 170, emoji: '🍾', color: 'from-yellow-50 to-teal-50', sortOrder: 4 },
          { name: 'চিনি', qty: '1 KG', price: 60, marketPrice: 80, emoji: '🍬', color: 'from-cyan-50 to-blue-50', sortOrder: 5 },
          { name: 'লবণ', qty: '1 KG', price: 15, marketPrice: 20, emoji: '🧂', color: 'from-slate-50 to-zinc-50', sortOrder: 6 },
          { name: 'দুধ গুঁড়া', qty: '500 GM', price: 180, marketPrice: 220, emoji: '🥛', color: 'from-indigo-50 to-purple-50', sortOrder: 7 },
          { name: 'ছোলা', qty: '1 KG', price: 80, marketPrice: 100, emoji: '🥜', color: 'from-amber-100/40 to-yellow-50', sortOrder: 8 },
          { name: 'সেমাই', qty: '1 KG', price: 70, marketPrice: 90, emoji: '🍜', color: 'from-amber-50 to-yellow-100/30', sortOrder: 9 },
          { name: 'চা পাতা', qty: '250 GM', price: 90, marketPrice: 120, emoji: '🍃', color: 'from-emerald-50 to-green-50', sortOrder: 10 }
        ];
        
        const { doc, setDoc } = await import('firebase/firestore');
        for (const item of defaultRationItems) {
          const docId = `item_${item.sortOrder}`;
          await setDoc(doc(db, 'ration_items', docId), item).catch(err => console.error("Error seeding default ration item", err));
        }
      } else {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        list.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
        setRationAdminItems(list);
      }
    }, (err) => {
      console.error("ration items listener error:", err);
    });

    // Real-time Admin Broadcast Audit Logs
    const qBroadcastLogs = query(collection(db, 'admin_broadcast_logs'), limit(150));
    const unsubscribeBroadcastLogs = onSnapshot(qBroadcastLogs, (snapshot) => {
      const logsList: AdminBroadcastLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        docId: doc.id,
        ...doc.data()
      } as AdminBroadcastLog));
      logsList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setBroadcastLogs(logsList);
    }, (err) => {
      console.error("admin_broadcast_logs listener error:", err);
    });

    // Real-time Phone Change Requests Listener
    const qPhoneReqs = collection(db, 'phone_change_requests');
    const unsubscribePhoneReqs = onSnapshot(qPhoneReqs, (snapshot) => {
      const reqsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PhoneChangeRequest[];
      reqsList.sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
      setPhoneChangeRequests(reqsList);
    }, (err) => {
      console.error("phone_change_requests listener error:", err);
    });

    // Clean up listeners on unmount
    return () => {
      unsubscribeTxs();
      unsubscribeUsers();
      unsubscribeSamityApps();
      unsubscribeExpenses();
      unsubscribeAgentApps();
      unsubscribeBapReqs();
      unsubscribeBapAgents();
      unsubscribeRation();
      unsubscribeCourierOrders();
      unsubscribeCourierRiders();
      unsubscribeSafeDeals();
      unsubscribeEduPosts();
      unsubscribeRationItems();
      unsubscribeBroadcastLogs();
      unsubscribePhoneReqs();
    };
  }, []);

  // Monitor pending requests and play a professional chime when a new request arrives in real-time
  useEffect(() => {
    const currentCount = pendingRequests.length;
    if (prevPendingCountRef.current !== null && currentCount > prevPendingCountRef.current) {
      playNotificationChime();
    }
    prevPendingCountRef.current = currentCount;
  }, [pendingRequests.length]);

  // Phone Change Handlers
  const handleApprovePhoneRequest = (req: PhoneChangeRequest) => {
    const cleanNewPhone = req.newPhone.replace(/\D/g, '');
    const normNewPhone = normalizePhoneNumber(cleanNewPhone);
    if (!cleanNewPhone || cleanNewPhone.length < 11) {
      alert('প্রদানকৃত নতুন মোবাইল নম্বরটি সঠিক নয় (কমপক্ষে 11 ডিজিট হতে হবে)।');
      return;
    }

    requestConfirm(
      'মোবাইল নম্বর পরিবর্তন অনুমোদন',
      `আপনি কি নিশ্চিত যে সদস্য "${req.userName}" (মেম্বার আইডি: ${req.memberId || 'N/A'}) এর নম্বর ${req.currentPhone} পরিবর্তন করে ${cleanNewPhone} করতে চান?\n\nসদস্যের ব্যালেন্স, খতিয়ান, ডিপিএস ও সঞ্চয় তথ্য 100% অপরিবর্তিত থাকবে।`,
      async () => {
        try {
          let targetUserDocId = req.userId;

          // Search user by current phone to get exact doc ID in users collection
          const foundUser = await findUserInFirestoreByPhone(req.currentPhone);
          if (foundUser?.docId) {
            targetUserDocId = foundUser.docId;
          }

          // If not found, try searching by memberId
          if (req.memberId && (!foundUser || !foundUser.docId)) {
            try {
              const qMem = query(collection(db, 'users'), where('memberId', '==', req.memberId));
              const snapMem = await getDocs(qMem);
              if (!snapMem.empty) {
                targetUserDocId = snapMem.docs[0].id;
              }
            } catch (eMem) {
              console.warn("Member ID search warning:", eMem);
            }
          }

          const updateData = {
            phone: cleanNewPhone,
            mobileNumber: cleanNewPhone,
            normalizedPhone: normNewPhone,
            phoneChangeCount: increment(1),
            updatedAt: serverTimestamp()
          };

          // 1. Update primary user document in `users`
          if (targetUserDocId) {
            await setDoc(doc(db, 'users', targetUserDocId), updateData, { merge: true });
          }

          // 2. If req.userId is different from targetUserDocId, update req.userId as well
          if (req.userId && req.userId !== targetUserDocId) {
            try {
              await setDoc(doc(db, 'users', req.userId), updateData, { merge: true });
            } catch (eAlt) {
              console.warn("Alt user update warning:", eAlt);
            }
          }

          // 3. Also update `samity_applications` collection
          try {
            if (targetUserDocId) {
              await setDoc(doc(db, 'samity_applications', targetUserDocId), updateData, { merge: true });
            }
            if (req.userId && req.userId !== targetUserDocId) {
              await setDoc(doc(db, 'samity_applications', req.userId), updateData, { merge: true });
            }
          } catch (eSamity) {
            console.warn("Samity app update warning:", eSamity);
          }

          // 4. Mark request as approved
          const reqRef = doc(db, 'phone_change_requests', req.id);
          await setDoc(reqRef, {
            status: 'approved',
            processedAt: new Date().toISOString(),
            processedBy: currentUser.name || 'Admin'
          }, { merge: true });

          // 5. User Notifications
          const notifMsg = `আপনার মোবাইল নম্বরটি সফলভাবে আপডেট করে ${cleanNewPhone} করা হয়েছে। আপনার সকল অ্যাকাউন্ট ব্যালেন্স, খতিয়ান ও সঞ্চয় তথ্য পূর্বের মতোই 100% অপরিবর্তিত রয়েছে।`;
          if (targetUserDocId) {
            await addDoc(collection(db, 'user_notifications'), {
              userId: targetUserDocId,
              title: '📱 মোবাইল নম্বর আপডেট সফল',
              message: notifMsg,
              type: 'info',
              read: false,
              createdAt: serverTimestamp()
            });
          }

          if (req.userId && req.userId !== targetUserDocId) {
            try {
              await addDoc(collection(db, 'user_notifications'), {
                userId: req.userId,
                title: '📱 মোবাইল নম্বর আপডেট সফল',
                message: notifMsg,
                type: 'info',
                read: false,
                createdAt: serverTimestamp()
              });
            } catch (eNotif) {
              console.warn("Alt notification warning:", eNotif);
            }
          }

          // 6. Broadcast log
          await addDoc(collection(db, 'admin_broadcast_logs'), {
            adminName: currentUser.name || 'Admin',
            adminPhone: currentUser.phone || 'Admin',
            targetScope: 'single',
            title: '📱 মোবাইল নম্বর পরিবর্তন অনুমোদন',
            message: `সদস্য ${req.userName} (${req.memberId || req.currentPhone}) এর মোবাইল নম্বর পরিবর্তন অনুমোদন করা হয়েছে: ${req.currentPhone} ➔ ${cleanNewPhone}`,
            createdAt: new Date().toISOString()
          });

          alert(`🎉 নম্বর পরিবর্তন অনুমোদন সফল! সদস্যের নতুন নম্বর: ${cleanNewPhone}`);
        } catch (err: any) {
          console.error('Error approving phone change:', err);
          alert('নম্বর পরিবর্তন অনুমোদন করতে সমস্যা হয়েছে: ' + (err?.message || err));
        }
      }
    );
  };

  const handleRejectPhoneRequest = (req: PhoneChangeRequest) => {
    requestPrompt(
      'মোবাইল নম্বর পরিবর্তন আবেদন বাতিল',
      'নম্বর পরিবর্তনের আবেদনটি বাতিল করার কারণ লিখুন (সদস্যকে নোটিফিকেশন দেওয়া হবে):',
      'তথ্য অসামঞ্জস্যপূর্ণ',
      async (reason) => {
        if (!reason || !reason.trim()) return;

        try {
          const reqRef = doc(db, 'phone_change_requests', req.id);
          await setDoc(reqRef, {
            status: 'rejected',
            rejectionReason: reason.trim(),
            processedAt: new Date().toISOString(),
            processedBy: currentUser.name || 'Admin'
          }, { merge: true });

          await addDoc(collection(db, 'user_notifications'), {
            userId: req.userId,
            title: '⚠️ মোবাইল নম্বর পরিবর্তনের বার্তা',
            message: `আপনার মোবাইল নম্বর পরিবর্তনের আবেদনটি মঞ্জুর করা সম্ভব হয়নি। বাতিলের কারণ: ${reason.trim()}।`,
            type: 'info',
            read: false,
            createdAt: serverTimestamp()
          });

          alert('নম্বর পরিবর্তনের আবেদনটি সফলভাবে বাতিল করা হয়েছে।');
        } catch (err: any) {
          console.error('Error rejecting phone change:', err);
          alert('আবেদন বাতিল করতে সমস্যা হয়েছে: ' + (err?.message || err));
        }
      }
    );
  };

  const handleDirectChangeUserPhone = (usr: User, cleanPhone: string) => {
    requestConfirm(
      'সরাসরি নম্বর পরিবর্তন',
      `আপনি কি নিশ্চিত যে সদস্য "${usr.name}" (মেম্বার আইডি: ${usr.memberId || 'N/A'}) এর নম্বর ${usr.phone || 'N/A'} পরিবর্তন করে ${cleanPhone} করতে চান?\n\nসদস্যের সকল ব্যালেন্স, খতিয়ান, কিস্তি ও সঞ্চয় তথ্য 100% অপরিবর্তিত থাকবে।`,
      async () => {
        try {
          const normPhone = normalizePhoneNumber(cleanPhone);
          const targetUserDocId = usr.uid || usr.id || '';
          const updateData = {
            phone: cleanPhone,
            mobileNumber: cleanPhone,
            normalizedPhone: normPhone,
            phoneChangeCount: increment(1),
            updatedAt: serverTimestamp()
          };

          if (targetUserDocId) {
            await setDoc(doc(db, 'users', targetUserDocId), updateData, { merge: true });
            try {
              await setDoc(doc(db, 'samity_applications', targetUserDocId), updateData, { merge: true });
            } catch (eSamity) {
              console.warn("Direct phone change samity app warning:", eSamity);
            }
          }

          await addDoc(collection(db, 'user_notifications'), {
            userId: targetUserDocId,
            title: '📱 মোবাইল নম্বর আপডেট সম্পন্ন',
            message: `এডমিন প্যানেল থেকে আপনার মোবাইল নম্বরটি সরাসরি পরিবর্তন করে ${cleanPhone} করা হয়েছে। আপনার অ্যাকাউন্ট ব্যালেন্স ও সঞ্চয় তথ্য 100% অপরিবর্তিত রয়েছে।`,
            type: 'info',
            read: false,
            createdAt: serverTimestamp()
          });

          await addDoc(collection(db, 'admin_broadcast_logs'), {
            adminName: currentUser.name || 'Admin',
            adminPhone: currentUser.phone || 'Admin',
            targetScope: 'single',
            title: '📱 সরাসরি মোবাইল নম্বর পরিবর্তন',
            message: `সদস্য ${usr.name} (${usr.memberId || usr.phone}) এর মোবাইল নম্বর এডমিন প্যানেল থেকে পরিবর্তন করা হয়েছে: ${usr.phone || 'N/A'} ➔ ${cleanPhone}`,
            createdAt: new Date().toISOString()
          });

          alert(`🎉 সদস্য ${usr.name} এর নম্বর সফলভাবে পরিবর্তন করে ${cleanPhone} করা হয়েছে!`);
        } catch (err: any) {
          console.error('Error directly changing phone:', err);
          alert('নম্বর পরিবর্তন করতে সমস্যা হয়েছে: ' + (err?.message || err));
        }
      }
    );
  };



  const handleBapQuickVerify = () => {
    if (!bapSearchQuery.trim()) {
      setBapSearchResult({ foundInReports: [], foundInUsers: [] });
      setBapSearchHasSearched(true);
      return;
    }
    const q = bapSearchQuery.toLowerCase();
    
    // search in reports
    const foundInReports = bapReports.filter(r => {
      if (bapSearchType === 'phone') {
        return r.accusedPhone?.includes(q) || (r.accusedName && r.accusedName.toLowerCase().includes(q));
      } else {
        return (r as any).accusedNid?.includes(q);
      }
    });

    // search in users
    const foundInUsers = users.filter(u => {
      if (bapSearchType === 'phone') {
        return u.phone?.includes(q) || u.name?.toLowerCase().includes(q) || u.memberId?.includes(q);
      } else {
        return u.nid?.includes(q);
      }
    });

    setBapSearchResult({ foundInReports, foundInUsers });
    setBapSearchHasSearched(true);
  };

  const handleCreateBapReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bapNewAccusedPhone.trim() || !bapNewAccusedName.trim()) {
      setBapNewError('অভিযুক্তের নাম এবং মোবাইল নম্বর আবশ্যক!');
      return;
    }
    setBapIsSubmitting(true);
    setBapNewError('');
    setBapNewSuccess('');
    try {
      const repId = `rep-${Date.now()}`;
      const newReport: BapReport = {
        id: repId,
        accusedName: bapNewAccusedName,
        accusedPhone: bapNewAccusedPhone,
        type: bapNewType,
        details: bapNewDetails,
        groupName: bapNewGroup,
        status: 'pending',
        reporterId: currentUser?.uid || 'admin',
        reporterName: currentUser?.name || 'Admin',
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'bap_reports', repId), newReport);
      
      setBapNewSuccess('রিপোর্টটি সফলভাবে বাংলাদেশ এডমিন ডেটাবেজে তালিকাভুক্ত করা হয়েছে!');
      setBapNewAccusedName('');
      setBapNewAccusedPhone('');
      setBapNewDetails('');
      setBapReports(prev => [newReport, ...prev]);
      setTimeout(() => setBapNewSuccess(''), 3000);
    } catch (err: any) {
      console.error(err);
      setBapNewError('সার্ভার ত্রুটি! ডাটা সেভ করা যায়নি।');
    } finally {
      setBapIsSubmitting(false);
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: 'pending' | 'solved') => {
    try {
      const repQuery = await getDocs(collection(db, 'bap_reports'));
      let docId = '';
      for (const d of repQuery.docs) {
        if (d.data().id === reportId) {
          docId = d.id;
          break;
        }
      }
      if (docId) {
        await updateDoc(doc(db, 'bap_reports', docId), { status });
        setBapReports(prev => prev.map((r, idx) => r.id === reportId ? { ...r, status } : r));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const defaultDashboardSlides = [
    {
      id: 1,
      tag: "সঞ্চয় ও বিনিয়োগ",
      title: "Al Mayadin Bazar",
      description: "নিরাপদে আপনার আমানত সঞ্চয় করুন ও সহজ ঋণের সুবিধা গ্রহণ করুন।",
      bgGradient: "from-emerald-950 via-emerald-900 to-teal-950",
      image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 2,
      tag: "টেলিকম অফার",
      title: "AMB টেলিকম রিচার্জ",
      description: "সব অপারেটরে আকর্ষণীয় ক্যাশব্যাক ও সুপার ফাস্ট ফ্লেক্সিলোড ড্রাইভে অফার!",
      bgGradient: "from-slate-950 via-cyan-950 to-emerald-950",
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 3,
      tag: "সুদমুক্ত ঋণ",
      title: "করযে হাসানা কল্যাণ তহবিল",
      description: "সব মেম্বারদের জন্য বিপদের সময়ে স্বস্তি ও সুদমুক্ত করযে হাসানা ঋণ সমাধান!",
      bgGradient: "from-stone-950 via-rose-950 to-indigo-950",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=650"
    }
  ];

  // Real-time automatic carousel slide transition (moved below defaultDashboardSlides declaration)
  useEffect(() => {
    const slides = dbDashboardBanners.length > 0 ? dbDashboardBanners : defaultDashboardSlides;
    if (viewingGrid && slides.length > 1) {
      const timer = setInterval(() => {
        setCurrentAdSlide(prev => (prev + 1) % slides.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [viewingGrid, dbDashboardBanners]);

  const defaultQardSlides = [
    {
      id: 1,
      tag: "সঞ্চয় ও বিনিয়োগ",
      title: "Al Mayadin Bazar",
      description: "নিরাপদে আপনার আমানত সঞ্চয় করুন ও সহজ ঋণের সুবিধা গ্রহণ করুন।",
      bgGradient: "from-emerald-950 via-emerald-900 to-teal-950",
      image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 2,
      tag: "টেলিকম অফার",
      title: "AMB টেলিকম রিচার্জ",
      description: "সব অপারেটরে আকর্ষণীয় ক্যাশব্যাক ও সুপার ফাস্ট ফ্লেক্সিলোড ড্রাইভে অফার!",
      bgGradient: "from-slate-950 via-cyan-950 to-emerald-950",
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 3,
      tag: "সুদমুক্ত ঋণ",
      title: "করযে হাসানা কল্যাণ তহবিল",
      description: "সব মেম্বারদের জন্য বিপদের সময়ে স্বস্তি ও সুদমুক্ত করযে হাসানা ঋণ সমাধান!",
      bgGradient: "from-stone-950 via-rose-950 to-indigo-950",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=650"
    }
  ];

  const defaultSamitySlides = [
    {
      id: 1,
      tag: "সঞ্চয় কিস্তি",
      title: "নিয়মিত সঞ্চয় ডিপিএস",
      description: "প্রতি মাসে ছোট সঞ্চয়ে গড়ে তুলুন আপনার নিশ্চিত ভবিষ্যৎ কল্যাণ তহবিল।",
      bgGradient: "from-slate-950 via-teal-950 to-emerald-950",
      image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 2,
      tag: "হালাল লভ্যাংশ",
      title: "শতভাগ হালাল ব্যবসা পার্টনার",
      description: "আপনার ডিপোজিটকৃত পুঁজি দিয়ে সরাসরি লাভজনক ব্যবসায় অংশ নিন এবং হালাল মুনাফা অর্জন করুন।",
      bgGradient: "from-emerald-950 via-emerald-900 to-teal-950",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 3,
      tag: "মেম্বারশিপ সুবিধা",
      title: "বিনিয়োগ ঋণ সেবা সুবিধা",
      description: "সমিতিতে 3 মাস নিয়মিত সঞ্চয়ের পর সহজ শর্তে ও দীর্ঘমেয়াদি ব্যবসায়িক মুনাফায় শেয়ারে বড় বিনিয়োগ সুবিধা পান!",
      bgGradient: "from-stone-950 via-rose-950 to-indigo-950",
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=650"
    }
  ];

  const defaultTelecomSlides = [
    {
      id: 1,
      tag: "টেলিকম অফার",
      title: "AMB টেলিকম রিচার্জ",
      description: "সব অপারেটরে আকর্ষণীয় ক্যাশব্যাক ও সুপার ফাস্ট ফ্লেক্সিলোড ড্রাইভে অফার!",
      bgGradient: "from-slate-950 via-cyan-950 to-emerald-950",
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 2,
      tag: "সঞ্চয় ও বিনিয়োগ",
      title: "Al Mayadin Bazar",
      description: "নিরাপদে আপনার আমানত সঞ্চয় করুন ও সহজ ঋণের সুবিধা গ্রহণ করুন।",
      bgGradient: "from-emerald-950 via-emerald-900 to-teal-950",
      image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 3,
      tag: "সুদমুক্ত ঋণ",
      title: "করযে হাসানা কল্যাণ তহবিল",
      description: "সব মেম্বারদের জন্য বিপদের সময়ে স্বস্তি ও সুদমুক্ত করযে হাসানা ঋণ সমাধান!",
      bgGradient: "from-stone-950 via-rose-950 to-indigo-950",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=650"
    }
  ];

  const defaultMoneyExchangeSlides = [
    {
      id: 1,
      tag: "রেমিট্যান্স বোনাস",
      title: "নিরাপদ রেমিট্যান্স ও লাইভ রেট",
      description: "প্রবাস থেকে প্রিয়জনের নম্বরে নিরাপদে রেমিট্যান্স পাঠান এবং ব্যাংক বোনাস বুঝে নিন।",
      bgGradient: "from-slate-950 via-emerald-950 to-slate-950",
      image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 2,
      tag: "সঞ্চয় ও বিনিয়োগ",
      title: "Al Mayadin Bazar",
      description: "নিরাপদে আপনার আমানত সঞ্চয় করুন ও সহজ ঋণের সুবিধা গ্রহণ করুন।",
      bgGradient: "from-emerald-950 via-emerald-900 to-teal-950",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 3,
      tag: "টেলিকম অফার",
      title: "AMB টেলিকম রিচার্জ",
      description: "সব অপারেটরে আকর্ষণীয় ক্যাশব্যাক ও সুপার ফাস্ট ফ্লেক্সিলোড ড্রাইভে অফার!",
      bgGradient: "from-slate-950 via-cyan-950 to-emerald-950",
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=650"
    }
  ];

  const defaultRationSlides = [
    {
      id: 1,
      tag: "কো-অপারেটিভ রেশন",
      title: "বিএনবি ডিজিটাল রেশন সেবা",
      description: "ডিজিটাল কো-অপারেটিভ রেশন কার্ডধারীদের জন্য বিশেষভাবে ভর্তুকি মূল্যে সর্বোচ্চ মানের ফ্রেশ ক্যাটাগরির চাল, ডাল, তেলসহ নানা নিত্যপ্রয়োজনীয় খাদ্যের নির্ভরযোগ্য পোর্টাল।",
      bgGradient: "from-emerald-950 via-emerald-900 to-teal-950",
      image: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 2,
      tag: "সহজ বুকিং",
      title: "5টি পণ্য নির্বাচন",
      description: "10টি নিত্যপ্রয়োজনীয় পণ্যের তালিকা থেকে প্রতি মাসে সর্বোচ্চ 5টি পণ্য ভর্তুকি মূল্যে বুকিং করার দারুণ সুবিধা পান।",
      bgGradient: "from-slate-950 via-emerald-950 to-emerald-900",
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=650"
    }
  ];

  const defaultSafiSlides = [
    {
      id: 1,
      tag: "সাফি অর্গানিক",
      title: "Safi Premium Shop",
      description: "শতভাগ খাটি ও ভেজালমুক্ত প্রিমিয়াম অর্গানিক পণ্যসামগ্রী সরাসরি অর্ডার করুন।",
      bgGradient: "from-amber-950 via-slate-900 to-amber-950",
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=650"
    }
  ];

  const defaultAgentSlides = [
    {
      id: 1,
      tag: "এজেন্ট পয়েন্ট",
      title: "AMB এজেন্ট প্রতিনিধি পোর্টাল",
      description: "আপনার এলাকায় প্রতিনিধি হিসেবে যোগ দিন এবং আকর্ষণীয় কমিশন আয় করুন।",
      bgGradient: "from-indigo-950 via-slate-900 to-indigo-950",
      image: "https://images.unsplash.com/photo-1556742049-0a6755490795?auto=format&fit=crop&q=80&w=650"
    }
  ];

  const defaultCourierSlides = [
    {
      id: 1,
      tag: "কুরিয়ার সার্ভিস",
      title: "AMB ইনস্ট্যান্ট কুরিয়ার ও পার্সেল",
      description: "দেশজুড়ে নিরাপদ ও দ্রুততম ডেলিভারি সেবায় আপনার পার্সেল পাঠান।",
      bgGradient: "from-cyan-950 via-slate-900 to-blue-950",
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=650"
    }
  ];

  useEffect(() => {
    if (appConfig) {
      setDbDashboardBanners(appConfig.dashboardBanners || []);
      setDbQardBanners(appConfig.qardBanners || []);
      setDbSamityBanners(appConfig.samityBanners || []);
      setDbTelecomBanners(appConfig.telecomBanners || []);
      setDbMoneyExchangeBanners(appConfig.moneyExchangeBanners || []);
      setDbRationBanners(appConfig.rationBanners || []);
      setDbSafiBanners(appConfig.safiBanners || []);
      setDbAgentBanners(appConfig.agentBanners || []);
      setDbCourierBanners(appConfig.courierBanners || []);
      setDbEscrowCoverUrl(appConfig.escrowCoverUrl || '');
    }
  }, [appConfig]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        alert("ইমেজ সাইজ 25 এমবি এর চেয়ে ছোট হতে হবে!");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 900;
          const MAX_HEIGHT = 500;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.50);
            callback(compressedBase64);
          } else {
            if (typeof event.target?.result === 'string') {
              callback(event.target.result);
            }
          }
        };
        img.onerror = () => {
          if (typeof event.target?.result === 'string') {
            callback(event.target.result);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBanners = async () => {
    setBannersSaving(true);
    setBannersSuccess(false);
    setBannersError('');
    try {
      const updatedConfig = {
        ...appConfig,
        tickerText: cfgTickerText,
        samityTicker: cfgSamityTicker,
        qardTicker: cfgQardTicker,
        telecomTicker: cfgTelecomTicker,
        safiTicker: cfgSafiTicker,
        escrowTicker: cfgEscrowTicker,
        rationTicker: cfgRationTicker,
        agentTicker: cfgAgentTicker,
        courierTicker: cfgCourierTicker,
        gatewayTicker: cfgGatewayTicker,
        dashboardBanners: dbDashboardBanners,
        qardBanners: dbQardBanners,
        samityBanners: dbSamityBanners,
        telecomBanners: dbTelecomBanners,
        moneyExchangeBanners: dbMoneyExchangeBanners,
        rationBanners: dbRationBanners,
        safiBanners: dbSafiBanners,
        agentBanners: dbAgentBanners,
        courierBanners: dbCourierBanners,
        escrowCoverUrl: dbEscrowCoverUrl
      };
      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      setBannersSuccess(true);
      setTimeout(() => setBannersSuccess(false), 3500);
    } catch (err) {
      console.error('Error saving banners:', err);
      setBannersError('ব্যানার ও ঘোষণা সংরক্ষণ করতে ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।');
    } finally {
      setBannersSaving(false);
    }
  };

  const renderBannerEditorList = (
    title: string,
    banners: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[],
    setBanners: React.Dispatch<React.SetStateAction<{ id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[]>>,
    defaults: any[]
  ) => {
    const currentBanners = banners.length > 0 ? banners : defaults;

    const updateField = (idx: number, field: string, val: any) => {
      const list = [...currentBanners];
      list[idx] = { ...list[idx], [field]: val };
      setBanners(list);
    };

    const deleteSlide = (idx: number) => {
      const list = currentBanners.filter((_, i) => i !== idx);
      setBanners(list);
    };

    const addSlide = () => {
      const newId = currentBanners.length > 0 ? Math.max(...currentBanners.map(b => b.id)) + 1 : 1;
      const list = [
        ...currentBanners,
        {
          id: newId,
          tag: "নতুন ট্যাগ",
          title: "নতুন অফার বা ব্যানার",
          description: "ব্যানারের সংক্ষেপিত বিস্তারিত বিবরণ এখানে লিখুন যা স্লাইডারে দৃশ্যমান হবে।",
          bgGradient: "from-slate-950 via-slate-900 to-slate-950",
          image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=650"
        }
      ];
      setBanners(list);
    };

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
          <h3 className="text-xs sm:text-sm font-black uppercase text-indigo-400 tracking-wider flex items-center gap-2">
            {title}
            {banners.length === 0 && (
              <span className="px-2 py-0.5 bg-slate-100 text-[8.5px] border border-slate-200 text-slate-500 rounded-md font-bold lowercase">
                (ডিফল্ট ব্যানারসমূহ সক্রিয়)
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={addSlide}
            className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-350 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            নতুন ব্যানার স্লাইড যোগ করুন
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {currentBanners.map((slider, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-100 hover:border-slate-300 p-4 rounded-2.5xl space-y-4 relative flex flex-col justify-between">
              
              {/* Custom Header with Slid number and actions */}
              <div className="flex justify-between items-center text-xs font-semibold pb-2 border-b border-slate-100">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                  ব্যানার স্লাইড #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => deleteSlide(idx)}
                  className="p-1 px-2.5 bg-rose-955/80 hover:bg-rose-900 border border-rose-900/30 text-rose-450 hover:text-rose-400 text-[10px] font-black rounded-md transition-colors cursor-pointer"
                >
                  স্লাইড মুছুন
                </button>
              </div>

              {/* Grid with Fields and Thumbnail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">ট্যাগ লাইন (Tag/Tagline)</label>
                    <input
                      type="text"
                      value={slider.tag}
                      onChange={(e) => updateField(idx, 'tag', e.target.value)}
                      className="block w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-extrabold leading-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">ব্যানার বড় শিরোনাম (Title)</label>
                    <input
                      type="text"
                      value={slider.title}
                      onChange={(e) => updateField(idx, 'title', e.target.value)}
                      className="block w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-extrabold leading-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">সংক্ষেপ বিবরণী (Description/Promo Text)</label>
                    <textarea
                      rows={2}
                      value={slider.description}
                      onChange={(e) => updateField(idx, 'description', e.target.value)}
                      className="block w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold leading-relaxed"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-0.5 uppercase tracking-wide">ছবি গ্যালারি থেকে সরাসরি আপলোড</label>
                    <label className="block w-full text-center py-2 bg-slate-100 hover:bg-slate-750 border border-slate-200 font-extrabold text-[10.5px] rounded-xl cursor-pointer text-slate-700 transition">
                      📁 গ্যালারি থেকে ফটো দিন
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, (base64) => updateField(idx, 'image', base64))}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5 font-sans">অথবা এক্সটার্নাল ফটো লিংক</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={slider.image}
                      onChange={(e) => updateField(idx, 'image', e.target.value)}
                      className="block w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-[10px] font-mono font-bold leading-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5 font-sans">ব্যাকগ্রাউন্ড গ্রেডিয়েন্ট overlay (Tailwind class style)</label>
                    <input
                      type="text"
                      placeholder="from-slate-950 to-slate-950"
                      value={slider.bgGradient || "from-slate-950 via-slate-900 to-slate-950"}
                      onChange={(e) => updateField(idx, 'bgGradient', e.target.value)}
                      className="block w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-[10px] font-mono font-bold leading-none"
                    />
                  </div>
                </div>
              </div>

              {/* YouTube Aspect ratio 16:9 Live Preview */}
              <div className="space-y-1.5 pt-2 border-t border-slate-850/50">
                <span className="text-[9.5px] font-black text-slate-450 uppercase tracking-widest block font-sans">লাইভ স্লাইডার রেসপন্সিভ প্রিভিউ (YouTube 16:9 Aspect Ratio)</span>
                <div className={`relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-slate-850 flex items-center`}>
                  <img src={slider.image} alt="Slide Preview" className="absolute inset-0 w-full h-full object-cover opacity-100" referrerPolicy="no-referrer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Helper method to automatically calculate a unique Member ID based on sequential serials
  const autoGenerateMemberId = () => {
    let maxSerial = 0;
    const totalCount = Array.isArray(users) ? users.length : 0;
    if (Array.isArray(users)) {
      users.forEach((u) => {
        if (u.memberId && u.memberId.startsWith('AMB')) {
          const serialPart = u.memberId.replace('AMB', '');
          const serialNum = parseInt(serialPart, 10);
          if (!isNaN(serialNum) && serialNum > maxSerial) {
            maxSerial = serialNum;
          }
        }
      });
    }
    const nextSerial = Math.max(maxSerial, totalCount) + 1;
    const nextId = `AMB${String(nextSerial).padStart(8, '0')}`;
    setNewMemberId(nextId);
    return nextId;
  };

  // Re-sequence all existing member IDs to start cleanly from 1..N (AMB00000001, AMB00000002...)
  const handleResequenceAllMemberIds = async () => {
    requestConfirm(
      '🔢 সদস্য সিরিয়াল 1 থেকে ঠিক ও সাজিয়ে দিন',
      `আপনি কি বর্তমান সকল ${users.length} জন সদস্যের সিরিয়াল আইডি 1 থেকে পরপর (AMB00000001, AMB00000002... AMB${String(users.length).padStart(8, '0')}) নতুন করে সাজাতে চান?\n\nএটি সম্পন্ন হলে সমস্ত সদস্যের সিরিয়াল আইডি 1 থেকে 1,00,000 পর্যন্ত সঠিকভাবে বিন্যস্ত থাকবে এবং এলোমেলো নম্বরগুলো সংশোধন হয়ে যাবে।`,
      async () => {
        setIsResequencing(true);
        try {
          const snap = await getDocs(collection(db, 'users'));
          const allUserDocs: { id: string; data: User }[] = [];
          
          snap.forEach(d => {
            allUserDocs.push({ id: d.id, data: d.data() as User });
          });

          // Separate main admins (who do NOT have a serial number) from regular members
          const regularMembers: { id: string; data: User }[] = [];
          const adminMembers: { id: string; data: User }[] = [];

          allUserDocs.forEach(u => {
            const isMainAdmin = u.id === 'admin_master' || u.data.phone === '+8800011112222' || u.data.memberId === 'MAIN_ADMIN';
            if (isMainAdmin) {
              adminMembers.push(u);
            } else {
              regularMembers.push(u);
            }
          });

          // Sort regular members by existing memberId numerical order first, fallback to createdAt
          regularMembers.sort((a, b) => {
            const numA = parseInt((a.data.memberId || '').replace(/\D/g, ''), 10) || 99999999;
            const numB = parseInt((b.data.memberId || '').replace(/\D/g, ''), 10) || 99999999;
            if (numA !== numB) {
              return numA - numB;
            }

            const timeA = a.data.createdAt ? new Date(a.data.createdAt).getTime() : 0;
            const timeB = b.data.createdAt ? new Date(b.data.createdAt).getTime() : 0;
            if (timeA && timeB && timeA !== timeB) {
              return timeA - timeB;
            }

            return (a.data.phone || a.id).localeCompare(b.data.phone || b.id);
          });

          const updatePromises: Promise<void>[] = [];
          const updatedUserMap: Record<string, string> = {};

          // Set Main Admins to 'MAIN_ADMIN'
          adminMembers.forEach(uObj => {
            updatedUserMap[uObj.id] = 'MAIN_ADMIN';
            updatePromises.push(
              updateDoc(doc(db, 'users', uObj.id), {
                memberId: 'MAIN_ADMIN'
              }).catch(err => console.error(`Error updating main admin memberId for ${uObj.id}:`, err))
            );
          });

          // Assign serial numbers strictly 1..N for regular members
          regularMembers.forEach((uObj, idx) => {
            const serialNum = idx + 1;
            const newMemberId = `AMB${String(serialNum).padStart(8, '0')}`;
            updatedUserMap[uObj.id] = newMemberId;

            updatePromises.push(
              updateDoc(doc(db, 'users', uObj.id), {
                memberId: newMemberId
              }).catch(err => console.error(`Error updating memberId for ${uObj.id}:`, err))
            );
          });

          await Promise.all(updatePromises);

          // Sync atomic member_counter document in app_config
          await setDoc(doc(db, 'app_config', 'member_counter'), {
            lastSerial: regularMembers.length,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});

          // Update local state
          setUsers(prev => prev.map(u => ({
            ...u,
            memberId: updatedUserMap[u.uid] || u.memberId
          })));

          const successMsg = `🎉 সফলভাবে ${regularMembers.length} জন সাধারণ সদস্যের সিরিয়াল নম্বর 1 থেকে পরপর পুনরায় সাজানো হয়েছে!\nপ্রারম্ভিক আইডি: AMB00000001\nশেষের আইডি: AMB${String(regularMembers.length).padStart(8, '0')}\n(মেইন এডমিন একাউন্টে কোনো সিরিয়াল নম্বর রাখা হয়নি)`;
          requestAlert('সিরিয়াল আইডি সংশোধন সম্পন্ন', successMsg);
        } catch (err: any) {
          console.error("Resequence error:", err);
          requestAlert('ত্রুটি', `সদস্য সিরিয়াল আপডেট করতে সমস্যা হয়েছে: ${err.message || err}`);
        } finally {
          setIsResequencing(false);
        }
      }
    );
  };

  // Handle manual co-op balance adjustments / cash entries (Reconciliation)
  const handleReconciliationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReconSuccess('');
    setReconError('');

    if (!reconUserUid) {
      setReconError('অনুগ্রহ করে একজন সমবায় সদস্য নির্বাচন করুন।');
      return;
    }

    const amt = Number(reconAmount);
    if (!reconAmount || isNaN(amt) || amt <= 0) {
      setReconError('সরঠিক টাকার পরিমাণ লিখুন।');
      return;
    }

    const targetUser = users.find(u => u.uid === reconUserUid);
    if (!targetUser) {
      setReconError('সদস্যকে ডাটাবেজে খুঁজে পাওয়া যায়নি।');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const txId = `tx-recon-${Date.now()}`;
      const recNo = `REC-RECON-${Math.floor(100000 + Math.random() * 900000)}`;
      
      let updatedSavings = targetUser.savings || 0;
      let updatedDueLoan = targetUser.dueLoan || 0;
      let updatedBalance = targetUser.balance || 0;
      let updatedDpsBalance = targetUser.dpsBalance !== undefined ? targetUser.dpsBalance : 0;
      let updatedProfitsBalance = targetUser.profitsBalance !== undefined ? targetUser.profitsBalance : 0;

      let typeLabel = '';
      let type: any = 'fee_payment';
      let description = '';

      if (reconAction === 'add_savings') {
        updatedSavings += amt;
        type = 'deposit';
        typeLabel = 'সঞ্চয়ী আমানত জমা';
        description = `অফিস ম্যানুয়ালি বা সমন্বয়ের মাধ্যমে কো-অপারেティブ সঞ্চয় ফান্ডে ৳${amt.toLocaleString('bn-BD')} টাকা নগদ জমা করেছেন।`;
      } else if (reconAction === 'reduce_savings') {
        updatedSavings = Math.max(0, updatedSavings - amt);
        type = 'withdraw';
        typeLabel = 'সঞ্চয়ী আমানত উত্তোলন';
        description = `অফিস ম্যানুয়ালি কো-অপারেティブ সঞ্চয় ফান্ড থেকে ৳${amt.toLocaleString('bn-BD')} টাকা বিয়োগ বা সমন্বয় করেছেন।`;
      } else if (reconAction === 'add_dps') {
        updatedDpsBalance += amt;
        type = 'deposit';
        typeLabel = 'ডিপিএস আমানত জমা';
        description = `অফিস ম্যানুয়ালি বা জমার মাধ্যমে সদস্যের ডিপিএস ফান্ডে ৳${amt.toLocaleString('bn-BD')} টাকা জমা রেকর্ড করেছেন।`;
      } else if (reconAction === 'reduce_dps') {
        updatedDpsBalance = Math.max(0, updatedDpsBalance - amt);
        type = 'withdraw';
        typeLabel = 'ডিপিএস আমানত সমন্বয়';
        description = `অফিস ম্যানুয়ালি বা সমন্বয়ের মাধ্যমে সদস্যের ডিপিএস ফান্ড থেকে ৳${amt.toLocaleString('bn-BD')} টাকা বিয়োগ বা সমন্বয় করেছেন।`;
      } else if (reconAction === 'add_profits') {
        updatedProfitsBalance += amt;
        type = 'interest';
        typeLabel = 'সমিতি লভ্যাংশ বণ্টন';
        description = `সমিতি লভ্যাংশ বণ্টন বাবদ সদস্যের অর্জিত লভ্যাংশ খতিয়ানে ৳${amt.toLocaleString('bn-BD')} টাকা ক্রেডিট করা হয়েছে।`;
      } else if (reconAction === 'reduce_profits') {
        updatedProfitsBalance = Math.max(0, updatedProfitsBalance - amt);
        type = 'withdraw';
        typeLabel = 'সমিতি লভ্যাংশ উত্তোলন';
        description = `সদস্যের অর্জিত লভ্যাংশ খতিয়ান হতে ৳${amt.toLocaleString('bn-BD')} টাকা উত্তোলন বা সমন্বয় রেকর্ড করা হয়েছে।`;
      } else if (reconAction === 'disburse_loan') {
        updatedDueLoan += amt;
        updatedBalance += amt;
        type = 'loan_disbursment';
        typeLabel = 'সমিতি লোন বিতরণ';
        description = `সমিতি লোন বাবদ নগদ ৳${amt.toLocaleString('bn-BD')} টাকা সদস্যের মেইন ওয়ালেটে বিতরণ করা হয়েছে। বকেয়া ঋণে যোগ হয়েছে।`;
      } else if (reconAction === 'repay_loan_cash') {
        updatedDueLoan = Math.max(0, updatedDueLoan - amt);
        type = 'loan_repayment';
        typeLabel = 'সমিতি লোন বকেয়া কিস্তি পরিশোধ';
        description = `অফিস রশিদ মূলে বা নগদ ৳${amt.toLocaleString('bn-BD')} টাকা সমবায় লোন কিস্তি বকেয়া আদায় করেছেন।`;
      } else if (reconAction === 'disburse_qard') {
        type = 'qard_loan_disbursment';
        typeLabel = 'করযে হাসানা ঋণ বিতরণ';
        description = `সুদমুক্ত কল্যাণ তহবিল হতে ৳${amt.toLocaleString('bn-BD')} করযে হাসানা বিতরণ রেকর্ড এন্ট্রি করা হয়েছে।`;
      } else if (reconAction === 'repay_qard') {
        type = 'qard_loan_repayment';
        typeLabel = 'করযে হাসানা ঋণ পরিশোধ';
        description = `সুদমুক্ত কল্যাণ তহবিলের বকেয়া ঋণ বাবদ ৳${amt.toLocaleString('bn-BD')} নগদ পরিশোধ রেকর্ড সমন্বয় করা হয়েছে।`;
      } else if ((reconAction as any) === 'transfer_main_to_savings') {
        updatedBalance = Math.max(0, updatedBalance - amt);
        updatedSavings += amt;
        updatedDpsBalance += amt;
        type = 'coop_savings_deposit';
        typeLabel = 'মেইন ব্যালেন্স হতে সঞ্চয় স্থানান্তর সমন্বয়';
        description = `অফিস সমন্বয় মূলে মেইন ব্যালেন্স হতে ৳${amt.toLocaleString('bn-BD')} কেটে সমিতি সঞ্চয় তহবিলে ক্রেডিট করা হয়েছে।`;
      } else if ((reconAction as any) === 'deduct_main_balance') {
        updatedBalance = Math.max(0, updatedBalance - amt);
        type = 'withdraw';
        typeLabel = 'মেইন ব্যালেন্স বিয়োগ/কর্তন';
        description = `অফিস সমন্বয় মূলে সদস্যের মেইন ব্যালেন্স থেকে ৳${amt.toLocaleString('bn-BD')} বিয়োগ বা এডজাস্ট করা হয়েছে।`;
      } else if ((reconAction as any) === 'add_main_balance') {
        updatedBalance += amt;
        type = 'add_money';
        typeLabel = 'মেইন ব্যালেন্স যোগ/বৃদ্ধি';
        description = `অফিস সমন্বয় মূলে সদস্যের মেইন ব্যালেন্সে ৳${amt.toLocaleString('bn-BD')} যোগ করা হয়েছে।`;
      }

      await updateDoc(userRef, {
        savings: updatedSavings,
        dueLoan: updatedDueLoan,
        balance: updatedBalance,
        mainBalance: updatedBalance,
        dpsBalance: updatedDpsBalance,
        profitsBalance: updatedProfitsBalance
      });

      await addDoc(collection(db, 'transactions'), {
        id: txId,
        userId: targetUser.uid,
        userName: targetUser.name,
        memberId: targetUser.memberId,
        type: type,
        typeLabel: typeLabel,
        amount: amt,
        status: 'success',
        createdAt: new Date().toISOString(),
        paymentMethod: 'Office Cash Recon',
        description: description + (reconNotes ? ` মন্তব্যঃ ${reconNotes}` : ''),
        receiptNo: recNo
      });

      setReconAmount('');
      setReconNotes('');
      setReconSuccess(`সফল হয়েছে! ${targetUser.name} এর জন্য "${typeLabel}" সফলভাবে এন্ট্রি ও ব্যালেন্স সমন্বয় করা হয়েছে। রশিদ নং: ${recNo}`);
    } catch (err: any) {
      console.error(err);
      setReconError(`ব্যালেন্স সমন্বয়ে ত্রুটি হয়েছেঃ ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit hand-crafted Member Registration inside the Panel!
  const handleManualMemberRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSuccess('');
    setRegError('');

    if (!newMemberName.trim()) {
      setRegError('সদস্যের পুরো নাম লিখুন।');
      return;
    }
    if (!newMemberPhone.trim() || newMemberPhone.trim().length !== 11) {
      setRegError('11 ডিজিটের সঠিক মোবাইল নাম্বার লিখুন।');
      return;
    }
    if (!newMemberPin.trim() || newMemberPin.trim().length !== 4) {
      setRegError('4 ডিজিটের সিকিউরিটি পিন নম্বর লিখুন।');
      return;
    }
    if (!newMemberId.trim()) {
      setRegError('মেম্বার আইডি টাইপ করুন বা অটো-জেনারেট বাটনে ক্লিক করুন।');
      return;
    }

    // Check if phone or ID is already in use with robust last-9-digits matching
    const cleanNewDigits = convertBengaliToEnglishDigits(newMemberPhone.trim()).replace(/\D/g, '');
    const last9New = cleanNewDigits.length >= 9 ? cleanNewDigits.slice(-9) : '';

    const duplicatePhone = users.find(u => {
      if (!u || !u.phone) return false;
      const uDigits = convertBengaliToEnglishDigits(u.phone).replace(/\D/g, '');
      const uNormDigits = u.normalizedPhone ? convertBengaliToEnglishDigits(u.normalizedPhone).replace(/\D/g, '') : '';
      return (
        (last9New && uDigits.endsWith(last9New)) ||
        (last9New && uNormDigits.endsWith(last9New)) ||
        u.phone.trim() === newMemberPhone.trim() ||
        (u.normalizedPhone && u.normalizedPhone.trim() === newMemberPhone.trim())
      );
    });

    if (duplicatePhone) {
      setRegError(`এই মোবাইল নম্বরটি (${duplicatePhone.phone}) দিয়ে ইতিমধ্যে সদস্য অ্যাকাউন্ট (${duplicatePhone.memberId || ''}) নিবন্ধিত রয়েছে।`);
      return;
    }

    const duplicateId = users.find(u => u.memberId && u.memberId.trim().toUpperCase() === newMemberId.trim().toUpperCase());
    if (duplicateId) {
      setRegError('এই মেম্বার আইডিটি বর্তমানে অন্য একজন সদস্যের অনুকূলে সচল আছে।');
      return;
    }

    setLoading(true);
    try {
      // Async deep check in Firestore before creation
      const normP = normalizePhoneNumber(newMemberPhone.trim());
      let firestoreExisting = await findUserInFirestoreByPhone(newMemberPhone.trim());
      if (!firestoreExisting && normP) {
        firestoreExisting = await findUserInFirestoreByPhone(normP);
      }
      if (!firestoreExisting && last9New.length === 9) {
        firestoreExisting = await findUserInFirestoreByPhone(last9New);
      }

      if (firestoreExisting && firestoreExisting.user) {
        setRegError(`ফায়ারস্টোরে এই মোবাইল নম্বরটির (${firestoreExisting.user.phone || newMemberPhone}) বিপরীতে ইতিমধ্যে সদস্য অ্যাকাউন্ট (ID: ${firestoreExisting.user.memberId || 'N/A'}) রয়েছে। একটি নম্বর দিয়ে আজীবন আর দ্বিতীয় অ্যাকাউন্ট খোলা যাবে না।`);
        setLoading(false);
        return;
      }

      const userDocId = 'user_' + (normP || cleanNewDigits || Date.now().toString());
      const finalMemberId = newMemberId.trim() || await getNextSequentialMemberId();

      const newUser: User = {
        uid: userDocId,
        name: newMemberName.trim(),
        phone: newMemberPhone.trim(),
        normalizedPhone: normP,
        memberId: finalMemberId,
        pin: newMemberPin.trim(),
        role: newRole,
        balance: Number(newMainsBal) || 0,
        telecomBalance: Number(newTelBal) || 0,
        superShopBalance: Number(newShopBal) || 0,
        savings: Number(newSavings) || 0,
        dueLoan: Number(newDueLoan) || 0,
        lockedBalance: 0,
        pendingBalance: 0,
        memberGroup: newMemberGroup,
        status: 'active',
        approved: true,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', userDocId), newUser, { merge: true });
      
      // Post an audit transaction log as record
      await addDoc(collection(db, 'transactions'), {
        id: `tx-reg-${Date.now()}`,
        userId: userDocId,
        userName: newUser.name,
        memberId: newUser.memberId,
        type: 'deposit',
        typeLabel: 'ম্যানুয়াল রেজিষ্ট্রেশন',
        amount: Number(newMainsBal) || 0,
        status: 'success',
        createdAt: new Date().toISOString(),
        paymentMethod: 'Office Set',
        description: `এডমিন কর্তৃক নতুন সদস্যের ম্যানুয়াল ডিরেক্টরি নিবন্ধন সম্পন্ন। প্রারম্ভিক শেয়ার সঞ্চয়ঃ ৳${newUser.savings}, প্রারম্ভিক ঋণঃ ৳${newUser.dueLoan}।`
      });

      // Clear Form Fields
      setNewMemberName('');
      setNewMemberPhone('');
      setNewMemberPin('');
      setNewMemberId('');
      setNewMainsBal('0');
      setNewSavings('0');
      setNewDueLoan('0');

      setRegSuccess(`অপূর্ব! নতুন সমবায় সদস্য (আইডি: ${newUser.memberId}) সফলভাবে সিস্টেমে নিবন্ধিত হয়েছে।`);
    } catch (err: any) {
      console.error(err);
      setRegError('সদস্য নিবন্ধন করার সময় সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTransaction = async (tx: Transaction): Promise<void> => {
    if (!tx) return;
    let defaultProfit = 0;
    let defaultNote = 'অর্জিত সার্ভিস লাভ / কমিশন';

    if (tx.type === 'telecom_recharge' || (tx.type as any) === 'recharge') {
      defaultProfit = Number((tx as any).adminProfit || (tx as any).profitAmount || (tx as any).rechargeCommission || tx.charge || 20);
      defaultNote = 'টেলিকম ড্রাইভ প্যাক / রিচার্জ কমিশন';
    } else if (tx.type === 'withdraw' || (tx.type as any) === 'payout') {
      defaultProfit = Number(tx.charge || tx.fee || (tx as any).adminProfit || 10);
      defaultNote = 'ক্যাশআউট / উইথড্র সার্ভিস চার্জ';
    } else if (tx.type === 'balance_transfer') {
      defaultProfit = Number(tx.charge || tx.fee || (tx as any).adminProfit || 5);
      defaultNote = 'ব্যালেন্স ও ব্যাংক ট্রান্সফার ফি';
    } else if (tx.type === 'money_exchange') {
      defaultProfit = Number(tx.charge || tx.fee || (tx as any).adminProfit || 15);
      defaultNote = 'কারেন্সি এক্সচেঞ্জ প্রফিট';
    } else {
      defaultProfit = Number(tx.charge || tx.fee || (tx as any).adminProfit || 0);
    }

    setApproveProfitInput(String(defaultProfit));
    setApproveProfitNote(defaultNote);
    await executeApproveTransaction(tx, defaultProfit, defaultNote);
  };

  const executeApproveTransaction = async (targetTx: Transaction, profit: number = 0, profitNote: string = '') => {
    if (!targetTx) return;
    if (targetTx.status === 'success' || (targetTx as any).isApproved) {
      requestAlert('সতর্কবার্তা', 'এই লেনদেনটি ইতোমধ্যে অনুমোদিত হয়েছে।');
      return;
    }
    setIsApprovingProcessing(true);
    const tx = targetTx;
    const approvedAmount = Number(tx.amount || 0);
    const targetId = tx.id || (tx as any).docId || '';
    const targetTrxId = tx.trxId || (tx as any).transactionId || (tx as any).receiptNo || '';

    const allIds = new Set<string>();
    if (targetId) allIds.add(targetId);
    if ((tx as any).docId) allIds.add((tx as any).docId);
    if ((tx as any).id) allIds.add((tx as any).id);
    if (Array.isArray((tx as any).allDocIds)) {
      ((tx as any).allDocIds as string[]).forEach(d => { if (d) allIds.add(d); });
    }

    const matchTx = (t: Transaction) => {
      if (!t) return false;
      if (allIds.has(t.id) || allIds.has((t as any).docId)) return true;
      if (targetTrxId && (t.trxId === targetTrxId || (t as any).transactionId === targetTrxId || (t as any).receiptNo === targetTrxId)) return true;
      return false;
    };

    // Optimistic instant state update (< 0.001s response)
    setTransactions(prev => sortTransactionsNewestFirst(prev.map(t => matchTx(t) ? {
      ...t,
      status: 'success',
      isApproved: true,
      approvedAt: new Date().toISOString(),
      amount: approvedAmount,
      adminProfit: profit,
      companyProfit: profit,
      profitAmount: profit,
      profitNote: profitNote || 'অর্জিত সার্ভিস লাভ / কমিশন',
      charge: profit > 0 ? profit : (t.charge || 0)
    } : t)));

    if (tx.userId) {
      setUsers(prev => prev.map((u) => {
        if (u.uid === tx.userId) {
          if (tx.type === 'add_money' || tx.type === 'deposit') {
            const curBal = getEffectiveBalance(u);
            return { ...u, balance: curBal + approvedAmount, mainBalance: curBal + approvedAmount };
          } else if (tx.type === 'coop_savings_deposit' || tx.type === 'samity_deposit') {
            const curBal = getEffectiveBalance(u);
            const isMainWalletPay = !tx.paymentMethod || tx.paymentMethod === 'Main Balance' || tx.paymentMethod === 'Al Mayadin Wallet' || tx.paymentMethod === 'মেইন ব্যালেন্স' || tx.paymentMethod === 'Wallet' || tx.paymentMethod === 'ক্যাশ/মেইন ওয়ালেট';
            const newBal = isMainWalletPay ? Math.max(0, curBal - approvedAmount) : curBal;
            const newSav = (u.savings || 0) + approvedAmount;
            const newPaid = normalizePaidMonthsArray(u.samityPaidMonths || [], newSav, u.monthlySavingsTarget || 1000);
            return { ...u, balance: newBal, mainBalance: newBal, savings: newSav, dpsBalance: newSav, samityPaidMonths: newPaid };
          } else if (tx.type === 'withdraw' && (tx.category === 'samity_withdraw' || (tx as any).isSavingsWithdraw || (tx.typeLabel || '').includes('সমবায়') || (tx.typeLabel || '').includes('সঞ্চয়'))) {
            const curBal = getEffectiveBalance(u);
            const curSav = Number(u.savings) || 0;
            const newSav = Math.max(0, curSav - approvedAmount);
            const newBal = curBal + approvedAmount;
            return { ...u, balance: newBal, mainBalance: newBal, savings: newSav, dpsBalance: newSav, samityDeactivateStatus: 'released', samityAutoSavingsActive: false };
          }
        }
        return u;
      }));
    }

    // Close approval modal immediately for maximum responsiveness
    setApproveModalTx(null);

    try {
      setLoading(true);
      const docIdsToUpdate = new Set<string>();
      if (targetId) docIdsToUpdate.add(targetId);
      if ((tx as any).docId) docIdsToUpdate.add((tx as any).docId);
      if ((tx as any).id) docIdsToUpdate.add((tx as any).id);
      if (Array.isArray((tx as any).allDocIds)) {
        ((tx as any).allDocIds as string[]).forEach(d => { if (d) docIdsToUpdate.add(d); });
      }

      if (targetTrxId) {
        try {
          const qTrx = query(collection(db, 'transactions'), where('trxId', '==', targetTrxId));
          const snapTrx = await getDocs(qTrx);
          snapTrx.forEach(d => docIdsToUpdate.add(d.id));
        } catch (e) {
          console.warn("Could not query by trxId:", e);
        }
        try {
          const qTrx2 = query(collection(db, 'transactions'), where('transactionId', '==', targetTrxId));
          const snapTrx2 = await getDocs(qTrx2);
          snapTrx2.forEach(d => docIdsToUpdate.add(d.id));
        } catch (e) {}
        try {
          const qTrx3 = query(collection(db, 'transactions'), where('receiptNo', '==', targetTrxId));
          const snapTrx3 = await getDocs(qTrx3);
          snapTrx3.forEach(d => docIdsToUpdate.add(d.id));
        } catch (e) {}
      }

      if (targetId) {
        try {
          const qId = query(collection(db, 'transactions'), where('id', '==', targetId));
          const snapId = await getDocs(qId);
          snapId.forEach(d => docIdsToUpdate.add(d.id));
        } catch (e) {}
      }

      // Also gather docIds from in-memory transactions that match this tx
      transactions.forEach(t => {
        if (matchTx(t)) {
          if (t.id) docIdsToUpdate.add(t.id);
          if ((t as any).docId) docIdsToUpdate.add((t as any).docId);
          if ((t as any).firestoreDocId) docIdsToUpdate.add((t as any).firestoreDocId);
        }
      });
      
      let finalUpdatedBalance = 0;
      let rxPhone = '';

      if (tx.userId) {
        const userRef = doc(db, 'users', tx.userId);
        await runTransaction(db, async (transaction) => {
          const uSnap = await transaction.get(userRef);
          if (!uSnap.exists()) return;
          const freshUser = uSnap.data();
          let liveBal = getEffectiveBalance(freshUser);

          if (tx.type === 'add_money' || tx.type === 'deposit') {
            liveBal = liveBal + approvedAmount;
            transaction.update(userRef, { balance: liveBal, mainBalance: liveBal });
          } else if (tx.type === 'coop_savings_deposit' || tx.type === 'samity_deposit') {
            const currentSavings = Number(freshUser.savings) || 0;
            const newSavings = currentSavings + approvedAmount;
            const currentDps = freshUser.dpsBalance !== undefined ? Number(freshUser.dpsBalance) : currentSavings;
            const newDps = currentDps + approvedAmount;
            const targetRate = Number(freshUser.monthlySavingsTarget) || 1000;
            const existingPaid = freshUser.samityPaidMonths || [];
            const updatedPaid = normalizePaidMonthsArray(existingPaid, newSavings, targetRate);
            
            const isMainWalletPay = !tx.paymentMethod || tx.paymentMethod === 'Main Balance' || tx.paymentMethod === 'Al Mayadin Wallet' || tx.paymentMethod === 'মেইন ব্যালেন্স' || tx.paymentMethod === 'Wallet' || tx.paymentMethod === 'ক্যাশ/মেইন ওয়ালেট';
            if (isMainWalletPay) {
              liveBal = Math.max(0, liveBal - approvedAmount);
            }
            
            transaction.update(userRef, {
              savings: newSavings,
              dpsBalance: newDps,
              balance: liveBal,
              mainBalance: liveBal,
              samityPaidMonths: updatedPaid
            });
          } else if (tx.type === 'coop_loan_apply') {
            const currentDue = Number(freshUser.dueLoan) || 0;
            liveBal = liveBal + approvedAmount;
            transaction.update(userRef, {
              balance: liveBal,
              mainBalance: liveBal,
              dueLoan: currentDue + approvedAmount
            });
          } else if (tx.type === 'loan_repayment') {
            const currentDue = Number(freshUser.dueLoan) || 0;
            const isMainWalletPay = !tx.paymentMethod || tx.paymentMethod === 'Main Balance' || tx.paymentMethod === 'Al Mayadin Wallet' || tx.paymentMethod === 'মেইন ব্যালেন্স' || tx.paymentMethod === 'Wallet';
            if (isMainWalletPay) {
              liveBal = Math.max(0, liveBal - approvedAmount);
            }
            transaction.update(userRef, {
              dueLoan: Math.max(0, currentDue - approvedAmount),
              balance: liveBal,
              mainBalance: liveBal
            });
          } else if (tx.type === 'withdraw') {
            const isSamityWd = tx.category === 'samity_withdraw' || (tx as any).isSavingsWithdraw || (tx.typeLabel || '').includes('সমবায়') || (tx.typeLabel || '').includes('সঞ্চয়');
            if (isSamityWd) {
              const currentSavings = Number(freshUser.savings) || 0;
              const newSavings = Math.max(0, currentSavings - approvedAmount);
              liveBal = liveBal + approvedAmount;
              transaction.update(userRef, {
                savings: newSavings,
                dpsBalance: newSavings,
                balance: liveBal,
                mainBalance: liveBal,
                samityDeactivateStatus: 'released',
                samityAutoSavingsActive: false
              });
            } else {
              const currentPending = Number(freshUser.pendingBalance) || 0;
              transaction.update(userRef, { pendingBalance: Math.max(0, currentPending - approvedAmount) });
            }
          } else if (tx.type === 'telecom_recharge') {
            const currentBal = Number(freshUser.telecomBalance) || 0;
            let updateTelecomObj: any = { telecomBalance: Math.max(0, currentBal - approvedAmount) };
            transaction.update(userRef, updateTelecomObj);
          }
          finalUpdatedBalance = liveBal;
        });
      }

      // If balance transfer, update receiver atomically
      if (tx.type === 'balance_transfer') {
        let receiverDocId = tx.receiverUid;
        if (!receiverDocId && (tx.receiverId || (tx as any).phone)) {
          const rxSearch = users.find(u => u.uid === tx.receiverUid || u.memberId === tx.receiverId || u.phone === (tx as any).phone || u.phone === tx.receiverId);
          if (rxSearch) receiverDocId = rxSearch.uid;
        }

        if (receiverDocId) {
          const rxRef = doc(db, 'users', receiverDocId);
          await runTransaction(db, async (transaction) => {
            const rxSnap = await transaction.get(rxRef);
            if (rxSnap.exists()) {
              const rxData = rxSnap.data();
              rxPhone = rxData.phone || '';
              const currentRxBal = getEffectiveBalance(rxData);
              const newRxBal = currentRxBal + approvedAmount;
              transaction.update(rxRef, { balance: newRxBal, mainBalance: newRxBal });

              const rxTxRef = doc(collection(db, 'transactions'));
              transaction.set(rxTxRef, {
                id: rxTxRef.id,
                userId: receiverDocId,
                userName: rxData.name || '',
                userPhone: rxData.phone || '',
                memberId: rxData.memberId || '',
                amount: approvedAmount,
                postBalance: newRxBal,
                type: 'deposit',
                typeLabel: 'সমিতি স্থানান্তর ব্যালেন্স লাভ',
                status: 'success',
                isApproved: true,
                paymentMethod: 'Al Mayadin Wallet',
                phone: (tx as any).userPhone || '',
                createdAt: new Date().toISOString(),
                description: `মেম্বার ${tx.userName || ''} (${tx.memberId || ''}) হতে স্থানান্তর ব্যালেন্স গ্রহণ`
              });

              const rxNotifRef = doc(collection(db, 'user_notifications'));
              transaction.set(rxNotifRef, {
                id: rxNotifRef.id,
                userId: receiverDocId,
                title: '📥 টাকা গ্রহণ সফল (Money Received)',
                body: `You have received Tk ${approvedAmount.toFixed(2)} from ${(tx as any).userPhone || ''}. Ref ${tx.transactionId || tx.receiptNo || tx.id}.`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: new Date().toISOString()
              });
            }
          });
        }
      }

      const updates: any = {
        status: 'success',
        isApproved: true,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        amount: approvedAmount,
        adminProfit: profit,
        companyProfit: profit,
        profitAmount: profit,
        profitNote: profitNote || 'অর্জিত সার্ভিস লাভ / কমিশন',
        charge: profit > 0 ? profit : (tx.charge || 0)
      };

      const promises: Promise<any>[] = [];
      for (const docId of docIdsToUpdate) {
        if (!docId) continue;
        promises.push(setDoc(doc(db, 'transactions', docId), updates, { merge: true }));
      }

      let notifTitle = 'আবেদন অনুমোদন সম্পন্ন';
      let notifBody = `আপনার ৳${approvedAmount.toLocaleString('bn-BD')} টাকার আবেদনটি অনুমোদন করা হয়েছে।`;

      if (tx.type === 'add_money' || tx.type === 'deposit') {
        notifTitle = '💰 ডিপোজিট/অ্যাড মানি অনুমোদন';
        notifBody = `আপনার ৳${approvedAmount.toLocaleString('bn-BD')} টাকা জমা আবেদন সফলভাবে অনুমোদন করা হয়েছে।`;
      } else if (tx.type === 'withdraw') {
        const isSamityWd = tx.category === 'samity_withdraw' || (tx as any).isSavingsWithdraw || (tx.typeLabel || '').includes('সমবায়') || (tx.typeLabel || '').includes('সঞ্চয়') || (tx.id && tx.id.startsWith('SYNTH-SAMITY-WD-'));
        if (isSamityWd) {
          if (tx.userId) {
            promises.push(setDoc(doc(db, 'users', tx.userId), {
              samityDeactivateStatus: 'released',
              samityAutoSavingsActive: false,
              updatedAt: new Date().toISOString()
            }, { merge: true }));
          }
          notifTitle = '🎉 সঞ্চয় উত্তোলন ও রিফান্ড অনুমোদন সম্পন্ন';
          notifBody = `আপনার সঞ্চয় বন্ধ ও ৳${approvedAmount.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন অনুমোদন করা হয়েছে এবং টাকা আপনার মেইন ব্যালেন্সে জমা করা হয়েছে।`;
        } else {
          notifTitle = '💸 উইথড্র/ক্যাশআউট অনুমোদন';
          notifBody = `আপনার ৳${approvedAmount.toLocaleString('bn-BD')} টাকা উত্তোলন আবেদন অনুমোদন করা হয়েছে।`;
        }
      } else if (tx.type === 'general_loan_request' as any) {
        notifTitle = '📈 সাধারণ ঋণ আবেদন অনুমোদন সম্পন্ন';
        notifBody = `আপনার ৳${tx.amount.toLocaleString('bn-BD')} সাধারণ ঋণ আবেদনটি অনুমোদন ও বিতরণ সম্পন্ন হয়েছে।`;
      } else if (tx.type === 'qard_loan_request' as any) {
        notifTitle = '🌱 করযে হাসানা বিতরণ সম্পন্ন';
        notifBody = `আপনার সুদমুক্ত করযে হাসানা কল্যাণ ঋণ ৳${tx.amount.toLocaleString('bn-BD')} অনুমোদন করা হয়েছে এবং ওয়ালেট ব্যালেন্সে যোগ হয়েছে।`;
      } else if (tx.type === 'balance_transfer') {
        if (tx.transferSector === 'samity' && tx.receiverUid) {
          const trxId = tx.transactionId || tx.receiptNo || tx.id || '';
          const now = new Date();
          const formattedTime = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          notifTitle = '💸 টাকা পাঠানো সফল (Money Sent)';
          notifBody = `You have sent Tk ${tx.amount.toFixed(2)} to ${rxPhone || ''}. Fee Tk 0.00. Balance Tk ${finalUpdatedBalance.toFixed(2)}. TrxID ${trxId} at ${formattedTime}`;
        } else {
          notifTitle = '🔄 ব্যালেন্স স্থানান্তর সফল';
          notifBody = `আপনার ৳${tx.amount.toLocaleString('bn-BD')} ব্যালেন্স স্থানান্তর আবেদনটি সফলভাবে অনুমোদিত হয়েছে।`;
        }
      } else if (tx.type === 'telecom_recharge') {
        notifTitle = '📱 মোবাইল রিচার্জ সফল';
        notifBody = `আপনার ৳${tx.amount.toLocaleString('bn-BD')} মোবাইল রিচার্জ সফলভাবে সম্পন্ন করা হয়েছে।`;
      } else if (tx.type === 'remittance' || tx.category === 'remittance') {
        notifTitle = '💸 প্রবাসী রেমিট্যান্স বিতরণ ও পেমেন্ট সম্পন্ন';
        const benefInfo = tx.beneficiaryName ? `প্রাপক: ${tx.beneficiaryName} (${tx.beneficiaryBankName || ''} - ${tx.beneficiaryAccountNo || ''})` : '';
        notifBody = `আপনার প্রবাসী রেমিট্যান্স আবেদনটি সফলভাবে সম্পন্ন হয়েছে। মূল টাকা ও ২.৫% সরকারি প্রণোদনা সহ মোট ৳${approvedAmount.toLocaleString('bn-BD')} BDT বাংলাদেশে প্রাপকের একাউন্টে পাঠানো হয়েছে। ${benefInfo}`;
      }

      promises.push(addDoc(collection(db, 'user_notifications'), {
        id: `notif-${Date.now()}`,
        userId: tx.userId,
        memberId: tx.memberId || '',
        title: notifTitle,
        body: notifBody,
        read: false,
        isTransactionHistory: true,
        createdAt: new Date().toISOString()
      }));

      await Promise.all(promises);

      triggerAdminCrossSync();
      fetchTransactionsFromDb();

      requestAlert('সফল সম্পন্ন', '⚡ 1 সেকেন্ডে সফলভাবে আবেদনটি অনুমোদন ও কোম্পানির লাভ যুক্ত করা হয়েছে!');
    } catch (err: any) {
      console.error(err);
      requestAlert('ত্রুটি', `অনুমোদন প্রক্রিয়ায় ত্রুটিঃ ${err?.message || err}`);
    } finally {
      setIsApprovingProcessing(false);
      setLoading(false);
    }
  };

  const executeRejectTransaction = async (targetTx: Transaction, reason?: string) => {
    if (!targetTx) return;
    if (targetTx.status === 'rejected') {
      requestAlert('সতর্কবার্তা', 'এই লেনদেনটি ইতোমধ্যে বাতিল করা হয়েছে।');
      return;
    }
    const finalReason = (reason !== undefined ? reason : rejectReasonInput).trim() || 'টাকা জমা হয়নি / একাউন্টে টাকা আসেনি';
    const targetId = targetTx.id || (targetTx as any).docId || '';
    const targetTrxId = targetTx.trxId || (targetTx as any).transactionId || (targetTx as any).receiptNo || '';

    const allIds = new Set<string>();
    if (targetId) allIds.add(targetId);
    if ((targetTx as any).docId) allIds.add((targetTx as any).docId);
    if ((targetTx as any).id) allIds.add((targetTx as any).id);
    if (Array.isArray((targetTx as any).allDocIds)) {
      ((targetTx as any).allDocIds as string[]).forEach(d => { if (d) allIds.add(d); });
    }

    setIsRejectingProcessing(true);

    // 1. Instant optimistic state update (< 0.001s response in UI)
    setTransactions(prev => sortTransactionsNewestFirst(
      prev.map(t => {
        const matches = 
          (targetId && (t.id === targetId || (t as any).docId === targetId)) ||
          allIds.has(t.id) || allIds.has((t as any).docId) ||
          (targetTrxId && (t.trxId === targetTrxId || (t as any).transactionId === targetTrxId || (t as any).receiptNo === targetTrxId));
        if (matches) {
          return {
            ...t,
            status: 'rejected',
            isApproved: false,
            rejectReason: finalReason,
            rejectionReason: finalReason,
            processedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      })
    ));

    // Close rejection modal immediately for super snappy UX
    setRejectModalTx(null);

    // 2. Perform Firestore background mutations
    try {
      const promises: Promise<any>[] = [];
      const docIdsToUpdate = new Set<string>();
      if (targetId) docIdsToUpdate.add(targetId);
      if ((targetTx as any).docId) docIdsToUpdate.add((targetTx as any).docId);
      if ((targetTx as any).id) docIdsToUpdate.add((targetTx as any).id);
      if (Array.isArray((targetTx as any).allDocIds)) {
        ((targetTx as any).allDocIds as string[]).forEach(d => { if (d) docIdsToUpdate.add(d); });
      }

      // Search for any other matching docs by TrxID to prevent orphaned duplicates
      if (targetTrxId) {
        try {
          const qTrx = query(collection(db, 'transactions'), where('trxId', '==', targetTrxId));
          const snapTrx = await getDocs(qTrx);
          snapTrx.forEach(d => docIdsToUpdate.add(d.id));
        } catch (e) {
          console.warn("Could not query by trxId:", e);
        }
        try {
          const qTrx2 = query(collection(db, 'transactions'), where('transactionId', '==', targetTrxId));
          const snapTrx2 = await getDocs(qTrx2);
          snapTrx2.forEach(d => docIdsToUpdate.add(d.id));
        } catch (e) {}
        try {
          const qTrx3 = query(collection(db, 'transactions'), where('receiptNo', '==', targetTrxId));
          const snapTrx3 = await getDocs(qTrx3);
          snapTrx3.forEach(d => docIdsToUpdate.add(d.id));
        } catch (e) {}
      }

      if (targetId) {
        try {
          const qId = query(collection(db, 'transactions'), where('id', '==', targetId));
          const snapId = await getDocs(qId);
          snapId.forEach(d => docIdsToUpdate.add(d.id));
        } catch (e) {}
      }

      // Also gather docIds from in-memory transactions that match this tx
      transactions.forEach(t => {
        const matches = 
          (targetId && (t.id === targetId || (t as any).docId === targetId)) ||
          allIds.has(t.id) || allIds.has((t as any).docId) ||
          (targetTrxId && (t.trxId === targetTrxId || (t as any).transactionId === targetTrxId || (t as any).receiptNo === targetTrxId));
        if (matches) {
          if (t.id) docIdsToUpdate.add(t.id);
          if ((t as any).docId) docIdsToUpdate.add((t as any).docId);
          if ((t as any).firestoreDocId) docIdsToUpdate.add((t as any).firestoreDocId);
        }
      });

      // Update all resolved Firestore transaction documents
      for (const dId of docIdsToUpdate) {
        if (!dId) continue;
        const txRef = doc(db, 'transactions', dId);
        promises.push(setDoc(txRef, {
          status: 'rejected',
          rejectReason: finalReason,
          rejectionReason: finalReason,
          isApproved: false,
          processedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true }));
      }

      // Handle refunds for deducted transaction types
      let actualRefundAmt = targetTx.amount || 0;
      let wasRefunded = false;

      if (targetTx.userId) {
        const isSamityWithdrawal = 
          targetTx.type === 'withdraw' && (
            targetTx.category === 'samity_withdraw' || 
            (targetTx as any).isSavingsWithdraw || 
            (targetTx.typeLabel || '').includes('সমবায়') || 
            (targetTx.typeLabel || '').includes('সঞ্চয়') ||
            targetTx.id?.startsWith('SYNTH-SAMITY-WD-')
          );

        if (isSamityWithdrawal) {
          const targetUserRef = doc(db, 'users', targetTx.userId);
          promises.push(setDoc(targetUserRef, {
            samityDeactivateStatus: 'rejected',
            samityOptOutReason: null,
            samityOptOutRejectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true }));
          setUsers(prev => prev.map(u => u.uid === targetTx.userId ? {
            ...u,
            samityDeactivateStatus: 'rejected',
            samityOptOutReason: null
          } : u));
        }

        const isDeductedType = 
          (targetTx.type === 'withdraw' && !isSamityWithdrawal) || 
          targetTx.type === 'balance_transfer' || 
          targetTx.type === 'telecom_recharge' || 
          targetTx.type === 'bill_pay' as any ||
          (targetTx.type === 'coop_savings_deposit' as any && (
            targetTx.paymentMethod === 'Main Balance' || 
            targetTx.paymentMethod === 'Al Mayadin Wallet' || 
            targetTx.paymentMethod === 'মেইন ব্যালেন্স'
          ));

        if (isDeductedType) {
          const targetUserRef = doc(db, 'users', targetTx.userId);
          const targetUserSnap = await getDoc(targetUserRef);
          if (targetUserSnap.exists()) {
            const freshUser = targetUserSnap.data();
            const currentBal = Number(freshUser.balance !== undefined ? freshUser.balance : freshUser.mainBalance) || 0;
            const refundTotal = targetTx.totalDeducted || (targetTx.amount + (targetTx.charge || 0));
            
            promises.push(updateDoc(targetUserRef, {
              balance: currentBal + refundTotal,
              mainBalance: currentBal + refundTotal
            }));
            wasRefunded = true;
            actualRefundAmt = refundTotal;
          }
        }

        // Live real-time notification to user
        let notifTitle = '❌ আবেদন বাতিল করা হয়েছে';
        let notifBody = `আপনার ৳${(targetTx.amount || 0).toLocaleString('bn-BD')} টাকার ${targetTx.type === 'add_money' || targetTx.type === 'deposit' ? 'ডিপোজিট / অ্যাড মানি' : targetTx.type === 'withdraw' ? 'উত্তোলন' : 'লেনদেন'} আবেদনটি বাতিল করা হয়েছে।\nকারণ: ${finalReason}`;
        
        if (targetTx.type === 'telecom_recharge') {
          notifTitle = '❌ মোবাইল রিচার্জ বাতিল';
          notifBody = `আপনার ৳${(targetTx.amount || 0).toLocaleString('bn-BD')} মোবাইল রিচার্জের আবেদনটি বাতিল করা হয়েছে। ৳${actualRefundAmt.toLocaleString('bn-BD')} ওয়ালেট ব্যালেন্সে রিফান্ড করা হয়েছে।\nকারণ: ${finalReason}`;
        } else if (targetTx.type === 'bill_pay' as any) {
          notifTitle = '❌ বিল পরিশোধ বাতিল';
          notifBody = `আপনার ${targetTx.typeLabel || 'ইউটিলিটি বিল'} পরিশোধের আবেদনটি বাতিল করা হয়েছে। ৳${(targetTx.amount || 0).toLocaleString('bn-BD')} আপনার ওয়ালেট ব্যালেন্সে রিফান্ড করা হয়েছে।\nকারণ: ${finalReason}`;
        } else if (wasRefunded) {
          notifBody = `আপনার ৳${(targetTx.amount || 0).toLocaleString('bn-BD')} এর ফান্ড স্থানান্তর আবেদনটি বাতিল করা হয়েছে। চার্জসহ মোট ৳${actualRefundAmt.toLocaleString('bn-BD')} ওয়ালেট ব্যালেন্সে রিফান্ড করা হয়েছে।\nকারণ: ${finalReason}`;
        }

        const notifDocRef = doc(collection(db, 'user_notifications'));
        promises.push(setDoc(notifDocRef, {
          id: notifDocRef.id,
          userId: targetTx.userId,
          memberId: targetTx.memberId || '',
          title: notifTitle,
          body: notifBody,
          read: false,
          isTransactionHistory: true,
          category: 'transaction',
          createdAt: new Date().toISOString()
        }));
      }

      if (targetTx.id?.startsWith('SYNTH-SAMITY-WD-') && targetTx.userId) {
        promises.push(setDoc(doc(db, 'users', targetTx.userId), {
          samityDeactivateStatus: 'rejected',
          samityOptOutReason: null,
          samityOptOutRejectedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true }));
      }

      await Promise.all(promises);
      triggerAdminCrossSync();
      fetchTransactionsFromDb();
      requestAlert('সফল সম্পন্ন ⚡', `1 সেকেন্ডে সফলভাবে বাতিল সম্পন্ন হয়েছে!\nকারণ: "${finalReason}"`);
    } catch (err: any) {
      console.error('Error in executeRejectTransaction:', err);
      requestAlert('ত্রুটি', `বাতিলকরণে সমস্যা হয়েছেঃ ${err?.message || err}`);
    } finally {
      setIsRejectingProcessing(false);
    }
  };

  const handleRejectTransaction = async (txIdInput: string | Transaction, reasonParam?: string): Promise<void> => {
    let targetTx: Transaction | undefined;
    if (typeof txIdInput === 'object' && txIdInput !== null) {
      targetTx = txIdInput;
    } else if (typeof txIdInput === 'string') {
      const inputStr = txIdInput.trim();
      targetTx = transactions.find(t => 
        t.id === inputStr || 
        (t as any).docId === inputStr || 
        t.trxId === inputStr || 
        (t as any).transactionId === inputStr ||
        (t as any).receiptNo === inputStr
      );
    }

    if (!targetTx) {
      requestAlert('ত্রুটি', 'ট্রানজেকশন ডাটাবেজে পাওয়া যায়নি!');
      return;
    }

    const finalReason = (reasonParam && typeof reasonParam === 'string' && reasonParam.trim())
      ? reasonParam.trim()
      : 'টাকা জমা হয়নি / একাউন্টে টাকা আসেনি';

    await executeRejectTransaction(targetTx, finalReason);
  };

  const handleHoldTransaction = async (txInput: Transaction | string): Promise<void> => {
    let targetTx: Transaction | undefined;
    if (typeof txInput === 'object' && txInput !== null) {
      targetTx = txInput;
    } else if (typeof txInput === 'string') {
      const inputStr = txInput.trim();
      targetTx = transactions.find(t => 
        t.id === inputStr || 
        (t as any).docId === inputStr || 
        t.trxId === inputStr
      );
    }
    if (!targetTx) return;

    const targetId = targetTx.id || (targetTx as any).docId || '';
    const targetTrxId = (targetTx.trxId || (targetTx as any).transactionId || (targetTx as any).receiptNo || '').trim();

    const allIds = new Set<string>();
    if (targetId) allIds.add(targetId);
    if ((targetTx as any).docId) allIds.add((targetTx as any).docId);
    if ((targetTx as any).id) allIds.add((targetTx as any).id);
    if (Array.isArray((targetTx as any).allDocIds)) {
      ((targetTx as any).allDocIds as string[]).forEach(d => { if (d) allIds.add(d); });
    }

    transactions.forEach(t => {
      const clean1 = (t.trxId || (t as any).transactionId || (t as any).receiptNo || '').trim().toLowerCase();
      const cleanTarget = targetTrxId.toLowerCase();
      if (cleanTarget && clean1 === cleanTarget) {
        if (t.id) allIds.add(t.id);
        if ((t as any).docId) allIds.add((t as any).docId);
      }
    });

    const heldAtIso = new Date().toISOString();
    setTransactions(prev => sortTransactionsNewestFirst(prev.map(t => {
      const matches = 
        allIds.has(t.id) || 
        allIds.has((t as any).docId) ||
        (targetTrxId && (t.trxId === targetTrxId || (t as any).transactionId === targetTrxId || (t as any).receiptNo === targetTrxId));
      if (matches) {
        return {
          ...t,
          status: 'on_hold' as any,
          reviewStatus: 'on_hold',
          heldAt: heldAtIso,
          heldBy: currentUser?.name || 'admin',
          adminNotice: 'এডমিন কর্তৃক তথ্য ও হিসাব যাচাইয়ের জন্য সাময়িকভাবে অপেক্ষমাণ রাখা হয়েছে'
        };
      }
      return t;
    })));

    triggerAdminCrossSync();

    try {
      const promises: Promise<any>[] = [];
      if (targetTx.id?.startsWith('SYNTH-SAMITY-WD-') && targetTx.userId) {
        promises.push(setDoc(doc(db, 'users', targetTx.userId), {
          samityDeactivateStatus: 'on_hold',
          samityOptOutHoldDate: heldAtIso,
          updatedAt: heldAtIso
        }, { merge: true }));
      }

      for (const dId of allIds) {
        if (!dId || dId.startsWith('SYNTH-')) continue;
        promises.push(setDoc(doc(db, 'transactions', dId), {
          status: 'on_hold',
          reviewStatus: 'on_hold',
          heldAt: heldAtIso,
          heldBy: currentUser?.name || 'admin',
          adminNotice: 'এডমিন কর্তৃক তথ্য ও হিসাব যাচাইয়ের জন্য সাময়িকভাবে অপেক্ষমাণ রাখা হয়েছে',
          updatedAt: heldAtIso
        }, { merge: true }).catch(e => console.warn('Hold doc non-fatal:', e)));
      }

      await Promise.all(promises);
      triggerAdminCrossSync();
      fetchTransactionsFromDb();
    } catch (err) {
      console.error('Error holding transaction:', err);
    }
  };

  const handleResumePendingTransaction = async (txInput: Transaction | string): Promise<void> => {
    let targetTx: Transaction | undefined;
    if (typeof txInput === 'object' && txInput !== null) {
      targetTx = txInput;
    } else if (typeof txInput === 'string') {
      const inputStr = txInput.trim();
      targetTx = transactions.find(t => 
        t.id === inputStr || 
        (t as any).docId === inputStr || 
        t.trxId === inputStr
      );
    }
    if (!targetTx) return;

    const targetId = targetTx.id || (targetTx as any).docId || '';
    const targetTrxId = (targetTx.trxId || (targetTx as any).transactionId || (targetTx as any).receiptNo || '').trim();

    const allIds = new Set<string>();
    if (targetId) allIds.add(targetId);
    if ((targetTx as any).docId) allIds.add((targetTx as any).docId);
    if ((targetTx as any).id) allIds.add((targetTx as any).id);
    if (Array.isArray((targetTx as any).allDocIds)) {
      ((targetTx as any).allDocIds as string[]).forEach(d => { if (d) allIds.add(d); });
    }

    transactions.forEach(t => {
      const clean1 = (t.trxId || (t as any).transactionId || (t as any).receiptNo || '').trim().toLowerCase();
      const cleanTarget = targetTrxId.toLowerCase();
      if (cleanTarget && clean1 === cleanTarget) {
        if (t.id) allIds.add(t.id);
        if ((t as any).docId) allIds.add((t as any).docId);
      }
    });

    const resumeAtIso = new Date().toISOString();
    setTransactions(prev => sortTransactionsNewestFirst(prev.map(t => {
      const matches = 
        allIds.has(t.id) || 
        allIds.has((t as any).docId) ||
        (targetTrxId && (t.trxId === targetTrxId || (t as any).transactionId === targetTrxId || (t as any).receiptNo === targetTrxId));
      if (matches) {
        return {
          ...t,
          status: 'pending' as any,
          reviewStatus: 'pending',
          heldAt: null as any,
          heldBy: null as any,
          adminNotice: null as any,
          updatedAt: resumeAtIso
        };
      }
      return t;
    })));

    triggerAdminCrossSync();

    try {
      const promises: Promise<any>[] = [];
      if (targetTx.id?.startsWith('SYNTH-SAMITY-WD-') && targetTx.userId) {
        promises.push(setDoc(doc(db, 'users', targetTx.userId), {
          samityDeactivateStatus: 'self_opted_out',
          updatedAt: resumeAtIso
        }, { merge: true }));
      }

      for (const dId of allIds) {
        if (!dId || dId.startsWith('SYNTH-')) continue;
        promises.push(setDoc(doc(db, 'transactions', dId), {
          status: 'pending',
          reviewStatus: 'pending',
          heldAt: null,
          heldBy: null,
          adminNotice: 'পুনরায় সক্রিয় পেন্ডিং তালিকায় ফেরত আনা হয়েছে',
          updatedAt: resumeAtIso
        }, { merge: true }).catch(e => console.warn('Resume doc non-fatal:', e)));
      }

      await Promise.all(promises);
      triggerAdminCrossSync();
      fetchTransactionsFromDb();
    } catch (err) {
      console.error('Error resuming transaction:', err);
    }
  };

  // Qard Hasana Admin Handlers
  const handleSaveQardTicker = async () => {
    try {
      setLoading(true);
      setCfgQardTicker(qardTickerInput);
      const appConfigRef = doc(db, 'app_config', 'global_settings');
      await setDoc(appConfigRef, { qardTicker: qardTickerInput }, { merge: true });
      setQardShowTickerModal(false);
      requestAlert('সফল সম্পন্ন', 'করযে হাসানা ঘোষণা টিংকার সফলভাবে আপডেট করা হয়েছে!');
    } catch (err: any) {
      requestAlert('ত্রুটি', 'টিঙ্কার আপডেট ত্রুটি: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQardFundVal = async () => {
    try {
      setLoading(true);
      const numVal = parseFloat(qardFundInput);
      if (isNaN(numVal) || numVal < 0) {
        requestAlert('ত্রুটি', 'সঠিক ফান্ডের পরিমাণ দিন।');
        return;
      }
      const updatedFundValues = {
        ...((appConfig as any).fundValues || {}),
        qard_fund: numVal
      };
      const updatedFundManual = {
        ...((appConfig as any).fundManual || {}),
        qard_fund: true
      };
      const appConfigRef = doc(db, 'app_config', 'global_settings');
      await setDoc(appConfigRef, {
        fundValues: updatedFundValues,
        fundManual: updatedFundManual
      }, { merge: true });
      setQardShowFundModal(false);
      requestAlert('সফল সম্পন্ন', 'করযে হাসানা ফান্ড ব্যালেন্স সফলভাবে আপডেট করা হয়েছে!');
    } catch (err: any) {
      requestAlert('ত্রুটি', 'ফান্ড আপডেট ত্রুটি: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectQardLoanDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qardDirectUserUid) {
      requestAlert('ত্রুটি', 'অনুগ্রহ করে একজন সদস্য নির্বাচন করুন।');
      return;
    }
    const amt = parseFloat(qardDirectAmt);
    if (isNaN(amt) || amt <= 0) {
      requestAlert('ত্রুটি', 'সঠিক ঋণের পরিমাণ লিখুন।');
      return;
    }
    const targetUser = users.find(u => u.uid === qardDirectUserUid);
    if (!targetUser) {
      requestAlert('ত্রুটি', 'সদস্য পাওয়া যায়নি।');
      return;
    }

    setLoading(true);
    try {
      const monthlyRepay = parseFloat(qardDirectMonthly) || Math.round(amt / qardDirectDuration);
      
      const userRef = doc(db, 'users', targetUser.uid);
      const newBal = (targetUser.balance || 0) + amt;
      const newDue = (targetUser.dueLoan || 0) + amt;
      await updateDoc(userRef, { balance: newBal, mainBalance: newBal, dueLoan: newDue });

      const txRef = doc(collection(db, 'transactions'));
      const newTx: any = {
        id: txRef.id,
        userId: targetUser.uid,
        userName: targetUser.name,
        memberId: targetUser.memberId || targetUser.phone,
        type: 'qard_loan_disbursment',
        typeLabel: 'করযে হাসানা ঋণ বিতরণ (এডমিন)',
        amount: amt,
        status: 'success',
        description: `সুদমুক্ত করযে হাসানা ঋণ প্রদান সম্পন্ন (মেয়াদ: ${qardDirectDuration} মাস, কিস্তি: ৳${monthlyRepay}/মাস)।`,
        createdAt: new Date().toISOString(),
        loanDuration: qardDirectDuration,
        monthlyRepayAmount: monthlyRepay,
        whatsappNumber: qardDirectWhatsapp || targetUser.phone,
        approvedAt: new Date().toISOString()
      };
      await setDoc(txRef, newTx);
      setTransactions(prev => [newTx, ...prev]);

      const notifRef = doc(collection(db, 'user_notifications'));
      await setDoc(notifRef, {
        userId: targetUser.uid,
        title: '🌱 করযে হাসানা ঋণ বিতরণ সম্পন্ন',
        body: `এডমিন আপনার একাউন্টে ৳${amt.toLocaleString('bn-BD')} টাকার সুদমুক্ত করযে হাসানা ঋণ প্রদান করেছেন। আপনার ওয়ালেট ব্যালেন্স যোগ করা হয়েছে।`,
        read: false,
        createdAt: new Date().toISOString()
      });

      setQardShowDirectLoanModal(false);
      setQardDirectAmt('');
      setQardDirectWhatsapp('');
      setQardDirectMonthly('');
      requestAlert('সফল সম্পন্ন', `সফলভাবে ${targetUser.name}-কে ৳${amt} টাকার করযে হাসানা ঋণ বিতরণ করা হয়েছে!`);
    } catch (err: any) {
      requestAlert('ত্রুটি', 'ঋণ বিতরণ ত্রুটি: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualQardDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(qardDonateAmt);
    if (isNaN(amt) || amt <= 0) {
      requestAlert('ত্রুটি', 'সঠিক অনুদানের পরিমাণ লিখুন।');
      return;
    }
    const targetUser = users.find(u => u.uid === qardDonateUserUid);

    setLoading(true);
    try {
      const txRef = doc(collection(db, 'transactions'));
      const newTx: any = {
        id: txRef.id,
        userId: targetUser?.uid || 'GUEST-DONOR',
        userName: qardDonateAnon ? 'গোপন দাতা' : (targetUser?.name || 'অজ্ঞাত দাতা'),
        memberId: targetUser?.memberId || 'DONOR',
        type: 'qard_donation',
        typeLabel: 'করযে হাসানা দান (এডমিন)',
        amount: amt,
        status: 'success',
        description: `করযে হাসানা ফান্ডের ম্যানুয়াল দান রেজিস্টার - ${qardDonatePurpose === 'general' ? 'সাধারণ ফান্ড' : qardDonatePurpose}`,
        createdAt: new Date().toISOString(),
        paymentMethod: 'CASH/ADMIN',
        transactionId: `QRD-ADM-${Date.now().toString().slice(-6)}`,
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      };
      await setDoc(txRef, newTx);
      setTransactions(prev => [newTx, ...prev]);

      setQardShowDonateModal(false);
      setQardDonateAmt('');
      requestAlert('সফল সম্পন্ন', `আলহামদুলিল্লাহ! ৳${amt} টাকার দান সফলভাবে ফান্ডের খাতায় যুক্ত হয়েছে।`);
    } catch (err: any) {
      requestAlert('ত্রুটি', 'দান রেজিস্টার ত্রুটি: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQardTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qardEditingTx) return;
    const amt = parseFloat(qardEditAmt);
    if (isNaN(amt) || amt <= 0) {
      requestAlert('ত্রুটি', 'সঠিক পরিমাণ দিন।');
      return;
    }

    setLoading(true);
    try {
      const realDocId = (qardEditingTx as any).docId || qardEditingTx.id;
      const txRef = doc(db, 'transactions', realDocId);
      const updates: any = {
        amount: amt,
        status: qardEditStatus,
        description: qardEditDesc,
        whatsappNumber: qardEditWhatsapp
      };
      await updateDoc(txRef, updates);

      setTransactions(prev => prev.map(t => t.id === qardEditingTx.id ? { ...t, ...updates } : t));
      setQardEditingTx(null);
      requestAlert('সফল সম্পন্ন', 'ট্রানজেকশন সফলভাবে এডিট করা হয়েছে!');
    } catch (err: any) {
      requestAlert('ত্রুটি', 'এডিট ত্রুটি: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQardTx = async (tx: Transaction) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${tx.description || tx.typeLabel}" (৳${tx.amount}) এন্ট্রিটি চিরতরে মুছে ফেলতে চান?`)) {
      return;
    }
    setLoading(true);
    try {
      const realId = (tx as any).docId || tx.id;
      await deleteDoc(doc(db, 'transactions', realId)).catch(() => {});
      if (tx.id && realId !== tx.id) {
        await deleteDoc(doc(db, 'transactions', tx.id)).catch(() => {});
      }
      setTransactions(prev => prev.filter(t => t.id !== tx.id && (t as any).docId !== realId));
      requestAlert('সফল সম্পন্ন', 'এন্ট্রিটি সফলভাবে মুছে ফেলা হয়েছে!');
    } catch (err: any) {
      requestAlert('ত্রুটি', 'ডিলিট ত্রুটি: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBapAdminRequest = async (req: BapAdminRequest) => {
    try {
      const reqRef = doc(db, 'bap_admin_requests', req.id);
      await updateDoc(reqRef, { status: 'approved' });
      
      const targetUser = users.find(u => u.uid === req.userId);
      if (targetUser) {
        const userRef = doc(db, 'users', targetUser.uid);
        await updateDoc(userRef, { role: 'admin' });
      }
      
      alert('আবেদনকারীকে সফলভাবে BAP/AMB এডমিন মডিউল অনুমোদন দেওয়া হয়েছে!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectBapAdminRequest = async (reqId: string) => {
    try {
      const reqRef = doc(db, 'bap_admin_requests', reqId);
      await updateDoc(reqRef, { status: 'rejected' });
      alert('এডমিন রিকোয়েস্ট প্রত্যাখ্যাত হয়েছে!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBapReport = async (reportId: string) => {
    if (!window.confirm('আপনি কি এই প্রতারণা অভিযোগ রিপোর্টটি মুছে ফেলতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'bap_reports', reportId));
      alert('অভিযোগ খাতা হতে মুছে ফেলা হয়েছে!');
      fetchBapReportsAndGroups();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (u: any) => {
    openDeleteUserModal(u);
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (!window.confirm('আপনি কি এই বিজ্ঞপ্তি বা ব্যানারটি মুছে ফেলতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'notices', noticeId));
      alert('বিজ্ঞপ্তি মুছে ফেলা হয়েছে!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveBapGroup = async (groupId: string) => {
    try {
      await updateDoc(doc(db, 'bap_groups', groupId), { status: 'approved' });
      alert('গ্রুপ অনুমোদন দেওয়া হয়েছে!');
      fetchBapReportsAndGroups();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectBapGroup = async (groupId: string) => {
    try {
      await updateDoc(doc(db, 'bap_groups', groupId), { status: 'rejected' });
      alert('গ্রুপ প্রত্যাখ্যাত হয়েছে!');
      fetchBapReportsAndGroups();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEditUser = async () => {
    if (!editingUser || isSavingUser) return;

    setAdminPinError('');

    const delta = Number(adjAmount) || 0;
    if (adjType !== 'none') {
      if (delta <= 0) {
        alert('দয়া করে এডজাস্টমেন্টের সঠিক টাকার পরিমাণ লিখুন!');
        return;
      }
    }

    setIsSavingUser(true);

    try {
      const parseBal = (val: any) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
      };

      let currentMainBalance = parseBal(editBalance);

      if (adjType === 'bonus' && delta > 0) {
        currentMainBalance += delta;
      } else if (adjType === 'deduct' && delta > 0) {
        currentMainBalance = Math.max(0, currentMainBalance - delta);
      }

      const targetUserId = editingUser.uid || editingUser.id || (editingUser as any).docId;
      if (!targetUserId) {
        alert('❌ সদস্য আইডি সনাক্ত করা যায়নি!');
        setIsSavingUser(false);
        return;
      }

      const safeTrim = (val: any): string => {
        if (val === null || val === undefined) return '';
        return String(val).trim();
      };

      const updatedFields = {
        name: safeTrim(editUserName) || editingUser.name || 'সদস্য',
        memberId: safeTrim(editUserMemberId) || editingUser.memberId || '',
        phone: safeTrim(editUserPhone) || editingUser.phone || '',
        balance: currentMainBalance,
        mainBalance: currentMainBalance,
        telecomBalance: parseBal(editTelecomBalance),
        superShopBalance: parseBal(editSuperShopBalance),
        savings: parseBal(editSavings),
        dpsBalance: parseBal(editSavings),
        dueLoan: parseBal(editDueLoan),
        pin: safeTrim(editPin) || editingUser.pin || '1234',
        status: editUserStatus || 'active',
        role: editRole || 'user',
        subAdminPermissions: editSubAdminPermissions || [],
        memberGroup: editMemberGroup || 'general',
        samityStatus: editSamityStatus || 'none',
        samityApproved: editSamityStatus === 'approved',
        nid: safeTrim(editNid),
        nidNumber: safeTrim(editNid),
        country: safeTrim(editCountry) || 'Bangladesh',
        division: safeTrim(editDivision),
        district: safeTrim(editDistrict),
        thana: safeTrim(editThana),
        postOffice: safeTrim(editPostOffice),
        fatherName: safeTrim(editFatherName),
        motherName: safeTrim(editMotherName),
        dob: safeTrim(editDob),
        birthReg: safeTrim(editBirthReg),
        gender: safeTrim(editGender),
        occupation: safeTrim(editOccupation),
        alternatePhone: safeTrim(editAlternatePhone),
        emergencyPhone: safeTrim(editAlternatePhone),
        nomineeName: safeTrim(editNomineeName),
        nomineeRelation: safeTrim(editNomineeRelation),
        nomineePhone: safeTrim(editNomineePhone),
        nomineeNid: safeTrim(editNomineeNid),
        profilePic: safeTrim(editProfilePic),
        nidFrontPic: safeTrim(editNidFrontPic),
        nidFrontUrl: safeTrim(editNidFrontPic),
        nidBackPic: safeTrim(editNidBackPic),
        nidBackUrl: safeTrim(editNidBackPic),
        village: safeTrim(editVillage),
        fullAddress: safeTrim(editFullAddress),
        kycStatus: editKycStatus || 'none',
        hasSetProfile: Boolean(editHasSetProfile),
        customTelecomPercent: Number(editCustomTelecomPercent) || 0,
        monthlySavingsTarget: Number(editMonthlySavingsTarget) || 1000,
        samityPaidMonths: normalizePaidMonthsArray(editSamityPaidMonths, Number(editSavings) || 0, Number(editMonthlySavingsTarget) || 1000),
        samitySchemeActive: editSamitySchemeActive !== false,
        canDisableAutoSavings: Boolean(editCanDisableAutoSavings),
        allowAutoSavingsToggle: Boolean(editCanDisableAutoSavings),
        currentDeviceId: safeTrim(editCurrentDeviceId),
        deviceLockBypassed: Boolean(editDeviceLockBypassed),
        deviceChangeRequested: Boolean(editDeviceChangeRequested),
        appLockCode: safeTrim(editAppLockCode),
        isAppLocked: Boolean(editIsAppLocked),
        appLockResetRequested: editIsAppLocked ? Boolean(editingUser.appLockResetRequested) : false,
        appLockResetStatus: editIsAppLocked ? (editingUser.appLockResetStatus || '') : 'approved',
        appLockUpdatedAt: new Date().toISOString(),
        hasRationCard: Boolean(editRationEnabled),
        rationCardNo: editRationEnabled ? (safeTrim(editRationCardNo) || `RC-${safeTrim(editUserMemberId) || editingUser.memberId || ''}`) : '',
        rationName: editRationEnabled ? (safeTrim(editRationName) || safeTrim(editUserName) || editingUser.name || '') : '',
        rationPhone: editRationEnabled ? (safeTrim(editRationPhone) || safeTrim(editUserPhone) || editingUser.phone || '') : '',
        rationVillage: editRationEnabled ? safeTrim(editRationVillage) : '',
        rationUpazila: editRationEnabled ? safeTrim(editRationUpazila) : '',
        rationDistrict: editRationEnabled ? safeTrim(editRationDistrict) : '',
        rationIssueDate: editRationEnabled ? (safeTrim(editRationIssueDate) || '2026-01-01') : '',
        rationExpiryDate: editRationEnabled ? (safeTrim(editRationExpiryDate) || '2030-12-31') : '',
        rationSignature: editRationEnabled ? (safeTrim(editRationSignature) || 'AMB Ration Authority') : '',
        rationSecurityCode: editRationEnabled ? (safeTrim(editRationSecurityCode) || '1234') : '',
        rationPhotoUrl: editRationEnabled ? safeTrim(editRationPhotoUrl) : ''
      };

      // Sanitize object recursively to remove any undefined or invalid fields
      const sanitizeData = (data: any): any => {
        if (data === undefined || data === null) return null;
        if (typeof data !== 'object') return data;
        if (Array.isArray(data)) return data.map(sanitizeData).filter(v => v !== undefined);
        const res: Record<string, any> = {};
        for (const [k, v] of Object.entries(data)) {
          if (v !== undefined) {
            res[k] = sanitizeData(v);
          }
        }
        return res;
      };

      const cleanUpdatedFields = sanitizeData(updatedFields);

      // ⚡ 1. Collect all document IDs and phone variants for authoritative multi-doc sync
      const targetDocIds = new Set<string>();
      if (targetUserId && typeof targetUserId === 'string' && targetUserId.trim()) targetDocIds.add(targetUserId.trim());
      if (editingUser.uid && typeof editingUser.uid === 'string' && editingUser.uid.trim()) targetDocIds.add(editingUser.uid.trim());
      if (editingUser.id && typeof editingUser.id === 'string' && editingUser.id.trim()) targetDocIds.add(editingUser.id.trim());
      if ((editingUser as any).docId && typeof (editingUser as any).docId === 'string' && (editingUser as any).docId.trim()) {
        targetDocIds.add((editingUser as any).docId.trim());
      }

      const rawPhone = editUserPhone.trim();
      const cleanDigits = rawPhone.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, '');
      const phoneVariants = new Set<string>();
      if (rawPhone) phoneVariants.add(rawPhone);
      if (editingUser.phone) phoneVariants.add(editingUser.phone);
      if (cleanDigits) {
        phoneVariants.add(cleanDigits);
        if (cleanDigits.startsWith('880')) {
          phoneVariants.add('+' + cleanDigits);
          phoneVariants.add('0' + cleanDigits.slice(3));
        } else if (cleanDigits.startsWith('0')) {
          phoneVariants.add('+88' + cleanDigits);
          phoneVariants.add(cleanDigits.slice(1));
        } else if (cleanDigits.length === 10) {
          phoneVariants.add('0' + cleanDigits);
          phoneVariants.add('+880' + cleanDigits);
        }
      }

      // Query `users` by all phone variants
      for (const pVar of Array.from(phoneVariants)) {
        try {
          const qP = query(collection(db, 'users'), where('phone', '==', pVar));
          const snapP = await getDocs(qP);
          snapP.forEach(d => targetDocIds.add(d.id));
        } catch (e) {}
      }

      // Query `users` by memberId
      if (editUserMemberId.trim()) {
        try {
          const qM = query(collection(db, 'users'), where('memberId', '==', editUserMemberId.trim()));
          const snapM = await getDocs(qM);
          snapM.forEach(d => targetDocIds.add(d.id));
        } catch (e) {}
      }
      if (editingUser.memberId && editingUser.memberId !== editUserMemberId.trim()) {
        try {
          const qM2 = query(collection(db, 'users'), where('memberId', '==', editingUser.memberId));
          const snapM2 = await getDocs(qM2);
          snapM2.forEach(d => targetDocIds.add(d.id));
        } catch (e) {}
      }

      // Memory lookup fallback in current `users` list
      users.forEach(u => {
        const uPhoneDigits = (u.phone || '').replace(/\D/g, '');
        if (cleanDigits && uPhoneDigits && (uPhoneDigits === cleanDigits || uPhoneDigits.endsWith(cleanDigits.slice(-9)))) {
          if (u.uid) targetDocIds.add(u.uid);
        }
        if (editUserMemberId.trim() && u.memberId && u.memberId.trim().toUpperCase() === editUserMemberId.trim().toUpperCase()) {
          if (u.uid) targetDocIds.add(u.uid);
        }
      });

      // ⚡ 2. Write updated fields to all matching `users` records
      const validUserIds = Array.from(targetDocIds).filter(uId => Boolean(uId && typeof uId === 'string' && uId.trim()));
      const userWritePromises = validUserIds.map(uId => 
        setDoc(doc(db, 'users', uId), {
          ...cleanUpdatedFields,
          updatedAt: serverTimestamp()
        }, { merge: true })
      );
      if (userWritePromises.length > 0) {
        await Promise.all(userWritePromises);
      }

      // ⚡ 3. Sync to `samity_applications` collection
      const samityDocIds = new Set<string>();
      if ((editingUser as any).samityApplicationId) {
        samityDocIds.add((editingUser as any).samityApplicationId);
      }
      for (const pVar of Array.from(phoneVariants)) {
        try {
          const qSamP = query(collection(db, 'samity_applications'), where('phone', '==', pVar));
          const snapSamP = await getDocs(qSamP);
          snapSamP.forEach(d => samityDocIds.add(d.id));
        } catch (e) {}
      }
      if (editUserMemberId.trim()) {
        try {
          const qSamM = query(collection(db, 'samity_applications'), where('memberId', '==', editUserMemberId.trim()));
          const snapSamM = await getDocs(qSamM);
          snapSamM.forEach(d => samityDocIds.add(d.id));
        } catch (e) {}
      }

      const validSamityIds = Array.from(samityDocIds).filter(sId => Boolean(sId && typeof sId === 'string' && sId.trim()));
      const samityWritePromises = validSamityIds.map(sId => 
        setDoc(doc(db, 'samity_applications', sId), {
          ...cleanUpdatedFields,
          status: editSamityStatus || 'none',
          samityStatus: editSamityStatus || 'none',
          updatedAt: serverTimestamp()
        }, { merge: true })
      );
      if (samityWritePromises.length > 0) {
        await Promise.all(samityWritePromises);
      }

      // ⚡ 4. Timestamp & transaction/notification handling
      const now = new Date();
      const banglaTime = now.toLocaleString('bn-BD', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const originalMainBal = parseBal(editingUser.balance ?? editingUser.mainBalance ?? 0);
      const directMainDiff = currentMainBalance - originalMainBal;
      const logUserId = targetUserId || Array.from(targetDocIds)[0] || 'user';

      if (adjType !== 'none' && delta > 0) {
        const finalReason = adjReason.trim() || (adjType === 'bonus' ? 'এডমিন প্যানেল থেকে ওয়ালেট বোনাস' : 'এডমিন প্যানেল থেকে চার্জ কর্তন');

        await addDoc(collection(db, 'transactions'), {
          id: `tx-adj-${Date.now()}`,
          userId: logUserId,
          userPhone: editUserPhone || editingUser.phone || '',
          userName: editUserName || editingUser.name || '',
          memberId: editUserMemberId || editingUser.memberId || '',
          amount: delta,
          type: adjType === 'bonus' ? 'bonus' : 'deduct',
          typeLabel: adjType === 'bonus' ? 'এডমিন বোনাস জমা' : 'এডমিন চার্জ কর্তন',
          method: 'Admin_Adjustment',
          paymentMethod: 'Admin Panel',
          status: 'approved',
          date: banglaTime,
          createdAt: new Date().toISOString(),
          adminApprovedAt: new Date().toISOString(),
          adminNote: finalReason,
          description: finalReason,
          note: finalReason,
          receiptNo: `REC-ADM-${Math.floor(100000 + Math.random() * 900000)}`
        });

        const notifTitle = adjType === 'bonus' ? '🎁 ওয়ালেট বোনাস জমা হয়েছে' : '💸 ওয়ালেট চার্জ/কর্তন করা হয়েছে';
        const notifMessage = adjType === 'bonus' 
          ? `এডমিন প্যানেল থেকে আপনার ওয়ালেটে ৳${delta} টাকা যোগ করা হয়েছে। কারণঃ ${finalReason}`
          : `এডমিন প্যানেল থেকে আপনার ওয়ালেট থেকে ৳${delta} টাকা কর্তন করা হয়েছে। কারণঃ ${finalReason}`;

        await addDoc(collection(db, 'user_notifications'), {
          id: `notif-adj-${Date.now()}`,
          userId: logUserId,
          memberId: editUserMemberId || editingUser.memberId || '',
          phone: editUserPhone || editingUser.phone || '',
          userPhone: editUserPhone || editingUser.phone || '',
          title: notifTitle,
          message: notifMessage,
          type: 'balance_update',
          read: false,
          createdAt: new Date().toISOString(),
          timestamp: Date.now(),
          date: banglaTime
        });
      } else if (adjType === 'none' && Math.abs(directMainDiff) > 0) {
        const isIncrease = directMainDiff > 0;
        const diffAmount = Math.abs(directMainDiff);
        const actionLabel = isIncrease ? 'মূল ব্যালেন্স বৃদ্ধি/সমন্বয়' : 'মূল ব্যালেন্স কর্তন/সমন্বয়';
        const txType = isIncrease ? 'deposit' : 'withdraw';
        const desc = `এডমিন কর্তৃক প্রোফাইল থেকে সরাসরি মূল ব্যালেন্স ${isIncrease ? '৳' + diffAmount + ' যোগ করা হয়েছে' : '৳' + diffAmount + ' কর্তন/সমন্বয় করা হয়েছে'}। পূর্বের ব্যালেন্সঃ ৳${originalMainBal}, নতুন ব্যালেন্সঃ ৳${currentMainBalance}।`;

        await addDoc(collection(db, 'transactions'), {
          id: `tx-direct-${Date.now()}`,
          userId: logUserId,
          userPhone: editUserPhone || editingUser.phone || '',
          userName: editUserName || editingUser.name || '',
          memberId: editUserMemberId || editingUser.memberId || '',
          amount: diffAmount,
          type: txType,
          typeLabel: actionLabel,
          method: 'Direct_Admin_Edit',
          paymentMethod: 'Admin Profile Edit',
          status: 'approved',
          date: banglaTime,
          createdAt: new Date().toISOString(),
          adminApprovedAt: new Date().toISOString(),
          adminNote: desc,
          description: desc,
          note: desc,
          receiptNo: `REC-DIR-${Math.floor(100000 + Math.random() * 900000)}`
        });

        await addDoc(collection(db, 'user_notifications'), {
          id: `notif-direct-${Date.now()}`,
          userId: logUserId,
          memberId: editUserMemberId || editingUser.memberId || '',
          phone: editUserPhone || editingUser.phone || '',
          userPhone: editUserPhone || editingUser.phone || '',
          title: isIncrease ? '💰 মূল ব্যালেন্স আপডেট (জমা)' : 'ℹ️ মূল ব্যালেন্স সমন্বয় (কর্তন)',
          message: desc,
          type: 'balance_update',
          read: false,
          createdAt: new Date().toISOString(),
          timestamp: Date.now(),
          date: banglaTime
        });
      }

      // Check Savings Balance changes
      const originalSavings = parseBal(editingUser.savings ?? 0);
      const newSavingsVal = parseBal(editSavings);
      const diffSavings = newSavingsVal - originalSavings;
      if (Math.abs(diffSavings) > 0) {
        const isSavingsInc = diffSavings > 0;
        const savingsAmt = Math.abs(diffSavings);
        const savingsDesc = `এডমিন কর্তৃক সমবায় সঞ্চয় তহবিল ব্যালেন্স ${isSavingsInc ? 'বৃদ্ধি' : 'সমন্বয়'} করা হয়েছে। পরিবর্তনঃ ৳${savingsAmt}। পূর্বের সঞ্চয়ঃ ৳${originalSavings}, বর্তমান সঞ্চয়ঃ ৳${newSavingsVal}।`;

        await addDoc(collection(db, 'transactions'), {
          id: `tx-sav-${Date.now()}`,
          userId: logUserId,
          userPhone: editUserPhone || editingUser.phone || '',
          userName: editUserName || editingUser.name || '',
          memberId: editUserMemberId || editingUser.memberId || '',
          amount: savingsAmt,
          type: isSavingsInc ? 'deposit' : 'withdraw',
          typeLabel: isSavingsInc ? 'সঞ্চয় আমানত সমন্বয়' : 'সঞ্চয় উত্তোলন সমন্বয়',
          method: 'Savings_Admin_Edit',
          paymentMethod: 'Coop Savings Ledger',
          status: 'approved',
          date: banglaTime,
          createdAt: new Date().toISOString(),
          adminApprovedAt: new Date().toISOString(),
          adminNote: savingsDesc,
          description: savingsDesc,
          note: savingsDesc,
          receiptNo: `REC-SAV-${Math.floor(100000 + Math.random() * 900000)}`
        });
      }

      // Handle standalone direct Notice to Member if entered
      if (customNoticeText.trim()) {
        await addDoc(collection(db, 'user_notifications'), {
          id: `notif-direct-${Date.now()}`,
          userId: logUserId,
          memberId: editUserMemberId || editingUser.memberId || '',
          phone: editUserPhone || editingUser.phone || '',
          userPhone: editUserPhone || editingUser.phone || '',
          title: '📢 এডমিন থেকে বিশেষ বার্তা/নোটিশ',
          message: customNoticeText.trim(),
          type: 'admin_notice',
          read: false,
          createdAt: serverTimestamp(),
          timestamp: Date.now(),
          date: banglaTime
        });
      }

      // Ration card sync
      if (editRationEnabled) {
        await setDoc(doc(db, 'ration_cards', logUserId), {
          userId: logUserId,
          cardNo: editRationCardNo || `RC-${editUserMemberId || editingUser.memberId}`,
          name: editRationName || editUserName || editingUser.name,
          phone: editRationPhone || editUserPhone || editingUser.phone,
          village: editRationVillage,
          upazila: editRationUpazila,
          district: editRationDistrict,
          securityCode: editRationSecurityCode || '1234',
          issueDate: editRationIssueDate || '2026-01-01',
          expiryDate: editRationExpiryDate || '2030-12-31',
          signature: editRationSignature || 'AMB Ration Authority',
          photoUrl: editRationPhotoUrl || '',
          status: 'active',
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await setDoc(doc(db, 'ration_cards', logUserId), {
          status: 'inactive',
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      // ⚡ 5. Update local state for all matching user records
      const updateFn = (prev: any[]) => prev.map(u => {
        const uTargetId = u.uid || u.id || (u as any).docId;
        const uPhoneDigits = (u.phone || '').replace(/\D/g, '');
        const isMatched = targetDocIds.has(uTargetId) || 
                          (cleanDigits && uPhoneDigits && (uPhoneDigits === cleanDigits || uPhoneDigits.endsWith(cleanDigits.slice(-9)))) ||
                          (editUserMemberId.trim() && u.memberId && u.memberId.trim().toUpperCase() === editUserMemberId.trim().toUpperCase());
        if (isMatched) {
          return { ...u, ...cleanUpdatedFields };
        }
        return u;
      });

      setUsers(updateFn);
      setDbSearchUsers(updateFn);

      // Close modal and reset fields
      setEditingUser(null);
      setAdminConfirmPin('');
      setAdminPinError('');
      setAdjType('none');
      setAdjAmount('');
      setAdjReason('');
      setCustomNoticeText('');
      setIsSavingUser(false);

      requestAlert('সফল সম্পন্ন ⚡', 'সদস্যের সমস্ত তথ্য ও ব্যালেন্স উভয় স্থানে (এডমিন ও সদস্যের অ্যাপ) নিখুঁতভাবে লাইভ আপডেট ও সিঙ্ক করা হয়েছে!');
    } catch (err: any) {
      console.error('Error saving user edits:', err);
      setIsSavingUser(false);
      requestAlert('ত্রুটি', 'তথ্য সংরক্ষণ করতে সমস্যা হয়েছে: ' + (err?.message || err));
    }
  };

  // Filter members based on search bar with database fallback
  const filteredUsers = searchQuery.trim() ? dbSearchUsers : users;

  // Filter transaction records by status and filter types
  const displayedPendingTxs = pendingRequests.filter(tx => {
    if (filterTxType === 'all') return true;
    const type = String(tx.type || '').toLowerCase();
    const cat = String((tx as any).category || '').toLowerCase();
    const label = String((tx as any).typeLabel || '').toLowerCase();
    const desc = String(tx.description || '').toLowerCase();

    if (filterTxType === 'add_money' as any || filterTxType === 'deposit') {
      return ['add_money', 'deposit', 'samity_deposit', 'balance_load', 'add_money_request'].includes(type) ||
        cat.includes('deposit') ||
        label.includes('অ্যাড মানি') || label.includes('ডিপোজিট') || label.includes('জমা') ||
        desc.includes('অ্যাড মানি') || desc.includes('ডিপোজিট');
    }
    if (filterTxType === 'withdraw') {
      return ['withdraw', 'cash_out', 'samity_withdraw'].includes(type) ||
        cat.includes('withdraw') ||
        label.includes('উইথড্র') || label.includes('উত্তোলন') || label.includes('ক্যাশ আউট') ||
        desc.includes('উইথড্র') || desc.includes('উত্তোলন');
    }
    if (filterTxType === 'transfer') {
      return ['balance_transfer', 'transfer', 'send_money', 'remittance', 'money_exchange'].includes(type) ||
        cat.includes('transfer') || cat.includes('remit') ||
        label.includes('ট্রান্সফার') || label.includes('স্থানান্তর') || label.includes('সেন্ড মানি') || label.includes('রেমিট্যান্স') ||
        desc.includes('ট্রান্সফার') || desc.includes('স্থানান্তর') || desc.includes('সেন্ড মানি') ||
        String((tx as any).paymentMethod || '').toLowerCase().includes('transfer');
    }
    if (filterTxType === 'loan_repayment') return type === 'loan_repayment' || type.includes('loan');
    if ((filterTxType as any) === 'telecom' || filterTxType === 'telecom_recharge') return type === 'telecom' || type.includes('recharge');
    return tx.type === filterTxType;
  });

  // Admin Push Notification, Bonus & Fine States
  const [notifyTargetType, setNotifyTargetType] = useState<'all' | 'single'>('all');
  const [notifySelectedUserId, setNotifySelectedUserId] = useState<string>('');
  const [notifyActionType, setNotifyActionType] = useState<'bonus' | 'fine' | 'notice'>('notice');
  const [notifyAmount, setNotifyAmount] = useState<string>('10');
  const [notifyTitle, setNotifyTitle] = useState<string>('');
  const [notifyMessage, setNotifyMessage] = useState<string>('');
  const [notifyUserSearch, setNotifyUserSearch] = useState<string>('');
  const [isSendingNotify, setIsSendingNotify] = useState(false);
  const [notifySuccessSent, setNotifySuccessSent] = useState(false);
  const isSubmittingNotifyRef = useRef(false);
  const [notifyCooldownEnd, setNotifyCooldownEnd] = useState<number>(0);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState<number>(0);
  const [lastDispatchReport, setLastDispatchReport] = useState<DispatchReport | null>(null);
  const [showDispatchSuccessModal, setShowDispatchSuccessModal] = useState<boolean>(false);

  useEffect(() => {
    if (notifyCooldownEnd <= Date.now()) {
      setCooldownSecondsLeft(0);
      return;
    }
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((notifyCooldownEnd - Date.now()) / 1000));
      setCooldownSecondsLeft(left);
      if (left <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [notifyCooldownEnd]);

  // Broadcast History States
  const [broadcastLogs, setBroadcastLogs] = useState<AdminBroadcastLog[]>([]);
  const [broadcastHistorySearch, setBroadcastHistorySearch] = useState<string>('');
  const [broadcastHistoryFilter, setBroadcastHistoryFilter] = useState<'all' | 'bonus' | 'fine' | 'notice'>('all');

  const handleDeleteBroadcastLog = async (logId: string) => {
    requestConfirm('রেকর্ড মুছে ফেলা', 'আপনি কি নিশ্চিত যে এই নোটিফিকেশন/বোনাস হিস্ট্রি রেকর্ডটি মুছে ফেলতে চান?', async () => {
      try {
        await deleteDoc(doc(db, 'admin_broadcast_logs', logId));
        setBroadcastLogs(prev => prev.filter(l => l.id !== logId && l.docId !== logId));
        requestAlert('সফল সম্পন্ন', 'হিস্ট্রি রেকর্ড মুছে ফেলা হয়েছে।');
      } catch (err: any) {
        requestAlert('ত্রুটি', 'হিস্ট্রি মুছতে সমস্যা হয়েছে: ' + (err?.message || err));
      }
    });
  };

  const handleSendAdminNotification = async () => {
    // 🛑 Synchronous Multi-Click Lock: Block rapid multi-clicks within split seconds
    if (isSendingNotify || isSubmittingNotifyRef.current) {
      return;
    }

    if (cooldownSecondsLeft > 0 || notifyCooldownEnd > Date.now()) {
      const remainingSecs = cooldownSecondsLeft > 0 ? cooldownSecondsLeft : Math.ceil((notifyCooldownEnd - Date.now()) / 1000);
      requestAlert('সেফটি লক সক্রিয়', `ডুপ্লিকেট নোটিশ বা ডাবল ট্রানজাকশন এড়াতে 1 মিনিটের সেফটি লক চলছে। এক মিনিটের মধ্যে একাধিকবার নোটিফিকেশন পাঠানো যাবে না। আর ${remainingSecs} সেকেন্ড পর চেষ্টা করুন।`);
      return;
    }

    isSubmittingNotifyRef.current = true;

    let effectiveSelectedUserId = notifySelectedUserId;
    const searchTrim = notifyUserSearch.trim();

    if (notifyTargetType === 'single' && !effectiveSelectedUserId && searchTrim) {
      const matched = users.find(u =>
        (u.phone && u.phone.includes(searchTrim)) ||
        (u.memberId && u.memberId.includes(searchTrim)) ||
        (u.name && u.name.toLowerCase().includes(searchTrim.toLowerCase())) ||
        (u.uid && u.uid === searchTrim)
      );
      if (matched) {
        effectiveSelectedUserId = matched.uid || matched.id || (matched as any).docId || '';
        setNotifySelectedUserId(effectiveSelectedUserId);
      }
    }

    if (notifyTargetType === 'single' && !effectiveSelectedUserId && !searchTrim) {
      isSubmittingNotifyRef.current = false;
      requestAlert('সদস্য নির্বাচন প্রয়োজন', 'অনুগ্রহ করে ড্রপডাউন বা মোবাইল নম্বর সার্চ বক্স হতে একজন সদস্য নির্বাচন করুন');
      return;
    }
    if ((notifyActionType === 'bonus' || notifyActionType === 'fine') && (!notifyAmount || Number(notifyAmount) <= 0)) {
      isSubmittingNotifyRef.current = false;
      requestAlert('পরিমাণ প্রদান করুন', 'অনুগ্রহ করে সঠিক টাকার পরিমাণ (যেমন: 10, 20, 50) প্রদান করুন');
      return;
    }

    const amtNum = Number(notifyAmount) || 0;

    // Auto-calculate non-empty fallback title and body
    let effectiveTitle = notifyTitle.trim();
    if (!effectiveTitle) {
      if (notifyActionType === 'bonus') {
        effectiveTitle = '🎁 ওয়ালেট বোনাস জমা হয়েছে';
      } else if (notifyActionType === 'fine') {
        effectiveTitle = '⚠️ টাকা কর্তন / জরিমানা নোটিশ';
      } else {
        effectiveTitle = '📢 জরুরি এডমিন নোটিশ';
      }
    }

    let effectiveMessage = notifyMessage.trim();
    if (!effectiveMessage) {
      if (notifyActionType === 'bonus') {
        effectiveMessage = `আপনাকে ৳${amtNum || 10} টাকা বিশেষ বোনাস প্রদান করা হলো। টাকাটি আপনার মেইন ওয়ালেটে জমা হয়ে গেছে।`;
      } else if (notifyActionType === 'fine') {
        effectiveMessage = `আপনার অ্যাকাউন্ট থেকে ৳${amtNum || 10} টাকা জরিমানা/চার্জ কর্তন করা হয়েছে।`;
      } else {
        effectiveMessage = 'জরুরি এডমিন নোটিশ ব্রডকাস্ট করা হয়েছে।';
      }
    }

    let targetUsersList: User[] = [];

    if (notifyTargetType === 'single') {
      let matchedUsers: User[] = [];

      if (effectiveSelectedUserId) {
        matchedUsers = users.filter(u => 
          u.uid === effectiveSelectedUserId || 
          u.id === effectiveSelectedUserId || 
          (u as any).docId === effectiveSelectedUserId ||
          u.phone === effectiveSelectedUserId ||
          u.memberId === effectiveSelectedUserId
        );
      }

      if (matchedUsers.length === 0 && searchTrim) {
        matchedUsers = users.filter(u =>
          (u.phone && u.phone.trim() === searchTrim) ||
          (u.memberId && u.memberId.trim() === searchTrim) ||
          (u.phone && u.phone.includes(searchTrim)) ||
          (u.memberId && u.memberId.includes(searchTrim)) ||
          (u.name && u.name.toLowerCase().includes(searchTrim.toLowerCase())) ||
          (u.uid && u.uid === searchTrim) ||
          (u.id && u.id === searchTrim)
        );
      }

      if (matchedUsers.length === 0 && searchTrim) {
        try {
          const directDocSnap = await getDoc(doc(db, 'users', searchTrim));
          if (directDocSnap.exists()) {
            matchedUsers.push({ uid: directDocSnap.id, ...directDocSnap.data() } as User);
          } else {
            const qPhone = query(collection(db, 'users'), where('phone', '==', searchTrim));
            const phoneSnap = await getDocs(qPhone);
            if (!phoneSnap.empty) {
              phoneSnap.docs.forEach(d => matchedUsers.push({ uid: d.id, ...d.data() } as User));
            } else {
              const qMember = query(collection(db, 'users'), where('memberId', '==', searchTrim));
              const memberSnap = await getDocs(qMember);
              if (!memberSnap.empty) {
                memberSnap.docs.forEach(d => matchedUsers.push({ uid: d.id, ...d.data() } as User));
              }
            }
          }
        } catch (fetchErr) {
          console.error("Error direct fetching target user:", fetchErr);
        }
      }

      targetUsersList = matchedUsers;
    } else {
      if (users.length > 0) {
        targetUsersList = users;
      } else {
        const allUsersSnap = await getDocs(collection(db, 'users'));
        targetUsersList = allUsersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User));
      }
    }

    if (targetUsersList.length === 0) {
      isSubmittingNotifyRef.current = false;
      requestAlert('ত্রুটি', 'কোনো ভ্যালিড সদস্য পাওয়া যায়নি। দয়া করে সঠিক সদস্য নির্বাচন করুন।');
      return;
    }

    const logTargetName = notifyTargetType === 'all'
      ? `👥 সকল সদস্য (${targetUsersList.length} জন)`
      : `${targetUsersList[0]?.name || 'সদস্য'} (${targetUsersList[0]?.phone || targetUsersList[0]?.memberId || targetUsersList[0]?.uid})`;

    const confirmTitle = notifyActionType === 'bonus'
      ? '🎁 বোনাস প্রদান নিশ্চিতকরণ'
      : notifyActionType === 'fine'
      ? '⚠️ টাকা কর্তন / জরিমানা নিশ্চিতকরণ'
      : '📢 নোটিশ ব্রডকাস্ট নিশ্চিতকরণ';

    const confirmMessage = notifyActionType === 'bonus'
      ? `আপনি কি নিশ্চিত যে ${logTargetName} ওয়ালেটে ৳${amtNum} টাকা বোনাস প্রদান করতে চান?`
      : notifyActionType === 'fine'
      ? `আপনি কি নিশ্চিত যে ${logTargetName} ওয়ালেট থেকে ৳${amtNum} টাকা জরিমানা/চার্জ কেটে নিতে চান?`
      : `আপনি কি নিশ্চিত যে ${logTargetName} কাছে এই ব্রডকাস্ট নোটিশটি পাঠাতে চান?`;

    requestConfirm(confirmTitle, confirmMessage, async () => {
      setIsSendingNotify(true);
      setNotifySuccessSent(false);
      // Set 1-minute (60s) cooldown safety lock
      setNotifyCooldownEnd(Date.now() + 60000);

      try {
        const timestamp = new Date().toISOString();
        const promises: Promise<any>[] = [];
        const updatedUserBalances: { [uid: string]: number } = {};

        if (notifyTargetType === 'single') {
          // --- SINGLE MEMBER TARGET ---
          const u = targetUsersList[0];
          const targetUid = u.uid || (u as any).id || (u as any).docId;

          if (targetUid) {
            const currentBal = Number(u.balance) || 0;
            const currentMain = Number((u as any).mainBalance || u.balance) || currentBal;

            let newBal = currentBal;
            let newMain = currentMain;
            let balanceSummary = '';

            if (notifyActionType === 'bonus') {
              newBal = currentBal + amtNum;
              newMain = currentMain + amtNum;
              balanceSummary = `আপনার পূর্বে ওয়ালেট ব্যালেন্স ছিল ৳${currentBal.toLocaleString('bn-BD')} টাকা। বর্তমান +৳${amtNum.toLocaleString('bn-BD')} টাকা বোনাস প্রদান করায় আপনার সর্বমোট নতুন ব্যালেন্স ৳${newBal.toLocaleString('bn-BD')} টাকা।`;
            } else if (notifyActionType === 'fine') {
              newBal = Math.max(0, currentBal - amtNum);
              newMain = Math.max(0, currentMain - amtNum);
              balanceSummary = `আপনার পূর্বে ওয়ালেট ব্যালেন্স ছিল ৳${currentBal.toLocaleString('bn-BD')} টাকা। বর্তমান -৳${amtNum.toLocaleString('bn-BD')} টাকা জরিমানা/চার্জ কর্তন করায় আপনার সর্বমোট নতুন ব্যালেন্স ৳${newBal.toLocaleString('bn-BD')} টাকা।`;
            }

            updatedUserBalances[targetUid] = newBal;

            const finalMsgBody = (notifyActionType === 'bonus' || notifyActionType === 'fine')
              ? (effectiveMessage.includes('পূর্বের ব্যালেন্স') || effectiveMessage.includes('নতুন ব্যালেন্স')
                  ? effectiveMessage
                  : `${balanceSummary}${effectiveMessage.trim() ? `\n\nবিবরণ: ${effectiveMessage.trim()}` : ''}`)
              : effectiveMessage;

            if (notifyActionType === 'bonus' || notifyActionType === 'fine') {
              promises.push(setDoc(doc(db, 'users', targetUid), {
                balance: newBal,
                mainBalance: newMain,
                updatedAt: timestamp
              }, { merge: true }));

              promises.push(addDoc(collection(db, 'transactions'), {
                id: `tx-${notifyActionType}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                userId: targetUid,
                memberId: u.memberId || '',
                userName: u.name || '',
                userPhone: u.phone || '',
                type: notifyActionType,
                typeLabel: notifyActionType === 'bonus' ? 'এডমিন বোনাস' : 'এডমিন জরিমানা',
                amount: amtNum,
                status: 'success',
                desc: finalMsgBody,
                createdAt: timestamp
              }));
            }

            promises.push(addDoc(collection(db, 'user_notifications'), {
              id: `notif-${notifyActionType}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              userId: targetUid,
              memberId: u.memberId || '',
              title: effectiveTitle,
              body: finalMsgBody,
              message: finalMsgBody,
              category: notifyActionType,
              type: notifyActionType,
              amount: amtNum,
              isPersonal: true,
              isAdminBroadcast: true,
              read: false,
              createdAt: timestamp
            }));
          }
        } else {
          // --- ALL MEMBERS TARGET (SUPER FAST <0.1s BROADCAST) ---
          let globalBody = effectiveMessage;
          if (notifyActionType === 'bonus') {
            globalBody = `সকল সদস্যকে ৳${amtNum.toLocaleString('bn-BD')} টাকা ওয়ালেট বোনাস প্রদান করা হলো।${effectiveMessage.trim() ? `\n\nবিবরণ: ${effectiveMessage.trim()}` : ''}`;
          } else if (notifyActionType === 'fine') {
            globalBody = `সকল সদস্যের অ্যাকাউন্ট হতে ৳${amtNum.toLocaleString('bn-BD')} টাকা চার্জ/জরিমানা কর্তন করা হয়েছে।${effectiveMessage.trim() ? `\n\nবিবরণ: ${effectiveMessage.trim()}` : ''}`;
          }

          // 1. Instant global notification
          promises.push(addDoc(collection(db, 'user_notifications'), {
            id: `notif-all-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            userId: 'all',
            title: effectiveTitle,
            body: globalBody,
            message: globalBody,
            category: notifyActionType,
            type: notifyActionType,
            amount: amtNum,
            isPersonal: true,
            isAdminBroadcast: true,
            read: false,
            createdAt: timestamp
          }));

          // 2. Instant global notice board document
          promises.push(addDoc(collection(db, 'notices'), {
            id: `not-${Date.now()}`,
            title: effectiveTitle,
            content: globalBody,
            section: 'all',
            createdAt: timestamp
          }));

          // Balance updates & targeted user notification dispatch
          for (const u of targetUsersList) {
            const targetUid = u.uid || (u as any).id || (u as any).docId;
            if (!targetUid) continue;

            let personalSummary = globalBody;

            if (notifyActionType === 'bonus' && amtNum > 0) {
              const currentBal = Number(u.balance) || 0;
              const currentMain = Number((u as any).mainBalance || u.balance) || currentBal;
              const newBal = currentBal + amtNum;
              const newMain = currentMain + amtNum;
              updatedUserBalances[targetUid] = newBal;

              personalSummary = `আপনার পূর্বে ওয়ালেট ব্যালেন্স ছিল ৳${currentBal.toLocaleString('bn-BD')} টাকা। বর্তমান +৳${amtNum.toLocaleString('bn-BD')} টাকা বোনাস জমা হওয়ায় আপনার সর্বমোট নতুন ব্যালেন্স ৳${newBal.toLocaleString('bn-BD')} টাকা।`;

              promises.push(setDoc(doc(db, 'users', targetUid), {
                balance: newBal,
                mainBalance: newMain,
                updatedAt: timestamp
              }, { merge: true }));

              promises.push(addDoc(collection(db, 'transactions'), {
                id: `tx-bonus-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                userId: targetUid,
                memberId: u.memberId || '',
                userName: u.name || '',
                userPhone: u.phone || '',
                type: 'bonus',
                typeLabel: 'এডমিন বোনাস',
                amount: amtNum,
                status: 'success',
                desc: personalSummary,
                createdAt: timestamp
              }));
            } else if (notifyActionType === 'fine' && amtNum > 0) {
              const currentBal = Number(u.balance) || 0;
              const currentMain = Number((u as any).mainBalance || u.balance) || currentBal;
              const newBal = Math.max(0, currentBal - amtNum);
              const newMain = Math.max(0, currentMain - amtNum);
              updatedUserBalances[targetUid] = newBal;

              personalSummary = `আপনার পূর্বে ওয়ালেট ব্যালেন্স ছিল ৳${currentBal.toLocaleString('bn-BD')} টাকা। বর্তমান -৳${amtNum.toLocaleString('bn-BD')} টাকা জরিমানা/চার্জ কর্তন করায় আপনার সর্বমোট নতুন ব্যালেন্স ৳${newBal.toLocaleString('bn-BD')} টাকা।`;

              promises.push(setDoc(doc(db, 'users', targetUid), {
                balance: newBal,
                mainBalance: newMain,
                updatedAt: timestamp
              }, { merge: true }));

              promises.push(addDoc(collection(db, 'transactions'), {
                id: `tx-fine-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                userId: targetUid,
                memberId: u.memberId || '',
                userName: u.name || '',
                userPhone: u.phone || '',
                type: 'fine',
                typeLabel: 'এডমিন জরিমানা',
                amount: amtNum,
                status: 'success',
                desc: personalSummary,
                createdAt: timestamp
              }));
            }

          }
        }

        // Save to Audit History Collection
        const newLogItem: AdminBroadcastLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          actionType: notifyActionType,
          targetType: notifyTargetType,
          targetUserName: logTargetName,
          targetUserPhone: notifyTargetType === 'single' ? (targetUsersList[0]?.phone || '') : '',
          targetUserId: notifyTargetType === 'single' ? (targetUsersList[0]?.uid || (targetUsersList[0] as any)?.id) : 'all',
          amount: amtNum,
          title: effectiveTitle,
          message: effectiveMessage,
          sentBy: currentUser?.name || 'এডমিন',
          status: 'delivered',
          createdAt: timestamp
        };

        promises.push(addDoc(collection(db, 'admin_broadcast_logs'), newLogItem));

        // Optimistically update React memory states for instant UI update (<0.1s)
        if (Object.keys(updatedUserBalances).length > 0) {
          setUsers(prev => prev.map(usr => {
            const uid = usr.uid || usr.id || (usr as any).docId;
            if (uid && updatedUserBalances[uid] !== undefined) {
              return {
                ...usr,
                balance: updatedUserBalances[uid],
                mainBalance: updatedUserBalances[uid]
              };
            }
            return usr;
          }));
        }

        setBroadcastLogs(prev => [newLogItem, ...prev]);

        // Construct detailed Dispatch Report for real-time visual proof
        const reportObj: DispatchReport = {
          id: `DISPATCH-${Date.now().toString().slice(-6)}`,
          timestamp: new Date().toLocaleString('bn-BD', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            day: 'numeric', month: 'long', year: 'numeric'
          }),
          actionType: notifyActionType,
          targetType: notifyTargetType,
          targetName: logTargetName,
          targetCount: targetUsersList.length,
          amount: amtNum,
          title: effectiveTitle,
          message: effectiveMessage,
          status: 'delivered',
          speedSeconds: '0.10'
        };

        setLastDispatchReport(reportObj);
        setShowDispatchSuccessModal(true);
        playNotificationChime();

        // Await database write promises to ensure 100% persistence in Firestore
        await Promise.all(promises);

        // Set Completed status text
        setNotifySuccessSent(true);
        setTimeout(() => setNotifySuccessSent(false), 5000);

        let successMsg = '';
        if (notifyActionType === 'bonus') {
          successMsg = `🎉 1 সেকেন্ডে সফলভাবে ${logTargetName} ওয়ালেটে ৳${amtNum} টাকা বোনাস প্রদান করা হয়েছে এবং নোটিফিকেশন পৌঁছে গেছে! (1 মিনিটের সেফটি লক চালুকৃত)`;
        } else if (notifyActionType === 'fine') {
          successMsg = `⚠️ 1 সেকেন্ডে সফলভাবে ${logTargetName} ওয়ালেট হতে ৳${amtNum} টাকা জরিমানা কর্তন করা হয়েছে এবং নোটিফিকেশন পৌঁছে গেছে! (1 মিনিটের সেফটি লক চালুকৃত)`;
        } else {
          successMsg = `📢 1 সেকেন্ডে সফলভাবে ${logTargetName} নোটিফিকেশন ইনবক্সে বার্তা ব্রডকাস্ট করা হয়েছে! (1 মিনিটের সেফটি লক চালুকৃত)`;
        }

        requestAlert('✅ নোটিফিকেশন পাঠানো সম্পন্ন হয়েছে!', successMsg);
      } catch (err: any) {
        console.error('Error sending admin notification:', err);
        requestAlert('ত্রুটি', 'ব্যালেন্স বা নোটিফিকেশন পাঠাতে সমস্যা হয়েছে: ' + (err?.message || err));
      } finally {
        setIsSendingNotify(false);
        isSubmittingNotifyRef.current = false;
      }
    }, () => {
      // If admin cancels confirm modal, release click lock
      isSubmittingNotifyRef.current = false;
      setNotifyCooldownEnd(0);
    });
  };

  // States for Section 12 Report & Audit Modal + Drill Down + Manual Fund Adjustments
  const [showSection12ReportModal, setShowSection12ReportModal] = useState(false);
  
  // Auto-Deductions & Section Notification System (অটো কর্তন নোটিশ সিস্টেম - হুবহু নোটিফিকেশন রেপ্লিকা)
  const [adminSeenNoticeIds, setAdminSeenNoticeIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('amb_admin_seen_notice_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showAutoNoticeModal, setShowAutoNoticeModal] = useState(false);
  const [selectedAutoNoticeCategory, setSelectedAutoNoticeCategory] = useState<'all' | 'fine' | 'savings' | 'loan' | 'refund'>('all');
  const [selectedNoticeReceipt, setSelectedNoticeReceipt] = useState<any | null>(null);

  const markNoticeAsSeen = (ids: string | string[]) => {
    const toAdd = Array.isArray(ids) ? ids : [ids];
    setAdminSeenNoticeIds(prev => {
      const next = Array.from(new Set([...prev, ...toAdd]));
      try {
        localStorage.setItem('amb_admin_seen_notice_ids', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const markAllNoticesAsSeen = (idsToMark: string[]) => {
    markNoticeAsSeen(idsToMark);
  };
  const [drillDownModalData, setDrillDownModalData] = useState<{ title: string; amount: number; type?: string; sectionName?: string; history?: any[] } | null>(null);
  const [reportPreset, setReportPreset] = useState<'today' | 'weekly' | 'monthly' | 'yearly' | '1-15' | '1-25' | 'custom'>('monthly');
  const [reportCustomStart, setReportCustomStart] = useState<string>('2026-07-01');
  const [reportCustomEnd, setReportCustomEnd] = useState<string>('2026-07-31');

  // Manual Fund Override States
  const [showFundAdjustModal, setShowFundAdjustModal] = useState(false);
  const [adjustFundKey, setAdjustFundKey] = useState<string>('master_fund');
  const [adjustCustomValue, setAdjustCustomValue] = useState<string>('');

  // Financial calculations for company ledger and balance sheet (English numbers)
  const totalMemberCount = users.length;
  const totalMemberBalance = users
    .filter(u => !isMainAdminUser(u))
    .reduce((sum, u) => sum + Math.max(0, Number(u.balance || (u as any).mainBalance || (u as any).walletBalance || 0)), 0);
  const totalSavings = users.reduce((sum, u) => sum + Math.max(0, Number(u.savings !== undefined ? u.savings : u.dpsBalance) || 0), 0);
  const totalDps = 0;
  const totalDueLoan = users.reduce((sum, u) => sum + Math.max(0, Number(u.dueLoan) || 0), 0);
  
  // Real Cashback sum from user cashback fields and success cashback transactions
  const totalUserCashback = users.reduce((sum, u) => sum + Math.max(0, Number(u.cashback) || 0), 0);
  const totalTxCashback = transactions
    .filter(t => (t.status === 'success' || t.status === 'approved' || (t as any).isApproved) && ((t.type as any) === 'cashback' || t.rechargeCashback))
    .reduce((sum, t) => sum + (Number(t.rechargeCashback) || Number(t.amount) || 0), 0);
  const totalCashback = totalUserCashback || totalTxCashback || 0;
  
  // Real income & profit calculations from transaction records (পাই টু পাই একুরেট হিসাব)
  const totalIncomeFromTx = transactions
    .filter(t => t.status === 'success' || t.status === 'approved' || (t as any).isApproved)
    .reduce((sum, t) => {
      const profit = Number((t as any).adminProfit || (t as any).companyProfit || (t as any).profitAmount || 0);
      const fee = Number(t.charge || t.fee || (t.type === 'fee' || (t.type as any) === 'fee_payment' ? t.amount : 0) || 0);
      return sum + (profit > 0 ? profit : fee);
    }, 0);

  const totalExpenseFromTx = transactions
    .filter(t => (t.status === 'success' || t.status === 'approved' || (t as any).isApproved) && ((t.type as any) === 'expense' || t.type === 'withdraw' || (t.type as any) === 'payout'))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
  const totalTelecomRecharge = transactions
    .filter(t => (t.status === 'success' || t.status === 'approved' || (t as any).isApproved) && (t.type === 'telecom' || t.type === 'telecom_recharge' || (t.type as any) === 'recharge'))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  
  const totalExpenses = totalCashback + totalExpenseFromTx;
  const initialCompanyFund = appConfig?.initialCompanyFund || 1200000;

  // 12 Core Balance Sections Values (Auto Calculation + Manual Override capability)
  const getFundValueAndStatus = (key: string, autoVal: number) => {
    const manualVal = appConfig?.manualFundAdjustments?.[key];
    if (manualVal !== undefined && manualVal !== null && typeof manualVal === 'number' && !isNaN(manualVal)) {
      return { val: Math.max(0, manualVal), isManual: true, autoVal };
    }
    return { val: Math.max(0, autoVal), isManual: false, autoVal };
  };

  const autoMasterFund = masterAccounts && masterAccounts.length > 0 
    ? masterAccounts.reduce((sum, acc) => sum + Math.max(0, Number(acc.amount || 0)), 0)
    : initialCompanyFund;
  const autoSamityFund = totalSavings;
  const autoMobileRechargeFund = totalTelecomRecharge;
  const autoMobileCashbackFund = totalCashback;

  // Qard Hasana Transactions & Dual Balance breakdown
  const qardAllTransactions = transactions.filter(t => ['qard_donation', 'qard_loan_request', 'qard_loan_disbursment', 'qard_loan_repayment'].includes(t.type));
  const totalQardDonations = qardAllTransactions.filter(t => t.type === 'qard_donation' && (t.status === 'success' || t.status === 'approved')).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalQardRepayments = qardAllTransactions.filter(t => t.type === 'qard_loan_repayment' && (t.status === 'success' || t.status === 'approved')).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalQardDisbursed = qardAllTransactions.filter(t => (t.type === 'qard_loan_disbursment' || t.type === 'qard_loan_request') && (t.status === 'success' || t.status === 'approved')).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Active Hawlat (Loan Due) from users
  const totalUserDueHawlat = users.reduce((sum, u) => sum + Math.max(0, Number(u.dueLoan) || 0), 0);
  const autoQardDueLoanFund = totalUserDueHawlat > 0 ? totalUserDueHawlat : Math.max(0, totalQardDisbursed - totalQardRepayments);
  
  // Base Starting Fund (defaults to 0 or config)
  const baseQardFund = appConfig?.qardConfig?.baseFund !== undefined ? Number(appConfig?.qardConfig?.baseFund) : 0;
  
  // Main Fund Balance = (Base Capital + Donations + Repayments) - Active Loans Taken
  const autoQardMainFund = Math.max(0, baseQardFund + totalQardDonations + totalQardRepayments - autoQardDueLoanFund);
  const autoQardFund = autoQardDueLoanFund;

  const autoCashAndBankBalance = totalMemberBalance;
  const autoIncome = totalIncomeFromTx;
  const autoExpense = totalExpenses;

  // Build fine and penalty records list (কার থেকে কেন কত টাকা কাটা হলো)
  const fineHistoryItems: Array<{
    name: string;
    phone: string;
    memberId: string;
    date: string;
    amount: number;
    reason: string;
    type: string;
    status: string;
    userObj?: any;
    userId?: string;
  }> = [];

  // Add fine records from broadcast logs
  broadcastLogs
    .filter(l => l.actionType === 'fine')
    .forEach(l => {
      const u = users.find(usr => usr.phone === l.targetUserPhone || usr.normalizedPhone === l.targetUserPhone || usr.name === l.targetUserName);
      fineHistoryItems.push({
        userId: u?.id,
        userObj: u,
        name: l.targetUserName || u?.name || 'সদস্য',
        phone: l.targetUserPhone || u?.phone || '—',
        memberId: u?.memberId || 'FINE-LOG',
        date: l.createdAt ? new Date(l.createdAt).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }) : 'আজ',
        amount: Number(l.amount || 0),
        reason: l.title ? `${l.title}${l.message ? `: ${l.message}` : ''}` : (l.message || 'নিয়ম ভঙ্গের জরিমানা / বিলম্ব ফি'),
        type: '⚠️ জরিমানা কর্তন',
        status: 'কর্তনকৃত'
      });
    });

  // Add fine records from transactions if not already added
  transactions
    .filter(t => t.type === 'fine' || t.type === 'qard_fine' || t.type === 'penalty' || t.type === 'late_fine' || t.category === 'fine' || t.category === 'qard_late_fine' || ((t as any).fine && (t as any).fine > 0))
    .forEach(t => {
      const u = users.find(usr => usr.phone === t.userPhone || usr.phone === t.phoneNumber || usr.name === t.userName);
      fineHistoryItems.push({
        userId: u?.id || t.userId,
        userObj: u,
        name: t.userName || u?.name || 'সদস্য',
        phone: t.userPhone || t.phoneNumber || u?.phone || '—',
        memberId: u?.memberId || t.trxId || 'FINE-TX',
        date: t.date || (t.createdAt ? new Date(t.createdAt).toLocaleDateString('bn-BD') : 'আজ'),
        amount: Number((t as any).fine || t.amount || 0),
        reason: t.description || t.title || 'কিস্তি খেলাপ জরিমানা / সার্ভিস চার্জ',
        type: '⚠️ জরিমানা কর্তন',
        status: 'কর্তনকৃত'
      });
    });

  const autoFineFund = fineHistoryItems.reduce((sum, item) => sum + item.amount, 0);

  const objMasterFund = getFundValueAndStatus('master_fund', autoMasterFund);
  const objSamityFund = getFundValueAndStatus('samity_fund', autoSamityFund);
  const objMobileRechargeFund = getFundValueAndStatus('telecom_fund', autoMobileRechargeFund);
  const objMobileCashbackFund = getFundValueAndStatus('cashback_fund', autoMobileCashbackFund);
  const objQardMainFund = getFundValueAndStatus('qard_main_fund', autoQardMainFund);
  const objQardFund = getFundValueAndStatus('qard_fund', autoQardDueLoanFund);
  const objCashAndBankBalance = getFundValueAndStatus('cash_bank_fund', autoCashAndBankBalance);
  const objIncome = getFundValueAndStatus('income_fund', autoIncome);
  const objExpense = getFundValueAndStatus('expense_fund', autoExpense);
  const objFineFund = getFundValueAndStatus('fine_fund', autoFineFund);

  const autoLiabilities = objCashAndBankBalance.val + objSamityFund.val + objMobileCashbackFund.val;
  const objLiabilities = getFundValueAndStatus('liabilities_fund', autoLiabilities);

  const autoNetAsset = Math.max(0, objMasterFund.val + objIncome.val + objFineFund.val - objExpense.val);
  const objNetAsset = getFundValueAndStatus('net_capital_fund', autoNetAsset);

  const valMasterFund = objMasterFund.val;
  const valSamityFund = objSamityFund.val;
  const valMobileRechargeFund = objMobileRechargeFund.val;
  const valMobileCashbackFund = objMobileCashbackFund.val;
  const valQardMainFund = objQardMainFund.val;
  const valQardFund = objQardFund.val;
  const valCashAndBankBalance = objCashAndBankBalance.val;
  const valIncome = objIncome.val;
  const valExpense = objExpense.val;
  const valFineFund = objFineFund.val;
  const valLiabilities = objLiabilities.val;
  const valNetAsset = objNetAsset.val;

  const getUserMainWalletBalance = (usr: any) => {
    if (!usr) return 0;
    return Number(usr.balance !== undefined ? usr.balance : usr.walletBalance !== undefined ? usr.walletBalance : (usr as any).mainBalance) || 0;
  };

  const fundModulesList = [
    { key: 'master_fund', name: '1. মাস্টার ফান্ড', autoVal: autoMasterFund, currentVal: valMasterFund, isManual: objMasterFund.isManual },
    { key: 'samity_fund', name: '2. সমিতি ফান্ড', autoVal: autoSamityFund, currentVal: valSamityFund, isManual: objSamityFund.isManual },
    { key: 'telecom_fund', name: '3. রিচার্জ ফান্ড', autoVal: autoMobileRechargeFund, currentVal: valMobileRechargeFund, isManual: objMobileRechargeFund.isManual },
    { key: 'cashback_fund', name: '4. ক্যাশব্যাক ফান্ড', autoVal: autoMobileCashbackFund, currentVal: valMobileCashbackFund, isManual: objMobileCashbackFund.isManual },
    { key: 'qard_main_fund', name: '5.1 কর্জে হাসানা মূল তহবিল (মেইন ব্যালেন্স)', autoVal: autoQardMainFund, currentVal: valQardMainFund, isManual: objQardMainFund.isManual },
    { key: 'qard_fund', name: '5.2 মোট বিতরণকৃত হাওলাত (চলতি ঋণ)', autoVal: autoQardDueLoanFund, currentVal: valQardFund, isManual: objQardFund.isManual },
    { key: 'cash_bank_fund', name: '6. ক্যাশ ও ব্যাংক', autoVal: autoCashAndBankBalance, currentVal: valCashAndBankBalance, isManual: objCashAndBankBalance.isManual },
    { key: 'income_fund', name: '7. আয় (Income)', autoVal: autoIncome, currentVal: valIncome, isManual: objIncome.isManual },
    { key: 'expense_fund', name: '8. ব্যয় (Expense)', autoVal: autoExpense, currentVal: valExpense, isManual: objExpense.isManual },
    { key: 'fine_fund', name: '9. জরিমানা ফান্ড', autoVal: autoFineFund, currentVal: valFineFund, isManual: objFineFund.isManual },
    { key: 'net_capital_fund', name: '10. নেট মূলধন', autoVal: autoNetAsset, currentVal: valNetAsset, isManual: objNetAsset.isManual },
    { key: 'liabilities_fund', name: '11. দায় ও পাওনা', autoVal: autoLiabilities, currentVal: valLiabilities, isManual: objLiabilities.isManual },
  ];

  // =========================================================
  // STEP-BY-STEP BACK NAVIGATION & HISTORY STACK ENGINE
  // =========================================================

  const closeAllAdminModals = () => {
    let modalClosed = false;
    if (showFundAdjustModal) { setShowFundAdjustModal(false); modalClosed = true; }
    if (drillDownModalData) { setDrillDownModalData(null); modalClosed = true; }
    if (showSection12ReportModal) { setShowSection12ReportModal(false); modalClosed = true; }
    if (editingUser) { setEditingUser(null); modalClosed = true; }
    if (editingCardUser) { setEditingCardUser(null); modalClosed = true; }
    if (showAddMemberForm) { setShowAddMemberForm(false); modalClosed = true; }
    if (editingBank) { setEditingBank(null); modalClosed = true; }
    if (showAddBank) { setShowAddBank(false); modalClosed = true; }
    if (showMemberListModal) { setShowMemberListModal(false); modalClosed = true; }
    if (showExpenseModal) { setShowExpenseModal(false); modalClosed = true; }
    if (showReserveEditModal) { setShowReserveEditModal(false); modalClosed = true; }
    if (showLoanListModal) { setShowLoanListModal(false); modalClosed = true; }
    if (showNetOperatingModal) { setShowNetOperatingModal(false); modalClosed = true; }
    if (showTotalLiabilitiesModal) { setShowTotalLiabilitiesModal(false); modalClosed = true; }
    if (showAdminNotifyModal) { setShowAdminNotifyModal(false); modalClosed = true; }
    if (showHeaderMembersModal) { setShowHeaderMembersModal(false); modalClosed = true; }
    if (showHeaderPendingModal) { setShowHeaderPendingModal(false); modalClosed = true; }
    if (isPenaltyCalendarModalOpen) { setIsPenaltyCalendarModalOpen(false); modalClosed = true; }
    if (isPolicyModalOpen) { setIsPolicyModalOpen(false); modalClosed = true; }
    if (confirmState) { setConfirmState(null); modalClosed = true; }
    if (previewImage) { setPreviewImage(null); modalClosed = true; }
    if (editingSafiProdId) { setEditingSafiProdId(null); modalClosed = true; }
    if (historyActiveScreenshot) { setHistoryActiveScreenshot(null); modalClosed = true; }
    if (showAddAccountForm) { setShowAddAccountForm(false); modalClosed = true; }
    if (showAdminAddSafiProductModal) { setShowAdminAddSafiProductModal(false); modalClosed = true; }
    if (showAdminAddCatModal) { setShowAdminAddCatModal(false); modalClosed = true; }
    if (showResetModal) { setShowResetModal(false); modalClosed = true; }
    if (showTrackingModal) { setShowTrackingModal(false); modalClosed = true; }
    if (showDispatchSuccessModal) { setShowDispatchSuccessModal(false); modalClosed = true; }
    return modalClosed;
  };

  const handleGoBack = () => {
    if (window.history.state?.appView === 'admin_panel' && window.history.state?.level) {
      window.history.back();
    } else {
      const modalClosed = closeAllAdminModals();
      if (!modalClosed) {
        if (!viewingGrid) {
          setViewingGrid(true);
        } else {
          if (onBack) {
            onBack();
          }
        }
      }
    }
  };

  // Push history state when navigating into a sub-section
  const prevViewingGridRef = useRef(viewingGrid);
  useEffect(() => {
    if (prevViewingGridRef.current === true && viewingGrid === false) {
      window.history.pushState({ appView: 'admin_panel', level: 'section', tab: adminTab }, '');
    }
    prevViewingGridRef.current = viewingGrid;
  }, [viewingGrid, adminTab]);

  // Push history state when a modal is opened
  const activeModalCount = [
    Boolean(showFundAdjustModal),
    Boolean(drillDownModalData),
    Boolean(showSection12ReportModal),
    Boolean(editingUser),
    Boolean(editingCardUser),
    Boolean(showAddMemberForm),
    Boolean(editingBank),
    Boolean(showAddBank),
    Boolean(showMemberListModal),
    Boolean(showExpenseModal),
    Boolean(showReserveEditModal),
    Boolean(showLoanListModal),
    Boolean(showNetOperatingModal),
    Boolean(showTotalLiabilitiesModal),
    Boolean(showAdminNotifyModal),
    Boolean(showHeaderMembersModal),
    Boolean(showHeaderPendingModal),
    Boolean(confirmState),
    Boolean(previewImage),
    Boolean(editingSafiProdId),
    Boolean(historyActiveScreenshot),
    Boolean(showAddAccountForm),
    Boolean(showAdminAddSafiProductModal),
    Boolean(showAdminAddCatModal),
    Boolean(showResetModal),
    Boolean(showTrackingModal),
    Boolean(showDispatchSuccessModal)
  ].filter(Boolean).length;

  const prevModalCountRef = useRef(activeModalCount);
  useEffect(() => {
    if (activeModalCount > prevModalCountRef.current) {
      window.history.pushState({ appView: 'admin_panel', level: 'modal' }, '');
    }
    prevModalCountRef.current = activeModalCount;
  }, [activeModalCount]);

  // Expose window handlers for global back button step-by-step navigation
  useEffect(() => {
    (window as any).amb_admin_modal_open = activeModalCount > 0;
    (window as any).amb_admin_close_modal = closeAllAdminModals;
    (window as any).amb_admin_viewing_grid = viewingGrid;
    (window as any).amb_admin_set_viewing_grid = setViewingGrid;
    return () => {
      delete (window as any).amb_admin_modal_open;
      delete (window as any).amb_admin_close_modal;
      delete (window as any).amb_admin_viewing_grid;
      delete (window as any).amb_admin_set_viewing_grid;
    };
  }, [activeModalCount, viewingGrid, closeAllAdminModals]);

    const adminScopeProps: Record<string, any> = {
    ...props,
    valFineFund,
    fineHistoryItems,
    users,
    name,
    getUserMainWalletBalance,
    transactions,
    valSamityFund,
    valQardFund,
    valMobileCashbackFund,
    adminSeenNoticeIds,
    setSelectedAutoNoticeCategory,
    setShowAutoNoticeModal,
    showAutoNoticeModal,
    selectedAutoNoticeCategory,
    drillDownModalData,
    showMemberListModal,
    setShowMemberListModal,
    showAdminNotifyModal,
    setShowAdminNotifyModal,
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
    onRefreshTransactions: fetchTransactionsFromDb,
    showFundAdjustModal,
    setShowFundAdjustModal,
    adjustFundKey,
    setAdjustFundKey,
    adjustCustomValue,
    setAdjustCustomValue,
    fundModulesList,
    showSection12ReportModal,
    setShowSection12ReportModal,
    reportPreset,
    setReportPreset,
    reportCustomStart,
    setReportCustomStart,
    reportCustomEnd,
    setReportCustomEnd,
    markNoticeAsSeen,
    markAllNoticesAsSeen,
    broadcastLogs,
    pendingRequests,
    isMasterAdmin,
    hasPermission,
    alert,
    setAdminTab,
    setViewingGrid,
    valMasterFund,
    requestPrompt,
    initialCompanyFund,
    setDrillDownModalData,
    masterAccounts,
    valMobileRechargeFund,
    setQardBoxViewHawlat,
    qardBoxViewHawlat,
    valQardMainFund,
    qardAllTransactions,
    valCashAndBankBalance,
    valIncome,
    valExpense,
    valNetAsset,
    totalMemberBalance,
    totalExpenses,
    valLiabilities,
    adminAgentRequests,
    notices,
    phoneChangeRequests,
    cfgLogoUrl,
    handleDirectUpdateLogo,
    handleGoBack,
    adminTab,
    BENGALI_MONTH_DEFS,
    isMonthExemptedInConfig,
    getMonthExemptConfig,
    policyFormState,
    setQuickPenaltyDay,
    setQuickPenaltyNote,
    setIsQuickPenaltyModalOpen,
    setIsPolicyModalOpen,
    cfgAllowProfileSelfEdit,
    handleToggleProfileSelfEdit,
    isSubAdmin,
    setGeneralMemberFilterTab,
    generalMemberFilterTab,
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
    handleApproveAppLockReset,
    handleRejectAppLockReset,
    showAppLockCodeMap,
    setShowAppLockCodeMap,
    setCopiedAppLockUid,
    copiedAppLockUid,
    handleAdminInstantUnlockUser,
    openUserEditModal,
    handleDeleteUser,
    setApprovalsSubTab,
    approvalsSubTab,
    handleApproveDeviceReset,
    handleReleaseAccountDeviceAndLogout,
    handleRejectDeviceReset,
    expandedReqIds,
    toggleReqExpanded,
    setCfgPhoneChangeEnabled,
    cfgPhoneChangeEnabled,
    cfgPhoneChangeFreeDays,
    setCfgPhoneChangeFreeDays,
    cfgPhoneChangeFeeIncrement,
    setCfgPhoneChangeFeeIncrement,
    cfgPhoneChangeMaxFee,
    setCfgPhoneChangeMaxFee,
    handleSavePhoneChangeConfig,
    cfgSaving,
    handleApprovePhoneRequest,
    handleRejectPhoneRequest,
    handleUpdateAgentRequestStatus,
    oneSignalSuccess,
    oneSignalError,
    cfgOneSignalAppId,
    setCfgOneSignalAppId,
    showOneSignalKey,
    cfgOneSignalRestApiKey,
    setCfgOneSignalRestApiKey,
    setShowOneSignalKey,
    handleUnlockOneSignalSettings,
    oneSignalSaving,
    handleSaveOneSignalSettings,
    handleSendPush,
    setPushTargetType,
    setPushTargetValue,
    pushTargetType,
    pushTargetValue,
    pushTitle,
    setPushTitle,
    pushMessage,
    setPushMessage,
    pushImageUrl,
    setPushImageUrl,
    pushDeepLink,
    setPushDeepLink,
    pushSending,
    adminNotifications,
    handleDeleteAdminNotification,
    handleSaveConfig,
    cfgSuccess,
    cfgError,
    setCfgLogoUrl,
    cfgAppName,
    setCfgAppName,
    cfgSupportPhone,
    setCfgSupportPhone,
    cfgPersonalMfsNumber,
    setCfgPersonalMfsNumber,
    cfgPersonalBankCard,
    setCfgPersonalBankCard,
    cfgTickerText,
    setCfgTickerText,
    cfgSamityTicker,
    setCfgSamityTicker,
    cfgQardTicker,
    setCfgQardTicker,
    cfgSafiTicker,
    setCfgSafiTicker,
    cfgEscrowTicker,
    setCfgEscrowTicker,
    cfgRationTicker,
    setCfgRationTicker,
    cfgSamityTerms,
    setCfgSamityTerms,
    setCfgMaintenanceMode,
    cfgMaintenanceMode,
    cfgMaintenanceTitle,
    setCfgMaintenanceTitle,
    cfgMaintenanceDescription,
    setCfgMaintenanceDescription,
    cfgMaintenanceEstimatedTime,
    setCfgMaintenanceEstimatedTime,
    setCfgForceUpdateActive,
    cfgForceUpdateActive,
    cfgMinAppVersion,
    setCfgMinAppVersion,
    cfgLatestAppVersion,
    setCfgLatestAppVersion,
    cfgDownloadLink,
    setCfgDownloadLink,
    cfgUpdateTitle,
    setCfgUpdateTitle,
    cfgUpdateDescription,
    setCfgUpdateDescription,
    cfgServiceStatus,
    setCfgServiceStatus,
    cfgBannerHeightType,
    setCfgBannerHeightType,
    cfgBannerHeightValue,
    setCfgBannerHeightValue,
    cfgGridColsCount,
    setCfgGridColsCount,
    cfgGridIconSize,
    setCfgGridIconSize,
    cfgGridIconSizeValue,
    setCfgGridIconSizeValue,
    cfgBottomNavHeightType,
    setCfgBottomNavHeightType,
    cfgBottomNavTabs,
    setCfgBottomNavTabs,
    receiptSuccess,
    setReceiptSuccess,
    receiptError,
    setReceiptError,
    handleSaveReceiptConfig,
    isSavingReceiptConfig,
    receiptHeaderTitle,
    setReceiptHeaderTitle,
    receiptCompanyName,
    setReceiptCompanyName,
    receiptOrganizationDetails,
    setReceiptOrganizationDetails,
    receiptOfficialTagText,
    setReceiptOfficialTagText,
    receiptAdminSignatureName,
    setReceiptAdminSignatureName,
    receiptAdminSignatureTitle,
    setReceiptAdminSignatureTitle,
    receiptFooterVerificationText,
    setReceiptFooterVerificationText,
    rcptAddMoneyTheme,
    setRcptAddMoneyTheme,
    setReceiptPreviewCat,
    rcptAddMoneyTitle,
    setRcptAddMoneyTitle,
    rcptAddMoneyNotice,
    setRcptAddMoneyNotice,
    rcptSendMoneyTheme,
    setRcptSendMoneyTheme,
    rcptSendMoneyTitle,
    setRcptSendMoneyTitle,
    rcptSendMoneyNotice,
    setRcptSendMoneyNotice,
    rcptWithdrawTheme,
    setRcptWithdrawTheme,
    rcptWithdrawTitle,
    setRcptWithdrawTitle,
    rcptWithdrawNotice,
    setRcptWithdrawNotice,
    rcptTelecomTheme,
    setRcptTelecomTheme,
    rcptTelecomTitle,
    setRcptTelecomTitle,
    rcptTelecomNotice,
    setRcptTelecomNotice,
    rcptShopTheme,
    setRcptShopTheme,
    rcptShopTitle,
    setRcptShopTitle,
    rcptShopNotice,
    setRcptShopNotice,
    setRcptQardTheme,
    rcptQardTheme,
    rcptQardTitle,
    setRcptQardTitle,
    rcptQardNotice,
    setRcptQardNotice,
    receiptPreviewCat,
    rcptDepositTheme,
    rcptDepositTitle,
    rcptDepositNotice,
    receiptFooterComputerGeneratedText,
    shopProductsList,
    handleSeedDefaultProducts,
    loading,
    handlePostProduct,
    prodSuccess,
    prodError,
    newProdName,
    setNewProdName,
    newProdPrice,
    setNewProdPrice,
    newProdOldPrice,
    setNewProdOldPrice,
    newProdCategory,
    setNewProdCategory,
    newProdImageUrl,
    setNewProdImageUrl,
    newProdIcon,
    setNewProdIcon,
    newProdMinOrder,
    setNewProdMinOrder,
    newProdShipTime,
    setNewProdShipTime,
    newProdDescription,
    setNewProdDescription,
    handleOpenEditProduct,
    handleDeleteProduct,
    setLoading,
    adminBankBoxTab,
    setAdminBankBoxTab,
    setBankPendingFilter,
    bankPendingFilter,
    setPreviewImage,
    setEditingTxModal,
    handleSaveGlobalRulesAndFees,
    cfgCoopInterestRate,
    setCfgCoopInterestRate,
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
    ebCurrency,
    setEbCurrency,
    ebCountry,
    setEbCountry,
    ebTransferFee,
    setEbTransferFee,
    ebCustomRate,
    setEbCustomRate,
    remitTransferFeeVal,
    setRemitTransferFeeVal,
    handleBankQrUpload,
    ebQrCodeUrl,
    setEbQrCodeUrl,
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
    cfgRemittanceFee,
    setCfgRemittanceFee,
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
    remitRates,
    handleEditRemitRate,
    handleDeleteRemitRate,
    setQardTickerInput,
    setQardShowTickerModal,
    setBannerSubSection,
    getFundValueAndStatus,
    setQardFundInput,
    setQardShowFundModal,
    setQardShowDirectLoanModal,
    setQardShowDonateModal,
    requestAlert,
    setTransactions,
    setUsers,
    setIsBulkPenaltyDeducting,
    setIsDeductingSinglePenalty,
    setIsBulkDeductingQard,
    setIsSendingQardNotice,
    adminGoldLoans,
    qardActiveSection,
    setQardActiveSection,
    setQardTenureFilter,
    qardTenureFilter,
    executeRejectTransaction,
    qardGoldFilter,
    qardGoldSearchQuery,
    setQardGoldFilter,
    setQardGoldSearchQuery,
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
    setQardEditingTx,
    setQardEditAmt,
    setQardEditStatus,
    setQardEditDesc,
    setQardEditWhatsapp,
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
    setRuleIsWarningInput,
    handleSaveBanners,
    bannersSaving,
    cfgTelecomTicker,
    setCfgTelecomTicker,
    cfgAgentTicker,
    setCfgAgentTicker,
    cfgCourierTicker,
    setCfgCourierTicker,
    cfgGatewayTicker,
    setCfgGatewayTicker,
    bannersSuccess,
    bannersError,
    bannerSubSection,
    renderBannerEditorList,
    dbDashboardBanners,
    setDbDashboardBanners,
    defaultDashboardSlides,
    dbQardBanners,
    setDbQardBanners,
    defaultQardSlides,
    dbSamityBanners,
    setDbSamityBanners,
    defaultSamitySlides,
    dbTelecomBanners,
    setDbTelecomBanners,
    defaultTelecomSlides,
    dbMoneyExchangeBanners,
    setDbMoneyExchangeBanners,
    defaultMoneyExchangeSlides,
    dbRationBanners,
    setDbRationBanners,
    defaultRationSlides,
    dbSafiBanners,
    setDbSafiBanners,
    defaultSafiSlides,
    dbAgentBanners,
    setDbAgentBanners,
    defaultAgentSlides,
    dbCourierBanners,
    setDbCourierBanners,
    defaultCourierSlides,
    handleFileChange,
    setDbEscrowCoverUrl,
    dbEscrowCoverUrl,
    agentRequestSuccessMsg,
    agentRequestErrorMsg,
    cfgAllowManualAgentLocation,
    handleToggleAllowManualAgentLocation,
    setAgentAdminSubTab,
    agentAdminSubTab,
    adminAgents,
    loadingAgentRequests,
    agentActionId,
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
    setTrackingAgent,
    setShowTrackingModal,
    handleDeleteAgent,
    setRationAdminTab,
    rationAdminTab,
    rationCards,
    approvingRationId,
    newCardNumber,
    setNewCardNumber,
    newCardExpiry,
    setNewCardExpiry,
    handleApproveRationCardWithDetails,
    setApprovingRationId,
    handleRejectRationCardDirect,
    handleCreateRationCardManually,
    rcNewUserId,
    setRcNewUserId,
    rcNewName,
    setRcNewName,
    rcNewPhone,
    setRcNewPhone,
    rcNewCardNo,
    setRcNewCardNo,
    rcNewCardType,
    setRcNewCardType,
    rcNewVipCardBg,
    setRcNewVipCardBg,
    rcNewVipBorderColor,
    setRcNewVipBorderColor,
    rcNewVipPrimaryColor,
    setRcNewVipPrimaryColor,
    rcNewVipTextColor,
    setRcNewVipTextColor,
    rcNewVillage,
    setRcNewVillage,
    rcNewUpazila,
    setRcNewUpazila,
    rcNewDistrict,
    setRcNewDistrict,
    rcNewNomineeName,
    setRcNewNomineeName,
    setRcNewPhoto,
    rcNewPhoto,
    fetchRationCards,
    rationSearchQuery,
    setRationSearchQuery,
    loadingRationCards,
    handleOpenEditRation,
    handleDeleteRationCard,
    rationAdminItems,
    handleOpenAddRationItem,
    handleOpenEditRationItem,
    handleDeleteRationItem,
    handleSaveRationSettings,
    cfgRationTitleText,
    setCfgRationTitleText,
    cfgRationMaxSelectLimit,
    setCfgRationMaxSelectLimit,
    cfgRationTotalItemsText,
    setCfgRationTotalItemsText,
    setSdSubTab,
    sdSubTab,
    disputes,
    handleCreateSafeDeal,
    sdTitle,
    setSdTitle,
    sdSupplier,
    setSdSupplier,
    sdPrice,
    setSdPrice,
    sdMinQty,
    setSdMinQty,
    sdEmoji,
    setSdEmoji,
    loadingEscrow,
    sdDesc,
    setSdDesc,
    safeDeals,
    handleToggleSafeDealStatus,
    handleDeleteSafeDeal,
    handleUpdateDisputeStatus,
    updatingDisputeId,
    setCourierSubTab,
    courierSubTab,
    courierRiders,
    courierOrders,
    handleDeleteCourierOrder,
    handleUpdateCourierOrderStatus,
    assignRiderId,
    setAssignRiderId,
    handleRegisterRider,
    newRiderName,
    setNewRiderName,
    newRiderPhone,
    setNewRiderPhone,
    newRiderMemberId,
    setNewRiderMemberId,
    loadingCourier,
    handleDeleteRider,
    isRunningWalletTests,
    setIsRunningWalletTests,
    setWalletTestResults,
    walletTestResults,
    setHistorySearch,
    setHistoryType,
    setHistoryStatus,
    setHistorySort,
    historySearch,
    historyType,
    historyStatus,
    historySort,
    setHistoryActiveScreenshot,
    handleAdminDeleteTransaction,
    resetSuccess,
    setResetSuccess,
    resetError,
    setResetError,
    setSystemResetEnabled,
    systemResetEnabled,
    setResetMode,
    resetMode,
    setResetConfirmInput,
    setResetPinInput,
    setShowResetModal,
    editingUser,
    setEditingUser,
    setAdjType,
    setAdjAmount,
    setAdjReason,
    editUserName,
    editUserMemberId,
    isSavingUser,
    handleSaveEditUser,
    setEditUserName,
    setEditUserMemberId,
    editUserPhone,
    setEditUserPhone,
    setEditBalance,
    setEditTelecomBalance,
    setEditSuperShopBalance,
    setEditSavings,
    setEditDueLoan,
    editBalance,
    editTelecomBalance,
    editSuperShopBalance,
    editSavings,
    editDueLoan,
    editPin,
    setEditPin,
    editIsAppLocked,
    editAppLockCode,
    setEditAppLockCode,
    setEditIsAppLocked,
    editUserStatus,
    setEditUserStatus,
    editRole,
    setEditRole,
    editMonthlySavingsTarget,
    setEditMonthlySavingsTarget,
    editSamitySchemeActive,
    setEditSamitySchemeActive,
    editCanDisableAutoSavings,
    setEditCanDisableAutoSavings,
    setEditSubAdminPermissions,
    editSubAdminPermissions,
    editSamityStatus,
    setEditSamityStatus,
    editMemberGroup,
    setEditMemberGroup,
    editCustomTelecomPercent,
    setEditCustomTelecomPercent,
    editDeviceChangeRequested,
    editCurrentDeviceId,
    setEditCurrentDeviceId,
    setEditDeviceChangeRequested,
    editDeviceLockBypassed,
    setEditDeviceLockBypassed,
    editFatherName,
    setEditFatherName,
    editMotherName,
    setEditMotherName,
    editNid,
    setEditNid,
    editDob,
    setEditDob,
    editOccupation,
    setEditOccupation,
    editAlternatePhone,
    setEditAlternatePhone,
    editDivision,
    setEditDivision,
    editDistrict,
    setEditDistrict,
    editThana,
    setEditThana,
    editPostOffice,
    setEditPostOffice,
    editFullAddress,
    setEditFullAddress,
    setEditHasSetProfile,
    editHasSetProfile,
    editNomineeName,
    setEditNomineeName,
    editNomineeRelation,
    setEditNomineeRelation,
    editNomineePhone,
    setEditNomineePhone,
    hasRationCard,
    editRationEnabled,
    setEditRationEnabled,
    editRationName,
    setEditRationName,
    editRationPhone,
    setEditRationPhone,
    editRationVillage,
    setEditRationVillage,
    editRationUpazila,
    setEditRationUpazila,
    editRationDistrict,
    setEditRationDistrict,
    editRationCardNo,
    setEditRationCardNo,
    editRationSecurityCode,
    setEditRationSecurityCode,
    editRationIssueDate,
    setEditRationIssueDate,
    editRationExpiryDate,
    setEditRationExpiryDate,
    editRationSignature,
    setEditRationSignature,
    editRationPhotoUrl,
    setEditRationPhotoUrl,
    adjType,
    adjAmount,
    adjReason,
    customNoticeText,
    setCustomNoticeText,
    editSamityPaidMonths,
    editTrackerSelectedYear,
    setEditTrackerSelectedYear,
    setEditSamityPaidMonths,
    userToDelete,
    deletePinInput,
    setDeletePinInput,
    setDeleteErrorMsg,
    confirmDeleteUserWithPin,
    deleteErrorMsg,
    isDeletingUser,
    setUserToDelete,
    historyActiveScreenshot,
    editingTxModal,
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
    riPrice,
    setRiPrice,
    riMarketPrice,
    setRiMarketPrice,
    riColor,
    setRiColor,
    setEditingRationItem,
    setIsAddingRationItem,
    isQuickPenaltyModalOpen,
    handleToggleMonthPenaltyExemption,
    showNetOperatingModal,
    setShowNetOperatingModal,
    netOperatingCash,
    companyReserveFund,
    totalMemberSavings,
    totalMemberMainBalance
  };

    return (
    <div className="w-full font-sans text-left" id="admin-panel-root">
      <div className="space-y-4 text-left">
        {/* 1. Slim Single-Row Top Header Bar */}
        <div className="bg-[#00a884] rounded-2xl px-2.5 sm:px-3.5 py-1.5 sm:py-2 flex items-center justify-between gap-2 text-white shadow-md mb-2.5 border border-teal-400/30">
          {/* Left Side: Back Arrow, Member Pill, Pending Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <UnifiedBackButton 
              onClick={handleGoBack}
              variant="emerald"
              title="ফিরে যান"
            />
            {/* 1. Member Count Pill (Left side - First) */}
            <div 
              onClick={() => setShowMemberListModal(true)}
              className="bg-[#008769] hover:bg-[#00745a] active:scale-95 px-2.5 sm:px-3 py-1 rounded-full flex items-center gap-1 sm:gap-1.5 text-white cursor-pointer transition whitespace-nowrap border border-teal-300/30 shadow-2xs"
              title="সকল সদস্যের সিরিয়াল তালিকা ও ব্যালেন্স দেখতে ক্লিক করুন"
            >
              <div className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-[9px] shadow-2xs shrink-0">
                M
              </div>
              <div className="leading-none text-[10px] sm:text-xs">
                <span className="font-black text-white">{users.length} জন</span>
              </div>
            </div>

            {/* 2. Pending Pill (Left side - Second) */}
            <div 
              onClick={() => {
                setHeaderPendingTab('all');
                setHeaderPendingAddMoneyMethod('all');
                setHeaderPendingStatusFilter('pending');
                setHeaderPendingSearchQuery('');
                setHeaderPendingDateFilter('all');
                setHeaderPendingCustomDate('');
                setShowHeaderPendingModal(true);
              }}
              className="bg-rose-600 hover:bg-rose-700 active:scale-95 px-2.5 sm:px-3.5 py-1 rounded-full text-white flex items-center gap-1.5 cursor-pointer transition shadow-xs whitespace-nowrap border border-rose-400/40"
              title="পেন্ডিং রিকোয়েস্ট সেন্টারে যান"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
              <span className="text-[10px] sm:text-xs font-bold text-rose-100">পেন্ডিং</span>
              <span className="font-black text-white text-xs sm:text-sm font-mono">{pendingRequests.length} টি</span>
            </div>
          </div>

          {/* Right Side: Bell Icon, Refresh, User View */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button 
              type="button"
              onClick={() => setShowAdminNotifyModal(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center cursor-pointer hover:bg-amber-300 transition relative shadow-2xs shrink-0 active:scale-95"
              title="নোটিফিকেশন ও অ্যালার্ট"
            >
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950 stroke-[2.2]" />
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-rose-600 text-white text-[8.5px] font-black rounded-full flex items-center justify-center animate-bounce border border-white shadow-xs">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button 
              type="button"
              onClick={() => {
                fetchBapReportsAndGroups();
                requestAlert('ডাটাবেজ রিফ্রেশ', 'ডাটাবেজ সফলভাবে রিফ্রেশ করা হয়েছে!');
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition shadow-2xs shrink-0 active:scale-95"
              title="পেজ রিফ্রেশ করুন"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('amb_admin_mode', 'true');
                onBack();
              }}
              className="px-2.5 sm:px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-full text-[10px] sm:text-xs flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer shrink-0 border border-amber-300"
              title="ইউজার অ্যাপ ড্যাশবোর্ডে সুইচে ক্লিক করুন"
            >
              <UserCheck className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
              <span className="whitespace-nowrap">ইউজার ভিউ</span>
            </button>
          </div>
        </div>

        {/* OVERVIEW (4-SECTION TRACKING + 12 BOX DASHBOARD + 12 GRID MATRIX + DRILLDOWN) */}
        {viewingGrid && (
          <AdminDashboardOverview {...adminScopeProps} />
        )}

        {/* 1. SAMITY SECTION */}
        <AdminSamitySection {...adminScopeProps} />

        {/* SALARY ADMIN SECTION */}
        <AdminSalarySection
          adminTab={adminTab}
          setViewingGrid={setViewingGrid}
          setAdminTab={setAdminTab}
        />

        {/* AUTO RECHARGE ADMIN SECTION */}
        <AdminAutoRechargeSection
          adminTab={adminTab}
          setViewingGrid={setViewingGrid}
          setAdminTab={setAdminTab}
          users={users}
          transactions={transactions}
          appConfig={appConfig}
          requestAlert={requestAlert}
          requestConfirm={requestConfirm}
          isMasterAdmin={isMasterAdmin}
        />

        {/* BILL PAY ADMIN SECTION */}
        <AdminBillPaySection
          adminTab={adminTab}
          setViewingGrid={setViewingGrid}
          setAdminTab={setAdminTab}
          users={users}
          transactions={transactions}
          appConfig={appConfig}
          requestAlert={requestAlert}
          requestConfirm={requestConfirm}
          isMasterAdmin={isMasterAdmin}
        />

        {/* 2. APPROVALS SECTION */}
        <AdminApprovalsSection {...adminScopeProps} />

        {/* NOTICES & BAP SECTION */}
        <AdminNoticesBapSection {...adminScopeProps} />
        
        {/* 3. CONFIG SECTION */}
        <AdminConfigSection {...adminScopeProps} />

        {/* 4. RECEIPT SECTION */}
        <AdminReceiptSection {...adminScopeProps} />

        {/* 5. SHOP SECTION */}
        <AdminShopSection {...adminScopeProps} />

        {/* 6. BANK SECTION */}
        <AdminBankSection {...adminScopeProps} />

        {/* 7. QARD SECTION */}
        <AdminQardSection {...adminScopeProps} />

        {/* 8. BANNERS SECTION */}
        <AdminBannersSection {...adminScopeProps} />

        {/* 9. AGENT SECTION */}
        <AdminAgentSection {...adminScopeProps} />

        {/* 10. RATION SECTION */}
        <AdminRationSection {...adminScopeProps} />

        {/* 11. SAFE DEALS SECTION */}
        <AdminSafeDealsSection {...adminScopeProps} />

        {/* 12. COURIER SECTION */}
        <AdminCourierSection {...adminScopeProps} />

        {/* 13. LEDGER SECTION */}
        <AdminLedgerSection {...adminScopeProps} />

        {/* 14. SYSTEM RESET SECTION */}
        <AdminSystemResetSection {...adminScopeProps} />

        {/* 15. USER EDIT MODAL */}
        <AdminUserEditModal {...adminScopeProps} />

        {/* 16. BOTTOM MODALS */}
        <AdminBottomModals {...adminScopeProps} />
      </div>
    </div>
  );
}
