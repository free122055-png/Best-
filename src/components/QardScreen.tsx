import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Transaction, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { DEFAULT_QARD_CONFIG } from '../lib/config';
import { hasCompletedSamityProfile, getMissingProfileFields } from '../lib/memberUtils';
import AmbPaymentReceiptModal from './AmbPaymentReceiptModal';
import UnifiedBackButton from './UnifiedBackButton';
import { useBackHandler } from '../lib/navigationManager';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  doc,
  updateDoc,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Heart, 
  Calendar, 
  Award, 
  ShieldCheck, 
  FileText, 
  Users, 
  Sparkles, 
  HelpCircle, 
  CheckCircle, 
  AlertCircle, 
  Mail, 
  Download, 
  DollarSign, 
  Eye,
  EyeOff, 
  Lock, 
  Bell, 
  BookOpen, 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  HeartHandshake,
  CreditCard,
  PlusCircle,
  Clock,
  BadgeAlert,
  Zap,
  Search,
  Filter,
  Check,
  Volume2,
  Copy,
  ClipboardList,
  X,
  Gem,
  Landmark,
  Calculator,
  Plus,
  CheckCircle2,
  RefreshCw,
  Crown
} from 'lucide-react';

interface QardScreenProps {
  user: User;
  onBack: () => void;
  syncLiveProfile: () => Promise<void>;
  appConfig?: AppConfig;
}

