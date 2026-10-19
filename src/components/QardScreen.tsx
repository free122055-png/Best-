import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Transaction, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { DEFAULT_QARD_CONFIG } from '../lib/config';
import { hasCompletedSamityProfile, getMissingProfileFields, getMembershipCategory } from '../lib/memberUtils';
import BNBPaymentReceiptModal from './BNBPaymentReceiptModal';
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
  AlertTriangle,
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
  HandHeart,
  HelpingHand,
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

const QardBannerSlider = React.memo(function QardBannerSlider({ adSlides }: { adSlides: any[] }) {
  const [currentAdSlide, setCurrentAdSlide] = useState(0);

  useEffect(() => {
    if (!adSlides || adSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentAdSlide((prev) => (prev + 1) % adSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [adSlides]);

  if (!adSlides || adSlides.length === 0) return null;
  const slide = adSlides[currentAdSlide] || adSlides[0];

  return (
    <div className="relative overflow-hidden rounded-3.5xl border border-slate-150 shadow-md bg-slate-900 aspect-[16/9] w-full group">
      <div className="absolute inset-0 w-full h-full">
        <img
          src={slide.image}
          alt={slide.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-85 transition-opacity duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-4 flex flex-col justify-end text-left">
          <span className="text-[9px] font-extrabold text-[#F43F5E] uppercase tracking-widest bg-rose-950/80 max-w-max px-2 py-0.5 rounded-md mb-1.5 border border-rose-800/60">
            {slide.tag}
          </span>
          <h3 className="text-sm font-black text-white leading-tight mb-1">
            {slide.title}
          </h3>
          <p className="text-[10px] text-slate-300 font-semibold leading-snug">
            {slide.description}
          </p>
        </div>
      </div>
      {adSlides.length > 1 && (
        <div className="absolute top-3 right-4 flex gap-1.5 z-10">
          {adSlides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={'Slide ' + (idx + 1)}
              onClick={() => setCurrentAdSlide(idx)}
              className={'h-1.5 rounded-full transition-all duration-300 cursor-pointer ' + (
                currentAdSlide === idx ? 'w-4.5 bg-rose-500' : 'w-1.5 bg-white/40 hover:bg-white/65'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
});


export const QardScreen = React.memo(function QardScreen({ user, onBack, syncLiveProfile, appConfig }: QardScreenProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'landing' | 'donate' | 'dashboard' | 'transparency' | 'apply' | 'admin' | 'withdraw' | 'gold_loan'>('landing');

  // States for Gold Loan / স্বর্ণ রেখে জরুরি টাকা
  const [goldLoansList, setGoldLoansList] = useState<any[]>([]);
  const [goldJewelryType, setGoldJewelryType] = useState('');
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
  const [calcMarketValue, setCalcMarketValue] = useState<string>('');

  // Internal Qard Back Handler
  useBackHandler(() => {
    if (showPayForMemberModal) { setShowPayForMemberModal(false); return true; }
    if (showDonorsModal) { setShowDonorsModal(false); return true; }
    if (showBorrowersModal) { setShowBorrowersModal(false); return true; }
    if (showReceiptModal) { setShowReceiptModal(false); return true; }
    if (showCertificate) { setShowCertificate(false); return true; }
    if (showRepayModal) {
      if (repaySubTab !== 'my_loan') {
        setRepaySubTab('my_loan');
        return true;
      }
      setShowRepayModal(false);
      return true;
    }
    if (showSectionTxHistory) { setShowSectionTxHistory(false); return true; }
    if (selectedQardSection !== 'none') {
      setSelectedQardSection('none');
      return true;
    }
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
  // Form states - Qard Withdrawal Apply
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawWhatsapp, setWithdrawWhatsapp] = useState<string>('');
  const [withdrawPin, setWithdrawPin] = useState<string>('');
  const [selectedQardSection, setSelectedQardSection] = useState<'none' | 'investor' | 'general'>('none');

  const defaultAdSlides = [
    {
      id: 1,
      tag: "সঞ্চয় ও বিনিয়োগ",
      title: "BNB Business Network Bangladesh",
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
BUSINESS NETWORK BANGLADESH (BNB)
BNB Business Co-operative Welfare Fund
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
    ctx.fillText('BNB Business Co-operative Welfare Fund', 250, 85);

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
  const [donationPurpose, setDonationPurpose] = useState<string>('general');
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
  const [ambTxVolume, setBNBTxVolume] = useState<number>(0);
  const [eligibilityLoaded, setEligibilityLoaded] = useState<boolean>(false);

  // Coop 50% Instant Auto-Loan States
  const [instantLoanAmtInput, setInstantLoanAmtInput] = useState<string>('');
  const [instantLoanDurationInput, setInstantLoanDurationInput] = useState<number>(1);
  const [instantLoanPinInput, setInstantLoanPinInput] = useState<string>('');
  const [instantLoanLoading, setInstantLoanLoading] = useState<boolean>(false);

  // Receipts & Certificates Modals
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<Transaction | null>(null);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);
  const [showRepayModal, setShowRepayModal] = useState<boolean>(false);
  const [repaySubTab, setRepaySubTab] = useState<'my_loan' | 'borrowers_list' | 'all_beneficiaries' | 'late_defaulters'>('my_loan');

  // Automatically reset repaySubTab to 'my_loan' whenever modal closes/opens or user navigates
  useEffect(() => {
    setRepaySubTab('my_loan');
  }, [showRepayModal, selectedQardSection, activeTab]);
  const [beneficiariesSearchQuery, setBeneficiariesSearchQuery] = useState<string>('');
  const [defaultersSearchQuery, setDefaultersSearchQuery] = useState<string>('');
  const [thirdPartyPhoneInput, setThirdPartyPhoneInput] = useState<string>('');
  const [thirdPartyPayAmount, setThirdPartyPayAmount] = useState<string>('');
  const [thirdPartyPayLoading, setThirdPartyPayLoading] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>(user.phone + '@bnb-network.org');
  const [emailSending, setEmailSending] = useState<boolean>(false);

  // States for paying another member's loan installment directly
  const [selectedTargetUser, setSelectedTargetUser] = useState<any | null>(null);
  const [showPayForMemberModal, setShowPayForMemberModal] = useState<boolean>(false);
  const [payMemberAmountInput, setPayMemberAmountInput] = useState<string>('');
  const [payMemberPinInput, setPayMemberPinInput] = useState<string>('');
  const [payMemberLoading, setPayMemberLoading] = useState<boolean>(false);
  const [payMemberError, setPayMemberError] = useState<string>('');

  // Selected Donor details state for history popup
  const [selectedDonorForDetails, setSelectedDonorForDetails] = useState<any | null>(null);

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
      setBNBTxVolume(vol);
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
            message: `আপনার ৳${dueLoan.toLocaleString('en-US')} করযে হাসানা ঋণের ৩০ দিন মেয়াদের আর মাত্র ${daysLeft === 0 ? 'আজকেই শেষ দিন (পরের মাসের একই তারিখ)' : `${daysLeft} দিন বাকি`}। অতিরিক্ত জরিমানা এড়াতে অবিলম্বে ঋণ পরিশোধ করুন, অন্যথায় ৩০ দিন অতিক্রান্ত হলে প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা বিলম্ব জরিমানা অটোমেটিক মেইন ব্যালেন্স থেকে কর্তন করা শুরু হবে।`,
            body: `আপনার ৳${dueLoan.toLocaleString('en-US')} করযে হাসানা ঋণের ৩০ দিন মেয়াদের আর মাত্র ${daysLeft === 0 ? 'আজকেই শেষ দিন (পরের মাসের একই তারিখ)' : `${daysLeft} দিন বাকি`}। অতিরিক্ত জরিমানা এড়াতে অবিলম্বে ঋণ পরিশোধ করুন, অন্যথায় ৩০ দিন অতিক্রান্ত হলে প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা বিলম্ব জরিমানা অটোমেটিক মেইন ব্যালেন্স থেকে কর্তন করা শুরু হবে।`,
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
              description: `⚠️ করযে হাসানা ঋণের ৩০ দিন মেয়াদ অতিক্রান্ত হওয়ায় (${daysElapsed - 30}তম দিন ওভারডিউ) আজ ${todayKey}-এ প্রতি হাজারে ১০ টাকা হারে ৳${dailyFine.toLocaleString('en-US')} বিলম্ব জরিমানা ${deductedFromBal > 0 ? `মেইন ওয়ালেট থেকে ৳${deductedFromBal} অটো কর্তন` : ''}${addedToDue > 0 ? `${deductedFromBal > 0 ? ' ও বাকি ' : ''}৳${addedToDue} বকেয়া ঋণে যুক্ত` : ''} করা হয়েছে।`,
              paymentMethod: deductedFromBal >= dailyFine ? 'AUTO_WALLET_DEDUCT' : 'AUTO_FINE',
              receiptNo: `FINE-${Math.floor(100000 + Math.random() * 900000)}`,
              createdAt: nowIso
            });

            // Send Realtime Notification
            addDoc(collection(db, 'user_notifications'), {
              userId: user.uid,
              title: '⚠️ করযে হাসানা বিলম্ব জরিমানা কর্তন',
              message: `আপনার করযে হাসানা ঋণের ৩০ দিনের মেয়াদ অতিক্রান্ত হওয়ায় আজ (${todayKey}) নিয়ম অনুযায়ী প্রতি ১,০০০ টাকায় ১০ টাকা হারে ৳${dailyFine.toLocaleString('en-US')} বিলম্ব জরিমানা ${deductedFromBal > 0 ? 'আপনার মেইন ওয়ালেট ব্যালেন্স থেকে অটোমেটিক কর্তন করা হয়েছে' : 'বকেয়া ঋণে যুক্ত করা হয়েছে'}। অতিরিক্ত জরিমানা এড়াতে অবিলম্বে সম্পূর্ণ ঋণ পরিশোধ করুন।`,
              body: `আপনার করযে হাসানা ঋণের ৩০ দিনের মেয়াদ অতিক্রান্ত হওয়ায় আজ (${todayKey}) নিয়ম অনুযায়ী প্রতি ১,০০০ টাকায় ১০ টাকা হারে ৳${dailyFine.toLocaleString('en-US')} বিলম্ব জরিমানা ${deductedFromBal > 0 ? 'আপনার মেইন ওয়ালেট ব্যালেন্স থেকে অটোমেটিক কর্তন করা হয়েছে' : 'বকেয়া ঋণে যুক্ত করা হয়েছে'}। অতিরিক্ত জরিমানা এড়াতে অবিলম্বে সম্পূর্ণ ঋণ পরিশোধ করুন।`,
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
              description: `⚠️ করযে হাসানা ৩ মাস মেয়াদী ঋণের কিস্তির ৩০ দিন মেয়াদ অতিক্রান্ত হওয়ায় আজ ${todayKey}-এ প্রতি হাজারে ১০ টাকা হারে ৳${dailyFine.toLocaleString('en-US')} বিলম্ব জরিমানা ${deductedFromBal > 0 ? `মেইন ওয়ালেট থেকে ৳${deductedFromBal} অটো কর্তন` : ''}${addedToDue > 0 ? `${deductedFromBal > 0 ? ' ও বাকি ' : ''}৳${addedToDue} বকেয়া ঋণে যুক্ত` : ''} করা হয়েছে।`,
              paymentMethod: deductedFromBal >= dailyFine ? 'AUTO_WALLET_DEDUCT' : 'AUTO_FINE',
              receiptNo: `FINE-${Math.floor(100000 + Math.random() * 900000)}`,
              createdAt: nowIso
            });

            addDoc(collection(db, 'user_notifications'), {
              userId: user.uid,
              title: '⚠️ করযে হাসানা বিলম্ব জরিমানা কর্তন',
              message: `আপনার ৩ মাস মেয়াদী করযে হাসানা ঋণের কিস্তির মেয়াদ অতিক্রান্ত হওয়ায় প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা হারে আজ ৳${dailyFine.toLocaleString('en-US')} জরিমানা ${deductedFromBal > 0 ? 'মেইন ব্যালেন্স থেকে অটোমেটিক কর্তন করা হয়েছে' : 'বকেয়া ঋণে যুক্ত করা হয়েছে'}। অতিসত্বর কিস্তি পরিশোধ করুন।`,
              body: `আপনার ৩ মাস মেয়াদী করযে হাসানা ঋণের কিস্তির মেয়াদ অতিক্রান্ত হওয়ায় প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা হারে আজ ৳${dailyFine.toLocaleString('en-US')} জরিমানা ${deductedFromBal > 0 ? 'মেইন ব্যালেন্স থেকে অটোমেটিক কর্তন করা হয়েছে' : 'বকেয়া ঋণে যুক্ত করা হয়েছে'}। অতিসত্বর কিস্তি পরিশোধ করুন।`,
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
        const map: Record<string, { photoURL?: string; photo?: string; profilePic?: string; name?: string; phone?: string; memberId?: string }> = {};
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const photo = d.photoURL || d.photo || d.profilePic || d.avatar || d.image || d.profileImage || d.profilePicUrl || '';
          const name = d.name || d.userName || '';
          const info = { photoURL: photo, photo: photo, profilePic: photo, name: name, phone: d.phone, memberId: d.memberId };

          if (docSnap.id) map[docSnap.id] = info;
          if (d.uid) map[d.uid] = info;
          if (d.phone) map[d.phone] = info;
          if (d.memberId) map[d.memberId] = info;
          if (name) map[name] = info;
          if (d.userName) map[d.userName] = info;
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
        userPhone: user.phone || '',
        userPhoto: isAnonymous ? '' : (user.photoURL || user.profilePic || (user as any).photo || ''),
        photoURL: isAnonymous ? '' : (user.photoURL || user.profilePic || (user as any).photo || ''),
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
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) করজে হাসানা ফান্ডে ৳${amt.toLocaleString('en-US')} টাকা অনুদান দিয়েছেন।`,
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

    // Lifetime Ban Check for 2+ Late Repayments
    const userLateStrikes = (user.qardLateCount || 0) + qardHistory.filter(t => t.userId === user.uid && (t.type === 'qard_fine' || t.category === 'qard_late_fine')).length;
    if (userLateStrikes >= 2 || user.isLifetimeBannedFromQard === true) {
      setErrorMsg('⚠️ দুঃখিত! আপনি পূর্বে ২ বার সময়মতো ঋণ পরিশোধে ব্যর্থ হয়েছেন। করযে হাসানা নিয়ম অনুযায়ী আপনি আজীবনের জন্য সুদমুক্ত ঋণ গ্রহণ থেকে স্থায়ীভাবে নিষিদ্ধ (LIFETIME BANNED)।');
      return;
    }

    const amt = parseFloat(loanAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('অনুগ্রহ করে সঠিক ঋণের পরিমাণ লিখুন।');
      return;
    }

    const monthlyRepay = amt; // 1 month full repayment rule

    // Mandatory Complete Profile Check
    const missingProfileFields = getMissingProfileFields(user);
    if (missingProfileFields.length > 0) {
      setErrorMsg(`⚠️ করযে হাসানা ঋণ পাওয়ার জন্য প্রোফাইল 100% ফিলাপ থাকা বাধ্যতামূলক। কোনো একটি তথ্য গ্যাপ থাকলে করজে হাসানা পাওয়া যাবে না। আপনার প্রোফাইলে বাকি রয়েছে: ${missingProfileFields.join(', ')}। অনুগ্রহ করে আগে প্রোফাইল এডিট করে সকল তথ্য সম্পূর্ণ করুন।`);
      return;
    }

    // General member limit check (Min 1 BDT, Max 2,000 BDT for manual admin review)
    const minLimit = appConfig?.qardConfig?.minLoanAmount || 1;
    const maxLimit = appConfig?.qardConfig?.maxLoanAmount || 2000;
    if (amt < minLimit || amt > maxLimit) {
      setErrorMsg(`সাধারণ সদস্যদের ক্ষেত্রে সুদমুক্ত ঋণের পরিমাণ সর্বনিম্ন ৳${minLimit} টাকা থেকে সর্বোচ্চ ৳${maxLimit.toLocaleString('en-US')} টাকা হতে হবে (যা এডমিন ম্যানুয়ালি পর্যালোচনা করে সিদ্ধান্ত গ্রহণ করবেন)।`);
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
      setErrorMsg(`দুঃখিত! সাধারণ সদস্যদের ক্ষেত্রে এই 2 মাসে কমপক্ষে BNB টু BNB 20,000 টাকার লেনদেন থাকতে হবে। আপনার বর্তমান লেনদেন ৳${ambTxVolume.toLocaleString('en-US')} BDT`);
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
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ৳${amt.toLocaleString('en-US')} টাকা সুদমুক্ত ঋণ আবেদন করেছেন (মেয়াদ: ${loanDuration} মাস, কিস্তি: ৳${monthlyRepay}/মাস)।`,
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

    // Lifetime Ban Check for 2+ Late Repayments
    const userLateStrikes = (user.qardLateCount || 0) + qardHistory.filter(t => t.userId === user.uid && (t.type === 'qard_fine' || t.category === 'qard_late_fine')).length;
    if (userLateStrikes >= 2 || user.isLifetimeBannedFromQard === true) {
      setErrorMsg('⚠️ দুঃখিত! আপনি পূর্বে ২ বার সময়মতো ঋণ পরিশোধে ব্যর্থ হয়েছেন। করযে হাসানা নিয়ম অনুযায়ী আপনি আজীবনের জন্য সুদমুক্ত ঋণ গ্রহণ থেকে স্থায়ীভাবে নিষিদ্ধ (LIFETIME BANNED)।');
      return;
    }

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
      setErrorMsg('আপনার সমিতিতে কোনো সঞ্চয় জমা নেই। অটো-ঋণ নিতে আগে সমিতিতে সঞ্চয় জমা রাখুন।');
      return;
    }

    // Role/Category Based Percentage: Owner 70%, Shareholder 60%, Investor/Regular 50%
    const cat = user.memberCategory || 'investor';
    const percent = cat === 'owner' ? 70 : cat === 'shareholder' ? 60 : 50;
    const minInstantLimit = Math.max(1, Math.floor(userSavings * 0.01));
    const maxInstantLimit = Math.floor(userSavings * (percent / 100));

    const requestedAmt = parseFloat(instantLoanAmtInput || String(maxInstantLimit));

    if (isNaN(requestedAmt) || requestedAmt <= 0) {
      setErrorMsg('অনুগ্রহ করে ইনস্ট্যান্ট ঋণের সঠিক পরিমাণ লিখুন।');
      return;
    }

    if (requestedAmt < minInstantLimit) {
      setErrorMsg(`ইনস্ট্যান্ট ঋণের সর্বনিম্ন সীমা সঞ্চয়ের 1% (৳${minInstantLimit.toLocaleString('en-US')} BDT)।`);
      return;
    }

    if (requestedAmt > maxInstantLimit) {
      setErrorMsg(`আপনার ক্যাটাগরির (${cat === 'owner' ? 'অনার ৭০%' : cat === 'shareholder' ? 'শেয়ারহোল্ডার ৬০%' : 'ইনভেস্টর ৫০%'}) সর্বোচ্চ সীমা ৳${maxInstantLimit.toLocaleString('en-US')} BDT।`);
      return;
    }

    // Calculate percentage taken relative to savings
    const loanPercent = userSavings > 0 ? Math.round(((requestedAmt / userSavings) * 100) * 10) / 10 : percent;

    // 1. Check existing active due loan
    if ((user.dueLoan || 0) > 0) {
      setErrorMsg(`আপনার নিকট বর্তমানে ৳${(user.dueLoan || 0).toLocaleString('en-US')} BDT বকেয়া ঋণ রয়েছে। ইনস্ট্যান্ট অটো-ঋণ নিতে প্রথমে বর্তমান বকেয়া ঋণ সম্পূর্ণ পরিশোধ করুন।`);
      return;
    }

    // 2. Repayment-based Cooldown check: 60 days after repayment
    const lastLoanAmt = user.lastCoopInstantLoanAmount || 0;
    const effectiveCooldownDays = 60;

    if (user.lastCoopInstantLoanRepaidAt) {
      const repaidTime = new Date(user.lastCoopInstantLoanRepaidAt).getTime();
      const daysSinceRepaid = Math.floor((Date.now() - repaidTime) / (1000 * 60 * 60 * 24));
      if (daysSinceRepaid < effectiveCooldownDays) {
        const remainingDays = effectiveCooldownDays - daysSinceRepaid;
        const nextDateStr = new Date(repaidTime + effectiveCooldownDays * 24 * 60 * 60 * 1000).toLocaleDateString('bn-BD');
        setErrorMsg(`আপনি গত ${new Date(user.lastCoopInstantLoanRepaidAt).toLocaleDateString('bn-BD')}-এ পূর্বের ঋণ সম্পূর্ণ পরিশোধ করেছেন। নিয়ম অনুযায়ী পরিশোধের ৬০ দিন পর (${nextDateStr}) পুনরায় অটো-ঋণ নেওয়া যাবে। (আর ${remainingDays} দিন বাকি)`);
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
        description: `🏢 সমবায় সঞ্চয়ের (${loanPercent}%) ইনস্ট্যান্ট অটো-ঋণ (সঞ্চয়: ৳${userSavings.toLocaleString('en-US')}, ${durationMonths === 3 ? '3 মাস' : '1 মাস (30 দিন)'} মেয়াদে ডিসবার্সড)${ratioNote}`,
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
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) সমবায় সঞ্চয়ের বিপরীতে ৳${requestedAmt.toLocaleString('en-US')} ইনস্ট্যান্ট ঋণ নিয়েছেন (${durationMonths} মাস মেয়াদ)।`,
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
        message: `আপনার সমবায় সঞ্চয় (৳${userSavings.toLocaleString('en-US')}) ভিত্তি ধরে ৳${requestedAmt.toLocaleString('en-US')} ইনস্ট্যান্ট অটো-ঋণ সরাসরি ওয়ালেটে জমা দেওয়া হয়েছে। পরিশোধের নিয়মঃ যেই তারিখে টাকা নেওয়া হয়েছে, ঠিক পরের মাসে সেই একই তারিখে পরিশোধ করতে হবে (30 দিন গণনা)। ${durationMonths === 3 ? '3 মাস মেয়াদের ক্ষেত্রে 90 দিন গণনা হবে এবং প্রতি 30 দিন পর পর 3টি সমান কিস্তিতে পরিশোধ করতে হবে।' : '1 মাস মেয়াদের ক্ষেত্রে 30 দিন পর সম্পূর্ণ পরিশোধ করতে হবে।'} মেয়াদ শেষ হওয়ার 2 দিন পূর্বে রিমাইন্ডার নোটিফিকেশন যাবে এবং 30 দিন পার হলে প্রতিদিন প্রতি হাজারে 10 টাকা বিলম্ব জরিমানা কার্যকর হবে।`,
        type: 'qard_disbursed',
        read: false,
        createdAt: nowIso
      };
      await addDoc(collection(db, 'user_notifications'), notifData);

      // Open Professional BNB Receipt Modal
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

      setSuccessMsg(`🎉 অভিনন্দন! ৳${requestedAmt.toLocaleString('en-US')} ইনস্ট্যান্ট অটো-ঋণ সরাসরি আপনার মেইন ওয়ালেটে জমা হয়েছে! (${durationMonths} মাস মেয়াদের অটো-কিস্তি চালু করা হয়েছে)`);
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
      setErrorMsg(`আপনার সর্বোচ্চ উত্তোলনযোগ্য ব্যালেন্স ৳${myWithdrawableBalance?.toLocaleString('en-US')} BDT`);
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
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) করজে হাসানা ফান্ড হতে ৳${amt.toLocaleString('en-US')} টাকা উত্তোলনের আবেদন করেছেন।`,
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
      setErrorMsg(`দুঃখিত! ঋণ পরিশোধের জন্য আপনার মেইন ওয়ালেট ব্যালেন্স পর্যাপ্ত নয়। প্রয়োজন ৳${repayAmt.toLocaleString('en-US')} BDT, কিন্তু আপনার মেইন ব্যালেন্স আছে ৳${(user.balance || 0).toLocaleString('en-US')} BDT। অনুগ্রহ করে ওয়ালেটে ডিপোজিট/রিচার্জ করুন।`);
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
        description: `মেইন ব্যালেন্স থেকে করযে হাসানা সুদমুক্ত ঋণ/কিস্তি পরিশোধ সম্পন্ন (বকেয়া অবশিষ্ট: ৳${newDue.toLocaleString('en-US')} BDT)`,
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
        description: `মেইন ব্যালেন্স থেকে করযে হাসানা ঋণ/কিস্তি পরিশোধ সম্পন্ন (${newDue === 0 ? 'সম্পূর্ণ বকেয়া পরিশোধিত' : `বকেয়া অবশিষ্ট ৳${newDue.toLocaleString('en-US')} BDT`})`,
        createdAt: nowIso,
        paymentMethod: 'WALLET'
      });
      setShowReceiptModal(true);
      setSuccessMsg(newDue === 0 
        ? 'অভিনন্দন! আপনার বকেয়া করযে হাসানা ঋণ সম্পূর্ণ পরিশোধিত হয়েছে।' 
        : `আপনার ৳${repayAmt.toLocaleString('en-US')} কিস্তি পরিশোধ সফল হয়েছে! বকেয়া ঋণ অবশিষ্ট: ৳${newDue.toLocaleString('en-US')} BDT।`);
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
          message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ৳${repayAmt.toLocaleString('en-US')} টাকা ঋণ কিস্তি পরিশোধ করেছেন। অবশিষ্ট বকেয়া: ৳${newDue.toLocaleString('en-US')}।`,
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
          body: `আপনার মেইন ওয়ালেট ব্যালেন্স থেকে ৳${repayAmt.toLocaleString('en-US')} সফলভাবে পরিশোধ করা হয়েছে। ${newDue === 0 ? 'আপনার সকল বকেয়া ঋণ সম্পূর্ণ পরিশোধিত।' : `বকেয়া অবশিষ্ট ৳${newDue.toLocaleString('en-US')} BDT।`}`,
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

  // Repay Qard Loan on behalf of another member (3rd party repayment via Phone or ID)
  const handleThirdPartyLoanRepay = async (targetUserObj: any, repayAmt: number) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!targetUserObj || !targetUserObj.uid) {
      setErrorMsg('অনুগ্রহ করে সঠিক ঋণগ্রহীতা সদস্য নির্বাচন বা ফোন নম্বর প্রবেশ করান।');
      return;
    }

    if (!repayAmt || repayAmt <= 0) {
      setErrorMsg('অনুগ্রহ করে সঠিক পরিশোধের পরিমাণ লিখুন।');
      return;
    }

    if (user.balance < repayAmt) {
      setErrorMsg(`দুঃখিত! পরিশোধের জন্য আপনার মেইন ওয়ালেট ব্যালেন্স পর্যাপ্ত নয়। প্রয়োজন ৳${repayAmt.toLocaleString('en-US')} BDT, কিন্তু আপনার মেইন ব্যালেন্স আছে ৳${(user.balance || 0).toLocaleString('en-US')} BDT।`);
      return;
    }

    const pin = prompt(`সদস্য ${targetUserObj.name || targetUserObj.phone}-এর ৳${repayAmt.toLocaleString('en-US')} করযে হাসানা কিস্তি পরিশোধ নিশ্চিত করতে আপনার 4 ডিজিটের সিকিউরিটি পিন দিনঃ`);
    if (!pin || pin !== user.pin) {
      setErrorMsg('ভুল সিকিউরিটি পিন। পরিশোধ বাতিল করা হয়েছে।');
      return;
    }

    setThirdPartyPayLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const targetDue = targetUserObj.dueLoan || 0;
      const newTargetDue = Math.max(0, targetDue - repayAmt);
      const newPayerBalance = Math.max(0, user.balance - repayAmt);

      // Optimistic local update ⚡
      user.balance = newPayerBalance;
      targetUserObj.dueLoan = newTargetDue;

      const generatedReceiptNo = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const generatedTxId = `QRD-3RD-${Date.now().toString().slice(-6)}`;

      setReceiptData({
        receiptNo: generatedReceiptNo,
        transactionId: generatedTxId,
        userName: user.name,
        memberId: user.memberId || user.phone,
        typeLabel: 'অন্যের করযে হাসানা কিস্তি পরিশোধ',
        amount: repayAmt,
        description: `সদস্য ${targetUserObj.name || 'সদস্য'} (${targetUserObj.phone || 'N/A'})-এর বকেয়া করযে হাসানা কিস্তি পরিশোধিত (অবশিষ্ট বকেয়া: ৳${newTargetDue.toLocaleString('en-US')} BDT)`,
        createdAt: nowIso,
        paymentMethod: 'WALLET'
      });
      setShowReceiptModal(true);

      setSuccessMsg(`ধন্যবাদ! আপনি সফলভাবে সদস্য ${targetUserObj.name || targetUserObj.phone}-এর ৳${repayAmt.toLocaleString('en-US')} টাকা করযে হাসানা কিস্তি পরিশোধ করেছেন।`);
      setThirdPartyPayAmount('');
      setThirdPartyPhoneInput('');

      // Background Firestore updates
      const payerRef = doc(db, 'users', user.uid);
      const targetRef = doc(db, 'users', targetUserObj.uid);

      await Promise.all([
        updateDoc(payerRef, { balance: newPayerBalance }).catch(e => console.warn('Payer update err:', e)),
        updateDoc(targetRef, { dueLoan: newTargetDue }).catch(e => console.warn('Target update err:', e)),
        addDoc(collection(db, 'transactions'), {
          userId: targetUserObj.uid,
          payerUserId: user.uid,
          payerName: user.name,
          userName: targetUserObj.name || 'সদস্য',
          memberId: targetUserObj.memberId || targetUserObj.phone,
          type: 'qard_loan_repayment',
          typeLabel: 'অন্যের মাধ্যমে করযে হাসানা কিস্তি পরিশোধ',
          amount: repayAmt,
          status: 'success',
          description: `দাতা সদস্য ${user.name} (${user.phone}) আপনার ৳${repayAmt.toLocaleString('en-US')} টাকার করযে হাসানা কিস্তি পরিশোধ করে দিয়েছেন।`,
          createdAt: nowIso,
          paymentMethod: 'WALLET',
          transactionId: generatedTxId,
          receiptNo: generatedReceiptNo
        }).catch(e => console.warn('Tx doc err:', e)),
        addDoc(collection(db, 'user_notifications'), {
          userId: targetUserObj.uid,
          title: '🎉 আপনার করযে হাসানা কিস্তি পরিশোধ হয়েছে!',
          message: `সম্মানিত সদস্য ${user.name} (${user.phone}) আপনার ৳${repayAmt.toLocaleString('en-US')} BDT করযে হাসানা কিস্তি পরিশোধ করেছেন। আপনার বকেয়া অবশিষ্ট: ৳${newTargetDue.toLocaleString('en-US')} BDT।`,
          createdAt: nowIso,
          read: false,
          type: 'qard_repayment'
        }).catch(e => console.warn('Notif err:', e)),
        addDoc(collection(db, 'admin_notifications'), {
          title: '🤝 অন্যের করযে হাসানা কিস্তি পরিশোধ সম্পন্ন',
          message: `সদস্য ${user.name} (${user.phone}) অপর সদস্য ${targetUserObj.name} (${targetUserObj.phone})-এর ৳${repayAmt.toLocaleString('en-US')} টাকার করযে হাসানা কিস্তি পরিশোধ করেছেন।`,
          userId: user.uid,
          createdAt: nowIso,
          read: false
        }).catch(e => console.warn('Admin notif err:', e))
      ]);

      await syncLiveProfile();
      await fetchLedgers();
    } catch (err: any) {
      console.error('Third party repay error:', err);
      setErrorMsg('পরিশোধ প্রক্রিয়ায় ত্রুটি হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setThirdPartyPayLoading(false);
    }
  };

  // Dedicated Pay For Member Submit Handler with 4-Digit Security PIN Validation
  const handlePayForMemberSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPayMemberError('');

    if (!selectedTargetUser) {
      setPayMemberError('সদস্য নির্বাচন করা হয়নি।');
      return;
    }

    const repayAmt = parseFloat(payMemberAmountInput);
    if (isNaN(repayAmt) || repayAmt <= 0) {
      setPayMemberError('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন।');
      return;
    }

    const targetDue = selectedTargetUser.dueAmount !== undefined 
      ? selectedTargetUser.dueAmount 
      : (selectedTargetUser.rawDueAmount !== undefined ? selectedTargetUser.rawDueAmount : (selectedTargetUser.dueLoan || 0));

    if (targetDue <= 0) {
      setPayMemberError('এই সদস্যের বর্তমানে কোনো বকেয়া ঋণ নেই।');
      return;
    }

    if (repayAmt > targetDue) {
      setPayMemberError(`পরিশোধের পরিমাণ সদস্যের সর্বোচ্চ বকেয়া ৳${targetDue.toLocaleString('en-US')} টাকার বেশি হতে পারবে না।`);
      return;
    }

    if ((user.balance || 0) < repayAmt) {
      setPayMemberError(`আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই। আপনার বর্তমান ব্যালেন্স: ৳${(user.balance || 0).toLocaleString('en-US')} BDT।`);
      return;
    }

    // 4-digit PIN verification
    if (!payMemberPinInput || payMemberPinInput.trim().length !== 4) {
      setPayMemberError('অনুগ্রহ করে আপনার ৪ সংখ্যার সিকিউরিটি পিন কোড লিখুন।');
      return;
    }

    if (user.pin && payMemberPinInput.trim() !== user.pin.trim()) {
      setPayMemberError('ভুল ৪ সংখ্যার সিকিউরিটি পিন কোড! পুনরায় সঠিক পিন দিন।');
      return;
    }

    setPayMemberLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const targetUserId = selectedTargetUser.userId || selectedTargetUser.uid;
      const targetName = selectedTargetUser.name || selectedTargetUser.userName || 'সম্মানিত সদস্য';
      const targetPhone = selectedTargetUser.phone || selectedTargetUser.userPhone || '';
      const targetMemberId = selectedTargetUser.memberId || targetPhone;

      const newTargetDue = Math.max(0, targetDue - repayAmt);
      const newPayerBalance = Math.max(0, (user.balance || 0) - repayAmt);

      // Local optimistic update
      user.balance = newPayerBalance;
      selectedTargetUser.dueLoan = newTargetDue;
      selectedTargetUser.dueAmount = newTargetDue;
      if (selectedTargetUser.rawDueAmount !== undefined) selectedTargetUser.rawDueAmount = newTargetDue;

      const generatedReceiptNo = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const generatedTxId = `QRD-3RD-${Date.now().toString().slice(-6)}`;

      // Set digital receipt data
      setReceiptData({
        receiptNo: generatedReceiptNo,
        transactionId: generatedTxId,
        userName: user.name,
        memberId: user.memberId || user.phone,
        typeLabel: 'অন্যের করযে হাসানা কিস্তি পরিশোধ',
        amount: repayAmt,
        description: `সদস্য ${targetName} (${targetPhone || 'N/A'})-এর বকেয়া করযে হাসানা কিস্তি পরিশোধিত (অবশিষ্ট বকেয়া: ৳${newTargetDue.toLocaleString('en-US')} BDT)`,
        createdAt: nowIso,
        paymentMethod: 'WALLET'
      });

      setShowPayForMemberModal(false);
      setShowReceiptModal(true);
      setSuccessMsg(`ধন্যবাদ! আপনি সফলভাবে সদস্য ${targetName}-এর ৳${repayAmt.toLocaleString('en-US')} টাকা করযে হাসানা কিস্তি পরিশোধ করেছেন।`);

      // Reset inputs
      setPayMemberAmountInput('');
      setPayMemberPinInput('');
      setSelectedTargetUser(null);

      // Firestore background operations
      const payerRef = doc(db, 'users', user.uid);
      const targetRef = doc(db, 'users', targetUserId);

      await Promise.all([
        updateDoc(payerRef, { balance: newPayerBalance, mainBalance: newPayerBalance }).catch(e => console.warn('Payer update err:', e)),
        updateDoc(targetRef, { dueLoan: newTargetDue }).catch(e => console.warn('Target update err:', e)),
        addDoc(collection(db, 'transactions'), {
          userId: targetUserId,
          payerUserId: user.uid,
          payerName: user.name,
          userName: targetName,
          memberId: targetMemberId,
          type: 'qard_loan_repayment',
          typeLabel: 'অন্যের মাধ্যমে করযে হাসানা কিস্তি পরিশোধ',
          amount: repayAmt,
          status: 'success',
          description: `দাতা সদস্য ${user.name} (${user.phone}) আপনার ৳${repayAmt.toLocaleString('en-US')} টাকার করযে হাসানা কিস্তি পরিশোধ করে দিয়েছেন।`,
          createdAt: nowIso,
          paymentMethod: 'WALLET',
          transactionId: generatedTxId,
          receiptNo: generatedReceiptNo
        }).catch(e => console.warn('Tx doc err:', e)),
        addDoc(collection(db, 'user_notifications'), {
          userId: targetUserId,
          title: '🎉 আপনার করযে হাসানা কিস্তি পরিশোধ হয়েছে!',
          message: `সম্মানিত সদস্য ${user.name} (${user.phone}) আপনার ৳${repayAmt.toLocaleString('en-US')} BDT করযে হাসানা কিস্তি পরিশোধ করেছেন। আপনার বকেয়া অবশিষ্ট: ৳${newTargetDue.toLocaleString('en-US')} BDT।`,
          createdAt: nowIso,
          read: false,
          type: 'qard_repayment'
        }).catch(e => console.warn('Notif err:', e)),
        addDoc(collection(db, 'admin_notifications'), {
          title: '🤝 অন্যের করযে হাসানা কিস্তি পরিশোধ সম্পন্ন',
          message: `সদস্য ${user.name} (${user.phone}) অপর সদস্য ${targetName} (${targetPhone})-এর ৳${repayAmt.toLocaleString('en-US')} টাকার করযে হাসানা কিস্তি পরিশোধ করেছেন।`,
          userId: user.uid,
          createdAt: nowIso,
          read: false
        }).catch(e => console.warn('Admin notif err:', e))
      ]);

      await syncLiveProfile();
      await fetchLedgers();
    } catch (err: any) {
      console.error('Pay for member submit error:', err);
      setPayMemberError('পরিশোধ প্রক্রিয়ায় ত্রুটি হয়েছে। পুনরায় চেষ্টা করুন।');
    } finally {
      setPayMemberLoading(false);
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
            <strong className="text-base font-mono font-black text-rose-700">৳ {activeDue.toLocaleString('en-US')} BDT</strong>
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
              আপনার ঋণের নির্ধারিত ৩০ দিন মেয়াদ পার হয়ে গেছে। নিয়ম অনুযায়ী প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা হারে (আজকের জরিমানা ৳{dailyFineAmt.toLocaleString('en-US')}) আপনার মেইন ব্যালেন্স থেকে স্বয়ংক্রিয়ভাবে বিলম্ব জরিমানা কর্তন করা শুরু হয়েছে। আরও অতিরিক্ত জরিমানা এড়াতে এখনই সম্পূর্ণ ঋণ পরিশোধ করুন।
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
            <span className="font-extrabold text-slate-800">৳ {monthlyInstalment.toLocaleString('en-US')}</span>
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
              <span className="text-[9.5px] opacity-90 font-mono">৳ {monthlyInstalment.toLocaleString('en-US')} BDT</span>
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
              <span className="text-[9.5px] opacity-90 font-mono">৳ {activeDue.toLocaleString('en-US')} BDT</span>
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
            ওয়ালেট থেকে এক্ষুণি ৳ {payAmtToExecute.toLocaleString('en-US')} BDT পরিশোধ করুন
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
      setSimulationError(`দুঃখিত! আপনার মেইন ব্যালেন্স থেকে কিস্তি এবং জরিমানা বাবদ প্রয়োজনীয় ৳${totalDeduction.toLocaleString('en-US')} স্বয়ংক্রিয়ভাবে কাটার জন্য পর্যাপ্ত ব্যালেন্স নেই। অনুগ্রহ করে ওয়ালেটে ফান্ড অ্যাড করুন।`);
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
        body: `আপনার একাউন্টের মেইন ব্যালেন্স থেকে সফলভাবে কিস্তি বাবদ ৳${installmentAmount.toLocaleString('en-US')} ${penaltyAmount > 0 ? `এবং বিলম্ব জরিমানা বাবদ ৳${penaltyAmount.toLocaleString('en-US')}` : ''} স্বয়ংক্রিয়ভাবে কেটে নেওয়া হয়েছে। আপনার আমানত সুরক্ষায় সহযোগিতা করার জন্য ধন্যবাদ।`,
        read: false,
        createdAt: new Date().toISOString()
      });
      
      setSimulationSuccess(`আলহামদুলিল্লাহ! আপনার কিস্তি অটো-ডেবিট এবং জরিমানা সমন্বয় সফলভাবে সম্পন্ন হয়েছে। মেইন ওয়ালেট থেকে মোট ৳${totalDeduction.toLocaleString('en-US')} কেটে নেওয়া হয়েছে।`);
      
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans relative pt-[max(10px,env(safe-area-inset-top))]">
      
      {/* Header Area */}
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/80 px-2 py-2 shrink-0 shadow-3xs overflow-x-auto no-scrollbar">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-1 min-w-max">
          {/* Left Group: Back button + Section Name */}
          <div className="flex items-center gap-1.5 shrink-0">
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

            <div className="shrink-0 px-0.5">
              <h1 className="text-xs font-black text-rose-600 font-sans tracking-tight leading-none">
                করযে হাসানা
              </h1>
            </div>
          </div>

          {/* Right Group: Joined Balances Box + Transaction History Button (ব্যালেন্সের ঠিক পাশে লেনদেন বাটন) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-xl px-2 py-1 shrink-0 divide-x divide-slate-200/90 gap-1.5">
              {/* Main Balance */}
              <div className="pr-1 text-left leading-none">
                <span className="text-[6.5px] sm:text-[7px] font-extrabold text-emerald-700 uppercase block tracking-tighter">মেইন ব্যালেন্স</span>
                <span className="text-[10px] sm:text-[10.5px] font-black text-emerald-950 font-sans block mt-0.5 whitespace-nowrap">৳ {(user.balance || 0).toLocaleString('en-US')}</span>
              </div>
              {/* Qard Hasana Fund */}
              <div className="px-1.5 text-left leading-none">
                <span className="text-[6.5px] sm:text-[7px] font-extrabold text-rose-700 uppercase block tracking-tighter">করযে হাসানা ফান্ড</span>
                <span className="text-[10px] sm:text-[10.5px] font-black text-rose-950 font-sans block mt-0.5 whitespace-nowrap">৳ {(qardTotalFund || 0).toLocaleString('en-US')}</span>
              </div>
              {/* Distributed Loans */}
              <div className="pl-1.5 text-left leading-none">
                <span className="text-[6.5px] sm:text-[7px] font-extrabold text-amber-700 uppercase block tracking-tighter">বিতরণকৃত ঋণ</span>
                <span className="text-[10px] sm:text-[10.5px] font-black text-amber-950 font-sans block mt-0.5 whitespace-nowrap">৳ {(qardActiveLoansAmount || 0).toLocaleString('en-US')}</span>
              </div>
            </div>

            {/* Transaction History Button */}
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
                amount: loanAmt.toLocaleString('en-US'),
                installments: isComplete ? '3/3' : (t.loanDuration ? `1/${t.loanDuration}` : '1/3'),
                dueAmount: remaining.toLocaleString('en-US'),
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

          // Aggregate all donations by unique donor (userId/phone/name) for Cumulative Totals
          const allDonationsTxs = qardHistory.filter(t => {
            if (t.type !== 'qard_donation' || t.status !== 'success') return false;
            const nameStr = String(t.userName || '');
            if (nameStr.includes('জুবায়ের') || nameStr.includes('Jubayer')) return false;
            if (Number(t.amount) === 2500) return false;
            return true;
          });
          const donorMap: Record<string, {
            userId: string;
            name: string;
            phone: string;
            image: string;
            initialLetter: string;
            totalAmount: number;
            donationCount: number;
            latestDate: string;
            latestTimestamp: number;
            history: Array<{
              id: string;
              amount: number;
              date: string;
              typeLabel: string;
              description: string;
              receiptNo?: string;
              transactionId?: string;
            }>;
          }> = {};

          allDonationsTxs.forEach((t) => {
            const key = t.userId || t.userPhone || t.userName || 'anonymous';
            const donateAmt = Number(t.amount) || 0;
            const uInfo = usersMap[t.userId] || 
                          (t.userPhone ? usersMap[t.userPhone] : null) || 
                          (t.memberId ? usersMap[t.memberId] : null) ||
                          (t.userName ? usersMap[t.userName] : null);

            const memberName = t.userName === 'গোপন দাতা' ? 'গোপন দাতা' : (uInfo?.name || t.userName || 'দানশীল সদস্য');
            const memberPhone = (uInfo as any)?.phone || t.userPhone || '';
            const memberPhoto = t.userName === 'গোপন দাতা' 
              ? '' 
              : (uInfo?.photoURL || uInfo?.photo || (uInfo as any)?.profilePic || t.userPhoto || t.photoURL || (t as any).profilePic || (user && (user.uid === t.userId || user.name === t.userName || user.phone === t.userPhone) ? (user.photoURL || user.profilePic || (user as any).photo) : '') || '');

            const initialLetter = (memberName || 'দ').trim().charAt(0).toUpperCase();

            const txDate = t.createdAt ? new Date(t.createdAt) : new Date();
            const formattedDate = txDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
            const typeLabel = t.description?.includes('মাসিক') ? 'মাসিক অনুদান' : (t.description?.includes('আমানত') ? 'কল্যাণ আমানত' : 'স্বেচ্ছা অনুদান');

            if (!donorMap[key]) {
              donorMap[key] = {
                userId: key,
                name: memberName,
                phone: memberPhone,
                image: memberPhoto,
                initialLetter,
                totalAmount: 0,
                donationCount: 0,
                latestDate: formattedDate,
                latestTimestamp: txDate.getTime(),
                history: []
              };
            } else {
              if (!donorMap[key].image && memberPhoto) {
                donorMap[key].image = memberPhoto;
              }
              if (memberName && memberName !== 'দানশীল সদস্য' && donorMap[key].name === 'দানশীল সদস্য') {
                donorMap[key].name = memberName;
              }
            }

            donorMap[key].totalAmount += donateAmt;
            donorMap[key].donationCount += 1;
            if (txDate.getTime() >= donorMap[key].latestTimestamp) {
              donorMap[key].latestTimestamp = txDate.getTime();
              donorMap[key].latestDate = formattedDate;
            }

            donorMap[key].history.push({
              id: t.id || t.transactionId || String(Math.random()),
              amount: donateAmt,
              date: formattedDate,
              typeLabel,
              description: t.description || 'করযে হাসানা অনুদান',
              receiptNo: t.receiptNo,
              transactionId: t.transactionId
            });
          });

          // Sort each donor's individual history descending by date
          Object.values(donorMap).forEach((d) => {
            d.history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          });

          // Sorted donors array by total cumulative donation descending (Highest to Lowest)
          const aggregatedDonorsList = Object.values(donorMap).sort((a, b) => b.totalAmount - a.totalAmount);
          const displayDonors = aggregatedDonorsList.slice(0, 5);

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

              {/* Premium Image Slider System (Memoized isolated slider) */}
              <QardBannerSlider adSlides={adSlides} />

              {/* Top Section: Compact Sleek Full-Width Banner for 'কর্জে হাসানায় দান করুন' */}
              <div className="my-2 w-full">
                <div 
                  onClick={() => setActiveTab('donate')}
                  className="w-full bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 hover:from-emerald-900 hover:to-teal-900 text-white py-2.5 px-3.5 sm:py-3 sm:px-4 rounded-2.5xl shadow-md border border-emerald-500/70 flex items-center justify-between gap-2.5 cursor-pointer transition active:scale-98 group relative overflow-hidden"
                >
                  {/* Decorative subtle glowing background highlight */}
                  <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

                  <div className="flex items-center gap-2.5 relative z-10 text-left min-w-0 flex-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 text-emerald-950 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition border border-amber-300">
                      <HeartHandshake className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-emerald-950" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[8.5px] sm:text-[9.5px] font-black bg-amber-400 text-emerald-950 px-2 py-0.2 rounded-full shadow-3xs leading-tight">
                          ✨ ১৮ গুণ সওয়াব
                        </span>
                        <span className="text-[8.5px] font-bold text-emerald-200 bg-white/10 px-1.5 py-0.2 rounded-full border border-white/20 hidden sm:inline-block">
                          সদকা এ جاریয়া
                        </span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-black text-amber-300 font-sans leading-tight truncate">
                        উম্মাহর সেবায় করযে হাসানায় দান করুন
                      </h3>
                    </div>
                  </div>

                  {/* Right Action Button */}
                  <div className="relative z-10 shrink-0">
                    <div className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-emerald-950 rounded-xl text-[11px] font-black shadow-xs flex items-center gap-1 group-hover:translate-x-0.5 transition border border-amber-300">
                      <HandHeart className="w-3.5 h-3.5 text-emerald-950 fill-emerald-950" />
                      <span>দান করুন ➔</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Loan Repayment Component if user has active due loan */}
              {renderActiveLoanRepaymentCard()}

              {/* Bottom 4 Section Cards Grid - 4 Columns Layout */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 my-3">
                {/* 1. টাকা নিতে আবেদন (First) */}
                <button 
                  type="button"
                  onClick={() => setActiveTab('apply')}
                  className="bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-200/80 rounded-2xl p-2 sm:p-2.5 text-center shadow-4xs flex flex-col items-center justify-between min-w-0 cursor-pointer transition active:scale-95 group"
                >
                  <div className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition mb-1">
                    <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="space-y-0.5 min-w-0 w-full">
                    <span className="text-[9px] sm:text-[10.5px] font-black text-emerald-950 block truncate leading-tight">টাকা নিতে আবেদন</span>
                    <span className="text-[7px] sm:text-[8.5px] text-emerald-700 font-bold block truncate leading-none mt-0.5">সুদমুক্ত ঋণ</span>
                  </div>
                </button>

                {/* 2. টাকা পরিশোধ */}
                <button 
                  type="button"
                  onClick={() => {
                    setRepaySubTab('my_loan');
                    setShowRepayModal(true);
                  }}
                  className="bg-amber-50/60 hover:bg-amber-100/80 border border-amber-200/80 rounded-2xl p-2 sm:p-2.5 text-center shadow-4xs flex flex-col items-center justify-between min-w-0 cursor-pointer transition active:scale-95 group"
                >
                  <div className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition mb-1">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="space-y-0.5 min-w-0 w-full">
                    <span className="text-[9px] sm:text-[10.5px] font-black text-amber-950 block truncate leading-tight">টাকা পরিশোধ</span>
                    <span className="text-[7px] sm:text-[8.5px] text-amber-700 font-bold block truncate leading-none mt-0.5">কিস্তি বা ফেরত</span>
                  </div>
                </button>

                {/* 3. আমার আবেদন */}
                <button 
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200/80 rounded-2xl p-2 sm:p-2.5 text-center shadow-4xs flex flex-col items-center justify-between min-w-0 cursor-pointer transition active:scale-95 group"
                >
                  <div className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition mb-1">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="space-y-0.5 min-w-0 w-full">
                    <span className="text-[9px] sm:text-[10.5px] font-black text-slate-900 block truncate leading-tight">আমার আবেদন</span>
                    <span className="text-[7px] sm:text-[8.5px] text-blue-700 font-bold block truncate leading-none mt-0.5">আবেদন স্ট্যাটাস</span>
                  </div>
                </button>

                {/* 4. স্বর্ণ রেখে লোন (Last) */}
                <button 
                  type="button"
                  onClick={() => {
                    setActiveTab('gold_loan');
                    setGoldSuccessMsg('');
                    setGoldErrorMsg('');
                  }}
                  className="bg-gradient-to-b from-amber-50 to-yellow-50 hover:bg-amber-100 border border-amber-200 rounded-2xl p-2 sm:p-2.5 text-center shadow-4xs flex flex-col items-center justify-between min-w-0 cursor-pointer transition active:scale-95 group"
                >
                  <div className="w-8.5 h-8.5 sm:w-10 sm:h-10 bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition mb-1">
                    <Gem className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="space-y-0.5 min-w-0 w-full">
                    <span className="text-[9px] sm:text-[10.5px] font-black text-amber-950 block truncate leading-tight">স্বর্ণ রেখে লোন</span>
                    <span className="text-[7px] sm:text-[8.5px] text-amber-700 font-bold block truncate leading-none mt-0.5">১০০% সমপরিমাণ</span>
                  </div>
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

              {/* LIST 2: কে ফান্ডে টাকা দিয়েছে (একক দাতা সর্বমোট দান খতিয়ান তালিকা) */}
              <div className="space-y-2.5 my-3 font-sans">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs font-black text-sky-850 font-sans border-l-4 border-sky-500 pl-2">কে ফান্ডে টাকা দিয়েছে (সর্বমোট দান খতিয়ান)</h3>
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
                          onClick={() => setSelectedDonorForDetails(item)}
                          className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2.5xl hover:bg-emerald-50/40 hover:border-emerald-200 transition duration-150 shadow-3xs gap-2 sm:gap-3 cursor-pointer group"
                        >
                          {/* Avatar Initials & Full Name */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {item.image ? (
                              <img 
                                src={item.image} 
                                alt={item.name}
                                className="w-10.5 h-10.5 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-emerald-500 shrink-0 shadow-xs group-hover:scale-105 transition" 
                                referrerPolicy="no-referrer" 
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                  const fallback = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`w-10.5 h-10.5 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xs sm:text-sm font-black shrink-0 border-2 border-emerald-400 shadow-xs group-hover:scale-105 transition ${item.image ? 'hidden' : 'flex'}`}>
                              {item.initialLetter}
                            </div>
                            <div className="min-w-0 flex-1 pr-1">
                              <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-snug group-hover:text-emerald-800 transition whitespace-normal break-words">
                                {item.name}
                              </h4>
                              <span className="text-[8.5px] text-emerald-700 bg-emerald-50 border border-emerald-150 px-1.5 py-0.2 rounded font-extrabold inline-block mt-0.5">
                                {item.donationCount > 1 ? `মোট ${item.donationCount} টি অনুদান` : '১ টি অনুদান'}
                              </span>
                            </div>
                          </div>

                          {/* সর্বমোট দেওয়া টাকা */}
                          <div className="shrink-0 text-right sm:text-left sm:w-[22%]">
                            <span className="text-[8px] text-slate-400 block font-black uppercase leading-none">সর্বমোট দান</span>
                            <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono mt-1 block">
                              ৳ {item.totalAmount.toLocaleString('en-US')}
                            </span>
                          </div>

                          {/* সর্বশেষ দানের তারিখ */}
                          <div className="hidden sm:block sm:w-[24%] text-left shrink-0">
                            <span className="text-[8px] text-slate-400 block font-black uppercase leading-none mb-1">সর্বশেষ দান</span>
                            <span className="text-[9.5px] font-extrabold text-slate-600 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {item.latestDate}
                            </span>
                          </div>

                          {/* Details CTA button */}
                          <div className="shrink-0 text-right flex items-center justify-end">
                            <span className="text-[9.5px] font-black text-teal-800 bg-teal-50 border border-teal-200 px-2 py-1 rounded-xl group-hover:bg-teal-600 group-hover:text-white transition flex items-center gap-0.5 shadow-4xs">
                              হিস্ট্রি <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* আরো দেখুন বাটন (কে ফান্ডে টাকা দিয়েছে) */}
                      {aggregatedDonorsList.length > 5 ? (
                        <button
                          type="button"
                          onClick={() => setShowDonorsModal(true)}
                          className="w-full py-2.5 px-4 bg-sky-50/90 hover:bg-sky-100/90 text-sky-800 border border-sky-200/90 rounded-2xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs active:scale-98 mt-1"
                        >
                          <span>আরো দেখুন (মোট {aggregatedDonorsList.length.toLocaleString('en-US')} জন দাতা সদস্য)</span>
                          <ChevronRight className="w-4 h-4 text-sky-700" />
                        </button>
                      ) : (
                        aggregatedDonorsList.length > 0 && (
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

        {/* ==================== TAB 1: DONATE FORM (Compact Sleek Single Purpose Form) ==================== */}
        {activeTab === 'donate' && (
          <div className="space-y-3 max-w-lg mx-auto animate-fade-in text-center font-sans">
            
            {/* Islamic Hadith Card encouraging Qard Hasana */}
            <div className="bg-gradient-to-br from-emerald-950 via-teal-900 to-emerald-900 text-white border-2 border-emerald-600/80 p-4 sm:p-5 rounded-2xl text-left space-y-3.5 shadow-lg relative overflow-hidden">
              {/* Header Badge */}
              <div className="flex items-center justify-between pb-2.5 border-b border-emerald-600/60">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-400 text-emerald-950 rounded-xl text-sm font-black shrink-0 shadow-xs">📖</span>
                  <h3 className="text-sm sm:text-base md:text-lg font-black text-amber-300 font-sans tracking-tight leading-tight">
                    করযে হাসানার বিশেষ ফজিলত ও সওয়াব
                  </h3>
                </div>
                <span className="text-xs sm:text-sm font-black uppercase bg-amber-400 text-emerald-950 px-2.5 py-1 rounded-full shadow-xs leading-none">
                  ১৮ গুণ সওয়াব
                </span>
              </div>

              {/* Hadith 1 */}
              <div className="bg-emerald-900/80 p-3 sm:p-3.5 rounded-xl border border-emerald-600/60 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs sm:text-sm">
                  <span>✨ সুনান ইবনে মাজাহ (হাদিস: ২৪৩১/১৮৪৪)</span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-50 font-normal leading-relaxed">
                  রাসূলুল্লাহ (সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম) বলেছেনঃ <span className="text-amber-200 font-black text-xs sm:text-sm md:text-base block sm:inline my-1 sm:my-0">"মিরাজের রাতে আমি জান্নাতের দরজায় লিখিত দেখেছি— 'দানের সওয়াব ১০ গুণ এবং করযে হাসানার (সুদমুক্ত ঋণের) সওয়াব ১৮ গুণ।'"</span> আমি জিবরীল (আঃ)-কে জিজ্ঞেস করলাম, করযে হাসানার সওয়াব দানের চেয়ে বেশি কেন? তিনি বললেন, <span className="text-amber-100 italic font-semibold">'কারণ সাহায্যপ্রার্থী প্রয়োজন না থাকলেও চাইতে পারে, কিন্তু ঋণগ্রহীতা ব্যক্তি একমাত্র চরম প্রয়োজনেই ঋণ চায়।'</span>
                </p>
              </div>

              {/* Hadith 2 */}
              <div className="bg-emerald-900/80 p-3 sm:p-3.5 rounded-xl border border-emerald-600/60 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs sm:text-sm">
                  <span>✨ সহীহ মুসলিম (হাদিস: ২৬৯৯)</span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-50 font-normal leading-relaxed">
                  রাসূলুল্লাহ (সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম) বলেছেনঃ <span className="text-amber-200 font-black text-xs sm:text-sm md:text-base block sm:inline my-1 sm:my-0">"যে ব্যক্তি কোনো মুসলিমের পার্থিব বিপদ-আপদ দূর করবে, কেয়ামতের দিন আল্লাহ তাআলা তার একটি কঠিন বিপদ দূর করে দেবেন।"</span>
                </p>
              </div>

              {/* Virtues summary */}
              <div className="bg-amber-400/20 p-2.5 sm:p-3 rounded-xl border border-amber-400/40 text-xs sm:text-sm text-amber-100 font-bold leading-relaxed flex items-start gap-2">
                <span className="text-base shrink-0">💡</span>
                <span><strong>সংক্ষিপ্ত সুবিধাঃ</strong> সাধারণ দান অপেক্ষা ১.৮ গুণ (১৮ গুণ) বেশি সওয়াব, মানুষের আত্মসম্মান রক্ষা করে অসচ্ছলদের সেবা এবং সমাজে সুদমুক্ত অর্থনীতির প্রসার।</span>
              </div>
            </div>

            <form onSubmit={handleDonateSubmit} className="space-y-2.5 font-sans">
              
              {/* Single Purpose Card: কর্জে হাসানা */}
              <div className="bg-white border border-slate-200/90 p-2.5 sm:p-3 rounded-xl space-y-1.5 shadow-2xs text-left">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 bg-rose-50 rounded-md text-rose-700 shrink-0">
                      <HeartHandshake className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[10.5px] font-black text-slate-800">১. খাতের নামঃ কর্জে হাসানা</span>
                  </div>
                  <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ✓ খাত নির্ধারিত
                  </span>
                </div>

                <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-rose-50/70 to-emerald-50/70 border border-rose-200/80 rounded-lg">
                  <span className="text-sm p-1.5 bg-white border border-rose-200 rounded-md shrink-0 shadow-2xs">🤝</span>
                  <div className="text-left min-w-0">
                    <span className="text-xs font-black text-slate-850 block leading-tight">কর্জে হাসানা কল্যাণ ফান্ড</span>
                    <span className="text-[8.5px] block text-slate-500 font-bold leading-tight mt-0.5">অসহায় ও অভাবগ্রস্তদের সুদমুক্ত আর্থিক ঋণ সহায়তা দেওয়ার উদ্দেশ্যে তৈরি বিশেষ ফান্ড।</span>
                  </div>
                </div>
              </div>

              {/* Step 2: Donation Amount selection */}
              <div className="bg-white border border-slate-200/90 p-2.5 sm:p-3 rounded-xl space-y-2 shadow-2xs text-left">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 bg-rose-50 rounded-md text-rose-700 shrink-0">
                      <Coins className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[10.5px] font-black text-slate-800">২. কর্জে হাসানাতে দান করুন (টাকা):</span>
                  </div>
                  <span className="text-[8.5px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                    ন্যূনতম 5 ৳
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center text-rose-600 font-black text-sm pointer-events-none">
                      ৳
                    </div>
                    <input
                      type="number"
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                      placeholder="কত টাকা দান করতে চান লিখুন..."
                      className="w-full bg-slate-50 border border-slate-250 rounded-xl py-2 pl-7 pr-3 text-sm font-black font-mono focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-slate-850"
                      required
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="grid grid-cols-6 gap-1">
                    {[
                      { val: '5', label: '5 ৳' },
                      { val: '10', label: '10 ৳' },
                      { val: '20', label: '20 ৳' },
                      { val: '50', label: '50 ৳' },
                      { val: '100', label: '100 ৳' },
                      { val: '500', label: '500 ৳' }
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.val}
                        onClick={() => setDonationAmount(item.val)}
                        className={`py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer active:scale-95 text-center ${
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
              <div className="bg-white border border-slate-200/90 p-2.5 sm:p-3 rounded-xl space-y-2 shadow-2xs text-left">
                <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
                  <span className="p-1 bg-rose-50 rounded-md text-rose-700 shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[10.5px] font-black text-slate-800">৩. সুরক্ষা ও গোপনীয়তা সেটিংসঃ</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Anonymous Donation Option */}
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-left min-w-0">
                      <EyeOff className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[9.5px] text-slate-850 font-black block leading-none">গোপন দাতা</span>
                        <span className="text-[7.5px] text-slate-450 block leading-none font-bold mt-0.5 truncate">
                          নাম প্রকাশ গোপন থাকবে
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
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex items-center justify-between gap-1">
                    <div className="text-left min-w-0">
                      <span className="text-[9.5px] text-slate-850 font-black block leading-none">সিকিউরিটি পিন *</span>
                      <span className="text-[7.5px] text-slate-450 block leading-none font-bold mt-0.5">
                        4-সংখ্যার পিন
                      </span>
                    </div>
                    <input
                      type="password"
                      maxLength={4}
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-12 bg-white border border-slate-300 rounded-lg px-1 py-1 text-center font-mono text-xs tracking-widest text-slate-800 font-black focus:outline-none focus:border-rose-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {loading ? 'প্রসেসিং হচ্ছে...' : 'কর্জযে হাসানাতে দান সম্পন্ন করুন'}
                  <Heart className="w-4 h-4 fill-current animate-pulse text-white" />
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
                            {isDonation || isRepayment ? '+' : '-'}৳ {tx.amount?.toLocaleString('en-US')}
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
                              <strong className="text-xs font-extrabold text-slate-800">৳ {tx.amount?.toLocaleString('en-US')} BDT ঋণ আবেদন</strong>
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
                          {new Date(tx.createdAt).toLocaleString('en-US')} • {tx.paymentMethod || 'Wallet'}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <span className={"font-mono font-black text-[11px] block " + (tx.type === 'qard_loan_repayment' ? 'text-emerald-600' : 'text-rose-600')}>
                          {tx.type === 'qard_loan_repayment' ? '+' : '-'}৳ {tx.amount?.toLocaleString('en-US')}
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
          const rules = (qardCfg.rulesList && qardCfg.rulesList.length > 0 && qardCfg.rulesList.length <= 3)
            ? qardCfg.rulesList
            : DEFAULT_QARD_CONFIG.rulesList;
          const vNotice = qardCfg.verificationNotice || DEFAULT_QARD_CONFIG.verificationNotice;
          const eligCfg = qardCfg.eligibilityConfig || DEFAULT_QARD_CONFIG.eligibilityConfig;
          const reqDays = eligCfg.requiredActiveDays ?? 60;
          const reqVol = eligCfg.requiredBNBTxVolume ?? 20000;

          const isSamityInvestor = user.samityStatus === 'approved' || user.samityApproved === true || user.isSamityMember === true || user.samitySchemeActive || user.role === 'admin' || user.isDemo;

          const isDaysEligible = isSamityInvestor || activeDays >= reqDays;
          const isVolEligible = isSamityInvestor || ambTxVolume >= reqVol;
          const isOverallEligible = isSamityInvestor || (activeDays >= reqDays && ambTxVolume >= reqVol);

          return (
          <div className="space-y-4 font-sans text-left animate-fade-in">
            {selectedQardSection === 'none' && (
              <div className="space-y-4 animate-fade-in">
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
                        <p className={`text-slate-700 font-bold ${(rule as any).isWarning ? 'text-rose-900 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/60 w-full' : ''}`}>
                          <strong className="text-rose-950 font-black">{rule.title}: </strong>
                          {rule.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <span className="text-base">💡</span>
                  <span>ঋণ গ্রহণের জন্য নিচের যেকোনো একটি সেকশনে ট্যাপ করে পরবর্তী ধাপে (সেকেন্ড পেজ) প্রবেশ করুনঃ</span>
                </div>

                {/* Two Main Selection Cards (Side by side in 1 row) */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedQardSection('investor')}
                    className="p-3.5 sm:p-5 rounded-3xl text-left border bg-gradient-to-br from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900 text-white shadow-md transition cursor-pointer flex flex-col justify-between group active:scale-98"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[8px] sm:text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                        অটো অনুমোদন (২৪/৭)
                      </span>
                      <span className="text-xl sm:text-2xl group-hover:scale-110 transition">🏢</span>
                    </div>
                    <div className="space-y-1">
                      <strong className="text-xs sm:text-sm font-black block leading-snug">
                        ১. BNB ইনভেস্টর
                      </strong>
                      <p className="text-[9px] sm:text-[10px] text-emerald-100 font-bold leading-tight">
                        অনার, শেয়ারহোল্ডার ও ইনভেস্টর অটো-ঋণ (প্রবেশ করুন →)
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedQardSection('general')}
                    className="p-5 rounded-3xl text-left border bg-gradient-to-br from-teal-600 to-emerald-800 hover:from-teal-700 hover:to-emerald-900 text-white shadow-md transition cursor-pointer flex flex-col justify-between group active:scale-98"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[8px] sm:text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                        ম্যানুয়াল আবেদন
                      </span>
                      <span className="text-xl sm:text-2xl group-hover:scale-110 transition">📝</span>
                    </div>
                    <div className="space-y-1">
                      <strong className="text-xs sm:text-sm font-black block leading-snug">
                        ২. সাধারণ সদস্য
                      </strong>
                      <p className="text-[9px] sm:text-[10px] text-teal-100 font-bold leading-tight">
                        সাধারণ সদস্যদের ম্যানুয়াল আবেদন ও এডমিন যাচাই (প্রবেশ করুন →)
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {selectedQardSection === 'investor' && (
              <div className="space-y-4 animate-fade-in">
                {/* Back to selection header */}
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setSelectedQardSection('none')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    ← ব্যাক (সেকশন নির্বাচন)
                  </button>
                  <span className="text-xs font-black text-emerald-950">🏢 ১. ইনভেস্টর অটো-ঋণ সেকশন (সেকেন্ড পেজ)</span>
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
                            <span className="font-bold text-white">৳ {instAmount.toLocaleString('en-US')} BDT</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">বিলম্ব জরিমানা (31তম দিন থেকে প্রতি হাজারে প্রতিদিন ৳10)：</span>
                            <span className={`font-bold ${daysLateVal > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                              ৳ {penAmountVal.toLocaleString('en-US')} BDT
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-slate-850 pt-2 text-xs font-black">
                            <span className="text-rose-400">মোট প্রদেয় কিস্তি (কিস্তি + জরিমানা)：</span>
                            <span className="text-emerald-400">
                              ৳ {totalVal.toLocaleString('en-US')} BDT
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

            {/* Coop Instant Auto-Loan Section (Auto-Disbursement without Admin Approval) */}
            {(() => {
              const coopInstantCfg = qardCfg.coopInstantLoanConfig || DEFAULT_QARD_CONFIG.coopInstantLoanConfig;
              if (coopInstantCfg?.enabled === false) return null;

              const catMeta = getMembershipCategory(user);
              const cat = catMeta.key === 'owner' ? 'owner' : catMeta.key === 'shareholder' ? 'shareholder' : 'investor';
              const catLabel = cat === 'owner' ? 'অনার (৪,০০০৳/মাস - ৭০%)' : cat === 'shareholder' ? 'শেয়ারহোল্ডার (২,০০০৳/মাস - ৬০%)' : 'ইনভেস্টর (১,০০০৳/মাস - ৫০%)';
              const maxPercent = cat === 'owner' ? 70 : cat === 'shareholder' ? 60 : 50;

              const userSavings = user.savings || 0;
              const minInstantLimit = Math.max(1, Math.floor(userSavings * 0.01));
              const maxInstantLimit = Math.floor(userSavings * (maxPercent / 100));

              const effectiveCooldownDays = 60;
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
                <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-orange-500/10 border border-amber-300/80 p-4 sm:p-5 rounded-3xl space-y-3.5 shadow-sm text-left">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2.5">
                    <div>
                      <span className="text-[9px] bg-amber-600 text-white px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-2xs">
                        <Zap className="w-3 h-3 text-amber-200" /> অটো অনুমোদন (No Admin Needed)
                      </span>
                      <h4 className="text-sm font-black text-amber-950 mt-1 flex items-center gap-1.5">
                        ⚡ সমবায় ইনস্ট্যান্ট অটো-ঋণ (২৪/৭)
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[9.5px] text-amber-800 font-black block">আপনার সীমা ({catLabel})</span>
                      <strong className="text-xs sm:text-sm font-mono font-black text-amber-800">৳{minInstantLimit.toLocaleString('en-US')} - ৳{maxInstantLimit.toLocaleString('en-US')} BDT</strong>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-100/80 border border-amber-300/70 rounded-2xl text-[10.5px] text-amber-950 font-bold space-y-1">
                    <p className="font-black text-amber-900">📌 সমবায় সমিতি সঞ্চয় জমা প্রদানকারীদের ক্যাটাগরি ও ইনস্ট্যান্ট ঋণ সুবিধাঃ</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-amber-900 font-bold">
                      <li><strong>ইনভেস্টর (মাসে ১,০০০৳ সমবায় জমা):</strong> জমা সঞ্চয়ের ৫০% অটো-ঋণ</li>
                      <li><strong>শেয়ারহোল্ডার (মাসে ২,০০০৳ সমবায় জমা):</strong> জমা সঞ্চয়ের ৬০% অটো-ঋণ</li>
                      <li><strong>অনার (মাসে ৪,০০০৳ সমবায় জমা):</strong> জমা সঞ্চয়ের ৭০% অটো-ঋণ</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-white/90 p-2.5 rounded-2xl border border-amber-200/60">
                    <div className="space-y-0.5">
                      <span className="text-[9.5px] text-slate-500 font-extrabold">আপনার বর্তমান সঞ্চয়ঃ</span>
                      <p className="text-xs font-black font-mono text-emerald-700">৳{userSavings.toLocaleString('en-US')} BDT</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9.5px] text-slate-500 font-extrabold">আপনার ক্যাটাগরিঃ</span>
                      <p className="text-xs font-black text-amber-900">{catLabel}</p>
                    </div>
                  </div>

                  {/* Concise Rules Badges */}
                  <div className="grid grid-cols-3 gap-1.5 p-2 bg-gradient-to-r from-amber-100/90 via-amber-50 to-orange-50 border border-amber-300/90 rounded-2xl text-[9.5px] font-bold text-amber-950 shadow-2xs">
                    <div className="flex items-center gap-1 bg-white/80 px-2 py-1 rounded-xl border border-amber-200/60">
                      <span>⚡</span>
                      <span>অনুমোদন: <strong className="text-emerald-800 font-black">অটোমেটিক</strong></span>
                    </div>
                    <div className="flex items-center gap-1 bg-white/80 px-2 py-1 rounded-xl border border-amber-200/60">
                      <span>⏳</span>
                      <span>মেয়াদ: <strong className="text-amber-900 font-black">১ মাস (৩০ দিন)</strong></span>
                    </div>
                    <div className="flex items-center gap-1 bg-white/80 px-2 py-1 rounded-xl border border-rose-200/70">
                      <span>⚠️</span>
                      <span>জরিমানা: <strong className="text-rose-700 font-black">১,০০০৳ এ ১০৳/দিন</strong></span>
                    </div>
                  </div>

                  {userSavings <= 0 ? (
                    <div className="p-2.5 bg-amber-50/90 border border-amber-300 text-amber-950 rounded-2xl text-[10px] font-bold flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-black text-amber-950">ℹ️ অটো-ঋণ শুধুমাত্র সমবায় সমিতি সদস্যদের জন্য</p>
                        <p className="text-[9.5px] font-medium text-amber-900 mt-0.5">
                          সমবায় সমিতিতে একাউন্ট বা সঞ্চয় থাকলে আপনি অটো-ঋণ (অনার ৭০%, শেয়ারহোল্ডার ৬০%, ইনভেস্টর ৫০%) পাবেন। সমবায় বহির্ভূত সাধারণ সদস্যরা ১ টাকা থেকে ২,০০০ টাকা ম্যানুয়ালি আবেদন করতে পারেন (যা এডমিন ম্যানুয়ালি বিবেচনা করে এপ্রুভ করবেন)।
                        </p>
                      </div>
                    </div>
                  ) : hasActiveDue ? (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-[10px] font-bold flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-black text-rose-950">⚠️ পূর্বের বকেয়া ঋণ বিদ্যমান!</p>
                        <p className="text-[9.5px] mt-0.5 font-semibold text-rose-800">
                          আপনার নিকট বর্তমানে ৳{(user.dueLoan || 0).toLocaleString('en-US')} BDT বকেয়া ঋণ রয়েছে। অটো-ঋণ নিতে প্রথমে বর্তমান বকেয়া ঋণ সম্পূর্ণ পরিশোধ করুন।
                        </p>
                      </div>
                    </div>
                  ) : isCooldownActive ? (
                    <div className="p-2.5 bg-amber-100/90 border border-amber-300 text-amber-900 rounded-2xl text-[10px] font-bold flex items-start gap-2">
                      <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-black text-amber-950">⏳ বিরতি সময় বাকী রয়েছে!</p>
                        <p className="text-[9.5px] mt-0.5 font-bold">
                          পূর্বের ঋণ সম্পূর্ণ পরিশোধ করেছেন। নিয়ম অনুযায়ী পরিশোধের ৬০ দিন পর ({nextEligibleDateStr}) পুনরায় অটো-ঋণ নেওয়া যাবে। (আর {daysRemaining} দিন বাকি)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleCoopInstantLoanSubmit} className="space-y-2.5 bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-amber-950 uppercase">ঋণের পরিমাণ ({catLabel}):</label>
                          <span className="text-[9.5px] font-bold text-amber-700">
                            সীমাঃ ৳{minInstantLimit.toLocaleString('en-US')} - ৳{maxInstantLimit.toLocaleString('en-US')}
                          </span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-amber-700">৳</span>
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
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setInstantLoanAmtInput(String(minInstantLimit))}
                            className="px-2 py-0.5 bg-amber-100/80 hover:bg-amber-200 text-amber-900 text-[9px] font-black rounded-lg border border-amber-300/70 cursor-pointer"
                          >
                            ১% (৳{minInstantLimit.toLocaleString('en-US')})
                          </button>
                          {maxInstantLimit > minInstantLimit * 2 && (
                            <button
                              type="button"
                              onClick={() => setInstantLoanAmtInput(String(Math.floor((minInstantLimit + maxInstantLimit) / 2)))}
                              className="px-2 py-0.5 bg-amber-100/80 hover:bg-amber-200 text-amber-900 text-[9px] font-black rounded-lg border border-amber-300/70 cursor-pointer"
                            >
                              ৫০% সীমা (৳{Math.floor((minInstantLimit + maxInstantLimit) / 2).toLocaleString('en-US')})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setInstantLoanAmtInput(String(maxInstantLimit))}
                            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black rounded-lg shadow-2xs cursor-pointer ml-auto"
                          >
                            সর্বোচ্চ (৳{maxInstantLimit.toLocaleString('en-US')})
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-700 uppercase">পরিশোধ মেয়াদ ও নিয়ম:</label>
                          <div className="w-full bg-amber-50/50 border border-amber-200 rounded-xl py-2 px-3 text-xs font-bold text-amber-950">
                            1 মাস (30 দিন) — একবারে সম্পূর্ণ পরিশোধযোগ্য
                          </div>
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

                      {/* Live 1-Month Fixed Repayment Info Box */}
                      {(() => {
                        const curAmt = parseFloat(instantLoanAmtInput || String(maxInstantLimit)) || 0;
                        return (
                          <div className="p-3 bg-slate-900 text-white rounded-2xl text-[10.5px] space-y-1.5 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-300">📊 ১ মাস (৩০ দিন) মেয়াদে একবারে সম্পূর্ণ পরিশোধযোগ্যঃ</span>
                              <strong className="font-mono text-amber-400 font-black text-xs">৳{curAmt.toLocaleString('en-US')} BDT</strong>
                            </div>
                            <div className="p-2 bg-slate-800/80 rounded-xl text-[9.5px] text-slate-300 space-y-0.5">
                              <p className="text-amber-300 font-bold">🔔 মেয়াদ শেষ হওয়ার ২ দিন পূর্বে অটো নোটিফিকেশন রিমাইন্ডার যাবে।</p>
                              <p className="text-rose-400 font-bold">⚠️ ৩০ দিন পার হলে প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা হারে বিলম্ব জরিমানা প্রযোজ্য হবে।</p>
                            </div>
                          </div>
                        );
                      })()}

                      <button
                        type="submit"
                        disabled={instantLoanLoading}
                        className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-98 text-white font-black text-xs rounded-xl shadow-md transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4 text-amber-200 fill-amber-200" />
                        {instantLoanLoading
                          ? 'প্রক্রিয়াকরণ হচ্ছে...'
                          : `৳ ${parseFloat(instantLoanAmtInput || String(maxInstantLimit)).toLocaleString('en-US')} ইনস্ট্যান্ট অটো-ঋণ গ্রহণ করুন (অটো-অনুমোদন)`}
                      </button>
                    </form>
                  )}
                </div>
              );
            })()}
              </div>
            )}

            {selectedQardSection === 'general' && (
              <div className="space-y-4 animate-fade-in">
                {/* Back to selection header */}
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setSelectedQardSection('none')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    ← ব্যাক (সেকশন নির্বাচন)
                  </button>
                  <span className="text-xs font-black text-emerald-950">📝 ২. সাধারণ সদস্য ম্যানুয়াল আবেদন (সেকেন্ড পেজ)</span>
                </div>

                {/* Apply Application Form block */}
                <form onSubmit={handleLoanApply} className="bg-white border border-slate-150 p-5 rounded-3xl space-y-4 shadow-3xs text-left">
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
                <label className="text-[10px] text-slate-650 font-extrabold uppercase tracking-wide block">3. ঋণ পরিশোধের মেয়াদ ও নিয়মাবলি：</label>
                <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3 text-left space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-rose-900">🗓️ ঋণের সর্বোচ্চ মেয়াদঃ 30 দিন (1 মাস)</span>
                    <span className="text-[9px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded-full">30 দিন ফিক্সড</span>
                  </div>
                  <p className="text-[10.5px] text-slate-700 font-bold leading-relaxed">
                    যেই তারিখে টাকা গ্রহণ করবেন, ঠিক পরের মাসের একই তারিখে সম্পূর্ণ টাকা ফেরত দিতে হবে (যেমনঃ 10 অক্টোবর টাকা নিলে 10 নভেম্বরের মধ্যে ফেরত দিতে হবে)।
                  </p>
                  <p className="text-[9.5px] text-rose-800 font-black pt-0.5">
                    🔔 মেয়াদ শেষ হওয়ার 2 দিন পূর্বে রিমাইন্ডার যাবে। 30 দিন পার হলে 31তম দিন থেকে প্রতিদিন প্রতি 1,000 টাকায় 10 টাকা বিলম্ব ফি যুক্ত হবে।
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-650 font-extrabold uppercase tracking-wide block">4. ঋণের সুনির্দিষ্ট উদ্দেশ্য ও কারণঃ</label>
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
                <label className="text-[10px] text-slate-650 font-extrabold uppercase tracking-wide block">5. 4-ডিজিট সিকিউরিটি পিন নাম্বারঃ</label>
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
            )}
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
                            <p className="text-[9px] text-slate-400 mt-0.5">{new Date(tx.createdAt).toLocaleString('en-US')}</p>
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
                        const donorId = firstTx ? firstTx.memberId : 'BNB00000000';
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
                            <span className="font-mono font-black text-emerald-600 text-xs">+৳ {totalContribution?.toLocaleString('en-US')}</span>
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
                  <p className="text-slate-450 border-b border-slate-100 pb-1.5">{new Date().toLocaleString('en-US')} • অ্যান্ডমিন প্যানেল সচল করা হয়েছে</p>
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
          const protMonths = goldCfg?.protectionMonths ?? 1;
          const protDays = goldCfg?.protectionDays ?? 30;

          const rates = goldCfg?.rates || {
            k24: 125000,
            k22: 115000,
            k21: 110000,
            k18: 95000,
            traditional: 80000
          };

          const guidelinesList = (goldCfg?.guidelines && goldCfg.guidelines.length > 0 && goldCfg.guidelines.length <= 3)
            ? goldCfg.guidelines
            : DEFAULT_QARD_CONFIG.goldLoanConfig.guidelines;

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
                message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ${goldJewelryType} (${goldCarat}) জমা রেখে ৳${cashReceived.toLocaleString('en-US')} জরুরি ঋণের আবেদন করেছেন।`,
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
                message: `আপনার ${goldJewelryType} (${goldCarat}) স্বর্ণ জমার বিপরীতে ৳${cashReceived.toLocaleString('en-US')} জরুরি সহায়তার আবেদন জমা হয়েছে। 100% সমান বাজারমূল্যে 0% সুদে স্বর্ণ ভল্ট হেফাজতে থাকবে।`,
                type: 'gold_loan',
                read: false,
                createdAt: serverTimestamp()
              });

              setGoldSuccessMsg(`অভিনন্দন! আপনার স্বর্ণ রেখে জরুরি টাকার আবেদনটি সফলভাবে গৃহীত হয়েছে। মোট অনুমোদিত ক্যাশ: ৳${cashReceived.toLocaleString('en-US')} (100% বাজারদর • 0% সুদ)।`);
              setGoldJewelryType('');
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

              {/* Concise, Professional & Elegant Terms Box */}
              <div className="bg-gradient-to-br from-amber-50/90 via-white to-amber-50/50 border-2 border-amber-300/80 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
                {/* Header */}
                <div className="flex items-start gap-2.5 pb-2.5 border-b border-amber-200/80">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-600 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                    <Gem className="w-5 h-5 text-amber-100" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-950 font-sans leading-tight">
                      স্বর্ণ রেখে ১ মাসের সুদমুক্ত জরুরি হাওলাত
                    </h4>
                    <p className="text-[10.5px] text-amber-900 font-bold mt-1 leading-relaxed">
                      বাংলাদেশের যেকোনো নাগরিক বিপদের মুহূর্তে নিজের মূল্যবান স্বর্ণ বিক্রি না করে তা আমাদের কাছে গচ্ছিত রেখে বর্তমান বাজারদর অনুযায়ী ১০০% সমপরিমাণ টাকা ১ মাসের জন্য সুদমুক্ত হাওলাত গ্রহণ করতে পারবেন। ১ মাস পর আসল টাকা ফেরত দিয়ে গচ্ছিত স্বর্ণ শতভাগ অক্ষত অবস্থায় বুঝে নিন।
                    </p>
                  </div>
                </div>

                {/* Clean Bullet Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
                  {/* Card 1 */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200/80 flex items-start gap-2 shadow-3xs">
                    <span className="text-base leading-none p-1 bg-amber-100/80 rounded-lg shrink-0">🪙</span>
                    <div>
                      <strong className="text-[11px] font-black text-amber-950 block">১০০% সমপরিমাণ ক্যাশ</strong>
                      <p className="text-[10px] text-slate-600 font-medium leading-tight mt-0.5">
                        স্বর্ণের তৎকালীন বাজারমূল্যের সমপরিমাণ (১০০% টাকা) ক্যাশ পাবেন।
                      </p>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200/80 flex items-start gap-2 shadow-3xs">
                    <span className="text-base leading-none p-1 bg-amber-100/80 rounded-lg shrink-0">⏳</span>
                    <div>
                      <strong className="text-[11px] font-black text-amber-950 block">১ মাসের সুদমুক্ত মেয়াদ</strong>
                      <p className="text-[10px] text-slate-600 font-medium leading-tight mt-0.5">
                        সম্পূর্ণ ০% সুদ বা কোনো লাভ/হিডেন চার্জ ছাড়াই ১ মাস (৩০ দিন) ব্যবহারের সুযোগ।
                      </p>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200/80 flex items-start gap-2 shadow-3xs">
                    <span className="text-base leading-none p-1 bg-amber-100/80 rounded-lg shrink-0">🔒</span>
                    <div>
                      <strong className="text-[11px] font-black text-amber-950 block">ভল্টে নিরাপদ হেফাজত</strong>
                      <p className="text-[10px] text-slate-600 font-medium leading-tight mt-0.5">
                        আপনার গচ্ছিত স্বর্ণ অফিশিয়াল সিলযুক্ত সিকিউর ভল্টে শতভাগ অক্ষত সংরক্ষিত থাকবে।
                      </p>
                    </div>
                  </div>

                  {/* Card 4 */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200/80 flex items-start gap-2 shadow-3xs">
                    <span className="text-base leading-none p-1 bg-amber-100/80 rounded-lg shrink-0">🔄</span>
                    <div>
                      <strong className="text-[11px] font-black text-amber-950 block">মূল টাকা ফেরত ও স্বর্ণ গ্রহণ</strong>
                      <p className="text-[10px] text-slate-600 font-medium leading-tight mt-0.5">
                        ১ মাসের (৩০ দিন) মধ্যে গৃহীত মূল টাকা জমা দিয়ে সঙ্গে সঙ্গে নিজের স্বর্ণ বুঝে নিন।
                      </p>
                    </div>
                  </div>

                  {/* Card 5 - Overdue Fine Rule */}
                  <div className="bg-amber-100/70 p-2.5 rounded-xl border border-amber-300/90 flex items-start gap-2 shadow-3xs col-span-1 sm:col-span-2">
                    <span className="text-base leading-none p-1 bg-amber-200/90 rounded-lg shrink-0">⚠️</span>
                    <div>
                      <strong className="text-[11px] font-black text-amber-950 block">৩০ দিন পর বিলম্ব ফি/জরিমানা</strong>
                      <p className="text-[10px] text-amber-900 font-bold leading-tight mt-0.5">
                        ৩০ দিনের (১ মাস) মধ্যে টাকা ফেরত না দিলে, পরবর্তীতে প্রতি দিনের বিলম্বের জন্য প্রতি ১,০০০ টাকায় ১০ টাকা করে জরিমানা/বিলম্ব ফি প্রযোজ্য হবে।
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Tagline */}
                <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-yellow-800 text-amber-100 px-3 py-1.5 rounded-xl text-[10px] font-bold text-center flex items-center justify-center gap-1.5 shadow-3xs">
                  <span>🤝</span>
                  <span>"বাংলাদেশের যেকোনো নাগরিক বিপদের সময় স্বর্ণ বিক্রি না করে সুরক্ষিত রেখে সুদমুক্ত আর্থিক সেবা নিতে পারবেন।"</span>
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
                      ৳{totalGoldCash.toLocaleString('en-US')}
                    </h3>
                    <span className="text-[7.5px] font-extrabold text-amber-700 block mt-0.5">
                      (সমান সমান বাজারমূল্য: ৳{totalMarketVal.toLocaleString('en-US')})
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
                            <strong className="text-slate-900 font-mono">৳{(Number(loan.marketValue) || 0).toLocaleString('en-US')}</strong>
                          </div>
                          <div className="col-span-2">
                            <span>প্রাপ্ত জরুরি ক্যাশ: </span>
                            <strong className="text-emerald-700 font-mono font-bold">৳{(Number(loan.cashAmount) || 0).toLocaleString('en-US')} (100% বাজারমূল্য)</strong>
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
                      placeholder="স্বর্ণের বাজার বিক্রয়মূল্য লিখুন (৳)"
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="absolute right-3 top-2 text-xs font-black text-amber-700">৳</span>
                  </div>
                </div>

                {/* Calculation Output Box */}
                <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white p-2.5 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-[10px] font-bold border-b border-white/20 pb-1">
                    <span>স্বর্ণের বাজারদর (100%):</span>
                    <span className="font-mono">৳{parsedCalcMarket.toLocaleString('en-US')}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-black text-yellow-200 border-b border-white/20 pb-1">
                    <span>প্রদেয় অনুপাত ও সুদ:</span>
                    <span>সমান সমান টাকা (0% সুদ)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-black pt-0.5">
                    <span>আপনি তাৎক্ষণিক পাবেন:</span>
                    <span className="text-sm font-mono text-white bg-white/20 px-2 py-0.5 rounded-lg">
                      ৳{calcCash.toLocaleString('en-US')}
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
                        placeholder="উদাঃ স্বর্ণের আংটি, চেইন, বালা, হার বা গহনা লিখুন"
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
                          ৳{(Number(goldMarketValue)).toLocaleString('en-US')}
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
                      আমি নিশ্চিত করছি যে স্বর্ণটি আমার নিজস্ব এবং আমি স্বর্ণ রেখে জরুরি টাকার নিয়মাবলী, ১ মাসের (৩০ দিন) সময়সীমা ও ৩০ দিন অতিবাহিত হলে প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা বিলম্ব ফি সংক্রান্ত শর্তাবলীতে সম্পূর্ণ সম্মত প্রকাশ করছি।
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

      {/* ==================== PAY FOR OTHER MEMBER LOAN MODAL ==================== */}
      <AnimatePresence>
        {showPayForMemberModal && selectedTargetUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[11000] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans text-slate-800"
            onClick={() => setShowPayForMemberModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 flex flex-col text-left"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 flex items-center justify-between shrink-0 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                    <Coins className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">অন্য সদস্যের কিস্তি পরিশোধ করুন</h3>
                    <p className="text-[10.5px] text-emerald-100 font-semibold">আপনার ওয়ালেট থেকে কিস্তি কেটে নেওয়া হবে</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPayForMemberModal(false)}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Target Member Details Card */}
              <div className="p-4 bg-emerald-50/80 border-b border-emerald-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-emerald-800 font-extrabold uppercase block">ঋণ গ্রহীতা সদস্যঃ</span>
                    <h4 className="text-xs font-black text-slate-900">{selectedTargetUser.name || selectedTargetUser.userName || 'সম্মানিত সদস্য'}</h4>
                    <p className="text-[10px] text-slate-500 font-mono font-bold mt-0.5">ফোনঃ {selectedTargetUser.phone || selectedTargetUser.userPhone || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-rose-700 font-black uppercase block">বকেয়া ঋণঃ</span>
                    <strong className="text-sm font-mono font-black text-rose-700">
                      ৳{(selectedTargetUser.dueAmount !== undefined ? selectedTargetUser.dueAmount : (selectedTargetUser.rawDueAmount !== undefined ? selectedTargetUser.rawDueAmount : selectedTargetUser.dueLoan || 0)).toLocaleString('en-US')} BDT
                    </strong>
                  </div>
                </div>

                <div className="p-2 bg-white rounded-xl border border-emerald-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>আপনার ওয়ালেট ব্যালেন্স:</span>
                  <span className="text-emerald-700 font-mono font-black">৳{(user.balance || 0).toLocaleString('en-US')} BDT</span>
                </div>
              </div>

              {/* Modal Form */}
              <form onSubmit={handlePayForMemberSubmit} className="p-4 sm:p-5 space-y-4">
                {payMemberError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{payMemberError}</span>
                  </div>
                )}

                {/* Amount selection */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-800">
                    পরিশোধের পরিমাণ লিখুন (৳):
                  </label>

                  {/* Quick Amount Buttons */}
                  {(() => {
                    const due = selectedTargetUser.dueAmount !== undefined ? selectedTargetUser.dueAmount : (selectedTargetUser.rawDueAmount !== undefined ? selectedTargetUser.rawDueAmount : selectedTargetUser.dueLoan || 0);
                    const instAmt = Math.min(due, Math.ceil(due / 3));
                    return (
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setPayMemberAmountInput(String(instAmt))}
                          className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                            payMemberAmountInput === String(instAmt)
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          ১ কিস্তি (৳{instAmt.toLocaleString('en-US')})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayMemberAmountInput(String(due))}
                          className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                            payMemberAmountInput === String(due)
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          সম্পূর্ণ ঋণ (৳{due.toLocaleString('en-US')})
                        </button>
                      </div>
                    );
                  })()}

                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">৳</span>
                    <input
                      type="number"
                      value={payMemberAmountInput}
                      onChange={(e) => setPayMemberAmountInput(e.target.value)}
                      placeholder="টাকার পরিমাণ লিখুন"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                      required
                    />
                  </div>
                </div>

                {/* 4-Digit Security PIN Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-800">
                    আপনার ৪ সংখ্যার সিকিউরিটি পিন কোড দিন:
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      maxLength={4}
                      value={payMemberPinInput}
                      onChange={(e) => setPayMemberPinInput(e.target.value)}
                      placeholder="৪ সংখ্যার পিন কোড লিখুন"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                      required
                    />
                  </div>
                </div>

                {/* Action Button */}
                <button
                  type="submit"
                  disabled={payMemberLoading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-black text-xs rounded-2xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  {payMemberLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>পরিশোধ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4 text-white" />
                      <span>ওয়ালেট থেকে ৳{(parseFloat(payMemberAmountInput) || 0).toLocaleString('en-US')} কিস্তি পরিশোধ নিশ্চিত করুন</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== DIGITAL RECEIPT MODAL POPUP ==================== */}
      {showReceiptModal && receiptData && (
        <BNBPaymentReceiptModal
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
            beneficiaryName: receiptData.userName || user.name || 'BNB সদস্য',
            beneficiaryAccount: receiptData.memberId || user.memberId || user.phone,
            senderPhone: user.phone,
            transactionDate: receiptData.createdAt ? new Date(receiptData.createdAt).toLocaleString('en-US') : new Date().toLocaleString('en-US')
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
                <p className="text-[8px] font-sans text-stone-500 font-extrabold uppercase mt-1">BNB Business Cooperative Co. Welfare Fund</p>
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
                    {((user as any).tierName || 'সম্মানিত দাতা (Donor)').split(' (')[0]}
                  </strong>
                </div>
              </div>

              <div className="flex justify-between items-end pt-4 text-[9px] font-sans text-stone-500 text-left">
                <div className="space-y-0.5">
                  <p>সার্টিফিকেট আইডিঃ BNB/QRD-{user.memberId?.slice(-5)}</p>
                  <p>প্রদানের তারিখঃ {new Date().toLocaleDateString('bn-BD')}</p>
                </div>
                <div className="border-t border-stone-300 pt-1 text-center pr-2">
                  <p className="font-serif font-black text-amber-900 italic">BNB Board of Directors</p>
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
                            {isDonation ? '-' : '+'} ৳{tx.amount.toLocaleString('en-US')}
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
                <span className="text-[10px] text-slate-400 font-bold">© BUSINESS NETWORK BANGLADESH (BNB)</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== DONORS & CONTRIBUTORS MODAL (কে টাকা দিয়েছে - সর্বমোট দান খতিয়ান) ==================== */}
      <AnimatePresence>
        {showDonorsModal && (() => {
          const allDonationsTxs = qardHistory.filter(t => t.type === 'qard_donation' && t.status === 'success');
          const donorMap: Record<string, {
            userId: string;
            name: string;
            phone: string;
            image: string;
            initialLetter: string;
            totalAmount: number;
            donationCount: number;
            latestDate: string;
            latestTimestamp: number;
            history: Array<{
              id: string;
              amount: number;
              date: string;
              typeLabel: string;
              description: string;
              receiptNo?: string;
              transactionId?: string;
            }>;
          }> = {};

          allDonationsTxs.forEach((t) => {
            const key = t.userId || t.userPhone || t.userName || 'anonymous';
            const donateAmt = Number(t.amount) || 0;
            const uInfo = usersMap[t.userId] || (t.userPhone ? usersMap[t.userPhone] : null) || (t.memberId ? usersMap[t.memberId] : null);
            const memberName = t.userName === 'গোপন দাতা' ? 'গোপন দাতা' : (uInfo?.name || t.userName || 'দানশীল সদস্য');
            const memberPhone = (uInfo as any)?.phone || t.userPhone || '';
            const memberPhoto = t.userName === 'গোপন দাতা' ? '' : (uInfo?.photoURL || uInfo?.photo || t.userPhoto || t.photoURL || '');
            const initialLetter = (memberName || 'দ').trim().charAt(0).toUpperCase();

            const txDate = t.createdAt ? new Date(t.createdAt) : new Date();
            const formattedDate = txDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
            const typeLabel = t.description?.includes('মাসিক') ? 'মাসিক অনুদান' : (t.description?.includes('আমানত') ? 'কল্যাণ আমানত' : 'স্বেচ্ছা অনুদান');

            if (!donorMap[key]) {
              donorMap[key] = {
                userId: key,
                name: memberName,
                phone: memberPhone,
                image: memberPhoto,
                initialLetter,
                totalAmount: 0,
                donationCount: 0,
                latestDate: formattedDate,
                latestTimestamp: txDate.getTime(),
                history: []
              };
            }

            donorMap[key].totalAmount += donateAmt;
            donorMap[key].donationCount += 1;
            if (txDate.getTime() >= donorMap[key].latestTimestamp) {
              donorMap[key].latestTimestamp = txDate.getTime();
              donorMap[key].latestDate = formattedDate;
            }

            donorMap[key].history.push({
              id: t.id || t.transactionId || String(Math.random()),
              amount: donateAmt,
              date: formattedDate,
              typeLabel,
              description: t.description || 'করযে হাসানা অনুদান',
              receiptNo: t.receiptNo,
              transactionId: t.transactionId
            });
          });

          // Sort each donor's history descending by date
          Object.values(donorMap).forEach((d) => {
            d.history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          });

          const aggregatedDonorsList = Object.values(donorMap).sort((a, b) => b.totalAmount - a.totalAmount);

          const filtered = aggregatedDonorsList.filter(d => 
            !donorsSearchQuery.trim() || 
            d.name.toLowerCase().includes(donorsSearchQuery.toLowerCase()) ||
            d.phone.includes(donorsSearchQuery) ||
            String(d.totalAmount).includes(donorsSearchQuery)
          );

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans"
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
                      <h3 className="text-sm font-black text-white">ফান্ডে দান ও আমানতকারী সদস্যবৃন্দ (সর্বমোট দান)</h3>
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
                    <span className="text-base font-black text-emerald-900 font-mono">৳ {qardTotalFund?.toLocaleString('en-US')} BDT</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-emerald-800 font-extrabold uppercase block">মোট দাতা সদস্য</span>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block">
                      {aggregatedDonorsList.length} জন
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
                      <div 
                        key={idx} 
                        onClick={() => setSelectedDonorForDetails(item)}
                        className="pt-2.5 first:pt-0 flex items-center justify-between gap-2.5 hover:bg-emerald-50/60 p-2.5 rounded-2xl transition cursor-pointer border border-transparent hover:border-emerald-200 group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-10.5 h-10.5 rounded-full object-cover border-2 border-emerald-500 shrink-0 shadow-xs group-hover:scale-105 transition"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                                const fallback = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`w-10.5 h-10.5 rounded-full bg-emerald-100 text-emerald-700 font-black text-sm flex items-center justify-center shrink-0 border border-emerald-300 shadow-xs group-hover:scale-105 transition ${item.image ? 'hidden' : 'flex'}`}>
                            {item.initialLetter}
                          </div>
                          <div className="min-w-0 flex-1 pr-1">
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 group-hover:text-emerald-800 leading-snug whitespace-normal break-words">{item.name}</h4>
                            <div className="flex items-center gap-1.5 text-[9px] font-semibold flex-wrap mt-0.5">
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-150">
                                {item.donationCount > 1 ? `মোট ${item.donationCount} বার দান` : '১ বার দান'}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500">সর্বশেষ: {item.latestDate}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs sm:text-sm font-black text-emerald-600 font-mono block">
                            ৳ {item.totalAmount.toLocaleString('en-US')}
                          </span>
                          <span className="text-[8.5px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full inline-block mt-0.5 group-hover:bg-teal-600 group-hover:text-white transition">
                            খতিয়ান দেখুন ➔
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

      {/* ==================== DONOR DETAILED BREAKDOWN MODAL (কবে কয় টাকা দিয়েছিলো) ==================== */}
      <AnimatePresence>
        {selectedDonorForDetails && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans"
            onClick={() => setSelectedDonorForDetails(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] text-left"
            >
              {/* Modal Top Header */}
              <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-4 flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                  {selectedDonorForDetails.image ? (
                    <img 
                      src={selectedDonorForDetails.image} 
                      alt={selectedDonorForDetails.name}
                      className="w-11 h-11 rounded-full object-cover border-2 border-amber-300 shadow-md shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-white/20 text-white font-black text-base flex items-center justify-center shrink-0 border border-white/30">
                      {selectedDonorForDetails.initialLetter}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-white truncate leading-tight">
                      {selectedDonorForDetails.name}
                    </h3>
                    <p className="text-[11px] text-emerald-100 font-semibold mt-0.5">
                      পবিত্র করযে হাসানা দান খতিয়ান ও বিস্তারিত হিস্ট্রি
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDonorForDetails(null)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Cumulative Donation Stats Summary Box */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50/60 to-emerald-100/50 p-4 border-b border-emerald-200/80 flex items-center justify-between gap-3 shrink-0">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-emerald-800 font-extrabold uppercase block">
                    সর্বমোট প্রদানকৃত দান
                  </span>
                  <strong className="text-xl font-mono font-black text-emerald-900 block">
                    ৳ {selectedDonorForDetails.totalAmount?.toLocaleString('en-US')} BDT
                  </strong>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase block">
                    মোট অনুদান সংখ্যা
                  </span>
                  <span className="text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full inline-block shadow-3xs">
                    {selectedDonorForDetails.donationCount} বার দান করেছেন
                  </span>
                </div>
              </div>

              {/* Scrollable Individual Transactions History Timeline */}
              <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
                <h4 className="text-xs font-black text-slate-800 border-l-4 border-emerald-500 pl-2">
                  দানের তারিখ ও পরিমাণ খতিয়ান (কবে কয় টাকা দিয়েছিলেন):
                </h4>

                <div className="space-y-2">
                  {selectedDonorForDetails.history.map((entry: any, hIdx: number) => (
                    <div 
                      key={entry.id || hIdx}
                      className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-4xs space-y-2 hover:border-emerald-300 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                            ৳
                          </div>
                          <div>
                            <strong className="text-sm font-black font-mono text-emerald-700 block">
                              ৳ {entry.amount?.toLocaleString('en-US')} BDT
                            </strong>
                            <span className="text-[9.5px] text-slate-400 font-semibold block mt-0.5">
                              {entry.typeLabel}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-extrabold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {entry.date}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                        <span className="truncate max-w-[240px]">
                          {entry.description || 'কর্জে হাসানা কল্যাণ অনুদান'}
                        </span>
                        {entry.receiptNo && (
                          <span className="font-mono font-bold text-slate-400 shrink-0">
                            {entry.receiptNo}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 bg-white border-t border-slate-200 shrink-0 text-center">
                <button
                  type="button"
                  onClick={() => setSelectedDonorForDetails(null)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
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
                amount: t.amount?.toLocaleString('en-US') || '0',
                rawAmount: t.amount || 0,
                installments: isComplete ? '3/3' : '1/3',
                dueAmount: remaining?.toLocaleString('en-US') || '0',
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
                    <span className="text-base font-black text-rose-900 font-mono">৳ {qardActiveLoansAmount?.toLocaleString('en-US')} BDT</span>
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

      {/* ==================== REPAYMENT FULL-SCREEN PORTAL (টাকা/ঋণ পরিশোধ ও অন্যের কিস্তি পরিশোধ) ==================== */}
      <AnimatePresence>
        {showRepayModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/90 z-[10000] flex flex-col w-full h-full min-h-screen overflow-hidden font-sans text-slate-800"
          >
            <motion.div 
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: 20 }}
              className="bg-white w-full h-full flex flex-col overflow-hidden"
            >
              {/* Full-Screen Top Navigation Bar */}
              <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white px-4 py-3.5 flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                    <Zap className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-white leading-tight">
                      করযে হাসানা টাকা / ঋণ পরিশোধ কেন্দ্র
                    </h2>
                    <p className="text-[10.5px] text-emerald-100 font-semibold">
                      শুধুমাত্র করযে হাসানা সুদমুক্ত ঋণ ও কিস্তি পরিশোধের জন্য নিবেদিত
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setRepaySubTab('my_loan');
                    setShowRepayModal(false);
                  }}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black transition active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  <span>বন্ধ করুন</span>
                </button>
              </div>

              {/* Sub-Tab Navigation Header (4 Sections as requested) */}
              <div className="bg-slate-100/90 border-b border-slate-200 p-2 shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-sans">
                <button
                  type="button"
                  onClick={() => setRepaySubTab('my_loan')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                    repaySubTab === 'my_loan'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>১. আমার ঋণ পরিশোধ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRepaySubTab('borrowers_list')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                    repaySubTab === 'borrowers_list'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>২. ঋণ গ্রহীতা ও কিস্তি</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRepaySubTab('all_beneficiaries')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                    repaySubTab === 'all_beneficiaries'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>৩. সর্বমোট সুবিধাভোগী</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRepaySubTab('late_defaulters')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                    repaySubTab === 'late_defaulters'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  <BadgeAlert className="w-3.5 h-3.5" />
                  <span>৪. বিলম্ব ও ব্ল্যাকলিস্ট</span>
                </button>
              </div>

              {/* Scrollable Main Content Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-4 text-left">
                
                {/* SUB TAB 1: MY LOAN REPAYMENT */}
                {repaySubTab === 'my_loan' && (
                  <div className="space-y-4">
                    {/* Notice Banner */}
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-950 font-bold leading-relaxed space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-800 font-black text-xs">
                        <CheckCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>বিশেষ নির্দেশনাঃ</span>
                      </div>
                      <p className="text-slate-700">
                        করযে হাসানা পরিশোধ শুধুমাত্র এই সেকশনে ঢুকে করতে হবে। অন্য জায়গা থেকে নেওয়া টাকা বা সাধারণ লেনদেন এখানে পরিশোধ করা যাবে না। আপনার করযে হাসানা ঋণের টাকা আপনি যেকোনো সময় (১ দিন, ১ সপ্তাহ বা মেয়াদ শেষে) অগ্রিম পরিশোধ করতে পারবেন।
                      </p>
                    </div>

                    {/* Status Info Card */}
                    <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 p-4 rounded-2.5xl flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[10px] text-emerald-800 font-black uppercase block">আপনার বর্তমান বকেয়া ঋণ</span>
                        <strong className="text-xl font-mono font-black text-rose-700 block mt-0.5">
                          ৳ {(user.dueLoan || 0).toLocaleString('en-US')} BDT
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 font-black uppercase block">মেইন ওয়ালেট ব্যালেন্স</span>
                        <strong className="text-base font-mono font-black text-emerald-700 block mt-0.5">
                          ৳ {(user.balance || 0).toLocaleString('en-US')} BDT
                        </strong>
                      </div>
                    </div>

                    {user.dueLoan && user.dueLoan > 0 ? (
                      <div className="space-y-3 bg-white border border-slate-200 p-4 rounded-2.5xl shadow-3xs">
                        <label className="block text-xs font-black text-slate-800">
                          পরিশোধের পরিমাণ নির্বাচন বা লিখুন (৳):
                        </label>

                        {/* Preset quick buttons */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setCustomRepayInput(String(Math.min(user.dueLoan || 0, Math.ceil((user.dueLoan || 0) / 3))))}
                            className={`p-3 rounded-2xl border text-xs font-extrabold transition cursor-pointer flex flex-col items-center justify-center ${
                              customRepayInput === String(Math.min(user.dueLoan || 0, Math.ceil((user.dueLoan || 0) / 3)))
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>1 কিস্তি পরিশোধ</span>
                            <span className="text-[10px] opacity-90 font-mono">৳ {Math.min(user.dueLoan || 0, Math.ceil((user.dueLoan || 0) / 3)).toLocaleString('en-US')} BDT</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCustomRepayInput(String(user.dueLoan))}
                            className={`p-3 rounded-2xl border text-xs font-extrabold transition cursor-pointer flex flex-col items-center justify-center ${
                              customRepayInput === String(user.dueLoan) || (!customRepayInput && user.dueLoan > 0)
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>সম্পূর্ণ ঋণ পরিশোধ</span>
                            <span className="text-[10px] opacity-90 font-mono">৳ {user.dueLoan.toLocaleString('en-US')} BDT</span>
                          </button>
                        </div>

                        {/* Custom Input */}
                        <div className="relative">
                          <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-xs">৳</span>
                          <input
                            type="number"
                            value={customRepayInput}
                            onChange={(e) => setCustomRepayInput(e.target.value)}
                            placeholder={`নিজের পছন্দমতো টাকার সংখ্যা লিখুন (উদাঃ ${user.dueLoan})`}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-8 pr-4 py-2.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
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
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
                        >
                          <Coins className="w-4 h-4 text-white" />
                          মেইন ওয়ালেট থেকে ৳ {(parseFloat(customRepayInput) || user.dueLoan || 0).toLocaleString('en-US')} BDT পরিশোধ করুন
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-8 px-4 bg-slate-50 border border-slate-200 rounded-2.5xl space-y-3">
                        <span className="text-3xl block">🎉</span>
                        <h4 className="text-sm font-black text-slate-800">আপনার কোনো বকেয়া করযে হাসানা ঋণ নেই!</h4>
                        <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                          আপনার একাউন্টে বর্তমানে কোনো বকেয়া ঋণ নেই। আপনি অন্য কোনো সদস্যের কিস্তি পরিশোধ করতে চাইলে **"ঋণ গ্রহীতা ও কিস্তি তালিকা"** ট্যাবে ক্লিক করুন।
                        </p>
                        <button
                          type="button"
                          onClick={() => setRepaySubTab('borrowers_list')}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <ClipboardList className="w-4 h-4" />
                          অন্যান্য ঋণ গ্রহীতা সদস্য তালিকা দেখুন
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* SUB TAB 2: BORROWERS LIST & DIRECT PIN REPAYMENT */}
                {repaySubTab === 'borrowers_list' && (() => {
                  const borrowersList = qardHistory
                    .filter(t => t.type === 'qard_loan_disbursment' && t.status === 'success')
                    .map((t) => {
                      const repayments = qardHistory
                        .filter(rp => rp.type === 'qard_loan_repayment' && rp.status === 'success' && rp.userId === t.userId);
                      const totalRepaidAmount = repayments.reduce((sum, r) => sum + r.amount, 0);
                      const remaining = Math.max(0, t.amount - totalRepaidAmount);
                      const isComplete = remaining === 0;

                      const uInfo = usersMap[t.userId] || (t.userPhone ? usersMap[t.userPhone] : null);
                      const memberName = uInfo?.name || t.userName || 'সম্মানিত সদস্য';
                      const memberPhone = (uInfo as any)?.phone || t.userPhone || '';

                      return {
                        userId: t.userId,
                        name: memberName,
                        phone: memberPhone,
                        amount: t.amount,
                        dueAmount: remaining,
                        isComplete,
                        uInfo
                      };
                    });

                  return (
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">সকল ঋণ গ্রহীতা সদস্যবৃন্দ ({borrowersList.length} জন)</span>
                        <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-100 px-2 py-0.5 rounded-full">
                          সরাসরি কিস্তি পরিশোধ
                        </span>
                      </div>

                      <div className="space-y-2">
                        {borrowersList.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl text-xs font-bold">
                            কোনো ঋণ গ্রহীতার তালিকা পাওয়া যায়নি।
                          </div>
                        ) : (
                          borrowersList.map((item, idx) => (
                            <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-4xs">
                              <div className="min-w-0">
                                <h4 className="text-xs font-black text-slate-800 truncate">{item.name}</h4>
                                <p className="text-[10px] text-slate-500 font-mono font-bold mt-0.5">ফোনঃ {item.phone || 'N/A'}</p>
                                <div className="flex items-center gap-2 mt-1 text-[10px]">
                                  <span className="text-slate-600 font-bold">নেয়াঃ ৳{item.amount}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className={item.isComplete ? 'text-emerald-700 font-black' : 'text-rose-600 font-black'}>
                                    বকেয়াঃ ৳{item.dueAmount}
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                {item.dueAmount > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedTargetUser(item);
                                      setPayMemberAmountInput(String(Math.min(item.dueAmount, Math.ceil(item.dueAmount / 3))));
                                      setPayMemberPinInput('');
                                      setPayMemberError('');
                                      setShowPayForMemberModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black shadow-xs transition cursor-pointer"
                                  >
                                    এনার কিস্তি পরিশোধ করুন
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg inline-block">
                                    ✓ পরিশোধিত
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* SUB TAB 3: ALL BENEFICIARIES LIST (প্রথম থেকে শেষ পর্যন্ত কয়জন টাকা নিয়েছে) */}
                {repaySubTab === 'all_beneficiaries' && (() => {
                  const allBeneficiariesList = qardHistory
                    .filter(t => t.type === 'qard_loan_disbursment' && t.status === 'success')
                    .map((t) => {
                      const repayments = qardHistory
                        .filter(rp => rp.type === 'qard_loan_repayment' && rp.status === 'success' && rp.userId === t.userId);
                      const totalRepaidAmount = repayments.reduce((sum, r) => sum + (r.amount || 0), 0);
                      const remaining = Math.max(0, (t.amount || 0) - totalRepaidAmount);
                      const isComplete = remaining === 0;

                      const uInfo = usersMap[t.userId] || (t.userPhone ? usersMap[t.userPhone] : null);
                      const memberName = uInfo?.name || t.userName || 'সুবিধাভোগী সদস্য';
                      const memberPhone = (uInfo as any)?.phone || t.userPhone || '';
                      const memberPhoto = (uInfo as any)?.photoURL || (uInfo as any)?.photo || t.userPhoto || '';

                      return {
                        userId: t.userId,
                        name: memberName,
                        phone: memberPhone,
                        photo: memberPhoto,
                        amount: t.amount || 0,
                        dueAmount: remaining,
                        isComplete,
                        date: t.createdAt ? new Date(t.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'
                      };
                    });

                  allBeneficiariesList.sort((a, b) => b.amount - a.amount);

                  const filteredBeneficiaries = allBeneficiariesList.filter(b => 
                    !beneficiariesSearchQuery.trim() || 
                    b.name.toLowerCase().includes(beneficiariesSearchQuery.toLowerCase()) ||
                    b.phone.includes(beneficiariesSearchQuery) ||
                    String(b.amount).includes(beneficiariesSearchQuery)
                  );

                  const totalDisbursedSum = allBeneficiariesList.reduce((acc, c) => acc + c.amount, 0);

                  return (
                    <div className="space-y-3 font-sans">
                      {/* Summary Banner */}
                      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 p-4 rounded-2.5xl flex items-center justify-between shadow-xs">
                        <div>
                          <span className="text-[10px] text-emerald-800 font-extrabold uppercase block">সর্বমোট সুবিধাভোগী সংখ্যা</span>
                          <strong className="text-xl font-mono font-black text-emerald-950 block mt-0.5">
                            {allBeneficiariesList.length} জন সদস্য
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 font-extrabold uppercase block">বিতরণকৃত সর্বমোট ফান্ড</span>
                          <strong className="text-base font-mono font-black text-emerald-700 block mt-0.5">
                            ৳ {totalDisbursedSum.toLocaleString('en-US')} BDT
                          </strong>
                        </div>
                      </div>

                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="সুবিধাভোগী সদস্যের নাম বা ফোন নম্বর লিখে খুঁজুন..."
                          value={beneficiariesSearchQuery}
                          onChange={(e) => setBeneficiariesSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-7 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-sans font-bold"
                        />
                        {beneficiariesSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setBeneficiariesSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* List */}
                      <div className="space-y-2">
                        {filteredBeneficiaries.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl text-xs font-bold">
                            কোনো সুবিধাভোগী সদস্যের রেকর্ড পাওয়া যায়নি।
                          </div>
                        ) : (
                          filteredBeneficiaries.map((item, idx) => (
                            <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-4xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {item.photo ? (
                                  <img
                                    src={item.photo}
                                    alt={item.name}
                                    className="w-9 h-9 rounded-full object-cover border border-emerald-500 shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0 border border-emerald-300">
                                    {item.name.trim().charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h4 className="text-xs font-black text-slate-800 truncate">{item.name}</h4>
                                  <p className="text-[10px] text-slate-500 font-mono font-bold mt-0.5">
                                    ফোনঃ {item.phone || 'N/A'} • {item.date}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0 text-right space-y-0.5">
                                <span className="text-xs font-mono font-black text-emerald-800 block">
                                  ৳ {item.amount.toLocaleString('en-US')}
                                </span>
                                {item.isComplete ? (
                                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block">
                                    ✓ সম্পূর্ণ পরিশোধিত
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md inline-block">
                                    ⏳ বকেয়া: ৳{item.dueAmount.toLocaleString('en-US')}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* SUB TAB 4: LATE PAYERS & BLACKLISTED DEFAULTERS (বিলম্বকারী ও ২-বার ব্যর্থতায় স্থায়ী আজীবন নিষিদ্ধ) */}
                {repaySubTab === 'late_defaulters' && (() => {
                  const latePayersMap: Record<string, { userId: string; name: string; phone: string; lateCount: number; totalFine: number; lastFineDate: string; isBanned: boolean; photo?: string }> = {};

                  qardHistory.forEach((t) => {
                    if (t.type === 'qard_fine' || t.category === 'qard_late_fine') {
                      const uid = t.userId;
                      if (!uid) return;
                      const uInfo = usersMap[uid] || (t.userPhone ? usersMap[t.userPhone] : null);
                      const mName = uInfo?.name || t.userName || 'সদস্য';
                      const mPhone = (uInfo as any)?.phone || t.userPhone || '';
                      const mPhoto = (uInfo as any)?.photoURL || (uInfo as any)?.photo || '';

                      if (!latePayersMap[uid]) {
                        latePayersMap[uid] = {
                          userId: uid,
                          name: mName,
                          phone: mPhone,
                          lateCount: 0,
                          totalFine: 0,
                          lastFineDate: t.createdAt,
                          isBanned: false,
                          photo: mPhoto
                        };
                      }
                      latePayersMap[uid].lateCount += 1;
                      latePayersMap[uid].totalFine += (t.amount || 0);
                      if (latePayersMap[uid].lateCount >= 2) {
                        latePayersMap[uid].isBanned = true;
                      }
                    }
                  });

                  const latePayersList = Object.values(latePayersMap);
                  latePayersList.sort((a, b) => b.lateCount - a.lateCount);

                  const filteredDefaulters = latePayersList.filter(d => 
                    !defaultersSearchQuery.trim() || 
                    d.name.toLowerCase().includes(defaultersSearchQuery.toLowerCase()) ||
                    d.phone.includes(defaultersSearchQuery)
                  );

                  return (
                    <div className="space-y-3 font-sans">
                      {/* Rules Banner */}
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-[11px] text-rose-950 font-bold leading-relaxed space-y-1">
                        <div className="flex items-center gap-1.5 text-rose-800 font-black text-xs">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>২-বার বিলম্ব এবং আজীবন নিষিদ্ধকরণ নিয়মাবলী:</span>
                        </div>
                        <p className="text-slate-700">
                          প্রথমবার ৩০ দিন মেয়াদ পার করে দেরিতে পরিশোধ করলে ১টি বিলম্ব জরিমানা ও সতর্কবার্তা যুক্ত হয়। কিন্তু ২য় বার সময়মতো পরিশোধে ব্যর্থ হলে (বিলম্ব কাউন্ট ২) উক্ত ব্যক্তি আজীবনের জন্য করযে হাসানা ফান্ড বা সমবায় সমিতি থেকে নতুন কোনো ঋণ নেওয়ার যোগ্যতা স্থায়ীভাবে হারাবে (LIFETIME BANNED)।
                        </p>
                      </div>

                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="বিলম্বকারী বা নিষিদ্ধ সদস্যদের নাম/ফোন লিখে খুঁজুন..."
                          value={defaultersSearchQuery}
                          onChange={(e) => setDefaultersSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-7 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 font-sans font-bold"
                        />
                        {defaultersSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setDefaultersSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* List */}
                      <div className="space-y-2">
                        {filteredDefaulters.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl text-xs font-bold">
                            বর্তমানে কোনো বিলম্বকারী বা ব্ল্যাকলিস্টেড সদস্যের তথ্য পাওয়া যায়নি।
                          </div>
                        ) : (
                          filteredDefaulters.map((item, idx) => (
                            <div key={idx} className={`p-3 bg-white border rounded-2xl flex items-center justify-between gap-3 shadow-4xs ${item.isBanned ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'}`}>
                              <div className="flex items-center gap-2.5 min-w-0">
                                {item.photo ? (
                                  <img
                                    src={item.photo}
                                    alt={item.name}
                                    className="w-9 h-9 rounded-full object-cover border border-rose-500 shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-800 font-black text-xs flex items-center justify-center shrink-0 border border-rose-300">
                                    {item.name.trim().charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h4 className="text-xs font-black text-slate-800 truncate">{item.name}</h4>
                                  <p className="text-[10px] text-slate-500 font-mono font-bold mt-0.5">
                                    ফোনঃ {item.phone || 'N/A'} • মোট বিলম্ব জরিমানা: ৳{item.totalFine.toLocaleString('en-US')}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0 text-right space-y-0.5">
                                <span className="text-[10px] font-black text-slate-700 block">
                                  বিলম্ব কাউন্ট: {item.lateCount} বার
                                </span>
                                {item.isBanned || item.lateCount >= 2 ? (
                                  <span className="text-[9px] font-black text-white bg-rose-700 border border-rose-800 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-3xs">
                                    🚫 আজীবন নিষিদ্ধ (LIFETIME BANNED)
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md inline-block">
                                    ⚠️ ১ম বার বিলম্ব (সতর্কবার্তা)
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>

              {/* Bottom Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-center shrink-0">
                <p className="text-[10px] text-slate-400 font-bold">
                  © Business Network Bangladesh (BNB) — সুদমুক্ত করযে হাসানা ফান্ড পোর্টাল
                </p>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
});

export default QardScreen;
