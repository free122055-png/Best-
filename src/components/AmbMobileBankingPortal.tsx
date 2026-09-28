import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Globe, Banknote, Send, ArrowRight, Home, FileText, ChevronLeft, CreditCard, CheckCircle2, AlertCircle, Copy, Search, HelpCircle, Eye, EyeOff, ChevronDown, Lightbulb, Flame, Droplet, Wifi, Tv, Smartphone, UploadCloud, Trash2, Image, Camera, ChevronRight, RotateCcw, Briefcase, Bookmark, Info } from 'lucide-react';
import { User, Transaction, AppConfig, SavedAmbCard, normalizePaidMonthsArray, getEffectiveBalance, generateAmbTrxId, formatShortTrxId } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, getDoc, orderBy, limit, doc, updateDoc, onSnapshot, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import AmbAutoSalaryPay from './AmbAutoSalaryPay';
import { AmbPaymentReceiptModal, PaymentReceiptData } from './AmbPaymentReceiptModal';
import { useBackHandler } from '../lib/navigationManager';
import UnifiedBackButton from './UnifiedBackButton';

interface AmbMobileBankingPortalProps {
  user: User;
  onClose: () => void;
  syncLiveProfile: () => void;
  appConfig?: AppConfig;
  initialTab?: 'dashboard' | 'add_money' | 'auto_add_money' | 'amb_to_amb' | 'send_money' | 'bill_pay' | 'khatiyan' | 'salary';
}

export const AmbMobileBankingPortal: React.FC<AmbMobileBankingPortalProps> = ({ 
  user, 
  onClose, 
  syncLiveProfile,
  appConfig,
  initialTab
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add_money' | 'auto_add_money' | 'amb_to_amb' | 'send_money' | 'bill_pay' | 'khatiyan' | 'salary'>(initialTab || 'dashboard');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [loading, setLoading] = useState(false);
  const [txList, setTxList] = useState<Transaction[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [receiptModalData, setReceiptModalData] = useState<PaymentReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const openReceiptForTx = (tx: any) => {
    let label = 'AMB লেনদেন';
    if (tx.type === 'transfer' || tx.type === 'amb_to_amb') label = 'AMB TO AMB সেন্ড মানি';
    else if (tx.type === 'send_money') label = 'সেন্ড মানি / ক্যাশ আউট';
    else if (tx.type === 'add_money' || tx.type === 'deposit') label = 'অ্যাড মানি';
    else if (tx.type === 'bill_pay') label = 'বিল পে / ইউটিলিটি';

    setReceiptModalData({
      typeLabel: tx.typeLabel || label,
      transactionId: formatShortTrxId(tx.transactionId || tx.trxId || tx.id),
      amount: tx.amount || 0,
      fee: tx.charge || 0,
      totalAmount: tx.totalDeducted || (tx.amount + (tx.charge || 0)),
      status: tx.status === 'success' || tx.status === 'approved' ? 'success' : tx.status === 'failed' || tx.status === 'rejected' ? 'failed' : 'pending',
      beneficiaryName: tx.userName || tx.receiverName || tx.beneficiaryName || 'AMB সদস্য',
      beneficiaryAccount: tx.receiverId || tx.memberId || tx.beneficiaryAccount || 'N/A',
      senderPhone: tx.phone || tx.senderPhone || user.phone,
      transactionDate: tx.createdAt ? new Date(tx.createdAt).toLocaleString('bn-BD', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true }) : new Date().toLocaleString('bn-BD')
    });
    setIsReceiptOpen(true);
  };

// Portal internal back handler
  useBackHandler(() => {
    if (isReceiptOpen) { setIsReceiptOpen(false); return true; }
    if (showSaveCardModal) { setShowSaveCardModal(false); return true; }
    if (showMonthPopup) { setShowMonthPopup(false); return true; }
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
      return true;
    }
    return false;
  }, true, 25);

// Mobile Financial Services (MFS) dynamic numbers helpers
  const getOperatorNumber = (operator: string) => {
    if (operator === 'bkash') {
      if (appConfig?.mfsBkashActive === false) return '';
      return appConfig?.mfsBkashNumber || '01865911728';
    }
    if (operator === 'nagad') {
      if (appConfig?.mfsNagadActive === false) return '';
      return appConfig?.mfsNagadNumber || '01865911728';
    }
    if (operator === 'rocket') {
      if (appConfig?.mfsRocketActive === false) return '';
      return appConfig?.mfsRocketNumber || '01865911728';
    }
    if (operator === 'upay') {
      if (appConfig?.mfsUpayActive === false) return '';
      return appConfig?.mfsUpayNumber || '01600664081';
    }
    return '';
  };

  const toEnglishDigits = (str: string) => {
    const banglaDigits: Record<string, string> = { '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9' };
    return str.replace(/[0-9]/g, (w) => banglaDigits[w] || w);
  };

  const toBanglaDigits = (str: string) => {
    const englishToBangla: Record<string, string> = {
      '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
    };
    return str.replace(/[0-9]/g, (w) => englishToBangla[w] || w);
  };

  const formattedDisplayNum = (num: string) => {
    const eng = toEnglishDigits(num).replace(/[^\d]/g, '');
    if (eng.length === 11) {
      return `${eng.slice(0, 5)}-${eng.slice(5)}`;
    }
    return eng || num;
  };

  const cleanNumberForCopy = (numStr: string) => {
    const engNum = toEnglishDigits(numStr);
    return engNum.replace(/[^\d]/g, '');
  };

// Remittance Rates Live Sync
  const [remittanceRates, setRemittanceRates] = useState<any[]>([]);
  const [isMoreRatesOpen, setIsMoreRatesOpen] = useState(false);
  const [ratesSearchQuery, setRatesSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'remittance_rates'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
// Seed default rates on-the-fly
        const defaults = [
          { id: 'sa', flag: '🇸🇦', name: 'সৌদি রিয়াল (SAR)', value: 30, multiplier: '1 রিয়াল', order: 1 },
          { id: 'ae', flag: '🇦🇪', name: 'দুবাই দিরহাম (AED)', value: 30, multiplier: '1 দিরহাম', order: 2 },
          { id: 'kw', flag: '🇰🇼', name: 'কুয়েতি দিনার (KWD)', value: 360, multiplier: '1 দিনার', order: 3 },
          { id: 'bh', flag: '🇧🇭', name: 'বাহরাইন দিনার (BHD)', value: 294, multiplier: '1 দিনার', order: 4 }
        ];
        defaults.forEach(async (d) => {
          await setDoc(doc(db, 'remittance_rates', d.id), d);
        });
      } else {
        const rates = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setRemittanceRates(rates);
      }
    }, (err) => {
      console.error("Error listening to remittance rates: ", err);
    });
    return () => unsubscribe();
  }, []);

// Real-time notifications for live card request alert
  const [portalNotifications, setPortalNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !user.uid) return;
    const q = query(
      collection(db, 'user_notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPortalNotifications(list);
    }, (err) => {
      console.error("Error listening to portal notifications: ", err);
    });
    return () => unsubscribe();
  }, [user]);

// 1. Add Money States
  const [addMoneyOperator, setAddMoneyOperator] = useState<'bkash' | 'nagad' | 'rocket' | 'upay' | null>(null);
  const [addMoneyChannel, setAddMoneyChannel] = useState<'local_mobile' | 'bank_deposit' | 'foreign_bank' | 'online_payment' | 'remittance'>('local_mobile');
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [cashback, setCashback] = useState(0);
  const [senderNumber, setSenderNumber] = useState('');
  const [foreignCurrencyMode, setForeignCurrencyMode] = useState<'foreign' | 'bdt'>('foreign');
  const [foreignSelectedCountryCode, setForeignSelectedCountryCode] = useState<string>('');

  // Remittance States (প্রবাসী রেমিট্যান্স ও ২.৫% সরকারি প্রণোদনা)
  const [remitStep, setRemitStep] = useState<number>(1);
  const [remitSelectedBankId, setRemitSelectedBankId] = useState<string | null>(null);
  const [remitSelectedCountryCode, setRemitSelectedCountryCode] = useState<string>('');
  const [remitCurrencyMode, setRemitCurrencyMode] = useState<'foreign' | 'bdt'>('foreign');
  const [remitAmount, setRemitAmount] = useState<string>('');
  const [remitSenderAccount, setRemitSenderAccount] = useState<string>('');
  const [remitBeneficiaryBankName, setRemitBeneficiaryBankName] = useState<string>('');
  const [remitBeneficiaryAccountNo, setRemitBeneficiaryAccountNo] = useState<string>('');
  const [remitBeneficiaryName, setRemitBeneficiaryName] = useState<string>('');
  const [remitBeneficiaryBranch, setRemitBeneficiaryBranch] = useState<string>('');
  const [remitBeneficiaryDistrict, setRemitBeneficiaryDistrict] = useState<string>('');
  const [remitBeneficiaryPhone, setRemitBeneficiaryPhone] = useState<string>('');
  const [remitBeneficiaryRelation, setRemitBeneficiaryRelation] = useState<string>('পরিবার / আত্মীয়');
  const [remitTrxId, setRemitTrxId] = useState<string>('');
  const [remitSecurityPin, setRemitSecurityPin] = useState<string>('');

  const getBankCurrencyInfo = (
    bank: any,
    ratesList: any[] = [],
    configRates?: Record<string, number>,
    overrideCode?: string,
    rateType: 'add_money' | 'remittance' = 'add_money'
  ) => {
    let code = (overrideCode || bank?.currency || '').toUpperCase();
    const customRate = Number(bank?.customRate || bank?.exchangeRate || 0);

    const combined = `${bank?.name || ''} ${bank?.branch || ''} ${bank?.acronym || ''} ${bank?.iban || ''} ${bank?.holder || ''} ${bank?.country || ''}`.toLowerCase();

    let countryName = bank?.country || 'সৌদি আরব';
    let flag = '🇸🇦';

    const countryFlags: Record<string, string> = {
      'সৌদি আরব': '🇸🇦',
      'সংযুক্ত আরব আমিরাত': '🇦🇪',
      'দুবাই': '🇦🇪',
      'কাতার': '🇶🇦',
      'কুয়েত': '🇰🇼',
      'কুয়েত': '🇰🇼',
      'ওমান': '🇴🇲',
      'বাহরাইন': '🇧🇭',
      'মালয়েশিয়া': '🇲🇾',
      'মালয়েশিয়া': '🇲🇾',
      'সিঙ্গাপুর': '🇸🇬',
      'আমেরিকা': '🇺🇸',
      'যুক্তরাজ্য': '🇬🇧',
      'ইউরোপ': '🇪🇺',
      'SAR': '🇸🇦',
      'AED': '🇦🇪',
      'QAR': '🇶🇦',
      'KWD': '🇰🇼',
      'OMR': '🇴🇲',
      'BHD': '🇧🇭',
      'MYR': '🇲🇾',
      'SGD': '🇸🇬',
      'USD': '🇺🇸',
      'GBP': '🇬🇧',
      'EUR': '🇪🇺'
    };

    if (!code) {
      if (combined.includes('saudi') || combined.includes('rajhi') || combined.includes('snb') || combined.includes('alinma') || combined.includes('riyad') || combined.includes('jazira') || combined.includes('alahli') || combined.includes('সৌদি') || (bank?.iban && bank.iban.toUpperCase().startsWith('SA'))) {
        code = 'SAR';
        countryName = bank?.country || 'সৌদি আরব';
        flag = '🇸🇦';
      } else if (combined.includes('emirates') || combined.includes('dubai') || combined.includes('nbd') || combined.includes('uae') || combined.includes('mashreq') || combined.includes('adcb') || combined.includes('দুবাই') || combined.includes('আরব আমিরাত') || (bank?.iban && bank.iban.toUpperCase().startsWith('AE'))) {
        code = 'AED';
        countryName = bank?.country || 'সংযুক্ত আরব আমিরাত';
        flag = '🇦🇪';
      } else if (combined.includes('qatar') || combined.includes('qnb') || combined.includes('doha') || combined.includes('কাতার') || (bank?.iban && bank.iban.toUpperCase().startsWith('QA'))) {
        code = 'QAR';
        countryName = bank?.country || 'কাতার';
        flag = '🇶🇦';
      } else if (combined.includes('kuwait') || combined.includes('nbk') || combined.includes('কুয়েত') || combined.includes('কুয়েত') || (bank?.iban && bank.iban.toUpperCase().startsWith('KW'))) {
        code = 'KWD';
        countryName = bank?.country || 'কুয়েত';
        flag = '🇰🇼';
      } else if (combined.includes('oman') || combined.includes('muscat') || combined.includes('ওমান') || (bank?.iban && bank.iban.toUpperCase().startsWith('OM'))) {
        code = 'OMR';
        countryName = bank?.country || 'ওমান';
        flag = '🇴🇲';
      } else if (combined.includes('bahrain') || combined.includes('বাহরাইন') || (bank?.iban && bank.iban.toUpperCase().startsWith('BH'))) {
        code = 'BHD';
        countryName = bank?.country || 'বাহরাইন';
        flag = '🇧🇭';
      } else if (combined.includes('malaysia') || combined.includes('maybank') || combined.includes('cimb') || combined.includes('মালয়েশিয়া') || combined.includes('মালয়েশিয়া') || (bank?.iban && bank.iban.toUpperCase().startsWith('MY'))) {
        code = 'MYR';
        countryName = bank?.country || 'মালয়েশিয়া';
        flag = '🇲🇾';
      } else if (combined.includes('singapore') || combined.includes('dbs') || combined.includes('সিঙ্গাপুর') || (bank?.iban && bank.iban.toUpperCase().startsWith('SG'))) {
        code = 'SGD';
        countryName = bank?.country || 'সিঙ্গাপুর';
        flag = '🇸🇬';
      } else if (combined.includes('america') || combined.includes('usa') || combined.includes('usd') || combined.includes('chase') || combined.includes('আমেরিকা') || combined.includes('ডলার')) {
        code = 'USD';
        countryName = bank?.country || 'আমেরিকা / ডলার';
        flag = '🇺🇸';
      } else if (combined.includes('euro') || combined.includes('europe') || combined.includes('ইউরো')) {
        code = 'EUR';
        countryName = bank?.country || 'ইউরোপ';
        flag = '🇪🇺';
      } else if (combined.includes('uk') || combined.includes('pound') || combined.includes('লন্ডন') || combined.includes('যুক্তরাজ্য')) {
        code = 'GBP';
        countryName = bank?.country || 'যুক্তরাজ্য';
        flag = '🇬🇧';
      } else {
        code = 'SAR';
        countryName = bank?.country || 'সৌদি আরব';
        flag = '🇸🇦';
      }
    } else {
      if (bank?.country) {
        countryName = bank.country;
      } else {
        if (code === 'SAR') { countryName = 'সৌদি আরব'; }
        else if (code === 'AED') { countryName = 'সংযুক্ত আরব আমিরাত'; }
        else if (code === 'QAR') { countryName = 'কাতার'; }
        else if (code === 'KWD') { countryName = 'কুয়েত'; }
        else if (code === 'OMR') { countryName = 'ওমান'; }
        else if (code === 'BHD') { countryName = 'বাহরাইন'; }
        else if (code === 'MYR') { countryName = 'মালয়েশিয়া'; }
        else if (code === 'SGD') { countryName = 'সিঙ্গাপুর'; }
        else if (code === 'USD') { countryName = 'আমেরিকা (USD)'; }
        else if (code === 'EUR') { countryName = 'ইউরোপ (EUR)'; }
        else if (code === 'GBP') { countryName = 'যুক্তরাজ্য (GBP)'; }
      }
      flag = countryFlags[countryName] || countryFlags[code] || '🌍';
    }

    const matchedRateObj = (ratesList || []).find((r: any) => {
      const rName = (r.name || '').toLowerCase();
      const rId = (r.id || '').toLowerCase();
      return rName.includes(code.toLowerCase()) || 
             rId.includes(code.toLowerCase()) || 
             rName.includes(countryName.toLowerCase()) ||
             (code === 'SAR' && (rName.includes('সৌদি') || rName.includes('saudi') || rName.includes('রিয়াল') || rName.includes('riyal'))) ||
             (code === 'AED' && (rName.includes('দুবাই') || rName.includes('দিরহাম') || rName.includes('uae') || rName.includes('emirates'))) ||
             (code === 'QAR' && (rName.includes('কাতার') || rName.includes('qatar'))) ||
             (code === 'KWD' && (rName.includes('কুয়েত') || rName.includes('kuwait') || rName.includes('দিনার'))) ||
             (code === 'OMR' && (rName.includes('ওমান') || rName.includes('oman'))) ||
             (code === 'BHD' && (rName.includes('বাহরাইন') || rName.includes('bahrain'))) ||
             (code === 'MYR' && (rName.includes('মালয়েশিয়া') || rName.includes('malaysia') || rName.includes('রিঙ্গিত'))) ||
             (code === 'USD' && (rName.includes('আমেরিকা') || rName.includes('ডলার') || rName.includes('usd')));
    });

    const resolvedTransferFee = (bank?.transferFee !== undefined && bank?.transferFee !== null && bank?.transferFee !== '')
      ? Number(bank.transferFee)
      : (matchedRateObj?.transferFee !== undefined && matchedRateObj?.transferFee !== null && matchedRateObj?.transferFee !== ''
          ? Number(matchedRateObj.transferFee)
          : Number(appConfig?.remittanceTransferFee ?? appConfig?.remittanceFee ?? 15));

    if (customRate > 0 && !overrideCode) {
      return { 
        code, 
        countryName, 
        flag, 
        rate: customRate, 
        transferFee: resolvedTransferFee,
        name: `${countryName} (${code})` 
      };
    }

    if (matchedRateObj) {
      let finalRate = 0;
      if (rateType === 'remittance') {
        finalRate = Number(matchedRateObj.remittanceRate || matchedRateObj.value || 0);
      } else {
        finalRate = Number(matchedRateObj.addMoneyRate || (matchedRateObj.value ? Math.max(0, matchedRateObj.value - 2.5) : 0));
      }
      if (finalRate > 0) {
        return {
          code,
          countryName: matchedRateObj.name || countryName,
          flag: matchedRateObj.flag || flag,
          rate: finalRate,
          transferFee: resolvedTransferFee,
          name: `${matchedRateObj.name || countryName} (${code})`
        };
      }
    }

    if (configRates && configRates[code] && Number(configRates[code]) > 0) {
      const baseConfigRate = Number(configRates[code]);
      const resolvedRate = rateType === 'remittance' ? baseConfigRate : Math.max(0, baseConfigRate - 2.5);
      return { 
        code, 
        countryName, 
        flag, 
        rate: resolvedRate, 
        transferFee: resolvedTransferFee,
        name: `${countryName} (${code})` 
      };
    }

    const fallbackRemitRates: Record<string, number> = {
      SAR: 32.50,
      AED: 33.15,
      QAR: 33.40,
      KWD: 396.00,
      OMR: 316.00,
      BHD: 323.00,
      MYR: 27.50,
      SGD: 92.00,
      USD: 122.00,
      EUR: 132.00,
      GBP: 155.00
    };

    const fallbackAddMoneyRates: Record<string, number> = {
      SAR: 30.00,
      AED: 30.65,
      QAR: 30.90,
      KWD: 385.00,
      OMR: 305.00,
      BHD: 310.00,
      MYR: 25.00,
      SGD: 88.00,
      USD: 118.00,
      EUR: 128.00,
      GBP: 150.00
    };

    const rate = rateType === 'remittance' ? (fallbackRemitRates[code] || 32.50) : (fallbackAddMoneyRates[code] || 30.00);
    return { 
      code, 
      countryName, 
      flag, 
      rate, 
      transferFee: resolvedTransferFee,
      name: `${countryName} (${code})` 
    };
  };

  useEffect(() => {
    const amount = Number(depositAmount);
    const { addMoneyBankCashbackPerThousand = 5 } = appConfig || {};
    if (addMoneyChannel === 'bank_deposit') {
      setCashback(Math.floor(amount / 1000) * addMoneyBankCashbackPerThousand);
    } else {
      setCashback(0);
    }
  }, [depositAmount, addMoneyChannel, appConfig]);

  useEffect(() => {
    const initializeCard = async () => {
      if (user && user.uid && (!user.ambCardNumber || !user.ambAccountNumber)) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const rand1 = Math.floor(1000 + Math.random() * 9000);
          const rand2 = Math.floor(1000 + Math.random() * 9000);
          const cardNumber = `4840 6100 ${rand1} ${rand2}`;
          
          const randAcc = Math.floor(100000 + Math.random() * 900000);
          const accountNumber = `164.121.${randAcc}`;
          
          const cvv = String(Math.floor(100 + Math.random() * 900));
          
          const now = new Date();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const yy = String(now.getFullYear() + 1 - 2000);
          const expiry = `${mm}/${yy}`;
          
          await updateDoc(userRef, {
            ambCardNumber: cardNumber,
            ambAccountNumber: accountNumber,
            ambCardHolderName: (user.name || 'AMB MEMBER').toUpperCase(),
            ambCardExpiry: expiry,
            ambCardCvv: cvv,
            ambCardStatus: 'active',
            ambCardIssuedAt: now.toISOString()
          });
          
          if (syncLiveProfile) {
            syncLiveProfile();
          }
        } catch (e) {
          console.error("Error initializing AMB virtual card: ", e);
        }
      }
    };
    initializeCard();
  }, [user, syncLiveProfile]);
// 1.5 AMB to AMB States
  const [ambSubTab, setAmbSubTab] = useState<'send' | 'card_add'>('send');
  const [ambSendReceiver, setAmbSendReceiver] = useState('');
  const [ambSendAmount, setAmbSendAmount] = useState('');
  const [ambSendPin, setAmbSendPin] = useState('');

  const [cardAddNum, setCardAddNum] = useState('');
  const [cardAddExpiry, setCardAddExpiry] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [showCardDetails, setShowCardDetails] = useState(true);

  useEffect(() => {
    if (expiryMonth && expiryYear) {
      setCardAddExpiry(`${expiryMonth}/${expiryYear}`);
    } else {
      setCardAddExpiry('');
    }
  }, [expiryMonth, expiryYear]);

  const [cardAddCvv, setCardAddCvv] = useState('');
  const [cardAddPin, setCardAddPin] = useState('');
  const [cardAddAmount, setCardAddAmount] = useState('');

// Card Add Money OTP Security state variables
  const [cardOtpSent, setCardOtpSent] = useState(false);
  const [cardOtpCode, setCardOtpCode] = useState('');
  const [userEnteredOtp, setUserEnteredOtp] = useState('');
  const [validatedCardOwnerData, setValidatedCardOwnerData] = useState<any>(null);
  const [validatedCardOwnerUid, setValidatedCardOwnerUid] = useState('');

