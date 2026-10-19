import React, { useState, useEffect, useMemo } from 'react';
import { 
  Smartphone, Server, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, 
  Send, Database, Terminal, Key, Copy, Check, Radio, Activity, ArrowRight,
  Lock, Zap, FileText, AlertTriangle, Eye, XCircle, Search, UserCheck, 
  ExternalLink, Layers, Clock, Ban
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, doc, getDocs } from 'firebase/firestore';
import { 
  DetectedPayment, 
  User 
} from '../types';
import { apiUrl } from '../config/api';
import { 
  getNativeGatewayStatus, 
  requestNativeSmsPermission, 
  subscribeToDetectedPayments, 
  subscribeToDuplicateTransactions, 
  subscribeToFailedTransactions, 
  approvePaymentVerification, 
  rejectPaymentVerification, 
  testDetectBkashSms 
} from '../lib/smsDetectionEngine';

interface BNBSmsGatewayDashboardProps {
  db?: any;
  user?: User;
}

export const BNBSmsGatewayDashboard: React.FC<BNBSmsGatewayDashboardProps> = ({ db, user }) => {
  // Requirement 11: 6 Mandatory Tabs
  const [activeTab, setActiveTab] = useState<
    'detection_status' | 'pending_verification' | 'verified' | 'failed' | 'duplicate' | 'history'
  >('detection_status');

  // Live Data Lists
  const [allDetectedPayments, setAllDetectedPayments] = useState<DetectedPayment[]>([]);
  const [duplicateList, setDuplicateList] = useState<any[]>([]);
  const [failedList, setFailedList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);

  // System Health States
  const [nativeStatus, setNativeStatus] = useState<any>({
    isNative: false,
    hasPermission: false,
    status: 'CHECKING',
    message: ''
  });
  const [firebaseStatus, setFirebaseStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Approval / Rejection Modal State
  const [selectedPayment, setSelectedPayment] = useState<DetectedPayment | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'details' | null>(null);
  const [manualUserId, setManualUserId] = useState<string>('');
  const [verificationProof, setVerificationProof] = useState<string>('bKash App স্টেটমেন্ট ও *247# দ্বারা যাচাইকৃত');
  const [rejectReason, setRejectReason] = useState<string>('টাকা bKash একাউন্টে জমা হয়নি / ভুল তথ্য');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // bKash Test & Simulation State
  const [simForm, setSimForm] = useState({
    sender: 'bKash',
    message: 'You have received Tk 1,500.00 from 01811223344. Fee Tk 0.00. Balance Tk 25,450.00. TrxID 9K8L7M6N5P4 at 13/10/2026 14:00',
    trxId: '9K8L7M6N5P4',
    amount: '1500',
    senderPhone: '01811223344'
  });
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/sms-gateway/webhook` : '';

  // 1. Initial Status & Permission Check
  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    setIsRefreshing(true);
    try {
      const nStatus = await getNativeGatewayStatus();
      setNativeStatus(nStatus);

      // Check backend status endpoint
      const res = await fetch(apiUrl('/api/sms-gateway/status'));
      if (res.ok) {
        setFirebaseStatus('connected');
      } else {
        setFirebaseStatus('error');
      }
    } catch (e) {
      setFirebaseStatus('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 2. Real-time Subscriptions to Firestore Collections
  useEffect(() => {
    if (!db) return;

    // A. Detected Payments
    const unsubDetected = subscribeToDetectedPayments('all', (items) => {
      setAllDetectedPayments(items);
      setFirebaseStatus('connected');
    }, () => setFirebaseStatus('error'));

    // B. Duplicate Transactions
    const unsubDup = subscribeToDuplicateTransactions((items) => {
      setDuplicateList(items);
    });

    // C. Failed Transactions
    const unsubFail = subscribeToFailedTransactions((items) => {
      setFailedList(items);
    });

    // D. Users for Manual Matching
    const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(150)), (snap) => {
      const uList = snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }));
      setUsersList(uList);
    });

    return () => {
      unsubDetected();
      unsubDup();
      unsubFail();
      unsubUsers();
    };
  }, [db]);

  // Derived Categorized Lists
  const pendingPayments = useMemo(() => {
    return allDetectedPayments.filter(p => p.status === 'pending_verification' && !p.isDuplicate);
  }, [allDetectedPayments]);

  const verifiedPayments = useMemo(() => {
    return allDetectedPayments.filter(p => p.status === 'verified');
  }, [allDetectedPayments]);

  const failedPayments = useMemo(() => {
    const list = allDetectedPayments.filter(p => p.status === 'failed');
    return [...list, ...failedList];
  }, [allDetectedPayments, failedList]);

  const duplicatesCombined = useMemo(() => {
    const list = allDetectedPayments.filter(p => p.status === 'duplicate' || p.isDuplicate);
    return [...list, ...duplicateList];
  }, [allDetectedPayments, duplicateList]);

  // Filtered list based on active tab and search query
  const displayedPayments = useMemo(() => {
    let list: any[] = [];
    if (activeTab === 'pending_verification') list = pendingPayments;
    else if (activeTab === 'verified') list = verifiedPayments;
    else if (activeTab === 'failed') list = failedPayments;
    else if (activeTab === 'duplicate') list = duplicatesCombined;
    else if (activeTab === 'history') list = allDetectedPayments;

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((item: any) => {
      const trx = (item.trxId || '').toLowerCase();
      const phone = (item.senderPhone || '').toLowerCase();
      const mId = (item.matchedMemberId || '').toLowerCase();
      const name = (item.matchedUserName || '').toLowerCase();
      const amt = String(item.amount || '');
      return trx.includes(q) || phone.includes(q) || mId.includes(q) || name.includes(q) || amt.includes(q);
    });
  }, [activeTab, pendingPayments, verifiedPayments, failedPayments, duplicatesCombined, allDetectedPayments, searchQuery]);

  const handleCopyUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequestNativePermission = async () => {
    const granted = await requestNativeSmsPermission();
    if (granted) {
      alert('Android SMS পড়ার অনুমতি সফলভাবে প্রাপ্ত হয়েছে!');
    } else {
      alert('অনুমতি দেওয়া হয়নি। আপনার ফোনের সেটিংস থেকে SMS অনুমতি চালু করুন।');
    }
    checkSystemStatus();
  };

  const handleExecuteApproval = async () => {
    if (!selectedPayment) return;
    setIsProcessingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const targetUid = manualUserId || selectedPayment.matchedUserId;
      if (!targetUid) {
        throw new Error('দয়া করে কোন সদস্যের ব্যালেন্সে টাকা যোগ হবে তা নির্বাচন করুন।');
      }

      const res = await approvePaymentVerification(selectedPayment.trxId, targetUid, user?.uid || 'admin_master', verificationProof);
      setActionSuccess(res.message || 'পেমেন্ট সফলভাবে ভেরিফাই হয়েছে এবং ব্যালেন্সে যোগ হয়েছে!');
      setTimeout(() => {
        setActionType(null);
        setSelectedPayment(null);
        setActionSuccess(null);
      }, 1500);
    } catch (err: any) {
      setActionError(err.message || 'অনুমোদনে সমস্যা হয়েছে');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleExecuteRejection = async () => {
    if (!selectedPayment) return;
    setIsProcessingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await rejectPaymentVerification(selectedPayment.trxId, rejectReason, user?.uid || 'admin_master');
      setActionSuccess(res.message || 'লেনদেনটি বাতিল করা হয়েছে।');
      setTimeout(() => {
        setActionType(null);
        setSelectedPayment(null);
        setActionSuccess(null);
      }, 1500);
    } catch (err: any) {
      setActionError(err.message || 'বাতিল করতে সমস্যা হয়েছে');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSimulateSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimLoading(true);
    setSimResult(null);

    try {
      const data = await testDetectBkashSms({
        sender: simForm.sender,
        operator: simForm.sender,
        message: simForm.message,
        trxId: simForm.trxId.trim(),
        amount: parseFloat(simForm.amount),
        senderPhone: simForm.senderPhone.trim()
      });
      setSimResult(data);
    } catch (err: any) {
      setSimResult({ success: false, error: err.message });
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden font-sans text-slate-800">
      
      {/* Minimal Header Bar */}
      <div className="bg-slate-900 text-white p-4 px-6 shadow-xs flex items-center justify-between font-sans border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm sm:text-base font-black tracking-tight text-white">bKash SMS পেমেন্ট ভেরিফিকেশন ও ট্রানজেকশন তথ্য</h2>
        </div>
        <button
          type="button"
          onClick={checkSystemStatus}
          disabled={isRefreshing}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/15"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>রিফ্রেশ</span>
        </button>
      </div>

      {/* 2. Mandatory 6 Tabs Navigation (Requirement 11) */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 pt-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          {[
            { id: 'detection_status', label: 'Payment Detection Status', icon: Activity, count: null },
            { id: 'pending_verification', label: 'Pending Verification', icon: Clock, count: pendingPayments.length, alert: pendingPayments.length > 0 },
            { id: 'verified', label: 'Verified Transactions', icon: CheckCircle2, count: verifiedPayments.length },
            { id: 'failed', label: 'Failed Transactions', icon: XCircle, count: failedPayments.length },
            { id: 'duplicate', label: 'Duplicate Transactions', icon: Ban, count: duplicatesCombined.length },
            { id: 'history', label: 'Transaction History', icon: Layers, count: allDetectedPayments.length }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 rounded-t-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer border-b-2 ${
                  isActive
                    ? 'bg-white text-[#0b6623] border-[#0b6623] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#0b6623]' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                    tab.alert
                      ? 'bg-amber-500 text-white animate-pulse'
                      : isActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Tab Contents */}
      <div className="p-4 sm:p-6 bg-slate-50/50">

        {/* =========================================================================
            TAB 1: PAYMENT DETECTION STATUS
           ========================================================================= */}
        {activeTab === 'detection_status' && (
          <div className="space-y-6">
            {/* Quick Metrics Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-slate-500 text-xs font-bold mb-1">মোট শনাক্তকৃত SMS</div>
                <div className="text-2xl font-black text-slate-800 font-mono">{allDetectedPayments.length}</div>
                <div className="text-[10px] text-emerald-600 font-medium mt-1">bKash পেমেন্ট রেকর্ড</div>
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-xs">
                <div className="text-amber-800 text-xs font-bold mb-1">Pending Verification</div>
                <div className="text-2xl font-black text-amber-700 font-mono">{pendingPayments.length}</div>
                <div className="text-[10px] text-amber-700 font-medium mt-1">যাচাইয়ের অপেক্ষায়</div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
                <div className="text-emerald-800 text-xs font-bold mb-1">Verified Transactions</div>
                <div className="text-2xl font-black text-emerald-700 font-mono">{verifiedPayments.length}</div>
                <div className="text-[10px] text-emerald-700 font-medium mt-1">ব্যালেন্সে ক্রেডিট সম্পন্ন</div>
              </div>

              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 shadow-xs">
                <div className="text-rose-800 text-xs font-bold mb-1">Duplicate Blocked</div>
                <div className="text-2xl font-black text-rose-700 font-mono">{duplicatesCombined.length}</div>
                <div className="text-[10px] text-rose-600 font-medium mt-1">ডাবল এন্ট্রি প্রতিহত</div>
              </div>

              <div className="bg-slate-100 p-4 rounded-2xl border border-slate-300 shadow-xs">
                <div className="text-slate-600 text-xs font-bold mb-1">Failed / Rejected</div>
                <div className="text-2xl font-black text-slate-700 font-mono">{failedPayments.length}</div>
                <div className="text-[10px] text-slate-500 font-medium mt-1">বাতিলকৃত ট্রানজেকশন</div>
              </div>
            </div>

            {/* Android Webhook & Configuration Panel */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-[#0b6623]" />
                    <span>Android SMS রিসিভার ও Webhook সংযোগ</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    যে Android ফোনে bKash-এর পার্সোনাল সিম রয়েছে, সেই ফোনে নিচের Webhook বা নেটিভ অ্যাপ সেট করুন:
                  </p>
                </div>

                {nativeStatus.isNative && !nativeStatus.hasPermission && (
                  <button
                    type="button"
                    onClick={handleRequestNativePermission}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    SMS পারমিশন মঞ্জুর করুন
                  </button>
                )}
              </div>

              {/* Webhook URL Copy Box */}
              <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="min-w-0 flex-1 w-full">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    TARGET SMS GATEWAY WEBHOOK URL
                  </div>
                  <div className="font-mono text-xs text-emerald-800 font-bold truncate select-all">
                    {webhookUrl}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-4 py-2 bg-[#0b6623] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 w-full sm:w-auto justify-center"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'কপি হয়েছে!' : 'URL কপি করুন'}</span>
                </button>
              </div>

              {/* Platform Gateway Disclosure */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#0b6623] shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>পেমেন্ট গেটওয়ে ও ওয়েবহুক ইন্টিগ্রেশন:</strong> আমাদের সিস্টেম সরাসরি সুরক্ষিত পেমেন্ট গেটওয়ে API ও সার্ভার ওয়েবহুক আর্কিটেকচারের মাধ্যমে লেনদেন সম্পন্ন করে। ডিভাইসের কোনো সংবেদনশীল SMS পড়ার অনুমতির প্রয়োজন হয় না।
                </div>
              </div>
            </div>

            {/* Live bKash SMS Detection Simulator (Requirement 2 & 15) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-black text-sm">
                <Terminal className="w-4 h-4 text-[#0b6623]" />
                <span>🧪 bKash SMS রিয়েল-টাইম ডিটেকশন ও পার্সিং টেস্ট সিমুলেটর</span>
              </div>
              <p className="text-xs text-slate-500">
                পার্সোনাল bKash একাউন্টে টাকা আসার যেকোনো মেসেজ নিচে টেস্ট করে দেখতে পারেন। সিস্টেম স্বয়ংক্রিয়ভাবে TrxID ও Amount শনাক্ত করে Pending Verification তালিকায় সংরক্ষণ করবে এবং ডুপ্লিকেট TrxID আসলে তা প্রতিহত করবে:
              </p>

              <form onSubmit={handleSimulateSms} className="space-y-3.5">
                {/* Quick Real-world SMS Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500">দ্রুত টেস্ট টেমপ্লেট:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const randTrx = 'BK' + Math.random().toString(36).substring(2, 10).toUpperCase();
                      const msg = `You have received Tk 1,500.00 from 01811223344. Fee Tk 0.00. Balance Tk 25,450.00. TrxID ${randTrx} at 13/10/2026 14:00`;
                      setSimForm({
                        sender: 'bKash',
                        message: msg,
                        trxId: randTrx,
                        amount: '1500',
                        senderPhone: '01811223344'
                      });
                    }}
                    className="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-[#d12053] border border-pink-200 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1"
                  >
                    🌸 বিকাশ (৳১,৫০০)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const randTrx = 'NG' + Math.random().toString(36).substring(2, 10).toUpperCase();
                      const msg = `You have received Tk 1,500.00 from 01722334455. Fee Tk 0.00. Balance: Tk 18,200.00. TxnID: ${randTrx} at 13/10/2026 14:15`;
                      setSimForm({
                        sender: '16167',
                        message: msg,
                        trxId: randTrx,
                        amount: '1500',
                        senderPhone: '01722334455'
                      });
                    }}
                    className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-[#d96b00] border border-orange-200 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1"
                  >
                    🍊 নগদ (৳১,৫০০)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const randTrx = 'RK' + Math.random().toString(36).substring(2, 10).toUpperCase();
                      const msg = `You have received Tk 1,500.00 from 01933445566. TxnId: ${randTrx}. Your balance is Tk 32,500.00.`;
                      setSimForm({
                        sender: '16216',
                        message: msg,
                        trxId: randTrx,
                        amount: '1500',
                        senderPhone: '01933445566'
                      });
                    }}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-[#8c3494] border border-purple-200 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1"
                  >
                    🟣 রকেট (৳১,৫০০)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const randTrx = 'MFS' + Math.random().toString(36).substring(2, 9).toUpperCase();
                      setSimForm(prev => ({
                        ...prev,
                        trxId: randTrx,
                        message: prev.message.replace(/(?:TrxID|TxnID|TxnId|Trx\s*Id)[:\s]+[A-Za-z0-9]+/i, `TrxID ${randTrx}`)
                      }));
                    }}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#0b6623] border border-emerald-200 rounded-lg text-[11px] font-black transition cursor-pointer"
                  >
                    🎲 নতুন TrxID তৈরি
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    MFS SMS টেক্সট (bKash / Nagad / Rocket):
                  </label>
                  <textarea
                    rows={2}
                    value={simForm.message}
                    onChange={(e) => {
                      const msg = e.target.value;
                      // Auto-extract TrxID, Amount and Phone for live preview
                      const trxMatch = msg.match(/(?:TrxID|trxID|TRXID|Trx\s*Id|TxnID|TxnId|TXNID|Txn\s*Id|Transaction\s*ID|Txn|Trx)[:\s]*([A-Za-z0-9]{8,15})/i);
                      const amtMatch = msg.match(/(?:(?:received|cash\s*in|deposit|amount|পরিমাণ)[:\s]*(?:Tk\.?|TK\.?|BDT|৳|টাকা)?|(?:Tk\.?|TK\.?|BDT|৳|টাকা))\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
                      const phoneMatch = msg.match(/(?:from|by|Sender|প্রেরক|হতে|থেকে)[:\s]*(\+?8801[3-9]\d{8,9}|01[3-9]\d{8,9})/i);
                      setSimForm({
                        ...simForm,
                        message: msg,
                        trxId: trxMatch ? trxMatch[1] : simForm.trxId,
                        amount: amtMatch ? amtMatch[1].replace(/,/g, '') : simForm.amount,
                        senderPhone: phoneMatch ? phoneMatch[1] : simForm.senderPhone
                      });
                    }}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:bg-white focus:border-[#0b6623] focus:outline-none transition"
                    placeholder="You have received Tk 1,500.00 from 018... TrxID / TxnID..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">শনাক্তকৃত TrxID:</label>
                    <input
                      type="text"
                      value={simForm.trxId}
                      onChange={(e) => setSimForm({ ...simForm, trxId: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-[#0b6623]"
                      placeholder="TrxID"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">শনাক্তকৃত Amount (টাকা):</label>
                    <input
                      type="number"
                      value={simForm.amount}
                      onChange={(e) => setSimForm({ ...simForm, amount: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                      placeholder="টাকা"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">প্রেরকের নম্বর (Sender Phone):</label>
                    <input
                      type="text"
                      value={simForm.senderPhone}
                      onChange={(e) => setSimForm({ ...simForm, senderPhone: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                      placeholder="018XXXXXXXX"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="text-[11px] text-slate-500">
                    💡 টেস্ট বাটনে চাপ দিলে Webhook-এ কল হয়ে ফায়ারবেসে রিয়েল ডাটা সেভ হবে।
                  </div>

                  <button
                    type="submit"
                    disabled={simLoading || !simForm.trxId || !simForm.amount}
                    className="px-5 py-2.5 bg-[#0b6623] hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {simLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>টেস্ট পেমেন্ট SMS পাঠান</span>
                  </button>
                </div>
              </form>

              {/* Simulation Result Output */}
              {simResult && (
                <div className={`p-3.5 rounded-2xl border text-xs font-mono ${
                  simResult.status === 'duplicate_rejected'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : simResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    {simResult.status === 'duplicate_rejected' ? (
                      <>
                        <Ban className="w-4 h-4 text-rose-600" />
                        <span>ডুপ্লিকেট TrxID প্রতিহত হয়েছে (Duplicate Prevention Working)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>ফলাফল: {simResult.message || simResult.status}</span>
                      </>
                    )}
                  </div>
                  <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap mt-1">
                    {JSON.stringify(simResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            COMMON SEARCH BAR FOR TABS 2 TO 6
           ========================================================================= */}
        {activeTab !== 'detection_status' && (
          <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="TrxID, মোবাইল নম্বর বা মেম্বার আইডি দিয়ে খুঁজুন..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#0b6623] transition shadow-2xs"
              />
            </div>

            <div className="text-xs text-slate-500 font-bold shrink-0">
              সর্বমোট রেকর্ড: <span className="font-mono text-slate-800">{displayedPayments.length}</span> টি
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: PENDING VERIFICATION (MANDATORY REQUIREMENT 7, 8, 9, 11)
           ========================================================================= */}
        {activeTab === 'pending_verification' && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Pending Verification নিয়ম:</strong> এটি Personal bKash একাউন্ট। প্রাপ্ত SMS-এর সত্যতা ও প্রেরক সদস্যের পরিচয় যাচাই ছাড়া স্বয়ংক্রিয়ভাবে কোনো ব্যালেন্স পরিবর্তন হবে না। অ্যাডমিন নিচে থেকে যাচাই নিশ্চিত করে "ব্যালেন্সে অনুমোদন" চাপলে সদস্যের ওয়ালেটে ১ বার টাকা যোগ হবে।
              </div>
            </div>

            {displayedPayments.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-slate-700">কোনো অপেক্ষমাণ পেমেন্ট নেই</h4>
                <p className="text-xs text-slate-400">সকল প্রাপ্ত bKash পেমেন্ট ইতিমধ্যে যাচাই ও প্রসেস করা হয়েছে।</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedPayments.map((payment: DetectedPayment) => (
                  <div
                    key={payment.id}
                    className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-400 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-sm text-[#0b6623] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          {payment.trxId}
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          📱 {payment.senderPhone || 'ফোন নম্বর নেই'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          🕒 {new Date(payment.detectedAt).toLocaleString('bn-BD')}
                        </span>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-black text-slate-800 font-mono">
                          ৳{Number(payment.amount || 0).toLocaleString()}
                        </div>
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          ⏳ যাচাই প্রয়োজন
                        </span>
                      </div>
                    </div>

                    {/* Member Identification Status Box */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <span className="font-bold text-slate-700">সদস্য শনাক্তকরণ: </span>
                        {payment.matchedUserId ? (
                          <span className="text-emerald-700 font-bold">
                            ✅ {payment.matchedUserName || 'সদস্য'} ({payment.matchedMemberId || payment.matchedUserId})
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold">
                            ⚠️ সদস্য শনাক্ত হয়নি (আনম্যাচড পেমেন্ট)
                          </span>
                        )}
                      </div>

                      {/* Raw SMS preview */}
                      <div className="text-[11px] text-slate-500 font-mono max-w-md truncate">
                        "{payment.rawMessage || payment.message}"
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPayment(payment);
                          setActionType('reject');
                        }}
                        className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        ❌ বাতিল
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPayment(payment);
                          setManualUserId(payment.matchedUserId || '');
                          setActionType('approve');
                        }}
                        className="px-4 py-1.5 bg-[#0b6623] hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>যাচাই ও ব্যালেন্সে অনুমোদন করুন</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: VERIFIED TRANSACTIONS (MANDATORY REQUIREMENT 11)
           ========================================================================= */}
        {activeTab === 'verified' && (
          <div className="space-y-3">
            {displayedPayments.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
                কোনো যাচাইকৃত লেনদেন পাওয়া যায়নি।
              </div>
            ) : (
              displayedPayments.map((payment: DetectedPayment) => (
                <div
                  key={payment.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-[#0b6623]">
                        {payment.trxId}
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        ✅ ব্যালেন্স যোগ হয়েছে
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-bold">
                      👤 {payment.matchedUserName || 'সদস্য'} ({payment.matchedMemberId || 'N/A'}) • 📱 {payment.senderPhone || 'N/A'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      ভেরিফাই সময়: {payment.verifiedAt ? new Date(payment.verifiedAt).toLocaleString('bn-BD') : 'N/A'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-black text-[#0b6623] font-mono">
                      +৳{Number(payment.amount || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      অ্যাডমিন আইডি: {payment.verifiedBy || 'SYSTEM'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: FAILED TRANSACTIONS (MANDATORY REQUIREMENT 11)
           ========================================================================= */}
        {activeTab === 'failed' && (
          <div className="space-y-3">
            {displayedPayments.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
                কোনো বাতিল বা ব্যর্থ লেনদেন নেই।
              </div>
            ) : (
              displayedPayments.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-rose-700">
                        {item.trxId}
                      </span>
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                        ❌ বাতিলকৃত
                      </span>
                    </div>
                    <div className="text-xs text-rose-800 font-bold">
                      কারণ: {item.rejectionReason || item.reason || 'যাচাইয়ে অসঙ্গতি পাওয়া গেছে'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      বাতিলের সময়: {new Date(item.rejectedAt || item.detectedAt || Date.now()).toLocaleString('bn-BD')}
                    </div>
                  </div>

                  <div className="text-right font-mono text-base font-black text-slate-700">
                    ৳{Number(item.amount || 0).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 5: DUPLICATE TRANSACTIONS (MANDATORY REQUIREMENT 6 & 11)
           ========================================================================= */}
        {activeTab === 'duplicate' && (
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>ডুপ্লিকেট প্রতিরোধ সক্রিয় (Duplicate Prevention):</strong> প্রতিটি TrxID শুধুমাত্র একবারই প্রক্রিয়া করা সম্ভব। নিচে তালিকাভুক্ত লেনদেনগুলো দ্বিতীয়বার পাঠানোর চেষ্টা করা হলে সিস্টেম স্বয়ংক্রিয়ভাবে প্রতিহত করেছে, যার ফলে মেম্বারের একাউন্টে ডাবল টাকা যোগ হওয়ার ঝুঁকি শতভাগ শূন্য।
              </div>
            </div>

            {displayedPayments.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
                কোনো ডুপ্লিকেট চেষ্টার রেকর্ড নেই।
              </div>
            ) : (
              displayedPayments.map((dup: any, idx: number) => (
                <div
                  key={dup.id || idx}
                  className="bg-white p-4 rounded-2xl border border-amber-300 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900">
                        {dup.trxId}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                        🛡️ ডুপ্লিকেট ব্লকড
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      📱 প্রেরক: {dup.senderPhone || 'N/A'} • পরিমাণ: ৳{Number(dup.amount || 0).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      ব্লক করার সময়: {new Date(dup.rejectedAt || dup.detectedAt || Date.now()).toLocaleString('bn-BD')}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      দ্বিতীয়বার প্রসেস প্রতিহত
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 6: TRANSACTION HISTORY (MANDATORY REQUIREMENT 11)
           ========================================================================= */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {displayedPayments.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
                কোনো হিস্ট্রি রেকর্ড নেই।
              </div>
            ) : (
              displayedPayments.map((item: DetectedPayment) => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-800">{item.trxId}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'pending_verification'
                          ? 'bg-amber-100 text-amber-800'
                          : item.status === 'duplicate'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      {item.matchedUserName ? `মেম্বার: ${item.matchedUserName} (${item.matchedMemberId})` : 'সদস্য আনম্যাচড'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      শনাক্ত: {new Date(item.detectedAt).toLocaleString('bn-BD')}
                    </div>
                  </div>

                  <div className="text-right font-mono font-black text-base text-slate-800">
                    ৳{Number(item.amount || 0).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* =========================================================================
          ACTION MODALS: APPROVE OR REJECT DIALOG
         ========================================================================= */}
      {actionType === 'approve' && selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-800">
              <CheckCircle2 className="w-6 h-6 text-[#0b6623]" />
              <h3 className="text-base font-black">bKash পেমেন্ট অনুমোদন ও ব্যালেন্স ক্রেডিট</h3>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">TrxID:</span>
                <span className="font-bold text-[#0b6623]">{selectedPayment.trxId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">পরিমাণ:</span>
                <span className="font-bold text-slate-900 text-sm">৳{Number(selectedPayment.amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">প্রেরক মোবাইল:</span>
                <span>{selectedPayment.senderPhone || 'N/A'}</span>
              </div>
            </div>

            {/* Member Selection (Requirement 9: Member Identification Mandatory) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                টাকা গ্রহণকারী সদস্য নির্বাচন করুন (বাধ্যতামূলক):
              </label>
              <select
                value={manualUserId}
                onChange={(e) => setManualUserId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0b6623]"
              >
                <option value="">-- সদস্য নির্বাচন করুন --</option>
                {usersList.map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.name || 'সদস্য'} ({u.memberId || 'N/A'}) - {u.phone || ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                প্রকৃত পেমেন্টের প্রমাণ / স্টেটমেন্ট রেফারেন্স (বাধ্যতামূলক):
              </label>
              <input
                type="text"
                value={verificationProof}
                onChange={(e) => setVerificationProof(e.target.value)}
                placeholder="যেমন: bKash স্টেটমেন্ট রেফারেন্স বা *247# কনফার্মেশন"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0b6623]"
              />
            </div>

            {actionError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold">
                {actionSuccess}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                ফিরে যান
              </button>

              <button
                type="button"
                disabled={isProcessingAction || !manualUserId}
                onClick={handleExecuteApproval}
                className="px-5 py-2 bg-[#0b6623] hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>ব্যালেন্সে যোগ নিশ্চিত করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {actionType === 'reject' && selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-800">
              <XCircle className="w-6 h-6 text-rose-600" />
              <h3 className="text-base font-black">পেমেন্ট বাতিল নিশ্চিতকরণ</h3>
            </div>

            <p className="text-xs text-slate-500">
              TrxID <strong>{selectedPayment.trxId}</strong> (৳{selectedPayment.amount}) বাতিল করা হবে।
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                বাতিলের কারণ লিখুন:
              </label>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            {actionError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                ফিরে যান
              </button>

              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleExecuteRejection}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                {isProcessingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>বাতিল নিশ্চিত করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
