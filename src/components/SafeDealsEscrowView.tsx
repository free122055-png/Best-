import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import UnifiedBackButton from './UnifiedBackButton';
import { 
  Lock, 
  HelpCircle, 
  Send, 
  Clock, 
  Check, 
  CheckCircle, 
  X, 
  XCircle, 
  ChevronRight, 
  User, 
  Phone, 
  ShieldCheck, 
  AlertCircle, 
  ArrowLeft, 
  ArrowDown, 
  Truck, 
  AlertTriangle,
  Search,
  Filter,
  DollarSign,
  Eye,
  EyeOff,
  Download,
  Share2,
  Printer,
  Copy,
  UploadCloud,
  ClipboardList
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { User as UserType, Transaction } from '../types';
import { useBackHandler } from '../lib/navigationManager';

interface SafeDealsEscrowViewProps {
  liveUser: UserType;
  syncLiveProfile: () => Promise<void>;
  appConfig?: any;
  onBack?: () => void;
  allNotices?: any[];
}

export default function SafeDealsEscrowView({ 
  liveUser, 
  syncLiveProfile, 
  appConfig, 
  onBack,
  allNotices = []
}: SafeDealsEscrowViewProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'confirmed' | 'shipped' | 'cancelled'>('all');
  const [showBalance, setShowBalance] = useState<boolean>(true);

  // States for localized transaction history
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [showSectionTxHistory, setShowSectionTxHistory] = useState(false);
  const [txModalSearch, setTxModalSearch] = useState('');

  const fetchTxHistory = async () => {
    setLoadingTx(true);
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', liveUser.uid)
      );
      const snapshot = await getDocs(q);
      const list: Transaction[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setTxHistory(list);
    } catch (e) {
      console.error("Error fetching escrow tx:", e);
    } finally {
      setLoadingTx(false);
    }
  };

  // Compute total escrow balance currently locked in safe deals for this buyer
  const safeDealsBalance = orders
    .filter(order => 
      (order.buyerUid === liveUser.uid || order.buyerPhone === liveUser.phone) &&
      (order.status === 'Payment Held' || order.status === 'Shipped')
    )
    .reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);

  const defaultDealsSlides = [
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1563013544-824ae1d704d3?auto=format&fit=crop&q=80&w=800",
      title: "নিরাপদ ট্রাস্ট ও লেনদেন",
      description: "ডিজিটাল এসক্রো ব্যবস্থার সাথে প্রতিটি ডিল ও লেনদেন হোক সম্পূর্ণ নিরাপদ ও ঝুঁকিমুক্ত।"
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=800",
      title: "গ্রুপ বাই ডিল ও সমবায় পেমেন্ট",
      description: "ক্রেতা বিক্রেতার শতভাগ নিশ্চয়তা, টাকা থাকবে আমাদের সুরক্ষিত ওয়ালেটে।"
    }
  ];

  const adSlides = appConfig?.safeDealsBanners && appConfig.safeDealsBanners.length > 0 
    ? appConfig.safeDealsBanners 
    : defaultDealsSlides;

  const [currentAdSlide, setCurrentAdSlide] = useState(0);

  useEffect(() => {
    if (adSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAdSlide((prev) => (prev + 1) % adSlides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [adSlides.length]);

  // Trigger real-time sync with safe_deal_orders
  useEffect(() => {
    // Sync all escrow orders where liveUser is either the buyer or the seller, or if the user is an admin/sub_admin
    const unsubscribe = onSnapshot(collection(db, 'safe_deal_orders'), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        // Include if associated with current user, or if admin/sub_admin
        if (
          liveUser.role === 'admin' || 
          liveUser.role === 'sub_admin' || 
          data.buyerUid === liveUser.uid || 
          data.sellerUid === liveUser.uid || 
          data.buyerPhone === liveUser.phone || 
          data.sellerPhone === liveUser.phone
        ) {
          list.push({ id: d.id, ...data });
        }
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setOrders(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [liveUser]);

  // Recipient resolution inside "টাকা পাঠান" form
  const [sendPhone, setSendPhone] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendPurpose, setSendPurpose] = useState('');
  const [sendPin, setSendPin] = useState('');
  const [resolvedRecipient, setResolvedRecipient] = useState<any | null>(null);
  const [checkingRecipient, setCheckingRecipient] = useState(false);
  
  useEffect(() => {
    const checkRecipient = async () => {
      const cleaned = sendPhone.trim();
      if (cleaned.length < 5) {
        setResolvedRecipient(null);
        return;
      }
      setCheckingRecipient(true);
      try {
        // Query users by Member ID
        const q1 = query(collection(db, 'users'), where('memberId', '==', cleaned));
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
          setResolvedRecipient({ id: snap1.docs[0].id, ...snap1.docs[0].data() });
          return;
        }

        // Query users by Phone
        const q2 = query(collection(db, 'users'), where('phone', '==', cleaned));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          setResolvedRecipient({ id: snap2.docs[0].id, ...snap2.docs[0].data() });
          return;
        }

        setResolvedRecipient(null);
      } catch (err) {
        console.error("Error checking recipient", err);
      } finally {
        setCheckingRecipient(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      checkRecipient();
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [sendPhone]);

  // Modals visibility toggles
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedVoucher, setCopiedVoucher] = useState(false);
  const [voucherData, setVoucherData] = useState<{
    title: string;
    bookingId: string;
    amount: number;
    buyerName: string;
    buyerPhone: string;
    sellerName: string;
    sellerPhone: string;
    detail: string;
    courierName?: string;
    trackingNumber?: string;
    status: string;
    timestamp: string;
  } | null>(null);

  const [confirmModalData, setConfirmModalData] = useState<{
    title: string;
    description: string;
    actionLabel: string;
    onConfirm: () => void;
    type: 'release' | 'cancel';
    amount: number;
    bookingId: string;
  } | null>(null);

  // Seller ship variables
  const [courierName, setCourierName] = useState('সুন্দরবন কুরিয়ার');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [showShipForm, setShowShipForm] = useState(false);
  const [shipmentScreenshot, setShipmentScreenshot] = useState<string | null>(null);
  const [shipmentScreenshotName, setShipmentScreenshotName] = useState('');

  // Support & Dispute states
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeOrder, setDisputeOrder] = useState<any | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeContactPhone, setDisputeContactPhone] = useState(liveUser.phone || '');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [showSupportHistoryModal, setShowSupportHistoryModal] = useState(false);
  const [searchTicketNo, setSearchTicketNo] = useState('');
  const [searchTicketResult, setSearchTicketResult] = useState<any | null>(null);
  const [searchTicketError, setSearchTicketError] = useState('');
  const [searchingTicket, setSearchingTicket] = useState(false);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);

  // Safe Deals internal back handler
  useBackHandler(() => {
    if (showDisputeModal) { setShowDisputeModal(false); return true; }
    if (showSupportHistoryModal) { setShowSupportHistoryModal(false); return true; }
    if (showShipForm) { setShowShipForm(false); return true; }
    if (showSendModal) { setShowSendModal(false); return true; }
    if (showReceiveModal) { setShowReceiveModal(false); return true; }
    if (showHelpModal) { setShowHelpModal(false); return true; }
    if (showSectionTxHistory) { setShowSectionTxHistory(false); return true; }
    if (selectedOrder) { setSelectedOrder(null); return true; }
    if (voucherData) { setVoucherData(null); return true; }
    if (confirmModalData) { setConfirmModalData(null); return true; }
    return false;
  }, true, 25);

  // Sync support tickets real-time
  useEffect(() => {
    if (!liveUser?.uid) return;
    const q = (liveUser.role === 'admin' || liveUser.role === 'sub_admin')
      ? collection(db, 'escrow_disputes')
      : query(collection(db, 'escrow_disputes'), where('userId', '==', liveUser.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setSupportTickets(list);
    });
    return () => unsubscribe();
  }, [liveUser]);

  // Stats Counters
  const countPending = orders.filter(o => o.status === 'Payment Held').length;
  const countConfirmed = orders.filter(o => o.status === 'Payment Released').length;
  const countShipped = orders.filter(o => o.status === 'Shipped').length;
  const countCancelled = orders.filter(o => o.status === 'Cancelled' || o.status === 'Refunded').length;

  // Filter logic
  const filteredOrders = orders.filter(o => {
    if (activeFilter === 'pending') return o.status === 'Payment Held';
    if (activeFilter === 'confirmed') return o.status === 'Payment Released';
    if (activeFilter === 'shipped') return o.status === 'Shipped';
    if (activeFilter === 'cancelled') return o.status === 'Cancelled' || o.status === 'Refunded';
    return true; // 'all'
  });

  // Bengali Date helper
  const formatBengaliDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const bengaliMonths = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const day = d.getDate();
    const month = bengaliMonths[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    const bNum = (num: any) => {
      const numbers: Record<string, string> = {
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
        '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
      };
      return num.toString().split('').map((char: string) => numbers[char] || char).join('');
    };

    return `${bNum(day)} ${month}, ${bNum(year)} • ${bNum(hours)}:${bNum(minutes)} ${ampm}`;
  };

  // Convert English number to Bengali number helper
  const englishToBengaliNumber = (num: any) => {
    if (num === undefined || num === null) return '0';
    const numbers: Record<string, string> = {
      '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
    };
    return num.toString().split('').map((char: string) => numbers[char] || char).join('');
  };

  // Format money with commas in English first, then convert characters to Bengali digit
  const formatBengaliMoney = (value: number) => {
    const formatted = Number(value || 0).toLocaleString('en-US');
    return englishToBengaliNumber(formatted);
  };

  // Send Secure Escrow Money Execution
  const handleSendEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(sendAmount);
    if (!sendPhone || isNaN(cleanAmount) || cleanAmount <= 0) {
      setErrorMsg("অনুগ্রহ করে মোবাইল/আইডি এবং সঠিক টাকার পরিমাণ লিখুন।");
      return;
    }
    if (cleanAmount > liveUser.balance) {
      setErrorMsg(`আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই! আপনার ব্যালেন্স মাত্র ৳${liveUser.balance.toLocaleString('bn-BD')} BDT।`);
      return;
    }
    if (sendPin !== liveUser.pin) {
      setErrorMsg("আপনার নিরাপত্তা পিন নম্বরটি সঠিক নয়!");
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const timestamp = new Date().toISOString();

      // Deduct sender's balance
      const senderRef = doc(db, 'users', liveUser.uid);
      await updateDoc(senderRef, {
        balance: liveUser.balance - cleanAmount,
        mainBalance: liveUser.balance - cleanAmount
      });

      // Create new safe deal escrow order
      const orderData = {
        buyerUid: liveUser.uid,
        buyerName: liveUser.name,
        buyerPhone: liveUser.phone,
        buyerMemberId: liveUser.memberId,
        sellerUid: resolvedRecipient ? resolvedRecipient.uid : '',
        sellerName: resolvedRecipient ? resolvedRecipient.name : 'অনিবন্ধিত প্রাপক',
        sellerPhone: resolvedRecipient ? resolvedRecipient.phone : sendPhone.trim(),
        sellerMemberId: resolvedRecipient ? resolvedRecipient.memberId : '',
        dealTitle: sendPurpose || 'নিরাপদ লেনদেন ডিল',
        totalAmount: cleanAmount,
        pricePerItem: cleanAmount,
        quantity: 1,
        status: 'Payment Held', // 'অপেক্ষমাণ' state
        createdAt: timestamp,
        courierName: '',
        trackingNumber: '',
        shipmentDate: '',
        statusHistory: [
          { status: 'Payment Held', timestamp, note: 'ক্রেতা মেইন ব্যালেন্স দিয়ে নিরাপদ লেনদেন শুরু করেছেন। টাকা সাময়িকভাবে এসক্রো সুরক্ষিত ওয়ালেটে হোল্ড করা হয়েছে।' }
        ]
      };

      const docRef = await addDoc(collection(db, 'safe_deal_orders'), orderData);
      // Dispatch real-time Admin Notification for Safe Deal booking
      addDoc(collection(db, 'admin_notifications'), {
        title: '🛡️ নতুন নিরাপদ লেনদেন (এসক্রো ডিল) বুকিং',
        message: `${liveUser.name || 'সদস্য'} (${liveUser.memberId || 'N/A'}) ৳${cleanAmount.toLocaleString('bn-BD')} টাকার একটি নতুন নিরাপদ লেনদেন শুরু করেছেন (প্রাপক: ${sendPhone})।`,
        userId: liveUser.uid,
        userName: liveUser.name || '',
        memberId: liveUser.memberId || '',
        userPhone: liveUser.phone || '',
        recipientPhone: sendPhone,
        amount: cleanAmount,
        type: 'safe_deal_booking',
        read: false,
        createdAt: timestamp
      }).catch(e => console.warn('Admin notif error:', e));

      // Log transaction for sender (Escrow Locked) as 'fee_payment' type compliant with schema
      await addDoc(collection(db, 'transactions'), {
        id: `tx-esc-held-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'fee_payment',
        typeLabel: 'নিরাপদ লেনদেন হোল্ড',
        amount: cleanAmount,
        status: 'success',
        description: `নিরাপদ ডিল ফান্ড বুকিং: ${sendPurpose || 'লেনদেন'} (আইডি: ${docRef.id.substring(0, 6).toUpperCase()})। টাকা এসক্রো লক করা হয়েছে।`,
        createdAt: timestamp,
        paymentMethod: 'Main Balance'
      });

      // Log system notice for recipient
      if (resolvedRecipient) {
        await addDoc(collection(db, 'notices'), {
          title: `নিরাপদ লেনদেন জমার নিবেদন!`,
          content: `${liveUser.name} (AMB ID: ${liveUser.memberId}) আপনার ফোন নম্বরে ৳${cleanAmount.toLocaleString('bn-BD')} BDT এর একটি নিরাপদ লেনদেন বুকিং জমা করেছেন। ট্র্যাকিং জমা দিয়ে বা পণ্যটি পাঠিয়ে রিলিজ বুঝে নিন।`,
          createdAt: timestamp
        });
      }

      setShowSendModal(false);
      setSendPhone('');
      setSendAmount('');
      setSendPurpose('');
      setSendPin('');
      setResolvedRecipient(null);
      await syncLiveProfile();

      setVoucherData({
        title: "নিরাপদ লেনদেন ফান্ড বুকিং ভাউচার",
        bookingId: docRef.id.toUpperCase(),
        amount: cleanAmount,
        buyerName: liveUser.name,
        buyerPhone: liveUser.phone || liveUser.memberId,
        sellerName: resolvedRecipient ? resolvedRecipient.name : 'অনিবন্ধিত প্রাপক',
        sellerPhone: sendPhone,
        detail: sendPurpose || 'নিরাপদ লেনদেন ডিল',
        courierName: '-',
        trackingNumber: '-',
        status: 'অপেক্ষমাণ সুরক্ষায় হোল্ড (Held)',
        timestamp: new Date().toLocaleString('bn-BD')
      });

    } catch (err: any) {
      console.error(err);
      setErrorMsg("লেনদেন সম্পন্ন করা যায়নি: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Shipper updates tracking detail (Seller/Recipient)
  const handleShipProduct = async (order: any) => {
    if (!trackingNumber.trim()) {
      alert("অনুগ্রহ করে কুরিয়ার ট্র্যাকিং নাম্বার লিখুন।");
      return;
    }
    setSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const orderRef = doc(db, 'safe_deal_orders', order.id);

      const updatedHistory = [
        ...(order.statusHistory || []),
        { status: 'Shipped', timestamp, note: `বিক্রেতা পণ্যটি শিপ করেছেন এবং ট্র্যাকিং তথ্য দিয়েছেনঃ ${courierName}, ট্র্যাকিং নং ${trackingNumber}` }
      ];

      await updateDoc(orderRef, {
        status: 'Shipped',
        courierName,
        trackingNumber,
        shipmentDate: new Date().toLocaleDateString('bn-BD'),
        statusHistory: updatedHistory,
        shipmentScreenshot: shipmentScreenshot || ''
      });

      // Notice to buyer
      await addDoc(collection(db, 'notices'), {
        title: `নিরাপদ লেনদেনঃ কুরিয়ার পণ্য বুকিং অ্যালার্ট!`,
        content: `আপনার বুকিংকৃত ডিল "${order.dealTitle}" এর বিপরীতে কুরিয়ার করা হয়েছে। ট্র্যাকিং নাম্বারঃ ${trackingNumber} (${courierName})। পণ্য হাতে পেয়ে অনুগ্রহ করে ওয়ালেটে পেমেন্ট রিলিজ নিশ্চিত করুন।`,
        createdAt: timestamp
      });

      setVoucherData({
        title: "নিরাপদ কুরিয়ার পণ্য ট্র্যাকিং রসিদ",
        bookingId: order.id.toUpperCase(),
        amount: order.totalAmount,
        buyerName: order.buyerName || 'ক্রেতা',
        buyerPhone: order.buyerPhone || '-',
        sellerName: order.sellerName || 'বিক্রেতা',
        sellerPhone: order.sellerPhone || '-',
        detail: order.dealTitle || 'নিরাপদ লেনদেন ডিল',
        courierName: courierName,
        trackingNumber: trackingNumber,
        status: 'পণ্য পাঠানো হয়েছে (Shipped)',
        timestamp: new Date().toLocaleString('bn-BD')
      });
      setShowShipForm(false);
      setTrackingNumber('');
      setShipmentScreenshot(null);
      setShipmentScreenshotName('');
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({ 
          ...selectedOrder, 
          status: 'Shipped', 
          courierName, 
          trackingNumber,
          shipmentScreenshot: shipmentScreenshot || ''
        });
      }
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Execute actual Release Funds logic
  const executeReleaseFunds = async (order: any) => {
    setConfirmModalData(null);
    setSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const orderRef = doc(db, 'safe_deal_orders', order.id);

      // 1. Update order status to Payment Released
      const updatedHistory = [
        ...(order.statusHistory || []),
        { status: 'Payment Released', timestamp, note: 'ক্রেতা সন্তুষ্ট হয়ে সফলভাবে পণ্য বুঝে পেয়ে পেমেন্ট রিলিজ নিশ্চিত করেছেন।' }
      ];

      await updateDoc(orderRef, {
        status: 'Payment Released',
        approvedAt: timestamp,
        statusHistory: updatedHistory
      });

      // 2. Transfer funds to target seller/recipient's balance if they are registered users
      if (order.sellerUid) {
        const sellerRef = doc(db, 'users', order.sellerUid);
        const sellerSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', order.sellerUid)));
        if (!sellerSnap.empty) {
          const sellerData = sellerSnap.docs[0].data();
          await updateDoc(sellerRef, {
            balance: (sellerData.balance || 0) + order.totalAmount,
            mainBalance: (sellerData.balance || 0) + order.totalAmount
          });
        }

        // Log transaction for recipient (deposit credit)
        await addDoc(collection(db, 'transactions'), {
          id: `tx-esc-rec-${Date.now()}`,
          userId: order.sellerUid,
          userName: order.sellerName,
          memberId: order.sellerMemberId || 'SELLER',
          type: 'deposit',
          typeLabel: 'নিরাপদ লেনদেন প্রাপ্তি',
          amount: order.totalAmount,
          status: 'success',
          description: `নিরাপদ লেনদেন সম্পন্নঃ ক্রেতা পণ্য চেক করে টাকা রিলিজ করেছেন (মোবাইল: ${order.buyerPhone})।`,
          createdAt: timestamp,
          paymentMethod: 'Escrow Release'
        });
      }

      setVoucherData({
        title: "নিরাপদ লেনদেন নিষ্পত্তি ভাউচার (Released)",
        bookingId: order.id.toUpperCase(),
        amount: order.totalAmount,
        buyerName: order.buyerName || 'ক্রেতা',
        buyerPhone: order.buyerPhone || '-',
        sellerName: order.sellerName || 'বিক্রেতা',
        sellerPhone: order.sellerPhone || '-',
        detail: order.dealTitle || 'নিরাপদ লেনদেন ডিল',
        courierName: order.courierName || '-',
        trackingNumber: order.trackingNumber || '-',
        status: 'সম্পন্ন ও রিলিজড (Completed)',
        timestamp: new Date().toLocaleString('bn-BD')
      });
      setSelectedOrder(null);
      await syncLiveProfile();
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Buyer Releases Funds to Seller
  const handleReleaseFunds = (order: any) => {
    setConfirmModalData({
      title: "পেমেন্ট রিলিজ নিশ্চিতকরণ",
      description: `আপনি কি এই ডিলটির পেমেন্ট সম্পন্ন করতে চান? আপনি পেমেন্ট নিশ্চিত করলে সরাসরি এই টাকা বিক্রেতার ব্যালেন্সে জমা হয়ে যাবে এবং এটি পরিবর্তন করা সম্ভব নয়।`,
      actionLabel: "হ্যাঁ, পেমেন্ট দিন",
      type: "release",
      amount: order.totalAmount,
      bookingId: order.id,
      onConfirm: () => executeReleaseFunds(order)
    });
  };

  // Execute actual Cancel/Refund Escrow logic
  const executeCancelEscrow = async (order: any) => {
    setConfirmModalData(null);
    setSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const orderRef = doc(db, 'safe_deal_orders', order.id);

      // 1. Update order status
      const updatedHistory = [
        ...(order.statusHistory || []),
        { status: 'Refunded', timestamp, note: 'লেনদেন বাতিল করা হয়েছে এবং টাকা সম্পূর্ণ ফেরত পাঠানো হয়েছে।' }
      ];

      await updateDoc(orderRef, {
        status: 'Refunded',
        statusHistory: updatedHistory
      });

      // 2. Credit back the buyer's balance
      const buyerRef = doc(db, 'users', order.buyerUid);
      const buyerSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', order.buyerUid)));
      if (!buyerSnap.empty) {
        const buyerData = buyerSnap.docs[0].data();
        await updateDoc(buyerRef, {
          balance: (buyerData.balance || 0) + order.totalAmount
        });
      }

      // Log transaction for buyer credit
      await addDoc(collection(db, 'transactions'), {
        id: `tx-esc-refund-${Date.now()}`,
        userId: order.buyerUid,
        userName: order.buyerName,
        memberId: order.buyerMemberId,
        type: 'deposit',
        typeLabel: 'নিরাপদ লেনদেন রিফান্ড',
        amount: order.totalAmount,
        status: 'success',
        description: `নিরাপদ লেনদেন বুকিং রিফান্ডঃ ডিল বাতিল হওয়ার কারণে পেমেন্ট মেইন ব্যালেন্সে ক্রেডিট করা হয়েছে।`,
        createdAt: timestamp,
        paymentMethod: 'Escrow Refund'
      });

      setVoucherData({
        title: "নিরাপদ লেনদেন বাতিল ও রিফান্ড ভাউচার",
        bookingId: order.id.toUpperCase(),
        amount: order.totalAmount,
        buyerName: order.buyerName || 'ক্রেতা',
        buyerPhone: order.buyerPhone || '-',
        sellerName: order.sellerName || 'বিক্রেতা',
        sellerPhone: order.sellerPhone || '-',
        detail: order.dealTitle || 'নিরাপদ লেনদেন ডিল',
        courierName: order.courierName || '-',
        trackingNumber: order.trackingNumber || '-',
        status: 'রিফান্ডেড ও বাতিল (Refunded)',
        timestamp: new Date().toLocaleString('bn-BD')
      });
      setSelectedOrder(null);
      await syncLiveProfile();
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel/Refund Transaction (Available to Seller freely OR Admin)
  const handleCancelEscrow = (order: any) => {
    setConfirmModalData({
      title: "লেনদেন বাতিল ও রিফান্ড নিশ্চিতকরণ",
      description: `আপনি কি নিশ্চিতভাবে এই লেনদেনটি বাতিল বা রিফান্ড করতে চান? বুকিংকৃত টাকা সরাসরি পুনরায় ক্রেতার মেইন ওয়ালেটে ফেরত দেওয়া হবে।`,
      actionLabel: "হ্যাঁ, বাতিল ও রিফান্ড করুন",
      type: "cancel",
      amount: order.totalAmount,
      bookingId: order.id,
      onConfirm: () => executeCancelEscrow(order)
    });
  };

  const handleOpenDisputeModal = (order: any) => {
    setDisputeOrder(order);
    setDisputeReason('');
    setDisputeContactPhone(liveUser.phone || '');
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeOrder) return;
    if (!disputeReason.trim()) {
      alert("অনুগ্রহ করে আপনার অভিযোগের বিবরণ বিস্তারিত লিখুন।");
      return;
    }

    setSubmittingDispute(true);
    try {
      const timestamp = new Date().toISOString();
      const ticketId = `SUP-${Math.floor(100000 + Math.random() * 900000)}`;
      
      // Determine the sequential serial number
      const allDisputesSnap = await getDocs(collection(db, 'escrow_disputes'));
      const serialNo = allDisputesSnap.size + 1;

      const disputeDoc = {
        ticketId,
        serialNo,
        userId: liveUser.uid,
        userName: liveUser.name,
        userPhone: disputeContactPhone || liveUser.phone || '',
        orderId: disputeOrder.id,
        orderTitle: disputeOrder.dealTitle || 'নিরাপদ লেনদেন ডিল',
        amount: Number(disputeOrder.totalAmount) || 0,
        description: disputeReason.trim(),
        status: 'Pending', // Pending, Processing, Resolved
        createdAt: timestamp,
        whatsappSupportNumber: '01865911728',
        courierName: disputeOrder.courierName || 'N/A',
        trackingNumber: disputeOrder.trackingNumber || 'N/A',
        shipmentDate: disputeOrder.shipmentDate || 'N/A'
      };

      await addDoc(collection(db, 'escrow_disputes'), disputeDoc);
      // Dispatch real-time Admin Notification for Escrow Dispute
      addDoc(collection(db, 'admin_notifications'), {
        title: '🚨 নিরাপদ লেনদেন অভিযোগ ও সাপোর্ট টিকিট দাখিল',
        message: `${liveUser.name || 'সদস্য'} (${liveUser.memberId || 'N/A'}) ডিল #${disputeOrder.id?.substring(0, 8).toUpperCase()} এর বিপরীতে অভিযোগ দাখিল করেছেন (টিকিট: ${ticketId})।`,
        userId: liveUser.uid,
        userName: liveUser.name || '',
        memberId: liveUser.memberId || '',
        userPhone: disputeContactPhone || liveUser.phone || '',
        orderId: disputeOrder.id,
        ticketId: ticketId,
        amount: Number(disputeOrder.totalAmount) || 0,
        type: 'safe_deal_dispute',
        read: false,
        createdAt: timestamp
      }).catch(e => console.warn('Admin notif error:', e));

      // Add a notice to user about support ticket submission
      await addDoc(collection(db, 'notices'), {
        title: `অভিযোগ সাবমিট সম্পন্নঃ রসিদ নং ${ticketId}`,
        content: `আপনার নিরাপদ লেনদেন ডিল "${disputeOrder.dealTitle}" এর বিপরীতে অভিযোগটি সফলভাবে রেজিস্টার করা হয়েছে। সিরিয়াল নংঃ ${serialNo}। আমাদের গ্রাহক সেবা প্রতিনিধি আপনার সাথে হোয়াটসঅ্যাপে (01865911728) যোগাযোগ করবেন।`,
        createdAt: timestamp
      });

      alert(`আলহামদুলিল্লাহ! আপনার অভিযোগটি সফলভাবে রেকর্ড করা হয়েছে।\nরসিদ নম্বর: ${ticketId}\nআপনার অভিযোগের সিরিয়াল নং: ${serialNo}`);
      
      setShowDisputeModal(false);
      setDisputeOrder(null);
      setDisputeReason('');
      
      // Open support tracker to let them see it
      setShowSupportHistoryModal(true);

    } catch (err: any) {
      console.error(err);
      alert("অভিযোগ সাবমিট করা যায়নি: " + err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleSearchTicket = async () => {
    const queryStr = searchTicketNo.trim().toUpperCase();
    if (!queryStr) {
      setSearchTicketError('অনুগ্রহ করে সঠিক রসিদ নম্বর দিন।');
      return;
    }
    setSearchingTicket(true);
    setSearchTicketResult(null);
    setSearchTicketError('');
    try {
      const q = query(
        collection(db, 'escrow_disputes'),
        where('ticketId', '==', queryStr)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setSearchTicketError('দুঃখিত, এই রসিদ নম্বরের কোনো অভিযোগ পাওয়া যায়নি। অনুগ্রহ করে সঠিক রসিদ নম্বর টাইপ করুন।');
      } else {
        setSearchTicketResult({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (err: any) {
      setSearchTicketError('অনুসন্ধান ব্যর্থ হয়েছেঃ ' + err.message);
    } finally {
      setSearchingTicket(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 font-sans">
      <div className="max-w-2xl mx-auto p-4 space-y-5 pb-24">
        {/* Simple back arrow button inside the scrollable content container */}
        <div className="flex items-center justify-between gap-1 w-full flex-nowrap">
          <div className="flex items-center gap-1">
            <UnifiedBackButton
              onClick={() => {
                if (showDisputeModal) { setShowDisputeModal(false); return; }
                if (showSupportHistoryModal) { setShowSupportHistoryModal(false); return; }
                if (showShipForm) { setShowShipForm(false); return; }
                if (showSendModal) { setShowSendModal(false); return; }
                if (showReceiveModal) { setShowReceiveModal(false); return; }
                if (showHelpModal) { setShowHelpModal(false); return; }
                if (showSectionTxHistory) { setShowSectionTxHistory(false); return; }
                if (selectedOrder) { setSelectedOrder(null); return; }
                if (voucherData) { setVoucherData(null); return; }
                if (confirmModalData) { setConfirmModalData(null); return; }
                if (onBack) onBack();
              }}
              variant="dark"
              title="পিছনে যান"
            />

            <button 
              type="button"
              onClick={() => {
                fetchTxHistory();
                setShowSectionTxHistory(true);
              }}
              className="flex items-center gap-1 px-2 py-1.5 bg-indigo-50 border border-indigo-150 hover:bg-indigo-100 text-indigo-700 text-[10px] sm:text-xs font-black rounded-xl shadow-4xs cursor-pointer transition-all shrink-0 active:scale-95"
              title="নিরাপদ লেনদেন খতিয়ান"
            >
              <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
              <span>খতিয়ান</span>
            </button>
          </div>

          {/* Dual Balance Widget (Main Balance on Left, Safe Deal locked balance on Right) */}
          <button
            type="button"
            onClick={() => setShowBalance(!showBalance)}
            className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full p-0.5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer select-none text-left shrink-0 scale-95 sm:scale-100 origin-right"
          >
            {/* Main Balance */}
            <div className="flex items-center gap-0.5 px-1.5 py-0.5 sm:py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 rounded-full">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[8px] font-sans shrink-0">৳</span>
              <div className="flex flex-col leading-none">
                <span className="text-[6.5px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-black">মেইন</span>
                <span className="text-[10px] font-bold font-mono">
                  {showBalance ? `৳${(liveUser.balance || 0).toLocaleString('bn-BD')}` : '••••'}
                </span>
              </div>
            </div>

            {/* Separator / Divider */}
            <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-800 mx-0.5" />

            {/* Safe Deals Held Balance */}
            <div className="flex items-center gap-0.5 px-1.5 py-0.5 sm:py-1 text-slate-700 dark:text-slate-300">
              <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[8px] font-sans shrink-0">৳</span>
              <div className="flex flex-col leading-none">
                <span className="text-[6.5px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-black">
                  নিরাপদ<span className="hidden xs:inline"> লেনদেন</span>
                </span>
                <span className="text-[10px] font-bold font-mono text-indigo-700 dark:text-indigo-400">
                  {showBalance ? `৳${safeDealsBalance.toLocaleString('bn-BD')}` : '••••'}
                </span>
              </div>
            </div>

            {/* Toggle Eye Icon */}
            <div className="pl-0.5 pr-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 transition shrink-0">
              {showBalance ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </div>
          </button>
        </div>

        {/* Urgent Notice Scroll Ticker (Full screen content view like Dashboard) */}
        <div className="bg-white border-2 border-emerald-800/80 rounded-full px-3 py-1.5 flex items-center gap-3.5 overflow-hidden shadow-sm w-full mx-auto">
          <div className="bg-emerald-800 text-white text-[10.5px] font-black px-3.5 py-1 rounded-full shrink-0 shadow-3xs flex items-center gap-1">
            <span>ঘোষণা</span>
          </div>
          <div className="flex-grow overflow-hidden relative mr-1.5">
            <marquee className="text-[12px] font-bold text-slate-800 leading-none py-0.5" behavior="scroll" direction="left" scrollamount="4">
              {appConfig?.escrowTicker || "AMB নিরাপদ লেনদেনঃ যেকোনো প্রোডাক্ট কুরিয়ার কন্ডিশনে ক্রয়ের পূর্বে এসক্রো ডিল বুকিং করে আপনার মেইন ব্যালেন্সের পেমেন্ট নিরাপদ করুন।"}
            </marquee>
          </div>
        </div>

        {/* Section Specific Notices */}
        {(() => {
          const dealNotices = allNotices.filter(n => n.section === 'safe_deal');
          if (dealNotices.length === 0) return null;
          return (
            <div className="space-y-2">
              {dealNotices.map((n, idx) => (
                <div key={`${n.id}-${idx}`} className="bg-blue-50 border border-blue-155 p-3.5 rounded-2xl text-left relative overflow-hidden shadow-3xs">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs shrink-0 mt-0.5">📢</span>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-blue-900 leading-snug">{n.title}</h4>
                      <p className="text-[11px] text-blue-800 font-bold leading-normal">{n.content}</p>
                      <span className="text-[8.5px] text-blue-400 font-mono block pt-0.5">{new Date(n.createdAt).toLocaleDateString('bn-BD')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Custom Support & Dispute tracker button */}
        <button
          type="button"
          onClick={() => setShowSupportHistoryModal(true)}
          className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold py-3.5 px-4 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md border border-amber-400/40"
        >
          <AlertTriangle className="w-4 h-4 text-white animate-pulse" />
          <span>অভিযোগ ট্র্যাকিং ও কাস্টমার কেয়ার (Support Desk)</span>
        </button>
        
        {/* 2. YOUTUBE SIZE BANNER */}
        <div className="relative rounded-none overflow-hidden aspect-video shadow-sm border border-slate-200/80 bg-slate-900 group w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentAdSlide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 w-full h-full"
            >
              <img 
                src={adSlides[currentAdSlide].image} 
                alt="নিরাপদ লেনদেন ব্যানার"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
            </motion.div>
          </AnimatePresence>
          
          {/* Indicator Dots */}
          {adSlides.length > 1 && (
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 z-20">
              {adSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentAdSlide(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    currentAdSlide === idx ? 'w-4 bg-[#1A56DB]' : 'w-1.5 bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* 3. TWO ACTION CARDS - MATCHING IMAGE */}
        <div className="grid grid-cols-2 bg-white rounded-[32px] overflow-hidden border border-[#E2E8F0] shadow-sm divide-x divide-[#E2E8F0]">
          
          {/* Card A: টাকা গ্রহণ করুন (Left Green) */}
          <div className="bg-[#EEFBF6] py-8 sm:py-10 px-4 text-center flex flex-col items-center justify-between">
            <div className="w-full">
              {/* Green circle with down arrow */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center border border-[#D5F3E5] shadow-xs mx-auto mb-4">
                <ArrowDown className="w-7 h-7 sm:w-8 sm:h-8 text-[#008F56] stroke-[3.5]" />
              </div>

              <h3 className="text-lg sm:text-[22px] font-black text-[#008F56] tracking-tight text-center leading-none">
                টাকা গ্রহণ করুন
              </h3>
              <p className="text-[#475569] text-xs sm:text-[13px] font-black text-center leading-relaxed mt-3 whitespace-pre-line">
                কেউ টাকা পাঠালে{"\n"}এখানে গ্রহণ করুন
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowReceiveModal(true);
              }}
              className="mt-6 bg-[#008955] hover:bg-[#007346] active:scale-95 text-white font-black text-xs sm:text-[13px] tracking-wide py-2.5 sm:py-3 px-5 sm:px-6 rounded-full transition-transform w-[130px] sm:w-[155px] shadow-sm cursor-pointer text-center leading-none"
            >
              টাকা গ্রহণ করুন
            </button>
          </div>

          {/* Card B: টাকা পাঠান (Right Red) */}
          <div className="bg-[#FFF5F6] py-8 sm:py-10 px-4 text-center flex flex-col items-center justify-between">
            <div className="w-full">
              {/* Red circle with paper plane */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center border border-[#FFE4E6] shadow-xs mx-auto mb-4">
                <Send className="w-7 h-7 sm:w-8 sm:h-8 text-[#D90429] stroke-[2.5] -rotate-45 translate-x-0.5 -translate-y-0.5" />
              </div>

              <h3 className="text-lg sm:text-[22px] font-black text-[#D90429] tracking-tight text-center leading-none">
                টাকা পাঠান
              </h3>
              <p className="text-[#475569] text-xs sm:text-[13px] font-black text-center leading-relaxed mt-3 whitespace-pre-line">
                কার্ডে টাকা পাঠিয়ে{"\n"}নিরাপদে রাখুন
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSendModal(true)}
              className="mt-6 bg-[#D90429] hover:bg-[#B30321] active:scale-95 text-white font-black text-xs sm:text-[13px] tracking-wide py-2.5 sm:py-3 px-5 sm:px-6 rounded-full transition-transform w-[130px] sm:w-[155px] shadow-sm cursor-pointer text-center leading-none"
            >
              টাকা পাঠান
            </button>
          </div>

        </div>

        {/* 4. MY TRANSACTIONS SECTION & COUNTS */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[14.5px] font-black text-slate-900">আমার লেনদেন</h3>
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              সব দেখুন <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 4 Status summary cards matching the image alignment */}
          <div className="grid grid-cols-4 gap-1 sm:gap-3">
            {/* Stat 1: অপেক্ষমাণ */}
            <button
              type="button"
              onClick={() => setActiveFilter('pending')}
              className={`p-1.5 xs:p-2 sm:p-3.5 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1 transition-all border text-left ${
                activeFilter === 'pending' 
                  ? 'bg-blue-150 border-blue-400 ring-2 ring-blue-150' 
                  : 'bg-[#F0F5FF] hover:bg-blue-100/60 border-blue-50'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-[#2563EB] stroke-[2.5] shrink-0" />
                <span className="text-[8.5px] xs:text-[10px] sm:text-[11px] font-black text-[#2563EB] truncate">অপেক্ষমাণ</span>
              </div>
              <p className="text-xs sm:text-[19px] font-black text-slate-900 font-sans mt-1 sm:mt-1.5 leading-none truncate">
                • {englishToBengaliNumber(countPending)} টি
              </p>
              <p className="text-[8px] sm:text-[10px] text-slate-500 font-extrabold mt-0.5 sm:mt-1 truncate">টাকা ছাড় হয় নি</p>
            </button>

            {/* Stat 2: নিশ্চিত হয়েছে */}
            <button
              type="button"
              onClick={() => setActiveFilter('confirmed')}
              className={`p-1.5 xs:p-2 sm:p-3.5 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1 transition-all border text-left ${
                activeFilter === 'confirmed' 
                  ? 'bg-emerald-150 border-emerald-400 ring-2 ring-emerald-150' 
                  : 'bg-[#ECFDF5] hover:bg-emerald-100/60 border-emerald-50'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[#059669] stroke-[2.5] shrink-0" />
                <span className="text-[8.5px] xs:text-[10px] sm:text-[11px] font-black text-[#059669] truncate">নিশ্চিত হয়েছে</span>
              </div>
              <p className="text-xs sm:text-[19px] font-black text-slate-900 font-sans mt-1 sm:mt-1.5 leading-none truncate">
                • {englishToBengaliNumber(countConfirmed)} টি
              </p>
              <p className="text-[8px] sm:text-[10px] text-slate-500 font-extrabold mt-0.5 sm:mt-1 truncate">লেনদেন সম্পন্ন</p>
            </button>

            {/* Stat 3: পথে পাঠানো */}
            <button
              type="button"
              onClick={() => setActiveFilter('shipped')}
              className={`p-1.5 xs:p-2 sm:p-3.5 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1 transition-all border text-left ${
                activeFilter === 'shipped' 
                  ? 'bg-amber-150 border-amber-400 ring-2 ring-amber-150' 
                  : 'bg-[#FFFBEB] hover:bg-amber-100/60 border-amber-100/40'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Truck className="w-3 h-3 sm:w-4 sm:h-4 text-[#D97706] stroke-[2.5] shrink-0" />
                <span className="text-[8.5px] xs:text-[10px] sm:text-[11px] font-black text-[#B45309] truncate">পথে পাঠানো</span>
              </div>
              <p className="text-xs sm:text-[19px] font-black text-slate-900 font-sans mt-1 sm:mt-1.5 leading-none truncate">
                • {englishToBengaliNumber(countShipped)} টি
              </p>
              <p className="text-[8px] sm:text-[10px] text-slate-500 font-extrabold mt-0.5 sm:mt-1 truncate">নিশ্চিতের অপেক্ষায়</p>
            </button>

            {/* Stat 4: বাতিল */}
            <button
              type="button"
              onClick={() => setActiveFilter('cancelled')}
              className={`p-1.5 xs:p-2 sm:p-3.5 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1 transition-all border text-left ${
                activeFilter === 'cancelled' 
                  ? 'bg-rose-150 border-rose-400 ring-2 ring-rose-150' 
                  : 'bg-[#FFF5F5] hover:bg-rose-100/60 border-rose-100/40'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[#E11D48] stroke-[2.5] shrink-0" />
                <span className="text-[8.5px] xs:text-[10px] sm:text-[11px] font-black text-[#E11D48] truncate">বাতিল</span>
              </div>
              <p className="text-xs sm:text-[19px] font-black text-slate-900 font-sans mt-1 sm:mt-1.5 leading-none truncate">
                • {englishToBengaliNumber(countCancelled)} টি
              </p>
              <p className="text-[8px] sm:text-[10px] text-slate-500 font-extrabold mt-0.5 sm:mt-1 truncate">লেনদেন বাতিল</p>
            </button>
          </div>
        </div>

        {/* 5. RECENT TRANSACTIONS SECTION ("সাম্প্রতিক লেনদেন") */}
        <div className="space-y-3 pt-2 text-left">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-black text-slate-900 flex items-center gap-1.5">
              সাম্প্রতিক লেনদেন
              {activeFilter !== 'all' && (
                <span className="text-[9px] font-extrabold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full select-none flex items-center gap-1">
                  ফিল্টারঃ {activeFilter === 'pending' ? 'অপেক্ষমাণ' : activeFilter === 'confirmed' ? 'সম্পন্ন' : activeFilter === 'shipped' ? 'পণ্য পাঠানো' : 'বাতিল'}
                  <button onClick={() => setActiveFilter('all')} className="hover:text-red-600 font-black ml-1 text-slate-500">×</button>
                </span>
              )}
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">রিয়েল-টাইম ডাটাবেস</span>
          </div>

          {loading ? null : filteredOrders.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed border-slate-200 bg-white rounded-3xl text-slate-450 text-xs font-bold">
              এই ক্যাটাগরিতে কোনো বুকিং লেনদেন পাওয়া যায়নি।
            </div>
          ) : (
            <div className="bg-white border border-slate-200/85 rounded-3xl overflow-hidden divide-y divide-slate-100 shadow-3xs">
              {filteredOrders.map((order, idx) => {
                const isBuyer = order.buyerUid === liveUser.uid;
                const otherPartyName = isBuyer ? order.sellerName : order.buyerName;
                const initials = otherPartyName ? otherPartyName.charAt(0).toUpperCase() : 'B';
                
                // Subtitle label determine
                let labelText = isBuyer ? 'টাকা পাঠিয়েছেন' : 'টাকা পেয়েছেন';
                if (order.status === 'Cancelled' || order.status === 'Refunded') {
                  labelText = 'লেনদেন বাতিল';
                }

                // Render dynamic status pill on transaction item
                let statusBadgeColor = 'bg-blue-50 text-blue-700 border-blue-100';
                let statusText = 'অপেক্ষমাণ';
                if (order.status === 'Payment Released') {
                  statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  statusText = 'সম্পন্ন';
                } else if (order.status === 'Cancelled' || order.status === 'Refunded') {
                  statusBadgeColor = 'bg-rose-50 text-rose-700 border-rose-100';
                  statusText = 'বাতিল';
                } else if (order.status === 'Shipped') {
                  statusBadgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                  statusText = 'পণ্য পাঠানো';
                }

                // Assign background pattern to Avatar based on initials to match screenshot
                const charCode = initials.charCodeAt(0) || 65;
                const avatarBg = charCode % 3 === 0 
                  ? 'bg-blue-600' 
                  : charCode % 3 === 1 
                    ? 'bg-emerald-600' 
                    : 'bg-amber-500';

                return (
                  <div 
                    key={`${order.id}-${idx}`}
                    onClick={() => setSelectedOrder(order)}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all cursor-pointer font-sans"
                  >
                    {/* Left details */}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${avatarBg} text-white font-extrabold text-base rounded-full flex items-center justify-center shadow-3xs`}>
                        {initials}
                      </div>
                      
                      <div className="text-left space-y-0.5">
                        <h4 className="text-xs sm:text-sm font-black text-slate-905 text-gray-900 leading-normal">{otherPartyName || 'কো-অপারেটিভ মেম্বার'}</h4>
                        <p className={`text-[10px] font-bold ${order.status === 'Cancelled' || order.status === 'Refunded' ? 'text-rose-500' : 'text-slate-450'}`}>
                          {labelText}
                        </p>
                      </div>
                    </div>

                    {/* Right part */}
                    <div className="flex items-center gap-3">
                      <div className="text-right space-y-0.5">
                        <p className="text-sm sm:text-base font-black text-slate-900 font-mono">
                          ৳ {formatBengaliMoney(order.totalAmount)}
                        </p>
                        <p className="text-[9.5px] text-slate-400 font-semibold font-mono">
                          {formatBengaliDate(order.createdAt)}
                        </p>
                      </div>

                      {/* Status pill & arrow */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${statusBadgeColor}`}>
                          {statusText}
                        </span>
                        <ChevronRight className="w-4 const h-4 text-slate-400" />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* MODAL I: টাকা পাঠান (Send secure money form) */}
      <AnimatePresence>
        {showSendModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-55 font-sans">
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-md border border-slate-100 shadow-2xl relative overflow-hidden text-left space-y-4"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600" />
              
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-extrabold text-blue-700 flex items-center gap-2">
                  <Send className="w-4 h-4" /> নিরাপদ এসক্রো টাকা পাঠান
                </h3>
                <button 
                  type="button"
                  onClick={() => {
                    setShowSendModal(false);
                    setErrorMsg('');
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSendEscrow} className="space-y-4">
                {/* Search recipient */}
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-600">প্রাপকের মোবাইল নম্বর অথবা মেম্বার আইডি *</label>
                  <div className="relative">
                    <input 
                      type="text"
                      required
                      placeholder="উদাঃ AMB00005327 অথবা মোবাইল"
                      value={sendPhone}
                      onChange={(e) => setSendPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-blue-500 font-mono text-sm pl-10"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  </div>

                  {checkingRecipient && (
                    <p className="text-[9.5px] text-blue-600 font-bold animate-pulse">ডাটাবেসে প্রাপক খোঁজা হচ্ছে...</p>
                  )}

                  {resolvedRecipient ? (
                    <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl flex items-center justify-between text-xs mt-1.5">
                      <div className="text-left">
                        <p className="font-extrabold text-emerald-800 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> প্রাপক সঠিকঃ
                        </p>
                        <p className="text-slate-700 mt-0.5 font-bold">{resolvedRecipient.name} ({resolvedRecipient.memberId || 'সাধারণ সদস্য'})</p>
                      </div>
                      <span className="text-[9.5px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md">ভেরিফাইড</span>
                    </div>
                  ) : sendPhone.length >= 5 && !checkingRecipient && (
                    <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl text-[10.5px] text-amber-800 leading-relaxed font-bold">
                      ⚠ প্রাপক ডাটাবেসে নিবন্ধিত পাওয়া যায়নি। আপনার দেওয়া তথ্য পুনরায় নিশ্চিত করুন।
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-600">টাকার পরিমাণ (৳ BDT) *</label>
                  <input 
                    type="number"
                    required
                    min="100"
                    placeholder="নূন্যতম 100 টাকা"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-sm font-black focus:border-blue-500 font-mono"
                  />
                  <p className="text-[9.5px] text-slate-400">আপনার বর্তমান ব্যালেন্সঃ ৳{liveUser.balance?.toLocaleString('bn-BD')} BDT</p>
                </div>

                {/* Purpose/Description */}
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-600">লেনদেনের উদ্দেশ্য / বিবরণ (ঐচ্ছিক)</label>
                  <input 
                    type="text"
                    placeholder="উদাঃ শাড়ি ও জামা কাপড়ের পেমেন্ট"
                    value={sendPurpose}
                    onChange={(e) => setSendPurpose(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs"
                  />
                </div>

                {/* Security Pin */}
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-600">আপনার 4 ডিজিটের নিরাপত্তা পিন নাম্বার *</label>
                  <input 
                    type="password"
                    required
                    maxLength={4}
                    placeholder="••••"
                    value={sendPin}
                    onChange={(e) => setSendPin(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-center focus:border-blue-500 font-mono tracking-widest text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold py-3.5 px-4 rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      টাকা পাঠানো হচ্ছে...
                    </>
                  ) : (
                    <>✓ বুকিং নিশ্চিত ও সুরক্ষিত হোল্ড করুন</>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL II: টাকা গ্রহণ করুন (Receive/Accept orders list overlay) */}
      <AnimatePresence>
        {showReceiveModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-55 font-sans">
            <motion.div
              initial={{ y: 85, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 85, opacity: 0 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-lg border border-slate-100 shadow-2xl relative overflow-hidden text-left space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-600" />

              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-extrabold text-emerald-800 flex items-center gap-1.5">
                  <ArrowDown className="w-4 h-4" /> সুরক্ষিত ডিল টাকা ও কুরিয়ার গ্রহণ করুন
                </h3>
                <button 
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Find list where Seller is current user and status is Payment Held */}
              {(() => {
                const pendingSales = orders.filter(o => o.sellerUid === liveUser.uid && o.status === 'Payment Held');
                return (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 font-bold mb-2">কেউ নিরাপদ লেনদেনের মাধ্যমে আপনাকে টাকা বুকিং করলে নিচে দেখতে পাবেন এবং কুরিয়ার প্রদানের পর রিলিজ নিতে পারবেনঃ</p>
                    
                    {pendingSales.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold leading-relaxed">
                        আপাতত আপনার জন্য কোনো পেন্ডিং বুকিং পাওয়া যায়নি। ক্রেতাদের আপনার AMB মোবাইল নম্বরে বা AMB মেম্বার আইডিতে "টাকা পাঠান" সেকশন ব্যবহার করে পেমেন্ট করার কথা বলুন।
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingSales.map((item, idx) => (
                          <div key={`${item.id}-${idx}`} className="p-4 bg-[#F9FAFB] border border-slate-205 border-slate-200 rounded-2xl space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                                  <span>👤 {item.buyerName}</span>
                                  <span className="text-[10px] font-mono text-slate-400 bg-white border px-1.5 rounded">ID: {item.buyerMemberId}</span>
                                </h4>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">বুকিং আইডিঃ #{item.id.substring(0, 6).toUpperCase()}</p>
                              </div>
                              <span className="text-sm font-black text-[#0D9488] font-mono">৳ {item.totalAmount.toLocaleString('en-US')}</span>
                            </div>

                            <div className="bg-white p-2.5 rounded-xl text-[11px] text-slate-600 font-bold border border-slate-150 relative">
                              <span className="text-[8.5px] uppercase font-black tracking-wider text-slate-400 block mb-0.5">লেনদেনের উদ্দেশ্যঃ</span>
                              "{item.dealTitle || 'নিরাপদ ক্রয় ডিল'}"
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrder(item);
                                setShowReceiveModal(false);
                              }}
                              className="w-full bg-[#057A55] hover:bg-emerald-800 text-white font-extrabold py-2 px-3 rounded-xl text-xs transition cursor-pointer text-center flex items-center justify-center gap-1"
                            >
                              পণ্য শিপিং ট্র্যাকিং বা রিফান্ড পরিচালনা করুন <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL III: TRANSACTION DETAIL TIMELINE MODAL */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-55 font-sans">
            <motion.div
              initial={{ y: 90, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 90, opacity: 0 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-sm border border-slate-100 shadow-2xl relative overflow-hidden text-left space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600" />

              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">নিরাপদ লেনদেন ভাউচার</h3>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">বুকিং আইডিঃ #{selectedOrder.id.toUpperCase()}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedOrder(null);
                    setShowShipForm(false);
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Status & money summary card */}
              <div className="bg-slate-50 border p-4 rounded-2.5xl space-y-2.5 text-center relative overflow-hidden">
                <p className="text-[10px] text-slate-400 font-black block">বুকিং পেমেন্ট পরিমাণ</p>
                <h2 className="text-2xl font-black text-slate-900 font-sans font-mono">
                  ৳ {formatBengaliMoney(selectedOrder.totalAmount)} BDT
                </h2>
                
                <div className="flex items-center justify-center gap-1 bg-white border py-1.5 px-3 rounded-full self-center inline-block mx-auto text-xs font-black text-slate-700 shadow-4xs">
                  স্ট্যাটাসঃ 
                  <span className={`font-black ml-1 uppercase`}>
                    {selectedOrder.status === 'Payment Held' ? '⏳ অপেক্ষমাণ হোল্ড' : 
                     selectedOrder.status === 'Payment Released' ? '✓ সম্পন্ন (Paid)' : 
                     selectedOrder.status === 'Shipped' ? '🚚 পণ্য পাঠানো হয়েছে' : '❌ বাতিল ও ফেরতকৃত'}
                  </span>
                </div>
              </div>

              {/* Deal description metadata details */}
              <div className="space-y-2.5 text-xs text-slate-650 font-bold">
                <div className="grid grid-cols-2 gap-2 border-b pb-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider">টাকা পেয়ার (ক্রেতা)</span>
                    <p className="text-slate-800 font-extrabold">{selectedOrder.buyerName}</p>
                    <p className="text-slate-500 font-mono text-[9px]">{selectedOrder.buyerPhone}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider">টাকা প্রাপক (বিক্রেতা)</span>
                    <p className="text-slate-800 font-extrabold">{selectedOrder.sellerName}</p>
                    <p className="text-slate-500 font-mono text-[9px]">{selectedOrder.sellerPhone}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 block text-[9px] uppercase tracking-wider">লেনদেনের উদ্দেশ্য ও বিবরণঃ</span>
                  <p className="p-2.5 bg-[#F9FAFB] border rounded-xl italic font-medium leading-relaxed font-sans text-slate-705">
                    "{selectedOrder.dealTitle || 'সুরক্ষিত ক্রয় লেনদেন ডিল'}"
                  </p>
                </div>

                {selectedOrder.courierName && (
                  <div className="bg-sky-50 border border-sky-100 p-2.5 rounded-xl space-y-1.5 text-[10.5px]">
                    <p className="font-extrabold text-sky-900 flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-sky-700" /> শিপিং ট্র্যাকিং তথ্যঃ
                    </p>
                    <p className="text-slate-750">কুরিয়ার কোম্পানিঃ <span className="font-extrabold">{selectedOrder.courierName}</span></p>
                    <p className="text-slate-750">শিপমেন্ট পোস্টিং তারিখঃ <span className="font-mono font-extrabold">{selectedOrder.shipmentDate || 'ম্যাপকৃত'}</span></p>
                    <p className="text-slate-755 font-semibold">ট্র্যাকিং কোডঃ <span className="font-mono font-black text-rose-800 bg-white border px-2 py-0.5 rounded shadow-4xs">{selectedOrder.trackingNumber}</span></p>
                    
                    {selectedOrder.shipmentScreenshot && (
                      <div className="mt-2 pt-2 border-t border-sky-200/50 space-y-1">
                        <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-extrabold">সংযুক্ত রসিদ বা স্ক্রিনশটঃ</span>
                        <div className="relative group overflow-hidden rounded-lg border border-slate-200/60 bg-white max-w-full">
                          <img 
                            src={selectedOrder.shipmentScreenshot} 
                            alt="Shipment Memo" 
                            className="w-full max-h-48 object-contain cursor-zoom-in"
                            onClick={() => {
                              const imgWindow = window.open();
                              if (imgWindow) {
                                imgWindow.document.write(`<img src="${selectedOrder.shipmentScreenshot}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                              } else {
                                alert("পপ-আপ ব্লক করা হয়েছে। অনুগ্রহ করে পপ-আপ অনুমোদন করুন।");
                              }
                            }}
                          />
                          <p className="text-center py-1 text-[8px] bg-slate-50 text-slate-500 font-bold">
                            ছবিতে ক্লিক করে বড় করে দেখুন
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions segment */}
              <div className="space-y-2 pt-2 border-t">
                {/* 1. Buyer actions */}
                {selectedOrder.buyerUid === liveUser.uid && (selectedOrder.status === 'Payment Held' || selectedOrder.status === 'Shipped') && (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleReleaseFunds(selectedOrder)}
                      className="w-full bg-[#057A55] hover:bg-emerald-800 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-emerald-950/10"
                    >
                      <Check className="w-4 h-4" /> পণ্য পেয়েছি (টাকা রিলিজ করুন)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenDisputeModal(selectedOrder)}
                      className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer text-center flex items-center justify-center gap-1"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> বিবাদ বা অভিযোগ (Admin Support)
                    </button>
                  </div>
                )}

                {/* 2. Seller actions */}
                {selectedOrder.sellerUid === liveUser.uid && selectedOrder.status === 'Payment Held' && (
                  <div className="space-y-3">
                    {!showShipForm ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setShowShipForm(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Truck className="w-4 h-4" /> পণ্য কুরিয়ার করুন
                        </button>

                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleCancelEscrow(selectedOrder)}
                          className="bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-extrabold py-2.5 px-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          বাতিল ও রিফান্ড ↺
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border rounded-2xl space-y-3">
                        <p className="text-[10px] uppercase font-black tracking-widest text-[#0D9488]">📦 কুরিয়ার ট্র্যাকিং জমা দিন</p>
                        
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500">কুরিয়ার সার্ভিস কোম্পানিঃ</label>
                          <select
                            value={courierName}
                            onChange={(e) => setCourierName(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="ক্যাশ টু ক্যাশ নিরাপদ ডেলিভারি">ক্যাশ টু ক্যাশ নিরাপদ ডেলিভারি (Cash to Cash)</option>
                            <option value="সুন্দরবন কুরিয়ার">সুন্দরবন কুরিয়ার (Sundarban)</option>
                            <option value="এস এ পরিবহন">এস এ পরিবহন (SA Paribahan)</option>
                            <option value="পাঠাও কুরিয়ার">পাঠাও কুরিয়ার (Pathao)</option>
                            <option value="রেডএক্স কুরিয়ার">রেডএক্স কুরিয়ার (REDX)</option>
                            <option value="নিজেদের হোম ডেলিভারি">হ্যান্ড টু হ্যান্ড হোম ডেলিভারি</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500">মেমো বা ট্র্যাকিং রসিদ নম্বরঃ</label>
                          <input 
                            type="text"
                            required
                            placeholder="উদাঃ CN-73491-DN"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>

                        {/* Image/screenshot upload component */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500">
                            রসিদ বা স্ক্রিনশট আপলোড (ঐচ্ছিক):
                          </label>
                          {!shipmentScreenshot ? (
                            <div
                              onClick={() => document.getElementById('shipment-screenshot-input')?.click()}
                              className="border border-dashed border-slate-250 hover:border-[#0D9488] hover:bg-slate-50 rounded-lg py-2 px-2.5 text-center cursor-pointer flex items-center justify-center gap-1.5 transition duration-200 bg-white"
                            >
                              <input 
                                id="shipment-screenshot-input"
                                type="file" 
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 2 * 1024 * 1024) {
                                      alert('রসিদ ছবির সাইজ সর্বোচ্চ 2 মেগাবাইট হতে পারে!');
                                      return;
                                    }
                                    setShipmentScreenshotName(file.name);
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      setShipmentScreenshot(reader.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              <UploadCloud className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                              <span className="text-[10px] font-bold text-slate-600">গ্যালারি থেকে ছবি সিলেক্ট করুন</span>
                            </div>
                          ) : (
                            <div className="relative border rounded-lg p-1.5 bg-emerald-50/40 border-emerald-100 flex items-center gap-1.5">
                              <img 
                                src={shipmentScreenshot} 
                                alt="Receipt Preview" 
                                className="w-8 h-8 rounded-md object-cover border border-emerald-200 bg-white shadow-3xs shrink-0" 
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-[9.5px] font-bold text-slate-700 block truncate">{shipmentScreenshotName || 'receipt.png'}</span>
                                <span className="text-[8px] text-emerald-600 font-extrabold block leading-none">সফলভাবে লোড হয়েছে ✔</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setShipmentScreenshot(null);
                                  setShipmentScreenshotName('');
                                }}
                                className="w-5 h-5 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 font-bold text-[10px]"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            onClick={() => setShowShipForm(false)}
                            className="flex-1 py-1 px-2 border rounded-lg text-slate-400 text-xs font-bold"
                          >
                            বন্ধ
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleShipProduct(selectedOrder)}
                            className="flex-grow bg-[#057A55] hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold py-1 px-3 rounded-lg text-xs"
                          >
                            {submitting ? 'জমা হচ্ছে...' : 'জমা দিন'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Closed trans message */}
                {selectedOrder.status === 'Payment Released' && (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-2.5 rounded-xl text-[11px] text-center font-bold flex items-center justify-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-700" /> এই লেনদেনের সম্পূর্ণ সমাধান হয়ে ক্লোজ করা হয়েছে।
                  </div>
                )}

                {selectedOrder.status === 'Refunded' && (
                  <div className="bg-rose-50 text-rose-800 border border-rose-100 p-2.5 rounded-xl text-[11px] text-center font-bold flex items-center justify-center gap-1">
                    <XCircle className="w-4 h-4 text-rose-700" /> এই লেনদেনটি বাতিল ও ক্রেতাকে রিফান্ড সম্পন্নকৃত।
                  </div>
                )}

                {/* 4. Admin Arbitrator Actions */}
                {(liveUser.role === 'admin' || liveUser.role === 'sub_admin') && (selectedOrder.status === 'Payment Held' || selectedOrder.status === 'Shipped') && (
                  <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-2xl space-y-2 mt-2">
                    <p className="text-[10px] uppercase font-black tracking-widest text-amber-900 flex items-center gap-1">
                      🛡️ প্রশাসনিক সালিশি প্যানেল (Admin Arbitrator)
                    </p>
                    <p className="text-[9.5px] text-amber-700 font-bold leading-normal">
                      সালিশকারী হিসেবে আপনি ক্রেতা/বিক্রেতার বিবাদ নিষ্পত্তি করতে ফোর্স অ্যাকশন সম্পন্ন করতে পারবেন।
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleReleaseFunds(selectedOrder)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-3 rounded-xl text-[10.5px] transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        ফোর্স পেমেন্ট রিলিজ
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleCancelEscrow(selectedOrder)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 px-3 rounded-xl text-[10.5px] transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        ফোর্স বাতিল ও রিফান্ড
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL IV: নীতিমালা ও সাহায্য নির্দেশিকা (Help / Safe Rules manual) */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 w-full max-w-sm border border-slate-100 shadow-2xl relative overflow-hidden text-left space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 to-emerald-600" />

              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-extrabold text-[#0D9488] flex items-center gap-1">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" /> নিরাপদ লেনদেন ও এসক্রো নীতিমালাঃ
                </h3>
                <button 
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-slate-600 font-bold leading-relaxed font-sans">
                <div className="space-y-1">
                  <h4 className="text-slate-800 font-extrabold">1. এসক্রো বা নিরাপদ হোল্ড কি?</h4>
                  <p className="text-[11px] text-slate-500">নিরাপদ লেনদেন হল সমবায় ইউনিয়নের ডিজিটাল সমাধান। এখানে ক্রেতার টাকা বিক্রেতাকে সাথে সাথে দেওয়া হয় না। পণ্য ক্রেতা ভালোমতো হাতে বুঝে নিয়ে ওয়ালেটে 'পণ্য পেয়েছি' নিশ্চিত করলেই কেবল বিক্রেতা পেমেন্ট লাভ করেন।</p>
                </div>

                <div className="space-y-1">
                  <h4 className="text-slate-800 font-extrabold">2. বিক্রেতা ট্র্যাকিং কিভাবে দিবেন?</h4>
                  <p className="text-[11px] text-slate-500">বিক্রেতা যখন পণ্যটি কোনো কুরিয়ারে বুকিং দেন, তখন সাথে সাথে প্রাপ্ত রসিদ বা মোমো নম্বর কুরিয়ার নাম সহ ইনপুট দিবেন। এটি দিলে স্ট্যাটাস পণ্য পাঠানো- তে হালনাগাদ হয়ে যায়।</p>
                </div>

                <div className="space-y-1">
                  <h4 className="text-slate-800 font-extrabold">3. 72 ঘণ্টার অটোমেটিক এডমিন সহায়তা</h4>
                  <p className="text-[11px] text-slate-500">বিক্রেতা পণ্য সরবারাহ সম্পন্ন করার পরও যদি ক্রেতা 72 ঘণ্টার ভেতর টাকা রিলিজ না করেন বা কোনো অভিযোগ না পাঠান, তবে সমবায় এডমিন তদন্ত সাপেক্ষে লেনদেনটি সুরাহা করে থাকেন।</p>
                </div>

                <div className="space-y-12 block pt-2">
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(false)}
                    className="w-full bg-[#1A56DB] text-white py-2.5 rounded-xl font-extrabold text-xs text-center cursor-pointer hover:bg-blue-700"
                  >
                    বুঝেছি, ধন্যবাদ
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Centered Success Popup Overlay */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs font-sans"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-emerald-100"
            >
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 animate-pulse">
                <CheckCircle className="w-9 h-9 stroke-[2.5]" />
              </div>
              <h3 className="text-base font-black text-slate-800 mb-2">লেনদেন সফল হয়েছে!</h3>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl mb-5 text-left">
                <p className="text-xs font-bold text-slate-700 leading-relaxed text-center">
                  {successMsg}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg('')}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-xs transition duration-200 cursor-pointer active:scale-98"
              >
                ঠিক আছে
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Centered Detailed Success Receipt Voucher Overlay */}
      <AnimatePresence>
        {voucherData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs font-sans overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-emerald-100 overflow-hidden my-8"
            >
              {/* Header with Brand Accent */}
              <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-5 text-center relative">
                <div className="absolute right-4 top-4">
                  <button 
                    type="button" 
                    onClick={() => setVoucherData(null)}
                    className="p-1.5 hover:bg-white/10 rounded-full transition cursor-pointer"
                  >
                    <X className="w-5 h-5 text-white/80" />
                  </button>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-white/20">
                  <ShieldCheck className="w-7 h-7 text-emerald-300" />
                </div>
                <h2 className="text-sm font-extrabold tracking-wide text-emerald-100">BUSINESS NETWORK BANGLADESH</h2>
                <p className="text-[10px] text-white/70">নিরাপদ বাতায়ন ও সমবায় ব্যাংকিং</p>
                <div className="inline-block mt-3 bg-white/15 text-emerald-50 text-[11px] font-black px-3 py-1 rounded-full border border-white/10">
                  {voucherData.title}
                </div>
              </div>

              {/* Receipt Body */}
              <div className="p-5 space-y-4">
                {/* Large Amount Box */}
                <div className="bg-emerald-50/50 border border-emerald-100/80 rounded-2xl p-4 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">লেনদেনের মোট পরিমাণ</span>
                  <div className="text-2xl font-black text-emerald-800 mt-1">
                    ৳ {Number(voucherData.amount).toLocaleString('bn-BD')} <span className="text-sm font-bold">BDT</span>
                  </div>
                </div>

                {/* Details List */}
                <div className="space-y-2.5 bg-slate-50 border border-slate-100 p-4 rounded-2xl text-xs font-bold text-slate-700">
                  <div className="flex items-start justify-between pb-2 border-b border-slate-200/50">
                    <span className="text-slate-400 shrink-0">বুকিং আইডি:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[11px] text-slate-800 break-all select-all">{voucherData.bookingId}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(voucherData.bookingId);
                          setCopiedVoucher(true);
                          setTimeout(() => setCopiedVoucher(false), 2000);
                        }}
                        className="text-emerald-600 hover:text-emerald-700 p-0.5"
                        title="কপি করুন"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between pb-2 border-b border-slate-200/50">
                    <span className="text-slate-400">তারিখ ও সময়:</span>
                    <span className="text-slate-800">{voucherData.timestamp}</span>
                  </div>

                  <div className="flex justify-between pb-2 border-b border-slate-200/50">
                    <span className="text-slate-400">ক্রেতা (প্রেরক):</span>
                    <span className="text-slate-800">{voucherData.buyerName} ({voucherData.buyerPhone})</span>
                  </div>

                  <div className="flex justify-between pb-2 border-b border-slate-200/50">
                    <span className="text-slate-400">বিক্রেতা (প্রাপক):</span>
                    <span className="text-slate-800">{voucherData.sellerName} ({voucherData.sellerPhone})</span>
                  </div>

                  <div className="flex items-start justify-between pb-2 border-b border-slate-200/50">
                    <span className="text-slate-400 shrink-0">লেনদেনের বিবরণ:</span>
                    <span className="text-slate-800 text-right">"{voucherData.detail}"</span>
                  </div>

                  {voucherData.courierName && voucherData.courierName !== '-' && (
                    <div className="flex justify-between pb-2 border-b border-slate-200/50">
                      <span className="text-slate-400">কুরিয়ার কোম্পানি:</span>
                      <span className="text-slate-800">{voucherData.courierName}</span>
                    </div>
                  )}

                  {voucherData.trackingNumber && voucherData.trackingNumber !== '-' && (
                    <div className="flex justify-between pb-2 border-b border-slate-200/50">
                      <span className="text-slate-400">মেমো বা ট্র্যাকিং নং:</span>
                      <span className="text-slate-800">{voucherData.trackingNumber}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">লেনদেনের স্ট্যাটাস:</span>
                    <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                      {voucherData.status}
                    </span>
                  </div>
                </div>

                {/* Copied alert toast indicator */}
                {copiedVoucher && (
                  <div className="text-center text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-100 py-1.5 rounded-xl animate-pulse">
                    ✓ তথ্য সফলভাবে ক্লিপবোর্ডে কপি করা হয়েছে!
                  </div>
                )}

                {/* Main Action Grid */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const canvas = document.createElement('canvas');
                        canvas.width = 600;
                        canvas.height = 880;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;

                        // Fill background
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Draw dual border
                        ctx.strokeStyle = '#e2e8f0';
                        ctx.lineWidth = 12;
                        ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
                        ctx.strokeStyle = '#057a55'; // emerald-700
                        ctx.lineWidth = 2;
                        ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

                        // Draw Header Logo and Subtitle
                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#057a55';
                        ctx.font = 'bold 24px system-ui, sans-serif';
                        ctx.fillText('BUSINESS NETWORK BANGLADESH', canvas.width / 2, 70);

                        ctx.fillStyle = '#475569';
                        ctx.font = 'bold 12px system-ui, sans-serif';
                        ctx.fillText('নিরাপদ বাতায়ন ও সমবায় ব্যাংকিং', canvas.width / 2, 95);

                        // Draw Badge Title
                        ctx.fillStyle = '#f1f5f9';
                        const titleWidth = 260;
                        const titleHeight = 32;
                        ctx.fillRect((canvas.width - titleWidth) / 2, 115, titleWidth, titleHeight);
                        ctx.strokeStyle = '#cbd5e1';
                        ctx.strokeRect((canvas.width - titleWidth) / 2, 115, titleWidth, titleHeight);

                        ctx.fillStyle = '#0f172a';
                        ctx.font = 'bold 13px system-ui, sans-serif';
                        ctx.fillText(voucherData.title || 'লেনদেন রশিদ ভাউচার', canvas.width / 2, 136);

                        // Amount Box
                        ctx.fillStyle = '#f0fdf4';
                        ctx.fillRect(40, 175, canvas.width - 80, 95);
                        ctx.strokeStyle = '#bbf7d0';
                        ctx.strokeRect(40, 175, canvas.width - 80, 95);

                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#15803d';
                        ctx.font = 'bold 12px system-ui, sans-serif';
                        ctx.fillText('লেনদেনকৃত টাকার পরিমাণ', canvas.width / 2, 205);

                        ctx.fillStyle = '#166534';
                        ctx.font = 'bold 30px system-ui, sans-serif';
                        ctx.fillText(`৳ ${Number(voucherData.amount).toLocaleString('bn-BD')} BDT`, canvas.width / 2, 245);

                        // Draw Information Table
                        const startX = 40;
                        const endX = canvas.width - 40;
                        let currentY = 320;
                        const rowHeight = 38;

                        const drawRow = (label: string, value: string) => {
                          // Draw bottom line
                          ctx.strokeStyle = '#f1f5f9';
                          ctx.lineWidth = 1;
                          ctx.beginPath();
                          ctx.moveTo(startX, currentY + 10);
                          ctx.lineTo(endX, currentY + 10);
                          ctx.stroke();

                          ctx.textAlign = 'left';
                          ctx.fillStyle = '#64748b';
                          ctx.font = 'bold 13px system-ui, sans-serif';
                          ctx.fillText(label, startX + 10, currentY - 4);

                          ctx.textAlign = 'right';
                          ctx.fillStyle = '#0f172a';
                          ctx.font = 'bold 13px system-ui, sans-serif';
                          ctx.fillText(value, endX - 10, currentY - 4);

                          currentY += rowHeight;
                        };

                        drawRow('বুকিং আইডি', voucherData.bookingId || 'N/A');
                        drawRow('তারিখ ও সময়', voucherData.timestamp || 'N/A');
                        drawRow('ক্রেতা (প্রেরক)', `${voucherData.buyerName} (${voucherData.buyerPhone})`);
                        drawRow('বিক্রেতা (প্রাপক)', `${voucherData.sellerName} (${voucherData.sellerPhone})`);
                        
                        // Handle wrapping of details text
                        ctx.strokeStyle = '#f1f5f9';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(startX, currentY + 10);
                        ctx.lineTo(endX, currentY + 10);
                        ctx.stroke();

                        ctx.textAlign = 'left';
                        ctx.fillStyle = '#64748b';
                        ctx.font = 'bold 13px system-ui, sans-serif';
                        ctx.fillText('লেনদেনের বিবরণ', startX + 10, currentY - 4);

                        ctx.textAlign = 'right';
                        ctx.fillStyle = '#334155';
                        ctx.font = 'bold 12px system-ui, sans-serif';
                        const descVal = `"${voucherData.detail || ''}"`;
                        ctx.fillText(descVal.length > 35 ? descVal.slice(0, 35) + '...' : descVal, endX - 10, currentY - 4);
                        currentY += rowHeight;

                        if (voucherData.courierName && voucherData.courierName !== '-') {
                          drawRow('কুরিয়ার কোম্পানি', voucherData.courierName);
                        }
                        if (voucherData.trackingNumber && voucherData.trackingNumber !== '-') {
                          drawRow('মেমো বা ট্র্যাকিং নং', voucherData.trackingNumber);
                        }

                        // Status row with badge drawing
                        ctx.strokeStyle = '#f1f5f9';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(startX, currentY + 10);
                        ctx.lineTo(endX, currentY + 10);
                        ctx.stroke();

                        ctx.textAlign = 'left';
                        ctx.fillStyle = '#64748b';
                        ctx.font = 'bold 13px system-ui, sans-serif';
                        ctx.fillText('লেনদেনের স্ট্যাটাস', startX + 10, currentY - 4);

                        // Draw status pill
                        const statusBadgeWidth = 100;
                        const statusBadgeHeight = 22;
                        const sbX = endX - statusBadgeWidth - 10;
                        const sbY = currentY - 18;
                        
                        ctx.fillStyle = '#dcfce7';
                        ctx.beginPath();
                        ctx.arc(sbX + 11, sbY + 11, 11, Math.PI/2, 3*Math.PI/2);
                        ctx.lineTo(sbX + statusBadgeWidth - 11, sbY);
                        ctx.arc(sbX + statusBadgeWidth - 11, sbY + 11, 11, 3*Math.PI/2, Math.PI/2);
                        ctx.lineTo(sbX + 11, sbY + statusBadgeHeight);
                        ctx.closePath();
                        ctx.fill();

                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#15803d';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.fillText(voucherData.status || 'সফল', sbX + statusBadgeWidth / 2, sbY + 15);

                        currentY += rowHeight + 20;

                        // Footer divider
                        ctx.strokeStyle = '#e2e8f0';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(40, currentY);
                        ctx.lineTo(canvas.width - 40, currentY);
                        ctx.stroke();

                        // Footer text
                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#94a3b8';
                        ctx.font = 'bold 10px system-ui, sans-serif';
                        ctx.fillText('এটি একটি সিস্টেম জেনারেটেড রসিদ কপি। যেকোনো তথ্যের জন্য সাপোর্ট টিমে যোগাযোগ করুন।', canvas.width / 2, currentY + 30);
                        ctx.fillText('© BUSINESS NETWORK BANGLADESH (AMB)', canvas.width / 2, currentY + 48);

                        // Bottom scallops
                        ctx.fillStyle = '#f1f5f9';
                        for (let i = 0; i < canvas.width; i += 24) {
                          ctx.beginPath();
                          ctx.arc(i + 12, canvas.height, 12, 0, Math.PI, true);
                          ctx.fill();
                        }

                        const dataUrl = canvas.toDataURL('image/png');
                        
                        // Convert to Blob for direct mobile/iOS download support (bypasses sandbox restrictions)
                        const arr = dataUrl.split(',');
                        const mime = arr[0].match(/:(.*?);/)![1];
                        const bstr = atob(arr[1]);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while (n--) {
                          u8arr[n] = bstr.charCodeAt(n);
                        }
                        const blob = new Blob([u8arr], { type: mime });
                        const blobUrl = URL.createObjectURL(blob);

                        const link = document.createElement('a');
                        link.download = `AMB-Escrow-Voucher-${voucherData.bookingId}.png`;
                        link.href = blobUrl;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                      } catch (err) {
                        console.error('Error generating and downloading escrow receipt image:', err);
                        alert("রসিদটি সরাসরি ডাউনলোড করা যায়নি। অনুগ্রহ করে স্ক্রিনের একটি স্ক্রিনশট নিয়ে রাখুন।");
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] font-black shadow-xs transition cursor-pointer active:scale-98"
                  >
                    <Printer className="w-4 h-4" /> রসিদ ডাউনলোড
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const shareText = `📝 *নিরাপদ লেনদেনের ভাউচার কপি* 📝\n🏢 *প্রতিষ্ঠান:* BUSINESS NETWORK BANGLADESH\n📌 *ভাউচার টাইপ:* ${voucherData.title}\n🔢 *বুকিং আইডি:* ${voucherData.bookingId}\n💰 *পরিমাণ:* ৳ ${Number(voucherData.amount).toLocaleString('bn-BD')} BDT\n⏰ *তারিখ ও সময়:* ${voucherData.timestamp}\n👤 *ক্রেতা:* ${voucherData.buyerName} (${voucherData.buyerPhone})\n👥 *বিক্রেতা:* ${voucherData.sellerName} (${voucherData.sellerPhone})\n📦 *বিবরণ:* "${voucherData.detail}"\n${voucherData.courierName && voucherData.courierName !== '-' ? `🚚 *কুরিয়ার:* ${voucherData.courierName}\n` : ''}${voucherData.trackingNumber && voucherData.trackingNumber !== '-' ? `🎫 *ট্র্যাকিং নং:* ${voucherData.trackingNumber}\n` : ''}✅ *স্ট্যাটাস:* ${voucherData.status}\n\n-------------------------------------\n*ধন্যবাদ, বিজনেস নেটওয়ার্ক বাংলাদেশ এর সাথে লেনদেন করার জন্য!*`;
                      
                      navigator.clipboard.writeText(shareText).then(() => {
                        setCopiedVoucher(true);
                        setTimeout(() => setCopiedVoucher(false), 3000);
                      }).catch(err => {
                        alert("কপি করা যায়নিঃ " + err);
                      });
                    }}
                    className="flex items-center justify-center gap-1.5 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-[11px] font-black shadow-xs transition cursor-pointer active:scale-98"
                  >
                    <Share2 className="w-4 h-4" /> ফরোয়ার্ড করুন
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setVoucherData(null)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black transition duration-200 cursor-pointer text-center"
                >
                  বন্ধ করুন
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Centered Error Popup Overlay */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs font-sans"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-rose-100"
            >
              <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                <AlertCircle className="w-9 h-9 stroke-[2.5]" />
              </div>
              <h3 className="text-base font-black text-rose-700 mb-2">লেনদেন ব্যর্থ হয়েছে</h3>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl mb-5 text-left">
                <p className="text-xs font-bold text-slate-700 leading-relaxed text-center">
                  {errorMsg}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg('')}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black shadow-xs transition duration-200 cursor-pointer active:scale-98"
              >
                আবার চেষ্টা করুন
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Professional Brand Confirmation Modal Overlay */}
      <AnimatePresence>
        {confirmModalData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs font-sans"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 25 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 25 }}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden"
            >
              {/* Header section with brand info */}
              <div className="bg-gradient-to-r from-slate-800 to-indigo-900 text-white p-5 text-center relative">
                <button 
                  type="button" 
                  onClick={() => setConfirmModalData(null)}
                  className="absolute right-4 top-4 p-1.5 hover:bg-white/10 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5 text-white/80" />
                </button>
                <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-amber-500/20">
                  <AlertTriangle className="w-6 h-6 text-amber-400 stroke-[2]" />
                </div>
                <h2 className="text-[11px] font-extrabold tracking-widest text-slate-300 uppercase">BUSINESS NETWORK BANGLADESH</h2>
                <p className="text-[9px] text-white/65 mt-0.5 font-medium">নিরাপদ বাতায়ন ও সমবায় ব্যাংকিং এসক্রো সিস্টেম</p>
                <div className="mt-2.5 inline-block bg-slate-700/60 text-slate-100 text-[11px] font-black px-3.5 py-1 rounded-full border border-slate-600/50">
                  {confirmModalData.title}
                </div>
              </div>

              {/* Main content area */}
              <div className="p-5 space-y-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">ডিলের বুকিংকৃত পরিমাণ</span>
                  <div className="text-2xl font-black text-slate-850 mt-1">
                    ৳ {confirmModalData.amount.toLocaleString('bn-BD')} <span className="text-sm font-bold">BDT</span>
                  </div>
                  {confirmModalData.bookingId && (
                    <div className="mt-1.5 inline-block text-[10px] font-mono font-bold bg-slate-200/50 text-slate-600 px-2.5 py-0.5 rounded-md">
                      বুকিং আইডিঃ {confirmModalData.bookingId.toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl space-y-2">
                  <h4 className="text-xs font-black text-amber-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" /> গুরুত্বপূর্ণ সতর্কতাঃ
                  </h4>
                  <p className="text-xs font-bold text-slate-600 leading-relaxed text-center">
                    {confirmModalData.description}
                  </p>
                </div>

                {/* Confirm & Cancel Buttons */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmModalData(null)}
                    className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black transition duration-200 cursor-pointer text-center"
                  >
                    ফিরে যান
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={confirmModalData.onConfirm}
                    className={`py-3 text-white rounded-2xl text-xs font-black shadow-xs transition duration-200 cursor-pointer text-center active:scale-98 ${
                      confirmModalData.type === 'cancel'
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200/50'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200/50'
                    }`}
                  >
                    {submitting ? 'প্রক্রিয়াধীন...' : confirmModalData.actionLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== DISPUTE / COMPLAINT SUBMISSION MODAL ==================== */}
      <AnimatePresence>
        {showDisputeModal && disputeOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl relative overflow-hidden text-left space-y-4"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-5 h-5 text-amber-500 animate-bounce" /> বিবাদ বা অভিযোগ সাবমিট করুন
                </h3>
                <button 
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Order Info Summary */}
              <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-2xl space-y-1">
                <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">অভিযোগের বুকিং তথ্যঃ</span>
                <p className="text-xs font-bold text-slate-800">{disputeOrder.dealTitle}</p>
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>বুকিং আইডিঃ #{disputeOrder.id.substring(0, 8).toUpperCase()}</span>
                  <span className="font-sans font-bold">পরিমাণঃ ৳{disputeOrder.totalAmount?.toLocaleString('bn-BD')}</span>
                </div>
              </div>

              <form onSubmit={handleSubmitDispute} className="space-y-4">
                {/* Contact Phone */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">যোগাযোগের মোবাইল নাম্বার (WhatsApp সচল থাকতে হবে) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="01xxxxxxxxx"
                    value={disputeContactPhone}
                    onChange={(e) => setDisputeContactPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs font-semibold focus:border-amber-500 focus:bg-white transition"
                  />
                </div>

                {/* Dispute Reason/Description */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">অভিযোগের বিবরণ (বিস্তারিত লিখুন) *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="পণ্য বা কুরিয়ার সংক্রান্ত বিস্তারিত সমস্যা এখানে লিখুন যেন এডমিন দ্রুত সমাধান করতে পারেন..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:border-amber-500 focus:bg-white transition animate-none"
                  />
                  <span className="text-[9.5px] text-slate-450 leading-relaxed block font-semibold">
                    * আপনার কুরিয়ার ডকিং ডাটা ও মেম্বার ট্র্যাকিং ইনফো স্বয়ংক্রিয়ভাবে প্রশাসনের কাছে রিপোর্টের সাথে যুক্ত হয়ে যাবে।
                  </span>
                </div>

                {/* Form Buttons */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDisputeModal(false)}
                    className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer text-center"
                  >
                    বাতিল করুন
                  </button>

                  <button
                    type="submit"
                    disabled={submittingDispute}
                    className="py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer text-center flex items-center justify-center gap-1"
                  >
                    {submittingDispute ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        সাবমিট হচ্ছে...
                      </>
                    ) : (
                      <>✓ অভিযোগ জমা দিন</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== SUPPORT TICKETS & COMPLAINT TRACKER MODAL ==================== */}
      <AnimatePresence>
        {showSupportHistoryModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 w-full max-w-lg border border-slate-200 shadow-2xl relative overflow-hidden text-left space-y-4 max-h-[90vh] overflow-y-auto"
            >
              {/* Top Accent line */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-600" />

              {/* Close Button & Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mt-1">
                <div>
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" /> অ্যাডমিন সাপোর্ট ও ট্র্যাকিং সেন্টার
                  </h3>
                  <p className="text-[10px] text-slate-450 font-bold">Al Mayadin Bazar (AMB)</p>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setShowSupportHistoryModal(false);
                    setSearchTicketNo('');
                    setSearchTicketResult(null);
                    setSearchTicketError('');
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* WhatsApp Quick Support Section */}
              <div className="bg-emerald-50 border border-emerald-100/70 p-4 rounded-2xl flex flex-col xs:flex-row xs:items-center justify-between gap-3 shadow-3xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">সরাসরি হোয়াটসঅ্যাপে যোগাযোগঃ</span>
                  <p className="text-xs font-black text-slate-800">এডমিন সাপোর্ট সেন্টারের সাথে সরাসরি কথা বলুন</p>
                  <p className="text-[11px] text-emerald-700 font-mono font-bold">WhatsApp: 01865911728</p>
                </div>
                <a
                  href="https://wa.me/8801865911728"
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-4 bg-[#25D366] hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl transition shadow-3xs flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Phone className="w-3.5 h-3.5 text-white" />
                  হোয়াটসঅ্যাপ সাপোর্ট
                </a>
              </div>

              {/* Live Status Tracker Search Input */}
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-700">অভিযোগের রসিদ নম্বর (Ticket ID) দিয়ে স্ট্যাটাস চেক করুনঃ</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="যেমন: SUP-123456"
                      value={searchTicketNo}
                      onChange={(e) => setSearchTicketNo(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-900 font-mono uppercase tracking-wider rounded-xl text-xs placeholder:font-sans placeholder:tracking-normal focus:border-blue-500 transition font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleSearchTicket}
                      disabled={searchingTicket}
                      className="px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 shadow-3xs cursor-pointer"
                    >
                      {searchingTicket ? 'খোঁজা হচ্ছে...' : 'সার্চ'}
                    </button>
                  </div>
                </div>

                {/* Ticket Search Result Display */}
                {searchTicketError && (
                  <p className="text-[11px] text-rose-600 font-semibold">{searchTicketError}</p>
                )}

                {searchTicketResult && (
                  <div className="bg-white border border-blue-100 p-3.5 rounded-xl space-y-2 text-xs shadow-3xs">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="font-mono font-bold text-blue-700">আইডিঃ {searchTicketResult.ticketId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                        searchTicketResult.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        searchTicketResult.status === 'Processing' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                      }`}>
                        {searchTicketResult.status === 'Resolved' ? 'সমাধান হয়েছে' :
                         searchTicketResult.status === 'Processing' ? 'তদন্তাধীন/প্রসেসিং' : 'পেন্ডিং (অপেক্ষমাণ)'}
                      </span>
                    </div>
                    <div className="space-y-1 text-slate-600">
                      <p className="font-semibold text-slate-800">অভিযোগকারীঃ <strong className="font-extrabold">{searchTicketResult.userName}</strong></p>
                      <p className="font-semibold">ডিল শিরোনামঃ <span className="text-slate-800 font-bold">{searchTicketResult.orderTitle}</span></p>
                      <p className="font-semibold font-mono text-[11px]">পরিমাণঃ ৳{searchTicketResult.amount?.toLocaleString('bn-BD')}</p>
                      <p className="font-semibold font-mono text-[11px]">অভিযোগের সিরিয়াল নংঃ {englishToBengaliNumber(searchTicketResult.serialNo)}</p>
                      <p className="font-semibold bg-slate-50 border p-2 rounded-lg mt-1 text-slate-700 italic">" {searchTicketResult.description} "</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Your Ticket History List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" /> আপনার করা বিগত অভিযোগের তালিকা ({englishToBengaliNumber(supportTickets.length)} টি)
                </h4>

                {supportTickets.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-150 rounded-2xl text-slate-400 text-xs font-bold">
                    আপনার কোনো পূর্ববর্তী অভিযোগের রেকর্ড পাওয়া যায়নি।
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {supportTickets.map((ticket, idx) => (
                      <div key={ticket.id || idx} className="p-3 bg-slate-50 hover:bg-slate-100/80 border rounded-xl flex items-center justify-between gap-3 transition">
                        <div className="space-y-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-700 text-xs">{ticket.ticketId}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{new Date(ticket.createdAt).toLocaleDateString('bn-BD')}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-bold truncate max-w-[200px]">{ticket.orderTitle || 'সাধারণ অভিযোগ'}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span>সিরিয়াল নংঃ {englishToBengaliNumber(ticket.serialNo)}</span>
                            {ticket.status === 'Pending' && (
                              <span className="text-amber-600 font-bold">• প্রসেসিং লাইনে আছে</span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border block text-center ${
                            ticket.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            ticket.status === 'Processing' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {ticket.status === 'Resolved' ? 'সম্পন্ন' :
                             ticket.status === 'Processing' ? 'প্রসেসিং' : 'পেন্ডিং'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setShowSupportHistoryModal(false);
                  setSearchTicketNo('');
                  setSearchTicketResult(null);
                  setSearchTicketError('');
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-2xl transition"
              >
                বন্ধ করুন
              </button>
            </motion.div>
          </div>
        )}

        {/* ================= LOCALIZED ESCROW TRANSACTION HISTORY MODAL ================= */}
        {showSectionTxHistory && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden text-slate-800 font-sans"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-750 via-indigo-800 to-indigo-900 text-white px-5 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-200" />
                  <div>
                    <h3 className="text-sm font-black text-white">নিরাপদ লেনদেন এসক্রো খতিয়ান</h3>
                    <p className="text-[10px] text-indigo-200 font-medium">নিরাপদ ডিল, ফান্ড হোল্ড ও রিলিজ সংক্রান্ত ইতিহাস</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowSectionTxHistory(false);
                    setTxModalSearch('');
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition text-white/90 active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input 
                    type="text"
                    value={txModalSearch}
                    onChange={(e) => setTxModalSearch(e.target.value)}
                    placeholder="অ্যামাউন্ট, আইডি বা বিবরণ দিয়ে খুঁজুন..."
                    className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-2xl text-xs font-medium focus:outline-none focus:border-indigo-650 focus:ring-1 focus:ring-indigo-650"
                  />
                  {txModalSearch && (
                    <button 
                      onClick={() => setTxModalSearch('')}
                      className="text-[10px] font-black text-slate-400 hover:text-slate-600 absolute right-3.5 top-2.5"
                    >
                      মুছুন
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingTx ? (
                  <div className="text-center py-10 text-slate-400 text-xs font-bold">
                    খতিয়ান লোড হচ্ছে...
                  </div>
                ) : (() => {
                  const filteredTxs = txHistory.filter(tx => {
                    const isEscrowTx = tx.typeLabel?.includes('নিরাপদ') || tx.typeLabel?.includes('এসক্রো') ||
                      tx.description?.includes('নিরাপদ') || tx.description?.includes('এসক্রো') ||
                      tx.description?.includes('ডিল ফান্ড') || tx.paymentMethod?.includes('Escrow');

                    if (!isEscrowTx) return false;

                    if (!txModalSearch.trim()) return true;
                    const searchLower = txModalSearch.toLowerCase();
                    return (
                      tx.description?.toLowerCase().includes(searchLower) ||
                      tx.typeLabel?.toLowerCase().includes(searchLower) ||
                      tx.amount.toString().includes(searchLower) ||
                      tx.id.toLowerCase().includes(searchLower) ||
                      tx.receiptNo?.toLowerCase().includes(searchLower)
                    );
                  });

                  if (filteredTxs.length === 0) {
                    return (
                      <div className="text-center py-10 text-slate-400 text-xs font-bold">
                        কোনো নিরাপদ লেনদেন রেকর্ড পাওয়া যায়নি।
                      </div>
                    );
                  }

                  return filteredTxs.map((tx, idx) => {
                    const isCredit = tx.typeLabel?.includes('প্রাপ্তি') || tx.description?.includes('প্রাপ্তি') || tx.description?.includes('রিলিজ করেছেন');
                    return (
                      <div key={`${tx.id}-${idx}`} className="p-3 bg-white border border-slate-150 rounded-2xl shadow-3xs flex justify-between items-start gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-black text-slate-850 block">{tx.typeLabel || 'নিরাপদ লেনদেন'}</span>
                          <span className="text-[10px] text-slate-400 block font-medium">
                            {new Date(tx.createdAt).toLocaleDateString('bn-BD')} {new Date(tx.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <p className="text-[10.5px] text-slate-650 font-bold leading-normal">{tx.description}</p>
                          {tx.id && (
                            <span className="inline-block text-[9px] bg-slate-100 text-slate-500 font-mono px-2 py-0.5 rounded-md">
                              TXN ID: {tx.id.replace('tx-esc-', '').toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-black font-mono block ${isCredit ? 'text-emerald-600' : 'text-indigo-600'}`}>
                            {isCredit ? '+' : '-'} ৳{tx.amount.toLocaleString('bn-BD')}
                          </span>
                          <span className="inline-block text-[8.5px] font-extrabold px-1.5 py-0.2 mt-1 rounded-md uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                            সফল
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 font-bold">© BUSINESS NETWORK BANGLADESH (AMB)</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
