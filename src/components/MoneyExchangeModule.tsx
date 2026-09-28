import React, { useState, useEffect, useRef } from 'react';
import { X, Bell, Megaphone, ShieldCheck, Clock, CheckCircle, CheckCircle2, AlertCircle, PhoneCall, RefreshCw, Lock, HelpCircle, FileText, ArrowRight, Copy, Share2, Printer, Loader2, Check } from 'lucide-react';
import { User as UserType, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, runTransaction, getDocs, where, addDoc } from 'firebase/firestore';

interface MoneyExchangeModuleProps {
  user: UserType;
  onClose?: () => void;
  syncLiveProfile?: () => void;
  appConfig?: AppConfig;
}

export interface TransactionReceipt {
  txnId: string;
  type: 'hold' | 'sent' | 'received' | 'completed' | 'error';
  title: string;
  amount: number;
  senderName: string;
  senderPhone?: string;
  recipientName: string;
  recipientPhone?: string;
  timestamp: string;
  statusBadge: string;
  statusColor: 'emerald' | 'amber' | 'indigo' | 'rose';
  note: string;
  fine?: number;
}

const MoneyExchangeModule: React.FC<MoneyExchangeModuleProps> = ({
  user,
  onClose,
  syncLiveProfile,
  appConfig
}) => {
  // Live user snapshot for real-time balance sync
  const [liveUser, setLiveUser] = useState<UserType>(user);

  // Active deal & history states
  const [activeDeal, setActiveDeal] = useState<any | null>(null);
  const [historyDeals, setHistoryDeals] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // High speed transaction state & custom feedback modals
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptModal, setReceiptModal] = useState<TransactionReceipt | null>(null);
  const [toastNotice, setToastNotice] = useState<{ text: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Form states for creating a new deal
  const [recipientInput, setRecipientInput] = useState('');
  const [holdAmountInput, setHoldAmountInput] = useState('');
  const [walletPinInput, setWalletPinInput] = useState('');
  
  // Recipient resolution states
  const [resolvingRecipient, setResolvingRecipient] = useState(false);
  const [resolvedRecipient, setResolvedRecipient] = useState<{ uid: string; name: string; memberId: string; phone: string } | null>(null);

  // Interactive PIN prompt modal states for action verification
  const [showPinPrompt, setShowPinPrompt] = useState<{ action: 'yes_received' | 'complete'; dealId: string } | null>(null);
  const [actionPin, setActionPin] = useState('');

  // Local state for the countdown timer
  const [timeStr, setTimeStr] = useState('15:00:00');
  const [penaltyText, setPenaltyText] = useState<string | null>(null);

  // Toast Auto-dismiss
  useEffect(() => {
    if (toastNotice) {
      const timer = setTimeout(() => setToastNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastNotice]);

  // Fetch real-time updates for logged-in user
  useEffect(() => {
    if (!user.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setLiveUser({ uid: snap.id, ...snap.data() } as UserType);
      }
    });
    return unsub;
  }, [user.uid]);

  // Recipient live resolution debouncer (Optimized for instant 300ms speed!)
  useEffect(() => {
    const cleaned = recipientInput.trim();
    if (cleaned.length < 5) {
      setResolvedRecipient(null);
      return;
    }
    setResolvingRecipient(true);
    const resolveUser = async () => {
      try {
        const usersRef = collection(db, 'users');
        // Resolve by phone number
        const qPhone = query(usersRef, where('phone', '==', cleaned));
        const snapPhone = await getDocs(qPhone);
        if (!snapPhone.empty) {
          const data = snapPhone.docs[0].data();
          setResolvedRecipient({
            uid: snapPhone.docs[0].id,
            name: data.name || 'অজ্ঞাত সদস্য',
            memberId: data.memberId || 'N/A',
            phone: data.phone || cleaned
          });
          return;
        }

        // Resolve by Member ID
        const qMem = query(usersRef, where('memberId', '==', cleaned));
        const snapMem = await getDocs(qMem);
        if (!snapMem.empty) {
          const data = snapMem.docs[0].data();
          setResolvedRecipient({
            uid: snapMem.docs[0].id,
            name: data.name || 'অজ্ঞাত সদস্য',
            memberId: data.memberId || cleaned,
            phone: data.phone || ''
          });
          return;
        }
        setResolvedRecipient(null);
      } catch (err) {
        console.error('Error resolving recipient:', err);
      } finally {
        setResolvingRecipient(false);
      }
    };

    const timer = setTimeout(() => {
      resolveUser();
    }, 300); // 300ms for high-speed resolution
    return () => clearTimeout(timer);
  }, [recipientInput]);

  // Listen to safe deals (escrow deals) in real-time
  useEffect(() => {
    const q = query(
      collection(db, 'exchange_orders'),
      where('type', '==', 'safe_deal')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deals = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as any[];

      // Filter active deal involving current user
      const userActive = deals.find(d =>
        (d.creatorId === user.uid || d.recipientUid === user.uid || d.recipientPhone === user.phone || d.recipientPhone === user.memberId) &&
        d.status !== 'completed' && d.status !== 'cancelled'
      );

      setActiveDeal(userActive || null);

      // Save history deals
      const userHistory = deals.filter(d =>
        (d.creatorId === user.uid || d.recipientUid === user.uid || d.recipientPhone === user.phone || d.recipientPhone === user.memberId) &&
        d.status === 'completed'
      );
      // Sort newest first
      userHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistoryDeals(userHistory);
    }, (err) => {
      console.error('Error listening to safe deals:', err);
    });

    return () => unsubscribe();
  }, [user.uid, user.phone, user.memberId]);

  // Countdown timer clock ticking system
  useEffect(() => {
    if (!activeDeal) {
      setTimeStr('15:00:00');
      setPenaltyText(null);
      return;
    }

    const interval = setInterval(() => {
      const startMs = new Date(activeDeal.createdAt).getTime();
      const elapsedMs = Date.now() - startMs;
      const limitMs = 15 * 60 * 1000; // 15 Minutes
      const remainingMs = limitMs - elapsedMs;

      if (remainingMs > 0) {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        const centis = Math.floor((remainingMs % 1000) / 10);

        const mStr = mins.toString().padStart(2, '0');
        const sStr = secs.toString().padStart(2, '0');
        const cStr = centis.toString().padStart(2, '0');

        setTimeStr(`${mStr}:${sStr}:${cStr}`);
        setPenaltyText(null);
      } else {
        // Limit exceeded, calculate penalty: 1 Taka per extra minute
        setTimeStr('00:00:00');
        const extraMins = Math.floor(Math.abs(remainingMs) / 60000);
        const penaltyAmount = extraMins + 1; // At least 1 Taka for the first extra minute
        setPenaltyText(`নির্ধারিত 15 মিনিট সময় অতিক্রম হয়েছে! জরিমানা: ৳${penaltyAmount} (প্রতি অতিরিক্ত মিনিটে 1 টাকা)`);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [activeDeal]);

  // Helper to format date & time in Bengali
  const getFormattedNow = () => {
    return new Date().toLocaleString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // 🟢 STEP 1: AMB ডিল হোল্ড (Create a New Escrow Deal)
  const handleCreateDeal = async () => {
    if (activeDeal) {
      setToastNotice({ text: 'দুঃখিত, ইতিমধ্যে একটি নিরাপদ এক্সচেঞ্জ ডিল সচল রয়েছে! নতুন ডিল শুরু করার আগে বর্তমান ডিলটি সম্পন্ন করুন।', type: 'error' });
      return;
    }

    const holdAmount = Number(holdAmountInput);
    if (isNaN(holdAmount) || holdAmount <= 0) {
      setToastNotice({ text: 'দয়া করে সঠিক হোল্ড পরিমাণ উল্লেখ করুন!', type: 'error' });
      return;
    }

    if (!resolvedRecipient) {
      setToastNotice({ text: 'দয়া করে সঠিক প্রাপকের AMB অ্যাপে নিবন্ধিত মোবাইল নম্বর বা মেম্বার আইডি দিন!', type: 'error' });
      return;
    }

    if (!walletPinInput.trim()) {
      setToastNotice({ text: 'দয়া করে আপনার 4 বা 5 ডিজিটের ওয়ালেট পিন নম্বরটি প্রদান করুন!', type: 'error' });
      return;
    }

    if (walletPinInput !== liveUser.pin) {
      setToastNotice({ text: 'দুঃখিত, আপনার ওয়ালেট পিন নম্বরটি সঠিক নয়!', type: 'error' });
      return;
    }

    if ((liveUser.balance || 0) < holdAmount) {
      setToastNotice({ text: `দুঃখিত, আপনার মেইন ব্যালেন্সে পর্যাপ্ত টাকা নেই! বর্তমান ব্যালেন্স: ৳${(liveUser.balance || 0).toLocaleString()}`, type: 'error' });
      return;
    }

    setIsProcessing(true);
    const txnId = `TXN-AMB-${Math.floor(10000000 + Math.random() * 90000000)}`;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', liveUser.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('ব্যবহারকারী তথ্য খুঁজে পাওয়া যায়নি!');

        const curBal = userSnap.data().balance || 0;
        const curLock = userSnap.data().lockedBalance || 0;

        if (curBal < holdAmount) throw new Error('পর্যাপ্ত ব্যালেন্স নেই!');

        // Update balances
        transaction.update(userRef, {
          balance: curBal - holdAmount,
          lockedBalance: curLock + holdAmount
        });

        // Create the escrow safe deal document
        const newDealRef = doc(collection(db, 'exchange_orders'));
        transaction.set(newDealRef, {
          type: 'safe_deal',
          status: 'hold',
          step: 1,
          amount: holdAmount,
          creatorId: liveUser.uid,
          creatorName: liveUser.name,
          creatorPhone: liveUser.phone,
          recipientPhone: resolvedRecipient.phone || recipientInput.trim(),
          recipientUid: resolvedRecipient.uid,
          recipientName: resolvedRecipient.name,
          createdAt: new Date().toISOString(),
          fine: 0
        });

        // Log transaction history
        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          userId: liveUser.uid,
          userName: liveUser.name,
          memberId: liveUser.memberId || 'MEM',
          type: 'fee_payment',
          typeLabel: 'নিরাপদ লেনদেন হোল্ড',
          amount: holdAmount,
          status: 'success',
          description: `সরাসরি নিরাপদ লেনদেন হোল্ডঃ প্রাপক ${resolvedRecipient.name} (আইডি: ${resolvedRecipient.memberId})। টাকা এসক্রো লক করা হয়েছে।`,
          createdAt: new Date().toISOString(),
          paymentMethod: 'Al Mayadin Wallet'
        });

        // Send Notification to recipient
        const notifRef = doc(collection(db, 'user_notifications'));
        transaction.set(notifRef, {
          userId: resolvedRecipient.uid,
          memberId: resolvedRecipient.memberId,
          title: 'নিরাপদ লেনদেন সুরক্ষায় ফান্ড জমা!',
          body: `${liveUser.name} আপনার নম্বরে ৳${holdAmount.toLocaleString()} টাকার একটি নিরাপদ ডিল ফান্ড বুক করেছেন। আপনি টাকা গ্রহণের পর ডিল রিলিজ হবে।`,
          read: false,
          createdAt: new Date().toISOString(),
          isPersonal: true
        });
      });

      // Show high-speed digital receipt popup
      setReceiptModal({
        txnId,
        type: 'hold',
        title: 'নিরাপদ লেনদেন এসক্রো হোল্ড মানি রিসিট',
        amount: holdAmount,
        senderName: liveUser.name || 'সবুজ পক্ষ (দাতা)',
        senderPhone: liveUser.phone || '',
        recipientName: resolvedRecipient.name || 'লাল পক্ষ (প্রাপক)',
        recipientPhone: resolvedRecipient.phone || '',
        timestamp: getFormattedNow(),
        statusBadge: '🟢 এসক্রো ফান্ড লক্ড (স্ট্যাটাস: হোল্ড)',
        statusColor: 'emerald',
        note: 'আলহামদুলিল্লাহ! আপনার নিরাপদ এক্সচেঞ্জ ডিল সফলভাবে শুরু হয়েছে এবং টাকা নিরাপদে AMB হোল্ডে সংরক্ষিত করা হয়েছে।'
      });

      setHoldAmountInput('');
      setRecipientInput('');
      setWalletPinInput('');
      setResolvedRecipient(null);
      if (syncLiveProfile) syncLiveProfile();
    } catch (err: any) {
      console.error(err);
      setToastNotice({ text: err.message || 'ডিল শুরু করতে সমস্যা হয়েছে।', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔴 STEP 2: টাকা পাঠানো শেষ (Money Sent Confirmation)
  const handleMoneySent = async () => {
    if (!activeDeal) {
      setToastNotice({ text: 'কোনো সচল ডিল খুঁজে পাওয়া যায়নি!', type: 'error' });
      return;
    }

    const isRecipient = activeDeal.recipientUid === liveUser.uid || activeDeal.recipientPhone === liveUser.phone || activeDeal.recipientPhone === liveUser.memberId;
    if (!isRecipient) {
      setToastNotice({ text: 'দুঃখিত, শুধুমাত্র ক্রেতা বা প্রাপক পক্ষ (লাল পক্ষ) টাকা পাঠানো নিশ্চিত করতে পারবেন!', type: 'error' });
      return;
    }

    if (activeDeal.step !== 1) {
      setToastNotice({ text: 'ইতিমধ্যে পরবর্তী ধাপে যাওয়া হয়েছে!', type: 'error' });
      return;
    }

    setIsProcessing(true);
    // Optimistically update local active deal state for <1s instant response
    setActiveDeal(prev => prev ? { ...prev, step: 2, status: 'sent' } : null);

    try {
      await runTransaction(db, async (transaction) => {
        const dealRef = doc(db, 'exchange_orders', activeDeal.id);
        transaction.update(dealRef, {
          step: 2,
          status: 'sent'
        });

        // Send notification to the creator (Green side)
        const notifRef = doc(collection(db, 'user_notifications'));
        transaction.set(notifRef, {
          userId: activeDeal.creatorId,
          memberId: 'MEM',
          title: 'টাকা পাঠানো হয়েছে!',
          body: `${liveUser.name} জানিয়েছেন যে তিনি আপনাকে টাকা পাঠিয়েছেন। দয়া করে ব্যালেন্স পরীক্ষা করে 'হ্যাঁ, পাইছি' বাটনে চাপ দিন।`,
          read: false,
          createdAt: new Date().toISOString(),
          isPersonal: true
        });
      });

      // Instant digital money receipt popup modal
      setReceiptModal({
        txnId: activeDeal.id ? `TXN-AMB-${activeDeal.id.substring(0, 8).toUpperCase()}` : `TXN-AMB-${Math.floor(10000000 + Math.random() * 90000000)}`,
        type: 'sent',
        title: 'টাকা পাঠানো সম্পন্ন মানি রিসিট (Receipt)',
        amount: activeDeal.amount,
        senderName: liveUser.name || 'লাল পক্ষ (প্রাপক)',
        senderPhone: liveUser.phone || '',
        recipientName: activeDeal.creatorName || 'সবুজ পক্ষ (দাতা)',
        recipientPhone: activeDeal.creatorPhone || '',
        timestamp: getFormattedNow(),
        statusBadge: '✅ টাকা পাঠানো সফলভাবে রেকর্ড করা হয়েছে',
        statusColor: 'amber',
        note: 'টাকা পাঠানো সম্পন্ন হওয়ার কথা সফলভাবে রেকর্ড করা হয়েছে। এখন সবুজ পক্ষের নিশ্চিতকরণের জন্য অপেক্ষা করুন।'
      });
    } catch (err: any) {
      console.error(err);
      setToastNotice({ text: 'ব্যর্থ হয়েছে, দয়া করে আবার চেষ্টা করুন।', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔵 STEP 3: হ্যাঁ, পাইছি (Received Cash Confirmation)
  const handleConfirmReceived = async () => {
    if (!activeDeal) {
      setToastNotice({ text: 'কোনো সচল ডিল খুঁজে পাওয়া যায়নি!', type: 'error' });
      return;
    }

    const isCreator = activeDeal.creatorId === liveUser.uid;
    if (!isCreator) {
      setToastNotice({ text: 'দুঃখিত, শুধুমাত্র টাকা হোল্ডকারী সবুজ পক্ষ টাকা পাওয়ার বিষয়টি নিশ্চিত করতে পারবেন!', type: 'error' });
      return;
    }

    if (activeDeal.step !== 2) {
      setToastNotice({ text: 'দয়া করে অপেক্ষা করুন! লাল পক্ষ প্রথমে টাকা পাঠানো শেষ করার পর আপনি এই ধাপটি নিশ্চিত করতে পারবেন।', type: 'error' });
      return;
    }

    // Open PIN prompt
    setShowPinPrompt({ action: 'yes_received', dealId: activeDeal.id });
    setActionPin('');
  };

  // 🟠 STEP 4: সম্পূর্ণ (Complete Escrow Deal)
  const handleFinalComplete = async () => {
    if (!activeDeal) {
      setToastNotice({ text: 'কোনো সচল ডিল খুঁজে পাওয়া যায়নি!', type: 'error' });
      return;
    }

    const isRecipient = activeDeal.recipientUid === liveUser.uid || activeDeal.recipientPhone === liveUser.phone || activeDeal.recipientPhone === liveUser.memberId;
    if (!isRecipient) {
      setToastNotice({ text: 'দুঃখিত, শুধুমাত্র লাল পক্ষ লেনদেনটি চূড়ান্ত সম্পন্ন করতে পারবেন!', type: 'error' });
      return;
    }

    if (activeDeal.step !== 3) {
      setToastNotice({ text: 'দয়া করে অপেক্ষা করুন! সবুজ পক্ষ প্রথমে "হ্যাঁ, পাইছি" বাটন প্রেস করার পর আপনি লেনদেন সম্পূর্ণ করতে পারবেন।', type: 'error' });
      return;
    }

    // Open PIN prompt
    setShowPinPrompt({ action: 'complete', dealId: activeDeal.id });
    setActionPin('');
  };

  // Process PIN verified actions
  const executePinVerifiedAction = async () => {
    if (!showPinPrompt) return;
    
    if (actionPin !== liveUser.pin) {
      setToastNotice({ text: 'দুঃখিত, আপনার প্রবেশ করানো পিন নম্বরটি সঠিক নয়!', type: 'error' });
      return;
    }

    const { action, dealId } = showPinPrompt;
    setIsProcessing(true);

    try {
      if (action === 'yes_received') {
        // Optimistically update active deal step
        setActiveDeal(prev => prev ? { ...prev, step: 3, status: 'received' } : null);

        await runTransaction(db, async (transaction) => {
          const dealRef = doc(db, 'exchange_orders', dealId);
          transaction.update(dealRef, {
            step: 3,
            status: 'received'
          });

          // Send notification to the recipient (Red side)
          const notifRef = doc(collection(db, 'user_notifications'));
          transaction.set(notifRef, {
            userId: activeDeal.recipientUid,
            memberId: 'MEM',
            title: 'টাকা প্রাপ্তি নিশ্চিত হয়েছে!',
            body: `${liveUser.name} আপনার পেমেন্ট পাওয়ার বিষয়টি নিশ্চিত করেছেন। এবার ডিলটি সম্পন্ন করতে 'সম্পূর্ণ' বাটনে চাপ দিন।`,
            read: false,
            createdAt: new Date().toISOString(),
            isPersonal: true
          });
        });

        // Instant Digital Receipt
        setReceiptModal({
          txnId: activeDeal.id ? `TXN-AMB-${activeDeal.id.substring(0, 8).toUpperCase()}` : `TXN-AMB-${Math.floor(10000000 + Math.random() * 90000000)}`,
          type: 'received',
          title: 'টাকা প্রাপ্তি নিশ্চয়তা মানি রিসিট',
          amount: activeDeal.amount,
          senderName: activeDeal.creatorName,
          senderPhone: activeDeal.creatorPhone,
          recipientName: activeDeal.recipientName,
          recipientPhone: activeDeal.recipientPhone,
          timestamp: getFormattedNow(),
          statusBadge: '✅ টাকা প্রাপ্তি সফলভাবে নিশ্চিত করা হয়েছে',
          statusColor: 'indigo',
          note: 'সফলভাবে টাকা প্রাপ্তির তথ্য নিশ্চিত করা হয়েছে! এখন লাল পক্ষ সম্পূর্ণ করলেই ফান্ড রিলিজ হবে।'
        });
      } else if (action === 'complete') {
        // Calculate penalty/fine if any
        let overtimeFine = 0;
        const startMs = new Date(activeDeal.createdAt).getTime();
        const elapsedMs = Date.now() - startMs;
        const limitMs = 15 * 60 * 1000;
        if (elapsedMs > limitMs) {
          const extraMins = Math.floor((elapsedMs - limitMs) / 60000);
          overtimeFine = extraMins + 1;
        }

        const refundAmount = activeDeal.amount;

        // Optimistically complete deal locally
        setActiveDeal(null);

        await runTransaction(db, async (transaction) => {
          // Get creator user (Green side) to update their balances
          const creatorRef = doc(db, 'users', activeDeal.creatorId);
          const creatorSnap = await transaction.get(creatorRef);
          if (!creatorSnap.exists()) throw new Error('মুল লেনদেনের তথ্য পাওয়া যায়নি!');

          const curBal = creatorSnap.data().balance || 0;
          const curLock = creatorSnap.data().lockedBalance || 0;

          // Release locked balance back to green side's main balance as requested
          transaction.update(creatorRef, {
            lockedBalance: Math.max(0, curLock - refundAmount),
            balance: curBal + refundAmount - overtimeFine
          });

          // Update Deal order status to completed
          const dealRef = doc(db, 'exchange_orders', dealId);
          transaction.update(dealRef, {
            step: 4,
            status: 'completed',
            fine: overtimeFine,
            completedAt: new Date().toISOString()
          });

          // Record transaction log of completion and release back
          const txRef = doc(collection(db, 'transactions'));
          transaction.set(txRef, {
            userId: activeDeal.creatorId,
            userName: activeDeal.creatorName,
            memberId: 'MEM',
            type: 'deposit',
            typeLabel: 'নিরাপদ লেনদেন রিলিজ',
            amount: refundAmount - overtimeFine,
            status: 'success',
            description: `নিরাপদ এক্সচেঞ্জ ডিল সফলভাবে সম্পন্ন ও টাকা রিলিজ। জরিমানা: ৳${overtimeFine}।`,
            createdAt: new Date().toISOString(),
            paymentMethod: 'Al Mayadin Wallet'
          });

          // Notifications to both users
          const notifCreator = doc(collection(db, 'user_notifications'));
          transaction.set(notifCreator, {
            userId: activeDeal.creatorId,
            memberId: 'MEM',
            title: 'নিরাপদ লেনদেন সম্পূর্ণ!',
            body: `আপনার ৳${refundAmount.toLocaleString()} টাকার নিরাপদ লেনদেন ডিলটি সফলভাবে সম্পূর্ণ হয়েছে। ফান্ড রিলিজ হয়ে আপনার মেইন ব্যালেন্সে ফিরেছে।`,
            read: false,
            createdAt: new Date().toISOString(),
            isPersonal: true
          });

          const notifRecipient = doc(collection(db, 'user_notifications'));
          transaction.set(notifRecipient, {
            userId: activeDeal.recipientUid,
            memberId: 'MEM',
            title: 'নিরাপদ লেনদেন সম্পূর্ণ!',
            body: `আপনার এবং ${activeDeal.creatorName} এর মধ্যকার লেনদেনটি চূড়ান্ত সম্পন্ন হয়েছে। আমাদের সাথে থাকার জন্য ধন্যবাদ!`,
            read: false,
            createdAt: new Date().toISOString(),
            isPersonal: true
          });
        });

        // High-speed Completion Receipt Modal
        setReceiptModal({
          txnId: activeDeal.id ? `TXN-AMB-${activeDeal.id.substring(0, 8).toUpperCase()}` : `TXN-AMB-${Math.floor(10000000 + Math.random() * 90000000)}`,
          type: 'completed',
          title: 'নিরাপদ লেনদেন চূড়ান্ত রিলিজ মানি রিসিট',
          amount: refundAmount - overtimeFine,
          senderName: activeDeal.creatorName,
          senderPhone: activeDeal.creatorPhone,
          recipientName: activeDeal.recipientName,
          recipientPhone: activeDeal.recipientPhone,
          timestamp: getFormattedNow(),
          statusBadge: '🎉 লেনদেন সম্পূর্ণ ও ফান্ড সফলভাবে রিলিজড',
          statusColor: 'emerald',
          note: 'অভিনন্দন! নিরাপদ লেনদেন ডিলটি সফলভাবে সম্পন্ন হয়েছে এবং হোল্ড ফান্ড রিলিজ করে মেইন ব্যালেন্সে যুক্ত করা হয়েছে।',
          fine: overtimeFine
        });
      }

      setShowPinPrompt(null);
      setActionPin('');
      if (syncLiveProfile) syncLiveProfile();
    } catch (err: any) {
      console.error(err);
      setToastNotice({ text: err.message || 'লেনদেন প্রক্রিয়াকরণে সমস্যা হয়েছে।', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy receipt to clipboard
  const copyReceiptToClipboard = () => {
    if (!receiptModal) return;
    const text = `=================================\n   AMB ডিজিটাল মানি এক্সচেঞ্জ রিসিট\n=================================\nরিসিট শিরোনাম: ${receiptModal.title}\nট্রানজেকশন নম্বর: ${receiptModal.txnId}\nটাকার পরিমাণ: ৳${receiptModal.amount.toLocaleString('bn-BD')}\nলেনদেনের তারিখ ও সময়: ${receiptModal.timestamp}\nবর্তমান স্ট্যাটাস: ${receiptModal.statusBadge}\nসবুজ পক্ষ (দাতা): ${receiptModal.senderName} (${receiptModal.senderPhone || 'N/A'})\nলাল পক্ষ (প্রাপক): ${receiptModal.recipientName} (${receiptModal.recipientPhone || 'N/A'})\nবিবরণ: ${receiptModal.note}\n=================================\nAl Mayadin Bazar Escrow Gateway`;

    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 3000);
  };

  // Helper values for current role
  const isCreator = activeDeal?.creatorId === liveUser.uid;
  const isRecipient = activeDeal?.recipientUid === liveUser.uid || activeDeal?.recipientPhone === liveUser.phone || activeDeal?.recipientPhone === liveUser.memberId;
  const partnerName = activeDeal ? (isCreator ? activeDeal.recipientName : activeDeal.creatorName) : '';

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-800 font-sans flex flex-col w-full h-full pb-12 overflow-y-auto relative">
      {/* Toast Notice Banner (No Native Alert!) */}
      {toastNotice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1100] w-[90%] max-w-md animate-bounce-short">
          <div className={`p-3.5 rounded-2xl shadow-2xl border flex items-center justify-between gap-3 text-xs font-black ${
            toastNotice.type === 'error'
              ? 'bg-rose-900 text-rose-100 border-rose-700'
              : 'bg-emerald-900 text-emerald-100 border-emerald-700'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              {toastNotice.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
              )}
              <span className="truncate">{toastNotice.text}</span>
            </div>
            <button
              onClick={() => setToastNotice(null)}
              className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. HEADER (AMB নিরাপদ এক্সচেঞ্জ / Al Mayadin Bazar Escrow Gateway) */}
      <div className="bg-gradient-to-r from-[#014022] to-[#015E34] text-white p-4 pb-6 rounded-b-[2rem] shadow-xl relative shrink-0">
        <div className="flex justify-between items-start gap-2">
          {/* Back Action */}
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full transition cursor-pointer mt-1">
            <X className="w-5 h-5" />
          </button>

          {/* Core Applet Title */}
          <div className="flex-1 mt-1 text-center sm:text-left sm:pl-3">
            <div className="flex items-center justify-center sm:justify-start gap-1.5">
              <span className="bg-white/20 text-xs font-black px-2 py-0.5 rounded-lg tracking-widest">AMB</span>
              <h1 className="font-extrabold text-lg tracking-tight leading-none">AMB নিরাপদ এক্সচেঞ্জ</h1>
            </div>
            <p className="text-[9px] opacity-80 font-mono mt-1 uppercase tracking-wider">Al Mayadin Bazar Escrow Gateway</p>
          </div>

          {/* Right Balanced Frame: User Balance Display Box (সাদা বক্স) */}
          <div className="flex items-center gap-2">
            <div className="bg-white text-slate-800 px-4 py-2 rounded-2xl shadow-md border border-emerald-100 flex flex-col items-end shrink-0">
              <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest">মেইন ব্যালেন্স</span>
              <span className="text-sm font-black font-mono text-emerald-800">
                ৳{(liveUser.balance || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* 2. লেনদেন আইকন (গোল হলুদ নোটিফিকেশন/স্ট্যাটাস আইকন) */}
            <button 
              onClick={() => setShowHistoryModal(true)} 
              className="bg-[#FFDE00] hover:bg-[#FFE844] active:scale-95 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all border border-yellow-200 shrink-0 cursor-pointer relative"
              title="পূর্ববর্তী লেনদেনের ইতিহাস"
            >
              <Bell className="w-5 h-5 text-[#014022] animate-bounce-slow" />
              {historyDeals.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-mono text-[9px] font-black h-5 w-5 rounded-full flex items-center justify-center animate-pulse">
                  {historyDeals.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Marquee Ticker Notice Banner */}
      <div className="mx-4 mt-4 shrink-0 bg-[#E6F4EA] border border-[#A7F3D0] rounded-2xl p-2 flex items-center gap-2 overflow-hidden shadow-xs">
        <div className="bg-gradient-to-r from-[#DC2626] to-[#EF4444] text-white px-3 py-1 rounded-xl flex items-center gap-1 shrink-0 font-extrabold text-[11px] tracking-tight">
          <Megaphone className="w-3 h-3" />
          <span>ঘোষণা</span>
        </div>
        <marquee className="text-xs font-extrabold text-[#065F46] flex-1">
          জনমানুষের একটি জনকল্যাণমুখী উদ্যোগ নিচ্ছি। আমাদের সাথে নিরাপদ লেনদেন করুন। অতিরিক্ত সাহায্য বা সাপোর্টের জন্য যোগাযোগ করুন।
        </marquee>
      </div>

      {/* 3. COUNTDOWN TIMER */}
      <div className="flex flex-col items-center justify-center py-6 shrink-0 bg-white shadow-xs mx-4 mt-4 rounded-3xl border border-slate-100">
        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">এসক্রো সময়সীমা</span>
        
        {/* Large red timer text - stable, no blinking */}
        <div className="text-red-500 text-5xl md:text-6xl font-black font-mono tracking-widest select-none tabular-nums drop-shadow-sm">
          {timeStr}
        </div>

        {penaltyText && (
          <p className="text-xs font-black text-rose-600 mt-2 px-4 text-center animate-bounce">
            {penaltyText}
          </p>
        )}
      </div>

      {/* 4. FOUR BUTTONS & ESCROW HOLD MAIN BOARD */}
      <div className="p-4 flex flex-col gap-4">
        {/* Step Buttons Grid */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* 🔴 টাকা পাঠানো শেষ (Step 2 Button) */}
          <button
            onClick={handleMoneySent}
            disabled={!activeDeal || activeDeal.step !== 1 || !isRecipient || isProcessing}
            className={`py-6 px-4 rounded-[2rem] flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-md select-none ${
              activeDeal && activeDeal.step === 1 && isRecipient
                ? 'bg-[#EF4444] text-white hover:bg-[#DC2626] animate-pulse ring-4 ring-[#EF4444]/20'
                : 'bg-[#FEE2E2] text-[#EF4444] border border-[#FCA5A5] cursor-not-allowed opacity-80'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${
              activeDeal && activeDeal.step === 1 && isRecipient
                ? 'bg-white text-[#EF4444]'
                : 'bg-[#FEE2E2] text-[#EF4444]'
            }`}>
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-xl">↑</span>}
            </div>
            <span className="font-extrabold text-base tracking-tight">
              {isProcessing ? 'রেকর্ড হচ্ছে...' : 'টাকা পাঠানো শেষ'}
            </span>
          </button>

          {/* 🟢 AMB ডিল হোল্ড (Step 1 Button) */}
          <button
            onClick={() => {
              if (activeDeal) {
                setToastNotice({ text: 'ইতিমধ্যে একটি ডিল সচল রয়েছে!', type: 'info' });
              } else {
                // Focus on create form
                const formEl = document.getElementById('new-deal-form');
                if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className={`py-6 px-4 rounded-[2rem] flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-md select-none ${
              !activeDeal
                ? 'bg-[#059669] text-white hover:bg-[#047857] animate-pulse ring-4 ring-[#059669]/20'
                : 'bg-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="w-10 h-10 bg-white text-emerald-600 rounded-full flex items-center justify-center font-bold shadow-sm">
              <span className="text-xl">↑</span>
            </div>
            <span className="font-extrabold text-base tracking-tight">AMB ডিল হোল্ড</span>
          </button>

        </div>

        {/* Bottom Tri-Module Row (হ্যাঁ পাইছি | AMB Hold | সম্পূর্ণ) */}
        <div className="grid grid-cols-3 gap-3 items-stretch">
          
          {/* 🟢 হ্যাঁ, পাইছি (Step 3 Button) */}
          <button
            onClick={handleConfirmReceived}
            disabled={!activeDeal || activeDeal.step !== 2 || !isCreator || isProcessing}
            className={`rounded-3xl p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-md text-center ${
              activeDeal && activeDeal.step === 2 && isCreator
                ? 'bg-[#059669] text-white hover:bg-[#047857] animate-pulse ring-4 ring-[#059669]/20'
                : 'bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] cursor-not-allowed opacity-80'
            }`}
          >
            <span className="font-black text-sm tracking-tight block">হ্যাঁ<br/>পাইছি</span>
          </button>

          {/* ⚫ AMB HOLD (Middle Black Box / Escrow Hold Balance Display) */}
          <div className="bg-black text-white p-4 flex flex-col items-center justify-center rounded-tr-[2.5rem] rounded-bl-[2.5rem] shadow-2xl border border-slate-800 text-center select-none min-h-[110px]">
            <span className="text-[14px] font-black font-mono text-emerald-400">
              ৳{activeDeal ? activeDeal.amount.toLocaleString() : '0.00'}
            </span>
            <div className="flex items-center gap-1 mt-1 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-[11px] font-extrabold text-slate-300">AMB</span>
            </div>
          </div>

          {/* 🔴 সম্পূর্ণ (Step 4 Button) */}
          <button
            onClick={handleFinalComplete}
            disabled={!activeDeal || activeDeal.step !== 3 || !isRecipient || isProcessing}
            className={`rounded-3xl p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-md text-center ${
              activeDeal && activeDeal.step === 3 && isRecipient
                ? 'bg-[#EF4444] text-white hover:bg-[#DC2626] animate-pulse ring-4 ring-[#EF4444]/20'
                : 'bg-[#FEE2E2] text-[#EF4444] border border-[#FCA5A5] cursor-not-allowed opacity-80'
            }`}
          >
            <span className="font-black text-sm tracking-tight block">সম্পূর্ণ</span>
          </button>

        </div>
      </div>

      {/* 5. STEP EXPLANATION & INSTRUCTIONS PANEL */}
      <div className="mx-4 mt-2 mb-4">
        {activeDeal ? (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl border border-slate-700 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-extrabold text-sm text-emerald-400 flex items-center gap-2">
                <span className="animate-pulse bg-emerald-500 h-2.5 w-2.5 rounded-full" />
                সচল নিরাপদ এক্সচেঞ্জ ডিল
              </h3>
              <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-xl font-mono uppercase">
                ধাপঃ {activeDeal.step} / 4
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                <div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase">সবুজ পক্ষ (দাতা)</p>
                  <p className="font-extrabold text-white mt-0.5">{activeDeal.creatorName}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase">লাল পক্ষ (প্রাপক)</p>
                  <p className="font-extrabold text-white mt-0.5">{activeDeal.recipientName}</p>
                </div>
              </div>

              {/* Dynamic instruction description based on step */}
              <div className="bg-emerald-500/10 text-emerald-200 p-4 rounded-2xl border border-emerald-500/20 leading-relaxed font-bold">
                {activeDeal.step === 1 && (
                  <>
                    {isCreator ? (
                      <p>✅ আপনি সফলভাবে ফান্ড হোল্ড করেছেন। এখন অপর পক্ষকে (লাল পক্ষ) টাকা পাঠাতে বলুন। টাকা পাঠানো সম্পন্ন হলে তিনি "টাকা পাঠানো শেষ" বাটনে চাপবেন।</p>
                    ) : (
                      <p>👉 সবুজ পক্ষ ৳{activeDeal.amount.toLocaleString()} নিরাপদ হোল্ডে রেখেছেন। আপনি তাকে বিকাশ, নগদ বা ব্যাংকের মাধ্যমে টাকা পাঠিয়ে দ্রুত বামদিকের লাল <strong className="text-white">"টাকা পাঠানো শেষ"</strong> বাটনে ক্লিক করুন।</p>
                    )}
                  </>
                )}
                {activeDeal.step === 2 && (
                  <>
                    {isCreator ? (
                      <p>👉 লাল পক্ষ টাকা পাঠিয়েছেন বলে নিশ্চিত করেছেন। অনুগ্রহ করে আপনার পেমেন্ট ওয়ালেট চেক করুন। পেমেন্ট সঠিক পেয়ে থাকলে আপনার পিন কোড দিয়ে <strong className="text-white">"হ্যাঁ, পাইছি"</strong> বাটনে চাপ দিন।</p>
                    ) : (
                      <p>⌛ আপনি টাকা পাঠানো সম্পন্ন করেছেন। এখন সবুজ পক্ষ টাকা প্রাপ্তি নিশ্চিত করে "হ্যাঁ, পাইছি" বাটনে ক্লিক করার জন্য অপেক্ষা করুন।</p>
                    )}
                  </>
                )}
                {activeDeal.step === 3 && (
                  <>
                    {isCreator ? (
                      <p>⌛ আপনি টাকা পাওয়ার কথা স্বীকার করেছেন। এখন লাল পক্ষ ডানদিকের <strong className="text-white">"সম্পূর্ণ"</strong> বাটনে ক্লিক করলে ডিলটি রিলিজ হয়ে সফলভাবে শেষ হবে।</p>
                    ) : (
                      <p>✅ সবুজ পক্ষ টাকা বুঝে পেয়েছেন বলে নিশ্চিত করেছেন। লেনদেনটি সফলভাবে ক্লোজ করতে এবং ফান্ড রিলিজ করতে এখনই আপনার পিন দিয়ে ডানদিকের <strong className="text-white">"সম্পূর্ণ"</strong> বাটনে চাপ দিন।</p>
                    )}
                  </>
                )}
              </div>

              {/* Instant WhatsApp Support Link */}
              <div className="pt-2">
                <a
                  href={`https://wa.me/8801865911728`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition"
                >
                  💬 আমাদের সাহায্য বা ডিল সাপোর্ট
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* Create a New Escrow Deal Form (সবুজ পক্ষ) */
          <div id="new-deal-form" className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-[#015E34] flex items-center gap-2">
                🟢 নতুন ডিল তৈরি করুন (ফান্ড হোল্ডার)
              </h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Initialize a safe escrow transaction</p>
            </div>

            <div className="space-y-4">
              {/* Recipient Input */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">প্রাপকের AMB নিবন্ধিত নম্বর বা মেম্বার আইডি</label>
                <input
                  type="text"
                  placeholder="যেমনঃ 017xxxxxxxx বা মেম্বার আইডি"
                  value={recipientInput}
                  onChange={e => setRecipientInput(e.target.value)}
                  className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-extrabold focus:bg-white outline-none"
                />
                
                {/* Live Resolution result */}
                {resolvingRecipient && (
                  <p className="text-[10px] text-indigo-600 font-bold mt-1.5 animate-pulse flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>গ্রাহক যাচাই করা হচ্ছে...</span>
                  </p>
                )}
                {resolvedRecipient ? (
                  <div className="mt-2 p-2 bg-emerald-50 border border-emerald-150 rounded-xl text-[10px] font-black text-emerald-800 flex items-center gap-1.5 animate-fade-in">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>প্রাপক সচলঃ <strong>{resolvedRecipient.name}</strong> (আইডিঃ {resolvedRecipient.memberId})</span>
                  </div>
                ) : recipientInput.trim().length >= 5 && !resolvingRecipient ? (
                  <div className="mt-2 p-2 bg-rose-50 border border-rose-150 rounded-xl text-[10px] font-black text-rose-700 flex items-center gap-1.5 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span>দুঃখিত, কোনো নিবন্ধিত AMB সদস্য খুঁজে পাওয়া যায়নি!</span>
                  </div>
                ) : null}
              </div>

              {/* Amount Input */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">কত টাকা হোল্ডে রাখতে চান (Amount)</label>
                <input
                  type="number"
                  placeholder="হোল্ডের পরিমাণ লিখুন"
                  value={holdAmountInput}
                  onChange={e => setHoldAmountInput(e.target.value)}
                  className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-extrabold focus:bg-white outline-none font-mono"
                />
                {/* Quick select tags */}
                <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                  {[500, 1000, 2000, 5000, 10000].map((amt, idx) => (
                    <button
                      key={`${amt}-${idx}`}
                      type="button"
                      onClick={() => setHoldAmountInput(amt.toString())}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-extrabold px-3 py-1 rounded-lg border border-slate-200 transition shrink-0 cursor-pointer"
                    >
                      ৳{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallet PIN */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">আপনার ওয়ালেট সিকিউরিটি পিন (PIN)</label>
                <input
                  type="password"
                  placeholder="4 বা 5 ডিজিটের পিন লিখুন"
                  maxLength={5}
                  value={walletPinInput}
                  onChange={e => setWalletPinInput(e.target.value)}
                  className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-extrabold focus:bg-white outline-none font-mono"
                />
              </div>

              {/* Guidelines / Help details */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 text-[10.5px] font-bold text-slate-600 leading-relaxed space-y-1.5">
                <p className="text-slate-800 font-extrabold flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5 text-[#015E34]" /> নিয়োমাবলীঃ</p>
                <p>• টাকা হোল্ডে রাখলে তা আপনার ব্যালেন্স থেকে সাময়িক লক হয়ে থাকবে।</p>
                <p>• ডিল সফলভাবে শেষ হলে উক্ত লক ব্যালেন্সটি স্বয়ংক্রিয়ভাবে আপনার মেইন ব্যালেন্সে ফেরত দেওয়া হবে।</p>
                <p>• 15 মিনিট অতিক্রান্ত হয়ে গেলে অতিরিক্ত প্রতি মিনিটের জন্য 1 টাকা জরিমানা কার্যকর হবে।</p>
              </div>

              {/* Submit Action */}
              <button
                onClick={handleCreateDeal}
                disabled={isProcessing}
                className="w-full py-3.5 bg-[#059669] hover:bg-[#047857] text-white font-black text-xs rounded-2xl shadow-md tracking-wider transition-all active:scale-98 flex items-center justify-center gap-1 cursor-pointer"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>প্রক্রিয়াকরণ হচ্ছে...</span>
                  </div>
                ) : (
                  <>
                    <span>নিরাপদ এক্সচেঞ্জ ডিল শুরু করুন</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. PIN VERIFICATION DIALOG MODAL */}
      {showPinPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-150 shadow-2xl space-y-4 animate-scale-up">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-800">নিরাপত্তা নিশ্চিতকরণ</h3>
              <p className="text-xs text-slate-500 font-bold leading-normal">
                {showPinPrompt.action === 'yes_received'
                  ? 'টাকা বুঝে পেয়েছেন তা নিশ্চিত করতে দয়া করে আপনার ওয়ালেট পিন নম্বরটি প্রদান করুন।'
                  : 'লেনদেন সম্পূর্ণ করতে দয়া করে আপনার ওয়ালেট পিন নম্বরটি প্রদান করুন।'}
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                placeholder="আপনার ওয়ালেট পিন লিখুন"
                maxLength={5}
                value={actionPin}
                onChange={e => setActionPin(e.target.value)}
                className="w-full bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-sm font-extrabold text-center font-mono focus:bg-white outline-none"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPinPrompt(null)}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  onClick={executePinVerifiedAction}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'নিশ্চিত করুন'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. HIGH-SPEED CUSTOM DIGITAL TRANSACTION MONEY RECEIPT POPUP MODAL (মানি রিসিট পপআপ) */}
      {receiptModal && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in text-left font-sans">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Top Receipt Header */}
            <div className="bg-gradient-to-r from-[#014022] via-[#015E34] to-[#014022] text-white p-5 text-center relative shrink-0">
              <button
                onClick={() => setReceiptModal(null)}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-white/20 text-emerald-300">
                <CheckCircle2 className="w-7 h-7 text-emerald-300 animate-bounce-slow" />
              </div>
              <h2 className="text-base font-black tracking-wide text-white">{receiptModal.title}</h2>
              <p className="text-[10px] text-emerald-200 font-mono uppercase tracking-widest mt-0.5">
                Al Mayadin Bazar Escrow Gateway
              </p>
            </div>

            {/* Money Receipt Body */}
            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
              
              {/* Main Amount Display Badge */}
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-center">
                <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest block">টাকার পরিমাণ (Amount)</span>
                <span className="text-3xl font-black text-emerald-950 font-mono mt-0.5 block">
                  ৳{receiptModal.amount.toLocaleString('bn-BD')}
                </span>
                <span className="inline-block mt-2 px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10.5px] font-black rounded-full">
                  {receiptModal.statusBadge}
                </span>
              </div>

              {/* Detailed Itemized Ledger Table */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
                
                {/* Transaction ID */}
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-bold text-[11px]">ট্রানজেকশন নম্বর:</span>
                  <span className="font-mono font-black text-slate-800 text-xs bg-white px-2 py-0.5 rounded border border-slate-200">
                    {receiptModal.txnId}
                  </span>
                </div>

                {/* Date & Time (কখন গেছে) */}
                <div className="flex justify-between items-start border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-bold text-[11px] shrink-0">সময় ও তারিখ:</span>
                  <span className="font-extrabold text-slate-800 text-right text-[11px]">
                    {receiptModal.timestamp}
                  </span>
                </div>

                {/* Sender (দাতা) */}
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-bold text-[11px]">সবুজ পক্ষ (দাতা):</span>
                  <span className="font-extrabold text-slate-900">
                    {receiptModal.senderName} {receiptModal.senderPhone ? `(${receiptModal.senderPhone})` : ''}
                  </span>
                </div>

                {/* Recipient (গ্রহীতা) */}
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-bold text-[11px]">লাল পক্ষ (গ্রহীতা):</span>
                  <span className="font-extrabold text-slate-900">
                    {receiptModal.recipientName} {receiptModal.recipientPhone ? `(${receiptModal.recipientPhone})` : ''}
                  </span>
                </div>

                {/* Fine if any */}
                {receiptModal.fine !== undefined && receiptModal.fine > 0 && (
                  <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 text-rose-700">
                    <span className="font-bold text-[11px]">অতিরিক্ত সময় জরিমানা:</span>
                    <span className="font-black font-mono text-xs">৳{receiptModal.fine}</span>
                  </div>
                )}

                {/* Status Description */}
                <div className="pt-1 text-[11px] text-slate-700 leading-relaxed font-medium">
                  <strong>বিবরণ:</strong> {receiptModal.note}
                </div>
              </div>

              {/* Security Seal Note */}
              <div className="text-[10px] text-slate-400 text-center font-bold">
                🔒 100% নিরাপদ এনক্রিপ্টেড ডিজিটাল মানি রিসিট • AMB Bangladesh
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={copyReceiptToClipboard}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedReceipt ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">কপি হয়েছে!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>রিসিট কপি করুন</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setReceiptModal(null)}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black transition cursor-pointer"
              >
                সম্পন্ন / বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. PREVIOUS DEALS HISTORY DRAWER/MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center">
          <div className="bg-white rounded-t-[2.5rem] w-full max-w-md p-6 max-h-[80vh] overflow-y-auto shadow-2xl border-t border-slate-150 space-y-5 animate-slide-up text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-[#015E34] flex items-center gap-1.5">
                <Clock className="w-5 h-5" /> পূর্ববর্তী লেনদেন হিসাব
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full transition text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {historyDeals.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <span className="text-3xl block">📁</span>
                <p className="text-xs font-bold">এখনো কোনো নিরাপদ লেনদেন সম্পন্ন হয়নি।</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {historyDeals.map((deal, idx) => (
                  <div key={`${deal.id}-${idx}`} className="bg-slate-50 p-4 rounded-2xl border border-slate-150/80 flex justify-between items-center text-xs">
                    <div className="space-y-1 text-left">
                      <p className="font-black text-slate-800">৳{deal.amount.toLocaleString()} AMB</p>
                      <p className="text-[10px] text-slate-500 font-bold">গ্রহীতাঃ {deal.recipientName}</p>
                      <p className="text-[8px] text-slate-400 font-mono">
                        {deal.completedAt ? new Date(deal.completedAt).toLocaleString('bn-BD') : ''}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-black uppercase">
                        সম্পন্ন
                      </span>
                      {deal.fine > 0 && (
                        <p className="text-[8.5px] text-rose-600 font-black">জরিমানাঃ ৳{deal.fine}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MoneyExchangeModule;