// Favorite / Saved Cards state
  const [saveCardNicknameInput, setSaveCardNicknameInput] = useState('');
  const [showSaveCardModal, setShowSaveCardModal] = useState(false);
  const [previewQrModalUrl, setPreviewQrModalUrl] = useState<string | null>(null);

  const handleSaveCurrentCardToFavorites = async (nickname?: string) => {
    if (!cardAddNum || !cardAddNum.trim()) {
      setErrorMsg('প্রথমে সেভ করতে চাওয়া 16 সংখ্যার কার্ড নম্বরটি লিখুন।');
      return;
    }
    const cleanNum = cardAddNum.replace(/\s+/g, '');
    if (cleanNum.length < 16) {
      setErrorMsg('সঠিক 16 সংখ্যার কার্ড নম্বর লিখুন।');
      return;
    }
    const label = nickname && nickname.trim() ? nickname.trim() : (saveCardNicknameInput.trim() || 'প্রিয় কার্ড');
    const currentSaved = user.savedAmbCards || [];
    
    if (currentSaved.length >= 5) {
      setErrorMsg('আপনি সর্বোচ্চ 5টি প্রিয় কার্ড সেভ করে রাখতে পারবেন। কোনো একটি কার্ড মুছে নতুন যোগ করুন।');
      return;
    }

    if (currentSaved.some(c => c.cardNumber.replace(/\s+/g, '') === cleanNum)) {
      setErrorMsg('এই কার্ডটি ইতিমধ্যেই আপনার প্রিয় কার্ড তালিকায় সংরক্ষিত আছে।');
      return;
    }

    const exp = cardAddExpiry || (expiryMonth && expiryYear ? `${expiryMonth}/${expiryYear}` : '07/27');
    const newSaved: SavedAmbCard = {
      id: `CARD_${Date.now()}`,
      name: label,
      cardNumber: cleanNum,
      expiry: exp,
      cvv: cardAddCvv || '820'
    };

    const updated = [...currentSaved, newSaved];
    user.savedAmbCards = updated;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), { savedAmbCards: updated });
      setSuccessMsg(`"${label}" প্রিয় কার্ড হিসেবে সেভ করা হয়েছে! ⭐`);
      setSaveCardNicknameInput('');
      setShowSaveCardModal(false);
      if (syncLiveProfile) syncLiveProfile();
    } catch (err: any) {
      console.error("Error saving favorite card: ", err);
      setErrorMsg('প্রিয় কার্ড সেভ করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleDeleteSavedCard = async (cardId: string) => {
    const currentSaved = user.savedAmbCards || [];
    const updated = currentSaved.filter(c => c.id !== cardId);
    user.savedAmbCards = updated;
    try {
      await updateDoc(doc(db, 'users', user.uid), { savedAmbCards: updated });
      setSuccessMsg('প্রিয় কার্ডটি তালিকা থেকে মুছে ফেলা হয়েছে।');
      if (syncLiveProfile) syncLiveProfile();
    } catch (err: any) {
      console.error("Error deleting saved card: ", err);
      setErrorMsg('মুছে ফেলতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const [trxId, setTrxId] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [bankStep, setBankStep] = useState<1 | 2>(1);
  const [foreignBankStep, setForeignBankStep] = useState<1 | 2>(1);

// 2. Send Money States
  const SAMITY_MONTH_LIST = [
    { id: 'jan', name: 'জানুয়ারি' },
    { id: 'feb', name: 'ফেব্রুয়ারি' },
    { id: 'mar', name: 'মার্চ' },
    { id: 'apr', name: 'এপ্রিল' },
    { id: 'may', name: 'মে' },
    { id: 'jun', name: 'জুন' },
    { id: 'jul', name: 'জুলাই' },
    { id: 'aug', name: 'আগস্ট' },
    { id: 'sep', name: 'সেপ্টেম্বর' },
    { id: 'oct', name: 'অক্টোবর' },
    { id: 'nov', name: 'নভেম্বর' },
    { id: 'dec', name: 'ডিসেম্বর' },
  ];
  const [sendSelectedMonth, setSendSelectedMonth] = useState<string>(
    SAMITY_MONTH_LIST[new Date().getMonth()]?.id || 'jan'
  );
  const [sendMoneyChannel, setSendMoneyChannel] = useState<'amb' | 'mobile_bank' | 'bank_wallet' | 'abroad' | 'remittance'>('mobile_bank');
  const [selectedMobileOp, setSelectedMobileOp] = useState<string | null>(null);
  const [selectedBankOp, setSelectedBankOp] = useState<string | null>(null);
  const [sendTargetId, setSendTargetId] = useState('');
  const [sendTargetNumber, setSendTargetNumber] = useState('');
  const [sendTargetOperator, setSendTargetOperator] = useState<'bkash' | 'nagad' | 'rocket' | 'upay'>('bkash');
  const [sendBankName, setSendBankName] = useState('Dutch-Bangla Bank');
  const [sendAccTitle, setSendAccTitle] = useState('');
  const [sendAccNo, setSendAccNo] = useState('');
  const [sendBranch, setSendBranch] = useState('');
  const [sendRouting, setSendRouting] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  
// Charge Calculation State
  const [chargeInfo, setChargeInfo] = useState<{ flat: number, service: number, total: number }>({ flat: 0, service: 0, total: 0 });

  useEffect(() => {
    const amount = Number(sendAmount);
    if (!amount || amount < 10) {
      setChargeInfo({ flat: 0, service: 0, total: 0 });
      return;
    }

    const {
      sendMoneyMobileBankFlatCharge = 4.90,
      sendMoneyMobileBankServiceChargePerThousand = 1,
      sendMoneyBankFlatCharge = 7.90,
      sendMoneyBankServiceChargePerThousand = 7.90
    } = appConfig || {};

    let flat = 0;
    let service = 0;

    if (sendMoneyChannel === 'amb') {
      flat = 0;
      service = 0;
    } else if (sendMoneyChannel === 'mobile_bank') {
      flat = Number(sendMoneyMobileBankFlatCharge);
      service = Math.ceil(amount / 1000) * Number(sendMoneyMobileBankServiceChargePerThousand);
    } else if (sendMoneyChannel === 'bank_wallet') {
      flat = Number(sendMoneyBankFlatCharge);
      service = Math.ceil(amount / 1000) * Number(sendMoneyBankServiceChargePerThousand);
    }
    
    setChargeInfo({ flat, service, total: flat + service });
  }, [sendAmount, sendMoneyChannel, appConfig]);

// 3. Bill Pay States
  const [billCategory, setBillCategory] = useState<'electricity' | 'gas' | 'water' | 'internet' | 'tv' | 'telephone' | null>(null);
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [selectedBillProvider, setSelectedBillProvider] = useState<{ id: string; name: string; label: string; enLabel?: string; iconColor?: string } | null>(null);
  const [billAccNo, setBillAccNo] = useState('');
  const [billMonth, setBillMonth] = useState('July 2026');
  const [showMonthPopup, setShowMonthPopup] = useState(false);
  const [billAmount, setBillAmount] = useState('');
  const [billImage, setBillImage] = useState<string>('');

// Fetch Khatiyan Transactions
  const fetchTransactions = async () => {
    try {
      if (!user.uid) return;
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const querySnapshot = await getDocs(q);
      const docs: Transaction[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        docs.push({ id: docSnap.id, ...data } as any);
      });
// Filter for banking related transactions
const bankingTypes = ['add_money', 'deposit', 'withdraw', 'bill_pay', 'money_exchange', 'transfer', 'received_transfer'];
      setTxList(docs.filter(t => bankingTypes.includes(t.type)));
    } catch (e) {
      console.error("Error fetching transactions: ", e);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user.uid, activeTab]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMsg(`${label} সফলভাবে কপি হয়েছে!`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const isForeignBankItem = (b: any) => {
    if (b.isInternational === true) return true;
    if (b.country && !b.country.includes('বাংলাদেশ') && b.country !== 'Bangladesh') return true;
    if (b.currency && b.currency !== 'BDT') return true;
    const str = `${b.id || ''} ${b.name || ''} ${b.branch || ''} ${b.country || ''}`.toLowerCase();
    return (
      str.includes('al rajhi') ||
      str.includes('rajhi') ||
      str.includes('saudi') ||
      str.includes('snb') ||
      str.includes('enbd') ||
      str.includes('emirates') ||
      str.includes('dubai') ||
      str.includes('qatar') ||
      str.includes('kuwait') ||
      str.includes('oman') ||
      str.includes('bahrain') ||
      str.includes('malaysia') ||
      str.includes('singapore') ||
      str.includes('america') ||
      str.includes('iban') ||
      str.includes('international') ||
      str.includes('foreign') ||
      str.includes('সৌদি') ||
      str.includes('দুবাই') ||
      str.includes('আল রাজি') ||
      str.includes('কাতার') ||
      str.includes('কুয়েত') ||
      str.includes('কুয়েত') ||
      str.includes('ওমান') ||
      str.includes('বাহরাইন') ||
      str.includes('মালয়েশিয়া') ||
      str.includes('মালয়েশিয়া') ||
      str.includes('সিঙ্গাপুর') ||
      str.includes('আমেরিকা') ||
      str.includes('আইবান') ||
      str.includes('বিদেশী') ||
      str.includes('আন্তর্জাতিক')
    );
  };

  const handleAddMoneySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (loading) return;

    if (!depositAmount || Number(depositAmount) <= 0) {
      setErrorMsg('সঠিক ডিপোজিট পরিমাণ লিখুন।');
      return;
    }
    if (!senderNumber) {
      setErrorMsg('প্রেরক অ্যাকাউন্ট, আইবান বা মোবাইল নম্বর প্রদান করুন।');
      return;
    }
    if (!trxId || !trxId.trim()) {
      setErrorMsg('ট্রানজেকশন আইডি (TrxID) দেওয়া বাধ্যতামূলক। অনুগ্রহ করে সঠিক TrxID লিখুন।');
      return;
    }
    if (trxId.trim().length < 5) {
      setErrorMsg('সঠিক ট্রানজেকশন আইডি (TrxID) লিখুন। শুধু শেষ চার সংখ্যা দিলে হবে না, সম্পূর্ণ TrxID দিন।');
      return;
    }
    const userPin = user?.pin ? String(user.pin).trim() : '';
    if (!userPin || securityPin.trim() !== userPin) {
      setErrorMsg('ভুল সিকিউরিটি পিন! সঠিক 4 সংখ্যার ওয়ালেট পিন প্রদান করুন।');
      return;
    }

    const inputVal = Number(depositAmount);
    const isBank = addMoneyChannel === 'bank_deposit';
    const isForeignBank = addMoneyChannel === 'foreign_bank';
    const txType = 'add_money';

    const selectedBankObj = (appConfig?.paymentBanks || []).find(b => b.id === selectedBankId);
    const intlCurrency = isForeignBank 
      ? getBankCurrencyInfo(selectedBankObj, remittanceRates, appConfig?.remittanceRates, undefined, 'add_money')
      : null;

    let bdtAmountVal = 0;
    let foreignAmountVal: number | undefined = undefined;
    let foreignCurrencyCode: string | undefined = undefined;
    let exchangeRateVal: number | undefined = undefined;
    let bankTransferFeeVal = 0;

    if (isForeignBank && intlCurrency) {
      bankTransferFeeVal = 0; // Foreign add money has no transfer fee
      if (foreignCurrencyMode === 'foreign') {
        foreignAmountVal = inputVal;
        bdtAmountVal = Math.round(inputVal * intlCurrency.rate * 100) / 100;
      } else {
        bdtAmountVal = inputVal;
        foreignAmountVal = intlCurrency.rate > 0 ? Math.round((inputVal / intlCurrency.rate) * 100) / 100 : 0;
      }
      foreignCurrencyCode = intlCurrency.code;
      exchangeRateVal = intlCurrency.rate;

      if (bdtAmountVal < 10) {
        setErrorMsg('সর্বনিম্ন জমার পরিমাণ 10 BDT হতে হবে।');
        return;
      }
    } else {
      bdtAmountVal = inputVal;
      if (bdtAmountVal < 10) {
        setErrorMsg('সর্বনিম্ন জমার পরিমাণ 10 BDT হতে হবে।');
        return;
      }
    }

    const amountNum = bdtAmountVal;

    let methodLabel = 'Add Money';
    if (isForeignBank) {
      methodLabel = selectedBankObj 
        ? `${selectedBankObj.name} (${foreignCurrencyCode || 'Foreign'})` 
        : 'Foreign IBAN Remittance';
    } else if (isBank) {
      methodLabel = selectedBankObj 
        ? selectedBankObj.name 
        : 'Bank Transfer';
    } else {
      methodLabel = addMoneyOperator === 'bkash' ? 'bKash' : addMoneyOperator === 'nagad' ? 'Nagad' : addMoneyOperator === 'rocket' ? 'Rocket' : 'Upay';
    }

    const currentTxId = trxId.trim();
    const currentSender = senderNumber.trim() || user.phone || '';

    // Check if this TrxID is already submitted and pending to avoid duplicate requests
    if (user?.uid && currentTxId) {
      const existingPending = (txList || []).find(t => 
        t.userId === user.uid && 
        (t.status === 'pending' || (t as any).status === 'processing') && 
        (t.trxId?.toLowerCase() === currentTxId.toLowerCase() || (t as any).transactionId?.toLowerCase() === currentTxId.toLowerCase())
      );
      if (existingPending) {
        setErrorMsg('এই ট্রানজেকশন আইডি (TrxID) দিয়ে ইতিপূর্বে একটি রিকোয়েস্ট জমা দেওয়া হয়েছে। অনুগ্রহ করে এডমিনের অনুমোদনের অপেক্ষা করুন।');
        return;
      }
    }

    setLoading(true);
    try {
      await Promise.all([
        addDoc(collection(db, 'admin_notifications'), {
          title: isForeignBank ? '🌐 নতুন প্রবাস ব্যাংক ডিপোজিট রিকোয়েস্ট' : '📥 নতুন ব্যাংক/মোবাইল অ্যাড মানি রিকোয়েস্ট',
          message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ৳${amountNum.toLocaleString('bn-BD')} টাকা অ্যাড মানি রিকোয়েস্ট করেছেন (${methodLabel}, TrxID: ${currentTxId})।`,
          userId: user.uid,
          userName: user.name || '',
          memberId: user.memberId || '',
          userPhone: currentSender,
          amount: amountNum,
          trxId: currentTxId,
          type: 'add_money',
          read: false,
          createdAt: new Date().toISOString()
        }).catch(e => console.warn('Admin notif error:', e)),
        addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userName: user.name || 'Anonymous User',
          userPhone: user.phone || '',
          memberId: user.memberId || 'AMB000000',
          amount: amountNum,
          type: txType,
          status: 'pending',
          paymentMethod: methodLabel,
          phone: currentSender,
          senderPhone: currentSender,
          senderInfo: currentSender,
          accountNumber: currentSender,
          trxId: currentTxId,
          transactionId: currentTxId,
          receiptNo: currentTxId,
          foreignAmount: foreignAmountVal,
          foreignCurrency: foreignCurrencyCode,
          exchangeRate: exchangeRateVal,
          bdtAmount: bdtAmountVal,
          createdAt: new Date().toISOString(),
          description: isForeignBank
            ? `${methodLabel} - ${foreignAmountVal} ${foreignCurrencyCode} (এক্সচেঞ্জ রেট: ৳${exchangeRateVal}) = ৳${amountNum.toLocaleString('bn-BD')} BDT প্রবাস ব্যাংক ডিপোজিট রিকোয়েস্ট (প্রেরক: ${currentSender}, TrxID: ${currentTxId})`
            : `${methodLabel} এর মাধ্যমে ৳${amountNum.toLocaleString('bn-BD')} অ্যাড মানি রিকোয়েস্ট (প্রেরক: ${currentSender}, TrxID: ${currentTxId})`
        }),
        addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          title: isForeignBank ? 'প্রবাস ব্যাংক ডিপোজিট রিকোয়েস্ট সাবমিট হয়েছে' : 'অ্যাড মানি রিকোয়েস্ট সাবমিট হয়েছে',
          message: isForeignBank
            ? `আপনার ${foreignAmountVal} ${foreignCurrencyCode} (রেট: ৳${exchangeRateVal}, সমপরিমাণ ৳${amountNum.toLocaleString('bn-BD')} BDT) এর প্রবাস ব্যাংক ডিপোজিট রিকোয়েস্টটি সফলভাবে সাবমিট হয়েছে। এডমিন ভাউচার যাচাই করে ব্যালেন্স যোগ করবেন।`
            : `আপনার ৳${amountNum.toLocaleString('bn-BD')} এর অ্যাড মানি রিকোয়েস্টটি সফলভাবে সাবমিট হয়েছে। এডমিন যাচাই করে ব্যালেন্স যোগ করবে।`,
          read: false,
          createdAt: new Date().toISOString()
        })
      ]);

      setSuccessMsg(isForeignBank 
        ? `আপনার ${foreignAmountVal} ${foreignCurrencyCode} (৳${amountNum.toLocaleString('bn-BD')} BDT) প্রবাস ব্যাংক ডিপোজিট রিকোয়েস্ট সফলভাবে সাবমিট করা হয়েছে!` 
        : 'আপনার অ্যাড মানি রিকোয়েস্ট সফলভাবে সাবমিট করা হয়েছে!'
      );
      setReceiptModalData({
        typeLabel: `অ্যাড মানি (${methodLabel})`,
        transactionId: currentTxId,
        amount: amountNum,
        fee: 0,
        totalAmount: amountNum,
        status: 'pending',
        beneficiaryName: user.name || 'AMB MEMBER',
        beneficiaryAccount: user.memberId || user.phone,
        senderPhone: currentSender,
        transactionDate: new Date().toLocaleString('bn-BD', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true }),
        foreignAmount: foreignAmountVal,
        foreignCurrency: foreignCurrencyCode,
        exchangeRate: exchangeRateVal,
        bdtAmount: bdtAmountVal
      });
      setIsReceiptOpen(true);
      setDepositAmount('');
      setSenderNumber('');
      setTrxId('');
      setSecurityPin('');
      setAddMoneyOperator(null);
      setSelectedBankId(null);
      setBankStep(1);

      if (syncLiveProfile) syncLiveProfile();
    } catch (err: any) {
      console.error("Add money submit error:", err);
      setErrorMsg('রিকোয়েস্ট সাবমিট করতে সমস্যা হয়েছে: ' + (err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleRemittanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (loading) return;

    if (!remitAmount || Number(remitAmount) <= 0) {
      setErrorMsg('সঠিক রেমিট্যান্স পরিমাণ লিখুন।');
      return;
    }
    if (!remitSenderAccount) {
      setErrorMsg('প্রেরক প্রবাস ব্যাংক হিসাব, আইবান বা মোবাইল নম্বর প্রদান করুন।');
      return;
    }
    if (!remitBeneficiaryBankName || !remitBeneficiaryBankName.trim()) {
      setErrorMsg('বাংলাদেশে প্রাপকের ব্যাংকের নাম উল্লেখ করুন।');
      return;
    }
    if (!remitBeneficiaryAccountNo || !remitBeneficiaryAccountNo.trim()) {
      setErrorMsg('বাংলাদেশে প্রাপকের ব্যাংক হিসাব নম্বর (Account No) প্রদান করুন।');
      return;
    }
    if (!remitBeneficiaryName || !remitBeneficiaryName.trim()) {
      setErrorMsg('বাংলাদেশে প্রাপকের নাম (Account Holder Name) প্রদান করুন।');
      return;
    }
    if (!remitTrxId || !remitTrxId.trim()) {
      setErrorMsg('ভাউচার বা ট্রানজেকশন আইডি (TrxID) দেওয়া বাধ্যতামূলক।');
      return;
    }
    if (remitTrxId.trim().length < 5) {
      setErrorMsg('সঠিক ট্রানজেকশন আইডি (TrxID) লিখুন। সম্পূর্ণ TrxID প্রদান করুন।');
      return;
    }
    const userPin = user?.pin ? String(user.pin).trim() : '';
    if (!userPin || remitSecurityPin.trim() !== userPin) {
      setErrorMsg('ভুল সিকিউরিটি পিন! সঠিক 4 সংখ্যার ওয়ালেট পিন প্রদান করুন।');
      return;
    }

    const allBanks = (appConfig?.paymentBanks && Array.isArray(appConfig.paymentBanks)) ? appConfig.paymentBanks : [];
    const customIntlBanks = allBanks.filter((b: any) => isForeignBankItem(b) && b.active !== false);
    const defaultIntlBanksList = [
      { id: 'AL RAJHI (সৌদি ব্যাংক)', name: 'AL RAJHI BANK (সৌদি ব্যাংক)', acronym: 'RAJHI', currency: 'SAR', country: 'সৌদি আরব', active: true },
      { id: 'SNB (সৌদি ব্যাংক)', name: 'SAUDI NATIONAL BANK (SNB ALAHLI)', acronym: 'SNB', currency: 'SAR', country: 'সৌদি আরব', active: true },
      { id: 'ENBD (দুবাই ব্যাংক)', name: 'EMIRATES NBD BANK (DUBAI)', acronym: 'ENBD', currency: 'AED', country: 'সংযুক্ত আরব আমিরাত', active: true }
    ];
    const hasConfiguredBanks = Array.isArray(appConfig?.paymentBanks);
    const displayIntlBanks = (hasConfiguredBanks && customIntlBanks.length > 0)
      ? customIntlBanks
      : (hasConfiguredBanks && (appConfig?.paymentBanks?.length || 0) > 0 ? [] : defaultIntlBanksList);
    const selectedIntlBank = (displayIntlBanks.find((b: any) => b.id === remitSelectedBankId) || displayIntlBanks[0]) as any;

    const remitCurrency = getBankCurrencyInfo(
      selectedIntlBank,
      remittanceRates,
      appConfig?.remittanceRates,
      undefined,
      'remittance'
    );

    const inputVal = Number(remitAmount);
    const remitTransferFee = Number(
      selectedIntlBank?.transferFee !== undefined && selectedIntlBank?.transferFee !== null && selectedIntlBank?.transferFee !== ''
        ? selectedIntlBank.transferFee
        : (remitCurrency.transferFee ?? appConfig?.remittanceTransferFee ?? appConfig?.remittanceFee ?? 15)
    );
    let grossForeign = 0;
    let grossBdt = 0;

    if (remitCurrencyMode === 'foreign') {
      grossForeign = inputVal;
      grossBdt = Math.round(inputVal * remitCurrency.rate * 100) / 100;
    } else {
      grossBdt = inputVal;
      grossForeign = remitCurrency.rate > 0 ? Math.round((inputVal / remitCurrency.rate) * 100) / 100 : 0;
    }

    const feeForeign = inputVal > 0 ? remitTransferFee : 0;
    const feeBdt = Math.round(feeForeign * remitCurrency.rate * 100) / 100;
    const netForeign = Math.max(0, grossForeign - feeForeign);
    const netBdt = Math.round(netForeign * remitCurrency.rate * 100) / 100;

    if (netBdt < 10) {
      setErrorMsg('সর্বনিম্ন রেমিট্যান্স জমার পরিমাণ ১০ BDT সমপরিমাণ হতে হবে।');
      return;
    }

    const incentiveAmountVal = Math.round((netBdt * 0.025) * 100) / 100;
    const totalPayoutVal = Math.max(0, Math.round((netBdt + incentiveAmountVal) * 100) / 100);
    const currentTxId = remitTrxId.trim();
    const currentSender = remitSenderAccount.trim();

    // Check duplicate
    if (user?.uid && currentTxId) {
      const existingPending = (txList || []).find(t => 
        t.userId === user.uid && 
        (t.status === 'pending' || (t as any).status === 'processing') && 
        (t.trxId?.toLowerCase() === currentTxId.toLowerCase() || (t as any).transactionId?.toLowerCase() === currentTxId.toLowerCase())
      );
      if (existingPending) {
        setErrorMsg('এই ট্রানজেকশন আইডি (TrxID) দিয়ে ইতিপূর্বে একটি রিকোয়েস্ট জমা দেওয়া হয়েছে। অনুগ্রহ করে এডমিনের অনুমোদনের অপেক্ষা করুন।');
        return;
      }
    }

    setLoading(true);
    try {
      const bankName = selectedIntlBank?.name || 'অনুমোদিত প্রবাস ব্যাংক';
      const formattedDate = new Date().toLocaleString('bn-BD', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });

      await Promise.all([
        addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userName: user.name || 'Anonymous User',
          userPhone: user.phone || '',
          memberId: user.memberId || 'AMB000000',
          amount: totalPayoutVal,
          bdtAmount: netBdt,
          grossBdtAmount: grossBdt,
          fee: feeForeign,
          feeBdt: feeBdt,
          remittanceFee: feeForeign,
          remittanceTransferFee: feeForeign,
          type: 'remittance',
          category: 'remittance',
          status: 'pending',
          paymentMethod: `প্রবাসী রেমিট্যান্স (${bankName})`,
          senderBankName: bankName,
          phone: currentSender,
          senderPhone: currentSender,
          senderInfo: currentSender,
          accountNumber: currentSender,
          trxId: currentTxId,
          transactionId: currentTxId,
          receiptNo: currentTxId,
          foreignAmount: grossForeign,
          netForeignAmount: netForeign,
          foreignCurrency: remitCurrency.code,
          exchangeRate: remitCurrency.rate,
          remittanceIncentiveRate: 2.5,
          remittanceIncentiveAmount: incentiveAmountVal,
          totalRemittancePayout: totalPayoutVal,
          beneficiaryBankName: remitBeneficiaryBankName.trim(),
          beneficiaryAccountNo: remitBeneficiaryAccountNo.trim(),
          beneficiaryName: remitBeneficiaryName.trim(),
          beneficiaryBranch: remitBeneficiaryBranch.trim(),
          beneficiaryDistrict: remitBeneficiaryDistrict.trim(),
          beneficiaryPhone: remitBeneficiaryPhone.trim(),
          beneficiaryRelation: remitBeneficiaryRelation.trim(),
          createdAt: new Date().toISOString(),
          description: `প্রবাসী রেমিট্যান্স: ${grossForeign} ${remitCurrency.code} (ফি: ${feeForeign} ${remitCurrency.code}, নিট: ${netForeign} ${remitCurrency.code}, রেট: ৳${remitCurrency.rate}) = নিট ৳${netBdt.toLocaleString('bn-BD')} + ২.৫% প্রণোদনা ৳${incentiveAmountVal.toLocaleString('bn-BD')} = বাংলাদেশে প্রাপক মোট পাবেন ৳${totalPayoutVal.toLocaleString('bn-BD')} BDT (প্রাপক ব্যাংক: ${remitBeneficiaryBankName}, হিসাব: ${remitBeneficiaryAccountNo}, প্রাপক: ${remitBeneficiaryName}, প্রেরক হিসাব: ${currentSender}, TrxID: ${currentTxId})`
        }),
        addDoc(collection(db, 'admin_notifications'), {
          title: '🌍 নতুন প্রবাসী রেমিট্যান্স আবেদন',
          message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ${grossForeign} ${remitCurrency.code} প্রবাসী রেমিট্যান্স পাঠিয়েছেন (প্রাপক মোট পাবেন ৳${totalPayoutVal.toLocaleString('bn-BD')} BDT)।`,
          userId: user.uid,
          userName: user.name || '',
          memberId: user.memberId || '',
          userPhone: currentSender,
          amount: totalPayoutVal,
          trxId: currentTxId,
          type: 'remittance',
          read: false,
          createdAt: new Date().toISOString()
        }).catch(e => console.warn('Admin notif error:', e)),
        addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          title: 'প্রবাসী রেমিট্যান্স আবেদন সাবমিট হয়েছে',
          message: `আপনার ${grossForeign} ${remitCurrency.code} (ফি: ${feeForeign} ${remitCurrency.code}, নিট: ${netForeign} ${remitCurrency.code}, রেট: ৳${remitCurrency.rate}, নিট ৳${netBdt} + ২.৫% প্রণোদনা ৳${incentiveAmountVal} = মোট প্রাপ্যতা ৳${totalPayoutVal} BDT) এর প্রবাসী রেমিট্যান্স আবেদন সফলভাবে জমা হয়েছে। এডমিন ভাউচার যাচাই করে প্রাপকের ব্যাংকে টাকা পাঠিয়ে দেবে।`,
          read: false,
          createdAt: new Date().toISOString()
        })
      ]);

      setReceiptModalData({
        typeLabel: 'প্রবাসী রেমিট্যান্স (২.৫% প্রণোদনা সহ)',
        transactionId: currentTxId,
        amount: netBdt,
        grossAmount: grossBdt,
        fee: feeForeign,
        feeBdt: feeBdt,
        remittanceFee: feeForeign,
        remittanceTransferFee: feeForeign,
        totalAmount: totalPayoutVal,
        status: 'pending',
        beneficiaryName: remitBeneficiaryName.trim(),
        beneficiaryAccount: remitBeneficiaryAccountNo.trim(),
        bankName: remitBeneficiaryBankName.trim(),
        branchName: remitBeneficiaryBranch.trim(),
        senderPhone: currentSender,
        transactionDate: formattedDate,
        foreignAmount: grossForeign,
        netForeignAmount: netForeign,
        foreignCurrency: remitCurrency.code,
        exchangeRate: remitCurrency.rate,
        bdtAmount: netBdt,
        remittanceIncentiveRate: 2.5,
        remittanceIncentiveAmount: incentiveAmountVal,
        totalRemittancePayout: totalPayoutVal,
        beneficiaryBankName: remitBeneficiaryBankName.trim(),
        beneficiaryAccountNo: remitBeneficiaryAccountNo.trim(),
        beneficiaryBranch: remitBeneficiaryBranch.trim(),
        beneficiaryDistrict: remitBeneficiaryDistrict.trim(),
        beneficiaryPhone: remitBeneficiaryPhone.trim(),
        beneficiaryRelation: remitBeneficiaryRelation.trim()
      });
      setIsReceiptOpen(true);
      setSuccessMsg(`আপনার ${grossForeign} ${remitCurrency.code} (ফি বাদে নিট ${netForeign} ${remitCurrency.code}, মোট প্রদেয় ৳${totalPayoutVal.toLocaleString('bn-BD')} BDT) প্রবাসী রেমিট্যান্স আবেদন সফলভাবে সাবমিট করা হয়েছে!`);

      setRemitAmount('');
      setRemitSenderAccount('');
      setRemitBeneficiaryBankName('');
      setRemitBeneficiaryAccountNo('');
      setRemitBeneficiaryName('');
      setRemitBeneficiaryBranch('');
      setRemitBeneficiaryDistrict('');
      setRemitBeneficiaryPhone('');
      setRemitTrxId('');
      setRemitSecurityPin('');
      setRemitStep(1);
      setRemitSelectedBankId(null);
      if (syncLiveProfile) syncLiveProfile();
    } catch (err: any) {
      console.error("Remittance submit error:", err);
      setErrorMsg('রেমিট্যান্স আবেদন সাবমিট করতে সমস্যা হয়েছে: ' + (err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleAmbSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (user.ambCardStatus === 'inactive') {
      setErrorMsg('দুঃখিত! আপনার ভার্চুয়াল কার্ডটি লক বা নিষ্ক্রিয় রয়েছে। অনুগ্রহ করে কার্ড আনলক করুন।');
      return;
    }

    const amountNum = Number(ambSendAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg('সঠিক টাকার পরিমাণ দিন।');
      return;
    }

    if (amountNum < 10) {
      setErrorMsg('সর্বনিম্ন 10 টাকা স্থানান্তর করতে পারবেন।');
      return;
    }

    if ((user.balance || 0) < amountNum) {
      setErrorMsg('আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই।');
      return;
    }

    if (user.pin !== ambSendPin.trim()) {
      setErrorMsg('ভুল সিকিউরিটি পিন! সঠিক 4 সংখ্যার ওয়ালেট পিন প্রদান করুন।');
      return;
    }

    setLoading(true);
    try {
      const trimmedReceiver = ambSendReceiver.trim();
      let receiverDoc = null;
      let isVirtualSomitiAcc = false;

      const isVirtualEndingInZero = trimmedReceiver.endsWith('0') && trimmedReceiver.length >= 10;
      const cleanReceiver = isVirtualEndingInZero ? trimmedReceiver.slice(0, -1) : trimmedReceiver;

// Fast query memberId, phone, or virtual phone/memberId in parallel
      const q1 = query(collection(db, 'users'), where('memberId', '==', trimmedReceiver));
      const q2 = query(collection(db, 'users'), where('phone', '==', trimmedReceiver));
      const q3 = isVirtualEndingInZero ? query(collection(db, 'users'), where('memberId', '==', cleanReceiver)) : null;
      const q4 = isVirtualEndingInZero ? query(collection(db, 'users'), where('phone', '==', cleanReceiver)) : null;
      const q5 = (isVirtualEndingInZero && cleanReceiver.startsWith('0')) ? query(collection(db, 'users'), where('phone', '==', cleanReceiver.substring(1))) : null;
      const q6 = (isVirtualEndingInZero && cleanReceiver.startsWith('0')) ? query(collection(db, 'users'), where('phone', '==', '+88' + cleanReceiver)) : null;

      const [snap1, snap2, snap3, snap4, snap5, snap6] = await Promise.all([
        getDocs(q1).catch(() => ({ empty: true, docs: [] } as any)),
        getDocs(q2).catch(() => ({ empty: true, docs: [] } as any)),
        q3 ? getDocs(q3).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any),
        q4 ? getDocs(q4).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any),
        q5 ? getDocs(q5).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any),
        q6 ? getDocs(q6).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any)
      ]);

      if (!snap1.empty && snap1.docs.length > 0) {
        receiverDoc = snap1.docs[0];
        if (trimmedReceiver.endsWith('0')) isVirtualSomitiAcc = true;
      } else if (!snap2.empty && snap2.docs.length > 0) {
        receiverDoc = snap2.docs[0];
        if (trimmedReceiver.endsWith('0')) isVirtualSomitiAcc = true;
      } else if (snap3 && !snap3.empty && snap3.docs.length > 0) {
        receiverDoc = snap3.docs[0];
        isVirtualSomitiAcc = true;
      } else if (snap4 && !snap4.empty && snap4.docs.length > 0) {
        receiverDoc = snap4.docs[0];
        isVirtualSomitiAcc = true;
      } else if (snap5 && !snap5.empty && snap5.docs.length > 0) {
        receiverDoc = snap5.docs[0];
        isVirtualSomitiAcc = true;
      } else if (snap6 && !snap6.empty && snap6.docs.length > 0) {
        receiverDoc = snap6.docs[0];
        isVirtualSomitiAcc = true;
      }

      if (trimmedReceiver.endsWith('0') || isVirtualEndingInZero) {
        isVirtualSomitiAcc = true;
      }

      if (!receiverDoc) {
        setErrorMsg('প্রাপকের অ্যাকাউন্ট পাওয়া যায়নি। সঠিক মেম্বার আইডি বা মোবাইল নম্বর দিন।');
        setLoading(false);
        return;
      }

      const receiverUid = receiverDoc.id;
      const receiverData = receiverDoc.data();

      if (receiverUid === user.uid) {
        setErrorMsg('আপনি নিজের অ্যাকাউন্টে ফান্ড ট্রান্সফার করতে পারবেন না।');
        setLoading(false);
        return;
      }

      const senderRef = doc(db, 'users', user.uid);
      const receiverRef = doc(db, 'users', receiverUid);

      let finalSenderBal = 0;
      let finalReceiverBal = 0;

      await runTransaction(db, async (transaction) => {
        const senderSnap = await transaction.get(senderRef);
        const receiverSnap = await transaction.get(receiverRef);

        if (!senderSnap.exists()) {
          throw new Error('আপনার অ্যাকাউন্ট পাওয়া যায়নি।');
        }
        if (!receiverSnap.exists()) {
          throw new Error('গ্রহীতা অ্যাকাউন্ট পাওয়া যায়নি।');
        }

        const sData = senderSnap.data();
        const rData = receiverSnap.data();

        const currentSenderBal = sData.balance || 0;
        if (currentSenderBal < amountNum) {
          throw new Error(`পর্যাপ্ত ওয়ালেট ব্যালেন্স নেই! আপনার বর্তমান ওয়ালেট ব্যালেন্স ৳ ${currentSenderBal.toLocaleString('bn-BD')} BDT।`);
        }

        finalSenderBal = currentSenderBal - amountNum;
        if (isVirtualSomitiAcc) {
          finalReceiverBal = (rData.savings || 0) + amountNum;
          transaction.update(receiverRef, { savings: finalReceiverBal, dpsBalance: finalReceiverBal });
        } else {
          finalReceiverBal = (rData.balance || 0) + amountNum;
          transaction.update(receiverRef, { balance: finalReceiverBal, mainBalance: finalReceiverBal });
        }

        transaction.update(senderRef, { balance: finalSenderBal, mainBalance: finalSenderBal });

        const txSenderRef = doc(collection(db, 'transactions'));
        const txReceiverRef = doc(collection(db, 'transactions'));
        const notifReceiverRef = doc(collection(db, 'user_notifications'));

        transaction.set(txSenderRef, {
          userId: user.uid,
          userName: user.name || '',
          userPhone: user.phone || '',
          memberId: user.memberId || '',
          amount: amountNum,
          postBalance: finalSenderBal,
          type: isVirtualSomitiAcc ? 'coop_savings_deposit' : 'transfer',
          typeLabel: isVirtualSomitiAcc ? 'সমিতি ওয়ালেটে অটো ফান্ড জমা' : 'ফান্ড ট্রান্সফার',
          status: 'success',
          paymentMethod: 'Al Mayadin Wallet',
          phone: rData.phone,
          createdAt: new Date().toISOString(),
          description: `মেম্বার ${rData.name || ''} (${rData.memberId || ''}) কে ফান্ড পাঠানো হয়েছে`
        });

        transaction.set(txReceiverRef, {
          userId: receiverUid,
          userName: rData.name || '',
          userPhone: rData.phone || '',
          memberId: rData.memberId || '',
          amount: amountNum,
          postBalance: finalReceiverBal,
          type: isVirtualSomitiAcc ? 'coop_savings_deposit' : 'add_money',
          typeLabel: isVirtualSomitiAcc ? 'সমিতি একাউন্টে সঞ্চয় জমা' : 'ফান্ড গ্রহণ',
          status: 'success',
          paymentMethod: 'Al Mayadin Wallet',
          phone: user.phone,
          createdAt: new Date().toISOString(),
          description: `মেম্বার ${user.name} (${user.memberId}) থেকে ফান্ড গ্রহণ`
        });

        transaction.set(notifReceiverRef, {
          userId: receiverUid,
          title: isVirtualSomitiAcc ? '📥 সমিতি একাউন্টে সঞ্চয় জমা' : 'ফান্ড জমা হয়েছে',
          message: isVirtualSomitiAcc 
            ? `মেম্বার ${user.name} (${user.memberId}) থেকে ৳${amountNum.toLocaleString('en-US')} আপনার সমিতি একাউন্টে (${trimmedReceiver}) জমা হয়েছে।`
            : `মেম্বার ${user.name} (${user.memberId}) থেকে ৳${amountNum.toLocaleString('en-US')} আপনার ওয়ালেটে জমা হয়েছে।`,
          read: false,
          createdAt: new Date().toISOString()
        });
      });

// Update local memory and UI state after transaction succeeds 100%
// user.balance = finalSenderBal;
      if (syncLiveProfile) syncLiveProfile();

      const generatedTxId = generateAmbTrxId('BN');
      setSuccessMsg(isVirtualSomitiAcc ? 'অভিনন্দন! সমবায় সমিতি একাউন্টে জমা সফল হয়েছে।' : 'অভিনন্দন! ফান্ড স্থানান্তর সফলভাবে সম্পন্ন হয়েছে।');
      setReceiptModalData({
        typeLabel: isVirtualSomitiAcc ? 'AMB সমিতি ওয়ালেট জমা (Virtual Acc)' : 'AMB TO AMB সেন্ড মানি',
        transactionId: generatedTxId,
        amount: amountNum,
        fee: 0,
        totalAmount: amountNum,
        status: 'success',
        beneficiaryName: receiverData.name || 'AMB MEMBER',
        beneficiaryAccount: isVirtualSomitiAcc ? `${receiverData.phone}0` : (receiverData.memberId || receiverData.phone),
        senderPhone: user.phone,
        transactionDate: new Date().toLocaleString('bn-BD', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true })
      });
      setIsReceiptOpen(true);
      setAmbSendAmount('');
      setAmbSendReceiver('');
      setAmbSendPin('');
      setLoading(false);
    } catch (err: any) {
      console.error("Error in direct transfer: ", err);
      setErrorMsg('স্থানান্তর সম্পন্ন করতে ব্যর্থ হয়েছে: ' + err.message);
      setLoading(false);
    }
  };

  const handleAmbCardAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const amountNum = Number(cardAddAmount);
    if (!cardAddNum || !cardAddNum.trim()) {
      setErrorMsg('কার্ড নম্বর প্রদান করুন।');
      return;
    }
    if (!cardAddAmount || amountNum < 10) {
      setErrorMsg('সর্বনিম্ন অ্যাড মানি পরিমাণ 10 BDT হতে হবে।');
      return;
    }
    if (!cardAddPin || !cardAddPin.trim()) {
      setErrorMsg('আপনার 4 সংখ্যার ওয়ালেট পিন প্রদান করুন।');
      return;
    }

