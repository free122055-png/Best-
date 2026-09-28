import React, { useState, useEffect } from 'react';
import { User, Offer, AppConfig, Transaction } from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  setDoc,
  getDocs, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Sliders, 
  Smartphone, 
  CheckCircle2, 
  Gift, 
  Trash2, 
  Pencil,
  Plus, 
  Sparkles, 
  Megaphone,
  Bell,
  RefreshCw,
  Clock,
  UserCheck,
  Zap,
  ArrowLeft,
  Search,
  ListFilter,
  Check,
  X,
  FileText,
  AlertCircle,
  Database,
  TrendingUp,
  UserPlus,
  ArrowUpRight,
  ShieldAlert,
  BarChart3,
  Calendar,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TelecomAdminProps {
  appConfig: AppConfig;
  user: User;
  onClose: () => void;
  users?: User[];
  transactions?: Transaction[];
  handleApproveTransaction?: (tx: Transaction) => Promise<void>;
  handleRejectTransaction?: (txId: string) => Promise<void>;
}

export default function TelecomAdmin({ 
  appConfig: initialAppConfig, 
  user, 
  onClose,
  users: propUsers,
  transactions: propTransactions,
  handleApproveTransaction,
  handleRejectTransaction
}: TelecomAdminProps) {
  
  const [appConfig, setAppConfig] = useState<AppConfig>(initialAppConfig);
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [localNotices, setLocalNotices] = useState<any[]>([]);

  // Selected sub-section tab state (null shows the main 5-box Telecom Dashboard home screen first!)
  const [activeSection, setActiveSection] = useState<'pending' | 'offers' | 'slabs' | 'operators' | 'cashback_rules' | 'adjust_balance' | 'notices' | 'history' | 'banners' | 'ticker' | 'categories' | 'rates' | 'services' | 'money_exchange_admin' | null>(null);
  const [pendingSubTab, setPendingSubTab] = useState<'all' | 'flexiload' | 'drive' | 'add_money' | 'bill'>('all');

  // Ticker, Banners, Categories, Rates states
  const [tickerText, setTickerText] = useState(initialAppConfig?.telecomTicker || '');
  const [bannersList, setBannersList] = useState<any[]>(initialAppConfig?.telecomBanners || []);
  const [categoriesList, setCategoriesList] = useState<any[]>(initialAppConfig?.telecomCategories || []);
  const [mobRechargePct, setMobRechargePct] = useState(initialAppConfig?.mobileRechargePercent ?? 2.0);
  const [alaapRechargePct, setAlaapRechargePct] = useState(initialAppConfig?.alaapRechargePercent ?? 1.0);
  const [brilliantRechargePct, setBrilliantRechargePct] = useState(initialAppConfig?.brilliantRechargePercent ?? 1.0);

  // Services Config & Money Exchange Admin states
  const defaultServicesConfig = {
    mobile_recharge: { title: 'মোবাইল রিচার্জ', icon: '📱', subtitle: 'সব সিম রিচার্জ', isActive: true },
    alaap_recharge: { title: 'আলাপ রিচার্জ', icon: '📞', subtitle: 'আলাপ বিটিসিএল', isActive: true },
    brilliant_recharge: { title: 'ব্রিলিয়ান্ট রিচার্জ', icon: '🌐', subtitle: 'ব্রিলিয়ান্ট কানেক্ট', isActive: true },
    money_exchange: { title: 'মানি এক্সচেঞ্জ', icon: '💸', subtitle: 'বৈদেশিক কারেন্সি', isActive: true },
    data_pack: { title: 'ডাটা প্যাক', icon: '🌐', subtitle: 'ইন্টারনেট অফার', isActive: true },
    minute_pack: { title: 'মিনিট প্যাক', icon: '📞', subtitle: 'টকটাইম অফার', isActive: true },
    pack_builder: { title: 'প্যাক বিল্ডার', icon: '🎁', subtitle: 'বান্ডেল বানাই', isActive: true },
    balance_add: { title: 'হেল্পলাইন', icon: '🎧', subtitle: 'হেল্পলাইন সেকশন', isActive: true }
  };

  const [servicesConfig, setServicesConfig] = useState<Record<string, any>>(
    initialAppConfig?.telecomServicesConfig || defaultServicesConfig
  );

  const [helplinePhone, setHelplinePhone] = useState(
    initialAppConfig?.telecomHelplinePhone || initialAppConfig?.supportPhone || '01865911728'
  );
  const [helplineFacebook, setHelplineFacebook] = useState(
    initialAppConfig?.telecomHelplineFacebook || 'https://facebook.com'
  );
  const [helplineNotice, setHelplineNotice] = useState(
    initialAppConfig?.telecomHelplineNotice || 'যেকোনো বিষয় জানতে বা সমস্যার সমাধানের জন্য আমাদের হেল্পলাইন ওয়াটসঅ্যাপে মেসেজ অথবা সরাসরি কল করুন।'
  );

  const defaultMoneyExchangeRates = [
    { countryCode: 'MYR', countryName: 'মালয়েশিয়া (MYR)', currencyCode: 'MYR', flagEmoji: '🇲🇾', bdtRate: 28.5, minAmount: 100, maxAmount: 50000, cashback: 5 },
    { countryCode: 'SAR', countryName: 'সৌদি আরব (SAR)', currencyCode: 'SAR', flagEmoji: '🇸🇦', bdtRate: 32.2, minAmount: 100, maxAmount: 50000, cashback: 5 },
    { countryCode: 'AED', countryName: 'ইউএই (AED)', currencyCode: 'AED', flagEmoji: '🇦🇪', bdtRate: 32.8, minAmount: 100, maxAmount: 50000, cashback: 5 },
    { countryCode: 'QAR', countryName: 'কাতার (QAR)', currencyCode: 'QAR', flagEmoji: '🇶🇦', bdtRate: 33.1, minAmount: 100, maxAmount: 50000, cashback: 5 },
    { countryCode: 'KWD', countryName: 'কুয়েত (KWD)', currencyCode: 'KWD', flagEmoji: '🇰🇼', bdtRate: 392.0, minAmount: 10, maxAmount: 5000, cashback: 10 },
    { countryCode: 'OMR', countryName: 'ওমান (OMR)', currencyCode: 'OMR', flagEmoji: '🇴🇲', bdtRate: 312.0, minAmount: 10, maxAmount: 5000, cashback: 10 },
    { countryCode: 'USD', countryName: 'ইউএস ডলার (USD)', currencyCode: 'USD', flagEmoji: '🇺🇸', bdtRate: 120.0, minAmount: 10, maxAmount: 10000, cashback: 5 },
    { countryCode: 'GBP', countryName: 'ইউকে পাউন্ড (GBP)', currencyCode: 'GBP', flagEmoji: '🇬🇧', bdtRate: 152.0, minAmount: 10, maxAmount: 10000, cashback: 5 },
    { countryCode: 'EUR', countryName: 'ইউরো (EUR)', currencyCode: 'EUR', flagEmoji: '🇪🇺', bdtRate: 130.0, minAmount: 10, maxAmount: 10000, cashback: 5 },
    { countryCode: 'SGD', countryName: 'সিঙ্গাপুর (SGD)', currencyCode: 'SGD', flagEmoji: '🇸🇬', bdtRate: 90.0, minAmount: 100, maxAmount: 50000, cashback: 5 }
  ];

  const [exchangeEnabled, setExchangeEnabled] = useState(
    initialAppConfig?.moneyExchangeRatesConfig?.enabled !== false
  );
  const [exchangeNotice, setExchangeNotice] = useState(
    initialAppConfig?.moneyExchangeRatesConfig?.noticeText || 'লাইভ কারেন্সি এক্সচেঞ্জ রেট দিয়ে মুহূর্তেই নিরাপদে রিমিট্যান্স লেনদেন সম্পন্ন করুন।'
  );
  const [exchangeFlatFee, setExchangeFlatFee] = useState(
    initialAppConfig?.moneyExchangeRatesConfig?.flatFee ?? 0
  );
  const [exchangeRatesList, setExchangeRatesList] = useState<any[]>(
    initialAppConfig?.moneyExchangeRatesConfig?.rates || defaultMoneyExchangeRates
  );

  // New banner form states
  const [newBannerTag, setNewBannerTag] = useState('');
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerDesc, setNewBannerDesc] = useState('');
  const [newBannerImage, setNewBannerImage] = useState('');
  const [newBannerGradient, setNewBannerGradient] = useState('from-slate-950 via-cyan-950 to-emerald-950');

  // New category form states
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newCategoryLabel, setNewCategoryLabel] = useState('');

  // Active section's secondary filters & states
  const [searchTxQuery, setSearchTxQuery] = useState('');
  const [filterTxStatus, setFilterTxStatus] = useState<'all' | 'pending' | 'success' | 'failed'>('all');
  const [filterTxOperator, setFilterTxOperator] = useState<string>('all');

  // Notice creation states
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeBody, setNewNoticeBody] = useState('');
  const [isSendingNotice, setIsSendingNotice] = useState(false);

  // Copy state for quick number / full post copy in Telecom Admin Panel
  const [copiedStateKey, setCopiedStateKey] = useState<string | null>(null);

  const extractTargetPhone = (tx: any): string => {
    if (tx.phone && String(tx.phone).trim() !== '') return String(tx.phone).trim();
    if (tx.receiverPhone && String(tx.receiverPhone).trim() !== '') return String(tx.receiverPhone).trim();
    if (tx.phoneNumber && String(tx.phoneNumber).trim() !== '') return String(tx.phoneNumber).trim();
    if (tx.mobileNumber && String(tx.mobileNumber).trim() !== '') return String(tx.mobileNumber).trim();
    if (tx.accountNumber && String(tx.accountNumber).trim() !== '') return String(tx.accountNumber).trim();
    if (tx.description) {
      const match = tx.description.match(/(?:01[3-9]\d{8})/);
      if (match) return match[0];
    }
    return '';
  };

  const extractCleanOfferTitle = (tx: any): string => {
    if (tx.packTitle && String(tx.packTitle).trim() !== '') return String(tx.packTitle).trim();
    if (tx.offerTitle && String(tx.offerTitle).trim() !== '') return String(tx.offerTitle).trim();
    if (tx.description) {
      const matchQuote = tx.description.match(/প্যাকঃ\s*"([^"]+)"/);
      if (matchQuote && matchQuote[1]) return matchQuote[1].trim();
      return tx.description
        .replace(/^[^\s]+\s*নম্বরে\s*\([^)]*\)\s*/i, '')
        .replace(/ক্যাশ রিচার্জের আবেদন করা হয়েছে.*/gi, '')
        .replace(/ক্রয়ের আবেদন করা হয়েছে.*/gi, '')
        .replace(/অ্যাডমিন ভেরিফিকেশন পেন্ডিং.*/gi, '')
        .trim();
    }
    return `৳${tx.amount} রিচার্জ`;
  };

  const getFormattedFullPostText = (tx: any, phoneNum: string): string => {
    const operatorStr = tx.paymentMethod || tx.operator || 'অপারেটর';
    const cleanTitle = extractCleanOfferTitle(tx);
    const descLower = (tx.description || '').toLowerCase();
    const isDrive = descLower.includes('gb') || 
      descLower.includes('মিনিট') || 
      descLower.includes('প্যাক') || 
      descLower.includes('ড্রাইভ') ||
      descLower.includes('অফার');

    if (isDrive) {
      return `${phoneNum || 'ফোন নম্বর নেই'} - ${cleanTitle} (৳${tx.amount}) [${operatorStr}]`;
    } else {
      return `${phoneNum || 'ফোন নম্বর নেই'} - ৳${tx.amount} রিচার্জ [${operatorStr}]`;
    }
  };

  const handleCopyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedStateKey(key);
    setTimeout(() => {
      setCopiedStateKey(null);
    }, 2500);
  };

  // Telecom-specific Admin configuration states
  const [cfgSlab1Amt, setCfgSlab1Amt] = useState(20);
  const [cfgSlab1Cb, setCfgSlab1Cb] = useState(0);
  const [cfgSlab2Amt, setCfgSlab2Amt] = useState(50);
  const [cfgSlab2Cb, setCfgSlab2Cb] = useState(5);
  const [cfgSlab3Amt, setCfgSlab3Amt] = useState(100);
  const [cfgSlab3Cb, setCfgSlab3Cb] = useState(0);
  const [cfgSlab4Amt, setCfgSlab4Amt] = useState(500);
  const [cfgSlab4Cb, setCfgSlab4Cb] = useState(0);

  const [cfgOperatorCashbacks, setCfgOperatorCashbacks] = useState<Record<string, { slab1: number; slab2: number; slab3: number; slab4: number }>>({});
  
  // Cashback rules states
  const [cbAmountRule, setCbAmountRule] = useState('');
  const [cbCashbackRule, setCbCashbackRule] = useState('');
  const [cbOperatorRule, setCbOperatorRule] = useState('all');
  const [cbCustomOperator, setCbCustomOperator] = useState('');
  const [editingCbRuleId, setEditingCbRuleId] = useState<string | null>(null);
  const [cbSaving, setCbSaving] = useState(false);

  // New Custom Telecom Offer states
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [offerTitle, setOfferTitle] = useState('');
  const [offerCommission, setOfferCommission] = useState('');
  const [offerOperator, setOfferOperator] = useState('Grameenphone');
  const [offerCategory, setOfferCategory] = useState<'internet' | 'minute' | 'bundle'>('internet');
  const [offerValidity, setOfferValidity] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerIsHot, setOfferIsHot] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState(false);

  // Admin offer list filter states
  const [adminOfferOperatorFilter, setAdminOfferOperatorFilter] = useState<string>('all');
  const [adminOfferCategoryFilter, setAdminOfferCategoryFilter] = useState<string>('all');
  const [adminOfferSearchQuery, setAdminOfferSearchQuery] = useState<string>('');

  // Balance adjust states
  const [adjustTargetUid, setAdjustTargetUid] = useState('');
  const [adjustWalletType, setAdjustWalletType] = useState('telecomBalance');
  const [adjustActionType, setAdjustActionType] = useState('bonus');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Search filter for balance adjustments
  const [searchMemberQuery, setSearchMemberQuery] = useState('');

  // Transaction extra commission and cashback entry (pending request processing)
  const [txCommissionMap, setTxCommissionMap] = useState<Record<string, number>>({});
  const [txCashbackMap, setTxCashbackMap] = useState<Record<string, number>>({});
  const [localTransactions, setLocalTransactions] = useState<Transaction[]>([]);
  const [reportFilterMode, setReportFilterMode] = useState<'since_reset' | 'today' | 'all'>('since_reset');
  const [customResetAt, setCustomResetAt] = useState<string>(() => {
    return localStorage.getItem('telecom_report_reset_at') || '';
  });

  const handleResetReportToZero = async () => {
    if (window.confirm("আপনি কি নিশ্চিতভাবে বর্তমান সেলস ও রিচার্জ রিপোর্ট জিরো ব্যালেন্স (০) করতে চান? এরপরের নতুন লেনদেনসমূহ থেকে জিরো পয়েন্ট থেকে নতুন হিসাব গণনা করা হবে।")) {
      try {
        const newResetAt = new Date().toISOString();
        setCustomResetAt(newResetAt);
        localStorage.setItem('telecom_report_reset_at', newResetAt);
        setReportFilterMode('since_reset');

        const configRef = doc(db, 'system_settings', 'app_config');
        await setDoc(configRef, { telecomReportResetAt: newResetAt }, { merge: true });
        setAppConfig(prev => ({ ...prev, telecomReportResetAt: newResetAt }));
        alert("সামারি রিপোর্ট সফলভাবে জিরো (০) ব্যালেন্সে রিসেট করা হয়েছে!");
      } catch (err: any) {
        console.error("Reset report error:", err);
        alert("সামারি রিপোর্ট জিরো (০) ব্যালেন্সে রিসেট করা হয়েছে!");
      }
    }
  };

  const handleRestoreFullReport = async () => {
    if (window.confirm("আপনি কি রিসেট পয়েন্ট তুলে দিয়ে সম্পূর্ণ ইতিহাসের রিপোর্ট দেখতে চান?")) {
      try {
        setCustomResetAt('');
        localStorage.removeItem('telecom_report_reset_at');
        setReportFilterMode('all');

        const configRef = doc(db, 'system_settings', 'app_config');
        await setDoc(configRef, { telecomReportResetAt: '' }, { merge: true });
        setAppConfig(prev => ({ ...prev, telecomReportResetAt: '' }));
        alert("সম্পূর্ণ পূর্বের ইতিহাস রিস্টোর করা হয়েছে!");
      } catch (err: any) {
        console.error("Restore report error:", err);
      }
    }
  };

  // Real-time app config observer & load default data
  useEffect(() => {
    const configRef = doc(db, 'system_settings', 'app_config');
    const unsubConfig = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppConfig;
        setAppConfig(data);
        
        // Initialize slab values from latest app config
        if (data.telecomDefaultSlabs) {
          setCfgSlab1Amt(data.telecomDefaultSlabs[0]?.amount ?? 20);
          setCfgSlab1Cb(data.telecomDefaultSlabs[0]?.cashback ?? 0);
          setCfgSlab2Amt(data.telecomDefaultSlabs[1]?.amount ?? 50);
          setCfgSlab2Cb(data.telecomDefaultSlabs[1]?.cashback ?? 5);
          setCfgSlab3Amt(data.telecomDefaultSlabs[2]?.amount ?? 100);
          setCfgSlab3Cb(data.telecomDefaultSlabs[2]?.cashback ?? 0);
          setCfgSlab4Amt(data.telecomDefaultSlabs[3]?.amount ?? 500);
          setCfgSlab4Cb(data.telecomDefaultSlabs[3]?.cashback ?? 0);
        }
        
        if (data.telecomOperatorCashbacks) {
          setCfgOperatorCashbacks(data.telecomOperatorCashbacks);
        }

        if (data.telecomTicker !== undefined) setTickerText(data.telecomTicker);
        if (data.telecomBanners !== undefined) setBannersList(data.telecomBanners);
        if (data.telecomCategories !== undefined) setCategoriesList(data.telecomCategories);
        if (data.mobileRechargePercent !== undefined) setMobRechargePct(data.mobileRechargePercent);
        if (data.alaapRechargePercent !== undefined) setAlaapRechargePct(data.alaapRechargePercent);
        if (data.brilliantRechargePercent !== undefined) setBrilliantRechargePct(data.brilliantRechargePercent);
      }
    });

    const unsubTx = onSnapshot(collection(db, 'transactions'), (snap) => {
      const txList: Transaction[] = [];
      snap.forEach((d) => {
        txList.push({ id: d.id, docId: d.id, ...d.data() } as Transaction);
      });
      setLocalTransactions(txList);
    });

    fetchData();

    return () => {
      unsubConfig();
      unsubTx();
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users locally if not passed from prop
      if (!propUsers) {
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersList: User[] = [];
        usersSnap.forEach((d) => {
          usersList.push({ uid: d.id, ...d.data() } as User);
        });
        usersList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setLocalUsers(usersList);
      }

      // Fetch offers
      await fetchOffers();

      // Fetch notices for telecom
      const noticesSnap = await getDocs(collection(db, 'notices'));
      const noticesList: any[] = [];
      noticesSnap.forEach((d) => {
        noticesList.push({ id: d.id, ...d.data() });
      });
      const filteredNotices = noticesList.filter(n => n.section === 'telecom');
      filteredNotices.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setLocalNotices(filteredNotices);

    } catch (e) {
      console.error("Error loading telecom admin data:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOffers = async () => {
    try {
      const snap = await getDocs(collection(db, 'offers'));
      const list: Offer[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({ ...data, id: data.id || d.id, docId: d.id } as Offer);
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setOffers(list);
    } catch (err) {
      console.error("Error fetching offers:", err);
    }
  };

  // Telecom notice creation
  const handleSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeTitle.trim() || !newNoticeBody.trim()) return;

    setIsSendingNotice(true);
    try {
      const noticeId = `not-tel-${Date.now()}`;
      const noticeObj = {
        id: noticeId,
        title: newNoticeTitle,
        body: newNoticeBody,
        section: 'telecom',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'notices'), noticeObj);
      alert('টেলিকম নোটিশটি সফলভাবে পাঠানো হয়েছে!');
      setNewNoticeTitle('');
      setNewNoticeBody('');

      setLocalNotices(prev => [noticeObj, ...prev]);
    } catch (err: any) {
      console.error("Error sending telecom notice:", err);
      alert('নোটিশ পাঠাতে ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setIsSendingNotice(false);
    }
  };

  const handleDeleteNotice = async (docId: string, id: string) => {
    if (!window.confirm('আপনি কি এই নোটিশটি ডিলিট করতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'notices', docId));
      setLocalNotices(prev => prev.filter(n => n.id !== id));
      alert('নোটিশটি সফলভাবে মুছে ফেলা হয়েছে!');
    } catch (err) {
      console.error("Error deleting notice:", err);
    }
  };

  // Save scrolling ticker (announcement) text
  const handleSaveTicker = async () => {
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { telecomTicker: tickerText }, { merge: true });
      alert("স্ক্রলিং ঘোষণা ও নোটিশ সফলভাবে আপডেট করা হয়েছে!");
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    }
  };

  // Save commission rates
  const handleSaveRates = async () => {
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { 
        mobileRechargePercent: Number(mobRechargePct),
        alaapRechargePercent: Number(alaapRechargePct),
        brilliantRechargePercent: Number(brilliantRechargePct)
      }, { merge: true });
      alert("রিচার্জ কমিশন ও রেট সেটিংস সফলভাবে আপডেট করা হয়েছে!");
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    }
  };

  // Add a Telecom Banner slide
  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBannerTitle.trim() || !newBannerDesc.trim()) {
      alert("দয়া করে টাইটেল এবং বিবরণ পূরণ করুন!");
      return;
    }

    try {
      const newBannerObj = {
        id: Date.now(),
        tag: newBannerTag.trim() || "টেলিকম অফার",
        title: newBannerTitle.trim(),
        description: newBannerDesc.trim(),
        bgGradient: newBannerGradient.trim() || "from-slate-950 via-cyan-950 to-emerald-950",
        image: newBannerImage.trim() || "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=650"
      };

      const updatedBanners = [...bannersList, newBannerObj];
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { telecomBanners: updatedBanners }, { merge: true });

      setBannersList(updatedBanners);
      setNewBannerTag('');
      setNewBannerTitle('');
      setNewBannerDesc('');
      setNewBannerImage('');
      setNewBannerGradient('from-slate-950 via-cyan-950 to-emerald-950');
      alert("নতুন ব্যানার সফলভাবে সংযুক্ত করা হয়েছে!");
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    }
  };

  // Delete a Telecom Banner slide
  const handleDeleteBanner = async (bannerId: number) => {
    if (!window.confirm("আপনি কি এই ব্যানারটি মুছে ফেলতে চান?")) return;
    try {
      const updatedBanners = bannersList.filter(b => b.id !== bannerId);
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { telecomBanners: updatedBanners }, { merge: true });
      setBannersList(updatedBanners);
      alert("ব্যানারটি সফলভাবে মুছে ফেলা হয়েছে!");
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    }
  };

  // Add Operator Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryId.trim() || !newCategoryLabel.trim()) {
      alert("দয়া করে অপারেটর আইডি এবং নাম পূরণ করুন!");
      return;
    }

    try {
      const newCatObj = {
        id: newCategoryId.trim(),
        label: newCategoryLabel.trim()
      };

      if (categoriesList.some(c => c.id.toLowerCase() === newCatObj.id.toLowerCase())) {
        alert("এই আইডি দিয়ে অপারেটর অলরেডি রয়েছে!");
        return;
      }

      const updatedCats = [...categoriesList, newCatObj];
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { telecomCategories: updatedCats }, { merge: true });

      setCategoriesList(updatedCats);
      setNewCategoryId('');
      setNewCategoryLabel('');
      alert("নতুন অপারেটর সফলভাবে যুক্ত করা হয়েছে!");
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    }
  };

  // Delete Operator Category
  const handleDeleteCategory = async (catId: string) => {
    if (!window.confirm(`আপনি কি "${catId}" অপারেটরটি মুছে ফেলতে চান?`)) return;
    try {
      const updatedCats = categoriesList.filter(c => c.id !== catId);
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { telecomCategories: updatedCats }, { merge: true });
      setCategoriesList(updatedCats);
      alert("অপারেটরটি সফলভাবে মুছে ফেলা হয়েছে!");
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    }
  };

  // Cashback Rules
  const handleStartEditCashbackRule = (rule: any) => {
    const ruleId = rule.id || `cb_${rule.amount}_${rule.operator || 'all'}`;
    setEditingCbRuleId(ruleId);
    setCbAmountRule(String(rule.amount || ''));
    setCbCashbackRule(String(rule.cashback || ''));
    const op = rule.operator || 'all';
    const knownOps = ['all', 'Grameenphone', 'Robi', 'Airtel', 'Banglalink', 'Teletalk', 'Skitto', 'Alaap', 'Brilliant'];
    if (knownOps.includes(op)) {
      setCbOperatorRule(op);
      setCbCustomOperator('');
    } else {
      setCbOperatorRule('custom');
      setCbCustomOperator(op);
    }
  };

  const handleCancelEditCashbackRule = () => {
    setEditingCbRuleId(null);
    setCbAmountRule('');
    setCbCashbackRule('');
    setCbOperatorRule('all');
    setCbCustomOperator('');
  };

  const handleAddCashbackRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cbAmountRule || cbCashbackRule === '') {
      alert('দয়া করে রিচার্জের পরিমাণ এবং ক্যাশব্যাকের পরিমাণ সঠিকভাবে লিখুন!');
      return;
    }

    const amount = Number(cbAmountRule);
    const cashback = Number(cbCashbackRule);

    if (isNaN(amount) || amount <= 0 || isNaN(cashback) || cashback < 0) {
      alert('দয়া করে সঠিক ধনাত্মক সংখ্যা লিখুন!');
      return;
    }

    let finalOperator = cbOperatorRule;
    if (cbOperatorRule === 'custom') {
      finalOperator = cbCustomOperator.trim() || 'সকল অপারেটর';
    }

    setCbSaving(true);
    try {
      const currentRules = appConfig?.rechargeCashbackRules || [];
      let updatedRules: any[] = [];

      if (editingCbRuleId) {
        let matched = false;
        updatedRules = currentRules.map((r, idx) => {
          const ruleId = r.id || `cb_${r.amount}_${r.operator || 'all'}`;
          if (ruleId === editingCbRuleId) {
            matched = true;
            return {
              ...r,
              id: ruleId,
              amount,
              cashback,
              operator: finalOperator
            };
          }
          return r;
        });
        if (!matched) {
          updatedRules.push({
            id: editingCbRuleId,
            amount,
            cashback,
            operator: finalOperator
          });
        }
      } else {
        const newRule = {
          id: `cb_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          amount,
          cashback,
          operator: finalOperator
        };

        const filteredRules = currentRules.filter(r => {
          const sameAmount = Number(r.amount) === amount;
          const sameOp = (r.operator || 'all').toLowerCase() === finalOperator.toLowerCase();
          return !(sameAmount && sameOp);
        });

        updatedRules = [...filteredRules, newRule];
      }

      updatedRules.sort((a, b) => Number(a.amount) - Number(b.amount));

      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { rechargeCashbackRules: updatedRules }, { merge: true });

      setAppConfig(prev => ({
        ...prev,
        rechargeCashbackRules: updatedRules
      }));

      setCbAmountRule('');
      setCbCashbackRule('');
      setCbOperatorRule('all');
      setCbCustomOperator('');
      setEditingCbRuleId(null);
      alert(editingCbRuleId ? "ক্যাশব্যাক অফার রুলটি সফলভাবে আপডেট করা হয়েছে!" : "ক্যাশব্যাক অফার রুলটি সফলভাবে সংরক্ষণ করা হয়েছে!");
    } catch (err: any) {
      console.error("Error saving cashback rule:", err);
      alert("রুল সেভ করতে সমস্যা হয়েছেঃ " + err.message);
    } finally {
      setCbSaving(false);
    }
  };

  const handleDeleteCashbackRule = async (targetRule: any) => {
    const ruleAmount = typeof targetRule === 'object' ? targetRule.amount : targetRule;
    const ruleOp = typeof targetRule === 'object' ? (targetRule.operator || 'all') : 'all';
    const ruleId = typeof targetRule === 'object' ? targetRule.id : null;

    const opLabel = ruleOp === 'Grameenphone' ? 'গ্রামীনফোন' :
                    ruleOp === 'Robi' ? 'রবি' :
                    ruleOp === 'Airtel' ? 'এয়ারটেল' :
                    ruleOp === 'Banglalink' ? 'বাংলালিংক' :
                    ruleOp === 'Teletalk' ? 'টেলিটক' :
                    ruleOp === 'Skitto' ? 'স্কিটো' :
                    ruleOp === 'Alaap' ? 'আলাপ' :
                    ruleOp === 'Brilliant' ? 'ব্রিলিয়ান্ট' :
                    ruleOp === 'all' ? 'সকল অপারেটর' : ruleOp;

    if (!window.confirm(`আপনি কি ৳${ruleAmount} (${opLabel}) এর ক্যাশব্যাক রুলটি মুছে ফেলতে চান?`)) return;

    try {
      const currentRules = appConfig?.rechargeCashbackRules || [];
      let updatedRules: any[] = [];

      if (ruleId) {
        updatedRules = currentRules.filter(r => (r.id || `cb_${r.amount}_${r.operator || 'all'}`) !== ruleId);
      } else {
        updatedRules = currentRules.filter(r => {
          const matchAmount = Number(r.amount) === Number(ruleAmount);
          const matchOp = (r.operator || 'all').toLowerCase() === ruleOp.toLowerCase();
          return !(matchAmount && matchOp);
        });
      }

      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, { rechargeCashbackRules: updatedRules }, { merge: true });

      setAppConfig(prev => ({
        ...prev,
        rechargeCashbackRules: updatedRules
      }));

      // Reset edit mode if deleting the currently edited rule
      if (editingCbRuleId && (ruleId === editingCbRuleId || targetRule.id === editingCbRuleId)) {
        handleCancelEditCashbackRule();
      }

      alert("ক্যাশব্যাক রুলটি সফলভাবে মুছে ফেলা হয়েছে!");
    } catch (err: any) {
      console.error("Error deleting cashback rule:", err);
      alert("রুল ডিলিট করতে সমস্যা হয়েছেঃ " + err.message);
    }
  };

  // Telecom Offer Edit/Post handlers
  const handleStartEditOffer = (op: Offer) => {
    setEditingOfferId(op.id);
    setEditingDocId(op.docId || op.id);
    setOfferTitle(op.title || '');
    const regPriceStr = op.regularPrice !== undefined && op.regularPrice !== null && Number(op.regularPrice) > 0
      ? String(op.regularPrice)
      : (op.commission !== undefined && op.commission !== null && Number(op.commission) > 0
          ? String(Number(op.price || 0) + Number(op.commission))
          : '');
    setOfferCommission(regPriceStr);
    setOfferOperator(op.operator || 'Grameenphone');
    setOfferCategory(op.category || 'internet');
    setOfferValidity(op.validity || '');
    setOfferPrice(op.price !== undefined && op.price !== null ? String(op.price) : '');
    setOfferIsHot(!!op.isHot);
  };

  const handleCancelEditOffer = () => {
    setEditingOfferId(null);
    setEditingDocId(null);
    setOfferTitle('');
    setOfferCommission('');
    setOfferValidity('');
    setOfferPrice('');
    setOfferIsHot(false);
  };

  const handlePostOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerTitle.trim() || !offerPrice || !offerValidity.trim()) {
      alert('সব তথ্য সঠিকভাবে দিন!');
      return;
    }

    try {
      const regVal = offerCommission ? Number(offerCommission) : 0;
      const priceVal = Number(offerPrice) || 0;
      const commVal = (regVal > 0 && regVal > priceVal) ? regVal - priceVal : 0;

      if (editingDocId) {
        // Update existing offer doc
        await updateDoc(doc(db, 'offers', editingDocId), {
          title: offerTitle.trim(),
          operator: offerOperator,
          category: offerCategory,
          validity: offerValidity.trim(),
          price: priceVal,
          regularPrice: regVal > 0 ? regVal : priceVal,
          commission: commVal,
          isHot: offerIsHot,
          updatedAt: new Date().toISOString()
        });
        alert('অফার প্যাকেজটি সফলভাবে আপডেট করা হয়েছে!');
      } else {
        // Create new offer doc
        const offerId = `off-${Date.now()}`;
        await addDoc(collection(db, 'offers'), {
          id: offerId,
          title: offerTitle.trim(),
          operator: offerOperator,
          category: offerCategory,
          validity: offerValidity.trim(),
          price: priceVal,
          regularPrice: regVal > 0 ? regVal : priceVal,
          commission: commVal,
          isHot: offerIsHot,
          createdAt: new Date().toISOString()
        });
        alert('নতুন অফার সফলভাবে যুক্ত করা হয়েছে!');
      }

      handleCancelEditOffer();
      setOfferSuccess(true);
      setTimeout(() => setOfferSuccess(false), 3000);
      fetchOffers();
    } catch (err: any) {
      console.error("Error saving offer:", err);
      alert("অফার সংরক্ষণ করতে সমস্যা হয়েছেঃ " + err.message);
    }
  };

  const handleDeleteOffer = async (offerId: string, docId?: string) => {
    if (!window.confirm('আপনি কি এই অফারটি ডিলিট করতে চান?')) return;
    
    // Optimistically update local UI state immediately
    setOffers((prev) => prev.filter((o) => o.id !== offerId && o.docId !== docId && o.docId !== offerId));

    try {
      let isDeleted = false;
      if (docId) {
        try {
          await deleteDoc(doc(db, 'offers', docId));
          isDeleted = true;
        } catch (e) {
          console.warn("Direct docId delete failed, attempting query match:", e);
        }
      }

      // Query-based deletion to clean up doc by id or docId if direct docId missed
      const oQuery = await getDocs(collection(db, 'offers'));
      for (const docSnap of oQuery.docs) {
        const data = docSnap.data();
        if (docSnap.id === docId || docSnap.id === offerId || data.id === offerId || data.id === docId) {
          await deleteDoc(doc(db, 'offers', docSnap.id));
          isDeleted = true;
        }
      }

      await fetchOffers();
      alert('অফারটি সফলভাবে মুছে ফেলা হয়েছে!');
    } catch (err: any) {
      console.error("Error deleting offer:", err);
      alert("অফার ডিলিট করতে সমস্যা হয়েছে: " + (err?.message || 'Error'));
      await fetchOffers();
    }
  };

  const handleSeedDefaultOffers = async () => {
    setLoading(true);
    try {
      const PRESET_OFFERS = [
        { title: "50GB INTERNET (GP Pack)", operator: "Grameenphone", category: "internet", validity: "30 Days", price: 615, commission: 80, isHot: true },
        { title: "100GB INTERNET GP VIP", operator: "Grameenphone", category: "internet", validity: "30 Days", price: 745, commission: 120, isHot: true },
        { title: "700 Robi Minute Combo", operator: "Robi", category: "minute", validity: "30 Days", price: 345, commission: 45, isHot: true },
        { title: "500 MARVEL MINUTES Airtel", operator: "Airtel", category: "minute", validity: "30 Days", price: 270, commission: 35, isHot: true },
        { title: "৳1000 RECHARGE SPECIAL Blast", operator: "Alaap", category: "bundle", validity: "UNLIMITED", price: 1000, commission: 100, isHot: true },
        { title: "১০ জিবি ইন্টারনেট ধামাকা প্যাক", operator: "Banglalink", category: "internet", validity: "৩০ দিন", price: 349, commission: 50, isHot: false },
        { title: "৩০ জিবি সুপার ক্লাব Robi", operator: "Robi", category: "internet", validity: "৩০ দিন", price: 599, commission: 90, isHot: false },
        { title: "৫০০ মিনিট বাংলালিংক এক্সট্রা", operator: "Banglalink", category: "minute", validity: "৩০ দিন", price: 298, commission: 10, isHot: true }
      ];

      for (const op of PRESET_OFFERS) {
        const offerId = `off-preset-${Math.random().toString(36).substring(2, 10)}`;
        await addDoc(collection(db, 'offers'), {
          ...op,
          id: offerId,
          createdAt: new Date().toISOString()
        });
      }
      fetchOffers();
      alert('ডিফল্ট ৩জি/৪জি প্যাকেজ সমুহ সফলভাবে লোড হয়েছে!');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered admin offers for UI display
  const filteredAdminOffers = offers.filter((op) => {
    if (adminOfferOperatorFilter !== 'all') {
      if (op.operator.toLowerCase() !== adminOfferOperatorFilter.toLowerCase()) {
        return false;
      }
    }
    if (adminOfferCategoryFilter !== 'all') {
      if (op.category !== adminOfferCategoryFilter) {
        return false;
      }
    }
    if (adminOfferSearchQuery.trim()) {
      const q = adminOfferSearchQuery.toLowerCase();
      const matchTitle = (op.title || '').toLowerCase().includes(q);
      const matchOp = (op.operator || '').toLowerCase().includes(q);
      const matchVal = (op.validity || '').toLowerCase().includes(q);
      if (!matchTitle && !matchOp && !matchVal) return false;
    }
    return true;
  });

  // Manual Balance adjustment submit handler
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetUid) {
      alert('দয়া করে একজন সদস্য নির্বাচন করুন!');
      return;
    }
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('দয়া করে সঠিক ধনাত্মক টাকার পরিমাণ প্রবেশ করান!');
      return;
    }
    if (!adjustReason.trim()) {
      alert('দয়া করে ট্রানজেকশনের কারণ বা নোট প্রদান করুন!');
      return;
    }

    setIsAdjusting(true);
    try {
      const activeUsersList = propUsers || localUsers;
      const targetUser = activeUsersList.find(u => u.uid === adjustTargetUid);
      if (!targetUser) {
        alert('সদস্য খুঁজে পাওয়া যায়নি!');
        setIsAdjusting(false);
        return;
      }

      let currentBal = 0;
      let balanceField = 'telecomBalance';
      let walletLabel = 'টেলিকম ব্যালেন্স';

      if (adjustWalletType === 'balance') {
        currentBal = targetUser.balance || 0;
        balanceField = 'balance';
        walletLabel = 'মূল ড্যাশবোর্ড ব্যালেন্স';
      } else if (adjustWalletType === 'superShopBalance') {
        currentBal = targetUser.superShopBalance || 0;
        balanceField = 'superShopBalance';
        walletLabel = 'সুপার শপ ব্যালেন্স';
      } else {
        currentBal = targetUser.telecomBalance || 0;
        balanceField = 'telecomBalance';
        walletLabel = 'টেলিকম ব্যালেন্স';
      }

      let finalBal = currentBal;
      let txType = 'deposit';
      let txLabel = 'টেলিকম বোনাস';
      let paymentMethod = 'Telecom Admin Bonus';
      let description = '';
      let notifTitle = '';
      let notifBody = '';

      if (adjustActionType === 'deduct') {
        finalBal = currentBal - amount;
        txType = 'withdraw';
        txLabel = adjustWalletType === 'balance' ? 'অ্যাডমিন চার্জ কর্তন' : adjustWalletType === 'superShopBalance' ? 'শপ চার্জ কর্তন' : 'টেলিকম চার্জ কর্তন';
        paymentMethod = 'Telecom Admin Debit';
        description = `টেলিকম প্যানেল কর্তনঃ ${adjustReason}। পূর্বের ${walletLabel}ঃ ৳${currentBal} | নতুন ${walletLabel}ঃ ৳${finalBal}।`;
        notifTitle = `⚠️ ${walletLabel} কর্তন করা হয়েছে`;
        notifBody = `প্রিয় গ্রাহক, আপনার ${walletLabel} হতে এডমিন প্যানেল কর্তৃক ৳${amount} কেটে নেওয়া হয়েছে।\nकारण/নোট: ${adjustReason}`;
      } else {
        finalBal = currentBal + amount;
        txType = 'deposit';
        txLabel = adjustWalletType === 'balance' ? 'অ্যাডমিন বোনাস' : adjustWalletType === 'superShopBalance' ? 'শপ বোনাস' : 'টেলিকম বোনাস';
        paymentMethod = 'Telecom Admin Bonus';
        description = `টেলিকম প্যানেল বোনাসঃ ${adjustReason}। পূর্বের ${walletLabel}ঃ ৳${currentBal} | নতুন ${walletLabel}ঃ ৳${finalBal}।`;
        notifTitle = `🎉 ${walletLabel} বোনাস যুক্ত হয়েছে!`;
        notifBody = `প্রিয় গ্রাহক, আমাদের টেলিকম এডমিন প্যানেল থেকে আপনার ${walletLabel}-এ ৳${amount} বোনাস যুক্ত করা হয়েছে।\nবোনাস নোট: ${adjustReason}`;
      }

      // Update Firestore balance
      await updateDoc(doc(db, 'users', targetUser.uid), { [balanceField]: finalBal });

      // Create Transaction Log
      await addDoc(collection(db, 'transactions'), {
        id: `tx-telecom-adj-${Date.now()}`,
        userId: targetUser.uid,
        userName: targetUser.name,
        memberId: targetUser.memberId || 'N/A',
        type: txType,
        typeLabel: txLabel,
        amount: amount,
        status: 'success',
        createdAt: new Date().toISOString(),
        paymentMethod: paymentMethod,
        description: description
      });

      // Send Push Notification
      await addDoc(collection(db, 'user_notifications'), {
        userId: targetUser.uid,
        memberId: targetUser.memberId || 'N/A',
        title: notifTitle,
        body: notifBody,
        read: false,
        isPersonal: true,
        category: 'admin_msg',
        createdAt: new Date().toISOString()
      });

      alert('সদস্যের ওয়ালেট ব্যালেন্স সফলভাবে আপডেট করা হয়েছে!');
      
      // Reset form states
      setAdjustAmount('');
      setAdjustReason('');
      setAdjustTargetUid('');

      // Refresh users local state list if prop wasn't passed
      fetchData();

    } catch (err: any) {
      console.error("Error processing balance adjustment:", err);
      alert('ওয়ালেট ব্যালেন্স আপডেট করতে ব্যর্থ হয়েছে।');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleSaveServicesConfig = async () => {
    setLoading(true);
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, {
        telecomServicesConfig: servicesConfig,
        telecomHelplinePhone: helplinePhone,
        telecomHelplineFacebook: helplineFacebook,
        telecomHelplineNotice: helplineNotice
      }, { merge: true });

      setAppConfig((prev) => ({ 
        ...prev, 
        telecomServicesConfig: servicesConfig,
        telecomHelplinePhone: helplinePhone,
        telecomHelplineFacebook: helplineFacebook,
        telecomHelplineNotice: helplineNotice
      }));
      alert('সফলভাবে সার্ভিস লেবেল, আইকন ও হেল্পলাইন সেটিংস আপডেট করা হয়েছে! 🚀');
    } catch (err: any) {
      console.error(err);
      alert('সেটিংস সেভ করতে ব্যর্থ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMoneyExchangeConfig = async () => {
    setLoading(true);
    try {
      const configObj = {
        enabled: exchangeEnabled,
        noticeText: exchangeNotice,
        flatFee: Number(exchangeFlatFee) || 0,
        rates: exchangeRatesList
      };

      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, {
        moneyExchangeRatesConfig: configObj
      }, { merge: true });

      setAppConfig((prev) => ({ ...prev, moneyExchangeRatesConfig: configObj }));
      alert('সফলভাবে মানি এক্সচেঞ্জ কন্ট্রোল প্যানেল সেটিংস আপডেট করা হয়েছে! 🚀');
    } catch (err: any) {
      console.error(err);
      alert('সেটিংস সেভ করতে ব্যর্থ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to suggest or lookup cashback based on rules or default slabs
  const getSuggestedCashback = (amount: number, operator: string) => {
    // 1. Look up trigger rules
    const rules = appConfig?.rechargeCashbackRules || [];
    const matchedRule = rules.find(r => r.amount === amount);
    if (matchedRule) return matchedRule.cashback;

    // 2. Look up operator cashbacks
    const opCashbacks = cfgOperatorCashbacks[operator];
    if (opCashbacks) {
      if (amount === cfgSlab1Amt) return opCashbacks.slab1;
      if (amount === cfgSlab2Amt) return opCashbacks.slab2;
      if (amount === cfgSlab3Amt) return opCashbacks.slab3;
      if (amount === cfgSlab4Amt) return opCashbacks.slab4;
    }

    // 3. Look up default slabs
    if (appConfig?.telecomDefaultSlabs) {
      const matchedSlab = appConfig.telecomDefaultSlabs.find(s => s.amount === amount);
      if (matchedSlab) return matchedSlab.cashback;
    }

    return 0;
  };

  const activeUsers = propUsers || localUsers;
  const activeTransactions = (propTransactions && propTransactions.length > localTransactions.length) 
    ? propTransactions 
    : (localTransactions.length > 0 ? localTransactions : (propTransactions || []));

  // --- AUTOMATED TELECOM REPORT & ANALYTICS COMPUTATION ---
  const rawTelecomTransactions = activeTransactions.filter(t => 
    t.type === 'telecom_recharge' || 
    (t.type as string) === 'bill_pay' ||
    (t.description || '').includes('রিচার্জ') ||
    (t.description || '').includes('ড্রাইভ') ||
    (t.description || '').includes('অফার')
  );

  const resetTimeStr = customResetAt || appConfig?.telecomReportResetAt || (typeof window !== 'undefined' ? localStorage.getItem('telecom_report_reset_at') : '') || '';

  const telecomTransactions = rawTelecomTransactions.filter(t => {
    if (!t.createdAt) return false;
    const txTime = new Date(t.createdAt).getTime();

    if (reportFilterMode === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return txTime >= todayStart.getTime();
    }

    if (reportFilterMode === 'since_reset') {
      if (resetTimeStr) {
        const resetTime = new Date(resetTimeStr).getTime();
        if (!isNaN(resetTime) && resetTime > 0) {
          return txTime >= resetTime;
        }
      }
      // If no reset point set or in since_reset mode, exclude past sample transactions so report starts cleanly at 0
      return false;
    }

    return true;
  });

  const isDriveOffer = (t: Transaction) => {
    const desc = (t.description || '').toLowerCase();
    return desc.includes('প্যাক') || desc.includes('gb') || desc.includes('মিনিট') || desc.includes('অফার') || desc.includes('ড্রাইভ') || desc.includes('প্যাকেজ') || desc.includes('মেগাবাইট') || desc.includes('ইন্টারনেট') || desc.includes('mb') || desc.includes('min');
  };

  // 1. Flexiload / General Recharges
  const successFlexiList = telecomTransactions.filter(t => 
    (t.status === 'success' || t.status === 'approved') && 
    t.type === 'telecom_recharge' && 
    !isDriveOffer(t)
  );
  const successFlexiCount = successFlexiList.length;
  const successFlexiTotalAmount = successFlexiList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const rejectedFlexiList = telecomTransactions.filter(t => 
    (t.status === 'rejected' || t.status === 'cancelled' || t.status === 'failed') && 
    t.type === 'telecom_recharge' && 
    !isDriveOffer(t)
  );
  const rejectedFlexiCount = rejectedFlexiList.length;
  const rejectedFlexiTotalAmount = rejectedFlexiList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // 2. Drive Offers (MB / Minute / Pack)
  const successDriveList = telecomTransactions.filter(t => 
    (t.status === 'success' || t.status === 'approved') && 
    t.type === 'telecom_recharge' && 
    isDriveOffer(t)
  );
  const successDriveCount = successDriveList.length;
  const successDriveTotalAmount = successDriveList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const rejectedDriveList = telecomTransactions.filter(t => 
    (t.status === 'rejected' || t.status === 'cancelled' || t.status === 'failed') && 
    t.type === 'telecom_recharge' && 
    isDriveOffer(t)
  );
  const rejectedDriveCount = rejectedDriveList.length;
  const rejectedDriveTotalAmount = rejectedDriveList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // 3. Date-wise Sales Breakdown Map & List
  const salesByDateMap: Record<string, {
    dateStr: string;
    formattedDate: string;
    flexiCount: number;
    flexiAmount: number;
    driveCount: number;
    driveAmount: number;
    rejectedFlexiCount: number;
    rejectedFlexiAmount: number;
    rejectedDriveCount: number;
    rejectedDriveAmount: number;
    totalSalesAmount: number;
  }> = {};

  telecomTransactions.forEach(t => {
    if (!t.createdAt) return;
    const d = new Date(t.createdAt);
    if (isNaN(d.getTime())) return;
    
    const dateStr = d.toISOString().split('T')[0];
    const formattedDate = d.toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    if (!salesByDateMap[dateStr]) {
      salesByDateMap[dateStr] = {
        dateStr,
        formattedDate,
        flexiCount: 0,
        flexiAmount: 0,
        driveCount: 0,
        driveAmount: 0,
        rejectedFlexiCount: 0,
        rejectedFlexiAmount: 0,
        rejectedDriveCount: 0,
        rejectedDriveAmount: 0,
        totalSalesAmount: 0
      };
    }

    const isSucc = t.status === 'success' || t.status === 'approved';
    const isRej = t.status === 'rejected' || t.status === 'cancelled' || t.status === 'failed';
    const amt = Number(t.amount) || 0;
    const drive = isDriveOffer(t);

    if (isSucc) {
      if (drive) {
        salesByDateMap[dateStr].driveCount += 1;
        salesByDateMap[dateStr].driveAmount += amt;
      } else {
        salesByDateMap[dateStr].flexiCount += 1;
        salesByDateMap[dateStr].flexiAmount += amt;
      }
      salesByDateMap[dateStr].totalSalesAmount += amt;
    } else if (isRej) {
      if (drive) {
        salesByDateMap[dateStr].rejectedDriveCount += 1;
        salesByDateMap[dateStr].rejectedDriveAmount += amt;
      } else {
        salesByDateMap[dateStr].rejectedFlexiCount += 1;
        salesByDateMap[dateStr].rejectedFlexiAmount += amt;
      }
    }
  });

  const salesByDateList = Object.values(salesByDateMap).sort((a, b) => b.dateStr.localeCompare(a.dateStr));

  // Filter pending recharges, add money, and bill pays
  const allTelecomPending = activeTransactions.filter(t => 
    t.status === 'pending' && (
      t.type === 'telecom_recharge' || 
      t.type === 'bill_pay' as any || 
      (t.type === 'deposit' && ((t.description || '').includes('টেলিকম') || (t.typeLabel || '').includes('টেলিকম')))
    )
  );

  const pendingFlexiRequests = allTelecomPending.filter(t => 
    t.type === 'telecom_recharge' && (!t.description || (!t.description.toLowerCase().includes('প্যাক') && !t.description.toLowerCase().includes('gb') && !t.description.toLowerCase().includes('মিনিট') && !t.description.toLowerCase().includes('অফার') && !t.description.toLowerCase().includes('ড্রাইভ')))
  );

  const pendingDriveRequests = allTelecomPending.filter(t => 
    t.type === 'telecom_recharge' && t.description && (t.description.toLowerCase().includes('প্যাক') || t.description.toLowerCase().includes('gb') || t.description.toLowerCase().includes('মিনিট') || t.description.toLowerCase().includes('অফার') || t.description.toLowerCase().includes('ড্রাইভ'))
  );

  const pendingAddMoneyRequests = allTelecomPending.filter(t => 
    t.type === 'deposit' || (t.typeLabel || '').includes('টেলিকম') || (t.description || '').includes('টেলিকম')
  );

  const pendingBillRequests = allTelecomPending.filter(t => (t.type as string) === 'bill_pay' || t.type === 'utility');

  const pendingRequests = 
    pendingSubTab === 'flexiload' ? pendingFlexiRequests :
    pendingSubTab === 'drive' ? pendingDriveRequests :
    pendingSubTab === 'add_money' ? pendingAddMoneyRequests :
    pendingSubTab === 'bill' ? pendingBillRequests :
    allTelecomPending;

  // Filter historical telecom logs
  const telecomLogs = activeTransactions.filter(t => 
    (t.type === 'telecom_recharge' || t.type === 'bill_pay' as any) &&
    (filterTxStatus === 'all' ? true : t.status === filterTxStatus) &&
    (filterTxOperator === 'all' ? true : (t.description || '').toLowerCase().includes(filterTxOperator.toLowerCase()) || (t.paymentMethod || '').toLowerCase().includes(filterTxOperator.toLowerCase())) &&
    (searchTxQuery.trim() === '' ? true : 
      (t.userName || '').toLowerCase().includes(searchTxQuery.toLowerCase()) ||
      (t.memberId || '').toLowerCase().includes(searchTxQuery.toLowerCase()) ||
      (t.id || '').toLowerCase().includes(searchTxQuery.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchTxQuery.toLowerCase())
    )
  );

  // Filter users based on search member query
  const filteredUsers = activeUsers.filter(u => 
    (u.name || '').toLowerCase().includes(searchMemberQuery.toLowerCase()) || 
    (u.phone || '').includes(searchMemberQuery) || 
    (u.memberId || '').toLowerCase().includes(searchMemberQuery.toLowerCase())
  );

  // Stats for the header boxes
  const totalOffersCount = offers.length;
  const activeRulesCount = appConfig?.rechargeCashbackRules?.length || 0;
  const pendingRequestsCount = pendingRequests.length;
  const totalNoticesCount = localNotices.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-left pb-16 font-sans">
      
      {/* Dynamic Breadcrumbs & Section Title */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-850">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold font-sans mb-1.5">
            <span className="hover:text-white cursor-pointer transition" onClick={onClose}>অ্যাডমিন ড্যাশবোর্ড</span>
            <span>/</span>
            <span className="text-amber-400">টেলিকম ও রিচার্জ সার্ভিস</span>
            {activeSection && (
              <>
                <span>/</span>
                <span className="text-white capitalize">
                  {activeSection === 'pending' ? 'পেন্ডিং রিকোয়েস্ট' : 
                   activeSection === 'offers' ? 'সচল অফার ও প্যাকেজ' : 
                   activeSection === 'slabs' ? 'ডিফল্ট রিচার্জ স্ল্যাব' : 
                   activeSection === 'operators' ? 'অপারেটর ক্যাশব্যাক' : 
                   activeSection === 'cashback_rules' ? 'ক্যাশব্যাক অফার রুলস' : 
                   activeSection === 'adjust_balance' ? 'মেম্বার ব্যালেন্স সমন্বয়' : 
                   activeSection === 'notices' ? 'টেলিকম নোটিশ বোর্ড' : 
                   'লেনদেন ইতিহাস'}
                </span>
              </>
            )}
          </div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400 fill-amber-400 animate-pulse shrink-0" />
            টেলিকম ও ইউটিলিটি বিল অ্যাডমিন প্যানেল
          </h2>
          <p className="text-xs text-slate-350 mt-1 font-medium">
            মোবাইল ফ্লেক্সিলোড, ইন্টারনেট ডিল, ক্যাশব্যাক সেটিংস এবং ট্রানজেকশন অনুমোদন করার রিয়েল-টাইম কন্ট্রোল প্যানেল।
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button 
            type="button"
            onClick={fetchData}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl transition flex items-center gap-2 text-xs font-bold border border-slate-750 active:scale-95 cursor-pointer"
            title="ডাটা রিফ্রেশ"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            রিফ্রেশ
          </button>
          {activeSection ? (
            <button 
              type="button"
              onClick={() => setActiveSection(null)}
              className="p-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl transition flex items-center gap-2 text-xs font-black shadow-md active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              ফিরে যান (ড্যাশবোর্ড)
            </button>
          ) : (
            <button 
              type="button"
              onClick={onClose}
              className="p-3 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-2xl transition flex items-center gap-2 text-xs font-bold border border-slate-800 active:scale-95 cursor-pointer"
            >
              প্যানেল বন্ধ করুন
            </button>
          )}
        </div>
      </div>

      {/* Main Dashboard (8 Boxes Layout - Highly Interactive Grid) */}
      {!activeSection ? (
        <div className="space-y-6">
          
          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border border-indigo-100/60 p-4 rounded-3xl text-left shadow-2xs">
              <span className="text-[10px] text-indigo-500 font-extrabold tracking-wider uppercase font-mono block">পেন্ডিং রিচার্জ রিকোয়েস্ট</span>
              <span className="text-2xl font-black text-indigo-950 block mt-1 font-sans">
                {pendingRequestsCount} <span className="text-xs text-indigo-600 font-bold font-sans">টি বাকি</span>
              </span>
            </div>
            <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 border border-emerald-100/60 p-4 rounded-3xl text-left shadow-2xs">
              <span className="text-[10px] text-emerald-500 font-extrabold tracking-wider uppercase font-mono block">সচল ইন্টারনেট ও মিনিট অফার</span>
              <span className="text-2xl font-black text-emerald-950 block mt-1 font-sans">
                {totalOffersCount} <span className="text-xs text-emerald-600 font-bold font-sans">টি লাইভ</span>
              </span>
            </div>
            <div className="bg-gradient-to-br from-purple-50/70 to-fuchsia-50/50 border border-purple-100/60 p-4 rounded-3xl text-left shadow-2xs">
              <span className="text-[10px] text-purple-500 font-extrabold tracking-wider uppercase font-mono block">সক্রিয় ক্যাশব্যাক অফার রুলস</span>
              <span className="text-2xl font-black text-purple-950 block mt-1 font-sans">
                {activeRulesCount} <span className="text-xs text-purple-600 font-bold font-sans">টি সচল</span>
              </span>
            </div>
            <div className="bg-gradient-to-br from-amber-50/70 to-yellow-50/50 border border-amber-100/60 p-4 rounded-3xl text-left shadow-2xs">
              <span className="text-[10px] text-amber-500 font-extrabold tracking-wider uppercase font-mono block">টেলিকম সচল নোটিশ সংখ্যা</span>
              <span className="text-2xl font-black text-amber-950 block mt-1 font-sans">
                {totalNoticesCount} <span className="text-xs text-amber-600 font-bold font-sans">টি বোর্ড</span>
              </span>
            </div>
          </div>

          {/* Core 5 Master Control Modules */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider font-sans">টেলিকম এডমিন কন্ট্রোল প্যানেল (৫টি সেকশন)</h3>
              <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                সুসংগঠিত ও দ্রুত এক্সেস
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              
              {/* Box 1: Pending Requests & Approvals */}
              <button
                onClick={() => setActiveSection('pending')}
                className="group relative bg-white hover:bg-indigo-50/40 border-2 border-slate-200/90 hover:border-indigo-500 rounded-2xl p-3.5 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[140px] w-full"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                    <Clock className="w-5 h-5" />
                  </div>
                  {pendingRequestsCount > 0 ? (
                    <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full animate-pulse flex items-center gap-1 shrink-0">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                      </span>
                      {pendingRequestsCount}টি বাকি
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200/60 shrink-0">
                      সব শেষ
                    </span>
                  )}
                </div>
                <div className="mt-2.5 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 leading-tight tracking-tight">
                    ১. পেন্ডিং রিকোয়েস্ট
                  </h4>
                  <p className="text-[10.5px] text-slate-500 mt-1 font-medium line-clamp-1">
                    ফ্লেক্সিলোড ও প্যাক অনুমোদন
                  </p>
                </div>
                <div className="text-[10px] text-indigo-600 font-extrabold mt-2 flex items-center gap-0.5 group-hover:translate-x-1 transition shrink-0">
                  পেন্ডিং তালিকা দেখুন ➜
                </div>
              </button>

              {/* Box 2: Offers & Packages */}
              <button
                onClick={() => setActiveSection('offers')}
                className="group relative bg-white hover:bg-emerald-50/40 border-2 border-slate-200/90 hover:border-emerald-500 rounded-2xl p-3.5 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[140px] w-full"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold rounded-full border border-emerald-200/60 shrink-0">
                    {totalOffersCount}টি লাইভ
                  </span>
                </div>
                <div className="mt-2.5 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 leading-tight tracking-tight">
                    ২. অফার ও ড্রাইভ প্যাক
                  </h4>
                  <p className="text-[10.5px] text-slate-500 mt-1 font-medium line-clamp-1">
                    ইন্টারনেট, মিনিট ও বান্ডেল প্যাক
                  </p>
                </div>
                <div className="text-[10px] text-emerald-600 font-extrabold mt-2 flex items-center gap-0.5 group-hover:translate-x-1 transition shrink-0">
                  অফার ম্যানেজমেন্ট ➜
                </div>
              </button>

              {/* Box 3: Master Commission & Cashback Settings */}
              <button
                onClick={() => setActiveSection('rates')}
                className="group relative bg-white hover:bg-violet-50/40 border-2 border-slate-200/90 hover:border-violet-500 rounded-2xl p-3.5 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[140px] w-full"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                    <Gift className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-[10px] font-extrabold rounded-full border border-violet-200/60 shrink-0">
                    কমিশন ও বোনাস
                  </span>
                </div>
                <div className="mt-2.5 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 leading-tight tracking-tight">
                    ৩. কমিশন ও ক্যাশব্যাক
                  </h4>
                  <p className="text-[10.5px] text-slate-500 mt-1 font-medium line-clamp-1">
                    ডিফল্ট রেট %, স্ল্যাব ও ক্যাশব্যাক
                  </p>
                </div>
                <div className="text-[10px] text-violet-600 font-extrabold mt-2 flex items-center gap-0.5 group-hover:translate-x-1 transition shrink-0">
                  কমিশন সেটআপ ➜
                </div>
              </button>

              {/* Box 4: Notices, Banners & Scrolling Ticker */}
              <button
                onClick={() => setActiveSection('notices')}
                className="group relative bg-white hover:bg-amber-50/40 border-2 border-slate-200/90 hover:border-amber-500 rounded-2xl p-3.5 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[140px] w-full"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-extrabold rounded-full border border-amber-200/60 shrink-0">
                    নোটিশ ও ব্যানার
                  </span>
                </div>
                <div className="mt-2.5 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 leading-tight tracking-tight">
                    ৪. নোটিশ, ব্যানার ও স্লাইডার
                  </h4>
                  <p className="text-[10.5px] text-slate-500 mt-1 font-medium line-clamp-1">
                    স্ক্রলিং ঘোষণা ও প্রোমো ব্যানার
                  </p>
                </div>
                <div className="text-[10px] text-amber-600 font-extrabold mt-2 flex items-center gap-0.5 group-hover:translate-x-1 transition shrink-0">
                  পাবলিশার বোর্ড ➜
                </div>
              </button>

              {/* Box 5: Transactions History & Member Wallet Adjust */}
              <button
                onClick={() => setActiveSection('history')}
                className="group relative bg-white hover:bg-blue-50/40 border-2 border-slate-200/90 hover:border-blue-500 rounded-2xl p-3.5 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[140px] w-full"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-extrabold rounded-full border border-blue-200/60 shrink-0">
                    খতিয়ান ও ফান্ড
                  </span>
                </div>
                <div className="mt-2.5 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 leading-tight tracking-tight">
                    ৫. ইতিহাস ও ব্যালেন্স সমন্বয়
                  </h4>
                  <p className="text-[10.5px] text-slate-500 mt-1 font-medium line-clamp-1">
                    ট্রানজেকশন লগস ও ব্যালেন্স এডিটর
                  </p>
                </div>
                <div className="text-[10px] text-blue-600 font-extrabold mt-2 flex items-center gap-0.5 group-hover:translate-x-1 transition shrink-0">
                  হিসাব ও সমন্বয় ➜
                </div>
              </button>

            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-3xl p-1 md:p-2 border border-slate-200/60 shadow-sm">
          
          {/* Sub-navigation bar if inside related master sections */}
          {(['rates', 'slabs', 'cashback_rules', 'operators'].includes(activeSection || '')) && (
            <div className="bg-violet-900/90 text-white p-2.5 rounded-2xl mb-4 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-black text-amber-300 shrink-0 px-2">কমিশন ও ক্যাশব্যাকঃ</span>
              <button
                onClick={() => setActiveSection('rates')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeSection === 'rates' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'bg-violet-800/80 hover:bg-violet-700 text-violet-100'}`}
              >
                📊 ডিফল্ট কমিশন (%)
              </button>
              <button
                onClick={() => setActiveSection('slabs')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeSection === 'slabs' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'bg-violet-800/80 hover:bg-violet-700 text-violet-100'}`}
              >
                🏷️ কুইক রিচার্জ স্ল্যাব
              </button>
              <button
                onClick={() => setActiveSection('cashback_rules')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeSection === 'cashback_rules' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'bg-violet-800/80 hover:bg-violet-700 text-violet-100'}`}
              >
                🎁 ক্যাশব্যাক অফার রুলস
              </button>
              <button
                onClick={() => setActiveSection('operators')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeSection === 'operators' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'bg-violet-800/80 hover:bg-violet-700 text-violet-100'}`}
              >
                📶 অপারেটর ক্যাশব্যাক
              </button>
            </div>
          )}

          {(['notices', 'ticker', 'banners'].includes(activeSection || '')) && (
            <div className="bg-amber-900/90 text-white p-2.5 rounded-2xl mb-4 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-black text-amber-300 shrink-0 px-2">নোটিশ ও প্রমোশনঃ</span>
              <button
                onClick={() => setActiveSection('notices')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeSection === 'notices' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'bg-amber-800/80 hover:bg-amber-700 text-amber-100'}`}
              >
                📢 লাইভ নোটিশ বোর্ড
              </button>
              <button
                onClick={() => setActiveSection('ticker')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeSection === 'ticker' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'bg-amber-800/80 hover:bg-amber-700 text-amber-100'}`}
              >
                📣 স্ক্রলিং এনাউন্সমেন্ট
              </button>
              <button
                onClick={() => setActiveSection('banners')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeSection === 'banners' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'bg-amber-800/80 hover:bg-amber-700 text-amber-100'}`}
              >
                🖼️ প্রমোশন ব্যানার স্লাইডার
              </button>
            </div>
          )}

          {(['history', 'adjust_balance'].includes(activeSection || '')) && (
            <div className="bg-slate-900 text-white p-2.5 rounded-2xl mb-4 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-black text-amber-300 shrink-0 px-2">খতিয়ান ও ব্যালেন্সঃ</span>
              <button
                onClick={() => setActiveSection('history')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeSection === 'history' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
              >
                📜 লেনদেনের ইতিহাস ও লগস
              </button>
              <button
                onClick={() => setActiveSection('adjust_balance')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeSection === 'adjust_balance' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
              >
                💸 মেম্বার ওয়ালেট এড/মাইনাস
              </button>
            </div>
          )}
          
          {/* Back Navigation Header */}
          <div className="bg-white rounded-2xl p-4.5 mb-6 shadow-2xs border border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveSection(null)}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-black active:scale-95 cursor-pointer"
                title="ড্যাশবোর্ডে ফিরে যান"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-base font-black text-indigo-950">
                  {activeSection === 'pending' && '📋 পেন্ডিং রিচার্জ ও বিল রিকোয়েস্ট অনুমোদন'}
                  {activeSection === 'offers' && '📱 সচল ব্রডব্যান্ড ও মোবাইল রিচার্জ অফারস'}
                  {activeSection === 'slabs' && '📊 ৪টি কাস্টম রিচার্জ স্ল্যাব সেটিংস'}
                  {activeSection === 'operators' && '📶 অপারেটর ভিত্তিক ক্যাশব্যাক পার্সেন্টেজ'}
                  {activeSection === 'cashback_rules' && '🎁 মোবাইল রিচার্জ ভিত্তিক অতিরিক্ত ক্যাশব্যাক অফার'}
                  {activeSection === 'adjust_balance' && '💸 মেম্বার ওয়ালেট সমন্বয় ও বোনাস যোগ'}
                  {activeSection === 'notices' && '📢 টেলিকম স্ক্রিন লাইভ নোটিশ বোর্ড'}
                  {activeSection === 'history' && '📜 টেলিকম লেনদেনের বিস্তারিত ইতিহাস ও লগস'}
                  {activeSection === 'banners' && '🖼️ টেলিকম ব্যানার স্লাইডার কনফিগারেশন'}
                  {activeSection === 'ticker' && '📣 স্ক্রলিং ঘোষণা ও রানিং নোটিশ এডিটর'}
                  {activeSection === 'categories' && '⚙️ নেটওয়ার্ক অপারেটর ক্যাটাগরি ম্যানেজার'}
                  {activeSection === 'rates' && '💹 রিচার্জ কমিশন ও ডিফল্ট রেট পার্সেন্টেজ'}
                  {activeSection === 'services' && '🎨 টেলিকম ৮টি সার্ভিস বাটন টাইটেল, আইকন ও লোগো ম্যানেজার'}
                  {activeSection === 'money_exchange_admin' && '💸 মানি এক্সচেঞ্জ কারেন্সি রেট ও সম্পূর্ণ কন্ট্রোল প্যানেল'}
                </h3>
                <p className="text-[11px] text-slate-550 mt-0.5 font-medium leading-relaxed">
                  {activeSection === 'pending' && 'গ্রাহকদের ফ্লেক্সিলোড ও ইউটিলিটি বিল পেমেন্ট রিকোয়েস্ট চেক ও দ্রুত একশনে অনুমোদন করুন।'}
                  {activeSection === 'offers' && 'নতুন ইন্টারনেট ও কল প্যাক আপলোড বা পূর্বে আপলোডকৃত যেকোনো প্যাক ডিলিট করতে পারেন।'}
                  {activeSection === 'slabs' && 'মেম্বারদের মোবাইল রিচার্জ স্ক্রিনে প্রদর্শিত ৪টি কাস্টম স্ল্যাব বাটন ও স্ল্যাব ক্যাশব্যাক কনফিগ করুন।'}
                  {activeSection === 'operators' && 'জিপি, রবি, এয়ারটেল, বাংলালিংক, টেলিটক ও স্কিটো এর ক্যাশব্যাক আলাদাভাবে এডিট করুন।'}
                  {activeSection === 'cashback_rules' && 'নির্দিষ্ট টাকার রিচার্জে মেম্বাররা কত টাকা কমিশন ক্যাশব্যাক পাবেন তা এখান থেকে সেট করুন।'}
                  {activeSection === 'adjust_balance' && 'সদস্যের মেইন ব্যালেন্স বা টেলিকম ব্যালেন্স সরাসরি চার্জ কর্তন বা ক্যাশব্যাক বোনাস প্রদান।'}
                  {activeSection === 'notices' && 'টেলিকম অফার স্ক্রিনের উপরের সতর্কবার্তা পোস্ট করুন।'}
                  {activeSection === 'history' && 'সফল, পেন্ডিং বা রিজেক্ট হওয়া সকল টেলিকম ট্রানজেকশন ফিল্টার বা সার্চ করতে পারেন।'}
                  {activeSection === 'banners' && 'ইউজারদের টেলিকম ড্যাশবোর্ডের উপরে প্রদর্শিত প্রমোশনাল ব্যানার বা স্লাইড সমূহ পরিচালনা করুন।'}
                  {activeSection === 'ticker' && 'টেলিকম স্ক্রিনে রানিং স্ক্রলিং লাল/সবুজ সতর্কবার্তা এবং এনাউন্সমেন্ট টেক্সট এডিট করুন।'}
                  {activeSection === 'categories' && 'ইউজার রিচার্জ পেজে প্রদর্শিত সিম নেটওয়ার্ক অপারেটর ক্যাটাগরি বাটন সমূহ সংযোজন ও বিয়োজন।'}
                  {activeSection === 'rates' && 'মোবাইল রিচার্জ, আলাপ VoIP এবং ব্রিলিয়ান্ট রিচার্জের জন্য ডিফল্ট লাভ কমিশন হার (%) সেট করুন।'}
                  {activeSection === 'services' && 'মোবাইল রিচার্জ, আলাপ, ব্রিলিয়ান্ট, মানি এক্সচেঞ্জ ও কুইক অ্যাকশন বাটনগুলোর টাইটেল ও আইকন পরিবর্তন করুন।'}
                  {activeSection === 'money_exchange_admin' && 'মালয়েশিয়া, সৌদি আরব, ইউএই, কাতার, কুয়েত, ওমান, ইউএসডি সহ বিভিন্ন দেশের কারেন্সি রেট ও বোনাস এডিট করুন।'}
                </p>
              </div>
            </div>
            
            {/* Action Indicators */}
            <div className="flex gap-2 font-mono text-[10px]">
              <span className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 font-extrabold rounded-lg uppercase tracking-wide">
                Section ID: {activeSection}
              </span>
            </div>
          </div>

          {/* Render Active Section Content */}
          <div className="p-2 md:p-4 bg-white rounded-2xl border border-slate-100 min-h-[300px]">
            
            {/* SECTION 1: PENDING REQUESTS APPROVAL */}
            {activeSection === 'pending' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-slate-100 gap-2">
                  <div>
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide">পেন্ডিং আবেদন তালিকা ({pendingRequests.length} টি)</h4>
                    <p className="text-[10px] text-slate-400">টেলিকমের বিভিন্ন ক্যাটাগরির পেন্ডিং আবেদন আলাদাভাবে পরিচালনা করুন</p>
                  </div>
                  <span className="text-[10px] bg-amber-50 text-amber-700 font-black px-2.5 py-1 rounded-md shrink-0">আপগ্রেডঃ রিয়েল-টাইম সিঙ্ক</span>
                </div>

                {/* Sub-tab selection bar for Telecom Pending (Moved ABOVE the report box) */}
                <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setPendingSubTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      pendingSubTab === 'all'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>📂 সকল পেন্ডিং</span>
                    <span className={`px-1.5 py-0.5 text-[9px] rounded-md font-mono ${
                      pendingSubTab === 'all' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {allTelecomPending.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingSubTab('flexiload')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      pendingSubTab === 'flexiload'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>📱 ফ্লেক্সিলোড / রিচার্জ</span>
                    <span className={`px-1.5 py-0.5 text-[9px] rounded-md font-mono ${
                      pendingSubTab === 'flexiload' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {pendingFlexiRequests.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingSubTab('drive')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      pendingSubTab === 'drive'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>🎁 এমবি ও মিনিট ড্রাইভ অফার</span>
                    <span className={`px-1.5 py-0.5 text-[9px] rounded-md font-mono ${
                      pendingSubTab === 'drive' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {pendingDriveRequests.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingSubTab('add_money')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      pendingSubTab === 'add_money'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>💰 টেলিকম ব্যালেন্স ক্যাশ ইন</span>
                    <span className={`px-1.5 py-0.5 text-[9px] rounded-md font-mono ${
                      pendingSubTab === 'add_money' ? 'bg-sky-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {pendingAddMoneyRequests.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingSubTab('bill')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      pendingSubTab === 'bill'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>⚡ ইউটিলিটি বিল</span>
                    <span className={`px-1.5 py-0.5 text-[9px] rounded-md font-mono ${
                      pendingSubTab === 'bill' ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {pendingBillRequests.length}
                    </span>
                  </button>
                </div>

                {/* 📊 TELECOM LIVE SALES & STATS AUTOMATED REPORT */}
                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 md:p-5 shadow-lg border border-indigo-900/50 space-y-4">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-indigo-800/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-amber-400">
                        <BarChart3 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                          📊 টেলিকম অটোমেটেড সেলস ও রিপোর্ট সামারি
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                            লাইভ অটো-সিঙ্ক
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-300 font-medium">
                          সফল ও বাতিল রিচার্জ, ড্রাইভ অফার সেলস এবং তারিখভিত্তিক বিক্রির সয়ংক্রিয় হিসাব
                        </p>
                      </div>
                    </div>

                    {/* Reset & Filter Action Controls */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                      <button
                        type="button"
                        onClick={handleResetReportToZero}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs rounded-xl shadow-md border border-rose-400/40 active:scale-95 transition-all shrink-0 cursor-pointer"
                        title="বর্তমান সব সেলস রিপোর্ট জিরো (০) করুন"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        🧹 জিরো ব্যালেন্স (০) করুন
                      </button>

                      <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-indigo-800/60 text-[10px] shrink-0">
                        <button
                          type="button"
                          onClick={() => setReportFilterMode('since_reset')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                            reportFilterMode === 'since_reset' 
                              ? 'bg-indigo-600 text-white shadow' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          ⚡ রিসেট পয়েন্ট
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportFilterMode('today')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                            reportFilterMode === 'today' 
                              ? 'bg-indigo-600 text-white shadow' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          📅 আজকের হিসাব
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportFilterMode('all')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                            reportFilterMode === 'all' 
                              ? 'bg-indigo-600 text-white shadow' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🌐 সব সময়
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reset Timestamp status bar if active */}
                  {resetTimeStr && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-indigo-950/80 border border-indigo-700/50 rounded-xl text-[11px] text-indigo-200 font-medium shadow-inner">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                        ⚡ হিসাব রিসেট পয়েন্ট: <span className="font-bold text-amber-300 font-mono">{new Date(resetTimeStr).toLocaleString('bn-BD')}</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleRestoreFullReport}
                        className="text-amber-400 hover:text-amber-300 hover:underline font-black flex items-center gap-1 text-[10.5px] cursor-pointer"
                      >
                        ↺ রিসেট তুলে দিয়ে সব সময় (All) এর ইতিহাস দেখুন
                      </button>
                    </div>
                  )}

                  {/* 4 Core Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Card 1: Successful Recharges */}
                    <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex flex-col justify-between space-y-1.5 shadow-inner">
                      <div className="flex items-center justify-between text-emerald-400">
                        <span className="text-[10px] font-black uppercase tracking-wider">📱 সফল রিচার্জ</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-lg md:text-xl font-black text-emerald-300 font-mono">
                          ৳{successFlexiTotalAmount.toLocaleString('bn-BD')}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-200/80 mt-0.5">
                          মোট সফল: <span className="text-white font-extrabold">{successFlexiCount} টি</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Cancelled Recharges */}
                    <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 flex flex-col justify-between space-y-1.5 shadow-inner">
                      <div className="flex items-center justify-between text-rose-400">
                        <span className="text-[10px] font-black uppercase tracking-wider">🚫 ক্যানসেল রিচার্জ</span>
                        <XCircle className="w-4 h-4 text-rose-400" />
                      </div>
                      <div>
                        <div className="text-lg md:text-xl font-black text-rose-300 font-mono">
                          ৳{rejectedFlexiTotalAmount.toLocaleString('bn-BD')}
                        </div>
                        <div className="text-[10px] font-bold text-rose-200/80 mt-0.5">
                          মোট বাতিল: <span className="text-white font-extrabold">{rejectedFlexiCount} টি</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Successful Drive Offers */}
                    <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-3 flex flex-col justify-between space-y-1.5 shadow-inner">
                      <div className="flex items-center justify-between text-sky-400">
                        <span className="text-[10px] font-black uppercase tracking-wider">🎁 সফল ড্রাইভ অফার</span>
                        <Smartphone className="w-4 h-4 text-sky-400" />
                      </div>
                      <div>
                        <div className="text-lg md:text-xl font-black text-sky-300 font-mono">
                          ৳{successDriveTotalAmount.toLocaleString('bn-BD')}
                        </div>
                        <div className="text-[10px] font-bold text-sky-200/80 mt-0.5">
                          মোট সফল: <span className="text-white font-extrabold">{successDriveCount} টি</span> (এমবি/মিনিট)
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Cancelled Drive Offers */}
                    <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 flex flex-col justify-between space-y-1.5 shadow-inner">
                      <div className="flex items-center justify-between text-amber-400">
                        <span className="text-[10px] font-black uppercase tracking-wider">❌ বাতিল ড্রাইভ অফার</span>
                        <XCircle className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <div className="text-lg md:text-xl font-black text-amber-300 font-mono">
                          ৳{rejectedDriveTotalAmount.toLocaleString('bn-BD')}
                        </div>
                        <div className="text-[10px] font-bold text-amber-200/80 mt-0.5">
                          মোট বাতিল: <span className="text-white font-extrabold">{rejectedDriveCount} টি</span> (এমবি/মিনিট)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 📅 Date-wise Sales Breakdown (তারিখ অনুযায়ী অফার বিক্রির হিসাব) */}
                  <div className="bg-slate-950/80 border border-indigo-900/60 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-indigo-900/40 pb-2">
                      <h4 className="text-xs font-black text-indigo-200 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        তারিখ ভিত্তিক অফার ও রিচার্জ বিক্রির হিসাব ({salesByDateList.length} দিন)
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">অটোমেটেড হিসাব</span>
                    </div>

                    {salesByDateList.length === 0 ? (
                      <p className="text-center py-4 text-xs text-slate-400 font-bold">এখনো কোনো বিক্রির রেখা তৈরি হয়নি!</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] font-sans">
                          <thead>
                            <tr className="border-b border-indigo-900/50 text-indigo-300 font-bold uppercase text-[9.5px]">
                              <th className="py-2 px-2">📅 তারিখ</th>
                              <th className="py-2 px-2 text-center">📱 সফল রিচার্জ</th>
                              <th className="py-2 px-2 text-center">🎁 সফল ড্রাইভ অফার</th>
                              <th className="py-2 px-2 text-center">🚫 বাতিল রিচার্জ/অফার</th>
                              <th className="py-2 px-2 text-right">💰 মোট বিক্রি</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-indigo-900/30 text-slate-200">
                            {salesByDateList.map((row, idx) => (
                              <tr key={row.dateStr} className="hover:bg-indigo-900/20 transition-colors">
                                <td className="py-2.5 px-2 font-bold text-indigo-200">
                                  {row.formattedDate}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <span className="font-extrabold text-emerald-400">{row.flexiCount} টি</span>
                                  <span className="text-[9.5px] text-slate-400 block font-mono">৳{row.flexiAmount.toLocaleString('bn-BD')}</span>
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <span className="font-extrabold text-sky-400">{row.driveCount} টি</span>
                                  <span className="text-[9.5px] text-slate-400 block font-mono">৳{row.driveAmount.toLocaleString('bn-BD')}</span>
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <span className="font-extrabold text-rose-400">{row.rejectedFlexiCount + row.rejectedDriveCount} টি</span>
                                  <span className="text-[9.5px] text-slate-400 block font-mono">৳{(row.rejectedFlexiAmount + row.rejectedDriveAmount).toLocaleString('bn-BD')}</span>
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  <span className="text-xs font-black text-amber-300 font-mono">
                                    ৳{row.totalSalesAmount.toLocaleString('bn-BD')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {pendingRequests.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 font-bold space-y-2">
                    <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto" />
                    <p className="text-sm text-slate-500 font-extrabold">কোনো পেন্ডিং রিচার্জ বা বিল পেমেন্ট আবেদন নেই!</p>
                    <p className="text-xs text-slate-400 font-medium">সব আবেদন সফলভাবে প্রসেস করা হয়েছে।</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map((tx, idx) => {
                      const initialSuggestedCb = getSuggestedCashback(tx.amount, tx.paymentMethod || '');
                      const extraComm = txCommissionMap[tx.id] ?? 0;
                      const appCb = txCashbackMap[tx.id] ?? initialSuggestedCb;

                      const targetPhone = extractTargetPhone(tx);
                      const fullPostText = getFormattedFullPostText(tx, targetPhone);
                      const phoneCopyKey = `phone_${tx.id}`;
                      const postCopyKey = `post_${tx.id}`;
                      const isPhoneCopied = copiedStateKey === phoneCopyKey;
                      const isPostCopied = copiedStateKey === postCopyKey;

                      return (
                        <div key={`${tx.id}-${idx}`} className="bg-white hover:bg-slate-50/80 border border-slate-200 rounded-2xl p-4 transition-all flex flex-col lg:flex-row justify-between items-stretch gap-4 relative shadow-2xs">
                          
                          {/* Info & Copy Panel */}
                          <div className="space-y-3 text-left flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-md uppercase tracking-wider">
                                {tx.type === 'telecom_recharge' ? '📶 মোবাইল রিচার্জ / ড্রাইভ' : '⚡ ইউটিলিটি বিল'}
                              </span>
                              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md uppercase tracking-wider">
                                {tx.paymentMethod || tx.operator || 'অপারেটর'}
                              </span>
                              <span className="text-[11px] text-slate-500 font-bold font-sans">
                                🕒 {tx.createdAt ? new Date(tx.createdAt).toLocaleString('bn-BD') : 'N/A'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-400 font-medium block text-[10.5px]">আবেদনকারী গ্রাহকঃ</span>
                                <span className="font-extrabold text-slate-800">{tx.userName}</span>{' '}
                                <span className="text-[10px] text-slate-500 font-mono font-semibold">(আইডি: {tx.memberId || 'N/A'})</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-medium block text-[10.5px]">টাকার পরিমাণ / রিচার্জঃ</span>
                                <span className="text-base font-black text-indigo-700 font-mono">৳{tx.amount} BDT</span>
                              </div>
                            </div>

                            {/* 📱 Phone Number & Copy Control Box */}
                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide block">
                                    🎯 টার্গেট ফোন নম্বর (ম্যানুয়াল রিচার্জের জন্য):
                                  </span>
                                  <span className="text-base sm:text-lg font-mono font-black text-emerald-700 tracking-wider select-all block">
                                    {targetPhone || 'ফোন নম্বর পাওয়া যায়নি'}
                                  </span>
                                </div>

                                {/* Copy Action Buttons */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyToClipboard(targetPhone, phoneCopyKey)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border ${
                                      isPhoneCopied
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                        : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                                    }`}
                                    title="শুধুমাত্র ১১ ডিজিটের ফোন নম্বর কপি করুন"
                                  >
                                    <span>{isPhoneCopied ? '✅ নম্বর কপি হয়েছে!' : '📋 শুধু নম্বর কপি'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCopyToClipboard(fullPostText, postCopyKey)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border ${
                                      isPostCopied
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                        : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
                                    }`}
                                    title="নাম্বার সহ সম্পূর্ণ অফার ও পোস্ট বিবরণ কপি করুন"
                                  >
                                    <span>{isPostCopied ? '✅ ফুল পোস্ট কপি হয়েছে!' : '📄 ফুল পোস্ট কপি'}</span>
                                  </button>
                                </div>
                              </div>

                              {/* Full Post Preview Box */}
                              <div className="bg-white border border-slate-200/80 rounded-lg p-2 text-[11px] font-mono text-slate-700 font-semibold leading-relaxed flex items-center justify-between gap-2">
                                <div className="truncate">
                                  <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wider font-sans">কপিকৃত পোস্ট প্রিভিউঃ</span>
                                  <span className="text-slate-800 font-extrabold select-all">{fullPostText}</span>
                                </div>
                              </div>
                            </div>

                            {tx.description && (
                              <p className="text-[11px] bg-slate-50/80 border border-slate-200/60 rounded-lg p-2 text-slate-600 font-medium leading-relaxed">
                                📦 প্যাক/অফার বিবরণঃ {tx.description}
                              </p>
                            )}
                          </div>

                          {/* Quick Admin action panel */}
                          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row lg:flex-col justify-center items-center gap-3 shrink-0 lg:w-[220px]">
                            <div className="grid grid-cols-2 gap-2 w-full text-[10px] font-bold text-left">
                              <div className="space-y-1">
                                <label className="text-slate-500 block">কমিশন (৳)</label>
                                <input 
                                  type="number"
                                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg p-1.5 text-xs font-black outline-none font-mono"
                                  value={extraComm}
                                  onChange={(e) => setTxCommissionMap({
                                    ...txCommissionMap,
                                    [tx.id]: Number(e.target.value) || 0
                                  })}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-slate-500 block">ক্যাশব্যাক (৳)</label>
                                <input 
                                  type="number"
                                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg p-1.5 text-xs font-black outline-none font-mono"
                                  value={appCb}
                                  onChange={(e) => setTxCashbackMap({
                                    ...txCashbackMap,
                                    [tx.id]: Number(e.target.value) || 0
                                  })}
                                />
                              </div>
                            </div>

                            <div className="flex gap-2 w-full shrink-0 font-sans">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (handleApproveTransaction) {
                                    const modifiedTx = {
                                      ...tx,
                                      receiptNo: tx.receiptNo || `REC-${Math.floor(100000 + Math.random() * 900000)}`
                                    };
                                    await handleApproveTransaction(modifiedTx);
                                    fetchData();
                                  } else {
                                    alert('অনুমোদন সিস্টেম সংযোগ ত্রুটি!');
                                  }
                                }}
                                className="flex-1 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 transition shadow-sm active:scale-95 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" /> অনুমোদন
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (handleRejectTransaction) {
                                    await handleRejectTransaction(tx.docId || tx.id);
                                    fetchData();
                                  } else {
                                    alert('বাতিলকরণ সিস্টেম সংযোগ ত্রুটি!');
                                  }
                                }}
                                className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" /> বাতিল
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 9: TELECOM BANNERS SLIDER */}
            {activeSection === 'banners' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                {/* Form to Add Banner */}
                <form onSubmit={handleAddBanner} className="lg:col-span-5 bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 text-xs">
                  <div className="border-b border-slate-200 pb-2 mb-2">
                    <h4 className="text-xs font-black text-slate-750 uppercase tracking-wider font-sans">নতুন ব্যানার স্লাইড এড করুন</h4>
                    <p className="text-[10px] text-slate-500 font-medium">ব্যবহারকারীদের টেলিকম স্ক্রিনের স্লাইডারে এটি প্রদর্শিত হবে।</p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্যানার ক্যাটাগরি / ট্যাগ</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      placeholder="যেমন: স্পেশাল অফার বা ধামাকা অফার"
                      value={newBannerTag}
                      onChange={(e) => setNewBannerTag(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্যানার টাইটেল (Title)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      placeholder="যেমন: বিএনবি টেলিকম ধামাকা অফার"
                      value={newBannerTitle}
                      onChange={(e) => setNewBannerTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্যানার বিবরণ (Description)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      placeholder="যেমন: আজীবন মেয়াদসহ সুপার ক্যাশব্যাক ফ্লেক্সিলোড ড্রাইভ!"
                      value={newBannerDesc}
                      onChange={(e) => setNewBannerDesc(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্যানার ব্যাকগ্রাউন্ড গ্রাডিয়েন্ট (Tailwind Classes)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                      placeholder="যেমন: from-slate-950 via-cyan-950 to-emerald-950"
                      value={newBannerGradient}
                      onChange={(e) => setNewBannerGradient(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্যানার ইমেজ লিংক (Image URL)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      placeholder="ইমেজ URL দিন"
                      value={newBannerImage}
                      onChange={(e) => setNewBannerImage(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    নতুন স্লাইড সংরক্ষণ করুন 🚀
                  </button>
                </form>

                {/* List of active banners */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black text-slate-750 uppercase tracking-wider font-sans">সচল টেলিকম স্লাইডার ব্যানার সমূহ ({bannersList.length})</h4>
                  </div>
                  
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {bannersList.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 text-xs font-bold bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        টেলিকম সেকশনে বর্তমানে কোনো সচল স্লাইডার ব্যানার নেই।
                      </div>
                    ) : (
                      bannersList.map((banner, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-left">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[8px] bg-slate-200 text-slate-700 font-black px-1.5 py-0.5 rounded uppercase">
                                {banner.tag}
                              </span>
                              <span className="text-[8px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]">
                                ID: {banner.id}
                              </span>
                            </div>
                            <h4 className="text-[11px] font-extrabold text-slate-800 mt-1">{banner.title}</h4>
                            <p className="text-[10px] text-slate-550 leading-relaxed line-clamp-1 mt-0.5">{banner.description}</p>
                            {banner.image && (
                              <img src={banner.image} alt="preview" className="h-10 w-24 object-cover rounded-md border border-slate-200 mt-1" referrerPolicy="no-referrer" />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteBanner(banner.id)}
                            className="text-rose-500 hover:text-rose-700 p-2 bg-white hover:bg-rose-50 border border-slate-150 rounded-lg transition shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 10: SCROLLING TICKER */}
            {activeSection === 'ticker' && (
              <div className="space-y-5 text-left max-w-xl mx-auto bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                <div className="border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider font-sans">রানিং এনাউন্সমেন্ট ও স্ক্রলিং টিক্কার টেক্সট</h4>
                  <p className="text-[10px] text-slate-550 font-semibold leading-relaxed mt-1">
                    টেলিকম স্ক্রিনের নোটিশ ঘোষণা (ticker) এডিট করতে পারেন যা লাইভ স্ক্রলিং টেক্সট হিসেবে অনবরত চলতে থাকে।
                  </p>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">স্ক্রলিং ঘোষণা টেক্সট</label>
                  <textarea
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition min-h-[110px] leading-relaxed"
                    placeholder="টেলিকম ফ্লেক্সিলোড ও সুপার ফাস্ট ড্রাইভ অফার গাইড..."
                    value={tickerText}
                    onChange={(e) => setTickerText(e.target.value)}
                    required
                  />
                </div>

                <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-3 flex items-start gap-2 text-emerald-800 text-[10px] font-bold">
                  <span>💡</span>
                  <p className="leading-normal">এটি সরাসরি সদস্যদের BNB টেলিকম স্ক্রিনের সবুজ রানিং নোটিশ স্ক্রলিং বারে রিয়েল-টাইমে আপডেট হবে।</p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveTicker}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
                >
                  ঘোষণা টেক্সট লাইভ আপডেট করুন 🚀
                </button>
              </div>
            )}

            {/* SECTION 11: OPERATORS & CATEGORIES MANAGER */}
            {activeSection === 'categories' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                {/* Add Category Form */}
                <form onSubmit={handleAddCategory} className="lg:col-span-5 bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 text-xs">
                  <div className="border-b border-slate-200 pb-2 mb-2">
                    <h4 className="text-xs font-black text-slate-750 uppercase tracking-wider font-sans">নতুন অপারেটর / ক্যাটাগরি যোগ করুন</h4>
                    <p className="text-[10px] text-slate-500 font-medium">টেলিকম স্ক্রিনের নেটওয়ার্ক অপারেটর ফিল্টার বাটন সমূহে এটি যুক্ত হবে।</p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">অপারেটর আইডি (Operator ID)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                      placeholder="যেমন: Grameenphone বা Robi বা Skitto"
                      value={newCategoryId}
                      onChange={(e) => setNewCategoryId(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">অপারেটর লেবেল / নাম (Label Name)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      placeholder="যেমন: GP বা Robi বা Skitto"
                      value={newCategoryLabel}
                      onChange={(e) => setNewCategoryLabel(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    অপারেটর ক্যাটাগরি সংরক্ষণ করুন 🚀
                  </button>
                </form>

                {/* List of active categories */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black text-slate-750 uppercase tracking-wider font-sans">সক্রিয় নেটওয়ার্ক অপারেটর তালিকা ({categoriesList.length})</h4>
                  </div>
                  
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {categoriesList.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 text-xs font-bold bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        টেলিকম সেকশনে বর্তমানে কোনো কাস্টম অপারেটর সেট করা নেই। (সিস্টেমের ডিফল্ট ৮টি অপারেটর সচল আছে)।
                      </div>
                    ) : (
                      categoriesList.map((cat, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-left">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800">{cat.label}</p>
                            <p className="text-[10px] text-slate-550 font-mono mt-0.5">ID Key: {cat.id}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-rose-500 hover:text-rose-700 p-1.5 bg-white hover:bg-rose-50 border border-slate-150 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 12: COMMISSION RATES & DEFAULT PERCENT */}
            {activeSection === 'rates' && (
              <div className="space-y-6 text-left max-w-xl mx-auto bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                <div className="border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider font-sans">রিচার্জ ও ডিক্লেয়ার্ড কমিশন লাভ পার্সেন্টেজ হার</h4>
                  <p className="text-[10px] text-slate-550 font-semibold leading-relaxed mt-1">
                    গ্রাহকদের রিচার্জ আবেদনের পর স্বয়ংক্রিয়ভাবে প্রদানকৃত লাভ কমিশন পার্সেন্টেজ হার (%) এখানে কনফিগার করুন।
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">মোবাইল রিচার্জ কমিশন (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none"
                      value={mobRechargePct}
                      onChange={(e) => setMobRechargePct(Number(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">আলাপ রিচার্জ কমিশন (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none"
                      value={alaapRechargePct}
                      onChange={(e) => setAlaapRechargePct(Number(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্রিলিয়ান্ট কমিশন (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none"
                      value={brilliantRechargePct}
                      onChange={(e) => setBrilliantRechargePct(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-150 rounded-xl p-3 flex items-start gap-2 text-amber-800 text-[10px] font-bold">
                  <span>⚠️</span>
                  <p className="leading-normal">
                    যদি কোনো ইউজারের প্রোফাইলে স্পেশাল কাস্টম পার্সেন্টেজ সেট করা থাকে (customTelecomPercent), তবে সিস্টেম সেই ইউজারের ক্ষেত্রে ডিফল্ট হারের পরিবর্তে কাস্টম হারটি অগ্রাধিকার দেবে।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveRates}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
                >
                  কমিশন রেট সংরক্ষণ করুন 🚀
                </button>
              </div>
            )}

            {/* SECTION 2: ACTIVE OFFERS & PRESETS */}
            {activeSection === 'offers' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                
                {/* Custom offer publisher form */}
                <div className="lg:col-span-5 bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xs">
                  <div className="border-b border-slate-200 pb-2 mb-2 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-sans">
                        {editingOfferId ? 'অফার প্যাকেজ এডিট করুন ✏️' : 'নতুন ইন্টারনেট/মিনিট প্যাক এড করুন'}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium">সদস্যরা এই নতুন প্যাকটি রিচার্জ করার সুযোগ পাবেন।</p>
                    </div>
                    {editingOfferId && (
                      <button
                        type="button"
                        onClick={handleCancelEditOffer}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                      >
                        বাতিল
                      </button>
                    )}
                  </div>

                  <form onSubmit={handlePostOffer} className="space-y-3.5 text-xs">
                    {offerSuccess && (
                      <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs p-2.5 rounded-xl font-bold">
                        সফল! অফারটি সফলভাবে সংরক্ষণ করা হয়েছে।
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-mono">
                        অফার প্যাকেজ নাম
                      </label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-bold"
                        placeholder="যেমন: জিপি ৫০ জিবি ইন্টারনেট স্পেশাল ডিল"
                        value={offerTitle}
                        onChange={(e) => setOfferTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-mono">
                          রেগুলার দাম REGULAR PRICE ৳
                        </label>
                        <input
                          type="number"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-black font-mono"
                          placeholder="যেমন: ৳৫১০"
                          value={offerCommission}
                          onChange={(e) => setOfferCommission(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-mono">
                          ক্যাটাগরি
                        </label>
                        <select
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-bold cursor-pointer"
                          value={offerCategory}
                          onChange={(e) => setOfferCategory(e.target.value as any)}
                        >
                          <option value="internet">ডাটা (Internet)</option>
                          <option value="minute">মিনিট (Minutes)</option>
                          <option value="bundle">বান্ডেল (Core Combo)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 font-sans">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-mono">
                          মেয়াদ (VALIDITY)
                        </label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-bold"
                          placeholder="যেমন: ৩০ দিন"
                          value={offerValidity}
                          onChange={(e) => setOfferValidity(e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-mono">
                          মূল্য (PRICE ৳)
                        </label>
                        <input
                          type="number"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-black font-mono"
                          placeholder="৳ BDT"
                          value={offerPrice}
                          onChange={(e) => setOfferPrice(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-mono">
                        অপারেটর
                      </label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-bold cursor-pointer"
                        value={offerOperator}
                        onChange={(e) => setOfferOperator(e.target.value)}
                      >
                        <option value="Grameenphone">Grameenphone</option>
                        <option value="Robi">Robi</option>
                        <option value="Airtel">Airtel</option>
                        <option value="Banglalink">Banglalink</option>
                        <option value="Teletalk">Teletalk</option>
                        <option value="Skitto">Skitto</option>
                        <option value="Alaap">Alaap (IPSP)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-1 font-sans">
                      <input
                        type="checkbox"
                        id="telecom-hot-offer"
                        className="rounded text-emerald-600 focus:ring-emerald-500 bg-white border-slate-200 cursor-pointer"
                        checked={offerIsHot}
                        onChange={(e) => setOfferIsHot(e.target.checked)}
                      />
                      <label htmlFor="telecom-hot-offer" className="text-[11px] text-slate-650 font-bold select-none cursor-pointer">
                        এই অফারটি হট ড্রাইভ হিসেবে হাইলাইট করুন
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition cursor-pointer font-sans shadow-xs"
                      >
                        {editingOfferId ? 'প্যাকেজ আপডেট করুন ✏️' : 'নতুন প্যাকেজ প্রকাশ করুন 🚀'}
                      </button>
                      {editingOfferId && (
                        <button
                          type="button"
                          onClick={handleCancelEditOffer}
                          className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                          বাতিল
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Offer list and filters */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-sans">
                      সচল ব্রডব্যান্ড ও টেলিকম অফার সমূহ ({filteredAdminOffers.length})
                    </h4>
                    {offers.length === 0 && (
                      <button
                        onClick={handleSeedDefaultOffers}
                        className="text-[10px] bg-emerald-950/90 hover:bg-emerald-900 text-emerald-400 font-extrabold px-3 py-1.5 rounded-lg border border-emerald-900/50 transition-all cursor-pointer"
                      >
                        ডিফল্ট ৩জি/৪জি প্যাক লোড দিন
                      </button>
                    )}
                  </div>

                  {/* Network Operator Category Tabs (নেটওয়ার্ক অপারেটর ক্যাটাগরি) */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">নেটওয়ার্ক অপারেটর ক্যাটাগরি</span>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      {[
                        { id: 'all', label: 'সব অপারেটর' },
                        { id: 'Grameenphone', label: 'GRAMEENPHONE' },
                        { id: 'Robi', label: 'ROBI' },
                        { id: 'Airtel', label: 'AIRTEL' },
                        { id: 'Banglalink', label: 'BANGLALINK' },
                        { id: 'Teletalk', label: 'TELETALK' },
                        { id: 'Skitto', label: 'SKITTO' },
                        { id: 'Alaap', label: 'ALAAP' }
                      ].map((opTab, idx) => (
                        <button
                          key={`${opTab.id}-${idx}`}
                          type="button"
                          onClick={() => setAdminOfferOperatorFilter(opTab.id)}
                          className={`px-3 py-1 text-[10.5px] font-black rounded-lg transition shrink-0 uppercase cursor-pointer ${
                            adminOfferOperatorFilter.toLowerCase() === opTab.id.toLowerCase()
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {opTab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Offer Sub-tabs & Search Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-7 flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                      {[
                        { id: 'all', label: 'সকল অফার' },
                        { id: 'internet', label: 'ডাটা প্যাক' },
                        { id: 'minute', label: 'মিনিট প্যাক' },
                        { id: 'bundle', label: 'বান্ডেল অফার' }
                      ].map((catTab, idx) => (
                        <button
                          key={`${catTab.id}-${idx}`}
                          type="button"
                          onClick={() => setAdminOfferCategoryFilter(catTab.id)}
                          className={`flex-1 py-1 text-[10px] font-black rounded-lg transition cursor-pointer ${
                            adminOfferCategoryFilter === catTab.id ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {catTab.label}
                        </button>
                      ))}
                    </div>
                    <div className="sm:col-span-5 relative">
                      <input
                        type="text"
                        placeholder="অপারেশন বা ধামাকা প্যাক খুঁজুন..."
                        value={adminOfferSearchQuery}
                        onChange={(e) => setAdminOfferSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  {/* Offers Cards Grid */}
                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {filteredAdminOffers.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs font-bold bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        কোনো অফার পাওয়া যায়নি।
                      </div>
                    ) : (
                      filteredAdminOffers.map((op, idx) => {
                        let brandColor = 'bg-blue-600 text-white';
                        if (op.operator.toLowerCase() === 'robi') brandColor = 'bg-red-600 text-white';
                        if (op.operator.toLowerCase() === 'airtel') brandColor = 'bg-rose-600 text-white';
                        if (op.operator.toLowerCase() === 'banglalink') brandColor = 'bg-orange-500 text-white';
                        if (op.operator.toLowerCase() === 'teletalk') brandColor = 'bg-emerald-600 text-white';
                        if (op.operator.toLowerCase() === 'skitto') brandColor = 'bg-yellow-400 text-slate-950';
                        if (op.operator.toLowerCase() === 'alaap') brandColor = 'bg-purple-600 text-white';

                        return (
                          <div key={`${op.id}-${idx}`} className="bg-white border border-slate-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-300 transition shadow-2xs">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide ${brandColor}`}>
                                  {op.operator}
                                </span>
                                {op.isHot && (
                                  <span className="text-[8.5px] bg-rose-50 text-rose-600 font-black px-1.5 py-0.5 rounded-md border border-rose-100 flex items-center gap-0.5">
                                    🔥 HOT
                                  </span>
                                )}
                                <span className="text-[8.5px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-md border border-slate-200">
                                  {op.validity}
                                </span>
                              </div>
                              <h4 className="text-[12px] font-black text-slate-800 line-clamp-1">{op.title}</h4>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {((op.commission !== undefined && Number(op.commission) > 0) || (op.regularPrice !== undefined && Number(op.regularPrice) > 0)) && (
                                <div className="text-right">
                                  <span className="text-[9.5px] text-slate-500 font-bold block">রেগুলার</span>
                                  <span className="text-xs font-black font-mono text-slate-800 line-through decoration-rose-500">৳{op.regularPrice || (Number(op.price) + Number(op.commission || 0))}</span>
                                </div>
                              )}
                              <div className="text-right">
                                <span className="text-[9.5px] text-slate-500 font-bold block">অফারে কিনুন</span>
                                <span className="text-xs font-black font-mono text-emerald-600">৳{op.price}</span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditOffer(op)}
                                  className="text-indigo-600 hover:text-indigo-800 p-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 transition cursor-pointer"
                                  title="এডিট করুন"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOffer(op.id, op.docId)}
                                  className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition cursor-pointer"
                                  title="ডিলিট করুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* SECTION 3: RECHARGE SLABS */}
            {activeSection === 'slabs' && (
              <div className="space-y-4 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Slab 1 */}
                  <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl space-y-3.5 text-xs">
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wide">স্ল্যাব ১ (বাটন)</span>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">রিচার্জের পরিমাণ (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                        value={cfgSlab1Amt}
                        onChange={(e) => setCfgSlab1Amt(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">বিশেষ ক্যাশব্যাক (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                        value={cfgSlab1Cb}
                        onChange={(e) => setCfgSlab1Cb(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Slab 2 */}
                  <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl space-y-3.5 text-xs">
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wide">স্ল্যাব ২ (বাটন)</span>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">রিচার্জের পরিমাণ (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                        value={cfgSlab2Amt}
                        onChange={(e) => setCfgSlab2Amt(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">বিশেষ ক্যাশব্যাক (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                        value={cfgSlab2Cb}
                        onChange={(e) => setCfgSlab2Cb(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Slab 3 */}
                  <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl space-y-3.5 text-xs">
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wide">স্ল্যাব ৩ (বাটন)</span>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">রিচার্জের পরিমাণ (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                        value={cfgSlab3Amt}
                        onChange={(e) => setCfgSlab3Amt(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">বিশেষ ক্যাশব্যাক (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                        value={cfgSlab3Cb}
                        onChange={(e) => setCfgSlab3Cb(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Slab 4 */}
                  <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl space-y-3.5 text-xs">
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wide">স্ল্যাব ৪ (বাটন)</span>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">রিচার্জের পরিমাণ (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                        value={cfgSlab4Amt}
                        onChange={(e) => setCfgSlab4Amt(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">বিশেষ ক্যাশব্যাক (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                        value={cfgSlab4Cb}
                        onChange={(e) => setCfgSlab4Cb(Number(e.target.value))}
                      />
                    </div>
                  </div>

                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const updatedSlabs = [
                          { amount: Number(cfgSlab1Amt) || 20, cashback: Number(cfgSlab1Cb) || 0 },
                          { amount: Number(cfgSlab2Amt) || 50, cashback: Number(cfgSlab2Cb) || 5 },
                          { amount: Number(cfgSlab3Amt) || 100, cashback: Number(cfgSlab3Cb) || 0 },
                          { amount: Number(cfgSlab4Amt) || 500, cashback: Number(cfgSlab4Cb) || 0 }
                        ];
                        
                        const configRef = doc(db, 'system_settings', 'app_config');
                        await setDoc(configRef, { telecomDefaultSlabs: updatedSlabs }, { merge: true });
                        alert("৪টি ডিফল্ট রিচার্জ স্ল্যাব ও ক্যাশব্যাক সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে!");
                      } catch (err: any) {
                        console.error("Error saving default slabs:", err);
                        alert("স্ল্যাব সেটিংস সেভ করতে সমস্যা হয়েছেঃ " + err.message);
                      }
                    }}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all hover:scale-101 active:scale-95 shadow-sm cursor-pointer flex items-center gap-1.5 font-sans"
                  >
                    <CheckCircle2 className="w-4 h-4" /> স্ল্যাব সেটিংস সংরক্ষণ করুন
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 4: OPERATOR CASHBACKS */}
            {activeSection === 'operators' && (
              <div className="space-y-4 text-left">
                
                {/* Editable Slab Amounts Customizer */}
                <div className="bg-indigo-50/80 border border-indigo-200/80 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5 font-sans">
                        <span>✏️</span> রিচার্জ স্ল্যাব টাকার পরিমাণ এডিটর (Custom Slab Amounts)
                      </h4>
                      <p className="text-[10.5px] text-indigo-700/80 font-medium mt-0.5">
                        নিচে স্ল্যাব ১, স্ল্যাব ২, স্ল্যাব ৩ ও স্ল্যাব ৪ এর রিচার্জ টাকার পরিমাণগুলো (যেমন: ২০, ৫০, ১০০, ২০০, ৫০০) নিজের ইচ্ছামতো টাইপ করে চেঞ্জ বা এডিট করতে পারেন।
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-150 shadow-2xs space-y-1">
                      <label className="block text-[10px] font-bold text-slate-600">স্ল্যাব ১ পরিমাণ (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-2.5 py-1.5 text-xs font-black font-mono text-indigo-900 outline-none"
                        value={cfgSlab1Amt}
                        onChange={(e) => setCfgSlab1Amt(Number(e.target.value) || 0)}
                        placeholder="20"
                      />
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-150 shadow-2xs space-y-1">
                      <label className="block text-[10px] font-bold text-slate-600">স্ল্যাব ২ পরিমাণ (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-2.5 py-1.5 text-xs font-black font-mono text-indigo-900 outline-none"
                        value={cfgSlab2Amt}
                        onChange={(e) => setCfgSlab2Amt(Number(e.target.value) || 0)}
                        placeholder="50"
                      />
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-150 shadow-2xs space-y-1">
                      <label className="block text-[10px] font-bold text-slate-600">স্ল্যাব ৩ পরিমাণ (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-2.5 py-1.5 text-xs font-black font-mono text-indigo-900 outline-none"
                        value={cfgSlab3Amt}
                        onChange={(e) => setCfgSlab3Amt(Number(e.target.value) || 0)}
                        placeholder="100"
                      />
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-150 shadow-2xs space-y-1">
                      <label className="block text-[10px] font-bold text-slate-600">স্ল্যাব ৪ পরিমাণ (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-2.5 py-1.5 text-xs font-black font-mono text-indigo-900 outline-none"
                        value={cfgSlab4Amt}
                        onChange={(e) => setCfgSlab4Amt(Number(e.target.value) || 0)}
                        placeholder="500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {['Grameenphone', 'Robi', 'Airtel', 'Banglalink', 'Teletalk', 'Skitto'].map((operator) => {
                    const cbData = cfgOperatorCashbacks[operator] || { slab1: 0, slab2: 0, slab3: 0, slab4: 0 };
                    return (
                      <div key={operator} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3 text-xs shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black ${
                              operator === 'Grameenphone' ? 'bg-blue-500 text-white' :
                              operator === 'Robi' ? 'bg-red-500 text-white' :
                              operator === 'Airtel' ? 'bg-rose-600 text-white' :
                              operator === 'Banglalink' ? 'bg-orange-500 text-white' :
                              operator === 'Teletalk' ? 'bg-emerald-600 text-white' :
                              'bg-yellow-450 text-slate-900'
                            }`}>
                              {operator === 'Grameenphone' ? 'GP' : operator === 'Banglalink' ? 'BL' : operator.substring(0, 4)}
                            </div>
                            <span className="text-xs font-black text-slate-800">{operator}</span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">ক্যাশব্যাক (৳)</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-[10px]">
                          <div>
                            <div className="flex items-center justify-between mb-1 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 font-extrabold text-[10px]">৳</span>
                                <input
                                  type="number"
                                  className="w-12 font-mono font-black text-[11px] text-indigo-900 bg-slate-50 border border-slate-200 rounded px-1 py-0.2 focus:bg-white focus:border-indigo-500 outline-none"
                                  value={cfgSlab1Amt}
                                  onChange={(e) => setCfgSlab1Amt(Number(e.target.value) || 0)}
                                  title="স্ল্যাব ১ টাকার পরিমাণ পরিবর্তন করুন"
                                />
                              </div>
                              <span className="text-[9px] text-slate-400 font-bold">(স্ল্যাব ১)</span>
                            </div>
                            <input
                              type="number"
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none font-mono"
                              value={cbData.slab1}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setCfgOperatorCashbacks({
                                  ...cfgOperatorCashbacks,
                                  [operator]: { ...cbData, slab1: val }
                                });
                              }}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 font-extrabold text-[10px]">৳</span>
                                <input
                                  type="number"
                                  className="w-12 font-mono font-black text-[11px] text-indigo-900 bg-slate-50 border border-slate-200 rounded px-1 py-0.2 focus:bg-white focus:border-indigo-500 outline-none"
                                  value={cfgSlab2Amt}
                                  onChange={(e) => setCfgSlab2Amt(Number(e.target.value) || 0)}
                                  title="স্ল্যাব ২ টাকার পরিমাণ পরিবর্তন করুন"
                                />
                              </div>
                              <span className="text-[9px] text-slate-400 font-bold">(স্ল্যাব ২)</span>
                            </div>
                            <input
                              type="number"
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none font-mono"
                              value={cbData.slab2}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setCfgOperatorCashbacks({
                                  ...cfgOperatorCashbacks,
                                  [operator]: { ...cbData, slab2: val }
                                });
                              }}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 font-extrabold text-[10px]">৳</span>
                                <input
                                  type="number"
                                  className="w-12 font-mono font-black text-[11px] text-indigo-900 bg-slate-50 border border-slate-200 rounded px-1 py-0.2 focus:bg-white focus:border-indigo-500 outline-none"
                                  value={cfgSlab3Amt}
                                  onChange={(e) => setCfgSlab3Amt(Number(e.target.value) || 0)}
                                  title="স্ল্যাব ৩ টাকার পরিমাণ পরিবর্তন করুন"
                                />
                              </div>
                              <span className="text-[9px] text-slate-400 font-bold">(স্ল্যাব ৩)</span>
                            </div>
                            <input
                              type="number"
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none font-mono"
                              value={cbData.slab3}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setCfgOperatorCashbacks({
                                  ...cfgOperatorCashbacks,
                                  [operator]: { ...cbData, slab3: val }
                                });
                              }}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 font-extrabold text-[10px]">৳</span>
                                <input
                                  type="number"
                                  className="w-12 font-mono font-black text-[11px] text-indigo-900 bg-slate-50 border border-slate-200 rounded px-1 py-0.2 focus:bg-white focus:border-indigo-500 outline-none"
                                  value={cfgSlab4Amt}
                                  onChange={(e) => setCfgSlab4Amt(Number(e.target.value) || 0)}
                                  title="স্ল্যাব ৪ টাকার পরিমাণ পরিবর্তন করুন"
                                />
                              </div>
                              <span className="text-[9px] text-slate-400 font-bold">(স্ল্যাব ৪)</span>
                            </div>
                            <input
                              type="number"
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none font-mono"
                              value={cbData.slab4}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setCfgOperatorCashbacks({
                                  ...cfgOperatorCashbacks,
                                  [operator]: { ...cbData, slab4: val }
                                });
                              }}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const updatedSlabs = [
                          { amount: Number(cfgSlab1Amt) || 20, cashback: Number(cfgSlab1Cb) || 0 },
                          { amount: Number(cfgSlab2Amt) || 50, cashback: Number(cfgSlab2Cb) || 0 },
                          { amount: Number(cfgSlab3Amt) || 100, cashback: Number(cfgSlab3Cb) || 0 },
                          { amount: Number(cfgSlab4Amt) || 500, cashback: Number(cfgSlab4Cb) || 0 }
                        ];
                        const configRef = doc(db, 'system_settings', 'app_config');
                        await setDoc(configRef, { 
                          telecomOperatorCashbacks: cfgOperatorCashbacks,
                          telecomDefaultSlabs: updatedSlabs
                        }, { merge: true });
                        alert("অপারেটর ক্যাশব্যাক ও স্ল্যাব পরিমাণ সফলভাবে সংরক্ষণ করা হয়েছে!");
                      } catch (err: any) {
                        console.error("Error saving operator cashbacks:", err);
                        alert("অপারেটর ক্যাশব্যাক সেভ করতে ত্রুটি ঘটেছে: " + err.message);
                      }
                    }}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> অপারেটর ক্যাশব্যাক ও স্ল্যাব সংরক্ষণ করুন
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 5: CASHBACK TRIGGER RULES */}
            {activeSection === 'cashback_rules' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                
                {/* Form to Add / Edit Rule */}
                <form onSubmit={handleAddCashbackRule} className="lg:col-span-5 bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                  <div className="border-b border-slate-200/60 pb-2 mb-2 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-sans flex items-center gap-1.5">
                        {editingCbRuleId ? (
                          <>
                            <span className="p-1 bg-amber-100 text-amber-800 rounded-md">✏️</span>
                            ক্যাশব্যাক রুল এডিট করুন
                          </>
                        ) : (
                          <>
                            <span className="p-1 bg-purple-100 text-purple-800 rounded-md">➕</span>
                            নতুন ক্যাশব্যাক রুল যোগ করুন
                          </>
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {editingCbRuleId ? 'বিদ্যমান ক্যাশব্যাক রুলের তথ্য পরিবর্তন করে সেভ করুন।' : 'গ্রাহকরা নির্দিষ্ট পরিমাণ রিচার্জে ও নির্দিষ্ট অপারেটরে কাস্টম বোনাস টাকা পাবেন।'}
                      </p>
                    </div>
                    {editingCbRuleId && (
                      <button
                        type="button"
                        onClick={handleCancelEditCashbackRule}
                        className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-black rounded-lg transition"
                      >
                        বাতিল ✕
                      </button>
                    )}
                  </div>
                  
                  {/* Operator Selection */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider font-sans">
                      প্রযোজ্য সিম অপারেটর (Target SIM Operator)
                    </label>
                    <select
                      className="w-full bg-white border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-800 outline-none font-sans cursor-pointer shadow-2xs"
                      value={cbOperatorRule}
                      onChange={(e) => setCbOperatorRule(e.target.value)}
                    >
                      <option value="all">🌐 সকল অপারেটর (All Operators)</option>
                      <option value="Grameenphone">💙 গ্রামীনফোন (Grameenphone)</option>
                      <option value="Robi">🔴 রবি (Robi)</option>
                      <option value="Airtel">🔴 এয়ারটেল (Airtel)</option>
                      <option value="Banglalink">🟠 বাংলালিংক (Banglalink)</option>
                      <option value="Teletalk">🟢 টেলিটক (Teletalk)</option>
                      <option value="Skitto">🟡 স্কিটো (Skitto)</option>
                      <option value="Alaap">🟣 আলাপ (Alaap)</option>
                      <option value="Brilliant">🔵 ব্রিলিয়ান্ট (Brilliant)</option>
                      <option value="custom">✍️ কাস্টম অপারেটর/নাম টাইপ করুন (Custom Operator)</option>
                    </select>

                    {/* Custom Operator Name Input */}
                    {cbOperatorRule === 'custom' && (
                      <div className="pt-2">
                        <label className="block text-[9.5px] font-bold text-purple-700 mb-1">
                          অপারেটর / অফারের নাম টাইপ করুন (যেমনঃ গ্রামীন ৫০ টাকা রিচার্জ)
                        </label>
                        <input
                          type="text"
                          className="w-full bg-white border border-purple-200 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                          placeholder="যেমনঃ গ্রামীনফোন ৫০ টাকা অফার"
                          value={cbCustomOperator}
                          onChange={(e) => setCbCustomOperator(e.target.value)}
                          required={cbOperatorRule === 'custom'}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">রিচার্জের পরিমাণ (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                        placeholder="যেমন: ৫০ বা ১০০"
                        value={cbAmountRule}
                        onChange={(e) => setCbAmountRule(e.target.value)}
                        required
                        min="1"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">ক্যাশব্যাক বোনাস (৳)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                        placeholder="যেমন: ৫"
                        value={cbCashbackRule}
                        onChange={(e) => setCbCashbackRule(e.target.value)}
                        required
                        min="0"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={cbSaving}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all hover:scale-101 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-98 disabled:opacity-50"
                  >
                    {cbSaving ? "সেভ হচ্ছে..." : editingCbRuleId ? "ক্যাশব্যাক রুল আপডেট করুন 🔄" : "ক্যাশব্যাক রুল সংরক্ষণ করুন 🚀"}
                  </button>
                </form>

                {/* List of Rules */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-sans">বিদ্যমান ক্যাশব্যাক রুলস সমূহের তালিকা</h4>
                    <span className="text-[10px] font-extrabold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                      মোট: {appConfig?.rechargeCashbackRules?.length || 0}টি
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {(!appConfig?.rechargeCashbackRules || appConfig.rechargeCashbackRules.length === 0) ? (
                      <div className="col-span-2 text-center py-16 text-slate-400 text-xs font-bold bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        কোনো সচল ক্যাশব্যাক রুল সেট করা নেই। গ্রাহকরা শুধু সাধারণ রিচার্জ কমিশন পাবেন।
                      </div>
                    ) : (
                      appConfig?.rechargeCashbackRules?.map((rule, idx) => {
                        const ruleOp = rule.operator || 'all';
                        const opLabel = ruleOp === 'Grameenphone' ? 'GRAMEENPHONE' :
                                        ruleOp === 'Robi' ? 'ROBI' :
                                        ruleOp === 'Airtel' ? 'AIRTEL' :
                                        ruleOp === 'Banglalink' ? 'BANGLALINK' :
                                        ruleOp === 'Teletalk' ? 'TELETALK' :
                                        ruleOp === 'Skitto' ? 'SKITTO' :
                                        ruleOp === 'Alaap' ? 'ALAAP' :
                                        ruleOp === 'Brilliant' ? 'BRILLIANT' :
                                        ruleOp === 'all' ? 'সকল অপারেটর' : ruleOp;

                        const opBadgeStyle = ruleOp === 'Grameenphone' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                             ruleOp === 'Robi' ? 'bg-red-100 text-red-800 border-red-200' :
                                             ruleOp === 'Airtel' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                             ruleOp === 'Banglalink' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                             ruleOp === 'Teletalk' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                             ruleOp === 'Skitto' ? 'bg-yellow-100 text-yellow-900 border-yellow-200' :
                                             ruleOp === 'Alaap' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                             ruleOp === 'Brilliant' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                                             'bg-purple-100 text-purple-900 border-purple-200';

                        const isBeingEdited = editingCbRuleId && (rule.id === editingCbRuleId || `cb_${rule.amount}_${rule.operator || 'all'}` === editingCbRuleId);

                        return (
                          <div key={rule.id || idx} className={`p-3 rounded-xl flex items-center justify-between gap-3 text-xs transition ${isBeingEdited ? 'bg-amber-50 border-2 border-amber-400 shadow-md ring-2 ring-amber-200' : 'bg-purple-50/50 border border-purple-100 shadow-2xs hover:bg-purple-50'}`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`p-2 rounded-xl shrink-0 ${isBeingEdited ? 'bg-amber-200 text-amber-900' : 'bg-purple-100 text-purple-700'}`}>
                                <Gift className="w-4 h-4" />
                              </span>
                              <div className="text-left space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded border font-mono ${opBadgeStyle}`}>
                                    {opLabel}
                                  </span>
                                  <p className="text-[11px] font-black text-slate-800">৳{rule.amount} রিচার্জে</p>
                                </div>
                                <p className="text-[10.5px] text-purple-700 font-extrabold font-sans">৳{rule.cashback} ইনস্ট্যান্ট ক্যাশব্যাক</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditCashbackRule(rule)}
                                className="text-purple-600 hover:text-purple-800 p-1.5 bg-white hover:bg-purple-100 border border-purple-200 rounded-xl transition cursor-pointer shadow-2xs active:scale-95"
                                title="এই ক্যাশব্যাক অফারটি এডিট করুন"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCashbackRule(rule)}
                                className="text-rose-500 hover:text-rose-700 p-1.5 bg-white hover:bg-rose-50 border border-slate-200 rounded-xl transition cursor-pointer shadow-2xs active:scale-95"
                                title="এই ক্যাশব্যাক অফারটি মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* SECTION 6: MEMBER BALANCE ADJUSTMENTS */}
            {activeSection === 'adjust_balance' && (
              <div className="space-y-4 text-left">
                <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Search and select member */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3.5">
                      <h4 className="text-[10px] uppercase font-black text-indigo-950 font-mono tracking-wider border-b border-slate-200/60 pb-1.5">১. মেম্বার নির্বাচন করুন</h4>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">মেম্বার খুঁজুন (নাম বা ফোন বা আইডি)</label>
                        <input 
                          type="text" 
                          placeholder="মেম্বার ডাটা সার্চ..."
                          className="w-full bg-white border border-slate-200 text-xs p-2.5 rounded-xl outline-none font-bold placeholder-slate-400 focus:border-indigo-500"
                          value={searchMemberQuery}
                          onChange={(e) => setSearchMemberQuery(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">মেম্বার সিলেক্ট করুন</label>
                        <select 
                          required 
                          className="w-full bg-white border border-slate-200 text-xs p-2.5 rounded-xl outline-none font-bold cursor-pointer focus:border-indigo-500"
                          value={adjustTargetUid}
                          onChange={(e) => setAdjustTargetUid(e.target.value)}
                        >
                          <option value="">-- মেম্বার সিলেক্ট করুন ({filteredUsers.length} জন) --</option>
                          {filteredUsers.map((u, idx) => (
                            <option key={`${u.uid}-${idx}`} value={u.uid}>
                              {u.name || 'N/A'} - {u.phone || 'N/A'} [৳{(u.telecomBalance || 0).toLocaleString()}] ({u.memberId || 'N/A'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Action types and Wallets */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-4">
                      <h4 className="text-[10px] uppercase font-black text-indigo-950 font-mono tracking-wider border-b border-slate-200/60 pb-1.5">২. সমন্বয় কনফিগারেশন</h4>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">ওয়ালেট নির্বাচন</label>
                        <select 
                          required 
                          className="w-full bg-white border border-slate-200 text-xs p-2.5 rounded-xl outline-none font-bold cursor-pointer focus:border-indigo-500" 
                          value={adjustWalletType}
                          onChange={(e) => setAdjustWalletType(e.target.value)}
                        >
                          <option value="telecomBalance">📶 টেলিকম ব্যালেন্স (Telecom Balance)</option>
                          <option value="balance">💰 মেইন ড্যাশবোর্ড ব্যালেন্স (Main Balance)</option>
                          <option value="superShopBalance">🛒 সুপার শপ ব্যালেন্স (Super Shop Balance)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">অ্যাকশন টাইপ</label>
                        <div className="grid grid-cols-2 gap-2 font-sans">
                          <button
                            type="button"
                            onClick={() => setAdjustActionType('bonus')}
                            className={`py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                              adjustActionType === 'bonus' 
                                ? 'bg-emerald-600 text-white border border-emerald-500' 
                                : 'bg-white text-slate-500 border border-slate-250 hover:bg-slate-100'
                            }`}
                          >
                            🎉 বোনাস জমা দিন
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjustActionType('deduct')}
                            className={`py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                              adjustActionType === 'deduct' 
                                ? 'bg-rose-600 text-white border border-rose-500' 
                                : 'bg-white text-slate-500 border border-slate-250 hover:bg-slate-100'
                            }`}
                          >
                            ⚠️ ব্যালেন্স কর্তন করুন
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Amount & Description */}
                    <div className="md:col-span-2 bg-slate-50 border border-slate-200 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase font-mono">টাকার পরিমাণ (৳ Amount)</label>
                        <input 
                          type="number" 
                          placeholder="যেমন: ৫০০" 
                          required 
                          className="w-full bg-white border border-slate-200 text-xs p-2.5 rounded-xl outline-none font-mono font-black text-slate-800" 
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase font-mono">পরিবর্তনের কারণ বা নোট</label>
                        <input 
                          type="text" 
                          placeholder="যেমন: ভুল রিচার্জ রিফান্ড বা অফার বোনাস" 
                          required 
                          className="w-full bg-white border border-slate-200 text-xs p-2.5 rounded-xl outline-none font-bold text-slate-800" 
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                        />
                      </div>
                    </div>

                  </div>

                  <button
                    type="submit"
                    disabled={isAdjusting}
                    className={`w-full py-3 text-xs font-black rounded-xl transition cursor-pointer shadow-md ${
                      adjustActionType === 'deduct' 
                        ? 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800' 
                        : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800'
                    } text-white disabled:opacity-50 font-sans`}
                  >
                    {isAdjusting ? "প্রসেস হচ্ছে..." : "ওয়ালেট লেজার আপডেট করুন ও মেম্বারকে নোটিফাই করুন 🚀"}
                  </button>
                </form>
              </div>
            )}

            {/* SECTION 7: TELECOM NOTICES */}
            {activeSection === 'notices' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                {/* New Notice Form */}
                <form onSubmit={handleSendNotice} className="lg:col-span-5 bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 text-xs">
                  <div className="border-b border-slate-200 pb-2 mb-2">
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider font-sans">নতুন টেলিকম নোটিশ বোর্ড লিখুন</h4>
                    <p className="text-[10px] text-slate-500 font-medium">গ্রাহকরা তাদের টেলিকম অফার স্ক্রিনে এই নোটিশটি রিয়েল টাইমে দেখতে পাবেন।</p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">নোটিশের টাইটেল</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition"
                      placeholder="যেমন: আজ রাত ১০টায় সার্ভার রক্ষণাবেক্ষণ"
                      value={newNoticeTitle}
                      onChange={(e) => setNewNoticeTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">বিস্তারিত নোটিশ মেসেজ</label>
                    <textarea
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition min-h-[100px]"
                      placeholder="প্রিয় গ্রাহক, বিশেষ আপগ্রেডের জন্য আজ রাত ১০টা থেকে টেলিকম সাময়িকভাবে বন্ধ থাকবে..."
                      value={newNoticeBody}
                      onChange={(e) => setNewNoticeBody(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingNotice}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black transition shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isSendingNotice ? "পাঠানো হচ্ছে..." : "টেলিকম নোটিশ প্রকাশ করুন 🚀"}
                  </button>
                </form>

                {/* List of active telecom notices */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-sans">বিদ্যমান টেলিকম নোটিশ তালিকা ({localNotices.length})</h4>
                  </div>
                  
                  <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                    {localNotices.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 text-xs font-bold bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        টেলিকম সেকশনে বর্তমানে কোনো সচল নোটিশ নেই।
                      </div>
                    ) : (
                      localNotices.map((n, idx) => (
                        <div key={idx} className="bg-indigo-50/40 border border-indigo-100 p-3.5 rounded-xl flex items-start justify-between gap-3 text-xs">
                          <div className="flex items-start gap-2.5 text-left min-w-0 flex-1">
                            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl mt-0.5 shrink-0">
                              <Bell className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-black text-slate-850 leading-tight truncate">{n.title}</p>
                              <p className="text-[10.5px] text-slate-550 leading-relaxed mt-1.5 whitespace-pre-wrap">{n.body}</p>
                              <p className="text-[9px] text-slate-400 font-bold tracking-tight font-sans mt-2">
                                {n.createdAt ? new Date(n.createdAt).toLocaleString('bn-BD') : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteNotice(n.id, n.id)}
                            className="text-rose-500 hover:text-rose-700 p-2 bg-white hover:bg-rose-50 border border-slate-150 rounded-xl transition shrink-0 cursor-pointer animate-pulse"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 8: TRANSACTION LOGS / HISTORY */}
            {activeSection === 'history' && (
              <div className="space-y-4">
                
                {/* Search and Filters */}
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-3.5 text-xs text-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                    
                    {/* Query Input */}
                    <div className="md:col-span-5 relative">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">গ্রাহকের নাম, আইডি বা ফোন</label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-3.5 py-2 text-xs font-bold outline-none"
                          placeholder="মেম্বার আইডি বা ফোন লিখে সার্চ..."
                          value={searchTxQuery}
                          onChange={(e) => setSearchTxQuery(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Status Filter */}
                    <div className="md:col-span-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">অবস্থা (Status)</label>
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer focus:border-indigo-500 outline-none"
                        value={filterTxStatus}
                        onChange={(e) => setFilterTxStatus(e.target.value as any)}
                      >
                        <option value="all">সব লেনদেন (All)</option>
                        <option value="pending">পেন্ডিং আবেদন (Pending)</option>
                        <option value="success">সফল রিচার্জ (Success)</option>
                        <option value="failed">বাতিল আবেদন (Failed)</option>
                      </select>
                    </div>

                    {/* Operator Filter */}
                    <div className="md:col-span-4">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">অপারেটর (Operator)</label>
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer focus:border-indigo-500 outline-none"
                        value={filterTxOperator}
                        onChange={(e) => setFilterTxOperator(e.target.value)}
                      >
                        <option value="all">সব মোবাইল অপারেটর (All Operators)</option>
                        <option value="Grameenphone">Grameenphone (GP)</option>
                        <option value="Robi">Robi</option>
                        <option value="Airtel">Airtel</option>
                        <option value="Banglalink">Banglalink (BL)</option>
                        <option value="Teletalk">Teletalk</option>
                        <option value="Skitto">Skitto</option>
                        <option value="Alaap">Alaap (IPSP)</option>
                      </select>
                    </div>

                  </div>
                </div>

                {/* Table or logs list */}
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {telecomLogs.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 font-bold bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs">
                      সার্চ শর্ত অনুযায়ী কোনো রিচার্জ বা বিল লেনদেনের ইতিহাস খুঁজে পাওয়া যায়নি।
                    </div>
                  ) : (
                    telecomLogs.map((tx, idx) => {
                      const targetPhone = extractTargetPhone(tx);
                      const fullPostText = getFormattedFullPostText(tx, targetPhone);
                      const phoneCopyKey = `hist_phone_${tx.id}`;
                      const postCopyKey = `hist_post_${tx.id}`;
                      const isPhoneCopied = copiedStateKey === phoneCopyKey;
                      const isPostCopied = copiedStateKey === postCopyKey;

                      return (
                        <div key={`${tx.id}-${idx}`} className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs hover:bg-slate-50 transition">
                          <div className="text-left space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-800">{tx.userName || 'N/A'}</span>
                              <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.2 rounded font-sans">{tx.memberId || 'N/A'}</span>
                              <span className="text-[9px] font-bold text-slate-400 font-sans">{tx.createdAt ? new Date(tx.createdAt).toLocaleString('bn-BD') : 'N/A'}</span>
                            </div>
                            <p className="text-[10.5px] text-slate-600 leading-relaxed font-medium">
                              📱 {tx.description || `${tx.paymentMethod || 'রিচার্জ'} ৳${tx.amount}`}
                            </p>
                            {targetPhone && (
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  📞 {targetPhone}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyToClipboard(targetPhone, phoneCopyKey)}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                                    isPhoneCopied
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300'
                                  }`}
                                >
                                  {isPhoneCopied ? '✅ নম্বর কপিড' : '📋 নম্বর কপি'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyToClipboard(fullPostText, postCopyKey)}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                                    isPostCopied
                                      ? 'bg-indigo-600 text-white border-indigo-600'
                                      : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-300'
                                  }`}
                                >
                                  {isPostCopied ? '✅ পোস্ট কপিড' : '📄 ফুল পোস্ট কপি'}
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0 font-sans">
                            <p className="font-black text-indigo-950 text-sm">৳{tx.amount}</p>
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase mt-1 ${
                              tx.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              tx.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {tx.status === 'success' ? 'সফল' : tx.status === 'pending' ? 'পেন্ডিং' : 'বাতিল'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            )}

            {/* SECTION 9: TELECOM BANNERS SLIDER */}
            {activeSection === 'banners' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                {/* Form to Add Banner */}
                <form onSubmit={handleAddBanner} className="lg:col-span-5 bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 text-xs">
                  <div className="border-b border-slate-200 pb-2 mb-2">
                    <h4 className="text-xs font-black text-slate-750 uppercase tracking-wider font-sans">নতুন ব্যানার স্লাইড এড করুন</h4>
                    <p className="text-[10px] text-slate-550 font-medium">ব্যবহারকারীদের টেলিকম স্ক্রিনের স্লাইডারে এটি প্রদর্শিত হবে।</p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্যানার ক্যাটাগরি / ট্যাগ</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      placeholder="যেমন: স্পেশাল অফার বা ধামাকা অফার"
                      value={newBannerTag}
                      onChange={(e) => setNewBannerTag(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্যানার টাইটেল (Title)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      placeholder="যেমন: বিএনবি টেলিকম ধামাকা অফার"
                      value={newBannerTitle}
                      onChange={(e) => setNewBannerTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্যানার বিবরণ (Description)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      placeholder="যেমন: আজীবন মেয়াদসহ সুপার ক্যাশব্যাক ফ্লেক্সিলোড ড্রাইভ!"
                      value={newBannerDesc}
                      onChange={(e) => setNewBannerDesc(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্যানার ব্যাকগ্রাউন্ড গ্রাডিয়েন্ট (Tailwind Classes)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                      placeholder="যেমন: from-slate-950 via-cyan-950 to-emerald-950"
                      value={newBannerGradient}
                      onChange={(e) => setNewBannerGradient(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্যানার ইমেজ লিংক (Image URL)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      placeholder="ইমেজ URL দিন"
                      value={newBannerImage}
                      onChange={(e) => setNewBannerImage(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    নতুন স্লাইড সংরক্ষণ করুন 🚀
                  </button>
                </form>

                {/* List of active banners */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black text-slate-750 uppercase tracking-wider font-sans">সচল টেলিকম স্লাইডার ব্যানার সমূহ ({bannersList.length})</h4>
                  </div>
                  
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {bannersList.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 text-xs font-bold bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        টেলিকম সেকশনে বর্তমানে কোনো সচল স্লাইডার ব্যানার নেই।
                      </div>
                    ) : (
                      bannersList.map((banner, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-left">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[8px] bg-slate-200 text-slate-700 font-black px-1.5 py-0.5 rounded uppercase">
                                {banner.tag}
                              </span>
                              <span className="text-[8px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]">
                                ID: {banner.id}
                              </span>
                            </div>
                            <h4 className="text-[11px] font-extrabold text-slate-800 mt-1">{banner.title}</h4>
                            <p className="text-[10px] text-slate-550 leading-relaxed line-clamp-1 mt-0.5">{banner.description}</p>
                            {banner.image && (
                              <img src={banner.image} alt="preview" className="h-10 w-24 object-cover rounded-md border border-slate-200 mt-1" referrerPolicy="no-referrer" />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteBanner(banner.id)}
                            className="text-rose-500 hover:text-rose-700 p-2 bg-white hover:bg-rose-50 border border-slate-150 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 10: SCROLLING TICKER */}
            {activeSection === 'ticker' && (
              <div className="space-y-5 text-left max-w-xl mx-auto bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                <div className="border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider font-sans">রানিং এনাউন্সমেন্ট ও স্ক্রলিং টিক্কার টেক্সট</h4>
                  <p className="text-[10px] text-slate-550 font-semibold leading-relaxed mt-1">
                    টেলিকম স্ক্রিনের নোটিশ ঘোষণা (ticker) এডিট করতে পারেন যা লাইভ স্ক্রলিং টেক্সট হিসেবে অনবরত চলতে থাকে।
                  </p>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">স্ক্রলিং ঘোষণা টেক্সট</label>
                  <textarea
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition min-h-[110px] leading-relaxed"
                    placeholder="টেলিকম ফ্লেক্সিলোড ও সুপার ফাস্ট ড্রাইভ অফার গাইড..."
                    value={tickerText}
                    onChange={(e) => setTickerText(e.target.value)}
                    required
                  />
                </div>

                <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-3 flex items-start gap-2 text-emerald-800 text-[10px] font-bold">
                  <span>💡</span>
                  <p className="leading-normal">এটি সরাসরি সদস্যদের BNB টেলিকম স্ক্রিনের সবুজ রানিং নোটিশ স্ক্রলিং বারে রিয়েল-টাইমে আপডেট হবে।</p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveTicker}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
                >
                  ঘোষণা টেক্সট লাইভ আপডেট করুন 🚀
                </button>
              </div>
            )}

            {/* SECTION 11: OPERATORS & CATEGORIES MANAGER */}
            {activeSection === 'categories' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                {/* Add Category Form */}
                <form onSubmit={handleAddCategory} className="lg:col-span-5 bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 text-xs">
                  <div className="border-b border-slate-200 pb-2 mb-2">
                    <h4 className="text-xs font-black text-slate-750 uppercase tracking-wider font-sans">নতুন অপারেটর / ক্যাটাগরি যোগ করুন</h4>
                    <p className="text-[10px] text-slate-550 font-medium">টেলিকম স্ক্রিনের নেটওয়ার্ক অপারেটর ফিল্টার বাটন সমূহে এটি যুক্ত হবে।</p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">অপারেটর আইডি (Operator ID)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                      placeholder="যেমন: Grameenphone বা Robi বা Skitto"
                      value={newCategoryId}
                      onChange={(e) => setNewCategoryId(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">অপারেটর লেবেল / নাম (Label Name)</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      placeholder="যেমন: GP বা Robi বা Skitto"
                      value={newCategoryLabel}
                      onChange={(e) => setNewCategoryLabel(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    অপারেটর ক্যাটাগরি সংরক্ষণ করুন 🚀
                  </button>
                </form>

                {/* List of active categories */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black text-slate-750 uppercase tracking-wider font-sans">সক্রিয় নেটওয়ার্ক অপারেটর তালিকা ({categoriesList.length})</h4>
                  </div>
                  
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {categoriesList.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 text-xs font-bold bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        টেলিকম সেকশনে বর্তমানে কোনো কাস্টম অপারেটর সেট করা নেই। (সিস্টেমের ডিফল্ট ৮টি অপারেটর সচল আছে)।
                      </div>
                    ) : (
                      categoriesList.map((cat, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-left">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800">{cat.label}</p>
                            <p className="text-[10px] text-slate-550 font-mono mt-0.5">ID Key: {cat.id}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-rose-500 hover:text-rose-700 p-1.5 bg-white hover:bg-rose-50 border border-slate-150 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 12: COMMISSION RATES & DEFAULT PERCENT */}
            {activeSection === 'rates' && (
              <div className="space-y-6 text-left max-w-xl mx-auto bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                <div className="border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider font-sans">রিচার্জ ও ডিক্লেয়ার্ড কমিশন লাভ পার্সেন্টেজ হার</h4>
                  <p className="text-[10px] text-slate-550 font-semibold leading-relaxed mt-1">
                    গ্রাহকদের রিচার্জ আবেদনের পর স্বয়ংক্রিয়ভাবে প্রদানকৃত লাভ কমিশন পার্সেন্টেজ হার (%) এখানে কনফিগার করুন।
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">মোবাইল রিচার্জ কমিশন (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none"
                      value={mobRechargePct}
                      onChange={(e) => setMobRechargePct(Number(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">আলাপ রিচার্জ কমিশন (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none"
                      value={alaapRechargePct}
                      onChange={(e) => setAlaapRechargePct(Number(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase font-mono">ব্রিলিয়ান্ট কমিশন (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none"
                      value={brilliantRechargePct}
                      onChange={(e) => setBrilliantRechargePct(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-150 rounded-xl p-3 flex items-start gap-2 text-amber-800 text-[10px] font-bold">
                  <span>⚠️</span>
                  <p className="leading-normal">
                    যদি কোনো ইউজারের প্রোফাইলে স্পেশাল কাস্টম পার্সেন্টেজ সেট করা থাকে (customTelecomPercent), তবে সিস্টেম সেই ইউজারের ক্ষেত্রে ডিফল্ট হারের পরিবর্তে কাস্টম হারটি অগ্রাধিকার দেবে।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveRates}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
                >
                  কমিশন রেট সংরক্ষণ করুন 🚀
                </button>
              </div>
            )}

            {/* SECTION 13: TELECOM SERVICES & BUTTONS TITLES/LOGOS MANAGER */}
            {activeSection === 'services' && (
              <div className="space-y-6 text-left">
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider font-sans">টেলিকম ৮টি কাস্টম সার্ভিস বাটন কন্ট্রোল প্যানেল</h4>
                    <p className="text-[10px] text-slate-550 font-semibold leading-relaxed mt-1">
                      মোবাইল রিচার্জ, আলাপ, ব্রিলিয়ান্ট, মানি এক্সচেঞ্জ, ডাটা প্যাক, মিনিট প্যাক, প্যাক বিল্ডার ও ব্যালেন্স এড বাটনগুলোর নাম, আইকন/ইমেজ লোগো ও সচল অবস্থা পরিবর্তন করতে পারবেন।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveServicesConfig}
                    disabled={loading}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    সেটিংস সেভ করুন 🚀
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'mobile_recharge', defaultTitle: 'মোবাইল রিচার্জ', defaultIcon: '📱', label: '১. প্রথম হেডার বাটন (মোবাইল রিচার্জ)' },
                    { key: 'alaap_recharge', defaultTitle: 'আলাপ রিচার্জ', defaultIcon: '📞', label: '২. দ্বিতীয় হেডার বাটন (আলাপ রিচার্জ)' },
                    { key: 'brilliant_recharge', defaultTitle: 'ব্রিলিয়ান্ট রিচার্জ', defaultIcon: '🌐', label: '৩. তৃতীয় হেডার বাটন (ব্রিলিয়ান্ট রিচার্জ)' },
                    { key: 'money_exchange', defaultTitle: 'মানি এক্সচেঞ্জ', defaultIcon: '💸', label: '৪. চতুর্থ হেডার বাটন (মানি এক্সচেঞ্জ)' },
                    { key: 'data_pack', defaultTitle: 'ডাটা প্যাক', defaultIcon: '🌐', label: '৫. কুইক অ্যাকশন ১ (ডাটা প্যাক)' },
                    { key: 'minute_pack', defaultTitle: 'মিনিট প্যাক', defaultIcon: '📞', label: '৬. কুইক অ্যাকশন ২ (মিনিট প্যাক)' },
                    { key: 'pack_builder', defaultTitle: 'প্যাক বিল্ডার', defaultIcon: '🎁', label: '৭. কুইক অ্যাকশন ৩ (প্যাক বিল্ডার)' },
                    { key: 'balance_add', defaultTitle: 'হেল্পলাইন', defaultIcon: '🎧', label: '৮. কুইক অ্যাকশন ৪ (হেল্পলাইন বাটন)' }
                  ].map((item, idx) => {
                    const conf = servicesConfig[item.key] || { title: item.defaultTitle, icon: item.defaultIcon, isActive: true };
                    return (
                      <div key={item.key} className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-3 text-xs">
                        <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                          <span className="font-black text-slate-800 text-[11px]">{item.label}</span>
                          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-600">
                            <input
                              type="checkbox"
                              checked={conf.isActive !== false}
                              onChange={(e) => setServicesConfig({
                                ...servicesConfig,
                                [item.key]: { ...conf, isActive: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 accent-indigo-600 rounded"
                            />
                            <span>সচল রাখুন</span>
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9.5px] font-black text-slate-500 uppercase font-mono mb-1">বাটন টাইটেল</label>
                            <input
                              type="text"
                              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold outline-none text-xs"
                              value={conf.title || item.defaultTitle}
                              onChange={(e) => setServicesConfig({
                                ...servicesConfig,
                                [item.key]: { ...conf, title: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <label className="block text-[9.5px] font-black text-slate-500 uppercase font-mono mb-1">আইকন বা ইমেজ URL</label>
                            <input
                              type="text"
                              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold outline-none text-xs font-mono"
                              placeholder="📱 বা https://..."
                              value={conf.icon || item.defaultIcon}
                              onChange={(e) => setServicesConfig({
                                ...servicesConfig,
                                [item.key]: { ...conf, icon: e.target.value }
                              })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* HELPLINE DETAILED CONFIGURATION PANEL */}
                <div className="bg-emerald-50/60 border border-emerald-200/80 p-5 rounded-2xl space-y-4 text-xs">
                  <div className="border-b border-emerald-200/80 pb-2">
                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-2 font-sans">
                      🎧 হেল্পলাইন ওয়াটসঅ্যাপ, কল নম্বর ও ফেসবুক আইডি লিংক কনফিগারেশন
                    </h4>
                    <p className="text-[10.5px] text-emerald-800 font-bold mt-0.5">
                      এখান থেকে দেওয়া হেল্পলাইন ওয়াটসঅ্যাপ নম্বর ও ফেসবুক আইডি লিংকে ইউজাররা কুইক অ্যাকশন ৪ (হেল্পলাইন) বাটন চেপে সরাসরি যোগাযোগ ও মেসেজ করতে পারবে।
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-emerald-900 uppercase font-mono mb-1">
                        ১. হেল্পলাইন ওয়াটসঅ্যাপ / ফোন নম্বর
                      </label>
                      <input
                        type="text"
                        className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 font-mono font-bold text-xs text-slate-800 outline-none focus:border-emerald-600 shadow-2xs"
                        placeholder="01865911728"
                        value={helplinePhone}
                        onChange={(e) => setHelplinePhone(e.target.value)}
                      />
                      <span className="text-[9px] text-emerald-700 font-bold mt-1 block">ডিফল্ট: 01865911728 (WhatsApp এবং ডায়াল অপশন)</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-emerald-900 uppercase font-mono mb-1">
                        ২. ফেসবুক আইডি / পেজ লিংক
                      </label>
                      <input
                        type="text"
                        className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 font-mono font-bold text-xs text-slate-800 outline-none focus:border-emerald-600 shadow-2xs"
                        placeholder="https://facebook.com/..."
                        value={helplineFacebook}
                        onChange={(e) => setHelplineFacebook(e.target.value)}
                      />
                      <span className="text-[9px] text-emerald-700 font-bold mt-1 block">ইউজার পেজের বাটনে চাপ দিলে সরাসরি এই লিংক খুলবে।</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-emerald-900 uppercase font-mono mb-1">
                      ৩. হেল্পলাইন পপআপ নোটিশ বার্তা
                    </label>
                    <input
                      type="text"
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 font-bold text-xs text-slate-800 outline-none focus:border-emerald-600 shadow-2xs"
                      placeholder="যেকোনো বিষয় জানতে বা সমস্যার সমাধানের জন্য আমাদের হেল্পলাইন ওয়াটসঅ্যাপে মেসেজ অথবা সরাসরি কল করুন।"
                      value={helplineNotice}
                      onChange={(e) => setHelplineNotice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveServicesConfig}
                    disabled={loading}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-md active:scale-95 cursor-pointer"
                  >
                    সার্ভিস কনফিগারেশন সেভ করুন 🚀
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 14: MONEY EXCHANGE ADMIN CONTROL PANEL */}
            {activeSection === 'money_exchange_admin' && (
              <div className="space-y-6 text-left">
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider font-sans">মানি এক্সচেঞ্জ ও বৈশ্বিক কারেন্সি রেট কনফিগারেশন</h4>
                    <p className="text-[10px] text-slate-550 font-semibold leading-relaxed mt-1">
                      আন্তর্জাতিক রেমিট্যান্স ও মানি এক্সচেঞ্জের রেট (মালয়েশিয়া MYR, সৌদি SAR, ইউএই AED, কাতার, কুয়েত, ওমান, ইউএসডি সহ) এবং সার্ভিস চার্জ এখান থেকে সম্পূর্ণ নিয়ন্ত্রণ করুন।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveMoneyExchangeConfig}
                    disabled={loading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    মানি এক্সচেঞ্জ সেভ করুন 🚀
                  </button>
                </div>

                {/* Top General Settings */}
                <div className="bg-[#FFFFFF] border border-slate-200 p-4.5 rounded-2xl space-y-4 text-xs font-bold">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-xs font-black text-slate-800">মানি এক্সচেঞ্জ মডিউল স্ট্যাটাস</span>
                      <p className="text-[10px] text-slate-500 font-normal">ইউজার অ্যাপে মানি এক্সচেঞ্জ ফিচার চালু বা বন্ধ রাখার টগল</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        checked={exchangeEnabled}
                        onChange={(e) => setExchangeEnabled(e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span className={exchangeEnabled ? 'text-emerald-700 font-black' : 'text-slate-400'}>
                        {exchangeEnabled ? 'ফিচার সচল আছে' : 'ফিচার বন্ধ আছে'}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase font-mono mb-1">মানি এক্সচেঞ্জ ঘোষণা টিপস নোটিশ</label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:bg-white"
                        value={exchangeNotice}
                        onChange={(e) => setExchangeNotice(e.target.value)}
                        placeholder="নোটিশ টেক্সট লিখুন..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase font-mono mb-1">ফ্ল্যাট প্রসেসিং সার্ভিস চার্জ (৳ BDT)</label>
                      <input
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none focus:bg-white"
                        value={exchangeFlatFee}
                        onChange={(e) => setExchangeFlatFee(Number(e.target.value) || 0)}
                        placeholder="0 (ফ্রি হলে 0 লিখুন)"
                      />
                    </div>
                  </div>
                </div>

                {/* Country Exchange Rates Table / Grid */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="text-xs font-black text-slate-700 uppercase tracking-wide">দেশভিত্তিক এক্সচেঞ্জ রেট তালিকা ({exchangeRatesList.length} টি দেশ)</h5>
                    <button
                      type="button"
                      onClick={() => {
                        const newRate = {
                          countryCode: 'USD',
                          countryName: 'নতুন দেশ (USD)',
                          currencyCode: 'USD',
                          flagEmoji: '🌐',
                          bdtRate: 100,
                          minAmount: 10,
                          maxAmount: 10000,
                          cashback: 0
                        };
                        setExchangeRatesList([...exchangeRatesList, newRate]);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold rounded-xl transition cursor-pointer"
                    >
                      + নতুন দেশ যোগ করুন
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {exchangeRatesList.map((rateItem, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2.5 text-xs">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              className="w-8 text-center bg-white border border-slate-200 rounded-lg p-1 font-mono text-sm"
                              value={rateItem.flagEmoji || '🏳️'}
                              onChange={(e) => {
                                const updated = [...exchangeRatesList];
                                updated[idx].flagEmoji = e.target.value;
                                setExchangeRatesList(updated);
                              }}
                            />
                            <input
                              type="text"
                              className="font-black text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs w-36 outline-none"
                              value={rateItem.countryName || ''}
                              onChange={(e) => {
                                const updated = [...exchangeRatesList];
                                updated[idx].countryName = e.target.value;
                                setExchangeRatesList(updated);
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = exchangeRatesList.filter((_, i) => i !== idx);
                              setExchangeRatesList(updated);
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1 bg-white rounded-lg border border-slate-200"
                            title="দেশটি মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                          <div>
                            <label className="block text-slate-500 font-mono mb-0.5">কারেন্সি কোড</label>
                            <input
                              type="text"
                              className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-mono text-xs font-black uppercase outline-none"
                              value={rateItem.currencyCode || ''}
                              onChange={(e) => {
                                const updated = [...exchangeRatesList];
                                updated[idx].currencyCode = e.target.value;
                                setExchangeRatesList(updated);
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-mono mb-0.5">১ {rateItem.currencyCode || 'কোড'} = ৳ BDT রেট</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full bg-white border border-emerald-300 rounded-lg p-1.5 font-mono text-xs font-black text-emerald-700 outline-none"
                              value={rateItem.bdtRate || 0}
                              onChange={(e) => {
                                const updated = [...exchangeRatesList];
                                updated[idx].bdtRate = Number(e.target.value) || 0;
                                setExchangeRatesList(updated);
                              }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                          <div>
                            <label className="block text-slate-500 font-mono mb-0.5">মিনিমাম এক্সচেঞ্জ</label>
                            <input
                              type="number"
                              className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-mono text-xs outline-none"
                              value={rateItem.minAmount || 0}
                              onChange={(e) => {
                                const updated = [...exchangeRatesList];
                                updated[idx].minAmount = Number(e.target.value) || 0;
                                setExchangeRatesList(updated);
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-mono mb-0.5">ক্যাশব্যাক/বোনাস (৳)</label>
                            <input
                              type="number"
                              className="w-full bg-white border border-purple-200 rounded-lg p-1.5 font-mono text-xs font-black text-purple-700 outline-none"
                              value={rateItem.cashback || 0}
                              onChange={(e) => {
                                const updated = [...exchangeRatesList];
                                updated[idx].cashback = Number(e.target.value) || 0;
                                setExchangeRatesList(updated);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveMoneyExchangeConfig}
                    disabled={loading}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-md active:scale-95 cursor-pointer"
                  >
                    মানি এক্সচেঞ্জ কন্ট্রোল সেভ করুন 🚀
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
