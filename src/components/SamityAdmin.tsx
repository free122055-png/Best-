import React, { useState, useEffect } from 'react';
import { User, Transaction, SamityPolicyConfig, SamityFineTier, SAMITY_MONTHS, SAMITY_YEARS, getEffectiveBalance, normalizePaidMonthsArray, getUniquePaidMonthsCount } from '../types';
import { 
  processBulkSamitySavingsAutoDeduction, 
  adminProcessSamityMonthSettlement, 
  adminRefundAllFutureAdvanceMonths,
  isUserMonthPaid, 
  getUnpaidSamityMonths, 
  AutoDeductionResult 
} from '../lib/samitySavingsEngine';
import { sortTransactionsNewestFirst } from '../lib/transactionUtils';
import { deleteUserCompletelyFromDatabase } from '../lib/memberUtils';
import { db } from '../lib/firebase';
import { doc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';
import SamityInvestmentsView from './SamityInvestmentsView';
import { 
  PiggyBank, 
  BadgeAlert, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Users,
  Coins,
  ChevronLeft,
  Volume2,
  FileText,
  Image as ImageIcon,
  Sparkles,
  ClipboardList,
  Trash2,
  Check,
  Info,
  ArrowUpRight,
  ArrowDownLeft,
  Settings,
  Search,
  Edit3,
  Award,
  LineChart,
  Calendar,
  Eye,
  Sliders,
  ShieldAlert,
  Save,
  X,
  CreditCard,
  Zap,
  RotateCcw,
  CheckSquare,
  Square,
  AlertCircle,
  TrendingUp,
  Landmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_FINE_TIERS: SamityFineTier[] = [
  { id: 'tier-1', fromDay: 1, toDay: 9, rangeLabel: '1 থেকে 9 তারিখঃ', fineText: 'কোনো জরিমানা নেই (0 BDT)', fineAmount: 0, bgClass: 'bg-emerald-50/40 border-emerald-100 text-emerald-800' },
  { id: 'tier-2', fromDay: 10, toDay: 19, rangeLabel: '10 থেকে 19 তারিখঃ', fineText: '৳ 10 জরিমানা', fineAmount: 10, bgClass: 'bg-amber-50/40 border-amber-100 text-amber-800' },
  { id: 'tier-3', fromDay: 20, toDay: 29, rangeLabel: '20 থেকে 29 তারিখঃ', fineText: '৳ 20 জরিমানা', fineAmount: 20, bgClass: 'bg-orange-50/40 border-orange-100 text-orange-800' },
  { id: 'tier-4', fromDay: 30, toDay: 39, rangeLabel: '30 থেকে 39 তারিখঃ', fineText: '৳ 30 জরিমানা', fineAmount: 30, bgClass: 'bg-rose-50/40 border-rose-100 text-rose-800' },
  { id: 'tier-5', fromDay: 40, toDay: 40, rangeLabel: '40তম দিনঃ', fineText: '৳ 80 জরিমানা', fineAmount: 80, bgClass: 'bg-red-50/40 border-red-150 text-red-800' },
  { id: 'tier-6', fromDay: 41, toDay: 999, rangeLabel: '40তম দিনের পরঃ', fineText: '৳ 10 প্রতিদিন জরিমানা', fineAmount: 10, bgClass: 'bg-slate-50 border-slate-150 text-slate-700', isDaily: true }
];

const DEFAULT_CUSTOM_RULES: string[] = [
  "25শে ডিসেম্বরের পূর্বে আপনার সঞ্চিত টাকা উত্তোলন করতে পারবেন না। আপনার জমাকৃত টাকা ডিসেম্বরের 25-30 তারিখের মধ্যে স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্সে জমা হবে।",
  "প্রতি মাসের 1 থেকে 9 তারিখের মধ্যে স্বয়ংক্রিয়ভাবে অটো-ডেবিট কিস্তি জমা নেওয়া হয়।",
  "10 তারিখ থেকে বিলম্বে কিস্তি জমায় জরিমানা পলিসি প্রযোজ্য হবে।",
  "বিশেষ প্রয়োজনে অটো সঞ্চয় বন্ধ করতে এডমিন অনুমতির জন্য হেল্পলাইনে যোগাযোগ করুন।"
];

interface SamityAdminProps {
  users: User[];
  transactions: Transaction[];
  loading: boolean;
  reconUserUid: string;
  setReconUserUid: (val: string) => void;
  reconAction: 'add_savings' | 'reduce_savings' | 'add_dps' | 'reduce_dps' | 'add_profits' | 'reduce_profits' | 'disburse_loan' | 'repay_loan_cash' | 'disburse_qard' | 'repay_qard';
  setReconAction: (val: any) => void;
  reconAmount: string;
  setReconAmount: (val: string) => void;
  reconNotes: string;
  setReconNotes: (val: string) => void;
  reconSuccess: string;
  reconError: string;
  handleReconciliationSubmit: (e: React.FormEvent) => void;
  handleApproveTransaction: (tx: Transaction) => void;
  handleRejectTransaction: (txId: string) => void;
  handleApproveSamityMember: (user: User) => void;
  handleRejectSamityMember: (user: User) => void;
  appConfig: any;
  onChangeConfig: (newConfig: any) => void;
  dbSamityBanners: any[];
  setDbSamityBanners: React.Dispatch<React.SetStateAction<any[]>>;
  defaultSamitySlides: any[];
}

export default function SamityAdmin({
  users,
  transactions,
  loading,
  reconUserUid,
  setReconUserUid,
  reconAction,
  setReconAction,
  reconAmount,
  setReconAmount,
  reconNotes,
  setReconNotes,
  reconSuccess,
  reconError,
  handleReconciliationSubmit,
  handleApproveTransaction,
  handleRejectTransaction,
  handleApproveSamityMember,
  handleRejectSamityMember,
  appConfig,
  onChangeConfig,
  dbSamityBanners,
  setDbSamityBanners,
  defaultSamitySlides
}: SamityAdminProps) {

  // Active sub-section state inside BNB Investor admin panel
  const [activeSubView, setActiveSubView] = useState<'main' | 'membership' | 'transactions' | 'ledger' | 'notices' | 'banners' | 'members' | 'policy_rules' | 'monthly_collection' | 'investments_manager'>('main');

  // Monthly Savings Collection & Auto-Debit states
  const [selectedCollectionYear, setSelectedCollectionYear] = useState<number>(new Date().getFullYear());
  const [collectionSearchQuery, setCollectionSearchQuery] = useState<string>('');
  const [collectionFilterStatus, setCollectionFilterStatus] = useState<'all' | 'unpaid' | 'current_unpaid' | 'paid'>('all');
  const [memberSelectedMonthsMap, setMemberSelectedMonthsMap] = useState<Record<string, string[]>>({});
  const [isBulkDeducting, setIsBulkDeducting] = useState<boolean>(false);
  const [bulkResultModal, setBulkResultModal] = useState<{
    totalEligible: number;
    processedCount: number;
    totalCollected: number;
    skippedCount: number;
    results: AutoDeductionResult[];
  } | null>(null);
  const [settlingMemberUid, setSettlingMemberUid] = useState<string | null>(null);
  const [collectionSuccessMsg, setCollectionSuccessMsg] = useState<string>('');
  const [collectionErrorMsg, setCollectionErrorMsg] = useState<string>('');

  // Member search & editing state
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [memberSaveSuccess, setMemberSaveSuccess] = useState('');
  const [memberSaveError, setMemberSaveError] = useState('');
  const [isSavingMember, setIsSavingMember] = useState(false);

  // Filter for transactions
  const [txFilterType, setTxFilterType] = useState<'all' | 'deposit' | 'withdraw'>('all');

  // Local state for policy settings
  const [tickerText, setTickerText] = useState(appConfig?.samityTicker || '');
  const [termsText, setTermsText] = useState(appConfig?.samityTerms || '');
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState('');

  // Local state for BNB Investor Policy Config & Rules
  const [policyConfig, setPolicyConfig] = useState<SamityPolicyConfig>(() => ({
    policyTitle: appConfig?.samityPolicyConfig?.policyTitle || 'মাসিক বিনিয়োগ ও নীতিমালা',
    policySubTitle: appConfig?.samityPolicyConfig?.policySubTitle || '1ম থেকে 25শে অক্টোবর পেমেন্ট সিস্টেম ও বিলম্ব চার্জসমূহ',
    schemeStatusNote: appConfig?.samityPolicyConfig?.schemeStatusNote || 'আপনার একাউন্ট থেকে প্রতি মাসের 1 থেকে 9 তারিখের মধ্যে স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্স থেকে কিস্তি অটো-ডেবিট করা হবে।',
    fixedAmountTitle: appConfig?.samityPolicyConfig?.fixedAmountTitle || '1. নির্ধারিত মাসিক বিনিয়োগের পরিমাণ',
    fixedAmountNote: appConfig?.samityPolicyConfig?.fixedAmountNote || '💡 অ্যাকাউন্ট খোলার সময় আপনার নির্বাচিত এই কিস্তির পরিমাণ স্থায়ী। এটি সাধারণ ব্যবহারকারী নিজে পরিবর্তন করতে পারবেন না। প্রয়োজনে পরিবর্তন করার জন্য এডমিন প্যানেলের মাধ্যমে প্রধান কার্যালয়ের সাথে যোগাযোগ করুন।',
    penaltyTitle: appConfig?.samityPolicyConfig?.penaltyTitle || '2. বিলম্ব পেমেন্ট ও জরিমানা পলিসি',
    penaltyTiers: appConfig?.samityPolicyConfig?.penaltyTiers && appConfig.samityPolicyConfig.penaltyTiers.length > 0 
      ? appConfig.samityPolicyConfig.penaltyTiers 
      : DEFAULT_FINE_TIERS,
    customRules: appConfig?.samityPolicyConfig?.customRules && appConfig.samityPolicyConfig.customRules.length > 0 
      ? appConfig.samityPolicyConfig.customRules 
      : DEFAULT_CUSTOM_RULES,
    pausePenaltyUntil15th: appConfig?.samityPolicyConfig?.pausePenaltyUntil15th ?? false,
    penaltyExemptionUntilDay: appConfig?.samityPolicyConfig?.penaltyExemptionUntilDay || 15,
    penaltyExemptionNote: appConfig?.samityPolicyConfig?.penaltyExemptionNote || 'অ্যাপ সম্পূর্ণ প্রস্তুতকরণ কাজের জন্য এই মাসের জরিমানা 15 তারিখ পর্যন্ত স্থগিত রাখা হলো।',
    exemptedMonths: appConfig?.samityPolicyConfig?.exemptedMonths || {},
    exemptedMonthsConfig: appConfig?.samityPolicyConfig?.exemptedMonthsConfig || {},
  }));
  const [selectedAdminPenaltyYear, setSelectedAdminPenaltyYear] = useState<number>(new Date().getFullYear());
  const [policySaveSuccess, setPolicySaveSuccess] = useState(false);
  const [policySaveError, setPolicySaveError] = useState('');
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);

  useEffect(() => {
    if (appConfig?.samityPolicyConfig) {
      setPolicyConfig({
        policyTitle: appConfig.samityPolicyConfig.policyTitle || 'মাসিক বিনিয়োগ ও নীতিমালা',
        policySubTitle: appConfig.samityPolicyConfig.policySubTitle || '1ম থেকে 25শে অক্টোবর পেমেন্ট সিস্টেম ও বিলম্ব চার্জসমূহ',
        schemeStatusNote: appConfig.samityPolicyConfig.schemeStatusNote || 'আপনার একাউন্ট থেকে প্রতি মাসের 1 থেকে 9 তারিখের মধ্যে স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্স থেকে কিস্তি অটো-ডেবিট করা হবে।',
        fixedAmountTitle: appConfig.samityPolicyConfig.fixedAmountTitle || '1. নির্ধারিত মাসিক বিনিয়োগের পরিমাণ',
        fixedAmountNote: appConfig.samityPolicyConfig.fixedAmountNote || '💡 অ্যাকাউন্ট খোলার সময় আপনার নির্বাচিত এই কিস্তির পরিমাণ স্থায়ী। এটি সাধারণ ব্যবহারকারী নিজে পরিবর্তন করতে পারবেন না। প্রয়োজনে পরিবর্তন করার জন্য এডমিন প্যানেলের মাধ্যমে প্রধান কার্যালয়ের সাথে যোগাযোগ করুন।',
        penaltyTitle: appConfig.samityPolicyConfig.penaltyTitle || '2. বিলম্ব পেমেন্ট ও জরিমানা পলিসি',
        penaltyTiers: appConfig.samityPolicyConfig.penaltyTiers && appConfig.samityPolicyConfig.penaltyTiers.length > 0 
          ? appConfig.samityPolicyConfig.penaltyTiers 
          : DEFAULT_FINE_TIERS,
        customRules: appConfig.samityPolicyConfig.customRules && appConfig.samityPolicyConfig.customRules.length > 0 
          ? appConfig.samityPolicyConfig.customRules 
          : DEFAULT_CUSTOM_RULES,
        pausePenaltyUntil15th: appConfig.samityPolicyConfig.pausePenaltyUntil15th ?? false,
        penaltyExemptionUntilDay: appConfig.samityPolicyConfig.penaltyExemptionUntilDay || 15,
        penaltyExemptionNote: appConfig.samityPolicyConfig.penaltyExemptionNote || 'অ্যাপ সম্পূর্ণ প্রস্তুতকরণ কাজের জন্য এই মাসের জরিমানা 15 তারিখ পর্যন্ত স্থগিত রাখা হলো।',
        exemptedMonths: appConfig.samityPolicyConfig.exemptedMonths || {},
        exemptedMonthsConfig: appConfig.samityPolicyConfig.exemptedMonthsConfig || {},
      });
    }
  }, [appConfig?.samityPolicyConfig]);

  const handleSavePolicyConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPolicySaveError('');
    setPolicySaveSuccess(false);
    setIsSavingPolicy(true);

    try {
      await onChangeConfig({
        ...appConfig,
        samityPolicyConfig: policyConfig
      });
      setPolicySaveSuccess(true);
      setTimeout(() => setPolicySaveSuccess(false), 3500);
    } catch (err: any) {
      setPolicySaveError('নীতিমালা সেটিংস সেভ করতে সমস্যা হয়েছে: ' + (err?.message || 'অজানা ত্রুটি'));
    } finally {
      setIsSavingPolicy(false);
    }
  };

  // Local stats calculations
  const totalSavings = users.reduce((sum, u) => sum + (u.savings || 0), 0);
  const totalDps = users.reduce((sum, u) => sum + (u.dpsBalance || 0), 0);
  const totalProfits = users.reduce((sum, u) => sum + (u.profitsBalance || 0), 0);
  const totalLoans = users.reduce((sum, u) => sum + (u.dueLoan || 0), 0);
  const totalShares = users.reduce((sum, u) => sum + (u.shares || 0), 0);
  const approvedMembersCount = users.filter(u => u.samityStatus === 'approved').length;
  const pendingMembers = users.filter(u => u.samityStatus === 'pending');
  const pendingMembersCount = pendingMembers.length;

  // Samity-specific transaction types
  const samityTxTypes = [
    'deposit',
    'withdraw',
    'loan_repayment',
    'loan_disbursment',
    'coop_savings_deposit'
  ];

  // Filters pending co-op transactions
  const pendingSamityTxs = transactions.filter(t => t.status === 'pending' && samityTxTypes.includes(t.type));
  const pendingTxsCount = pendingSamityTxs.length;

  // Active borrowers list
  const membersWithLoans = users.filter(u => (u.dueLoan || 0) > 0);

  // Base64 image handler helper
  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Helper function to update appConfig
  const handleUpdateSamityConfig = async () => {
    setSettingsSaveError('');
    setSettingsSaveSuccess(false);
    try {
      const updatedConfig = {
        ...appConfig,
        samityTicker: tickerText,
        samityTerms: termsText
      };
      // Import saveAppConfig inline or from config lib
      const { saveAppConfig } = await import('../lib/config');
      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      setSettingsSaveSuccess(true);
      setTimeout(() => setSettingsSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving Samity policy config:', err);
      setSettingsSaveError('পলিসি আপডেট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
  };

  // Helper to save modified banners
  const handleSaveBannersConfig = async (updatedBanners: any[]) => {
    try {
      setDbSamityBanners(updatedBanners);
      const updatedConfig = {
        ...appConfig,
        samityBanners: updatedBanners
      };
      const { saveAppConfig } = await import('../lib/config');
      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);
      alert('স্লাইডার ব্যানার সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে!');
    } catch (err: any) {
      alert('ব্যানার সংরক্ষণ করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  // Current banners
  const currentBanners = dbSamityBanners.length > 0 ? dbSamityBanners : defaultSamitySlides;

  // Member save handler
  const handleSaveMemberProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setIsSavingMember(true);
    setMemberSaveError('');
    setMemberSaveSuccess('');

    try {
      const userRef = doc(db, 'users', editingMember.uid);
      const canDisable = Boolean(editingMember.canDisableAutoSavings || editingMember.allowAutoSavingsToggle);
      const savingsVal = Number(editingMember.savings || 0);
      const targetRateVal = Math.max(1, Number(editingMember.monthlySavingsTarget) || 1000);
      const rawPaid = Array.isArray(editingMember.samityPaidMonths) ? editingMember.samityPaidMonths : [];
      const normalizedPaid = normalizePaidMonthsArray(rawPaid, savingsVal, targetRateVal);

      const updateData = {
        name: editingMember.name,
        phone: editingMember.phone,
        nid: editingMember.nid || '',
        savings: savingsVal,
        dpsBalance: savingsVal,
        monthlySavingsTarget: targetRateVal,
        samityPaidMonths: normalizedPaid,
        profitsBalance: Number(editingMember.profitsBalance || 0),
        dueLoan: Number(editingMember.dueLoan || 0),
        samityStatus: editingMember.samityStatus || 'none',
        samityApproved: editingMember.samityStatus === 'approved',
        canDisableAutoSavings: canDisable,
        allowAutoSavingsToggle: canDisable
      };

      await updateDoc(userRef, updateData);

      // Also sync dedicated samity_applications doc if it exists
      try {
        await updateDoc(doc(db, 'samity_applications', editingMember.uid), {
          ...updateData,
          status: editingMember.samityStatus || 'none'
        });
      } catch (e) {
        // ignore if application doc doesn't exist
      }

      // User Notification for permission update
      await addDoc(collection(db, 'user_notifications'), {
        userId: editingMember.uid,
        title: canDisable ? '🔓 অটো সঞ্চয় অফ করার অনুমতি দেওয়া হয়েছে' : '🔒 অটো সঞ্চয় অফ করার অনুমতি বন্ধ রাখা হয়েছে',
        message: canDisable
          ? 'এডমিন প্যানেল থেকে আপনার সমবায় সমিতির অটো সঞ্চয় সুইচ বন্ধ (OFF) করার অনুমতি প্রদান করা হয়েছে।'
          : 'এডমিন প্যানেল থেকে আপনার অটো সঞ্চয় সুইচ বন্ধ করার অনুমতি সুরক্ষিত করা হয়েছে।',
        type: 'admin_permission_update',
        read: false,
        createdAt: new Date().toISOString()
      });
      setMemberSaveSuccess('সদস্যের সমস্ত তথ্য সফলভাবে আপডেট করা হয়েছে!');
      setTimeout(() => {
        setMemberSaveSuccess('');
        setEditingMember(null);
      }, 1500);
    } catch (err: any) {
      setMemberSaveError('তথ্য আপডেট করা সম্ভব হয়নি: ' + err.message);
    } finally {
      setIsSavingMember(false);
    }
  };

  // Member delete handler

  // Toggle a month selection for a specific member
  const toggleMemberMonthSelection = (memberUid: string, monthId: string) => {
    setMemberSelectedMonthsMap(prev => {
      const current = prev[memberUid] || [];
      if (current.includes(monthId)) {
        return { ...prev, [memberUid]: current.filter(id => id !== monthId) };
      } else {
        return { ...prev, [memberUid]: [...current, monthId] };
      }
    });
  };

  // Select all unpaid months for a member in the selected year
  const selectAllUnpaidForMember = (member: User, year: number) => {
    const unpaid = getUnpaidSamityMonths(member, year, false);
    setMemberSelectedMonthsMap(prev => ({
      ...prev,
      [member.uid]: unpaid.map(u => u.id)
    }));
  };

  // Clear month selection for a member
  const clearMemberMonthSelection = (memberUid: string) => {
    setMemberSelectedMonthsMap(prev => ({
      ...prev,
      [memberUid]: []
    }));
  };

  // Execute manual month settlement (deduct from main balance or direct deposit or unmark)
  const handleMemberMonthSettlement = async (
    member: User, 
    deductFromMainBalance: boolean,
    action: 'mark_paid' | 'unmark' = 'mark_paid'
  ) => {
    const selectedMonths = memberSelectedMonthsMap[member.uid] || [];
    if (selectedMonths.length === 0) {
      alert('অনুগ্রহ করে অন্তত একটি মাস নির্বাচন করুন।');
      return;
    }

    const targetRate = Math.max(1, Number(member.monthlySavingsTarget) || 1000);
    const totalAmt = selectedMonths.length * targetRate;
    const memberBal = getEffectiveBalance(member);

    if (action === 'mark_paid' && deductFromMainBalance && memberBal < totalAmt) {
      alert(`সদস্যের মেইন ব্যালেন্সে পর্যাপ্ত টাকা নেই।\nবর্তমান মেইন ব্যালেন্স: ৳${memberBal.toLocaleString('bn-BD')}\nপ্রয়োজনীয় কিস্তি (${selectedMonths.length} মাস): ৳${totalAmt.toLocaleString('bn-BD')}\n\nসদস্যের মেইন ব্যালেন্সে রিচার্জ করার পর কর্তন করুন অথবা সরাসরি ক্যাশ জমা অপশন ব্যবহার করুন।`);
      return;
    }

    const monthNames = selectedMonths.map(mId => {
      const found = SAMITY_MONTHS.find(m => m.id === mId);
      return found ? found.name : mId;
    }).join(', ');

    const confirmPrompt = action === 'unmark'
      ? `আপনি কি নিশ্চিত যে ${member.name}-এর ${selectedCollectionYear} সালের (${monthNames}) মাসের পেইড স্ট্যাটাস বাতিল (Unmark) করতে চান?`
      : deductFromMainBalance
      ? `আপনি কি নিশ্চিত যে ${member.name}-এর মেইন ব্যালেন্স থেকে (${monthNames}) ${selectedCollectionYear} সালের সঞ্চয় বাবদ ৳${totalAmt.toLocaleString('bn-BD')} টাকা কেটে সঞ্চয়ে জমা করতে চান?`
      : `আপনি কি নিশ্চিত যে ${member.name}-এর জন্য (${monthNames}) ${selectedCollectionYear} সালের সঞ্চয় ৳${totalAmt.toLocaleString('bn-BD')} টাকা সরাসরি ক্যাশ/এডমিন হিসেবে পেইড মার্ক করতে চান?`;

    if (!window.confirm(confirmPrompt)) return;

    setSettlingMemberUid(member.uid);
    setCollectionSuccessMsg('');
    setCollectionErrorMsg('');

    try {
      const res = await adminProcessSamityMonthSettlement({
        userId: member.uid,
        year: selectedCollectionYear,
        monthIds: selectedMonths,
        deductFromMainBalance,
        action,
        adminName: 'এডমিন'
      });

      if (res.success) {
        setCollectionSuccessMsg(res.message);
        clearMemberMonthSelection(member.uid);
        setTimeout(() => setCollectionSuccessMsg(''), 6000);
      } else {
        setCollectionErrorMsg(res.message);
        setTimeout(() => setCollectionErrorMsg(''), 6000);
      }
    } catch (err: any) {
      setCollectionErrorMsg(err?.message || 'সঞ্চয় কিস্তি জমা প্রক্রিয়াকরণে সমস্যা হয়েছে।');
      setTimeout(() => setCollectionErrorMsg(''), 6000);
    } finally {
      setSettlingMemberUid(null);
    }
  };

  // Run bulk auto-deduction across all eligible members
  const handleRunBulkAutoDeduction = async () => {
    const confirmRun = window.confirm(
      `🚀 আপনি কি সকল নিবন্ধিত সমবায় সদস্যের বকেয়া কিস্তি অটো-কাটিং চালাতে চান?\n\n- যেসব সদস্যের চলতি বা বিগত মাসের সঞ্চয় বাকি আছে\n- এবং যাদের মেইন ব্যালেন্সে পর্যাপ্ত টাকা আছে\nতাদের সম্পূর্ণ কিস্তির টাকা (1000/2000/5000) স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্স থেকে কেটে সঞ্চয়ে জমা হবে।`
    );
    if (!confirmRun) return;

    setIsBulkDeducting(true);
    try {
      const res = await processBulkSamitySavingsAutoDeduction(users, { targetYear: selectedCollectionYear });
      setBulkResultModal(res);
    } catch (err: any) {
      alert('বাল্ক সঞ্চয় অটো-কাটিং প্রক্রিয়াকরণে সমস্যা হয়েছে: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsBulkDeducting(false);
    }
  };

  const [isRefundingAdvance, setIsRefundingAdvance] = useState(false);

  // Refund all future/advance months (October, November, etc.) to members' main balances
  const handleRefundAdvanceMonths = async () => {
    const confirmRefund = window.confirm(
      `🔄 আপনি কি সকল সদস্যের একাউন্ট থেকে ভুলবশত কর্তিত অগ্রিম মাসের (অক্টোবর, নভেম্বর ইত্যাদি) কিস্তির টাকা মেইন ব্যালেন্সে রিফান্ড করতে চান?\n\n- সিস্টেম সকল সদস্যের সঞ্চয় চেক করবে\n- অক্টোবর/নভেম্বর বা ভবিষ্যৎ মাসের কিস্তি থাকলে তা বাতিল করবে\n- এবং কর্তিত টাকা তৎক্ষণাৎ সদস্যের মেইন ব্যালেন্সে ফেরত পাঠাবে।`
    );
    if (!confirmRefund) return;

    setIsRefundingAdvance(true);
    try {
      const res = await adminRefundAllFutureAdvanceMonths(users);
      if (res.totalRefundedMembers > 0) {
        alert(`✅ মোট ${res.totalRefundedMembers} জন সদস্যের একাউন্টে সর্বমোট ৳${res.totalRefundedAmount.toLocaleString('bn-BD')} টাকা সফলভাবে মেইন ব্যালেন্সে রিফান্ড করা হয়েছে!`);
      } else {
        alert('তথ্য: কোনো সদস্যের একাউন্টে অগ্রিম মাসের কিস্তি পাওয়া যায়নি। সবাই সুরক্ষিত রয়েছে।');
      }
    } catch (err: any) {
      alert('রিফান্ড প্রক্রিয়াকরণে ত্রুটি: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsRefundingAdvance(false);
    }
  };

  const handleDeleteMemberProfile = async (memberUid: string, memberName: string) => {
    if (window.confirm(`আপনি কি নিশ্চিত যে ${memberName} এর অ্যাকাউন্ট স্থায়ীভাবে ডিলিট/মুছে ফেলতে চান? এই কাজটি আর পূর্বাবস্থায় ফেরানো যাবে না।`)) {
      try {
        await deleteUserCompletelyFromDatabase(memberUid);
        alert(`${memberName} এর অ্যাকাউন্ট সফলভাবে মুছে ফেলা হয়েছে!`);
      } catch (err: any) {
        alert('অ্যাকাউন্ট মুছতে সমস্যা হয়েছে: ' + err.message);
      }
    }
  };

  return (
    <div className="space-y-6 text-slate-800 font-sans text-left" id="samity-admin-panel-container">
      
      {/* 1. Header with Breadcrumb and Status */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {activeSubView !== 'main' && (
            <button
              onClick={() => setActiveSubView('main')}
              className="p-2 hover:bg-slate-100 border border-slate-200 rounded-2xl text-slate-600 transition duration-150 active:scale-95 cursor-pointer"
              title="কন্ট্রোল সেন্টারে ফিরে যান"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                {activeSubView === 'main' && '🏢 BNB কোম্পানি ম্যানেজমেন্ট ইনভেস্টর কন্ট্রোল সেন্টার'}
                {activeSubView === 'membership' && '👥 সদস্যপদ অনুমোদন প্যানেল'}
                {activeSubView === 'transactions' && '📥 ডিপোজিট ও লোন অনুমোদন পোর্টাল'}
                {activeSubView === 'ledger' && '📊 ঋণ খতিয়ান ও ম্যানুয়াল খাতা এন্ট্রি'}
                {activeSubView === 'notices' && '📢 লাইভ নোটিশ ও নীতিমালা এডিটর'}
                {activeSubView === 'banners' && '🖼️ ইনভেস্টর হোম স্লাইডার ব্যানার সেটিংস'}
                {activeSubView === 'members' && '⚙️ সমবায় সদস্য ডাটাবেজ & তথ্য এডিটর'}
                {activeSubView === 'policy_rules' && '📜 ইনভেস্টার নীতি ও জরিমানা পলিসি কাস্টমাইজেশন'}
                {activeSubView === 'monthly_collection' && '🗓️ 12 মাস সঞ্চয় কিস্তি আদায় ও অটো-কাটিং ম্যানেজার'}
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {activeSubView === 'main' && 'ইনভেস্টর ও সমবায় খাতের নতুন আবেদন ভেরিফিকেশন, লোন লেজার ও নোটিশ কনফিগারেশন হাব'}
              {activeSubView === 'membership' && 'সম্মানিত সদস্যদের প্রেরিত নতুন ইনভেস্টর সদস্যপদের পেন্ডিং আবেদনপত্র যাচাইকরণ তালিকা'}
              {activeSubView === 'transactions' && 'মেম্বারদের প্রেরিত সমবায় কিস্তি জমা, সঞ্চয় উত্তোলন ও করযে হাসানা লোন এপ্রুভাল ক্যাশবক্স'}
              {activeSubView === 'ledger' && 'অফলাইন ও ম্যানুয়াল পেমেন্ট কালেকশন লিপিবদ্ধকরণ এবং সমিতি সমন্বয় ব্যালেন্স এন্ট্রি'}
              {activeSubView === 'notices' && 'লাইভ স্ক্রোলিং নোটিশ ঘোষণা এবং সদস্যপদের জন্য রেজিষ্ট্রেশন ফি এর শর্তাবলী পরিবর্তন'}
              {activeSubView === 'banners' && 'ইনভেস্টর মডিউলের হোম স্ক্রিনে প্রদর্শিত চমৎকার ব্যানার স্লাইডার কনফিগারেশন'}
              {activeSubView === 'members' && 'সকল নিবন্ধিত সদস্যের প্রোফাইল, ব্যালেন্স, এনআইডি এবং মোবাইল নাম্বার সরাসরি এডিট বা ডিলিট করুন'}
              {activeSubView === 'policy_rules' && 'BNB ইনভেস্টার ইউজার ড্যাশবোর্ডের সমস্ত নিয়মকানুন, কিস্তি পলিসি ও বিলম্ব জরিমানা স্কেল পরিবর্তন করুন'}
              {activeSubView === 'monthly_collection' && 'সকল নিবন্ধিত সদস্যের 12 মাসের কিস্তির খতিয়ান, মেইন ব্যালেন্স থেকে অটো-কাটিং এবং ম্যানুয়াল কিস্তি সমন্বয়'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 items-center flex-wrap">
          <button
            onClick={() => setActiveSubView('monthly_collection')}
            className="text-[10.5px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            12 মাস সঞ্চয় আদায়
          </button>
          <button
            onClick={() => setActiveSubView('policy_rules')}
            className="text-[10.5px] font-bold bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            নিয়মকানুন কাস্টমাইজেশন
          </button>
          <span className="text-[10.5px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 px-3.5 py-1.5 rounded-full">
            সমবায় এডমিন প্যানেল
          </span>
        </div>
      </div>

      {/* 2. Live Notification Banner */}
      {activeSubView === 'main' && appConfig?.samityTicker && (
        <div className="bg-emerald-50/75 border border-emerald-100 text-emerald-800 text-xs py-3 px-4.5 rounded-2xl flex items-center gap-2.5 shadow-3xs">
          <span className="flex items-center justify-center w-6 h-6 bg-emerald-500 text-white rounded-full shrink-0">
            <Volume2 className="w-3.5 h-3.5 animate-bounce" />
          </span>
          <div className="overflow-hidden relative flex-1">
            <p className="font-bold truncate text-[11px] text-emerald-950">
              <span className="text-emerald-500 font-extrabold mr-1">[সক্রিয় নোটিশ]:</span>
              {appConfig?.samityTicker}
            </p>
          </div>
          <button 
            onClick={() => setActiveSubView('notices')} 
            className="text-[10px] bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-700 px-3 py-1 rounded-xl font-bold transition whitespace-nowrap cursor-pointer active:scale-95"
          >
            পরিবর্তন করুন
          </button>
        </div>
      )}

      {/* 3. Core Financial Stats Box */}
      {activeSubView === 'main' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200/80 p-4.5 rounded-2.5xl shadow-3xs">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">1. সঞ্চয়ী আমানত স্থিতি</span>
              <span className="text-emerald-600 bg-emerald-50 p-1 rounded-lg"><PiggyBank className="w-3.5 h-3.5" /></span>
            </div>
            <h3 className="text-base sm:text-lg font-black font-sans text-emerald-600 mt-2">৳{totalSavings.toLocaleString('bn-BD')} BDT</h3>
            <p className="text-[9.5px] text-slate-450 mt-1">সমিতি সঞ্চয় ফান্ড মোট ক্যাপিটাল</p>
          </div>

          <div className="bg-white border border-slate-200/80 p-4.5 rounded-2.5xl shadow-3xs">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">2. সমবায় লোন বকেয়া</span>
              <span className="text-rose-600 bg-rose-50 p-1 rounded-lg"><Coins className="w-3.5 h-3.5" /></span>
            </div>
            <h3 className="text-base sm:text-lg font-black font-sans text-rose-600 mt-2">৳{totalLoans.toLocaleString('bn-BD')} BDT</h3>
            <p className="text-[9.5px] text-slate-450 mt-1">Outstanding লোন বকেয়া খাত</p>
          </div>

          <div className="bg-white border border-slate-200/80 p-4.5 rounded-2.5xl shadow-3xs">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">3. ডিপিএস আমানত স্থিতি</span>
              <span className="text-sky-600 bg-sky-50 p-1 rounded-lg"><Sparkles className="w-3.5 h-3.5" /></span>
            </div>
            <h3 className="text-base sm:text-lg font-black font-sans text-sky-600 mt-2">৳{totalDps.toLocaleString('bn-BD')} BDT</h3>
            <p className="text-[9.5px] text-slate-450 mt-1">সদস্য ডিপিএস সঞ্চয় মোট ক্যাপিটাল</p>
          </div>

          <div className="bg-white border border-slate-200/80 p-4.5 rounded-2.5xl shadow-3xs">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">4. বণ্টনকৃত লভ্যাংশ স্থিতি</span>
              <span className="text-indigo-600 bg-indigo-50 p-1 rounded-lg"><Coins className="w-3.5 h-3.5" /></span>
            </div>
            <h3 className="text-base sm:text-lg font-black font-sans text-indigo-600 mt-2">৳{totalProfits.toLocaleString('bn-BD')} BDT</h3>
            <p className="text-[9.5px] text-slate-450 mt-1">সদস্যদের অর্জিত অর্ধবার্ষিক লভ্যাংশ</p>
          </div>

          <div className="bg-emerald-500 text-white p-4.5 rounded-2.5xl shadow-3xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full blur-xl transform translate-x-4 -translate-y-4" />
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-emerald-100 font-extrabold uppercase tracking-wider">5. মোট ইকুইটি শেয়ার সংখ্যা</span>
              <span className="text-emerald-550 bg-white/20 p-1 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5 text-white" /></span>
            </div>
            <h3 className="text-base sm:text-lg font-black font-sans mt-2">{totalShares.toLocaleString('bn-BD')} টি</h3>
            <p className="text-[9.5px] text-emerald-100 mt-1 font-medium">1,000 সঞ্চয় = 1টি মালিকানা শেয়ার</p>
          </div>
        </div>
      )}

      {/* 4. Content Area Based on Active Sub-view */}
      <div className="mt-2" id="samity-dynamic-sub-views-container">
        
        {/* VIEW A: MAIN CONTROL DASHBOARD GRID */}
        {activeSubView === 'main' && (
          <div className="space-y-6">
            
            {/* Security Note */}
            <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2.5xl flex items-start gap-3 shadow-3xs">
              <span className="text-amber-500 bg-amber-50 p-1.5 rounded-xl shrink-0"><Info className="w-4 h-4" /></span>
              <div className="text-xs text-slate-600 leading-relaxed">
                <strong>ম্যানেজমেন্ট পলিসি সিকিউরিটিঃ</strong> এখানে প্রদর্শিত প্রতিটি বিষয় সরাসরি ইউজার প্যানেলের <strong>"BNB কোম্পানি ম্যানেজমেন্ট ইনভেস্টর"</strong> সেকশনের সাথে সংযুক্ত। নতুন মেম্বার আবেদন করা মাত্রই আপনি এখানে নোটিফিকেশন পাবেন এবং তাদের যাবতীয় কিস্তি ট্রানজেকশন অনুমোদন করতে পারবেন।
              </div>
            </div>

            {/* Dashboard Navigation Grid - Strictly 4 Columns Per Row Grid */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider font-sans">কন্ট্রোল মডিউল নির্বাচন করুন (8টি সেকশন)</h3>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  এক সারিতে 4টি সেকশন
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
                
                {/* Option 1: Membership Approvals */}
                <button
                  onClick={() => setActiveSubView('membership')}
                  className="group relative bg-white hover:bg-emerald-50/40 border-2 border-slate-200/90 hover:border-emerald-500 rounded-xl sm:rounded-2xl p-2 sm:p-3 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[110px] sm:min-h-[135px] w-full min-w-0"
                >
                  <div className="flex items-center justify-between w-full gap-0.5">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                      <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                    {pendingMembersCount > 0 ? (
                      <span className="px-1 sm:px-1.5 py-0.5 bg-rose-500 text-white text-[8px] sm:text-[9.5px] font-black rounded animate-pulse shrink-0">
                        {pendingMembersCount}টি পেন্ডিং
                      </span>
                    ) : (
                      <span className="px-1 sm:px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] sm:text-[9px] font-bold rounded border border-emerald-200 shrink-0">
                        সব শেষ
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 sm:mt-2.5 min-w-0">
                    <h4 className="text-[11px] sm:text-[13.5px] font-black text-slate-900 leading-tight tracking-tight line-clamp-1">
                      মেম্বারশিপ আবেদন
                    </h4>
                    <p className="text-[8.5px] sm:text-[10.5px] text-slate-500 mt-0.5 font-semibold line-clamp-1">
                      নতুন সদস্য যাচাই ও অনুমোদন
                    </p>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between w-full text-[8.5px] sm:text-[10px] font-bold text-emerald-600">
                    <span>খুলুন →</span>
                  </div>
                </button>

                {/* Option 2: Transactions & Installment Approvals */}
                <button
                  onClick={() => setActiveSubView('transactions')}
                  className="group relative bg-white hover:bg-amber-50/40 border-2 border-slate-200/90 hover:border-amber-500 rounded-xl sm:rounded-2xl p-2 sm:p-3 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[110px] sm:min-h-[135px] w-full min-w-0"
                >
                  <div className="flex items-center justify-between w-full gap-0.5">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                    {pendingTxsCount > 0 ? (
                      <span className="px-1 sm:px-1.5 py-0.5 bg-amber-500 text-white text-[8px] sm:text-[9.5px] font-black rounded animate-bounce shrink-0">
                        {pendingTxsCount}টি বাকি
                      </span>
                    ) : (
                      <span className="px-1 sm:px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] sm:text-[9px] font-bold rounded border border-emerald-200 shrink-0">
                        সব ক্লিয়ার
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 sm:mt-2.5 min-w-0">
                    <h4 className="text-[11px] sm:text-[13.5px] font-black text-slate-900 leading-tight tracking-tight line-clamp-1">
                      কিস্তি ও লোন
                    </h4>
                    <p className="text-[8.5px] sm:text-[10.5px] text-slate-500 mt-0.5 font-semibold line-clamp-1">
                      পেমেন্ট প্রুফ ও রিকোয়েস্ট অনুমোদন
                    </p>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between w-full text-[8.5px] sm:text-[10px] font-bold text-amber-600">
                    <span>খুলুন →</span>
                  </div>
                </button>

                {/* Option 3: Loans Ledger & Reconciliation */}
                <button
                  onClick={() => setActiveSubView('ledger')}
                  className="group relative bg-white hover:bg-sky-50/40 border-2 border-slate-200/90 hover:border-sky-500 rounded-xl sm:rounded-2xl p-2 sm:p-3 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[110px] sm:min-h-[135px] w-full min-w-0"
                >
                  <div className="flex items-center justify-between w-full gap-0.5">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                      <PiggyBank className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                    <span className="px-1 sm:px-1.5 py-0.5 bg-sky-50 text-sky-700 text-[8px] sm:text-[9px] font-bold rounded border border-sky-200 shrink-0">
                      {membersWithLoans.length} জন ঋণী
                    </span>
                  </div>
                  <div className="mt-1.5 sm:mt-2.5 min-w-0">
                    <h4 className="text-[11px] sm:text-[13.5px] font-black text-slate-900 leading-tight tracking-tight line-clamp-1">
                      ঋণ খতিয়ান
                    </h4>
                    <p className="text-[8.5px] sm:text-[10.5px] text-slate-500 mt-0.5 font-semibold line-clamp-1">
                      ম্যানুয়াল খাতা ও অফলাইন সমন্বয়
                    </p>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between w-full text-[8.5px] sm:text-[10px] font-bold text-sky-600">
                    <span>খুলুন →</span>
                  </div>
                </button>

                {/* Option 4: Notices & Rules Policy */}
                <button
                  onClick={() => setActiveSubView('notices')}
                  className="group relative bg-white hover:bg-purple-50/40 border-2 border-slate-200/90 hover:border-purple-500 rounded-xl sm:rounded-2xl p-2 sm:p-3 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[110px] sm:min-h-[135px] w-full min-w-0"
                >
                  <div className="flex items-center justify-between w-full gap-0.5">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                      <Volume2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                    <span className="px-1 sm:px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[8px] sm:text-[9px] font-bold rounded border border-purple-200 shrink-0">
                      লাইভ নোটিশ
                    </span>
                  </div>
                  <div className="mt-1.5 sm:mt-2.5 min-w-0">
                    <h4 className="text-[11px] sm:text-[13.5px] font-black text-slate-900 leading-tight tracking-tight line-clamp-1">
                      নোটিশ ও রুলস
                    </h4>
                    <p className="text-[8.5px] sm:text-[10.5px] text-slate-500 mt-0.5 font-semibold line-clamp-1">
                      লাইভ ঘোষণা ও মেম্বারশিপ ফি
                    </p>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between w-full text-[8.5px] sm:text-[10px] font-bold text-purple-600">
                    <span>খুলুন →</span>
                  </div>
                </button>

                {/* Option 5: Slider Banner Config */}
                <button
                  onClick={() => setActiveSubView('banners')}
                  className="group relative bg-white hover:bg-pink-50/40 border-2 border-slate-200/90 hover:border-pink-500 rounded-xl sm:rounded-2xl p-2 sm:p-3 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[110px] sm:min-h-[135px] w-full min-w-0"
                >
                  <div className="flex items-center justify-between w-full gap-0.5">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                      <ImageIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                    <span className="px-1 sm:px-1.5 py-0.5 bg-pink-50 text-pink-700 text-[8px] sm:text-[9px] font-bold rounded border border-pink-200 shrink-0">
                      {currentBanners.length}টি স্লাইড
                    </span>
                  </div>
                  <div className="mt-1.5 sm:mt-2.5 min-w-0">
                    <h4 className="text-[11px] sm:text-[13.5px] font-black text-slate-900 leading-tight tracking-tight line-clamp-1">
                      ব্যানার স্লাইডার
                    </h4>
                    <p className="text-[8.5px] sm:text-[10.5px] text-slate-500 mt-0.5 font-semibold line-clamp-1">
                      স্লাইড ইমেজ ও কন্টেন্ট
                    </p>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between w-full text-[8.5px] sm:text-[10px] font-bold text-pink-600">
                    <span>খুলুন →</span>
                  </div>
                </button>

                {/* Option 6: Member Database & Profile Editor */}
                <button
                  onClick={() => setActiveSubView('members')}
                  className="group relative bg-white hover:bg-indigo-50/40 border-2 border-slate-200/90 hover:border-indigo-500 rounded-xl sm:rounded-2xl p-2 sm:p-3 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[110px] sm:min-h-[135px] w-full min-w-0"
                >
                  <div className="flex items-center justify-between w-full gap-0.5">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                      <Edit3 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                    <span className="px-1 sm:px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[8px] sm:text-[9px] font-bold rounded border border-indigo-200 shrink-0">
                      {users.length} জন
                    </span>
                  </div>
                  <div className="mt-1.5 sm:mt-2.5 min-w-0">
                    <h4 className="text-[11px] sm:text-[13.5px] font-black text-slate-900 leading-tight tracking-tight line-clamp-1">
                      সদস্য ডাটাবেজ
                    </h4>
                    <p className="text-[8.5px] sm:text-[10.5px] text-slate-500 mt-0.5 font-semibold line-clamp-1">
                      এডিট, ব্যালেন্স & ডিলিট
                    </p>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between w-full text-[8.5px] sm:text-[10px] font-bold text-indigo-600">
                    <span>খুলুন →</span>
                  </div>
                </button>

                {/* Option 7: BNB Investor Rules & Policy Config */}
                <button
                  onClick={() => setActiveSubView('policy_rules')}
                  className="group relative bg-white hover:bg-teal-50/40 border-2 border-slate-200/90 hover:border-teal-500 rounded-xl sm:rounded-2xl p-2 sm:p-3 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[110px] sm:min-h-[135px] w-full min-w-0"
                >
                  <div className="flex items-center justify-between w-full gap-0.5">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                      <FileText className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                    <span className="px-1 sm:px-1.5 py-0.5 bg-teal-50 text-teal-700 text-[8px] sm:text-[9px] font-bold rounded border border-teal-200 shrink-0">
                      কাস্টম রুলস
                    </span>
                  </div>
                  <div className="mt-1.5 sm:mt-2.5 min-w-0">
                    <h4 className="text-[11px] sm:text-[13.5px] font-black text-slate-900 leading-tight tracking-tight line-clamp-1">
                      নীতিমালা ও নিয়মাবলী
                    </h4>
                    <p className="text-[8.5px] sm:text-[10.5px] text-slate-500 mt-0.5 font-semibold line-clamp-1">
                      ইনভেস্টার নিয়ম ও জরিমানা স্কেল
                    </p>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between w-full text-[8.5px] sm:text-[10px] font-bold text-teal-600">
                    <span>খুলুন →</span>
                  </div>
                </button>

                {/* Option 8: 12 Months Savings Collection & Auto-Debit Manager */}
                <button
                  onClick={() => setActiveSubView('monthly_collection')}
                  className="group relative bg-gradient-to-br from-emerald-50/70 to-teal-50/70 hover:from-emerald-100/70 hover:to-teal-100/70 border-2 border-emerald-300 hover:border-emerald-500 rounded-xl sm:rounded-2xl p-2 sm:p-3 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[110px] sm:min-h-[135px] w-full min-w-0"
                >
                  <div className="flex items-center justify-between w-full gap-0.5">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                      <Calendar className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                    <span className="px-1 sm:px-1.5 py-0.5 bg-emerald-600 text-white text-[8px] sm:text-[9px] font-black rounded shadow-xs shrink-0">
                      12 মাস কিস্তি
                    </span>
                  </div>
                  <div className="mt-1.5 sm:mt-2.5 min-w-0">
                    <h4 className="text-[11px] sm:text-[13.5px] font-black text-emerald-950 leading-tight tracking-tight line-clamp-1">
                      12 মাস সঞ্চয় আদায়
                    </h4>
                    <p className="text-[8.5px] sm:text-[10.5px] text-emerald-700 mt-0.5 font-semibold line-clamp-1">
                      মাস সিলেক্ট ও অটো-কাটিং
                    </p>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-emerald-200/80 flex items-center justify-between w-full text-[8.5px] sm:text-[10px] font-black text-emerald-800">
                    <span>ম্যানেজার খুলুন →</span>
                  </div>
                </button>

                {/* Option 9: BNB Our Investments (আমাদের ইনভেস্ট পোস্ট ও পোর্টফোলিও ম্যানেজার) */}
                <button
                  onClick={() => setActiveSubView('investments_manager')}
                  className="group relative bg-gradient-to-br from-amber-50/80 via-orange-50/70 to-yellow-50/80 hover:from-amber-100 hover:to-orange-100 border-2 border-amber-300 hover:border-amber-500 rounded-xl sm:rounded-2xl p-2 sm:p-3 text-left transition-all duration-200 hover:shadow-md active:scale-98 cursor-pointer flex flex-col justify-between min-h-[110px] sm:min-h-[135px] w-full min-w-0"
                >
                  <div className="flex items-center justify-between w-full gap-0.5">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-center group-hover:scale-105 transition-all shrink-0 shadow-xs">
                      <TrendingUp className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                    <span className="px-1 sm:px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] sm:text-[9px] font-black rounded shadow-xs shrink-0 animate-pulse">
                      স্বর্ণ ও জমি
                    </span>
                  </div>
                  <div className="mt-1.5 sm:mt-2.5 min-w-0">
                    <h4 className="text-[11px] sm:text-[13.5px] font-black text-amber-950 leading-tight tracking-tight line-clamp-1">
                      আমাদের ইনভেস্ট
                    </h4>
                    <p className="text-[8.5px] sm:text-[10.5px] text-amber-800 mt-0.5 font-semibold line-clamp-1">
                      ফেসবুক স্টাইলে পোস্ট ও লাভ
                    </p>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-amber-200/80 flex items-center justify-between w-full text-[8.5px] sm:text-[10px] font-black text-amber-900">
                    <span>পোস্ট ম্যানেজার →</span>
                  </div>
                </button>

              </div>

            </div>

          </div>
        )}

        {/* VIEW B: MEMBERSHIP APPLICATIONS */}
        {activeSubView === 'membership' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-6 animate-fade-in">
            <div className="border-b border-slate-150 pb-4 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  ইনভেস্টর সদস্যপদ সক্রিয়করণ আবেদন তালিকা ({pendingMembersCount})
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">সদস্যপদের জন্য প্রেরিত এবং যাচাইকরণাধীন পেন্ডিং আবেদনপত্রের পুর্নাঙ্গ প্রোফাইল</p>
              </div>
              <button
                onClick={() => setActiveSubView('main')}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                ← কন্ট্রোল সেন্টারে যান
              </button>
            </div>

            {pendingMembersCount === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2.5xl border border-slate-100">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-bold text-xs">নতুন কোনো সদস্যপদ আবেদন পেন্ডিং নেই।</p>
                <p className="text-[10px] text-slate-400 mt-0.5">সব মেম্বার ভেরিফিকেশন ইতিমধ্যে সম্পূর্ণ করা হয়েছে।</p>
              </div>
            ) : (
              <div className="space-y-5">
                {pendingMembers.map((u, idx) => (
                  <div key={`${u.uid}-${idx}`} className="bg-slate-50 border border-slate-150 p-5 rounded-2.5xl flex flex-col xl:flex-row xl:items-center justify-between gap-5 hover:border-slate-350 transition duration-150">
                    <div className="space-y-3 text-left flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-extrabold bg-emerald-100 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full uppercase leading-none">
                          সদস্যপদ আবেদন
                        </span>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-850">{u.name}</h4>
                        <span className="text-[10px] text-slate-500 font-mono font-bold">({u.memberId || 'আইডি প্রস্তুত করা হবে'})</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-[11px] font-sans text-slate-650 border-t border-slate-100 pt-3">
                        <div>মোবাইল নং: <span className="text-slate-800 font-mono font-bold">{u.phone}</span></div>
                        <div>জাতীয় পরিচয়পত্র/পাসপোর্ট: <span className="text-indigo-600 font-mono font-bold">{u.nid || 'প্রদান করা হয়নি'}</span></div>
                        <div>দেশ: <span className="text-slate-800 font-bold">{u.country || 'Bangladesh'}</span></div>
                        <div>বিভাগ: <span className="text-slate-850 font-semibold">{u.division || 'প্রদান করা হয়নি'}</span></div>
                        <div>জেলা: <span className="text-slate-850 font-semibold">{u.district || 'প্রদান করা হয়নি'}</span></div>
                        <div>থানা / উপজেলা: <span className="text-slate-850 font-semibold">{u.thana || 'প্রদান করা হয়নি'}</span></div>
                        <div>পোস্ট অফিস / গ্রাম: <span className="text-slate-850 font-semibold">{u.postOffice || 'প্রদান করা হয়নি'}</span></div>
                        <div>জন্ম তারিখ: <span className="text-slate-800 font-mono">{u.dob || 'প্রদান করা হয়নি'}</span></div>
                        <div>মাসিক সঞ্চয় লক্ষ্যঃ <span className="text-emerald-600 font-black font-mono">৳ {u.monthlySavingsTarget || 500} BDT</span></div>
                      </div>

                      {/* Nominee details with good contrast */}
                      <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-1 text-slate-800">
                        <div className="text-[9.5px] text-slate-500 font-extrabold uppercase tracking-wide">নমিনি সংক্রান্ত তথ্য (Nominee Details):</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10.5px]">
                          <div>নমিনির নাম: <span className="text-slate-900 font-bold">{u.nomineeName || 'N/A'}</span></div>
                          <div>সম্পর্ক: <span className="text-slate-800 font-semibold">{u.nomineeRelation || 'N/A'}</span></div>
                          <div>নমিনি যোগাযোগ নং: <span className="text-slate-900 font-mono font-bold">{u.nomineePhone || 'N/A'}</span></div>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono">আবেদনের সময়সূচীঃ {u.samityAppliedAt ? new Date(u.samityAppliedAt).toLocaleString('bn-BD') : 'তথ্য পাওয়া হয়নি'}</div>
                    </div>

                    <div className="flex sm:flex-row xl:flex-col gap-2 shrink-0 sm:w-full xl:w-40 border-t sm:border-t-0 xl:border-t-0 border-slate-200 pt-4 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleApproveSamityMember(u)}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-sans transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-3xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        অনুমোদন দিন
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectSamityMember(u)}
                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold font-sans transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-3xs"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        আবেদন বাতিল
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW C: TRANSACTIONS & INSTALLMENTS APPROVAL */}
        {activeSubView === 'transactions' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-6 animate-fade-in">
            <div className="border-b border-slate-150 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
                  ইনভেস্টর কিস্তি ও লোন পেমেন্ট অনুমোদন হাব ({pendingTxsCount})
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">সম্মানিত ইনভেস্টরদের প্রেরিত পেমেন্ট প্রুফ ও সঞ্চয় উইথড্রয়াল ভেরিফিকেশন তালিকা</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveSubView('main')}
                  className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  ← কন্ট্রোল সেন্টার
                </button>
              </div>
            </div>

            {/* Micro Filters for transactions within the view */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
              <button
                onClick={() => setTxFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap border ${txFilterType === 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
              >
                সব ({pendingSamityTxs.length})
              </button>
              <button
                onClick={() => setTxFilterType('deposit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap border ${txFilterType === 'deposit' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
              >
                কিস্তি জমা ({pendingSamityTxs.filter(t => t.type === 'deposit' || t.type === 'coop_savings_deposit').length})
              </button>
              <button
                onClick={() => setTxFilterType('withdraw')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap border ${txFilterType === 'withdraw' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
              >
                উত্তোলন আবেদন ({pendingSamityTxs.filter(t => t.type === 'withdraw').length})
              </button>
            </div>

            {/* Filter implementation */}
            {(() => {
              const filteredList = sortTransactionsNewestFirst(pendingSamityTxs.filter(tx => {
                if (txFilterType === 'deposit') return tx.type === 'deposit' || tx.type === 'coop_savings_deposit';
                if (txFilterType === 'withdraw') return tx.type === 'withdraw';
                return true;
              }));

              if (filteredList.length === 0) {
                return (
                  <div className="text-center py-14 bg-slate-50 rounded-2.5xl border border-slate-100">
                    <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-xs font-bold italic">এই ক্যাটাগরিতে কোনো পেন্ডিং লেনদেন পাওয়া যায়নি।</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {filteredList.map((tx, idx) => (
                    <div key={`${tx.id}-${idx}`} className="bg-slate-50 border border-slate-150 p-4.5 rounded-2.5xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2 text-left flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                            tx.type === 'withdraw' ? 'bg-rose-50 border-rose-100 text-rose-700' : 
                            tx.type === 'deposit' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-sky-50 border-sky-100 text-sky-700'
                          }`}>
                            {tx.typeLabel || 'সমবায় লেনদেন'}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900">{tx.userName}</h4>
                          <span className="text-[10px] text-slate-500 font-mono font-bold">({tx.memberId || 'N/A'})</span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1">{tx.description}</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[10.5px] font-sans text-slate-600 border-t border-slate-100/60 pt-2 mt-1">
                          <div>পরিশোধ মাধ্যমঃ <strong className="text-slate-800">{tx.paymentMethod || 'Wallet Balance'}</strong></div>
                          <div>মোবাইল নং / রেফারেন্সঃ <strong className="text-slate-900 font-mono">{tx.senderInfo || 'সরাসরি ওয়ালেট'}</strong></div>
                          {tx.receiptNo && <div>ট্রানজেকশন আইডিঃ <strong className="text-indigo-600 font-mono">{tx.receiptNo}</strong></div>}
                          <div>আবেদন সময়ঃ <span className="text-slate-500 font-mono">{new Date(tx.createdAt).toLocaleString('bn-BD')}</span></div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 justify-end border-t md:border-t-0 border-slate-200 pt-3 md:pt-0">
                        <div className="text-right mr-3 shrink-0">
                          <span className={`text-base font-black font-sans ${tx.type === 'withdraw' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ৳ {tx.amount.toLocaleString('bn-BD')} BDT
                          </span>
                          <p className="text-[9.5px] text-slate-400">
                            {tx.type === 'withdraw' ? 'আমানত থেকে বিয়োগ হবে' : 'আমানতে জমা হবে'}
                          </p>
                        </div>
                        
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => handleApproveTransaction(tx)}
                            className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap active:scale-95 shadow-3xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            মঞ্জুর করুন
                          </button>
                          <button
                            onClick={() => handleRejectTransaction(tx.id)}
                            className="py-1.5 px-3 bg-white hover:bg-slate-50 text-rose-600 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap active:scale-95 shadow-4xs"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            বাতিল করুন
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

          </div>
        )}

        {/* VIEW D: LOAN LEDGER & RECONCILIATION */}
        {activeSubView === 'ledger' && (
          <div className="space-y-6 animate-fade-in">
            
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <BadgeAlert className="w-4 h-4 text-indigo-500" />
                  সদস্য ঋণ খতিয়ান ও লিকুইডেশন খাতা ({membersWithLoans.length} জন)
                </h3>
                <button
                  onClick={() => setActiveSubView('main')}
                  className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  ← কন্ট্রোল সেন্টার
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left side list of borrowers */}
                <div className="lg:col-span-7 space-y-3">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-2">সক্রিয় ঋণী সদস্যদের তালিকা</span>
                  
                  <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-2">
                    {membersWithLoans.length === 0 ? (
                      <p className="text-slate-400 text-xs text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">বর্তমানে বকেয়া সমবায় লোন রানিং নেই।</p>
                    ) : (
                      membersWithLoans.map((u, idx) => (
                        <div key={`${u.uid}-${idx}`} className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-300 transition shadow-4xs">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-extrabold text-slate-850">{u.name}</span>
                              <span className="text-[9px] bg-indigo-50 text-indigo-700 font-mono px-2 py-0.5 rounded font-bold border border-indigo-100">{u.memberId || u.phone}</span>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[10.5px] text-slate-600">
                              <div>সমিতি বকেয়াঃ <strong className="text-rose-600 font-mono">৳{(u.dueLoan || 0).toLocaleString('bn-BD')}</strong></div>
                              <div className="sm:col-span-2 text-[9px] text-slate-450 mt-0.5">মোবাইলঃ {u.phone}</div>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setReconUserUid(u.uid);
                              setReconAction('repay_loan_cash');
                            }}
                            className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 text-emerald-700 hover:text-emerald-800 rounded-xl text-[10.5px] font-black transition shrink-0 cursor-pointer shadow-4xs"
                          >
                            💸 পেমেন্ট এন্ট্রি
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right side manual reconciliation entry form */}
                <div className="lg:col-span-5 bg-slate-50/50 border border-slate-150 p-5 rounded-2.5xl">
                  <div className="border-b border-slate-200 pb-3 mb-4 text-left">
                    <h4 className="text-xs font-black text-slate-900">
                      🏢 ম্যানুয়াল সমন্বয় ও অফলাইন ক্যাশ পোর্টাল
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">অফলাইন ক্যাশ আদায়, ফেরত বা সঞ্চয় ব্যালেন্স ম্যানুয়ালি এন্ট্রি করার মেথড</p>
                  </div>

                  <form onSubmit={handleReconciliationSubmit} className="space-y-4">
                    {reconSuccess && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl font-bold font-sans">
                        ✅ {reconSuccess}
                      </div>
                    )}
                    {reconError && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-bold font-sans">
                        ⚠️ {reconError}
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">1. সমবায় মেম্বার নির্বাচন</label>
                      <select
                        value={reconUserUid}
                        onChange={(e) => setReconUserUid(e.target.value)}
                        className="block w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-400"
                        required
                      >
                        <option value="">-- সদস্য সিলেক্ট করুন --</option>
                        {users.map((u, idx) => (
                          <option key={`${u.uid}-${idx}`} value={u.uid}>{u.name} ({u.memberId || u.phone})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">2. সমন্বয়ের খাত</label>
                      <select
                        value={reconAction}
                        onChange={(e) => setReconAction(e.target.value as any)}
                        className="block w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-400"
                        required
                      >
                        <option value="transfer_main_to_savings">⚡ মেইন ব্যালেন্স কেটে সমিতি সঞ্চয়ে স্থানান্তর (Transfer Main to Savings)</option>
                        <option value="deduct_main_balance">🔻 মেইন ব্যালেন্স বিয়োগ/কর্তন (Deduct Main Balance)</option>
                        <option value="add_main_balance">🔺 মেইন ব্যালেন্স যোগ/বৃদ্ধি (Add Main Balance)</option>
                        <option value="add_savings">💰 সঞ্চয় জমা বৃদ্ধি করুন (Deposit to Savings)</option>
                        <option value="reduce_savings">💸 সঞ্চয় ব্যালেন্স বিয়োগ করুন (Adjustment/Withdrawal)</option>
                        <option value="add_dps">🏦 ডিপিেস ব্যালেন্স জমা/বৃদ্ধি (Deposit to DPS)</option>
                        <option value="reduce_dps">📉 ডিপিএস ব্যালেন্স বিয়োগ/সমন্বয় (Adjust DPS Balance)</option>
                        <option value="add_profits">📈 লভ্যাংশ বণ্টন জমা (Distribute Profit)</option>
                        <option value="reduce_profits">📉 লভ্যাংশ উত্তোলন সমন্বয় (Adjust Profit Balance)</option>
                        <option value="disburse_loan">📈 সমবায় নতুন লোন প্রদান (Disburse Co-op Loan)</option>
                        <option value="repay_loan_cash">📉 সমবায় লোন কিস্তি বা বকেয়া আদায় (Repay Co-op Loan)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">3. সমন্বয়ের পরিমাণ (৳ BDT)</label>
                        <input
                          type="number"
                          required
                          value={reconAmount}
                          onChange={(e) => setReconAmount(e.target.value)}
                          placeholder="৳ টাকার পরিমাণ"
                          className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-emerald-700 font-mono focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">4. রশিদ নম্বর বা ইন্টারনাল রেফারেন্স</label>
                        <input
                          type="text"
                          value={reconNotes}
                          onChange={(e) => setReconNotes(e.target.value)}
                          placeholder="উদাঃ রশিদ বই নং 3, ক্যাশ কাউন্টার"
                          className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-400 placeholder-slate-400 font-medium"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-100"
                    >
                      <Coins className="w-4 h-4" />
                      ম্যানুয়াল খাতা এন্ট্রি সম্পন্ন করুন
                    </button>
                  </form>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* VIEW E: POLICY & NOTICES SETTINGS */}
        {activeSubView === 'notices' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-6 animate-fade-in">
            <div className="border-b border-slate-150 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-purple-500" />
                  ইনভেস্টর লাইভ নোটিশ এবং সদস্যপদের নীতিমালা এডিটর
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">সদস্যদের স্ক্রিনে প্রদর্শিত স্ক্রোলিং নোটিশ ঘোষণা এবং রেজিষ্ট্রেশন ফি এর নির্দেশিকা</p>
              </div>
              <button
                onClick={() => setActiveSubView('main')}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                ← কন্ট্রোল সেন্টার
              </button>
            </div>

            <div className="space-y-5">
              
              {settingsSaveSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 text-xs p-3 rounded-xl font-bold">
                  ✅ পলিসি সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে!
                </div>
              )}
              {settingsSaveError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-bold">
                  ⚠️ {settingsSaveError}
                </div>
              )}

              {/* Notice declaration input */}
              <div className="space-y-2 text-left">
                <label className="block text-xs font-black text-slate-700">🏢 1. ইনভেস্টর সেকশন লাইভ ঘোষণা (Scrolling Notice Ticker)</label>
                <textarea
                  rows={3}
                  value={tickerText}
                  onChange={(e) => setTickerText(e.target.value)}
                  placeholder="ইনভেস্টরদের জন্য আকর্ষণীয় ঘোষণা বা জরুরি নির্দেশনা এখানে লিখুন যা স্ক্রোল আকারে ভাসবে..."
                  className="block w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-indigo-400"
                />
                <p className="text-[10px] text-slate-400">এই নোটিশটি সরাসরি কো-অপারেটিভ ইনভেস্টর খাতার হোম স্লাইডারের নিচে টিল্ট আকারে অনবরত স্ক্রোল হবে।</p>
              </div>

              {/* Terms declaration input */}
              <div className="space-y-2 text-left">
                <label className="block text-xs font-black text-slate-700">📋 2. নতুন সদস্যপদ আবেদনের শর্তাবলী ও গাইডলাইন (Membership Terms)</label>
                <textarea
                  rows={4}
                  value={termsText}
                  onChange={(e) => setTermsText(e.target.value)}
                  placeholder="মেম্বারশিপ সক্রিয় করতে কত টাকা ফি জমা দিতে হবে এবং কিভাবে কন্টাক্ট করবে তার বিস্তারিত..."
                  className="block w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-indigo-400"
                />
                <p className="text-[10px] text-slate-400">নতুন ইউজার যখন প্রথমবার সদস্যপদের জন্য আবেদন করতে যাবে, তখন তারা আবেদনের ফর্মের শীর্ষে এই নীতিমালা দেখতে পাবে।</p>
              </div>

              <button
                onClick={handleUpdateSamityConfig}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-md shadow-purple-100 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                ঘোষণা ও নীতিমালা পরিবর্তন সংরক্ষণ করুন
              </button>

            </div>

          </div>
        )}

        {/* VIEW F: SLIDER BANNER CONFIG */}
        {activeSubView === 'banners' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-6 animate-fade-in">
            <div className="border-b border-slate-150 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-pink-500" />
                  ইনভেস্টর হোম স্লাইডার ব্যানার এডিটর পোর্টাল
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">সম্মানিত গ্রাহকদের স্ক্রিনে প্রদর্শিত ব্যানার স্লাইডার সমূহ নিয়ন্ত্রণ করুন</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (window.confirm('আপনি কি নিশ্চিত যে সমস্ত ব্যানার স্লাইড ডিফল্ট স্লাইডে রিসেট করতে চান?')) {
                      handleSaveBannersConfig([]);
                    }
                  }}
                  className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  ডিফল্ট রিসেট
                </button>
                <button
                  onClick={() => setActiveSubView('main')}
                  className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  ← কন্ট্রোল সেন্টার
                </button>
              </div>
            </div>

            <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
                <h3 className="text-xs font-black uppercase text-pink-600 tracking-wider flex items-center gap-2">
                  🏢 স্লাইডার কভার ব্যানার সমূহ
                  {dbSamityBanners.length === 0 && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-[8.5px] border border-indigo-100 text-indigo-600 rounded-md font-bold lowercase">
                      (ডিফল্ট স্লাইডার সক্রিয়)
                    </span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const newId = currentBanners.length > 0 ? Math.max(...currentBanners.map((b: any) => b.id)) + 1 : 1;
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
                    handleSaveBannersConfig(list);
                  }}
                  className="px-3.5 py-1.5 bg-pink-600/10 hover:bg-pink-600/20 border border-pink-200/50 text-pink-700 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  নতুন ব্যানার স্লাইড যোগ করুন
                </button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {currentBanners.map((slider: any, idx: number) => {
                  
                  const updateFieldLocal = (field: string, val: any) => {
                    const list = [...currentBanners];
                    list[idx] = { ...list[idx], [field]: val };
                    handleSaveBannersConfig(list);
                  };

                  const deleteSlideLocal = () => {
                    if (window.confirm('আপনি কি নিশ্চিত যে এই স্লাইডটি মুছে ফেলতে চান?')) {
                      const list = currentBanners.filter((_: any, i: number) => i !== idx);
                      handleSaveBannersConfig(list);
                    }
                  };

                  return (
                    <div key={idx} className="bg-slate-50 border border-slate-150 hover:border-slate-300 p-4 rounded-2.5xl space-y-4 relative flex flex-col justify-between shadow-4xs">
                      
                      <div className="flex justify-between items-center text-xs font-semibold pb-2 border-b border-slate-200">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                          ব্যানার স্লাইড #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={deleteSlideLocal}
                          className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-650 text-[10px] font-black rounded-md transition-colors cursor-pointer"
                        >
                          স্লাইড মুছুন
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">স্লাইড ট্যাগ (Badge Tag)</label>
                            <input
                              type="text"
                              value={slider.tag}
                              onChange={(e) => updateFieldLocal('tag', e.target.value)}
                              className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">স্লাইড টাইটেল (Title Text)</label>
                            <input
                              type="text"
                              value={slider.title}
                              onChange={(e) => updateFieldLocal('title', e.target.value)}
                              className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">ব্যাকগ্রাউন্ড গ্রাডিয়েন্ট (Tailwind Classes)</label>
                            <input
                              type="text"
                              value={slider.bgGradient}
                              onChange={(e) => updateFieldLocal('bgGradient', e.target.value)}
                              className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800 focus:outline-none"
                            />
                          </div>

                        </div>

                        <div className="space-y-3">
                          
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">সংক্ষিপ্ত বিবরণ (Description)</label>
                            <textarea
                              rows={2}
                              value={slider.description}
                              onChange={(e) => updateFieldLocal('description', e.target.value)}
                              className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">ব্যানার ফটো ইউআরএল (Image Link)</label>
                            <input
                              type="text"
                              value={slider.image}
                              onChange={(e) => updateFieldLocal('image', e.target.value)}
                              className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none"
                            />
                          </div>

                          {/* Base64 upload for slides */}
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">সরাসরি ব্যানার ফটো আপলোড</label>
                            <label className="block w-full px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-center text-[11px] font-bold rounded-lg cursor-pointer transition">
                              📁 গ্যালারি থেকে ছবি সিলেক্ট করুন
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleLocalFileChange(e, (base64) => updateFieldLocal('image', base64))}
                                className="hidden"
                              />
                            </label>
                          </div>

                        </div>
                      </div>

                      {/* Realtime visual preview card */}
                      <div className="mt-3 bg-white p-3 border border-slate-250/60 rounded-xl space-y-2">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">লাইভ ব্যানার প্রিভিউঃ</span>
                        <div className={`rounded-xl p-3.5 bg-gradient-to-r ${slider.bgGradient} text-white flex justify-between items-center overflow-hidden min-h-[85px] relative`}>
                          <div className="space-y-1 relative z-10 max-w-[65%] text-left">
                            <span className="inline-block bg-white/20 text-white font-extrabold text-[8.5px] px-1.5 py-0.5 rounded uppercase">
                              {slider.tag}
                            </span>
                            <h4 className="text-[11px] font-bold tracking-tight leading-tight line-clamp-1">{slider.title}</h4>
                            <p className="text-[9px] text-slate-200 font-medium line-clamp-2 leading-relaxed">{slider.description}</p>
                          </div>
                          {slider.image && (
                            <div className="absolute top-0 right-0 h-full w-[35%] overflow-hidden flex items-center justify-center">
                              <img src={slider.image} alt={slider.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-transparent to-transparent opacity-80" />
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        )}

        {/* VIEW G: MEMBER MANAGEMENT & EDIT/DELETE DIRECTORY */}
        {activeSubView === 'members' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-6 animate-fade-in">
            <div className="border-b border-slate-150 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse" />
                  সমবায় নিবন্ধিত সদস্য ডাটাবেজ ({users.length} জন)
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  সকল নিবন্ধিত সদস্যের তথ্য সরাসরি দেখুন, এনআইডি/মোবাইল এডিট করুন অথবা অ্যাকাউন্ট মুছুন
                </p>
              </div>
              <button
                onClick={() => setActiveSubView('main')}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl transition cursor-pointer self-start sm:self-auto"
              >
                ← কন্ট্রোল সেন্টারে যান
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="সদস্যের নাম, মোবাইল নাম্বার বা মেম্বার আইডি দিয়ে খুঁজুন..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                onFocus={(e) => {
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 250);
                }}
                className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
              />
              {memberSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMemberSearchQuery('')}
                  className="absolute right-3 top-2.5 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title="সার্চ মুছুন"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Members List Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-96 sm:pb-[480px]">
              {users
                .filter(u => 
                  u.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                  u.phone.includes(memberSearchQuery) ||
                  (u.memberId && u.memberId.includes(memberSearchQuery))
                )
                .map((member, idx) => (
                  <div key={`${member.uid}-${idx}`} className="bg-slate-50/80 border border-slate-200 rounded-2.5xl p-4.5 space-y-3 hover:border-indigo-300 transition shadow-3xs">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500 text-white rounded-2xl font-black flex items-center justify-center text-sm shadow-sm">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            {member.name}
                            <span className="text-[9px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-extrabold">
                              ID: {member.memberId || member.uid.substring(0,6)}
                            </span>
                          </h4>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">📞 {member.phone}</p>
                          {member.nid && (
                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">🪪 NID: {member.nid}</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[9.5px] font-extrabold px-2.5 py-1 rounded-full border ${
                        member.samityStatus === 'approved' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {member.samityStatus === 'approved' ? '✓ অনুমোদিত সদস্য' : '⏳ পেন্ডিং আবেদন'}
                      </span>
                    </div>

                    {/* Member Balances */}
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200/80 text-center">
                      <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                        <span className="text-[8.5px] text-slate-400 font-extrabold uppercase block">সঞ্চয়</span>
                        <span className="text-[11px] font-black text-emerald-600">৳{(member.savings || 0).toLocaleString('bn-BD')}</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                        <span className="text-[8.5px] text-slate-400 font-extrabold uppercase block">ডিপিএস</span>
                        <span className="text-[11px] font-black text-sky-600">৳{(member.dpsBalance || 0).toLocaleString('bn-BD')}</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                        <span className="text-[8.5px] text-slate-400 font-extrabold uppercase block">লভ্যাংশ</span>
                        <span className="text-[11px] font-black text-indigo-600">৳{(member.profitsBalance || 0).toLocaleString('bn-BD')}</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                        <span className="text-[8.5px] text-slate-400 font-extrabold uppercase block">লোন</span>
                        <span className="text-[11px] font-black text-rose-600">৳{(member.dueLoan || 0).toLocaleString('bn-BD')}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 flex-wrap">
                      <button
                        onClick={() => {
                          setCollectionSearchQuery(member.name);
                          setActiveSubView('monthly_collection');
                        }}
                        className="flex items-center gap-1 text-[10.5px] font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                        title="এই সদস্যের 12 মাসের কিস্তি খতিয়ান ও কালেকশন খুলুন"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        12 মাস সঞ্চয় খতিয়ান
                      </button>
                      <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingMember({ ...member })}
                        className="flex items-center gap-1 text-[10.5px] font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        তথ্য এডিট করুন
                      </button>
                      <button
                        onClick={() => handleDeleteMemberProfile(member.uid, member.name)}
                        className="flex items-center gap-1 text-[10.5px] font-extrabold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        ডিলিট করুন
                      </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Member Edit Modal */}
            {editingMember && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-slate-150 pb-3">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      ✏️ সদস্যের প্রোফাইল এডিট ({editingMember.name})
                    </h3>
                    <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer">✕</button>
                  </div>

                  {memberSaveSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
                      ✓ {memberSaveSuccess}
                    </div>
                  )}

                  {memberSaveError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-bold">
                      ⚠ {memberSaveError}
                    </div>
                  )}

                  <form onSubmit={handleSaveMemberProfile} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">পূর্ণ নাম</label>
                      <input
                        type="text"
                        value={editingMember.name}
                        onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">মোবাইল নাম্বার</label>
                      <input
                        type="text"
                        value={editingMember.phone}
                        onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">এনআইডি (NID) নাম্বার</label>
                      <input
                        type="text"
                        value={editingMember.nid || ''}
                        onChange={(e) => setEditingMember({ ...editingMember, nid: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">সঞ্চয় স্থিতি (৳)</label>
                        <input
                          type="number"
                          value={editingMember.savings || 0}
                          onChange={(e) => setEditingMember({ ...editingMember, savings: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">ডিপিএস স্থিতি (৳)</label>
                        <input
                          type="number"
                          value={editingMember.dpsBalance || 0}
                          onChange={(e) => setEditingMember({ ...editingMember, dpsBalance: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">লভ্যাংশ স্থিতি (৳)</label>
                        <input
                          type="number"
                          value={editingMember.profitsBalance || 0}
                          onChange={(e) => setEditingMember({ ...editingMember, profitsBalance: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">বকেয়া লোন (৳)</label>
                        <input
                          type="number"
                          value={editingMember.dueLoan || 0}
                          onChange={(e) => setEditingMember({ ...editingMember, dueLoan: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Monthly Savings Target */}
                    <div className="bg-teal-50/80 border border-teal-200/90 rounded-2xl p-3 space-y-1.5">
                      <label className="block text-[11px] font-black text-teal-950">
                        💰 মাসিক সঞ্চয় কিস্তি লক্ষ্য (Monthly Target BDT)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="100"
                          step="100"
                          value={editingMember.monthlySavingsTarget || 1000}
                          onChange={(e) => setEditingMember({ ...editingMember, monthlySavingsTarget: Number(e.target.value) || 1000 })}
                          className="w-full px-3 py-2 bg-white border border-teal-300 rounded-xl text-xs font-black text-teal-950 font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                          placeholder="উদাঃ 500, 1000, 2000, 3000, 5000"
                        />
                        <span className="text-xs font-bold text-teal-800 shrink-0">টাকা/মাস</span>
                      </div>
                    </div>

                    {/* Samity Membership Status Selector */}
                    <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3 space-y-1.5">
                      <label className="block text-[11px] font-black text-emerald-950">
                        🛡️ সমিতি সদস্যপদ অনুমোদন স্ট্যাটাস (Samity Status)
                      </label>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-emerald-900 font-bold">
                          সদস্যের মেম্বারশিপ অনুমোদন অবস্থা নির্বাচন করুনঃ
                        </span>
                        <select
                          value={editingMember.samityStatus || 'approved'}
                          onChange={(e) => {
                            const val = e.target.value as 'none' | 'pending' | 'approved' | 'rejected';
                            setEditingMember({
                              ...editingMember,
                              samityStatus: val
                            });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black border focus:outline-none cursor-pointer ${
                            (editingMember.samityStatus || 'approved') === 'approved'
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : editingMember.samityStatus === 'pending'
                              ? 'bg-amber-600 text-white border-amber-700'
                              : editingMember.samityStatus === 'rejected'
                              ? 'bg-rose-600 text-white border-rose-700'
                              : 'bg-slate-600 text-white border-slate-700'
                          }`}
                        >
                          <option value="approved" className="bg-white text-slate-800">✓ অনুমোদিত সদস্য (Approved)</option>
                          <option value="pending" className="bg-white text-slate-800">⏳ পেন্ডিং আবেদন (Pending)</option>
                          <option value="rejected" className="bg-white text-slate-800">❌ আবেদন বাতিল (Rejected)</option>
                          <option value="none" className="bg-white text-slate-800">🚫 কোনো আবেদন নেই (None)</option>
                        </select>
                      </div>
                    </div>

                    {/* Auto Savings Disable Admin Permission Toggle */}
                    <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3 space-y-1.5">
                      <label className="block text-[11px] font-black text-amber-950">
                        ⚡ অটো সঞ্চয় অফ করার অনুমতি (Admin Permission)
                      </label>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-amber-900 font-bold">
                          সদস্য কি নিজ অ্যাপ থেকে অটো সঞ্চয় সুইচ বন্ধ (OFF) করতে পারবে?
                        </span>
                        <select
                          value={editingMember.canDisableAutoSavings || editingMember.allowAutoSavingsToggle ? 'true' : 'false'}
                          onChange={(e) => {
                            const val = e.target.value === 'true';
                            setEditingMember({
                              ...editingMember,
                              canDisableAutoSavings: val,
                              allowAutoSavingsToggle: val
                            });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black border focus:outline-none cursor-pointer ${
                            editingMember.canDisableAutoSavings || editingMember.allowAutoSavingsToggle
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-rose-600 text-white border-rose-700'
                          }`}
                        >
                          <option value="false" className="bg-white text-slate-800">🔒 অনুমতি নেই (বন্ধ করা যাবে না)</option>
                          <option value="true" className="bg-white text-slate-800">🔓 অনুমতি দিন (অফ করা যাবে)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                      <button
                        type="button"
                        onClick={() => setEditingMember(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingMember}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                      >
                        {isSavingMember ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

          </div>
        )}

        {/* VIEW G: BNB INVESTOR RULES & POLICY CUSTOMIZER */}
        {activeSubView === 'policy_rules' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-6 animate-fade-in">
            <div className="border-b border-slate-150 pb-4 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  BNB ইনভেস্টার নিয়মকানুন ও জরিমানা কাস্টমাইজেশন
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  সদস্যদের ইউজার ড্যাশবোর্ডে প্রদর্শিত সমস্ত নিয়মাবলী, কিস্তি পলিসি এবং বিলম্ব জরিমানা স্কেল রিয়েল-টাইমে ডায়নামিক পরিবর্তন করুন।
                </p>
              </div>
              <button
                onClick={() => setActiveSubView('main')}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0"
              >
                ← কন্ট্রোল সেন্টারে যান
              </button>
            </div>

            {policySaveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
                <Check className="w-4 h-4 text-emerald-600" />
                BNB ইনভেস্টার নীতি ও জরিমানা স্কেল সফলভাবে আপডেট করা হয়েছে!
              </div>
            )}

            {policySaveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                {policySaveError}
              </div>
            )}

            <form onSubmit={handleSavePolicyConfig} className="space-y-6">
              
              {/* 1. Main Titles & Notices */}
              <div className="bg-slate-50/80 border border-slate-200 p-4.5 rounded-2.5xl space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-teal-600" />
                  1. ইনভেস্টার নীতিমালার সাধারণ হেডার ও নোটিশ
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">পলিসি মূল শিরোনাম</label>
                    <input
                      type="text"
                      value={policyConfig.policyTitle || ''}
                      onChange={(e) => setPolicyConfig({ ...policyConfig, policyTitle: e.target.value })}
                      placeholder="যেমন: মাসিক বিনিয়োগ ও নীতিমালা"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">পলিসি উপ-শিরোনাম (পেমেন্ট মেয়াদ)</label>
                    <input
                      type="text"
                      value={policyConfig.policySubTitle || ''}
                      onChange={(e) => setPolicyConfig({ ...policyConfig, policySubTitle: e.target.value })}
                      placeholder="যেমন: 1ম থেকে 25শে অক্টোবর পেমেন্ট সিস্টেম ও বিলম্ব চার্জসমূহ"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">অটো-ডেবিট স্কিম নোটিশ</label>
                  <textarea
                    rows={2}
                    value={policyConfig.schemeStatusNote || ''}
                    onChange={(e) => setPolicyConfig({ ...policyConfig, schemeStatusNote: e.target.value })}
                    placeholder="আপনার একাউন্ট থেকে প্রতি মাসের 1 থেকে 9 তারিখের মধ্যে স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্স থেকে কিস্তি অটো-ডেবিট করা হবে।"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* 2. Fixed Investment Amount Section Config */}
              <div className="bg-slate-50/80 border border-slate-200 p-4.5 rounded-2.5xl space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <PiggyBank className="w-4 h-4 text-emerald-600" />
                  2. নির্ধারিত মাসিক বিনিয়োগ সেকশন কনফিগারেশন
                </h4>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">সেকশন 1 শিরোনাম</label>
                  <input
                    type="text"
                    value={policyConfig.fixedAmountTitle || ''}
                    onChange={(e) => setPolicyConfig({ ...policyConfig, fixedAmountTitle: e.target.value })}
                    placeholder="1. নির্ধারিত মাসিক বিনিয়োগের পরিমাণ"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">কিস্তির পরিমাণ সংক্রান্ত তথ্য নির্দেশিকা (Locked Notice)</label>
                  <textarea
                    rows={2}
                    value={policyConfig.fixedAmountNote || ''}
                    onChange={(e) => setPolicyConfig({ ...policyConfig, fixedAmountNote: e.target.value })}
                    placeholder="💡 অ্যাকাউন্ট খোলার সময় আপনার নির্বাচিত এই কিস্তির পরিমাণ স্থায়ী। এটি সাধারণ ব্যবহারকারী নিজে পরিবর্তন করতে পারবেন না..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* 3. Dynamic Penalty Tiers Editor */}
              <div className="bg-slate-50/80 border border-slate-200 p-4.5 rounded-2.5xl space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <BadgeAlert className="w-4 h-4 text-rose-600" />
                    3. বিলম্ব পেমেন্ট ও জরিমানা স্কেলসমূহ
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const newTier: SamityFineTier = {
                        id: 'tier-' + Date.now(),
                        fromDay: 10,
                        toDay: 15,
                        rangeLabel: '10 থেকে 15 তারিখঃ',
                        fineText: '৳ 10 জরিমানা',
                        fineAmount: 10,
                        bgClass: 'bg-amber-50/40 border-amber-100 text-amber-800'
                      };
                      setPolicyConfig({
                        ...policyConfig,
                        penaltyTiers: [...(policyConfig.penaltyTiers || []), newTier]
                      });
                    }}
                    className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-[10.5px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    নতুন জরিমানা ধাপ যোগ করুন
                  </button>
                </div>

                {/* 🗓️ 12 মাসের বিলম্ব জরিমানা ক্যালেন্ডার ও ছাড় ব্যবস্থাপনা (12-Month Penalty Waiver Calendar Manager) */}
                <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white rounded-2xl border-2 border-amber-400/40 shadow-md space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🗓️</span>
                      <div>
                        <h4 className="text-sm font-black text-amber-300">
                          12 মাসের বিলম্ব জরিমানা নিয়ন্ত্রণ ক্যালেন্ডার ও ছাড় পাওয়ার ম্যানেজার
                        </h4>
                        <p className="text-[10.5px] text-teal-200">
                          1-9 তারিখ 100% ফ্রি (৳0 জরিমানা)। এডমিন নির্দিষ্ট মাসে সুইচ অফ/স্থগিত করলে ওই মাসে মেম্বারদের জরিমানা আসবে না।
                        </p>
                      </div>
                    </div>

                    {/* Year Selector */}
                    <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/20">
                      {[2025, 2026, 2027, 2028].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setSelectedAdminPenaltyYear(yr)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                            selectedAdminPenaltyYear === yr
                              ? 'bg-amber-400 text-slate-950 shadow-xs'
                              : 'text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4-Step Visual Flowchart */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-left">
                    <div className="bg-white/10 border border-white/15 p-2.5 rounded-xl">
                      <div className="text-emerald-400 font-black text-xs flex items-center gap-1.5 mb-0.5">
                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black flex items-center justify-center">1</span>
                        <span>1-9 তারিখ</span>
                      </div>
                      <p className="text-[10px] text-slate-200">সকলের জন্য ৳0 জরিমানা (ফ্রি গ্রেস পিরিয়ড)।</p>
                    </div>
                    <div className="bg-white/10 border border-white/15 p-2.5 rounded-xl">
                      <div className="text-amber-400 font-black text-xs flex items-center gap-1.5 mb-0.5">
                        <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">2</span>
                        <span>10 তারিখ থেকে</span>
                      </div>
                      <p className="text-[10px] text-slate-200">কিস্তি না দিলে স্বয়ংক্রিয় বিলম্ব জরিমানা যোগ হবে।</p>
                    </div>
                    <div className="bg-amber-400/20 border border-amber-400/50 p-2.5 rounded-xl">
                      <div className="text-amber-300 font-black text-xs flex items-center gap-1.5 mb-0.5">
                        <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">3</span>
                        <span>এডমিন স্থগিত সুইচ</span>
                      </div>
                      <p className="text-[10px] text-amber-100">9 তারিখের মধ্যে সুইচ অফ করলে ওই মাসে ৳0 জরিমানা।</p>
                    </div>
                    <div className="bg-white/10 border border-white/15 p-2.5 rounded-xl">
                      <div className="text-sky-400 font-black text-xs flex items-center gap-1.5 mb-0.5">
                        <span className="w-4 h-4 rounded-full bg-sky-400 text-slate-950 text-[10px] font-black flex items-center justify-center">4</span>
                        <span>পরের মাসে স্বয়ংক্রিয়</span>
                      </div>
                      <p className="text-[10px] text-slate-200">পরের মাসে স্বয়ংক্রিয়ভাবে পুনরায় স্বাভাবিক নিয়ম চালু হবে।</p>
                    </div>
                  </div>

                  {/* 12 Months Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                    {[
                      { key: '01', name: 'জানুয়ারি', days: 31, icon: '❄️' },
                      { key: '02', name: 'ফেব্রুয়ারি', days: 28, icon: '🌸' },
                      { key: '03', name: 'মার্চ', days: 31, icon: '🌿' },
                      { key: '04', name: 'এপ্রিল', days: 30, icon: '☀️' },
                      { key: '05', name: 'মে', days: 31, icon: '🥭' },
                      { key: '06', name: 'জুন', days: 30, icon: '🌧️' },
                      { key: '07', name: 'জুলাই', days: 31, icon: '☔' },
                      { key: '08', name: 'আগস্ট', days: 31, icon: '🌾' },
                      { key: '09', name: 'সেপ্টেম্বর', days: 30, icon: '☁️' },
                      { key: '10', name: 'অক্টোবর', days: 31, icon: '🍁' },
                      { key: '11', name: 'নভেম্বর', days: 30, icon: '🌾' },
                      { key: '12', name: 'ডিসেম্বর', days: 31, icon: '⛄' },
                    ].map((m, idx) => {
                      const fullKey = `${selectedAdminPenaltyYear}-${m.key}`;
                      const now = new Date();
                      const isCurrent = selectedAdminPenaltyYear === now.getFullYear() && idx === now.getMonth();
                      const isExempt = policyConfig.exemptedMonthsConfig?.[fullKey]?.isExempted ?? (policyConfig.exemptedMonths?.[fullKey] || (isCurrent && policyConfig.pausePenaltyUntil15th));
                      const exemptDay = policyConfig.exemptedMonthsConfig?.[fullKey]?.exemptUntilDay || (isExempt ? 31 : 9);

                      return (
                        <div
                          key={m.key}
                          className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                            isExempt
                              ? 'bg-amber-500/20 border-amber-400 text-amber-100 ring-1 ring-amber-400/40'
                              : 'bg-white/10 border-white/15 text-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-black text-xs text-white flex items-center gap-1">
                                <span>{m.icon}</span>
                                <span>{m.name}</span>
                              </span>
                              {isCurrent && (
                                <span className="px-1 py-0.2 bg-amber-400 text-slate-950 font-black text-[9px] rounded">
                                  চলতি
                                </span>
                              )}
                            </div>
                            <span className="text-[9.5px] text-slate-300 block mt-0.5">
                              {isExempt ? `🛡️ জরিমানা স্থগিত (${exemptDay === 31 ? 'পুরো মাস' : `${exemptDay}ই পর্যন্ত`})` : '⚡ স্বাভাবিক নিয়ম'}
                            </span>
                          </div>

                          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between gap-1.5">
                            <select
                              value={exemptDay}
                              disabled={!isExempt}
                              onChange={(e) => {
                                const newDay = Number(e.target.value);
                                setPolicyConfig(prev => ({
                                  ...prev,
                                  exemptedMonthsConfig: {
                                    ...(prev.exemptedMonthsConfig || {}),
                                    [fullKey]: {
                                      isExempted: true,
                                      exemptUntilDay: newDay,
                                      note: `${selectedAdminPenaltyYear} সালের ${m.name} মাসে ${newDay === 31 ? 'পুরো মাস' : `${newDay}ই তারিখ পর্যন্ত`} জরিমানা স্থগিত।`
                                    }
                                  }
                                }));
                              }}
                              className="text-[10px] bg-slate-900 text-slate-100 border border-white/20 rounded px-1 py-0.5 disabled:opacity-40"
                            >
                              <option value={31}>পুরো মাস (31)</option>
                              <option value={15}>15ই পর্যন্ত</option>
                              <option value={20}>20ই পর্যন্ত</option>
                            </select>

                            {/* Mini Toggle Switch */}
                            <button
                              type="button"
                              onClick={() => {
                                const nextState = !isExempt;
                                setPolicyConfig(prev => {
                                  const updatedCfg = {
                                    ...(prev.exemptedMonthsConfig || {}),
                                    [fullKey]: {
                                      isExempted: nextState,
                                      exemptUntilDay: nextState ? 31 : 9,
                                      note: nextState ? `${selectedAdminPenaltyYear} সালের ${m.name} মাসে জরিমানা স্থগিত করা হয়েছে।` : ''
                                    }
                                  };
                                  const updatedSimple = {
                                    ...(prev.exemptedMonths || {}),
                                    [fullKey]: nextState
                                  };
                                  return {
                                    ...prev,
                                    exemptedMonths: updatedSimple,
                                    exemptedMonthsConfig: updatedCfg,
                                    ...(isCurrent ? { pausePenaltyUntil15th: nextState } : {})
                                  };
                                });
                              }}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                isExempt ? 'bg-emerald-500' : 'bg-slate-600'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                  isExempt ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 🚀 সাময়িক বিলম্ব জরিমানা স্থগিত (15 তারিখ পর্যন্ত ছাড় সুইচ) */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  policyConfig.pausePenaltyUntil15th
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-950 ring-2 ring-amber-400/20 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          🛡️ চলতি মাসের জরিমানা তাৎক্ষণিক স্থগিত সুইচ
                        </span>
                        {policyConfig.pausePenaltyUntil15th ? (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white font-black text-[10px] rounded-full animate-pulse shadow-2xs">
                            ✓ জরিমানা স্থগিত ({policyConfig.penaltyExemptionUntilDay || 15}ই পর্যন্ত ৳0 জরিমানা)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-bold text-[10px] rounded-full">
                            স্বাভাবিক নিয়ম (9 তারিখ পর্যন্ত ফ্রি)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        চলতি মাসের জরিমানা এক ক্লিকে মওকুফ বা স্থগিত রাখতে সুইচটি অন করুন।
                      </p>
                    </div>

                    {/* Toggle Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPolicyConfig(prev => ({
                          ...prev,
                          pausePenaltyUntil15th: !prev.pausePenaltyUntil15th
                        }));
                      }}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        policyConfig.pausePenaltyUntil15th ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          policyConfig.pausePenaltyUntil15th ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {policyConfig.pausePenaltyUntil15th && (
                    <div className="mt-3.5 pt-3 border-t border-amber-200/80 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-800 mb-1">
                            কত তারিখ পর্যন্ত জরিমানা স্থগিত থাকবে? (ডিফল্ট: 15)
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="31"
                            value={policyConfig.penaltyExemptionUntilDay || 15}
                            onChange={(e) => setPolicyConfig(prev => ({
                              ...prev,
                              penaltyExemptionUntilDay: Number(e.target.value) || 15
                            }))}
                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-800 mb-1">
                            মেম্বার অ্যাপে প্রদর্শিত নোটিশ মেসেজ
                          </label>
                          <input
                            type="text"
                            value={policyConfig.penaltyExemptionNote || 'অ্যাপ সম্পূর্ণ প্রস্তুতকরণ কাজের জন্য এই মাসের জরিমানা 15 তারিখ পর্যন্ত স্থগিত রাখা হলো।'}
                            onChange={(e) => setPolicyConfig(prev => ({
                              ...prev,
                              penaltyExemptionNote: e.target.value
                            }))}
                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">জরিমানা সেকশন মূল শিরোনাম</label>
                  <input
                    type="text"
                    value={policyConfig.penaltyTitle || ''}
                    onChange={(e) => setPolicyConfig({ ...policyConfig, penaltyTitle: e.target.value })}
                    placeholder="2. বিলম্ব পেমেন্ট ও জরিমানা পলিসি"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-teal-500 mb-3"
                  />
                </div>

                <div className="space-y-3">
                  {(policyConfig.penaltyTiers || []).map((tier, idx) => (
                    <div key={tier.id || idx} className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-3xs space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <span className="text-[11px] font-black text-slate-800">
                          ধাপ #{idx + 1}: {tier.rangeLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (policyConfig.penaltyTiers || []).filter((_, i) => i !== idx);
                            setPolicyConfig({ ...policyConfig, penaltyTiers: updated });
                          }}
                          className="text-rose-600 hover:text-rose-800 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> মুছে ফেলুন
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">তারিখের লেবেল</label>
                          <input
                            type="text"
                            value={tier.rangeLabel}
                            onChange={(e) => {
                              const updated = [...(policyConfig.penaltyTiers || [])];
                              updated[idx] = { ...updated[idx], rangeLabel: e.target.value };
                              setPolicyConfig({ ...policyConfig, penaltyTiers: updated });
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">জরিমানা বিবরণ</label>
                          <input
                            type="text"
                            value={tier.fineText}
                            onChange={(e) => {
                              const updated = [...(policyConfig.penaltyTiers || [])];
                              updated[idx] = { ...updated[idx], fineText: e.target.value };
                              setPolicyConfig({ ...policyConfig, penaltyTiers: updated });
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">জরিমানা টাকা (BDT)</label>
                          <input
                            type="number"
                            value={tier.fineAmount}
                            onChange={(e) => {
                              const updated = [...(policyConfig.penaltyTiers || [])];
                              updated[idx] = { ...updated[idx], fineAmount: Number(e.target.value) || 0 };
                              setPolicyConfig({ ...policyConfig, penaltyTiers: updated });
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">তারিখ সীমা (হতে - পর্যন্ত)</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={tier.fromDay}
                              onChange={(e) => {
                                const updated = [...(policyConfig.penaltyTiers || [])];
                                updated[idx] = { ...updated[idx], fromDay: Number(e.target.value) || 1 };
                                setPolicyConfig({ ...policyConfig, penaltyTiers: updated });
                              }}
                              className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                            />
                            <span className="text-slate-400 text-xs">-</span>
                            <input
                              type="number"
                              value={tier.toDay}
                              onChange={(e) => {
                                const updated = [...(policyConfig.penaltyTiers || [])];
                                updated[idx] = { ...updated[idx], toDay: Number(e.target.value) || 99 };
                                setPolicyConfig({ ...policyConfig, penaltyTiers: updated });
                              }}
                              className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id={`daily-chk-${idx}`}
                          checked={Boolean(tier.isDaily)}
                          onChange={(e) => {
                            const updated = [...(policyConfig.penaltyTiers || [])];
                            updated[idx] = { ...updated[idx], isDaily: e.target.checked };
                            setPolicyConfig({ ...policyConfig, penaltyTiers: updated });
                          }}
                          className="w-3.5 h-3.5 text-teal-600 rounded"
                        />
                        <label htmlFor={`daily-chk-${idx}`} className="text-[10.5px] font-bold text-slate-600">
                          এটি প্রতিদিনের দৈনিক জরিমানা (যেমন: 40তম দিনের পর প্রতিদিন ৳10)
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Custom Policy Rules Bullet Points */}
              <div className="bg-slate-50/80 border border-slate-200 p-4.5 rounded-2.5xl space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-600" />
                    4. ইনভেস্টার নীতিমালার অতিরিক্ত নিয়মকানুন (নিয়ম তালিকা)
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setPolicyConfig({
                        ...policyConfig,
                        customRules: [...(policyConfig.customRules || []), "নতুন ইনভেস্টার নিয়ম যুক্ত করুন..."]
                      });
                    }}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10.5px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    নতুন নিয়ম যোগ করুন
                  </button>
                </div>

                <div className="space-y-2.5">
                  {(policyConfig.customRules || []).map((ruleText, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white border border-slate-200 p-2.5 rounded-xl shadow-3xs">
                      <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <textarea
                        rows={1}
                        value={ruleText}
                        onChange={(e) => {
                          const updated = [...(policyConfig.customRules || [])];
                          updated[idx] = e.target.value;
                          setPolicyConfig({ ...policyConfig, customRules: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-transparent border-0 font-semibold text-xs text-slate-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (policyConfig.customRules || []).filter((_, i) => i !== idx);
                          setPolicyConfig({ ...policyConfig, customRules: updated });
                        }}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition shrink-0 cursor-pointer"
                        title="নিয়মটি ডিলিট করুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Footer Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingPolicy}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-teal-600/20 transition active:scale-95 cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSavingPolicy ? 'সংরক্ষণ করা হচ্ছে...' : '💾 ইনভেস্টার নীতিমালা সংরক্ষণ করুন'}
                </button>
              </div>

            </form>
          </div>
        )}


        {/* VIEW H: 12-MONTH SAVINGS COLLECTION & AUTO-DEBIT MANAGER */}
        {activeSubView === 'monthly_collection' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-3xs space-y-6 animate-fade-in text-left">
            {/* Header / Breadcrumb */}
            <div className="border-b border-slate-150 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  🗓️ 12 মাস সঞ্চয় কিস্তি আদায় ও অটো-কাটিং ম্যানেজার
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  নিবন্ধিত সদস্যদের 12 মাসের সঞ্চয় ট্র্যাক করুন, নির্দিষ্ট মাস সিলেক্ট করে মেইন ব্যালেন্স থেকে কর্তন বা ম্যানুয়াল পেইড করুন
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Year Selector */}
                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-800">বছরঃ</span>
                  <select
                    value={selectedCollectionYear}
                    onChange={(e) => setSelectedCollectionYear(Number(e.target.value))}
                    className="bg-transparent text-xs font-black text-emerald-950 focus:outline-none cursor-pointer"
                  >
                    {SAMITY_YEARS.map(yr => (
                      <option key={yr} value={yr}>{yr} সাল {yr === new Date().getFullYear() ? '(চলতি)' : ''}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setActiveSubView('main')}
                  className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                >
                  ← কন্ট্রোল সেন্টার
                </button>
              </div>
            </div>

            {/* Alert Messages */}
            {collectionSuccessMsg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{collectionSuccessMsg}</span>
              </motion.div>
            )}

            {collectionErrorMsg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{collectionErrorMsg}</span>
              </motion.div>
            )}

            {/* HERO BANNER: ONE-CLICK BULK AUTO-DEDUCTION ENGINE */}
            <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden border border-emerald-700/50">
              <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 rounded-full text-[10px] font-black uppercase tracking-wide">
                      ⚡ অটো-সঞ্চয় কালেকশন ইঞ্জিন
                    </span>
                    <span className="text-[10px] text-emerald-300 font-mono">
                      {selectedCollectionYear} সাল
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-white">
                    সকল যোগ্য সদস্যের বকেয়া কিস্তি অটো-কাটিং চালান
                  </h4>
                  <p className="text-[11px] text-emerald-100/80 leading-relaxed">
                    যেসব সদস্য সমবায় সমিতিতে নিবন্ধিত, যাদের চলতি বা বিগত মাসের সঞ্চয় বাকি এবং <strong>মেইন ব্যালেন্সে পর্যাপ্ত টাকা আছে</strong>, সিস্টেম তাদের মেইন ব্যালেন্স থেকে এক ক্লিকে পূর্ণ কিস্তির টাকা (1000/2000/5000) কেটে সঞ্চয়ে জমা করবে এবং স্বয়ংক্রিয় নোটিফিকেশন পাঠাবে।
                  </p>
                </div>
                <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleRefundAdvanceMonths}
                    disabled={isRefundingAdvance}
                    className="w-full sm:w-auto px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    title="ভুলবশত কর্তিত ভবিষ্যৎ মাসের (অক্টোবর/নভেম্বর) কিস্তি মেইন ব্যালেন্সে ফেরত দিন"
                  >
                    {isRefundingAdvance ? (
                      <>
                        <RotateCcw className="w-4 h-4 animate-spin" />
                        রিফান্ড হচ্ছে...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        🔄 ভুল কর্তিত অগ্রিম কিস্তি রিফান্ড
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleRunBulkAutoDeduction}
                    disabled={isBulkDeducting}
                    className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-2xl shadow-lg transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isBulkDeducting ? (
                      <>
                        <RotateCcw className="w-4 h-4 animate-spin" />
                        অটো-কাটিং চলছে...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-slate-950" />
                        🚀 এক ক্লিকে অটো-কাটিং চালান
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase block">নিবন্ধিত সমবায় সদস্য</span>
                <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">
                  {users.filter(u => u.samityStatus === 'approved' || u.isSamityMember).length} জন
                </span>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-3 text-center">
                <span className="text-[9px] text-emerald-700 font-extrabold uppercase block">মোট সঞ্চয় জমা স্থিতি</span>
                <span className="text-sm font-black text-emerald-700 font-mono mt-0.5 block">
                  ৳{users.reduce((sum, u) => sum + (Number(u.savings) || 0), 0).toLocaleString('bn-BD')}
                </span>
              </div>
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-3 text-center">
                <span className="text-[9px] text-amber-700 font-extrabold uppercase block">চলতি মাস ({SAMITY_MONTHS[new Date().getMonth()].name}) বাকি</span>
                <span className="text-sm font-black text-amber-700 font-mono mt-0.5 block">
                  {users.filter(u => {
                    const isM = u.samityStatus === 'approved' || u.isSamityMember;
                    if (!isM) return false;
                    const curMonthId = SAMITY_MONTHS[new Date().getMonth()].id;
                    return !isUserMonthPaid(u, new Date().getFullYear(), curMonthId, new Date().getMonth());
                  }).length} জন
                </span>
              </div>
              <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-3 text-center">
                <span className="text-[9px] text-indigo-700 font-extrabold uppercase block">চলতি মাসে পরিশোধিত</span>
                <span className="text-sm font-black text-indigo-700 font-mono mt-0.5 block">
                  {users.filter(u => {
                    const isM = u.samityStatus === 'approved' || u.isSamityMember;
                    if (!isM) return false;
                    const curMonthId = SAMITY_MONTHS[new Date().getMonth()].id;
                    return isUserMonthPaid(u, new Date().getFullYear(), curMonthId, new Date().getMonth());
                  }).length} জন
                </span>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="সদস্যের নাম, মোবাইল নাম্বার বা মেম্বার আইডি দিয়ে খুঁজুন..."
                    value={collectionSearchQuery}
                    onChange={(e) => setCollectionSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                  {collectionSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCollectionSearchQuery('')}
                      className="absolute right-3 top-2.5 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  {[
                    { id: 'all', label: 'সকল সদস্য' },
                    { id: 'current_unpaid', label: `চলতি মাস (${SAMITY_MONTHS[new Date().getMonth()].name}) বাকি` },
                    { id: 'unpaid', label: 'বকেয়া আছে' },
                    { id: 'paid', label: 'সম্পূর্ণ পেইড' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setCollectionFilterStatus(f.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                        collectionFilterStatus === f.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Member Cards List with 12 Months Matrix */}
            <div className="space-y-4 pb-96 sm:pb-[480px]">
              {users
                .filter(u => {
                  const matchesSearch = 
                    u.name.toLowerCase().includes(collectionSearchQuery.toLowerCase()) ||
                    u.phone.includes(collectionSearchQuery) ||
                    (u.memberId && u.memberId.includes(collectionSearchQuery));
                  
                  if (!matchesSearch) return false;

                  const isSamity = u.samityStatus === 'approved' || u.isSamityMember || (u.monthlySavingsTarget && u.monthlySavingsTarget > 0);
                  if (!isSamity) return false;

                  const unpaidMonths = getUnpaidSamityMonths(u, selectedCollectionYear, false);
                  const curMonthId = SAMITY_MONTHS[new Date().getMonth()].id;
                  const isCurMonthUnpaid = !isUserMonthPaid(u, new Date().getFullYear(), curMonthId, new Date().getMonth());

                  if (collectionFilterStatus === 'current_unpaid') return isCurMonthUnpaid;
                  if (collectionFilterStatus === 'unpaid') return unpaidMonths.length > 0;
                  if (collectionFilterStatus === 'paid') return unpaidMonths.length === 0;

                  return true;
                })
                .map((member, mIdx) => {
                  const targetRate = Math.max(1, Number(member.monthlySavingsTarget) || 1000);
                  const liveBal = getEffectiveBalance(member);
                  const memberSavings = Number(member.savings) || 0;
                  const paidCountInYear = SAMITY_MONTHS.filter((m, idx) => isUserMonthPaid(member, selectedCollectionYear, m.id, idx)).length;
                  const selectedMonths = memberSelectedMonthsMap[member.uid] || [];
                  const selectedTotalAmount = selectedMonths.length * targetRate;
                  const hasEnoughBalance = liveBal >= selectedTotalAmount;
                  const isSettling = settlingMemberUid === member.uid;

                  return (
                    <div key={`${member.uid}-${mIdx}`} className="bg-slate-50/80 border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4 hover:border-emerald-300 transition shadow-3xs">
                      {/* Top Row: User Avatar + Basic Details + Balances */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl font-black flex items-center justify-center text-base shadow-sm shrink-0">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              {member.name}
                              <span className="text-[9.5px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono font-extrabold">
                                ID: {member.memberId || member.uid.substring(0, 6)}
                              </span>
                            </h4>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                              <span>📞 {member.phone}</span>
                              {member.nid && <span className="font-mono text-slate-400">🪪 {member.nid}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Financial Metrics Summary */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 text-center">
                            <span className="text-[8px] text-slate-400 font-extrabold uppercase block">মাসিক কিস্তি</span>
                            <span className="text-xs font-black text-slate-800 font-mono">৳{targetRate.toLocaleString('bn-BD')}</span>
                          </div>
                          <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 text-center">
                            <span className="text-[8px] text-slate-400 font-extrabold uppercase block">মেইন ব্যালেন্স</span>
                            <span className="text-xs font-black text-indigo-600 font-mono">৳{liveBal.toLocaleString('bn-BD')}</span>
                          </div>
                          <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 text-center">
                            <span className="text-[8px] text-slate-400 font-extrabold uppercase block">মোট সঞ্চয়</span>
                            <span className="text-xs font-black text-emerald-600 font-mono">৳{memberSavings.toLocaleString('bn-BD')}</span>
                          </div>
                          <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 text-center">
                            <span className="text-[8px] text-slate-400 font-extrabold uppercase block">{selectedCollectionYear} পরিশোধিত</span>
                            <span className="text-xs font-black text-teal-600 font-mono">{paidCountInYear} / 12 মাস</span>
                          </div>
                        </div>
                      </div>

                      {/* 12-Month Matrix Selection Grid */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                            📅 <strong>{selectedCollectionYear} সালের 12 মাসের কিস্তি স্ট্যাটাস ও নির্বাচনঃ</strong>
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => selectAllUnpaidForMember(member, selectedCollectionYear)}
                              className="text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg transition cursor-pointer"
                            >
                              ✓ সব বকেয়া সিলেক্ট
                            </button>
                            {selectedMonths.length > 0 && (
                              <button
                                type="button"
                                onClick={() => clearMemberMonthSelection(member.uid)}
                                className="text-slate-500 hover:text-slate-700 font-bold bg-slate-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
                              >
                                ক্লিয়ার ({selectedMonths.length})
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 12 Month Grid Cards */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                          {SAMITY_MONTHS.map((m, idx) => {
                            const isPaid = isUserMonthPaid(member, selectedCollectionYear, m.id, idx);
                            const isCurrentMonth = selectedCollectionYear === new Date().getFullYear() && idx === new Date().getMonth();
                            const isSelected = selectedMonths.includes(m.id);

                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => toggleMemberMonthSelection(member.uid, m.id)}
                                className={`relative p-2 rounded-2xl border text-left transition duration-150 cursor-pointer flex flex-col justify-between min-h-[58px] ${
                                  isSelected
                                    ? 'bg-emerald-100/80 border-emerald-500 ring-2 ring-emerald-500/50 shadow-xs'
                                    : isPaid
                                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                                    : isCurrentMonth
                                    ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-[11px] font-black">{m.name}</span>
                                  {isSelected ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-slate-300" />
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded-md ${
                                    isPaid
                                      ? 'bg-emerald-600 text-white'
                                      : isCurrentMonth
                                      ? 'bg-amber-500 text-slate-950 font-black'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}>
                                    {isPaid ? '✓ পেইড' : isCurrentMonth ? 'চলতি মাস' : 'বাকি'}
                                  </span>
                                  <span className="text-[8px] font-mono text-slate-400 font-bold">
                                    ৳{targetRate}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bottom Action Bar for Selected Months */}
                      {selectedMonths.length > 0 ? (
                        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-emerald-950">
                                নির্বাচিত মাসঃ ({selectedMonths.length}টি মাস)
                              </span>
                              <span className="text-xs font-mono font-black text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                                মোট কিস্তিঃ ৳{selectedTotalAmount.toLocaleString('bn-BD')}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 font-semibold">
                              সদস্যের মেইন ব্যালেন্স: <strong>৳{liveBal.toLocaleString('bn-BD')}</strong>
                              {hasEnoughBalance ? (
                                <span className="text-emerald-700 font-bold ml-1.5">
                                  ✓ পর্যাপ্ত ব্যালেন্স আছে (অবশিষ্ট থাকবে ৳{(liveBal - selectedTotalAmount).toLocaleString('bn-BD')})
                                </span>
                              ) : (
                                <span className="text-rose-600 font-bold ml-1.5">
                                  ⚠ ব্যালেন্স অপর্যাপ্ত (কম আছে ৳{(selectedTotalAmount - liveBal).toLocaleString('bn-BD')})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleMemberMonthSettlement(member, true, 'mark_paid')}
                              disabled={isSettling || !hasEnoughBalance}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                              title={hasEnoughBalance ? 'মেইন ব্যালেন্স থেকে কর্তন করে সঞ্চয়ে জমা করুন' : 'পর্যাপ্ত ব্যালেন্স নেই'}
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              {isSettling ? 'প্রক্রিয়াকরণ...' : 'মেইন ব্যালেন্স থেকে কর্তন ও জমা'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMemberMonthSettlement(member, false, 'mark_paid')}
                              disabled={isSettling}
                              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                              title="সরাসরি ক্যাশ বা এডমিন হিসেবে পেইড মার্ক করুন"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              সরাসরি জমা / পেইড মার্ক
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMemberMonthSettlement(member, false, 'unmark')}
                              disabled={isSettling}
                              className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer disabled:opacity-50"
                              title="নির্বাচিত মাসের পেইড স্ট্যাটাস বাতিল (Unmark) করুন"
                            >
                              পেইড বাতিল (Unmark)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 bg-white/80 border border-dashed border-slate-200 rounded-xl p-2 text-center font-medium">
                          💡 যেকোনো মাস নির্বাচন করতে উপরের মাসের কার্ডে ক্লিক করুন অথবা "সব বকেয়া সিলেক্ট" বাটনে চাপুন।
                        </div>
                      )}

                    </div>
                  );
                })}
            </div>

            {/* Bulk Result Summary Modal */}
            {bulkResultModal && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-slate-150 pb-3">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      🎉 বাল্ক অটো-কাটিং ফলাফল রিপোর্ট
                    </h3>
                    <button onClick={() => setBulkResultModal(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer">✕</button>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase block">মোট সদস্য স্ক্যান</span>
                      <span className="text-sm font-black text-slate-900 font-mono">{bulkResultModal.totalEligible} জন</span>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded-2xl border border-emerald-200">
                      <span className="text-[9px] text-emerald-700 font-extrabold uppercase block">সফল কিস্তি কর্তন</span>
                      <span className="text-sm font-black text-emerald-700 font-mono">{bulkResultModal.processedCount} জন</span>
                    </div>
                    <div className="bg-teal-50 p-2.5 rounded-2xl border border-teal-200">
                      <span className="text-[9px] text-teal-700 font-extrabold uppercase block">মোট ফান্ড জমা</span>
                      <span className="text-sm font-black text-teal-800 font-mono">৳{bulkResultModal.totalCollected.toLocaleString('bn-BD')}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-slate-800">সদস্যভিত্তিক বিস্তারিত বিবরণঃ</h4>
                    <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                      {bulkResultModal.results.map((r, i) => (
                        <div key={i} className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                          r.success 
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}>
                          <div>
                            <span className="font-bold">{r.userName}</span>
                            <span className="text-[10px] block text-slate-500">{r.message}</span>
                          </div>
                          {r.success && (
                            <span className="font-black text-emerald-700 font-mono shrink-0">
                              +৳{r.deductedAmount.toLocaleString('bn-BD')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setBulkResultModal(null)}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl cursor-pointer"
                    >
                      ঠিক আছে, বন্ধ করুন
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

          </div>
        )}

        {/* VIEW I: BNB OUR INVESTMENTS (আমাদের ইনভেস্ট পোস্ট ও পোর্টফোলিও ম্যানেজার) */}
        {activeSubView === 'investments_manager' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-3 sm:p-5 shadow-3xs space-y-4 animate-fade-in text-left">
            <div className="border-b border-slate-150 pb-3 mb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                  আমাদের ইনভেস্ট (স্বর্ণ, জমি ও প্রজেক্ট পোস্ট ম্যানেজার)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ফেসবুক স্টাইলে নতুন ইনভেস্টমেন্ট পোস্ট তৈরি করুন, ক্রয়-বিক্রয় লাভ আপডেট করুন ও মুছে ফেলুন
                </p>
              </div>
              <button
                onClick={() => setActiveSubView('main')}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0"
              >
                ← কন্ট্রোল সেন্টারে যান
              </button>
            </div>

            <SamityInvestmentsView
              user={users.find(u => u.role === 'admin') || users[0] || { uid: 'admin', name: 'Admin', role: 'admin' } as User}
              onBack={() => setActiveSubView('main')}
              isAdmin={true}
            />
          </div>
        )}

      </div>

    </div>
  );
}