// Fast pre-validation before loading state
    if (cardOtpSent) {
      if (!userEnteredOtp || userEnteredOtp.trim().length < 6) {
        setErrorMsg('অনুগ্রহ করে 6 সংখ্যার ওটিপি কোডটি প্রবেশ করান।');
        return;
      }
      if (userEnteredOtp.trim() !== cardOtpCode) {
        setErrorMsg('ভুল ওটিপি কোড! অনুগ্রহ করে সঠিক 6 সংখ্যার ওটিপি কোডটি প্রদান করুন।');
        return;
      }
    }

    setLoading(true);

    try {
      if (cardOtpSent) {
// OTP already verified! Process transaction instantly ⚡
        const cardOwnerUid = validatedCardOwnerUid;
        const cardOwnerData = validatedCardOwnerData || {};

        if (!cardOwnerUid) {
          setErrorMsg('কার্ড মালিকের তথ্য পাওয়া যায়নি। আবার ট্রাই করুন।');
          setLoading(false);
          return;
        }

        const freshOwnerBal = Number(cardOwnerData.balance || 0);
        if (freshOwnerBal < amountNum) {
          setErrorMsg(`কার্ড মালিকের অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই! (বর্তমান ব্যালেন্স ৳${freshOwnerBal.toLocaleString('bn-BD')} BDT)`);
          setLoading(false);
          return;
        }

        const updatedOwnerBal = freshOwnerBal - amountNum;
        const freshReceiverBal = Number(user.balance || 0);
        const updatedReceiverBal = freshReceiverBal + amountNum;

// Instant optimistic update ⚡
        if (cardOwnerUid) {
          const ownerRef = doc(db, 'users', cardOwnerUid);
          updateDoc(ownerRef, {
            activeCardOtp: null,
            activeCardOtpAmount: null,
            activeCardOtpRequester: null,
            activeCardOtpTime: null
          }).catch(() => {});
        }

        user.balance = updatedReceiverBal;
        if (syncLiveProfile) syncLiveProfile();

        const generatedTxId = generateAmbTrxId('B');
        setReceiptModalData({
          typeLabel: 'ভার্চুয়াল কার্ড পে এডমানি',
          transactionId: generatedTxId,
          amount: amountNum,
          fee: 0,
          totalAmount: amountNum,
          status: 'success',
          beneficiaryName: user.name || 'AMB MEMBER',
          beneficiaryAccount: user.memberId || user.phone,
          senderPhone: cardOwnerData.phone || user.phone,
          transactionDate: new Date().toLocaleString('bn-BD', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true })
        });
        setIsReceiptOpen(true);
        setSuccessMsg(`অভিনন্দন! ৳${amountNum} টাকা কার্ড পেমেন্টের মাধ্যমে এডমানি সফলভাবে সম্পন্ন হয়েছে।`);

// Reset form immediately
        setCardAddNum('');
        setCardAddExpiry('');
        setExpiryMonth('');
        setExpiryYear('');
        setCardAddCvv('');
        setCardAddPin('');
        setCardAddAmount('');
        setCardOtpSent(false);
        setCardOtpCode('');
        setUserEnteredOtp('');
        setValidatedCardOwnerData(null);
        setValidatedCardOwnerUid('');
        setLoading(false);

// Async non-blocking database persistence
        const nowIso = new Date().toISOString();
        const ownerRef = doc(db, 'users', cardOwnerUid);
        const receiverRef = doc(db, 'users', user.uid);

        Promise.all([
          updateDoc(ownerRef, { balance: updatedOwnerBal, mainBalance: updatedOwnerBal }),
          updateDoc(receiverRef, { balance: updatedReceiverBal, mainBalance: updatedReceiverBal }),
          addDoc(collection(db, 'transactions'), {
            userId: cardOwnerUid,
            userName: cardOwnerData.name || 'Card Owner',
            userPhone: cardOwnerData.phone || '',
            memberId: cardOwnerData.memberId || '',
            amount: amountNum,
            postBalance: updatedOwnerBal,
            type: 'withdraw',
            typeLabel: 'কার্ড পেমেন্ট (ডেবিট)',
            status: 'success',
            paymentMethod: 'AMB Card',
            phone: user.phone,
            createdAt: nowIso,
            description: `মেম্বার ${user.name} (${user.memberId}) কে কার্ডের মাধ্যমে ৳${amountNum} ফান্ড পেমেন্ট`
          }),
          addDoc(collection(db, 'transactions'), {
            userId: user.uid,
            userName: user.name || '',
            userPhone: user.phone || '',
            memberId: user.memberId || '',
            amount: amountNum,
            postBalance: updatedReceiverBal,
            type: 'add_money',
            typeLabel: 'কার্ড এডমানি',
            status: 'success',
            paymentMethod: 'AMB Card',
            phone: cardOwnerData.phone || '',
            createdAt: nowIso,
            description: `কার্ড ${cardAddNum} (মালিক: ${cardOwnerData.name || 'AMB Card'}) থেকে ওয়ালেটে ৳${amountNum} এডমানি`
          }),
          addDoc(collection(db, 'user_notifications'), {
            userId: cardOwnerUid,
            title: '💸 কার্ড থেকে টাকা কর্তন (Debit Alert)',
            body: `আপনার ভার্চুয়াল কার্ড থেকে ৳${amountNum.toFixed(2)} কেটে নেওয়া হয়েছে মেম্বার ${user.name} (${user.memberId}) কে পরিশোধে। আপনার নতুন ব্যালেন্স ৳${updatedOwnerBal.toFixed(2)} BDT।`,
            message: `আপনার ভার্চুয়াল কার্ড থেকে ৳${amountNum.toFixed(2)} কেটে নেওয়া হয়েছে মেম্বার ${user.name} (${user.memberId}) কে পরিশোধে। আপনার নতুন ব্যালেন্স ৳${updatedOwnerBal.toFixed(2)} BDT।`,
            read: false,
            isPersonal: true,
            createdAt: nowIso
          }),
          addDoc(collection(db, 'user_notifications'), {
            userId: user.uid,
            title: '💰 কার্ড এডমানি সফল',
            body: `ভার্চুয়াল কার্ড থেকে ৳${amountNum.toFixed(2)} সফলভাবে আপনার ওয়ালেটে জমা হয়েছে। নতুন ব্যালেন্স ৳${updatedReceiverBal.toFixed(2)} BDT।`,
            message: `ভার্চুয়াল কার্ড থেকে ৳${amountNum.toFixed(2)} সফলভাবে আপনার ওয়ালেটে জমা হয়েছে। নতুন ব্যালেন্স ৳${updatedReceiverBal.toFixed(2)} BDT।`,
            read: false,
            isPersonal: true,
            createdAt: nowIso
          })
        ]).catch((err) => console.error("Background card transfer error:", err));

        return;
      }

// Step 1: Find Card Owner
      const cleanCardNum = cardAddNum.replace(/\s+/g, '');
      let cardOwnerData: any = null;
      let cardOwnerUid = '';

      if (user.ambCardNumber && user.ambCardNumber.replace(/\s+/g, '') === cleanCardNum) {
        cardOwnerData = user;
        cardOwnerUid = user.uid;
      } else {
        let queryCardNum = cleanCardNum;
        if (cleanCardNum.length === 16) {
          queryCardNum = `${cleanCardNum.substring(0, 4)} ${cleanCardNum.substring(4, 8)} ${cleanCardNum.substring(8, 12)} ${cleanCardNum.substring(12, 16)}`;
        }

        const q = query(collection(db, 'users'), where('ambCardNumber', '==', queryCardNum), limit(1));
        const qFallback = query(collection(db, 'users'), where('ambCardNumber', '==', cleanCardNum), limit(1));

        const [snap, snapFallback] = await Promise.all([
          getDocs(q).catch(() => ({ empty: true, docs: [] } as any)),
          getDocs(qFallback).catch(() => ({ empty: true, docs: [] } as any))
        ]);

        if (!snap.empty && snap.docs.length > 0) {
          cardOwnerData = snap.docs[0].data();
          cardOwnerUid = snap.docs[0].id;
        } else if (!snapFallback.empty && snapFallback.docs.length > 0) {
          cardOwnerData = snapFallback.docs[0].data();
          cardOwnerUid = snapFallback.docs[0].id;
        }
      }

      if (!cardOwnerData || !cardOwnerUid) {
        setErrorMsg('ভুল ও নিষ্ক্রিয় কার্ড নম্বর! এই কার্ডটির কোনো অস্তিত্ব নেই।');
        setLoading(false);
        return;
      }

      if (cardAddCvv && cardOwnerData.ambCardCvv !== cardAddCvv.trim()) {
        setErrorMsg('ভুল CVV নম্বর! কার্ডের সঠিক 3 সংখ্যার CVV দিন।');
        setLoading(false);
        return;
      }

      const expInput = cardAddExpiry.trim() || (expiryMonth && expiryYear ? `${expiryMonth}/${expiryYear}` : '');
      if (expInput && cardOwnerData.ambCardExpiry !== expInput) {
        setErrorMsg('ভুল এক্সপায়ারি তারিখ! সঠিক MM/YY ফরম্যাটে দিন।');
        setLoading(false);
        return;
      }

      if (cardOwnerData.pin !== cardAddPin.trim()) {
        setErrorMsg('ভুল সিকিউরিটি পিন! সঠিক 4 সংখ্যার পিন প্রদান করুন।');
        setLoading(false);
        return;
      }

      if (cardOwnerData.ambCardStatus !== 'active') {
        setErrorMsg('দুঃখিত! এই কার্ডটি বর্তমানে লক বা নিষ্ক্রিয় রয়েছে।');
        setLoading(false);
        return;
      }

      const isOtpLocked = cardOwnerData.ambCardOtpLocked !== false;

      if (isOtpLocked) {
// Generate OTP & send instantly ⚡
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        setCardOtpCode(generatedOtp);
        setCardOtpSent(true);
        setValidatedCardOwnerData(cardOwnerData);
        setValidatedCardOwnerUid(cardOwnerUid);

        setSuccessMsg('কার্ড মালিকের ইন-অ্যাপ নোটিফিকেশন ও ভার্চুয়াল কার্ডে 6 সংখ্যার গোপন ওটিপি পাঠানো হয়েছে।');
        setLoading(false);

// Instant background update to Card Owner user document for <1 second real-time card overlay display
        const now = new Date();
        const formattedTime = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        const cardOwnerRef = doc(db, 'users', cardOwnerUid);
        updateDoc(cardOwnerRef, {
          activeCardOtp: generatedOtp,
          activeCardOtpAmount: amountNum,
          activeCardOtpRequester: user.name || user.phone || 'মেম্বার',
          activeCardOtpTime: now.toISOString()
        }).catch((err) => console.error("Error updating activeCardOtp on card owner doc:", err));

        addDoc(collection(db, 'user_notifications'), {
          userId: cardOwnerUid,
          title: '🔑 কার্ড পেমেন্ট ওটিপি (OTP Security Alert)',
          body: `আপনার ভার্চুয়াল কার্ড থেকে ৳${amountNum.toFixed(2)} মেম্বার ${user.name} (ID: ${user.memberId}) এর অ্যাকাউন্টে অ্যাডমানি করার জন্য রিকুয়েস্ট করা হয়েছে। ভেরিফিকেশন ওটিপি (OTP): ${generatedOtp}। তারিখ ও সময়: ${formattedTime}। পেমেন্ট সচল করতে এই 6 সংখ্যার ওটিপি দিন।`,
          message: `আপনার ভার্চুয়াল কার্ড থেকে ৳${amountNum.toFixed(2)} মেম্বার ${user.name} (ID: ${user.memberId}) এর অ্যাকাউন্টে অ্যাডমানি করার জন্য রিকুয়েস্ট করা হয়েছে। ভেরিফিকেশন ওটিপি (OTP): ${generatedOtp}। তারিখ ও সময়: ${formattedTime}। পেমেন্ট সচল করতে এই 6 সংখ্যার ওটিপি দিন।`,
          read: false,
          isPersonal: true,
          category: 'admin_msg',
          createdAt: now.toISOString()
        }).catch((err) => console.error("Error sending OTP notification:", err));

        return;
      }