export default function QardScreen({ user, onBack, syncLiveProfile, appConfig }: QardScreenProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'landing' | 'donate' | 'dashboard' | 'transparency' | 'apply' | 'admin' | 'withdraw' | 'gold_loan'>('landing');

  // States for Gold Loan / স্বর্ণ রেখে জরুরি টাকা
  const [goldLoansList, setGoldLoansList] = useState<any[]>([]);
  const [goldJewelryType, setGoldJewelryType] = useState('স্বর্ণের চেইন ও গহনা');
  const [goldCarat, setGoldCarat] = useState<'22k' | '21k' | '18k' | '24k'>('22k');
  const [goldWeightVori, setGoldWeightVori] = useState('');
  const [goldWeightGrams, setGoldWeightGrams] = useState('');
  const [goldMarketValue, setGoldMarketValue] = useState('');
  const [goldAltPhone, setGoldAltPhone] = useState('');
  const [goldAddress, setGoldAddress] = useState('');
  const [goldNotes, setGoldNotes] = useState('');
  const [goldAgreed, setGoldAgreed] = useState(false);
  const [goldSubmitting, setGoldSubmitting] = useState(false);
  const [goldSuccessMsg, setGoldSuccessMsg] = useState('');
  const [goldErrorMsg, setGoldErrorMsg] = useState('');
  const [calcMarketValue, setCalcMarketValue] = useState<string>('200000');

  // Internal Qard Back Handler
  useBackHandler(() => {
    if (showDonorsModal) { setShowDonorsModal(false); return true; }
    if (showBorrowersModal) { setShowBorrowersModal(false); return true; }
    if (showReceiptModal) { setShowReceiptModal(false); return true; }
    if (showCertificate) { setShowCertificate(false); return true; }
    if (showRepayModal) { setShowRepayModal(false); return true; }
    if (showSectionTxHistory) { setShowSectionTxHistory(false); return true; }
    if (activeTab !== 'landing') {
      setActiveTab('landing');
      return true;
    }
    return false;
  }, true, 25);
  const [showDonorsModal, setShowDonorsModal] = useState(false);
  const [showBorrowersModal, setShowBorrowersModal] = useState(false);
  const [donorsSearchQuery, setDonorsSearchQuery] = useState('');
  const [borrowersSearchQuery, setBorrowersSearchQuery] = useState('');
  const [currentAdSlide, setCurrentAdSlide] = useState(0);

  // Form states - Qard Withdrawal Apply
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawWhatsapp, setWithdrawWhatsapp] = useState<string>('');
  const [withdrawPin, setWithdrawPin] = useState<string>('');

  const defaultAdSlides = [
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
      title: "BNB টেলিকম রিচার্জ",
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

  const adSlides = appConfig?.qardBanners && appConfig.qardBanners.length > 0 
    ? appConfig.qardBanners 
    : defaultAdSlides;

  useEffect(() => {
    if (adSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentAdSlide((prev) => (prev + 1) % adSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [adSlides.length]);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    receiptNo: string;
    transactionId: string;
    userName: string;
    memberId: string;
    typeLabel: string;
    amount: number;
    description: string;
    createdAt: string;
    paymentMethod: string;
  } | null>(null);

  const handleCopyReceiptText = () => {
    if (!receiptData) return;
    const formattedDate = receiptData.createdAt 
      ? new Date(receiptData.createdAt).toLocaleString('bn-BD', { hour12: true }) 
      : new Date().toLocaleString('bn-BD', { hour12: true });

    const text = `====================================
BUSINESS NETWORK BANGLADESH (AMB)
AMB Business Co-operative Welfare Fund
====================================
অফিসিয়াল রসিদ (Official Receipt)
------------------------------------
রসিদ নম্বর (Receipt No): ${receiptData.receiptNo || 'N/A'}
ট্রানজেকশন আইডি (Txn ID): ${receiptData.transactionId || 'N/A'}
গ্রাহকের নাম (Name): ${receiptData.userName || 'N/A'}
মেম্বার আইডি (Member ID): ${receiptData.memberId || 'N/A'}
অনুদানের ধরন (Type): ${receiptData.typeLabel || 'করযে হাসানা দান'}
অনুদানের খাত (Purpose): ${receiptData.description || 'কল্যাণ তহবিল'}
তারিখ ও সময় (Date & Time): ${formattedDate}
পেমেন্ট মাধ্যম (Method): ${receiptData.paymentMethod || 'WALLET'}
পরিমাণ (Amount): ৳ ${receiptData.amount}
------------------------------------
উম্মাহর সেবায় আপনার অবদান কবুল হোক! ইনশাআল্লাহ।
====================================`;
    
    navigator.clipboard.writeText(text);
    alert('রসিদের বিবরণ সফলভাবে কপি করা হয়েছে!');
  };

  const handleDownloadReceiptImage = () => {
    if (!receiptData) return;
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 650;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 500, 650);

    // Border & Accent Header
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 492, 642);

    // Top decorative bar
    ctx.fillStyle = '#059669'; // Emerald-600
    ctx.fillRect(8, 8, 484, 12);

    // Brand Header
    ctx.fillStyle = '#1e293b'; // Slate-800
    ctx.font = 'bold 20px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSINESS NETWORK BANGLADESH', 250, 60);

    ctx.fillStyle = '#64748b'; // Slate-500
    ctx.font = '500 13px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('AMB Business Co-operative Welfare Fund', 250, 85);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 105);
    ctx.lineTo(460, 105);
    ctx.stroke();

    // Receipt Label
    ctx.fillStyle = '#059669'; // Emerald-600
    ctx.font = 'bold 15px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('অফিসিয়াল রসিদ (Official Receipt)', 250, 135);

    // Fields starting Y
    let y = 185;
    const drawRow = (label: string, value: string) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569'; // Slate-600
      ctx.font = 'bold 12px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(label, 50, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a'; // Slate-900
      ctx.font = '500 12px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(value, 450, y);

      // subtle dashed line
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, y + 10);
      ctx.lineTo(450, y + 10);
      ctx.stroke();

      y += 35;
    };

    const formattedDate = receiptData.createdAt 
      ? new Date(receiptData.createdAt).toLocaleString('bn-BD', { hour12: true }) 
      : new Date().toLocaleString('bn-BD', { hour12: true });

    drawRow('রসিদ নম্বর (Receipt No):', receiptData.receiptNo || 'REC-N/A');
    drawRow('ট্রানজেকশন আইডি (Txn ID):', receiptData.transactionId || 'QRD-N/A');
    drawRow('গ্রাহকের নাম (Name):', receiptData.userName || 'N/A');
    drawRow('মেম্বার আইডি (Member ID):', receiptData.memberId || 'N/A');
    drawRow('অনুদানের ধরন (Type):', receiptData.typeLabel || 'করযে হাসানা দান');
    drawRow('অনুদানের খাত (Purpose):', receiptData.description || 'কল্যাণ তহবিল');
    drawRow('তারিখ ও সময় (Date & Time):', formattedDate);
    drawRow('পেমেন্ট মাধ্যম (Method):', receiptData.paymentMethod || 'WALLET');

    // Amount Highlight
    y += 10;
    ctx.fillStyle = '#f0fdf4'; // Light green card
    ctx.fillRect(40, y, 420, 55);
    ctx.strokeStyle = '#bbf7d0';
    ctx.strokeRect(40, y, 420, 55);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#166534'; // Dark green text
    ctx.font = 'bold 14px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('পরিমাণ (Amount):', 60, y + 33);

    ctx.textAlign = 'right';
    ctx.font = 'bold 18px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(`৳ ${receiptData.amount}`, 440, y + 35);

    // Footer Message
    ctx.textAlign = 'center';
    ctx.fillStyle = '#059669';
    ctx.font = 'bold italic 11px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('উম্মাহর সেবায় আপনার অবদান কবুল হোক! ইনশাআল্লাহ।', 250, 595);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('সফটওয়্যার দ্বারা স্বয়ংক্রিয়ভাবে জেনারেটকৃত রসিদ, কোনো স্বাক্ষরের প্রয়োজন নেই।', 250, 615);

    // Trigger Download
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Receipt-${receiptData.receiptNo || 'Qard'}.png`;
    link.href = dataURL;
    link.click();
  };

  // Qard calculations & database sync
  const [usersMap, setUsersMap] = useState<Record<string, { photoURL?: string; photo?: string; name?: string }>>({});
  const [qardHistory, setQardHistory] = useState<Transaction[]>([]);
  const [showSectionTxHistory, setShowSectionTxHistory] = useState(false);
  const [txModalSearch, setTxModalSearch] = useState('');
  const [qardTotalFund, setQardTotalFund] = useState(0);
  const [qardActiveLoansAmount, setQardActiveLoansAmount] = useState(0);
  const [beneficiaryCount, setBeneficiaryCount] = useState(1);
  const [uniqueDonors, setUniqueDonors] = useState<string[]>([]);
  const [allDonationsCount, setAllDonationsCount] = useState(0);

  const qardAvailableFund = Math.max(0, qardTotalFund - qardActiveLoansAmount);

  // Form states - Donation
  const [donationType, setDonationType] = useState<'one_time' | 'monthly'>('one_time');
  const [donationPurpose, setDonationPurpose] = useState<string>('');
  const [isPurposeMenuOpen, setIsPurposeMenuOpen] = useState<boolean>(false);
  const [donationAmount, setDonationAmount] = useState<string>('');
  const [paymentGateway, setPaymentGateway] = useState<'bkash' | 'nagad' | 'rocket' | 'bank' | 'card'>('bkash');
  const [senderAccount, setSenderAccount] = useState<string>('');
  const [txnId, setTxnId] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [securityPin, setSecurityPin] = useState<string>('');

  // Cards state
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardHolder, setCardHolder] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');

  // Form states - Qard Loan Apply
  const [loanAmount, setLoanAmount] = useState<string>('');
  const [loanPurpose, setLoanPurpose] = useState<string>('');
  const [loanPin, setLoanPin] = useState<string>('');
  const [loanWhatsapp, setLoanWhatsapp] = useState<string>('');
  const [loanDuration, setLoanDuration] = useState<number>(1);
  const [loanMonthlyRepay, setLoanMonthlyRepay] = useState<string>('');
  const [customRepayInput, setCustomRepayInput] = useState<string>('');

  // Qard Auto-Debit Simulation States
  const [qardSimulatedDay, setQardSimulatedDay] = useState<number>(1);
  const [simulatingAutoDebit, setSimulatingAutoDebit] = useState<boolean>(false);
  const [simulationSuccess, setSimulationSuccess] = useState<string>('');
  const [simulationError, setSimulationError] = useState<string>('');

  // Eligibility check states
  const [activeDays, setActiveDays] = useState<number>(0);
  const [ambTxVolume, setAmbTxVolume] = useState<number>(0);
  const [eligibilityLoaded, setEligibilityLoaded] = useState<boolean>(false);

  // Coop 50% Instant Auto-Loan States
  const [instantLoanAmtInput, setInstantLoanAmtInput] = useState<string>('');
  const [instantLoanDurationInput, setInstantLoanDurationInput] = useState<number>(3);
  const [instantLoanPinInput, setInstantLoanPinInput] = useState<string>('');
  const [instantLoanLoading, setInstantLoanLoading] = useState<boolean>(false);

  // Receipts & Certificates Modals
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<Transaction | null>(null);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);
  const [showRepayModal, setShowRepayModal] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>(user.phone + '@amb-network.org');
  const [emailSending, setEmailSending] = useState<boolean>(false);

  const showReceiptForTx = (tx: Transaction) => {
    setReceiptData({
      receiptNo: tx.receiptNo || `REC-${Math.floor(100000 + Math.random() * 900000)}`,
      transactionId: tx.transactionId || tx.id || `TXN-${Date.now().toString().slice(-6)}`,
      userName: tx.userName || user.name,
      memberId: tx.memberId || user.memberId || '',
      typeLabel: tx.typeLabel || (
        tx.type === 'qard_donation' ? 'করযে হাসানা দান' :
        tx.type === 'qard_loan_repayment' ? 'করযে হাসানা পরিশোধ' :
        tx.type === 'qard_loan_request' ? 'করযে হাসানা আবেদন' :
        tx.type === 'qard_loan_disbursment' ? 'করযে হাসানা ঋণ বিতরণ' : 'লেনদেন'
      ),
      amount: tx.amount,
      description: tx.description || '',
      createdAt: tx.createdAt || new Date().toISOString(),
      paymentMethod: tx.paymentMethod || 'WALLET'
    });
    setShowReceiptModal(true);
  };

  // Step-by-step donation form wizard state (bKash style)
  const [donateStep, setDonateStep] = useState<number>(1);

  const validateStep = (step: number): boolean => {
    setErrorMsg('');
    setSuccessMsg('');
    if (step === 1) {
      if (!donationType) {
        setErrorMsg('অনুগ্রহ করে অনুদানের ফ্রিকোয়েন্সি নির্বাচন করুন।');
        return false;
      }
    }
    if (step === 2) {
      if (!donationPurpose) {
        setErrorMsg('অনুগ্রহ করে দানের উদ্দেশ্য নির্বাচন করুন।');
        return false;
      }
    }
    if (step === 3) {
      const amt = parseFloat(donationAmount);
      if (isNaN(amt) || amt <= 0) {
        setErrorMsg('অনুগ্রহ করে সঠিক অনুদানের পরিমাণ (0 এর বেশি) প্রবেশ করান।');
        return false;
      }
    }
    if (step === 4) {
      if (!paymentGateway) {
        setErrorMsg('অনুগ্রহ করে পেমেন্ট গেটওয়ে নির্বাচন করুন।');
        return false;
      }
    }
    if (step === 5) {
      if (['bkash', 'nagad', 'rocket'].includes(paymentGateway)) {
        if (!senderAccount || senderAccount.length < 10) {
          setErrorMsg('অনুগ্রহ করে কমপক্ষে 10 সংখ্যার সঠিক প্রেরক নম্বর লিখুন।');
          return false;
        }
        if (!txnId || txnId.trim().length < 4) {
          setErrorMsg('অনুগ্রহ করে একটি সঠিক পেমেন্ট ট্রানজেকশন ID লিখুন।');
          return false;
        }
      } else if (paymentGateway === 'bank') {
        if (!senderAccount || senderAccount.trim().length < 3) {
          setErrorMsg('অনুগ্রহ করে ব্যাংক ক্যাশ-ইন প্রেরক রেফারেন্স বা নাম লিখুন।');
          return false;
        }
      } else if (paymentGateway === 'card') {
        if (!cardNumber || cardNumber.trim().length < 15) {
          setErrorMsg('অনুগ্রহ করে সঠিক কার্ড নম্বর লিখুন।');
          return false;
        }
        if (!cardHolder || cardHolder.trim().length < 3) {
          setErrorMsg('অনুগ্রহ করে কার্ডের ওপর থাকা সম্পূর্ণ নাম লিখুন।');
          return false;
        }
        if (!cardCvv || cardCvv.trim().length < 3) {
          setErrorMsg('অনুগ্রহ করে সঠিক কার্ড CVV (3 সংখ্যা) প্রবেশ করান।');
          return false;
        }
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(donateStep)) {
      setDonateStep((prev) => Math.min(prev + 1, 6));
    }
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    setDonateStep((prev) => Math.max(prev - 1, 1));
  };

  // Copy text state
  const [copiedGate, setCopiedGate] = useState<string | null>(null);
  const handleCopyText = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedGate(fieldId);
    setTimeout(() => setCopiedGate(null), 2000);
  };

  // Admin filter states
  const [adminSearch, setAdminSearch] = useState<string>('');
  const [adminTab, setAdminTab] = useState<'pending' | 'all' | 'donors' | 'allocation'>('pending');

  // Load ledger history
  const fetchLedgers = async () => {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('type', 'in', ['qard_donation', 'qard_loan_request', 'qard_loan_disbursment', 'qard_loan_repayment', 'qard_withdrawal'])
      );
      const snap = await getDocs(q);
      const allList: Transaction[] = [];
      snap.forEach((d) => {
        const item = d.data() as any;
        allList.push({
          ...item,
          id: item.id || d.id,
          docId: d.id
        } as Transaction);
      });
      // Sort desc
      allList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Keep qardHistory populated with all public records
      setQardHistory(allList);

      const starterAmount = 0;
      const totalDonations = allList
        .filter(t => t.type === 'qard_donation' && t.status === 'success')
        .reduce((sum, t) => sum + t.amount, 0);
      setQardTotalFund(starterAmount + totalDonations);

      const totalDisbursed = allList
        .filter(t => t.type === 'qard_loan_disbursment' && t.status === 'success')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalRepaid = allList
        .filter(t => t.type === 'qard_loan_repayment' && t.status === 'success')
        .reduce((sum, t) => sum + t.amount, 0);

      setQardActiveLoansAmount(Math.max(0, totalDisbursed - totalRepaid));

      // Calculate beneficiaries
      const uniqueBorrowers = new Set(
        allList.filter(t => t.type === 'qard_loan_disbursment' && t.status === 'success').map((t) => t.userId)
      );
      setBeneficiaryCount(Math.max(1, uniqueBorrowers.size));

      // Calculate unique donors
      const donors = new Set(
        allList.filter(t => t.type === 'qard_donation' && t.status === 'success').map((t) => t.userId)
      );
      setUniqueDonors(Array.from(donors));
      setAllDonationsCount(allList.filter(t => t.type === 'qard_donation' && t.status === 'success').length);

    } catch (err) {
      console.error("Qard ledger fetch error:", err);
    }
  };

  const fetchEligibility = async () => {
    try {
      if (!user || !user.uid) return;
      let createdDate = new Date();
      if (user.createdAt) {
        if (typeof (user.createdAt as any)?.toDate === 'function') {
          createdDate = (user.createdAt as any).toDate();
        } else {
          const parsed = new Date(user.createdAt);
          if (!isNaN(parsed.getTime())) createdDate = parsed;
        }
      }
      const now = new Date();
      const diffMs = Math.max(0, now.getTime() - createdDate.getTime());
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      setActiveDays(isNaN(days) ? 0 : days);

      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      let vol = 0;
      snap.forEach((d) => {
        const tx = d.data();
        if (tx.status === 'success' && (tx.type === 'balance_transfer' || tx.type === 'received_transfer')) {
          vol += tx.amount || 0;
        }
      });
      setAmbTxVolume(vol);
      setEligibilityLoaded(true);
    } catch (err) {
      console.error("Eligibility fetch error:", err);
    }
  };

  // Auto-Engine for Qard Hasana:
  // 1. 2-Day Reminder Notification before due date (for 1-Month or 3-Month installments)
  // 2. Automated Daily Late Fine (10 BDT per 1,000 BDT per day after 30 days / overdue date) with auto-deduction from wallet balance
  useEffect(() => {
    if (!user || !user.uid) return;
    const dueLoan = user.dueLoan || 0;
    if (dueLoan <= 0) return;

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowIso = now.toISOString();

    const duration = user.instantLoanDurationMonths || user.loanDuration || 1;
    const takenTimeStr = user.instantLoanTakenAt || user.lastCoopInstantLoanAt || user.loanTakenAt;
    const takenTime = takenTimeStr ? new Date(takenTimeStr).getTime() : now.getTime();
    const daysElapsed = Math.floor((now.getTime() - takenTime) / (1000 * 60 * 60 * 24));

    // A. 1-MONTH (30 DAYS / NEXT MONTH SAME DATE) LOAN SYSTEM
    if (duration === 1) {
      // 1. 2-Day Warning Notification (Days 28 to 30)
      if (daysElapsed >= 28 && daysElapsed <= 30) {
        const reminderCycleKey = `remind_1m_${takenTimeStr || 'init'}`;
        if (user.lastQardDueReminderCycle !== reminderCycleKey) {
          const daysLeft = Math.max(0, 30 - daysElapsed);
          addDoc(collection(db, 'user_notifications'), {
            userId: user.uid,
            title: '⚠️ করযে হাসানা ঋণ পরিশোধের সতর্কতা (২ দিন বাকি)',
            message: `আপনার ৳${dueLoan.toLocaleString('bn-BD')} করযে হাসানা ঋণের ৩০ দিন মেয়াদের আর মাত্র ${daysLeft === 0 ? 'আজকেই শেষ দিন (পরের মাসের একই তারিখ)' : `${daysLeft} দিন বাকি`}। অতিরিক্ত জরিমানা এড়াতে অবিলম্বে ঋণ পরিশোধ করুন, অন্যথায় ৩০ দিন অতিক্রান্ত হলে প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা বিলম্ব জরিমানা অটোমেটিক মেইন ব্যালেন্স থেকে কর্তন করা শুরু হবে।`,
            body: `আপনার ৳${dueLoan.toLocaleString('bn-BD')} করযে হাসানা ঋণের ৩০ দিন মেয়াদের আর মাত্র ${daysLeft === 0 ? 'আজকেই শেষ দিন (পরের মাসের একই তারিখ)' : `${daysLeft} দিন বাকি`}। অতিরিক্ত জরিমানা এড়াতে অবিলম্বে ঋণ পরিশোধ করুন, অন্যথায় ৩০ দিন অতিক্রান্ত হলে প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা বিলম্ব জরিমানা অটোমেটিক মেইন ব্যালেন্স থেকে কর্তন করা শুরু হবে।`,
            type: 'qard_due_warning',
            read: false,
            createdAt: nowIso
          });
          updateDoc(doc(db, 'users', user.uid), {
            lastQardDueReminderCycle: reminderCycleKey
          });
          user.lastQardDueReminderCycle = reminderCycleKey;
        }
      }

      // 2. Overdue Late Fine Automatic Deduction (Day 31+) - দিন প্রতি হাজারে ১০ টাকা করে ৩০ দিন পর থেকে জরিমানা কর্তন
      if (daysElapsed > 30) {
        if (user.lastQardFineDate !== todayKey) {
          const dailyFine = Math.max(10, Math.floor(dueLoan / 1000) * 10);
          const currentBal = Number(user.balance !== undefined ? user.balance : (user.mainBalance || 0)) || 0;
          
          let newBal = currentBal;
          let newDue = dueLoan;
          let deductedFromBal = 0;
          let addedToDue = 0;

          if (currentBal >= dailyFine) {
            newBal = currentBal - dailyFine;
            deductedFromBal = dailyFine;
          } else if (currentBal > 0) {
            deductedFromBal = currentBal;
            addedToDue = dailyFine - currentBal;
            newBal = 0;
            newDue = dueLoan + addedToDue;
          } else {
            addedToDue = dailyFine;
            newDue = dueLoan + dailyFine;
          }

          const userRef = doc(db, 'users', user.uid);
          updateDoc(userRef, {
            balance: newBal,
            mainBalance: newBal,
            dueLoan: newDue,
            lastQardFineDate: todayKey,
            totalQardFine: (user.totalQardFine || 0) + dailyFine
          }).then(() => {
            // Log Fine Deduction Transaction
            addDoc(collection(db, 'transactions'), {
              userId: user.uid,
              userName: user.name,
              memberId: user.memberId || user.phone,
              type: 'qard_fine',
              typeLabel: 'করযে হাসানা বিলম্ব জরিমানা কর্তন',
              amount: dailyFine,
              status: 'success',
              category: 'qard_late_fine',
              description: `⚠️ করযে হাসানা ঋণের ৩০ দিন মেয়াদ অতিক্রান্ত হওয়ায় (${daysElapsed - 30}তম দিন ওভারডিউ) আজ ${todayKey}-এ প্রতি হাজারে ১০ টাকা হারে ৳${dailyFine.toLocaleString('bn-BD')} বিলম্ব জরিমানা ${deductedFromBal > 0 ? `মেইন ওয়ালেট থেকে ৳${deductedFromBal} অটো কর্তন` : ''}${addedToDue > 0 ? `${deductedFromBal > 0 ? ' ও বাকি ' : ''}৳${addedToDue} বকেয়া ঋণে যুক্ত` : ''} করা হয়েছে।`,
              paymentMethod: deductedFromBal >= dailyFine ? 'AUTO_WALLET_DEDUCT' : 'AUTO_FINE',
              receiptNo: `FINE-${Math.floor(100000 + Math.random() * 900000)}`,
              createdAt: nowIso
            });

            // Send Realtime Notification
            addDoc(collection(db, 'user_notifications'), {
              userId: user.uid,
              title: '⚠️ করযে হাসানা বিলম্ব জরিমানা কর্তন',
              message: `আপনার করযে হাসানা ঋণের ৩০ দিনের মেয়াদ অতিক্রান্ত হওয়ায় আজ (${todayKey}) নিয়ম অনুযায়ী প্রতি ১,০০০ টাকায় ১০ টাকা হারে ৳${dailyFine.toLocaleString('bn-BD')} বিলম্ব জরিমানা ${deductedFromBal > 0 ? 'আপনার মেইন ওয়ালেট ব্যালেন্স থেকে অটোমেটিক কর্তন করা হয়েছে' : 'বকেয়া ঋণে যুক্ত করা হয়েছে'}। অতিরিক্ত জরিমানা এড়াতে অবিলম্বে সম্পূর্ণ ঋণ পরিশোধ করুন।`,
              body: `আপনার করযে হাসানা ঋণের ৩০ দিনের মেয়াদ অতিক্রান্ত হওয়ায় আজ (${todayKey}) নিয়ম অনুযায়ী প্রতি ১,০০০ টাকায় ১০ টাকা হারে ৳${dailyFine.toLocaleString('bn-BD')} বিলম্ব জরিমানা ${deductedFromBal > 0 ? 'আপনার মেইন ওয়ালেট ব্যালেন্স থেকে অটোমেটিক কর্তন করা হয়েছে' : 'বকেয়া ঋণে যুক্ত করা হয়েছে'}। অতিরিক্ত জরিমানা এড়াতে অবিলম্বে সম্পূর্ণ ঋণ পরিশোধ করুন।`,
              type: 'qard_fine_charged',
              read: false,
              createdAt: nowIso
            });

            user.balance = newBal;
            user.mainBalance = newBal;
            user.dueLoan = newDue;
            user.lastQardFineDate = todayKey;
            user.totalQardFine = (user.totalQardFine || 0) + dailyFine;
          }).catch((err) => console.error("Fine charge error:", err));
        }
      }
    } 
    // B. 3-MONTH (3 INSTALLMENTS) LOAN SYSTEM
    else {
      let stage = 1;
      let isWarningWindow = false;
      let isOverdue = false;
      let stageLabel = '১ম কিস্তি';

      if (daysElapsed <= 30) {
        stage = 1;
        stageLabel = '১ম কিস্তি';
        if (daysElapsed >= 28) isWarningWindow = true;
      } else if (daysElapsed <= 60) {
        stage = 2;
        stageLabel = '২য় কিস্তি';
        if (daysElapsed >= 58) isWarningWindow = true;
      } else if (daysElapsed <= 90) {
        stage = 3;
        stageLabel = '৩য় কিস্তি';
        if (daysElapsed >= 88) isWarningWindow = true;
      } else {
        stage = 3;
        stageLabel = '৩য় কিস্তি';
        isOverdue = true;
      }

      // 1. 2-Day Warning Notification for current installment
      if (isWarningWindow) {
        const reminderCycleKey = `remind_3m_stage${stage}_${takenTimeStr || 'init'}`;
        if (user.lastQardDueReminderCycle !== reminderCycleKey) {
          const targetDay = stage * 30;
          const daysLeft = Math.max(0, targetDay - daysElapsed);
          addDoc(collection(db, 'user_notifications'), {
            userId: user.uid,
            title: `⚠️ করযে হাসানা ${stageLabel} পরিশোধের সতর্কতা (২ দিন বাকি)`,
            message: `আপনার করযে হাসানা ৩ মাস মেয়াদী ঋণের ${stageLabel} পরিশোধের মেয়াদ শেষ হতে আর মাত্র ${daysLeft === 0 ? 'আজকেই শেষ দিন' : `${daysLeft} দিন বাকি`}। অতিরিক্ত জরিমানা এড়াতে কিস্তি পরিশোধ করুন, অন্যথায় ৩০ দিন মেয়াদ পার হলে প্রতিদিন হাজারে ১০ টাকা বিলম্ব জরিমানা অটো কর্তন শুরু হবে।`,
            body: `আপনার করযে হাসানা ৩ মাস মেয়াদী ঋণের ${stageLabel} পরিশোধের মেয়াদ শেষ হতে আর মাত্র ${daysLeft === 0 ? 'আজকেই শেষ দিন' : `${daysLeft} দিন বাকি`}। অতিরিক্ত জরিমানা এড়াতে কিস্তি পরিশোধ করুন, অন্যথায় ৩০ দিন মেয়াদ পার হলে প্রতিদিন হাজারে ১০ টাকা বিলম্ব জরিমানা অটো কর্তন শুরু হবে।`,
            type: 'qard_due_warning',
            read: false,
            createdAt: nowIso
          });
          updateDoc(doc(db, 'users', user.uid), {
            lastQardDueReminderCycle: reminderCycleKey
          });
          user.lastQardDueReminderCycle = reminderCycleKey;
        }
      }

      // 2. Overdue Late Fine for 3-Month Loan with wallet auto-deduction
      if (isOverdue || (stage === 1 && daysElapsed > 30 && !user.lastAutoDeductedMonth) || (stage === 2 && daysElapsed > 60)) {
        if (user.lastQardFineDate !== todayKey) {
          const dailyFine = Math.max(10, Math.floor(dueLoan / 1000) * 10);
          const currentBal = Number(user.balance !== undefined ? user.balance : (user.mainBalance || 0)) || 0;
          
          let newBal = currentBal;
          let newDue = dueLoan;
          let deductedFromBal = 0;
          let addedToDue = 0;

          if (currentBal >= dailyFine) {
            newBal = currentBal - dailyFine;
            deductedFromBal = dailyFine;
          } else if (currentBal > 0) {
            deductedFromBal = currentBal;
            addedToDue = dailyFine - currentBal;
            newBal = 0;
            newDue = dueLoan + addedToDue;
          } else {
            addedToDue = dailyFine;
            newDue = dueLoan + dailyFine;
          }

          const userRef = doc(db, 'users', user.uid);
          updateDoc(userRef, {
            balance: newBal,
            mainBalance: newBal,
            dueLoan: newDue,
            lastQardFineDate: todayKey,
            totalQardFine: (user.totalQardFine || 0) + dailyFine
          }).then(() => {
            addDoc(collection(db, 'transactions'), {
              userId: user.uid,
              userName: user.name,
              memberId: user.memberId || user.phone,
              type: 'qard_fine',
              typeLabel: 'করযে হাসানা বিলম্ব জরিমানা কর্তন',
              amount: dailyFine,
              status: 'success',
              category: 'qard_late_fine',
              description: `⚠️ করযে হাসানা ৩ মাস মেয়াদী ঋণের কিস্তির ৩০ দিন মেয়াদ অতিক্রান্ত হওয়ায় আজ ${todayKey}-এ প্রতি হাজারে ১০ টাকা হারে ৳${dailyFine.toLocaleString('bn-BD')} বিলম্ব জরিমানা ${deductedFromBal > 0 ? `মেইন ওয়ালেট থেকে ৳${deductedFromBal} অটো কর্তন` : ''}${addedToDue > 0 ? `${deductedFromBal > 0 ? ' ও বাকি ' : ''}৳${addedToDue} বকেয়া ঋণে যুক্ত` : ''} করা হয়েছে।`,
              paymentMethod: deductedFromBal >= dailyFine ? 'AUTO_WALLET_DEDUCT' : 'AUTO_FINE',
              receiptNo: `FINE-${Math.floor(100000 + Math.random() * 900000)}`,
              createdAt: nowIso
            });

            addDoc(collection(db, 'user_notifications'), {
              userId: user.uid,
              title: '⚠️ করযে হাসানা বিলম্ব জরিমানা কর্তন',
              message: `আপনার ৩ মাস মেয়াদী করযে হাসানা ঋণের কিস্তির মেয়াদ অতিক্রান্ত হওয়ায় প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা হারে আজ ৳${dailyFine.toLocaleString('bn-BD')} জরিমানা ${deductedFromBal > 0 ? 'মেইন ব্যালেন্স থেকে অটোমেটিক কর্তন করা হয়েছে' : 'বকেয়া ঋণে যুক্ত করা হয়েছে'}। অতিসত্বর কিস্তি পরিশোধ করুন।`,
              body: `আপনার ৩ মাস মেয়াদী করযে হাসানা ঋণের কিস্তির মেয়াদ অতিক্রান্ত হওয়ায় প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা হারে আজ ৳${dailyFine.toLocaleString('bn-BD')} জরিমানা ${deductedFromBal > 0 ? 'মেইন ব্যালেন্স থেকে অটোমেটিক কর্তন করা হয়েছে' : 'বকেয়া ঋণে যুক্ত করা হয়েছে'}। অতিসত্বর কিস্তি পরিশোধ করুন।`,
              type: 'qard_fine_charged',
              read: false,
              createdAt: nowIso
            });

            user.balance = newBal;
            user.mainBalance = newBal;
            user.dueLoan = newDue;
            user.lastQardFineDate = todayKey;
            user.totalQardFine = (user.totalQardFine || 0) + dailyFine;
          }).catch((err) => console.error("Fine charge error:", err));
        }
      }
    }
  }, [user?.uid, user?.dueLoan, user?.balance, user?.instantLoanTakenAt, user?.lastQardFineDate, appConfig]);

  useEffect(() => {
    fetchLedgers();
    fetchEligibility();
  }, []);

  // Real-time listener for user profile pictures and details across the platform
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
        const map: Record<string, { photoURL?: string; photo?: string; name?: string }> = {};
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const photo = d.photoURL || d.photo || d.avatar || d.image || d.profileImage || '';
          const name = d.name || '';
          const info = { photoURL: photo, photo, name };

          map[docSnap.id] = info;
          if (d.uid) map[d.uid] = info;
          if (d.phone) map[d.phone] = info;
          if (d.memberId) map[d.memberId] = info;
        });
        setUsersMap(map);
      }, (err) => {
        console.error("Users snapshot error in QardScreen:", err);
      });
      return () => unsub();
    } catch (err) {
      console.error("Error setting up users snapshot in QardScreen:", err);
    }
  }, []);

  // Real-time listener for user's Gold Loan records
  useEffect(() => {
    if (!user?.uid) return;
    try {
      const q = query(
        collection(db, 'gold_loans'),
        where('userId', '==', user.uid)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        list.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || 0);
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || 0);
          return tB - tA;
        });
        setGoldLoansList(list);
      }, (err) => {
        console.error("Gold loans snapshot error in Qard:", err);
      });
      return () => unsub();
    } catch (e) {
      console.error("Error setting up gold loans snapshot in Qard:", e);
    }
  }, [user?.uid]);

  // Helper values
  const currentMonthDonationTotal = qardHistory
    .filter(t => {
      if (t.userId !== user.uid || t.status !== 'success' || t.type !== 'qard_donation') return false;
      const txDate = new Date(t.createdAt);
      const now = new Date();
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const myAllTimeDonation = qardHistory
    .filter(t => t.userId === user.uid && t.status === 'success' && t.type === 'qard_donation')
    .reduce((sum, t) => sum + t.amount, 0);

  const myAllTimeWithdrawals = qardHistory
    .filter(t => t.userId === user.uid && t.type === 'qard_withdrawal' && t.status !== 'failed')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const myWithdrawableBalance = Math.max(0, myAllTimeDonation - myAllTimeWithdrawals);

  // Active Monthly Subscription tracker
  const monthlySubTx = qardHistory.find(
    t => t.userId === user.uid && t.status === 'success' && t.type === 'qard_donation' && t.description?.includes('মাসিক/স্বয়ংক্রিয়')
  );
  const activeMonthlyAmount = monthlySubTx ? monthlySubTx.amount : 0;

  // Donor category calculation
  const getDonorTier = (total: number) => {
    if (total >= 5000) return { name: 'গোল্ড ডোনার (Gold)', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30', level: '3' };
    if (total >= 500) return { name: 'সিলভার ডোনার (Silver)', color: 'text-slate-400 bg-slate-400/10 border-slate-400/30', level: '2' };
    if (total > 0) return { name: 'ব্রোঞ্জ ডোনার (Bronze)', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30', level: '1' };
    return { name: 'সাধারণ সদস্য', color: 'text-slate-400 bg-slate-100 border-slate-200', level: '0' };
  };

  const userTier = getDonorTier(myAllTimeDonation);

  // For scrolling ticker
  const [tickerIndex, setTickerIndex] = useState(0);
  const [isTransitionEnabled, setIsTransitionEnabled] = useState(true);

  const qardBorrowers = qardHistory
    .filter(t => t.type === 'qard_loan_disbursment' && t.status === 'success')
    .map((t, idx) => ({
      name: t.userName || 'সম্মানিত সদস্য',
      amount: t.amount
    }));

  const defaultBorrowers = [
    { name: "মোঃ আব্দুর রহমান", amount: 5000 },
    { name: "হাসান মাহমুদ", amount: 2000 },
    { name: "সামিয়া আক্তার", amount: 3000 },
    { name: "আরিফ বিল্লাহ", amount: 5000 },
    { name: "মোসাররফ হোসেন", amount: 2500 },
    { name: "তানজিল আহমেদ", amount: 4000 },
    { name: "ফাতেমা জান্নাত", amount: 1500 }
  ];

  const tickerItems = qardBorrowers.length > 0 ? qardBorrowers : defaultBorrowers;
  const extendedTickerItems = [...tickerItems, ...tickerItems.slice(0, 3)];

  useEffect(() => {
    if (tickerItems.length <= 3) return;
    const timer = setInterval(() => {
      setIsTransitionEnabled(true);
      setTickerIndex((prev) => prev + 1);
    }, 2550);
    return () => clearInterval(timer);
  }, [tickerItems.length]);

  useEffect(() => {
    if (tickerIndex >= tickerItems.length) {
      const timeout = setTimeout(() => {
        setIsTransitionEnabled(false);
        setTickerIndex(0);
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [tickerIndex, tickerItems.length]);

  // Handle Donation submit
  const handleDonateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const amt = parseFloat(donationAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('অনুগ্রহ করে সঠিক অনুদানের পরিমাণ লিখুন।');
      return;
    }

    if (user.balance < amt) {
      setErrorMsg('দুঃখিত! অনুদানের জন্য আপনার মেইন ওয়ালেট ব্যালেন্স পর্যাপ্ত নয়। আগে ড্যাশবোর্ড থেকে ওয়ালেটে ডিপোজিট করুন।');
      return;
    }

    if (!securityPin || securityPin !== user.pin) {
      setErrorMsg('ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।');
      return;
    }

    setLoading(true);
    try {
      const purposeMap: Record<string, { title: string; emoji: string }> = {
        general: { title: 'সাধারণ করযে হাসানা ফান্ড', emoji: '🤝' },
        medical: { title: 'চিকিৎসা সহায়তা খাতের দান', emoji: '🩺' },
        education: { title: 'দরিদ্র শিক্ষার্থীদের শিক্ষা', emoji: '🎓' },
        micro: { title: 'ক্ষুদ্র স্বনির্ভর ব্যবসা', emoji: '🚜' },
        emergency: { title: 'জরুরি মানবিক ও ত্রাণ সহায়তা', emoji: '🚨' },
      };
      const curPurpose = purposeMap[donationPurpose || 'general'] || purposeMap.general;
      const details = `${donationType === 'one_time' ? 'এককালীন' : 'মাসিক/স্বয়ংক্রিয়'} দান [${curPurpose.emoji} ${curPurpose.title}]`;

      // 2. Create success donation transaction
      const newTx: any = {
        userId: user.uid,
        userName: isAnonymous ? 'গোপন দাতা' : user.name,
        memberId: user.memberId,
        type: 'qard_donation',
        typeLabel: 'করযে হাসানা দান',
        amount: amt,
        status: 'success',
        donationPurpose: donationPurpose || 'general',
        purposeTitle: curPurpose.title,
        purposeEmoji: curPurpose.emoji,
        description: details + (isAnonymous ? ' (গোপনে দান)' : ''),
        createdAt: new Date().toISOString(),
        paymentMethod: 'WALLET',
        senderInfo: isAnonymous ? 'গোপন দাতা' : user.name,
        transactionId: `QRD-WLT-${Date.now().toString().slice(-6)}`,
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      };

      // Optimistic balance update ⚡
      user.balance = (user.balance || 0) - amt;
      user.mainBalance = user.balance;

      setReceiptData({
        receiptNo: newTx.receiptNo || '',
        transactionId: newTx.transactionId || '',
        userName: newTx.userName || '',
        memberId: newTx.memberId || '',
        typeLabel: newTx.typeLabel || 'করযে হাসানা দান',
        amount: newTx.amount || amt,
        description: newTx.description || '',
        createdAt: newTx.createdAt || new Date().toISOString(),
        paymentMethod: newTx.paymentMethod || 'WALLET'
      });
      setShowReceiptModal(true);
      setSuccessMsg('আলহামদুলিল্লাহ! আপনার মেইন ব্যালেন্স থেকে অনুদানটি সফলভাবে সম্পন্ন হয়েছে। উম্মাহর সেবায় আপনার অবদান কবুল হোক! ইনশাআল্লাহ।');
      setDonationAmount('');
      setSecurityPin('');
      setLoading(false);

      // Background async database operations
      const userRef = doc(db, 'users', user.uid);
      addDoc(collection(db, 'admin_notifications'), {
        title: '💖 করজে হাসানা ফান্ডে নতুন অনুদান প্রাপ্তি',
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) করজে হাসানা ফান্ডে ৳${amt.toLocaleString('bn-BD')} টাকা অনুদান দিয়েছেন।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        userPhone: user.phone || '',
        amount: amt,
        type: 'qard_donation',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      Promise.all([
        updateDoc(userRef, { balance: user.balance, mainBalance: user.balance }),
        addDoc(collection(db, 'transactions'), newTx)
      ]).then(() => {
        fetchLedgers();
        fetchEligibility();
      }).catch((err) => {
        console.error("Async donation background error:", err);
      });
    } catch (err: any) {
      setErrorMsg('ত্রুটি: ' + err.message);
      setLoading(false);
    }
  };

  // Handle Qard Loan application
  const handleLoanApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const amt = parseFloat(loanAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('অনুগ্রহ করে সঠিক ঋণের পরিমাণ লিখুন।');
      return;
    }

    const monthlyRepay = parseFloat(loanMonthlyRepay);
    if (isNaN(monthlyRepay) || monthlyRepay <= 0) {
      setErrorMsg('অনুগ্রহ করে প্রতি মাসে কত টাকা পরিশোধ করতে পারবেন তা লিখুন।');
      return;
    }

    // Mandatory Complete Profile Check
    const missingProfileFields = getMissingProfileFields(user);
    if (missingProfileFields.length > 0) {
      setErrorMsg(`⚠️ করযে হাসানা ঋণ পাওয়ার জন্য প্রোফাইল 100% ফিলাপ থাকা বাধ্যতামূলক। কোনো একটি তথ্য গ্যাপ থাকলে করজে হাসানা পাওয়া যাবে না। আপনার প্রোফাইলে বাকি রয়েছে: ${missingProfileFields.join(', ')}। অনুগ্রহ করে আগে প্রোফাইল এডিট করে সকল তথ্য সম্পূর্ণ করুন।`);
      return;
    }

    // Limit check - Min 500, Max 10,000 (Based on new policies)
    if (amt < 500 || amt > 10000) {
      setErrorMsg('প্রাথমিকভাবে ঋণের পরিমাণ সর্বনিম্ন 500 টাকা থেকে সর্বোচ্চ 10,000 টাকা হতে হবে।');
      return;
    }

    // Active days constraint (Min 2 months / 60 days for general members)
    const isSamityInvestor = user.samityStatus === 'approved' || user.samityApproved === true || user.isSamityMember === true || user.samitySchemeActive || user.role === 'admin' || user.isDemo;
    if (!isSamityInvestor && activeDays < 60) {
      setErrorMsg(`দুঃখিত! করজে হাসানা আবেদনের জন্য সাধারণ সদস্যদের অ্যাপে সর্বনিম্ন 2 মাস (60 দিন) সক্রিয় থাকতে হবে। আপনি মাত্র ${activeDays} দিন ধরে সক্রিয় আছেন।`);
      return;
    }

    // Transaction volume constraint (Min 20,000 BDT for general members)
    if (!isSamityInvestor && ambTxVolume < 20000) {
      setErrorMsg(`দুঃখিত! সাধারণ সদস্যদের ক্ষেত্রে এই 2 মাসে কমপক্ষে AMB টু AMB 20,000 টাকার লেনদেন থাকতে হবে। আপনার বর্তমান লেনদেন ৳${ambTxVolume.toLocaleString('bn-BD')} BDT`);
      return;
    }

    // Balance validation
    const availablePool = qardTotalFund - qardActiveLoansAmount;
    if (amt > availablePool) {
      setErrorMsg('দুঃখিত, ফান্ডে বর্তমানে পর্যাপ্ত ব্যালেন্স উপলব্ধ নেই। কিছু সময় পর পুনরায় চেষ্টা করুন।');
      return;
    }

    if (!loanWhatsapp || !loanWhatsapp.trim()) {
      setErrorMsg('অনুগ্রহ করে আপনার সচল WhatsApp নম্বরটি প্রদান করুন।');
      return;
    }

    if (!loanPin || loanPin !== user.pin) {
      setErrorMsg('ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।');
      return;
    }

    // Active loan check
    const myOutstanding = qardHistory.filter(t => t.userId === user.uid && t.type === 'qard_loan_disbursment' && t.status === 'success');
    const myRepaid = qardHistory.filter(t => t.userId === user.uid && t.type === 'qard_loan_repayment' && t.status === 'success');
    if (myOutstanding.length > myRepaid.length) {
      setErrorMsg('আপনার অলরেডি একটি সুদমুক্ত করযে হাসানা ঋণ বকেয়া আছে। সেটি পরিশোধের আগে নতুন আবেদন করা অসম্ভব।');
      return;
    }

    setLoading(true);
    try {
      const generatedReceiptNo = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const generatedTxId = `QRD-REQ-${Date.now().toString().slice(-6)}`;

      const newTx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'qard_loan_request',
        typeLabel: 'ঋণ সহায়তা রিকোয়েস্ট',
        amount: amt,
        status: 'pending',
        description: `সুদমুক্ত করযে হাসানা ঋণ সহায়তা আবেদন রিভিউ পেন্ডিং। মেয়াদ: ${loanDuration} মাস, কিস্তি: ৳${monthlyRepay}/মাস, হোয়াটসঅ্যাপ: ${loanWhatsapp}`,
        createdAt: new Date().toISOString(),
        loanDuration: loanDuration,
        whatsappNumber: loanWhatsapp,
        monthlyRepayAmount: monthlyRepay,
        transactionId: generatedTxId,
        receiptNo: generatedReceiptNo,
        paymentMethod: 'WALLET'
      };

      await addDoc(collection(db, 'transactions'), newTx);
      addDoc(collection(db, 'admin_notifications'), {
        title: '🤝 নতুন করজে হাসানা ঋণ সহায়তা আবেদন',
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ৳${amt.toLocaleString('bn-BD')} টাকা সুদমুক্ত ঋণ আবেদন করেছেন (মেয়াদ: ${loanDuration} মাস, কিস্তি: ৳${monthlyRepay}/মাস)।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        userPhone: user.phone || '',
        amount: amt,
        loanDuration: loanDuration,
        type: 'qard_loan_request',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));

      setReceiptData({
        receiptNo: generatedReceiptNo,
        transactionId: generatedTxId,
        userName: user.name,
        memberId: user.memberId || user.phone,
        typeLabel: 'ঋণ সহায়তা আবেদন (পেন্ডিং)',
        amount: amt,
        description: newTx.description || '',
        createdAt: newTx.createdAt || new Date().toISOString(),
        paymentMethod: 'WALLET'
      });
      setShowReceiptModal(true);

      setSuccessMsg('আপনার সুদমুক্ত ঋণ আবেদনটি সাফল্যের সাথে প্রেরণ করা হয়েছে। অ্যাডমিন পর্যালোচনার পর ঋণ সরাসরি আপনার ওয়ালেটে স্থানান্তর হবে।');
      setLoanAmount('');
      setLoanPurpose('');
      setLoanPin('');
      setLoanWhatsapp('');
      setLoanDuration(1);
      setLoanMonthlyRepay('');
      
      await fetchLedgers();
      await fetchEligibility();
    } catch (err: any) {
      setErrorMsg('ত্রুটি: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Coop 1% - 50% Instant Auto-Loan Disbursement
  const handleCoopInstantLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const coopInstantCfg = appConfig?.qardConfig?.coopInstantLoanConfig || DEFAULT_QARD_CONFIG.coopInstantLoanConfig;
    if (coopInstantCfg.enabled === false) {
      setErrorMsg('সমবায় ইনস্ট্যান্ট অটো-ঋণ সুবিধাটি সাময়িকভাবে বন্ধ রয়েছে।');
      return;
    }

    // Mandatory Complete Profile Check
    const missingProfileFields = getMissingProfileFields(user);
    if (missingProfileFields.length > 0) {
      setErrorMsg(`⚠️ করযে হাসানা ইনস্ট্যান্ট ঋণ গ্রহণের জন্য আপনার প্রোফাইল 100% ফিলাপ থাকা আবশ্যক। কোনো তথ্য গ্যাপ থাকলে ঋণ গ্রহণ করা যাবে না। বাকি তথ্য: ${missingProfileFields.join(', ')}। আগে প্রোফাইল সম্পূর্ণ করুন।`);
      return;
    }

    const userSavings = user.savings || 0;
    if (userSavings <= 0) {
      setErrorMsg('আপনার সমিতিতে কোনো সঞ্চয় জমা নেই। 1% - 50% অটো-ঋণ নিতে আগে সমিতিতে সঞ্চয় আমানত জমা রাখুন।');
      return;
    }

    const percent = coopInstantCfg.percentage ?? 50;
    const minInstantLimit = Math.max(1, Math.floor(userSavings * 0.01)); // Minimum 1% of savings
    const maxInstantLimit = Math.floor(userSavings * (percent / 100)); // Maximum 50% of savings

    const requestedAmt = parseFloat(instantLoanAmtInput || String(maxInstantLimit));

    if (isNaN(requestedAmt) || requestedAmt <= 0) {
      setErrorMsg('অনুগ্রহ করে ইনস্ট্যান্ট ঋণের সঠিক পরিমাণ লিখুন।');
      return;
    }

    if (requestedAmt < minInstantLimit) {
      setErrorMsg(`ইনস্ট্যান্ট ঋণের সর্বনিম্ন সীমা সঞ্চয়ের 1% (৳${minInstantLimit.toLocaleString('bn-BD')} BDT)।`);
      return;
    }

    if (requestedAmt > maxInstantLimit) {
      setErrorMsg(`আপনার সঞ্চয়ের (${percent}%) সর্বোচ্চ প্রাপ্যতা সীমা ৳${maxInstantLimit.toLocaleString('bn-BD')} BDT। এর বেশি ঋণ গ্রহণ করা সম্ভব নয়।`);
      return;
    }

    // Calculate percentage taken relative to savings
    const loanPercent = userSavings > 0 ? Math.round(((requestedAmt / userSavings) * 100) * 10) / 10 : 50;

    // 1. Check existing active due loan
    if ((user.dueLoan || 0) > 0) {
      setErrorMsg(`আপনার নিকট বর্তমানে ৳${(user.dueLoan || 0).toLocaleString('bn-BD')} BDT বকেয়া ঋণ রয়েছে। ইনস্ট্যান্ট অটো-ঋণ নিতে প্রথমে বর্তমান বকেয়া ঋণ সম্পূর্ণ পরিশোধ করুন।`);
      return;
    }

    // 2. Repayment-based Cooldown check:
    // If loan percentage <= 25%: 1 month (30 days) cooldown after FULL repayment.
    // If loan percentage > 25%: 3 months (90 days) cooldown after FULL repayment.
    const lastLoanAmt = user.lastCoopInstantLoanAmount || 0;
    const calcPercent = userSavings > 0 ? (lastLoanAmt / userSavings) * 100 : 50;
    const effectivePercent = user.lastCoopLoanPercentage ?? calcPercent;
    const effectiveCooldownDays = effectivePercent <= 25 ? 30 : 90;

    if (user.lastCoopInstantLoanRepaidAt) {
      const repaidTime = new Date(user.lastCoopInstantLoanRepaidAt).getTime();
      const daysSinceRepaid = Math.floor((Date.now() - repaidTime) / (1000 * 60 * 60 * 24));
      if (daysSinceRepaid < effectiveCooldownDays) {
        const remainingDays = effectiveCooldownDays - daysSinceRepaid;
        const nextDateStr = new Date(repaidTime + effectiveCooldownDays * 24 * 60 * 60 * 1000).toLocaleDateString('bn-BD');
        const cooldownLabel = effectivePercent <= 25 ? '1 মাস (30 দিন)' : '3 মাস (90 দিন)';
        setErrorMsg(`আপনি গত ${new Date(user.lastCoopInstantLoanRepaidAt).toLocaleDateString('bn-BD')}-এ (${daysSinceRepaid} দিন আগে) পূর্বের ${lastLoanAmt > 0 ? `৳${lastLoanAmt.toLocaleString('bn-BD')} (${effectivePercent.toFixed(1)}%) ` : ''}ঋণ সম্পূর্ণ পরিশোধ করেছেন। নিয়ম অনুযায়ী ${effectivePercent <= 25 ? '1% - 25%' : '25% - 50%'} ঋণ পরিশোধের পর ${cooldownLabel} পর (${nextDateStr}) পুনরায় ইনস্ট্যান্ট অটো-ঋণ নেওয়া যাবে। (আর ${remainingDays} দিন বাকি)`);
        return;
      }
    }

    if (!instantLoanPinInput || instantLoanPinInput !== user.pin) {
      setErrorMsg('ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।');
      return;
    }

    setInstantLoanLoading(true);
    try {
      // 1. Update user balance & due loan directly in Firestore
      const userRef = doc(db, 'users', user.uid);
      const newBalance = (user.balance || 0) + requestedAmt;
      const newDueLoan = (user.dueLoan || 0) + requestedAmt;
      const durationMonths = instantLoanDurationInput === 3 ? 3 : 1;
      const nowIso = new Date().toISOString();

      await updateDoc(userRef, {
        balance: newBalance,
        mainBalance: newBalance,
        dueLoan: newDueLoan,
        lastCoopInstantLoanAt: nowIso,
        lastCoopInstantLoanAmount: requestedAmt,
        lastCoopLoanPercentage: loanPercent,
        instantLoanDurationMonths: durationMonths,
        instantLoanOriginalAmount: requestedAmt,
        instantLoanTakenAt: nowIso
      });

      // Update local optimistic state
      user.balance = newBalance;
      user.dueLoan = newDueLoan;
      user.lastCoopInstantLoanAmount = requestedAmt;
      user.lastCoopLoanPercentage = loanPercent;

      // 2. Calculate Installment Breakdown & Add Transaction Record
      let monthlyPay = Math.ceil(requestedAmt / durationMonths);
      let ratioNote = '';

      if (durationMonths === 3) {
        const m1 = Math.round(requestedAmt / 3);
        const m2 = Math.round(requestedAmt / 3);
        const m3 = requestedAmt - (m1 + m2);
        ratioNote = ` [3 কিস্তি বন্টনঃ 1ম কিস্তি (30 দিন / পরের মাসের একই তারিখ) ৳${m1}, 2য় কিস্তি (60 দিন / 2য় মাসের একই তারিখ) ৳${m2}, 3য় কিস্তি (90 দিন / 3য় মাসের একই তারিখ) ৳${m3}]`;
        monthlyPay = m1;
      } else {
        ratioNote = ` [1 মাস (30 দিন) মেয়াদে সম্পূর্ণ পরিশোধযোগ্যঃ ৳${requestedAmt} (পরের মাসের একই তারিখ)]`;
        monthlyPay = requestedAmt;
      }

      const generatedReceiptNo = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const generatedTxId = `QRD-AUTO-${Date.now().toString().slice(-6)}`;

      const txRecord: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'qard_loan_disbursment',
        typeLabel: 'সমবায় ইনস্ট্যান্ট অটো-ঋণ',
        amount: requestedAmt,
        status: 'success',
        category: 'coop_instant_auto_loan',
        description: `🏢 সমবায় সঞ্চয়ের (${loanPercent}%) ইনস্ট্যান্ট অটো-ঋণ (সঞ্চয়: ৳${userSavings.toLocaleString('bn-BD')}, ${durationMonths === 3 ? '3 মাস' : '1 মাস (30 দিন)'} মেয়াদে ডিসবার্সড)${ratioNote}`,
        loanDuration: durationMonths,
        monthlyRepayAmount: monthlyPay,
        createdAt: nowIso,
        transactionId: generatedTxId,
        receiptNo: generatedReceiptNo,
        paymentMethod: 'WALLET'
      };
      await addDoc(collection(db, 'transactions'), txRecord);
      addDoc(collection(db, 'admin_notifications'), {
        title: '⚡ সমবায় ইনস্ট্যান্ট অটো-ঋণ ডিসবার্সড',
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) সমবায় সঞ্চয়ের বিপরীতে ৳${requestedAmt.toLocaleString('bn-BD')} ইনস্ট্যান্ট ঋণ নিয়েছেন (${durationMonths} মাস মেয়াদ)।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        userPhone: user.phone || '',
        amount: requestedAmt,
        type: 'coop_instant_loan',
        read: false,
        createdAt: nowIso
      }).catch(e => console.warn('Admin notif error:', e));

      // 3. Add notification for user
      const notifData = {
        userId: user.uid,
        title: '🏢 1% - 50% ইনস্ট্যান্ট অটো-ঋণ অনুমোদিত!',
        message: `আপনার সমবায় সঞ্চয় (৳${userSavings.toLocaleString('bn-BD')}) ভিত্তি ধরে ৳${requestedAmt.toLocaleString('bn-BD')} ইনস্ট্যান্ট অটো-ঋণ সরাসরি ওয়ালেটে জমা দেওয়া হয়েছে। পরিশোধের নিয়মঃ যেই তারিখে টাকা নেওয়া হয়েছে, ঠিক পরের মাসে সেই একই তারিখে পরিশোধ করতে হবে (30 দিন গণনা)। ${durationMonths === 3 ? '3 মাস মেয়াদের ক্ষেত্রে 90 দিন গণনা হবে এবং প্রতি 30 দিন পর পর 3টি সমান কিস্তিতে পরিশোধ করতে হবে।' : '1 মাস মেয়াদের ক্ষেত্রে 30 দিন পর সম্পূর্ণ পরিশোধ করতে হবে।'} মেয়াদ শেষ হওয়ার 2 দিন পূর্বে রিমাইন্ডার নোটিফিকেশন যাবে এবং 30 দিন পার হলে প্রতিদিন প্রতি হাজারে 10 টাকা বিলম্ব জরিমানা কার্যকর হবে।`,
        type: 'qard_disbursed',
        read: false,
        createdAt: nowIso
      };
      await addDoc(collection(db, 'user_notifications'), notifData);

      // Open Professional AMB Receipt Modal
      setReceiptData({
        receiptNo: generatedReceiptNo,
        transactionId: generatedTxId,
        userName: user.name,
        memberId: user.memberId || user.phone,
        typeLabel: 'সমবায় ইনস্ট্যান্ট অটো-ঋণ',
        amount: requestedAmt,
        description: txRecord.description || '',
        createdAt: nowIso,
        paymentMethod: 'WALLET'
      });
      setShowReceiptModal(true);

      setSuccessMsg(`🎉 অভিনন্দন! ৳${requestedAmt.toLocaleString('bn-BD')} ইনস্ট্যান্ট অটো-ঋণ সরাসরি আপনার মেইন ওয়ালেটে জমা হয়েছে! (${durationMonths} মাস মেয়াদের অটো-কিস্তি চালু করা হয়েছে)`);
      setInstantLoanAmtInput('');
      setInstantLoanPinInput('');

      await fetchLedgers();
    } catch (err: any) {
      setErrorMsg('ইনস্ট্যান্ট ঋণ প্রক্রিয়াকরণে সমস্যা: ' + err.message);
    } finally {
      setInstantLoanLoading(false);
    }
  };

  const handleWithdrawApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('অনুগ্রহ করে সঠিক উত্তোলনের পরিমাণ লিখুন।');
      return;
    }

    if (amt > myWithdrawableBalance) {
      setErrorMsg(`আপনার সর্বোচ্চ উত্তোলনযোগ্য ব্যালেন্স ৳${myWithdrawableBalance?.toLocaleString('bn-BD')} BDT`);
      return;
    }

    if (!withdrawWhatsapp || !withdrawWhatsapp.trim()) {
      setErrorMsg('অনুগ্রহ করে আপনার সচল WhatsApp নম্বরটি প্রদান করুন।');
      return;
    }

    if (!withdrawPin || withdrawPin !== user.pin) {
      setErrorMsg('ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।');
      return;
    }

    setLoading(true);
    try {
      const generatedReceiptNo = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const generatedTxId = `QRD-WTH-${Date.now().toString().slice(-6)}`;

      const newTx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'qard_withdrawal',
        typeLabel: 'টাকা উত্তোলন আবেদন',
        amount: amt,
        status: 'pending',
        description: `সুদমুক্ত করযে হাসানা ফান্ড থেকে আমানত উত্তোলন আবেদন। হোয়াটসঅ্যাপ: ${withdrawWhatsapp}`,
        createdAt: new Date().toISOString(),
        whatsappNumber: withdrawWhatsapp,
        transactionId: generatedTxId,
        receiptNo: generatedReceiptNo,
        paymentMethod: 'WALLET'
      };

      await addDoc(collection(db, 'transactions'), newTx);
      addDoc(collection(db, 'admin_notifications'), {
        title: '💸 করজে হাসানা অনুদান ফেরত/উত্তোলন আবেদন',
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) করজে হাসানা ফান্ড হতে ৳${amt.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন করেছেন।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        userPhone: user.phone || '',
        amount: amt,
        type: 'qard_withdraw',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));

      setReceiptData({
        receiptNo: generatedReceiptNo,
        transactionId: generatedTxId,
        userName: user.name,
        memberId: user.memberId || user.phone,
        typeLabel: 'টাকা উত্তোলন আবেদন (পেন্ডিং)',
        amount: amt,
        description: newTx.description || '',
        createdAt: newTx.createdAt || new Date().toISOString(),
        paymentMethod: 'WALLET'
      });
      setShowReceiptModal(true);

      setSuccessMsg('আপনার টাকা উত্তোলনের রিকোয়েস্টটি সাফল্যের সাথে প্রেরণ করা হয়েছে। অ্যাডমিন প্যানেল আপনার দেওয়া তথ্য যাচাই করে অনুমোদন করবে।');
      setWithdrawAmount('');
      setWithdrawWhatsapp('');
      setWithdrawPin('');
      
      await fetchLedgers();
    } catch (err: any) {
      setErrorMsg('ত্রুটি: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Repay Qard Loan instantly using Main Balance
  const handleLoanRepay = async (repayAmt: number) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!repayAmt || repayAmt <= 0) {
      setErrorMsg('অনুগ্রহ করে সঠিক পরিশোধের পরিমাণ লিখুন।');
      return;
    }

    if (user.balance < repayAmt) {
      setErrorMsg(`দুঃখিত! ঋণ পরিশোধের জন্য আপনার মেইন ওয়ালেট ব্যালেন্স পর্যাপ্ত নয়। প্রয়োজন ৳${repayAmt.toLocaleString('bn-BD')} BDT, কিন্তু আপনার মেইন ব্যালেন্স আছে ৳${(user.balance || 0).toLocaleString('bn-BD')} BDT। অনুগ্রহ করে ওয়ালেটে ডিপোজিট/রিচার্জ করুন।`);
      return;
    }

    const pin = prompt('ঋণ পরিশোধ নিশ্চিত করতে আপনার 4 ডিজিটের সিকিউরিটি পিন নাম্বারটি দিনঃ');
    if (!pin || pin !== user.pin) {
      setErrorMsg('ভুল সিকিউরিটি পিন। পরিশোধ বাতিল করা হয়েছে।');
      return;
    }

    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const currentDue = user.dueLoan || 0;
      const newDue = Math.max(0, currentDue - repayAmt);
      const newBalance = Math.max(0, user.balance - repayAmt);

      // Optimistic local update ⚡
      user.balance = newBalance;
      user.dueLoan = newDue;
      if (newDue === 0) {
        user.lastCoopInstantLoanRepaidAt = nowIso;
      }

      const generatedReceiptNo = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const generatedTxId = `QRD-REPAY-${Date.now().toString().slice(-6)}`;
      const newTx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'qard_loan_repayment',
        typeLabel: 'করযে হাসানা পরিশোধ',
        amount: repayAmt,
        status: 'success',
        description: `মেইন ব্যালেন্স থেকে করযে হাসানা সুদমুক্ত ঋণ/কিস্তি পরিশোধ সম্পন্ন (বকেয়া অবশিষ্ট: ৳${newDue.toLocaleString('bn-BD')} BDT)`,
        createdAt: nowIso,
        paymentMethod: 'WALLET',
        transactionId: generatedTxId,
        receiptNo: generatedReceiptNo
      };

      setReceiptData({
        receiptNo: generatedReceiptNo,
        transactionId: generatedTxId,
        userName: user.name,
        memberId: user.memberId || user.phone,
        typeLabel: 'করযে হাসানা পরিশোধ',
        amount: repayAmt,
        description: `মেইন ব্যালেন্স থেকে করযে হাসানা ঋণ/কিস্তি পরিশোধ সম্পন্ন (${newDue === 0 ? 'সম্পূর্ণ বকেয়া পরিশোধিত' : `বকেয়া অবশিষ্ট ৳${newDue.toLocaleString('bn-BD')} BDT`})`,
        createdAt: nowIso,
        paymentMethod: 'WALLET'
      });
      setShowReceiptModal(true);
      setSuccessMsg(newDue === 0 
        ? 'অভিনন্দন! আপনার বকেয়া করযে হাসানা ঋণ সম্পূর্ণ পরিশোধিত হয়েছে।' 
        : `আপনার ৳${repayAmt.toLocaleString('bn-BD')} কিস্তি পরিশোধ সফল হয়েছে! বকেয়া ঋণ অবশিষ্ট: ৳${newDue.toLocaleString('bn-BD')} BDT।`);
      setCustomRepayInput('');
      setLoading(false);

      // Async background sync
      const userRef = doc(db, 'users', user.uid);
      const userUpdateFields: any = {
        balance: newBalance,
        dueLoan: newDue
      };
      if (newDue === 0) {
        userUpdateFields.lastCoopInstantLoanRepaidAt = nowIso;
      }

      await Promise.all([
        addDoc(collection(db, 'admin_notifications'), {
          title: '✅ করজে হাসানা ঋণ/কিস্তি পরিশোধ সফল',
          message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ৳${repayAmt.toLocaleString('bn-BD')} টাকা ঋণ কিস্তি পরিশোধ করেছেন। অবশিষ্ট বকেয়া: ৳${newDue.toLocaleString('bn-BD')}।`,
          userId: user.uid,
          userName: user.name || '',
          memberId: user.memberId || '',
          amount: repayAmt,
          type: 'qard_repay',
          read: false,
          createdAt: nowIso
        }).catch(e => console.warn('Admin notif error:', e)),
        updateDoc(userRef, userUpdateFields),
        addDoc(collection(db, 'transactions'), newTx),
        addDoc(collection(db, 'user_notifications'), {
          id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          userId: user.uid,
          title: '✅ করজে হাসানা ঋণ/কিস্তি পরিশোধ সম্পন্ন',
          body: `আপনার মেইন ওয়ালেট ব্যালেন্স থেকে ৳${repayAmt.toLocaleString('bn-BD')} সফলভাবে পরিশোধ করা হয়েছে। ${newDue === 0 ? 'আপনার সকল বকেয়া ঋণ সম্পূর্ণ পরিশোধিত।' : `বকেয়া অবশিষ্ট ৳${newDue.toLocaleString('bn-BD')} BDT।`}`,
          date: nowIso,
          read: false,
          type: 'SYSTEM'
        })
      ]);

      await syncLiveProfile();
      await fetchLedgers();
      await fetchEligibility();
    } catch (err: any) {
      setErrorMsg('ত্রুটি: ' + err.message);
      setLoading(false);
    }
  };

  // Active Loan Repayment Component Helper
  const renderActiveLoanRepaymentCard = () => {
    const myDisbursments = qardHistory.filter(t => t.userId === user.uid && t.type === 'qard_loan_disbursment' && t.status === 'success');
    const myRepayments = qardHistory.filter(t => t.userId === user.uid && t.type === 'qard_loan_repayment' && t.status === 'success');
    
    const totalBorrowed = myDisbursments.reduce((acc, c) => acc + c.amount, 0);
    const totalRepaid = myRepayments.reduce((acc, c) => acc + c.amount, 0);
    const activeDue = Math.max(user.dueLoan || 0, Math.max(0, totalBorrowed - totalRepaid));

    if (activeDue <= 0) return null;

    const latestDisb = myDisbursments[0];
    const duration = latestDisb?.loanDuration || 1;
    const loanAmount = latestDisb?.amount || activeDue;
    const monthlyInstalment = Math.min(activeDue, Math.ceil(loanAmount / duration));

    // Date calculations - Same date next month (30 days)
    const disbDateObj = latestDisb?.createdAt ? new Date(latestDisb.createdAt) : (user.instantLoanTakenAt ? new Date(user.instantLoanTakenAt) : new Date());
    const dayOfMonth = disbDateObj.getDate();
    const today = new Date();
    const daysElapsed = Math.floor((today.getTime() - disbDateObj.getTime()) / (1000 * 60 * 60 * 24));
    
    // Exact due date: Same date next month (30 days total period)
    const nextDueDate = new Date(disbDateObj);
    nextDueDate.setDate(nextDueDate.getDate() + (duration === 1 ? 30 : (daysElapsed > 60 ? 90 : (daysElapsed > 30 ? 60 : 30))));
    const nextDueDateStr = nextDueDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
    const disbDateStr = disbDateObj.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });

    const isOverdue = daysElapsed > 30;
    const overdueDays = isOverdue ? daysElapsed - 30 : 0;
    const daysRemaining = isOverdue ? 0 : Math.max(0, 30 - daysElapsed);
    const dailyFineAmt = Math.max(10, Math.floor(activeDue / 1000) * 10);

    const payAmtToExecute = parseFloat(customRepayInput) || activeDue;

    return (
      <div className="bg-gradient-to-br from-rose-50 via-white to-pink-50/50 p-4 sm:p-5 border border-rose-200/90 rounded-3xl space-y-4 text-left shadow-sm">
        <div className="flex justify-between items-start border-b border-rose-100/80 pb-3">
          <div>
            <span className="text-[9px] bg-rose-100 text-rose-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wide inline-block">
              সক্রিয় বকেয়া ঋণ ও অগ্রিম পরিশোধ
            </span>
            <h4 className="text-sm font-black text-rose-950 mt-1 font-sans">
              করযে হাসানা হাওলাত ও কিস্তি পরিশোধ
            </h4>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-slate-500 font-extrabold block">মোট বকেয়া ঋণ</span>
            <strong className="text-base font-mono font-black text-rose-700">৳ {activeDue.toLocaleString('bn-BD')} BDT</strong>
          </div>
        </div>

        {/* Overdue Warning Alert Box if passed 30 days */}
        {isOverdue && (
          <div className="p-3 bg-rose-600 text-white rounded-2xl text-[11px] font-bold space-y-1 shadow-sm animate-pulse">
            <div className="flex items-center gap-1.5 font-black text-xs">
              <AlertCircle className="w-4 h-4 text-white" />
              <span>⚠️ ৩০ দিন মেয়াদ অতিক্রান্ত! ({overdueDays} দিন ওভারডিউ)</span>
            </div>
            <p className="text-[10px] text-rose-100 leading-relaxed font-sans">
              আপনার ঋণের নির্ধারিত ৩০ দিন মেয়াদ পার হয়ে গেছে। নিয়ম অনুযায়ী প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা হারে (আজকের জরিমানা ৳{dailyFineAmt.toLocaleString('bn-BD')}) আপনার মেইন ব্যালেন্স থেকে স্বয়ংক্রিয়ভাবে বিলম্ব জরিমানা কর্তন করা শুরু হয়েছে। আরও অতিরিক্ত জরিমানা এড়াতে এখনই সম্পূর্ণ ঋণ পরিশোধ করুন।
            </p>
          </div>
        )}

        {/* Loan details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/90 p-3 rounded-2xl border border-rose-100/70 text-[10.5px]">
          <div>
            <span className="text-slate-400 font-bold block text-[8px] uppercase">ঋণ গ্রহণের তারিখঃ</span>
            <span className="font-extrabold text-slate-800">{disbDateStr}</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold block text-[8px] uppercase">পরিশোধের শেষ সময়ঃ</span>
            <span className={`font-black ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
              {nextDueDateStr} ({dayOfMonth}ই তারিখ)
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-bold block text-[8px] uppercase">অবশিষ্ট সময়ঃ</span>
            <span className={`font-black ${isOverdue ? 'text-rose-600' : 'text-emerald-700'}`}>
              {isOverdue ? `⚠️ ${overdueDays} দিন ওভারডিউ` : `⏳ আর ${daysRemaining} দিন বাকি`}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-bold block text-[8px] uppercase">মাসিক নির্ধারিত কিস্তিঃ</span>
            <span className="font-extrabold text-slate-800">৳ {monthlyInstalment.toLocaleString('bn-BD')}</span>
          </div>
        </div>

        {/* Special Early Repayment Rule Notice */}
        <div className="p-3 bg-rose-500/10 border border-rose-200/70 rounded-2xl text-[10px] text-rose-950 font-bold leading-relaxed flex items-start gap-2">
          <Zap className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-rose-700 font-black block mb-0.5">পরিশোধের সঠিক নিয়ম ও স্বয়ংক্রিয় জরিমানাঃ</strong>
            যেই তারিখে ঋণ নিবেন, ঠিক পরের মাসে সেই একই তারিখের পূর্বে (সর্বোচ্চ ৩০ দিনের মধ্যে) পরিশোধ করতে হবে। ৩০ দিনের বেশি হয়ে গেলে স্বয়ংক্রিয়ভাবে ৩১তম দিন থেকে প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা হারে বিলম্ব জরিমানা মেইন ব্যালেন্স থেকে অটো কর্তন করা শুরু হবে। আপনি চাইলে নির্ধারিত মেয়াদের আগেই যেকোনো দিন আপনার মেইন ওয়ালেট থেকে সম্পূর্ণ ঋণ বা কিস্তির টাকা অগ্রিম পরিশোধ করতে পারবেন।
          </div>
        </div>

        {/* Repayment Form Controls */}
        <div className="space-y-3 pt-1">
          <label className="block text-[11px] font-extrabold text-slate-700">
            পরিশোধের পরিমাণ নির্বাচন করুন বা লিখুন (৳):
          </label>

          {/* Quick Select Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCustomRepayInput(String(monthlyInstalment))}
              className={`p-2.5 rounded-xl border text-[11px] font-extrabold transition cursor-pointer flex flex-col items-center justify-center ${
                customRepayInput === String(monthlyInstalment)
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>1 কিস্তি পরিশোধ</span>
              <span className="text-[9.5px] opacity-90 font-mono">৳ {monthlyInstalment.toLocaleString('bn-BD')} BDT</span>
            </button>

            <button
              type="button"
              onClick={() => setCustomRepayInput(String(activeDue))}
              className={`p-2.5 rounded-xl border text-[11px] font-extrabold transition cursor-pointer flex flex-col items-center justify-center ${
                customRepayInput === String(activeDue) || (!customRepayInput && activeDue > 0)
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>সম্পূর্ণ ঋণ পরিশোধ</span>
              <span className="text-[9.5px] opacity-90 font-mono">৳ {activeDue.toLocaleString('bn-BD')} BDT</span>
            </button>
          </div>

          {/* Custom Input */}
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">৳</span>
            <input
              type="number"
              value={customRepayInput}
              onChange={(e) => setCustomRepayInput(e.target.value)}
              placeholder={`নিজের ইচ্ছেমতো পরিমাণ লিখুন (উদাঃ ${monthlyInstalment} বা ${activeDue})`}
              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Execute Button */}
          <button
            onClick={() => handleLoanRepay(payAmtToExecute)}
            disabled={loading}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-2xl active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <Coins className="w-4 h-4 text-white" />
            ওয়ালেট থেকে এক্ষুণি ৳ {payAmtToExecute.toLocaleString('bn-BD')} BDT পরিশোধ করুন
          </button>
        </div>
      </div>
    );
  };

  // Execute Qard Auto Debit Simulation
  const handleExecuteQardAutoDebit = async (outstandingDue: number, monthlyInstallment: number, duration: number) => {
    setSimulationError('');
    setSimulationSuccess('');
    
    const installmentAmount = Math.min(outstandingDue, monthlyInstallment);
    const daysLate = qardSimulatedDay > 30 ? (qardSimulatedDay - 30) : 0;
    
    // Calculate penalty: 10 TK per 1000 TK per day (applied when exceeding 30 days)
    const penaltyAmount = daysLate > 0 ? Math.floor((installmentAmount / 1000) * 10 * daysLate) : 0;
    const totalDeduction = installmentAmount + penaltyAmount;
    
    if (user.balance < totalDeduction) {
      setSimulationError(`দুঃখিত! আপনার মেইন ব্যালেন্স থেকে কিস্তি এবং জরিমানা বাবদ প্রয়োজনীয় ৳${totalDeduction.toLocaleString('bn-BD')} স্বয়ংক্রিয়ভাবে কাটার জন্য পর্যাপ্ত ব্যালেন্স নেই। অনুগ্রহ করে ওয়ালেটে ফান্ড অ্যাড করুন।`);
      return;
    }
    
    setSimulatingAutoDebit(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      // Deduct from user balance
      await updateDoc(userRef, {
        balance: user.balance - totalDeduction
      });
      
      const generatedReceiptNo = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const generatedTxId = `QRD-DEBIT-${Date.now().toString().slice(-6)}`;
      
      // Save Repayment Transaction
      const repaymentTx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'qard_loan_repayment',
        typeLabel: 'করযে হাসানা পরিশোধ (অটো-ডেবিট)',
        amount: installmentAmount,
        status: 'success',
        description: `মেইন ব্যালেন্স থেকে করযে হাসানা কিস্তি স্বয়ংক্রিয়ভাবে কেটে নেওয়া হয়েছে (ঋণ চক্রের ${qardSimulatedDay}তম দিনে, মেয়াদ: ${duration} মাস)।`,
        createdAt: new Date().toISOString(),
        paymentMethod: 'WALLET',
        transactionId: generatedTxId,
        receiptNo: generatedReceiptNo
      };
      await addDoc(collection(db, 'transactions'), repaymentTx);
      
      // Save Penalty Transaction (if penalty exists)
      if (penaltyAmount > 0) {
        const penaltyTx: Partial<Transaction> = {
          userId: user.uid,
          userName: user.name,
          memberId: user.memberId || user.phone,
          type: 'fee_payment',
          typeLabel: 'বিলম্ব জরিমানা (করযে হাসানা)',
          amount: penaltyAmount,
          status: 'success',
          description: `করযে হাসানা কিস্তি পরিশোধে 30 দিন অতিক্রম করায় (${daysLate} দিন বিলম্বে) জরিমানা চার্জ করা হয়েছে (প্রতি 1,000 টাকায় প্রতিদিন 10 টাকা)।`,
          createdAt: new Date().toISOString(),
          paymentMethod: 'WALLET',
          transactionId: `QRD-PENALTY-${Date.now().toString().slice(-6)}`,
          receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
        };
        await addDoc(collection(db, 'transactions'), penaltyTx);
      }
      
      // Add Notifications
      const notifId = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await addDoc(collection(db, 'user_notifications'), {
        id: notifId,
        userId: user.uid,
        title: '💸 করজে হাসানা কিস্তি অটো-ডেবিট সম্পন্ন',
        body: `আপনার একাউন্টের মেইন ব্যালেন্স থেকে সফলভাবে কিস্তি বাবদ ৳${installmentAmount.toLocaleString('bn-BD')} ${penaltyAmount > 0 ? `এবং বিলম্ব জরিমানা বাবদ ৳${penaltyAmount.toLocaleString('bn-BD')}` : ''} স্বয়ংক্রিয়ভাবে কেটে নেওয়া হয়েছে। আপনার আমানত সুরক্ষায় সহযোগিতা করার জন্য ধন্যবাদ।`,
        read: false,
        createdAt: new Date().toISOString()
      });
      
      setSimulationSuccess(`আলহামদুলিল্লাহ! আপনার কিস্তি অটো-ডেবিট এবং জরিমানা সমন্বয় সফলভাবে সম্পন্ন হয়েছে। মেইন ওয়ালেট থেকে মোট ৳${totalDeduction.toLocaleString('bn-BD')} কেটে নেওয়া হয়েছে।`);
      
      await fetchLedgers();
      await syncLiveProfile();
    } catch (err: any) {
      setSimulationError('সিমুলেশন ব্যর্থ হয়েছেঃ ' + err.message);
    } finally {
      setSimulatingAutoDebit(false);
    }
  };

  // Admin Actions
  const handleAdminVerify = async (txId: string, action: 'approve' | 'reject', txType: string, txUserId: string, txAmount: number) => {
    setLoading(true);
    try {
      const tx = qardHistory.find(t => t.id === txId || t.docId === txId);
      const txRef = doc(db, 'transactions', tx?.docId || txId);
      
      if (action === 'approve') {
        // Approve transaction status
        await updateDoc(txRef, { status: 'success' });
        
        // If it was a loan request, trigger loan disbursement and insert the actual disbursement tx and credit user's main wallet balance!
        if (txType === 'qard_loan_request') {
          // Double verify pool limits
          const availablePool = qardTotalFund - qardActiveLoansAmount;
          if (txAmount > availablePool) {
            alert('ফান্ডে পর্যান্ত ব্যালেন্স নেই!');
            setLoading(false);
            return;
          }

          // Credit borrower's main wallet balance and update due loan status
          const borrowerRef = doc(db, 'users', txUserId);
          const snapB = await getDocs(query(collection(db, 'users')));
          let borrowerData: any = null;
          snapB.forEach((ub) => {
            if (ub.id === txUserId) borrowerData = ub.data();
          });

          const currentBal = borrowerData?.balance || 0;
          await updateDoc(borrowerRef, {
            balance: currentBal + txAmount,
            mainBalance: currentBal + txAmount,
            dueLoan: txAmount
          });

          // Insert actual disbursement transaction
          await addDoc(collection(db, 'transactions'), {
            userId: txUserId,
            userName: borrowerData?.name || 'ঋণ গ্রহীতা',
            memberId: borrowerData?.memberId || 'UNKNOWN',
            type: 'qard_loan_disbursment',
            typeLabel: 'ঋণ বিতরণ সম্পন্ন',
            amount: txAmount,
            status: 'success',
            description: `সুদমুক্ত ঋণ বিতরণ (অনুমোদিত আবেদন# ${txId.slice(-4)})`,
            createdAt: new Date().toISOString()
          });
        }

        if (txType === 'qard_withdrawal') {
          // Credit user's main balance upon donation withdrawal approval
          const requesterRef = doc(db, 'users', txUserId);
          const snapB = await getDocs(query(collection(db, 'users')));
          let requesterData: any = null;
          snapB.forEach((ub) => {
            if (ub.id === txUserId) requesterData = ub.data();
          });

          const currentBal = requesterData?.balance || 0;
          await updateDoc(requesterRef, {
            balance: currentBal + txAmount,
            mainBalance: currentBal + txAmount
          });
        }
        
        alert('সফলভাবে অনুমোদন করা হয়েছে!');
      } else {
        await updateDoc(txRef, { status: 'failed' });
        alert('আবেদনটি বাতিল করা হয়েছে!');
      }

      await fetchLedgers();
      await syncLiveProfile();
    } catch (err: any) {
      alert('অ্যাডমিন অ্যাকশনে ত্রুটি: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Simulated Email Receipt Sender
  const handleSendEmailReceipt = () => {
    if (!emailInput.includes('@')) {
      alert('সঠিক ইমেইল এড্রেস প্রদান করুন।');
      return;
    }
    setEmailSending(true);
    setTimeout(() => {
      setEmailSending(false);
      alert(`আপনার ডিজিটাল রসিদটি সফলতা ও স্বচ্ছতার সাথে ${emailInput} ঠিকানায় প্রেরণ করা হয়েছে।`);
    }, 1500);
  };



  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans relative">
      
      {/* Header Area */}
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/80 px-2 py-2 shrink-0 shadow-3xs overflow-x-auto no-scrollbar">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-1 min-w-max">
          {/* Back button */}
          <UnifiedBackButton 
            onClick={() => {
              if (showReceiptModal) { setShowReceiptModal(false); return; }
              if (showCertificate) { setShowCertificate(false); return; }
              if (showRepayModal) { setShowRepayModal(false); return; }
              if (showSectionTxHistory) { setShowSectionTxHistory(false); return; }
              if (activeTab !== 'landing') {
                setActiveTab('landing');
                return;
              }
              onBack();
            }}
            variant="dark"
            title="পিছনে যান"
          />

          {/* Item 1: Section Name (সেকশনের নাম: করযে হাসানা) */}
          <div className="leading-tight shrink-0 px-1">
            <div className="flex items-center gap-1">
              <h1 className="text-xs font-black text-rose-600 font-sans tracking-tight leading-none">
                করযে হাসানা
              </h1>
              <span className="text-[7.5px] font-sans font-black uppercase bg-rose-100 text-rose-700 border border-rose-200 px-1 py-0.5 rounded-full leading-none">
                সুদমুক্ত
              </span>
            </div>
            <p className="text-[7.5px] text-slate-400 font-sans font-bold leading-none mt-0.5">Welfare Fund</p>
          </div>

          {/* Item 2 & 3 Joined: Main Balance + Qard Hasana Fund (একসাথে লাগানো ব্যালেন্স বক্স) */}
          <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-xl px-2 py-1 shrink-0 divide-x divide-slate-200/90 gap-2">
            {/* Main Balance */}
            <div className="pr-1 text-left leading-none">
              <span className="text-[7px] font-extrabold text-emerald-700 uppercase block tracking-tighter">মেইন ব্যালেন্স</span>
              <span className="text-[10.5px] font-black text-emerald-950 font-sans block mt-0.5 whitespace-nowrap">৳ {(user.balance || 0).toLocaleString('bn-BD')}</span>
            </div>
            {/* Qard Hasana Fund (Main Fund Total / মোট করযে হাসানা তহবিল) */}
            <div className="pl-2 text-left leading-none">
              <span className="text-[7px] font-extrabold text-rose-700 uppercase block tracking-tighter">করযে হাসানা ফান্ড</span>
              <span className="text-[10.5px] font-black text-rose-950 font-sans block mt-0.5 whitespace-nowrap">৳ {(qardTotalFund || 0).toLocaleString('bn-BD')}</span>
            </div>
          </div>

          {/* Item 4: Transaction History (ছোট লেনদেন হিস্টোরি বাটন) */}
          <button 
            onClick={() => {
              fetchLedgers();
              setShowSectionTxHistory(true);
            }}
            className="p-1.5 px-2 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-700 rounded-xl transition active:scale-95 cursor-pointer flex items-center gap-1 shrink-0 shadow-3xs"
            title="করযে হাসানা লেনদেন হিস্টোরি"
          >
            <ClipboardList className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="text-[9px] text-rose-700 font-black whitespace-nowrap">লেনদেন</span>
          </button>
        </div>
      </header>

      {/* Main Tab Links completely removed per user request for a cleaner and non-cluttered design */}


      {/* Main Container */}
      <main className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-6 pb-24 h-full overflow-y-auto">
        
        {/* Alerts messages banner */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl mb-4 text-xs font-sans font-bold flex gap-3 items-start shadow-3xs">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p>{successMsg}</p>
            </div>
          </div>
        )}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl mb-4 text-xs font-sans font-bold flex gap-3 items-start shadow-3xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* ==================== LANDING HOME: BENTO SERVICE GRID ==================== */}
        {activeTab === 'landing' && (() => {

          const liveLoansList = qardHistory
            .filter(t => t.type === 'qard_loan_disbursment' && t.status === 'success')
            .map((t, idx) => {
              const repayments = qardHistory
                .filter(rp => rp.type === 'qard_loan_repayment' && rp.status === 'success' && rp.userId === t.userId);
              const totalRepaidAmount = repayments.reduce((sum, r) => sum + (r.amount || 0), 0);
              const loanAmt = Number(t.amount) || 0;
              const remaining = Math.max(0, loanAmt - totalRepaidAmount);
              const isComplete = remaining === 0;

              const uInfo = usersMap[t.userId] || (t.userPhone ? usersMap[t.userPhone] : null) || (t.memberId ? usersMap[t.memberId] : null);
              const memberName = uInfo?.name || t.userName || 'সম্মানিত সদস্য';
              const memberPhoto = uInfo?.photoURL || uInfo?.photo || t.userPhoto || t.photoURL || '';
              const initialLetter = (memberName || 'স').trim().charAt(0).toUpperCase();

              return {
                userId: t.userId,
                name: memberName,
                role: 'সদস্য',
                rawAmount: loanAmt,
                amount: loanAmt.toLocaleString('bn-BD'),
                installments: isComplete ? '3/3' : (t.loanDuration ? `1/${t.loanDuration}` : '1/3'),
                dueAmount: remaining.toLocaleString('bn-BD'),
                rawDueAmount: remaining,
                nextInstallment: t.loanDuration === 1 ? '30 দিন' : '25 জুন',
                isComplete,
                image: memberPhoto,
                initialLetter
              };
            });

          // বেশি টাকা থেকে কম টাকার দিকে সাজানো (Descending sort: Highest to Lowest)
          liveLoansList.sort((a, b) => b.rawAmount - a.rawAmount);
          // প্রথম 5 জনের তালিকা
          const displayLoans = liveLoansList.slice(0, 5);

          const liveDonationsList = qardHistory
            .filter(t => t.type === 'qard_donation' && t.status === 'success')
            .map((t, idx) => {
              const donateAmt = Number(t.amount) || 0;
              const uInfo = usersMap[t.userId] || (t.userPhone ? usersMap[t.userPhone] : null) || (t.memberId ? usersMap[t.memberId] : null);
              const memberName = uInfo?.name || t.userName || 'দানশীল সদস্য';
              const memberPhoto = uInfo?.photoURL || uInfo?.photo || t.userPhoto || t.photoURL || '';
              const initialLetter = (memberName || 'দ').trim().charAt(0).toUpperCase();

              return {
                userId: t.userId,
                name: memberName,
                relationship: 'সদস্য',
                rawAmount: donateAmt,
                amount: donateAmt.toLocaleString('bn-BD'),
                date: new Date(t.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }),
                type: 'donation',
                typeLabel: t.description?.includes('মাসিক') ? 'মাসিক অনুদান' : (t.description?.includes('আমানত') ? 'কল্যাণ আমানত' : 'স্বেচ্ছা অনুদান'),
                image: memberPhoto,
                initialLetter,
                bgColorClass: 'bg-emerald-600'
              };
            });

          // বেশি টাকা থেকে কম টাকার দিকে সাজানো (Descending sort: Highest to Lowest)
          liveDonationsList.sort((a, b) => b.rawAmount - a.rawAmount);
          // প্রথম 5 জনের তালিকা
          const displayDonors = liveDonationsList.slice(0, 5); 

          return (
            <div className="space-y-4 animate-fade-in text-left">
              
              {/* Ticker / Announcement (ঘোষণা) */}
              <div className="bg-rose-500/10 border border-rose-300/30 rounded-2.5xl p-2.5 flex items-center gap-2 text-rose-900 shadow-4xs select-none">
                <div className="text-[10px] font-extrabold bg-rose-500 text-white rounded-lg px-2 py-1 flex items-center gap-1 uppercase tracking-tight shrink-0 font-sans shadow-3xs">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>ঘোষণা</span>
                </div>
                <div className="flex-grow overflow-hidden relative mr-1.5">
                  <marquee className="text-[12px] font-bold text-slate-800 leading-none py-0.5" behavior="scroll" direction="left" scrollamount="4">
                    {appConfig?.qardTicker || "সুদমুক্ত করযে হাসানা কল্যাণ তহবিলে আপনাকে স্বাগতম। আপনার সামর্থ্য অনুযায়ী দান করে ফান্ড সমৃদ্ধ করুন অথবা প্রয়োজনের সময়ে সুদমুক্ত করযে স্বস্তির নিঃশ্বাস ফেলুন।"}
                  </marquee>
                </div>
              </div>

              {/* Premium Image Slider System */}
              <div className="relative overflow-hidden rounded-3.5xl border border-slate-150 shadow-md bg-slate-900 aspect-[16/9] w-full group">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentAdSlide}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 w-full h-full"
                  >
                    <img
                      src={adSlides[currentAdSlide].image}
                      alt={adSlides[currentAdSlide].title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-85"
                      loading="lazy"
                    />
                    {/* Text Overlay for Premium Feel */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-4 flex flex-col justify-end text-left">
                      <span className="text-[9px] font-extrabold text-[#F43F5E] uppercase tracking-widest bg-rose-950/80 max-w-max px-2 py-0.5 rounded-md mb-1.5 border border-rose-800/60">
                        {adSlides[currentAdSlide].tag}
                      </span>
                      <h3 className="text-sm font-black text-white leading-tight mb-1">
                        {adSlides[currentAdSlide].title}
                      </h3>
                      <p className="text-[10px] text-slate-300 font-semibold leading-snug">
                        {adSlides[currentAdSlide].description}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Slider Indicator Dots */}
                <div className="absolute top-3 right-4 flex gap-1.5 z-10">
                  {adSlides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentAdSlide(idx)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${currentAdSlide === idx ? 'w-4.5 bg-rose-500' : 'w-1.5 bg-white/40 hover:bg-white/65'}`}
                    />
                  ))}
                </div>
              </div>

              {/* 4 Premium Quick Info Counters Row (ফান্ডে জমা টাকা, ঋণ দেওয়া আছে, কে টাকা দিয়েছে, স্বর্ণ রেখে লোন) - 1 Line 4 Columns */}
              <div className="grid grid-cols-4 gap-1 sm:gap-2.5 my-2">
                {/* Card 1: ফান্ডে জমা টাকা */}
                <button 
                  type="button"
                  onClick={() => setShowDonorsModal(true)}
                  className="bg-[#FAFDFB] hover:bg-emerald-50 border border-emerald-100/80 rounded-2xl p-1.5 sm:p-2.5 text-center shadow-4xs flex flex-col items-center justify-between min-w-0 cursor-pointer transition active:scale-95 group"
                  title="ফান্ডের বর্তমান অবশিষ্ট ব্যালেন্স ও দাতা সদস্যদের তালিকা দেখতে ক্লিক করুন"
                >
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-emerald-100 group-hover:bg-emerald-200 text-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition mb-1">
                    <HeartHandshake className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  </div>
                  <div className="space-y-0.5 min-w-0 w-full">
                    <span className="text-[7.5px] sm:text-[9px] text-slate-400 group-hover:text-emerald-700 font-extrabold block truncate leading-none">ফান্ডে জমা টাকা</span>
                    <h3 className="text-[9.5px] sm:text-xs md:text-sm font-black text-emerald-700 group-hover:text-emerald-900 font-sans tracking-tight leading-none truncate my-0.5">৳ {qardAvailableFund?.toLocaleString('bn-BD')}</h3>
                    <span className="text-[6.5px] sm:text-[8px] text-emerald-600 font-extrabold block truncate leading-none flex items-center justify-center gap-0.5">অবশিষ্ট ফান্ড <ChevronRight className="w-2 h-2 inline" /></span>
                  </div>
                </button>

                {/* Card 2: ঋণ দেওয়া আছে */}
                <button 
                  type="button"
                  onClick={() => setShowBorrowersModal(true)}
                  className="bg-[#FFF9FB] hover:bg-rose-50 border border-rose-100/80 rounded-2xl p-1.5 sm:p-2.5 text-center shadow-4xs flex flex-col items-center justify-between min-w-0 cursor-pointer transition active:scale-95 group"
                  title="ঋণগ্রহীতা সকল সদস্যদের তালিকা ও কিস্তির হিসাব দেখতে ক্লিক করুন"
                >
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-rose-100 group-hover:bg-rose-200 text-rose-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition mb-1">
                    <Coins className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  </div>
                  <div className="space-y-0.5 min-w-0 w-full">
                    <span className="text-[7.5px] sm:text-[9px] text-slate-400 group-hover:text-rose-700 font-extrabold block truncate leading-none">ঋণ দেওয়া আছে</span>
                    <h3 className="text-[9.5px] sm:text-xs md:text-sm font-black text-rose-600 group-hover:text-rose-800 font-sans tracking-tight leading-none truncate my-0.5">৳ {qardActiveLoansAmount?.toLocaleString('bn-BD')}</h3>
                    <span className="text-[6.5px] sm:text-[8px] text-rose-600 font-extrabold block truncate leading-none flex items-center justify-center gap-0.5">মোট {beneficiaryCount} জনকে <ChevronRight className="w-2 h-2 inline" /></span>
                  </div>
                </button>

                {/* Card 3: ফান্ডে কে টাকা দিয়েছে */}
                <button 
                  type="button"
                  onClick={() => setShowDonorsModal(true)}
                  className="bg-[#FAFCFF] hover:bg-sky-50 border border-sky-100/80 rounded-2xl p-1.5 sm:p-2.5 text-center shadow-4xs flex flex-col items-center justify-between min-w-0 cursor-pointer transition active:scale-95 group"
                  title="ফান্ডে অনুদান প্রদানকারী সকল দাতা সদস্যদের তালিকা দেখতে ক্লিক করুন"
                >
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-sky-100 text-sky-650 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 mb-1">
                    <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  </div>
                  <div className="space-y-0.5 min-w-0 w-full">
                    <span className="text-[7.5px] sm:text-[9px] text-slate-400 font-extrabold block truncate leading-none">কে টাকা দিয়েছে</span>
                    <h3 className="text-[9.5px] sm:text-xs md:text-sm font-black text-sky-600 font-sans tracking-tight leading-none truncate my-0.5">{displayDonors.length.toLocaleString('bn-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} জন</h3>
                    <span className="text-[6.5px] sm:text-[8px] text-teal-600 font-extrabold block truncate leading-none">মোট দাতা সদস্য</span>
                  </div>
                </button>

                {/* Card 4: স্বর্ণ রেখে লোন */}
                <button 
                  type="button"
                  onClick={() => {
                    setActiveTab('gold_loan');
                    setGoldSuccessMsg('');
                    setGoldErrorMsg('');
                  }}
                  className="bg-gradient-to-br from-amber-50/90 to-yellow-50/70 hover:from-amber-100 hover:to-yellow-100 border border-amber-200/90 rounded-2xl p-1.5 sm:p-2.5 text-center shadow-4xs flex flex-col items-center justify-between min-w-0 cursor-pointer transition active:scale-95 group relative overflow-hidden"
                  title="স্বর্ণ রেখে জরুরি লোন ও 0% সুদে ক্যাশ সুবিধা দেখতে ক্লিক করুন"
                >
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-500 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition mb-1">
                    <Gem className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="space-y-0.5 min-w-0 w-full">
                    <span className="text-[7.5px] sm:text-[9px] text-amber-800 font-extrabold block truncate leading-none">স্বর্ণ রেখে লোন</span>
                    <h3 className="text-[9.5px] sm:text-xs md:text-sm font-black text-amber-950 font-sans tracking-tight leading-none truncate my-0.5">দরকার টাকা</h3>
                    <span className="text-[6.5px] sm:text-[8px] text-amber-700 font-extrabold block truncate leading-none flex items-center justify-center gap-0.5">100% বাজারদর <ChevronRight className="w-2 h-2 inline" /></span>
                  </div>
                </button>
              </div>

              {/* Active Loan Repayment Component if user has active due loan */}
              {renderActiveLoanRepaymentCard()}

              {/* 4 Action Buttons Grid inside standard Box - Single Horizontal Row (1 Line) */}
              <div className="bg-white border border-slate-100 rounded-3xl p-2 sm:p-4 shadow-xs grid grid-cols-4 gap-1 sm:gap-2.5 text-center my-3 relative overflow-hidden">
                {/* Btn 1: টাকা জমা ও দান */}
                <button 
                  onClick={() => setActiveTab('donate')}
                  className="flex flex-col items-center justify-center p-1 sm:p-2 rounded-2xl hover:bg-rose-50/50 focus:outline-none group active:scale-95 transition-all duration-150 cursor-pointer text-center border border-transparent hover:border-rose-100"
                >
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-200 transition-all duration-200 mb-1">
                    <Heart className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <span className="text-[9.5px] sm:text-[11px] font-black text-slate-800 leading-tight block whitespace-nowrap">টাকা জমা ও দান</span>
                  <span className="text-[7.5px] sm:text-[8.5px] text-slate-400 font-extrabold block leading-none font-sans mt-0.5 whitespace-nowrap">আমানত বা অনুদান</span>
                </button>

                {/* Btn 2: টাকা নিতে আবেদন */}
                <button 
                  onClick={() => setActiveTab('apply')}
                  className="flex flex-col items-center justify-center p-1 sm:p-2 rounded-2xl hover:bg-emerald-50/50 focus:outline-none group active:scale-95 transition-all duration-150 cursor-pointer text-center border border-transparent hover:border-emerald-100"
                >
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 transition-all duration-200 mb-1">
                    <Coins className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 text-white" />
                  </div>
                  <span className="text-[9.5px] sm:text-[11px] font-black text-slate-800 leading-tight block whitespace-nowrap">টাকা নিতে আবেদন</span>
                  <span className="text-[7.5px] sm:text-[8.5px] text-slate-400 font-extrabold block leading-none mt-0.5 whitespace-nowrap">সুদ মুক্ত ঋণ নিন</span>
                </button>

                {/* Btn 3: টাকা পরিশোধ (1 দিন / 1 সপ্তাহ বা অগ্রিম) */}
                <button 
                  onClick={() => setShowRepayModal(true)}
                  className="flex flex-col items-center justify-center p-1 sm:p-2 rounded-2xl bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/90 focus:outline-none group active:scale-95 transition-all duration-150 cursor-pointer text-center relative"
                >
                  
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-200 transition-all duration-200 mb-1">
                    <Zap className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 text-white" />
                  </div>
                  <span className="text-[9.5px] sm:text-[11px] font-black text-amber-950 leading-tight block whitespace-nowrap">টাকা পরিশোধ</span>
                  <span className="text-[7.5px] sm:text-[8.5px] text-amber-700 font-extrabold block leading-none mt-0.5 whitespace-nowrap">1 দিন/1 সপ্তাহ অগ্রিম</span>
                </button>

                {/* Btn 4: আমার আবেদন */}
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className="flex flex-col items-center justify-center p-1 sm:p-2 rounded-2xl hover:bg-blue-50/50 focus:outline-none group active:scale-95 transition-all duration-150 cursor-pointer text-center border border-transparent hover:border-blue-100"
                >
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 transition-all duration-200 mb-1">
                    <FileText className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 text-white" />
                  </div>
                  <span className="text-[9.5px] sm:text-[11px] font-black text-slate-800 leading-tight block whitespace-nowrap">আমার আবেদন</span>
                  <span className="text-[7.5px] sm:text-[8.5px] text-slate-400 font-extrabold block leading-none font-sans mt-0.5 whitespace-nowrap">আবেদন তালিকা</span>
                </button>
              </div>

              {/* Silent administrative button helper if user is admin */}
              {user.role === 'admin' && (
                <div 
                  onClick={() => setActiveTab('admin')}
                  className="bg-purple-50 hover:bg-purple-100 border border-purple-200/60 rounded-2xl p-2.5 flex items-center justify-between text-purple-900 cursor-pointer transition active:scale-95"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse" />
                    <span className="text-[11px] font-black">⚙️ আপনি একজন অ্যাডমিন। যাচাইকরণ ও কাজের জন্য অ্যাডমিন মডিউল খুলুন</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-purple-400" />
                </div>
              )}

              {/* Progress Bar Card */}
              <div className="bg-white border border-slate-100 rounded-3xl p-3.5 shadow-xs flex items-center justify-between gap-3 my-3">
                {/* Left Info: Icon & name */}
                <div className="flex items-center gap-2 text-left shrink-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-slate-800">ফান্ডের অবস্থা</span>
                </div>

                {/* Middle: Progress bars */}
                {(() => {
                  const activeLoansPct = qardTotalFund > 0 ? Math.min(100, Math.round((qardActiveLoansAmount / qardTotalFund) * 100)) : 0;
                  const remainingPct = Math.max(0, 100 - activeLoansPct);
                  return (
                    <div className="flex-grow px-2 flex flex-col space-y-1 text-left">
                      <div className="flex justify-between items-center text-[10px] font-extrabold">
                        <span className="text-rose-700">ব্যবহার হয়েছে <strong className="text-xs font-mono font-black">{activeLoansPct}%</strong></span>
                        <span className="text-emerald-700">বাকি আছে <strong className="text-xs font-mono font-black">{remainingPct}%</strong></span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-150">
                        <div className="h-full bg-rose-500 transition-all duration-550" style={{ width: `${activeLoansPct}%` }} />
                        <div className="h-full bg-emerald-500" style={{ width: `${remainingPct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Right: details button */}
                <button 
                  onClick={() => setActiveTab('transparency')}
                  className="py-1.5 px-3.5 bg-[#0D9488] hover:bg-[#0B7A70] text-white text-[10px] font-black rounded-xl transition duration-150 shrink-0 cursor-pointer text-center flex items-center gap-1 shadow-sm"
                >
                  বিস্তারিত <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* LIST 1: কে কত নিয়েছে */}
              <div className="space-y-2.5 my-3">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs font-black text-emerald-800 font-sans border-l-4 border-emerald-500 pl-2">কে কত নিয়েছে</h3>
                  <span 
                    onClick={() => setShowBorrowersModal(true)}
                    className="text-[10.5px] font-black text-[#0D9488] hover:underline cursor-pointer flex items-center gap-0.5 shrink-0"
                  >
                    সব দেখুন <ChevronRight className="w-3.5 h-3.5 inline" />
                  </span>
                </div>

                <div className="space-y-2 col-span-full">
                  {displayLoans.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-white border border-slate-100/80 rounded-2.5xl text-xs font-bold shadow-4xs select-none">
                      কোনো ঋণগ্রহীতা পাওয়া যায়নি। মেম্বারদের ঋণ অনুমোদন হয়ে রিয়েল টাইম ডেটা আসলে এখানে দেখাবে।
                    </div>
                  ) : (
                    <>
                      {displayLoans.map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setActiveTab('transparency')}
                          className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2.5xl hover:bg-slate-50 transition duration-150 shadow-3xs gap-2 cursor-pointer"
                        >
                          {/* Avatar & relationship details */}
                          <div className="flex items-center gap-2.5 w-[27%] min-w-0">
                            {item.image ? (
                              <img 
                                src={item.image} 
                                alt={item.name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shrink-0 shadow-3xs" 
                                referrerPolicy="no-referrer" 
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                  const fallback = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div 
                              className={`w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-sm shrink-0 border-2 border-emerald-400 shadow-3xs ${item.image ? 'hidden' : 'flex'}`}
                            >
                              {item.initialLetter || (item.name ? item.name.trim().charAt(0).toUpperCase() : 'স')}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-slate-800 truncate leading-tight mt-0.5">{item.name}</h4>
                              <span className="text-[9px] text-[#22C55E] bg-[#E6F4EA] px-1.5 py-0.5 rounded-md font-bold inline-block mt-0.5 truncate max-w-full scale-90 origin-left">{item.role}</span>
                            </div>
                          </div>

                          {/* নেয়া টাকা */}
                          <div className="w-[18%] text-left">
                            <span className="text-[8px] text-slate-400 block font-black leading-none">নেয়া টাকা</span>
                            <span className="text-xs font-black text-slate-800 font-sans mt-1.5 block">৳ {item.amount}</span>
                          </div>

                          {/* কিস্তি */}
                          <div className="w-[12%] text-center">
                            <span className="text-[8px] text-slate-400 block font-black leading-none mb-1">কিস্তি</span>
                            <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full inline-block leading-none ${item.isComplete ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono'}`}>
                              {item.installments}
                            </span>
                          </div>

                          {/* পরিশোধ বাকি */}
                          <div className="w-[18%] text-left">
                            <span className="text-[8px] text-slate-400 block font-black leading-none">পরিশোধ বাকি</span>
                            <span className={`text-xs font-black font-sans mt-1.5 block ${item.isComplete ? 'text-[#137333]' : 'text-rose-600'}`}>
                              ৳ {item.dueAmount}
                            </span>
                          </div>

                          {/* পরবর্তী কিস্তি / সম্পন্ন status */}
                          <div className="w-[20%] text-left flex flex-col justify-center">
                            <span className="text-[8px] text-slate-400 block font-black leading-none mb-1">পরবর্তী কিস্তি</span>
                            {item.isComplete ? (
                              <span className="text-[9px] font-black text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200 self-start">
                                ✓ সম্পন্ন
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-extrabold text-slate-600 flex items-center gap-1 leading-normal">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {item.nextInstallment}
                              </span>
                            )}
                          </div>

                          {/* Arrow icon */}
                          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </div>
                      ))}

                      {/* আরো দেখুন বাটন (কে কত নিয়েছে) */}
                      {liveLoansList.length > 5 ? (
                        <button
                          type="button"
                          onClick={() => setShowBorrowersModal(true)}
                          className="w-full py-2.5 px-4 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-800 border border-emerald-200/90 rounded-2xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs active:scale-98 mt-1"
                        >
                          <span>আরো দেখুন (মোট {liveLoansList.length.toLocaleString('bn-BD')} জন ঋণগ্রহীতা সদস্য)</span>
                          <ChevronRight className="w-4 h-4 text-emerald-700" />
                        </button>
                      ) : (
                        liveLoansList.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowBorrowersModal(true)}
                            className="w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-2xl text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer shadow-4xs active:scale-98 mt-1"
                          >
                            <span>আরো দেখুন (সকল ঋণগ্রহীতা ও কিস্তি খতিয়ান)</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* LIST 2: কে ফান্ডে টাকা দিয়েছে */}
              <div className="space-y-2.5 my-3">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs font-black text-sky-850 font-sans border-l-4 border-sky-500 pl-2">কে ফান্ডে টাকা দিয়েছে</h3>
                  <span 
                    onClick={() => setShowDonorsModal(true)}
                    className="text-[10.5px] font-black text-[#0D9488] hover:underline cursor-pointer flex items-center gap-0.5 shrink-0"
                  >
                    সব দেখুন <ChevronRight className="w-3.5 h-3.5 inline" />
                  </span>
                </div>

                <div className="space-y-2 col-span-full">
                  {displayDonors.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-white border border-slate-100/80 rounded-2.5xl text-xs font-bold shadow-4xs select-none">
                      কোনো তহবিল অনুদান রেকর্ড পাওয়া যায়নি। অনুদান প্রদান করা হলে এখানে স্বয়ংক্রিয়ভাবে দেখাবে।
                    </div>
                  ) : (
                    <>
                      {displayDonors.map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setActiveTab('transparency')}
                          className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2.5xl hover:bg-slate-50 transition duration-150 shadow-3xs gap-2 cursor-pointer"
                        >
                          {/* Avatar Initials & relationship */}
                          <div className="flex items-center gap-2.5 w-[28%] min-w-0">
                            {item.image ? (
                              <img 
                                src={item.image} 
                                alt={item.name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shrink-0 shadow-3xs" 
                                referrerPolicy="no-referrer" 
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                  const fallback = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 shadow-3xs ${item.bgColorClass || 'bg-[#7D5BE2]'} ${item.image ? 'hidden' : 'flex'}`}>
                              {item.initialLetter || (item.name ? item.name.trim().charAt(0).toUpperCase() : 'দ')}
                            </div>
                            <div className="min-w-0 mt-0.5">
                              <h4 className="text-xs font-black text-slate-800 truncate leading-tight">{item.name}</h4>
                              <span className="text-[8.5px] text-slate-450 font-extrabold block mt-0.5 truncate">{item.relationship}</span>
                            </div>
                          </div>

                          {/* দেওয়া টাকা */}
                          <div className="w-[18%] text-left">
                            <span className="text-[8px] text-slate-400 block font-black leading-none">দেওয়া টাকা</span>
                            <span className="text-xs font-black text-[#137333] font-sans mt-1.5 block">৳ {item.amount}</span>
                          </div>

                          {/* তারিখ */}
                          <div className="w-[28%] text-left">
                            <span className="text-[8px] text-slate-400 block font-black leading-none mb-1">তারিখ</span>
                            <span className="text-[9.5px] font-extrabold text-slate-600 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {item.date}
                            </span>
                          </div>

                          {/* ধরন */}
                          <div className="w-[18%] text-left">
                            <span className="text-[8px] text-slate-400 block font-black leading-none mb-1">ধরন</span>
                            <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full inline-block leading-none ${item.type === 'donation' ? 'bg-[#EBF5FF] text-blue-700 border border-blue-150' : 'bg-[#E6F4EA] text-[#137333] border border-emerald-100'}`}>
                              {item.typeLabel}
                            </span>
                          </div>

                          {/* Arrow Icon */}
                          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </div>
                      ))}

                      {/* আরো দেখুন বাটন (কে ফান্ডে টাকা দিয়েছে) */}
                      {liveDonationsList.length > 5 ? (
                        <button
                          type="button"
                          onClick={() => setShowDonorsModal(true)}
                          className="w-full py-2.5 px-4 bg-sky-50/90 hover:bg-sky-100/90 text-sky-800 border border-sky-200/90 rounded-2xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs active:scale-98 mt-1"
                        >
                          <span>আরো দেখুন (মোট {liveDonationsList.length.toLocaleString('bn-BD')} জন দাতা সদস্য)</span>
                          <ChevronRight className="w-4 h-4 text-sky-700" />
                        </button>
                      ) : (
                        liveDonationsList.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowDonorsModal(true)}
                            className="w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-2xl text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer shadow-4xs active:scale-98 mt-1"
                          >
                            <span>আরো দেখুন (সকল দাতা ও কল্যাণ অনুদান খতিয়ান)</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ==================== TAB 1: DONATE FORM (Compact Sleek Form) ==================== */}
        {activeTab === 'donate' && (
          <div className="space-y-2 max-w-lg mx-auto animate-fade-in text-center">
            {/* Short compact header info */}
            <div className="bg-gradient-to-r from-rose-50/80 via-amber-50/60 to-rose-50/80 border border-rose-150/80 p-2 sm:p-2.5 rounded-xl flex items-center gap-2 text-left shadow-2xs">
              <span className="p-1.5 bg-rose-500 text-white rounded-lg text-xs shrink-0 shadow-xs">💝</span>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11px] font-black text-rose-955 leading-tight truncate">কল্যাণ তহবিলে অনুদান ও স্থায়ী আমানত</h4>
                <p className="text-[8px] text-slate-500 font-bold leading-tight mt-0.5">সম্পূর্ণ সুদমুক্ত সেবামূলক কাজে ব্যবহৃত হবে। 1 বছর পর চাইলে উত্তোলনযোগ্য।</p>
              </div>
            </div>

            <form onSubmit={handleDonateSubmit} className="space-y-2 font-sans">
              
              {/* Step 1: Donation Purpose Selection */}
              <div className="bg-white border border-slate-200/90 p-2 sm:p-2.5 rounded-xl space-y-1.5 shadow-2xs text-left">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-1">
                    <span className="p-0.5 bg-rose-50 rounded-md text-rose-700 shrink-0">
                      <HeartHandshake className="w-3 h-3" />
                    </span>
                    <span className="text-[9.5px] font-black text-slate-800">1. দানের উদ্দেশ্য বা খাত বেছে নিনঃ</span>
                  </div>
                  {donationPurpose && (
                    <span className="text-[7.5px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                      ✓ খাত নির্বাচিত
                    </span>
                  )}
                </div>

                {(() => {
                  const purposes = [
                    { id: 'general', emoji: '🤝', title: 'সাধারণ করযে হাসানা ফান্ড', desc: 'অসহায়দের বিনা সুদে ঋণ বিতরণের জন্য', tag: 'GENERAL', color: 'emerald' },
                    { id: 'medical', emoji: '🩺', title: 'চিকিৎসা সহায়তা খাতের দান', desc: 'মুমূর্ষু ও অসহায় রোগীদের জরুরি ওষুধ ক্রয়ে', tag: 'MEDICINE', color: 'rose' },
                    { id: 'education', emoji: '🎓', title: 'দরিদ্র শিক্ষার্থীদের শিক্ষা', desc: 'শিক্ষা উপকরণ ও মেধা বিকাশের তহবিলে', tag: 'EDUCATION', color: 'indigo' },
                    { id: 'micro', emoji: '🚜', title: 'ক্ষুদ্র স্বনির্ভর ব্যবসা', desc: 'স্বাবলম্বী হতে ভ্যান/সেলাই মেশিন অনুদান', tag: 'MICRO BIZ', color: 'teal' },
                    { id: 'emergency', emoji: '🚨', title: 'জরুরি মানবিক ও ত্রাণ সহায়তা', desc: 'বন্যা, দুর্যোগ বা আকস্মিক বিপর্যয়ে পাশে দাঁড়াতে', tag: 'EMERGENCY', color: 'amber' }
                  ];
                  const selectedItem = purposes.find(p => p.id === donationPurpose);

                  return (
                    <div className="space-y-1">
                      {!selectedItem ? (
                        <div 
                          onClick={() => setIsPurposeMenuOpen(!isPurposeMenuOpen)}
                          className="flex items-center justify-between p-2 bg-rose-50/40 hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer transition active:scale-[0.99] select-none"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs p-1 bg-white border border-rose-200 rounded-md shrink-0">💝</span>
                            <div className="text-left">
                              <span className="text-[10px] font-black text-rose-955 block">উদ্দেশ্য বা খাত বেছে নিতে এখানে ক্লিক করুন</span>
                            </div>
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 text-rose-500 shrink-0 transition-transform duration-200 ${isPurposeMenuOpen ? 'rotate-180' : ''}`} />
                        </div>
                      ) : (
                        <div 
                          onClick={() => setIsPurposeMenuOpen(!isPurposeMenuOpen)}
                          className="flex items-center justify-between p-1.5 bg-rose-50/50 hover:bg-rose-50 border border-rose-250 rounded-lg cursor-pointer transition active:scale-[0.99] select-none"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs p-1 bg-white border border-rose-200 rounded-md shrink-0">
                              {selectedItem.emoji}
                            </span>
                            <div className="text-left min-w-0">
                              <span className="text-[10px] font-black text-rose-955 block leading-tight truncate">{selectedItem.title}</span>
                              <span className="text-[7.5px] block text-slate-500 font-bold leading-tight mt-0.5 truncate">{selectedItem.desc}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-1.5">
                            <span className="text-[7.5px] font-black text-rose-700 bg-white border border-rose-200 px-1.5 py-0.2 rounded-md">পরিবর্তন</span>
                            <ChevronDown className={`w-3 h-3 text-rose-600 shrink-0 transition-transform duration-200 ${isPurposeMenuOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      )}

                      <AnimatePresence>
                        {isPurposeMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 bg-white shadow-xs mt-1">
                              {purposes.map((p, idx) => (
                                <button
                                  type="button"
                                  key={`${p.id}-${idx}`}
                                  onClick={() => {
                                    setDonationPurpose(p.id);
                                    setIsPurposeMenuOpen(false);
                                  }}
                                  className={`w-full p-1.5 text-left flex items-center justify-between gap-1.5 transition-all cursor-pointer active:bg-slate-100 select-none ${
                                    donationPurpose === p.id 
                                      ? 'bg-rose-50 text-rose-955 font-black' 
                                      : 'bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs p-1 bg-slate-50 border border-slate-150 rounded-md shrink-0">
                                      {p.emoji}
                                    </span>
                                    <div className="min-w-0">
                                      <span className="text-[9.5px] font-black block leading-tight truncate">{p.title}</span>
                                      <span className="text-[7.5px] block text-slate-450 font-semibold leading-tight truncate mt-0.5">{p.desc}</span>
                                    </div>
                                  </div>
                                  <div className="shrink-0 flex items-center justify-center">
                                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                                      donationPurpose === p.id 
                                        ? 'bg-rose-600 border-rose-600 text-white' 
                                        : 'border-slate-300 bg-white'
                                    }`}>
                                      {donationPurpose === p.id && (
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      )}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })()}
              </div>

              {/* Step 2: Donation Amount selection */}
              <div className="bg-white border border-slate-200/90 p-2 sm:p-2.5 rounded-xl space-y-1.5 shadow-2xs text-left">
                <div className="flex items-center gap-1 pb-1 border-b border-slate-100">
                  <span className="p-0.5 bg-rose-50 rounded-md text-rose-700 shrink-0">
                    <Coins className="w-3 h-3" />
                  </span>
                  <span className="text-[9.5px] font-black text-slate-800">2. জমা বা অনুদানের পরিমাণ (টাকা):</span>
                </div>

                <div className="space-y-1.5">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-2.5 flex items-center text-rose-600 font-black text-xs pointer-events-none">
                      ৳
                    </div>
                    <input
                      type="number"
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                      placeholder={donationPurpose ? "কত টাকা দান করতে চান লিখুন..." : "প্রথমে খাতের তালিকায় ট্যাপ করে বেছে নিন..."}
                      className="w-full bg-slate-50 border border-slate-250 rounded-lg py-1.5 pl-6 pr-2.5 text-xs font-black font-mono focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-slate-850"
                      required
                    />
                  </div>

                  {/* Quick Preset Buttons: 5, 10, 20, 50, 100 */}
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { val: '5', label: '5 ৳' },
                      { val: '10', label: '10 ৳' },
                      { val: '20', label: '20 ৳' },
                      { val: '50', label: '50 ৳' },
                      { val: '100', label: '100 ৳' }
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.val}
                        onClick={() => setDonationAmount(item.val)}
                        className={`py-1 rounded-md text-[10px] font-black transition cursor-pointer active:scale-95 text-center ${
                          donationAmount === item.val
                            ? 'bg-rose-600 border border-rose-600 text-white shadow-xs'
                            : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-rose-50/50 hover:border-rose-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 3: Privacy & Security PIN Confirmation */}
              <div className="bg-white border border-slate-200/90 p-2 sm:p-2.5 rounded-xl space-y-1.5 shadow-2xs text-left">
                <div className="flex items-center gap-1 pb-1 border-b border-slate-100">
                  <span className="p-0.5 bg-rose-50 rounded-md text-rose-700 shrink-0">
                    <Lock className="w-3 h-3" />
                  </span>
                  <span className="text-[9.5px] font-black text-slate-800">3. সুরক্ষা ও অন্যান্য সেটিংসঃ</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {/* Anonymous Donation Option */}
                  <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-1 text-left min-w-0">
                      <EyeOff className="w-3 h-3 text-rose-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[9px] text-slate-850 font-black block leading-none">গোপন দাতা</span>
                        <span className="text-[7px] text-slate-450 block leading-none font-bold mt-0.5 truncate">
                          নাম গোপন থাকবে
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 ml-1">
                      <input 
                        type="checkbox" 
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-6 h-3.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1.5px] after:left-[1.5px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>

                  {/* Security PIN input */}
                  <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg flex items-center justify-between gap-1">
                    <div className="text-left min-w-0">
                      <span className="text-[9px] text-slate-850 font-black block leading-none">সিকিউরিটি পিন *</span>
                      <span className="text-[7px] text-slate-450 block leading-none font-bold mt-0.5">
                        4-সংখ্যার পিন
                      </span>
                    </div>
                    <input
                      type="password"
                      maxLength={4}
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-11 bg-white border border-slate-300 rounded-md px-1 py-0.5 text-center font-mono text-xs tracking-widest text-slate-800 font-black focus:outline-none focus:border-rose-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-0.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {loading ? 'প্রসেসিং হচ্ছে...' : 'স্বেচ্ছাদান সুনিশ্চিত করুন'}
                  <Heart className="w-3.5 h-3.5 fill-current animate-pulse text-white" />
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'transparency' && (
          <div className="space-y-4 text-left animate-fade-in">
            {/* Rule & Regulation Policy Banner */}
            <div className="bg-gradient-to-r from-rose-50 via-amber-50/60 to-purple-50 border border-rose-200/90 p-4 rounded-3xl text-left space-y-2 shadow-3xs">
              <div className="flex items-center gap-2 text-rose-850 font-black text-xs">
                <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs">
                  ⚖️
                </div>
                <span>করযে হাসানা ঋণ পরিশোধ ও অটোমেটিক জরিমানা নীতিমালা</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] font-bold text-slate-700 pt-1">
                <div className="bg-white/80 p-2.5 rounded-2xl border border-rose-100/80 space-y-0.5">
                  <span className="text-rose-700 font-extrabold block">📅 পরিশোধের সময়সীমাঃ</span>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    যেই তারিখে ঋণ নেওয়া হবে, ঠিক পরের মাসে সেই একই তারিখের পূর্বে (৩০ দিনের মধ্যে) পরিশোধ করতে হবে।
                  </p>
                </div>
                <div className="bg-white/80 p-2.5 rounded-2xl border border-rose-100/80 space-y-0.5">
                  <span className="text-rose-700 font-extrabold block">⚡ অটোমেটিক বিলম্ব জরিমানাঃ</span>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    ৩০ দিনের বেশি হয়ে গেলে ৩১তম দিন থেকে প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা হারে বিলম্ব জরিমানা মেইন ব্যালেন্স থেকে অটোমেটিক কর্তন করা হবে।
                  </p>
                </div>
              </div>
            </div>

            {/* Public Ledger Log and Audit trail for Transparency */}
            <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-4 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <h4 className="text-sm font-black text-slate-850 flex items-center gap-1.5">
                  <Users className="w-4.5 h-4.5 text-[#7D5BE2]" />
                  সুদমুক্ত করযে হাসানা লেজার খাতা (Ledger List)
                </h4>
                <span className="text-[10px] bg-purple-50 text-purple-700 font-extrabold px-2.5 py-0.5 rounded border border-purple-100 uppercase tracking-wide">
                  100% স্বচ্ছতা
                </span>
              </div>
              
              <p className="text-[10.5px] text-slate-500 font-bold leading-normal">
                করযে হাসানা কল্যাণ ফান্ডের আওতায় এযাবৎ সংঘটিত সকল অনুদান, ঋণের অনুমোদন এবং পরিশোধ বিবরণী নিচে তালিকাভুক্ত করা হয়েছেঃ
              </p>

              {qardHistory.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-6 text-center">কোনো ঐতিহাসিক করযে হাসানা রেকর্ড পাওয়া যায়নি।</p>
              ) : (
                <div className="border border-slate-150 rounded-2xl divide-y divide-slate-100 max-h-[500px] overflow-y-auto bg-slate-50/20 text-xs">
                  {qardHistory.map((tx, idx) => {
                    const isDonation = tx.type === 'qard_donation';
                    const isRepayment = tx.type === 'qard_loan_repayment';
                    const isDisbursment = tx.type === 'qard_loan_disbursment';
                    const isRequest = tx.type === 'qard_loan_request';
                    const isFine = tx.type === 'qard_fine';

                    // Calculate repayment date details for disbursement
                    let scheduleInfo = null;
                    if (isDisbursment && tx.createdAt) {
                      const takenDate = new Date(tx.createdAt);
                      const dayOfMonth = takenDate.getDate();
                      const dueDate = new Date(takenDate);
                      dueDate.setDate(dueDate.getDate() + 30);
                      const today = new Date();
                      const daysElapsed = Math.floor((today.getTime() - takenDate.getTime()) / (1000 * 60 * 60 * 24));
                      const isOverdue = daysElapsed > 30;
                      const overdueDays = isOverdue ? daysElapsed - 30 : 0;
                      const daysLeft = isOverdue ? 0 : Math.max(0, 30 - daysElapsed);

                      scheduleInfo = {
                        dayOfMonth,
                        dueDateStr: dueDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }),
                        isOverdue,
                        overdueDays,
                        daysLeft
                      };
                    }

                    return (
                      <div key={`${tx.id || "tx"}-${idx}`} className="p-3.5 flex justify-between items-start text-left font-sans hover:bg-slate-50 transition">
                        <div className="space-y-1">
                          <p className="font-extrabold text-slate-800 text-[11.5px]">
                            {isDonation && '❤️ ফান্ডের অনুদান'}
                            {isRequest && '⏳ ঋণের আবেদন'}
                            {isDisbursment && '💸 ঋণ বিতরণ লাভ'}
                            {isRepayment && '✅ ঋণ পরিশোধ সম্পন্ন'}
                            {isFine && '⚠️ বিলম্ব জরিমানা কর্তন'}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400 font-bold">
                            <span>সদস্যঃ {tx.userName}</span>
                            <span>•</span>
                            <span>{new Date(tx.createdAt).toLocaleDateString('bn-BD')}</span>
                          </div>
                          {scheduleInfo && (
                            <div className="text-[8.5px] font-sans font-bold pt-0.5 space-y-0.5">
                              <span className="text-slate-500 block">
                                📅 পরিশোধের শেষ সময়ঃ <strong className="text-slate-700">{scheduleInfo.dueDateStr} ({scheduleInfo.dayOfMonth}ই তারিখ)</strong>
                              </span>
                              <div>
                                {scheduleInfo.isOverdue ? (
                                  <span className="text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded text-[8px] font-black">
                                    ⚠️ ৩০ দিন পার ({scheduleInfo.overdueDays} দিন ওভারডিউ - অটো জরিমানা সক্রিয়)
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[8px] font-black">
                                    ⏳ আর {scheduleInfo.daysLeft} দিন বাকি
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-right space-y-1 font-mono">
                          <span className={"font-black text-[11.5px] block " + ((isDonation || isRepayment) ? 'text-emerald-600' : 'text-rose-600')}>
                            {isDonation || isRepayment ? '+' : '-'}৳ {tx.amount?.toLocaleString('bn-BD')}
                          </span>
                          <div className="text-[8.5px] text-slate-450 font-sans tracking-wide">
                            {tx.status === 'success' ? (
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md font-sans font-bold">অনুমোদিত</span>
                            ) : tx.status === 'pending' ? (
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md font-sans font-bold">রিভিউ পেন্ডিং</span>
                            ) : (
                              <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md font-sans font-bold">বাতিল</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: MY DASHBOARD ==================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 text-left animate-fade-in">
            {/* My Loan Applications Status Tracker with Admin Notification support */}
            <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-3 shadow-3xs">
              <h4 className="text-xs font-black text-slate-850 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-rose-600" />
                আমার সুদমুক্ত ঋণ আবেদন সমূহ ও স্ট্যাটাসঃ
              </h4>
              
              {(() => {
                const myRequests = qardHistory.filter(
                  t => t.userId === user.uid && (t.type === 'qard_loan_request' || t.type === 'qard_loan_disbursment' || (t.type === 'qard_loan_request' && t.status === 'failed'))
                );

                if (myRequests.length === 0) {
                  return (
                    <div className="py-4 text-center">
                      <p className="text-[10px] text-slate-450 italic">আপনার কোনো সুদমুক্ত ঋণ আবেদন পাওয়া যায়নি।</p>
                      <button
                        onClick={() => setActiveTab('apply')}
                        className="mt-2.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-xl transition cursor-pointer"
                      >
                        ঋণ আবেদন করুন
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {myRequests.map((tx, idx) => {
                      const isPending = tx.status === 'pending';
                      const isApproved = tx.type === 'qard_loan_disbursment' || tx.status === 'success';
                      const isFailed = tx.status === 'failed';

                      return (
                        <div key={`${tx.id}-${idx}`} className="bg-slate-50/50 border border-slate-150 rounded-2xl p-3.5 space-y-2.5 text-left font-sans">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-[8.5px] font-mono text-slate-450 font-bold block">আইডিঃ #{tx.id?.slice(-6).toUpperCase() || 'REQUEST'}</span>
                              <strong className="text-xs font-extrabold text-slate-800">৳ {tx.amount?.toLocaleString('bn-BD')} BDT ঋণ আবেদন</strong>
                            </div>
                            <div>
                              {isPending && (
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-black rounded-lg">
                                  ⏳ রিভিউ পেন্ডিং
                                </span>
                              )}
                              {isApproved && (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-black rounded-lg">
                                  ✅ অনুমোদিত
                                </span>
                              )}
                              {isFailed && (
                                <span className="px-2.5 py-1 bg-rose-50 text-rose-850 border border-rose-200 text-[9px] font-black rounded-lg">
                                  ❌ বাতিলকৃত
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 p-2.5 bg-white rounded-xl text-[10px] font-bold text-slate-550 border border-slate-100">
                            <div>
                              <span className="text-slate-400 block text-[7.5px] uppercase">আবেদনের তারিখঃ</span>
                              <span className="text-slate-700">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('bn-BD') : 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[7.5px] uppercase">পরিশোধের মেয়াদঃ</span>
                              <span className="text-slate-700">{tx.loanDuration || 1} মাস</span>
                            </div>
                            <div className="col-span-2 border-t border-slate-50 pt-1.5 mt-0.5">
                              <span className="text-slate-400 block text-[7.5px] uppercase">উদ্দেশ্যঃ</span>
                              <span className="text-slate-700 block mt-0.5 leading-normal">{tx.description?.replace('সুদমুক্ত ঋণ আবেদন: ', '') || 'ব্যক্তিগত জরুরি প্রয়োজন'}</span>
                            </div>
                          </div>

                          {/* Rejection reason / Notice from admin block */}
                          {(isFailed || tx.adminNotice || tx.rejectReason || tx.adminNote) && (
                            <div className={`p-2.5 rounded-xl border text-[10px] font-bold leading-relaxed ${isFailed ? 'bg-rose-50 border-rose-100 text-rose-950' : 'bg-blue-50 border-blue-100 text-blue-950'}`}>
                              <h6 className="font-extrabold text-[10.5px] mb-1 flex items-center gap-1">
                                {isFailed ? '📢 বাতিল হওয়ার কারণ / এডমিন নোটিশঃ' : '📢 এডমিন পর্যালোচনা নোটিশঃ'}
                              </h6>
                              <p className="font-sans">
                                {tx.rejectReason || tx.adminNote || tx.adminNotice || (isFailed ? 'প্রদত্ত তথ্যের অমিল অথবা অপর্যাপ্ত ফান্ড লিমিটের কারণে আপনার ঋণ আবেদনটি বাতিল করা হয়েছে। দয়া করে সঠিক তথ্যাদি দিয়ে পুনরায় চেষ্টা করুন।' : 'আপনার আবেদনটি বর্তমানে এডমিন পর্যালোচনায় রয়েছে।')}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* User Transaction History for Qard */}
            <div className="bg-white border border-slate-150 p-4 rounded-3xl space-y-3 shadow-3xs">
              <h4 className="text-xs font-black text-slate-850">আপনার ঐতিহাসিক ঋণ রসিদ সমূহঃ</h4>
              {qardHistory.filter(t => t.userId === user.uid && t.type !== 'qard_donation').length === 0 ? (
                <p className="text-[10px] text-slate-450 italic py-4 text-center">এখনো কোনো ঋণের লেনদেন পাওয়া যায়নি।</p>
              ) : (
                <div className="border border-slate-150 rounded-2xl divide-y divide-slate-150">
                  {qardHistory.filter(t => t.userId === user.uid && t.type !== 'qard_donation').map((tx, idx) => (
                    <div key={`${tx.id || "tx"}-${idx}`} className="p-3 flex justify-between items-center text-xs hover:bg-slate-50/50 transition">
                      <div className="text-left space-y-0.5">
                        <strong className="text-[11.5px] text-slate-800 block">
                          {tx.type === 'qard_loan_request' ? '⏳ সুদমুক্ত ঋণ আবেদন' : tx.type === 'qard_loan_disbursment' ? '💸 ঋণ বিতরণ লাভ' : '✅ ঋণ পরিশোধ'}
                        </strong>
                        <p className="text-[9px] text-slate-450 font-sans mt-0.5">
                          {new Date(tx.createdAt).toLocaleString('bn-BD')} • {tx.paymentMethod || 'Wallet'}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <span className={"font-mono font-black text-[11px] block " + (tx.type === 'qard_loan_repayment' ? 'text-emerald-600' : 'text-rose-600')}>
                          {tx.type === 'qard_loan_repayment' ? '+' : '-'}৳ {tx.amount?.toLocaleString('bn-BD')}
                        </span>
                        <button
                          onClick={() => showReceiptForTx(tx)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[8px] font-sans font-extrabold rounded-md shadow-3xs cursor-pointer"
                        >
                          ডিজিটাল রসিদ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 4: QARD LOAN APPLY ==================== */}
        {activeTab === 'apply' && (() => {
          const qardCfg = appConfig?.qardConfig || DEFAULT_QARD_CONFIG;
          const rules = qardCfg.rulesList || DEFAULT_QARD_CONFIG.rulesList;
          const vNotice = qardCfg.verificationNotice || DEFAULT_QARD_CONFIG.verificationNotice;
          const eligCfg = qardCfg.eligibilityConfig || DEFAULT_QARD_CONFIG.eligibilityConfig;
          const reqDays = eligCfg.requiredActiveDays ?? 60;
          const reqVol = eligCfg.requiredAmbTxVolume ?? 20000;

          const isSamityInvestor = user.samityStatus === 'approved' || user.samityApproved === true || user.isSamityMember === true || user.samitySchemeActive || user.role === 'admin' || user.isDemo;

          const isDaysEligible = isSamityInvestor || activeDays >= reqDays;
          const isVolEligible = isSamityInvestor || ambTxVolume >= reqVol;
          const isOverallEligible = isSamityInvestor || (activeDays >= reqDays && ambTxVolume >= reqVol);

          return (
          <div className="space-y-4 font-sans text-left animate-fade-in">
            {/* Policy & category limit info box */}
            <div className="bg-gradient-to-br from-rose-50 to-amber-50/30 border border-rose-100 p-5 rounded-3xl space-y-4">
              <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-150 px-2.5 py-0.5 rounded-full font-black uppercase inline-block">
                {qardCfg.rulesSubtitle || 'করযে হাসানা শর্তাবলি (সংক্ষেপে)'}
              </span>
              <h3 className="text-base font-black text-slate-850">
                {qardCfg.rulesTitle || 'কল্যাণমুখী করজে হাসানা (সুদমুক্ত ঋণ) নীতিমালা'}
              </h3>
              
              <div className="space-y-3.5 text-xs font-bold text-slate-750 leading-relaxed">
                {rules.map((rule, idx) => (
                  <div key={rule.id || idx} className={`flex items-start gap-2.5 ${idx > 0 ? 'border-t border-rose-100/50 pt-2.5' : ''}`}>
                    <span className="text-rose-600 text-sm mt-0.5">{rule.icon || '📌'}</span>
                    <p className={`text-slate-700 font-bold ${rule.isWarning ? 'text-rose-900 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/60 w-full' : ''}`}>
                      <strong className="text-rose-950 font-black">{rule.title}: </strong>
                      {rule.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Eligibility Tracker Box */}
            <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-4 shadow-3xs text-left">
              <h4 className="text-sm font-black text-slate-850 flex items-center gap-1.5">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-650" />
                {eligCfg.trackerTitle || 'আপনার করযে হাসানা যোগ্যতা ট্র্যাকার'}
              </h4>
              <p className="text-[10.5px] text-slate-500 font-bold">
                {eligCfg.trackerSubtitle || 'ঋণের আবেদন করার জন্য নিম্নলিখিত শর্তাবলী পূরণ করা আবশ্যকঃ'}
              </p>

              {isSamityInvestor && (
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-[11px] text-emerald-950 font-bold flex items-start gap-2.5 shadow-2xs">
                  <span className="text-base leading-none">🏢</span>
                  <div className="space-y-0.5">
                    <p className="font-black text-emerald-900">AMB কোম্পানি ম্যানেজমেন্ট ইনভেস্টার / সমবায় সমিতি সদস্য</p>
                    <p className="text-[10px] text-emerald-800 font-bold leading-relaxed">
                      আপনার সমবায় সমিতিতে সঞ্চয় জমা থাকায় 2 মাস সক্রিয় থাকা বা 20,000 টাকা লেনদেনের শর্ত প্রযোজ্য নয়! আপনি যেকোনো সময় আপনার জমা সঞ্চয়ের 50% টাকা ইনস্ট্যান্ট অটো-ঋণ হিসেবে গ্রহণ করতে পারবেন।
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {/* Condition 1: Active Days */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    isDaysEligible ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {isDaysEligible ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-black text-slate-750">
                      অ্যাপে {Math.round(reqDays / 30)} মাস ({reqDays} দিন) সক্রিয় থাকা
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold">
                      {isSamityInvestor
                        ? `অব্যাহতিপ্রাপ্ত! সমবায় সমিতি ইনভেস্টার সদস্যদের জন্য এই শর্ত প্রযোজ্য নয় (অটো-অনুমোদিত)।`
                        : isDaysEligible
                          ? `পূরণ হয়েছে! আপনি ${activeDays} দিন ধরে আমাদের সাথে সক্রিয় আছেন।`
                          : `পূরণ হয়নি! (শুধুমাত্র সাধারণ সদস্যদের জন্যঃ আপনার সক্রিয় মেয়াদ ${activeDays} দিন, কমপক্ষে ${reqDays} দিন প্রয়োজন)`}
                    </p>
                  </div>
                </div>

                {/* Condition 2: AMB to AMB Tx Volume */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    isVolEligible ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {isVolEligible ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-black text-slate-750">AMB টু BNB লেনদেন (৳{reqVol.toLocaleString('bn-BD')})</p>
                    <p className="text-[10px] text-slate-500 font-bold">
                      {isSamityInvestor
                        ? `অব্যাহতিপ্রাপ্ত! সমবায় সমিতি ইনভেস্টার সদস্যদের জন্য 20,000 টাকা লেনদেনের বাধ্যবাধকতা নেই (অটো-অনুমোদিত)।`
                        : isVolEligible
                          ? `পূরণ হয়েছে! আপনার AMB টু BNB লেনদেন ৳${ambTxVolume.toLocaleString('bn-BD')} BDT`
                          : `পূরণ হয়নি! (শুধুমাত্র সাধারণ সদস্যদের জন্যঃ আপনার লেনদেন ৳${ambTxVolume.toLocaleString('bn-BD')} BDT, ন্যূনতম ${reqVol.toLocaleString('bn-BD')} টাকা প্রয়োজন)`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status overall */}
              {isSamityInvestor ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-[10.5px] font-bold flex items-center gap-2">
                  <span className="text-xs">✅</span>
                  <span>অভিনন্দন! আপনি সমবায় সমিতি ইনভেস্টার হিসেবে যেকোনো সময় জমা সঞ্চয়ের 50% ঋণ নিতে পারবেন।</span>
                </div>
              ) : isOverallEligible ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-[10.5px] font-bold flex items-center gap-2">
                  <span className="text-xs">✅</span>
                  <span>অভিনন্দন! আপনি সুদমুক্ত করজে হাসানা ঋণ পাওয়ার জন্য যোগ্য। নিচে ফর্মটি পূরণ করে আবেদন করুন।</span>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-[10.5px] font-bold flex items-start gap-2">
                  <span className="text-xs mt-0.5">⚠️</span>
                  <span>দুঃখিত, সাধারণ সদস্য হিসেবে আপনি এখনো ঋণের যোগ্যতা অর্জন করেননি। শর্তাবলী সম্পূর্ণ পূরণ হলে স্বয়ংক্রিয়ভাবে আবেদন সক্রিয় হবে।</span>
                </div>
              )}
            </div>

            {/* Active Loan tracking repayment panel if user has outstanding debt */}
            {renderActiveLoanRepaymentCard()}

            {/* Interactive Qard Auto-Debit Simulator */}
            {(() => {
              const myDisbursments = qardHistory.filter(t => t.userId === user.uid && t.type === 'qard_loan_disbursment' && t.status === 'success');
              const myRepayments = qardHistory.filter(t => t.userId === user.uid && t.type === 'qard_loan_repayment' && t.status === 'success');
              const totalBorrowed = myDisbursments.reduce((acc, c) => acc + c.amount, 0);
              const totalRepaid = myRepayments.reduce((acc, c) => acc + c.amount, 0);
              const due = Math.max(user.dueLoan || 0, Math.max(0, totalBorrowed - totalRepaid));

              if (due <= 0) return null;

              return (
                <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-4 shadow-md relative overflow-hidden mt-3">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white text-xs font-bold animate-bounce">
                      ⚡
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-rose-400">করযে হাসানা কিস্তি অটো-ডেবিট ও জরিমানা সিমুলেটর</h4>
                      <p className="text-[9.5px] text-slate-400 mt-0.5">স্বয়ংক্রিয় কিস্তি অটো-ডেবিট ও বিলম্ব জরিমানা টেস্ট টুল</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1 text-xs">
                    <div>
                      <label className="block text-[10.5px] text-slate-400 font-bold mb-1.5">চলতি ঋণ চক্রের কোন দিনে কিস্তি পরিশোধ পরীক্ষা করবেন?</label>
                      <select
                        value={qardSimulatedDay}
                        onChange={(e) => setQardSimulatedDay(Number(e.target.value))}
                        className="block w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                      >
                        {Array.from({ length: 45 }, (_, i) => i + 1).map((day) => {
                          let tag = '';
                          const latestDisb = myDisbursments[0];
                          const dur = latestDisb?.loanDuration || 1;
                          const instAmt = Math.min(due, Math.ceil((latestDisb?.amount || due) / dur));
                          const lateDays = day > 30 ? (day - 30) : 0;
                          const penAmt = lateDays > 0 ? Math.floor((instAmt / 1000) * 10 * lateDays) : 0;
                          if (day <= 30) tag = ' (30 দিনের মধ্যে: 0৳ জরিমানা - ফ্রি)';
                          else tag = ` (${lateDays} দিন ওভারডিউ: ৳${penAmt} জরিমানা)`;
                          return (
                            <option key={day} value={day}>
                              দিন {day} {tag}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Live calculations output */}
                    {(() => {
                      const latestDisb = myDisbursments[0];
                      const dur = latestDisb?.loanDuration || 1;
                      const instAmount = Math.min(due, Math.ceil((latestDisb?.amount || due) / dur));
                      const daysLateVal = qardSimulatedDay > 30 ? (qardSimulatedDay - 30) : 0;
                      const penAmountVal = daysLateVal > 0 ? Math.floor((instAmount / 1000) * 10 * daysLateVal) : 0;
                      const totalVal = instAmount + penAmountVal;
                      return (
                        <div className="bg-slate-850/80 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-[11.5px] font-sans font-semibold">
                          <div className="flex justify-between">
                            <span className="text-slate-400">নির্ধারিত মাসিক কিস্তিঃ</span>
                            <span className="font-bold text-white">৳ {instAmount.toLocaleString('bn-BD')} BDT</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">বিলম্ব জরিমানা (31তম দিন থেকে প্রতি হাজারে প্রতিদিন ৳10)：</span>
                            <span className={`font-bold ${daysLateVal > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                              ৳ {penAmountVal.toLocaleString('bn-BD')} BDT
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-slate-850 pt-2 text-xs font-black">
                            <span className="text-rose-400">মোট প্রদেয় কিস্তি (কিস্তি + জরিমানা)：</span>
                            <span className="text-emerald-400">
                              ৳ {totalVal.toLocaleString('bn-BD')} BDT
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {simulationError && (
                      <div className="bg-rose-950/40 border border-rose-900 text-rose-400 text-[10.5px] p-3 rounded-xl font-bold leading-relaxed text-left">
                        ⚠️ {simulationError}
                      </div>
                    )}

                    {simulationSuccess && (
                      <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-400 text-[10.5px] p-3 rounded-xl font-bold leading-relaxed text-left">
                        ✓ {simulationSuccess}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        const latestDisb = myDisbursments[0];
                        const dur = latestDisb?.loanDuration || 1;
                        const instAmount = Math.min(due, Math.ceil((latestDisb?.amount || due) / dur));
                        handleExecuteQardAutoDebit(due, instAmount, dur);
                      }}
                      disabled={simulatingAutoDebit}
                      className="w-full bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white py-3 rounded-xl font-extrabold text-xs transition duration-200 disabled:opacity-50 cursor-pointer"
                    >
                      {simulatingAutoDebit ? 'প্রক্রিয়াকরণ হচ্ছে...' : 'কিস্তি অটো-ডেবিট ও জরিমানা সমন্বয় করুন'}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Coop 1% - 50% Instant Auto-Loan Section (Auto-Disbursement without Admin Approval) */}
            {(() => {
              const coopInstantCfg = qardCfg.coopInstantLoanConfig || DEFAULT_QARD_CONFIG.coopInstantLoanConfig;
              if (coopInstantCfg?.enabled === false) return null;

              const percent = coopInstantCfg?.percentage ?? 50;
              const userSavings = user.savings || 0;
              const minInstantLimit = Math.max(1, Math.floor(userSavings * 0.01));
              const maxInstantLimit = Math.floor(userSavings * (percent / 100));

              const lastLoanAmt = user.lastCoopInstantLoanAmount || 0;
              const calcPercent = userSavings > 0 ? (lastLoanAmt / userSavings) * 100 : 50;
              const effectivePercent = user.lastCoopLoanPercentage ?? calcPercent;
              const effectiveCooldownDays = effectivePercent <= 25 ? 30 : 90;
              const hasActiveDue = (user.dueLoan || 0) > 0;

              let isCooldownActive = false;
              let daysSinceRepaid = 0;
              let daysRemaining = 0;
              let nextEligibleDateStr = '';

              if (user.lastCoopInstantLoanRepaidAt) {
                const repaidTime = new Date(user.lastCoopInstantLoanRepaidAt).getTime();
                daysSinceRepaid = Math.floor((Date.now() - repaidTime) / (1000 * 60 * 60 * 24));
                if (daysSinceRepaid < effectiveCooldownDays) {
                  isCooldownActive = true;
                  daysRemaining = effectiveCooldownDays - daysSinceRepaid;
                  nextEligibleDateStr = new Date(repaidTime + effectiveCooldownDays * 24 * 60 * 60 * 1000).toLocaleDateString('bn-BD');
                }
              }

              return (
                <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-orange-500/10 border border-amber-300/80 p-5 rounded-3xl space-y-4 shadow-sm text-left">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                    <div>
                      <span className="text-[9px] bg-amber-600 text-white px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-2xs">
                        <Zap className="w-3 h-3 text-amber-200" /> অটো অনুমোদন (No Admin Needed)
                      </span>
                      <h4 className="text-sm font-black text-amber-950 mt-1.5 flex items-center gap-1.5">
                        {coopInstantCfg?.title || '🏢 সমবায় আমানতের 1% - 50% ইনস্ট্যান্ট অটো-ঋণ'}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-amber-800 font-extrabold block">ঋণের সীমা (1% - 50%)</span>
                      <strong className="text-sm font-mono font-black text-amber-700">৳{minInstantLimit.toLocaleString('bn-BD')} - ৳{maxInstantLimit.toLocaleString('bn-BD')} BDT</strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-900 font-bold leading-relaxed">
                    {coopInstantCfg?.description || `সমিতিতে যাদের সঞ্চয় রয়েছে, তারা জমানো সঞ্চয়ের 1% থেকে 50% টাকা যেকোনো সময় এডমিন অনুমোদন ছাড়াই 1-3 মাস মেয়াদের ইনস্ট্যান্ট অটো-ঋণ নিতে পারবেন। 1% - 25% ঋণ পরিশোধ করলে 1 মাস (30 দিন) এবং 25% - 50% ঋণ পরিশোধ করলে 3 মাস (90 দিন) পর পুনরায় ঋণ নেওয়ার সুযোগ মিলবে।`}
                  </p>

                  <div className="grid grid-cols-2 gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200/60">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-extrabold">আপনার বর্তমান সঞ্চয়ঃ</span>
                      <p className="text-xs font-black font-mono text-emerald-700">৳{userSavings.toLocaleString('bn-BD')} BDT</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-extrabold">সুদমুক্ত ঋণের নিয়মঃ</span>
                      <p className="text-xs font-black text-amber-900">বিনাসুদে 1-3 মাস মেয়াদে গ্রহণযোগ্য</p>
                    </div>
                  </div>

                  {/* Date Windows & Rules Information Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-gradient-to-r from-amber-100/90 via-amber-50 to-orange-50 border border-amber-300/90 rounded-2xl text-[10px] font-bold text-amber-950 shadow-2xs">
                    <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1.5 rounded-xl border border-amber-200/60">
                      <span className="text-xs">🗓️</span>
                      <span>ঋণ নেওয়ার সময়ঃ <strong className="text-emerald-800 font-black">যেকোনো সময় (24/7)</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1.5 rounded-xl border border-amber-200/60">
                      <span className="text-xs">⏳</span>
                      <span>পরিশোধ মেয়াদঃ <strong className="text-amber-900 font-black">1 মাস (30 দিন) / 3 মাস</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1.5 rounded-xl border border-rose-200/70">
                      <span className="text-xs">⚠️</span>
                      <span>বিলম্ব জরিমানাঃ <strong className="text-rose-700 font-black">হাজারে 10৳ / দিন</strong></span>
                    </div>
                  </div>

                  {userSavings <= 0 ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-[10.5px] font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>আপনার সমিতিতে সঞ্চয় জমা নেই। 1% - 50% অটো-ঋণ নিতে আগে সমিতিতে সঞ্চয় জমা প্রদান করুন।</span>
                    </div>
                  ) : hasActiveDue ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-[10.5px] font-bold flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-black text-rose-950">⚠️ পূর্বের বকেয়া ঋণ বিদ্যমান!</p>
                        <p className="text-[10px] mt-0.5 font-semibold text-rose-800">
                          আপনার নিকট বর্তমানে ৳{(user.dueLoan || 0).toLocaleString('bn-BD')} BDT বকেয়া ঋণ রয়েছে। ইনস্ট্যান্ট অটো-ঋণ নিতে প্রথমে বর্তমান বকেয়া ঋণ সম্পূর্ণ পরিশোধ করুন।
                        </p>
                      </div>
                    </div>
                  ) : isCooldownActive ? (
                    <div className="p-3 bg-amber-100/90 border border-amber-300 text-amber-900 rounded-2xl text-[10.5px] font-bold flex items-start gap-2">
                      <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-black text-amber-950">⏳ ইনস্ট্যান্ট ঋণ পুনরায় গ্রহণের সময় বাকী রয়েছে!</p>
                        <p className="text-[10px] mt-0.5 font-bold">
                          আপনি গত {new Date(user.lastCoopInstantLoanRepaidAt!).toLocaleDateString('bn-BD')}-এ ({daysSinceRepaid} দিন আগে) পূর্বের {lastLoanAmt > 0 ? `৳${lastLoanAmt.toLocaleString('bn-BD')} (${effectivePercent.toFixed(1)}%) ` : ''}ঋণ সম্পূর্ণ পরিশোধ করেছেন। নিয়ম অনুযায়ী {effectivePercent <= 25 ? '1% - 25%' : '25% - 50%'} ঋণ পরিশোধের পর {effectivePercent <= 25 ? '1 মাস (30 দিন)' : '3 মাস (90 দিন)'} পর ({nextEligibleDateStr}) পুনরায় 1% - 50% ইনস্ট্যান্ট ঋণ নেওয়া যাবে। (আর {daysRemaining} দিন বাকি)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleCoopInstantLoanSubmit} className="space-y-3 bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-amber-950 uppercase">ঋণের পরিমাণ (1% - 50%):</label>
                          <span className="text-[10px] font-bold text-amber-700">
                            সীমাঃ ৳{minInstantLimit.toLocaleString('bn-BD')} - ৳{maxInstantLimit.toLocaleString('bn-BD')}
                          </span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-amber-700">৳</span>
                          <input
                            type="number"
                            value={instantLoanAmtInput}
                            onChange={(e) => setInstantLoanAmtInput(e.target.value)}
                            placeholder={`৳ ${minInstantLimit} থেকে ৳ ${maxInstantLimit}`}
                            className="w-full bg-amber-50/50 border border-amber-200 rounded-xl py-2 pl-7 pr-3 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800"
                            min={minInstantLimit}
                            max={maxInstantLimit}
                            required
                          />
                        </div>
                        {/* Quick selector buttons */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setInstantLoanAmtInput(String(minInstantLimit))}
                            className="px-2.5 py-1 bg-amber-100/80 hover:bg-amber-200 text-amber-900 text-[9.5px] font-black rounded-lg border border-amber-300/70 cursor-pointer"
                          >
                            1% (৳{minInstantLimit.toLocaleString('bn-BD')})
                          </button>
                          {maxInstantLimit > minInstantLimit * 2 && (
                            <button
                              type="button"
                              onClick={() => setInstantLoanAmtInput(String(Math.floor((minInstantLimit + maxInstantLimit) / 2)))}
                              className="px-2.5 py-1 bg-amber-100/80 hover:bg-amber-200 text-amber-900 text-[9.5px] font-black rounded-lg border border-amber-300/70 cursor-pointer"
                            >
                              25% (৳{Math.floor((minInstantLimit + maxInstantLimit) / 2).toLocaleString('bn-BD')})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setInstantLoanAmtInput(String(maxInstantLimit))}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[9.5px] font-black rounded-lg cursor-pointer"
                          >
                            50% (৳{maxInstantLimit.toLocaleString('bn-BD')})
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-700 uppercase">পরিশোধ মেয়াদ ও কিস্তি অপশন:</label>
                          <select
                            value={instantLoanDurationInput}
                            onChange={(e) => setInstantLoanDurationInput(Number(e.target.value))}
                            className="w-full bg-amber-50/50 border border-amber-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          >
                            <option value={1}>1 মাস (30 দিন) — এককালীন সম্পূর্ণ পরিশোধ</option>
                            <option value={3}>3 মাস (90 দিন) — 3টি কিস্তিতে পরিশোধ</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-700 uppercase">সিকিউরিটি পিন:</label>
                          <input
                            type="password"
                            maxLength={4}
                            value={instantLoanPinInput}
                            onChange={(e) => setInstantLoanPinInput(e.target.value)}
                            placeholder="****"
                            className="w-full bg-amber-50/50 border border-amber-200 rounded-xl py-2 px-3 text-xs font-bold font-mono text-center tracking-widest focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800"
                            required
                          />
                        </div>
                      </div>

                      {/* Live Installment Breakdown Box */}
                      {(() => {
                        const curAmt = parseFloat(instantLoanAmtInput || String(maxInstantLimit)) || 0;

                        if (instantLoanDurationInput === 3) {
                          const m1 = Math.round(curAmt / 3);
                          const m2 = Math.round(curAmt / 3);
                          const m3 = curAmt - (m1 + m2);
                          return (
                            <div className="p-3.5 bg-slate-900 text-white rounded-2xl text-[10.5px] space-y-2.5 shadow-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-black text-amber-300">📊 3 মাসের 3-কিস্তি পরিশোধ শিডিউল (90 দিন):</span>
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">0% সুদ</span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 text-center font-mono font-bold">
                                <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700">
                                  <span className="text-[8.5px] text-slate-400 block font-sans">1ম কিস্তি (30 দিন)</span>
                                  <span className="text-amber-400 text-xs">৳{m1.toLocaleString('bn-BD')}</span>
                                  <span className="text-[8px] text-slate-400 block font-sans mt-0.5">পরের মাসের একই তারিখ</span>
                                </div>
                                <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700">
                                  <span className="text-[8.5px] text-slate-400 block font-sans">2য় কিস্তি (60 দিন)</span>
                                  <span className="text-amber-400 text-xs">৳{m2.toLocaleString('bn-BD')}</span>
                                  <span className="text-[8px] text-slate-400 block font-sans mt-0.5">2য় মাসের একই তারিখ</span>
                                </div>
                                <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700">
                                  <span className="text-[8.5px] text-slate-400 block font-sans">3য় কিস্তি (90 দিন)</span>
                                  <span className="text-amber-400 text-xs">৳{m3.toLocaleString('bn-BD')}</span>
                                  <span className="text-[8px] text-slate-400 block font-sans mt-0.5">3য় মাসের একই তারিখ</span>
                                </div>
                              </div>
                              <p className="text-[9.5px] text-slate-400 leading-tight">
                                🔔 প্রতি কিস্তির মেয়াদ শেষ হওয়ার 2 দিন আগে নোটিফিকেশন যাবে। 30 দিনের মধ্যে পরিশোধ না করলে প্রতিদিন প্রতি 1,000 টাকায় 10 টাকা বিলম্ব জরিমানা কার্যকর হবে।
                              </p>
                            </div>
                          );
                        } else {
                          return (
                            <div className="p-3 bg-slate-900 text-white rounded-2xl text-[10.5px] space-y-1.5 shadow-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-300">📊 1 মাস (30 দিন / পরের মাসের একই তারিখ) মেয়াদে সম্পূর্ণ পরিশোধযোগ্যঃ</span>
                                <strong className="font-mono text-amber-400 font-black text-xs">৳{curAmt.toLocaleString('bn-BD')} BDT</strong>
                              </div>
                              <div className="p-2 bg-slate-800/80 rounded-xl text-[9.5px] text-slate-300 space-y-0.5">
                                <p className="text-amber-300 font-bold">🔔 মেয়াদ শেষ হওয়ার 2 দিন পূর্বে অটো নোটিফিকেশন রিমাইন্ডার যাবে।</p>
                                <p className="text-rose-400 font-bold">⚠️ 30 দিন পার হলে প্রতিদিন প্রতি 1,000 টাকায় 10 টাকা হারে বিলম্ব জরিমানা প্রযোজ্য হবে।</p>
                              </div>
                            </div>
                          );
                        }
                      })()}

                      <button
                        type="submit"
                        disabled={instantLoanLoading}
                        className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-98 text-white font-black text-xs rounded-xl shadow-md transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4 text-amber-200 fill-amber-200" />
                        {instantLoanLoading
                          ? 'প্রক্রিয়াকরণ হচ্ছে...'
                          : `৳ ${parseFloat(instantLoanAmtInput || String(maxInstantLimit)).toLocaleString('bn-BD')} ইনস্ট্যান্ট অটো-ঋণ গ্রহণ করুন (অটো-অনুমোদন)`}
                      </button>
                    </form>
                  )}
                </div>
              );
            })()}

            {/* Apply Application Form block */}
            <form onSubmit={handleLoanApply} className="bg-white border border-slate-150 p-5 rounded-3xl space-y-4 shadow-3xs">
              <h4 className="text-sm font-black text-slate-850 border-b border-slate-100 pb-2">নতুন সুদমুক্ত করযে হাসানা ঋণ রিকোয়েস্ট</h4>

              {/* Profile Completion Checklist Banner */}
              {(() => {
                const missing = getMissingProfileFields(user);
                const isComplete = missing.length === 0;
                if (!isComplete) {
                  return (
                    <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-3.5 text-xs font-bold leading-relaxed shadow-3xs text-left space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-rose-950 font-black block">
                            ⚠️ করযে হাসানা ঋণ নিতে প্রোফাইল 100% সম্পূর্ণ থাকা বাধ্যতামূলক!
                          </strong>
                          <p className="text-[11px] text-rose-800 font-medium mt-0.5">
                            কোনো একটি তথ্য ফাঁকা থাকলে করযে হাসানা আবেদন গ্রহণযোগ্য হবে না। আপনার প্রোফাইলে বাকি রয়েছে:
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {missing.map((field, idx) => (
                          <span key={idx} className="bg-rose-150 text-rose-900 border border-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            ❌ {field}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10.5px] text-slate-600 italic">
                        👉 প্রোফাইল ট্যাব থেকে &quot;ডাটা পরিবর্তন&quot; করে বাকি তথ্যগুলো পূরণ করুন।
                      </p>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-3 text-xs font-bold flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>✓ আপনার প্রোফাইল 100% সম্পূর্ণ রয়েছে। করযে হাসানা আবেদনের জন্য যোগ্য।</span>
                    </div>
                  );
                }
              })()}
              
              {/* WhatsApp Contact Notice from Admin */}
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-3.5 text-xs font-bold leading-relaxed shadow-3xs text-left flex items-start gap-2">
                <span className="text-base leading-none">📢</span>
                <div className="space-y-1.5">
                  <strong className="text-amber-950 font-black block mb-0.5">
                    {vNotice.title || 'এডমিন প্যানেল ভেরিফিকেশন নোটিশঃ'}
                  </strong>
                  <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-line">
                    {vNotice.body}
                  </p>
                  {vNotice.warningNote && (
                    <p className="text-amber-900 font-black mt-1.5 block">
                      {vNotice.warningNote}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-650 font-extrabold uppercase tracking-wide block">1. ঋণের আবেদনকৃত পরিমাণঃ</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center text-rose-600 font-bold">
                    ৳
                  </div>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="যেমনঃ 3000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-9 pr-4 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-650 font-extrabold uppercase tracking-wide block">2. সচল WhatsApp নম্বর (যোগাযোগের জন্য)：</label>
                <input
                  type="tel"
                  value={loanWhatsapp}
                  onChange={(e) => setLoanWhatsapp(e.target.value)}
                  placeholder="যেমনঃ 017XXXXXXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-650 font-extrabold uppercase tracking-wide block">3. ঋণ পরিশোধের মেয়াদ ও কিস্তি অপশন：</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { m: 1, label: '1 মাস (30 দিন)', sub: 'এককালীন পরিশোধ' },
                    { m: 3, label: '3 মাস (90 দিন)', sub: '3টি কিস্তিতে পরিশোধ' }
                  ].map(({ m, label, sub }) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setLoanDuration(m)}
                      className={`py-2 px-3 rounded-2xl text-xs font-black border transition cursor-pointer text-center ${loanDuration === m ? 'bg-rose-50 border-rose-500 text-rose-700 font-sans' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                    >
                      <span className="block">{label}</span>
                      <span className="text-[9px] opacity-75 font-normal block font-sans">{sub}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[9.5px] text-slate-500">
                  🔔 মেয়াদ শেষ হওয়ার 2 দিন পূর্বে রিমাইন্ডার নোটিফিকেশন পাঠানো হবে। 30 দিন পর থেকে দিন প্রতি হাজারে 10 টাকা বিলম্ব জরিমানা প্রযোজ্য হবে।
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-650 font-extrabold uppercase tracking-wide block">4. প্রতি মাসে কত টাকা পরিশোধ করতে পারবেন? (repayment per month):</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center text-rose-600 font-bold">
                    ৳
                  </div>
                  <input
                    type="number"
                    value={loanMonthlyRepay}
                    onChange={(e) => setLoanMonthlyRepay(e.target.value)}
                    placeholder="যেমনঃ 1000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-9 pr-4 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-650 font-extrabold uppercase tracking-wide block">5. ঋণের সুনির্দিষ্ট উদ্দেশ্য ও কারণঃ</label>
                <textarea
                  rows={3}
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  placeholder="যেমনঃ ডায়াগনস্টিক রিপোর্ট এবং চিকিৎসার জরুরি বিল।"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-sans text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-650 font-extrabold uppercase tracking-wide block">6. 4-ডিজিট সিকিউরিটি পিন নাম্বারঃ</label>
                <input
                  type="password"
                  maxLength={4}
                  value={loanPin}
                  onChange={(e) => setLoanPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="নিশ্চিত করতে আপনার সিকিউরিটি পিন কোড দিন"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-mono tracking-widest text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-2xl active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                {loading ? 'আবেদন পাঠানো হচ্ছে...' : 'ঋণ সহায়তা রিকোয়েস্ট পাঠান'}
              </button>
            </form>
          </div>
          );
        })()}

        {/* ==================== TAB: WITHDRAW SECTION ==================== */}
        {activeTab === 'withdraw' && (
          <div className="space-y-5 text-left animate-fade-in">
            <div className="bg-amber-50/80 border border-amber-200 p-6 rounded-3xl text-center space-y-3.5 shadow-3xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-xl font-bold">
                🔒
              </div>
              <h3 className="text-sm font-black text-slate-800 font-sans">করযে হাসানা কল্যাণ তহবিল নীতিমালা</h3>
              <p className="text-xs text-slate-650 font-bold leading-relaxed max-w-md mx-auto">
                করযে হাসানা হলো একটি সুদমুক্ত দ্বীনি ও সামাজিক কল্যাণ তহবিল। এখানে প্রদত্ত যেকোনো অনুদান বা ফান্ড সরাসরি অভাবী মানুষের সহায়তা ও সুদমুক্ত ঋণে ব্যবহৃত হয়। নীতি অনুযায়ী এই তহবিল হতে কোনো টাকা ব্যক্তিগতভাবে উত্তোলনযোগ্য নয়।
              </p>
              <div className="pt-2">
                <button 
                  onClick={() => setActiveTab('donate')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  🌱 কল্যাণ তহবিলে অবদান রাখুন
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: ADMIN SUB SECTION ==================== */}
        {activeTab === 'admin' && user.role === 'admin' && (
          <div className="space-y-4 text-left animate-fade-in">
            {/* Header statistics info */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200 p-5 rounded-3xl relative overflow-hidden">
              <span className="bg-amber-100 text-amber-800 border border-amber-200/50 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase inline-block">
                করযে হাসানা প্রশাসনিক প্যানেল
              </span>
              <h3 className="text-base font-black text-slate-850 mt-1.5">উদারতা ও অনুদান হিসাব ব্যবস্থাপনা</h3>
              <p className="text-[11px] text-slate-655 leading-relaxed font-bold mt-1">
                এখানে দাতাদের তালিকা নিরীক্ষণ, অসমাপ্ত পেমেন্ট অনুমোদন, এবং সুদমুক্ত ফান্ডের সঠিক বরাদ্দ ও বিতরণ সম্পন্ন করতে পারবেন।
              </p>
            </div>

            {/* Quick Admin submenus */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => setAdminTab('pending')}
                className={"p-2 rounded-xl font-black text-center transition-all cursor-pointer border " + (adminTab === 'pending' ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}
              >
                আবেদনসমূহ ({qardHistory.filter(t => t.status === 'pending').length})
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('all')}
                className={"p-2 rounded-xl font-black text-center transition-all cursor-pointer border " + (adminTab === 'all' ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}
              >
                সম্পূর্ণ লেজার খাতা
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('donors')}
                className={"p-2 rounded-xl font-black text-center transition-all cursor-pointer border " + (adminTab === 'donors' ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}
              >
                দাতাদের তালিকা ({uniqueDonors.length})
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('allocation')}
                className={"p-2 rounded-xl font-black text-center transition-all cursor-pointer border " + (adminTab === 'allocation' ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}
              >
                অডিটিং লগ
              </button>
            </div>

            {/* ADMIN SUB: PENDING APPLICATIONS */}
            {adminTab === 'pending' && (
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-500">অপেক্ষারত অনুদান ও ঋণ যাচাই তালিকাঃ</h4>
                
                {qardHistory.filter(t => t.status === 'pending').length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic py-4 text-center">কোনো অপেক্ষারত আবেদন পাওয়া যায়নি।</p>
                ) : (
                  <div className="space-y-3">
                    {qardHistory.filter(t => t.status === 'pending').map((tx, idx) => (
                      <div key={`${tx.id || "tx"}-${idx}`} className="bg-white p-4 border border-slate-150 rounded-3xl space-y-3 text-xs text-left shadow-3xs animate-fade-in">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={"px-2 py-0.5 rounded text-[8px] font-black " + (tx.type === 'qard_donation' ? 'bg-rose-50 text-rose-700 border border-rose-100' : tx.type === 'qard_withdrawal' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100')}>
                              {tx.type === 'qard_donation' ? 'উদার অনুদান' : tx.type === 'qard_withdrawal' ? 'টাকা উত্তোলন আবেদন' : 'ঋণ সহায়তা রিকোয়েস্ট'}
                            </span>
                            <h5 className="text-[11px] font-black text-slate-800 mt-1.5">সদস্যঃ {tx.userName} ({tx.memberId})</h5>
                            <p className="text-[9px] text-slate-400 mt-0.5">{new Date(tx.createdAt).toLocaleString('bn-BD')}</p>
                          </div>
                          <span className="font-mono text-xs font-black text-rose-600">৳ {tx.amount}</span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 space-y-1 text-[10px] text-slate-600 font-mono">
                          <p><strong className="text-slate-800 font-sans">বিবরণীঃ</strong> {tx.description || 'N/A'}</p>
                          {tx.whatsappNumber && (
                            <p className="flex items-center gap-1.5 mt-0.5">
                              <strong className="text-slate-800 font-sans">WhatsApp নম্বরঃ</strong>
                              <span className="text-emerald-700 font-black text-xs font-mono">{tx.whatsappNumber}</span>
                              <a
                                href={`https://wa.me/${tx.whatsappNumber.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-sans text-[8px] font-bold inline-flex items-center"
                              >
                                চ্যাট করুন 💬
                              </a>
                            </p>
                          )}
                          {tx.monthlyRepayAmount !== undefined && (
                            <p><strong className="text-slate-800 font-sans">প্রস্তাবিত মাসিক কিস্তিঃ</strong> <span className="text-rose-600 font-black">৳ {tx.monthlyRepayAmount} BDT/মাস</span></p>
                          )}
                          {tx.paymentMethod && <p><strong className="text-slate-800 font-sans">গেটওয়েঃ</strong> {tx.paymentMethod}</p>}
                          {tx.senderInfo && <p><strong className="text-slate-800 font-sans">প্রেরক তথ্যঃ</strong> {tx.senderInfo}</p>}
                          {tx.transactionId && <p><strong className="text-slate-800 font-sans">TxnID：</strong> {tx.transactionId}</p>}
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleAdminVerify(tx.id, 'approve', tx.type, tx.userId, tx.amount)}
                            disabled={loading}
                            className="flex-1 py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-lg transition shadow-xs cursor-pointer"
                          >
                            অনুমোদন করুন
                          </button>
                          <button
                            onClick={() => handleAdminVerify(tx.id, 'reject', tx.type, tx.userId, tx.amount)}
                            disabled={loading}
                            className="py-1 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-[10px] rounded-lg transition shadow-xs cursor-pointer"
                          >
                            প্রত্যাখ্যান
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ADMIN SUB: ALL LEDGERS */}
            {adminTab === 'all' && (
              <div className="space-y-3 font-sans">
                {/* Visual statistics for admin overview */}
                <div className="bg-white p-4 border border-slate-150 rounded-3xl grid grid-cols-2 gap-3 text-xs text-left shadow-3xs">
                  <p className="text-[10px] text-slate-505 font-bold">মোট অনুদান ট্রানজেকশনঃ <span className="text-slate-850 font-mono font-black block mt-0.5">{allDonationsCount} টি</span></p>
                  <p className="text-[10px] text-slate-505 font-bold">মোট বিতরণকৃত ঋণঃ <span className="text-slate-850 font-mono font-black block mt-0.5">{qardHistory.filter(t => t.type === 'qard_loan_disbursment').length} বার</span></p>
                </div>

                <div className="bg-white border border-slate-150 rounded-3xl overflow-hidden divide-y divide-slate-150 shadow-3xs">
                  {qardHistory.length === 0 ? (
                    <p className="p-4 text-[10px] text-slate-400 italic text-center">কোনো লেনদেন রেকর্ড নেই।</p>
                  ) : (
                    <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-150">
                      {qardHistory.map((tx, idx) => (
                        <div key={`${tx.id || "tx"}-${idx}`} className="p-3 flex justify-between items-center text-xs hover:bg-slate-50/50 transition leading-none text-left">
                          <div className="space-y-0.5">
                            <p className="font-extrabold text-slate-800 text-[11.5px]">
                              {tx.type === 'qard_donation' && '❤️ অনুদান পেমেন্ট'}
                              {tx.type === 'qard_loan_request' && '⏳ ঋণের রিকোয়েস্ট'}
                              {tx.type === 'qard_loan_disbursment' && '💸 ঋণ বিতরণ'}
                              {tx.type === 'qard_loan_repayment' && '✅ ঋণ পরিশোধ'}
                              {tx.type === 'qard_withdrawal' && '📤 আমানত উত্তোলন'}
                            </p>
                            <p className="text-[9px] text-slate-400 font-sans mt-0.5">সদস্যঃ {tx.userName} • {tx.paymentMethod || 'Wallet'} • {new Date(tx.createdAt).toLocaleDateString('bn-BD')}</p>
                          </div>
                          <div className="text-right space-y-1">
                            <span className={"px-1.5 py-0.5 rounded text-[8px] font-black " + (tx.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : tx.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100')}>
                              {tx.status === 'success' ? 'সফল' : tx.status === 'pending' ? 'চলমান' : 'বাতিল'}
                            </span>
                            <p className="font-mono text-[10.5px] font-black text-rose-600">৳ {tx.amount}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ADMIN SUB: DONORS LIST */}
            {adminTab === 'donors' && (
              <div className="space-y-3 text-left font-sans">
                <h4 className="text-xs font-black text-slate-500">ফান্ডের অনুদানকারী সদস্য তালিকাঃ</h4>
                
                <div className="bg-white border border-slate-150 rounded-3xl overflow-hidden divide-y divide-slate-150 shadow-3xs">
                  {uniqueDonors.length === 0 ? (
                    <p className="p-4 text-[10px] text-slate-400 italic text-center">এখনো কোনো অনুদানকারী তালিকাভুক্ত হয়নি।</p>
                  ) : (
                    <div className="divide-y divide-slate-150">
                      {uniqueDonors.map((uId, idx) => {
                        const donorTxs = qardHistory.filter(t => t.userId === uId && t.status === 'success' && t.type === 'qard_donation');
                        const totalContribution = donorTxs.reduce((sum, t) => sum + t.amount, 0);
                        const firstTx = donorTxs[0];
                        const donorName = firstTx ? firstTx.userName : 'গোপন দাতা';
                        const donorId = firstTx ? firstTx.memberId : 'AMB00000000';
                        const donorTier = getDonorTier(totalContribution);

                        return (
                          <div key={uId || idx} className="p-3.5 flex justify-between items-center hover:bg-slate-50/50 transition">
                            <div>
                              <h5 className="text-[11.5px] font-extrabold text-slate-800">{donorName}</h5>
                              <p className="text-[9px] text-slate-450 mt-0.5">আইডিঃ {donorId} • মোট দানঃ {donorTxs.length} বার</p>
                              <span className={"inline-block mt-1 px-2.5 py-0.5 rounded-full text-[8px] font-bold border " + donorTier.color}>
                                {donorTier.name}
                              </span>
                            </div>
                            <span className="font-mono font-black text-emerald-600 text-xs">+৳ {totalContribution?.toLocaleString('bn-BD')}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ADMIN SUB: AUDIT LOGS */}
            {adminTab === 'allocation' && (
              <div className="space-y-3 text-left animate-fade-in">
                <h4 className="text-xs font-black text-slate-500">অডিট পর্যালোচনা ও কার্যক্রম লগঃ</h4>
                <div className="bg-white border border-slate-150 rounded-3xl p-4 font-mono text-[9px] text-slate-655 space-y-2 max-h-[300px] overflow-y-auto shadow-3xs animate-fade-in">
                  <p className="text-slate-450 border-b border-slate-100 pb-1.5">{new Date().toLocaleString('bn-BD')} • অ্যান্ডমিন প্যানেল সচল করা হয়েছে</p>
                  {qardHistory.filter(t => t.status === 'success').map((tx, idx) => (
                    <p key={`${tx.id || "tx"}-${idx}`} className="border-b border-slate-100 pb-1.5 leading-relaxed text-slate-600">
                      ⏳ {new Date(tx.createdAt).toLocaleDateString('bn-BD')} • {tx.userName} ({tx.memberId}) কর্তৃক ৳{tx.amount} এর {tx.type === 'qard_donation' ? 'অনুদান সফলভাবে বরাদ্দ ও রেকর্ডভুক্ত' : tx.type === 'qard_loan_repayment' ? 'ঋণ পরিশোধ রসিদ জেনারেট' : 'সুদমুক্ত ঋণ বিতরণ অনুমোদন সম্পন্ন'}
                    </p>
                  ))}
                  <p className="text-amber-600 font-bold">* উদ্যোক্তা কর্তৃক প্রারম্ভিক 55,000 টাকা কল্যাণ তহবিল সুচনা অডিট সম্পন্ন।</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: GOLD EMERGENCY LOAN (স্বর্ণ রেখে জরুরি টাকা) ==================== */}
        {activeTab === 'gold_loan' && (() => {
          const goldCfg = appConfig?.qardConfig?.goldLoanConfig || DEFAULT_QARD_CONFIG.goldLoanConfig;
          const activeGoldLoans = goldLoansList.filter(item => item.status !== 'cancelled');
          const totalGoldCash = activeGoldLoans.reduce((sum, item) => sum + (Number(item.cashAmount) || 0), 0);
          const totalMarketVal = activeGoldLoans.reduce((sum, item) => sum + (Number(item.marketValue) || 0), 0);
          const parsedCalcMarket = Number(calcMarketValue) || 0;
          const calcCash = parsedCalcMarket > 0 ? parsedCalcMarket : 0;
          const protMonths = goldCfg?.protectionMonths ?? 3;
          const protDays = goldCfg?.protectionDays ?? 90;

          const rates = goldCfg?.rates || {
            k24: 125000,
            k22: 115000,
            k21: 110000,
            k18: 95000,
            traditional: 80000
          };

          const guidelinesList = (goldCfg?.guidelines && goldCfg.guidelines.length > 0) ? goldCfg.guidelines : [
            { id: '1', icon: '👑', title: 'সমবায় সদস্যদের 100% সমপরিমাণ লোন সুবিধা', description: `BNB সমবায় সমিতির সদস্যরা ${protMonths} মাসের (${protDays} দিন) জন্য স্বর্ণের সমপরিমাণ (100% বাজারদর) পুরো টাকা ইমার্জেন্সি লোন নিতে পারবেন এবং ${protMonths} মাসের মধ্যে সমপরিমাণ মূল টাকা পরিশোধ করে স্বর্ণ ছাড়িয়ে নিতে পারবেন।` },
            { id: '2', icon: '👥', title: 'সাধারণ নাগরিকদের জন্য বাজারদর নীতি', description: 'যাঁরা সমবায় সমিতির সদস্য নন, তাঁরা প্রচলিত বাজার নীতি ও সাধারণ মূল্যায়নের ভিত্তিতে স্বর্ণ রেখে জরুরি আর্থিক সুবিধা গ্রহণ করতে পারবেন।' },
            { id: '3', icon: '💎', title: '0% সুদ ও সুদমুক্ত কল্যাণ সেবা', description: 'করযে হাসানা তহবিলের অধীনে সমবায় সদস্যদের জন্য কোনো প্রকার সুদ, অতিরিক্ত ফি বা হিডেন চার্জ কাটা হবে না।' },
            { id: '4', icon: '🔒', title: `${protMonths} মাসের সুরক্ষিত ভল্ট হেফাজত`, description: `নির্দিষ্ট সময়সীমার (${protMonths} মাস / ${protDays} দিন) পূর্বে আপনার সংরক্ষিত স্বর্ণ কোনো অবস্থাতেই বিক্রি বা হস্তান্তর করা হবে না।` },
            { id: '5', icon: '🤝', title: 'টাকা পরিশোধে অক্ষত স্বর্ণ ফেরত', description: 'গৃহীত মূল টাকা পরিশোধ করার সাথে সাথে আপনার গচ্ছিত স্বর্ণ শতভাগ অক্ষত অবস্থায় ফিরিয়ে দেওয়া হবে।' },
            { id: '6', icon: '🏛️', title: 'সিদ্ধান্তের পূর্বে নোটিশ ও ভল্ট ডায়েরি', description: 'মেয়াদ শেষ হলে যেকোনো পদক্ষেপ নেওয়ার পূর্বে সদস্যের সাথে যোগাযোগ করা হবে এবং প্রতিটি অলংকার অফিশিয়াল সিলযুক্ত ভল্টে সংরক্ষিত থাকে।' }
          ];

          const handleGoldLoanSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            setGoldErrorMsg('');
            setGoldSuccessMsg('');

            if (!goldJewelryType.trim()) {
              setGoldErrorMsg('অনুগ্রহ করে স্বর্ণের বিবরণ বা গহনার নাম লিখুন');
              return;
            }
            if (!goldWeightVori.trim() && !goldWeightGrams.trim()) {
              setGoldErrorMsg('অনুগ্রহ করে স্বর্ণের আনুমানিক ওজন (ভরি বা গ্রাম) লিখুন');
              return;
            }
            const mv = Number(goldMarketValue);
            if (!mv || mv <= 0) {
              setGoldErrorMsg('অনুগ্রহ করে স্বর্ণের আনুমানিক বাজারদর (টাকায়) লিখুন');
              return;
            }
            if (!goldAgreed) {
              setGoldErrorMsg('নীতিমালা ও শর্তাবলীতে সম্মতি প্রদান করুন');
              return;
            }

            setGoldSubmitting(true);
            try {
              const cashReceived = mv; // 100% equal market price (no extra +500)
              const expiryDateObj = new Date(Date.now() + protDays * 24 * 60 * 60 * 1000);
              
              addDoc(collection(db, 'admin_notifications'), {
                title: '👑 স্বর্ণ রেখে জরুরি টাকার নতুন আবেদন',
                message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ${goldJewelryType} (${goldCarat}) জমা রেখে ৳${cashReceived.toLocaleString('bn-BD')} জরুরি ঋণের আবেদন করেছেন।`,
                userId: user.uid,
                userName: user.name || '',
                memberId: user.memberId || '',
                userPhone: user.phone || '',
                marketValue: mv,
                cashAmount: cashReceived,
                type: 'gold_loan',
                read: false,
                createdAt: new Date().toISOString()
              }).catch(e => console.warn('Admin notif error:', e));
              await addDoc(collection(db, 'gold_loans'), {
                userId: user.uid,
                userName: user.name || 'সম্মানিত সদস্য',
                userPhone: user.phone || '',
                memberId: user.memberId || '',
                jewelryType: goldJewelryType,
                carat: goldCarat,
                weightVori: goldWeightVori || 'নির্দিষ্ট নয়',
                weightGrams: goldWeightGrams || 'নির্দিষ্ট নয়',
                marketValue: mv,
                extraBenefit: 0,
                cashAmount: cashReceived,
                altPhone: goldAltPhone || user.phone || '',
                address: goldAddress || (user as any).address || '',
                notes: goldNotes || '',
                status: 'active',
                collateralStatus: 'safe_in_vault',
                interestRate: 0,
                protectionMonths: protMonths,
                protectionDays: protDays,
                expiryDate: expiryDateObj.toISOString(),
                createdAt: serverTimestamp()
              });

              // Add notification
              await addDoc(collection(db, 'user_notifications'), {
                userId: user.uid,
                title: '🏦 স্বর্ণ রেখে জরুরি টাকার আবেদন গৃহীত হয়েছে',
                message: `আপনার ${goldJewelryType} (${goldCarat}) স্বর্ণ জমার বিপরীতে ৳${cashReceived.toLocaleString('bn-BD')} জরুরি সহায়তার আবেদন জমা হয়েছে। 100% সমান বাজারমূল্যে 0% সুদে স্বর্ণ ভল্ট হেফাজতে থাকবে।`,
                type: 'gold_loan',
                read: false,
                createdAt: serverTimestamp()
              });

              setGoldSuccessMsg(`অভিনন্দন! আপনার স্বর্ণ রেখে জরুরি টাকার আবেদনটি সফলভাবে গৃহীত হয়েছে। মোট অনুমোদিত ক্যাশ: ৳${cashReceived.toLocaleString('bn-BD')} (100% বাজারদর • 0% সুদ)।`);
              setGoldJewelryType('স্বর্ণের চেইন ও গহনা');
              setGoldWeightVori('');
              setGoldWeightGrams('');
              setGoldMarketValue('');
              setGoldAltPhone('');
              setGoldAddress('');
              setGoldNotes('');
              setGoldAgreed(false);
            } catch (err: any) {
              console.error("Gold loan submit error:", err);
              setGoldErrorMsg('আবেদন জমা দিতে সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।');
            } finally {
              setGoldSubmitting(false);
            }
          };

          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3.5 text-left font-sans animate-fade-in"
            >
              {/* Header Nav Card */}
              <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-600 text-white p-3.5 rounded-2.5xl shadow-md flex items-center justify-between relative overflow-hidden">
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center gap-2.5 relative z-10">
                  <button
                    onClick={() => {
                      setActiveTab('landing');
                      setGoldErrorMsg('');
                      setGoldSuccessMsg('');
                    }}
                    className="p-1.5 bg-white/15 hover:bg-white/25 rounded-xl border border-white/20 text-white transition active:scale-95 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Gem className="w-4 h-4 text-amber-200" />
                      <h3 className="text-sm font-black text-white font-sans leading-tight">
                        {goldCfg?.noticeTitle || "স্বর্ণ রেখে জরুরি টাকা"}
                      </h3>
                    </div>
                    <p className="text-[9.5px] text-amber-100/90 mt-0.5 font-bold">
                      {goldCfg?.noticeSubtitle || "বিপদের সময় পাশে থাকাই আমাদের মূল উদ্দেশ্য • 0% সুদ"}
                    </p>
                  </div>
                </div>

                <div className="bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/30 text-center shrink-0">
                  <span className="text-[8px] font-black text-amber-100 uppercase block leading-none">সুবিধাসমূহ</span>
                  <span className="text-[11px] font-black text-amber-200 font-mono">100% বাজারদর</span>
                </div>
              </div>

              {/* 1. Official Terms & Rules Box (Admin-Controlled & Read-Only for Members) */}
              <div className="bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 border-2 border-amber-200/90 rounded-2xl p-3.5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-amber-200/70">
                  <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[12.5px] font-black text-amber-950 font-sans leading-tight">
                      🏦 স্বর্ণ রেখে জরুরি টাকা গ্রহণের নিয়মাবলী
                    </h4>
                    <p className="text-[9.5px] text-amber-800 font-bold mt-0.5">
                      কারও হঠাৎ টাকার প্রয়োজন হলে, সে তার স্বর্ণ আমাদের কাছে রেখে জরুরি টাকা নিতে পারবে।
                    </p>
                  </div>
                </div>

                {/* 🌟 সমবায় সদস্য বনাম সাধারণ নাগরিক বিশেষ সুবিধা ও নীতিমালা কার্ড */}
                <div className="bg-white border-2 border-amber-300/80 rounded-2xl p-3 shadow-xs space-y-2.5">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-amber-100">
                    <Crown className="w-4 h-4 text-amber-600" />
                    <span className="text-[11px] font-black text-amber-950 uppercase tracking-wide">
                      সদস্য বনাম সাধারণ মানুষের সুবিধা ও নীতিমালা
                    </span>
                  </div>

                  {/* 👑 সমবায় সদস্যদের জন্য বিশেষ সুবিধা */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50/70 border border-emerald-200 rounded-xl p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-black uppercase">
                        👑 সমবায় সমিতির সদস্য
                      </span>
                      <strong className="text-[10.5px] font-black text-emerald-950">3 মাসের 100% জরুরি লোন সুবিধা</strong>
                    </div>
                    <p className="text-[10px] text-emerald-900 leading-relaxed font-medium">
                      BNB সমবায় সমিতির সদস্যরা <strong>3 মাসের জন্য স্বর্ণের যত টাকা (সমপরিমাণ 100% পুরো টাকা)</strong> জরুরি লোন নিতে পারবেন। পরবর্তীতে <strong>3 মাসের মধ্যে সমপরিমাণ মূল টাকা পরিশোধ করে</strong> নিরাপদে ও অক্ষত অবস্থায় নিজের স্বর্ণ ফেরত নিতে পারবেন (0% সুদ, কোনো অতিরিক্ত চার্জ নেই)।
                    </p>
                  </div>

                  {/* 👥 সাধারণ নাগরিকদের জন্য নিয়ম */}
                  <div className="bg-gradient-to-r from-slate-50 to-amber-50/40 border border-slate-200 rounded-xl p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-700 text-white text-[9px] font-black uppercase">
                        👥 সাধারণ মানুষ (অ-সদস্য)
                      </span>
                      <strong className="text-[10.5px] font-black text-slate-800">বাজার নিয়ম প্রযোজ্য</strong>
                    </div>
                    <p className="text-[10px] text-slate-700 leading-relaxed font-medium">
                      যাঁরা সমবায় সমিতির সদস্য নন, সাধারণ মানুষ হিসেবে তাঁদের ক্ষেত্রে প্রচলিত বাজার নিয়মাবলী ও নির্ধারিত মানসম্মত মূল্যায়নের ভিত্তিতে স্বর্ণ রেখে জরুরি ঋণ সুবিধা প্রদান করা হবে।
                    </p>
                  </div>
                </div>

                {/* Live Rules & Guidelines List */}
                <div className="space-y-2 text-[10.5px] text-slate-800 font-sans leading-relaxed">
                  {guidelinesList.map((g, idx) => (
                    <div key={g.id || idx} className="flex items-start gap-2 bg-white/90 p-2 rounded-xl border border-amber-150">
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="space-y-0.5">
                        <strong className="text-slate-900 block font-bold">{g.title}</strong>
                        <p className="text-[10px] text-slate-600 font-medium">{g.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 🤝 আমাদের উদ্দেশ্য Box */}
                <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-teal-950 text-white p-3 rounded-xl shadow-xs space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🤝</span>
                    <h5 className="text-[11px] font-black text-emerald-300 uppercase tracking-wide">আমাদের উদ্দেশ্য</h5>
                  </div>
                  <p className="text-[10px] text-teal-100 font-medium leading-relaxed">
                    বাংলাদেশের যেকোনো মানুষ বিপদে পড়লে সহজে স্বর্ণের নিরাপত্তার মাধ্যমে সমান সমান বাজারমূল্যে জরুরি আর্থিক সহায়তা পেতে পারে।
                  </p>
                  <p className="text-[10.5px] text-amber-300 font-black italic pt-0.5 border-t border-teal-800">
                    “বিপদের সময় পাশে থাকাই আমাদের মূল উদ্দেশ্য।”
                  </p>
                </div>
              </div>

              {/* সদস্যের স্বর্ণ বন্ধক ও জরুরি টাকা খতিয়ান (My Gold Collateral Summary & Active Accounts) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-[11px] font-black text-slate-900 uppercase">
                      আমার স্বর্ণ জমা ও লোন খতিয়ান
                    </h4>
                  </div>
                  <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                    {activeGoldLoans.length}টি সংরক্ষিত রেকর্ড
                  </span>
                </div>

                {/* Stats Overview Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-amber-50/70 border border-amber-200/70 p-2.5 rounded-xl">
                    <span className="text-[8.5px] font-black text-amber-900 block uppercase">গৃহীত মোট জরুরি টাকা</span>
                    <h3 className="text-base font-black text-amber-950 font-mono mt-0.5">
                      ৳{totalGoldCash.toLocaleString('bn-BD')}
                    </h3>
                    <span className="text-[7.5px] font-extrabold text-amber-700 block mt-0.5">
                      (সমান সমান বাজারমূল্য: ৳{totalMarketVal.toLocaleString('bn-BD')})
                    </span>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-200/70 p-2.5 rounded-xl flex flex-col justify-between">
                    <div>
                      <span className="text-[8.5px] font-black text-emerald-900 block uppercase">হেফাজত ও নিরাপত্তা</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[11px] font-black text-emerald-900">ভল্টে নিরাপদ</span>
                      </div>
                    </div>
                    <span className="text-[7.5px] font-bold text-emerald-700 block mt-0.5">
                      0% সুদ • {protMonths} মাস ({protDays} দিন) অক্ষত সুরক্ষা
                    </span>
                  </div>
                </div>

                {/* Member's Active Gold Records List */}
                {activeGoldLoans.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {activeGoldLoans.map((loan, idx) => (
                      <div key={loan.id || idx} className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 space-y-1.5 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-900 flex items-center gap-1">
                            <Gem className="w-3 h-3 text-amber-600" />
                            {loan.jewelryType || 'স্বর্ণের গহনা'} ({loan.carat || '22 ক্যারেট'})
                          </span>
                          <span className="bg-emerald-600 text-white font-mono text-[8px] font-black px-1.5 py-0.5 rounded">
                            নিরাপদ ভল্ট
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-600 bg-white p-1.5 rounded-lg border border-slate-150">
                          <div>
                            <span>ওজন: </span>
                            <strong className="text-slate-900 font-mono">{loan.weightVori || loan.weightGrams || '1 ভরি'}</strong>
                          </div>
                          <div>
                            <span>বাজারদর: </span>
                            <strong className="text-slate-900 font-mono">৳{(Number(loan.marketValue) || 0).toLocaleString('bn-BD')}</strong>
                          </div>
                          <div className="col-span-2">
                            <span>প্রাপ্ত জরুরি ক্যাশ: </span>
                            <strong className="text-emerald-700 font-mono font-bold">৳{(Number(loan.cashAmount) || 0).toLocaleString('bn-BD')} (100% বাজারমূল্য)</strong>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[8px] text-slate-500 font-semibold pt-0.5">
                          <span>📅 জমার তারিখ: {loan.createdAt?.toDate ? loan.createdAt.toDate().toLocaleDateString('bn-BD') : 'চলতি মাস'}</span>
                          <span className="text-rose-700 font-bold">
                            {loan.expiryDate ? `মেয়াদ: ${new Date(loan.expiryDate).toLocaleDateString('bn-BD')}` : `${loan.protectionMonths || protMonths} মাস বিক্রিমুক্ত সুরক্ষা`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-200 p-2.5 rounded-xl text-center text-slate-500 text-[10px]">
                    বর্তমানে আপনার কোনো সক্রিয় স্বর্ণ বন্ধক নেই। প্রয়োজন হলে নিচের ফর্মটি পূরণ করে স্বর্ণ রেখে নগদ টাকা গ্রহণ করুন।
                  </div>
                )}
              </div>

              {/* 4. Live Gold Value Calculator (জরুরি টাকার ক্যালকুলেটর) */}
              <div className="bg-gradient-to-br from-amber-50/50 via-white to-yellow-50/40 border border-amber-200/90 rounded-2xl p-3 shadow-2xs space-y-2">
                <div className="flex items-center gap-1.5 pb-1 border-b border-amber-150">
                  <Calculator className="w-3.5 h-3.5 text-amber-700" />
                  <h4 className="text-[11px] font-black text-amber-950 uppercase">
                    স্বর্ণের বাজারদর ও ক্যাশ ক্যালকুলেটর (100% বাজারদর)
                  </h4>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9.5px] font-bold text-slate-700 block">
                    স্বর্ণের আনুমানিক বর্তমান বাজার বিক্রয়মূল্য লিখুন (৳):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={calcMarketValue}
                      onChange={(e) => setCalcMarketValue(e.target.value)}
                      placeholder="যেমন: 200000"
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="absolute right-3 top-2 text-xs font-black text-amber-700">৳</span>
                  </div>
                </div>

                {/* Calculation Output Box */}
                <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white p-2.5 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-[10px] font-bold border-b border-white/20 pb-1">
                    <span>স্বর্ণের বাজারদর (100%):</span>
                    <span className="font-mono">৳{parsedCalcMarket.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-black text-yellow-200 border-b border-white/20 pb-1">
                    <span>প্রদেয় অনুপাত ও সুদ:</span>
                    <span>সমান সমান টাকা (0% সুদ)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-black pt-0.5">
                    <span>আপনি তাৎক্ষণিক পাবেন:</span>
                    <span className="text-sm font-mono text-white bg-white/20 px-2 py-0.5 rounded-lg">
                      ৳{calcCash.toLocaleString('bn-BD')}
                    </span>
                  </div>
                  <div className="text-[8px] text-amber-100 font-bold text-center pt-0.5">
                    ✓ কোনো লাভ বা সুদ কাটা হবে না • টাকা পরিশোধ করলে আপনার স্বর্ণ ফিরিয়ে দেওয়া হবে
                  </div>
                </div>
              </div>

              {/* 5. Gold Loan Application Form (স্বর্ণ রেখে জরুরি টাকার আবেদন ফর্ম) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <div>
                    <h4 className="text-[11.5px] font-black text-slate-900 uppercase">
                      স্বর্ণ জমা দিয়ে জরুরি ক্যাশ নেওয়ার আবেদন
                    </h4>
                    <p className="text-[9px] text-slate-500">
                      নিচের তথ্যগুলো দিয়ে আবেদন জমা দিলে আমাদের প্রতিনিধি যোগাযোগ করে দ্রুত ক্যাশ প্রদান করবেন।
                    </p>
                  </div>
                </div>

                {goldSuccessMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-[10px] text-emerald-900 font-bold flex items-start gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{goldSuccessMsg}</span>
                  </div>
                )}

                {goldErrorMsg && (
                  <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-[10px] text-rose-900 font-bold flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{goldErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleGoldLoanSubmit} className="space-y-2.5 text-left">
                  {/* Jewelry Type & Carat */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-700 block">গহনার ধরন / বিবরণ *</label>
                      <input
                        type="text"
                        value={goldJewelryType}
                        onChange={(e) => setGoldJewelryType(e.target.value)}
                        placeholder="যেমন: গলার চেইন, বালা, আংটি"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-700 block">স্বর্ণের ক্যারেট *</label>
                      <select
                        value={goldCarat}
                        onChange={(e) => setGoldCarat(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                      >
                        <option value="22k">22 ক্যারেট (22K)</option>
                        <option value="21k">21 ক্যারেট (21K)</option>
                        <option value="18k">18 ক্যারেট (18K)</option>
                        <option value="24k">24 ক্যারেট খাঁটি স্বর্ণ (24K)</option>
                        <option value="traditional">সনাতন পদ্ধতি (Traditional)</option>
                      </select>
                    </div>
                  </div>

                  {/* Weight in Vori and Grams */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-700 block">ওজন (ভরি / আনা / রতি)</label>
                      <input
                        type="text"
                        value={goldWeightVori}
                        onChange={(e) => setGoldWeightVori(e.target.value)}
                        placeholder="যেমন: 1 ভরি 4 আনা"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-700 block">ওজন (গ্রাম - যদি জানা থাকে)</label>
                      <input
                        type="text"
                        value={goldWeightGrams}
                        onChange={(e) => setGoldWeightGrams(e.target.value)}
                        placeholder="যেমন: 11.66 গ্রাম"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Market Value & Equal Cash */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-700 block">
                      স্বর্ণের আনুমানিক বাজার বিক্রয়মূল্য (টাকায়) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={goldMarketValue}
                        onChange={(e) => setGoldMarketValue(e.target.value)}
                        placeholder="যেমন: 200000"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        required
                      />
                      <span className="absolute right-2.5 top-1.5 text-xs font-bold text-slate-400">৳</span>
                    </div>

                    {Number(goldMarketValue) > 0 && (
                      <div className="bg-amber-50 border border-amber-200/80 p-2 rounded-lg text-[9.5px] text-amber-950 font-bold flex items-center justify-between">
                        <span>বাজারদর অনুযায়ী আপনার প্রাপ্য জরুরি ক্যাশ (100%):</span>
                        <strong className="text-emerald-700 font-mono text-[11px]">
                          ৳{(Number(goldMarketValue)).toLocaleString('bn-BD')}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Contact Phone & Address */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-700 block">যোগাযোগের মোবাইল নম্বর</label>
                      <input
                        type="text"
                        value={goldAltPhone || user.phone || ''}
                        onChange={(e) => setGoldAltPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-700 block">ঠিকানা / এলাকা</label>
                      <input
                        type="text"
                        value={goldAddress}
                        onChange={(e) => setGoldAddress(e.target.value)}
                        placeholder="আপনার বর্তমান ঠিকানা"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-700 block">জরুরি মন্তব্য / বিশেষ নোট (ঐচ্ছিক)</label>
                    <textarea
                      value={goldNotes}
                      onChange={(e) => setGoldNotes(e.target.value)}
                      placeholder="কোনো বিশেষ তথ্য থাকলে এখানে লিখুন..."
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Agreement Checkbox */}
                  <div className="flex items-start gap-2 bg-amber-50/70 p-2 rounded-xl border border-amber-200/80">
                    <input
                      type="checkbox"
                      id="goldAgreeCheck"
                      checked={goldAgreed}
                      onChange={(e) => setGoldAgreed(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="goldAgreeCheck" className="text-[9.5px] text-slate-800 font-semibold cursor-pointer">
                      আমি নিশ্চিত করছি যে স্বর্ণটি আমার নিজস্ব এবং আমি স্বর্ণ রেখে জরুরি টাকার সব নিয়মাবলী ও {protMonths} মাসের ({protDays} দিন) সুরক্ষা শর্তসমূহ পড়েছি ও সম্মতি প্রদান করছি।
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={goldSubmitting}
                    className="w-full bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 active:scale-95 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {goldSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>আবেদন জমা হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Gem className="w-4 h-4" />
                        <span>স্বর্ণ জমা দিয়ে জরুরি ক্যাশের আবেদন পাঠান</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Bottom Back Button */}
              <button
                onClick={() => setActiveTab('landing')}
                className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-xl text-xs transition shadow-3xs text-center cursor-pointer"
              >
                ← করযে হাসানা হোমে ফিরে যান
              </button>
            </motion.div>
          );
        })()}
      </main>

      {/* ==================== DIGITAL RECEIPT MODAL POPUP ==================== */}
      {showReceiptModal && receiptData && (
        <AmbPaymentReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setReceiptData(null);
          }}
          data={{
            typeLabel: receiptData.typeLabel || 'করযে হাসানা অনুদান / ঋণ লেনদেন',
            transactionId: receiptData.transactionId || receiptData.receiptNo || `QRD${Date.now()}`,
            amount: receiptData.amount || 0,
            fee: 0,
            totalAmount: receiptData.amount || 0,
            status: 'success',
            beneficiaryName: receiptData.userName || user.name || 'AMB সদস্য',
            beneficiaryAccount: receiptData.memberId || user.memberId || user.phone,
            senderPhone: user.phone,
            transactionDate: receiptData.createdAt ? new Date(receiptData.createdAt).toLocaleString('bn-BD') : new Date().toLocaleString('bn-BD')
          }}
          onNewTransaction={() => {
            setShowReceiptModal(false);
            setReceiptData(null);
          }}
          onViewHistory={() => {
            setShowReceiptModal(false);
            setReceiptData(null);
          }}
        />
      )}

      {/* ==================== MEMORANDUM OF RECOGNITION CERTIFICATE MODAL ==================== */}
      {showCertificate && (
        <div className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center p-4 backdrop-blur-xs text-slate-800 font-serif">
          <div className="bg-stone-50 border-[6px] border-amber-600/30 p-2 rounded-3xl max-w-lg w-full shadow-2xl relative">
            
            {/* Gold bordered certificate layout */}
            <div className="border border-amber-600/60 p-6 md:p-8 space-y-6 text-center text-xs relative overflow-hidden bg-stone-50">
              
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-yellow-300/10 to-transparent pointer-events-none rotate-45" />

              <div className="space-y-1">
                <span className="text-[8px] tracking-widest font-sans font-black text-amber-700/80 uppercase">Certificate of Appreciation</span>
                <h3 className="text-xl md:text-2xl font-black text-amber-800 font-serif tracking-tight">উদারতা ও কন্ট্রিবিউশন সম্মাননাপত্র</h3>
                <p className="text-[8px] font-sans text-stone-500 font-extrabold uppercase mt-1">AMB Business Cooperative Co. Welfare Fund</p>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] text-stone-500 font-sans italic block">অত্যন্ত কৃতজ্ঞতা ও শ্রদ্ধার সাথে এই সম্মাননাপত্র প্রদান করা হচ্ছে</span>
                <h4 className="text-lg font-bold text-stone-900 border-b border-stone-200 pb-2 max-w-sm mx-auto tracking-normal font-sans">
                  {user.name}
                </h4>
                <p className="text-[11px] leading-relaxed text-stone-600 max-w-md mx-auto italic">
                  "যিনি উম্মাহর সেবায় এবং সুদমুক্ত ঋণ প্রদানের মহৎ লক্ষ্য পুনরুজ্জীবিত করতে ‘করযে হাসানা কল্যাণ তহবিল’ সৃষ্টিতে উদারচিত্তে অবদান রেখেছেন। আপনার এই অগ্রযাত্রা সদকা জারিয়া হিসেবে চীরকাল সমাদৃত থাকবে।"
                </p>
              </div>

              {/* Category Medal Stamp showcase */}
              <div className="flex justify-center items-center gap-1.5 py-2">
                <div className="px-5 py-2 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-400 rounded-2xl shadow-sm text-center">
                  <span className="text-[8px] font-sans font-black text-amber-800 uppercase block tracking-wider">দাতা ক্যাটাগরিঃ</span>
                  <strong className="text-sm font-black font-sans text-amber-900 uppercase tracking-tight block mt-0.5">
                    {userTier.name.split(' (')[0]}
                  </strong>
                </div>
              </div>

              <div className="flex justify-between items-end pt-4 text-[9px] font-sans text-stone-500 text-left">
                <div className="space-y-0.5">
                  <p>সার্টিফিকেট আইডিঃ AMB/QRD-{user.memberId?.slice(-5)}</p>
                  <p>প্রদানের তারিখঃ {new Date().toLocaleDateString('bn-BD')}</p>
                </div>
                <div className="border-t border-stone-300 pt-1 text-center pr-2">
                  <p className="font-serif font-black text-amber-900 italic">AMB Board of Directors</p>
                  <p className="text-[8px] text-stone-400 tracking-wide mt-0.5">অফিসিয়াল প্রধান পরিচালক</p>
                </div>
              </div>

            </div>

            {/* Close control bar */}
            <div className="absolute top-3 right-3">
              <button 
                onClick={() => setShowCertificate(false)}
                className="w-8 h-8 rounded-full bg-slate-900/10 border border-transparent flex items-center justify-center font-sans hover:bg-slate-900/20 font-black cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Bottom action panel */}
            <div className="mt-4 flex gap-2 p-2">
              <button
                onClick={() => alert('আপনার ডিভাইস সংস্কৃতির সাথে মিল রেখে সম্মাননা প্রশংসাপত্রটি PDF ফরম্যাটে ডাউনলোড শুরু হয়েছে!')}
                className="flex-1 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-black text-xs font-sans text-center transition flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4 text-white" />
                প্রশংসাপত্র PDF ডাউনলোড করুন
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold font-sans rounded-xl transition"
              >
                প্রিন্ট করুন
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= LOCALIZED QARD TRANSACTION HISTORY MODAL ================= */}
      <AnimatePresence>
        {showSectionTxHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans text-slate-800"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-rose-700 to-pink-850 text-white px-5 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-pink-100" />
                  <div>
                    <h3 className="text-sm font-black text-white">করযে হাসানা লেনদেন সমূহ</h3>
                    <p className="text-[10px] text-pink-100 font-medium">আপনার অনুদান ও সুদমুক্ত ঋণ সংক্রান্ত সকল লেনদেন বিবরণী</p>
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
                    placeholder="পরিমাণ, বিবরণ বা আইডি দিয়ে খুঁজুন..."
                    className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-2xl text-xs font-medium focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600"
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
                {(() => {
                  const filteredTxs = qardHistory.filter(tx => {
                    const isUserTx = tx.userId === user.uid;
                    if (!isUserTx) return false;

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
                        আপনার করযে হাসানা তহবিল লেনদেন রেকর্ড পাওয়া যায়নি।
                      </div>
                    );
                  }

                  return filteredTxs.map((tx, idx) => {
                    const isDonation = tx.type === 'qard_donation';
                    return (
                      <div key={`${tx.id}-${idx}`} className="p-3 bg-white border border-slate-150 rounded-2xl shadow-3xs flex justify-between items-start gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-black text-slate-800 block">{tx.typeLabel || 'করযে হাসানা দান'}</span>
                          <span className="text-[10px] text-slate-400 block font-medium">
                            {new Date(tx.createdAt).toLocaleDateString('bn-BD')} {new Date(tx.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <p className="text-[10.5px] text-slate-600 font-bold leading-normal">{tx.description}</p>
                          {tx.receiptNo && (
                            <span className="inline-block text-[9px] bg-slate-100 text-slate-500 font-mono px-2 py-0.5 rounded-md">
                              Receipt: {tx.receiptNo}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <span className={`text-xs font-black font-mono block ${isDonation ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {isDonation ? '-' : '+'} ৳{tx.amount.toLocaleString('bn-BD')}
                          </span>
                          <span className={`inline-block text-[8.5px] font-extrabold px-1.5 py-0.2 rounded-md uppercase block ${
                            tx.status === 'success' || tx.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            tx.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {tx.status === 'success' || tx.status === 'approved' ? 'সফল' : tx.status === 'pending' ? 'অপেক্ষমাণ' : 'ব্যর্থ'}
                          </span>
                          <button
                            onClick={() => showReceiptForTx(tx)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[8.5px] font-sans font-extrabold rounded-md shadow-3xs cursor-pointer block mt-1 ml-auto"
                          >
                            ডিজিটাল রসিদ
                          </button>
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== DONORS & CONTRIBUTORS MODAL (কে টাকা দিয়েছে) ==================== */}
      <AnimatePresence>
        {showDonorsModal && (() => {
          const liveDonationsList = qardHistory
            .filter(t => t.type === 'qard_donation' && t.status === 'success')
            .map((t, idx) => {
              const uInfo = usersMap[t.userId] || (t.userPhone ? usersMap[t.userPhone] : null) || (t.memberId ? usersMap[t.memberId] : null);
              const memberName = uInfo?.name || t.userName || 'দানশীল সদস্য';
              const memberPhoto = uInfo?.photoURL || uInfo?.photo || t.userPhoto || t.photoURL || '';
              const initialLetter = (memberName || 'দ').trim().charAt(0).toUpperCase();

              return {
                name: memberName,
                relationship: 'সদস্য',
                amount: t.amount?.toLocaleString('bn-BD') || '0',
                rawAmount: t.amount || 0,
                date: t.createdAt ? new Date(t.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A',
                type: 'donation',
                typeLabel: t.description?.includes('মাসিক') ? 'মাসিক অনুদান' : (t.description?.includes('আমানত') ? 'কল্যাণ আমানত' : 'স্বেচ্ছা অনুদান'),
                image: memberPhoto,
                initialLetter,
                phone: t.userPhone || ''
              };
            });

          // সর্বোচ্চ থেকে সর্বনিম্ন ক্রমানুসারে সাজানো (Descending Sort: Highest to Lowest)
          liveDonationsList.sort((a, b) => b.rawAmount - a.rawAmount);

          const filtered = liveDonationsList.filter(d => 
            !donorsSearchQuery.trim() || 
            d.name.toLowerCase().includes(donorsSearchQuery.toLowerCase()) ||
            String(d.rawAmount).includes(donorsSearchQuery) ||
            d.amount.includes(donorsSearchQuery) ||
            d.typeLabel.toLowerCase().includes(donorsSearchQuery.toLowerCase())
          );

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
              onClick={() => setShowDonorsModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[88vh] text-left"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 flex items-center justify-between shrink-0 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">ফান্ডে দান ও আমানতকারী সদস্যবৃন্দ</h3>
                      <p className="text-[10px] text-emerald-100 font-semibold">কল্যাণমুখী সুদমুক্ত তহবিলের দাতা সদস্যদের তালিকা</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDonorsModal(false)}
                    className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Highlights Banner */}
                <div className="bg-emerald-50 border-b border-emerald-100 p-3.5 flex items-center justify-between shrink-0">
                  <div className="text-left">
                    <span className="text-[9px] text-emerald-800 font-extrabold uppercase block">মোট সংগৃহীত ফান্ড</span>
                    <span className="text-base font-black text-emerald-900 font-mono">৳ {qardTotalFund?.toLocaleString('bn-BD')} BDT</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-emerald-800 font-extrabold uppercase block">মোট দাতা সদস্য</span>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block">
                      {liveDonationsList.length} জন
                    </span>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="সদস্যের নাম বা টাকার পরিমাণ লিখে খুঁজুন..."
                      value={donorsSearchQuery}
                      onChange={(e) => setDonorsSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-sans font-bold"
                    />
                    {donorsSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setDonorsSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Scrollable List */}
                <div className="p-3 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 space-y-2">
                      <Heart className="w-10 h-10 text-slate-300 mx-auto opacity-50" />
                      <p className="text-xs font-bold text-slate-600">কোনো দাতার রেকর্ড পাওয়া যায়নি</p>
                      <p className="text-[10px] text-slate-400">সদস্যগণ ফান্ডে অনুদান বা আমানত জমা দিলে স্বয়ংক্রিয়ভাবে এখানে যুক্ত হবে।</p>
                    </div>
                  ) : (
                    filtered.map((item, idx) => (
                      <div key={idx} className="pt-2.5 first:pt-0 flex items-center justify-between gap-2.5 hover:bg-slate-50/80 p-1.5 rounded-xl transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shrink-0 shadow-3xs"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                                const fallback = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-black text-sm flex items-center justify-center shrink-0 border border-emerald-300 shadow-3xs ${item.image ? 'hidden' : 'flex'}`}>
                            {item.initialLetter}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-extrabold text-slate-800 truncate">{item.name}</h4>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold flex-wrap mt-0.5">
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-150">{item.relationship}</span>
                              <span>•</span>
                              <span>{item.date}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-emerald-600 font-mono block">
                            ৳ {item.amount}
                          </span>
                          <span className="text-[8.5px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full inline-block mt-0.5">
                            {item.typeLabel}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer Action */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDonorsModal(false);
                      setActiveTab('donate');
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Heart className="w-4 h-4 text-white" />
                    <span>আমিও ফান্ডে টাকা জমা বা দান করতে চাই</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ==================== BORROWERS MODAL (কে ঋণ নিয়েছে / কিস্তি খতিয়ান) ==================== */}
      <AnimatePresence>
        {showBorrowersModal && (() => {
          const liveLoansList = qardHistory
            .filter(t => t.type === 'qard_loan_disbursment' && t.status === 'success')
            .map((t, idx) => {
              const repayments = qardHistory
                .filter(rp => rp.type === 'qard_loan_repayment' && rp.status === 'success' && rp.userId === t.userId);
              const totalRepaidAmount = repayments.reduce((sum, r) => sum + r.amount, 0);
              const remaining = Math.max(0, t.amount - totalRepaidAmount);
              const isComplete = remaining === 0;

              const uInfo = usersMap[t.userId] || (t.userPhone ? usersMap[t.userPhone] : null) || (t.memberId ? usersMap[t.memberId] : null);
              const memberName = uInfo?.name || t.userName || 'সম্মানিত সদস্য';
              const memberPhoto = uInfo?.photoURL || uInfo?.photo || t.userPhoto || t.photoURL || '';
              const initialLetter = (memberName || 'স').trim().charAt(0).toUpperCase();

              return {
                name: memberName,
                role: 'সদস্য',
                amount: t.amount?.toLocaleString('bn-BD') || '0',
                rawAmount: t.amount || 0,
                installments: isComplete ? '3/3' : '1/3',
                dueAmount: remaining?.toLocaleString('bn-BD') || '0',
                rawDueAmount: remaining,
                nextInstallment: t.loanDuration ? (t.loanDuration + ' মাস') : 'চলতি মাস',
                isComplete,
                date: t.createdAt ? new Date(t.createdAt).toLocaleDateString('bn-BD') : 'N/A',
                image: memberPhoto,
                initialLetter
              };
            });

          // সর্বোচ্চ থেকে সর্বনিম্ন ঋণের পরিমাণ ক্রমানুসারে সাজানো (Descending Sort: Highest to Lowest)
          liveLoansList.sort((a, b) => b.rawAmount - a.rawAmount);

          const filtered = liveLoansList.filter(b => 
            !borrowersSearchQuery.trim() || 
            b.name.toLowerCase().includes(borrowersSearchQuery.toLowerCase()) ||
            String(b.rawAmount).includes(borrowersSearchQuery) ||
            b.amount.includes(borrowersSearchQuery)
          );

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
              onClick={() => setShowBorrowersModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[88vh] text-left"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-amber-700 text-white p-4 flex items-center justify-between shrink-0 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                      <Coins className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">সুদমুক্ত ঋণ গ্রহীতা ও কিস্তি খতিয়ান</h3>
                      <p className="text-[10px] text-rose-100 font-semibold">সকল ঋণ অনুমোদন ও পরিশোধ ট্র্যাকিং</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBorrowersModal(false)}
                    className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Highlights Banner */}
                <div className="bg-rose-50 border-b border-rose-100 p-3.5 flex items-center justify-between shrink-0">
                  <div className="text-left">
                    <span className="text-[9px] text-rose-800 font-extrabold uppercase block">মোট ঋণ বিতরণ</span>
                    <span className="text-base font-black text-rose-900 font-mono">৳ {qardActiveLoansAmount?.toLocaleString('bn-BD')} BDT</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-rose-800 font-extrabold uppercase block">মোট গ্রহীতা</span>
                    <span className="text-xs font-black text-rose-800 bg-rose-100/90 border border-rose-200 px-2.5 py-0.5 rounded-full inline-block">
                      {liveLoansList.length} জন
                    </span>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ঋণগ্রহীতার নাম বা টাকার অংক লিখে খুঁজুন..."
                      value={borrowersSearchQuery}
                      onChange={(e) => setBorrowersSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 font-sans font-bold"
                    />
                    {borrowersSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setBorrowersSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Scrollable List */}
                <div className="p-3 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 space-y-2">
                      <Coins className="w-10 h-10 text-slate-300 mx-auto opacity-50" />
                      <p className="text-xs font-bold text-slate-600">কোনো ঋণগ্রহীতার রেকর্ড পাওয়া যায়নি</p>
                      <p className="text-[10px] text-slate-400">নতুন ঋণ অনুমোদন হলে রিয়েল-টাইম কিস্তির বিবরণ এখানে দেখাবে।</p>
                    </div>
                  ) : (
                    filtered.map((item, idx) => (
                      <div key={idx} className="pt-2.5 first:pt-0 bg-white p-2.5 rounded-2xl border border-slate-150 hover:border-rose-200 space-y-2 shadow-4xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-8 h-8 rounded-full object-cover border border-emerald-500 shrink-0"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                  const fallback = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-400 ${item.image ? 'hidden' : 'flex'}`}>
                              {item.initialLetter}
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-slate-800">{item.name}</h4>
                              <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-bold">{item.role}</span>
                            </div>
                          </div>

                          <div>
                            {item.isComplete ? (
                              <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                ✓ পরিশোধ সম্পন্ন
                              </span>
                            ) : (
                              <span className="text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                ⏳ কিস্তি চলমান
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-xl text-center text-[10px]">
                          <div>
                            <span className="text-slate-400 text-[8px] font-bold block">নেয়া টাকা</span>
                            <span className="font-mono font-black text-slate-800">৳ {item.amount}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[8px] font-bold block">কিস্তি</span>
                            <span className="font-mono font-black text-emerald-700">{item.installments}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[8px] font-bold block">পরিশোধ বাকি</span>
                            <span className={'font-mono font-black ' + (item.isComplete ? 'text-emerald-700' : 'text-rose-600')}>
                              ৳ {item.dueAmount}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer Action */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBorrowersModal(false);
                      setActiveTab('apply');
                    }}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Coins className="w-4 h-4 text-white" />
                    <span>সুদমুক্ত ঋণ নিতে আবেদন করুন</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ==================== REPAYMENT MODAL (টাকা/ঋণ পরিশোধ ও অগ্রিম পরিশোধ) ==================== */}
      <AnimatePresence>
        {showRepayModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowRepayModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 text-left my-auto"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                    <Zap className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 font-sans">
                      করযে হাসানা টাকা/ঋণ পরিশোধ কেন্দ্র
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold">
                      1 দিন, 1 সপ্তাহ বা যেকোনো সময় অগ্রিম পরিশোধ ব্যবস্থা
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRepayModal(false)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition active:scale-90 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Info Card */}
              <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-pink-50 border border-amber-200/80 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-amber-800 font-extrabold uppercase block">আপনার বর্তমান বকেয়া ঋণ</span>
                  <strong className="text-base font-mono font-black text-rose-700">
                    ৳ {(user.dueLoan || 0).toLocaleString('bn-BD')} BDT
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase block">মেইন ব্যালেন্স</span>
                  <strong className="text-sm font-mono font-black text-emerald-700">
                    ৳ {(user.balance || 0).toLocaleString('bn-BD')} BDT
                  </strong>
                </div>
              </div>

              {/* Notice Banner */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-200/80 rounded-2xl text-[10.5px] text-emerald-950 font-bold leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-800 font-black">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>অগ্রিম ও যেকোনো সময় পরিশোধের সুবিধাঃ</span>
                </div>
                <p className="text-slate-700">
                  করযে হাসানা থেকে 1 মাস অথবা 3 মাসের মেয়াদে হাওলাত নেওয়ার পর, আপনি চাইলে 1 মাস অপেক্ষা না করে **1 দিন পরে, 1 সপ্তাহ পরে অথবা যেকোনো দিন** একাউন্টের মেইন ওয়ালেট ব্যালেন্স থেকে সম্পূর্ণ বকেয়া অথবা আংশিক কিস্তি অগ্রিম পরিশোধ করতে পারবেন।
                </p>
              </div>

              {user.dueLoan && user.dueLoan > 0 ? (
                /* Execution Form if user has due loan */
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-black text-slate-800">
                    পরিশোধের পরিমাণ নির্বাচন বা প্রদান করুন (৳):
                  </label>

                  {/* Preset quick buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomRepayInput(String(Math.min(user.dueLoan || 0, Math.ceil((user.dueLoan || 0) / 3))))}
                      className={`p-2.5 rounded-xl border text-xs font-extrabold transition cursor-pointer flex flex-col items-center justify-center ${
                        customRepayInput === String(Math.min(user.dueLoan || 0, Math.ceil((user.dueLoan || 0) / 3)))
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>1 কিস্তি পরিশোধ</span>
                      <span className="text-[9.5px] opacity-90 font-mono">৳ {Math.min(user.dueLoan || 0, Math.ceil((user.dueLoan || 0) / 3)).toLocaleString('bn-BD')} BDT</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCustomRepayInput(String(user.dueLoan))}
                      className={`p-2.5 rounded-xl border text-xs font-extrabold transition cursor-pointer flex flex-col items-center justify-center ${
                        customRepayInput === String(user.dueLoan) || (!customRepayInput && user.dueLoan > 0)
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>সম্পূর্ণ ঋণ পরিশোধ</span>
                      <span className="text-[9.5px] opacity-90 font-mono">৳ {user.dueLoan.toLocaleString('bn-BD')} BDT</span>
                    </button>
                  </div>

                  {/* Custom Input */}
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">৳</span>
                    <input
                      type="number"
                      value={customRepayInput}
                      onChange={(e) => setCustomRepayInput(e.target.value)}
                      placeholder={`নিজের ইচ্ছেমতো টাকার পরিমাণ লিখুন (উদাঃ ${user.dueLoan})`}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Execute Button */}
                  <button
                    onClick={async () => {
                      const amtToPay = parseFloat(customRepayInput) || user.dueLoan || 0;
                      await handleLoanRepay(amtToPay);
                      setShowRepayModal(false);
                    }}
                    disabled={loading}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-2xl active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Coins className="w-4 h-4 text-white" />
                    ওয়ালেট থেকে এক্ষুণি ৳ {(parseFloat(customRepayInput) || user.dueLoan || 0).toLocaleString('bn-BD')} BDT পরিশোধ করুন
                  </button>
                </div>
              ) : (
                /* Clear status message if no due loan */
                <div className="text-center py-4 space-y-3 bg-slate-50 border border-slate-100 rounded-2xl">
                  <span className="text-2xl block">🎉</span>
                  <h4 className="text-xs font-black text-slate-800">আপনার কোনো বকেয়া করযে হাসানা ঋণ নেই!</h4>
                  <p className="text-[10.5px] text-slate-500 font-bold px-4">
                    আপনার একাউন্টে বর্তমানে কোনো বকেয়া নেই। প্রয়োজন হলে আপনি সহজেই 1 মাস বা 3 মাসের মেয়াদে সুদমুক্ত করযে হাসানা ঋণের জন্য আবেদন করতে পারেন।
                  </p>
                  <button
                    onClick={() => {
                      setShowRepayModal(false);
                      setActiveTab('apply');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Coins className="w-4 h-4" />
                    সুদমুক্ত ঋণ নিতে আবেদন করুন
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
