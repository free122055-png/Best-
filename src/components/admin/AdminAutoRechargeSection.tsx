import React, { useState, useEffect, useMemo } from 'react';
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
  Smartphone, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Sliders, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Clock, 
  ShieldAlert, 
  ShieldCheck, 
  Settings, 
  Check, 
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { saveAppConfig } from '../../lib/config';

interface AdminAutoRechargeSectionProps {
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

interface SimGateway {
  id: string;
  operator: 'Grameenphone' | 'Banglalink' | 'Robi' | 'Airtel' | 'Teletalk' | 'Skitto';
  phone: string;
  simSlot: number;
  balance: number;
  ussdCode: string;
  status: 'online' | 'offline' | 'busy' | 'low_balance';
  autoActive: boolean;
  minBalanceAlert: number;
  dailyCount: number;
  dailyLimit: number;
  lastUpdated?: string;
}

const DEFAULT_SIMS: SimGateway[] = [
  { id: 'sim-gp-1', operator: 'Grameenphone', phone: '01700000001', simSlot: 1, balance: 15420, ussdCode: '*566#', status: 'online', autoActive: true, minBalanceAlert: 500, dailyCount: 42, dailyLimit: 50000, lastUpdated: 'সক্রিয়' },
  { id: 'sim-bl-1', operator: 'Banglalink', phone: '01900000002', simSlot: 2, balance: 8750, ussdCode: '*124#', status: 'online', autoActive: true, minBalanceAlert: 500, dailyCount: 28, dailyLimit: 40000, lastUpdated: 'সক্রিয়' },
  { id: 'sim-robi-1', operator: 'Robi', phone: '01800000003', simSlot: 3, balance: 12100, ussdCode: '*222#', status: 'online', autoActive: true, minBalanceAlert: 500, dailyCount: 35, dailyLimit: 45000, lastUpdated: 'সক্রিয়' },
  { id: 'sim-airtel-1', operator: 'Airtel', phone: '01600000004', simSlot: 4, balance: 6300, ussdCode: '*778#', status: 'online', autoActive: true, minBalanceAlert: 500, dailyCount: 19, dailyLimit: 30000, lastUpdated: 'সক্রিয়' },
  { id: 'sim-teletalk-1', operator: 'Teletalk', phone: '01500000005', simSlot: 5, balance: 3400, ussdCode: '*152#', status: 'online', autoActive: true, minBalanceAlert: 500, dailyCount: 8, dailyLimit: 20000, lastUpdated: 'সক্রিয়' },
  { id: 'sim-skitto-1', operator: 'Skitto', phone: '01799000006', simSlot: 6, balance: 4100, ussdCode: '*121*1#', status: 'online', autoActive: true, minBalanceAlert: 500, dailyCount: 12, dailyLimit: 25000, lastUpdated: 'সক্রিয়' },
];

export default function AdminAutoRechargeSection({
  adminTab,
  setViewingGrid,
  setAdminTab,
  users,
  transactions,
  appConfig,
  requestAlert = (title, msg) => alert(`${title}: ${msg}`),
  requestConfirm = async (title, msg) => window.confirm(`${title}\n${msg}`),
  isMasterAdmin = true
}: AdminAutoRechargeSectionProps) {
  if (adminTab !== 'auto_recharge_admin') return null;

  const [activeSubTab, setActiveSubTab] = useState<'gateways' | 'queue' | 'settings'>('gateways');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'success' | 'rejected'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // SIM Gateways State
  const [simGateways, setSimGateways] = useState<SimGateway[]>(() => {
    return (appConfig as any)?.autoRechargeSims || DEFAULT_SIMS;
  });

  // Config States
  const [autoRechargeActive, setAutoRechargeActive] = useState<boolean>(
    (appConfig as any)?.autoRechargeActive !== false
  );
  const [autoThreshold, setAutoThreshold] = useState<string>(
    String((appConfig as any)?.autoRechargeMaxThreshold || '1000')
  );
  const [autoTicker, setAutoTicker] = useState<string>(
    (appConfig as any)?.autoRechargeTicker || '⚡ AMB ইনস্ট্যান্ট অটো রিচার্জ গেটওয়ে ২৪/৭ সক্রিয়। সকল অপারেটরে দ্রুত ফ্লেক্সিলোড ও স্পেশাল ক্যাশব্যাক অফার উপভোগ করুন।'
  );
  const [autoPolicyText, setAutoPolicyText] = useState<string>(
    (appConfig as any)?.autoRechargePolicy || '১. রিচার্জ ব্যালেন্স থেকে অটো রিচার্জ সম্পন্ন হয়।\n২. ভুল নম্বরে রিচার্জ গেলে কোম্পানি দায়ী নয়।\n৩. কোনো কারণে সার্ভার ব্যস্ত থাকলে অটোমেটিক রি-ট্রাই করা হবে।'
  );

  // SIM Modal State
  const [showSimModal, setShowSimModal] = useState(false);
  const [editingSim, setEditingSim] = useState<SimGateway | null>(null);
  const [simOp, setSimOp] = useState<SimGateway['operator']>('Grameenphone');
  const [simPhone, setSimPhone] = useState('');
  const [simSlotNum, setSimSlotNum] = useState('1');
  const [simBal, setSimBal] = useState('10000');
  const [simUssd, setSimUssd] = useState('*566#');
  const [simAlertBal, setSimAlertBal] = useState('500');
  const [simLimit, setSimLimit] = useState('50000');

  // Quick Balance Modal
  const [balanceModalSim, setBalanceModalSim] = useState<SimGateway | null>(null);
  const [newSimBalanceInput, setNewSimBalanceInput] = useState('');

  // Rejection Modal
  const [rejectingTx, setRejectingTx] = useState<Transaction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('নম্বর ভুল বা বন্ধ পাওয়া গেছে');

  // Filter Recharge Transactions
  const rechargeTransactions = useMemo(() => {
    return transactions.filter(t => {
      const type = (t.type || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      const isRecharge = type.includes('telecom_recharge') || type.includes('recharge') || cat.includes('recharge') || (t as any).isAutoRecharge;
      return isRecharge;
    });
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return rechargeTransactions.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = (t.recipientNumber || t.phoneNumber || t.userPhone || '').toLowerCase();
        const uName = (t.userName || t.senderName || '').toLowerCase();
        const trx = (t.trxId || t.id || '').toLowerCase();
        const op = (t.operator || '').toLowerCase();
        return num.includes(q) || uName.includes(q) || trx.includes(q) || op.includes(q);
      }
      return true;
    });
  }, [rechargeTransactions, statusFilter, searchQuery]);

  // Total SIM Balance
  const totalSimBalance = useMemo(() => {
    return simGateways.reduce((sum, s) => sum + (Number(s.balance) || 0), 0);
  }, [simGateways]);

  const pendingCount = useMemo(() => {
    return rechargeTransactions.filter(t => t.status === 'pending').length;
  }, [rechargeTransactions]);

  const successCount = useMemo(() => {
    return rechargeTransactions.filter(t => t.status === 'success' || (t.status as any) === 'approved').length;
  }, [rechargeTransactions]);

  // Save SIM Gateways to Config
  const handleSaveSimGateways = async (updatedList: SimGateway[]) => {
    setSimGateways(updatedList);
    try {
      await saveAppConfig({
        ...appConfig,
        autoRechargeSims: updatedList
      } as any);
      requestAlert('সফল', 'সিম গেটওয়ে তালিকা সফলভাবে সংরক্ষণ করা হয়েছে!');
    } catch (e: any) {
      console.error('Error saving SIM gateways:', e);
      requestAlert('ত্রুটি', 'সিম গেটওয়ে সংরক্ষণ করতে সমস্যা হয়েছে: ' + (e.message || 'Unknown error'));
    }
  };

  // Save Global Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveAppConfig({
        ...appConfig,
        autoRechargeActive,
        autoRechargeMaxThreshold: Number(autoThreshold) || 1000,
        autoRechargeTicker: autoTicker,
        autoRechargePolicy: autoPolicyText,
        autoRechargeSims: simGateways
      } as any);
      requestAlert('সংরক্ষণ সফল', 'অটো রিচার্জ গেটওয়ে সেটিংস সফলভাবে আপডেট হয়েছে!');
    } catch (e: any) {
      console.error('Error saving auto recharge config:', e);
      requestAlert('ত্রুটি', 'সেটিংস সংরক্ষণ ব্যর্থ হয়েছে: ' + (e.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Single SIM Auto Status
  const handleToggleSimAuto = (simId: string) => {
    const updated = simGateways.map(s => {
      if (s.id === simId) {
        return { ...s, autoActive: !s.autoActive, status: !s.autoActive ? ('online' as const) : ('offline' as const) };
      }
      return s;
    });
    handleSaveSimGateways(updated);
  };

  // Open SIM Create/Edit
  const handleOpenSimModal = (sim?: SimGateway) => {
    if (sim) {
      setEditingSim(sim);
      setSimOp(sim.operator);
      setSimPhone(sim.phone);
      setSimSlotNum(String(sim.simSlot));
      setSimBal(String(sim.balance));
      setSimUssd(sim.ussdCode);
      setSimAlertBal(String(sim.minBalanceAlert));
      setSimLimit(String(sim.dailyLimit));
    } else {
      setEditingSim(null);
      setSimOp('Grameenphone');
      setSimPhone('');
      setSimSlotNum(String(simGateways.length + 1));
      setSimBal('10000');
      setSimUssd('*566#');
      setSimAlertBal('500');
      setSimLimit('50000');
    }
    setShowSimModal(true);
  };

  // Save Single SIM
  const handleSaveSingleSim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simPhone.trim()) {
      requestAlert('ত্রুটি', 'সিম মোবাইল নম্বর লিখুন');
      return;
    }

    let updatedList: SimGateway[];
    if (editingSim) {
      updatedList = simGateways.map(s => {
        if (s.id === editingSim.id) {
          return {
            ...s,
            operator: simOp,
            phone: simPhone.trim(),
            simSlot: Number(simSlotNum) || 1,
            balance: Number(simBal) || 0,
            ussdCode: simUssd.trim(),
            minBalanceAlert: Number(simAlertBal) || 500,
            dailyLimit: Number(simLimit) || 50000,
            lastUpdated: new Date().toLocaleDateString('bn-BD')
          };
        }
        return s;
      });
    } else {
      const newSim: SimGateway = {
        id: `sim-${Date.now()}`,
        operator: simOp,
        phone: simPhone.trim(),
        simSlot: Number(simSlotNum) || simGateways.length + 1,
        balance: Number(simBal) || 0,
        ussdCode: simUssd.trim(),
        status: 'online',
        autoActive: true,
        minBalanceAlert: Number(simAlertBal) || 500,
        dailyCount: 0,
        dailyLimit: Number(simLimit) || 50000,
        lastUpdated: 'নতুন যুক্ত'
      };
      updatedList = [...simGateways, newSim];
    }

    handleSaveSimGateways(updatedList);
    setShowSimModal(false);
  };

  // Delete SIM
  const handleDeleteSim = async (sim: SimGateway) => {
    const ok = await requestConfirm('সিম গেটওয়ে ডিলিট', `আপনি কি নিশ্চিত যে "${sim.operator} (স্লট ${sim.simSlot})" গেটওয়ে মুছে ফেলতে চান?`);
    if (!ok) return;
    const updated = simGateways.filter(s => s.id !== sim.id);
    handleSaveSimGateways(updated);
  };

  // Quick Update SIM Balance
  const handleUpdateSimBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModalSim) return;
    const newBal = Number(newSimBalanceInput);
    if (isNaN(newBal) || newBal < 0) {
      requestAlert('ত্রুটি', 'সঠিক ব্যালেন্স সংখ্যা প্রদান করুন');
      return;
    }
    const updated = simGateways.map(s => {
      if (s.id === balanceModalSim.id) {
        return { ...s, balance: newBal, lastUpdated: new Date().toLocaleTimeString('bn-BD') };
      }
      return s;
    });
    handleSaveSimGateways(updated);
    setBalanceModalSim(null);
  };

  // Approve Recharge Request
  const handleApproveRecharge = async (tx: Transaction) => {
    const num = (tx as any).recipientNumber || tx.phoneNumber || 'নম্বর';
    const doApprove = async () => {
      setActionLoadingId(tx.id);
      try {
        // 1. Update Transaction Status
        await updateDoc(doc(db, 'transactions', tx.id), {
          status: 'success',
          processedBy: 'admin',
          processedAt: serverTimestamp(),
          gatewayMessage: 'এডমিন কর্তৃক সফলভাবে অনুমোদিত ও প্রেরিত'
        });

        // 2. Dispatch Notification to User
        if (tx.userId) {
          await addDoc(collection(db, 'user_notifications'), {
            userId: tx.userId,
            title: '⚡ রিচার্জ সফল হয়েছে!',
            message: `আপনার ${num} নম্বরে ৳${(tx.amount || 0).toLocaleString('bn-BD')} রিচার্জ সফলভাবে সম্পন্ন হয়েছে।`,
            type: 'success',
            category: 'telecom',
            read: false,
            createdAt: serverTimestamp()
          });
        }

        requestAlert('সফল', 'রিচার্জ সফলভাবে অনুমোদিত ও সম্পন্ন হয়েছে!');
      } catch (e: any) {
        console.error('Error approving recharge:', e);
        requestAlert('ত্রুটি', 'অনুমোদন ব্যর্থ হয়েছে: ' + (e.message || ''));
      } finally {
        setActionLoadingId(null);
      }
    };

    if (typeof requestConfirm === 'function') {
      requestConfirm('রিচার্জ অনুমোদন', `আপনি কি নিশ্চিত যে ${num} নম্বরে ৳${(tx.amount || 0).toLocaleString('bn-BD')} রিচার্জ সফল করতে চান?`, doApprove);
    } else {
      if (window.confirm(`আপনি কি নিশ্চিত যে ${num} নম্বরে ৳${(tx.amount || 0).toLocaleString('bn-BD')} রিচার্জ সফল করতে চান?`)) {
        await doApprove();
      }
    }
  };

  // Reject Recharge & Refund Balance
  const handleRejectRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingTx) return;

    const tx = rejectingTx;
    setActionLoadingId(tx.id);
    try {
      // 1. Refund to User's Telecom / Main Wallet
      if (tx.userId) {
        const uDocRef = doc(db, 'users', tx.userId);
        // If user paid from telecom balance, return to telecom balance; else main balance
        await updateDoc(uDocRef, {
          telecomBalance: increment(Number(tx.amount) || 0)
        });
      }

      // 2. Update Transaction Status
      await updateDoc(doc(db, 'transactions', tx.id), {
        status: 'rejected',
        rejectionReason: rejectionReason,
        refunded: true,
        processedBy: 'admin',
        processedAt: serverTimestamp()
      });

      // 3. Dispatch Notification
      if (tx.userId) {
        await addDoc(collection(db, 'user_notifications'), {
          userId: tx.userId,
          title: '❌ রিচার্জ বাতিল ও ব্যালেন্স রিফান্ড',
          message: `${tx.recipientNumber || tx.phoneNumber} নম্বরে ৳${(tx.amount || 0).toLocaleString('bn-BD')} রিচার্জ বাতিল হয়েছে। কারণ: "${rejectionReason}"। টাকা আপনার রিচার্জ ওয়ালেটে রিফান্ড করা হয়েছে।`,
          type: 'error',
          category: 'telecom',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      requestAlert('সফল', 'রিচার্জ বাতিল করা হয়েছে এবং গ্রাহকের ব্যালেন্স রিফান্ড হয়েছে!');
      setRejectingTx(null);
    } catch (e: any) {
      console.error('Error rejecting recharge:', e);
      requestAlert('ত্রুটি', 'বাতিলকরণ ব্যর্থ হয়েছে: ' + (e.message || ''));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="w-full text-left space-y-4 animate-fade-in text-slate-800" id="admin-auto-recharge-section">
      {/* 1. Header Navigation Bar */}
      <div className="bg-gradient-to-r from-sky-700 via-blue-800 to-indigo-900 rounded-2xl p-4 text-white shadow-md flex items-center justify-between gap-3 border border-sky-400/30 flex-wrap">
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
              <span className="p-1 rounded-lg bg-sky-500/30 text-sky-200">
                <Zap className="w-4 h-4 fill-sky-300" />
              </span>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                AMB অটো রিচার্জ গেটওয়ে এডমিন কন্ট্রোল
              </h1>
            </div>
            <p className="text-xs text-sky-200 font-medium mt-0.5">
              মডেম সিম কার্ড কনফিগারেশন, লাইভ রিচার্জ কিউ ও স্বয়ংক্রিয় প্রসেসিং রুলস
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 border shadow-2xs ${
            autoRechargeActive 
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' 
              : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${autoRechargeActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span>{autoRechargeActive ? '🟢 গেটওয়ে সচল (AUTO ON)' : '🔴 গেটওয়ে বন্ধ (AUTO OFF)'}</span>
          </span>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold">মোট সিম ব্যালেন্স</span>
            <Smartphone className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-base sm:text-lg font-black text-slate-900 font-mono">
            ৳{totalSimBalance.toLocaleString('bn-BD')}
          </p>
          <span className="text-[9px] text-slate-400 font-semibold">{simGateways.length}টি সক্রিয় সিম স্লট</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold">পেন্ডিং রিচার্জ</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-base sm:text-lg font-black text-amber-600 font-mono">
            {pendingCount} টি
          </p>
          <span className="text-[9px] text-amber-600/80 font-semibold">তাৎক্ষণিক অ্যাকশন প্রয়োজন</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold">সফল রিচার্জ</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-base sm:text-lg font-black text-emerald-600 font-mono">
            {successCount} টি
          </p>
          <span className="text-[9px] text-emerald-600/80 font-semibold">সফলভাবে ডেলিভার্ড</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold">অটো থ্রেশহোল্ড</span>
            <Cpu className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-base sm:text-lg font-black text-purple-700 font-mono">
            ৳{Number(autoThreshold).toLocaleString('bn-BD')}
          </p>
          <span className="text-[9px] text-purple-600/80 font-semibold">সর্বোচ্চ অটো এপ্রুভ লিমিট</span>
        </div>
      </div>

      {/* 3. Sub-Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('gateways')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeSubTab === 'gateways'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>📱 সিম ও মডেম গেটওয়ে ({simGateways.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('queue')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeSubTab === 'queue'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>⚡ লাইভ রিচার্জ কিউ ({pendingCount > 0 ? `${pendingCount} পেন্ডিং` : `${filteredTransactions.length} মোট`})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeSubTab === 'settings'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>⚙️ অটোমেশন সেটিংস ও রুলস</span>
        </button>
      </div>

      {/* ======================= TAB 1: SIM GATEWAYS ======================= */}
      {activeSubTab === 'gateways' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>📡</span> সক্রিয় মডেম ও সিম স্লটসমূহ
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                প্রত্যেক অপারেটরের সিম ব্যালেন্স, USSD কোড ও অটো-প্রসেসিং স্ট্যাটাস ম্যানেজ করুন
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenSimModal()}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>নতুন সিম স্লট যুক্ত করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {simGateways.map((sim) => {
              const isLowBalance = sim.balance <= sim.minBalanceAlert;
              return (
                <div
                  key={sim.id}
                  className={`bg-white border rounded-2xl p-3.5 shadow-2xs transition hover:shadow-xs relative overflow-hidden flex flex-col justify-between ${
                    isLowBalance ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
                  }`}
                >
                  {/* Top Bar */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-sky-100 text-sky-700 font-mono font-black flex items-center justify-center text-xs shadow-2xs">
                          S{sim.simSlot}
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 leading-tight">{sim.operator}</h4>
                          <p className="text-[10px] font-mono text-slate-500 font-bold">{sim.phone}</p>
                        </div>
                      </div>

                      {/* Auto Active Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleSimAuto(sim.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition border ${
                          sim.autoActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {sim.autoActive ? '🟢 AUTO ON' : '⚪ MANUAL'}
                      </button>
                    </div>

                    {/* Balance Display */}
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 my-2">
                      <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold mb-0.5">
                        <span>সিম ব্যালেন্স</span>
                        <span className="font-mono text-slate-400">USSD: {sim.ussdCode}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-base font-black text-slate-900 font-mono">
                          ৳{Number(sim.balance).toLocaleString('bn-BD')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setBalanceModalSim(sim);
                            setNewSimBalanceInput(String(sim.balance));
                          }}
                          className="text-[10px] text-sky-600 hover:text-sky-700 font-black underline cursor-pointer"
                        >
                          ব্যালেন্স আপডেট
                        </button>
                      </div>

                      {isLowBalance && (
                        <div className="mt-1.5 flex items-center gap-1 text-[9.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>সতর্কতা: সিম ব্যালেন্স ৳{sim.minBalanceAlert} এর নিচে নেমেছে!</span>
                        </div>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 font-medium pt-1">
                      <div>দৈনিক লিমিট: <span className="font-mono font-bold text-slate-700">৳{sim.dailyLimit}</span></div>
                      <div className="text-right">আজকের ট্রাফিক্স: <span className="font-mono font-bold text-slate-700">{sim.dailyCount} টি</span></div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2.5">
                    <span className="text-[9px] text-slate-400 font-mono">আপডেট: {sim.lastUpdated || 'সম্প্রতি'}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenSimModal(sim)}
                        className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                        title="এডিট করুন"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSim(sim)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================= TAB 2: LIVE RECHARGE QUEUE ======================= */}
      {activeSubTab === 'queue' && (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'all' ? 'bg-sky-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                সকল ({rechargeTransactions.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-2xs' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span>পেন্ডিং ({pendingCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('success')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'success' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                সফল ({successCount})
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
                placeholder="নম্বর / নাম / ট্রানজেকশন..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-sky-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* List */}
          {filteredTransactions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-14 text-center text-slate-400 space-y-2">
              <Zap className="w-8 h-8 mx-auto text-slate-300 opacity-60" />
              <p className="text-xs font-bold">কোনো রিচার্জ লেনদেন পাওয়া যায়নি!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((tx) => {
                const isPending = tx.status === 'pending';
                const isSuccess = tx.status === 'success' || (tx.status as any) === 'approved';
                const isRejected = (tx.status as any) === 'rejected' || (tx.status as any) === 'failed';
                const u = users.find(usr => usr.uid === tx.userId || usr.phone === tx.userPhone);

                return (
                  <div
                    key={tx.id}
                    className={`bg-white border rounded-2xl p-3 shadow-2xs transition hover:shadow-xs flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap ${
                      isPending ? 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-200/50' : 'border-slate-200'
                    }`}
                  >
                    {/* Left: Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 font-black text-xs ${
                        (tx.operator || '').toLowerCase().includes('gp') || (tx.operator || '').toLowerCase().includes('grameen') ? 'bg-sky-500' :
                        (tx.operator || '').toLowerCase().includes('bl') || (tx.operator || '').toLowerCase().includes('banglalink') ? 'bg-orange-500' :
                        (tx.operator || '').toLowerCase().includes('robi') ? 'bg-red-500' :
                        (tx.operator || '').toLowerCase().includes('airtel') ? 'bg-rose-600' :
                        (tx.operator || '').toLowerCase().includes('teletalk') ? 'bg-emerald-600' : 'bg-indigo-600'
                      }`}>
                        {tx.operator ? tx.operator.substring(0, 2).toUpperCase() : 'RC'}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-900 font-mono">
                            {tx.recipientNumber || tx.phoneNumber || 'নম্বরবিহীন'}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700">
                            {tx.operator || 'ফ্লেক্সিলোড'}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-black ${
                            isPending ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                            isSuccess ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                            'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}>
                            {isPending ? '🟡 পেন্ডিং' : isSuccess ? '✅ সফল' : '❌ বাতিল'}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span>গ্রাহক: <strong className="text-slate-600">{tx.userName || u?.name || 'ইউজার'}</strong></span>
                          <span>•</span>
                          <span>তারিখ: {tx.date || 'চলতি'} ({tx.time || ''})</span>
                          <span>•</span>
                          <span className="font-mono text-slate-400">ID: {tx.id.substring(0, 8)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                      <div className="text-right">
                        <span className="text-sm sm:text-base font-black text-slate-900 font-mono block">
                          ৳{(Number(tx.amount) || 0).toLocaleString('bn-BD')}
                        </span>
                        <span className="text-[9.5px] text-sky-600 font-bold">রিচার্জ ওয়ালেট</span>
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={actionLoadingId === tx.id}
                            onClick={() => {
                              setRejectingTx(tx);
                              setRejectionReason('নম্বর ভুল বা বন্ধ পাওয়া গেছে');
                            }}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            বাতিল
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingId === tx.id}
                            onClick={() => handleApproveRecharge(tx)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-xs active:scale-95 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>অনুমোদন</span>
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

      {/* ======================= TAB 3: SETTINGS & RULES ======================= */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span>⚙️</span> গেটওয়ে পলিসি ও অটোমেশন রুলস
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              ইউজার অ্যাপে অটো রিচার্জ ইন্টারফেসের নির্দেশিকা, সর্বোচ্চ অটো এপ্রুভ লিমিট ও বিজ্ঞপ্তি পরিবর্তন করুন
            </p>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Global Switch */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div>
                <h4 className="font-black text-slate-800">গ্লোবাল অটো রিচার্জ গেটওয়ে সার্ভিস</h4>
                <p className="text-[11px] text-slate-500">অন থাকলে গ্রাহকরা ২৪/৭ স্বয়ংক্রিয় রিচার্জ রিকোয়েস্ট পাঠাতে পারবেন</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoRechargeActive(!autoRechargeActive)}
                className={`w-12 h-6.5 rounded-full transition p-0.5 cursor-pointer ${
                  autoRechargeActive ? 'bg-sky-600' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5.5 h-5.5 rounded-full bg-white transition shadow-xs ${
                  autoRechargeActive ? 'translate-x-5.5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Threshold limit */}
            <div className="space-y-1">
              <label className="block font-black text-slate-700">
                স্বয়ংক্রিয় এপ্রুভাল লিমিট (Auto Threshold Amount - BDT)
              </label>
              <input
                type="number"
                value={autoThreshold}
                onChange={(e) => setAutoThreshold(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:border-sky-500 focus:bg-white"
                placeholder="যেমন: 1000"
                required
              />
              <p className="text-[10px] text-slate-400">এই পরিমাণের নিচের সকল রিচার্জ সার্ভার তাৎক্ষণিক স্বয়ংক্রিয়ভাবে সিম মডেম দিয়ে সফল করবে। এর ওপরের এন্ট্রিগুলো এডমিন পেন্ডিং তালিকায় যাবে।</p>
            </div>

            {/* Ticker Notice */}
            <div className="space-y-1">
              <label className="block font-black text-slate-700">
                ইউজার অ্যাপ অটো রিচার্জ স্ক্রল নোটিশ (Ticker)
              </label>
              <textarea
                value={autoTicker}
                onChange={(e) => setAutoTicker(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-sky-500 focus:bg-white"
                placeholder="স্ক্রল নোটিশ লিখুন..."
              />
            </div>

            {/* Policy & Terms */}
            <div className="space-y-1">
              <label className="block font-black text-slate-700">
                রিচার্জ নির্দেশিকা ও নিয়মাবলী (Terms & Guidelines)
              </label>
              <textarea
                value={autoPolicyText}
                onChange={(e) => setAutoPolicyText(e.target.value)}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-sky-500 focus:bg-white"
                placeholder="১. নিয়মাবলী লিখুন..."
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>সেটিংস ও নিয়মাবলী সংরক্ষণ করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ======================= MODAL: SIM CREATE / EDIT ======================= */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3">
          <form onSubmit={handleSaveSingleSim} className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-4 sm:p-5 space-y-3.5 text-xs shadow-2xl text-left animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-sky-600" />
                <span>{editingSim ? 'সিম স্লট কনফিগারেশন এডিট' : 'নতুন মডেম সিম স্লট যুক্ত করুন'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10.5px] font-black text-slate-600 mb-1">অপারেটর</label>
                  <select
                    value={simOp}
                    onChange={(e: any) => setSimOp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                  >
                    <option value="Grameenphone">Grameenphone</option>
                    <option value="Banglalink">Banglalink</option>
                    <option value="Robi">Robi</option>
                    <option value="Airtel">Airtel</option>
                    <option value="Teletalk">Teletalk</option>
                    <option value="Skitto">Skitto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black text-slate-600 mb-1">স্লট নম্বর</label>
                  <input
                    type="number"
                    value={simSlotNum}
                    onChange={(e) => setSimSlotNum(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                    placeholder="1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-black text-slate-600 mb-1">সিম মোবাইল নম্বর</label>
                <input
                  type="text"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold outline-none"
                  placeholder="017XXXXXXXX"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10.5px] font-black text-slate-600 mb-1">বর্তমান ব্যালেন্স (৳)</label>
                  <input
                    type="number"
                    value={simBal}
                    onChange={(e) => setSimBal(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                    placeholder="10000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-black text-slate-600 mb-1">USSD চেক কোড</label>
                  <input
                    type="text"
                    value={simUssd}
                    onChange={(e) => setSimUssd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                    placeholder="*566#"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10.5px] font-black text-slate-600 mb-1">লো-ব্যালেন্স অ্যালার্ট (৳)</label>
                  <input
                    type="number"
                    value={simAlertBal}
                    onChange={(e) => setSimAlertBal(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                    placeholder="500"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-black text-slate-600 mb-1">দৈনিক সর্বোচ্চ লিমিট (৳)</label>
                  <input
                    type="number"
                    value={simLimit}
                    onChange={(e) => setSimLimit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                    placeholder="50000"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================= MODAL: QUICK BALANCE UPDATE ======================= */}
      {balanceModalSim && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3">
          <form onSubmit={handleUpdateSimBalance} className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-4 space-y-3 text-xs shadow-2xl text-left animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-900">
                {balanceModalSim.operator} (স্লট {balanceModalSim.simSlot}) ব্যালেন্স আপডেট
              </h3>
              <button
                type="button"
                onClick={() => setBalanceModalSim(null)}
                className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-600 mb-1">নতুন ব্যালেন্স (টাকা)</label>
              <input
                type="number"
                value={newSimBalanceInput}
                onChange={(e) => setNewSimBalanceInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-black font-mono outline-none focus:border-sky-500 focus:bg-white"
                placeholder="যেমন: 15000"
                required
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBalanceModalSim(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
              >
                আপডেট করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================= MODAL: REJECT RECHARGE ======================= */}
      {rejectingTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3">
          <form onSubmit={handleRejectRecharge} className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-4 space-y-3 text-xs shadow-2xl text-left animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-rose-600 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                <span>রিচার্জ বাতিল ও রিফান্ড</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectingTx(null)}
                className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-[11px] text-rose-900 space-y-1">
              <p>গ্রাহকের ৳{(Number(rejectingTx.amount) || 0).toLocaleString('bn-BD')} টাকা স্বয়ংক্রিয়ভাবে তার ওয়ালেটে রিফান্ড করা হবে।</p>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 mb-1">বাতিলের কারণ</label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none mb-1.5"
              >
                <option value="নম্বর ভুল বা বন্ধ পাওয়া গেছে">নম্বর ভুল বা বন্ধ পাওয়া গেছে</option>
                <option value="অপারেটর সার্ভারে সমস্যা / ডাউন">অপারেটর সার্ভারে সমস্যা / ডাউন</option>
                <option value="প্রিপেইড/পোস্টপেইড ধরন অমিল">প্রিপেইড/পোস্টপেইড ধরন অমিল</option>
                <option value="গ্রাহকের অনুরোধে বাতিল">গ্রাহকের অনুরোধে বাতিল</option>
              </select>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none"
                placeholder="কাস্টম কারণ লিখুন..."
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectingTx(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                ফিরে যান
              </button>
              <button
                type="submit"
                disabled={actionLoadingId === rejectingTx.id}
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
