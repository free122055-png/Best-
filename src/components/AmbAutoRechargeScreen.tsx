import React, { useState } from 'react';
import { User, Transaction, AppConfig, generateAmbTrxId, formatShortTrxId } from '../types';
import { db } from '../lib/firebase';
import UnifiedBackButton from './UnifiedBackButton';
import { doc, updateDoc, setDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { 
  Smartphone, 
  CheckCircle, 
  X, 
  Zap,
  RefreshCw,
  History,
  Search,
  ClipboardList,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Check,
  Copy,
  Plus,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AmbPaymentReceiptModal, PaymentReceiptData } from './AmbPaymentReceiptModal';

// Helper functions for operator-specific cashback rules matching
const isOperatorMatch = (ruleOpRaw?: string, targetOpRaw?: string): boolean => {
  const rOp = (ruleOpRaw || 'all').trim().toLowerCase();
  const tOp = (targetOpRaw || '').trim().toLowerCase();

  if (rOp === 'all' || rOp === 'সকল অপারেটর') return true;
  if (rOp === tOp) return true;

  const opAliases: Record<string, string[]> = {
    'grameenphone': ['gp', 'গ্রামীন', 'গ্রামীনফোন', 'grameenphone'],
    'robi': ['robi', 'রবি'],
    'airtel': ['airtel', 'এয়ারটেল'],
    'banglalink': ['bl', 'বাংলালিংক', 'banglalink'],
    'teletalk': ['teletalk', 'টেলিটক'],
    'skitto': ['skitto', 'স্কিটো'],
    'alaap': ['alaap', 'আলাপ'],
    'brilliant': ['brilliant', 'ব্রিলিয়ান্ট']
  };

  for (const [canonical, aliases] of Object.entries(opAliases)) {
    const isTargetInGroup = tOp === canonical || aliases.includes(tOp);
    const isRuleInGroup = rOp === canonical || aliases.includes(rOp);
    if (isTargetInGroup && isRuleInGroup) return true;
  }

  return false;
};

const getMatchedCashbackForRule = (rules: any[] = [], amount: number, operator: string): number => {
  let matchedCashback = 0;
  let foundSpecific = false;

  for (const r of rules) {
    if (Number(r.amount) !== amount) continue;
    const rOp = (r.operator || 'all').trim().toLowerCase();

    // Specific operator rule takes priority
    if (rOp !== 'all' && rOp !== 'সকল অপারেটর' && isOperatorMatch(rOp, operator)) {
      return Number(r.cashback);
    }

    // Generic 'all' operator rule fallback
    if ((rOp === 'all' || rOp === 'সকল অপারেটর') && !foundSpecific) {
      matchedCashback = Number(r.cashback);
    }
  }

  return matchedCashback;
};

const getFilteredRulesForOperator = (rules: any[] = [], operator: string) => {
  if (!rules || rules.length === 0) return [];
  const tOp = (operator || '').trim().toLowerCase();

  const filtered = rules.filter(r => {
    const rOp = (r.operator || 'all').trim().toLowerCase();
    if (rOp === 'all' || rOp === 'সকল অপারেটর') return true;
    return isOperatorMatch(rOp, tOp);
  });

  return [...filtered].sort((a, b) => Number(a.amount) - Number(b.amount));
};

interface AmbAutoRechargeScreenProps {
  user: User;
  onBack: () => void;
  syncLiveProfile: () => void;
  appConfig?: AppConfig;
}

export default function AmbAutoRechargeScreen({
  user,
  onBack,
  syncLiveProfile,
  appConfig
}: AmbAutoRechargeScreenProps) {
  const [operator, setOperator] = useState<string>('');
  const [rechargeAmount, setRechargeAmount] = useState<string>('');
  const [recipientNumber, setRecipientNumber] = useState<string>('');
  const [rechargePin, setRechargePin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<boolean>(false);

  // Add Money to Recharge Balance Modal State
  const [showAddBalanceModal, setShowAddBalanceModal] = useState<boolean>(false);
  const [addBalanceAmount, setAddBalanceAmount] = useState<string>('');
  const [addBalancePin, setAddBalancePin] = useState<string>('');
  const [addBalanceMsg, setAddBalanceMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Transaction History Modal State
  const [showTxHistoryModal, setShowTxHistoryModal] = useState<boolean>(false);
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState<boolean>(false);
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');
  const [txFilterTab, setTxFilterTab] = useState<'all' | 'recharge' | 'add_balance'>('all');

  // Full-screen receipt modal state
  const [receiptModalData, setReceiptModalData] = useState<PaymentReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);

  const operatorsList = [
    { id: 'Grameenphone', short: 'GP', name: 'Grameenphone', color: 'bg-blue-500', border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-900' },
    { id: 'Robi', short: 'Robi', name: 'Robi', color: 'bg-red-500', border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-900' },
    { id: 'Airtel', short: 'Airtel', name: 'Airtel', color: 'bg-rose-600', border: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-900' },
    { id: 'Banglalink', short: 'BL', name: 'Banglalink', color: 'bg-orange-500', border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-900' },
    { id: 'Teletalk', short: 'Tele', name: 'Teletalk', color: 'bg-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-900' },
    { id: 'Skitto', short: 'Skitto', name: 'Skitto', color: 'bg-yellow-400', border: 'border-yellow-200', bg: 'bg-yellow-50', text: 'text-yellow-900' }
  ];

  // Fetch recharge history
  const fetchTxHistory = async () => {
    setLoadingTx(true);
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const list: Transaction[] = [];
      snapshot.forEach(docSnap => {
        const d = { id: docSnap.id, ...docSnap.data() } as Transaction;
        if (
          d.type === 'telecom_recharge' || 
          d.type === 'telecom_add_balance' || 
          (d.typeLabel && d.typeLabel.includes('রিচার্জ')) ||
          (d.typeLabel && d.typeLabel.includes('টেলিকম'))
        ) {
          list.push(d);
        }
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setTxHistory(list);
    } catch (e) {
      console.error("Error fetching recharge tx history:", e);
    } finally {
      setLoadingTx(false);
    }
  };

  // Open receipt for transaction
  const openReceiptForTx = (tx: any) => {
    setReceiptModalData({
      typeLabel: tx.typeLabel || 'অটো মোবাইল রিচার্জ',
      transactionId: formatShortTrxId(tx.transactionId || tx.trxId || tx.id),
      amount: tx.amount || 0,
      fee: 0,
      totalAmount: tx.amount || 0,
      status: tx.status || 'pending',
      beneficiaryName: tx.userName || user.name || 'AMB সদস্য',
      beneficiaryAccount: tx.memberId || user.memberId || user.phone,
      senderPhone: tx.phone || tx.receiverPhone || user.phone || 'N/A',
      paymentMethod: tx.operator || tx.paymentMethod || 'AMB রিচার্জ',
      description: tx.description,
      transactionDate: tx.createdAt ? new Date(tx.createdAt).toLocaleString('bn-BD', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      }) : new Date().toLocaleString('bn-BD')
    });
    setIsReceiptOpen(true);
  };

  // Add Money from Main Balance to Telecom Balance with 2% commission (হাজারে ২০ টাকা)
  const handleAddBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddBalanceMsg(null);

    const amt = Number(addBalanceAmount);
    if (!amt || amt < 10) {
      setAddBalanceMsg({ text: 'সর্বনিম্ন ৳১০ অ্যাড করা যাবে।', type: 'error' });
      return;
    }

    if (amt > (user.balance || 0)) {
      setAddBalanceMsg({ text: 'আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই!', type: 'error' });
      return;
    }

    if (addBalancePin !== user.pin) {
      setAddBalanceMsg({ text: 'ভুল সিকিউরিটি পিন নম্বর!', type: 'error' });
      return;
    }

    setIsProcessing(true);
    try {
      const commission = amt * 0.02; // 2% bonus (হাজারে ২০ টাকা)
      const totalToAdd = amt + commission;
      
      const newMainBalance = (user.balance || 0) - amt;
      const newTelecomBalance = (user.telecomBalance || 0) + totalToAdd;

      // Optimistic state update
      user.balance = newMainBalance;
      user.telecomBalance = newTelecomBalance;

      const txId = `tx-addbal-${Date.now()}`;
      const newTx: Transaction = {
        id: txId,
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId,
        type: 'telecom_add_balance',
        typeLabel: 'রিচার্জ ব্যালেন্স অ্যাড',
        amount: amt,
        status: 'approved',
        description: `মেইন ব্যালেন্স থেকে ৳${amt.toLocaleString()} রিচার্জ ব্যালেন্সে অ্যাড করা হয়েছে। (২% বোনাস কমিশন ৳${commission.toFixed(2)} সহ মোট ৳${totalToAdd.toFixed(2)} রিচার্জ ওয়ালেটে যুক্ত হয়েছে)।`,
        createdAt: new Date().toISOString(),
        rechargeCommission: commission,
        operator: 'AMB Telecom'
      } as any;

      // Real-time notification
      const notifId = `notif-${Date.now()}`;
      const newNotif = {
        id: notifId,
        userId: user.uid,
        title: 'রিচার্জ ব্যালেন্স অ্যাড সফল',
        message: `৳${amt.toLocaleString()} টাকা অ্যাড সফল। ২% বোনাস (৳${commission.toFixed(2)}) সহ ৳${totalToAdd.toFixed(2)} রিচার্জ ব্যালেন্সে যোগ হয়েছে।`,
        type: 'balance_added',
        isRead: false,
        createdAt: new Date().toISOString()
      };

      // Background Firestore save
      (async () => {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            balance: newMainBalance,
            telecomBalance: newTelecomBalance
          });
          await setDoc(doc(db, 'transactions', newTx.id), newTx, { merge: true });

          await setDoc(doc(db, 'user_notifications', notifId), newNotif, { merge: true });
        } catch (dbErr) {
          console.error("Firestore add balance error:", dbErr);
        }
      })();

      syncLiveProfile();
      setAddBalanceMsg({ text: `সফলভাবে ৳${totalToAdd.toFixed(2)} (২% বোনাস সহ) রিচার্জ ব্যালেন্সে যুক্ত হয়েছে!`, type: 'success' });

      setTimeout(() => {
        setShowAddBalanceModal(false);
        setAddBalanceAmount('');
        setAddBalancePin('');
        setAddBalanceMsg(null);
      }, 1400);

    } catch (err: any) {
      console.error(err);
      setAddBalanceMsg({ text: 'ব্যালেন্স অ্যাড ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!operator) {
      setErrorMessage('অপারেটর সিলেক্ট করুন যেকোনো একটা!');
      return;
    }

    const reloadAmt = Number(rechargeAmount);
    if (!reloadAmt || reloadAmt < 10) {
      setErrorMessage('সর্বনিম্ন রিচার্জ 10 টাকা হতে হবে।');
      return;
    }

    const cleanCashNumber = recipientNumber.trim();
    const isNumeric = /^\d+$/.test(cleanCashNumber);
    if (!cleanCashNumber || cleanCashNumber.length !== 11 || !isNumeric) {
      setErrorMessage('11 ডিজিটের সঠিক মোবাইল নম্বর লিখুন (মেম্বার আইডি বা অক্ষর গ্রহণযোগ্য নয়)।');
      return;
    }

    const availableTelecom = user.telecomBalance || 0;
    if (availableTelecom < reloadAmt) {
      setErrorMessage(`অপর্যাপ্ত রিচার্জ ব্যালেন্স (আছে: ৳${availableTelecom.toLocaleString('bn-BD')})! দয়া করে উপরে "+ Add" বাটনে ক্লিক করে মেইন থেকে রিচার্জ ব্যালেন্সে টাকা যুক্ত করুন (২% বোনাস সহ)।`);
      return;
    }

    if (rechargePin !== user.pin) {
      setErrorMessage('ভুল সিকিউরিটি পিন নম্বর! পুনরায় সঠিক পিন দিন।');
      return;
    }

    try {
      setIsProcessing(true);

      const remainingTelecom = availableTelecom - reloadAmt;
      user.telecomBalance = remainingTelecom;
      const updateFields = { telecomBalance: remainingTelecom };

      const ambTrxId = generateAmbTrxId('BN');
      const txId = `tx-auto-${ambTrxId}`;
      const typeLabel = 'অটো মোবাইল রিচার্জ';

      const description = `${operator} নম্বরে (${cleanCashNumber}) ৳${reloadAmt.toLocaleString('bn-BD')} ইনস্ট্যান্ট অটো রিচার্জের রিকোয়েস্ট সম্পন্ন হয়েছে (রিচার্জ ব্যালেন্স থেকে প্রদেয়)।`;
          
      const newTx: Transaction = {
        id: txId,
        transactionId: ambTrxId,
        receiptNo: ambTrxId,
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId,
        type: 'telecom_recharge',
        typeLabel: typeLabel,
        amount: reloadAmt,
        status: 'pending',
        description: description,
        createdAt: new Date().toISOString(),
        phone: cleanCashNumber,
        receiverPhone: cleanCashNumber,
        paymentMethod: 'রিচার্জ ব্যালেন্স',
        operator: operator
      } as any;

      setPurchaseSuccess(true);
      setIsProcessing(false);
      syncLiveProfile();
      
      // Async background save to Firestore
      (async () => {
        try {
          await updateDoc(doc(db, 'users', user.uid), updateFields);
          await setDoc(doc(db, 'transactions', newTx.id), newTx, { merge: true });
          addDoc(collection(db, 'admin_notifications'), {
            title: '⚡ নতুন BNB অটো রিচার্জ রিকোয়েস্ট',
            message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ${operator} নম্বরে (${cleanCashNumber}) ৳${reloadAmt.toLocaleString('bn-BD')} টাকা অটো রিচার্জের আবেদন করেছেন।`,
            userId: user.uid,
            userName: user.name || '',
            memberId: user.memberId || '',
            recipientPhone: cleanCashNumber,
            operator: operator,
            amount: reloadAmt,
            type: 'telecom_recharge',
            read: false,
            createdAt: new Date().toISOString()
          }).catch(e => console.warn('Admin notif error:', e));
        } catch (dbErr) {
          console.error("Firestore auto recharge save error:", dbErr);
        }
      })();

      // Show Full-Screen Transaction Receipt Modal
      setReceiptModalData({
        typeLabel: typeLabel,
        transactionId: ambTrxId,
        amount: reloadAmt,
        fee: 0,
        totalAmount: reloadAmt,
        status: 'pending',
        beneficiaryName: user.name,
        beneficiaryAccount: user.memberId || user.phone,
        senderPhone: cleanCashNumber,
        paymentMethod: `${operator} (রিচার্জ ব্যালেন্স)`,
        description: description,
        transactionDate: new Date().toLocaleString('bn-BD', {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          hour12: true
        })
      });
      setIsReceiptOpen(true);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`রিচার্জ সম্পন্নকরণে ত্রুটি ঘটেছেঃ ${err?.message || 'সার্ভার সংযোগ সমস্যা'}`);
      setIsProcessing(false);
    }
  };

  const opRules = getFilteredRulesForOperator(appConfig?.rechargeCashbackRules || [], operator);

  // Filtered transactions for History Modal
  const filteredTxHistory = txHistory.filter(tx => {
    const matchesSearch = 
      (tx.phone && tx.phone.includes(txSearchQuery)) ||
      (tx.operator && tx.operator.toLowerCase().includes(txSearchQuery.toLowerCase())) ||
      (tx.amount && String(tx.amount).includes(txSearchQuery)) ||
      (tx.typeLabel && tx.typeLabel.toLowerCase().includes(txSearchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (txFilterTab === 'recharge') return tx.type === 'telecom_recharge';
    if (txFilterTab === 'add_balance') return tx.type === 'telecom_add_balance';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top App Header */}
      <header className="bg-gradient-to-r from-cyan-900 via-indigo-900 to-indigo-950 text-white p-3 sm:p-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          
          {/* Left section: Back button & Title + Main Balance pill in red-marked area */}
          <div className="flex items-center gap-2">
            <UnifiedBackButton onClick={onBack} label="ড্যাশবোর্ড" variant="glass" />
            <div>
              <h1 className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                AMB মোবাইল রিচার্জ (অটো)
              </h1>
              {/* Red-marked area: Main Balance Pill right under title */}
              <div 
                onClick={syncLiveProfile}
                className="mt-0.5 inline-flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 px-2 py-0.5 rounded-lg text-[9.5px] font-black text-emerald-300 cursor-pointer transition active:scale-95 shadow-3xs"
                title="মেইন ব্যালেন্স রিফ্রেশ করুন"
              >
                <span className="text-[8px] text-emerald-200 font-sans">মেইনঃ</span>
                <span className="font-mono text-emerald-300 font-black">৳{(user.balance || 0).toLocaleString('bn-BD')}</span>
                <RefreshCw className="w-2.5 h-2.5 text-emerald-300 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Right section: Recharge Balance (where main balance was) & History Button (Green arrow spot) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Recharge Balance Box with + Add button */}
            <div className="bg-white/10 backdrop-blur-md px-2 py-1 rounded-xl border border-white/15 text-right flex items-center gap-1.5 shadow-3xs">
              <div>
                <span className="text-[7.5px] text-rose-200 block leading-none font-bold">রিচার্জ ব্যালেন্স</span>
                <span className="text-[11px] sm:text-xs font-black text-rose-300 font-mono">৳{(user.telecomBalance || 0).toLocaleString('bn-BD')}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddBalanceAmount('');
                  setAddBalancePin('');
                  setAddBalanceMsg(null);
                  setShowAddBalanceModal(true);
                }}
                className="bg-rose-500 hover:bg-rose-600 text-white text-[8.5px] font-black px-1.5 py-1 rounded-md transition active:scale-95 cursor-pointer shadow-xs"
                title="মেইন ব্যালেন্স থেকে রিচার্জ ব্যালেন্সে টাকা অ্যাড করুন (২% বোনাস)"
              >
                + Add
              </button>
            </div>

            {/* History Button - Green Arrow Place */}
            <button
              type="button"
              onClick={() => {
                fetchTxHistory();
                setShowTxHistoryModal(true);
              }}
              className="bg-indigo-500/30 hover:bg-indigo-500/45 border border-indigo-400/30 text-indigo-100 p-1.5 sm:px-2 sm:py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-3xs"
              title="রিচার্জ লেনদেন হিস্ট্রি"
            >
              <History className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden xs:inline">হিস্ট্রি</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Form */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 pb-10">
        
        {/* Ticker / Notice */}
        <div className="bg-cyan-50 border border-cyan-200/80 rounded-2xl p-3 flex items-center gap-2.5 shadow-3xs">
          <div className="w-7 h-7 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <p className="text-[10.5px] font-bold text-cyan-950 leading-relaxed">
            সব অপারেটরে ইনস্ট্যান্ট অটো মোবাইল রিচার্জ ও স্পেশাল ক্যাশব্যাক অফার স্ল্যাব সচল রয়েছে। মেইন থেকে রিচার্জ ওয়ালেটে টাকা অ্যাডে ২% বোনাস!
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-250 text-rose-800 p-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-3xs">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={() => setErrorMessage('')} className="text-rose-500 font-black cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
          
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            
            {/* Operator Selection Grid */}
            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-600 font-black tracking-wide">
                অপারেটর নির্বাচন করুন
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {operatorsList.map((op) => {
                  const isSelected = operator === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setOperator(op.id)}
                      className={`py-2 px-1 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                        isSelected 
                          ? `${op.bg} ${op.border} border-2 ring-2 ring-indigo-500/30 font-black scale-102 shadow-xs` 
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black text-white ${op.color} shadow-xs`}>
                        {op.short}
                      </div>
                      <span className="text-[8.5px] font-black block leading-none truncate max-w-full">
                        {op.short}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recipient Mobile Number */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] text-slate-600 font-black">প্রাপক মোবাইল নম্বর</label>
                <button 
                  type="button" 
                  onClick={() => setRecipientNumber(user.phone || '')} 
                  className="text-[10px] text-cyan-700 hover:underline font-extrabold"
                >
                  নিজের নম্বর ব্যবহার করুন ({user.phone || 'N/A'})
                </button>
              </div>
              <input
                type="tel"
                required
                maxLength={11}
                value={recipientNumber}
                onChange={(e) => setRecipientNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="01XXXXXXXXX (11 ডিজিট)"
                className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl font-mono text-sm font-bold text-slate-800 focus:bg-white focus:border-cyan-600 focus:outline-none transition"
              />
            </div>

            {/* Recharge Amount */}
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-600 font-black">রিচার্জের পরিমাণ (৳)</label>
              <input
                type="number"
                required
                min={10}
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                placeholder="10 - 1000 টাকা"
                className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl font-mono text-sm font-bold text-slate-800 focus:bg-white focus:border-cyan-600 focus:outline-none transition"
              />
            </div>

            {/* 4-digit Security PIN */}
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-600 font-black">আপনার 4 ডিজিটের গোপন পিন নম্বর</label>
              <input
                type="password"
                required
                maxLength={4}
                value={rechargePin}
                onChange={(e) => setRechargePin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl text-center font-mono text-base tracking-widest text-slate-800 focus:bg-white focus:border-cyan-600 focus:outline-none transition"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-700 to-indigo-800 hover:from-cyan-800 hover:to-indigo-900 text-white font-black rounded-2xl text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-98 mt-2"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white" />
                  <span>ইনস্ট্যান্ট রিচার্জ সম্পন্ন করুন</span>
                </>
              )}
            </button>

          </form>

        </div>

      </main>

      {/* ================= MODAL 1: ADD MONEY TO RECHARGE BALANCE (2% BONUS / হাজারে ২০ টাকা) ================= */}
      <AnimatePresence>
        {showAddBalanceModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }} 
              className="bg-white w-full max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 text-slate-800 font-sans"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">রিচার্জ ব্যালেন্স অ্যাড মানি</h3>
                    <p className="text-[10px] text-emerald-600 font-black">মেইন ব্যালেন্স থেকে ২% বোনাস (হাজারে ২০ টাকা)</p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowAddBalanceModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Message */}
              {addBalanceMsg && (
                <div className={`p-3 rounded-2xl text-xs font-bold mb-3 flex items-center justify-between ${
                  addBalanceMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                }`}>
                  <span className="leading-snug">{addBalanceMsg.text}</span>
                  <button type="button" onClick={() => setAddBalanceMsg(null)} className="text-slate-500 hover:text-slate-700 ml-2">×</button>
                </div>
              )}

              {/* Wallet Summary */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 mb-4 grid grid-cols-2 gap-2 text-center">
                <div className="bg-white p-2 rounded-xl border border-slate-150">
                  <span className="text-[9px] font-bold text-slate-500 block">মেইন ওয়ালেট</span>
                  <span className="text-xs font-black text-emerald-700 font-mono">৳{(user.balance || 0).toLocaleString('bn-BD')}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-150">
                  <span className="text-[9px] font-bold text-slate-500 block">বর্তমান রিচার্জ</span>
                  <span className="text-xs font-black text-rose-700 font-mono">৳{(user.telecomBalance || 0).toLocaleString('bn-BD')}</span>
                </div>
              </div>

              <form onSubmit={handleAddBalanceSubmit} className="space-y-3.5 text-left">
                <div>
                  <label className="text-[11px] font-black text-slate-700 block mb-1">অ্যাড করার পরিমাণ (৳)</label>
                  <input 
                    type="number" 
                    value={addBalanceAmount} 
                    onChange={(e) => setAddBalanceAmount(e.target.value)} 
                    required 
                    min={10}
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl text-sm font-mono font-bold focus:bg-white focus:border-rose-500 focus:outline-none transition" 
                    placeholder="যেমনঃ 1000" 
                  />
                  
                  {/* Live 2% Bonus Calculation Display */}
                  {Number(addBalanceAmount) > 0 && (
                    <div className="mt-2 p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl space-y-1 text-[10.5px]">
                      <div className="flex justify-between font-bold text-emerald-900">
                        <span>২% বোনাস কমিশন লাভ (হাজারে ২০৳):</span>
                        <span className="font-mono font-black">+৳{(Number(addBalanceAmount) * 0.02).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-black text-emerald-950 border-t border-emerald-200/60 pt-1">
                        <span>মোট রিচার্জ ওয়ালেটে যোগ হবে:</span>
                        <span className="font-mono text-xs text-emerald-700 font-black">
                          ৳{(Number(addBalanceAmount) * 1.02).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-700 block mb-1">আপনার ৪ ডিজিটের পিন নম্বর</label>
                  <input 
                    type="password" 
                    value={addBalancePin} 
                    onChange={(e) => setAddBalancePin(e.target.value.replace(/\D/g, ''))} 
                    required 
                    maxLength={4} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl text-center text-sm font-mono font-bold tracking-widest focus:bg-white focus:border-rose-500 focus:outline-none transition" 
                    placeholder="••••" 
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddBalanceModal(false)} 
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit" 
                    disabled={isProcessing} 
                    className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                  >
                    {isProcessing ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>নিশ্চিত করুন</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL 2: TELECOM & RECHARGE TRANSACTION HISTORY ================= */}
      <AnimatePresence>
        {showTxHistoryModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden text-slate-800 font-sans"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-cyan-900 via-indigo-900 to-indigo-950 text-white px-5 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-cyan-300" />
                  <div>
                    <h3 className="text-sm font-black text-white">মোবাইল রিচার্জ লেনদেন হিস্ট্রি</h3>
                    <p className="text-[10px] text-cyan-200 font-medium">অটো রিচার্জ ও ব্যালেন্স অ্যাডের সম্পূর্ণ বিবরণ</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowTxHistoryModal(false);
                    setTxSearchQuery('');
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition text-white/90 active:scale-90 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search & Tabs */}
              <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input 
                    type="text"
                    value={txSearchQuery}
                    onChange={(e) => setTxSearchQuery(e.target.value)}
                    placeholder="নম্বর, পরিমাণ বা অপারেটর দিয়ে খুঁজুন..."
                    className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                  {txSearchQuery && (
                    <button 
                      onClick={() => setTxSearchQuery('')}
                      className="text-[10px] font-black text-slate-400 hover:text-slate-600 absolute right-3 top-2.5 cursor-pointer"
                    >
                      পরিষ্কার
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTxFilterTab('all')}
                    className={`py-1.5 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                      txFilterTab === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    সকল ({txHistory.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxFilterTab('recharge')}
                    className={`py-1.5 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                      txFilterTab === 'recharge' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    রিচার্জ ({txHistory.filter(t => t.type === 'telecom_recharge').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxFilterTab('add_balance')}
                    className={`py-1.5 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                      txFilterTab === 'add_balance' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    অ্যাড ব্যালেন্স ({txHistory.filter(t => t.type === 'telecom_add_balance').length})
                  </button>
                </div>
              </div>

              {/* Transactions List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {loadingTx ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold">লেনদেন হিস্ট্রি লোড হচ্ছে...</span>
                  </div>
                ) : filteredTxHistory.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-bold space-y-1">
                    <p className="text-2xl">📑</p>
                    <p>কোনো রিচার্জ লেনদেন পাওয়া যায়নি</p>
                  </div>
                ) : (
                  filteredTxHistory.map((tx) => {
                    const isAdd = tx.type === 'telecom_add_balance';
                    const isApproved = tx.status === 'approved' || tx.status === 'success' || tx.status === 'completed';
                    const isRejected = tx.status === 'rejected' || tx.status === 'failed';

                    return (
                      <div
                        key={tx.id}
                        onClick={() => openReceiptForTx(tx)}
                        className="bg-white border border-slate-200 hover:border-indigo-300 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-3xs hover:shadow-xs transition cursor-pointer active:scale-98"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black shrink-0 ${
                            isAdd ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            {isAdd ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900">
                                {tx.typeLabel || (isAdd ? 'রিচার্জ ব্যালেন্স অ্যাড' : 'মোবাইল রিচার্জ')}
                              </span>
                              {tx.operator && (
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[9px] font-black">
                                  {tx.operator}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {tx.phone || tx.receiverPhone ? `নম্বর: ${tx.phone || tx.receiverPhone}` : new Date(tx.createdAt || '').toLocaleString('bn-BD')}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-xs font-black font-mono block ${isAdd ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {isAdd ? '+' : '-'}৳{Number(tx.amount || 0).toLocaleString('bn-BD')}
                          </span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                            isApproved ? 'bg-emerald-100 text-emerald-800' : isRejected ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isApproved ? 'সফল' : isRejected ? 'বাতিল' : 'পেন্ডিং'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
                <button
                  type="button"
                  onClick={() => setShowTxHistoryModal(false)}
                  className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Receipt Modal */}
      {isReceiptOpen && receiptModalData && (
        <AmbPaymentReceiptModal
          isOpen={isReceiptOpen}
          data={receiptModalData}
          onClose={() => {
            setIsReceiptOpen(false);
            setReceiptModalData(null);
          }}
        />
      )}
    </div>
  );
}