// If OTP lock is OFF, process payment directly
      const freshOwnerBal = Number(cardOwnerData.balance || 0);
      if (freshOwnerBal < amountNum) {
        setErrorMsg(`কার্ড মালিকের অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই! (বর্তমান ব্যালেন্স ৳${freshOwnerBal.toLocaleString('bn-BD')} BDT)`);
        setLoading(false);
        return;
      }

      const updatedOwnerBal = freshOwnerBal - amountNum;
      const freshReceiverBal = Number(user.balance || 0);
      const updatedReceiverBal = freshReceiverBal + amountNum;

      user.balance = updatedReceiverBal;
      if (syncLiveProfile) syncLiveProfile();

      const generatedTxId = generateAmbTrxId('B');
      setReceiptModalData({
        typeLabel: 'ভার্চুয়াল কার্ড পে এডমানি',
        transactionId: generatedTxId,
        amount: amountNum,
        fee: 0,
        totalAmount: amountNum,
        status: 'success',
        beneficiaryName: user.name || 'AMB MEMBER',
        beneficiaryAccount: user.memberId || user.phone,
        senderPhone: cardOwnerData.phone || user.phone,
        transactionDate: new Date().toLocaleString('bn-BD', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true })
      });
      setIsReceiptOpen(true);
      setSuccessMsg(`অভিনন্দন! ৳${amountNum} টাকা কার্ড পেমেন্টের মাধ্যমে এডমানি সফলভাবে সম্পন্ন হয়েছে।`);

      setCardAddNum('');
      setCardAddExpiry('');
      setExpiryMonth('');
      setExpiryYear('');
      setCardAddCvv('');
      setCardAddPin('');
      setCardAddAmount('');
      setCardOtpSent(false);
      setCardOtpCode('');
      setUserEnteredOtp('');
      setValidatedCardOwnerData(null);
      setValidatedCardOwnerUid('');
      setLoading(false);

      const nowIso = new Date().toISOString();
      const ownerRef = doc(db, 'users', cardOwnerUid);
      const receiverRef = doc(db, 'users', user.uid);

      Promise.all([
        updateDoc(ownerRef, { balance: updatedOwnerBal, mainBalance: updatedOwnerBal }),
        updateDoc(receiverRef, { balance: updatedReceiverBal, mainBalance: updatedReceiverBal }),
        addDoc(collection(db, 'transactions'), {
          userId: cardOwnerUid,
          userName: cardOwnerData.name || 'Card Owner',
          userPhone: cardOwnerData.phone || '',
          memberId: cardOwnerData.memberId || '',
          amount: amountNum,
          postBalance: updatedOwnerBal,
          type: 'withdraw',
          typeLabel: 'কার্ড পেমেন্ট (ডেবিট)',
          status: 'success',
          paymentMethod: 'AMB Card',
          phone: user.phone,
          createdAt: nowIso,
          description: `মেম্বার ${user.name} (${user.memberId}) কে কার্ডের মাধ্যমে ৳${amountNum} ফান্ড পেমেন্ট`
        }),
        addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userName: user.name || '',
          userPhone: user.phone || '',
          memberId: user.memberId || '',
          amount: amountNum,
          postBalance: updatedReceiverBal,
          type: 'add_money',
          typeLabel: 'কার্ড এডমানি',
          status: 'success',
          paymentMethod: 'AMB Card',
          phone: cardOwnerData.phone || '',
          createdAt: nowIso,
          description: `কার্ড ${cardAddNum} (মালিক: ${cardOwnerData.name || 'AMB Card'}) থেকে ওয়ালেটে ৳${amountNum} এডমানি`
        }),
        addDoc(collection(db, 'user_notifications'), {
          userId: cardOwnerUid,
          title: '💸 কার্ড থেকে টাকা কর্তন (Debit Alert)',
          body: `আপনার ভার্চুয়াল কার্ড থেকে ৳${amountNum.toFixed(2)} কেটে নেওয়া হয়েছে মেম্বার ${user.name} (${user.memberId}) কে পরিশোধে। আপনার নতুন ব্যালেন্স ৳${updatedOwnerBal.toFixed(2)} BDT।`,
          message: `আপনার ভার্চুয়াল কার্ড থেকে ৳${amountNum.toFixed(2)} কেটে নেওয়া হয়েছে মেম্বার ${user.name} (${user.memberId}) কে পরিশোধে। আপনার নতুন ব্যালেন্স ৳${updatedOwnerBal.toFixed(2)} BDT।`,
          read: false,
          isPersonal: true,
          createdAt: nowIso
        }),
        addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          title: '💰 কার্ড এডমানি সফল',
          body: `ভার্চুয়াল কার্ড থেকে ৳${amountNum.toFixed(2)} সফলভাবে আপনার ওয়ালেটে জমা হয়েছে। নতুন ব্যালেন্স ৳${updatedReceiverBal.toFixed(2)} BDT।`,
          message: `ভার্চুয়াল কার্ড থেকে ৳${amountNum.toFixed(2)} সফলভাবে আপনার ওয়ালেটে জমা হয়েছে। নতুন ব্যালেন্স ৳${updatedReceiverBal.toFixed(2)} BDT।`,
          read: false,
          isPersonal: true,
          createdAt: nowIso
        })
      ]).catch((err) => console.error("Background card transfer error:", err));

    } catch (err: any) {
      console.error("Error doing card add money: ", err);
      setErrorMsg('কার্ড এডমানি সম্পন্ন করতে ব্যর্থ হয়েছে: ' + (err.message || 'নেটওয়ার্ক কানেকশন ফেইল্ড'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendMoneySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (user.ambCardStatus === 'inactive') {
      setErrorMsg('দুঃখিত! আপনার ভার্চুয়াল কার্ডটি লক বা নিষ্ক্রিয় রয়েছে। অনুগ্রহ করে কার্ড আনলক করুন।');
      return;
    }

    const amountNum = Number(sendAmount);
    if (!sendAmount || amountNum < 10) {
      setErrorMsg('সর্বনিম্ন স্থানান্তরের পরিমাণ 10 BDT হতে হবে।');
      return;
    }

// Calculate total required including charges for mobile bank or bank wallet channels
    let chargeTotal = 0;
    if (sendMoneyChannel === 'mobile_bank' || sendMoneyChannel === 'bank_wallet') {
      chargeTotal = chargeInfo.total;
    }
    const totalRequired = amountNum + chargeTotal;

    if (totalRequired > (user.balance || 0)) {
      setErrorMsg(`দুঃখিত! চার্জসহ মোট ৳${totalRequired.toLocaleString('bn-BD')} টাকা স্থানান্তরের জন্য আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।`);
      return;
    }
    if (securityPin !== user.pin) {
      setErrorMsg('ভুল সিকিউরিটি পিন! সঠিক 4 সংখ্যার পিন প্রদান করুন।');
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    let writesToRun: Promise<any>[] = [];

    if (sendMoneyChannel === 'amb') {
      if (!sendTargetId) {
        setErrorMsg('গ্রহীতা মেম্বার আইডি বা মোবাইল নম্বর প্রদান করুন।');
        return;
      }

      setLoading(true);
      try {
        const trimmedTarget = sendTargetId.trim();
        const basePhone = (trimmedTarget.length === 12 && trimmedTarget.endsWith('0'))
          ? trimmedTarget.slice(0, 11)
          : trimmedTarget;

        const trimmedDigits = trimmedTarget.replace(/\D/g, '');
        const isSamityAutoAcc = trimmedDigits.length === 12 && trimmedDigits.endsWith('0');

        const qMemberId = query(collection(db, 'users'), where('memberId', '==', trimmedTarget), limit(1));
        const qPhone = query(collection(db, 'users'), where('phone', '==', trimmedTarget), limit(1));
        const qBasePhone = query(collection(db, 'users'), where('phone', '==', basePhone), limit(1));

        const [snap1, snap2, snap3] = await Promise.all([
          getDocs(qMemberId).catch(() => ({ empty: true, docs: [] } as any)),
          getDocs(qPhone).catch(() => ({ empty: true, docs: [] } as any)),
          getDocs(qBasePhone).catch(() => ({ empty: true, docs: [] } as any))
        ]);

        let targetDoc = !snap1.empty ? snap1.docs[0] : (!snap2.empty ? snap2.docs[0] : (!snap3.empty ? snap3.docs[0] : null));

        if (!targetDoc) {
          setErrorMsg('গ্রহীতা মেম্বার খুঁজে পাওয়া যায়নি! সঠিক মেম্বার আইডি বা 12-সংখ্যার নম্বর দিন।');
          setLoading(false);
          return;
        }

        const receiverUid = targetDoc.id;
        const receiverData = targetDoc.data();

        if (receiverUid === user.uid && !isSamityAutoAcc) {
          setErrorMsg('আপনি নিজের অ্যাকাউন্টে সেন্ড মানি করতে পারবেন না।');
          setLoading(false);
          return;
        }

        const senderRef = doc(db, 'users', user.uid);
        const receiverRef = doc(db, 'users', receiverUid);

        let finalSenderBal = 0;
        let finalReceiverBal = 0;

        const selMonthObj = SAMITY_MONTH_LIST.find(m => m.id === sendSelectedMonth) || SAMITY_MONTH_LIST[0];

        await runTransaction(db, async (transaction) => {
          const senderSnap = await transaction.get(senderRef);
          const receiverSnap = await transaction.get(receiverRef);

          if (!senderSnap.exists() || !receiverSnap.exists()) {
            throw new Error('মেম্বার একাউন্ট তথ্য খুঁজে পাওয়া যায়নি।');
          }

          const sData = senderSnap.data();
          const rData = receiverSnap.data();

          const currentSenderBal = getEffectiveBalance(sData);
          if (currentSenderBal < totalRequired) {
            throw new Error(`পর্যাপ্ত ওয়ালেট ব্যালেন্স নেই! প্রয়োজন ৳ ${totalRequired.toLocaleString('bn-BD')} BDT।`);
          }

          finalSenderBal = currentSenderBal - totalRequired;
          transaction.update(senderRef, { balance: finalSenderBal, mainBalance: finalSenderBal });

          if (isSamityAutoAcc) {
// Deposit directly into receiver's Samity Savings Fund
            const finalReceiverSavings = (Number(rData.savings) || 0) + amountNum;
            const currentPaidMonths = rData.samityPaidMonths || [];
            const targetRate = Number(rData.monthlySavingsTarget) || 1000;
            const updatedPaidMonths = normalizePaidMonthsArray([...currentPaidMonths, sendSelectedMonth], finalReceiverSavings, targetRate);

            transaction.update(receiverRef, {
              savings: finalReceiverSavings,
              dpsBalance: finalReceiverSavings,
              samityPaidMonths: updatedPaidMonths
            });

            finalReceiverBal = getEffectiveBalance(rData);

            const txSenderRef = doc(collection(db, 'transactions'));
            const txReceiverRef = doc(collection(db, 'transactions'));
            const notifReceiverRef = doc(collection(db, 'user_notifications'));

            transaction.set(txSenderRef, {
              userId: user.uid,
              userName: user.name || '',
              userPhone: user.phone || '',
              memberId: user.memberId || '',
              amount: amountNum,
              charge: chargeTotal,
              totalDeducted: totalRequired,
              postBalance: finalSenderBal,
              type: 'transfer',
              typeLabel: `সমিতি অটো সঞ্চয় স্থানান্তের (${selMonthObj.name})`,
              status: 'success',
              paymentMethod: 'AMB 12-Digit Auto Funding',
              phone: rData.phone || sendTargetId,
              createdAt: new Date().toISOString(),
              description: `মেম্বার ${rData.name || ''} (${rData.memberId || ''})-এর 12-সংখ্যার অটো অ্যাকাউন্টে ${selMonthObj.name} মাসের সমিতি সঞ্চয় ৳${amountNum.toLocaleString('bn-BD')} জমা সফল`
            });

            transaction.set(txReceiverRef, {
              userId: receiverUid,
              userName: rData.name || '',
              userPhone: rData.phone || '',
              memberId: rData.memberId || '',
              amount: amountNum,
              postBalance: finalReceiverSavings,
              type: 'samity_deposit',
              typeLabel: `সমিতি অটো সঞ্চয় জমা (${selMonthObj.name})`,
              status: 'approved',
              paymentMethod: 'AMB 12-Digit Auto Funding',
              phone: user.phone,
              createdAt: new Date().toISOString(),
              description: `মেম্বার ${user.name} (${user.phone}) কর্তৃক 12-সংখ্যার অটো একাউন্টের মাধ্যমে ${selMonthObj.name} মাসের সমিতি সঞ্চয় ৳${amountNum.toLocaleString('bn-BD')} জমা প্রাপ্তি`
            });

            transaction.set(notifReceiverRef, {
              userId: receiverUid,
              title: `✅ ${selMonthObj.name} মাসের সমিতি সঞ্চয় জমা প্রাপ্তি`,
              body: `আপনার 12-সংখ্যার অটো নম্বর (${trimmedTarget}) এ ${user.name} (${user.phone}) কর্তৃক ${selMonthObj.name} মাসের সঞ্চয় ৳${amountNum.toLocaleString('bn-BD')} জমা হয়েছে।`,
              read: false,
              isPersonal: true,
              isTransactionHistory: true,
              category: 'transaction',
              createdAt: new Date().toISOString()
            });

          } else {
// Standard wallet send money
            finalReceiverBal = getEffectiveBalance(rData) + amountNum;
            transaction.update(receiverRef, { balance: finalReceiverBal, mainBalance: finalReceiverBal });

            const txSenderRef = doc(collection(db, 'transactions'));
            const txReceiverRef = doc(collection(db, 'transactions'));
            const notifReceiverRef = doc(collection(db, 'user_notifications'));

            transaction.set(txSenderRef, {
              userId: user.uid,
              userName: user.name || '',
              userPhone: user.phone || '',
              memberId: user.memberId || '',
              amount: amountNum,
              charge: chargeTotal,
              totalDeducted: totalRequired,
              postBalance: finalSenderBal,
              type: 'transfer',
              typeLabel: 'AMB সেন্ড মানি',
              status: 'success',
              paymentMethod: 'AMB Transfer',
              phone: rData.phone || sendTargetId,
              createdAt: new Date().toISOString(),
              description: `মেম্বার ${rData.name || ''} (${rData.memberId || ''}) কে ৳${amountNum.toLocaleString('bn-BD')} সেন্ড মানি সফল`
            });

            transaction.set(txReceiverRef, {
              userId: receiverUid,
              userName: rData.name || '',
              userPhone: rData.phone || '',
              memberId: rData.memberId || '',
              amount: amountNum,
              postBalance: finalReceiverBal,
              type: 'add_money',
              typeLabel: 'AMB সেন্ড মানি লাভ',
              status: 'success',
              paymentMethod: 'AMB Transfer',
              phone: user.phone,
              createdAt: new Date().toISOString(),
              description: `মেম্বার ${user.name} (${user.memberId}) থেকে ৳${amountNum.toLocaleString('bn-BD')} সেন্ড মানি প্রাপ্তি`
            });

            transaction.set(notifReceiverRef, {
              userId: receiverUid,
              title: '💸 টাকা গ্রহণ সফল (Money Received)',
              body: `You have received Tk ${amountNum.toFixed(2)} from ${user.phone || ''} (${user.name}). Balance Tk ${finalReceiverBal.toFixed(2)}.`,
              read: false,
              createdAt: new Date().toISOString()
            });
          }
        });

        user.balance = finalSenderBal;
        if (syncLiveProfile) syncLiveProfile();

        const generatedTxId = generateAmbTrxId('BN');
        setSuccessMsg('আপনার সেন্ড মানি লেনদেন সফলভাবে সম্পন্ন হয়েছে!');
        setReceiptModalData({
          typeLabel: 'AMB সেন্ড মানি',
          transactionId: generatedTxId,
          amount: amountNum,
          fee: chargeTotal,
          totalAmount: totalRequired,
          status: 'success',
          beneficiaryName: receiverData.name || 'AMB MEMBER',
          beneficiaryAccount: receiverData.memberId || receiverData.phone || sendTargetId,
          senderPhone: user.phone,
          transactionDate: new Date().toLocaleString('bn-BD', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true })
        });
        setIsReceiptOpen(true);
        setSendTargetId('');
        setSendAmount('');
        setSecurityPin('');
        setLoading(false);
        return;
      } catch (err: any) {
        setErrorMsg('সেন্ড মানি করতে ব্যর্থ হয়েছে: ' + err.message);
        setLoading(false);
        return;
      }
    } else if (sendMoneyChannel === 'mobile_bank') {
      if (!selectedMobileOp) {
        setErrorMsg('দয়া করে অপারেটর সিলেক্ট করুন।');
        return;
      }
      if (!sendTargetNumber) {
        setErrorMsg('গ্রহীতা মোবাইল ওয়ালেট নম্বর দিন।');
        return;
      }

      let opName = '';
      let opType = '';
      if (selectedMobileOp.startsWith('bkash')) { opName = 'BKASH'; }
      else if (selectedMobileOp.startsWith('nagad')) { opName = 'NAGAD'; }
      else if (selectedMobileOp.startsWith('rocket')) { opName = 'ROCKET'; }
      else if (selectedMobileOp.startsWith('upay')) { opName = 'UPAY'; }

      if (selectedMobileOp.endsWith('cashout')) { opType = 'ক্যাশ আউট'; }
      else { opType = 'সেন্ড মানি'; }

      const paymentMethodString = `${opName} (${opType === 'ক্যাশ আউট' ? 'CashOut' : 'SendMoney'})`;
      const descString = `${opName === 'BKASH' ? 'বিকাশ' : opName === 'NAGAD' ? 'নগদ' : opName === 'ROCKET' ? 'রকেট' : 'উপায়'} নম্বরে (${sendTargetNumber}) ৳${amountNum.toLocaleString('bn-BD')} ${opType} স্থানান্তর আবেদন`;

      const finalBal = (user.balance || 0) - totalRequired;
      user.balance = finalBal; // Optimistic balance update ⚡
      user.mainBalance = finalBal;

      writesToRun.push(
        updateDoc(userRef, { balance: finalBal, mainBalance: finalBal }),
        addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userName: user.name || '',
          userPhone: user.phone || '',
          memberId: user.memberId || '',
          amount: amountNum,
          charge: chargeTotal,
          totalDeducted: totalRequired,
          postBalance: finalBal,
          type: 'withdraw',
          typeLabel: 'উইথড্র / ক্যাশআউট',
          status: 'pending',
          paymentMethod: paymentMethodString,
          phone: sendTargetNumber,
          senderPhone: sendTargetNumber,
          accountNumber: sendTargetNumber,
          accountTitle: user.name || '',
          accountName: user.name || '',
          createdAt: new Date().toISOString(),
          description: `${opName === 'BKASH' ? 'বিকাশ' : opName === 'NAGAD' ? 'নগদ' : opName === 'ROCKET' ? 'রকেট' : 'উপায়'} (${sendTargetNumber}) নম্বরে ৳${amountNum.toLocaleString('bn-BD')} ${opType} স্থানান্তর আবেদন`
        }),
        addDoc(collection(db, 'admin_notifications'), {
          title: '💸 নতুন মোবাইল ক্যাশআউট / উইথড্র আবেদন',
          message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ${paymentMethodString} মাধ্যমে ৳${amountNum.toLocaleString('bn-BD')} টাকা ক্যাশআউট আবেদন করেছেন (নম্বর: ${sendTargetNumber})।`,
          userId: user.uid,
          userName: user.name || '',
          memberId: user.memberId || '',
          userPhone: user.phone || '',
          amount: amountNum,
          type: 'withdraw',
          read: false,
          createdAt: new Date().toISOString()
        }).catch(e => console.warn('Admin notif error:', e))
      );
    } else if (sendMoneyChannel === 'bank_wallet') {
      if (!selectedBankOp) {
        setErrorMsg('দয়া করে ব্যাংক সিলেক্ট করুন।');
        return;
      }
      const allBanks = appConfig?.paymentBanks || [];
      const selectedBankObj = allBanks.find(b => b.id === selectedBankOp);
      let selectedBankNameFull = selectedBankObj ? selectedBankObj.name : 'Dutch-Bangla Bank PLC. (DBBL)';
      if (!selectedBankObj) {
        if (selectedBankOp === 'dbbl') selectedBankNameFull = 'Dutch-Bangla Bank PLC. (DBBL)';
        else if (selectedBankOp === 'sonali') selectedBankNameFull = 'Sonali Bank PLC.';
        else if (selectedBankOp === 'islami') selectedBankNameFull = 'Islami Bank Bangladesh PLC.';
        else if (selectedBankOp === 'city') selectedBankNameFull = 'City Bank PLC.';
        else if (selectedBankOp === 'brac') selectedBankNameFull = 'BRAC Bank PLC.';
        else if (selectedBankOp === 'pubali') selectedBankNameFull = 'Pubali Bank PLC.';
      }

      if (!sendAccNo || !sendAccTitle) {
        setErrorMsg('হিসাব নম্বর এবং হিসাবের নাম আবশ্যক।');
        return;
      }

      const finalBal = (user.balance || 0) - totalRequired;
      user.balance = finalBal; // Optimistic balance update ⚡
      user.mainBalance = finalBal;

      writesToRun.push(
        updateDoc(userRef, { balance: finalBal, mainBalance: finalBal }),
        addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userName: user.name || '',
          userPhone: user.phone || '',
          memberId: user.memberId || '',
          amount: amountNum,
          charge: chargeTotal,
          totalDeducted: totalRequired,
          postBalance: finalBal,
          type: 'withdraw',
          typeLabel: 'উইথড্র / ক্যাশআউট',
          status: 'pending',
          paymentMethod: `Bank Transfer - ${selectedBankNameFull}`,
          bankName: selectedBankNameFull,
          accountTitle: sendAccTitle,
          accountName: sendAccTitle,
          accountHolder: sendAccTitle,
          accountNumber: sendAccNo,
          branch: sendBranch || '',
          branchName: sendBranch || '',
          routingNumber: sendRouting || '',
          routingNo: sendRouting || '',
          phone: sendAccNo,
          senderPhone: sendAccNo,
          createdAt: new Date().toISOString(),
          description: `Bank Transfer - ${selectedBankNameFull} | অ্যাকাউন্টের নাম: ${sendAccTitle} | অ্যাকাউন্ট নম্বর: ${sendAccNo}${sendBranch ? ` | শাখা: ${sendBranch}` : ''}${sendRouting ? ` | Routing Number: ${sendRouting}` : ''}`
        }),
        addDoc(collection(db, 'admin_notifications'), {
          title: '🏛️ নতুন ব্যাংক ট্রান্সফার / উইথড্র আবেদন',
          message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ${selectedBankNameFull} অ্যাকাউন্টে ৳${amountNum.toLocaleString('bn-BD')} টাকা উইথড্র আবেদন করেছেন (হিসাব: ${sendAccNo})।`,
          userId: user.uid,
          userName: user.name || '',
          memberId: user.memberId || '',
          userPhone: user.phone || '',
          amount: amountNum,
          type: 'withdraw',
          read: false,
          createdAt: new Date().toISOString()
        }).catch(e => console.warn('Admin notif error:', e)),
      );
    } else if (sendMoneyChannel === 'abroad') {
      if (!selectedBankOp) {
        setErrorMsg('দয়া করে বিদেশি ব্যাংক সিলেক্ট করুন।');
        return;
      }
      const allBanks = appConfig?.paymentBanks || [];
      const selectedBankObj = allBanks.find(b => b.id === selectedBankOp);
      let selectedBankNameFull = selectedBankObj ? selectedBankObj.name : (sendBankName || 'Foreign Bank Transfer');

      if (!sendAccNo || !sendAccTitle) {
        setErrorMsg('গ্রহীতার একাউন্ট নম্বর/আইবান এবং নাম আবশ্যক।');
        return;
      }

      const finalBal = (user.balance || 0) - totalRequired;
      user.balance = finalBal; // Optimistic balance update ⚡
      user.mainBalance = finalBal;

      writesToRun.push(
        updateDoc(userRef, { balance: finalBal, mainBalance: finalBal }),
        addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userName: user.name || '',
          userPhone: user.phone || '',
          memberId: user.memberId || '',
          amount: amountNum,
          charge: chargeTotal,
          totalDeducted: totalRequired,
          postBalance: finalBal,
          type: 'remittance',
          typeLabel: 'রেমিট্যান্স / বিদেশি ব্যাংক স্থানান্তর',
          status: 'pending',
          paymentMethod: `Foreign Bank Transfer - ${selectedBankNameFull}`,
          bankName: selectedBankNameFull,
          accountTitle: sendAccTitle,
          accountName: sendAccTitle,
          accountHolder: sendAccTitle,
          accountNumber: sendAccNo,
          branch: sendBranch || '',
          branchName: sendBranch || '',
          routingNumber: sendRouting || '',
          routingNo: sendRouting || '',
          phone: sendAccNo,
          senderPhone: sendAccNo,
          createdAt: new Date().toISOString(),
          description: `Foreign Bank Transfer - ${selectedBankNameFull} | অ্যাকাউন্টের নাম: ${sendAccTitle} | অ্যাকাউন্ট নম্বর: ${sendAccNo}${sendBranch ? ` | শাখা: ${sendBranch}` : ''}${sendRouting ? ` | Routing Number: ${sendRouting}` : ''}`
        })
      );
    }

    writesToRun.push(
      addDoc(collection(db, 'user_notifications'), {
        userId: user.uid,
        title: 'ফান্ড স্থানান্তর আবেদন সাবমিট হয়েছে',
        message: `আপনার ৳${amountNum.toLocaleString('bn-BD')} এর সেন্ড মানি আবেদনটি সফলভাবে সাবমিট হয়েছে (চার্জসহ মোট ৳${totalRequired.toLocaleString('bn-BD')} ওয়ালেট হতে কেটে নেওয়া হয়েছে)। এডমিন অনুমোদন করলে সম্পন্ন হবে।`,
        read: false,
        createdAt: new Date().toISOString()
      })
    );

    const generatedTxId = generateAmbTrxId('BN');

    setLoading(true);
    try {
      await Promise.all(writesToRun);

      setSuccessMsg('আপনার লেনদেন আবেদনটি সফলভাবে সাবমিট হয়েছে!');
      setReceiptModalData({
        typeLabel: sendMoneyChannel === 'mobile_bank' ? 'এমএফএস ক্যাশ আউট / সেন্ড মানি' : sendMoneyChannel === 'bank_wallet' ? 'বাংলাদেশি ব্যাংক ওয়ালেট ট্রান্সফার' : 'বিদেশি ব্যাংক রেমিট্যান্স ট্রান্সফার',
        transactionId: generatedTxId,
        amount: amountNum,
        fee: chargeTotal,
        totalAmount: totalRequired,
        status: 'pending',
        beneficiaryName: sendAccTitle || sendTargetId || sendTargetNumber || 'BENEFICIARY ACCOUNT',
        beneficiaryAccount: sendTargetNumber || sendAccNo || sendTargetId || 'N/A',
        senderPhone: sendTargetNumber || sendAccNo || user.phone,
        transactionDate: new Date().toLocaleString('bn-BD', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true })
      });
      setIsReceiptOpen(true);
      setSendAmount('');
      setSendTargetId('');
      setSendTargetNumber('');
      setSendAccNo('');
      setSendAccTitle('');
      setSendBranch('');
      setSendRouting('');
      setSendWhatsapp('');
      setSecurityPin('');

      if (syncLiveProfile) syncLiveProfile();
    } catch (err: any) {
      console.error("Send money submit error:", err);
      setErrorMsg('লেনদেন সাবমিট করতে সমস্যা হয়েছে: ' + (err?.message || 'অনুগ্রহ করে পুনরায় চেষ্টা করুন'));
    } finally {
      setLoading(false);
    }
  };

  const handleBillPaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (user.ambCardStatus === 'inactive') {
      setErrorMsg('দুঃখিত! আপনার ভার্চুয়াল কার্ডটি লক বা নিষ্ক্রিয় রয়েছে। অনুগ্রহ করে কার্ড আনলক করুন।');
      return;
    }

    const amountNum = Number(billAmount);
    if (!selectedBillProvider) {
      setErrorMsg('অনুগ্রহ করে একটি বিল প্রদানকারী প্রতিষ্ঠান নির্বাচন করুন।');
      return;
    }
    if (!billAccNo) {
      setErrorMsg('বিল একাউন্ট / মিটার / কাস্টমার নম্বর দিন।');
      return;
    }
    if (!billAmount || amountNum <= 0) {
      setErrorMsg('সঠিক টাকার পরিমাণ দিন।');
      return;
    }
    if (securityPin !== user.pin) {
      setErrorMsg('ভুল সিকিউরিটি পিন! সঠিক 4 সংখ্যার পিন প্রদান করুন।');
      return;
    }

     // Instant zero-delay response ⚡
    setSuccessMsg('আপনার বিল পেমেন্ট রিকোয়েস্ট সফলভাবে সাবমিট হয়েছে!');
    setBillAmount('');
    setBillAccNo('');
    setBillImage('');
    setSelectedBillProvider(null);
    setSecurityPin('');

    Promise.all([
      addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userName: user.name || '',
        userPhone: user.phone || '',
        memberId: user.memberId || '',
        amount: amountNum,
        type: 'bill_pay',
        typeLabel: 'ইউটিলিটি বিল',
        status: 'pending',
        paymentMethod: selectedBillProvider.name,
        phone: billAccNo,
        billImage: billImage || '',
        createdAt: new Date().toISOString(),
        description: `${selectedBillProvider.label} (${billAccNo}) এর ${billMonth} মাসের বিল ৳${amountNum.toLocaleString('bn-BD')} পরিশোধের আবেদন (পেন্ডিং)`
      }),
      addDoc(collection(db, 'admin_notifications'), {
        title: '⚡ নতুন ইউটিলিটি বিল পে আবেদন',
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ${selectedBillProvider.name} এর ৳${amountNum.toLocaleString('bn-BD')} টাকা বিল পেমেন্ট রিকোয়েস্ট করেছেন (হিসাব/মিটার: ${billAccNo})।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        userPhone: user.phone || '',
        amount: amountNum,
        type: 'bill_pay',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e)),
      addDoc(collection(db, 'user_notifications'), {
        userId: user.uid,
        title: 'বিল পেমেন্ট রিকোয়েস্ট সাবমিট হয়েছে',
        message: `${selectedBillProvider.label} এর ৳${amountNum.toLocaleString('bn-BD')} বিল পরিশোধের রিকোয়েস্টটি সাবমিট হয়েছে। এডমিন ভেরিফাই করে পে করবে।`,
        read: false,
        createdAt: new Date().toISOString()
      })
    ]).then(() => {
      if (syncLiveProfile) syncLiveProfile();
    }).catch((err) => {
      console.error("Background bill pay error:", err);
    });
  };

   // Bill Providers static data list
  const billProviders = [
    // Electricity
    { id: 'palli_bidyut_prepaid', name: 'Palli Bidyut Prepaid', label: 'পল্লী বিদ্যুৎ (প্রিপেইড)', enLabel: 'Palli Bidyut (Prepaid)', category: 'electricity', iconColor: 'bg-pink-100 text-pink-600' },
    { id: 'palli_bidyut_postpaid', name: 'Palli Bidyut Postpaid', label: 'পল্লী বিদ্যুৎ (পোস্টপেইড)', enLabel: 'Palli Bidyut (Postpaid)', category: 'electricity', iconColor: 'bg-pink-100 text-pink-600' },
    { id: 'desco_prepaid', name: 'DESCO Prepaid', label: 'ডেসকো (প্রিপেইড)', enLabel: 'DESCO (Prepaid)', category: 'electricity', iconColor: 'bg-amber-100 text-amber-600' },
    { id: 'desco_postpaid', name: 'DESCO Postpaid', label: 'ডেসকো (পোস্টপেইড)', enLabel: 'DESCO (Postpaid)', category: 'electricity', iconColor: 'bg-amber-100 text-amber-600' },
    { id: 'dpdc_prepaid', name: 'DPDC Prepaid', label: 'ডিপিডিসি (প্রিপেইড)', enLabel: 'DPDC (Prepaid)', category: 'electricity', iconColor: 'bg-emerald-100 text-emerald-600' },
    { id: 'dpdc_postpaid', name: 'DPDC Postpaid', label: 'ডিপিডিসি (পোস্টপেইড)', enLabel: 'DPDC (Postpaid)', category: 'electricity', iconColor: 'bg-emerald-100 text-emerald-600' },
    { id: 'nesco_prepaid', name: 'NESCO Prepaid', label: 'নেসকো (প্রিপেইড)', enLabel: 'NESCO (Prepaid)', category: 'electricity', iconColor: 'bg-indigo-100 text-indigo-600' },
    { id: 'nesco_postpaid', name: 'NESCO Postpaid', label: 'নেসকো (পোস্টপেইড)', enLabel: 'NESCO (Postpaid)', category: 'electricity', iconColor: 'bg-indigo-100 text-indigo-600' },
    { id: 'wzpdcl_prepaid', name: 'WZPDCL Prepaid', label: 'ওজোপাডিকো (প্রিপেইড)', enLabel: 'WZPDCL (Prepaid)', category: 'electricity', iconColor: 'bg-cyan-100 text-cyan-600' },
    { id: 'wzpdcl_postpaid', name: 'WZPDCL Postpaid', label: 'ওজোপাডিকো (পোস্টপেইড)', enLabel: 'WZPDCL (Postpaid)', category: 'electricity', iconColor: 'bg-cyan-100 text-cyan-600' },

    // Gas
    { id: 'titas', name: 'Titas Gas', label: 'তিতাস গ্যাস বিল', enLabel: 'Titas Gas Bill', category: 'gas', iconColor: 'bg-rose-100 text-rose-600' },
    { id: 'jalalabad', name: 'Jalalabad Gas', label: 'জালালাবাদ গ্যাস বিল', enLabel: 'Jalalabad Gas Bill', category: 'gas', iconColor: 'bg-rose-100 text-rose-600' },
    { id: 'karnaphuli', name: 'Karnaphuli Gas', label: 'কর্ণফুলী গ্যাস বিল', enLabel: 'Karnaphuli Gas Bill', category: 'gas', iconColor: 'bg-rose-100 text-rose-600' },

    // Water
    { id: 'dhaka_wasa', name: 'Dhaka WASA', label: 'ঢাকা ওয়াসা পানি বিল', enLabel: 'Dhaka WASA Water Bill', category: 'water', iconColor: 'bg-blue-100 text-blue-600' },
    { id: 'ctg_wasa', name: 'Ctg WASA', label: 'চট্টগ্রাম ওয়াসা পানি বিল', enLabel: 'Ctg WASA Water Bill', category: 'water', iconColor: 'bg-blue-100 text-blue-600' },

    // Internet
    { id: 'link3', name: 'Link3', label: 'Link3 ইন্টারনেট বিল', enLabel: 'Link3 Internet Bill', category: 'internet', iconColor: 'bg-purple-100 text-purple-600' },
    { id: 'amber_it', name: 'Amber IT', label: 'Amber IT ইন্টারনেট বিল', enLabel: 'Amber IT Internet Bill', category: 'internet', iconColor: 'bg-purple-100 text-purple-600' },
    { id: 'carnival', name: 'Carnival', label: 'Carnival ইন্টারনেট বিল', enLabel: 'Carnival Internet Bill', category: 'internet', iconColor: 'bg-purple-100 text-purple-600' },

     // Cable TV
    { id: 'akash_dth', name: 'Akash DTH', label: 'আকাশ DTH ক্যাবল বিল', enLabel: 'Akash DTH Cable Bill', category: 'tv', iconColor: 'bg-fuchsia-100 text-fuchsia-600' },

    // Telephone
    { id: 'btcl', name: 'BTCL', label: 'BTCL ল্যান্ডলাইন বিল', enLabel: 'BTCL Landline Bill', category: 'telephone', iconColor: 'bg-teal-100 text-teal-600' }
  ];

  const filteredBillProviders = billProviders.filter(
    p => p.category === billCategory && (
      p.label.toLowerCase().includes(billSearchQuery.toLowerCase()) ||
      (p.enLabel && p.enLabel.toLowerCase().includes(billSearchQuery.toLowerCase()))
    )
  );

  const renderDashboard = () => (
    <div className="space-y-4">
      {/* Wallet Balance Card */}
      <div className="bg-radial from-[#024033] via-[#012f25] to-[#001e17] border border-emerald-500/25 p-5 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-wider">AMB সমবায় ব্যাংক লিঃ</p>
            <h2 className="text-md font-extrabold text-white">Al Mayadin Bazar Portal</h2>
          </div>
          <div className="bg-white/10 border border-white/5 px-2.5 py-1 rounded-full text-[9px] flex items-center gap-1.5 text-slate-100 font-mono font-black">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ID: {user.memberId || 'AMB00000000'}
          </div>
        </div>
        <p className="text-slate-300/80 text-[10px] font-bold">মেইন ওয়ালেট ব্যালেন্স (WALLET BALANCE)</p>
        <p className="text-3xl font-extrabold mb-5 text-white tracking-wide font-mono">
          ৳ {(user.balance || 0).toLocaleString('bn-BD')} <span className="text-sm font-sans font-medium text-emerald-400">BDT</span>
        </p>
        <button 
          onClick={() => setActiveTab('add_money')} 
          className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
        >
          <PlusCircle className="w-4 h-4 text-emerald-100" /> অ্যাড মানি ফান্ড (ADD MONEY)
        </button>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="bg-white border border-slate-150 rounded-2.5xl p-4 shadow-xs grid grid-cols-3 gap-2 text-slate-800 text-center">
        {[
          { id: 'dashboard', label: 'হোম ড্যাশ', icon: <Home className="w-5 h-5 text-emerald-800" />, isImg: false },
          { 
            id: 'amb_to_amb', 
            label: 'AMB to AMB', 
            icon: appConfig?.ambToAmbIconUrl ? (
              <img src={appConfig.ambToAmbIconUrl} className="w-5 h-5 object-cover rounded" alt="AMB to AMB" referrerPolicy="no-referrer" />
            ) : (
              <PlusCircle className="w-5 h-5 text-indigo-700" />
            ),
            isImg: !!appConfig?.ambToAmbIconUrl
          },
          { id: 'send_money', label: 'সেন্ড মানি', icon: <Send className="w-5 h-5 text-cyan-700" />, isImg: false }
        ].map((item, idx) => (
          <button 
            key={`${item.id}-${idx}`}
            onClick={() => setActiveTab(item.id as any)} 
            className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition cursor-pointer active:scale-95 ${activeTab === item.id ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
          >
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-2xs border ${activeTab === item.id ? 'bg-indigo-900 border-indigo-950 text-white' : 'bg-slate-100 border-slate-200 text-slate-750'}`}>
              {item.isImg ? (
                item.icon
              ) : (
                React.cloneElement(item.icon as React.ReactElement<any>, { className: activeTab === item.id ? 'text-white w-5 h-5' : (item.icon as any).props?.className })
              )}
            </div>
            <span className={`text-[10px] font-black tracking-tight leading-tight ${activeTab === item.id ? 'text-indigo-950 font-extrabold' : 'text-slate-650'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Global Foreign Remittance Rate Khata */}
      <div className="bg-white border border-slate-150 rounded-2.5xl p-4.5 shadow-xs text-slate-800 text-left space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
            <Globe className="w-4.5 h-4.5 text-emerald-700 animate-spin" style={{ animationDuration: '8s' }} /> 
            গ্লোবাল ফরেইন রেমিট্যান্স রেট খাতা
          </h3>
        </div>
        
        {/* Horizontal scrollable row, fits 4 in view or slides smoothly */}
        <div className="flex overflow-x-auto gap-2.5 pb-1 scrollbar-none snap-x touch-pan-x">
          {remittanceRates.map((rate, i) => (
            <div 
              key={rate.id || i} 
              className="min-w-[110px] max-w-[110px] flex-shrink-0 bg-slate-50 border border-slate-200/80 rounded-2.5xl p-3 flex flex-col items-center justify-between transition hover:bg-slate-100 text-center snap-start shadow-3xs"
            >
              <span className="text-xl mb-1 block leading-none">{rate.flag}</span>
              <div className="space-y-0.5">
                <span className="text-[9.5px] font-black text-slate-705 truncate block max-w-full">{rate.name}</span>
                <span className="text-[8.5px] text-slate-400 block font-sans leading-none">{rate.multiplier || '1 একক'}</span>
              </div>
              <div className="mt-1.5 pt-1 border-t border-slate-150 w-full">
                <span className="text-[11px] font-black font-mono text-emerald-800">৳ {(Number(rate.value) || 0).toFixed(2)}</span>
              </div>
            </div>
          ))}
          {remittanceRates.length === 0 && (
            <div className="w-full text-center py-4 text-slate-400 text-xs italic">কোনো লাইভ রেট নেই</div>
          )}
        </div>

        {/* Action Link to see all live rates and convert */}
        <button 
          onClick={() => setIsMoreRatesOpen(true)}
          className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-[11px] font-black text-emerald-800 transition flex items-center justify-center gap-1.5 shadow-3xs"
        >
          <span>অন্যান্য সব দেশের লাইভ রেট দেখুন এবং টাকা তুলুন →</span>
        </button>
      </div>

      {/* 🌟 AMB লেনদেনের প্রধান সুবিধাসমূহ ও নিয়মাবলী */}
      <div className="bg-[#0B1528] p-4.5 rounded-3xl border border-slate-800 space-y-4">
        {/* Three Pill Badges */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#E6F4EA] rounded-full py-2.5 px-1 text-center flex flex-col justify-center items-center shadow-md border border-emerald-500/20">
            <span className="text-[8.5px] font-black text-[#137333] leading-none mb-0.5">AMB অ্যাপস থেকে ব্যাংকে নিতে</span>
            <span className="text-[10px] sm:text-xs font-black text-[#137333] font-sans tracking-tight">
              হাজারে {(appConfig?.sendMoneyBankServiceChargePerThousand ?? 7.90).toFixed(2)}
            </span>
          </div>
          <div className="bg-[#FEF7E0] rounded-full py-2.5 px-1 text-center flex flex-col justify-center items-center shadow-md border border-amber-500/20">
            <span className="text-[8.5px] font-black text-[#B06000] leading-none mb-0.5">ব্যাংক থেকে এডমানি বোনাস</span>
            <span className="text-[10px] sm:text-xs font-black text-[#B06000] font-sans tracking-tight">
              হাজারে {(appConfig?.addMoneyBankCashbackPerThousand ?? 5).toFixed(2)}
            </span>
          </div>
          <div className="bg-[#E8F0FE] rounded-full py-2.5 px-1 text-center flex flex-col justify-center items-center shadow-md border border-indigo-500/20">
            <span className="text-[8.5px] font-black text-[#1A73E8] leading-none mb-0.5">AMB to AMB ফি</span>
            <span className="text-[10px] sm:text-xs font-black text-[#1A73E8]">সম্পূর্ণ ফ্রি</span>
          </div>
        </div>

        {/* Outer Box */}
        <div className="bg-[#F3F6F5] border border-slate-200 rounded-3xl p-4.5 text-left space-y-4 shadow-inner">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <span className="text-amber-500 text-sm">🌟</span>
            <span>MY AMB লেনদেনের প্রধান সুবিধা এবং নিয়ম কানুন</span>
          </h3>

          <div className="space-y-4 text-[10px] font-bold text-slate-800 leading-relaxed font-sans">
            <div>
              <h4 className="font-black text-[#136151] mb-1">📥 Add Money</h4>
              <p className="text-slate-800">1. মোবাইল ব্যাংকিং থেকে Add Money: বিকাশ, নগদ, রকেট ও উপায় থেকে সহজেই Add Money করা যাবে।</p>
              <p className="text-slate-800">2. ব্যাংক অ্যাকাউন্ট থেকে Add Money: বাংলাদেশের যেকোনো ব্যাংক থেকে Add Money করলে প্রতি 1,000 টাকায় {appConfig?.addMoneyBankCashbackPerThousand ?? 5} টাকা ইনস্ট্যান্ট ক্যাশব্যাক পাবেন।</p>
              <p className="text-slate-800">3. বিদেশি ব্যাংক থেকে Add Money: বিদেশি ব্যাংক অ্যাকাউন্ট থেকেও Add Money করা যাবে। এ জন্য নির্ধারিত বিদেশি অ্যাকাউন্ট নম্বর প্রদান করা হবে।</p>
            </div>

            <div>
              <h4 className="font-black text-[#1D3261] mb-1">📤 Send Money</h4>
              <p className="text-slate-800">1. AMB to AMB: সেন্ড মানি ও ক্যাশ আউট সম্পূর্ণ ফ্রি (কোনো ফি বা অতিরিক্ত টাকা কাটবে না)।</p>
              <p className="text-slate-800">2. AMB টু  মোবাইল ব্যাংকিং (বিকাশ, নগদ, রকেট, উপায়):</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-800">
                <li>প্রতি ট্রানজেকশনে 3.90 পয়সা ফি, এবং 1 থেকে 1000 পর্যন্ত এক টাকা চার্জ 1001 থেকে 2 হাজার পর্যন্ত 2 টাকা চার্জ অর্থাৎ প্রতি হাজারে এক টাকা করে চার্জ কাটবে।</li>
                <li>25,000 টাকার বেশি হলে 10 টাকা ফি।</li>
                <li>সর্বোচ্চ লেনদেন সীমা 3 লাখ টাকা মাসে।</li>
                <li>এছাড়া প্রতি 1,000 টাকায় 1 টাকা চার্জ প্রযোজ্য।</li>
              </ul>
              <p className="text-slate-800">3. AMB থেকে বাংলাদেশের যেকোনো ব্যাংকে: প্রতি 1,000 টাকায় {appConfig?.sendMoneyBankServiceChargePerThousand ?? 7.90} টাকা চার্জ প্রযোজ্য।</p>
              <p className="text-slate-800">4. AMB থেকে বিদেশে অর্থ প্রেরণ: বিশ্বের যেকোনো ব্যাংক বা অ্যাকাউন্টে টাকা পাঠানো যাবে। চার্জ ও রেট নির্ধারিত এক্সচেঞ্জ রেট অনুযায়ী প্রযোজ্য হবে।</p>
            </div>

            <div>
              <h4 className="font-black text-[#1C698C] mb-1">🌐 আন্তর্জাতিক লেনদেন</h4>
              <p className="text-slate-800">• বিদেশ থেকে দেশে টাকা পাঠানো যাবে।</p>
              <p className="text-slate-800">• দেশ থেকে বিদেশেও টাকা পাঠানো যাবে।</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );


  const renderAutoAddMoney = () => (
    <div className="space-y-4 text-left animate-fade-in">
      <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-black text-xs cursor-pointer">
        <ChevronLeft className="w-4 h-4" /> ফিরে যান
      </button>
      <div className="space-y-4 bg-slate-900 border border-emerald-500/20 p-5 rounded-3xl text-left shadow-xl text-white">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-xl">💳</span>
          <div>
            <h3 className="text-xs font-black uppercase text-white">NagorikPay অনলাইন অটোমেটিক গেটওয়ে</h3>
            <p className="text-[9.5px] text-white/50">1 সেকেন্ডে পেমেন্ট সম্পূর্ণ হয়ে অটো-ক্রেডিট হবে</p>
          </div>
        </div>

        <form onSubmit={async (e) => {
          e.preventDefault();
          const amt = parseFloat(depositAmount);
          if (!amt || amt <= 0) {
            setErrorMsg('দয়া করে সঠিক ডিপোজিট পরিমাণ লিখুন।');
            return;
          }
          setLoading(true);
          setErrorMsg('');
          setSuccessMsg('');
          try {
            const res = await fetch('/api/payment/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                amount: amt,
                userId: user?.uid,
                phone: user?.phone || ''
              })
            });
            const data = await res.json();
            if (data && data.success && data.payment_url) {
              setSuccessMsg('পেমেন্ট গেটওয়েতে রিডাইরেক্ট করা হচ্ছে...');
              window.location.href = data.payment_url;
            } else {
              setErrorMsg(data.error || 'পেমেন্ট গেটওয়ে লোড করতে ব্যর্থ হয়েছে।');
            }
          } catch (err: any) {
            setErrorMsg(err.message || 'নেটওয়ার্ক সংযোগ ত্রুটি!');
          } finally {
            setLoading(false);
          }
        }} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-800/60 text-rose-200 rounded-2xl text-xs font-bold flex items-center gap-1.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800/60 text-emerald-200 rounded-2xl text-xs font-bold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">ডিপোজিট পরিমাণ (৳ Amount BDT)</label>
            <input
              type="number"
              required
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="৳ সর্বনিম্ন 10 BDT"
              className="w-full px-3.5 py-3 border border-white/10 bg-white/5 focus:border-emerald-500 rounded-xl text-xs font-mono text-white"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer uppercase active:scale-95"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'NagorikPay গেটওয়ে দিয়ে পেমেন্ট করুন 💳'
            )}
          </button>
        </form>
      </div>
    </div>
  );


  const renderAmbToAmb = () => {
     // Generate fallback card details in case states aren't saved yet
    const displayCardNum = user.ambCardNumber || '4840 6100 ---- ----';
    const displayAccNum = user.ambAccountNumber || '164.121.------';
    const displayHolder = (user.ambCardHolderName || user.name || 'AMB MEMBER').toUpperCase();
    const displayExpiry = user.ambCardExpiry || '07/27';
    const displayCvv = user.ambCardCvv || '---';
    const displayStatus = user.ambCardStatus || 'active';
    const displayOtpLocked = user.ambCardOtpLocked !== false;

    const handleToggleCardLock = async () => {
      try {
        const nextStatus = displayStatus === 'active' ? 'inactive' : 'active';
        await updateDoc(doc(db, 'users', user.uid), {
          ambCardStatus: nextStatus
        });
        if (syncLiveProfile) syncLiveProfile();
        setSuccessMsg(`ভার্চুয়াল কার্ডটি সফলভাবে ${nextStatus === 'active' ? 'আনলক' : 'লক/নিষ্ক্রিয়'} করা হয়েছে!`);
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (e: any) {
        setErrorMsg('কার্ড স্ট্যাটাস পরিবর্তন করতে ব্যর্থ হয়েছে: ' + e.message);
      }
    };

    const handleToggleOtpLock = async () => {
      try {
        const nextOtpLocked = !displayOtpLocked;
        await updateDoc(doc(db, 'users', user.uid), {
          ambCardOtpLocked: nextOtpLocked
        });
        if (syncLiveProfile) syncLiveProfile();
        setSuccessMsg(`কার্ডের ওটিপি নিরাপত্তা সফলভাবে ${nextOtpLocked ? 'চালু (ON)' : 'বন্ধ (OFF)'} করা হয়েছে!`);
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (e: any) {
        setErrorMsg('ওটিপি সেটিংস পরিবর্তন করতে ব্যর্থ হয়েছে: ' + e.message);
      }
    };

     // Instant OTP read from user document OR fallback to portalNotifications
    const liveOtpFromUserDoc = user?.activeCardOtp ? {
      id: 'user_doc_otp',
      title: '🔑 কার্ড পেমেন্ট ওটিপি (OTP Security Alert)',
      body: `আপনার ভার্চুয়াল কার্ড থেকে ৳${user.activeCardOtpAmount || ''} মেম্বার ${user.activeCardOtpRequester || 'মেম্বার'} এর জন্য ওটিপি: ${user.activeCardOtp}`,
      message: `আপনার ভার্চুয়াল কার্ড থেকে ৳${user.activeCardOtpAmount || ''} মেম্বার ${user.activeCardOtpRequester || 'মেম্বার'} এর জন্য ওটিপি: ${user.activeCardOtp}`,
      read: false,
      createdAt: user.activeCardOtpTime || new Date().toISOString()
    } : null;

    const activeCardOtpNotification = liveOtpFromUserDoc || portalNotifications.find(n => 
      !n.read && 
      (n.title?.includes('ওটিপি') || n.title?.includes('OTP') || n.message?.includes('ভেরিফিকেশন ওটিপি') || n.body?.includes('ভেরিফিকেশন ওটিপি')) &&
      (new Date().getTime() - new Date(n.createdAt).getTime() < 15 * 60 * 1000)
    );

    let parsedAmt = '';
    let parsedOtp = '';
    if (user?.activeCardOtp) {
      parsedAmt = String(user.activeCardOtpAmount || '');
      parsedOtp = String(user.activeCardOtp);
    } else if (activeCardOtpNotification) {
      const text = activeCardOtpNotification.message || activeCardOtpNotification.body || '';
      const amtMatch = text.match(/৳\s*([0-9.]+)/) || text.match(/৳\s*([0-9.]+)/);
      const otpMatch = text.match(/(?:ভেরিফিকেশন ওটিপি \(OTP\):|ওটিপি|OTP:)\s*([0-9]+)/);
      if (amtMatch) parsedAmt = amtMatch[1];
      if (otpMatch) parsedOtp = otpMatch[1];
    }

    return (
      <div className="bg-white rounded-3xl p-4 text-slate-800 space-y-3 animate-fade-in shadow-lg text-left">
        {/* Back and Title */}
        <div className="flex items-center justify-between">
          <button onClick={() => setActiveTab('dashboard')} className="text-[10px] font-bold flex items-center gap-1 text-emerald-800">
            <ChevronLeft className="w-4 h-4" /> ফিরে যান
          </button>
          <span className="text-[10px] font-black text-slate-400 font-mono tracking-widest">AMB VIRTUAL GATEWAY</span>
        </div>

        {/* 1. Real Virtual Debit Card Interface */}
        <div className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-xl transition-all duration-300 w-full max-w-sm aspect-[1.58/1] mx-auto flex flex-col justify-between ${
          displayStatus === 'active' 
            ? 'bg-gradient-to-br from-[#121c33] via-[#0f172a] to-[#043329] border border-emerald-500/30' 
            : 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700/50 grayscale opacity-85'
        }`}>
          {/* Card Shine / Watermark */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_55%)] pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          
          {/* Real-time Card Transfer Request Alert overlay */}
          {activeCardOtpNotification && (
            <div className="absolute inset-x-2 top-2 bg-rose-600/95 border border-rose-400 text-white px-2.5 py-1.5 rounded-xl text-[9px] xs:text-[10px] font-bold z-30 flex flex-col gap-1 shadow-2xl animate-bounce">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-yellow-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping shrink-0" />
                  🚨 কার্ড লেনদেন অ্যালার্ট! (Live Request)
                </span>
                <button 
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (user?.activeCardOtp) {
                      try {
                        await updateDoc(doc(db, 'users', user.uid), {
                          activeCardOtp: null,
                          activeCardOtpAmount: null,
                          activeCardOtpRequester: null,
                          activeCardOtpTime: null
                        });
                      } catch(err) {
                        console.error("Error clearing activeCardOtp:", err);
                      }
                    }
                    if (activeCardOtpNotification?.id && activeCardOtpNotification.id !== 'user_doc_otp') {
                      try {
                        await updateDoc(doc(db, 'user_notifications', activeCardOtpNotification.id), { read: true });
                      } catch(err) {
                        console.error("Error marking read:", err);
                      }
                    }
                  }} 
                  className="p-0.5 text-white/85 hover:text-white bg-black/20 rounded-md text-[9px] w-4 h-4 flex items-center justify-center font-extrabold cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <p className="text-white text-[7.5px] xs:text-[8px] leading-snug font-semibold">
                {activeCardOtpNotification.message || activeCardOtpNotification.body}
              </p>
            </div>
          )}

          {/* Top Row: Brand & Type */}
          <div className="flex justify-between items-start z-10">
            <div>
              <h4 className="text-[9px] xs:text-[10px] font-black tracking-widest text-emerald-400 uppercase font-sans leading-tight">AMB CO-OPERATIVE BANK</h4>
              <p className="text-[7.5px] xs:text-[8px] font-bold text-slate-300 leading-tight">বিএনবি সমবায় ব্যাংক লিমিটেড</p>
              
              {/* Dynamic Notification Badge for withdrawals (ওপরে সাদা দাগের জায়গায়) */}
              {activeCardOtpNotification && (
                <div className="mt-1 bg-amber-500 border border-amber-400 text-slate-950 px-2 py-0.5 rounded-lg text-[8px] xs:text-[9px] font-extrabold animate-pulse flex items-center gap-1 shadow-lg max-w-[190px] truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping shrink-0" />
                  <span>৳{parsedAmt || '---'} টাকা রিকুয়েস্ট {parsedOtp ? `(OTP: ${parsedOtp})` : ''}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${displayStatus === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[7.5px] xs:text-[8px] font-black tracking-wider uppercase font-mono bg-white/10 px-1.5 py-0.5 rounded-md">
                {displayStatus === 'active' ? 'Active' : 'Locked'}
              </span>
            </div>
          </div>

          {/* Floating OTP ON/OFF Toggle Widget (ডান পাশে সাদা দাগের জায়গায়) */}
          <div className="absolute right-4 top-[32%] z-20 flex flex-col items-end gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleOtpLock();
              }}
              className={`px-1.5 py-0.5 rounded-md font-black tracking-wide flex items-center gap-0.5 transition text-[7px] xs:text-[7.5px] cursor-pointer shadow-md border ${
                displayOtpLocked !== false
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-400/40 animate-pulse'
                  : 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400/40'
              }`}
              title="ওটিপি অন/অফ করুন"
            >
              {displayOtpLocked !== false ? '🔐 OTP: ON' : '🔓 OTP: OFF'}
            </button>
            <span className="text-[5.5px] xs:text-[6px] text-slate-300 font-bold uppercase tracking-wider">
              {displayOtpLocked !== false ? 'ওটিপি সচল' : 'সরাসরি লেনদেন'}
            </span>
          </div>

          {/* Chip, Contactless, & Eye Toggle */}
          <div className="flex items-center justify-between z-10">
            {/* Gold Chip */}
            <div className="w-7 h-5 bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 rounded-md border border-amber-600/30 flex flex-col justify-between p-0.5 shadow-inner">
              <div className="h-[0.5px] bg-amber-950/15" />
              <div className="h-[0.5px] bg-amber-950/15" />
              <div className="h-[0.5px] bg-amber-950/15" />
            </div>
            {/* NFC & Eye button combined */}
            <div className="flex items-center gap-2">
              {/* Show/Hide eye button */}
              <button
                type="button"
                onClick={() => setShowCardDetails(!showCardDetails)}
                className="p-1 hover:bg-white/10 active:scale-90 rounded-lg text-white/80 hover:text-white transition cursor-pointer flex items-center justify-center"
                title={showCardDetails ? "তথ্য হাইড করুন" : "তথ্য প্রদর্শন করুন"}
              >
                {showCardDetails ? <EyeOff className="w-3.5 h-3.5 text-emerald-300" /> : <Eye className="w-3.5 h-3.5 text-slate-300" />}
              </button>
              <svg className="w-3.5 h-3.5 text-white/65" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a9 9 0 009-9V7.5M12 15a3 3 0 003-3V10.5m-3 4.5a3 3 0 01-3-3V10.5" />
              </svg>
            </div>
          </div>

          {/* Card Number */}
          <div className="z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-xs xs:text-sm sm:text-[15px] font-black font-mono tracking-[0.18em] text-slate-100 drop-shadow-md">
                {showCardDetails ? displayCardNum : displayCardNum.substring(0, 10) + '•••• ••••'}
              </span>
              <button 
                type="button"
                onClick={() => copyToClipboard(displayCardNum, 'কার্ড নম্বর')} 
                className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white transition cursor-pointer"
                title="Copy Card Number"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[6px] xs:text-[7px] font-medium tracking-wider text-slate-400 uppercase font-sans -mt-0.5">AMB Virtual Card Number</p>
          </div>

          {/* Footer Details */}
          <div className="grid grid-cols-12 gap-1 border-t border-white/10 pt-1 text-left z-10">
            <div className="col-span-5">
              <p className="text-[5.5px] xs:text-[6px] tracking-wider text-slate-400 uppercase font-sans">Cardholder</p>
              <p className="text-[8px] xs:text-[9.5px] font-extrabold truncate uppercase font-mono text-slate-100">{displayHolder}</p>
            </div>
            <div className="col-span-3">
              <p className="text-[5.5px] xs:text-[6px] tracking-wider text-slate-400 uppercase font-sans">Expiry</p>
              <p className="text-[8px] xs:text-[9.5px] font-extrabold font-mono text-slate-100">
                {showCardDetails ? displayExpiry : '••/••'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[5.5px] xs:text-[6px] tracking-wider text-slate-400 uppercase font-sans">CVV</p>
              <p className="text-[8px] xs:text-[9.5px] font-extrabold font-mono tracking-widest text-slate-100">
                {showCardDetails ? displayCvv : '•••'}
              </p>
            </div>
            <div className="col-span-2 text-right self-end pb-0.5">
              <p className="text-[8px] xs:text-[10px] font-black italic tracking-tighter text-emerald-400 font-serif leading-none">VISA</p>
            </div>
          </div>

          {/* Account Number & Card Control Buttons */}
          <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[7.5px] xs:text-[8.5px] z-10">
            <div className="flex items-center gap-1 text-slate-300">
              <span className="font-sans font-bold">A/C:</span>
              <span className="font-mono font-bold tracking-wide text-emerald-300">{displayAccNum}</span>
              <button type="button" onClick={() => copyToClipboard(displayAccNum, 'ব্যাংক অ্যাকাউন্ট নম্বর')} className="p-0.5 hover:bg-white/10 rounded">
                <Copy className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Controls Row */}
            <div className="flex items-center gap-1.5">
              {/* Card OTP Live Notification (if requested by another member) */}
              {displayOtpLocked !== false && activeCardOtpNotification && (
                <div className="bg-amber-500/25 border border-amber-400 text-amber-200 px-1.5 py-0.5 rounded font-black animate-pulse flex items-center gap-0.5 text-[7px] xs:text-[7.5px] shadow-sm">
                  <span className="w-1 h-1 bg-rose-500 rounded-full animate-ping shrink-0" />
                  <span>ওটিপি: <strong className="font-mono text-white text-[8.5px]">{parsedOtp || '---'}</strong></span>
                </div>
              )}

              {/* Lock/Unlock Card Switch */}
              <button 
                type="button"
                onClick={handleToggleCardLock} 
                className={`px-1.5 py-0.5 rounded font-bold flex items-center gap-1 transition text-[7.5px] xs:text-[8px] cursor-pointer ${
                  displayStatus === 'active' 
                    ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/35 border border-rose-500/20' 
                    : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/35 border border-emerald-500/20'
                }`}
              >
                {displayStatus === 'active' ? '🔒 Lock' : '🔓 Unlock'}
              </button>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-[10.5px] font-bold flex items-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-[10.5px] font-bold flex items-center gap-1.5 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 2. Mode / Option Switcher (Send Money vs Card Add Money) */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-2xl p-1 font-sans text-xs">
          <button 
            onClick={() => { setAmbSubTab('send'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              ambSubTab === 'send' ? 'bg-indigo-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            💸 ফান্ড স্থানান্তর (Send Money)
          </button>
          <button 
            onClick={() => { setAmbSubTab('card_add'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              ambSubTab === 'card_add' ? 'bg-indigo-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            💳 কার্ড এডমানি (Card Add Money)
          </button>
        </div>

        {/* 3. Tab Form Fields */}
        {ambSubTab === 'send' && (
          <div className="bg-slate-50 border border-slate-100 p-4.5 rounded-2.5xl space-y-3.5">
            <h3 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
              🚀 AMB TO AMB ফান্ড স্থানান্তর
            </h3>
            <p className="text-[9.5px] text-slate-500 -mt-1">
              যেকোনো নিবন্ধিত বিএনবি মেম্বার আইডি বা মোবাইল নম্বরে সরাসরি ব্যালেন্স পাঠান।
            </p>
            
            <form onSubmit={handleAmbSendSubmit} className="space-y-3.5 pt-1.5">
              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-600">গ্রহীতা মেম্বার আইডি বা মোবাইল নম্বর</label>
                <input 
                  type="text" 
                  required
                  value={ambSendReceiver}
                  onChange={(e) => setAmbSendReceiver(e.target.value)}
                  placeholder="উদাঃ AMB000001008 বা মোবাইল নম্বর" 
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-600">পরিমাণ (৳ BDT Amount)</label>
                  <input 
                    type="number" 
                    required
                    value={ambSendAmount}
                    onChange={(e) => setAmbSendAmount(e.target.value)}
                    placeholder="৳ সর্বনিম্ন 10 BDT" 
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-600">সিকিউরিটি পিন (Wallet PIN)</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    required
                    value={ambSendPin}
                    onChange={(e) => setAmbSendPin(e.target.value)}
                    placeholder="4 সংখ্যার পিন" 
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono text-center tracking-widest" 
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-indigo-900 hover:bg-indigo-950 text-white font-black rounded-2xl text-xs uppercase shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'নিরাপদ স্থানান্তরের আবেদন সাবমিট করুন ⚡'
                )}
              </button>
            </form>
          </div>
        )}

        {ambSubTab === 'card_add' && (
          <div className="bg-slate-50 border border-slate-100 p-4.5 rounded-2.5xl space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <h3 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                💳 অন্য বিএনবি কার্ড থেকে অ্যাড মানি
              </h3>
            </div>

            {/* Saved Cards Quick Picker (প্রিয় কার্ডসমূহ) */}
            <div className="bg-white border border-slate-200 p-3 rounded-2xl space-y-2 text-left shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-700 flex items-center gap-1">
                  <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  আমার প্রিয় কার্ডসমূহ (Saved Cards)
                </span>
                {cardAddNum && cardAddNum.trim().length >= 12 && (
                  <button
                    type="button"
                    onClick={() => setShowSaveCardModal(true)}
                    className="text-[9px] bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 rounded-lg font-black transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                  >
                    ⭐ এই কার্ডটি প্রিয় তালিকায় সেভ করুন
                  </button>
                )}
              </div>

              {user.savedAmbCards && user.savedAmbCards.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {user.savedAmbCards.map((sc, idx) => {
                    const cleanScNum = sc.cardNumber.replace(/\s+/g, '');
                    const last4 = cleanScNum.slice(-4);
                    const isActive = cardAddNum.replace(/\s+/g, '') === cleanScNum;

                    return (
                      <div 
                        key={`${sc.id}-${idx}`}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition ${
                          isActive 
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setCardAddNum(sc.cardNumber);
                            if (sc.expiry && sc.expiry.includes('/')) {
                              const [m, y] = sc.expiry.split('/');
                              setExpiryMonth(m);
                              setExpiryYear(y);
                            }
                            setCardAddCvv(sc.cvv || '820');
                            setErrorMsg('');
                            setSuccessMsg(`"${sc.name}" প্রিয় কার্ডের তথ্য লোড করা হয়েছে!`);
                          }}
                          className="flex items-center gap-1 text-left cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-bold">{sc.name}</span>
                          <span className="font-mono text-[9px] opacity-80">(**** {last4})</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`আপনি কি "${sc.name}" প্রিয় তালিকা থেকে মুছে ফেলতে চান?`)) {
                              handleDeleteSavedCard(sc.id);
                            }
                          }}
                          className="p-0.5 hover:text-rose-500 opacity-60 hover:opacity-100 transition cursor-pointer ml-1"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[9px] text-slate-400 font-bold">
                  এখনো কোনো প্রিয় কার্ড সেভ করা নেই। আপনি যেকোনো কার্ড নম্বর ইনপুট দিয়ে "⭐ এই কার্ডটি প্রিয় তালিকায় সেভ করুন" বাটনে ক্লিক করে 4-5টি কার্ড সেভ রাখতে পারবেন।
                </p>
              )}
            </div>

            <form onSubmit={handleAmbCardAddSubmit} className="space-y-3 pt-1.5">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[10.5px] font-bold text-slate-600">কার্ড নম্বর (Card Number)</label>
                  {cardAddNum && cardAddNum.trim().length >= 12 && (!user.savedAmbCards || !user.savedAmbCards.some(c => c.cardNumber.replace(/\s+/g, '') === cardAddNum.replace(/\s+/g, ''))) && (
                    <button
                      type="button"
                      onClick={() => setShowSaveCardModal(true)}
                      className="text-[9px] text-amber-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      ⭐ প্রিয় কার্ড হিসেবে সেভ করুন
                    </button>
                  )}
                </div>
                <input 
                  type="text" 
                  required
                  value={cardAddNum}
                  onChange={(e) => setCardAddNum(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx (16 সংখ্যার কার্ড)" 
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono text-center tracking-widest" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-600">মেয়াদ উত্তীর্ণ (Expiry Date)</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      required
                      value={expiryMonth}
                      onChange={(e) => setExpiryMonth(e.target.value)}
                      className="w-full px-2 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono bg-white cursor-pointer text-center"
                    >
                      <option value="">MM</option>
                      {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, idx) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      required
                      value={expiryYear}
                      onChange={(e) => setExpiryYear(e.target.value)}
                      className="w-full px-2 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono bg-white cursor-pointer text-center"
                    >
                      <option value="">YY</option>
                      {['26','27','28','29','30','31','32','33','34','35','36'].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-600">সিভিভি কোড (CVV)</label>
                  <input 
                    type="password" 
                    maxLength={3}
                    required
                    value={cardAddCvv}
                    onChange={(e) => setCardAddCvv(e.target.value)}
                    placeholder="3 সংখ্যার কোড" 
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono text-center tracking-wider" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-600">স্থানান্তর পরিমাণ (Amount BDT)</label>
                  <input 
                    type="number" 
                    required
                    value={cardAddAmount}
                    onChange={(e) => setCardAddAmount(e.target.value)}
                    placeholder="৳ সর্বনিম্ন 10 BDT" 
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-600">আমার ওয়ালেট পিন (PIN)</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    required
                    value={cardAddPin}
                    onChange={(e) => setCardAddPin(e.target.value)}
                    placeholder="4 সংখ্যার পিন" 
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono text-center tracking-widest" 
                  />
                </div>
              </div>

              {cardOtpSent && (
                <div className="space-y-1.5 bg-amber-50 border border-amber-300 p-3.5 rounded-2xl mt-2 text-left shadow-xs">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10.5px] font-black text-amber-900">6 সংখ্যার গোপন ওটিপি কোড (OTP Code)</label>
                  </div>
                  <input 
                    type="text" 
                    maxLength={6}
                    required
                    value={userEnteredOtp}
                    onChange={(e) => setUserEnteredOtp(e.target.value)}
                    placeholder="6 সংখ্যার ওটিপি কোড প্রবেশ করুন" 
                    className="w-full px-3.5 py-2.5 border border-amber-400 focus:border-amber-600 rounded-xl text-xs font-mono text-center tracking-widest font-black text-slate-900 bg-white" 
                  />
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[9.5px] text-amber-800 font-bold leading-tight">
                      📲 কার্ড মালিকের ইন-অ্যাপ নোটিফিকেশনে ওটিপি পাঠানো হয়েছে। কার্ড মালিকের থেকে ওটিপি সংগ্রহ করে প্রদান করুন।
                    </span>
                    <button 
                      type="button" 
                      onClick={() => {
                        setCardOtpSent(false);
                        setCardOtpCode('');
                        setUserEnteredOtp('');
                        setErrorMsg('ওটিপি ভেরিফিকেশন রিসেট করা হয়েছে। আবার চেষ্টা করুন।');
                      }}
                      className="text-[8.5px] text-rose-600 hover:underline font-extrabold cursor-pointer shrink-0 ml-2"
                    >
                      ভেরিফিকেশন রিসেট করুন
                    </button>
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-indigo-900 hover:bg-indigo-950 text-white font-black rounded-2xl text-xs uppercase shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer mt-2 active:scale-95"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : cardOtpSent ? (
                  'ওটিপি ভেরিফাই করে এডমানি সম্পূর্ণ করুন 🔐'
                ) : (
                  'কার্ড পেমেন্ট ভেরিফাই ও ওটিপি পাঠান 💳'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  };

  const renderRemittanceSection = () => {
    const allBanks = (appConfig?.paymentBanks && Array.isArray(appConfig.paymentBanks)) ? appConfig.paymentBanks : [];
    const customIntlBanks = allBanks.filter((b: any) => isForeignBankItem(b) && b.active !== false);
    const defaultIntlBanks = [
      { 
        id: 'AL RAJHI (সৌদি ব্যাংক)', 
        name: 'AL RAJHI BANK (সৌদি ব্যাংক)', 
        acronym: 'RAJHI', 
        holder: 'BUSINESS NETWORK BANGLADESH', 
        accNum: '540000010006080101452', 
        iban: 'SA03 8000 0540 6080 1010 1452', 
        branch: 'Riyadh Main Branch (সৌদি আরব)', 
        routingNum: 'RJHI SA RI', 
        swiftCode: 'RJHISARI',
        active: true 
      },
      { 
        id: 'SNB (সৌদি ব্যাংক)', 
        name: 'SAUDI NATIONAL BANK (SNB ALAHLI)', 
        acronym: 'SNB', 
        holder: 'BUSINESS NETWORK BANGLADESH', 
        accNum: '640000010006087881869', 
        iban: 'SA50 8000 0640 6080 1788 1869', 
        branch: 'Jeddah Main Branch (সৌদি আরব)', 
        routingNum: 'NCBKSA21', 
        swiftCode: 'NCBKSA21',
        active: true 
      },
      { 
        id: 'ENBD (দুবাই ব্যাংক)', 
        name: 'EMIRATES NBD BANK (DUBAI)', 
        acronym: 'ENBD', 
        holder: 'BUSINESS NETWORK BANGLADESH', 
        accNum: '120220000987456321458', 
        iban: 'AE12 0220 0009 8745 6321 458', 
        branch: 'Deira Branch, Dubai (সংযুক্ত আরব আমিরাত)', 
        routingNum: 'EBILAE2X', 
        swiftCode: 'EBILAE2X',
        active: true 
      }
    ];
    const hasConfiguredBanks = Array.isArray(appConfig?.paymentBanks);
    const displayIntlBanks = (hasConfiguredBanks && customIntlBanks.length > 0)
      ? customIntlBanks
      : (hasConfiguredBanks && (appConfig?.paymentBanks?.length || 0) > 0 ? [] : defaultIntlBanks);
    const defaultIntlBank = displayIntlBanks[0] || defaultIntlBanks[0];

    const currentRemitIntlBank = displayIntlBanks.find((b: any) => b.id === remitSelectedBankId) || defaultIntlBank;
    const remitCurrency = getBankCurrencyInfo(
      currentRemitIntlBank,
      remittanceRates,
      appConfig?.remittanceRates,
      undefined,
      'remittance'
    );

    const remitVal = parseFloat(remitAmount) || 0;
    const remitTransferFee = Number(
      (currentRemitIntlBank as any)?.transferFee !== undefined && (currentRemitIntlBank as any)?.transferFee !== null && (currentRemitIntlBank as any)?.transferFee !== ''
        ? (currentRemitIntlBank as any).transferFee
        : (remitCurrency.transferFee ?? appConfig?.remittanceTransferFee ?? appConfig?.remittanceFee ?? 15)
    );
    const remitGrossForeign = remitCurrencyMode === 'foreign'
      ? remitVal
      : (remitCurrency.rate > 0 ? Math.round((remitVal / remitCurrency.rate) * 100) / 100 : 0);
    const remitFeeForeign = remitVal > 0 ? remitTransferFee : 0;
    const remitFeeBdt = Math.round(remitFeeForeign * remitCurrency.rate * 100) / 100;
    const remitNetForeign = Math.max(0, remitGrossForeign - remitFeeForeign);
    const remitGrossBdt = remitCurrencyMode === 'foreign'
      ? Math.round(remitVal * remitCurrency.rate * 100) / 100
      : remitVal;
    const remitNetBdt = Math.round(remitNetForeign * remitCurrency.rate * 100) / 100;
    const remitIncentive = Math.round((remitNetBdt * 0.025) * 100) / 100;
    const remitTotalPayout = remitVal > 0 
      ? Math.round((remitNetBdt + remitIncentive) * 100) / 100 
      : 0;
    const remitForeignVal = remitGrossForeign;

    return (
      <div className="space-y-4">
        {remitStep === 1 ? (
          <div className="space-y-3.5 text-left animate-fade-in">
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 p-4 rounded-2xl border border-emerald-500/40 text-white shadow-md space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5 text-emerald-300">
                  <span>💸</span>
                  <span>প্রবাসী রেমিট্যান্স ও ২.৫% সরকারি প্রণোদনা</span>
                </h3>
                <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                  +২.৫% প্রণোদনা
                </span>
              </div>
              <p className="text-[11px] text-emerald-150 leading-relaxed font-normal">
                অনুমোদিত বিদেশী ব্যাংকে টাকা পাঠিয়ে বাংলাদেশে যে কোনো ব্যাংক একাউন্টে রেমিট্যান্স জমা করুন। সরকার কর্তৃক ঘোষিত অতিরিক্ত ২.৫% নগদ প্রণোদনা সরাসরি যোগ হবে।
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span>🏦</span> অনুমোদিত বিদেশী ব্যাংক পছন্দ করুনঃ
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">ধাপ ১ / ২</span>
            </div>

            <div className="space-y-2.5">
              {displayIntlBanks.map((bk: any) => {
                const remitCur = getBankCurrencyInfo(
                  bk,
                  remittanceRates,
                  appConfig?.remittanceRates,
                  undefined,
                  'remittance'
                );
                return (
                  <div 
                    key={bk.id}
                    onClick={() => {
                      setRemitSelectedBankId(bk.id);
                      setRemitSelectedCountryCode(remitCur.code);
                      setRemitStep(2);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="bg-white hover:bg-slate-50/90 border border-slate-200 hover:border-emerald-500 p-3.5 rounded-2xl transition cursor-pointer shadow-xs flex items-center justify-between group active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-700 to-teal-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-emerald-600/30">
                        {bk.acronym || 'REMIT'}
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition leading-snug">
                          {bk.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1">
                            <span>{remitCur.flag}</span>
                            <span>{bk.country || (remitCur as any).country || (remitCur as any).countryName || 'আন্তর্জাতিক'}</span>
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-mono">
                            ১ {remitCur.code} = ৳{remitCur.rate.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 block mb-1">
                        +২.৫% বোনাস সহ
                      </span>
                      <span className="text-xs font-bold text-emerald-700 group-hover:translate-x-0.5 transition inline-flex items-center gap-0.5">
                        নির্বাচন করুন →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2.5xl p-3 sm:p-4 text-slate-800 shadow-md space-y-3 border border-slate-200 animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-slate-150 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-800 to-teal-950 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  {currentRemitIntlBank.acronym || 'REMIT'}
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                    <span>💸</span>
                    <span>{currentRemitIntlBank.name}</span>
                  </h4>
                  <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                    অনুমোদিত বিদেশী ব্যাংক (২.৫% প্রণোদনা সক্রিয়)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRemitStep(1);
                  setRemitSelectedBankId(null);
                }}
                className="text-[10.5px] text-emerald-700 hover:text-emerald-900 font-bold bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200 transition cursor-pointer active:scale-95 shrink-0"
              >
                ব্যাংক পরিবর্তন 🔄
              </button>
            </div>

            {/* ১. আমাদের অনুমোদিত প্রবাস ব্যাংক অ্যাকাউন্ট তথ্য ও রেমিট্যান্স রেট */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <span className="font-bold text-slate-800 text-[11.5px] flex items-center gap-1">
                  <span>🏛️</span> ১. আমাদের অনুমোদিত প্রবাস ব্যাংক অ্যাকাউন্ট তথ্য ও রেমিট্যান্স রেট
                </span>
                <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded-full border border-emerald-300">
                  অফিসিয়াল গেটওয়ে
                </span>
              </div>

              {/* Currency and exchange rate card */}
              <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white rounded-lg p-2 flex flex-wrap items-center justify-between gap-1 shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{remitCurrency.flag}</span>
                  <div>
                    <span className="text-[9px] text-emerald-200 block uppercase font-mono">লাইভ এক্সচেঞ্জ রেট</span>
                    <strong className="text-xs sm:text-sm font-bold tracking-wide">
                      1 {remitCurrency.code} = ৳{remitCurrency.rate.toFixed(2)} BDT
                    </strong>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="bg-white/10 px-2 py-0.5 rounded border border-white/20 text-emerald-100">
                    ট্রান্সফার ফি: <b className="text-white font-mono">{remitTransferFee} {remitCurrency.code}</b>
                  </span>
                  <span className="bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded shadow-2xs">
                    সরকারি নগদ প্রণোদনা: +২.৫%
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60 text-[11px]">
                <span className="text-slate-500 font-medium">ব্যাংকের নামঃ</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-900">{currentRemitIntlBank.name}</span>
                  <button 
                    type="button"
                    onClick={() => copyToClipboard(currentRemitIntlBank.name, 'ব্যাংকের নাম')}
                    className="text-[9.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 cursor-pointer"
                  >
                    <Copy className="w-2.5 h-2.5 text-slate-500" /> কপি
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60 text-[11px]">
                <span className="text-slate-500 font-medium">অ্যাকাউন্ট হোল্ডারঃ</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-900">{currentRemitIntlBank.holder || 'BUSINESS NETWORK BANGLADESH'}</span>
                  <button 
                    type="button"
                    onClick={() => copyToClipboard(currentRemitIntlBank.holder || 'BUSINESS NETWORK BANGLADESH', 'অ্যাকাউন্ট হোল্ডার')}
                    className="text-[9.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 cursor-pointer"
                  >
                    <Copy className="w-2.5 h-2.5 text-slate-500" /> কপি
                  </button>
                </div>
              </div>

              {currentRemitIntlBank.accNum && (
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60 text-[11px]">
                  <span className="text-slate-500 font-medium">হিসাব নম্বর (Acc No):</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900 tracking-wide">{currentRemitIntlBank.accNum}</span>
                    <button 
                      type="button"
                      onClick={() => copyToClipboard(cleanNumberForCopy(currentRemitIntlBank.accNum), 'হিসাব নম্বর')}
                      className="text-[9.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 cursor-pointer"
                    >
                      <Copy className="w-2.5 h-2.5 text-slate-500" /> কপি
                    </button>
                  </div>
                </div>
              )}

              {currentRemitIntlBank.iban && (
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60 text-[11px]">
                  <span className="text-slate-500 font-medium">আইবান নম্বর (IBAN):</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900 tracking-wide">{currentRemitIntlBank.iban}</span>
                    <button 
                      type="button"
                      onClick={() => copyToClipboard(cleanNumberForCopy(currentRemitIntlBank.iban), 'আইবান নম্বর')}
                      className="text-[9.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 cursor-pointer"
                    >
                      <Copy className="w-2.5 h-2.5 text-slate-500" /> কপি
                    </button>
                  </div>
                </div>
              )}

              {currentRemitIntlBank.branch && (
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60 text-[11px]">
                  <span className="text-slate-500 font-medium">শাখার নাম (Branch):</span>
                  <span className="font-semibold text-slate-800">{currentRemitIntlBank.branch}</span>
                </div>
              )}

              {(currentRemitIntlBank.routingNum || currentRemitIntlBank.swiftCode) && (
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60 text-[11px]">
                  <span className="text-slate-500 font-medium">রাউটিং / SWIFT:</span>
                  <span className="font-mono font-semibold text-slate-900">{currentRemitIntlBank.routingNum || currentRemitIntlBank.swiftCode}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  const details = [
                    "ব্যাংকের নাম: " + currentRemitIntlBank.name,
                    "অ্যাকাউন্ট হোল্ডার: " + (currentRemitIntlBank.holder || 'BUSINESS NETWORK BANGLADESH'),
                    currentRemitIntlBank.accNum ? ("হিসাব নম্বর: " + currentRemitIntlBank.accNum) : '',
                    currentRemitIntlBank.iban ? ("IBAN: " + currentRemitIntlBank.iban) : '',
                    currentRemitIntlBank.branch ? ("শাখা: " + currentRemitIntlBank.branch) : '',
                    currentRemitIntlBank.routingNum ? ("রাউটিং নম্বর: " + currentRemitIntlBank.routingNum) : '',
                    currentRemitIntlBank.swiftCode ? ("SWIFT কোড: " + currentRemitIntlBank.swiftCode) : ''
                  ].filter(Boolean).join("\n");
                  copyToClipboard(details, 'ব্যাংকের সম্পূর্ণ তথ্য');
                }}
                className="w-full py-1.5 bg-[#22215b] hover:bg-[#1a1947] text-white font-medium text-[11px] rounded-lg shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
              >
                <Copy className="w-3.5 h-3.5 text-amber-300" />
                <span>📋 ব্যাংকের সকল তথ্য একসাথে কপি করুন</span>
              </button>
            </div>

            {/* Notice banner */}
            <div className="bg-[#e8f7ee] border border-[#b2e5c8] text-[#046c3b] p-2 sm:p-2.5 rounded-xl text-[10.5px] font-normal flex items-start gap-1.5 leading-snug">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#008955] mt-0.5 shrink-0" />
              <p>প্রবাসের অনুমোদিত ব্যাংকে টাকা পাঠিয়ে নিচে আপনার প্রেরক হিসাব ও ভাউচার দিন এবং ৩ নং সেকশনে বাংলাদেশে যে ব্যাংকে টাকা পাঠাতে চান সেই তথ্য পূরণ করুন।</p>
            </div>

            {/* Form starts */}
            <form onSubmit={handleRemittanceSubmit} className="space-y-2.5 pt-0.5">
              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-1.5 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-1.5 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* ২য় সেকশন: আপনার প্রেরক প্রবাস অ্যাকাউন্ট, রেমিট্যান্সের পরিমাণ ও ভাউচার তথ্য */}
              <div className="bg-slate-50 border border-slate-200 p-2.5 sm:p-3 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <span className="font-bold text-slate-800 text-[11.5px] flex items-center gap-1.5">
                    <span>📝</span> ২. আপনার প্রেরক প্রবাস অ্যাকাউন্ট, রেমিট্যান্সের পরিমাণ ও ভাউচার তথ্য
                  </span>
                  <span className="text-[9.5px] text-rose-600 font-bold bg-rose-50 px-2 py-0.2 rounded-full border border-rose-200">
                    বাধ্যতামূলক
                  </span>
                </div>

                {/* REMITTANCE AMOUNT FIELD WITH FEE IN SAR DEDUCTED & NET CONVERTED WITH 2.5% INCENTIVE */}
                <div className="space-y-1.5 bg-emerald-50/50 border border-emerald-300 p-2.5 sm:p-3 rounded-xl">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="block text-[11px] font-bold text-slate-900 flex items-center gap-1">
                      <span>💵 কত টাকা পাঠিয়েছেন (রেমিট্যান্সের পরিমাণ)</span>
                      <span className="text-rose-500">*</span>
                      <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.2 rounded text-[10px] font-bold flex items-center gap-1">
                        <span>{remitCurrency.flag}</span>
                        <span>{remitCurrencyMode === 'foreign' ? `${remitCurrency.code}` : 'BDT'}</span>
                      </span>
                    </label>

                    <div className="flex items-center gap-1">
                      <span className="text-[9.5px] font-bold text-emerald-800 bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                        ১ {remitCurrency.code} = ৳{remitCurrency.rate.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRemitCurrencyMode(prev => prev === 'foreign' ? 'bdt' : 'foreign');
                        }}
                        className="text-[9.5px] font-medium bg-white hover:bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 transition cursor-pointer active:scale-95"
                      >
                        🔄 {remitCurrencyMode === 'foreign' ? 'BDT মোড' : `${remitCurrency.code} মোড`}
                      </button>
                    </div>
                  </div>

                  {/* Remittance Input with auto calculated total */}
                  <div className="relative flex items-center w-full">
                    <input
                      type="number"
                      step="any"
                      required
                      value={remitAmount}
                      onChange={(e) => setRemitAmount(e.target.value)}
                      placeholder={remitCurrencyMode === 'foreign' ? `উদাঃ 1000 ${remitCurrency.code}` : `উদাঃ 30000 BDT`}
                      className="w-full pl-3 pr-36 sm:pr-44 py-2 border border-emerald-400 focus:border-emerald-600 rounded-xl text-sm sm:text-base font-mono font-bold bg-white text-slate-900 outline-none transition"
                    />

                    <div 
                      className="absolute right-1 top-1/2 -translate-y-1/2 bg-gradient-to-r from-emerald-700 to-teal-800 text-white px-2 py-1 rounded-lg flex items-center gap-1 font-mono text-[11px] sm:text-xs font-bold pointer-events-none select-none border border-emerald-400/60"
                    >
                      <span className="text-[8.5px] sm:text-[9px] text-emerald-200">
                        {remitCurrencyMode === 'foreign' ? 'প্রাপক:' : 'প্রবাসে:'}
                      </span>
                      <span className="text-amber-300 font-bold whitespace-nowrap">
                        {remitCurrencyMode === 'foreign'
                          ? `৳${remitTotalPayout.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                          : `${remitForeignVal} ${remitCurrency.code}`}
                      </span>
                    </div>
                  </div>

                  {/* Detailed Mathematical breakdown card */}
                  <div className="bg-white border border-emerald-200 rounded-lg p-2 space-y-1 text-[11px]">
                    <div className="flex justify-between items-center text-slate-600 pb-1 border-b border-slate-100">
                      <span className="font-medium">মোট প্রেরিত অর্থ:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {remitGrossForeign.toLocaleString('en-US')} {remitCurrency.code} (৳{remitGrossBdt.toLocaleString('bn-BD', { minimumFractionDigits: 2 })} BDT)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-rose-600 pb-1 border-b border-slate-100">
                      <span className="font-medium flex items-center gap-1">
                        <span>🏷️ ট্রান্সফার ফি / খরচ:</span>
                      </span>
                      <span className="font-mono font-semibold text-rose-600">
                        {remitFeeForeign} {remitCurrency.code}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700 pb-1 border-b border-slate-100">
                      <span className="font-medium">ফি বাদে নিট রেমিট্যান্স:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {remitNetForeign.toLocaleString('en-US')} {remitCurrency.code} (৳{remitNetBdt.toLocaleString('bn-BD', { minimumFractionDigits: 2 })} BDT)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-700 pb-1 border-b border-slate-100">
                      <span className="font-medium flex items-center gap-1">
                        <span>🎁 সরকারি নগদ প্রণোদনা (+২.৫%):</span>
                      </span>
                      <span className="font-mono font-semibold text-emerald-700">
                        +৳{remitIncentive.toLocaleString('bn-BD', { minimumFractionDigits: 2 })} BDT
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-950 pt-1 bg-emerald-50/70 p-1.5 rounded-md border border-emerald-200">
                      <span className="font-bold flex items-center gap-1 text-[11px] sm:text-xs">
                        <span>🇧🇩 বাংলাদেশে প্রাপক মোট পাবেন:</span>
                      </span>
                      <span className="font-mono text-emerald-800 text-xs sm:text-sm bg-white px-2 py-0.5 rounded border border-emerald-400 font-bold">
                        ৳{remitTotalPayout.toLocaleString('bn-BD', { minimumFractionDigits: 2 })} BDT
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    আপনার প্রেরক হিসাব / আইবান / অ্যাকাউন্ট নম্বর <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={remitSenderAccount}
                    onChange={(e) => setRemitSenderAccount(e.target.value)}
                    placeholder="প্রবাস থেকে যে অ্যাকাউন্ট বা আইবান থেকে টাকা পাঠিয়েছেন"
                    className="w-full px-2.5 py-2 border border-slate-300 focus:border-indigo-600 rounded-xl text-xs font-mono bg-white font-normal"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-slate-800">
                      ভাউচার / ট্রানজেকশন আইডি (TrxID) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[9.5px] text-slate-500 font-normal">ব্যাংক ডিপোজিট স্লিপের রেফারেন্স নম্বর</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={remitTrxId}
                    onChange={(e) => setRemitTrxId(e.target.value)}
                    placeholder="ট্রানজেকশন আইডি বা রেফারেন্স লিখুন"
                    className="w-full px-2.5 py-2 border border-slate-300 focus:border-indigo-600 rounded-xl text-xs font-mono uppercase bg-white font-normal"
                  />
                </div>
              </div>

              {/* ৩য় সেকশন: বাংলাদেশে যে ব্যাংকে টাকা পাঠাতে চান সেই ব্যাংকের তথ্য */}
              <div className="bg-slate-50 border border-slate-200 p-2.5 sm:p-3 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <span className="font-bold text-slate-800 text-[11.5px] flex items-center gap-1.5">
                    <span>🏦</span> ৩. বাংলাদেশে যে ব্যাংকে টাকা পাঠাতে চান সেই ব্যাংকের তথ্য
                  </span>
                  <span className="text-[9.5px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
                    প্রাপকের ব্যাংক
                  </span>
                </div>

                {/* Quick Bangladeshi Bank Suggestions */}
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-medium text-slate-600">জনপ্রিয় ব্যাংক পছন্দ করুনঃ</label>
                  <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-none">
                    {[
                      'ইসলামী ব্যাংক বাংলাদেশ',
                      'সোনালী ব্যাংক পিএলসি',
                      'ডাচ-বাংলা ব্যাংক (DBBL)',
                      'ব্র্যাক ব্যাংক',
                      'সিটি ব্যাংক',
                      'পূবালী ব্যাংক',
                      'জনতা ব্যাংক',
                      'অগ্রণী ব্যাংক'
                    ].map((bName) => (
                      <button
                        key={bName}
                        type="button"
                        onClick={() => setRemitBeneficiaryBankName(bName)}
                        className={`px-2 py-0.5 text-[10px] rounded-md border whitespace-nowrap transition cursor-pointer font-medium ${
                          remitBeneficiaryBankName === bName 
                            ? 'bg-indigo-900 text-white border-indigo-950 font-bold' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {bName}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-700">
                      প্রাপকের ব্যাংকের নাম <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={remitBeneficiaryBankName}
                      onChange={(e) => setRemitBeneficiaryBankName(e.target.value)}
                      placeholder="উদাঃ Islami Bank / Sonali Bank"
                      className="w-full px-2.5 py-2 border border-slate-300 focus:border-indigo-600 rounded-xl text-xs font-normal bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-700">
                      প্রাপকের ব্যাংক হিসাব নম্বর (Acc No) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={remitBeneficiaryAccountNo}
                      onChange={(e) => setRemitBeneficiaryAccountNo(e.target.value)}
                      placeholder="প্রাপকের সঠিক ব্যাংক হিসাব নম্বর"
                      className="w-full px-2.5 py-2 border border-slate-300 focus:border-indigo-600 rounded-xl text-xs font-mono font-medium bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-700">
                      প্রাপকের নাম (Account Holder Name) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={remitBeneficiaryName}
                      onChange={(e) => setRemitBeneficiaryName(e.target.value)}
                      placeholder="ব্যাংক একাউন্ট অনুযায়ী প্রাপকের পুরো নাম"
                      className="w-full px-2.5 py-2 border border-slate-300 focus:border-indigo-600 rounded-xl text-xs font-normal bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-700">
                       শাখা ও জেলা (Branch & District)
                    </label>
                    <input
                      type="text"
                      value={remitBeneficiaryBranch}
                      onChange={(e) => setRemitBeneficiaryBranch(e.target.value)}
                      placeholder="উদাঃ মতিঝিল শাখা, ঢাকা"
                      className="w-full px-2.5 py-2 border border-slate-300 focus:border-indigo-600 rounded-xl text-xs font-normal bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-700">
                      প্রাপকের মোবাইল নম্বর (SMS নোটিফিকেশন)
                    </label>
                    <input
                      type="tel"
                      value={remitBeneficiaryPhone}
                      onChange={(e) => setRemitBeneficiaryPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full px-2.5 py-2 border border-slate-300 focus:border-indigo-600 rounded-xl text-xs font-mono font-normal bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-700">
                      প্রাপকের সাথে সম্পর্ক (Relationship)
                    </label>
                    <select
                      value={remitBeneficiaryRelation}
                      onChange={(e) => setRemitBeneficiaryRelation(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 focus:border-indigo-600 rounded-xl text-xs font-normal bg-white"
                    >
                      <option value="পরিবার / আত্মীয়">পরিবার / আত্মীয়</option>
                      <option value="পিতা / মাতা">পিতা / মাতা</option>
                      <option value="স্ত্রী / স্বামী">স্ত্রী / স্বামী</option>
                      <option value="সন্তান">সন্তান</option>
                      <option value="ভাই / বোন">ভাই / বোন</option>
                      <option value="ব্যবসায়িক লেনদেন">ব্যবসায়িক লেনদেন</option>
                      <option value="অন্যান্য">অন্যান্য</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ৪. সিকিউরিটি ওয়ালেট পিন দিয়ে কনফার্ম করুন */}
              <div className="bg-slate-50 border border-slate-200 p-2.5 sm:p-3 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <span className="font-bold text-slate-800 text-[11.5px] flex items-center gap-1.5">
                    <span>🔐</span> ৪. সিকিউরিটি ওয়ালেট পিন দিয়ে আবেদন কনফার্ম করুন
                  </span>
                  <span className="text-[9.5px] text-rose-600 font-bold bg-rose-50 px-2 py-0.2 rounded-full border border-rose-200">
                    বাধ্যতামূলক
                  </span>
                </div>
                <div className="space-y-1 pt-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    আপনার ৪ সংখ্যার ওয়ালেট পিন নম্বর (Wallet PIN) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={remitSecurityPin}
                    onChange={(e) => setRemitSecurityPin(e.target.value)}
                    placeholder="••••"
                    className="w-full px-2.5 py-2.5 border border-slate-300 focus:border-emerald-600 rounded-xl text-sm font-mono text-center tracking-[0.3em] bg-white font-bold text-slate-900 shadow-2xs"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-800 hover:from-emerald-800 hover:to-teal-900 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer uppercase active:scale-98"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'প্রবাসী রেমিট্যান্স আবেদন সাবমিট করুন (২.৫% প্রণোদনা সহ) 💸'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  };

  const renderAddMoney = () => {
    const allBanks = appConfig?.paymentBanks || [];
    const customLocalBanks = allBanks.filter((b: any) => b.active !== false && !isForeignBankItem(b));
    const defaultLocalBanks = [
      {
        id: "DBBL (ডাচ-বাংলা ব্যাংক)",
        name: "Dutch-Bangla Bank PLC. (DBBL)",
        acronym: "DBBL",
        branch: "হেমায়েতপুর শাখা",
        routingNum: "090261545",
        holder: "MD SUJON MIA",
        accNum: "2441580395850",
        visaNum: "4840 6100 1036 9801",
        active: true,
      },
      {
        id: "Bank Asia PLC",
        name: "Bank Asia PLC",
        acronym: "BA",
        branch: "COMPANIGONJ BRANCH",
        routingNum: "070271545",
        holder: "MD SUJON MIA",
        accNum: "03934005821",
        visaNum: "",
        active: true,
      },
      {
        id: "Cellfin (Islami Bank)",
        name: "Cellfin",
        acronym: "IBBL",
        branch: "প্রধান শাখা / অনলাইন",
        routingNum: "125271545",
        holder: "MD SUJON MIA",
        accNum: "205021302008955",
        visaNum: "",
        active: true,
      }
    ];
    
    const localBanks = customLocalBanks.length > 0 ? customLocalBanks : defaultLocalBanks;
    const defaultLocalBank = localBanks[0] || defaultLocalBanks[0];

    const customIntlBanks = allBanks.filter((b: any) => isForeignBankItem(b) && b.active !== false);
    const defaultIntlBanks = [
      { 
        id: 'AL RAJHI (সৌদি ব্যাংক)', 
        name: 'AL RAJHI BANK (সৌদি ব্যাংক)', 
        acronym: 'RAJHI', 
        holder: 'BUSINESS NETWORK BANGLADESH', 
        accNum: '2441580395850', 
        iban: 'SA64000001006087881869', 
        branch: 'Riyadh Main Branch (সৌদি আরব)', 
        routingNum: 'RJHISA21', 
        swiftCode: 'RJHISA21',
        active: true 
      },
      { 
        id: 'SNB (সৌদি ব্যাংক)', 
        name: 'SAUDI NATIONAL BANK (SNB ALAHLI)', 
        acronym: 'SNB', 
        holder: 'BUSINESS NETWORK BANGLADESH', 
        accNum: '640000010006087881869', 
        iban: 'SA50 8000 0640 6080 1788 1869', 
        branch: 'Jeddah Main Branch (সৌদি আরব)', 
        routingNum: 'NCBKSA21', 
        swiftCode: 'NCBKSA21',
        active: true 
      },
      { 
        id: 'ENBD (দুবাই ব্যাংক)', 
        name: 'EMIRATES NBD BANK (DUBAI)', 
        acronym: 'ENBD', 
        holder: 'BUSINESS NETWORK BANGLADESH', 
        accNum: '120220000987456321458', 
        iban: 'AE12 0220 0009 8745 6321 458', 
        branch: 'Deira Branch, Dubai (সংযুক্ত আরব আমিরাত)', 
        routingNum: 'EBILAE2X', 
        swiftCode: 'EBILAE2X',
        active: true 
      }
    ];
    const hasConfiguredBanks = Array.isArray(appConfig?.paymentBanks);
    const displayIntlBanks = (hasConfiguredBanks && customIntlBanks.length > 0)
      ? customIntlBanks
      : (hasConfiguredBanks && (appConfig?.paymentBanks?.length || 0) > 0 ? [] : defaultIntlBanks);
    const defaultIntlBank = displayIntlBanks[0] || defaultIntlBanks[0];

    const currentSelectedLocalBank = localBanks.find((b: any) => b.id === selectedBankId) || defaultLocalBank;
    const currentSelectedIntlBank = (displayIntlBanks.find((b: any) => b.id === selectedBankId) || defaultIntlBank) as any;

    const intlCurrency = getBankCurrencyInfo(
      currentSelectedIntlBank,
      remittanceRates,
      appConfig?.remittanceRates,
      undefined,
      'add_money'
    );

    const foreignVal = parseFloat(depositAmount) || 0;
    // Foreign add money has no transfer fee; pure live exchange rate conversion
    const calculatedBdt = foreignCurrencyMode === 'foreign' 
      ? Math.round(foreignVal * intlCurrency.rate * 100) / 100 
      : foreignVal;

    const calculatedForeign = foreignCurrencyMode === 'foreign' 
      ? foreignVal 
      : (intlCurrency.rate > 0 ? Math.round((foreignVal / intlCurrency.rate) * 100) / 100 : 0);

    const availableAddMoneyOps: { id: string; name: string; symbol: string; circleBg: string; active: boolean; }[] = [
      { id: 'bkash', name: 'বিকাশ', symbol: 'ব', circleBg: 'bg-[#d8226e]', active: appConfig?.mfsBkashActive !== false },
      { id: 'nagad', name: 'নগদ', symbol: 'ন', circleBg: 'bg-[#f26522]', active: appConfig?.mfsNagadActive !== false },
      { id: 'rocket', name: 'রকেট', symbol: 'র', circleBg: 'bg-[#8c3494]', active: appConfig?.mfsRocketActive !== false },
      { id: 'upay', name: 'উপায়', symbol: 'উ', circleBg: 'bg-[#1b75bb]', active: appConfig?.mfsUpayActive !== false }
    ].filter(op => op.active);

    return (
      <div className="space-y-4 text-left animate-fade-in">
        {/* Back button */}
        <button 
          onClick={() => { 
            if (addMoneyOperator) {
              setAddMoneyOperator(null);
            } else if (addMoneyChannel === 'bank_deposit' && bankStep === 2) {
              setBankStep(1);
              setSelectedBankId(null);
            } else if (addMoneyChannel === 'foreign_bank' && foreignBankStep === 2) {
              setForeignBankStep(1);
              setSelectedBankId(null);
            } else if (addMoneyChannel === 'remittance' && remitStep === 2) {
              setRemitStep(1);
              setRemitSelectedBankId(null);
            } else {
              setActiveTab('dashboard'); 
              setAddMoneyOperator(null); 
              setSelectedBankId(null); 
              setRemitSelectedBankId(null);
              setBankStep(1); 
              setForeignBankStep(1);
              setRemitStep(1);
              setErrorMsg('');
              setSuccessMsg('');
            }
          }} 
          className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-black text-xs cursor-pointer transition"
        >
          <ChevronLeft className="w-4 h-4" /> ফিরে যান
        </button>

        {/* 4 Top Tabs: Local Mobile | Bank Deposit | Foreign Bank (Add Money from Abroad) | Remittance */}
        <div className="grid grid-cols-4 gap-1 bg-[#02281e]/90 border border-[#094132] p-1 rounded-xl">
          {[
            { id: 'local_mobile', label: 'লোকাল মোবাইল' },
            { id: 'bank_deposit', label: 'ব্যাংক ডিপোজিট' },
            { id: 'foreign_bank', label: 'বিদেশ থেকে এড মানি' },
            { id: 'remittance', label: 'রেমিট্যান্স 💸' }
          ].map((ch) => (
            <button 
              key={ch.id}
              onClick={() => { 
                setAddMoneyChannel(ch.id as any); 
                setAddMoneyOperator(null); 
                setBankStep(1);
                setForeignBankStep(1);
                setRemitStep(1);
                setSelectedBankId(null);
                setRemitSelectedBankId(null);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 px-0.5 text-[9px] min-[360px]:text-[10px] sm:text-xs font-bold rounded-lg transition cursor-pointer text-center truncate ${
                addMoneyChannel === ch.id 
                  ? 'bg-[#008955] text-white shadow-xs' 
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* ===================== TAB 1: LOCAL MOBILE ===================== */}
        {addMoneyChannel === 'local_mobile' && (
          <div className="space-y-4">
            {!addMoneyOperator ? (
              <div className="space-y-3.5 text-left">
                <p className="text-xs text-white/80 font-bold">
                  মোবাইল ফাইন্যান্সিয়াল ওয়ালেট সিলেক্ট করুনঃ
                </p>

                {availableAddMoneyOps.length === 0 ? (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl text-center text-amber-300 text-xs font-bold font-sans">
                    ⚠️ বর্তমানে কোনো মোবাইল ব্যাংকিং সার্ভিস সচল নেই।
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3.5">
                    {availableAddMoneyOps.map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => {
                          setAddMoneyOperator(op.id as any);
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                        className="bg-[#022c22] border border-[#0d4a39] rounded-3xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-emerald-500 hover:bg-[#03372b] transition active:scale-95 shadow-lg group"
                      >
                        <div className={`w-12 h-12 rounded-full ${op.circleBg} flex items-center justify-center text-white font-black text-xl shadow-md group-hover:scale-105 transition-transform`}>
                          {op.symbol}
                        </div>
                        <span className="text-white font-black text-sm tracking-wide">
                          {op.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* When an Operator (e.g. bKash) is selected */
              <div className="bg-white rounded-3xl p-6 text-slate-850 shadow-2xl space-y-4 animate-fade-in text-left">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-black text-indigo-950 flex items-center gap-1.5 uppercase">
                    <span className="text-red-500 text-sm">🎯</span> {addMoneyOperator.toUpperCase()} অ্যাড মানি পেমেন্ট ডিটেইলস
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setAddMoneyOperator(null)}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded-xl transition cursor-pointer"
                  >
                    পরিবর্তন
                  </button>
                </div>

                {/* Operator Details Box */}
                <div className="bg-slate-50/90 border border-slate-200/90 p-4 rounded-2xl space-y-3">
                  {/* Row 1: Service Name */}
                  <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <div>
                      <span className="text-slate-400 block uppercase font-black text-[9px]">মোবাইল ওয়ালেট / সার্ভিস</span>
                      <span className="font-black text-slate-900 text-sm uppercase">{addMoneyOperator.toUpperCase()}</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => copyToClipboard(addMoneyOperator.toUpperCase(), 'সার্ভিস নাম')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1 transition cursor-pointer active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-600" /> কপি
                    </button>
                  </div>

                  {/* Row 2: Personal Number */}
                  <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <div>
                      <span className="text-slate-400 block uppercase font-black text-[9px]">পার্সোনাল নম্বর</span>
                      <span className="font-mono text-base font-black text-slate-900 tracking-wider">
                        {formattedDisplayNum(getOperatorNumber(addMoneyOperator))}
                      </span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => copyToClipboard(cleanNumberForCopy(getOperatorNumber(addMoneyOperator)), 'অপারেটর নম্বর')}
                      className="px-3.5 py-1.5 bg-[#008955] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5 text-white" /> নম্বর কপি
                    </button>
                  </div>

                  {/* Row 3: Copy All Info */}
                  <button
                    type="button"
                    onClick={() => {
                      const fullText = "মোবাইল ওয়ালেট: " + addMoneyOperator.toUpperCase() + "\nপার্সোনাল নম্বর: " + cleanNumberForCopy(getOperatorNumber(addMoneyOperator));
                      copyToClipboard(fullText, 'ওয়ালেটের সকল তথ্য');
                    }}
                    className="w-full py-2.5 bg-[#22215b] hover:bg-[#1a1947] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer active:scale-98"
                  >
                    <Copy className="w-4 h-4 text-amber-300" /> 📋 ওয়ালেটের সকল তথ্য একসাথে কপি করুন
                  </button>
                </div>

                {/* Form Fields */}
                <form onSubmit={handleAddMoneySubmit} className="space-y-3.5 pt-1">
                  {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">ডিপোজিট পরিমাণ (৳ Amount BDT)</label>
                    <input
                      type="number"
                      required
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="৳ সর্বনিম্ন 10 BDT"
                      className="w-full px-3.5 py-3 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">প্রেরক {addMoneyOperator.toUpperCase()} নম্বর</label>
                    <input
                      type="text"
                      required
                      value={senderNumber}
                      onChange={(e) => setSenderNumber(e.target.value)}
                      placeholder="উদাঃ 017XXXXXXXX"
                      className="w-full px-3.5 py-3 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>ট্রানজেকশন আইডি (TrxID) দেওয়া বাধ্যতামূলক <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">বাধ্যতামূলক</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      placeholder="উদাঃ 8K48AL7D9 (সঠিক TrxID লিখুন)"
                      className="w-full px-3.5 py-3 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono uppercase bg-white shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">সিকিউরিটি পিন নম্বর (Wallet PIN)</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value)}
                      placeholder="4 সংখ্যার ওয়ালেট পিন"
                      className="w-full px-3.5 py-3 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono text-center tracking-widest bg-white"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3.5 bg-[#2c2777] hover:bg-[#231f61] text-white font-extrabold rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer uppercase active:scale-98"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'অ্যাড মানি রিকোয়েস্ট সাবমিট করুন ✨'
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: BANK DEPOSIT ===================== */}
        {addMoneyChannel === 'bank_deposit' && (
          <div className="space-y-4">
            {bankStep === 1 ? (
              <div className="space-y-3.5 text-left animate-fade-in">
                <p className="text-xs text-white/80 font-bold">
                  বাংলাদেশি ব্যাংক ডিপোজিট করতে নিচের যেকোনো একটি ব্যাংক বেছে নিনঃ
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {localBanks.map((bk: any, idx: number) => (
                    <button
                      key={`${bk.id}-${idx}`}
                      type="button"
                      onClick={() => { 
                        setSelectedBankId(bk.id); 
                        setBankStep(2); 
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="bg-[#edf5fd] hover:bg-[#e4effb] border border-sky-100/90 rounded-[26px] p-5.5 text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98] shadow-sm hover:shadow-md space-y-3 group"
                    >
                      <div className="text-2xl">
                        🏦
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-[#0b4ba5] group-hover:text-blue-900 leading-snug">
                          {bk.name}
                        </h4>
                        <p className="text-xs text-slate-500 font-sans font-medium mt-1">
                          {bk.branch || 'প্রধান শাখা'}
                        </p>
                      </div>
                    </button>
                  ))}
                  {localBanks.length === 0 && (
                    <div className="col-span-2 text-center py-6 text-white/60 font-bold text-xs">
                      কোনো বাংলাদেশি ব্যাংক অ্যাকাউন্ট সেটআপ করা নেই।
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Bank Account Details View */
              <div className="bg-white rounded-3xl p-6 text-slate-850 shadow-2xl space-y-4 animate-fade-in text-left">
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
                    <span className="text-red-500 text-sm">🎯</span> {currentSelectedLocalBank.name} অ্যাকাউন্ট তথ্য
                  </h3>
                  <button 
                    type="button"
                    onClick={() => {
                      setBankStep(1);
                      setSelectedBankId(null);
                    }} 
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-xl text-slate-700 font-bold transition cursor-pointer"
                  >
                    ব্যাংক পরিবর্তন
                  </button>
                </div>

                {/* Bank Details Rows */}
                <div className="bg-slate-50/90 border border-slate-200/90 p-4 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500 font-bold">ব্যাংকের নামঃ</span>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900">{currentSelectedLocalBank.name}</span>
                      <button 
                        type="button"
                        onClick={() => copyToClipboard(currentSelectedLocalBank.name, 'ব্যাংকের নাম')}
                        className="text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-slate-500" /> কপি
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500 font-bold">অ্যাকাউন্ট হোল্ডারঃ</span>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900">{currentSelectedLocalBank.holder || 'MD SUJON MIA'}</span>
                      <button 
                        type="button"
                        onClick={() => copyToClipboard(currentSelectedLocalBank.holder || 'MD SUJON MIA', 'অ্যাকাউন্ট হোল্ডার')}
                        className="text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-slate-500" /> কপি
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500 font-bold">হিসাব নম্বর (Acc No):</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 tracking-wide">{currentSelectedLocalBank.accNum}</span>
                      <button 
                        type="button"
                        onClick={() => copyToClipboard(cleanNumberForCopy(currentSelectedLocalBank.accNum), 'হিসাব নম্বর')}
                        className="text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-slate-500" /> কপি
                      </button>
                    </div>
                  </div>

                  {currentSelectedLocalBank.branch && (
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold">শাখার নাম (Branch):</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{currentSelectedLocalBank.branch}</span>
                        <button 
                          type="button"
                          onClick={() => copyToClipboard(currentSelectedLocalBank.branch, 'শাখার নাম')}
                          className="text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-slate-500" /> কপি
                        </button>
                      </div>
                    </div>
                  )}

                  {currentSelectedLocalBank.routingNum && (
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold">রাউটিং নম্বর (Routing):</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{currentSelectedLocalBank.routingNum}</span>
                        <button 
                          type="button"
                          onClick={() => copyToClipboard(cleanNumberForCopy(currentSelectedLocalBank.routingNum), 'রাউটিং নম্বর')}
                          className="text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-slate-500" /> কপি
                        </button>
                      </div>
                    </div>
                  )}

                  {currentSelectedLocalBank.visaNum && (
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold">ভিসা কার্ড নম্বর (VISA Card):</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{currentSelectedLocalBank.visaNum}</span>
                        <button 
                          type="button"
                          onClick={() => copyToClipboard(cleanNumberForCopy(currentSelectedLocalBank.visaNum), 'ভিসা কার্ড নম্বর')}
                          className="text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-slate-500" /> কপি
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const details = [
                        "ব্যাংকের নাম: " + currentSelectedLocalBank.name,
                        "অ্যাকাউন্ট হোল্ডার: " + (currentSelectedLocalBank.holder || 'MD SUJON MIA'),
                        "হিসাব নম্বর: " + currentSelectedLocalBank.accNum,
                        currentSelectedLocalBank.branch ? ("শাখা: " + currentSelectedLocalBank.branch) : '',
                        currentSelectedLocalBank.routingNum ? ("রাউটিং নম্বর: " + currentSelectedLocalBank.routingNum) : '',
                        currentSelectedLocalBank.visaNum ? ("ভিসা কার্ড নম্বর: " + currentSelectedLocalBank.visaNum) : ''
                      ].filter(Boolean).join("\n");
                      copyToClipboard(details, 'ব্যাংকের সম্পূর্ণ তথ্য');
                    }}
                    className="w-full py-2.5 mt-2 bg-[#22215b] hover:bg-[#1a1947] text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Copy className="w-4 h-4 text-amber-300" />
                    <span>📋 ব্যাংকের সকল তথ্য একসাথে কপি করুন</span>
                  </button>
                </div>

                {/* Light green notice banner */}
                <div className="bg-[#e8f7ee] border border-[#b2e5c8] text-[#046c3b] p-3.5 rounded-2xl text-[11.5px] font-medium flex items-start gap-2 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-[#008955] mt-0.5 shrink-0" />
                  <p>উপরোক্ত যেকোনো ব্যাংক চ্যানেলের মাধ্যমে ব্যালেন্স ডিপোজিট করুন। সম্পূর্ণ টাকা পাঠানো সম্পন্ন হলে নিচের রশিদের তথ্য প্রদান ফর্মটি পূরণ করে কনফার্ম করুন।</p>
                </div>

                {/* Form fields */}
                <form onSubmit={handleAddMoneySubmit} className="space-y-3.5 pt-1">
                  {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">ডিপোজিট পরিমাণ (৳ Deposit Amount BDT)</label>
                    <input
                      type="number"
                      required
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="৳ সর্বনিম্ন 10 BDT"
                      className="w-full px-3.5 py-3 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">আপনার ব্যাংক হিসাব নম্বর / মোবাইল নম্বর</label>
                    <input
                      type="text"
                      required
                      value={senderNumber}
                      onChange={(e) => setSenderNumber(e.target.value)}
                      placeholder="যে অ্যাকাউন্ট থেকে টাকা পাঠিয়েছেন"
                      className="w-full px-3.5 py-3 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>ভাউচার / ট্রানজেকশন আইডি (TrxID) দেওয়া বাধ্যতামূলক <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">বাধ্যতামূলক</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      placeholder="রশিদের ট্রানজেকশন আইডি বা রেফারেন্স"
                      className="w-full px-3.5 py-3 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono uppercase bg-white shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">সিকিউরিটি পিন নম্বর (Wallet PIN)</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value)}
                      placeholder="4 সংখ্যার ওয়ালেট পিন"
                      className="w-full px-3.5 py-3 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono text-center tracking-widest bg-white"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3.5 bg-[#2c2777] hover:bg-[#231f61] text-white font-extrabold rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer uppercase active:scale-98"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'ডিপোজিট রশিদ সাবমিট করুন ✅'
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 3: FOREIGN BANK (বিদেশ থেকে এড মানি) ===================== */}
        {addMoneyChannel === 'foreign_bank' && (
          <div className="space-y-4">
            {foreignBankStep === 1 ? (
              <div className="space-y-3.5 text-left animate-fade-in">
                <p className="text-xs text-white/80 font-bold">
                  বিদেশ থেকে এড মানি করতে নিচের যেকোনো একটি অনুমোদিত ব্যাংক বেছে নিনঃ
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {displayIntlBanks.map((bk: any, idx: number) => {
                    const bankCur = getBankCurrencyInfo(bk, remittanceRates, appConfig?.remittanceRates, undefined, 'add_money');
                    return (
                      <button
                        key={`${bk.id}-${idx}`}
                        type="button"
                        onClick={() => { 
                          setSelectedBankId(bk.id); 
                          setForeignSelectedCountryCode('');
                          setForeignBankStep(2); 
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                        className="bg-[#edf5fd] hover:bg-[#e4effb] border border-sky-100/90 rounded-[26px] p-5 text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98] shadow-sm hover:shadow-md space-y-2.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{bankCur.flag || '🏛️'}</span>
                          <span className="text-[9.5px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                            ১ {bankCur.code} = ৳{bankCur.rate.toFixed(2)} BDT
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-[#0b4ba5] group-hover:text-blue-900 leading-snug">
                            {bk.name}
                          </h4>
                          <p className="text-xs text-slate-500 font-sans font-medium mt-1 flex items-center justify-between">
                            <span>{bk.branch || `${bankCur.countryName} - বিদেশ থেকে এড মানি`}</span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {bankCur.countryName}
                            </span>
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {displayIntlBanks.length === 0 && (
                    <div className="col-span-2 text-center py-6 text-white/60 font-bold text-xs">
                      কোনো বিদেশী ব্যাংক অ্যাকাউন্ট সেটআপ করা নেই।
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Foreign Bank Details View */
              <div className="bg-white rounded-3xl p-6 text-slate-850 shadow-2xl space-y-4 animate-fade-in text-left">
                {/* Header */}
                <div className="flex justify-between items-center bg-indigo-50/70 border border-indigo-100/90 py-1.5 px-2.5 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center uppercase shrink-0 shadow-xs">
                      {currentSelectedIntlBank.acronym || 'INT'}
                    </div>
                    <div>
                      <h3 className="text-[11.5px] font-black text-indigo-950 uppercase flex items-center gap-1 leading-tight">
                        🎯 {currentSelectedIntlBank.name}
                      </h3>
                      <span className="text-[8.5px] text-indigo-700 font-extrabold block">প্রবাস / বিদেশী ব্যাংক অ্যাকাউন্ট (Foreign IBAN)</span>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      setForeignBankStep(1);
                      setSelectedBankId(null);
                    }} 
                    className="text-[10px] bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg text-slate-700 font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    ব্যাংক পরিবর্তন
                  </button>
                </div>

                {/* Bank Details Rows - Slim & Compact */}
                <div className="bg-slate-50/80 border border-slate-200/80 p-2.5 rounded-xl space-y-1 text-xs">
                  {/* Live Exchange Rate Row */}
                  <div className="flex justify-between items-center py-1 px-2 bg-gradient-to-r from-amber-50 via-emerald-50 to-teal-50 border border-emerald-300/80 rounded-lg text-xs shadow-2xs">
                    <span className="text-emerald-950 font-black text-[11px] flex items-center gap-1">
                      <span className="text-base">{intlCurrency.flag}</span>
                      <span>{intlCurrency.countryName} এক্সচেঞ্জ রেট:</span>
                    </span>
                    <span className="font-mono font-black text-emerald-900 text-[11.5px] bg-white px-2 py-0.5 rounded border border-emerald-400 shadow-2xs">
                      ১ {intlCurrency.code} = ৳{intlCurrency.rate.toFixed(2)} BDT
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60 text-[11px]">
                    <span className="text-slate-500 font-bold">ব্যাংকের নামঃ</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">{currentSelectedIntlBank.name}</span>
                      <button 
                        type="button"
                        onClick={() => copyToClipboard(currentSelectedIntlBank.name, 'ব্যাংকের নাম')}
                        className="text-[10px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Copy className="w-2.5 h-2.5 text-slate-500" /> কপি
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60 text-[11px]">
                    <span className="text-slate-500 font-bold">অ্যাকাউন্ট হোল্ডারঃ</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900">{currentSelectedIntlBank.holder || 'BUSINESS NETWORK BANGLADESH'}</span>
                      <button 
                        type="button"
                        onClick={() => copyToClipboard(currentSelectedIntlBank.holder || 'BUSINESS NETWORK BANGLADESH', 'অ্যাকাউন্ট হোল্ডার')}
                        className="text-[10px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Copy className="w-2.5 h-2.5 text-slate-500" /> কপি
                      </button>
                    </div>
                  </div>

                  {currentSelectedIntlBank.accNum && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 text-[11px]">
                      <span className="text-slate-500 font-bold">হিসাব নম্বর (Acc No):</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-slate-900">{currentSelectedIntlBank.accNum}</span>
                        <button 
                          type="button"
                          onClick={() => copyToClipboard(cleanNumberForCopy(currentSelectedIntlBank.accNum), 'হিসাব নম্বর')}
                          className="text-[10px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Copy className="w-2.5 h-2.5 text-slate-500" /> কপি
                        </button>
                      </div>
                    </div>
                  )}

                  {currentSelectedIntlBank.iban && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 text-[11px]">
                      <span className="text-slate-500 font-bold">আইবান নম্বর (IBAN):</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-slate-900">{currentSelectedIntlBank.iban}</span>
                        <button 
                          type="button"
                          onClick={() => copyToClipboard(cleanNumberForCopy(currentSelectedIntlBank.iban), 'আইবান নম্বর')}
                          className="text-[10px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Copy className="w-2.5 h-2.5 text-slate-500" /> কপি
                        </button>
                      </div>
                    </div>
                  )}

                  {currentSelectedIntlBank.branch && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 text-[11px]">
                      <span className="text-slate-500 font-bold">শাখার নাম (Branch):</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{currentSelectedIntlBank.branch}</span>
                        <button 
                          type="button"
                          onClick={() => copyToClipboard(currentSelectedIntlBank.branch, 'শাখার নাম')}
                          className="text-[10px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Copy className="w-2.5 h-2.5 text-slate-500" /> কপি
                        </button>
                      </div>
                    </div>
                  )}

                  {(currentSelectedIntlBank.routingNum || currentSelectedIntlBank.swiftCode) && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 text-[11px]">
                      <span className="text-slate-500 font-bold">রাউটিং / SWIFT:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900">{currentSelectedIntlBank.routingNum || currentSelectedIntlBank.swiftCode}</span>
                        <button 
                          type="button"
                          onClick={() => copyToClipboard(currentSelectedIntlBank.routingNum || currentSelectedIntlBank.swiftCode, 'রাউটিং/SWIFT')}
                          className="text-[10px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Copy className="w-2.5 h-2.5 text-slate-500" /> কপি
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const details = [
                        "ব্যাংকের নাম: " + currentSelectedIntlBank.name,
                        "অ্যাকাউন্ট হোল্ডার: " + (currentSelectedIntlBank.holder || 'BUSINESS NETWORK BANGLADESH'),
                        currentSelectedIntlBank.accNum ? ("হিসাব নম্বর: " + currentSelectedIntlBank.accNum) : '',
                        currentSelectedIntlBank.iban ? ("IBAN: " + currentSelectedIntlBank.iban) : '',
                        currentSelectedIntlBank.branch ? ("শাখা: " + currentSelectedIntlBank.branch) : '',
                        currentSelectedIntlBank.routingNum ? ("রাউটিং নম্বর: " + currentSelectedIntlBank.routingNum) : '',
                        currentSelectedIntlBank.swiftCode ? ("SWIFT কোড: " + currentSelectedIntlBank.swiftCode) : ''
                      ].filter(Boolean).join("\n");
                      copyToClipboard(details, 'ব্যাংকের সম্পূর্ণ তথ্য');
                    }}
                    className="w-full py-1.5 mt-1 bg-[#22215b] hover:bg-[#1a1947] text-white font-bold text-[11px] rounded-lg shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-300" />
                    <span>📋 ব্যাংকের সকল তথ্য একসাথে কপি করুন</span>
                  </button>
                </div>

                {/* Light green notice banner - Slim */}
                <div className="bg-[#e8f7ee] border border-[#b2e5c8] text-[#046c3b] py-1.5 px-2.5 rounded-xl text-[10.5px] font-medium flex items-center gap-1.5 leading-snug">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#008955] shrink-0" />
                  <p>উপরোক্ত বিদেশী ব্যাংক চ্যানেলে ডিপোজিট শেষে নিচের তথ্যগুলো দিয়ে কনফার্ম করুন।</p>
                </div>

                {/* Form fields */}
                <form onSubmit={handleAddMoneySubmit} className="space-y-2.5 pt-0.5">
                  {errorMsg && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {/* DEPOSIT AMOUNT FIELD WITH AUTO CALCULATED BANGLADESHI TAKA */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                        <span>ডিপোজিট পরিমাণ</span>
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded text-[9.5px] font-black">
                          {intlCurrency.flag} {foreignCurrencyMode === 'foreign' ? `${intlCurrency.code} (প্রবাস)` : 'BDT (বাংলাদেশ)'}
                        </span>
                      </label>

                      <div className="flex items-center gap-1">
                        <span className="text-[9.5px] font-extrabold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200 font-mono">
                          ১ {intlCurrency.code} = ৳{intlCurrency.rate.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setForeignCurrencyMode(prev => prev === 'foreign' ? 'bdt' : 'foreign');
                          }}
                          className="text-[9.5px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200 transition cursor-pointer"
                          title="কারেন্সি মোড পরিবর্তন করুন"
                        >
                          🔄 {foreignCurrencyMode === 'foreign' ? 'BDT মোড' : `${intlCurrency.code} মোড`}
                        </button>
                      </div>
                    </div>

                    {/* THE INPUT BOX WITH AUTO-CALCULATED BANGLADESHI TAKA */}
                    <div className="relative flex items-center w-full">
                      <input
                        type="number"
                        step="any"
                        required
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="এমাউন্ট বসান কত টাকা পাঠাতে চান"
                        className="w-full pl-3 pr-38 sm:pr-46 py-2 border border-slate-300 focus:border-indigo-600 rounded-xl text-sm sm:text-base font-mono font-bold bg-white text-slate-900 shadow-2xs outline-none transition"
                      />

                      {/* AUTO CONVERTED BANGLADESHI TAKA */}
                      <div 
                        id="auto-calculated-bdt-display"
                        className="absolute right-1 top-1/2 -translate-y-1/2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-2 py-1 rounded-lg shadow-xs flex items-center gap-1 font-mono text-[11px] sm:text-xs font-black tracking-tight pointer-events-none select-none border border-emerald-400/60"
                        title="এডমিন নির্ধারিত লাইভ রেট অনুযায়ী স্বয়ংক্রিয়ভাবে হিসাবকৃত বাংলাদেশি টাকা"
                      >
                        <span className="text-[8.5px] font-sans font-bold text-emerald-200 uppercase shrink-0">
                          {foreignCurrencyMode === 'foreign' ? 'বাংলাদেশি:' : 'প্রবাস:'}
                        </span>
                        <span className="text-amber-200 font-extrabold whitespace-nowrap">
                          {foreignCurrencyMode === 'foreign'
                            ? `৳ ${calculatedBdt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} BDT`
                            : `${calculatedForeign} ${intlCurrency.code}`}
                        </span>
                      </div>
                    </div>

                    {/* Compact helper text directly under the input */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium px-1">
                      <span>এমাউন্ট বসান কত টাকা পাঠাতে চান</span>
                      <span className="text-emerald-700 font-bold">✓ কোনো অতিরিক্ত চার্জ নেই (এড মানি ফ্রি)</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">আপনার প্রেরক হিসাব / আইবান / একাউন্ট নম্বর</label>
                    <input
                      type="text"
                      required
                      value={senderNumber}
                      onChange={(e) => setSenderNumber(e.target.value)}
                      placeholder="প্রবাস থেকে যে অ্যাকাউন্ট/আইবান থেকে টাকা পাঠিয়েছেন"
                      className="w-full px-3 py-2 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-800 flex items-center justify-between">
                      <span>ট্রানজেকশন আইডি / রেফারেন্স (TrxID) <span className="text-rose-500">*</span></span>
                      <span className="text-[9.5px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded-full border border-rose-200">বাধ্যতামূলক</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      placeholder="ট্রানজেকশন আইডি বা রেফারেন্স লিখুন"
                      className="w-full px-3 py-2 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono uppercase bg-white shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">সিকিউরিটি পিন নম্বর (Wallet PIN)</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value)}
                      placeholder="4 সংখ্যার ওয়ালেট পিন"
                      className="w-full px-3 py-2 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono text-center tracking-widest bg-white"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-2.5 bg-[#2c2777] hover:bg-[#231f61] text-white font-extrabold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer uppercase active:scale-98"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'ডিপোজিট রশিদ সাবমিট করুন ✅'
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 4: REMITTANCE (প্রবাসী রেমিট্যান্স ও ২.৫% সরকারি প্রণোদনা) ===================== */}
        {addMoneyChannel === 'remittance' && renderRemittanceSection()}
      </div>
    );
  };


  const renderSendMoney = () => {
    const mfsList = [
      { id: 'bkash_send', label: 'বিকাশ সেন্ডমানি', operator: 'bkash', active: appConfig?.mfsBkashActive !== false, type: 'SendMoney', logoText: 'bK', color: 'bg-pink-600', hoverColor: 'hover:bg-pink-700', textClr: 'text-pink-600' },
      { id: 'nagad_send', label: 'নগদ সেন্ডমানি', operator: 'nagad', active: appConfig?.mfsNagadActive !== false, type: 'SendMoney', logoText: 'ন', color: 'bg-orange-600', hoverColor: 'hover:bg-orange-700', textClr: 'text-orange-600' },
      { id: 'rocket_send', label: 'রকেট সেন্ডমানি', operator: 'rocket', active: appConfig?.mfsRocketActive !== false, type: 'SendMoney', logoText: 'র', color: 'bg-purple-600', hoverColor: 'hover:bg-purple-700', textClr: 'text-purple-600' },
      { id: 'upay_send', label: 'উপায় সেন্ডমানি', operator: 'upay', active: appConfig?.mfsUpayActive !== false, type: 'SendMoney', logoText: 'উ', color: 'bg-blue-600', hoverColor: 'hover:bg-blue-700', textClr: 'text-blue-600' },
    ].filter(op => op.active);

    const allPaymentBanks = appConfig?.paymentBanks || [];
    const configuredLocalBanks = allPaymentBanks.filter(b => !b.isInternational && b.active !== false && b.sendMoneyActive !== false);

    const defaultLocalBanks = [
      { id: 'dbbl', name: 'Dutch-Bangla Bank', label: 'DBBL ব্যাংক', logoText: 'DB', color: 'bg-blue-800', hoverColor: 'hover:bg-blue-900', textClr: 'text-blue-800' },
      { id: 'sonali', name: 'Sonali Bank', label: 'সোনালী ব্যাংক', logoText: 'সো', color: 'bg-emerald-700', hoverColor: 'hover:bg-emerald-800', textClr: 'text-emerald-700' },
      { id: 'islami', name: 'Islami Bank', label: 'ইসলামী ব্যাংক', logoText: 'ই', color: 'bg-green-700', hoverColor: 'hover:bg-green-800', textClr: 'text-green-700' },
      { id: 'city', name: 'City Bank', label: 'সিটি ব্যাংক', logoText: 'সি', color: 'bg-amber-700', hoverColor: 'hover:bg-amber-800', textClr: 'text-amber-700' },
      { id: 'brac', name: 'BRAC Bank', label: 'ব্র্যাক ব্যাংক', logoText: 'ব্র্যা', color: 'bg-blue-900', hoverColor: 'hover:bg-blue-950', textClr: 'text-blue-900' },
      { id: 'pubali', name: 'Pubali Bank', label: 'পূবালী ব্যাংক', logoText: 'পূ', color: 'bg-teal-800', hoverColor: 'hover:bg-teal-900', textClr: 'text-teal-800' }
    ];

    const bankList = configuredLocalBanks.length > 0
      ? configuredLocalBanks.map(b => ({
          id: b.id,
          name: b.name,
          label: b.name,
          logoText: b.acronym || 'BK',
          color: b.bgClass || 'bg-slate-800',
          hoverColor: 'hover:bg-slate-900',
          textClr: b.textClass || 'text-slate-800'
        }))
      : defaultLocalBanks;

    const configuredForeignBanks = allPaymentBanks.filter(b => b.isInternational === true && b.active !== false && b.sendMoneyActive !== false);

    const defaultForeignBanks = [
      { id: 'snb_saudi', name: 'SAUDI NATIONAL BANK (SNB ALAHLI)', label: 'SAUDI NATIONAL BANK (SNB)', logoText: 'SNB', color: 'bg-indigo-900', hoverColor: 'hover:bg-indigo-950', textClr: 'text-indigo-900' },
      { id: 'enbd_dubai', name: 'EMIRATES NBD BANK (DUBAI)', label: 'EMIRATES NBD BANK (DUBAI)', logoText: 'ENBD', color: 'bg-slate-800', hoverColor: 'hover:bg-slate-900', textClr: 'text-slate-800' },
      { id: 'rajhi_saudi', name: 'AL RAJHI BANK (সৌদি ব্যাংক)', label: 'AL RAJHI BANK (সৌদি ব্যাংক)', logoText: 'RAJHI', color: 'bg-sky-800', hoverColor: 'hover:bg-sky-900', textClr: 'text-sky-800' },
      { id: 'qnb_qatar', name: 'QATAR NATIONAL BANK (QNB)', label: 'QATAR NATIONAL BANK (QNB)', logoText: 'QNB', color: 'bg-purple-900', hoverColor: 'hover:bg-purple-950', textClr: 'text-purple-900' }
    ];

    const foreignBankList = configuredForeignBanks.length > 0
      ? configuredForeignBanks.map(b => ({
          id: b.id,
          name: b.name,
          label: b.name,
          logoText: b.acronym || 'INT',
          color: b.bgClass || 'bg-indigo-900',
          hoverColor: 'hover:bg-indigo-950',
          textClr: b.textClass || 'text-indigo-900'
        }))
      : defaultForeignBanks;

    return (
      <div className="space-y-4 text-left">
        <button 
          onClick={() => { 
            if (sendMoneyChannel === 'remittance' && remitStep === 2) {
              setRemitStep(1);
              setRemitSelectedBankId(null);
            } else {
              setActiveTab('dashboard'); 
              setSelectedMobileOp(null); 
              setSelectedBankOp(null); 
              setRemitStep(1);
              setRemitSelectedBankId(null);
              setErrorMsg('');
              setSuccessMsg('');
            }
          }} 
          className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-black text-xs cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> ফিরে যান
        </button>

        {/* Select Channel */}
        <div className="grid grid-cols-4 gap-1 bg-[#02281e]/90 border border-[#094132] p-1 rounded-xl">
          {[
            { id: 'mobile_bank', label: 'মোবাইল ব্যাংক' },
            { id: 'bank_wallet', label: 'বাংলাদেশি ব্যাংক' },
            { id: 'abroad', label: 'বিদেশি ব্যাংক' },
            { id: 'remittance', label: 'রেমিট্যান্স 💸' }
          ].map((ch) => (
            <button 
              key={ch.id}
              onClick={() => { 
                setSendMoneyChannel(ch.id as any); 
                setErrorMsg(''); 
                setSuccessMsg(''); 
                setSelectedMobileOp(null);
                setSelectedBankOp(null);
                setRemitStep(1);
                setRemitSelectedBankId(null);
              }}
              className={`py-2 px-0.5 text-[9px] min-[360px]:text-[10px] sm:text-xs font-bold rounded-lg transition cursor-pointer text-center truncate ${
                sendMoneyChannel === ch.id 
                  ? 'bg-[#008955] text-white shadow-xs' 
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {sendMoneyChannel === 'remittance' ? (
          renderRemittanceSection()
        ) : sendMoneyChannel === 'abroad' ? (
           // FOREIGN BANK CHANNEL
          !selectedBankOp ? (
            <div className="bg-white rounded-3xl p-5 text-slate-800 shadow-lg space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
                  🌍 আন্তর্জাতিক ও প্রবাসী ব্যাংক সেন্ড মানি
                </h3>
              </div>
              <p className="text-[10.5px] text-slate-500 -mt-1 leading-relaxed font-sans">
                নিচের যেকোনো বিদেশি ব্যাংকে ট্যাপ করে প্রবাস থেকে রেমিট্যান্স বা ফান্ড স্থানান্তর আবেদন করুনঃ
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {foreignBankList.map((bank, idx) => (
                  <button
                    key={`${bank.id}-${idx}`}
                    onClick={() => {
                      setSelectedBankOp(bank.id);
                      setSendBankName(bank.name);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="p-3.5 rounded-2xl border border-slate-150 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-300 transition text-left cursor-pointer flex items-center gap-3 shadow-3xs group active:scale-98"
                  >
                    <div className={`w-9 h-9 rounded-xl ${bank.color} text-white flex items-center justify-center font-black text-[10px] uppercase shrink-0 shadow-xs relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-white/5 group-hover:scale-110 transition duration-300" />
                      {bank.logoText}
                    </div>
                    <div className="min-w-0">
                      <span className={`text-[10.5px] font-extrabold block text-slate-800 leading-tight group-hover:${bank.textClr} transition`}>
                        {bank.label}
                      </span>
                      <span className="text-[8.5px] text-slate-450 font-bold block mt-0.5">
                        বক্স টিপুন 🌐
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
// Foreign Bank Form (Step 2)
            <div className="bg-white rounded-3xl p-5 text-slate-800 shadow-lg space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <button 
                  onClick={() => setSelectedBankOp(null)} 
                  className="flex items-center gap-1 text-slate-600 hover:text-indigo-900 font-extrabold text-[10.5px] cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> বিদেশি ব্যাংক তালিকায় ফিরুন
                </button>
                <span className="bg-slate-100 text-slate-700 text-[8.5px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                  রেমিট্যান্স ফর্ম (Step 2)
                </span>
              </div>

              {(() => {
                const bank = foreignBankList.find(b => b.id === selectedBankOp);
                return (
                  <div className="bg-indigo-50 border border-indigo-150 p-3 rounded-xl flex items-center gap-3 shadow-3xs">
                    <div className={`w-8.5 h-8.5 rounded-lg ${bank?.color || 'bg-indigo-900'} text-white flex items-center justify-center font-black text-[10px] uppercase shrink-0`}>
                      {bank?.logoText || 'INT'}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800">{bank?.label || sendBankName} স্থানান্তর ফর্ম</h4>
                      <p className="text-[9.5px] text-slate-500 mt-0.5 font-semibold leading-none">
                        আন্তর্জাতিক রেমিট্যান্স ক্লিয়ারিং হাউজ নেটওয়ার্ক
                      </p>
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleSendMoneySubmit} className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-600">প্রাপকের নাম (Beneficiary Name)</label>
                    <input
                      type="text"
                      required
                      value={sendAccTitle}
                      onChange={(e) => setSendAccTitle(e.target.value)}
                      placeholder="অ্যাকাউন্ট টাইটেল / নাম"
                      className="w-full px-2.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-600">হিসাব নম্বর / IBAN</label>
                    <input
                      type="text"
                      required
                      value={sendAccNo}
                      onChange={(e) => setSendAccNo(e.target.value)}
                      placeholder="একউন্ট নম্বর / IBAN"
                      className="w-full px-2.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-600">ব্যাংক ও দেশ (Bank & Country)</label>
                    <input
                      type="text"
                      value={sendBankName}
                      onChange={(e) => setSendBankName(e.target.value)}
                      placeholder="উদাঃ SNB, Saudi Arabia"
                      className="w-full px-2.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-600">যোগাযোগ / WhatsApp Log</label>
                    <input
                      type="text"
                      value={sendWhatsapp}
                      onChange={(e) => setSendWhatsapp(e.target.value)}
                      placeholder="উদাঃ +966XXXXXXX"
                      className="w-full px-2.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-slate-600">রেমিট্যান্স পরিমাণ (৳ BDT)</label>
                    <input
                      type="number"
                      required
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="৳ টাকা পরিমাণ"
                      className="w-full px-3.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-slate-600">ওয়ালেট পিন (Wallet PIN)</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value)}
                      placeholder="4 সংখ্যার পিন"
                      className="w-full px-3.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono text-center tracking-widest"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-3 bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer uppercase font-sans mt-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'বিদেশি ব্যাংক রেমিট্যান্স আবেদন সাবমিট করুন ⚡'
                  )}
                </button>
              </form>
            </div>
          )
        ) : sendMoneyChannel === 'mobile_bank' ? (
/* MOBILE BANK CHANNEL */
          !selectedMobileOp ? (
            <div className="bg-white rounded-3xl p-5 text-slate-800 shadow-lg space-y-4">
              <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                <h3 className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
                  🎯 মোবাইল ফাইনান্সিয়াল স্থানান্তর
                </h3>
              </div>
              <p className="text-[10.5px] text-slate-500 -mt-1 leading-relaxed font-sans">
                নিচের যেকোনো একটি বক্সে ট্যাপ করে ফান্ড স্থানান্তরের কাজ শুরু করুন। প্রতিটি অপারেটরের জন্য কাস্টম স্থানান্তর সুবিধা রয়েছেঃ
              </p>
              
              <div className="grid grid-cols-2 gap-3 pt-1">
                {mfsList.map((op, idx) => (
                  <button
                    key={`${op.id}-${idx}`}
                    onClick={() => {
                      setSelectedMobileOp(op.id);
                      setSendTargetOperator(op.operator as any);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="p-3.5 rounded-2xl border border-slate-150 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-300 transition text-left cursor-pointer flex items-center gap-3 shadow-3xs group active:scale-98"
                  >
                    <div className={`w-9 h-9 rounded-xl ${op.color} text-white flex items-center justify-center font-black text-xs uppercase shrink-0 shadow-xs relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-white/5 group-hover:scale-110 transition duration-300" />
                      {op.logoText}
                    </div>
                    <div className="min-w-0">
                      <span className={`text-[10.5px] font-extrabold block text-slate-800 leading-tight group-hover:${op.textClr} transition`}>
                        {op.label}
                      </span>
                      <span className="text-[8.5px] text-slate-450 font-bold block mt-0.5 font-mono">
                        {op.type === 'CashOut' ? 'Cash Out (৳3.90)' : 'Send Money'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-5 text-slate-800 shadow-lg space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <button 
                  onClick={() => setSelectedMobileOp(null)} 
                  className="flex items-center gap-1 text-slate-600 hover:text-indigo-900 font-extrabold text-[10.5px] cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> অপারেটর তালিকায় ফিরুন
                </button>
                <span className="bg-slate-100 text-slate-700 text-[8.5px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                  স্থানান্তর ফর্ম (Step 2)
                </span>
              </div>

              {(() => {
                const op = mfsList.find(o => o.id === selectedMobileOp);
                if (!op) return null;
                return (
                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex items-center gap-3 shadow-3xs">
                    <div className={`w-8.5 h-8.5 rounded-lg ${op.color} text-white flex items-center justify-center font-black text-xs uppercase shrink-0`}>
                      {op.logoText}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800">{op.label} ফর্ম</h4>
                      <p className="text-[9.5px] text-slate-450 mt-0.5 font-semibold leading-none">
                        {op.type === 'CashOut' ? 'ক্যাশ আউট গেটওয়ে পোর্টাল' : 'সেন্ড মানি গেটওয়ে পোর্টাল'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleSendMoneySubmit} className="space-y-3.5 pt-1">
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-600">গ্রহীতার মোবাইল নম্বর</label>
                  <input
                    type="text"
                    required
                    value={sendTargetNumber}
                    onChange={(e) => setSendTargetNumber(e.target.value)}
                    placeholder="উদাঃ 017XXXXXXXX"
                    className="w-full px-3.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-600">স্থানান্তর পরিমাণ (৳ BDT)</label>
                    <input
                      type="number"
                      required
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="৳ সর্বনিম্ন 10 BDT"
                      className="w-full px-3.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-600">ওয়ালেট পিন (Wallet PIN)</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value)}
                      placeholder="4 সংখ্যার পিন"
                      className="w-full px-3.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono text-center tracking-widest"
                    />
                  </div>
                </div>

                {chargeInfo.total > 0 && (
                  <div className="bg-indigo-50 border border-indigo-150 p-3 rounded-2xl text-[10px] font-bold text-indigo-900 space-y-1">
                    <div className="flex justify-between"><span>NPSB Charge:</span><span>৳ {chargeInfo.flat.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Service Charge:</span><span>৳ {chargeInfo.service.toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-indigo-200 pt-1 mt-1"><span>Total Charge:</span><span className="font-extrabold text-rose-600">৳ {chargeInfo.total.toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-indigo-200 pt-1 mt-1"><span>Recipient Gets (প্রাপক পাবেন):</span><span className="font-extrabold text-emerald-600">৳ {Number(sendAmount).toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-indigo-200 pt-1 mt-1"><span>Total Payable (চার্জসহ মোট কর্তন):</span><span className="font-extrabold text-indigo-900">৳ {(Number(sendAmount) + chargeInfo.total).toFixed(2)}</span></div>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-3 bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer uppercase font-sans mt-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'নিরাপদ স্থানান্তরের আবেদন সাবমিট করুন ⚡'
                  )}
                </button>
              </form>
            </div>
          )
        ) : (
          !selectedBankOp ? (
            <div className="bg-white rounded-3xl p-5 text-slate-800 shadow-lg space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
                  🎯 ব্যাংক ওয়ালেট সেটেলমেন্ট স্থানান্তর
                </h3>
              </div>
              <p className="text-[10.5px] text-slate-500 -mt-1 leading-relaxed font-sans">
                তালিকায় থাকা যেকোনো একটি ব্যাংকের বক্সে চাপ দিয়ে আপনার বা প্রিয়জনের অ্যাকাউন্টে সরাসরি টাকা স্থানান্তর শুরু করুনঃ
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {bankList.map((bank, idx) => (
                  <button
                    key={`${bank.id}-${idx}`}
                    onClick={() => {
                      setSelectedBankOp(bank.id);
                      setSendBankName(bank.name);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="p-3.5 rounded-2xl border border-slate-150 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-300 transition text-left cursor-pointer flex items-center gap-3 shadow-3xs group active:scale-98"
                  >
                    <div className={`w-9 h-9 rounded-xl ${bank.color} text-white flex items-center justify-center font-black text-[11px] uppercase shrink-0 shadow-xs relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-white/5 group-hover:scale-110 transition duration-300" />
                      {bank.logoText}
                    </div>
                    <div className="min-w-0">
                      <span className={`text-[10.5px] font-extrabold block text-slate-800 leading-tight group-hover:${bank.textClr} transition`}>
                        {bank.label}
                      </span>
                      <span className="text-[8.5px] text-slate-450 font-bold block mt-0.5">
                        বক্স টিপুন 🏦
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-5 text-slate-800 shadow-lg space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <button 
                  onClick={() => setSelectedBankOp(null)} 
                  className="flex items-center gap-1 text-slate-600 hover:text-indigo-900 font-extrabold text-[10.5px] cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> ব্যাংক তালিকায় ফিরুন
                </button>
                <span className="bg-slate-100 text-slate-700 text-[8.5px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                  স্থানান্তর ফর্ম (Step 2)
                </span>
              </div>

              {(() => {
                const bank = bankList.find(b => b.id === selectedBankOp);
                return (
                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex items-center gap-3 shadow-3xs">
                    <div className={`w-8.5 h-8.5 rounded-lg ${bank?.color || 'bg-slate-800'} text-white flex items-center justify-center font-black text-[10px] uppercase shrink-0`}>
                      {bank?.logoText || 'BK'}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800">{bank?.label || sendBankName} স্থানান্তর ফর্ম</h4>
                      <p className="text-[9.5px] text-slate-450 mt-0.5 font-semibold leading-none">
                        ব্যাংক ক্লিয়ারিং হাউজ গেটওয়ে সেটেলমেন্ট
                      </p>
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleSendMoneySubmit} className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-600">হিসাবের নাম (Account Title)</label>
                    <input
                      type="text"
                      required
                      value={sendAccTitle}
                      onChange={(e) => setSendAccTitle(e.target.value)}
                      placeholder="অ্যাকাউন্ট টাইটেল"
                      className="w-full px-2.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-600">হিসাব নম্বর (Account Number)</label>
                    <input
                      type="text"
                      required
                      value={sendAccNo}
                      onChange={(e) => setSendAccNo(e.target.value)}
                      placeholder="অ্যাকাউন্ট হিসাব নম্বর"
                      className="w-full px-2.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-600">শাখার নাম (Branch)</label>
                    <input
                      type="text"
                      value={sendBranch}
                      onChange={(e) => setSendBranch(e.target.value)}
                      placeholder="ব্রাঞ্চ নাম"
                      className="w-full px-2.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-600">রাউটিং নং (Routing Number)</label>
                    <input
                      type="text"
                      value={sendRouting}
                      onChange={(e) => setSendRouting(e.target.value)}
                      placeholder="রাউটিং নম্বর"
                      className="w-full px-2.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-600">হোয়াটসঅ্যাপ নম্বর (WhatsApp Log)</label>
                  <input
                    type="text"
                    value={sendWhatsapp}
                    onChange={(e) => setSendWhatsapp(e.target.value)}
                    placeholder="উদাঃ 017XXXXXXXX"
                    className="w-full px-2.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-slate-600">স্থানান্তর পরিমাণ (৳ BDT)</label>
                    <input
                      type="number"
                      required
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="৳ সর্বনিম্ন 10 BDT"
                      className="w-full px-3.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-slate-600">ওয়ালেট পিন (Wallet PIN)</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value)}
                      placeholder="4 সংখ্যার পিন"
                      className="w-full px-3.5 py-2.5 border border-slate-205 focus:border-indigo-500 rounded-xl text-xs font-mono text-center tracking-widest"
                    />
                  </div>
                </div>

                {chargeInfo.total > 0 && (
                  <div className="bg-indigo-50 border border-indigo-150 p-3 rounded-2xl text-[10px] font-bold text-indigo-900 space-y-1">
                    <div className="flex justify-between"><span>NPSB Charge:</span><span>৳ {chargeInfo.flat.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Service Charge:</span><span>৳ {chargeInfo.service.toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-indigo-200 pt-1 mt-1"><span>Total Charge:</span><span className="font-extrabold text-rose-600">৳ {chargeInfo.total.toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-indigo-200 pt-1 mt-1"><span>Recipient Gets (প্রাপক পাবেন):</span><span className="font-extrabold text-emerald-600">৳ {Number(sendAmount).toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-indigo-200 pt-1 mt-1"><span>Total Payable (চার্জসহ মোট কর্তন):</span><span className="font-extrabold text-indigo-900">৳ {(Number(sendAmount) + chargeInfo.total).toFixed(2)}</span></div>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-3 bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer uppercase font-sans mt-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'নিরাপদ স্থানান্তরের আবেদন সাবমিট করুন ⚡'
                  )}
                </button>
              </form>
            </div>
          )
)}
      </div>
    );
  };

  const renderBillPay = () => {
     // Categories matching the visual layout of the reference image with rich details
    const categories = [
      { 
        id: 'electricity', 
        label: 'বিদ্যুৎ বিল', 
        enLabel: 'Electricity Bill', 
        icon: Lightbulb, 
        bg: 'bg-[#fef9f3]', 
        activeBg: 'bg-amber-500', 
        iconColor: 'text-amber-500',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
        description: 'ডেসকো (DESCO), ডিপিডিসি (DPDC), পল্লী বিদ্যুৎ (REB), নেসকো (NESCO), ওজোপাডিকো (WZPDCL) ও পিডিবি (BPDB) সহ বাংলাদেশের সকল বিদ্যুৎ বণ্টনকারী সংস্থার প্রিপেইড ও পোস্টপেইড বিল নিরাপদে পরিশোধ করুন।'
      },
      { 
        id: 'gas', 
        label: 'গ্যাস বিল', 
        enLabel: 'Gas Bill', 
        icon: Flame, 
        bg: 'bg-[#fef2f2]', 
        activeBg: 'bg-rose-500', 
        iconColor: 'text-rose-500',
        badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
        description: 'তিতাস গ্যাস, বাখরাবাদ গ্যাস, জালালাবাদ গ্যাস, কর্ণফুলী গ্যাস ও সুন্দরবন গ্যাস কোম্পানির প্রিপেইড কার্ড মিটার ও পোস্টপেইড আবাসিক/বাণিজ্যিক লাইনের বিল পরিশোধ করুন।'
      },
      { 
        id: 'water', 
        label: 'পানি বিল', 
        enLabel: 'Water Bill', 
        icon: Droplet, 
        bg: 'bg-[#f0f9ff]', 
        activeBg: 'bg-blue-500', 
        iconColor: 'text-blue-500',
        badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
        description: 'ঢাকা ওয়াসা (Dhaka WASA), চট্টগ্রাম ওয়াসা (Ctg WASA), খুলনা ওয়াসা ও রাজশাহী ওয়াসা সহ দেশের সকল আঞ্চলিক স্বীকৃত পানি সরবরাহ কর্তৃপক্ষের মাসিক বিল তাৎক্ষণিক প্রদান করুন।'
      },
      { 
        id: 'internet', 
        label: 'ইন্টারনেট বিল', 
        enLabel: 'Internet Bill', 
        icon: Wifi, 
        bg: 'bg-[#faf5ff]', 
        activeBg: 'bg-purple-500', 
        iconColor: 'text-purple-500',
        badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
        description: 'লিংক থ্রি (Link3), আম্বার আইটি (Amber IT), কার্নিভাল (Carnival) সহ দেশের সকল অনুমোদিত ব্রডব্যান্ড আইএসপি এবং ওয়াইফাই সংযোগের বিল পরিশোধ ও প্যাকেজ রিনিউ করুন।'
      },
      { 
        id: 'tv', 
        label: 'টিভি বিল', 
        enLabel: 'TV Bill', 
        icon: Tv, 
        bg: 'bg-[#fdf2f8]', 
        activeBg: 'bg-pink-500', 
        iconColor: 'text-pink-500',
        badgeBg: 'bg-pink-100 text-pink-800 border-pink-300',
        description: 'আকাশ ডিটিএইচ (Akash DTH) ও স্থানীয় ডিজিটাল ক্যাবল টিভির রিচার্জ ও মাসিক সাবস্ক্রিপশন চার্জ ঘরে বসেই সহজে সম্পন্ন করুন।'
      },
      { 
        id: 'telephone', 
        label: 'টেলিফোন বিল', 
        enLabel: 'Telephone Bill', 
        icon: Smartphone, 
        bg: 'bg-[#f0fdfa]', 
        activeBg: 'bg-teal-500', 
        iconColor: 'text-teal-500',
        badgeBg: 'bg-teal-100 text-teal-800 border-teal-300',
        description: 'বিটিসিএল (BTCL) ল্যান্ডলাইন, সরকারি ফিক্সড ফোন ও ল্যান্ডলাইন ব্রডব্যান্ড লাইনের ব্যবহারিক বিল প্রদান করুন।'
      }
    ];

     // Selected Category Object if on category sub-page
    const activeCatObj = categories.find(c => c.id === billCategory);

     // Global search matching providers across all categories if user types in search box on home page
    const globalSearchProviders = billSearchQuery.trim()
      ? billProviders.filter(p =>
          p.label.toLowerCase().includes(billSearchQuery.toLowerCase()) ||
          p.name.toLowerCase().includes(billSearchQuery.toLowerCase()) ||
          (p.enLabel && p.enLabel.toLowerCase().includes(billSearchQuery.toLowerCase()))
        )
      : [];

     // Filtered providers for the active category sub-page
    const activeCatProviders = billCategory
      ? billProviders.filter(p => p.category === billCategory && (
          !billSearchQuery ||
          p.label.toLowerCase().includes(billSearchQuery.toLowerCase()) ||
          (p.enLabel && p.enLabel.toLowerCase().includes(billSearchQuery.toLowerCase()))
        ))
      : [];

    return (
      <div className="space-y-4 text-left font-sans">
        {/* SUB-PAGE 1: BILL PAYMENT FORM SCREEN */}
        {selectedBillProvider ? (
          <div className="bg-white rounded-3xl p-5 text-slate-800 space-y-4 animate-fade-in shadow-lg border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <button 
                onClick={() => setSelectedBillProvider(null)} 
                className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-black text-xs cursor-pointer bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200"
              >
                <ChevronLeft className="w-4 h-4" /> প্রতিষ্ঠানের তালিকায় ফিরে যান
              </button>
              <button 
                type="button"
                onClick={() => setSelectedBillProvider(null)} 
                className="text-[9.5px] bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-xl text-slate-700 font-black transition cursor-pointer"
              >
                পরিবর্তন
              </button>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs font-black">
                ⚡
              </div>
              <div>
                <h3 className="text-xs font-black text-indigo-950 uppercase">{selectedBillProvider.label} পরিশোধ ফরম</h3>
                <p className="text-[10.5px] text-slate-500 font-bold">সঠিক তথ্য প্রদান করে আপনার চলতি মাস বা বকেয়া বিলটি পরিশোধ সম্পন্ন করুন</p>
              </div>
            </div>

            <form onSubmit={handleBillPaySubmit} className="space-y-4 pt-1">
              {/* Account Number input field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">কাস্টমার আইডি / বিল অ্যাকাউন্ট নম্বর</label>
                <input
                  type="text"
                  required
                  value={billAccNo}
                  onChange={(e) => setBillAccNo(e.target.value)}
                  placeholder="বিল রশিদের অ্যাকাউন্ট নং যেমনঃ 102485903"
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {/* Month input field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">বিলের মাস ও বছর</label>
                  <button
                    type="button"
                    onClick={() => setShowMonthPopup(true)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold flex items-center justify-between outline-none text-left"
                  >
                    <span>{billMonth ? `${billMonth}` : 'মাস নির্বাচন করুন'}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Month Picker Popup modal */}
                {showMonthPopup && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white text-slate-800 w-full max-w-sm rounded-3xl shadow-xl p-5 space-y-4">
                      <h3 className="text-sm font-black text-slate-900">মাস নির্বাচন করুন</h3>
                      <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
                        {[
                          { en: 'January 2026', bn: 'জানুয়ারি 2026' },
                          { en: 'February 2026', bn: 'ফেব্রুয়ারি 2026' },
                          { en: 'March 2026', bn: 'মার্চ 2026' },
                          { en: 'April 2026', bn: 'এপ্রিল 2026' },
                          { en: 'May 2026', bn: 'মে 2026' },
                          { en: 'June 2026', bn: 'জুন 2026' },
                          { en: 'July 2026', bn: 'জুলাই 2026' },
                          { en: 'August 2026', bn: 'আগস্ট 2026' },
                          { en: 'September 2026', bn: 'সেপ্টেম্বর 2026' },
                          { en: 'October 2026', bn: 'অক্টোবর 2026' },
                          { en: 'November 2026', bn: 'নভেম্বর 2026' },
                          { en: 'December 2026', bn: 'ডিসেম্বর 2026' },
                        ].map((m) => (
                          <button
                            key={m.en}
                            type="button"
                            onClick={() => {
                              setBillMonth(m.en);
                              setShowMonthPopup(false);
                            }}
                            className={`w-full flex items-center justify-between p-3 border rounded-xl text-xs ${billMonth === m.en ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
                          >
                            <span className="font-bold text-slate-800">{m.en} ({m.bn})</span>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${billMonth === m.en ? 'border-emerald-500' : 'border-slate-300'}`}>
                              {billMonth === m.en && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                            </div>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMonthPopup(false)}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                      >
                        বন্ধ করুন
                      </button>
                    </div>
                  </div>
                )}

                {/* Amount input field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">বিল পরিমাণ (৳ Amount)</label>
                  <input
                    type="number"
                    required
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    placeholder="৳ সর্বনিম্ন 10 BDT"
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono font-bold text-indigo-900 outline-none"
                  />
                </div>
              </div>

              {/* Bill Receipt Photo attachment section */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Image className="w-4.5 h-4.5 text-pink-600" /> বিল বা রশিদের ছবি সংযুক্ত করুন (প্রমাণস্বরূপ)
                </label>
                
                {!billImage ? (
                  <div className="relative group">
                    <input
                      type="file"
                      id="bill-receipt-upload"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') {
                              setBillImage(reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="bill-receipt-upload"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-slate-250 hover:border-pink-500 rounded-2xl p-6 bg-slate-50 hover:bg-slate-100/50 text-center cursor-pointer transition duration-150"
                    >
                      <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-pink-500 group-hover:scale-105 transition-all mb-2" />
                      <span className="text-xs font-black text-slate-800">রশিদের ছবি ড্রপ করুন বা ক্লিক করে সংযুক্ত করুন</span>
                      <span className="text-[9.5px] text-slate-400 mt-1 font-bold">JPEG, PNG বা WebP ছবি সিলেক্ট করতে পারবেন</span>
                    </label>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-emerald-50/40 p-3.5 flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300 bg-white shadow-xs flex-shrink-0">
                        <img src={billImage} alt="Uploaded bill receipt" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> ছবি সংযুক্ত হয়েছে!
                        </p>
                        <p className="text-[9.5px] text-slate-500 font-bold mt-0.5">এডমিন এই বিলের ছবি দেখে পেমেন্ট ভেরিফাই করবেন</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBillImage('')}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition flex items-center justify-center flex-shrink-0 cursor-pointer"
                      title="ছবি মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* PIN input field */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold text-slate-700">ওয়ালেট পিন নম্বর (Security PIN)</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={securityPin}
                  onChange={(e) => setSecurityPin(e.target.value)}
                  placeholder="4 সংখ্যার গোপন ওয়ালেট পিন"
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono text-center tracking-widest outline-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer uppercase font-sans mt-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'নিরাপদ বিল পরিশোধ সম্পন্ন করুন ⚡'
                )}
              </button>
            </form>
          </div>
        ) : billCategory && activeCatObj ? (
          /* SUB-PAGE 2: DEDICATED CATEGORY SUB-PAGE WITH DETAILS AT TOP */
          <div className="space-y-4 animate-fade-in">
            {/* Top Navigation Back Button */}
            <button 
              onClick={() => { setBillCategory(null); setBillSearchQuery(''); }} 
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-black text-xs cursor-pointer bg-slate-800/80 px-3 py-1.5 rounded-xl border border-emerald-500/20 shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" /> পে বিল ক্যাটাগরিতে ফিরে যান
            </button>

            {/* TOP DETAILED INFO BANNER CARD (পেজের উপরে বিস্তারিত) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xl space-y-3 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${activeCatObj.activeBg} text-white shrink-0`}>
                    <activeCatObj.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-wider uppercase text-slate-400 block">ক্যাটাগরি পেজ</span>
                    <h2 className="text-base font-black text-indigo-950 leading-tight">{activeCatObj.label} সেকশন</h2>
                  </div>
                </div>
                <span className={`text-[9.5px] font-black px-3 py-1 rounded-full border ${activeCatObj.badgeBg}`}>
                  {activeCatObj.enLabel}
                </span>
              </div>

              {/* DETAILED INFORMATION BOX AT TOP OF CATEGORY PAGE */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <p className="text-[10.5px] font-bold text-slate-700 leading-relaxed flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{activeCatObj.description}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/50">
                  <span className="text-[9px] font-black text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    🏢 মোট প্রতিষ্ঠান: {activeCatProviders.length} টি
                  </span>
                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-lg border border-emerald-300">
                    ⚡ ইনস্ট্যান্ট পে রিসেট
                  </span>
                  <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    🔒 24/7 অটোমেটিক সাপোর্ট
                  </span>
                </div>
              </div>

              {/* SEARCH BOX INSIDE CATEGORY PAGE */}
              <div className="relative pt-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={billSearchQuery}
                  onChange={(e) => setBillSearchQuery(e.target.value)}
                  placeholder={`${activeCatObj.label} প্রোভাইডার বা প্রতিষ্ঠানের নাম টাইপ করুন...`}
                  className="w-full bg-slate-50 text-slate-800 pl-9 pr-4 py-2.5 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold outline-none"
                />
              </div>
            </div>

            {/* BILLERS LIST FOR THIS CATEGORY */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xl space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
                  🏢 {activeCatObj.label} প্রোভাইডার সমূহের তালিকা ({activeCatProviders.length} টি)
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-2.5 max-h-[360px] overflow-y-auto pr-0.5">
                {activeCatProviders.map((provider, pIdx) => (
                  <button
                    key={`cat-page-${provider.id}-${pIdx}`}
                    type="button"
                    onClick={() => setSelectedBillProvider(provider)}
                    className="w-full p-3.5 bg-slate-50 hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 rounded-2xl flex items-center justify-between text-slate-800 text-left transition shadow-2xs cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${provider.iconColor || 'bg-slate-100 text-slate-500'}`}>
                        <activeCatObj.icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-indigo-950 uppercase group-hover:text-emerald-700 transition-colors truncate">
                          {provider.label}
                        </h4>
                        <p className="text-[9.5px] text-slate-500 font-bold truncate">
                          {provider.enLabel || provider.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9.5px] font-black px-3 py-1.5 rounded-xl bg-emerald-600 text-white shadow-2xs group-hover:bg-emerald-700 transition">
                        বিল পরিশোধ ➔
                      </span>
                    </div>
                  </button>
                ))}

                {activeCatProviders.length === 0 && (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-xs text-slate-500 font-bold">দুঃখিত! এই নামে কোনো প্রতিষ্ঠান পাওয়া যায়নি।</p>
                    <button 
                      type="button" 
                      onClick={() => setBillSearchQuery('')} 
                      className="text-[10px] font-black bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      সার্চ রিসেট করুন
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* SUB-PAGE 3: MAIN CATEGORIES GRID VIEW */
          <div className="space-y-4 animate-fade-in">
            {/* Top Back Button to Dashboard */}
            <button 
              onClick={() => { setActiveTab('dashboard'); setSelectedBillProvider(null); setBillCategory(null); }} 
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-black text-xs cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> ফিরে যান
            </button>

            {/* 1. TOP SEARCH FIELD ("প্রতিষ্ঠানের নাম খুঁজুন") */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center pb-0.5">
                <h3 className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-emerald-400" /> প্রতিষ্ঠানের নাম খুঁজুন
                </h3>
                {billSearchQuery && (
                  <button 
                    onClick={() => setBillSearchQuery('')} 
                    className="text-[9px] bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-lg text-slate-300 font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> রিসেট
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  value={billSearchQuery}
                  onChange={(e) => setBillSearchQuery(e.target.value)}
                  placeholder="প্রতিষ্ঠানের নাম বা বিলার টাইপ করুন..."
                  className="w-full bg-white text-slate-800 pl-9 pr-4 py-3 border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-extrabold outline-none shadow-xs"
                />
              </div>

              {/* Instant Search Results Dropdown/Box when typing */}
              {billSearchQuery.trim() !== '' && (
                <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xl space-y-2 max-h-[250px] overflow-y-auto animate-fade-in">
                  <p className="text-[10px] font-black text-slate-500 border-b pb-1">খুঁজে পাওয়া প্রতিষ্ঠানসমূহ ({globalSearchProviders.length} টি):</p>
                  {globalSearchProviders.map((provider, sIdx) => {
                    const CatIcon = categories.find(c => c.id === provider.category)?.icon || Lightbulb;
                    return (
                      <button
                        key={`search-${provider.id}-${sIdx}`}
                        type="button"
                        onClick={() => {
                          setSelectedBillProvider(provider);
                          setBillSearchQuery('');
                        }}
                        className="w-full p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl flex items-center justify-between text-slate-800 text-left transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${provider.iconColor || 'bg-slate-100 text-slate-500'}`}>
                            <CatIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-indigo-950 group-hover:text-emerald-700">{provider.label}</h4>
                            <p className="text-[9px] text-slate-400">{provider.enLabel || provider.name}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
                      </button>
                    );
                  })}
                  {globalSearchProviders.length === 0 && (
                    <p className="text-center text-xs text-slate-400 font-bold py-3">দুঃখিত! কোনো বিল প্রোভাইডার পাওয়া যায়নি।</p>
                  )}
                </div>
              )}
            </div>

            {/* 2. CATEGORIES GRID - Clean 6 Category Cards */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">পে বিল ক্যাটাগরি নির্বাচন করুন</label>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((cat, idx) => (
                  <button
                    key={`${cat.id}-${idx}`}
                    type="button"
                    onClick={() => {
                      setBillCategory(cat.id as any);
                      setSelectedBillProvider(null);
                      setBillSearchQuery('');
                    }}
                    className={`rounded-[22px] transition-all duration-200 border-2 overflow-hidden col-span-1 border-transparent ${cat.bg} hover:scale-[1.02] p-4 text-left cursor-pointer group hover:shadow-md`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${cat.bg} ${cat.iconColor} shadow-2xs`}>
                        <cat.icon className="w-5.5 h-5.5" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-900 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-3">
                      <span className="text-xs font-black text-slate-900 leading-tight block group-hover:text-indigo-900 transition-colors">
                        {cat.label}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 block mt-0.5">{cat.enLabel}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Clean, empty bottom area as requested */}
          </div>
        )}
      </div>
    );
  };

  const renderKhatiyan = () => (
    <div className="space-y-4 text-left">
      <button onClick={() => { setActiveTab('dashboard'); }} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-black text-xs cursor-pointer">
        <ChevronLeft className="w-4 h-4" /> ফিরে যান
      </button>

      <div className="bg-white rounded-3xl p-5 text-slate-800 shadow-lg space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h3 className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
            <FileText className="w-4.5 h-4.5 text-teal-700 animate-pulse" /> আমার লেনদেনের বিবরণ ও স্টেটমেন্ট হিস্টোরি
          </h3>
          <span className="bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold text-[9px] px-2 py-0.5 rounded-md">
            মোটঃ {txList.length}
          </span>
        </div>

        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
          {(() => {
            const toBengaliDigits = (str: string) => {
              const bDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
              return str.replace(/\d/g, (d) => bDigits[parseInt(d)]);
            };

            const formatBengaliCurrency = (amount: number): string => {
              try {
                const englishFormatted = amount.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                });
                return toBengaliDigits(englishFormatted);
              } catch (e) {
                return toBengaliDigits(amount.toFixed(2));
              }
            };

            const getGroupDate = (createdAtStr: string) => {
              if (!createdAtStr) return 'অন্যান্য তারিখ';
              try {
                const d = new Date(createdAtStr);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const englishDate = `${year}-${month}-${day}`;
                return toBengaliDigits(englishDate);
              } catch (e) {
                return 'অন্যান্য তারিখ';
              }
            };

             // Calculate running/post balance for each transaction
            let running = user.balance || 0; //
            const txWithBalances = txList.map((tx, idx) => {
              const savedPost = tx.postBalance;
              const calculatedPost = running;
              
              const isOutgoing = ['withdraw', 'bill_pay', 'transfer'].includes(tx.type);
              const isIncoming = ['add_money', 'deposit', 'received_transfer'].includes(tx.type);
              
              if (isOutgoing) {
                const deducted = tx.totalDeducted || tx.amount || 0;
                running += deducted;
              } else if (isIncoming) {
                if (tx.status === 'approved' || tx.status === 'success') {
                  running -= (tx.amount || 0);
                }
              }
              
              return {
                ...tx,
                displayBalance: savedPost !== undefined ? savedPost : calculatedPost
              };
            });

             // Group by date
            const grouped: { [date: string]: typeof txWithBalances } = {};
            txWithBalances.forEach((tx) => {
              const dateStr = tx.createdAt ? getGroupDate(tx.createdAt) : 'অন্যান্য তারিখ';
              if (!grouped[dateStr]) {
                grouped[dateStr] = [];
              }
              grouped[dateStr].push(tx);
            });

            const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

            if (txList.length === 0) {
              return (
                <div className="text-center py-12 text-slate-450 space-y-2">
                  <span className="text-3xl block">📋</span>
                  <p className="text-xs font-bold font-sans">এখনো কোনো লেনদেনের বিবরণ পাওয়া যায়নি।</p>
                </div>
              );
            }

            return sortedDates.map((dateStr, idx) => (
              <div key={`${dateStr}-${idx}`} className="space-y-2 pb-2">
                {/* Date Header Grouping */}
                <div className="sticky top-0 bg-white z-10 py-1 flex items-center">
                  <span className="bg-indigo-100/70 text-indigo-950 font-black text-[9.5px] px-2.5 py-1 rounded-lg border border-indigo-200/50 flex items-center gap-1 shadow-3xs">
                    📅 {dateStr}
                  </span>
                </div>

                <div className="space-y-2">
                  {grouped[dateStr].map((tx, idx) => {
                    const isOutgoing = ['withdraw', 'bill_pay', 'transfer'].includes(tx.type);
                    const isIncoming = ['add_money', 'deposit', 'received_transfer'].includes(tx.type);

                    return (
                      <div 
                        key={`${tx.id}-${idx}`} 
                        onClick={() => openReceiptForTx(tx)}
                        className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl flex justify-between items-center text-left hover:bg-emerald-50/50 hover:border-emerald-300 transition shadow-3xs cursor-pointer active:scale-[0.99]"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${
                              tx.status === 'approved' || tx.status === 'success' 
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                : tx.status === 'rejected' || tx.status === 'failed' 
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200' 
                                  : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                            }`}>
                              {tx.status === 'approved' || tx.status === 'success' ? 'সফল' : tx.status === 'rejected' || tx.status === 'failed' ? 'প্রত্যাখ্যাত' : 'অপেক্ষমান'}
                            </span>
                            <span className="text-[10px] font-black text-slate-800">
                              {tx.type === 'add_money' ? 'মোবাইল অ্যাড মানি (Add Money)' : 
                               tx.type === 'deposit' ? 'ব্যাংক ডিপোজিট' : 
                               tx.type === 'withdraw' ? 'ক্যাশ আউট / উইথড্র' : 
                               tx.type === 'bill_pay' ? 'বিল পরিশোধ (Bill Pay)' : 
                               tx.type === 'transfer' ? 'টাকা পাঠানো (Send Money)' : 
                               tx.type === 'received_transfer' ? 'টাকা গ্রহণ (Received Money)' : 
                               tx.type === 'money_exchange' ? 'মানি এক্সচেঞ্জ' : 'লেনদেন'}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-500 font-sans leading-tight mt-1">{tx.description || tx.paymentMethod}</p>
                          {tx.transactionId && <p className="text-[8.5px] text-slate-400 font-mono leading-none mt-1 uppercase">TrxID: {tx.transactionId}</p>}
                          <p className="text-[8px] text-slate-400 font-sans mt-1">
                            {tx.createdAt ? toBengaliDigits(new Date(tx.createdAt).toLocaleTimeString('bn-BD')) : ''}
                          </p>
                        </div>
                        <div className="text-right space-y-0.5 min-w-[90px]">
                          <p className={`text-[12px] font-extrabold ${isOutgoing ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {isOutgoing ? '- ' : '+ '}৳{formatBengaliCurrency(tx.amount)}
                          </p>
                          <p className="text-[9.5px] text-slate-500 font-bold">
                            ৳{formatBengaliCurrency(tx.displayBalance)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );

  const handleBack = () => {
    if (isReceiptOpen) { setIsReceiptOpen(false); return; }
    if (showSaveCardModal) { setShowSaveCardModal(false); return; }
    if (showMonthPopup) { setShowMonthPopup(false); return; }
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#001E17] z-50 overflow-y-auto font-sans">
      <div id="money-exchange-module-root" className="w-full max-w-xl mx-auto bg-[#001E17] min-h-screen text-white px-1 sm:px-3 pt-1 pb-16 relative">
        
        {/* Header Title Bar */}
        <div className="flex items-center justify-between gap-2.5 mb-2 border-b border-white/5 pb-1.5">
          <div className="flex items-center gap-2">
            <UnifiedBackButton 
              onClick={handleBack} 
              variant="emerald"
              title="পিছনে যান"
            />
            <div className="text-left">
              <h1 className="text-xs font-black text-white leading-none">AMB সমবায় ব্যাংক</h1>
              <p className="text-[8px] text-white/60 leading-none mt-0.5">মোবাইল ব্যাংকিং</p>
            </div>
          </div>

          {/* Green mark: center main balance */}
          <div className="bg-emerald-950/40 border border-emerald-500/20 py-1 px-2.5 rounded-xl flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse"></span>
            <span className="text-[8.5px] text-emerald-300 font-bold">ব্যালেন্সঃ</span>
            <span className="font-black text-xs text-white font-mono">৳ {(user.balance || 0).toLocaleString('bn-BD')}</span>
          </div>

          {/* Red mark: corner transaction history */}
          <button 
            onClick={() => setActiveTab('khatiyan')}
            className={`bg-white/10 hover:bg-white/20 active:scale-95 border py-1 px-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'khatiyan' ? 'bg-emerald-600/30 border-emerald-500' : 'border-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-extrabold text-[9.5px] text-white">লেনদেন হিস্টরি</span>
          </button>
        </div>

        {/* Dynamic alerts rendering */}
        {errorMsg && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-200 p-3.5 rounded-2xl text-xs mb-4 flex items-center gap-1.5 leading-relaxed font-sans font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0"></span>
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 p-3.5 rounded-2xl text-xs mb-4 flex items-center gap-1.5 leading-relaxed font-sans font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Current Active Tab screen */}
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'add_money' && renderAddMoney()}
        {activeTab === 'auto_add_money' && renderAutoAddMoney()}
        {activeTab === 'amb_to_amb' && renderAmbToAmb()}
        {activeTab === 'send_money' && renderSendMoney()}
        {activeTab === 'bill_pay' && renderBillPay()}
        {activeTab === 'khatiyan' && renderKhatiyan()}
        {activeTab === 'salary' && (
          <div className="bg-white rounded-3xl overflow-hidden text-slate-800 animate-fade-in">
            <AmbAutoSalaryPay 
              user={user} 
              onBack={() => setActiveTab('dashboard')} 
              syncLiveProfile={syncLiveProfile} 
              appConfig={appConfig} 
            />
          </div>
        )}

        {/* More Rates Modal */}
        {isMoreRatesOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white text-slate-800 w-full max-w-md rounded-3xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
              <div className="bg-[#0B1528] text-white p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
                  <div>
                    <h3 className="text-xs font-black">গ্লোবাল লাইভ রেমিট্যান্স রেট</h3>
                    <p className="text-[9px] text-emerald-400 font-semibold">লাইভ রেটসমূহ</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMoreRatesOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Search country */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="দেশের নাম বা কারেন্সি খুঁজুন..."
                    value={ratesSearchQuery}
                    onChange={(e) => setRatesSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Country rates list */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {remittanceRates
                    .filter(rate => 
                      rate.name.toLowerCase().includes(ratesSearchQuery.toLowerCase()) ||
                      (rate.flag && rate.flag.includes(ratesSearchQuery))
                    )
                    .map((rate, idx) => (
                      <div key={`${rate.id}-${idx}`} className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-2xl flex items-center justify-between transition shadow-3xs">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl leading-none">{rate.flag}</span>
                          <div className="text-left">
                            <p className="text-xs font-black text-slate-800">{rate.name}</p>
                            <span className="text-[9px] text-slate-400 font-semibold">{rate.multiplier || '1 একক'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] text-slate-400 font-bold block uppercase">লাইভ রেট</span>
                          <strong className="text-xs font-black font-mono text-emerald-700">৳ {(Number(rate.value) || 0).toFixed(2)}</strong>
                        </div>
                      </div>
                    ))}
                  {remittanceRates.length === 0 && (
                    <p className="text-center text-xs text-slate-400 italic py-6">কোনো দেশের তথ্য পাওয়া যায়নি।</p>
                  )}
                </div>

                {/* Live Converter Calculator */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2.5">
                  <h4 className="text-[10px] text-emerald-800 font-black uppercase tracking-wider flex items-center gap-1">
                    <span>🧮</span> রেমিট্যান্স ক্যালকুলেটর (সহজ হিসাব)
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">দেশ নির্বাচন করুন</label>
                      <select 
                        id="calc-country-select"
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold"
                        onChange={(e) => {
                          const r = remittanceRates.find(x => x.id === e.target.value);
                          if (r) {
                            (document.getElementById('calc-rate-val') as HTMLInputElement).value = String(r.value);
                            const amountInput = document.getElementById('calc-foreign-amt') as HTMLInputElement;
                            const resultSpan = document.getElementById('calc-bdt-res') as HTMLElement;
                            if (amountInput && resultSpan) {
                              const bdt = Number(amountInput.value) * r.value;
                              resultSpan.innerText = `৳ ${bdt.toFixed(2)}`;
                            }
                          }
                        }}
                      >
                        <option value="">দেশ সিলেক্ট করুন</option>
                        {remittanceRates.map((r, idx) => (
                          <option key={`${r.id}-${idx}`} value={r.id}>{r.flag} {r.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">কারেন্সির পরিমাণ</label>
                      <input
                        type="number"
                        id="calc-foreign-amt"
                        placeholder="উদাঃ 500"
                        defaultValue="100"
                        onChange={(e) => {
                          const rateVal = Number((document.getElementById('calc-rate-val') as HTMLInputElement)?.value || 0);
                          const amt = Number(e.target.value);
                          const resultSpan = document.getElementById('calc-bdt-res') as HTMLElement;
                          if (resultSpan) {
                            const bdt = amt * rateVal;
                            resultSpan.innerText = `৳ ${bdt.toFixed(2)}`;
                          }
                        }}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold focus:outline-none"
                      />
                      <input type="hidden" id="calc-rate-val" defaultValue="0" />
                    </div>
                  </div>
                  <div className="bg-white p-2.5 border border-slate-150 rounded-xl text-center shadow-3xs">
                    <span className="text-[9px] text-slate-400 font-bold block">বাংলাদেশি টাকা পাবেন (BDT)</span>
                    <strong id="calc-bdt-res" className="text-xs font-black font-mono text-emerald-700">৳ 0.00</strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 text-center">
                <button
                  onClick={() => setIsMoreRatesOpen(false)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Card Nickname Modal */}
        {showSaveCardModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border border-slate-200 p-4 rounded-2.5xl w-full max-w-xs space-y-3 shadow-2xl text-left">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1">
                  ⭐ প্রিয় কার্ড হিসেবে সেভ করুন
                </h4>
                <button onClick={() => setShowSaveCardModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-bold">
                কার্ড নম্বর: <span className="font-mono text-slate-900 font-black tracking-wider">{cardAddNum}</span>
              </p>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-600">কার্ডের নাম/লেবেল (যেমন: ভাইয়ের কার্ড, সেজো ভাই)</label>
                <input
                  type="text"
                  value={saveCardNicknameInput}
                  onChange={(e) => setSaveCardNicknameInput(e.target.value)}
                  placeholder="যেমন: ভাইয়ের কার্ড"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:border-amber-500 text-slate-800"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSaveCardModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCurrentCardToFavorites()}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl cursor-pointer shadow-sm active:scale-95"
                >
                  সেভ করুন ⭐
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Fullscreen Viewer Modal */}
        {previewQrModalUrl && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 text-center relative shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5 uppercase tracking-wider">
                  📷 ব্যাংকিং কিউআর কোড স্ক্যানার ভিউ
                </span>
                <button 
                  onClick={() => setPreviewQrModalUrl(null)}
                  className="w-7 h-7 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-full flex items-center justify-center font-bold text-xs text-slate-600 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <img src={previewQrModalUrl} alt="Bank Scan QR" className="max-h-80 mx-auto rounded-xl object-contain shadow-sm" />
              </div>
              <p className="text-[10.5px] text-slate-600 font-bold font-sans leading-relaxed">
                আপনার মোবাইল ব্যাংকিং বা আন্তর্জাতিক ব্যাংক অ্যাপ থেকে কিউআর কোডটি স্ক্যান করে সহজে পেমেন্ট সম্পন্ন করুন।
              </p>
              <button 
                onClick={() => setPreviewQrModalUrl(null)}
                className="w-full py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold text-xs rounded-xl shadow-sm uppercase font-sans cursor-pointer transition active:scale-95"
              >
                বন্ধ করুন (Close)
              </button>
            </div>
          </div>
        )}

        {/* Digital Payment Receipt Modal */}
        <AmbPaymentReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          data={receiptModalData}
          appLogo={appConfig?.appLogoUrl || "/amb_logo.png"}
        />
      </div>
    </div>
  );
};

export default AmbMobileBankingPortal;
