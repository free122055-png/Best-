import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Search, Clock, CheckCircle2, XCircle, RefreshCw, Send, 
  Smartphone, Wallet, ArrowDownLeft, ShieldCheck, ChevronRight,
  Filter, Copy, Eye, Calendar, ArrowUpRight, Check, ChevronDown, ChevronUp, UserCheck,
  Share2, MessageCircle, AlertTriangle, PauseCircle, PlayCircle
} from 'lucide-react';
import { Transaction, User } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, addDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface HeaderPendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  users: User[];
  headerPendingTab: 'all' | 'add_money' | 'withdraw' | 'transfer' | 'telecom' | 'loan' | 'samity_dec25' | 'remittance' | 'bill_pay' | 'other';
  setHeaderPendingTab: (tab: any) => void;
  headerPendingAddMoneyMethod: 'all' | 'bkash' | 'nagad' | 'rocket' | 'upay' | 'cellfin' | 'bank' | 'local_bank' | 'foreign_bank' | 'wallet' | string;
  setHeaderPendingAddMoneyMethod: (method: any) => void;
  headerPendingStatusFilter: 'pending' | 'success' | 'rejected' | 'on_hold' | 'all';
  setHeaderPendingStatusFilter: (status: 'pending' | 'success' | 'rejected' | 'on_hold' | 'all') => void;
  headerPendingSearchQuery: string;
  setHeaderPendingSearchQuery: (query: string) => void;
  headerPendingDateFilter: 'today' | 'yesterday' | 'this_month' | 'custom' | 'all';
  setHeaderPendingDateFilter: (filter: 'today' | 'yesterday' | 'this_month' | 'custom' | 'all') => void;
  headerPendingCustomDate: string;
  setHeaderPendingCustomDate: (date: string) => void;
  handleApproveTransaction: (tx: Transaction) => Promise<void>;
  handleRejectTransaction: (tx: Transaction, reason?: string) => Promise<void>;
  handleHoldTransaction?: (tx: Transaction) => Promise<void>;
  handleResumePendingTransaction?: (tx: Transaction) => Promise<void>;
  onRefreshTransactions?: () => Promise<void>;
  onViewUserProfile?: (user: User) => void;
  isMasterAdmin?: boolean;
}

