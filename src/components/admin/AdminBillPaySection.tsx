import React, { useState, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { 
  collection, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import { User, Transaction, AppConfig } from '../../types';
import { 
  Receipt, 
  Lightbulb, 
  Flame, 
  Droplet, 
  Wifi, 
  Tv, 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Search, 
  Clock, 
  Sliders, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  Eye, 
  X, 
  Download, 
  FileText, 
  Settings,
  Filter,
  CreditCard,
  Building,
  User as UserIcon,
  Phone
} from 'lucide-react';
import { saveAppConfig } from '../../lib/config';

interface AdminBillPaySectionProps {
  adminTab: string;
  setViewingGrid: (viewing: boolean) => void;
  setAdminTab: (tab: any) => void;
  users: User[];
  transactions: Transaction[];
  appConfig: AppConfig;
  requestAlert?: (title: string, msg: string) => void;
  requestConfirm?: any;
  isMasterAdmin?: boolean;
}

export default function AdminBillPaySection({
  adminTab,
  setViewingGrid,
  setAdminTab,
  users,
  transactions,
  appConfig,
  requestAlert = (title, msg) => alert(`${title}: ${msg}`),
  requestConfirm = async (title, msg) => window.confirm(`${title}\n${msg}`),
  isMasterAdmin = true
}: AdminBillPaySectionProps) {
  if (adminTab !== 'bill_pay_admin') return null;

  const [activeSubTab, setActiveSubTab] = useState<'requests' | 'archive' | 'settings'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'success' | 'rejected'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Bill Image Viewer Modal
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Reject Modal
  const [rejectingBillTx, setRejectingBillTx] = useState<Transaction | null>(null);
  const [rejectReason, setRejectReason] = useState('ভুল মিটার / একাউন্ট নম্বর');

  // Settings State
  const [billPayActive, setBillPayActive] = useState<boolean>(
    (appConfig as any)?.billPayActive !== false
  );
  const [serviceFee, setServiceFee] = useState<string>(
    String((appConfig as any)?.billPayServiceFee ?? '0')
  );
  const [minBillLimit, setMinBillLimit] = useState<string>(
    String((appConfig as any)?.billPayMinLimit ?? '50')
  );
  const [maxBillLimit, setMaxBillLimit] = useState<string>(
    String((appConfig as any)?.billPayMaxLimit ?? '100000')
  );
  const [billTicker, setBillTicker] = useState<string>(
    (appConfig as any)?.billPayTicker || '💡 বিদ্যুৎ, গ্যাস, পানি ও ইন্টারনেট বিল ঘরে বসেই নিরাপদে পরিশোধ করুন। দ্রুত রসিদ সংগ্রহ করুন।'
  );
  const [billPolicyText, setBillPolicyText] = useState<string>(
    (appConfig as any)?.billPayPolicy || '১. বিলের সঠিক একাউন্ট নম্বর ও কপি যাচাই করে সাবমিট করুন।\n২. বিল অনুমোদিত হলে ডিজিটাল রসিদ জেনারেট হবে।\n৩. বিল বাতিল হলে টাকা স্বয়ংক্রিয়ভাবে মূল ওয়ালেটে রিফান্ড করা হয়।'
  );

  // Filter Utility Bill Transactions
  const billTransactions = useMemo(() => {
    return transactions.filter(t => {
      const type = (t.type || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      return type === 'bill_pay' || type.includes('bill') || cat === 'utility' || cat.includes('bill');
    });
  }, [transactions]);

  const pendingBills = useMemo(() => {
    return billTransactions.filter(t => t.status === 'pending');
  }, [billTransactions]);

  const successBills = useMemo(() => {
    return billTransactions.filter(t => t.status === 'success' || (t.status as any) === 'approved');
  }, [billTransactions]);

  const totalCollected = useMemo(() => {
    return successBills.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [successBills]);

  // Filtered List
  const filteredBills = useMemo(() => {
    return billTransactions.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'all') {
        const cat = (t.billCategory || (t as any).subCategory || '').toLowerCase();
        const pName = (t.providerName || t.senderName || '').toLowerCase();
        if (!cat.includes(categoryFilter) && !pName.includes(categoryFilter)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const acc = (t.accountNumber || t.meterNumber || (t as any).billAccount || '').toLowerCase();
        const uPhone = (t.userPhone || t.phoneNumber || t.recipientNumber || '').toLowerCase();
        const uName = (t.userName || '').toLowerCase();
        const trx = (t.trxId || t.id || '').toLowerCase();
        const prov = (t.providerName || '').toLowerCase();
        return acc.includes(q) || uPhone.includes(q) || uName.includes(q) || trx.includes(q) || prov.includes(q);
      }
      return true;
    });
  }, [billTransactions, statusFilter, categoryFilter, searchQuery]);

  // Save Settings
  const handleSaveBillSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await saveAppConfig({
        ...appConfig,
        billPayActive,
        billPayServiceFee: Number(serviceFee) || 0,
        billPayMinLimit: Number(minBillLimit) || 50,
        billPayMaxLimit: Number(maxBillLimit) || 100000,
        billPayTicker: billTicker,
        billPayPolicy: billPolicyText
      } as any);
      requestAlert('সংরক্ষণ সফল', 'ইউটিলিটি বিল পে সেটিংস সফলভাবে আপডেট হয়েছে!');
    } catch (e: any) {
      console.error('Error saving bill pay config:', e);
      requestAlert('ত্রুটি', 'সেটিংস সংরক্ষণ ব্যর্থ হয়েছে: ' + (e.message || ''));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Approve Bill Request
  const handleApproveBill = async (tx: Transaction) => {
    const prov = (tx as any).providerName || 'ইউটিলিটি';
    const acc = tx.accountNumber || (tx as any).meterNumber || (tx as any).billAccount || 'N/A';
    const doApprove = async () => {
      setActionLoadingId(tx.id);
      try {
        // 1. Update Transaction
        await updateDoc(doc(db, 'transactions', tx.id), {
          status: 'success',
          processedBy: 'admin',
          processedAt: serverTimestamp(),
          gatewayMessage: 'এডমিন কর্তৃক বিলটি ভেরিফাই ও সফলভাবে পরিশোধ করা হয়েছে'
        });

        // 2. Dispatch User Notification
        if (tx.userId) {
          await addDoc(collection(db, 'user_notifications'), {
            userId: tx.userId,
            title: '💡 ইউটিলিটি বিল সফলভাবে পরিশোধিত!',
            message: `আপনার ${prov} বিল (অ্যাকাউন্ট নং: ${acc}) ৳${(Number(tx.amount) || 0).toLocaleString('bn-BD')} সফলভাবে পরিশোধিত হয়েছে। ডিজিটাল রসিদ দেখতে রসিদ মেনুতে যান।`,
            type: 'success',
            category: 'utility',
            read: false,
            createdAt: serverTimestamp()
          });
        }

        requestAlert('সফল', 'বিল পেমেন্ট সফলভাবে অনুমোদিত ও রেকর্ড সম্পন্ন হয়েছে!');
      } catch (e: any) {
        console.error('Error approving bill:', e);
        requestAlert('ত্রুটি', 'বিল অনুমোদন ব্যর্থ হয়েছে: ' + (e.message || ''));
      } finally {
        setActionLoadingId(null);
      }
    };

    if (typeof requestConfirm === 'function') {
      requestConfirm(
        'বিল পেমেন্ট অনুমোদন',
        `আপনি কি নিশ্চিত যে ${prov} বিলের ৳${(Number(tx.amount) || 0).toLocaleString('bn-BD')} অনুমোদন ও পরিশোধ সম্পন্ন করতে চান?`,
        doApprove
      );
    } else {
      if (window.confirm(`আপনি কি নিশ্চিত যে ${prov} বিলের ৳${(Number(tx.amount) || 0).toLocaleString('bn-BD')} অনুমোদন ও পরিশোধ সম্পন্ন করতে চান?`)) {
        await doApprove();
      }
    }
  };

  // Reject Bill & Refund
  const handleRejectBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingBillTx) return;

    const tx = rejectingBillTx;
    setActionLoadingId(tx.id);
    try {
      const refundAmount = Number(tx.amount) || 0;

      // 1. Refund to User's Main Wallet
      if (tx.userId && refundAmount > 0) {
        const uDocRef = doc(db, 'users', tx.userId);
        await updateDoc(uDocRef, {
          balance: increment(refundAmount)
        });
      }

      // 2. Update Transaction Status
      await updateDoc(doc(db, 'transactions', tx.id), {
        status: 'rejected',
        rejectionReason: rejectReason,
        refunded: true,
        processedBy: 'admin',
        processedAt: serverTimestamp()
      });

      // 3. Dispatch Notification
      if (tx.userId) {
        await addDoc(collection(db, 'user_notifications'), {
          userId: tx.userId,
          title: '❌ বিল পেমেন্ট বাতিল ও টাকা রিফান্ড',
          message: `আপনার ${tx.providerName || 'ইউটিলিটি'} বিল আবেদনটি বাতিল করা হয়েছে। কারণ: "${rejectReason}"। বিলের ৳${refundAmount.toLocaleString('bn-BD')} আপনার মূল ওয়ালেটে রিফান্ড করা হয়েছে।`,
          type: 'error',
          category: 'utility',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      requestAlert('সফল', 'বিল বাতিল হয়েছে এবং গ্রাহকের ওয়ালেটে টাকা ফেরত দেওয়া হয়েছে!');
      setRejectingBillTx(null);
    } catch (e: any) {
      console.error('Error rejecting bill:', e);
      requestAlert('ত্রুটি', 'বিল বাতিল ব্যর্থ হয়েছে: ' + (e.message || ''));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper for provider icon & color
  const getProviderBadge = (providerName?: string, category?: string) => {
    const p = (providerName || '').toLowerCase();
    const c = (category || '').toLowerCase();

    if (p.includes('palli') || p.includes('desco') || p.includes('dpdc') || p.includes('nesco') || p.includes('wzpdcl') || c.includes('elec')) {
      return { icon: Lightbulb, color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'বিদ্যুৎ বিল' };
    }
    if (p.includes('gas') || p.includes('titas') || p.includes('jalalabad') || p.includes('karnaphuli') || c.includes('gas')) {
      return { icon: Flame, color: 'bg-rose-100 text-rose-800 border-rose-300', label: 'গ্যাস বিল' };
    }
    if (p.includes('wasa') || p.includes('water') || c.includes('water')) {
      return { icon: Droplet, color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'পানি বিল' };
    }
    if (p.includes('link3') || p.includes('carnival') || p.includes('amber') || c.includes('internet')) {
      return { icon: Wifi, color: 'bg-purple-100 text-purple-800 border-purple-300', label: 'ইন্টারনেট বিল' };
    }
    if (p.includes('akash') || p.includes('dth') || p.includes('tv') || c.includes('tv')) {
      return { icon: Tv, color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300', label: 'ক্যাবল টিভি' };
    }
    return { icon: Receipt, color: 'bg-slate-100 text-slate-800 border-slate-300', label: 'ইউটিলিটি বিল' };
  };

  return (
    <div className="w-full text-left space-y-4 animate-fade-in text-slate-800" id="admin-bill-pay-section">
      {/* 1. Header Navigation Bar */}
      <div className="bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 rounded-2xl p-4 text-white shadow-md flex items-center justify-between gap-3 border border-purple-400/30 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setViewingGrid(true);
              setAdminTab('general');
            }}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer border border-white/20"
            title="ড্যাশবোর্ডে ফিরে যান"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-purple-500/30 text-purple-200">
                <Receipt className="w-4 h-4" />
              </span>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                AMB বিল পে এডমিন কন্ট্রোল প্যানেল
              </h1>
            </div>
            <p className="text-xs text-purple-200 font-medium mt-0.5">
              বিদ্যুৎ, গ্যাস, পানি, ইন্টারনেট বিল রিকোয়েস্ট যাচাই, ডিজিটাল অনুমোদন ও কনফিগারেশন
            </p>
          </div>
        </div>

        {/* Global status pill */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 border shadow-2xs ${
            billPayActive 
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' 
              : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${billPayActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span>{billPayActive ? '🟢 বিল পে সার্ভিস সচল' : '🔴 বিল পে বন্ধ'}</span>
          </span>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold">মোট পরিশোধিত বিল</span>
            <Receipt className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-base sm:text-lg font-black text-slate-900 font-mono">
            ৳{totalCollected.toLocaleString('bn-BD')}
          </p>
          <span className="text-[9px] text-purple-600 font-semibold">{successBills.length}টি সফল বিল লেনদেন</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold">পেন্ডিং বিল আবেদন</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-base sm:text-lg font-black text-amber-600 font-mono">
            {pendingBills.length} টি
          </p>
          <span className="text-[9px] text-amber-600/80 font-semibold">ভেরিফিকেশন অপেক্ষমাণ</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold">সার্ভিস ফি / চার্জ</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-base sm:text-lg font-black text-emerald-600 font-mono">
            ৳{Number(serviceFee).toLocaleString('bn-BD')}
          </p>
          <span className="text-[9px] text-emerald-600/80 font-semibold">প্রতি বিল ট্রানজেকশনে</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold">সর্বমোট বিল আবেদন</span>
            <Building className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-base sm:text-lg font-black text-indigo-700 font-mono">
            {billTransactions.length} টি
          </p>
          <span className="text-[9px] text-slate-400 font-semibold">সমগ্র সিস্টেমে</span>
        </div>
      </div>

      {/* 3. Sub-Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setActiveSubTab('requests');
            setStatusFilter('pending');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeSubTab === 'requests'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>📋 পেন্ডিং বিল আবেদন ({pendingBills.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('archive');
            setStatusFilter('all');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeSubTab === 'archive'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>📊 সকল বিল লেনদেন ইতিহাস ({billTransactions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeSubTab === 'settings'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>⚙️ বিল সার্ভিস ও ফি সেটিংস</span>
        </button>
      </div>

      {/* ======================= TAB 1 & 2: BILL LIST / QUEUE ======================= */}
      {(activeSubTab === 'requests' || activeSubTab === 'archive') && (
        <div className="space-y-3">
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'all' ? 'bg-purple-700 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  সকল ({billTransactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-2xs' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  <span>পেন্ডিং ({pendingBills.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('success')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'success' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  পরিশোধিত ({successBills.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('rejected')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'rejected' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  বাতিল / রিফান্ড
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="মিটার / হিসাব নং / নাম / ফোন..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Category Quick Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold text-slate-600 pt-1 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase shrink-0">ধরন:</span>
              {[
                { id: 'all', label: 'সকল ক্যাটাগরি' },
                { id: 'elec', label: '💡 বিদ্যুৎ' },
                { id: 'gas', label: '🔥 গ্যাস' },
                { id: 'water', label: '💧 পানি' },
                { id: 'internet', label: '🌐 ইন্টারনেট' },
                { id: 'tv', label: '📺 টিভি' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2.5 py-0.5 rounded-lg transition shrink-0 cursor-pointer ${
                    categoryFilter === cat.id ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards List */}
          {filteredBills.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-14 text-center text-slate-400 space-y-2">
              <Receipt className="w-8 h-8 mx-auto text-slate-300 opacity-60" />
              <p className="text-xs font-bold">কোনো বিল পেমেন্ট আবেদন পাওয়া যায়নি!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBills.map((tx) => {
                const isPending = tx.status === 'pending';
                const isSuccess = tx.status === 'success' || (tx.status as any) === 'approved';
                const isRejected = (tx.status as any) === 'rejected' || (tx.status as any) === 'failed';
                const u = users.find(usr => usr.uid === tx.userId || usr.phone === tx.userPhone);
                const badge = getProviderBadge(tx.providerName, tx.billCategory);
                const BadgeIcon = badge.icon;
                const billPhoto = (tx as any).billImage || (tx as any).receiptUrl || (tx as any).attachmentUrl;

                return (
                  <div
                    key={tx.id}
                    className={`bg-white border rounded-2xl p-4 shadow-2xs transition hover:shadow-xs space-y-3 text-left ${
                      isPending ? 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-200/50' : 'border-slate-200'
                    }`}
                  >
                    {/* Top Row: Provider & Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl border ${badge.color} flex items-center justify-center shrink-0`}>
                          <BadgeIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                              {tx.providerName || (tx as any).billerName || 'ইউটিলিটি বিল'}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${badge.color}`}>
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            বিলিং মাস: <strong className="text-slate-600 font-sans">{(tx as any).billMonth || 'চলতি মাস'}</strong> • তারিখ: {tx.date || 'চলতি'} ({tx.time || ''})
                          </p>
                        </div>
                      </div>

                      {/* Status Pill & Amount */}
                      <div className="text-right">
                        <span className="text-base sm:text-lg font-black text-slate-900 font-mono block">
                          ৳{(Number(tx.amount) || 0).toLocaleString('bn-BD')}
                        </span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
                          isPending ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          isSuccess ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                          'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}>
                          {isPending ? '🟡 পেন্ডিং ভেরিফিকেশন' : isSuccess ? '✅ সফল পরিশোধ' : '❌ বাতিল ও রিফান্ডেড'}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Details Grid */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                      <div>
                        <span className="block text-[10px] text-slate-400 font-bold">মিটার / গ্রাহক হিসাব নম্বর</span>
                        <span className="font-black text-slate-800 font-mono text-xs select-all">
                          {tx.accountNumber || tx.meterNumber || (tx as any).billAccount || 'উপলব্ধ নয়'}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[10px] text-slate-400 font-bold">গ্রাহক তথ্য ও মোবাইল</span>
                        <span className="font-bold text-slate-700">
                          {tx.userName || u?.name || 'ইউজার'} (<span className="font-mono">{tx.userPhone || u?.phone || 'N/A'}</span>)
                        </span>
                      </div>

                      <div>
                        <span className="block text-[10px] text-slate-400 font-bold">ট্রানজেকশন রেফারেন্স</span>
                        <span className="font-mono font-bold text-slate-500 text-[10.5px]">
                          {tx.trxId || tx.id}
                        </span>
                      </div>
                    </div>

                    {/* Rejection Note if any */}
                    {isRejected && (tx as any).rejectionReason && (
                      <div className="bg-rose-50 text-rose-800 text-[11px] p-2 rounded-xl border border-rose-200 flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>বাতিলের কারণ: "{(tx as any).rejectionReason}" (টাকা মূল ওয়ালেটে রিফান্ড করা হয়েছে)</span>
                      </div>
                    )}

                    {/* Bottom Row: Attached Image preview & Actions */}
                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 flex-wrap">
                      <div>
                        {billPhoto ? (
                          <button
                            type="button"
                            onClick={() => setViewingImage(billPhoto)}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10.5px] font-black flex items-center gap-1 cursor-pointer transition"
                          >
                            <Eye className="w-3 h-3" />
                            <span>বিলের কপি / ছবি দেখুন</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium italic">কোনো বিল কপি সংযুক্ত করা হয়নি</span>
                        )}
                      </div>

                      {/* Pending Action Buttons */}
                      {isPending && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={actionLoadingId === tx.id}
                            onClick={() => {
                              setRejectingBillTx(tx);
                              setRejectReason('ভুল মিটার / একাউন্ট নম্বর');
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            বাতিল ও রিফান্ড
                          </button>

                          <button
                            type="button"
                            disabled={actionLoadingId === tx.id}
                            onClick={() => handleApproveBill(tx)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-xs active:scale-95 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>অনুমোদন ও পেইড মার্ক</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================= TAB 3: SETTINGS ======================= */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveBillSettings} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 text-left">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span>⚙️</span> ইউটিলিটি বিল পে সার্ভিস ও ফি কনফিগারেশন
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              ইউজার অ্যাপে বিল পে ইন্টারফেসের সার্ভিস ফি, সর্বোচ্চ লিমিট ও বিজ্ঞপ্তি পরিবর্তন করুন
            </p>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Global Switch */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div>
                <h4 className="font-black text-slate-800">গ্লোবাল ইউটিলিটি বিল পে সার্ভিস</h4>
                <p className="text-[11px] text-slate-500">অন থাকলে ইউজাররা ড্যাশবোর্ড থেকে সকল প্রকার বিল আবেদন সাবমিট করতে পারবেন</p>
              </div>
              <button
                type="button"
                onClick={() => setBillPayActive(!billPayActive)}
                className={`w-12 h-6.5 rounded-full transition p-0.5 cursor-pointer ${
                  billPayActive ? 'bg-purple-700' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5.5 h-5.5 rounded-full bg-white transition shadow-xs ${
                  billPayActive ? 'translate-x-5.5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Service Fee & Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-black text-slate-700 mb-1">
                  সার্ভিস ফি / চার্জ (টাকা)
                </label>
                <input
                  type="number"
                  value={serviceFee}
                  onChange={(e) => setServiceFee(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-purple-500 focus:bg-white"
                  placeholder="0 (ফ্রি)"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">প্রতি বিল সাবমিশনে গ্রাহকের ওয়ালেট থেকে কাটা ফি (০ হলে ফ্রি)</p>
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1">
                  সর্বনিম্ন বিল লিমিট (টাকা)
                </label>
                <input
                  type="number"
                  value={minBillLimit}
                  onChange={(e) => setMinBillLimit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-purple-500 focus:bg-white"
                  placeholder="50"
                />
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1">
                  সর্বোচ্চ বিল লিমিট (টাকা)
                </label>
                <input
                  type="number"
                  value={maxBillLimit}
                  onChange={(e) => setMaxBillLimit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-purple-500 focus:bg-white"
                  placeholder="100000"
                />
              </div>
            </div>

            {/* Ticker Notice */}
            <div className="space-y-1">
              <label className="block font-black text-slate-700">
                ইউজার অ্যাপ বিল পে স্ক্রল নোটিশ (Ticker)
              </label>
              <textarea
                value={billTicker}
                onChange={(e) => setBillTicker(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-purple-500 focus:bg-white"
                placeholder="স্ক্রল নোটিশ লিখুন..."
              />
            </div>

            {/* Policy & Terms */}
            <div className="space-y-1">
              <label className="block font-black text-slate-700">
                বিল পরিশোধ নির্দেশিকা ও নিয়মাবলী (Guidelines)
              </label>
              <textarea
                value={billPolicyText}
                onChange={(e) => setBillPolicyText(e.target.value)}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-purple-500 focus:bg-white"
                placeholder="১. নিয়মাবলী লিখুন..."
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {isSavingSettings ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>বিল পে সেটিংস ও চার্জ সংরক্ষণ করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ======================= MODAL: BILL IMAGE VIEWER ======================= */}
      {viewingImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-4 max-w-lg w-full space-y-3 text-center shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-black text-slate-900">সংযুক্ত বিলের কপি / কাগজ</h4>
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-900/5 flex items-center justify-center p-2">
              <img src={viewingImage} alt="Bill Attachment" className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-xs" />
            </div>
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="px-5 py-1.5 bg-purple-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: REJECT BILL ======================= */}
      {rejectingBillTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3">
          <form onSubmit={handleRejectBill} className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-4 space-y-3 text-xs shadow-2xl text-left animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-rose-600 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                <span>বিল পেমেন্ট বাতিল ও রিফান্ড</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectingBillTx(null)}
                className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-[11px] text-rose-900 space-y-1">
              <p>গ্রাহকের ৳{(Number(rejectingBillTx.amount) || 0).toLocaleString('bn-BD')} টাকা সরাসরি তার মূল ওয়ালেটে রিফান্ড করা হবে।</p>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 mb-1">বাতিলের কারণ</label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none mb-1.5"
              >
                <option value="ভুল মিটার / একাউন্ট নম্বর">ভুল মিটার / একাউন্ট নম্বর</option>
                <option value="বিল ইতিপূর্বে পরিশোধিত">বিল ইতিপূর্বে পরিশোধিত</option>
                <option value="বিলের ছবির কপি অস্পষ্ট / অপর্যাপ্ত">বিলের ছবির কপি অস্পষ্ট / অপর্যাপ্ত</option>
                <option value="বিলের মেয়াদ উত্তীর্ণ হয়েছে">বিলের মেয়াদ উত্তীর্ণ হয়েছে</option>
                <option value="টাকার অংক অমিল রয়েছে">টাকার অংক অমিল রয়েছে</option>
              </select>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none"
                placeholder="কাস্টম কারণ লিখুন..."
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectingBillTx(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                ফিরে যান
              </button>
              <button
                type="submit"
                disabled={actionLoadingId === rejectingBillTx.id}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs disabled:opacity-50"
              >
                নিশ্চিত বাতিল ও রিফান্ড
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