export const HeaderPendingModal: React.FC<HeaderPendingModalProps> = ({
  isOpen,
  onClose,
  transactions,
  users,
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
  onRefreshTransactions,
  onViewUserProfile,
  isMasterAdmin = true
}) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshTransactions) {
        await onRefreshTransactions();
      }
      setLastSyncTime(new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.warn('Manual refresh non-fatal:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // Live polling every 3.5s while processing modal is open so changes from other admins reflect instantly
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      if (onRefreshTransactions) {
        onRefreshTransactions();
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [isOpen, onRefreshTransactions]);
  
  // Rejection Dialog State
  const [rejectingTx, setRejectingTx] = useState<Transaction | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('টাকা জমা হয়নি / একাউন্টে আসেনি');

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(`${label} কপি হয়েছে!`);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const getTxMethodKey = (t: any): string => {
    const raw = (
      (t.paymentMethod || "") + " " +
      (t.method || "") + " " +
      (t.gateway || "") + " " +
      (t.bankName || "") + " " +
      (t.senderMethod || "") + " " +
      (t.operator || "") + " " +
      (t.provider || "") + " " +
      (t.description || "") + " " +
      (t.typeLabel || "") + " " +
      (t.title || "") + " " +
      (t.note || "")
    ).toLowerCase();

    if (raw.includes("remittance") || raw.includes("রেমিট্যান্স") || t.type === 'remittance' || (t as any).category === 'remittance') return "remittance";
    if (raw.includes("nagad") || raw.includes("নগদ")) return "nagad";
    if (raw.includes("rocket") || raw.includes("রকেট") || raw.includes("dbbl rocket")) return "rocket";
    if (raw.includes("upay") || raw.includes("উপায়") || raw.includes("উপায়")) return "upay";
    if (raw.includes("cellfin") || raw.includes("সেলফিন") || raw.includes("ibbl cellfin")) return "cellfin";
    if (raw.includes("foreign") || raw.includes("abroad") || raw.includes("প্রবাসী") || raw.includes("বিদেশি")) return "foreign_bank";
    if (raw.includes("bank") || raw.includes("bbc") || raw.includes("ব্যাংক") || raw.includes("islamic") || raw.includes("ইসলামী") || raw.includes("brac") || raw.includes("ব্র্যাক") || raw.includes("dutch") || raw.includes("city bank") || raw.includes("sonali")) return "bank";
    if (raw.includes("bkash") || raw.includes("বিকাশ") || raw.includes("b-kash")) return "bkash";
    if (raw.includes("wallet") || raw.includes("ওয়ালেট") || raw.includes("internal") || raw.includes("admin") || raw.includes("এডমিন") || raw.includes("সঞ্চয়") || raw.includes("samity") || raw.includes("কিস্তি") || raw.includes("সমন্বয়") || raw.includes("বোনাস") || raw.includes("কর্তন")) return "wallet";
    return "wallet";
  };

  // Slip Formatter Function
  const generateSlipText = (tx: Transaction, u?: User): string => {
    const userName = tx.userName || (tx as any).senderName || u?.name || 'অজানা গ্রাহক';
    const memberId = u?.memberId || (tx as any).userMemberId || (tx as any).memberId || 'N/A';
    const phone = tx.userPhone || (tx as any).phoneNumber || u?.phone || (tx as any).senderPhone || 'N/A';
    const isRemit = tx.type === 'remittance' || (tx as any).category === 'remittance' || getTxMethodKey(tx) === 'remittance';
    const serviceType = isRemit ? 'প্রবাসী রেমিট্যান্স' : (tx.type || '').includes('withdraw') ? 'উইথড্র / উত্তোলন' : (tx.type || '').includes('recharge') ? 'মোবাইল রিচার্জ' : 'ডিপোজিট / অ্যাড মানি';
    const methodKey = getTxMethodKey(tx);
    const method = methodKey === 'remittance' ? `প্রবাসী রেমিট্যান্স (${tx.paymentMethod || 'প্রবাসী ব্যাংক'})` : methodKey === 'bkash' ? 'বিকাশ' : methodKey === 'nagad' ? 'নগদ' : methodKey === 'rocket' ? 'রকেট' : methodKey === 'upay' ? 'উপায়' : methodKey === 'cellfin' ? 'সেলফিন' : methodKey === 'bank' ? 'ব্যাংক' : methodKey === 'foreign_bank' ? 'বিদেশ থেকে এড মানি' : 'ওয়ালেট / সিস্টেম';
    const senderNumber = (tx as any).senderPhone || (tx as any).senderNumber || tx.userPhone || 'N/A';
    const trxId = tx.trxId || (tx as any).transactionId || tx.id || 'N/A';
    const amount = Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
    
    let timeStr = (tx as any).date || 'N/A';
    if (tx.createdAt) {
      try {
        timeStr = typeof tx.createdAt === 'string' 
          ? new Date(tx.createdAt).toLocaleString('en-US') 
          : new Date(tx.createdAt).toLocaleString('en-US');
      } catch {
        timeStr = String(tx.createdAt);
      }
    }
    
    const isApprovedTx = tx.status === 'success' || (tx.status as any) === 'approved' || (tx.status as any) === 'completed';
    const isRejectedTx = (tx.status as any) === 'rejected' || (tx.status as any) === 'failed' || (tx.status as any) === 'canceled' || (tx.status as any) === 'cancelled';
    const isHoldTx = tx.status === 'on_hold' || (tx as any).status === 'hold' || (tx as any).reviewStatus === 'on_hold' || (tx as any).samityDeactivateStatus === 'on_hold';

    const status = isHoldTx
      ? 'অপেক্ষমাণ (On Hold / Under Review)'
      : isApprovedTx
      ? 'সফল / অনুমোদিত (Success / Approved)'
      : isRejectedTx
      ? 'বাতিল (Rejected)'
      : 'পেন্ডিং (Pending)';

    return `📋 লেনদেন আবেদন বিবরণী (BNB Network)
━━━━━━━━━━━━━━━━━━━━━
👤 মেম্বার নাম: ${userName}
🆔 মেম্বার আইডি: ${memberId}
📱 মেম্বার ফোন: ${phone}
📂 ট্রানজেকশন ধরন: ${serviceType}
💳 পেমেন্ট মেথড: ${method}
📞 প্রেরক/অ্যাকাউন্ট নম্বর: ${senderNumber}
🔢 ট্রানজেকশন আইডি (TrxID): ${trxId}
💵 টাকার পরিমাণ: ৳${amount} BDT
⏰ আবেদনের সময়: ${timeStr}
📌 বর্তমান স্ট্যাটাস: ${status}
━━━━━━━━━━━━━━━━━━━━━`;
  };

  // Authoritative status normalizer to prevent processed transactions from reverting to pending
  const getNormalizedStatus = (t: any): 'success' | 'rejected' | 'on_hold' | 'pending' => {
    if (!t) return 'pending';
    const s = String(t.status || '').toLowerCase().trim();
    const rev = String(t.reviewStatus || '').toLowerCase().trim();
    if (s === 'rejected' || s === 'failed' || s === 'cancelled' || s === 'canceled' || rev === 'rejected') return 'rejected';
    if (s === 'on_hold' || s === 'hold' || rev === 'on_hold' || t.samityDeactivateStatus === 'on_hold') return 'on_hold';
    if (s === 'pending' || s === 'processing' || s === 'waiting' || rev === 'pending' || (t.isApproved === false && s !== 'rejected')) return 'pending';
    if (s === 'success' || s === 'approved' || s === 'completed' || t.isApproved === true) return 'success';
    return 'pending';
  };

  // Check if today is within the December 25 settlement window (Dec 25 to Dec 31)
  const isDecember25Window = useMemo(() => {
    const today = new Date();
    return today.getMonth() === 11 && today.getDate() >= 25;
  }, []);

  // Consolidated Transactions (including active switch-off / opt-out savings withdraw applications)
  const allTransactions = useMemo(() => {
    const list = [...transactions];
    
    // Track users who already have ANY samity withdrawal record in the database
    const existingUserSamityWdSet = new Set<string>();
    list.forEach(t => {
      if (t.userId && (t.type === 'withdraw' || t.category === 'samity_withdraw' || (t as any).isSavingsWithdraw || (t.typeLabel || '').includes('সমবায়') || (t.typeLabel || '').includes('সঞ্চয়'))) {
        existingUserSamityWdSet.add(t.userId);
      }
    });

    // Check users who explicitly submitted an opt-out savings withdraw request
    // Only synthesize if no record exists in transactions and user is not already released or rejected
    users.forEach(u => {
      const hasOptedOutRequest = (u.samityDeactivateStatus === 'self_opted_out' || u.samityDeactivateStatus === 'on_hold') && !!u.samityOptOutReason;
      const isAlreadyProcessed = u.samityDeactivateStatus === 'released' || u.samityDeactivateStatus === 'rejected' || (u as any).samityOptOutRejectedAt;
      const savingsAmt = Number(u.savings) || 0;

      if (hasOptedOutRequest && savingsAmt > 0 && !isAlreadyProcessed) {
        if (!existingUserSamityWdSet.has(u.uid)) {
          const isHeld = u.samityDeactivateStatus === 'on_hold';
          list.push({
            id: `SYNTH-SAMITY-WD-${u.uid}`,
            docId: `SYNTH-SAMITY-WD-${u.uid}`,
            userId: u.uid,
            userName: u.name || 'সদস্য',
            userPhone: u.phone || '',
            userMemberId: u.memberId || '',
            memberId: u.memberId || '',
            type: 'withdraw',
            typeLabel: 'সমবায় সঞ্চয় বন্ধ ও ২৫ ডিসেম্বর উইন্ডো রিফান্ড',
            category: 'samity_withdraw',
            amount: savingsAmt,
            savingsAmount: savingsAmt,
            status: isHeld ? 'on_hold' : isDecember25Window ? 'pending' : 'scheduled_dec25',
            reviewStatus: isHeld ? 'on_hold' : undefined,
            isSavingsWithdraw: true,
            isDec25Scheduled: true,
            reason: u.samityOptOutReason || 'সঞ্চয় বন্ধ ও টাকা উত্তোলন আবেদন',
            paymentMethod: 'মেইন ওয়ালেট রিফান্ড / ব্যাংক / ক্যাশ',
            method: 'wallet_refund',
            description: `সমবায় সমিতি অটো সঞ্চয় বন্ধ ও ২৫শে ডিসেম্বর উইন্ডো রিফান্ড আবেদন। কারণ: "${u.samityOptOutReason || 'ব্যক্তিগত আবেদন'}"। জমাকৃত মোট সঞ্চয়: ৳${savingsAmt.toLocaleString('bn-BD')} টাকা।`,
            createdAt: u.samityOptOutDate || u.samitySwitchLastUpdated || u.updatedAt || new Date().toISOString(),
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString(),
            receiptNo: `REC-SAMITY-WD-${u.memberId || u.uid.substring(0, 6)}`
          } as any);
        }
      }
    });

    // Keep every distinct transaction document visible so no member request is ever lost or hidden
    const seenMap = new Map<string, Transaction>();
    for (const item of list) {
      const docKey = item.docId || item.id || `doc_${Math.random().toString(36).substring(2, 9)}`;
      const copy = { ...item };
      const normStatus = getNormalizedStatus(copy);
      copy.status = normStatus;
      if (normStatus === 'success') (copy as any).isApproved = true;
      (copy as any).allDocIds = [docKey];
      (copy as any).duplicateCount = 1;
      seenMap.set(docKey, copy);
    }

    return Array.from(seenMap.values());
  }, [transactions, users, isDecember25Window]);

  // Status counts (calculated purely using normalized status)
  const totalPending = allTransactions.filter(t => getNormalizedStatus(t) === 'pending').length;
  const totalSuccess = allTransactions.filter(t => getNormalizedStatus(t) === 'success').length;
  const totalRejected = allTransactions.filter(t => getNormalizedStatus(t) === 'rejected').length;
  const totalOnHold = allTransactions.filter(t => getNormalizedStatus(t) === 'on_hold').length;
  const totalDec25Scheduled = allTransactions.filter(t => (t as any).isDec25Scheduled || (t as any).status === 'scheduled_dec25' || t.category === 'samity_withdraw' || (t as any).isSavingsWithdraw).length;
  const totalAll = allTransactions.length;

  // Category counts for pending requests
  const countAddMoneyPending = useMemo(() => allTransactions.filter(t => getNormalizedStatus(t) === 'pending' && (
    (t.type || '').toLowerCase().includes('add') || 
    (t.category || '').toLowerCase().includes('deposit') || 
    (t.type || '').toLowerCase().includes('deposit') || 
    ((t as any).typeLabel || '').toLowerCase().includes('অ্যাড মানি') || 
    ((t as any).typeLabel || '').toLowerCase().includes('ডিপোজিট') || 
    ((t as any).typeLabel || '').toLowerCase().includes('জমা') ||
    (t.description || '').toLowerCase().includes('অ্যাড মানি') ||
    (t.description || '').toLowerCase().includes('ডিপোজিট')
  )).length, [allTransactions]);

  const countTransferPending = useMemo(() => allTransactions.filter(t => getNormalizedStatus(t) === 'pending' && (
    (t.type || '').toLowerCase().includes('transfer') || 
    (t.type || '').toLowerCase().includes('send_money') || 
    ((t as any).typeLabel || '').toLowerCase().includes('ট্রান্সফার') || 
    ((t as any).typeLabel || '').toLowerCase().includes('স্থানান্তর') ||
    ((t as any).typeLabel || '').toLowerCase().includes('সেন্ড মানি') ||
    (t.description || '').toLowerCase().includes('ট্রান্সফার') ||
    (t.description || '').toLowerCase().includes('স্থানান্তর')
  )).length, [allTransactions]);

  const countWithdrawPending = useMemo(() => allTransactions.filter(t => getNormalizedStatus(t) === 'pending' && (
    (t.type || '').toLowerCase().includes('withdraw') || 
    (t.category || '').toLowerCase().includes('withdraw') || 
    ((t as any).typeLabel || '').toLowerCase().includes('উত্তোলন') || 
    ((t as any).typeLabel || '').toLowerCase().includes('উইথড্র')
  )).length, [allTransactions]);

  // Filtered transactions
  const filteredList = allTransactions.filter((t) => {
    const statusNorm = getNormalizedStatus(t);
    const isHoldTx = statusNorm === 'on_hold';
    const isAppTx = statusNorm === 'success';
    const isRejTx = statusNorm === 'rejected';
    const isPendingTx = statusNorm === 'pending';

    // Service category filter: Dedicated Dec 25 window tab
    if (headerPendingTab === "samity_dec25") {
      const isDec25Tx = (t as any).isDec25Scheduled || (t as any).status === 'scheduled_dec25' || t.category === 'samity_withdraw' || (t as any).isSavingsWithdraw;
      if (!isDec25Tx) return false;

      // Status filter in Dec 25 tab
      if (headerPendingStatusFilter === "pending" && !isPendingTx && (t as any).status !== "scheduled_dec25") return false;
      if (headerPendingStatusFilter === "on_hold" && !isHoldTx) return false;
      if (headerPendingStatusFilter === "success" && !isAppTx) return false;
      if (headerPendingStatusFilter === "rejected" && !isRejTx) return false;
    } else {
      // General tabs: Status filter
      if (headerPendingStatusFilter === "pending" && !isPendingTx) return false;
      if (headerPendingStatusFilter === "on_hold" && !isHoldTx) return false;
      if (headerPendingStatusFilter === "success" && !isAppTx) return false;
      if (headerPendingStatusFilter === "rejected" && !isRejTx) return false;

      if (headerPendingTab !== "all") {
        const type = (t.type || "").toLowerCase();
        const cat = (t.category || "").toLowerCase();
        const label = ((t as any).typeLabel || "").toLowerCase();
        const desc = (t.description || "").toLowerCase();
        const method = String(t.paymentMethod || "").toLowerCase();

        if (headerPendingTab === "add_money") {
          const isAdd = type.includes("add") || cat.includes("deposit") || type.includes("deposit") || 
            label.includes("অ্যাড মানি") || label.includes("ডিপোজিট") || label.includes("জমা") || 
            desc.includes("অ্যাড মানি") || desc.includes("ডিপোজিট") || desc.includes("জমা");
          if (!isAdd) return false;
        }
        if (headerPendingTab === "transfer") {
          const isTransfer = type.includes("transfer") || type.includes("send_money") || 
            label.includes("ট্রান্সফার") || label.includes("রেমিট্যান্স") || label.includes("স্থানান্তর") || label.includes("সেন্ড মানি") || 
            desc.includes("ট্রান্সফার") || desc.includes("স্থানান্তর") || method.includes("transfer");
          if (!isTransfer) return false;
        }
        if (headerPendingTab === "withdraw") {
          if ((t as any).isDec25Scheduled && !isDecember25Window && !isHoldTx) return false;
          if (!type.includes("withdraw") && !cat.includes("withdraw") && !label.includes("উত্তোলন") && !label.includes("উইথড্র") && !label.includes("সঞ্চয়") && !label.includes("বন্ধ")) return false;
        }
        if (headerPendingTab === "telecom" && !type.includes("telecom") && !cat.includes("telecom") && !type.includes("recharge") && !type.includes("airtime") && !label.includes("রিচার্জ")) return false;
        if (headerPendingTab === "loan" && !type.includes("loan") && !cat.includes("loan") && !type.includes("qard") && !label.includes("কর্জ")) return false;
        if (headerPendingTab === "remittance" && !type.includes("remit") && !cat.includes("remit") && !label.includes("রেমিট্যান্স") && getTxMethodKey(t) !== "remittance") return false;
        if (headerPendingTab === "bill_pay" && !type.includes("bill") && !cat.includes("bill") && !label.includes("বিল") && !label.includes("ফি") && !type.includes("fee")) return false;
      }
    }

    // Gateway method filter
    if (headerPendingAddMoneyMethod !== "all") {
      const targetMethod = headerPendingAddMoneyMethod === ('local_bank' as any) ? 'bank' : headerPendingAddMoneyMethod;
      if (getTxMethodKey(t) !== targetMethod && !(targetMethod === 'bank' && getTxMethodKey(t) === 'foreign_bank')) {
        return false;
      }
    }

    // Date filter
    if (headerPendingDateFilter !== "all" && t.createdAt) {
      let txDate: Date;
      try {
        txDate = new Date(t.createdAt);
      } catch {
        txDate = new Date();
      }
      const today = new Date();
      if (headerPendingDateFilter === "today") {
        if (txDate.toDateString() !== today.toDateString()) return false;
      } else if (headerPendingDateFilter === "yesterday") {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (txDate.toDateString() !== yesterday.toDateString()) return false;
      } else if (headerPendingDateFilter === "this_month") {
        if (txDate.getMonth() !== today.getMonth() || txDate.getFullYear() !== today.getFullYear()) return false;
      } else if (headerPendingDateFilter === "custom" && headerPendingCustomDate) {
        const customDateStr = new Date(headerPendingCustomDate).toDateString();
        if (txDate.toDateString() !== customDateStr) return false;
      }
    }

    // Search query filter
    if (headerPendingSearchQuery.trim()) {
      const q = headerPendingSearchQuery.toLowerCase().trim();
      const matchName = (t.userName || t.senderName || "").toLowerCase().includes(q);
      const matchPhone = (t.userPhone || t.senderPhone || t.senderNumber || "").toLowerCase().includes(q);
      const matchTxId = (t.trxId || t.transactionId || t.id || "").toLowerCase().includes(q);
      const matchMemberId = (t.userMemberId || "").toLowerCase().includes(q);
      const matchDesc = (t.description || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchTxId && !matchMemberId && !matchDesc) return false;
    }

    return true;
  });

  // Calculate gateway breakdown
  const gatewayStats = useMemo(() => {
    const methods = ['bkash', 'nagad', 'rocket', 'upay', 'cellfin', 'bank', 'foreign_bank', 'wallet'];
    const res: Record<string, { count: number; total: number }> = {
      all: { count: allTransactions.length, total: allTransactions.reduce((s, t) => s + Number(t.amount || 0), 0) }
    };
    methods.forEach(m => { res[m] = { count: 0, total: 0 }; });

    allTransactions.forEach(t => {
      const key = getTxMethodKey(t);
      if (res[key]) {
        res[key].count += 1;
        res[key].total += Number(t.amount || 0);
      }
    });
    return res;
  }, [allTransactions]);

  // Ledger sums for filtered list
  const ledgerStats = useMemo(() => {
    let deposit = 0;
    let withdraw = 0;
    let pending = 0;
    let pendingCount = 0;
    let success = 0;
    let successCount = 0;
    let onHold = 0;
    let onHoldCount = 0;

    filteredList.forEach(t => {
      const amt = Number(t.amount || 0);
      const isDeposit = (t.type || '').includes('add') || (t.type || '').includes('deposit') || (t.category || '').includes('deposit');
      const isWithdraw = (t.type || '').includes('withdraw') || (t.category || '').includes('withdraw');
      const isHold = (t as any).status === 'on_hold' || (t as any).status === 'hold' || (t as any).reviewStatus === 'on_hold' || (t as any).samityDeactivateStatus === 'on_hold';
      const isSuccess = t.status === 'success' || (t.status as any) === 'approved' || (t.status as any) === 'completed';

      if (isDeposit) deposit += amt;
      if (isWithdraw) withdraw += amt;

      if (isHold) {
        onHold += amt;
        onHoldCount += 1;
      } else if (t.status === 'pending' || (t as any).status === 'processing') {
        if (!isSuccess) {
          pending += amt;
          pendingCount += 1;
        }
      }

      if (isSuccess) {
        success += amt;
        successCount += 1;
      }
    });

    return { deposit, withdraw, pending, pendingCount, onHold, onHoldCount, success, successCount, net: deposit - withdraw };
  }, [filteredList]);

  // Open user profile helper
  const handleOpenUserProfile = (tx: Transaction, targetUser?: User) => {
    if (onViewUserProfile) {
      if (targetUser) {
        onViewUserProfile(targetUser);
      } else {
        // Fallback user object if not found in cache
        onViewUserProfile({
          uid: tx.userId || '',
          name: tx.userName || (tx as any).senderName || 'গ্রাহক',
          phone: tx.userPhone || (tx as any).phoneNumber || (tx as any).senderPhone || '',
          memberId: (tx as any).userMemberId || (tx as any).memberId || '',
          balance: 0,
          role: 'user'
        } as User);
      }
    }
  };

  // Hold / Review Later Handler
  const handleHold = async (tx: Transaction) => {
    if (handleHoldTransaction) {
      await handleHoldTransaction(tx);
      return;
    }
    const docId = tx.docId || tx.id;
    setIsProcessing(tx.id);
    try {
      if (tx.id.startsWith('SYNTH-SAMITY-WD-') && tx.userId) {
        await updateDoc(doc(db, 'users', tx.userId), {
          samityDeactivateStatus: 'on_hold',
          samityOptOutHoldDate: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        const docIdsToUpdate = new Set<string>();
        if (docId) docIdsToUpdate.add(docId);
        if (tx.id) docIdsToUpdate.add(tx.id);
        if (Array.isArray((tx as any).allDocIds)) {
          ((tx as any).allDocIds as string[]).forEach(d => { if (d) docIdsToUpdate.add(d); });
        }
        const targetTrx = (tx.trxId || (tx as any).transactionId || (tx as any).receiptNo || '').trim();
        if (targetTrx && targetTrx.length >= 4) {
          try {
            const q = query(collection(db, 'transactions'), where('trxId', '==', targetTrx));
            const s = await getDocs(q);
            s.forEach(d => docIdsToUpdate.add(d.id));
          } catch (e) {}
        }
        for (const d of docIdsToUpdate) {
          await updateDoc(doc(db, 'transactions', d), {
            status: 'on_hold',
            reviewStatus: 'on_hold',
            heldAt: serverTimestamp(),
            heldBy: 'admin',
            adminNotice: 'এডমিন কর্তৃক তথ্য ও হিসাব যাচাইয়ের জন্য সাময়িকভাবে অপেক্ষমাণ রাখা হয়েছে'
          }).catch(e => console.warn('Hold doc update non-fatal:', e));
        }
      }

      if (tx.userId && !tx.id.startsWith('SYNTH-')) {
        try {
          await addDoc(collection(db, 'user_notifications'), {
            userId: tx.userId,
            title: '⏸️ আবেদনটি অপেক্ষমাণ রাখা হয়েছে',
            message: `আপনার ৳${Number(tx.amount || 0).toLocaleString('bn-BD')} টাকার আবেদনটি (${tx.typeLabel || 'লেনদেন'}) হিসাব ও তথ্য যাচাইয়ের জন্য সাময়িকভাবে অপেক্ষমাণ (Review) রাখা হয়েছে। শীঘ্রই চূড়ান্ত সিদ্ধান্ত জানানো হবে।`,
            type: 'warning',
            category: 'transaction',
            read: false,
            createdAt: serverTimestamp()
          });
        } catch (e) {
          console.warn('Notification non-fatal error:', e);
        }
      }

      setCopiedText('⏸️ লেনদেনটি সফলভাবে "অপেক্ষমাণ" তালিকায় স্থানান্তর করা হয়েছে!');
      setTimeout(() => setCopiedText(null), 3000);
    } catch (err: any) {
      console.error('Error putting tx on hold:', err);
      alert('অপেক্ষমাণ করতে সমস্যা হয়েছে: ' + (err?.message || ''));
    } finally {
      setIsProcessing(null);
    }
  };

  // Resume Back to Pending Handler
  const handleResumePending = async (tx: Transaction) => {
    const docId = tx.docId || tx.id;
    setIsProcessing(tx.id);
    try {
      if (tx.id.startsWith('SYNTH-SAMITY-WD-') && tx.userId) {
        await updateDoc(doc(db, 'users', tx.userId), {
          samityDeactivateStatus: 'self_opted_out',
          updatedAt: new Date().toISOString()
        });
      } else {
        const docIdsToUpdate = new Set<string>();
        if (docId) docIdsToUpdate.add(docId);
        if (tx.id) docIdsToUpdate.add(tx.id);
        if (Array.isArray((tx as any).allDocIds)) {
          ((tx as any).allDocIds as string[]).forEach(d => { if (d) docIdsToUpdate.add(d); });
        }
        const targetTrx = (tx.trxId || (tx as any).transactionId || (tx as any).receiptNo || '').trim();
        if (targetTrx && targetTrx.length >= 4) {
          try {
            const q = query(collection(db, 'transactions'), where('trxId', '==', targetTrx));
            const s = await getDocs(q);
            s.forEach(d => docIdsToUpdate.add(d.id));
          } catch (e) {}
        }
        for (const d of docIdsToUpdate) {
          await updateDoc(doc(db, 'transactions', d), {
            status: 'pending',
            reviewStatus: 'pending',
            updatedAt: serverTimestamp(),
            adminNotice: 'পুনরায় সক্রিয় পেন্ডিং তালিকায় ফেরত আনা হয়েছে'
          }).catch(e => console.warn('Resume doc update non-fatal:', e));
        }
      }

      setCopiedText('⏳ লেনদেনটি পুনরায় সক্রিয় পেন্ডিং তালিকায় স্থানান্তর করা হয়েছে!');
      setTimeout(() => setCopiedText(null), 3000);
    } catch (err: any) {
      console.error('Error resuming tx:', err);
      alert('পেন্ডিংয়ে ফেরত নিতে সমস্যা হয়েছে: ' + (err?.message || ''));
    } finally {
      setIsProcessing(null);
    }
  };

  // Rejection Submission Handler
  const handleConfirmRejection = async () => {
    if (!rejectingTx) return;
    try {
      setIsProcessing(rejectingTx.id);
      await handleRejectTransaction(rejectingTx, rejectionReason);
      setRejectingTx(null);
      setCopiedText('❌ ট্রানজেকশন বাতিল ও মেম্বারকে নোটিফাই করা হয়েছে!');
      setTimeout(() => setCopiedText(null), 3000);
    } catch (err) {
      console.error('Error rejecting tx:', err);
    } finally {
      setIsProcessing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-900/75 backdrop-blur-xs flex flex-col w-screen h-screen min-h-screen text-left overflow-hidden animate-fade-in font-sans p-0 m-0 text-slate-800">
      <div className="bg-[#f8fafc] w-full h-full flex flex-col overflow-hidden font-sans">
        
        {/* TOAST COPIED NOTICE */}
        {copiedText && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100002] bg-slate-900 text-amber-300 border border-amber-400/50 shadow-2xl px-4 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 animate-bounce">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{copiedText}</span>
          </div>
        )}

        {/* 1. TOP HEADER BAR */}
        <div className="px-3 sm:px-4 py-2 bg-[#0f172a] text-white flex items-center justify-between shrink-0 border-b border-slate-800 shadow-xs">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-white">
              <span>🕒</span>
              <span>প্রসেসিং সেন্টার</span>
            </div>

            {/* Header Badges (Clickable Filters) */}
            <div className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2 flex-wrap">
              <button
                type="button"
                onClick={() => setHeaderPendingStatusFilter('pending')}
                className={`text-white font-mono font-bold text-[10.5px] sm:text-xs px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer active:scale-95 ${
                  headerPendingStatusFilter === 'pending'
                    ? 'bg-amber-600 ring-2 ring-white shadow-md scale-105 font-black'
                    : 'bg-amber-700/80 hover:bg-amber-600 opacity-90 hover:opacity-100 border border-amber-500/50'
                }`}
                title="পেন্ডিং তালিকা দেখতে ক্লিক করুন"
              >
                <span>⏳ পেন্ডিং:</span>
                <span className="font-mono">{totalPending}</span>
              </button>

              <button
                type="button"
                onClick={() => setHeaderPendingStatusFilter('success')}
                className={`text-white font-mono font-bold text-[10.5px] sm:text-xs px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer active:scale-95 ${
                  headerPendingStatusFilter === 'success'
                    ? 'bg-emerald-600 ring-2 ring-white shadow-md scale-105 font-black'
                    : 'bg-emerald-700/80 hover:bg-emerald-600 opacity-90 hover:opacity-100 border border-emerald-500/50'
                }`}
                title="সফল লেনদেনের তালিকা দেখতে ক্লিক করুন"
              >
                <span>✅ সফল:</span>
                <span className="font-mono">{totalSuccess}</span>
              </button>

              <button
                type="button"
                onClick={() => setHeaderPendingStatusFilter('rejected')}
                className={`text-white font-mono font-bold text-[10.5px] sm:text-xs px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer active:scale-95 ${
                  headerPendingStatusFilter === 'rejected'
                    ? 'bg-rose-600 ring-2 ring-white shadow-md scale-105 font-black'
                    : 'bg-rose-700/80 hover:bg-rose-600 opacity-90 hover:opacity-100 border border-rose-500/50'
                }`}
                title="বাতিল তালিকা দেখতে ক্লিক করুন"
              >
                <span>❌ বাতিল:</span>
                <span className="font-mono">{totalRejected}</span>
              </button>

              <button
                type="button"
                onClick={() => setHeaderPendingStatusFilter('on_hold')}
                className={`text-white font-mono font-bold text-[10.5px] sm:text-xs px-2.5 py-1 rounded-md flex items-center gap-1 border transition cursor-pointer active:scale-95 ${
                  headerPendingStatusFilter === 'on_hold'
                    ? 'bg-blue-600 ring-2 ring-white border-blue-300 shadow-md scale-105 font-black'
                    : 'bg-blue-700/80 hover:bg-blue-600 opacity-90 hover:opacity-100 border-blue-400/50'
                }`}
                title="অপেক্ষমাণ তালিকা দেখতে ক্লিক করুন"
              >
                <span>⏸️ অপেক্ষমাণ:</span>
                <span className="font-mono">{totalOnHold}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-2 sm:px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-75 border border-emerald-400/40"
              title="অন্যান্য এডমিনের অনুমোদন বা বাতিলের লাইভ ডাটা রিফ্রেশ করতে ক্লিক করুন"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-300' : ''}`} />
              <span className="hidden sm:inline">লাইভ সিঙ্ক</span>
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 border border-slate-700"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. ROW 1: STATUS & SERVICE FILTER TABS */}
        <div className="bg-white border-b border-slate-200 px-2.5 sm:px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-xs shrink-0">🎯</span>
          
          {/* Status buttons */}
          <button
            type="button"
            onClick={() => setHeaderPendingStatusFilter('pending')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingStatusFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-100/70 text-amber-900 hover:bg-amber-200/80'
            }`}
          >
            ⏳ পেন্ডিং <span className="font-mono font-black">{totalPending}</span>
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingStatusFilter('success')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingStatusFilter === 'success'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-100/70 text-emerald-900 hover:bg-emerald-200/80'
            }`}
          >
            ✅ সফল <span className="font-mono font-black">{totalSuccess}</span>
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingStatusFilter('rejected')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingStatusFilter === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-100/70 text-rose-900 hover:bg-rose-200/80'
            }`}
          >
            ❌ বাতিল <span className="font-mono font-black">{totalRejected}</span>
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingStatusFilter('on_hold')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingStatusFilter === 'on_hold'
                ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-300'
                : 'bg-blue-100/70 text-blue-900 hover:bg-blue-200/80 border border-blue-300'
            }`}
          >
            ⏸️ অপেক্ষমাণ <span className="font-mono font-black">{totalOnHold}</span>
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingStatusFilter === 'all'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-teal-100/70 text-teal-900 hover:bg-teal-200/80'
            }`}
          >
            🌐 সব <span className="font-mono font-black">{totalAll}</span>
          </button>

          <span className="text-slate-300 mx-0.5">|</span>

          {/* Service Category Tabs */}
          <button
            type="button"
            onClick={() => setHeaderPendingTab('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-100/60 text-amber-900 hover:bg-amber-200/80'
            }`}
          >
            📂 সব সার্ভিস
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingTab('add_money')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingTab === 'add_money'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-100/60 text-amber-900 hover:bg-amber-200/80'
            }`}
          >
            <span>💰 অ্যাড মানি</span>
            {countAddMoneyPending > 0 && (
              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] font-black ${
                headerPendingTab === 'add_money' ? 'bg-slate-950 text-amber-300' : 'bg-rose-500 text-white'
              }`}>
                {countAddMoneyPending}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingTab('transfer')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingTab === 'transfer'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-100/60 text-amber-900 hover:bg-amber-200/80'
            }`}
          >
            <span>🔄 ট্রান্সফার</span>
            {countTransferPending > 0 && (
              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] font-black ${
                headerPendingTab === 'transfer' ? 'bg-slate-950 text-amber-300' : 'bg-rose-500 text-white'
              }`}>
                {countTransferPending}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingTab('withdraw')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingTab === 'withdraw'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-100/60 text-amber-900 hover:bg-amber-200/80'
            }`}
          >
            <span>📤 উইথড্র</span>
            {countWithdrawPending > 0 && (
              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] font-black ${
                headerPendingTab === 'withdraw' ? 'bg-slate-950 text-amber-300' : 'bg-rose-500 text-white'
              }`}>
                {countWithdrawPending}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingTab('telecom')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingTab === 'telecom'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-100/60 text-amber-900 hover:bg-amber-200/80'
            }`}
          >
            📱 রিচার্জ
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingTab('loan')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingTab === 'loan'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-100/60 text-amber-900 hover:bg-amber-200/80'
            }`}
          >
            🤝 কর্জে হাসানা
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingTab('samity_dec25')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 border ${
              headerPendingTab === 'samity_dec25'
                ? 'bg-indigo-700 text-white border-indigo-500 shadow-xs ring-1 ring-indigo-400'
                : 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            <span>📅</span>
            <span>২৫ ডিসেম্বর উইন্ডো</span>
            <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] font-black ml-0.5 ${
              headerPendingTab === 'samity_dec25' ? 'bg-indigo-900 text-amber-300' : 'bg-indigo-200 text-indigo-900'
            }`}>
              {totalDec25Scheduled}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingTab('remittance')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingTab === 'remittance'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-100/60 text-amber-900 hover:bg-amber-200/80'
            }`}
          >
            🌍 রেমিট্যান্স
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingTab('bill_pay')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              headerPendingTab === 'bill_pay'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-100/60 text-amber-900 hover:bg-amber-200/80'
            }`}
          >
            ⚡ বিল ও অন্যান্য
          </button>
        </div>

        {/* 3. ROW 2: PAYMENT GATEWAY BREAKDOWN PILLS */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-2.5 sm:px-3 py-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-[11px]">
          <span className="text-xs shrink-0">💳</span>

          <button
            type="button"
            onClick={() => setHeaderPendingAddMoneyMethod('all')}
            className={`px-2 py-0.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 text-[10.5px] ${
              headerPendingAddMoneyMethod === 'all'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-teal-50 text-teal-900 hover:bg-teal-100 border border-teal-200'
            }`}
          >
            🌐 সকল মাধ্যম ৳{gatewayStats.all.total.toLocaleString('en-US')} ({gatewayStats.all.count})
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingAddMoneyMethod('bkash')}
            className={`px-2 py-0.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 text-[10.5px] ${
              headerPendingAddMoneyMethod === 'bkash'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'bg-pink-50 text-pink-900 hover:bg-pink-100 border border-pink-200'
            }`}
          >
            💖 বিকাশ ৳{gatewayStats.bkash.total.toLocaleString('en-US')} ({gatewayStats.bkash.count})
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingAddMoneyMethod('nagad')}
            className={`px-2 py-0.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 text-[10.5px] ${
              headerPendingAddMoneyMethod === 'nagad'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-orange-50 text-orange-900 hover:bg-orange-100 border border-orange-200'
            }`}
          >
            🧡 নগদ ৳{gatewayStats.nagad.total.toLocaleString('en-US')} ({gatewayStats.nagad.count})
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingAddMoneyMethod('rocket')}
            className={`px-2 py-0.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 text-[10.5px] ${
              headerPendingAddMoneyMethod === 'rocket'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            🚀 রকেট ৳{gatewayStats.rocket.total.toLocaleString('en-US')} ({gatewayStats.rocket.count})
          </button>

          <button
            type="button"
            onClick={() => setHeaderPendingAddMoneyMethod('bank')}
            className={`px-2 py-0.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 text-[10.5px] ${
              headerPendingAddMoneyMethod === 'bank'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            🏛️ ব্যাংক ৳{gatewayStats.bank.total.toLocaleString('en-US')} ({gatewayStats.bank.count})
          </button>

          {(gatewayStats.wallet?.count > 0 || headerPendingAddMoneyMethod === 'wallet') && (
            <button
              type="button"
              onClick={() => setHeaderPendingAddMoneyMethod('wallet')}
              className={`px-2 py-0.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 text-[10.5px] ${
                headerPendingAddMoneyMethod === 'wallet'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              👛 ওয়ালেট/সিস্টেম ৳{(gatewayStats.wallet?.total || 0).toLocaleString('en-US')} ({gatewayStats.wallet?.count || 0})
            </button>
          )}
        </div>

        {/* 4. ROW 3: SEARCH BAR */}
        <div className="bg-white border-b border-slate-200 px-2.5 sm:px-3 py-1.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={headerPendingSearchQuery}
              onChange={(e) => setHeaderPendingSearchQuery(e.target.value)}
              placeholder="নাম, মোবাইল নম্বর, TrxID, বিবরণ লিখে দ্রুত সার্চ..."
              className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-teal-500 focus:outline-none transition text-slate-800"
            />
            {headerPendingSearchQuery && (
              <button
                type="button"
                onClick={() => setHeaderPendingSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 5. ROW 4: DATE BAR & VIEW MODE */}
        <div className="bg-[#0f172a] text-white px-2.5 sm:px-3 py-1 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setHeaderPendingDateFilter('today');
                setHeaderPendingCustomDate('');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                headerPendingDateFilter === 'today'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📅 আজ
            </button>

            <button
              type="button"
              onClick={() => {
                setHeaderPendingDateFilter('yesterday');
                setHeaderPendingCustomDate('');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                headerPendingDateFilter === 'yesterday'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📅 গতকাল
            </button>

            <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-slate-300 text-[11px]">
              <span>তারিখ:</span>
              <select
                value={headerPendingDateFilter}
                onChange={(e: any) => setHeaderPendingDateFilter(e.target.value)}
                className="bg-transparent text-white text-[11px] font-bold focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-800 text-white">সব তারিখ</option>
                <option value="today" className="bg-slate-800 text-white">আজ</option>
                <option value="yesterday" className="bg-slate-800 text-white">গতকাল</option>
                <option value="this_month" className="bg-slate-800 text-white">চলতি মাস</option>
                <option value="custom" className="bg-slate-800 text-white">নির্দিষ্ট তারিখ</option>
              </select>
            </div>

            {headerPendingDateFilter === 'custom' && (
              <input
                type="date"
                value={headerPendingCustomDate}
                onChange={(e) => setHeaderPendingCustomDate(e.target.value)}
                className="px-2 py-0.5 bg-slate-800 text-white rounded-lg text-[11px] border border-slate-700 focus:outline-none"
              />
            )}

            <button
              type="button"
              onClick={() => {
                setHeaderPendingDateFilter('all');
                setHeaderPendingCustomDate('');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1 ${
                headerPendingDateFilter === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
            >
              🟡 সব তারিখ
            </button>
          </div>

          <button
            type="button"
            onClick={() => setHeaderPendingStatusFilter('all')}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-[11px] flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
          >
            🗂️ বোর্ড
          </button>
        </div>

        {/* 6. ROW 5: FINANCIAL LEDGER SUMMARY BANNER */}
        <div className="px-2.5 sm:px-3 pt-1.5 pb-1 shrink-0">
          <div className="bg-[#052e16] border border-emerald-800/80 rounded-xl p-2 text-white shadow-xs">
            {/* Header row */}
            <div className="flex items-center justify-between border-b border-emerald-800/60 pb-1 mb-1.5">
              <div className="flex items-center gap-1.5 font-black text-[11px] sm:text-xs text-white">
                <span>📑</span>
                <span>লেনদেন খতিয়ান হিসাব</span>
                <span className="bg-emerald-800/80 text-emerald-200 px-1.5 py-0.2 rounded text-[9.5px] font-mono">
                  {filteredList.length} টি
                </span>
              </div>

              <div className="text-[11px] sm:text-xs font-mono font-black text-emerald-300">
                নেট: {ledgerStats.net >= 0 ? '+' : ''}৳{ledgerStats.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* 5 Mini Cards (Interactive Buttons) */}
            <div className="grid grid-cols-5 gap-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setHeaderPendingTab('add_money');
                }}
                className={`bg-black/30 border rounded-lg p-1 transition cursor-pointer active:scale-95 text-left flex flex-col items-center justify-center ${
                  headerPendingTab === 'add_money'
                    ? 'border-emerald-400 ring-1 ring-emerald-300 bg-emerald-950/40'
                    : 'border-emerald-900/60 hover:bg-black/50'
                }`}
                title="জমা / অ্যাড মানি তালিকা দেখতে ক্লিক করুন"
              >
                <div className="text-[8px] sm:text-[9.5px] text-emerald-300 font-bold flex items-center justify-center gap-0.5">
                  <span>📥</span> জমা
                </div>
                <div className="text-[9.5px] sm:text-[11px] font-mono font-black text-white truncate">
                  ৳{ledgerStats.deposit.toLocaleString('en-US')}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHeaderPendingTab('withdraw');
                }}
                className={`bg-black/30 border rounded-lg p-1 transition cursor-pointer active:scale-95 text-left flex flex-col items-center justify-center ${
                  headerPendingTab === 'withdraw'
                    ? 'border-rose-400 ring-1 ring-rose-300 bg-rose-950/40'
                    : 'border-emerald-900/60 hover:bg-black/50'
                }`}
                title="উত্তোলন / উইথড্র তালিকা দেখতে ক্লিক করুন"
              >
                <div className="text-[8px] sm:text-[9.5px] text-rose-300 font-bold flex items-center justify-center gap-0.5">
                  <span>📤</span> উইথড্র
                </div>
                <div className="text-[9.5px] sm:text-[11px] font-mono font-black text-white truncate">
                  ৳{ledgerStats.withdraw.toLocaleString('en-US')}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setHeaderPendingStatusFilter('pending')}
                className={`bg-black/30 border rounded-lg p-1 transition cursor-pointer active:scale-95 text-left flex flex-col items-center justify-center ${
                  headerPendingStatusFilter === 'pending'
                    ? 'border-amber-400 ring-1 ring-amber-300 bg-amber-950/40'
                    : 'border-emerald-900/60 hover:bg-black/50'
                }`}
                title="পেন্ডিং তালিকা ফিল্টার করতে ক্লিক করুন"
              >
                <div className="text-[8px] sm:text-[9.5px] text-amber-300 font-bold flex items-center justify-center gap-0.5">
                  <span>⏳</span> পেন্ডিং
                </div>
                <div className="text-[9.5px] sm:text-[11px] font-mono font-black text-amber-300 truncate">
                  {ledgerStats.pendingCount} টি
                </div>
              </button>

              <button
                type="button"
                onClick={() => setHeaderPendingStatusFilter('on_hold')}
                className={`bg-black/30 border rounded-lg p-1 transition cursor-pointer active:scale-95 text-left flex flex-col items-center justify-center ${
                  headerPendingStatusFilter === 'on_hold'
                    ? 'border-blue-400 ring-1 ring-blue-300 bg-blue-950/40'
                    : 'border-blue-900/60 hover:bg-black/50'
                }`}
                title="অপেক্ষমাণ তালিকা ফিল্টার করতে ক্লিক করুন"
              >
                <div className="text-[8px] sm:text-[9.5px] text-blue-300 font-bold flex items-center justify-center gap-0.5">
                  <span>⏸️</span> অপেক্ষমাণ
                </div>
                <div className="text-[9.5px] sm:text-[11px] font-mono font-black text-blue-300 truncate">
                  {ledgerStats.onHoldCount} টি
                </div>
              </button>

              <button
                type="button"
                onClick={() => setHeaderPendingStatusFilter('success')}
                className={`bg-black/30 border rounded-lg p-1 transition cursor-pointer active:scale-95 text-left flex flex-col items-center justify-center ${
                  headerPendingStatusFilter === 'success'
                    ? 'border-emerald-400 ring-1 ring-emerald-300 bg-emerald-950/40'
                    : 'border-emerald-900/60 hover:bg-black/50'
                }`}
                title="সফল তালিকা ফিল্টার করতে ক্লিক করুন"
              >
                <div className="text-[8px] sm:text-[9.5px] text-emerald-300 font-bold flex items-center justify-center gap-0.5">
                  <span>✅</span> সফল
                </div>
                <div className="text-[9.5px] sm:text-[11px] font-mono font-black text-emerald-400 truncate">
                  {ledgerStats.successCount} টি
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* 7. TRANSACTION LIST CARDS */}
        <div className="flex-1 overflow-y-auto px-2.5 sm:px-3 py-1 space-y-1.5">
          {/* Contextual Notice for December 25 Samity Window */}
          {headerPendingTab === 'samity_dec25' && (
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border border-indigo-500/50 rounded-xl p-3 text-white shadow-xs space-y-1.5 mb-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 font-black text-xs text-amber-300">
                  <span>📅</span>
                  <span>২৫শে ডিসেম্বর সমবায় সঞ্চয় রিফান্ড উইন্ডো ({totalDec25Scheduled} জন সদস্য)</span>
                </div>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                  {isDecember25Window ? '🟢 উইন্ডো ওপেন (লাইভ প্রসেসিং)' : '⏳ শিডিউল্ড উইন্ডো (২৫ ডিসেম্বর সক্রিয় হবে)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                সমবায় সমিতি নিয়মাবলি অনুযায়ী, যে সকল সদস্য চলতি বছর অটো সঞ্চয় বন্ধ করেছেন, তাদের জমাকৃত মোট সঞ্চয় আগামী <strong>২৫শে ডিসেম্বর</strong> স্ব-স্ব ওয়ালেটে স্বয়ংক্রিয়ভাবে প্রদান করা হবে। ২৫শে ডিসেম্বর এলে এন্ট্রিগুলো স্বয়ংক্রিয়ভাবে মূল পেন্ডিং তালিকায় সক্রিয় হবে। এডমিন চাইলে যেকোনো সময় <strong>"অনুমোদন ও ব্যালেন্স যুক্ত করুন"</strong> বোতামের মাধ্যমে অগ্রিম রিফান্ড সম্পন্ন করতে পারেন।
              </p>
            </div>
          )}

          {filteredList.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-1.5 text-slate-300 opacity-60" />
              <p className="text-xs font-bold text-slate-700">কোনো লেনদেন পাওয়া যায়নি</p>
              <p className="text-[10px] text-slate-400 mt-0.5">ফিল্টার বা সার্চ পরিবর্তন করে দেখুন</p>
            </div>
          ) : (
            filteredList.map((tx) => {
              const u = users.find(usr => usr.uid === tx.userId || usr.phone === tx.userPhone || usr.phone === tx.phoneNumber);
              const isExpanded = expandedTxId === tx.id;
              const isApproved = tx.status === 'success' || (tx.status as any) === 'approved' || (tx.status as any) === 'completed';
              const isRejected = (tx.status as any) === 'rejected' || (tx.status as any) === 'failed' || (tx.status as any) === 'canceled' || (tx.status as any) === 'cancelled';
              const isOnHold = ((tx as any).status === 'on_hold' || (tx as any).status === 'hold' || (tx as any).reviewStatus === 'on_hold' || (tx as any).samityDeactivateStatus === 'on_hold') && !isApproved && !isRejected;
              const isScheduledDec25 = (((tx as any).status === 'scheduled_dec25' || (tx as any).isDec25Scheduled) && !isDecember25Window) && !isOnHold && !isApproved && !isRejected;
              const isPending = !isApproved && !isRejected && !isOnHold && !isScheduledDec25;
              const canApproveOrReject = (isPending || isScheduledDec25 || isOnHold) && !isApproved && !isRejected;
              const methodKey = getTxMethodKey(tx);

              let formattedDate = tx.date || 'চলতি';
              if (tx.createdAt) {
                try {
                  formattedDate = typeof tx.createdAt === 'string'
                    ? new Date(tx.createdAt).toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        second: 'numeric',
                        hour12: true
                      })
                    : new Date(tx.createdAt).toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        second: 'numeric',
                        hour12: true
                      });
                } catch {
                  formattedDate = String(tx.createdAt);
                }
              }

              const methodLabel = methodKey === 'bkash' ? 'বিকাশ' : methodKey === 'nagad' ? 'নগদ' : methodKey === 'rocket' ? 'রকেট' : methodKey === 'upay' ? 'উপায়' : methodKey === 'cellfin' ? 'সেলফিন' : methodKey === 'bank' ? 'ব্যাংক' : methodKey === 'foreign_bank' ? 'প্রবাসী ব্যাংক' : 'ওয়ালেট';
              const serviceLabel = (tx.type || '').includes('withdraw') ? (isScheduledDec25 ? 'সমবায় ২৫ ডিসেঃ' : 'উইথড্র') : (tx.type || '').includes('recharge') ? 'রিচার্জ' : 'ডিপোজিট / অ্যাড মানি';

              const memberDisplayName = tx.userName || tx.senderName || u?.name || 'গ্রাহক';

              return (
                <div
                  key={tx.id}
                  className={`bg-white border rounded-xl p-2 sm:p-2.5 shadow-2xs transition hover:shadow-xs ${
                    isOnHold
                      ? 'border-blue-400 ring-1 ring-blue-300/80 bg-blue-50/20'
                      : isPending
                      ? 'border-amber-300/90 ring-1 ring-amber-200/40 bg-amber-50/20'
                      : isScheduledDec25
                      ? 'border-indigo-300/80 ring-1 ring-indigo-200/30 bg-indigo-50/15'
                      : isApproved
                      ? 'border-emerald-300/80 bg-emerald-50/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* TOP ROW: Badges on Left, Clickable Member Name & Profile on Right */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    {/* Left Badges */}
                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap min-w-0 text-[10px] sm:text-[11px]">
                      {/* Status */}
                      <span className={`px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-black flex items-center gap-0.5 shrink-0 ${
                        isOnHold
                          ? 'bg-blue-100 text-blue-900 border border-blue-300 ring-1 ring-blue-200'
                          : isPending
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : isScheduledDec25
                          ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                          : isApproved
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}>
                        <span>{isOnHold ? '⏸️' : isPending ? '🟡' : isScheduledDec25 ? '📅' : isApproved ? '✅' : '❌'}</span>
                        <span>{isOnHold ? 'অপেক্ষমাণ' : isPending ? 'পেন্ডিং' : isScheduledDec25 ? '২৫ ডিসেম্বর উইন্ডো' : isApproved ? 'সফল' : 'বাতিল'}</span>
                      </span>

                      {/* Service */}
                      <span className={`px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 shrink-0 ${
                        isScheduledDec25 ? 'bg-indigo-700 text-white' : 'bg-emerald-600 text-white'
                      }`}>
                        <span>{isScheduledDec25 ? '📅' : '💰'}</span> {serviceLabel}
                      </span>

                      {/* Method */}
                      <span className={`px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 shrink-0 ${
                        methodKey === 'remittance'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-black'
                          : methodKey === 'bkash'
                          ? 'bg-pink-50 text-pink-700 border border-pink-200'
                          : methodKey === 'nagad'
                          ? 'bg-orange-50 text-orange-700 border border-orange-200'
                          : methodKey === 'rocket'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : methodKey === 'bank'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : methodKey === 'foreign_bank'
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        <span>{methodKey === 'remittance' ? '💸' : methodKey === 'bkash' ? '💖' : methodKey === 'nagad' ? '🧡' : methodKey === 'rocket' ? '🚀' : methodKey === 'bank' ? '🏛️' : methodKey === 'foreign_bank' ? '✈️' : '👛'}</span>
                        <span>{methodKey === 'remittance' ? 'প্রবাসী রেমিট্যান্স' : methodLabel}</span>
                      </span>

                      {/* Date */}
                      <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono shrink-0">
                        {formattedDate}
                      </span>
                    </div>

                    {/* Right: Clickable Member Name & Profile Button (Clicking opens user profile) */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenUserProfile(tx, u)}
                        className="font-black text-slate-900 hover:text-teal-700 truncate max-w-[140px] sm:max-w-[180px] flex items-center gap-0.5 text-[10.5px] sm:text-xs transition cursor-pointer text-left"
                        title="মেম্বারের সম্পূর্ণ প্রোফাইল খুলুন"
                      >
                        <span className="text-blue-600">👤</span>
                        <span className="underline decoration-slate-300 hover:decoration-teal-600 font-extrabold">{memberDisplayName}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenUserProfile(tx, u)}
                        className="px-1.5 py-0.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded text-[9px] sm:text-[9.5px] font-black cursor-pointer flex items-center gap-0.5 shrink-0 shadow-2xs active:scale-95 transition"
                        title="মেম্বার প্রোফাইল ও বিস্তারিত তথ্য দেখুন"
                      >
                        <span>🔍 প্রোফাইল</span>
                      </button>
                    </div>
                  </div>

                  {/* SECOND ROW: Left = Phone & Amount, Right = "আরো দেখুন ▾" / "সংক্ষেপ ▴" button */}
                  <div className="mt-1 flex items-center justify-between gap-2">
                    {/* Left: Phone & Amount */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {(tx.userPhone || u?.phone) && (
                        <span className="inline-flex items-center gap-0.5 bg-slate-100 px-1.5 py-0.2 rounded font-mono text-[9.5px] text-slate-700 shrink-0">
                          <span>📱</span>
                          <span>{tx.userPhone || u?.phone}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(tx.userPhone || u?.phone || '', 'মোবাইল নম্বর')}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="নম্বর কপি করুন"
                          >
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      )}

                      {tx.foreignAmount && tx.foreignCurrency && (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-mono text-[9.5px] font-black shrink-0 shadow-2xs">
                          <span>✈️</span>
                          <span>{tx.foreignAmount} {tx.foreignCurrency}</span>
                          {tx.exchangeRate && (
                            <span className="text-[8.5px] text-amber-800 font-sans font-semibold">(@ ৳{tx.exchangeRate})</span>
                          )}
                          <span className="text-amber-700">➔</span>
                        </span>
                      )}

                      <span className="text-xs sm:text-sm font-black text-slate-950 font-mono tracking-tight">
                        ৳{Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Right: "আরো দেখুন ▾" / "সংক্ষেপ ▴" Button placed exactly on the right */}
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-2xs transition active:scale-95 ${
                          isExpanded 
                            ? 'bg-slate-900 text-white' 
                            : 'bg-slate-900 hover:bg-slate-800 text-white ring-1 ring-slate-700/50'
                        }`}
                        title={isExpanded ? 'সংক্ষেপ করুন' : 'আরো বিস্তারিত দেখুন'}
                      >
                        <span>{isExpanded ? 'সংক্ষেপ' : 'আরো দেখুন'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-amber-300" /> : <ChevronDown className="w-3 h-3 text-amber-300" />}
                      </button>
                    </div>
                  </div>

                  {/* INLINE COMPACT SENDER & DESCRIPTION ROW */}
                  <div className="mt-0.5 flex items-center gap-2 text-[9.5px] text-slate-600 flex-wrap">
                    {(tx.senderPhone || tx.senderNumber) && (
                      <span className="inline-flex items-center gap-0.5 text-slate-600 font-mono">
                        <span className="text-slate-400">প্রেরক:</span>
                        <span className="font-bold text-slate-800">{tx.senderPhone || tx.senderNumber}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(tx.senderPhone || tx.senderNumber || '', 'প্রেরক নম্বর')}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="প্রেরক নম্বর কপি"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    )}

                    {(tx.trxId || tx.transactionId || tx.id) && (
                      <span className="inline-flex items-center gap-0.5 text-slate-600 font-mono">
                        <span className="text-slate-400">TrxID:</span>
                        <span className="font-bold text-slate-800">{tx.trxId || tx.transactionId || tx.id}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(tx.trxId || tx.transactionId || tx.id || '', 'TrxID')}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="TrxID কপি করুন"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    )}

                    {tx.description && (
                      <span className="text-slate-500 truncate max-w-full">
                        বিবরণ: {tx.description}
                      </span>
                    )}
                  </div>

                  {/* Remittance Beneficiary Info Box if available */}
                  {(tx.beneficiaryBankName || tx.beneficiaryName) && (
                    <div className="w-full bg-emerald-50/80 border border-emerald-200/90 rounded-lg p-2 text-[10px] text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 font-sans">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-emerald-700 text-white px-1 py-0.2 rounded font-black text-[9px]">🇧🇩 প্রাপক</span>
                        <span className="font-extrabold text-slate-900">{tx.beneficiaryName}</span>
                        <span className="text-emerald-800 font-bold">({tx.beneficiaryBankName} - {tx.beneficiaryAccountNo})</span>
                        {tx.beneficiaryPhone && <span className="text-slate-600 font-mono">📱 {tx.beneficiaryPhone}</span>}
                      </div>
                      {tx.remittanceIncentiveAmount ? (
                        <span className="bg-emerald-200/90 text-emerald-900 px-1.5 py-0.5 rounded font-black font-mono shrink-0">
                          +২.৫% প্রণোদনা: ৳{tx.remittanceIncentiveAmount}
                        </span>
                      ) : null}
                    </div>
                  )}

                  {/* EXPANDED SECTION (Visible only when "আরো দেখুন" is clicked) */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-slate-200 bg-slate-50/95 rounded-xl p-2.5 text-xs space-y-2 animate-fade-in">
                      
                      {/* 4 Wallet Overview Mini-Boxes */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <span className="text-slate-400 block text-[9.5px]">বর্তমান মেইন ব্যালেন্স:</span>
                          <span className="font-black text-emerald-700 font-mono text-xs sm:text-sm">
                            ৳{Number(u?.balance !== undefined ? u?.balance : (u as any)?.mainBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <span className="text-slate-400 block text-[9.5px]">সঞ্চয় ব্যালেন্স:</span>
                          <span className="font-black text-purple-700 font-mono text-xs sm:text-sm">
                            ৳{Number(u?.savings || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <span className="text-slate-400 block text-[9.5px]">বকেয়া ঋণ:</span>
                          <span className="font-black text-rose-700 font-mono text-xs sm:text-sm">
                            ৳{Number(u?.dueLoan || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <span className="text-slate-400 block text-[9.5px]">সদস্য আইডি:</span>
                          <span className="font-black text-slate-800 font-mono text-xs sm:text-sm">
                            {u?.memberId || tx.userMemberId || 'BNB00000000'}
                          </span>
                        </div>
                      </div>

                      {/* Attached Screenshot Image */}
                      {(tx.receiptImage || (tx as any).screenshot || (tx as any).image) && (
                        <div className="mt-1.5 bg-white p-2 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-700 block mb-1 text-[10px]">📷 সংযুক্ত পেমেন্ট স্ক্রিনশট / প্রমাণ:</span>
                          <img
                            src={tx.receiptImage || (tx as any).screenshot || (tx as any).image}
                            alt="Receipt"
                            onClick={() => setSelectedImage(tx.receiptImage || (tx as any).screenshot || (tx as any).image)}
                            className="w-32 h-20 object-cover rounded-lg border border-slate-300 cursor-pointer hover:opacity-90 shadow-xs"
                          />
                        </div>
                      )}

                      {/* Rejection Note Display if rejected */}
                      {((tx as any).rejectReason || (tx as any).rejectionReason) && (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[10.5px]">
                          <span className="font-black">❌ বাতিলের কারণ: </span>
                          <span>{(tx as any).rejectReason || (tx as any).rejectionReason}</span>
                        </div>
                      )}

                      {/* ACTION BUTTONS & COPY/SHARE ROW (Visible only in expanded mode) */}
                      <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200 flex-wrap">
                        
                        {/* Left: Approve / Hold / Reject Buttons */}
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          {isApproved ? (
                            <div className="text-[11px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>অনুমোদিত ও সম্পন্ন লেনদেন</span>
                            </div>
                          ) : isRejected ? (
                            <div className="text-[11px] bg-rose-50 text-rose-800 font-bold px-2.5 py-1 rounded-lg border border-rose-200 flex items-center gap-1.5 shadow-2xs">
                              <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>বাতিলকৃত লেনদেন</span>
                            </div>
                          ) : canApproveOrReject ? (
                            <>
                              {/* Reject Button */}
                              <button
                                type="button"
                                disabled={isProcessing === tx.id}
                                onClick={() => {
                                  setRejectingTx(tx);
                                  setRejectionReason(isScheduledDec25 ? 'সমবায় সঞ্চয় উইথড্র আবেদন স্থগিত বা বাতিল করা হয়েছে' : 'টাকা জমা হয়নি / একাউন্টে আসেনি');
                                }}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50"
                              >
                                <span>❌</span>
                                <span>বাতিল করুন</span>
                              </button>

                              {/* Hold / Resume Button */}
                              {isOnHold ? (
                                <button
                                  type="button"
                                  disabled={isProcessing === tx.id}
                                  onClick={() => handleResumePending(tx)}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50"
                                  title="পুনরায় পেন্ডিং তালিকায় স্থানান্তর করুন"
                                >
                                  {isProcessing === tx.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <PlayCircle className="w-3.5 h-3.5 text-blue-600" />
                                  )}
                                  <span>↩️ পেন্ডিংয়ে ফেরত নিন</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isProcessing === tx.id}
                                  onClick={() => handleHold(tx)}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50"
                                  title="পরে ফ্রি সময়ে হিসাব যাচাই করার জন্য অপেক্ষমাণ রাখুন"
                                >
                                  {isProcessing === tx.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <PauseCircle className="w-3.5 h-3.5 text-blue-600" />
                                  )}
                                  <span>⏸️ অপেক্ষমাণ</span>
                                </button>
                              )}

                              {/* Approve Button */}
                              <button
                                type="button"
                                disabled={isProcessing === tx.id}
                                onClick={async () => {
                                  setIsProcessing(tx.id);
                                  try {
                                    await handleApproveTransaction(tx);
                                    setCopiedText('✅ ট্রানজেকশন সফলভাবে অনুমোদিত ও ব্যালেন্স যুক্ত হয়েছে!');
                                    setTimeout(() => setCopiedText(null), 3000);
                                  } finally {
                                    setIsProcessing(null);
                                    if (onRefreshTransactions) onRefreshTransactions();
                                  }
                                }}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                              >
                                {isProcessing === tx.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                <span>{isScheduledDec25 ? 'অগ্রিম রিফান্ড ও ব্যালেন্স প্রদান' : 'অনুমোদন ও ব্যালেন্স যুক্ত করুন'}</span>
                              </button>
                            </>
                          ) : null}
                        </div>

                        {/* Right: Copy Full Slip & WhatsApp Share */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {/* Copy Full Slip Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const slipText = generateSlipText(tx, u);
                              copyToClipboard(slipText, 'সম্পূর্ণ লেনদেন বিবরণী');
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[10.5px] font-black transition border border-slate-300 flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                            title="সব বিবরণী কপি করুন"
                          >
                            <Copy className="w-3 h-3 text-slate-600" />
                            <span>📋 সব কপি</span>
                          </button>

                          {/* WhatsApp Share Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const slipText = generateSlipText(tx, u);
                              const targetPhone = tx.userPhone || tx.phoneNumber || u?.phone || tx.senderPhone || '';
                              const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
                              const formattedPhone = cleanPhone.startsWith('0') ? '88' + cleanPhone : cleanPhone.startsWith('880') ? cleanPhone : cleanPhone;
                              const waUrl = formattedPhone.length >= 10
                                ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(slipText)}`
                                : `https://api.whatsapp.com/send?text=${encodeURIComponent(slipText)}`;
                              window.open(waUrl, '_blank');
                            }}
                            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-[10.5px] font-black transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                            title="হোয়াটসঅ্যাপে সরাসরি পাঠান"
                          >
                            <MessageCircle className="w-3 h-3 text-white" />
                            <span>WhatsApp</span>
                          </button>
                        </div>

                      </div>

                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 8. REJECTION REASON MODAL (When Admin Clicks "❌ বাতিল করুন") */}
        {rejectingTx && (
          <div className="fixed inset-0 z-[100010] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-md border border-slate-200 animate-fade-in">
              {/* Header */}
              <div className="bg-gradient-to-r from-rose-700 to-rose-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-300 animate-pulse" />
                  <span>ট্রানজেকশন বাতিল ও কারণ প্রদান</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectingTx(null)}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold cursor-pointer transition"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3.5 text-xs text-left">
                {/* Transaction Summary Card */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between font-black text-slate-800">
                    <span>👤 মেম্বার: {rejectingTx.userName || rejectingTx.senderName || 'গ্রাহক'}</span>
                    <span className="font-mono text-rose-700">৳{Number(rejectingTx.amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="text-slate-500 font-mono text-[10.5px] flex justify-between">
                    <span>📱 {rejectingTx.userPhone || rejectingTx.senderPhone || 'N/A'}</span>
                    <span>TrxID: {rejectingTx.trxId || rejectingTx.transactionId || rejectingTx.id || 'N/A'}</span>
                  </div>
                </div>

                {/* Quick Reason Chips */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    বাতিলের কারণ নির্বাচন করুন:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'টাকা জমা হয়নি / একাউন্টে আসেনি',
                      'ভুল TrxID বা ট্রানজেকশন তথ্য পাওয়া যায়নি',
                      'প্রেরক ও রিকোয়েস্ট নম্বর অমিল',
                      'অসম্পূর্ণ বা ভুল তথ্য প্রদান',
                      'ডুপ্লিকেট রিকোয়েস্ট আবেদন'
                    ].map((reasonChip) => (
                      <button
                        key={reasonChip}
                        type="button"
                        onClick={() => setRejectionReason(reasonChip)}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer text-left ${
                          rejectionReason === reasonChip
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {rejectionReason === reasonChip ? '✓ ' : ''}{reasonChip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Input */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    কাস্টম কারণ বা নোট লিখুন (সদস্যের কাছে নোটিফিকেশন যাবে):
                  </label>
                  <textarea
                    rows={2}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="বাতিলের সুনির্দিষ্ট কারণ লিখুন..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:border-rose-500 focus:outline-none transition"
                  />
                </div>

                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10.5px] text-amber-900 font-medium leading-tight">
                  💡 তথ্য: বাতিল নিশ্চিত করার সাথে সাথে মেম্বারের নোটিফিকেশনে এই কারণটি স্বয়ংক্রিয়ভাবে প্রেরিত হবে।
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingTx(null)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer transition"
                >
                  ফিরে যান
                </button>
                <button
                  type="button"
                  disabled={isProcessing === rejectingTx.id || !rejectionReason.trim()}
                  onClick={handleConfirmRejection}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isProcessing === rejectingTx.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>❌</span>
                  )}
                  <span>বাতিল নিশ্চিত করুন</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 9. IMAGE ZOOM PREVIEW MODAL */}
        {selectedImage && (
          <div 
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100015] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-3xl max-h-[90vh]">
              <img src={selectedImage} alt="Zoom" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
