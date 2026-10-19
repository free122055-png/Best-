import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, AppConfig, SAMITY_MONTHS, SAMITY_YEARS, SAMITY_QUARTERLY_MONTHS, MemberNominee, getUniquePaidMonthsCount, normalizePaidMonthsArray, getEffectiveBalance, getEffectivePaidMonthsList } from '../types';
import { processUserSamitySavingsAutoDeduction, getUnpaidSamityMonths, isUserMonthPaid, calculateSamityFine, getUserMonthlyInstallmentRate, getUserQuarterlyInstallmentRate, isUserQuarterlyPaid, processQuarterlyInstallmentPayment, processMultipleQuarterlyInstallmentsPayment } from '../lib/samitySavingsEngine';
import { db } from '../lib/firebase';
import SamityAdmin from './SamityAdmin';
import SamityInvestmentsView from './SamityInvestmentsView';
import UnifiedBackButton from './UnifiedBackButton';
import { BNBPaymentReceiptModal, PaymentReceiptData } from './BNBPaymentReceiptModal';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Menu,
  Bell,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  PiggyBank,
  FileText,
  Users,
  UserPlus,
  CheckCircle,
  Scale,
  Coins,
  Gem,
  Landmark,
  Calculator,
  AlertCircle,
  HelpCircle,
  Plus,
  ArrowDown,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  Hourglass,
  Lock,
  Wallet,
  Sparkles,
  ClipboardList,
  Search,
  BookOpen,
  LineChart,
  Home,
  MessageCircle,
  User as UserIcon,
  RefreshCw,
  Award,
  AlertTriangle,
  Send,
  Play,
  Volume2,
  Calendar,
  X,
  ShieldCheck,
  Smartphone,
  Copy,
  Trash2,
  CheckCircle2,
  PlusCircle,
  PhoneCall,
  ShieldAlert,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { normalizePhoneNumber, findUserInFirestoreByPhone, getMembershipCategory } from '../lib/memberUtils';
import { useBackHandler } from '../lib/navigationManager';

interface SamityScreenProps {
  user: User;
  allUsers: User[];
  onBack: () => void;
  syncLiveProfile: () => void;
  setActiveTab: (tab: 'home' | 'deposit' | 'loan' | 'history' | 'profile') => void;
  setModalType: (type: any) => void;
  appConfig?: AppConfig;
  allNotices?: any[];
  transactions?: Transaction[];
  isAdminView?: boolean;
  initialSubView?: 'main' | 'savings_dps' | 'loan_ledger' | 'profits' | 'member_registry' | 'withdraw_savings' | 'new_deposit' | 'monthly_investment_policy' | 'referral_network' | 'share_transfer' | 'register_other_member' | 'custom_savings' | 'admin' | 'our_investments' | string;
}

export const SamityScreen = React.memo(function SamityScreen({ 
  user, 
  allUsers, 
  onBack, 
  syncLiveProfile,
  setActiveTab,
  setModalType,
  appConfig,
  allNotices = [],
  transactions = [],
  isAdminView = false,
  initialSubView = 'main'
}: SamityScreenProps) {
  
  // High-fidelity active sub-view state inside full-screen Samity option
  const [activeSubView, setActiveSubView] = useState<'main' | 'savings_dps' | 'loan_ledger' | 'profits' | 'member_registry' | 'withdraw_savings' | 'new_deposit' | 'monthly_investment_policy' | 'referral_network' | 'share_transfer' | 'register_other_member' | 'custom_savings' | 'admin' | 'our_investments'>((initialSubView as any) || 'main');
  const [bottomTab, setBottomTab] = useState<'home' | 'report' | 'messages' | 'profile'>('home');

  // States for registering other member
  const [createdMembersCount, setCreatedMembersCount] = useState<number>(0);
  const [createdMembersList, setCreatedMembersList] = useState<User[]>([]);
  const [regMemberName, setRegMemberName] = useState('');
  const [regMemberPhone, setRegMemberPhone] = useState('');
  const [regFatherName, setRegFatherName] = useState('');
  const [regMotherName, setRegMotherName] = useState('');
  const [regMemberNid, setRegMemberNid] = useState('');
  const [regMemberDob, setRegMemberDob] = useState('');
  const [regMemberCountry, setRegMemberCountry] = useState('Bangladesh (বাংলাদেশ)');
  const [regMemberDivision, setRegMemberDivision] = useState('');
  const [regMemberDistrict, setRegMemberDistrict] = useState('');
  const [regMemberThana, setRegMemberThana] = useState('');
  const [regMemberPostOffice, setRegMemberPostOffice] = useState('');
  const [regNomineeName, setRegNomineeName] = useState('');
  const [regNomineeRelation, setRegNomineeRelation] = useState('');
  const [regNomineePhone, setRegNomineePhone] = useState('');
  const [regMonthlySavingsOption, setRegMonthlySavingsOption] = useState<string>('');
  const [regCustomSavingsAmount, setRegCustomSavingsAmount] = useState<string>('');
  const [regAgreed, setRegAgreed] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccessData, setRegSuccessData] = useState<{ name: string; phone: string; memberId: string } | null>(null);

  // Full-Screen Transaction Receipt Modal State
  const [receiptModalData, setReceiptModalData] = useState<PaymentReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const openReceiptForTx = (tx: any) => {
    const isCredit = ['coop_savings_deposit', 'deposit'].includes(tx.type) && !tx.description?.includes('উত্তোলন');
    setReceiptModalData({
      typeLabel: tx.typeLabel || (isCredit ? 'সমবায় সঞ্চয় জমা' : 'সমবায় সঞ্চয় উত্তোলন'),
      transactionId: (tx.id || tx.transactionId || tx.receiptNo || `SAM${Date.now()}`).toUpperCase(),
      amount: tx.amount || 0,
      fee: 0,
      totalAmount: tx.amount || 0,
      status: tx.status || 'pending',
      beneficiaryName: tx.userName || user.name || 'BNB সদস্য',
      beneficiaryAccount: tx.memberId || user.memberId || user.phone,
      senderPhone: tx.phone || user.phone || 'N/A',
      description: tx.description,
      paymentMethod: tx.paymentMethod || 'BNB ওয়ালেট',
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

  // Samity Screen Internal Back Handler (Closes modals, then returns to main samity view, then allows parent back)
  useBackHandler(() => {
    if (isReceiptOpen) { setIsReceiptOpen(false); return true; }
    if (activeTopModal !== 'none') { setActiveTopModal('none'); return true; }
    if (show2050CalendarModal) { setShow2050CalendarModal(false); return true; }
    if (showDeactivateModal) { setShowDeactivateModal(false); return true; }
    if (showHelplineModal) { setShowHelplineModal(false); return true; }
    if (showSectionTxHistory) { setShowSectionTxHistory(false); return true; }
    if (activeSubView !== 'main') {
      setActiveSubView('main');
      return true;
    }
    if (bottomTab !== 'home') {
      setBottomTab('home');
      return true;
    }
    return false;
  }, true, 25);

  // Ledger lists fetched from db
  const [liveDbUsers, setLiveDbUsers] = useState<User[]>([]);
  const [userTxHistory, setUserTxHistory] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [showSectionTxHistory, setShowSectionTxHistory] = useState(false);
  const [txModalSearch, setTxModalSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBalance, setShowBalance] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [copySuccess, setCopySuccess] = useState('');
  const [samityAutoSavingsActive, setSamityAutoSavingsActive] = useState<boolean>(
    user.samityAutoSavingsActive !== undefined ? user.samityAutoSavingsActive : true
  );

  // Top Section Modal Control: 'none' | 'owner' | 'shareholder' | 'exit_switch' | 'investor' | 'quarterly_pay'
  const [activeTopModal, setActiveTopModal] = useState<'none' | 'owner' | 'shareholder' | 'exit_switch' | 'investor' | 'quarterly_pay'>('none');
  const [switchActionType, setSwitchActionType] = useState<'turn_off' | 'turn_on'>('turn_off');
  const [switchOffReason, setSwitchOffReason] = useState('');
  const [switchOnReason, setSwitchOnReason] = useState('');
  const [switchSecurityPin, setSwitchSecurityPin] = useState('');
  const [switchSubmitting, setSwitchSubmitting] = useState(false);

  // Owner Upgrade Modal States
  const [ownerAgree, setOwnerAgree] = useState(false);
  const [ownerUpgradePin, setOwnerUpgradePin] = useState('');
  const [ownerUpgrading, setOwnerUpgrading] = useState(false);

  // Shareholder Upgrade Modal States
  const [shareholderAgree, setShareholderAgree] = useState(false);
  const [shareholderUpgradePin, setShareholderUpgradePin] = useState('');
  const [shareholderUpgrading, setShareholderUpgrading] = useState(false);

  // Investor Upgrade Modal States
  const [investorAgree, setInvestorAgree] = useState(false);
  const [investorUpgradePin, setInvestorUpgradePin] = useState('');
  const [investorUpgrading, setInvestorUpgrading] = useState(false);

  // Nominee form states inside modals
  const [nomineeInputName, setNomineeInputName] = useState('');
  const [nomineeInputRelation, setNomineeInputRelation] = useState('');
  const [nomineeInputPhone, setNomineeInputPhone] = useState('');
  const [nomineeInputNid, setNomineeInputNid] = useState('');
  const [savingNominees, setSavingNominees] = useState(false);

  // Quarterly payment & search for another member's account
  const [quarterlyPaying, setQuarterlyPaying] = useState(false);
  const [selectedQuarterIds, setSelectedQuarterIds] = useState<string[]>([]);
  const [quarterTargetMember, setQuarterTargetMember] = useState<User | null>(null);
  const [quarterSearchTerm, setQuarterSearchTerm] = useState('');
  const [quarterSearchResults, setQuarterSearchResults] = useState<User[]>([]);
  const [isSearchingQuarterMember, setIsSearchingQuarterMember] = useState(false);
  const [quarterPaymentSource, setQuarterPaymentSource] = useState<'payer' | 'target'>('payer');



  // Real-time live user state directly bound to Firestore document
  const [currentUserLive, setCurrentUserLive] = useState<User>(user);

  useEffect(() => {
    if (!user?.uid) return;
    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const liveData = { uid: snap.id, ...snap.data() } as User;
        setCurrentUserLive(liveData);
        if (liveData.samityAutoSavingsActive !== undefined) {
          setSamityAutoSavingsActive(liveData.samityAutoSavingsActive);
        }
      }
    }, (err) => {
      console.error("Live user snapshot error in SamityScreen:", err);
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (user) {
      setCurrentUserLive(prev => ({ ...prev, ...user }));
    }
  }, [user]);

  const effectiveUser = currentUserLive || user;

  const activeTarget = quarterTargetMember || effectiveUser;
  const activeCat = getMembershipCategory(activeTarget);
  const isTargetOwner = activeCat.key === 'owner';
  const isTargetShareholder = activeCat.key === 'shareholder';
  const isTargetEligible = isTargetOwner || isTargetShareholder;
  const targetQRate = isTargetOwner ? 10000 : isTargetShareholder ? 5000 : 10000;


  useEffect(() => {
    let rawUsersList: User[] = [];
    let rawSamityAppsList: any[] = [];

    const syncCombined = () => {
      const usersMap = new Map<string, User>();
      const phoneToUid = new Map<string, string>();
      const memberIdToUid = new Map<string, string>();

      const cleanDigits = (p?: string | null) => {
        if (!p) return '';
        return String(p).replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, '');
      };

      rawUsersList.forEach(u => {
        const key = u.uid || (u as any).id;
        if (key) {
          usersMap.set(key, { ...u, uid: key });
          const digits = cleanDigits(u.phone);
          if (digits) {
            phoneToUid.set(digits, key);
            if (digits.length >= 9) phoneToUid.set(digits.slice(-9), key);
          }
          if (u.memberId) {
            memberIdToUid.set(String(u.memberId).trim().toUpperCase(), key);
          }
        }
      });

      rawSamityAppsList.forEach(app => {
        const appUid = app.userId || app.uid || '';
        const appPhoneDigits = cleanDigits(app.phone);
        const appLast9 = appPhoneDigits.length >= 9 ? appPhoneDigits.slice(-9) : '';
        const appMemberId = app.memberId ? String(app.memberId).trim().toUpperCase() : '';

        let targetUid = '';
        if (appUid && usersMap.has(appUid)) {
          targetUid = appUid;
        } else if (appLast9 && phoneToUid.has(appLast9)) {
          targetUid = phoneToUid.get(appLast9)!;
        } else if (appMemberId && memberIdToUid.has(appMemberId)) {
          targetUid = memberIdToUid.get(appMemberId)!;
        } else if (app.id && usersMap.has(app.id)) {
          targetUid = app.id;
        }

        if (targetUid && usersMap.has(targetUid)) {
          const existing = usersMap.get(targetUid)!;
          if (app.savings !== undefined && (existing.savings === undefined || existing.savings === null)) existing.savings = Number(app.savings) || 0;
          if (app.dpsBalance !== undefined && (existing.dpsBalance === undefined || existing.dpsBalance === null)) existing.dpsBalance = Number(app.dpsBalance) || 0;
          if (app.nomineeName && !existing.nomineeName) existing.nomineeName = app.nomineeName;
          if (app.nomineePhone && !existing.nomineePhone) existing.nomineePhone = app.nomineePhone;
          if (app.monthlySavingsTarget && !existing.monthlySavingsTarget) existing.monthlySavingsTarget = app.monthlySavingsTarget;
          if (app.samityStatus === 'approved' || app.status === 'approved' || app.approved === true) {
            existing.samityStatus = 'approved';
            existing.samityApproved = true;
          }
          if (app.memberId && !existing.memberId) {
            existing.memberId = app.memberId;
          }
        } else {
          const key = appUid || app.id || app.docId || (appPhoneDigits ? `applicant_${appPhoneDigits}` : `app_${Date.now()}`);
          const isApproved = app.approved === true || app.status === 'approved' || app.samityStatus === 'approved';
          const newUser: User = {
            uid: key,
            name: app.name || 'সদস্য আবেদনকারী',
            phone: app.phone || '',
            memberId: app.memberId || '',
            pin: app.pin || '1234',
            role: 'user',
            balance: app.balance || 0,
            savings: app.savings || 0,
            dpsBalance: app.dpsBalance || 0,
            dueLoan: app.dueLoan || 0,
            createdAt: app.createdAt || new Date().toISOString(),
            samityStatus: isApproved ? 'approved' : (app.status || 'pending'),
            samityApproved: isApproved,
            approved: isApproved,
            status: isApproved ? 'active' : 'inactive'
          };
          usersMap.set(key, newUser);
          if (appLast9) phoneToUid.set(appLast9, key);
          if (appMemberId) memberIdToUid.set(appMemberId, key);
        }
      });

      setLiveDbUsers(Array.from(usersMap.values()));
    };

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      rawUsersList = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      syncCombined();
    }, (err) => {
      console.error("Error fetching live users for Samity summary:", err);
    });

    const unsubSamityApps = onSnapshot(collection(db, 'samity_applications'), (snap) => {
      rawSamityAppsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      syncCombined();
    }, (err) => {
      console.error("Error fetching live samity applications for Samity summary:", err);
    });

    return () => {
      unsubUsers();
      unsubSamityApps();
    };
  }, []);

  useEffect(() => {
    if (user.samityAutoSavingsActive !== undefined) {
      setSamityAutoSavingsActive(user.samityAutoSavingsActive);
    }
  }, [user.samityAutoSavingsActive]);

  // Fetch count and list of members created by this user
  useEffect(() => {
    if (activeSubView === 'register_other_member' && user?.uid) {
      const fetchCreatedMembers = async () => {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          const created: User[] = [];
          usersSnap.forEach((docSnap) => {
            const u = docSnap.data() as User;
            if (
              u.createdByUid === user.uid ||
              (u.createdByMemberId && u.createdByMemberId === user.memberId) ||
              (u.referrerMemberId && u.referrerMemberId === user.memberId)
            ) {
              created.push({ ...u, uid: docSnap.id });
            }
          });
          setCreatedMembersCount(created.length);
          setCreatedMembersList(created);
        } catch (e) {
          console.error("Error fetching created members count:", e);
        }
      };
      fetchCreatedMembers();
    }
  }, [activeSubView, user?.uid, user?.memberId]);

  const handleRegisterOtherMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regMemberName.trim()) {
      setRegError('নতুন সদস্যের নাম প্রদান করা বাধ্যতামূলক।');
      return;
    }

    if (!regMemberPhone.trim() || regMemberPhone.trim().length < 5) {
      setRegError('সঠিক মোবাইল নম্বর প্রদান করুন।');
      return;
    }

    if (!regAgreed) {
      setRegError('আবেদন জমা দিতে অবশ্যই নীতিমালার সাথে একমত পোষণ করুন।');
      return;
    }

    if (!regMemberNid.trim()) {
      setRegError('অনুগ্রহ করে জাতীয় পরিচয়পত্র (NID), পাসপোর্ট অথবা জন্ম নিবন্ধন নম্বর লিখুন।');
      return;
    }

    if (!regNomineeName.trim()) {
      setRegError('অনুগ্রহ করে নমিনির নাম প্রদান করুন।');
      return;
    }

    if (!regNomineePhone.trim()) {
      setRegError('অনুগ্রহ করে নমিনির মোবাইল নম্বর প্রদান করুন।');
      return;
    }

    if (!regMonthlySavingsOption) {
      setRegError('অনুগ্রহ করে কাঙ্ক্ষিত মাসিক সঞ্চয় স্কিম নির্ধারণ করুন।');
      return;
    }

    let savingsTarget = 500;
    if (regMonthlySavingsOption === 'custom') {
      const parsedAmt = parseInt(regCustomSavingsAmount, 10);
      if (isNaN(parsedAmt) || parsedAmt < 500) {
        setRegError('মাসিক সঞ্চয়ের পরিমাণ সর্বনিম্ন 500 টাকা বা তার বেশি হতে হবে (ইংলিশ সংখ্যায় লিখুন)।');
        return;
      }
      savingsTarget = parsedAmt;
    } else {
      savingsTarget = parseInt(regMonthlySavingsOption, 10);
    }

    setRegLoading(true);
    try {
      const normPhone = normalizePhoneNumber(regMemberPhone);
      const formattedPhone = regMemberPhone.startsWith('+') ? regMemberPhone : '+880' + regMemberPhone.replace(/^0+/, '');

      // ⚡ 1. Check if user already exists locally (< 0.1ms)
      const existingLocal = allUsers?.find(u => 
        (u.phone && (u.phone === regMemberPhone || u.phone === formattedPhone)) || 
        (u.normalizedPhone && u.normalizedPhone === normPhone)
      );
      if (existingLocal) {
        setRegError(`এই মোবাইল নম্বরটি (${existingLocal.phone || regMemberPhone}) ইতিমধ্যে নিবন্ধিত রয়েছে (সদস্য নাম: ${existingLocal.name}, আইডি: ${existingLocal.memberId})।`);
        setRegLoading(false);
        return;
      }

      // ⚡ 2. Instant Member ID generation from in-memory allUsers (< 0.1ms)
      let maxSerial = 0;
      if (Array.isArray(allUsers) && allUsers.length > 0) {
        allUsers.forEach((u) => {
          if (u.memberId && u.memberId.startsWith('BNB')) {
            const serialPart = u.memberId.replace('BNB', '');
            const serialNum = parseInt(serialPart, 10);
            if (!isNaN(serialNum) && serialNum > maxSerial) {
              maxSerial = serialNum;
            }
          }
        });
      }
      const nextSerial = Math.max(maxSerial, (allUsers?.length || 0)) + 1;
      const newMemberId = `BNB${String(nextSerial).padStart(8, '0')}`;
      const userDocId = 'user_' + (normPhone || Date.now().toString());
      const nowIso = new Date().toISOString();

      const newMemberDoc: User = {
        uid: userDocId,
        name: regMemberName.trim(),
        phone: formattedPhone,
        normalizedPhone: normPhone,
        memberId: newMemberId,
        pin: '', // Empty PIN - member sets PIN upon first login
        pinSet: false,
        isPendingPin: true,
        role: 'user',
        balance: 0,
        savings: 0,
        telecomBalance: 0,
        superShopBalance: 0,
        dueLoan: 0,
        lockedBalance: 0,
        pendingBalance: 0,
        monthlySavingsTarget: savingsTarget,
        createdAt: nowIso,
        approved: false, // Requires admin approval before login
        samityStatus: 'pending',
        status: 'inactive',
        createdByUid: user.uid,
        createdByMemberId: user.memberId || '',
        createdByMemberName: user.name,
        referrerMemberId: user.memberId || '',
        country: regMemberCountry,
        fatherName: regFatherName.trim(),
        motherName: regMotherName.trim(),
        nid: regMemberNid.trim(),
        dob: regMemberDob,
        division: regMemberDivision,
        district: regMemberDistrict,
        thana: regMemberThana,
        postOffice: regMemberPostOffice,
        nomineeName: regNomineeName.trim(),
        nomineeRelation: regNomineeRelation.trim(),
        nomineePhone: regNomineePhone.trim()
      };

      const appDocData = {
        ...newMemberDoc,
        status: 'pending',
        samityStatus: 'pending',
        approved: false,
        submittedAt: nowIso,
        appliedAt: nowIso,
        applicantName: regMemberName.trim()
      };

      // ⚡ 3. Parallel Firestore document creation (users & samity_applications concurrently under 0.5s)
      await Promise.all([
        setDoc(doc(db, 'users', userDocId), newMemberDoc, { merge: true }),
        setDoc(doc(db, 'samity_applications', userDocId), appDocData, { merge: true })
      ]);

      // ⚡ 4. Background Async Notifications (non-blocking)
      addDoc(collection(db, 'admin_notifications'), {
        type: 'samity_membership_application',
        title: '🏢 নতুন সদস্য আবেদনের অনুরোধ (রেফারেল)',
        message: `${user.name} (${user.memberId}) নতুন সদস্য ${regMemberName.trim()} (${formattedPhone}) এর জন্য সদস্যপদ আবেদন জমা দিয়েছেন।`,
        userId: userDocId,
        userName: regMemberName.trim(),
        referrerName: user.name,
        referrerMemberId: user.memberId || '',
        read: false,
        createdAt: nowIso
      }).catch(eAdminNotif => console.warn("Admin notification warning:", eAdminNotif));

      addDoc(collection(db, 'user_notifications'), {
        userId: user.uid,
        title: '📩 সদস্য আবেদন জমা সফল!',
        message: `আপনি সফলভাবে ${regMemberName.trim()} (আইডি: ${newMemberId}, মোবাইল: ${formattedPhone}) এর সদস্যপদ আবেদন সাবমিট করেছেন। এডমিন অনুমোদনের পর তিনি লগইন করতে পারবেন।`,
        timestamp: nowIso,
        read: false
      }).catch(eNotif => console.warn("Notification add warning:", eNotif));

      // ⚡ 5. Instant UI State Update
      setCreatedMembersCount(prev => prev + 1);
      setCreatedMembersList(prev => [newMemberDoc, ...prev]);

      setRegSuccessData({
        name: regMemberName.trim(),
        phone: formattedPhone,
        memberId: newMemberId
      });

      // Reset form fields
      setRegMemberName('');
      setRegMemberPhone('');
      setRegFatherName('');
      setRegMotherName('');
      setRegMemberNid('');
      setRegMemberDob('');
      setRegMemberDivision('');
      setRegMemberDistrict('');
      setRegMemberThana('');
      setRegMemberPostOffice('');
      setRegNomineeName('');
      setRegNomineeRelation('');
      setRegNomineePhone('');
      setRegCustomSavingsAmount('');
      setRegAgreed(false);

    } catch (err: any) {
      console.error(err);
      setRegError(`একাউন্ট তৈরি করতে সমস্যা হয়েছে: ${err?.message || JSON.stringify(err)}।`);
    } finally {
      setRegLoading(false);
    }
  };
  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivatePin, setDeactivatePin] = useState('');
  const [deactivateSubmitting, setDeactivateSubmitting] = useState(false);

  // Dec 25 Auto Balance Release effect
  useEffect(() => {
    const checkDec25AutoRelease = async () => {
      if (!user.uid) return;
      const now = new Date();
      const isDec25OrLater = now.getMonth() === 11 && now.getDate() >= 25;
      const isApproved = user.samityDeactivateStatus === 'approved' || (user.canDisableAutoSavings && user.samityAutoSavingsActive === false);
      const savingsToRelease = Number(user.savings || 0);

      if (isDec25OrLater && isApproved && savingsToRelease > 0) {
        try {
          const newBalance = (user.balance || 0) + savingsToRelease;
          const userRef = doc(db, 'users', user.uid);
          
          await updateDoc(userRef, {
            balance: newBalance,
            mainBalance: newBalance,
            savings: 0,
            samityDeactivateStatus: 'released',
            samityAutoSavingsActive: false
          });

          const nowIso = now.toISOString();
          await addDoc(collection(db, 'transactions'), {
            userId: user.uid,
            userName: user.name || '',
            memberId: user.memberId || '',
            phone: user.phone || '',
            type: 'samity_release',
            typeLabel: 'সমিতি সঞ্চয় মেয়ারপূর্তি রিফান্ড (25 ডিসেম্বর)',
            amount: savingsToRelease,
            preBalance: user.balance || 0,
            postBalance: newBalance,
            status: 'completed',
            description: `25শে ডিসেম্বর সমবায় সমিতি সঞ্চয় অফ আবেদনের নীতি অনুযায়ী জমানো ৳${savingsToRelease.toLocaleString('bn-BD')} টাকা মেইন ব্যালেন্সে স্বয়ংক্রিয়ভাবে রিফান্ড করা হয়েছে।`,
            createdAt: nowIso,
            receiptNo: `REFUND-DEC25-${Date.now()}`
          });

          await addDoc(collection(db, 'user_notifications'), {
            userId: user.uid,
            memberId: user.memberId || '',
            title: '🎉 25শে ডিসেম্বর সমবায় সঞ্চয় রিফান্ড!',
            body: `আপনার অনুমোদিত সঞ্চয় বন্ধের আবেদন অনুযায়ী সঞ্চিত ৳${savingsToRelease.toLocaleString('bn-BD')} টাকা সফলভাবে মেইন ব্যালেন্সে স্থানান্তরিত করা হয়েছে।`,
            read: false,
            isPersonal: true,
            isTransactionHistory: true,
            category: 'transaction',
            createdAt: nowIso
          });

          syncLiveProfile();
          setCustomAlert({
            title: '🎉 25শে ডিসেম্বর সমবায় সঞ্চয় রিফান্ড সম্পূর্ণ!',
            message: `আপনার সমবায় সমিতি সঞ্চয়ের মোট ৳${savingsToRelease.toLocaleString('bn-BD')} টাকা সফলভাবে আপনার মেইন ব্যালেন্সে জমা করা হয়েছে।`
          });
        } catch (err) {
          console.error("Auto release error:", err);
        }
      }
    };

    checkDec25AutoRelease();
  }, [user.uid, user.samityDeactivateStatus, user.savings, user.canDisableAutoSavings, user.samityAutoSavingsActive]);

  // Handle Dec 25-30 auto-transfer when auto-savings switch is OFF
  const [selectedPayMonth, setSelectedPayMonth] = useState<{ id: string; monthNum: number; name: string; year: number } | null>(null);
  const [monthPayLoading, setMonthPayLoading] = useState(false);
  const [trackerSelectedYear, setTrackerSelectedYear] = useState<number>(new Date().getFullYear() > 2050 ? 2050 : Math.max(2026, new Date().getFullYear()));
  const unpaidQuarters = SAMITY_QUARTERLY_MONTHS.filter(q => !isUserQuarterlyPaid(activeTarget, trackerSelectedYear, q.id));
  const [show2050CalendarModal, setShow2050CalendarModal] = useState(false);

  const SAMITY_YEARS = Array.from({ length: 2050 - 2026 + 1 }, (_, i) => 2026 + i);

  const SAMITY_MONTHS = [
    { id: 'jan', monthNum: 1, name: 'জানুয়ারি', short: 'Jan' },
    { id: 'feb', monthNum: 2, name: 'ফেব্রুয়ারি', short: 'Feb' },
    { id: 'mar', monthNum: 3, name: 'মার্চ', short: 'Mar' },
    { id: 'apr', monthNum: 4, name: 'এপ্রিল', short: 'Apr' },
    { id: 'may', monthNum: 5, name: 'মে', short: 'May' },
    { id: 'jun', monthNum: 6, name: 'জুন', short: 'Jun' },
    { id: 'jul', monthNum: 7, name: 'জুলাই', short: 'Jul' },
    { id: 'aug', monthNum: 8, name: 'আগস্ট', short: 'Aug' },
    { id: 'sep', monthNum: 9, name: 'সেপ্টেম্বর', short: 'Sep' },
    { id: 'oct', monthNum: 10, name: 'অক্টোবর', short: 'Oct' },
    { id: 'nov', monthNum: 11, name: 'নভেম্বর', short: 'Nov' },
    { id: 'dec', monthNum: 12, name: 'ডিসেম্বর', short: 'Dec' },
  ];

  const [bulkPayLoading, setBulkPayLoading] = useState(false);

  const handlePayAllAffordableMonths = async () => {
    if (!effectiveUser || !effectiveUser.uid) return;
    const targetAmt = targetMonthlyRate;
    const currentBal = getEffectiveBalance(effectiveUser);
    if (currentBal < targetAmt) {
      setCustomAlert({
        title: '⚠️ পর্যাপ্ত ব্যালেন্স নেই',
        message: `আপনার বর্তমান মেইন ব্যালেন্স ৳${currentBal.toLocaleString('bn-BD')} টাকা। প্রতি কিস্তি ৳${targetAmt.toLocaleString('bn-BD')} টাকা অনুযায়ী অন্তত 1টি কিস্তি দেওয়ার জন্য পর্যাপ্ত টাকা নেই।`
      });
      return;
    }

    setBulkPayLoading(true);
    try {
      // STRICT RULE: Only process at most 1 overdue month at a time!
      // Future months (October, November, etc.) will NEVER be auto-deducted!
      const res = await processUserSamitySavingsAutoDeduction(effectiveUser, { maxMonths: 1, isExplicitUserAction: true });
      if (res.success && res.deductedAmount > 0) {
        await syncLiveProfile();
        const monthNamesStr = res.monthsPaid.map(m => `${m.name} ${m.year}`).join(', ');
        setCustomAlert({
          title: `🎉 কিস্তি জমা সফল!`,
          message: `আপনার মেইন ব্যালেন্স থেকে (${monthNamesStr}) মাসের ৳${res.deductedAmount.toLocaleString('bn-BD')} টাকা সমবায় সঞ্চয় ফান্ডে জমা করা হয়েছে!`
        });
      } else {
        setCustomAlert({
          title: 'তথ্য',
          message: res.message || 'পরিশোধ করার মতো কোনো বকেয়া কিস্তি পাওয়া যায়নি।'
        });
      }
    } catch (err: any) {
      alert('ত্রুটি: ' + (err?.message || 'কিস্তি জমা দেওয়া সম্ভব হয়নি।'));
    } finally {
      setBulkPayLoading(false);
    }
  };

  const handleConfirmMonthPayment = async () => {
    if (!selectedPayMonth) return;
    const targetAmt = targetMonthlyRate;
    const payYear = selectedPayMonth.year || trackerSelectedYear;
    const currentBal = getEffectiveBalance(effectiveUser);
    if (currentBal < targetAmt) {
      setCustomAlert({
        title: '⚠️ পর্যাপ্ত ব্যালেন্স নেই',
        message: `আপনার মেইন ব্যালেন্স ৳${currentBal.toLocaleString('bn-BD')} টাকা। ${selectedPayMonth.name} ${payYear} সালের সঞ্চয় ৳${targetAmt.toLocaleString('bn-BD')} জমা দিতে পর্যাপ্ত মেইন ব্যালেন্স নেই।`
      });
      return;
    }

    setMonthPayLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const yearMonthKey = `${payYear}-${selectedPayMonth.id}`;

      await runTransaction(db, async (transaction) => {
        const uSnap = await transaction.get(userRef);
        if (!uSnap.exists()) {
          throw new Error('ব্যবহারকারীর প্রোফাইল পাওয়া যায়নি।');
        }
        const freshData = uSnap.data() as User;
        const liveBal = getEffectiveBalance(freshData);
        const liveTargetRate = Math.max(1, Number(freshData.monthlySavingsTarget) || targetAmt);

        if (liveBal < liveTargetRate) {
          throw new Error(`আপনার মেইন ব্যালেন্স ৳${liveBal.toLocaleString('bn-BD')} টাকা। ${selectedPayMonth.name} ${payYear} সালের সঞ্চয় ৳${liveTargetRate.toLocaleString('bn-BD')} জমা দিতে পর্যাপ্ত মেইন ব্যালেন্স নেই।`);
        }

        const existingPaid = Array.isArray(freshData.samityPaidMonths) ? freshData.samityPaidMonths : [];
        const currentSavings = Number(freshData.savings) || 0;

        const updatedPaid = normalizePaidMonthsArray([...existingPaid, yearMonthKey], currentSavings + liveTargetRate, liveTargetRate);
        const newSavings = currentSavings + liveTargetRate;
        const newMainBal = Math.max(0, liveBal - liveTargetRate);

        transaction.update(userRef, {
          balance: newMainBal,
          mainBalance: newMainBal,
          savings: newSavings,
          dpsBalance: newSavings,
          samityPaidMonths: updatedPaid
        });

        const txRef = doc(collection(db, 'transactions'));
        const notifRef = doc(collection(db, 'user_notifications'));
        const nowIso = new Date().toISOString();

        transaction.set(txRef, {
          id: txRef.id,
          userId: user.uid,
          userName: freshData.name || user.name || '',
          memberId: freshData.memberId || user.memberId || '',
          type: 'samity_deposit',
          typeLabel: `সমিতি সঞ্চয় জমা (${selectedPayMonth.name} ${payYear})`,
          amount: liveTargetRate,
          status: 'approved',
          isApproved: true,
          paymentMethod: 'BNB Wallet',
          description: `সদস্য কর্তৃক ওয়ালেট থেকে ${selectedPayMonth.name} ${payYear} সালের সমিতি সঞ্চয় কিস্তি ৳${liveTargetRate.toLocaleString('bn-BD')} জমা দেওয়া হয়েছে।`,
          createdAt: nowIso,
          receiptNo: `DEP-MONTH-${Date.now()}`
        });

        transaction.set(notifRef, {
          id: notifRef.id,
          userId: user.uid,
          memberId: freshData.memberId || user.memberId || '',
          title: `✅ ${selectedPayMonth.name} ${payYear} সালের সঞ্চয় জমা সফল`,
          body: `আপনার মেইন ব্যালেন্স থেকে ${selectedPayMonth.name} ${payYear} সালের কিস্তি ৳${liveTargetRate.toLocaleString('bn-BD')} টাকা সমিতি সঞ্চয় ফান্ডে জমা হয়েছে।`,
          read: false,
          isPersonal: true,
          isTransactionHistory: true,
          category: 'transaction',
          createdAt: nowIso
        });
      });

      await syncLiveProfile();
      setSelectedPayMonth(null);
      setCustomAlert({
        title: `🎉 ${selectedPayMonth.name} ${payYear} সালের জমা সফল`,
        message: `${selectedPayMonth.name} ${payYear} সালের সমিতি সঞ্চয় কিস্তি ৳${targetAmt.toLocaleString('bn-BD')} টাকা সফলভাবে জমা হয়েছে!`
      });
    } catch (err: any) {
      console.error('Month payment error:', err);
      alert(err?.message || 'টাকা জমা প্রক্রিয়ায় সমস্যা ঘটেছে। আবার চেষ্টা করুন।');
    } finally {
      setMonthPayLoading(false);
    }
  };

  const [dbSearchResults, setDbSearchResults] = useState<User[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  
  // High-fidelity Custom Pop-up Modal state
  const [customAlert, setCustomAlert] = useState<{ message: string; title?: string } | null>(null);
  const [noticeFilter, setNoticeFilter] = useState<'all' | 'samity' | 'general'>('all');
  const [readNoticeIds, setReadNoticeIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('samity_read_notice_ids') || '[]');
    } catch (e) {
      return [];
    }
  });

  // Filter allNotices strictly for Samity / Co-operative & General Admin announcements
  const samityNotices = useMemo(() => {
    return (allNotices || []).filter(n => {
      // Exclude other non-Samity section notices (telecom, safe_deal, shop, ration)
      if (n.section === 'telecom' || n.section === 'safe_deal' || n.section === 'shop' || n.section === 'ration') {
        return false;
      }
      // Exclude auto transaction/booking logs or system auto-notifications
      if (n.isTransactionHistory === true || n.isSystemAuto === true) {
        return false;
      }
      const titleText = ((n.title || '') + ' ' + (n.content || '')).toLowerCase();
      if (
        titleText.includes('নিরাপদ লেনদেন') || 
        titleText.includes('ক্যাশ ইন') || 
        titleText.includes('রিচার্জ') || 
        titleText.includes('বুর্কিং') || 
        titleText.includes('booking')
      ) {
        return false;
      }
      return true;
    });
  }, [allNotices]);

  const isSamityNoticeRead = (n: any) => {
    if (n.read === true) return true;
    const idKey = n.id || n.docId;
    if (idKey && readNoticeIds.includes(idKey)) return true;
    return false;
  };

  const unreadSamityCount = samityNotices.filter(n => !isSamityNoticeRead(n)).length;
  const hasUnreadSamity = unreadSamityCount > 0;

  const markAllSamityNoticesAsRead = () => {
    const idsToMark = samityNotices.map((n, idx) => n.id || n.docId).filter(Boolean);
    if (idsToMark.length > 0) {
      const updated = Array.from(new Set([...readNoticeIds, ...idsToMark]));
      setReadNoticeIds(updated);
      try {
        localStorage.setItem('samity_read_notice_ids', JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save read notice ids:", e);
      }
    }
  };

  const handleToggleReadNotice = (noticeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!noticeId) return;
    
    let updated: string[];
    if (readNoticeIds.includes(noticeId)) {
      updated = readNoticeIds.filter(id => id !== noticeId);
    } else {
      updated = [...readNoticeIds, noticeId];
    }
    setReadNoticeIds(updated);
    try {
      localStorage.setItem('samity_read_notice_ids', JSON.stringify(updated));
    } catch (err) {
      console.error("Save read state error:", err);
    }
  };

  const handleDeleteNotice = async (noticeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!noticeId) return;
    if (!window.confirm("আপনি কি এই নোটিশটি ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, 'notices', noticeId));
      setCustomAlert({ title: "সফল", message: "নোটিশটি মুছে ফেলা হয়েছে।" });
    } catch (err) {
      console.error("Failed to delete notice from firestore:", err);
      const updated = Array.from(new Set([...readNoticeIds, noticeId]));
      setReadNoticeIds(updated);
      try {
        localStorage.setItem('samity_read_notice_ids', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const handleClearAllNotices = async () => {
    if (samityNotices.length === 0) return;
    if (!window.confirm("আপনি কি নিশ্চিত যে সকল নোটিশ মুছে ফেলতে চান?")) return;
    try {
      for (const n of samityNotices) {
        const idKey = n.id || n.docId;
        if (idKey) {
          await deleteDoc(doc(db, 'notices', idKey));
        }
      }
      setCustomAlert({ title: "সফল", message: "সকল নোটিশ সফলভাবে মুছে ফেলা হয়েছে।" });
    } catch (err) {
      console.error("Clear notices error:", err);
      markAllSamityNoticesAsRead();
    }
  };

  // Automatically mark all Samity notices as read whenever Notice Board tab is opened or active
  useEffect(() => {
    if (bottomTab === 'messages') {
      markAllSamityNoticesAsRead();
    }
  }, [bottomTab, samityNotices]);

  // Admin integration states
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminTransactions, setAdminTransactions] = useState<Transaction[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [reconUserUid, setReconUserUid] = useState('');
  const [reconAction, setReconAction] = useState<'add_savings' | 'reduce_savings' | 'add_dps' | 'reduce_dps' | 'add_profits' | 'reduce_profits' | 'disburse_loan' | 'repay_loan_cash' | 'disburse_qard' | 'repay_qard'>('add_savings');
  const [reconAmount, setReconAmount] = useState('');
  const [reconNotes, setReconNotes] = useState('');
  const [reconSuccess, setReconSuccess] = useState('');
  const [reconError, setReconError] = useState('');
  const [dbSamityBanners, setDbSamityBanners] = useState<any[]>([]);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    requireInput?: boolean;
    inputValue?: string;
    inputPlaceholder?: string;
    onConfirm: (val?: string) => void;
    onCancel?: () => void;
  } | null>(null);

  const requestConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      onConfirm: () => {
        onConfirm();
      }
    });
  };

  const requestPrompt = (title: string, description: string, defaultValue: string, onConfirm: (val: string) => void) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      requireInput: true,
      inputValue: defaultValue,
      onConfirm: (val) => {
        onConfirm(val || '');
      }
    });
  };

  const requestAlert = (title: string, description: string) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      onConfirm: () => {}
    });
  };

  const customAlertFn = (msg: string) => {
    requestAlert('সিস্টেম রিকোয়েস্ট', msg);
  };

  const handleToggleAutoSavingsOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchOffReason.trim()) {
      setCustomAlert({ title: "⚠️ কারণ প্রয়োজন", message: "কেন আপনি সমবায় সমিতি সঞ্চয় বন্ধ/লিভ নিতে চান তা বিস্তারিত লিখুন।" });
      return;
    }
    const userPin = String(user?.pin || (user as any)?.pinCode || (user as any)?.securityPin || '').trim();
    if (userPin && switchSecurityPin.trim() !== userPin) {
      setCustomAlert({ title: "❌ ভুল পিন কোড", message: "আপনার 4 ডিজিটের সিকিউরিটি পিন কোডটি সঠিক নয়!" });
      return;
    }
    if (!userPin && switchSecurityPin.trim().length !== 4) {
      setCustomAlert({ title: "❌ 4 ডিজিটের পিন আবশ্যক", message: "অনুগ্রহ করে আপনার 4 ডিজিটের সিকিউরিটি পিন কোড দিন।" });
      return;
    }

    setSwitchSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const userRef = doc(db, 'users', user.uid);
      const totalSaved = Number(user.savings !== undefined ? user.savings : (user as any).dpsBalance) || 0;

      await updateDoc(userRef, {
        samityAutoSavingsActive: false,
        samityDeactivateStatus: 'self_opted_out',
        samitySwitchStatus: 'OFF',
        samityOptOutReason: switchOffReason.trim(),
        samityOptOutDate: nowIso,
        samitySwitchLastUpdated: nowIso,
        updatedAt: serverTimestamp()
      });

      setSamityAutoSavingsActive(false);

      // Create a pending transaction record so Admin Panel & Header Pending Center immediately display it
      try {
        const withdrawTxId = `TX-SAMITY-WD-${Date.now()}`;
        await addDoc(collection(db, 'transactions'), {
          id: withdrawTxId,
          userId: user.uid,
          userName: user.name || '',
          userPhone: user.phone || '',
          memberId: user.memberId || '',
          type: 'withdraw',
          typeLabel: 'সমবায় অটো সঞ্চয় বন্ধ ও উত্তোলন আবেদন',
          category: 'samity_withdraw',
          amount: totalSaved,
          savingsAmount: totalSaved,
          status: 'pending',
          isSavingsWithdraw: true,
          reason: switchOffReason.trim(),
          paymentMethod: 'মেইন ওয়ালেট রিফান্ড / ব্যাংক / ক্যাশ',
          method: 'wallet_refund',
          accountTitle: user.name || '',
          accountNumber: user.phone || '',
          description: `সমবায় সমিতি অটো সঞ্চয় বন্ধ ও টাকা উত্তোলনের আবেদন। কারণ: "${switchOffReason.trim()}"। জমাকৃত মোট সঞ্চয়: ৳${totalSaved.toLocaleString('bn-BD')} টাকা।`,
          createdAt: nowIso,
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString(),
          receiptNo: `REC-SAMITY-WD-${Math.floor(100000 + Math.random() * 900000)}`
        });
      } catch (txErr) {
        console.warn("transactions pending write failed:", txErr);
      }

      // Dispatch Real-Time Admin Notification
      try {
        await addDoc(collection(db, 'admin_notifications'), {
          title: '⏸️ সদস্য সমিতি সঞ্চয় বন্ধ ও উত্তোলন আবেদন করেছেন',
          message: `${user.name || 'সদস্য'} (আইডি: ${user.memberId || 'N/A'}, মোবাইল: ${user.phone || 'N/A'}) সমিতি সঞ্চয় সুইচ অফ ও ৳${totalSaved.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন করেছেন। কারণ: "${switchOffReason.trim()}"।`,
          userId: user.uid,
          memberId: user.memberId || '',
          userName: user.name || '',
          userPhone: user.phone || '',
          action: 'OFF',
          reason: switchOffReason.trim(),
          savingsAmount: totalSaved,
          type: 'samity_opt_out',
          read: false,
          createdAt: serverTimestamp()
        });

        // Also save in user_notifications
        await addDoc(collection(db, 'user_notifications'), {
          title: '⏸️ সমবায় সমিতি সঞ্চয় বন্ধ ও উত্তোলন আবেদন',
          message: `${user.name || 'সদস্য'} (আইডি: ${user.memberId || 'N/A'}) সমিতি সঞ্চয় সুইচ অফ করেছেন। কারণ: ${switchOffReason.trim()}। এডমিন অনুমোদন সাপেক্ষে জমাকৃত মোট ৳${totalSaved.toLocaleString('bn-BD')} টাকা মেইন ব্যালেন্সে জমা হবে অথবা 25শে ডিসেম্বর স্বয়ংক্রিয়ভাবে প্রদান করা হবে।`,
          body: `${user.name || 'সদস্য'} (আইডি: ${user.memberId || 'N/A'}) সমিতি সঞ্চয় সুইচ অফ করেছেন। কারণ: ${switchOffReason.trim()}। এডমিন অনুমোদন সাপেক্ষে জমাকৃত মোট ৳${totalSaved.toLocaleString('bn-BD')} টাকা মেইন ব্যালেন্সে জমা হবে অথবা 25শে ডিসেম্বর স্বয়ংক্রিয়ভাবে প্রদান করা হবে।`,
          userId: user.uid,
          memberId: user.memberId || '',
          userName: user.name || '',
          category: 'system',
          type: 'samity_opt_out',
          isPersonal: false,
          read: false,
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString(),
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("admin_notifications write failed:", e);
      }

      // Dispatch User Personal Notification
      try {
        await addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          memberId: user.memberId || '',
          title: '⏸️ সমিতি অটো সঞ্চয় সুইচ বন্ধ ও টাকা উত্তোলন আবেদন',
          message: `আপনার অটো সঞ্চয় বন্ধ ও ৳${totalSaved.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন এডমিন প্যানেলে জমা হয়েছে। এডমিন যাচাই করে অনুমোদন করার পর টাকা আপনার মেইন ব্যালেন্সে জমা হবে অথবা 25শে ডিসেম্বর স্বয়ংক্রিয়ভাবে রিফান্ড হবে।`,
          body: `আপনার অটো সঞ্চয় বন্ধ ও ৳${totalSaved.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন এডমিন প্যানেলে জমা হয়েছে। এডমিন যাচাই করে অনুমোদন করার পর টাকা আপনার মেইন ব্যালেন্সে জমা হবে অথবা 25শে ডিসেম্বর স্বয়ংক্রিয়ভাবে রিফান্ড হবে।`,
          isPersonal: true,
          read: false,
          type: 'samity',
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString(),
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("user_notifications write failed:", e);
      }

      syncLiveProfile();
      setActiveTopModal('none');
      setSwitchOffReason('');
      setSwitchSecurityPin('');

      setCustomAlert({
        title: "⏸️ অটো সঞ্চয় বন্ধ ও উত্তোলন আবেদন",
        message: `আপনার অটো সঞ্চয় বন্ধ ও ৳${totalSaved.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদনটি সফলভাবে এডমিন প্যানেলে জমা হয়েছে। এডমিন প্যানেল যাচাই করে অনুমোদন দেওয়ার পর টাকা আপনার মেইন একাউন্টে যোগ হবে অথবা 25শে ডিসেম্বর স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্সে চলে যাবে।`
      });
    } catch (err: any) {
      console.error("Error setting auto savings switch off:", err);
      setCustomAlert({ title: "❌ ত্রুটি", message: "সঞ্চয় বন্ধ করতে ব্যর্থ হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।" });
    } finally {
      setSwitchSubmitting(false);
    }
  };

  const handleToggleAutoSavingsOn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchOnReason.trim()) {
      setCustomAlert({ title: "⚠️ কারণ আবশ্যক", message: "সঞ্চয় পুনরায় চালু (ON) করার কারণ উল্লেখ করুন।" });
      return;
    }
    const userPin = String(user?.pin || (user as any)?.pinCode || (user as any)?.securityPin || '').trim();
    if (userPin && switchSecurityPin.trim() !== userPin) {
      setCustomAlert({ title: "❌ ভুল পিন কোড", message: "আপনার 4 ডিজিটের সিকিউরিটি পিন কোডটি সঠিক নয়!" });
      return;
    }
    if (!userPin && switchSecurityPin.trim().length !== 4) {
      setCustomAlert({ title: "❌ 4 ডিজিটের পিন আবশ্যক", message: "অনুগ্রহ করে আপনার 4 ডিজিটের সিকিউরিটি পিন কোড দিন।" });
      return;
    }

    setSwitchSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        samityAutoSavingsActive: true,
        samityDeactivateStatus: 'active',
        samitySwitchStatus: 'ON',
        samityOptInReason: switchOnReason.trim(),
        samityOptInDate: nowIso,
        samitySwitchLastUpdated: nowIso,
        updatedAt: serverTimestamp()
      });

      setSamityAutoSavingsActive(true);

      // Dispatch Real-Time Admin Notification
      try {
        await addDoc(collection(db, 'admin_notifications'), {
          title: '🔄 সদস্য সমিতি সঞ্চয় পুনরায় সচল (ON) করেছেন',
          message: `${user.name || 'সদস্য'} (আইডি: ${user.memberId || 'N/A'}, মোবাইল: ${user.phone || 'N/A'}) সমিতি সঞ্চয় পুনরায় সচল (ON) করেছেন। কারণ: "${switchOnReason.trim()}"।`,
          userId: user.uid,
          memberId: user.memberId || '',
          userName: user.name || '',
          userPhone: user.phone || '',
          action: 'ON',
          reason: switchOnReason.trim(),
          type: 'samity_opt_in',
          read: false,
          createdAt: serverTimestamp()
        });

        // Also save in user_notifications
        await addDoc(collection(db, 'user_notifications'), {
          title: '🔄 সমবায় সমিতি সঞ্চয় পুনরায় সচল (ON) নোটিফিকেশন',
          message: `${user.name || 'সদস্য'} (আইডি: ${user.memberId || 'N/A'}) সমিতি সঞ্চয় পুনরায় চালু করেছেন। কারণ: ${switchOnReason.trim()}।`,
          body: `${user.name || 'সদস্য'} (আইডি: ${user.memberId || 'N/A'}) সমিতি সঞ্চয় পুনরায় চালু করেছেন। কারণ: ${switchOnReason.trim()}।`,
          userId: user.uid,
          memberId: user.memberId || '',
          userName: user.name || '',
          category: 'system',
          type: 'samity_opt_in',
          isPersonal: false,
          read: false,
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString(),
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("admin_notifications write failed:", e);
      }

      // Notification to user
      try {
        await addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          memberId: user.memberId || '',
          title: '🔄 সমিতি অটো সঞ্চয় পুনরায় সচল (ON)',
          body: `আপনার সমবায় সমিতির মাসিক অটো সঞ্চয় প্রক্রিয়া সফলভাবে পুনরায় সচল করা হয়েছে। কারণ: ${switchOnReason.trim()}`,
          message: `আপনার সমবায় সমিতির মাসিক অটো সঞ্চয় প্রক্রিয়া সফলভাবে পুনরায় সচল করা হয়েছে। কারণ: ${switchOnReason.trim()}`,
          isPersonal: true,
          read: false,
          type: 'samity',
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString(),
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("user_notifications write failed:", e);
      }

      syncLiveProfile();
      setActiveTopModal('none');
      setSwitchOnReason('');
      setSwitchSecurityPin('');

      setCustomAlert({
        title: "🔄 অটো সঞ্চয় সচল (ON)",
        message: "আপনার অটো সঞ্চয় সফলভাবে পুনরায় সচল (ON) করা হয়েছে। এডমিন প্যানেলে নোটিফিকেশন পৌঁছে গেছে।"
      });
    } catch (err: any) {
      console.error("Error setting auto savings switch on:", err);
      setCustomAlert({ title: "❌ ত্রুটি", message: "সঞ্চয় সচল করতে ব্যর্থ হয়েছে।" });
    } finally {
      setSwitchSubmitting(false);
    }
  };

  const handleUpgradeToOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerAgree) {
      setCustomAlert({
        title: "⚠️ শর্তাবলীতে সম্মতি প্রয়োজন",
        message: "ওনার সদস্য হতে হলে মাসিক কিস্তি ৳৪,০০০, ৩ মাস পর পর অতিরিক্ত কিস্তি ৳১০,০০০ এবং নীতিমালায় টিক দিয়ে সম্মতি দিতে হবে।"
      });
      return;
    }
    const userPin = String(user?.pin || (user as any)?.pinCode || (user as any)?.securityPin || '').trim();
    if (userPin && ownerUpgradePin.trim() !== userPin) {
      setCustomAlert({ title: "❌ ভুল পিন কোড", message: "আপনার 4 ডিজিটের সিকিউরিটি পিন কোডটি সঠিক নয়!" });
      return;
    }
    if (!userPin && ownerUpgradePin.trim().length !== 4) {
      setCustomAlert({ title: "❌ 4 ডিজিটের পিন আবশ্যক", message: "অনুগ্রহ করে আপনার 4 ডিজিটের সিকিউরিটি পিন কোড দিন।" });
      return;
    }

    setOwnerUpgrading(true);
    try {
      const nowIso = new Date().toISOString();
      const userRef = doc(db, 'users', user.uid);

      await updateDoc(userRef, {
        memberCategory: 'owner',
        monthlySavingsTarget: 4000,
        categoryUpgradeDate: nowIso,
        updatedAt: serverTimestamp()
      });

      // Dispatch Admin Notification
      await addDoc(collection(db, 'admin_notifications'), {
        title: '🔴 নতুন ওনার সদস্য আপগ্রেড',
        message: `${user.name || 'সদস্য'} (আইডি: ${user.memberId || 'N/A'}, ফোন: ${user.phone || 'N/A'}) ওনার সদস্য হিসেবে একাউন্ট যুক্ত করেছেন (মাসিক ৳৪,০০০ ও ৩ মাস পর পর ৳১০,০০০ কিস্তি)।`,
        userId: user.uid,
        memberId: user.memberId || '',
        userName: user.name || '',
        userPhone: user.phone || '',
        type: 'owner_upgrade',
        read: false,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'user_notifications'), {
        userId: user.uid,
        memberId: user.memberId || '',
        title: '🔴 অভিনন্দন! আপনি এখন ওনার সদস্য',
        body: 'আপনি সফলভাবে সমবায় সমিতির ওনার পদে যুক্ত হয়েছেন। আপনার মাসিক কিস্তি ৳৪,০০০ এবং ৩ মাস পর পর কিস্তি ৳১০,০০০ নির্ধারিত হয়েছে। সর্বোচ্চ ৩ জন নমিনি দিতে পারবেন।',
        message: 'আপনি সফলভাবে সমবায় সমিতির ওনার পদে যুক্ত হয়েছেন। আপনার মাসিক কিস্তি ৳৪,০০০ এবং ৩ মাস পর পর কিস্তি ৳১০,০০০ নির্ধারিত হয়েছে। সর্বোচ্চ ৩ জন নমিনি দিতে পারবেন।',
        isPersonal: true,
        read: false,
        type: 'owner',
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        createdAt: serverTimestamp()
      });

      syncLiveProfile();
      setActiveTopModal('none');
      setOwnerAgree(false);
      setOwnerUpgradePin('');

      setCustomAlert({
        title: "🔴 অভিনন্দন ওনার সদস্য!",
        message: "আপনি সফলভাবে ওনার সদস্য হিসেবে নিবন্ধিত হয়েছেন। মাসিক কিস্তি ৳৪,০০০ এবং ৩ মাস পর পর কিস্তি ৳১০,০০০ কার্যকর হবে।"
      });
    } catch (err: any) {
      console.error("Error upgrading to owner:", err);
      setCustomAlert({ title: "❌ ব্যর্থ হয়েছে", message: "ওনার পদবীতে আপগ্রেড সম্পন্ন করা সম্ভব হয়নি।" });
    } finally {
      setOwnerUpgrading(false);
    }
  };

  const handleSaveNominee = async (nomineeData: MemberNominee) => {
    if (!nomineeData.name.trim()) {
      setCustomAlert({ title: "⚠️ নাম আবশ্যক", message: "নমিনির নাম প্রদান করা বাধ্যতামূলক।" });
      return;
    }
    const currentNominees: MemberNominee[] = Array.isArray(effectiveUser.nominees) ? [...effectiveUser.nominees] : [];
    const cat = getMembershipCategory(effectiveUser);
    const maxLimit = cat.key === 'owner' ? 3 : cat.key === 'shareholder' ? 2 : 1;

    if (currentNominees.length >= maxLimit) {
      setCustomAlert({
        title: "⚠️ সর্বোচ্চ নমিনি সীমা",
        message: `আপনার বর্তমান পদবী (${cat.titleBn}) অনুযায়ী ফর্মে সর্বোচ্চ ${maxLimit} জনের নাম দিতে পারবেন।`
      });
      return;
    }

    setSavingNominees(true);
    try {
      const updatedList = [...currentNominees, { ...nomineeData, id: `nom_${Date.now()}` }];
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        nominees: updatedList,
        nomineeName: updatedList[0]?.name || '',
        nomineeRelation: updatedList[0]?.relation || '',
        nomineePhone: updatedList[0]?.phone || '',
        nomineeNid: updatedList[0]?.nid || '',
        updatedAt: serverTimestamp()
      });
      syncLiveProfile();
      setNomineeInputName('');
      setNomineeInputRelation('');
      setNomineeInputPhone('');
      setNomineeInputNid('');
      setCustomAlert({
        title: "✅ নমিনি সংরক্ষিত",
        message: `নমিনি "${nomineeData.name}" সফলভাবে যুক্ত করা হয়েছে।`
      });
    } catch (e: any) {
      setCustomAlert({ title: "❌ ত্রুটি", message: "নমিনি সংরক্ষণ করতে সমস্যা হয়েছে: " + e.message });
    } finally {
      setSavingNominees(false);
    }
  };

  const handleDeleteNominee = async (nomineeIndex: number) => {
    const currentNominees: MemberNominee[] = Array.isArray(effectiveUser.nominees) ? [...effectiveUser.nominees] : [];
    currentNominees.splice(nomineeIndex, 1);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        nominees: currentNominees,
        nomineeName: currentNominees[0]?.name || '',
        nomineeRelation: currentNominees[0]?.relation || '',
        nomineePhone: currentNominees[0]?.phone || '',
        nomineeNid: currentNominees[0]?.nid || '',
        updatedAt: serverTimestamp()
      });
      syncLiveProfile();
    } catch (e: any) {
      console.error("Error deleting nominee:", e);
    }
  };

  const handlePayQuarterly = async (qId: string, yr: number) => {
    const activeTarget = quarterTargetMember || effectiveUser;
    const isOwner = activeTarget.memberCategory === 'owner';
    const isShareholder = activeTarget.memberCategory === 'shareholder';
    if (!isOwner && !isShareholder) {
      setCustomAlert({
        title: "⚠️ প্রযোজ্য নয়",
        message: "৩ মাস পর পর কিস্তি শুধুমাত্র ওনার (৳১০,০০০) ও শেয়ার হোল্ডার (৳৫,০০০) সদস্যদের জন্য প্রযোজ্য।"
      });
      return;
    }
    const qRate = isOwner ? 10000 : 5000;
    const balanceToCheck = (quarterTargetMember && quarterPaymentSource === 'target')
      ? getEffectiveBalance(quarterTargetMember)
      : getEffectiveBalance(effectiveUser);

    if (balanceToCheck < qRate) {
      setCustomAlert({
        title: "⚠️ পর্যাপ্ত ব্যালেন্স নেই",
        message: `${(quarterTargetMember && quarterPaymentSource === 'target') ? 'সদস্যের' : 'আপনার'} মেইন ব্যালেন্স ৳${balanceToCheck.toLocaleString('bn-BD')} টাকা। ত্রৈমাসিক কিস্তি ৳${qRate.toLocaleString('bn-BD')} টাকা পরিশোধ করার জন্য পর্যাপ্ত টাকা নেই।`
      });
      return;
    }

    setQuarterlyPaying(true);
    try {
      const res = await processQuarterlyInstallmentPayment(
        activeTarget,
        yr,
        qId,
        true,
        effectiveUser,
        quarterPaymentSource
      );
      if (res.success) {
        await syncLiveProfile();
        if (quarterTargetMember) {
          const freshTargetSnap = await getDoc(doc(db, 'users', quarterTargetMember.uid));
          if (freshTargetSnap.exists()) {
            setQuarterTargetMember({ uid: freshTargetSnap.id, ...freshTargetSnap.data() } as User);
          }
        }
        setCustomAlert({
          title: "🎉 ত্রৈমাসিক কিস্তি জমা সফল!",
          message: res.message
        });
      } else {
        setCustomAlert({
          title: "❌ কিস্তি জমা ব্যর্থ",
          message: res.message
        });
      }
    } catch (e: any) {
      setCustomAlert({
        title: "❌ ত্রুটি",
        message: e?.message || "ত্রৈমাসিক কিস্তি জমা ব্যর্থ হয়েছে।"
      });
    } finally {
      setQuarterlyPaying(false);
    }
  };

  const handlePayMultipleQuarterly = async (qIdsToPay?: string[]) => {
    const activeTarget = quarterTargetMember || effectiveUser;
    const isOwner = activeTarget.memberCategory === 'owner';
    const isShareholder = activeTarget.memberCategory === 'shareholder';
    if (!isOwner && !isShareholder) {
      setCustomAlert({
        title: "⚠️ প্রযোজ্য নয়",
        message: "৩ মাস পর পর কিস্তি শুধুমাত্র ওনার (৳১০,০০০) ও শেয়ার হোল্ডার (৳৫,০০০) সদস্যদের জন্য প্রযোজ্য।"
      });
      return;
    }
    const qIds = qIdsToPay && qIdsToPay.length > 0 ? qIdsToPay : selectedQuarterIds;
    if (!qIds || qIds.length === 0) {
      setCustomAlert({
        title: "⚠️ কিস্তি নির্বাচন করুন",
        message: "অনুগ্রহ করে কমপক্ষে একটি বা একাধিক কিস্তি নির্বাচন করুন।"
      });
      return;
    }
    const qRate = isOwner ? 10000 : 5000;
    const totalCost = qIds.length * qRate;
    const balanceToCheck = (quarterTargetMember && quarterPaymentSource === 'target')
      ? getEffectiveBalance(quarterTargetMember)
      : getEffectiveBalance(effectiveUser);

    if (balanceToCheck < totalCost) {
      setCustomAlert({
        title: "⚠️ পর্যাপ্ত ব্যালেন্স নেই",
        message: `${(quarterTargetMember && quarterPaymentSource === 'target') ? 'সদস্যের' : 'আপনার'} মেইন ব্যালেন্স ৳${balanceToCheck.toLocaleString('bn-BD')} টাকা। নির্বাচিত ${qIds.length}টি কিস্তির মোট পরিমাণ ৳${totalCost.toLocaleString('bn-BD')} টাকা পরিশোধ করার জন্য পর্যাপ্ত টাকা নেই।`
      });
      return;
    }

    setQuarterlyPaying(true);
    try {
      const res = await processMultipleQuarterlyInstallmentsPayment(
        activeTarget,
        trackerSelectedYear,
        qIds,
        true,
        effectiveUser,
        quarterPaymentSource
      );
      if (res.success) {
        setSelectedQuarterIds([]);
        await syncLiveProfile();
        if (quarterTargetMember) {
          const freshTargetSnap = await getDoc(doc(db, 'users', quarterTargetMember.uid));
          if (freshTargetSnap.exists()) {
            setQuarterTargetMember({ uid: freshTargetSnap.id, ...freshTargetSnap.data() } as User);
          }
        }
        setCustomAlert({
          title: "🎉 ত্রৈমাসিক কিস্তি জমা সফল!",
          message: res.message
        });
      } else {
        setCustomAlert({
          title: "❌ কিস্তি জমা ব্যর্থ",
          message: res.message
        });
      }
    } catch (e: any) {
      setCustomAlert({
        title: "❌ ত্রুটি",
        message: e?.message || "ত্রৈমাসিক কিস্তি জমা ব্যর্থ হয়েছে।"
      });
    } finally {
      setQuarterlyPaying(false);
    }
  };

  const handleUpgradeToShareholder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareholderAgree) {
      setCustomAlert({
        title: "⚠️ শর্তাবলীতে সম্মতি প্রয়োজন",
        message: "শেয়ার হোল্ডার হতে হলে আবশ্যকীয় শর্তাবলী ও বড় প্রজেক্ট/জমি ক্রয়ে 50 হাজার থেকে 5 লাখ টাকা মূলধন যোগানের নীতিতে টিক দিয়ে সম্মতি দিতে হবে।"
      });
      return;
    }
    const userPin = String(user?.pin || (user as any)?.pinCode || (user as any)?.securityPin || '').trim();
    if (userPin && shareholderUpgradePin.trim() !== userPin) {
      setCustomAlert({ title: "❌ ভুল পিন কোড", message: "আপনার 4 ডিজিটের সিকিউরিটি পিন কোডটি সঠিক নয়!" });
      return;
    }
    if (!userPin && shareholderUpgradePin.trim().length !== 4) {
      setCustomAlert({ title: "❌ 4 ডিজিটের পিন আবশ্যক", message: "অনুগ্রহ করে আপনার 4 ডিজিটের সিকিউরিটি পিন কোড দিন।" });
      return;
    }

    setShareholderUpgrading(true);
    try {
      const nowIso = new Date().toISOString();
      const userRef = doc(db, 'users', user.uid);

      await updateDoc(userRef, {
        memberCategory: 'shareholder',
        categoryUpgradeDate: nowIso,
        updatedAt: serverTimestamp()
      });

      // Dispatch Admin Notification
      try {
        await addDoc(collection(db, 'admin_notifications'), {
          title: '👑 নতুন শেয়ার হোল্ডার সদস্য আপগ্রেড',
          message: `${user.name || 'সদস্য'} (আইডি: ${user.memberId || 'N/A'}, ফোন: ${user.phone || 'N/A'}) সকল শর্তাবলী মেনে ও 50 হাজার থেকে 5 লাখ টাকা মূলধন দেওয়ার প্রতিশ্রুতি দিয়ে শেয়ার হোল্ডার হিসেবে একাউন্ট আপগ্রেড করেছেন।`,
          userId: user.uid,
          memberId: user.memberId || '',
          userName: user.name || '',
          userPhone: user.phone || '',
          type: 'shareholder_upgrade',
          read: false,
          createdAt: serverTimestamp()
        });

        await addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          memberId: user.memberId || '',
          title: '👑 অভিনন্দন! আপনি এখন একজন শেয়ার হোল্ডার',
          body: 'আপনি সফলভাবে সমবায় সমিতির শেয়ার হোল্ডার পদে যুক্ত হয়েছেন। এখন থেকে আপনি ব্যবসার শতভাগ (100%) বাণিজ্যিক মুনাফা ও ভোটাধিকার উপভোগ করবেন।',
          message: 'আপনি সফলভাবে সমবায় সমিতির শেয়ার হোল্ডার পদে যুক্ত হয়েছেন। এখন থেকে আপনি ব্যবসার শতভাগ (100%) বাণিজ্যিক মুনাফা ও ভোটাধিকার উপভোগ করবেন।',
          isPersonal: true,
          read: false,
          type: 'shareholder',
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString(),
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("Notification error:", e);
      }

      syncLiveProfile();
      setActiveTopModal('none');
      setShareholderAgree(false);
      setShareholderUpgradePin('');

      setCustomAlert({
        title: "👑 অভিনন্দন!",
        message: "আপনি সফলভাবে শেয়ার হোল্ডার সদস্য হিসেবে নিবন্ধিত হয়েছেন। এখন থেকে আপনি সমিতির 100% পূর্ণ বাণিজ্যিক মুনাফা অংশীদারিত্ব ও ভোটাধিকারের সুবিধা পাবেন।"
      });
    } catch (err: any) {
      console.error("Error upgrading to shareholder:", err);
      setCustomAlert({ title: "❌ ব্যর্থ হয়েছে", message: "শেয়ার হোল্ডার পদবীতে আপগ্রেড সম্পন্ন করা সম্ভব হয়নি।" });
    } finally {
      setShareholderUpgrading(false);
    }
  };

  const handleUpgradeToInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investorAgree) {
      setCustomAlert({
        title: "⚠️ শর্তাবলীতে সম্মতি প্রয়োজন",
        message: "ইনভেস্টার হতে হলে মাসিক সঞ্চয় ও 50% লাভ শেয়ারের নীতিতে টিক দিয়ে সম্মতি দিতে হবে।"
      });
      return;
    }
    const userPin = String(user?.pin || (user as any)?.pinCode || (user as any)?.securityPin || '').trim();
    if (userPin && investorUpgradePin.trim() !== userPin) {
      setCustomAlert({ title: "❌ ভুল পিন কোড", message: "আপনার 4 ডিজিটের সিকিউরিটি পিন কোডটি সঠিক নয়!" });
      return;
    }
    if (!userPin && investorUpgradePin.trim().length !== 4) {
      setCustomAlert({ title: "❌ 4 ডিজিটের পিন আবশ্যক", message: "অনুগ্রহ করে আপনার 4 ডিজিটের সিকিউরিটি পিন কোড দিন।" });
      return;
    }

    setInvestorUpgrading(true);
    try {
      const nowIso = new Date().toISOString();
      const userRef = doc(db, 'users', user.uid);

      await updateDoc(userRef, {
        memberCategory: 'investor',
        categoryUpgradeDate: nowIso,
        updatedAt: serverTimestamp()
      });

      // Dispatch Admin Notification
      try {
        await addDoc(collection(db, 'admin_notifications'), {
          title: '💎 নতুন ইনভেস্টার সদস্য নিবন্ধন',
          message: `${user.name || 'সদস্য'} (আইডি: ${user.memberId || 'N/A'}, ফোন: ${user.phone || 'N/A'}) ইনভেস্টার সদস্য হিসেবে একাউন্ট যুক্ত করেছেন (50% লাভ শেয়ার)।`,
          userId: user.uid,
          memberId: user.memberId || '',
          userName: user.name || '',
          userPhone: user.phone || '',
          type: 'investor_upgrade',
          read: false,
          createdAt: serverTimestamp()
        });

        await addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          memberId: user.memberId || '',
          title: '💎 অভিনন্দন! আপনি এখন একজন ইনভেস্টার',
          body: 'আপনি সফলভাবে সমবায় সমিতির ইনভেস্টার পদে যুক্ত হয়েছেন। এখন থেকে আপনি 50% বাণিজ্যিক মুনাফা শেয়ার পাবেন।',
          message: 'আপনি সফলভাবে সমবায় সমিতির ইনভেস্টার পদে যুক্ত হয়েছেন। এখন থেকে আপনি 50% বাণিজ্যিক মুনাফা শেয়ার পাবেন।',
          isPersonal: true,
          read: false,
          type: 'investor',
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString(),
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("Notification error:", e);
      }

      syncLiveProfile();
      setActiveTopModal('none');
      setInvestorAgree(false);
      setInvestorUpgradePin('');

      setCustomAlert({
        title: "💎 অভিনন্দন!",
        message: "আপনি সফলভাবে ইনভেস্টার সদস্য হিসেবে নিবন্ধিত হয়েছেন। আপনি 50% বাণিজ্যিক মুনাফা অংশীদারিত্বের সুবিধা পাবেন।"
      });
    } catch (err: any) {
      console.error("Error upgrading to investor:", err);
      setCustomAlert({ title: "❌ ব্যর্থ হয়েছে", message: "ইনভেস্টার পদবীতে পরিবর্তন সম্পন্ন করা সম্ভব হয়নি।" });
    } finally {
      setInvestorUpgrading(false);
    }
  };

  // Sync admin users and transactions in real-time
  useEffect(() => {
    if (user.role !== 'admin' && user.role !== 'sub_admin') return;

    setAdminLoading(true);

    const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList: User[] = [];
      snapshot.forEach((doc) => {
        usersList.push({ uid: doc.id, ...doc.data() } as User);
      });
      setAdminUsers(usersList);
      setAdminLoading(false);
    }, (error) => {
      console.error("Error fetching users for admin:", error);
    });

    const txUnsubscribe = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const txList: Transaction[] = [];
      snapshot.forEach((doc) => {
        txList.push({ docId: doc.id, ...doc.data() } as Transaction);
      });
      txList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setAdminTransactions(txList);
    }, (error) => {
      console.error("Error fetching transactions for admin:", error);
    });

    return () => {
      usersUnsubscribe();
      txUnsubscribe();
    };
  }, [user.role]);

  // Sync Samity banners initially
  useEffect(() => {
    if (appConfig?.samityBanners) {
      setDbSamityBanners(appConfig.samityBanners);
    }
  }, [appConfig?.samityBanners]);

  const onChangeConfig = async (newConfig: any) => {
    try {
      const configRef = doc(db, 'app_config', 'config_v1');
      await updateDoc(configRef, newConfig);
    } catch (err: any) {
      customAlertFn("কনফিগ আপডেট করতে সমস্যা হয়েছে: " + err.message);
    }
  };

  const autoGenerateMemberId = () => {
    let maxSerial = 0;
    const totalUsers = Array.isArray(adminUsers) ? adminUsers.length : 0;
    if (Array.isArray(adminUsers)) {
      adminUsers.forEach((u) => {
        if (u.memberId && u.memberId.startsWith('BNB')) {
          const serialPart = u.memberId.replace('BNB', '');
          const serialNum = parseInt(serialPart, 10);
          if (!isNaN(serialNum) && serialNum > maxSerial) {
            maxSerial = serialNum;
          }
        }
      });
    }
    const nextSerial = Math.max(maxSerial, totalUsers) + 1;
    return `BNB${String(nextSerial).padStart(8, '0')}`;
  };

  const handleReconciliationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReconSuccess('');
    setReconError('');

    if (!reconUserUid) {
      setReconError('অনুগ্রহ করে একজন সমবায় সদস্য নির্বাচন করুন।');
      return;
    }

    const amt = Number(reconAmount);
    if (!reconAmount || isNaN(amt) || amt <= 0) {
      setReconError('সদস্য খতিয়ানের সঠিক টাকার পরিমাণ লিখুন।');
      return;
    }

    const targetUser = adminUsers.find(u => u.uid === reconUserUid);
    if (!targetUser) {
      setReconError('সদস্যকে ডাটাবেজে খুঁজে পাওয়া যায়নি।');
      return;
    }

    setAdminLoading(true);
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const txId = `tx-recon-${Date.now()}`;
      const recNo = `REC-RECON-${Math.floor(100000 + Math.random() * 900000)}`;
      
      let updatedSavings = targetUser.savings || 0;
      let updatedDueLoan = targetUser.dueLoan || 0;
      let updatedBalance = targetUser.balance || 0;
      let updatedDpsBalance = targetUser.dpsBalance !== undefined ? targetUser.dpsBalance : 0;
      let updatedProfitsBalance = targetUser.profitsBalance !== undefined ? targetUser.profitsBalance : 0;

      let typeLabel = '';
      let type: any = 'fee_payment';
      let description = '';

      if (reconAction === 'add_savings') {
        updatedSavings += amt;
        type = 'deposit';
        typeLabel = 'সঞ্চয়ী আমানত জমা';
        description = `অফিস ম্যানুয়ালি বা সমন্বয়ের মাধ্যমে কো-অপারেティブ সঞ্চয় ফান্ডে ৳${amt.toLocaleString('bn-BD')} টাকা নগদ জমা করেছেন।`;
      } else if (reconAction === 'reduce_savings') {
        updatedSavings = Math.max(0, updatedSavings - amt);
        type = 'withdraw';
        typeLabel = 'সঞ্চয়ী আমানত উত্তোলন';
        description = `অফিস ম্যানুয়ালি কো-অপারেティブ সঞ্চয় ফান্ড থেকে ৳${amt.toLocaleString('bn-BD')} টাকা বিয়োগ বা সমন্বয় করেছেন।`;
      } else if (reconAction === 'add_dps') {
        updatedDpsBalance += amt;
        type = 'deposit';
        typeLabel = 'ডিপিএস আমানত জমা';
        description = `অফিস ম্যানুয়ালি বা জমার মাধ্যমে সদস্যের ডিপিএস ফান্ডে ৳${amt.toLocaleString('bn-BD')} টাকা জমা রেকর্ড করেছেন।`;
      } else if (reconAction === 'reduce_dps') {
        updatedDpsBalance = Math.max(0, updatedDpsBalance - amt);
        type = 'withdraw';
        typeLabel = 'ডিপিএস আমানত সমন্বয়';
        description = `অফিস ম্যানুয়ালি বা সমন্বয়ের মাধ্যমে সদস্যের ডিপিএস ফান্ড থেকে ৳${amt.toLocaleString('bn-BD')} টাকা বিয়োগ বা সমন্বয় করেছেন।`;
      } else if (reconAction === 'add_profits') {
        updatedProfitsBalance += amt;
        type = 'interest';
        typeLabel = 'সমিতি লভ্যাংশ বণ্টন';
        description = `সমিতি লভ্যাংশ বণ্টন বাবদ সদস্যের অর্জিত লভ্যাংশ খতিয়ানে ৳${amt.toLocaleString('bn-BD')} টাকা ক্রেডিট করা হয়েছে।`;
      } else if (reconAction === 'reduce_profits') {
        updatedProfitsBalance = Math.max(0, updatedProfitsBalance - amt);
        type = 'withdraw';
        typeLabel = 'সমিতি লভ্যাংশ উত্তোলন';
        description = `সদস্যের অর্জিত লভ্যাংশ খতিয়ান হতে ৳${amt.toLocaleString('bn-BD')} টাকা উত্তোলন বা সমন্বয় রেকর্ড করা হয়েছে।`;
      } else if (reconAction === 'disburse_loan') {
        updatedBalance += amt;
        updatedDueLoan += amt;
        type = 'loan_disbursment';
        typeLabel = 'কো-অপারেটিভ ঋণ প্রদান';
        description = `অফিস আপনার কো-অপারেটিভ ঋণ বাবদ ৳${amt.toLocaleString('bn-BD')} টাকা ওয়ালেট ব্যালেন্সে ক্রেডিট এবং ঋণের খাতায় চার্জ করেছে।`;
      } else if (reconAction === 'repay_loan_cash') {
        updatedDueLoan = Math.max(0, updatedDueLoan - amt);
        type = 'loan_repayment';
        typeLabel = 'কো-অপারেটিভ ঋণ নগদ পরিশোধ';
        description = `অফিস আপনার কো-অপারেটিভ ঋণের বিপরীতে ৳${amt.toLocaleString('bn-BD')} টাকা নগদ পরিশোধ বা সমন্বয় রেকর্ড করেছে।`;
      }

      await updateDoc(userRef, {
        balance: updatedBalance,
        mainBalance: updatedBalance,
        savings: updatedSavings,
        dueLoan: updatedDueLoan,
        dpsBalance: updatedDpsBalance,
        profitsBalance: updatedProfitsBalance
      });

      const newTx: Transaction = {
        id: txId,
        userId: targetUser.uid,
        userName: targetUser.name || '',
        memberId: targetUser.memberId || '',
        type,
        typeLabel,
        amount: amt,
        status: 'success',
        description,
        createdAt: new Date().toISOString(),
        paymentMethod: 'Cash Entry / Manual Adj.',
        receiptNo: recNo
      };

      await addDoc(collection(db, 'transactions'), newTx);

      const notifyId = `notif-${Date.now()}`;
      await addDoc(collection(db, 'user_notifications'), {
        id: notifyId,
        userId: targetUser.uid,
        title: `✍️ ব্যালেন্স সমন্বয়: ${typeLabel}`,
        body: description,
        read: false,
        isPersonal: true,
        category: 'samity',
        createdAt: new Date().toISOString()
      });

      setReconSuccess('সদস্য খতিয়ান সমন্বয় সম্পন্ন হয়েছে!');
      setReconAmount('');
      setReconNotes('');
    } catch (err: any) {
      setReconError('সমন্বয় করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleApproveTransaction = async (tx: Transaction) => {
    requestConfirm(
      'অনুমোদন নিশ্চিতকরণ',
      `আপনি কি নিশ্চিত যে ${tx.userName} (আইডি: ${tx.memberId}) এর করা এই আবেদনটি (${tx.typeLabel} - ৳${tx.amount.toLocaleString('bn-BD')}) অনুমোদন করতে চান?`,
      async () => {
        setAdminLoading(true);
        try {
          const targetUserRef = doc(db, 'users', tx.userId);
          const targetUserSnap = await getDoc(targetUserRef);
          if (!targetUserSnap.exists()) {
            customAlertFn('সদস্য ডাটাবেসে পাওয়া যায়নি!');
            return;
          }
          const userToModify = { uid: targetUserSnap.id, ...targetUserSnap.data() } as User;

          let updatedBalance = Number(userToModify.balance !== undefined ? userToModify.balance : (userToModify as any).mainBalance) || 0;
          let updatedSavings = userToModify.savings || 0;
          let updatedDps = userToModify.dpsBalance !== undefined ? userToModify.dpsBalance : updatedSavings;
          let updatedDueLoan = userToModify.dueLoan || 0;

          if (tx.type === 'deposit' || tx.type === 'add_money') {
            updatedBalance += tx.amount;
          } else if (tx.type === 'coop_savings_deposit' || tx.type === 'samity_deposit') {
            updatedSavings += tx.amount;
            updatedDps += tx.amount;
            if (tx.paymentMethod === 'Main Balance' || tx.paymentMethod === 'BNB Wallet' || tx.paymentMethod === 'মেইন ব্যালেন্স' || tx.paymentMethod === 'Wallet' || (tx as any).deductFromMain) {
              updatedBalance = Math.max(0, updatedBalance - tx.amount);
            }
          } else if (tx.type === 'loan_repayment') {
            updatedDueLoan = Math.max(0, updatedDueLoan - tx.amount);
            if ((!tx.paymentMethod || tx.paymentMethod === 'Main Balance' || tx.paymentMethod === 'BNB Wallet' || tx.paymentMethod === 'মেইন ব্যালেন্স') && updatedBalance >= tx.amount) {
              updatedBalance = Math.max(0, updatedBalance - tx.amount);
            }
          } else if (tx.type === 'coop_loan_apply') {
            updatedBalance += tx.amount;
            updatedDueLoan += tx.amount;
          } else if (tx.type === 'withdraw') {
            updatedSavings = Math.max(0, updatedSavings - tx.amount);
            updatedDps = Math.max(0, updatedDps - tx.amount);
            updatedBalance += tx.amount;
          }

          await updateDoc(targetUserRef, {
            balance: updatedBalance,
            mainBalance: updatedBalance,
            savings: updatedSavings,
            dpsBalance: updatedDps,
            dueLoan: updatedDueLoan
          });

          const realDocId = tx.docId || tx.id;
          const txRef = doc(db, 'transactions', realDocId);
          await updateDoc(txRef, {
            status: 'approved',
            processedAt: new Date().toISOString()
          });

          const notifyId = `notif-${Date.now()}`;
          await addDoc(collection(db, 'user_notifications'), {
            id: notifyId,
            userId: tx.userId,
            title: "✅ আবেদন অনুমোদিত",
            body: `আপনার ${tx.typeLabel} (৳${tx.amount.toLocaleString('bn-BD')}) এর আবেদনটি অ্যাডমিন কর্তৃক অনুমোদন করা হয়েছে।`,
            read: false,
            isPersonal: true,
            category: 'samity',
            createdAt: new Date().toISOString()
          });

          customAlertFn('আবেদনটি সফলভাবে অনুমোদন করা হয়েছে।');
        } catch (err: any) {
          customAlertFn('অনুমোদন করতে সমস্যা হয়েছে: ' + err.message);
        } finally {
          setAdminLoading(false);
        }
      }
    );
  };

  const handleRejectTransaction = async (txId: string) => {
    requestPrompt(
      '❌ আবেদন বাতিলের কারণ লিখুন',
      'আবেদনটি বাতিল করার নির্দিষ্ট কারণ লিখে দিন (গ্রাহকের অ্যাপে রিয়েল-টাইম নোটিফিকেশন চলে যাবে):',
      'অসামঞ্জস্যপূর্ণ তথ্য / ভুল রিকোয়েস্ট',
      async (rejectReasonText) => {
        const finalReason = (rejectReasonText || '').trim() || 'অসামঞ্জস্যপূর্ণ তথ্য / ভুল রিকোয়েস্ট';
        
        // Optimistic state update
        setAdminTransactions(prev => prev.map(t => (t.id === txId || (t as any).docId === txId) ? { ...t, status: 'rejected', rejectReason: finalReason, processedAt: new Date().toISOString() } : t));
        
        try {
          const txDoc = adminTransactions.find(t => t.id === txId || (t as any).docId === txId);
          const realDocId = (txDoc as any)?.docId || txDoc?.id || txId;
          const txRef = doc(db, 'transactions', realDocId);

          const promises: Promise<any>[] = [
            setDoc(txRef, {
              status: 'rejected',
              rejectReason: finalReason,
              processedAt: new Date().toISOString()
            }, { merge: true })
          ];

          if (txDoc && txDoc.userId) {
            const notifDocRef = doc(collection(db, 'user_notifications'));
            promises.push(setDoc(notifDocRef, {
              id: notifDocRef.id,
              userId: txDoc.userId,
              title: '❌ সমিতি লেনদেন বাতিল',
              body: `আপনার ${txDoc.typeLabel || 'সমিতি'} আবেদনটি বাতিল করা হয়েছে।\nকারণ: ${finalReason}`,
              read: false,
              isPersonal: true,
              isTransactionHistory: true,
              category: 'samity',
              createdAt: new Date().toISOString()
            }));
          }

          await Promise.all(promises);
          customAlertFn('⚡ 1 সেকেন্ডে সফলভাবে আবেদনটি বাতিল করা হয়েছে!');
        } catch (err: any) {
          console.error(err);
          customAlertFn('বাতিল করতে সমস্যা হয়েছে: ' + (err?.message || err));
        }
      }
    );
  };

  const handleApproveSamityMember = async (targetUser: User) => {
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const mId = targetUser.memberId || autoGenerateMemberId();
      await updateDoc(userRef, {
        memberId: mId,
        samityStatus: 'approved'
      });

      try {
        await updateDoc(doc(db, 'samity_applications', targetUser.uid), {
          status: 'approved',
          samityStatus: 'approved',
          approvedAt: new Date().toISOString()
        });
      } catch (e) {
        // ignore if doc missing
      }

      await addDoc(collection(db, 'user_notifications'), {
        userId: targetUser.uid,
        title: '🎉 সমবায় সদস্যপদ অনুমোদিত!',
        message: `অভিনন্দন ${targetUser.name}! আপনার সমবায় সমিতির সদস্যপদ আবেদনটি অনুমোদিত হয়েছে। আপনার মেম্বার আইডি: ${mId}।`,
        type: 'samity_approved',
        read: false,
        createdAt: new Date().toISOString()
      });

      customAlertFn(`সদস্য "${targetUser.name}" এর সদস্যতা অনুমোদন করা হয়েছে। মেম্বার আইডি: ${mId}`);
    } catch (err: any) {
      customAlertFn("অনুমোদন দিতে সমস্যা হয়েছে: " + err.message);
    }
  };

  const handleRejectSamityMember = async (targetUser: User) => {
    requestConfirm(
      'বাতিল নিশ্চিতকরণ',
      `আপনি কি নিশ্চিত যে সদস্য "${targetUser.name}" এর আবেদনটি বাতিল করতে চান?`,
      async () => {
        try {
          const userRef = doc(db, 'users', targetUser.uid);
          await updateDoc(userRef, {
            samityStatus: 'rejected'
          });

          try {
            await updateDoc(doc(db, 'samity_applications', targetUser.uid), {
              status: 'rejected',
              samityStatus: 'rejected',
              rejectedAt: new Date().toISOString()
            });
          } catch (e) {
            // ignore
          }

          await addDoc(collection(db, 'user_notifications'), {
            userId: targetUser.uid,
            title: '⚠️ সমবায় সদস্যপদ আবেদন সংক্রান্ত বার্তা',
            message: `সম্মানিত ${targetUser.name}, আপনার সমবায় সমিতির সদস্যপদ আবেদনটি বর্তমানে মঞ্জুর করা সম্ভব হয়নি। অনুগ্রহ করে বিস্তারিত জানতে এডমিন সাপোর্ট টিমে যোগাযোগ করুন।`,
            type: 'samity_rejected',
            read: false,
            createdAt: new Date().toISOString()
          });

          customAlertFn("আবেদনটি বাতিল করা হয়েছে।");
        } catch (err: any) {
          customAlertFn("বাতিল করতে সমস্যা হয়েছে: " + err.message);
        }
      }
    );
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      setDbSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingDb(true);
      try {
        const qText = searchTerm.trim().toLowerCase();
        
        // Query users by phone and memberId directly on Firebase for ultra-fast index matching
        const phoneQuery = query(collection(db, 'users'), where('phone', '==', qText));
        const memberIdQuery = query(collection(db, 'users'), where('memberId', '==', qText));
        
        const [phoneSnap, memberIdSnap] = await Promise.all([
          getDocs(phoneQuery),
          getDocs(memberIdQuery)
        ]);
        
        const results: User[] = [];
        phoneSnap.forEach(doc => {
          results.push({ uid: doc.id, ...doc.data() } as User);
        });
        memberIdSnap.forEach(doc => {
          if (!results.some(r => r.uid === doc.id)) {
            results.push({ uid: doc.id, ...doc.data() } as User);
          }
        });

        // Also check if any local preloaded users match
        allUsers.forEach(u => {
          if (
            (u.name || '').toLowerCase().includes(qText) ||
            (u.memberId || '').toLowerCase().includes(qText) ||
            (u.phone || '').includes(qText)
          ) {
            if (!results.some(r => r.uid === u.uid)) {
              results.push(u);
            }
          }
        });

        setDbSearchResults(results.slice(0, 50));
      } catch (err) {
        console.error("Error searching members in DB:", err);
      } finally {
        setIsSearchingDb(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, allUsers]);

  // Debounced search for quarter installment member
  useEffect(() => {
    if (!quarterSearchTerm.trim()) {
      setQuarterSearchResults([]);
      return;
    }
    const delayFn = setTimeout(async () => {
      setIsSearchingQuarterMember(true);
      try {
        const qText = quarterSearchTerm.trim().toLowerCase();
        const results: User[] = [];

        // First check locally available users for instantaneous feedback
        const pool = liveDbUsers.length > 0 ? liveDbUsers : allUsers;
        pool.forEach(u => {
          if (
            (u.name || '').toLowerCase().includes(qText) ||
            (u.memberId || '').toLowerCase().includes(qText) ||
            (u.phone || '').includes(qText)
          ) {
            if (!results.some(r => r.uid === u.uid)) {
              results.push(u);
            }
          }
        });

        // Query Firestore by phone & memberId if needed
        if (results.length < 5) {
          const phoneQuery = query(collection(db, 'users'), where('phone', '==', qText));
          const memberIdQuery = query(collection(db, 'users'), where('memberId', '==', qText));
          const [pSnap, mSnap] = await Promise.all([getDocs(phoneQuery), getDocs(memberIdQuery)]);
          pSnap.forEach(d => {
            if (!results.some(r => r.uid === d.id)) {
              results.push({ uid: d.id, ...d.data() } as User);
            }
          });
          mSnap.forEach(d => {
            if (!results.some(r => r.uid === d.id)) {
              results.push({ uid: d.id, ...d.data() } as User);
            }
          });
        }

        setQuarterSearchResults(results.slice(0, 15));
      } catch (err) {
        console.error("Error searching quarter member:", err);
      } finally {
        setIsSearchingQuarterMember(false);
      }
    }, 300);

    return () => clearTimeout(delayFn);
  }, [quarterSearchTerm, liveDbUsers, allUsers]);

  const defaultSamitySlides = [
    {
      id: 1,
      tag: "সঞ্চয় কিস্তি",
      title: "নিয়মিত সঞ্চয় ডিপিএস",
      description: "প্রতি মাসে ছোট সঞ্চয়ে গড়ে তুলুন আপনার নিশ্চিত ভবিষ্যৎ কল্যাণ তহবিল।",
      bgGradient: "from-slate-950 via-teal-950 to-emerald-950",
      image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 2,
      tag: "হালাল লভ্যাংশ",
      title: "শতভাগ হালাল ব্যবসা পার্টনার",
      description: "আপনার ডিপোজিটকৃত পুঁজি দিয়ে সরাসরি লাভজনক ব্যবসায় অংশ নিন এবং হালাল মুনাফা অর্জন করুন।",
      bgGradient: "from-emerald-950 via-emerald-900 to-teal-950",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 3,
      tag: "ইনভেস্টর সহায়তা",
      title: "সহজ শর্তে সুদমুক্ত ঋণ",
      description: "আমাদের সম্মানিত সহযোগী সদস্যদের জন্য জরুরী প্রয়োজনে করযে হাসানা ঋণ সুবিধা গ্রহণ করুন।",
      bgGradient: "from-teal-950 via-slate-900 to-zinc-950",
      image: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=80&w=650"
    }
  ];

  const samitySlides = appConfig?.samityBanners && appConfig.samityBanners.length > 0
    ? appConfig.samityBanners
    : defaultSamitySlides;

  // Form states - New Deposit
  const [depositPurpose, setDepositPurpose] = useState<'savings' | 'loan' | 'fees'>('savings');
  const [depositChannel, setDepositChannel] = useState('bKash');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositSender, setDepositSender] = useState(user.phone || '');
  const [depositTxId, setDepositTxId] = useState('');
  const [depositPin, setDepositPin] = useState('');

  // Form states - Savings Withdrawal
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawChannel, setWithdrawChannel] = useState('bKash');
  const [withdrawSender, setWithdrawSender] = useState(user.phone || '');
  const [withdrawPin, setWithdrawPin] = useState('');

  // Form states - Co-op Loan Application
  const [loanApplyAmount, setLoanApplyAmount] = useState('');
  const [loanApplyPurpose, setLoanApplyPurpose] = useState('');
  const [loanApplyPin, setLoanApplyPin] = useState('');

  // Success / Error triggers
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // States for new features
  // 1. Monthly Investment states
  const [selectedInvestmentAmount, setSelectedInvestmentAmount] = useState<number>(user.monthlySavingsTarget || 500);
  const [simulatedDay, setSimulatedDay] = useState<number>(5); // Default is 5th (no penalty)
  const [samityPinPrompt, setSamityPinPrompt] = useState<'none' | 'close' | 'active' | 'pay_reactivate'>('none');
  const [samityPinInput, setSamityPinInput] = useState('');
  const [simulatedOverdueDays, setSimulatedOverdueDays] = useState<number>(0);
  
  // 2. Referral system states
  const [referrerCodeInput, setReferrerCodeInput] = useState<string>('');
  const [referralMessage, setReferralMessage] = useState<string>('');

  // 3. Share transfer states
  const [shareRecipientId, setShareRecipientId] = useState<string>('');
  const [shareRecipientName, setShareRecipientName] = useState<string>('');
  const [shareCountInput, setShareCountInput] = useState<string>('');
  const [sharePriceInput, setSharePriceInput] = useState<string>('');
  const [shareTransferPin, setShareTransferPin] = useState<string>('');
  const [shareTransfers, setShareTransfers] = useState<any[]>([]);
  const [loadingShareTransfers, setLoadingShareTransfers] = useState<boolean>(false);

  // Custom Savings deposit state variables
  const [customDepositAmount, setCustomDepositAmount] = useState<string>('');
  const [customDepositPin, setCustomDepositPin] = useState<string>('');

  // Fallbacks for dynamic DPS and profit balances
  const userDps = effectiveUser.dpsBalance !== undefined ? effectiveUser.dpsBalance : (effectiveUser.savings || 0);
  const userProfits = effectiveUser.profitsBalance !== undefined ? effectiveUser.profitsBalance : 0;
  const userSavings = Number(effectiveUser.savings !== undefined ? effectiveUser.savings : effectiveUser.dpsBalance) || 0;
  
  const targetMonthlyRate = getUserMonthlyInstallmentRate(effectiveUser);
  const targetQuarterlyRate = getUserQuarterlyInstallmentRate(effectiveUser);

  // Reconciled effective paid months strictly verified against actual savings deposits
  const effectivePaidMonths = useMemo(() => {
    return getEffectivePaidMonthsList(
      effectiveUser?.samityPaidMonths || [],
      userSavings,
      targetMonthlyRate
    );
  }, [effectiveUser?.samityPaidMonths, userSavings, targetMonthlyRate]);

  // Custom Helper to verify if a month is marked paid based on mathematical reconciliation
  const checkIsMonthPaid = (mId: string, yr: number, _idx?: number): boolean => {
    const cleanId = (mId || '').toLowerCase().trim();
    const yearKey = `${yr}-${cleanId}`;
    const yearKeyAlt = `${yr}_${cleanId}`;
    if (effectivePaidMonths.includes(yearKey) || effectivePaidMonths.includes(yearKeyAlt)) return true;
    if (yr === 2026 && (effectivePaidMonths.includes(cleanId) || effectivePaidMonths.includes(`2026-${cleanId}`))) return true;

    const mIdx = _idx !== undefined ? _idx : SAMITY_MONTHS.findIndex(m => m.id === cleanId);
    if (mIdx >= 0) {
      const mNum = mIdx + 1;
      const mNumPad = mNum < 10 ? `0${mNum}` : `${mNum}`;
      if (effectivePaidMonths.includes(`${yr}-${mNum}`) || effectivePaidMonths.includes(`${yr}-${mNumPad}`)) return true;
      if (yr === 2026 && (effectivePaidMonths.includes(`${mNum}`) || effectivePaidMonths.includes(`${mNumPad}`))) return true;
    }
    return false;
  };

  // Automatically & permanently sync reconciled effective paid months to Firestore
  useEffect(() => {
    const uid = effectiveUser?.uid || effectiveUser?.id;
    if (!uid) return;

    const currentFirestoreList = Array.isArray(effectiveUser?.samityPaidMonths) ? effectiveUser.samityPaidMonths : [];
    const hasDiscrepancy = 
      effectivePaidMonths.length !== currentFirestoreList.length ||
      effectivePaidMonths.some(m => !currentFirestoreList.includes(m));

    if (hasDiscrepancy && effectivePaidMonths.length > 0) {
      updateDoc(doc(db, 'users', uid), {
        samityPaidMonths: effectivePaidMonths
      }).catch(err => {
        console.warn("Auto-sync samityPaidMonths to Firestore error:", err);
      });
    }
  }, [effectivePaidMonths, effectiveUser?.uid, effectiveUser?.id, effectiveUser?.samityPaidMonths]);

  const uniquePaidCount = effectivePaidMonths.length;

  const calcSavingsFromMonths = userSavings > 0 ? userSavings : (uniquePaidCount * targetMonthlyRate);

  // Compute dynamic stats from user transaction histories to prevent hardcoded leaks
  const currentMonthDeposits = userTxHistory
    .filter(tx => {
      if (tx.type !== 'coop_savings_deposit' && tx.type !== 'samity_deposit') return false;
      if (tx.status !== 'success' && tx.status !== 'approved') return false;
      if (!tx.createdAt) return false;
      const txDate = new Date(tx.createdAt);
      const now = new Date();
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Find the last successful deposit transaction to display in the "জমা" card
  const lastDepositTx = userTxHistory
    .filter(tx => {
      if (tx.type !== 'coop_savings_deposit' && tx.type !== 'samity_deposit') return false;
      return tx.status === 'success' || tx.status === 'approved';
    })
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    })[0];

  const lastDepositAmount = lastDepositTx ? (lastDepositTx.amount || 0) : 0;

  // Total Samity Balance ("আমার মোট টাকা") = Accumulated Savings + Profits
  const totalCoopBalance = userSavings + userProfits;

  const profitPercentage = userSavings > 0
    ? ((userProfits / userSavings) * 100).toFixed(1)
    : "0.0";

  const targetGoal = targetMonthlyRate * 12;
  const progressPercent = targetGoal > 0 ? Math.min(100, Math.round((userSavings / targetGoal) * 100)) : 0;
  const remainingTarget = Math.max(0, targetGoal - userSavings);

  // Clear states helper
  const resetFormState = () => {
    setFormError('');
    setFormSuccess('');
    setDepositAmount('');
    setDepositTxId('');
    setDepositPin('');
    setWithdrawAmount('');
    setWithdrawPin('');
    setLoanApplyAmount('');
    setLoanApplyPurpose('');
    setLoanApplyPin('');
  };

  // Fetch transactions logs specifically for cooperative receipts with multi-vector resilience
  const fetchUserTransactions = async () => {
    setLoadingTx(true);
    try {
      const txMap = new Map<string, Transaction>();

      // 1. Seed with passed-in transactions from props
      if (Array.isArray(transactions) && transactions.length > 0) {
        transactions.forEach(t => {
          const key = t.id || t.docId;
          if (key) txMap.set(key, t);
        });
      }

      // 2. Query transactions by userId
      if (user?.uid) {
        const q1 = query(
          collection(db, 'transactions'),
          where('userId', '==', user.uid)
        );
        const s1 = await getDocs(q1);
        s1.forEach(docSnap => {
          txMap.set(docSnap.id, { id: docSnap.id, docId: docSnap.id, ...docSnap.data() } as Transaction);
        });
      }

      // 3. Query transactions by memberId
      if (user?.memberId) {
        const q2 = query(
          collection(db, 'transactions'),
          where('memberId', '==', user.memberId)
        );
        const s2 = await getDocs(q2);
        s2.forEach(docSnap => {
          txMap.set(docSnap.id, { id: docSnap.id, docId: docSnap.id, ...docSnap.data() } as Transaction);
        });
      }

      // 4. Query transactions by phone
      if (user?.phone) {
        const q3 = query(
          collection(db, 'transactions'),
          where('phone', '==', user.phone)
        );
        const s3 = await getDocs(q3);
        s3.forEach(docSnap => {
          txMap.set(docSnap.id, { id: docSnap.id, docId: docSnap.id, ...docSnap.data() } as Transaction);
        });
      }

      const list = Array.from(txMap.values());
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setUserTxHistory(list);
    } catch (e) {
      console.error("Error fetching co-op tx:", e);
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    fetchUserTransactions();
  }, [user.uid, user.memberId, user.phone, activeSubView, transactions]);

  // Handle co-op deposit submission
  const handleCoopDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const amt = Number(depositAmount);
    if (!depositAmount || isNaN(amt) || amt <= 0) {
      setFormError('দয়া করে সঠিক জমা টাকার পরিমাণ টাইপ করুন।');
      return;
    }

    const currentBal = getEffectiveBalance(user);
    if (currentBal < amt) {
      setFormError(`দুঃখিত! আপনার মেইন ব্যালেন্স পর্যাপ্ত নয়। আপনার বর্তমান মেইন ব্যালেন্স ৳${currentBal.toLocaleString('bn-BD')} BDT.`);
      return;
    }

    if (!depositPin || depositPin !== user.pin) {
      setFormError('ভুল 4-ডিজিটের সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      return;
    }

    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      
      let typeLabel = '';
      let typeStr: Transaction['type'] = 'coop_savings_deposit';
      let descriptionStr = '';

      if (depositPurpose === 'savings') {
        typeStr = 'coop_savings_deposit';
        typeLabel = 'সঞ্চয় আমানত জমা';
        descriptionStr = `মেইন ব্যালেন্স হতে ৳${amt.toLocaleString('bn-BD')} টাকা সরাসরি ইনভেস্টর সাধারণ সঞ্চয় তহবিলে স্থানান্তর করা হয়েছে।`;
      } else if (depositPurpose === 'loan') {
        typeStr = 'loan_repayment';
        typeLabel = 'সমিতি লোন কিস্তি পরিশোধ';
        descriptionStr = `মেইন ব্যালেন্স হতে ৳${amt.toLocaleString('bn-BD')} টাকা সরাসরি সমবায় ঋণের কিস্তি পরিশোধ করা হয়েছে।`;
      } else {
        typeStr = 'fee_payment';
        typeLabel = 'ভর্তি ফি ও সার্ভিস চার্জ';
        descriptionStr = `মেইন ব্যালেন্স হতে ৳${amt.toLocaleString('bn-BD')} টাকা সরাসরি ভর্তি ফি ও সার্ভিস চার্জ পরিশোধ করা হয়েছে।`;
      }

      await runTransaction(db, async (transaction) => {
        const uSnap = await transaction.get(userRef);
        if (!uSnap.exists()) throw new Error('সদস্য একাউন্ট খুঁজে পাওয়া যায়নি।');
        const freshData = uSnap.data();
        const liveBal = getEffectiveBalance(freshData);
        if (liveBal < amt) {
          throw new Error(`দুঃখিত! আপনার মেইন ব্যালেন্স পর্যাপ্ত নয়। আপনার বর্তমান মেইন ব্যালেন্স ৳${liveBal.toLocaleString('bn-BD')} BDT.`);
        }

        const newBalance = Math.max(0, liveBal - amt);
        let updateFields: Record<string, any> = { balance: newBalance, mainBalance: newBalance };

        if (depositPurpose === 'savings') {
          updateFields.savings = (Number(freshData.savings) || 0) + amt;
          updateFields.dpsBalance = (Number(freshData.dpsBalance) || Number(freshData.savings) || 0) + amt;
        } else if (depositPurpose === 'loan') {
          updateFields.dueLoan = Math.max(0, (Number(freshData.dueLoan) || 0) - amt);
        }

        transaction.update(userRef, updateFields);

        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          id: txRef.id,
          userId: user.uid,
          userName: freshData.name || user.name || '',
          memberId: freshData.memberId || user.memberId || user.phone,
          type: typeStr,
          typeLabel: typeLabel,
          amount: amt,
          status: 'success',
          isApproved: true,
          paymentMethod: 'Main Balance',
          description: descriptionStr,
          createdAt: new Date().toISOString(),
          receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
        });
      });
      
      setFormSuccess(`আলহামদুলিল্লাহ! আপনার মেইন ব্যালেন্স হতে ৳${amt.toLocaleString('bn-BD')} টাকা সফলভাবে স্থানান্তরিত ও সচল করা হয়েছে।`);
      setTimeout(() => { setActiveSubView('main'); resetFormState(); syncLiveProfile(); }, 1000);

    } catch (err: any) {
      setFormError('জমাপ্রদান সম্পন্ন করতে সমস্যা হয়েছেঃ ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle custom savings deposit submission
  const handleCustomSavingsSubmit = async (amountToDeposit: number, pin: string) => {
    setFormError('');
    setFormSuccess('');

    if (!amountToDeposit || isNaN(amountToDeposit) || amountToDeposit <= 0) {
      setFormError('দয়া করে সঠিক জমার পরিমাণ প্রদান করুন।');
      return;
    }

    const currentBal = getEffectiveBalance(user);
    if (currentBal < amountToDeposit) {
      setFormError(`দুঃখিত! আপনার মেইন ব্যালেন্স পর্যাপ্ত নয়। আপনার বর্তমান মেইন ব্যালেন্স ৳${currentBal.toLocaleString('bn-BD')} BDT.`);
      return;
    }

    if (!pin || pin !== user.pin) {
      setFormError('ভুল 4-ডিজিটের সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      return;
    }

    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);

      await runTransaction(db, async (transaction) => {
        const uSnap = await transaction.get(userRef);
        if (!uSnap.exists()) throw new Error('সদস্য একাউন্ট খুঁজে পাওয়া যায়নি।');
        const freshData = uSnap.data();
        const liveBal = getEffectiveBalance(freshData);
        if (liveBal < amountToDeposit) {
          throw new Error(`দুঃখিত! আপনার মেইন ব্যালেন্স পর্যাপ্ত নয়। আপনার বর্তমান মেইন ব্যালেন্স ৳${liveBal.toLocaleString('bn-BD')} BDT.`);
        }

        const newBalance = Math.max(0, liveBal - amountToDeposit);
        const newSavings = (Number(freshData.savings) || 0) + amountToDeposit;
        const newDpsBalance = (Number(freshData.dpsBalance) || Number(freshData.savings) || 0) + amountToDeposit;
        const targetRate = Number(freshData.monthlySavingsTarget) || 1000;
        const updatedPaidMonths = normalizePaidMonthsArray(freshData.samityPaidMonths || [], newSavings, targetRate);

        transaction.update(userRef, {
          balance: newBalance,
          mainBalance: newBalance,
          savings: newSavings,
          dpsBalance: newDpsBalance,
          samityPaidMonths: updatedPaidMonths
        });

        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          id: txRef.id,
          userId: user.uid,
          userName: freshData.name || user.name || '',
          memberId: freshData.memberId || user.memberId || user.phone,
          type: 'coop_savings_deposit',
          typeLabel: 'সঞ্চয় আমানত',
          amount: amountToDeposit,
          status: 'success',
          isApproved: true,
          paymentMethod: 'Main Balance',
          description: `মেইন ব্যালেন্স হতে ৳${amountToDeposit.toLocaleString('bn-BD')} টাকা সাধারণ সঞ্চয় ওয়ালেটে স্থানান্তর করা হয়েছে।`,
          createdAt: new Date().toISOString(),
          receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
        });
      });

      setFormSuccess(`আলহামদুলিল্লাহ! আপনার মেইন ব্যালেন্স হতে ৳${amountToDeposit.toLocaleString('bn-BD')} টাকা সফলভাবে আপনার সঞ্চয় তহবিলে জমা করা হয়েছে।`);
      
      // Reset inputs
      setCustomDepositAmount('');
      setCustomDepositPin('');
      
      setTimeout(() => {
        syncLiveProfile();
      }, 1500);
    } catch (err: any) {
      setFormError('সঞ্চয় সম্পন্ন করতে সমস্যা হয়েছেঃ ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle savings withdrawal request
  const handleSavingsWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const amt = Number(withdrawAmount);
    if (!withdrawAmount || isNaN(amt) || amt <= 0) {
      setFormError('দয়া করে স্থানান্তরের সঠিক পরিমাণ টাইপ করুন।');
      return;
    }

    if (amt > userSavings) {
      setFormError(`পর্যাপ্ত সঞ্চয় ব্যালেন্স নেই! আপনার বর্তমান সঞ্চয় আমানত ৳${userSavings.toLocaleString('bn-BD')} BDT।`);
      return;
    }

    if (!withdrawPin || withdrawPin !== user.pin) {
      setFormError('ভুল 4-ডিজিটের সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      return;
    }

    const now = new Date();
    const isDec25 = (now.getMonth() === 11 && now.getDate() === 25) || user.role === 'admin';
    const isExitApproved = user.samityDeactivateStatus === 'approved' || user.samityDeactivateStatus === 'released';
    const canWithdraw = isDec25 || isExitApproved;

    if (!canWithdraw) {
      setFormError('🔒 সমবায় সমিতি সঞ্চয় নীতিমালা: সমিতি ফান্ডে কেবল টাকা জমা রাখা যাবে। 25শে ডিসেম্বরের পূর্বে কোনো সঞ্চয় উত্তোলন করা যাবে না। তবে যদি আপনি 25শে ডিসেম্বরের আগে "সমিতি বাতিল / সদস্যপদ প্রত্যাহার (আমি আর থাকবো না)" আবেদন করে থাকেন এবং তা এডমিন কর্তৃক অনুমোদিত হয়, তবেই সঞ্চয় উত্তোলন করা যাবে।');
      return;
    }

    setActionLoading(true);
    try {
      const newTx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'withdraw',
        typeLabel: isExitApproved ? 'সমবায় সঞ্চয় উত্তোলন (সদস্যপদ প্রত্যাহার)' : 'সমবায় সঞ্চয় উত্তোলন (25শে ডিসেম্বর)',
        amount: amt,
        status: 'pending',
        description: isExitApproved 
          ? `সমবায় সমিতি সদস্যপদ প্রত্যাহার অনুমোদন সাপেক্ষে সঞ্চয় আমানত হতে ৳${amt.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন।`
          : `সমবায় সমিতি সঞ্চয় আমানত হতে ৳${amt.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন (25শে ডিসেম্বর)।`,
        createdAt: new Date().toISOString(),
        receiptNo: `REC-WD-${Math.floor(100000 + Math.random() * 900000)}`
      };

      await addDoc(collection(db, 'transactions'), newTx);
      addDoc(collection(db, 'admin_notifications'), {
        title: '💸 নতুন সমবায় সঞ্চয় উত্তোলন আবেদন',
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) সমবায় সঞ্চয় ফান্ড হতে ৳${amt.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন করেছেন।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        userPhone: user.phone || '',
        amount: amt,
        type: 'samity_withdraw',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      setFormSuccess('আপনার সমবায় সঞ্চয় উত্তোলনের আবেদনটি সফলভাবে জমা দেওয়া হয়েছে! অ্যাডমিন প্যানেল আবেদনটি যাচাই করে অনুমোদন করার পর টাকা আপনার মেইন ব্যালেন্সে জমা হবে।');
      setWithdrawAmount('');
      setWithdrawPin('');
      setTimeout(() => { setActiveSubView('main'); syncLiveProfile(); }, 1000);
    } catch (err: any) {
      setFormError('আবেদন জমা দিতে সমস্যা হয়েছেঃ ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle new cooperative loan application
  const handleLoanApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const amt = Number(loanApplyAmount);
    if (!loanApplyAmount || isNaN(amt) || amt <= 0) {
      setFormError('দয়া করে ঋণের কাঙ্ক্ষিত পরিমাণ টাইপ করুন।');
      return;
    }

    if (amt > 50000) {
      setFormError('BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর নীতি অনুযায়ী নতুন লোন সর্বোচ্চ 50,000 টাকার বেশি হওয়া সম্ভব নয়।');
      return;
    }

    if (!loanApplyPurpose.trim()) {
      setFormError('অনুগ্রহ করে লোন নেওয়ার স্পষ্ট ধরণ বা লক্ষ্য উল্লেখ করুন।');
      return;
    }

    if (!loanApplyPin || loanApplyPin !== user.pin) {
      setFormError('ভুল সিকিউরিটি পিন! লোন আবেদন বাতিল করা হয়েছে।');
      return;
    }

    setActionLoading(true);
    try {
      const newTx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'coop_loan_apply',
        typeLabel: 'সমিতি নতুন লোন আবেদন',
        amount: amt,
        status: 'pending',
        description: `সমবায় লোন আবেদনঃ ৳${amt.toLocaleString('bn-BD')} টাকা ঋণের রিকোয়েস্ট (कारणঃ ${loanApplyPurpose})`,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'transactions'), newTx);
      addDoc(collection(db, 'admin_notifications'), {
        title: '🤝 নতুন সমবায় লোন আবেদন',
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ৳${amt.toLocaleString('bn-BD')} টাকা সমবায় লোন আবেদন করেছেন (উদ্দেশ্য: ${loanApplyPurpose})।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        userPhone: user.phone || '',
        amount: amt,
        type: 'samity_loan_apply',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      setFormSuccess('সফল! আপনার সমবায় লোন আবেদনটি যাচাইকরণ টেবিলে পাঠানো হয়েছে। অ্যাডমিন প্যানেল মিটিংয়ের ভিত্তিতে এটি মঞ্জুর বা বাতিল করবেন।');
      setTimeout(() => { setActiveSubView('main'); resetFormState(); syncLiveProfile(); }, 1000);

    } catch (err: any) {
      setFormError('লোন এপ্লিকেশন প্রক্রিয়াকরণে সমস্যাঃ ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Effects and helper functions for new features
  useEffect(() => {
    if (!shareRecipientId) {
      setShareRecipientName('');
      return;
    }
    const found = allUsers.find(
      (u) => u.memberId === shareRecipientId.trim() || u.phone === shareRecipientId.trim()
    );
    if (found) {
      setShareRecipientName(found.name);
    } else {
      setShareRecipientName('');
    }
  }, [shareRecipientId, allUsers]);

  const fetchShareTransfers = async () => {
    setLoadingShareTransfers(true);
    try {
      const q = query(
        collection(db, 'share_transfers'),
        where('senderUid', '==', user.uid)
      );
      const q2 = query(
        collection(db, 'share_transfers'),
        where('receiverUid', '==', user.uid)
      );
      const [s1, s2] = await Promise.all([getDocs(q), getDocs(q2)]);
      const list: any[] = [];
      s1.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      s2.forEach(docSnap => {
        if (!list.some(item => item.id === docSnap.id)) {
          list.push({ id: docSnap.id, ...docSnap.data() });
        }
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setShareTransfers(list);
    } catch (e) {
      console.error("Error fetching share transfers:", e);
    } finally {
      setLoadingShareTransfers(false);
    }
  };

  useEffect(() => {
    if (activeSubView === 'share_transfer') {
      fetchShareTransfers();
    }
  }, [activeSubView, user.uid]);

  const handleUpdateMonthlyInvestment = async () => {
    setFormError('');
    setFormSuccess('');
    
    if (selectedInvestmentAmount < 500 || selectedInvestmentAmount > 5000) {
      setFormError('বিনিযোগের পরিমাণ সর্বনিম্ন 500 টাকা এবং সর্বোচ্চ 5,000 টাকা হতে হবে।');
      return;
    }
    
    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        monthlySavingsTarget: selectedInvestmentAmount
      });
      setFormSuccess(`সফল! আপনার মাসিক সঞ্চয় লক্ষ্য ৳${selectedInvestmentAmount.toLocaleString('bn-BD')} BDT নির্ধারণ করা হয়েছে।`);
      syncLiveProfile();
    } catch (e: any) {
      setFormError('লক্ষ্য আপডেট করতে সমস্যা হয়েছে: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getPenaltyAmount = (day: number, checkDate?: Date): number => {
    const policy = appConfig?.samityPolicyConfig;
    const now = checkDate || new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonthKey = `${currentYear}-${currentMonthNum}`;

    const monthCfg = policy?.exemptedMonthsConfig?.[currentMonthKey];
    const isExempted = monthCfg !== undefined 
      ? monthCfg.isExempted 
      : Boolean(policy?.exemptedMonths?.[currentMonthKey] || policy?.pausePenaltyUntil15th);
    
    if (isExempted) {
      const exemptionDay = monthCfg?.exemptUntilDay || policy?.penaltyExemptionUntilDay || 31;
      if (day <= exemptionDay) {
        return 0;
      }
    }

    const customTiers = policy?.penaltyTiers;
    if (customTiers && customTiers.length > 0) {
      for (const tier of customTiers) {
        if (day >= tier.fromDay && day <= tier.toDay) {
          if (tier.isDaily) {
            const extraDays = day - tier.fromDay + 1;
            return (tier.fineAmount || 0) * extraDays;
          }
          return tier.fineAmount || 0;
        }
      }
    }
    // Default system policy:
    // 1-10: 0 penalty
    // 11th for 30 days (up to 39th day): 1 tk/day
    // 40th day onwards: 10 tk/day
    return calculateSamityFine(day).fineAmount;
  };

  const handleExecuteAutoDebit = async () => {
    setFormError('');
    setFormSuccess('');

    const targetAmt = targetMonthlyRate;
    const curBal = getEffectiveBalance(effectiveUser);
    const curSavings = userSavings;

    // Determine penalty based on simulated date
    const penalty = getPenaltyAmount(simulatedDay);

    const totalNeeded = targetAmt + penalty;
    const hasEnoughBalance = curBal >= totalNeeded;

    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', effectiveUser.uid);
      
      let balanceDeduction = 0;
      let savingsDeduction = 0;
      let newBalance = curBal;
      let newSavings = curSavings;
      let adjustmentDetails = '';

      if (hasEnoughBalance) {
        newBalance = curBal - totalNeeded;
        newSavings = curSavings + targetAmt;
        balanceDeduction = totalNeeded;
        adjustmentDetails = `আপনার মেইন ব্যালেন্স থেকে ৳${totalNeeded.toLocaleString('bn-BD')} কেটে নেওয়া হয়েছে।`;
      } else {
        const partialFromBalance = curBal;
        const remainingToDeduct = totalNeeded - partialFromBalance;
        
        if (curSavings + partialFromBalance < totalNeeded) {
          throw new Error(`দুঃখিত! আপনার মেইন ব্যালেন্স এবং পূর্বের জমানো সঞ্চয় মিলিয়েও প্রয়োজনীয় ৳${totalNeeded.toLocaleString('bn-BD')} (কিস্তি ৳${targetAmt} + জরিমানা ৳${penalty}) নেই। অনুগ্রহ করে প্রথমে ব্যালেন্স রিচার্জ করুন।`);
        }

        newBalance = 0;
        newSavings = curSavings + targetAmt - remainingToDeduct;
        balanceDeduction = partialFromBalance;
        savingsDeduction = remainingToDeduct;
        
        adjustmentDetails = `মেইন ব্যালেন্স থেকে ৳${partialFromBalance.toLocaleString('bn-BD')} এবং পূর্বের জমাকৃত সঞ্চয় থেকে ৳${remainingToDeduct.toLocaleString('bn-BD')} সমন্বয় (Adjust) করা হয়েছে।`;
      }

      await updateDoc(userRef, {
        balance: newBalance,
        savings: newSavings,
        lastPaidMonth: "2026-06"
      });

      const dpsTx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'deposit',
        typeLabel: 'মাসিক সঞ্চয় ডিপিএস',
        amount: targetAmt,
        status: 'success',
        description: `মাসিক নিয়মিত ডিপিএস সঞ্চয় (তারিখ: ${simulatedDay} জুন)। ${adjustmentDetails}`,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'transactions'), dpsTx);

      if (penalty > 0) {
        const penaltyTx: Partial<Transaction> = {
          userId: user.uid,
          userName: user.name,
          memberId: user.memberId || user.phone,
          type: 'fee_payment',
          typeLabel: 'বিলম্ব জরিমানা',
          amount: penalty,
          status: 'success',
          description: `বিলম্ব পেমেন্টের জরিমানা (${simulatedDay} জুনের বিলম্ব পেমেন্ট বাবদ)`,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'transactions'), penaltyTx);
      }

      setFormSuccess(`আলহামদুলিল্লাহ! আপনার জুন 2026 মাসের সঞ্চয় সফলভাবে জমা হয়েছে। ${adjustmentDetails}`);
      syncLiveProfile();
    } catch (e: any) {
      setFormError(e.message || 'পেমেন্ট সম্পন্ন করা যায়নি।');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateScheme = async () => {
    setFormError('');
    setFormSuccess('');
    if (!samityPinInput || samityPinInput !== user.pin) {
      setFormError('ভুল সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
      return;
    }
    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        samitySchemeActive: false
      });
      
      await addDoc(collection(db, 'user_notifications'), {
        id: `notif-deact-${Date.now()}`,
        userId: user.uid,
        memberId: user.memberId || 'N/A',
        title: '🔴 মাসিক বিনিয়োগ সাময়িকভাবে বন্ধ করা হয়েছে',
        body: `আপনার মাসিক বিনিয়োগ স্কিমটি বন্ধ করা হয়েছে। নতুন মাসিক কিস্তি আর অটো-ডেবিট হবে না। 25শে ডিসেম্বরের পূর্বে আপনার সঞ্চিত টাকা উত্তোলন করতে পারবেন না।`,
        read: false,
        isPersonal: true,
        category: 'samity_msg',
        createdAt: new Date().toISOString()
      });

      setFormSuccess('সফল! আপনার মাসিক বিনিয়োগ স্কিমটি সাময়িকভাবে বন্ধ (Inactive) করা হয়েছে।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
      syncLiveProfile();
    } catch (e: any) {
      setFormError('স্কিম বন্ধ করতে সমস্যা হয়েছে: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateScheme = async () => {
    setFormError('');
    setFormSuccess('');
    if (!samityPinInput || samityPinInput !== user.pin) {
      setFormError('ভুল সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
      return;
    }
    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        samitySchemeActive: true,
        dueMonths: 0
      });

      await addDoc(collection(db, 'user_notifications'), {
        id: `notif-act-${Date.now()}`,
        userId: user.uid,
        memberId: user.memberId || 'N/A',
        title: '🟢 মাসিক বিনিয়োগ স্কিম পুনরায় চালু করা হয়েছে',
        body: `আপনার কো-অপারেটিভ মাসিক বিনিয়োগ স্কিমটি সফলভাবে পুনরায় সচল করা হয়েছে। নিয়মিত কিস্তি অটো-ডেবিট আবার শুরু হবে।`,
        read: false,
        isPersonal: true,
        category: 'samity_msg',
        createdAt: new Date().toISOString()
      });

      setFormSuccess('আলহামদুলিল্লাহ! আপনার মাসিক বিনিয়োগ স্কিমটি পুনরায় সফলভাবে চালু (Active) করা হয়েছে।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
      syncLiveProfile();
    } catch (e: any) {
      setFormError('স্কিম চালু করতে সমস্যা হয়েছে: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayArrearsAndReactivate = async () => {
    setFormError('');
    setFormSuccess('');
    const userSamityPin = effectiveUser?.pin ? String(effectiveUser.pin).trim() : '';
    if (!samityPinInput || !userSamityPin || samityPinInput.trim() !== userSamityPin) {
      setFormError('ভুল সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
      return;
    }
    setActionLoading(true);
    try {
      const targetAmt = targetMonthlyRate;
      const dueMonths = effectiveUser.dueMonths || 1;
      const totalDueAmount = targetAmt * dueMonths;
      const curBal = getEffectiveBalance(effectiveUser);

      if (curBal < totalDueAmount) {
        throw new Error(`বকেয়া কিস্তি পরিশোধ করার জন্য আপনার মেইন ব্যালেন্সে পর্যাপ্ত টাকা নেই। মোট প্রয়োজন ৳${totalDueAmount.toLocaleString('bn-BD')} BDT, কিন্তু আপনার মেইন ব্যালেন্স ৳${curBal.toLocaleString('bn-BD')} BDT।`);
      }

      const userRef = doc(db, 'users', effectiveUser.uid);
      const newSavings = userSavings + totalDueAmount;
      const newBal = curBal - totalDueAmount;

      await updateDoc(userRef, {
        balance: newBal,
        mainBalance: newBal,
        savings: newSavings,
        dpsBalance: newSavings,
        samitySchemeActive: true,
        dueMonths: 0
      });

      await addDoc(collection(db, 'transactions'), {
        userId: effectiveUser.uid,
        userName: effectiveUser.name,
        memberId: effectiveUser.memberId || effectiveUser.phone,
        type: 'deposit',
        typeLabel: 'বকেয়া কিস্তি ও পুনঃসচলকরণ',
        amount: totalDueAmount,
        status: 'success',
        description: `মাসিক স্কিম পুনঃসচলকরণ কালে বকেয়া ${dueMonths} মাসের কিস্তি পরিশোধ করা হয়েছে।`,
        createdAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'user_notifications'), {
        id: `notif-arrear-${Date.now()}`,
        userId: user.uid,
        memberId: user.memberId || 'N/A',
        title: '🟢 বকেয়া কিস্তি পরিশোধ ও স্কিম সচল সফল',
        body: `বকেয়া কিস্তি পরিশোধ করে আপনার কো-অপারেটিভ মাসিক বিনিয়োগ স্কিমটি পুনরায় সফলভাবে চালু করা হয়েছে।`,
        read: false,
        isPersonal: true,
        category: 'samity_msg',
        createdAt: new Date().toISOString()
      });

      setFormSuccess(`বকেয়া ৳${totalDueAmount.toLocaleString('bn-BD')} BDT পরিশোধপূর্বক আপনার স্কিম সফলভাবে পুনরায় সচল করা হয়েছে।`);
      setSamityPinPrompt('none');
      setSamityPinInput('');
      syncLiveProfile();
    } catch (e: any) {
      setFormError(e.message || 'বকেয়া পরিশোধ করা সম্ভব হয়নি।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetReferrer = async () => {
    setFormError('');
    setFormSuccess('');
    setReferralMessage('');

    if (!referrerCodeInput.trim()) {
      setFormError('দয়া করে রেফারেল কোড বা মোবাইল নম্বর প্রবেশ করুন।');
      return;
    }

    const refCode = referrerCodeInput.trim();
    const referrer = allUsers.find(
      u => u.memberId === refCode || u.phone === refCode
    );

    if (!referrer) {
      setFormError('দুঃখিত! এই রেফারেল কোড বা মোবাইল নম্বরের কোনো সদস্য খুঁজে পাওয়া যায়নি।');
      return;
    }

    if (referrer.uid === user.uid) {
      setFormError('আপনি নিজেকে রেফার করতে পারবেন না!');
      return;
    }

    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        referredBy: referrer.memberId
      });
      setFormSuccess(`সফল! আপনাকে ${referrer.name} (ID: ${referrer.memberId}) এর অধীনে সফলভাবে রেফার করা হয়েছে।`);
      syncLiveProfile();
    } catch (e: any) {
      setFormError('রেফারার সেট করতে সমস্যা হয়েছে: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleShareTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const count = parseInt(shareCountInput, 10);
    const price = parseInt(sharePriceInput, 10) || 0;
    const myShares = user.shares !== undefined ? user.shares : Math.max(1, Math.floor(user.savings / 1000));

    if (!shareRecipientId.trim()) {
      setFormError('গ্রহীতার মেম্বার আইডি বা মোবাইল নম্বর প্রবেশ করুন।');
      return;
    }

    const recipient = allUsers.find(
      u => u.memberId === shareRecipientId.trim() || u.phone === shareRecipientId.trim()
    );

    if (!recipient) {
      setFormError('দুঃখিত! গ্রহীতার কোনো অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');
      return;
    }

    if (recipient.uid === user.uid) {
      setFormError('আপনি নিজের অ্যাকাউন্টে শেয়ার হস্তান্তর করতে পারবেন না!');
      return;
    }

    if (isNaN(count) || count <= 0) {
      setFormError('শেয়ার সংখ্যা অবশ্যই 1 বা তার বেশি হতে হবে।');
      return;
    }

    if (count > myShares) {
      setFormError(`দুঃখিত! আপনার কাছে পর্যাপ্ত শেয়ার নেই। আপনার মোট শেয়ার সংখ্যা: ${myShares}`);
      return;
    }

    if (shareTransferPin !== user.pin) {
      setFormError('ভুল 4-ডিজিটের সিকিউরিটি পিন! দয়া করে সঠিক পিন দিন।');
      return;
    }

    setActionLoading(true);
    try {
      const newTransfer = {
        senderUid: user.uid,
        senderName: user.name,
        senderMemberId: user.memberId || user.phone,
        receiverUid: recipient.uid,
        receiverName: recipient.name,
        receiverMemberId: recipient.memberId || recipient.phone,
        sharesCount: count,
        pricePerShare: price,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'share_transfers'), newTransfer);
      addDoc(collection(db, 'admin_notifications'), {
        title: '🔄 নতুন শেয়ার হস্তান্তর আবেদন',
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ${recipient.name} (${recipient.memberId || 'N/A'})-কে ${count}টি শেয়ার হস্তান্তর করার আবেদন করেছেন।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        receiverName: recipient.name || '',
        sharesCount: count,
        type: 'share_transfer',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      setFormSuccess('সফল! আপনার শেয়ার হস্তান্তর আবেদনটি সফলভাবে সাবমিট করা হয়েছে। এডমিন প্যানেলের অনুমোদনের পর শেয়ার স্থানান্তর কার্যকর হবে।');
      
      setShareCountInput('');
      setSharePriceInput('');
      setShareRecipientId('');
      setShareTransferPin('');
      
      fetchShareTransfers();
    } catch (err: any) {
      setFormError('শেয়ার হস্তান্তর প্রক্রিয়া করা যায়নি: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter members list based on query or Firestore-backed debounce search results
  const filteredUsers = searchTerm.trim() ? dbSearchResults : allUsers;

  // Dynamic values computation specifically for Samity investors, Samity deposits, and Samity profits
  const membersToUse = liveDbUsers.length > 0 ? liveDbUsers : (allUsers.length > 0 ? allUsers : [user]);

  // Unified helper matching Admin Panel Samity user definition
  const isSamityMemberUser = (u: any) => Boolean(
    u.samityApproved === true ||
    u.samityStatus === 'approved' ||
    u.isSamityMember === true
  );

  // Filter members who are registered / enrolled in Samity
  const samityMembersList = membersToUse.filter(isSamityMemberUser);

  // Real Samity member count (fallback to membersToUse if filter hasn't flagged users yet)
  const activeMembersNum = samityMembersList.length > 0 ? samityMembersList.length : membersToUse.length;

  // Calculated deposits in Samity across members (single accurate savings/share deposit sum)
  const calculatedDeposits = membersToUse.reduce((sum, u) => {
    const isSelf = u.uid === user.uid;
    const s = isSelf 
      ? Math.max(Number(user.savings !== undefined ? user.savings : user.dpsBalance) || 0, Number(u.savings !== undefined ? u.savings : u.dpsBalance) || 0)
      : (Number(u.savings !== undefined ? u.savings : u.dpsBalance) || 0);
    return sum + s;
  }, 0);

  // Sync with manual override from Admin Panel appConfig if set
  const manualFundVal = appConfig?.manualFundAdjustments?.['samity_fund'];
  const totalCompanyDeposits = (manualFundVal !== undefined && manualFundVal !== null && typeof manualFundVal === 'number' && !isNaN(manualFundVal))
    ? manualFundVal
    : calculatedDeposits;

  // Real total profits generated/distributed in Samity across all members (profitsBalance)
  const totalCompanyProfits = membersToUse.reduce((sum, u) => {
    return sum + (Number(u.profitsBalance) || 0);
  }, 0);

  // Render format helpers
  const renderBalanceValue = (val: number) => {
    if (!showBalance) return '••••••';
    return `৳ ${val.toLocaleString('bn-BD')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col relative pt-[max(10px,env(safe-area-inset-top))]" id="samity-screen-root">
      
      {/* 1. Header (1. হেডার) styled absolutely matching the forest-green app header - Ultra Compact */}
      <header className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 text-white px-3 py-2.5 rounded-b-2xl shadow-md relative overflow-hidden z-20">
        {/* Decorative subtle header glows */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-teal-500/10 rounded-full blur-xl" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-emerald-500/15 rounded-full blur-xl" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <UnifiedBackButton
              onClick={() => {
                if (show2050CalendarModal) { setShow2050CalendarModal(false); return; }
                if (showDeactivateModal) { setShowDeactivateModal(false); return; }
                if (showHelplineModal) { setShowHelplineModal(false); return; }
                if (showSectionTxHistory) { setShowSectionTxHistory(false); return; }
                if (activeSubView !== 'main') {
                  setActiveSubView('main');
                  return;
                }
                if (bottomTab !== 'home') {
                  setBottomTab('home');
                  return;
                }
                onBack();
              }}
              variant="glass"
              title="পিছনে যান"
            />
            
            <div className="flex items-center gap-2">
              {/* Profile Image with category border (Red for Shareholder, Blue for Investor) */}
              <div className={`w-8.5 h-8.5 rounded-full overflow-hidden shadow-xs relative flex items-center justify-center shrink-0 border-2 transition-all ${
                getMembershipCategory(effectiveUser).key === 'shareholder'
                  ? 'border-red-500 ring-1 ring-red-500 bg-red-950/40'
                  : getMembershipCategory(effectiveUser).key === 'investor'
                  ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-950/40'
                  : 'border-white/80 bg-slate-200'
              }`}>
                {user.profilePic ? (
                  user.profilePic.startsWith('http') || user.profilePic.startsWith('data:image/') ? (
                    <img src={user.profilePic} referrerPolicy="no-referrer" alt="User Profile" className="w-full h-full object-cover rounded-full" />
                  ) : (() => {
                    const PRESET_AVATARS = [
                      { id: 'av1', emoji: '👨‍💼', bg: 'bg-indigo-50 text-indigo-700' },
                      { id: 'av2', emoji: '👩‍💼', bg: 'bg-rose-50 text-rose-700' },
                      { id: 'av3', emoji: '👨‍💻', bg: 'bg-teal-50 text-teal-700' },
                      { id: 'av4', emoji: '🧑‍🌾', bg: 'bg-amber-50 text-amber-700' },
                      { id: 'av5', emoji: '👩‍🏫', bg: 'bg-emerald-50 text-emerald-700' },
                      { id: 'av6', emoji: '✨', bg: 'bg-cyan-50 text-cyan-700' },
                    ];
                    const activeAv = PRESET_AVATARS.find(av => av.id === user.profilePic) || PRESET_AVATARS[2];
                    return (
                      <div className={`w-full h-full rounded-full flex items-center justify-center text-lg ${activeAv.bg}`}>
                        {activeAv.emoji}
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-teal-900 text-white text-xs font-black rounded-full">
                    {user.name ? user.name.slice(0, 1) : "ম"}
                  </div>
                )}
              </div>

              <div>
                {/* [1. পদবী] -> [2. নাম] -> [3. একটিভ] */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1.5 py-0.2 rounded-full uppercase border border-emerald-500/30 flex items-center gap-0.5 shadow-2xs">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    একটিভ
                  </span>

                  <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-md leading-none shadow-2xs border ${
                    getMembershipCategory(effectiveUser).key === 'shareholder'
                      ? 'bg-red-600 text-white border-red-400'
                      : getMembershipCategory(effectiveUser).key === 'investor'
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-teal-900/80 text-teal-200 border-teal-700'
                  }`}>
                    {getMembershipCategory(effectiveUser).key === 'shareholder' ? '👑 শেয়ার হোল্ডার' : getMembershipCategory(effectiveUser).key === 'investor' ? '💎 ইনভেস্টার' : '👤 সাধারণ সদস্য'}
                  </span>
                </div>

                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] text-teal-100 font-bold block leading-none">
                    সদস্য আইডি: <strong className="font-mono text-white">{user.memberId || "BNB00005327"}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div 
              onClick={() => {
                syncLiveProfile();
                fetchUserTransactions();
              }}
              className="flex items-center gap-1 px-2 py-0.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition cursor-pointer select-none text-left shrink-0"
              title="মেইন ব্যালেন্স রিফ্রেশ করতে ট্যাপ করুন"
            >
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-sans font-black shrink-0">৳</span>
              <div className="flex flex-col leading-none">
                <span className="text-[6.5px] uppercase tracking-wider text-teal-100 font-extrabold">মেইন ব্যালেন্স</span>
                <span className="text-[10px] font-bold font-mono text-white">
                  ৳{(user.balance || 0).toLocaleString('bn-BD')}
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => {
                fetchUserTransactions();
                setShowSectionTxHistory(true);
              }}
              className="p-1.5 bg-white/15 hover:bg-white/25 text-teal-100 rounded-lg flex items-center gap-1 cursor-pointer active:scale-95"
              title="ইনভেস্টর লেনদেন খতিয়ান"
            >
              <ClipboardList className="w-3.5 h-3.5 text-white" />
            </button>

            <button 
              type="button"
              onClick={() => {
                setBottomTab('messages');
                setActiveSubView('main');
                markAllSamityNoticesAsRead();
              }}
              className={`p-1.5 rounded-lg relative cursor-pointer active:scale-95 transition-all flex items-center justify-center ${
                hasUnreadSamity
                  ? 'bg-rose-500 text-white shadow-md animate-pulse ring-1 ring-rose-300'
                  : 'bg-white/15 hover:bg-white/25 text-teal-100 hover:text-white'
              }`}
              title={hasUnreadSamity ? `${unreadSamityCount}টি অপঠিত নোটিশ` : 'নোটিশ বোর্ড (সকল পঠিত)'}
            >
              <Bell className={`w-3.5 h-3.5 ${hasUnreadSamity ? 'text-white' : 'text-teal-100'}`} />
              {hasUnreadSamity && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-rose-950 font-black text-[8px] min-w-[15px] h-3.5 px-0.5 rounded-full flex items-center justify-center border border-emerald-900 shadow-sm font-mono leading-none">
                  {unreadSamityCount > 9 ? '9+' : unreadSamityCount}
                </span>
              )}
            </button>

            {(user.role === 'admin' || user.role === 'sub_admin') && (
              <button 
                onClick={() => {
                  if (activeSubView === 'admin') {
                    setActiveSubView('main');
                  } else {
                    setActiveSubView('admin');
                  }
                }}
                className={`p-1.5 rounded-lg flex items-center gap-1 cursor-pointer active:scale-95 transition-all ${
                  activeSubView === 'admin' 
                    ? 'bg-rose-500 text-white font-black' 
                    : 'bg-amber-500 hover:bg-amber-600 text-white font-extrabold shadow-md'
                }`}
                title="সমবায় অ্যাডমিন প্যানেল"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[9px] hidden xs:inline">অ্যাডমিন</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-md mx-auto px-2.5 py-2 space-y-2 pb-6 overflow-y-auto">

        {/* ================= BOTTOM TAB: SYSTEM NOTICES & ANNOUNCEMENTS ================= */}
        {bottomTab === 'messages' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 text-left min-h-[500px] flex flex-col justify-between"
          >
            <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-3xs shrink-0">
                    <Bell className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">BNB Notice Board</h3>
                    <p className="text-[9.5px] mt-1 text-indigo-600 font-bold block">লাইভ সমবায় নোটিশ ও সিস্টেম ঘোষণা বার্তাখানা</p>
                  </div>
                </div>

                {/* Quick Action Buttons: Mark All Read & Clear All */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={markAllSamityNoticesAsRead}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-xl text-[9.5px] font-black transition cursor-pointer active:scale-95"
                    title="সব পঠিত করুন"
                  >
                    ✓ পঠিত
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllNotices}
                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-[9.5px] font-black transition cursor-pointer active:scale-95 flex items-center gap-1"
                    title="সকল নোটিশ মুছুন"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>মুছুন</span>
                  </button>
                </div>
              </div>

              {/* Notification Filter Controls */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNoticeFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition cursor-pointer ${
                      noticeFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-3xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    সব সমবায় নোটিশ
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeFilter('samity')}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition cursor-pointer ${
                      noticeFilter === 'samity'
                        ? 'bg-teal-700 text-white shadow-3xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    কো-অপারেটিভ
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeFilter('general')}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition cursor-pointer ${
                      noticeFilter === 'general'
                        ? 'bg-rose-600 text-white shadow-3xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    সাধারণ ঘোষণা
                  </button>
                </div>

                <span className="text-[10px] font-bold text-slate-400">
                  মোট: {samityNotices.length} টি
                </span>
              </div>

              {/* Full height scrollable notices container (no rigid max-h constraint) */}
              <div className="space-y-3 pt-2 flex-1 overflow-y-auto pr-1 min-h-[350px]">
                {(() => {
                  const filteredNotices = samityNotices.filter(n => {
                    if (noticeFilter === 'all') return true;
                    if (noticeFilter === 'samity') return n.section === 'samity';
                    if (noticeFilter === 'general') return n.section === 'general' || !n.section;
                    return true;
                  });

                  if (filteredNotices.length === 0) {
                    return (
                      <div className="p-8 text-center bg-slate-50 border border-slate-150 rounded-2xl space-y-2 my-auto">
                        <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-500">বর্তমানে কোনো নোটিশ বা ঘোষণা নেই।</p>
                      </div>
                    );
                  }

                  const formatNoticeDate = (dateStr?: string) => {
                    if (!dateStr) return '';
                    try {
                      const d = new Date(dateStr);
                      return d.toLocaleDateString('bn-BD', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      });
                    } catch (e) {
                      return dateStr;
                    }
                  };

                  return filteredNotices.map((n, idx) => {
                    const noticeId = n.id || n.docId;
                    const isRead = isSamityNoticeRead(n);

                    let sectionLabel = 'সাধারণ ঘোষণা';
                    let iconEmoji = '📢';

                    if (n.section === 'samity') {
                      sectionLabel = 'কো-অপারেটিভ সমবায়';
                      iconEmoji = '🌿';
                    }

                    return (
                      <div 
                        key={noticeId || Math.random().toString()} 
                        onClick={() => handleToggleReadNotice(noticeId)}
                        className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left space-y-2 relative overflow-hidden active:scale-[0.99] ${
                          !isRead
                            ? 'bg-rose-50/90 border-2 border-rose-300 text-rose-950 shadow-xs ring-1 ring-rose-200/80'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 shadow-3xs'
                        }`}
                      >
                        {/* Status bar accent */}
                        {!isRead && (
                          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-rose-600 animate-pulse" />
                        )}

                        <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-1.5 pl-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black tracking-wide uppercase flex items-center gap-1">
                              <span>{iconEmoji}</span>
                              <span>{sectionLabel}</span>
                            </span>

                            {/* Status Tag: Red if Unread, Green/White if Read */}
                            {!isRead ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-600 text-white flex items-center gap-1 shadow-3xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                🔴 অপঠিত (টিপ দিন)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                                ✓ পঠিত
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500 font-bold font-mono">
                              {formatNoticeDate(n.createdAt)}
                            </span>

                            {/* Delete single notice button */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteNotice(noticeId, e)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100/80 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="নোটিশ ডিলিট করুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className={`text-xs sm:text-sm tracking-tight leading-snug pl-1 ${
                          !isRead ? 'font-black text-rose-950' : 'font-extrabold text-slate-900'
                        }`}>
                          {n.title}
                        </h4>

                        <p className="text-[11px] leading-relaxed font-semibold opacity-90 whitespace-pre-line pl-1">
                          {n.content || n.message || n.body}
                        </p>

                        <div className="pt-1 flex justify-end pl-1">
                          <span className="text-[9.5px] font-black text-indigo-700 hover:underline">
                            {!isRead ? 'টিপ দিয়ে সিন করুন (সাদা করুন) →' : 'পঠিত স্থিতি'}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBottomTab('home')}
              className="w-full bg-white border border-slate-200 py-3 rounded-2xl text-xs font-extrabold transition text-slate-700 hover:bg-slate-50 shadow-3xs cursor-pointer active:scale-98"
            >
              ড্যাশবোর্ডে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= BOTTOM TAB: INVESTMENT REPORTS ================= */}
        {bottomTab === 'report' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-3 pb-3 border-b border-indigo-150">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                  <LineChart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Investment Statement</h3>
                  <p className="text-[9.5px] mt-1 text-indigo-600 font-bold block">সদস্যের মাসিক সঞ্চয় রিপোর্ট ও লভ্যাংশ চার্ট</p>
                </div>
              </div>

              <div className="space-y-4 font-sans text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-[9px] text-slate-400 font-extrabold leading-none mb-1 uppercase">টোটাল বিনিয়োগ</span>
                    <strong className="text-sm font-mono text-slate-800">৳ {userSavings.toLocaleString('bn-BD')}</strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-[9px] text-slate-400 font-extrabold leading-none mb-1 uppercase">পরিশোধিত ডিপিএস</span>
                    <strong className="text-sm font-mono text-slate-800">৳ {userDps.toLocaleString('bn-BD')}</strong>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4.5 space-y-2.5">
                  <h4 className="font-extrabold text-[12px] text-teal-800">📈 সঞ্চয় ও লভ্যাংশ</h4>
                  <p className="text-[10.5px] text-slate-650 leading-relaxed font-bold">
                    সঞ্চয় ও লভ্যাংশ চমৎকার গতিতে বাড়ছে। ঋণের কিস্তি সময়ে পরিশোধে ক্রেডিট স্কোর উন্নত হবে।
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setBottomTab('home')}
              className="w-full bg-white border border-slate-200 py-3 rounded-2xl text-xs font-extrabold transition text-slate-705 shadow-3xs"
            >
              ড্যাশবোর্ডে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= BOTTOM TAB: USER PROFILE VIEW ================= */}
        {bottomTab === 'profile' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm text-center">
              <div className={`w-16 h-16 rounded-full mx-auto overflow-hidden shadow-xs flex items-center justify-center text-lg font-black relative shrink-0 border-2 transition-all ${
                getMembershipCategory(effectiveUser).key === 'shareholder'
                  ? 'border-red-500 ring-2 ring-red-600 bg-red-50 text-red-700'
                  : getMembershipCategory(effectiveUser).key === 'investor'
                  ? 'border-blue-500 ring-2 ring-blue-600 bg-blue-50 text-blue-700'
                  : 'border-teal-600 bg-teal-100 text-teal-700'
              }`}>
                {user.profilePic ? (
                  user.profilePic.startsWith('http') || user.profilePic.startsWith('data:image/') ? (
                    <img src={user.profilePic} alt="Me" className="w-full h-full object-cover rounded-full" />
                  ) : (() => {
                    const PRESET_AVATARS = [
                      { id: 'av1', emoji: '👨‍💼', bg: 'bg-indigo-50 text-indigo-700' },
                      { id: 'av2', emoji: '👩‍💼', bg: 'bg-rose-50 text-rose-700' },
                      { id: 'av3', emoji: '👨‍💻', bg: 'bg-teal-50 text-teal-700' },
                      { id: 'av4', emoji: '🧑‍🌾', bg: 'bg-amber-50 text-amber-700' },
                      { id: 'av5', emoji: '👩‍🏫', bg: 'bg-emerald-50 text-emerald-700' },
                      { id: 'av6', emoji: '✨', bg: 'bg-cyan-50 text-cyan-700' },
                    ];
                    const activeAv = PRESET_AVATARS.find(av => av.id === user.profilePic) || PRESET_AVATARS[2];
                    return (
                      <div className={`w-full h-full rounded-full flex items-center justify-center text-3xl ${activeAv.bg}`}>
                        {activeAv.emoji}
                      </div>
                    );
                  })()
                ) : (
                  user.name ? user.name.slice(0, 1) : "ম"
                )}
              </div>

              <div className="space-y-1.5 flex flex-col items-center">
                {/* [1. পদবী] -> [2. নাম] -> [3. একটিভ] */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                    getMembershipCategory(effectiveUser).key === 'shareholder'
                      ? 'bg-red-600 text-white border-red-400'
                      : getMembershipCategory(effectiveUser).key === 'investor'
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-slate-700 text-white border-slate-600'
                  }`}>
                    {getMembershipCategory(effectiveUser).key === 'shareholder' ? '👑 শেয়ার হোল্ডার' : getMembershipCategory(effectiveUser).key === 'investor' ? '💎 ইনভেস্টার' : '👤 সাধারণ সদস্য'}
                  </span>

                  <h3 className="font-sans font-black text-slate-800 text-base">{user.name || "মোঃ রহিম"}</h3>

                  <span className="text-[9.5px] bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    একটিভ
                  </span>
                </div>

                <p className="text-xs text-slate-400 font-mono font-bold leading-none">সহযোগী আইডিঃ {user.memberId || "BNB00005327"}</p>
              </div>

              <div className="border-t border-slate-100 pt-4 text-left space-y-2.5 text-xs font-sans">
                <div className="flex justify-between items-center bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold">মোবাইল নাম্বারঃ</span>
                  <strong className="text-slate-700 font-mono">{user.phone}</strong>
                </div>
                <div className="flex justify-between items-center bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold">সদস্য গ্রুপঃ</span>
                  <strong className="text-slate-750">{user.memberGroup === 'admin' ? 'অফিসিয়াল অ্যাডমিন' : 'সাধারণ সহযোগী সদস্য'}</strong>
                </div>
                <div className="flex justify-between items-center bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold">সিকিউরিটি পিন কোডঃ</span>
                  <strong className="text-slate-750 font-mono tracking-widest">•••• (নিরাপদ)</strong>
                </div>
              </div>
            </div>

            <button
              onClick={() => setBottomTab('home')}
              className="w-full bg-white border border-slate-200 py-3 rounded-2xl text-xs font-extrabold transition text-slate-705 shadow-3xs"
            >
              ড্যাশবোর্ডে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SAMITY ADMINTRACTION VIEWS (ADMIN) ================= */}
        {activeSubView === 'admin' && (user.role === 'admin' || user.role === 'sub_admin') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <SamityAdmin
              users={adminUsers}
              transactions={adminTransactions}
              loading={adminLoading}
              reconUserUid={reconUserUid}
              setReconUserUid={setReconUserUid}
              reconAction={reconAction}
              setReconAction={setReconAction}
              reconAmount={reconAmount}
              setReconAmount={setReconAmount}
              reconNotes={reconNotes}
              setReconNotes={setReconNotes}
              reconSuccess={reconSuccess}
              reconError={reconError}
              handleReconciliationSubmit={handleReconciliationSubmit}
              handleApproveTransaction={handleApproveTransaction}
              handleRejectTransaction={handleRejectTransaction}
              handleApproveSamityMember={handleApproveSamityMember}
              handleRejectSamityMember={handleRejectSamityMember}
              appConfig={appConfig}
              onChangeConfig={onChangeConfig}
              dbSamityBanners={dbSamityBanners}
              setDbSamityBanners={setDbSamityBanners}
              defaultSamitySlides={defaultSamitySlides}
            />
          </motion.div>
        )}

        {/* ================= MAIN DASHBOARD VIEWS (HOME) ================= */}
        {bottomTab === 'home' && activeSubView === 'main' && (
          <div 
            className="space-y-2"
          >
            {/* Ticker / Announcement (ঘোষণা) - Compact */}
            <div className="bg-amber-500/10 border border-amber-300/30 rounded-xl py-1 px-2 flex items-center gap-1.5 text-amber-900 shadow-4xs select-none">
              <div className="text-[9px] font-extrabold bg-amber-500 text-white rounded-md px-1.5 py-0.5 flex items-center gap-1 uppercase tracking-tight shrink-0 font-sans shadow-3xs">
                <Volume2 className="w-3 h-3" />
                <span>ঘোষণা</span>
              </div>
              <div className="flex-grow overflow-hidden relative mr-1">
                <marquee className="text-[11px] font-bold text-slate-800 leading-none py-0.5" behavior="scroll" direction="left" scrollamount="4">
                  {appConfig?.samityTicker || "BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর সাধারণ ফান্ডে স্বাগতম। আপনি এখান থেকে সঞ্চয় জমা দিতে পারেন, ঋণ আবেদন এবং মুনাফার শেয়ার তুলতে পারেন।"}
                </marquee>
              </div>
            </div>

            {/* সদস্য ক্যাটাগরি — ৪টি সেকশন এক লাইনে (UI-তে এক লাইনের মূল প্রদর্শন) */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-1 shadow-2xs w-full text-left">
              {/* 4-Column Responsive Single-Line Grid */}
              <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100/90 rounded-lg border border-slate-200/80">
                {/* 1. 🔴 ওনার — Red */}
                <button
                  type="button"
                  onClick={() => setActiveTopModal('owner')}
                  className={`py-1.5 px-0.5 rounded-xl transition-all flex flex-col items-center justify-center text-center cursor-pointer relative shadow-xs active:scale-95 min-h-[58px] ${
                    getMembershipCategory(effectiveUser).key === 'owner'
                      ? 'bg-gradient-to-b from-rose-600 via-red-600 to-red-700 text-white ring-2 ring-red-400 shadow-md scale-[1.01]'
                      : 'bg-rose-50/80 hover:bg-rose-100/90 text-slate-800 border border-rose-300/80'
                  }`}
                  title="🔴 ওনার: মাসিক ৳৪,০০০ | ৩ মাসে ৳১০,০০০ | নমিনি ৩ জন"
                >
                  <span className="text-[10px] sm:text-[11px] font-black leading-tight flex items-center gap-0.5 text-rose-950">
                    🔴 ওনার
                  </span>
                  <span className={`text-[8.5px] sm:text-[9.5px] font-black mt-0.5 block font-mono ${
                    getMembershipCategory(effectiveUser).key === 'owner' ? 'text-white' : 'text-rose-700'
                  }`}>
                    ৳৪,০০০/মাস
                  </span>
                  <span className={`text-[7px] font-extrabold px-1 py-0.2 rounded mt-0.5 leading-tight ${
                    getMembershipCategory(effectiveUser).key === 'owner' ? 'bg-white/20 text-rose-100 font-black' : 'bg-rose-200/80 text-rose-900 font-bold'
                  }`}>
                    ৩ মাসে ৳১০হাজার
                  </span>
                </button>

                {/* 2. 🔵 শেয়ার হোল্ডার — Blue */}
                <button
                  type="button"
                  onClick={() => setActiveTopModal('shareholder')}
                  className={`py-1.5 px-0.5 rounded-xl transition-all flex flex-col items-center justify-center text-center cursor-pointer relative shadow-xs active:scale-95 min-h-[58px] ${
                    getMembershipCategory(effectiveUser).key === 'shareholder'
                      ? 'bg-gradient-to-b from-blue-600 via-indigo-600 to-blue-700 text-white ring-2 ring-blue-400 shadow-md scale-[1.01]'
                      : 'bg-blue-50/80 hover:bg-blue-100/90 text-slate-800 border border-blue-300/80'
                  }`}
                  title="🔵 শেয়ার হোল্ডার: মাসিক ৳২,০০০ | ৩ মাসে ৳৫,০০০ | নমিনি ২ জন"
                >
                  <span className="text-[10px] sm:text-[11px] font-black leading-tight flex items-center gap-0.5 text-blue-950">
                    🔵 শেয়ার হোল্ডার
                  </span>
                  <span className={`text-[8.5px] sm:text-[9.5px] font-black mt-0.5 block font-mono ${
                    getMembershipCategory(effectiveUser).key === 'shareholder' ? 'text-white' : 'text-blue-700'
                  }`}>
                    ৳২,০০০/মাস
                  </span>
                  <span className={`text-[7px] font-extrabold px-1 py-0.2 rounded mt-0.5 leading-tight ${
                    getMembershipCategory(effectiveUser).key === 'shareholder' ? 'bg-white/20 text-blue-100 font-black' : 'bg-blue-200/80 text-blue-900 font-bold'
                  }`}>
                    ৩ মাসে ৳৫হাজার
                  </span>
                </button>

                {/* 3. 🟢 ইনভেস্টার — Green */}
                <button
                  type="button"
                  onClick={() => setActiveTopModal('investor')}
                  className={`py-1.5 px-0.5 rounded-xl transition-all flex flex-col items-center justify-center text-center cursor-pointer relative shadow-xs active:scale-95 min-h-[58px] ${
                    getMembershipCategory(effectiveUser).key === 'investor'
                      ? 'bg-gradient-to-b from-emerald-600 via-green-600 to-emerald-700 text-white ring-2 ring-emerald-400 shadow-md scale-[1.01]'
                      : 'bg-emerald-50/80 hover:bg-emerald-100/90 text-slate-800 border border-emerald-300/80'
                  }`}
                  title="🟢 ইনভেস্টার: মাসিক ৳১,০০০ | ৩ মাসে কিস্তি নেই | নমিনি ১ জন"
                >
                  <span className="text-[10px] sm:text-[11px] font-black leading-tight flex items-center gap-0.5 text-emerald-950">
                    🟢 ইনভেস্টার
                  </span>
                  <span className={`text-[8.5px] sm:text-[9.5px] font-black mt-0.5 block font-mono ${
                    getMembershipCategory(effectiveUser).key === 'investor' ? 'text-white' : 'text-emerald-700'
                  }`}>
                    ৳১,০০০/মাস
                  </span>
                  <span className={`text-[7px] font-extrabold px-1 py-0.2 rounded mt-0.5 leading-tight ${
                    getMembershipCategory(effectiveUser).key === 'investor' ? 'bg-white/20 text-emerald-100 font-black' : 'bg-emerald-200/80 text-emerald-900 font-bold'
                  }`}>
                    বাধ্যতামূলক
                  </span>
                </button>

                {/* 4. 🔘 Switch ON/OFF — Neutral */}
                <button
                  type="button"
                  onClick={() => {
                    setSwitchActionType(samityAutoSavingsActive ? 'turn_off' : 'turn_on');
                    setActiveTopModal('exit_switch');
                  }}
                  className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-center text-center cursor-pointer relative shadow-3xs active:scale-95 min-h-[58px] ${
                    samityAutoSavingsActive
                      ? 'bg-white hover:bg-emerald-50/50 text-slate-800 border border-emerald-300'
                      : 'bg-gradient-to-b from-rose-700 to-red-800 text-white ring-2 ring-rose-400 shadow-md scale-[1.01]'
                  }`}
                  title="🔘 Switch ON/OFF: PIN দিয়ে নিয়ন্ত্রণ | ২৫শে ডিসেম্বর স্বয়ংক্রিয় অর্থ ফেরত"
                >
                  <span className="text-[10px] sm:text-[11px] font-black leading-tight flex items-center gap-0.5">
                    🔘 ON/OFF
                  </span>
                  <span className={`text-[8px] font-black mt-0.5 block ${
                    samityAutoSavingsActive ? 'text-emerald-700' : 'text-rose-100'
                  }`}>
                    {samityAutoSavingsActive ? '🟢 সচল (ON)' : '🔴 বন্ধ (OFF)'}
                  </span>
                  <span className={`text-[7px] font-extrabold px-1 py-0.2 rounded mt-0.5 leading-tight ${
                    samityAutoSavingsActive ? 'bg-slate-100 text-slate-700' : 'bg-white/20 text-white'
                  }`}>
                    PIN নিয়ন্ত্রণ
                  </span>
                </button>
              </div>
            </div>

            {/* 3. Main Combined Box (একত্রিত সম্পূর্ণ সেকশন - কম উচ্চতায় ও পরিপাটি) */}
            <div className="bg-white border border-slate-150 rounded-xl p-2 shadow-2xs text-left relative overflow-hidden space-y-1.5 w-full">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />

              {/* Virtual Samity Deposit Account Number Banner (Phone + 0) - Ultra Compact 1-Line */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 border border-emerald-300/80 rounded-lg p-1 px-2 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Smartphone className="w-3 h-3 text-emerald-700 shrink-0" />
                  <div className="min-w-0 flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] font-black text-emerald-900 uppercase tracking-tight">
                      সমিতি একাউন্ট নং:
                    </span>
                    <span className="text-[11px] font-black font-mono text-emerald-950 tracking-wider">
                      {user.phone ? `${user.phone}0` : '017000000000'}
                    </span>
                    <span className="text-[7px] bg-emerald-600 text-white px-1 py-0.2 rounded font-mono font-bold">
                      অটো জমা
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const virtualNum = `${user.phone || ''}0`;
                    navigator.clipboard.writeText(virtualNum);
                    setCopySuccess('কপি হয়েছে!');
                    setTimeout(() => setCopySuccess(''), 2500);
                  }}
                  className="px-1.5 py-0.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-extrabold text-[9px] rounded flex items-center gap-0.5 transition shadow-xs cursor-pointer shrink-0"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>{copySuccess || 'কপি'}</span>
                </button>
              </div>

              {/* Multi-Year Samity Payment Tracker Matrix (50 সাল পর্যন্ত সঞ্চয় কিস্তি ট্র্যাকার) - Ultra Compact */}
              <div className="bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/30 border border-emerald-200/80 rounded-lg text-left p-1.5 space-y-1 shadow-2xs">
                {/* Header (Clickable to open 2050 Calendar) - Ultra Compact */}
                <div 
                  onClick={() => setShow2050CalendarModal(true)}
                  className="flex items-center justify-between border-b border-emerald-150/80 pb-0.5 cursor-pointer group hover:bg-emerald-100/40 p-0.5 rounded transition"
                  title="50 সাল পর্যন্ত সম্পূর্ণ ক্যালেন্ডার দেখতে টিপ দিন"
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <Calendar className="w-3 h-3 text-emerald-700 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <h3 className="text-[9.5px] font-black text-emerald-950 uppercase tracking-tight">
                          50 সালের সঞ্চয় কিস্তি ট্র্যাকার
                        </h3>
                        <span className="text-[7.5px] bg-amber-500 text-slate-950 px-1 py-0.2 rounded-full font-bold shadow-3xs group-hover:bg-amber-400 transition">
                          50 সালের ক্যালেন্ডার ↗
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[8.5px] font-black bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-mono shadow-3xs shrink-0">
                    {SAMITY_MONTHS.filter((m, idx) => checkIsMonthPaid(m.id, trackerSelectedYear, idx)).length} / 12 মাস ({trackerSelectedYear})
                  </span>
                </div>

                {/* Year Navigation Bar (2026 - 2050) - Sleek & Compact */}
                <div className="flex items-center justify-between gap-1 bg-emerald-100/40 p-1 rounded-lg border border-emerald-200/60">
                  <div className="flex items-center gap-0.5 overflow-x-auto py-0.5 scrollbar-none max-w-[calc(100%-75px)]">
                    {SAMITY_YEARS.map(yr => {
                      const isCurrent = yr === new Date().getFullYear();
                      const isSelected = yr === trackerSelectedYear;
                      const yrPaid = SAMITY_MONTHS.filter((m, idx) => checkIsMonthPaid(m.id, yr, idx)).length;

                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setTrackerSelectedYear(yr)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono transition shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-700 text-white ring-1 ring-emerald-500 shadow-3xs'
                              : yrPaid === 12
                              ? 'bg-emerald-200/90 text-emerald-950 border border-emerald-300'
                              : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-300'
                          }`}
                        >
                          {yr}{isCurrent ? '*' : ''}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dropdown for quick jump */}
                  <select
                    value={trackerSelectedYear}
                    onChange={(e) => setTrackerSelectedYear(Number(e.target.value))}
                    className="text-[9px] font-black font-mono bg-white border border-emerald-300 text-emerald-950 rounded px-1 py-0.5 shrink-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    {SAMITY_YEARS.map(yr => (
                      <option key={yr} value={yr}>বছর: {yr}</option>
                    ))}
                  </select>
                </div>

                {/* Selected Year Title Banner */}
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-700 px-0.5">
                  <span>📅 <strong>{trackerSelectedYear} সালের</strong> সঞ্চয় কিস্তি তালিকা ({trackerSelectedYear === new Date().getFullYear() ? 'চলতি বছর' : '2050 লক্ষ্য'})</span>
                  <span className="text-[8.5px] text-emerald-800 font-mono font-black bg-emerald-100/80 px-1 py-0.2 rounded border border-emerald-200">
                    মাসিক: ৳{targetMonthlyRate.toLocaleString('bn-BD')}
                  </span>
                </div>

                {/* 12-Month Payment Matrix Grid - Tight Height & Crisp */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                  {SAMITY_MONTHS.map((m, idx) => {
                    const targetMonthly = targetMonthlyRate;
                    const isPaid = checkIsMonthPaid(m.id, trackerSelectedYear, idx);

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (!isPaid) {
                            setSelectedPayMonth({ ...m, year: trackerSelectedYear });
                          } else {
                            setCustomAlert({
                              title: `✅ ${m.name} ${trackerSelectedYear} সঞ্চয় পরিশোধিত`,
                              message: `আপনি ইতিমধ্যে ${m.name} ${trackerSelectedYear} সালের সমবায় সঞ্চয় কিস্তি ৳${targetMonthly.toLocaleString('bn-BD')} টাকা সফলভাবে জমা দিয়েছেন।`
                            });
                          }
                        }}
                        className={`p-1 rounded-lg border text-center transition cursor-pointer flex flex-col items-center justify-between min-h-[38px] ${
                          isPaid
                            ? 'bg-emerald-500/10 border-emerald-300 text-emerald-950 font-black shadow-3xs'
                            : 'bg-rose-50/60 border-rose-200 hover:border-rose-400 text-slate-800 font-bold hover:shadow-2xs'
                        }`}
                      >
                        <span className="text-[9px] font-extrabold truncate leading-tight">{m.name}</span>
                        {isPaid ? (
                          <span className="inline-flex items-center gap-0.5 text-[7.5px] bg-emerald-600 text-white px-1 py-0.2 rounded font-mono font-bold mt-0.5 shadow-3xs">
                            <CheckCircle2 className="w-2 h-2" /> পরিশোধিত
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[7.5px] bg-rose-600 hover:bg-rose-700 text-white px-1 py-0.2 rounded font-mono font-bold mt-0.5 shadow-3xs">
                            <PlusCircle className="w-2 h-2" /> বকেয়া
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 📅 ১২ মাসের কিস্তির নিচে: ৩ মাস পর পর ৪টি কিস্তি (ওপরে ১২ মাসের কিস্তির মতো হুবহু ৪টি কিস্তি এক লাইনে: জানুয়ারি, এপ্রিল, জুলাই, অক্টোবর) */}
                    <div className="bg-amber-50/70 border border-amber-300 rounded-lg p-2 space-y-2 shadow-2xs">
                      {/* Selected Year Title Banner - Exactly matching 12-Month style above */}
                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-700 px-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>
                            📅 <strong>{trackerSelectedYear} সালের</strong> ৩ মাস পর পর কিস্তি (বছরে ৪ কিস্তি: জানুয়ারি • এপ্রিল • জুলাই • অক্টোবর)
                          </span>
                          <span className="text-[7.5px] bg-rose-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                            যেকোনো সময় / অগ্রিম প্রদেয়
                          </span>
                          {quarterTargetMember && (
                            <span className="text-[7.5px] bg-emerald-700 text-white px-1.5 py-0.2 rounded font-black shadow-3xs">
                              🎯 প্রাপক: {quarterTargetMember.name} ({quarterTargetMember.memberId || 'N/A'})
                            </span>
                          )}
                        </div>
                        <span className="text-[8.5px] text-amber-900 font-mono font-black bg-amber-100/90 px-1.5 py-0.2 rounded border border-amber-300 shrink-0">
                          {isTargetOwner
                            ? 'ওনার: ৳১০,০০০'
                            : isTargetShareholder
                            ? 'শেয়ার হোল্ডার: ৳৫,০০০'
                            : 'ওনার: ৳১০,০০০ | শেয়ার: ৳৫,০০০'}
                        </span>
                      </div>

                      {/* 4-Month Payment Matrix Grid - Exactly matching 12-Month grid above (1 Line, 4 Columns) */}
                      <div className="grid grid-cols-4 gap-1">
                        {SAMITY_QUARTERLY_MONTHS.map((q) => {
                          const isPaid = isUserQuarterlyPaid(activeTarget, trackerSelectedYear, q.id);
                          const qAmount = isTargetOwner ? 10000 : isTargetShareholder ? 5000 : 10000;
                          const isSelected = selectedQuarterIds.includes(q.id);

                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => {
                                if (isPaid) {
                                  setCustomAlert({
                                    title: `✅ ${q.name} ${trackerSelectedYear} কিস্তি পরিশোধিত`,
                                    message: `${quarterTargetMember ? quarterTargetMember.name : 'আপনার'} ${q.name} ${trackerSelectedYear} সালের ৩ মাস পর পর কিস্তি ৳${qAmount.toLocaleString('bn-BD')} টাকা ইতিমধ্যে সফলভাবে জমা সম্পন্ন হয়েছে।`
                                  });
                                  return;
                                }

                                if (!isTargetEligible) {
                                  setCustomAlert({
                                    title: 'ℹ️ ওনার ও শেয়ার হোল্ডার কিস্তি',
                                    message: `৩ মাস পর পর ৪টি কিস্তি (জানুয়ারি, এপ্রিল, জুলাই, অক্টোবর) শুধুমাত্র ওনার (৳১০,০০০) ও শেয়ার হোল্ডার (৳৫,০০০) সদস্যদের জন্য প্রযোজ্য। আপনি অন্য কোনো ওনার বা শেয়ার হোল্ডার সদস্যের কিস্তি দিতে নিচের সার্চ বক্স দিয়ে সদস্যকে সিলেক্ট করুন।`
                                  });
                                  return;
                                }

                                if (selectedQuarterIds.length > 0) {
                                  setSelectedQuarterIds(prev =>
                                    prev.includes(q.id) ? prev.filter(id => id !== q.id) : [...prev, q.id]
                                  );
                                } else {
                                  handlePayQuarterly(q.id, trackerSelectedYear);
                                }
                              }}
                              className={`p-1 rounded-lg border text-center transition cursor-pointer flex flex-col items-center justify-between min-h-[46px] ${
                                isPaid
                                  ? 'bg-emerald-500/10 border-emerald-300 text-emerald-950 font-black shadow-3xs'
                                  : isSelected
                                  ? 'bg-amber-100 border-amber-500 ring-1 ring-amber-400 text-slate-900 shadow-2xs'
                                  : 'bg-rose-50/60 border-rose-200 hover:border-rose-400 text-slate-800 font-bold hover:shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full px-0.5">
                                <span className="text-[9px] font-extrabold truncate leading-tight">{q.name}</span>
                                <span className="text-[7px] font-bold text-amber-800 font-mono">({q.quarter})</span>
                              </div>

                              <span className="text-[7.5px] font-mono font-black text-amber-950 my-0.5">
                                ৳{qAmount.toLocaleString('bn-BD')}
                              </span>

                              {isPaid ? (
                                <span className="inline-flex items-center gap-0.5 text-[7.5px] bg-emerald-600 text-white px-1 py-0.2 rounded font-mono font-bold mt-0.5 shadow-3xs w-full justify-center">
                                  <CheckCircle2 className="w-2 h-2" /> পরিশোধিত
                                </span>
                              ) : isSelected ? (
                                <span className="inline-flex items-center gap-0.5 text-[7.5px] bg-amber-600 text-white px-1 py-0.2 rounded font-mono font-black mt-0.5 shadow-3xs w-full justify-center">
                                  ✓ নির্বাচিত
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[7.5px] bg-rose-600 hover:bg-rose-700 text-white px-1 py-0.2 rounded font-mono font-bold mt-0.5 shadow-3xs w-full justify-center">
                                  <PlusCircle className="w-2 h-2" /> জমা ⚡
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>



                      {/* Active Selected Target Member Banner */}
                      {quarterTargetMember && (
                        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 rounded-md p-1.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">🎯</span>
                              <div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9.5px] font-black text-emerald-950">{quarterTargetMember.name}</span>
                                  <span className={`text-[7.5px] font-black px-1 py-0.2 rounded ${activeCat.tagColor}`}>
                                    {activeCat.titleBn}
                                  </span>
                                </div>
                                <p className="text-[8px] text-emerald-850 font-mono">
                                  আইডি: <strong>{quarterTargetMember.memberId || 'N/A'}</strong> • মোবাইল: {quarterTargetMember.phone || ''}
                                </p>
                              </div>
                            </div>

                            {/* Payment Source Selector */}
                            <div className="text-right shrink-0">
                              <label className="block text-[7px] font-bold text-emerald-900 mb-0.5">টাকা কর্তন মাধ্যম:</label>
                              <select
                                value={quarterPaymentSource}
                                onChange={(e) => setQuarterPaymentSource(e.target.value as any)}
                                className="text-[7.5px] font-black bg-white border border-emerald-400 text-emerald-950 rounded px-1.5 py-0.5 cursor-pointer shadow-3xs focus:outline-none"
                              >
                                <option value="payer">আমার ওয়ালেট থেকে (৳{getEffectiveBalance(effectiveUser).toLocaleString('bn-BD')})</option>
                                <option value="target">সদস্যের ওয়ালেট থেকে (৳{getEffectiveBalance(quarterTargetMember).toLocaleString('bn-BD')})</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

            <div className="bg-white border border-slate-150 p-2.5 rounded-2xl text-left shadow-2xs space-y-1.5">
              <h4 className="text-[9px] font-black text-slate-400 tracking-wider uppercase">ক্ষুদ্র অ্যাকশন</h4>
              
              <div className="grid grid-cols-4 gap-1.5">
                
                {/* টাকা জমা */}
                <button
                  onClick={() => setActiveSubView('new_deposit')}
                  className="flex flex-col items-center gap-1 transition active:scale-90 group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-md hover:opacity-95 shadow-2xs">
                    <Plus className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-[9.5px] font-black text-slate-700 font-sans">টাকা জমা</span>
                </button>

                {/* টাকা উত্তোলন */}
                <button
                  onClick={() => setActiveSubView('withdraw_savings')}
                  className="flex flex-col items-center gap-1 transition active:scale-90 group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center font-black text-md hover:opacity-95 shadow-2xs">
                    <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <span className="text-[9.5px] font-black text-slate-700 font-sans">টাকা উত্তোলন</span>
                </button>

                {/* আমাদের ইনভেস্ট */}
                <button
                  onClick={() => setActiveSubView('our_investments')}
                  className="flex flex-col items-center gap-1 transition active:scale-90 group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-400 text-white flex items-center justify-center font-black text-md hover:opacity-95 shadow-2xs relative">
                    <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"></span>
                    </span>
                  </div>
                  <span className="text-[9px] font-black text-amber-950 font-sans leading-tight">আমাদের ইনভেস্ট</span>
                </button>

                {/* মাসিক বিনিয়োগ ও পলিসি */}
                <button
                  onClick={() => setActiveSubView('monthly_investment_policy')}
                  className="flex flex-col items-center gap-1 transition active:scale-90 group cursor-pointer"
                  id="btn-monthly-policy"
                >
                  <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center font-black text-md hover:opacity-95 shadow-2xs">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-black text-slate-700 font-sans text-center leading-tight">বিনিয়োগ ও পলিসি</span>
                </button>

              </div>
            </div>

            {/* 8. Samity Summary (8. সমিতি সারাংশ) - Horizontal 3-column Samity replica cards */}
            <div className="bg-white border border-slate-150 rounded-xl p-2 text-left shadow-2xs space-y-1.5 w-full">
              <h4 className="text-[9px] font-black text-emerald-800 tracking-wider uppercase leading-none flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                সমবায় সমিতি সারাংশ
              </h4>
              
              <div className="grid grid-cols-3 gap-1.5 text-center">
                
                {/* 1. সমিতি সদস্য (ইনভেস্টার) */}
                <div className="bg-emerald-50/60 p-1.5 rounded-lg border border-emerald-100 flex flex-col items-center justify-center">
                  <span className="block text-[7.5px] text-emerald-800 font-extrabold mb-0.5 uppercase truncate w-full">সমিতি সদস্য</span>
                  <div className="flex items-center justify-center gap-0.5">
                    <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                    <strong className="text-[10px] font-black text-slate-900 truncate">{Math.round(activeMembersNum).toLocaleString('bn-BD')} জন</strong>
                  </div>
                  <span className="text-[7px] text-emerald-700 font-bold block mt-0.5 truncate">মাসিক ইনভেস্টার</span>
                </div>

                {/* 2. সমিতি মোট জমা */}
                <div className="bg-teal-50/60 p-1.5 rounded-lg border border-teal-100 flex flex-col items-center justify-center">
                  <span className="block text-[7.5px] text-teal-800 font-extrabold mb-0.5 uppercase truncate w-full">সমিতি মোট জমা</span>
                  <div className="flex items-center justify-center gap-0.5">
                    <PiggyBank className="w-3 h-3 text-teal-600 shrink-0" />
                    <strong className="text-[9.5px] font-black text-slate-900 truncate">৳ {totalCompanyDeposits.toLocaleString('bn-BD')}</strong>
                  </div>
                  <span className="text-[7px] text-teal-700 font-bold block mt-0.5 truncate">সমবায় আমানত</span>
                </div>

                {/* 3. সমিতি মোট লাভ */}
                <div className="bg-indigo-50/60 p-1.5 rounded-lg border border-indigo-100 flex flex-col items-center justify-center">
                  <span className="block text-[7.5px] text-indigo-800 font-extrabold mb-0.5 uppercase truncate w-full">সমিতি মোট লাভ</span>
                  <div className="flex items-center justify-center gap-0.5">
                    <LineChart className="w-3 h-3 text-indigo-600 shrink-0" />
                    <strong className="text-[9.5px] font-black text-slate-900 truncate">৳ {totalCompanyProfits.toLocaleString('bn-BD')}</strong>
                  </div>
                  <span className="text-[7px] text-indigo-700 font-bold block mt-0.5 truncate">সদস্যদের লভ্যাংশ</span>
                </div>

              </div>
            </div>

            {/* Standard Warning Notice for trust assets */}
            <div className="bg-rose-50 border border-rose-100 p-2 rounded-xl text-[9.5px] text-rose-800 font-sans leading-relaxed flex items-start gap-1.5 text-left">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
              <p className="font-bold">
                ⚠️ অ্যাডমিন প্যানেলের অনুমতি ব্যতীত সমিতির টাকা ও ব্যাংক অ্যাকাউন্ট হতে টাকা সরাসরি স্থানান্তর করা সম্ভব নয়। সকল উত্তোলন পেন্ডিং থাকবে।
              </p>
            </div>

          </div>
        )}

        {/* ================= SUB VIEW: BNB OUR INVESTMENTS (আমাদের ইনভেস্ট) ================= */}
        {bottomTab === 'home' && activeSubView === 'our_investments' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 font-sans"
          >
            <SamityInvestmentsView
              user={effectiveUser}
              onBack={() => setActiveSubView('main')}
              isAdmin={user.role === 'admin' || user.role === 'sub_admin'}
            />
          </motion.div>
        )}

        {/* ================= SUB VIEW: MONTHLY INVESTMENT & POLICY ================= */}
        {bottomTab === 'home' && activeSubView === 'monthly_investment_policy' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 text-left font-sans"
          >
            {/* Header / Nav card with Back Button and Toggle Button */}
            <div className="bg-white border border-slate-150 p-4 rounded-3xl shadow-3xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setActiveSubView('main');
                    setFormError('');
                    setFormSuccess('');
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-xl border border-slate-150 text-slate-500 transition active:scale-95 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <div>
                  <h3 className="text-sm font-black text-teal-900 font-sans">
                    {appConfig?.samityPolicyConfig?.policyTitle || 'মাসিক বিনিয়োগ ও নীতিমালা'}
                  </h3>
                  <p className="text-[9.5px] text-slate-400 mt-0.5">
                    {appConfig?.samityPolicyConfig?.policySubTitle || '1ম থেকে 25শে অক্টোবর পেমেন্ট সিস্টেম ও বিলম্ব চার্জসমূহ'}
                  </p>
                </div>
              </div>

              {/* Deactivate/Reactivate Button */}
              {user.samitySchemeActive !== false ? (
                <button
                  onClick={() => {
                    setFormError('');
                    setFormSuccess('');
                    setSamityPinInput('');
                    setSamityPinPrompt('close');
                  }}
                  className="px-3.5 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-black hover:bg-rose-100 transition active:scale-95 cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              ) : (
                <button
                  onClick={() => {
                    setFormError('');
                    setFormSuccess('');
                    setSamityPinInput('');
                    if (user.dueMonths && user.dueMonths > 0) {
                      setSamityPinPrompt('pay_reactivate');
                    } else {
                      setSamityPinPrompt('active');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 border border-emerald-750 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition active:scale-95 cursor-pointer"
                >
                  চালু করুন
                </button>
              )}
            </div>

            {/* Error/Success alerts */}
            {formError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs p-3.5 rounded-2xl font-bold">
                ⚠️ {formError}
              </div>
            )}
            {formSuccess && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3.5 rounded-2xl font-bold">
                ✓ {formSuccess}
              </div>
            )}

            {/* Current Active Status Indicator */}
            <div className={`p-4 rounded-3xl border ${
              user.samitySchemeActive !== false 
                ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                : 'bg-rose-50/50 border-rose-100 text-rose-800'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${user.samitySchemeActive !== false ? 'bg-emerald-600 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-xs font-black">
                  স্কিম স্ট্যাটাসঃ {user.samitySchemeActive !== false ? '🟢 সচল (Active)' : '🔴 বন্ধ (Inactive)'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mt-1.5 leading-normal">
                {user.samitySchemeActive !== false 
                  ? (appConfig?.samityPolicyConfig?.schemeStatusNote || 'আপনার একাউন্ট থেকে প্রতি মাসের 1 থেকে 9 তারিখের মধ্যে স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্স থেকে কিস্তি অটো-ডেবিট করা হবে।')
                  : 'আপনার স্কিমটি বর্তমানে বন্ধ রয়েছে। বকেয়া কিস্তিসমূহ পরিশোধপূর্বক সিকিউরিটি পিন দিয়ে পুনরায় চালু করতে পারবেন।'}
              </p>
              {user.samitySchemeActive === false && (
                <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-[10.5px] font-bold leading-relaxed">
                  <p className="text-slate-700">
                    25শে ডিসেম্বরের পূর্বে আপনার সঞ্চিত টাকা উত্তোলন করতে পারবেন না। আপনার জমাকৃত <strong className="text-rose-600 font-black">৳ {userSavings.toLocaleString('bn-BD')}</strong> টাকা ডিসেম্বরের 25 তারিখে আপনার মেইন ব্যালেন্সে স্বয়ংক্রিয়ভাবে যোগ হয়ে যাবে।
                  </p>
                </div>
              )}
            </div>

            {/* 1. Fixed Investment amount card */}
            <div className="bg-white border border-slate-150 p-4.5 rounded-3xl space-y-3.5 shadow-3xs text-left">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold text-teal-600 uppercase tracking-widest block">
                  {appConfig?.samityPolicyConfig?.fixedAmountTitle || '1. নির্ধারিত মাসিক বিনিয়োগের পরিমাণ'}
                </span>
                <span className="text-[9.5px] bg-slate-100 border border-slate-200 text-slate-500 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 uppercase">
                  🔒 Locked
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">নির্ধারিত মাসিক কিস্তি</span>
                  <span className="font-sans text-lg font-black text-slate-800">৳ {targetMonthlyRate.toLocaleString('bn-BD')} <span className="text-xs text-slate-500 font-normal">BDT</span></span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-teal-600" />
                </div>
              </div>
              <p className="text-[10.5px] text-slate-500 leading-normal font-sans">
                {appConfig?.samityPolicyConfig?.fixedAmountNote || '💡 অ্যাকাউন্ট খোলার সময় আপনার নির্বাচিত এই কিস্তির পরিমাণ স্থায়ী। এটি সাধারণ ব্যবহারকারী নিজে পরিবর্তন করতে পারবেন না। প্রয়োজনে পরিবর্তন করার জন্য এডমিন প্যানেলের মাধ্যমে প্রধান কার্যালয়ের সাথে যোগাযোগ করুন।'}
              </p>
            </div>

            {/* 2. Penalty Schedule */}
            <div className="bg-white border border-slate-150 p-4.5 rounded-3xl space-y-3.5 shadow-3xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                {appConfig?.samityPolicyConfig?.penaltyTitle || '2. বিলম্ব পেমেন্ট ও জরিমানা পলিসি'}
              </span>

              {/* Current Month Fine Exemption Banner */}
              {(() => {
                const now = new Date();
                const curYear = now.getFullYear();
                const curMonthNum = String(now.getMonth() + 1).padStart(2, '0');
                const curMonthKey = `${curYear}-${curMonthNum}`;
                const curMonthCfg = appConfig?.samityPolicyConfig?.exemptedMonthsConfig?.[curMonthKey];
                const isExempt = curMonthCfg !== undefined 
                  ? curMonthCfg.isExempted 
                  : Boolean(appConfig?.samityPolicyConfig?.exemptedMonths?.[curMonthKey] || appConfig?.samityPolicyConfig?.pausePenaltyUntil15th);
                
                const exemptDay = curMonthCfg?.exemptUntilDay || appConfig?.samityPolicyConfig?.penaltyExemptionUntilDay || 31;
                const monthNamesBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
                const curMonthName = monthNamesBn[now.getMonth()];

                if (!isExempt) return null;

                return (
                  <div className="p-3 bg-amber-500/10 border border-amber-400/60 rounded-2xl text-amber-900 text-xs font-bold flex items-start gap-2 shadow-2xs">
                    <span className="text-base leading-none">📢</span>
                    <div>
                      <span className="text-[11px] font-black text-amber-800 uppercase block">
                        বিশেষ সুযোগঃ {curMonthName} মাসে বিলম্ব জরিমানা স্থগিত ({exemptDay === 31 ? 'পুরো মাস' : `${exemptDay}ই পর্যন্ত`} ৳0 জরিমানা)
                      </span>
                      <p className="text-[11.5px] font-semibold text-slate-700 mt-0.5 leading-relaxed">
                        {curMonthCfg?.note || appConfig?.samityPolicyConfig?.penaltyExemptionNote || `${curMonthName} মাসের বিশেষ সুবিধার জন্য জরিমানা 9 তারিখের পরিবর্তে ${exemptDay === 31 ? 'পুরো মাস' : `${exemptDay} তারিখ পর্যন্ত`} স্থগিত করা হয়েছে।`}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2 text-xs">
                {(appConfig?.samityPolicyConfig?.penaltyTiers && appConfig.samityPolicyConfig.penaltyTiers.length > 0
                  ? appConfig.samityPolicyConfig.penaltyTiers
                  : [
                      { id: '1', rangeLabel: '১ থেকে ১৫ তারিখঃ', fineText: 'কোনো জরিমানা নেই (০ BDT - নিয়মিত কিস্তির সময়, শেষ তারিখ ১৫ই চলতি মাস)', bgClass: 'bg-emerald-50/40 border-emerald-100 text-emerald-800' },
                      { id: '2', rangeLabel: '১৬ তারিখ থেকে প্রথম ৩০ দিনঃ', fineText: 'প্রতিদিন ৳১ জরিমানা (১৬ থেকে ৪৫তম দিন পর্যন্ত)', bgClass: 'bg-amber-50/40 border-amber-100 text-amber-800' },
                      { id: '3', rangeLabel: '৩০ দিন পার হলে (৪৬তম দিন থেকে)ঃ', fineText: 'প্রতিদিন ৳১০ জরিমানা', bgClass: 'bg-rose-50/40 border-rose-100 text-rose-800' }
                    ]
                ).map((tier, idx) => (
                  <div key={tier.id || idx} className={`flex justify-between items-center p-2.5 rounded-xl border ${tier.bgClass || 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                    <span className="font-bold">{tier.rangeLabel}</span>
                    <span className="font-extrabold">
                      {appConfig?.samityPolicyConfig?.pausePenaltyUntil15th && tier.fromDay <= (appConfig?.samityPolicyConfig?.penaltyExemptionUntilDay || 15)
                        ? `${tier.fineText} (বর্তমানে স্থগিত)`
                        : tier.fineText}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Rules List */}
            <div className="bg-white border border-slate-150 p-4.5 rounded-3xl space-y-2.5 shadow-3xs">
              <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-widest block">
                3. কিস্তি, অটো পেমেন্ট ও জরিমানা নীতিমালা
              </span>
              <div className="space-y-2">
                {(appConfig?.samityPolicyConfig?.customRules && appConfig.samityPolicyConfig.customRules.length > 0
                  ? appConfig.samityPolicyConfig.customRules
                  : [
                      "প্রতি মাসের ১ থেকে ১০ তারিখ পর্যন্ত সদস্যকে নিজের ইচ্ছায় কিস্তি পরিশোধ করার সুযোগ দেওয়া হয়।",
                      "১০ তারিখ পার হওয়ার পর চলতি মাসের কিস্তি পরিশোধ না করা থাকলে এবং মেইন ব্যালেন্সে পর্যাপ্ত টাকা থাকলে ১১ তারিখে স্বয়ংক্রিয়ভাবে ১টি কিস্তি কেটে নেওয়া হয়।",
                      "১৫ তারিখ হলো কিস্তি পরিশোধের শেষ তারিখ (Due Date)।",
                      "১৬ তারিখ থেকে প্রতিদিন ১ টাকা জরিমানা শুরু হয় (প্রথম ৩০ দিন প্রতিদিন ১ টাকা, ৩০ দিন অতিক্রান্ত হলে ৪৬তম দিন থেকে প্রতিদিন ১০ টাকা)।"
                    ]
                ).map((ruleItem, rIdx) => (
                  <div key={rIdx} className="bg-purple-50/50 border border-purple-100 p-3 rounded-2xl flex items-start gap-2 text-xs font-semibold text-purple-950">
                    <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-800 font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {rIdx + 1}
                    </span>
                    <p className="leading-relaxed text-[11px] font-sans">{ruleItem}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Interactive simulation tool */}
            <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-4 shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                  ⚡
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-emerald-400">তারিখ পরিবর্তন করে জরিমানা পরীক্ষা করুন</h4>
                  <p className="text-[9.5px] text-slate-400 mt-0.5">স্বয়ংক্রিয় অটো-ডেবিট ও জরিমানা সমন্বয় সিমুলেশন</p>
                </div>
              </div>

              <div className="space-y-3 pt-1 text-xs">
                <div>
                  <label className="block text-[10.5px] text-slate-450 font-bold mb-1.5">চলতি মাসের কোন তারিখে পেমেন্ট পরীক্ষা করবেন?</label>
                  <select
                    value={simulatedDay}
                    onChange={(e) => setSimulatedDay(Number(e.target.value))}
                    className="block w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                  >
                    {Array.from({ length: 60 }, (_, i) => i + 1).map((day) => {
                      let tag = '';
                      const penaltyAmt = getPenaltyAmount(day);
                      if (penaltyAmt === 0) {
                        if (appConfig?.samityPolicyConfig?.pausePenaltyUntil15th && day > 9) {
                          tag = ` (${day}ই পর্যন্ত জরিমানা স্থগিত - ৳0)`;
                        } else {
                          tag = ' (জরিমানা নেই - ৳0)';
                        }
                      } else {
                        tag = ` (৳${penaltyAmt} বিলম্ব জরিমানা)`;
                      }
                      return (
                        <option key={day} value={day}>
                          {day} তারিখ {tag}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Live penalty calculations output */}
                <div className="bg-slate-850/80 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-[11.5px] font-sans font-semibold">
                  <div className="flex justify-between">
                    <span className="text-slate-400">নির্ধারিত মাসিক কিস্তিঃ</span>
                    <span className="font-bold">৳ {targetMonthlyRate.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">বিলম্ব জরিমানা চার্জঃ</span>
                    <span className={`font-bold ${getPenaltyAmount(simulatedDay) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ৳ {getPenaltyAmount(simulatedDay).toLocaleString('bn-BD')}
                      {appConfig?.samityPolicyConfig?.pausePenaltyUntil15th && simulatedDay > 9 && simulatedDay <= (appConfig?.samityPolicyConfig?.penaltyExemptionUntilDay || 15) ? ' (স্থগিত)' : ''}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-xs font-black">
                    <span className="text-teal-400">মোট প্রদেয় কিস্তিঃ</span>
                    <span className="text-emerald-400">
                      ৳ {(targetMonthlyRate + getPenaltyAmount(simulatedDay)).toLocaleString('bn-BD')}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 leading-normal bg-slate-850 p-2.5 border border-slate-800 rounded-xl font-normal leading-relaxed">
                  💡 <strong>পলিসি অনুযায়ীঃ</strong> আপনার মেইন ব্যালেন্স যদি পর্যাপ্ত না থাকে, তবে পূর্বের জমানো সঞ্চয় (৳{userSavings.toLocaleString('bn-BD')}) হতে এই জরিমানা সমন্বয় করা হবে।
                </div>

                {/* Process Auto Debit Simulation */}
                {user.lastPaidMonth === '2026-06' ? (
                  <div className="bg-emerald-950/50 border border-emerald-900 text-emerald-400 text-xs p-3 rounded-xl text-center font-bold">
                    ✓ এই সিমুলেশনে জুন 2026 মাসের ডিপিএস অলরেডি পেইড দেখাচ্ছে!
                  </div>
                ) : (
                  <button
                    onClick={handleExecuteAutoDebit}
                    disabled={actionLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3 rounded-xl font-extrabold text-xs transition duration-200 disabled:opacity-50"
                  >
                    {actionLoading ? 'প্রক্রিয়াকরণ হচ্ছে...' : 'অটো-ডেবিট ও জরিমানা সমন্বয় করুন'}
                  </button>
                )}
              </div>
            </div>

            {/* Back button */}
            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-2xl text-xs transition shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: REFERRAL NETWORK ================= */}
        {bottomTab === 'home' && activeSubView === 'referral_network' && (() => {
          const myReferrals = allUsers.filter(u => u.referredBy === user.memberId || u.referredBy === user.phone);
          const referralLink = `${window.location.origin}/?ref=${user.memberId || user.phone}`;
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 text-left font-sans"
            >
              {/* Header */}
              <div className="bg-white border border-slate-150 p-4.5 rounded-3xl shadow-3xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-teal-900">রেফারেল নেটওয়ার্ক</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">আপনার রেফারেল নেটওয়ার্ক, কোড এবং মেম্বার লিস্ট</p>
                </div>
                <button
                  onClick={() => {
                    setActiveSubView('main');
                    setFormError('');
                    setFormSuccess('');
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-bold hover:bg-slate-100 transition active:scale-95"
                >
                  বন্ধ করুন
                </button>
              </div>

              {/* Alert Notification */}
              {formError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-750 text-xs p-3.5 rounded-2xl font-bold">
                  ⚠️ {formError}
                </div>
              )}
              {formSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-750 text-xs p-3.5 rounded-2xl font-bold">
                  ✓ {formSuccess}
                </div>
              )}

              {/* 1. Share Refer and Earn card */}
              <div className="bg-gradient-to-br from-indigo-900 to-teal-950 text-white p-5 rounded-3xl space-y-4 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
                
                <div className="space-y-1">
                  <span className="text-[9px] bg-indigo-500 text-white font-extrabold uppercase px-2 py-0.5 rounded-md">
                    REWARD SYSTEM
                  </span>
                  <h3 className="text-sm font-black text-teal-300">রেফারেল প্রোগ্রাম</h3>
                  <p className="text-[10px] text-slate-300 leading-normal font-medium mt-1">
                    আপনার রেফারেল লিংক বা মেম্বার আইডি ব্যবহার করে নতুন সদস্য যুক্ত করুন। ড্যাশবোর্ড থেকে তাদের স্থিতি নজর রাখুন।
                  </p>
                </div>

                {/* Referral Code Display */}
                <div className="bg-indigo-950/60 border border-indigo-800/80 p-3 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-indigo-300 block font-bold uppercase">আমার রেফারেল কোড</span>
                    <span className="font-mono text-base font-black tracking-wide text-white">{user.memberId || user.phone}</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(user.memberId || user.phone);
                      setCustomAlert({
                        message: "রেফারেল কোড সফলভাবে কপি করা হয়েছে!",
                        title: "কোড কপি সম্পন্ন"
                      });
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10.5px] font-bold text-white transition active:scale-95"
                  >
                    কপি করুন
                  </button>
                </div>

                {/* Referral Link Display */}
                <div className="bg-indigo-950/60 border border-indigo-800/80 p-3 rounded-2xl space-y-1.5">
                  <span className="text-[9px] text-indigo-300 block font-bold uppercase">আমার রেফারেল লিংক</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={referralLink}
                      className="flex-1 bg-indigo-950 border border-indigo-900 px-3 py-1.5 text-[10px] rounded-xl text-slate-300 font-mono focus:outline-none truncate"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralLink);
                        setCustomAlert({
                          message: "রেফারেল লিংক সফলভাবে কপি করা হয়েছে!",
                          title: "লিংক কপি সম্পন্ন"
                        });
                      }}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 rounded-xl text-[10.5px] font-bold text-white transition active:scale-95"
                    >
                      কপি করুন
                    </button>
                  </div>
                </div>
              </div>

              {/* Enter Referrer Code if not set */}
              {!user.referredBy ? (
                <div className="bg-white border border-slate-150 p-4.5 rounded-3xl space-y-3 shadow-3xs">
                  <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest block">1. রেফারার কোড যোগ করুন</span>
                  <p className="text-xs text-slate-500 leading-normal">
                    আপনাকে যদি অন্য কোনো সক্রিয় সদস্য রেফার করে থাকেন, তবে তার মেম্বার আইডি বা মোবাইল নম্বর দিয়ে সাবমিট করুন।
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referrerCodeInput}
                      onChange={(e) => setReferrerCodeInput(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                      placeholder="যেমনঃ BNB00000001"
                    />
                    <button
                      onClick={handleSetReferrer}
                      disabled={actionLoading}
                      className="px-4 py-2.5 bg-indigo-800 hover:bg-indigo-900 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                    >
                      সাবমিট
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-xs text-emerald-800 font-semibold space-y-1">
                  <p>✓ <strong>রেফারার সংযুক্তঃ</strong> আপনি সফলভাবে রেফারেল নেটওয়ার্কে যুক্ত আছেন।</p>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">রেফারার আইডি: {user.referredBy}</p>
                </div>
              )}

              {/* Referred Members list */}
              <div className="bg-white border border-slate-150 p-4 rounded-3xl space-y-4 shadow-3xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                  <span className="text-[10.5px] font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-tight">
                    <Users className="w-4 h-4 text-slate-500" />
                    আমার রেফারকৃত মেম্বার তালিকা ({myReferrals.length})
                  </span>
                  <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono font-black">NETWORK SIZE</span>
                </div>

                <div className="space-y-2.5">
                  {myReferrals.length > 0 ? (
                    myReferrals.map((item, idx) => (
                      <div key={item.uid || idx} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs shadow-4xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                            {idx + 1}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 block text-[11px] leading-tight">{item.name}</span>
                            <span className="text-[9.5px] text-slate-400 block mt-0.5 font-sans">ID: {item.memberId || 'N/A'} • মোবাইলঃ {item.phone ? `${item.phone.slice(0, 5)}*****${item.phone.slice(-3)}` : 'N/A'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[8.5px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-extrabold uppercase border border-emerald-200">
                            সক্রিয় সদস্য
                          </span>
                          <span className="text-[8.5px] text-slate-450 block mt-1">সঞ্চয়: ৳{(item.savings || 0).toLocaleString('bn-BD')}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-7 text-center text-xs text-slate-400 font-bold italic leading-relaxed">
                      আপনি এখনো কোনো মেম্বার রেফার করেননি।<br/>আপনার রেফারেল লিংক ব্যবহার করে মেম্বারদের আমন্ত্রন জানান!
                    </div>
                  )}
                </div>
              </div>

              {/* Back button */}
              <button
                onClick={() => setActiveSubView('main')}
                className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-2xl text-xs transition shadow-4xs text-center"
              >
                পিছনে ফিরে যান
              </button>
            </motion.div>
          );
        })()}

        {/* ================= SUB VIEW: SHARE TRANSFER ================= */}
        {bottomTab === 'home' && activeSubView === 'share_transfer' && (() => {
          const myShares = user.shares !== undefined ? user.shares : Math.max(1, Math.floor(user.savings / 1000));
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 text-left font-sans"
            >
              {/* Header */}
              <div className="bg-white border border-slate-150 p-4.5 rounded-3xl shadow-3xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-teal-900">শেয়ার বিক্রয় ও হস্তান্তর</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">আপনার শেয়ার বিক্রি বা হস্তান্তর করার পোর্টাল</p>
                </div>
                <button
                  onClick={() => {
                    setActiveSubView('main');
                    setFormError('');
                    setFormSuccess('');
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-bold hover:bg-slate-100 transition active:scale-95"
                >
                  বন্ধ করুন
                </button>
              </div>

              {/* Alerts */}
              {formError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-750 text-xs p-3.5 rounded-2xl font-bold">
                  ⚠️ {formError}
                </div>
              )}
              {formSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-750 text-xs p-3.5 rounded-2xl font-bold">
                  ✓ {formSuccess}
                </div>
              )}

              {/* 1. Share stats card */}
              <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white p-5 rounded-3xl space-y-3.5 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
                
                <div>
                  <span className="text-[9px] bg-rose-500/30 text-rose-200 font-extrabold uppercase border border-rose-500/30 px-2 py-0.5 rounded-md">
                    EQUITY HOLDING
                  </span>
                  <span className="text-[10.5px] block text-rose-200 mt-1.5 font-bold uppercase font-sans">আমার মোট শেয়ার সংখ্যা</span>
                  <h2 className="text-3xl font-black font-sans mt-0.5 text-white tracking-tight">{myShares} টি শেয়ার</h2>
                  <p className="text-[10px] text-rose-250 mt-1 leading-normal">
                    1,000 টাকা সঞ্চয়ের বিপরীতে 1টি শেয়ার ধরা হয়েছে। আপনার মালিকানাধীন শেয়ার আপনি অন্য যেকোনো নিবন্ধিত মেম্বারের কাছে বিক্রি বা ট্রান্সফার করতে পারেন।
                  </p>
                </div>
              </div>

              {/* 2. Submit Transfer request */}
              <div className="bg-white border border-slate-150 p-4.5 rounded-3xl space-y-4 shadow-3xs">
                <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest block">1. নতুন শেয়ার হস্তান্তর আবেদন</span>
                
                <form onSubmit={handleShareTransferSubmit} className="space-y-3 text-xs">
                  {/* Recipient User ID */}
                  <div>
                    <label className="block text-slate-600 font-extrabold mb-1.5">গ্রহীতার মেম্বার আইডি বা মোবাইল নম্বর</label>
                    <input
                      type="text"
                      required
                      value={shareRecipientId}
                      onChange={(e) => setShareRecipientId(e.target.value)}
                      className="block w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                      placeholder="যেমনঃ BNB00000002"
                    />
                    {shareRecipientName ? (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                        ✓ গ্রহীতার নামঃ <strong>{shareRecipientName}</strong>
                      </span>
                    ) : shareRecipientId.trim() ? (
                      <span className="text-[10px] text-rose-500 font-semibold block mt-1">
                        ⚠️ এই আইডি বা মোবাইলের কোনো সদস্য পাওয়া যায়নি
                      </span>
                    ) : null}
                  </div>

                  {/* Share count and Price */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 font-extrabold mb-1.5">হস্তান্তর শেয়ার সংখ্যা</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={myShares}
                        value={shareCountInput}
                        onChange={(e) => setShareCountInput(e.target.value)}
                        className="block w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs font-bold focus:outline-none"
                        placeholder={`সর্বোচ্চ ${myShares}`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-extrabold mb-1.5">প্রতি শেয়ারের মূল্য (ঐচ্ছিক)</label>
                      <input
                        type="number"
                        min={0}
                        value={sharePriceInput}
                        onChange={(e) => setSharePriceInput(e.target.value)}
                        className="block w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs font-bold focus:outline-none"
                        placeholder="যেমনঃ 500"
                      />
                    </div>
                  </div>

                  {/* Security PIN code */}
                  <div>
                    <label className="block text-slate-600 font-extrabold mb-1.5">সিকিউরিটি পিন নম্বর</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={shareTransferPin}
                      onChange={(e) => setShareTransferPin(e.target.value.replace(/\D/g, ''))}
                      className="block w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs font-bold tracking-widest text-center"
                      placeholder="••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading || !shareRecipientName}
                    className="w-full bg-rose-800 hover:bg-rose-900 active:bg-rose-950 text-white font-extrabold py-3 rounded-xl text-xs transition duration-200 disabled:opacity-50"
                  >
                    {actionLoading ? 'প্রক্রিয়াকরণ হচ্ছে...' : 'হস্তান্তর আবেদন সাবমিট করুন'}
                  </button>
                </form>
              </div>

              {/* 3. Share transfer request list */}
              <div className="bg-white border border-slate-150 p-4 rounded-3xl space-y-3 shadow-3xs">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-1.5">2. হস্তান্তর ইতিহাস ও অনুরোধসমূহ</span>
                
                {loadingShareTransfers ? (
                  <div className="py-5 text-center text-xs text-slate-450 font-bold">লোড হচ্ছে...</div>
                ) : (
                  <div className="space-y-2">
                    {shareTransfers.length > 0 ? (
                      shareTransfers.map((item, idx) => {
                        const isSender = item.senderUid === user.uid;
                        return (
                          <div key={`${item.id}-${idx}`} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs shadow-4xs">
                            <div>
                              <span className={`font-extrabold text-xs block ${isSender ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {isSender ? `শেয়ার বিক্রয় / হস্তান্তর` : `শেয়ার ক্রয় / প্রাপ্ত`}
                              </span>
                              <span className="text-[9.5px] text-slate-450 block mt-0.5 font-semibold">
                                {isSender ? `গ্রহীতা: ${item.receiverName} (${item.receiverMemberId})` : `প্রেরক: ${item.senderName} (${item.senderMemberId})`}
                              </span>
                              <span className="text-[8px] text-slate-400 font-mono block mt-0.5">তারিখ: {new Date(item.createdAt).toLocaleDateString('bn-BD')}</span>
                            </div>
                            <div className="text-right space-y-1">
                              <span className="font-sans font-black text-slate-800 text-xs block">{item.sharesCount} টি শেয়ার</span>
                              <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-extrabold uppercase border block ${
                                item.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                item.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {item.status === 'approved' ? 'অনুমোদিত' : item.status === 'rejected' ? 'প্রত্যাখ্যাত' : 'অনুমোদন অপেক্ষায়'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-450 font-bold">কোনো পূর্ববর্তী ট্র্যান্সফার রেকর্ড পাওয়া যায়নি।</div>
                    )}
                  </div>
                )}
              </div>

              {/* Back button */}
              <button
                onClick={() => setActiveSubView('main')}
                className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-2xl text-xs transition shadow-4xs text-center"
              >
                পিছনে ফিরে যান
              </button>
            </motion.div>
          );
        })()}

        {/* ================= SUB VIEW: REGISTER OTHER MEMBER ================= */}
        {bottomTab === 'home' && activeSubView === 'register_other_member' && (() => {
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 text-left"
            >
              {/* Header card */}
              <div className="bg-white border border-slate-150 p-4 rounded-3xl shadow-2xs flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">অন্য সদস্যের একাউন্ট করুন</h3>
                    <p className="text-[10.5px] text-slate-500 font-medium">সমবায় সমিতিতে আপনার মাধ্যমে নতুন সদস্য যুক্ত করুন</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSubView('main')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  পিছনে যান
                </button>
              </div>

              {/* Prominent Counter Box */}
              <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden text-center space-y-2 border border-emerald-700/50">
                <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center mx-auto text-emerald-300 border border-white/20 backdrop-blur-xs">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xs font-extrabold tracking-wide text-emerald-100">আপনি এ পর্যন্ত মোট নিবন্ধিত করেছেন</h3>
                <div className="text-3xl font-black font-mono tracking-tight text-white flex items-center justify-center gap-2">
                  <span>🎉</span>
                  <span>{createdMembersCount}</span>
                  <span className="text-sm font-bold text-emerald-200 font-sans">জন সদস্য</span>
                </div>
                <p className="text-[11px] text-emerald-200/90 font-medium max-w-sm mx-auto">
                  আপনি যেসব নতুন সদস্যের অ্যাকাউন্ট তৈরি করে দিয়েছেন তারা আপনার তালিকাভুক্ত সমবায় সদস্য হিসেবে গণ্য হবেন।
                </p>
              </div>

              {regSuccessData ? (
                /* Success View */
                <div className="bg-white border border-emerald-200 p-6 rounded-3xl text-center space-y-4 shadow-sm">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border border-emerald-300">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-slate-900">সদস্য আবেদন সফলভাবে সাবমিট হয়েছে!</h3>
                    <p className="text-xs text-slate-600">নতুন সদস্যের আবেদনটি এডমিন প্যানেলে অনুমোদনের জন্য জমা হয়েছে।</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl text-left text-xs space-y-1.5 text-slate-700">
                    <p>👤 <strong>সদস্য নামঃ</strong> {regSuccessData.name}</p>
                    <p>🆔 <strong>সদস্য আইডিঃ</strong> <span className="font-mono text-emerald-900 font-black">{regSuccessData.memberId}</span></p>
                    <p>📞 <strong>মোবাইল নম্বরঃ</strong> <span className="font-mono text-slate-900 font-black">{regSuccessData.phone}</span></p>
                    <p>⏳ <strong>আবেদনের স্ট্যাটাসঃ</strong> <span className="text-amber-600 font-extrabold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">এডমিন অনুমোদনের অপেক্ষায় (Pending)</span></p>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-xs text-emerald-900 font-medium space-y-1 text-left">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                      এডমিন অনুমোদন ও পিন সেটআপ প্রক্রিয়া:
                    </p>
                    <p className="text-[11px] leading-relaxed text-emerald-850">
                      এডমিন আবেদনটি যাচাই করে অনুমোদন (Approve) দিলে এই সদস্য তাঁর মোবাইল নম্বর দিয়ে অ্যাপে প্রবেশ করে প্রথমবার নিজের 4 ডিজিটের সিকিউরিটি পিন সেট করে অ্যাকাউন্টে প্রবেশ করতে পারবেন।
                    </p>
                  </div>

                  <button
                    onClick={() => setRegSuccessData(null)}
                    className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-2xl text-xs transition shadow-md cursor-pointer"
                  >
                    আরেকটি নতুন একাউন্ট করুন
                  </button>
                </div>
              ) : (
                /* Registration Form */
                <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-4 shadow-2xs">
                  
                  {/* Pin Security Banner */}
                  <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-2xl text-xs text-amber-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-amber-800">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      গোপনীয়তা ও সিকিউরিটি পিন সংক্রান্ত নির্দেশনা:
                    </p>
                    <p className="text-[11px] leading-relaxed text-amber-900/90 font-medium">
                      সদস্যের নিরাপত্তার স্বার্থে আপনি পিন কোড সেট করতে পারবেন না। নতুন সদস্য প্রথমবার নিজের মোবাইল নম্বর দিয়ে অ্যাপসে প্রবেশ করার সময় নিজের পছন্দের 4 ডিজিটের পিন কোড সেট করে নিবেন।
                    </p>
                  </div>

                  <form onSubmit={handleRegisterOtherMemberSubmit} className="space-y-3.5">
                    {regError && (
                      <div className="bg-red-50 text-red-650 border border-red-100 text-xs p-3.5 rounded-2xl font-medium leading-relaxed">
                        {regError}
                      </div>
                    )}

                    {/* 1. নাম */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        1. নতুন সদস্যের নাম (বাংলা বা ইংরেজি) *
                      </label>
                      <input
                        type="text"
                        required
                        value={regMemberName}
                        onChange={(e) => setRegMemberName(e.target.value)}
                        placeholder="উদাঃ মোজাফ্মেল হক"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      />
                    </div>

                    {/* 2. মোবাইল নম্বর */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        2. নতুন সদস্যের মোবাইল নম্বর *
                      </label>
                      <input
                        type="tel"
                        required
                        value={regMemberPhone}
                        onChange={(e) => setRegMemberPhone(e.target.value.replace(/[^\d+]/g, ''))}
                        placeholder="উদাঃ 01712345678"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">এই নম্বর দিয়ে পরবর্তীতে সদস্য অ্যাপে প্রবেশ করবেন।</p>
                    </div>

                    {/* 3. পিতার নাম & মাতার নাম */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">3. পিতার নাম</label>
                        <input
                          type="text"
                          value={regFatherName}
                          onChange={(e) => setRegFatherName(e.target.value)}
                          placeholder="পিতার নাম লিখুন"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">4. মাতার নাম</label>
                        <input
                          type="text"
                          value={regMotherName}
                          onChange={(e) => setRegMotherName(e.target.value)}
                          placeholder="মাতার নাম লিখুন"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* 5. NID & জন্ম তারিখ */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">5. NID / পাসপোর্ট নম্বর *</label>
                        <input
                          type="text"
                          required
                          value={regMemberNid}
                          onChange={(e) => setRegMemberNid(e.target.value)}
                          placeholder="NID বা পাসপোর্ট নম্বর"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">6. জন্ম তারিখ</label>
                        <input
                          type="date"
                          value={regMemberDob}
                          onChange={(e) => setRegMemberDob(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* 7. ঠিকানা */}
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <p className="text-xs font-extrabold text-slate-800">7. সদস্যের ঠিকানা বিবরণী</p>
                      
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">বিভাগ / প্রদেশ</label>
                          <input
                            type="text"
                            value={regMemberDivision}
                            onChange={(e) => setRegMemberDivision(e.target.value)}
                            placeholder="উদাঃ ঢাকা"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">জেলা</label>
                          <input
                            type="text"
                            value={regMemberDistrict}
                            onChange={(e) => setRegMemberDistrict(e.target.value)}
                            placeholder="উদাঃ গাজীপুর"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">থানা / উপজেলা</label>
                          <input
                            type="text"
                            value={regMemberThana}
                            onChange={(e) => setRegMemberThana(e.target.value)}
                            placeholder="উদাঃ টঙ্গী"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">পোস্ট অফিস / গ্রাম</label>
                          <input
                            type="text"
                            value={regMemberPostOffice}
                            onChange={(e) => setRegMemberPostOffice(e.target.value)}
                            placeholder="গ্রাম/রোড"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 8. নমিনির তথ্য */}
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <p className="text-xs font-extrabold text-slate-800">8. নমিনির বিবরণী</p>
                      
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">নমিনির নাম *</label>
                        <input
                          type="text"
                          required
                          value={regNomineeName}
                          onChange={(e) => setRegNomineeName(e.target.value)}
                          placeholder="নমিনির নাম লিখুন"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">নমিনির সম্পর্ক</label>
                          <input
                            type="text"
                            value={regNomineeRelation}
                            onChange={(e) => setRegNomineeRelation(e.target.value)}
                            placeholder="উদাঃ পিতা/স্ত্রী"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">নমিনির মোবাইল *</label>
                          <input
                            type="tel"
                            required
                            value={regNomineePhone}
                            onChange={(e) => setRegNomineePhone(e.target.value)}
                            placeholder="017XXXXXXXX"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 9. কাঙ্ক্ষিত মাসিক সঞ্চয় স্কিম */}
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <label className="block text-xs font-bold text-slate-800">
                        9. কাঙ্ক্ষিত মাসিক সঞ্চয় স্কিম নির্ধারণ করুন *
                      </label>

                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: '100 BDT', value: '100' },
                          { label: '200 BDT', value: '200' },
                          { label: '500 BDT', value: '500' },
                          { label: '1000 BDT', value: '1000' },
                          { label: '2000 BDT', value: '2000' },
                          { label: 'Custom', value: 'custom' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setRegMonthlySavingsOption(opt.value)}
                            className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                              regMonthlySavingsOption === opt.value
                                ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {regMonthlySavingsOption === 'custom' && (
                        <div className="mt-2">
                          <label className="block text-[10.5px] font-bold text-slate-600 mb-1">
                            আপনার পছন্দের মাসিক সঞ্চয়ের পরিমাণ লিখুন (টাকায়) *
                          </label>
                          <input
                            type="number"
                            min="500"
                            required
                            value={regCustomSavingsAmount}
                            onChange={(e) => setRegCustomSavingsAmount(e.target.value)}
                            placeholder="উদাঃ 1500, 2500, 10000"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* 10. সম্মতি */}
                    <div className="pt-2">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={regAgreed}
                          onChange={(e) => setRegAgreed(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] text-slate-650 leading-snug">
                          আমি নিশ্চিত করছি যে প্রদত্ত সমস্ত তথ্য সঠিক এবং আমি সমবায় সমিতির নীতিমালার সাথে একমত পোষণ করছি।
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-2xl text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {regLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'নতুন সদস্য অ্যাকাউন্ট তৈরি করুন'
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Previously Created Members List */}
              {createdMembersList.length > 0 && (
                <div className="bg-white border border-slate-150 p-4 rounded-3xl space-y-3 shadow-2xs">
                  <h4 className="text-xs font-black text-slate-800 flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-600" />
                      আপনার নিবন্ধিত সদস্যবৃন্দের তালিকা
                    </span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                      মোট {createdMembersList.length} জন
                    </span>
                  </h4>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {createdMembersList.map((m, idx) => (
                      <div key={`${m.uid}-${idx}`} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-extrabold text-slate-900 block">{m.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">আইডি: {m.memberId} | মোবাইল: {m.phone}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-emerald-700 block bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            মাসিক ৳{m.monthlySavingsTarget || 500}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setActiveSubView('main')}
                className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-2xl text-xs transition shadow-4xs text-center"
              >
                পিছনে ফিরে যান
              </button>
            </motion.div>
          );
        })()}

        {/* ================= SUB VIEW: SAVINGS & DPS DETAIL ================= */}
        {bottomTab === 'home' && activeSubView === 'savings_dps' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-4 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                  <Wallet className="w-4 h-4" />
                  সঞ্চয় বিবরণী ও চলমান ডিপিএস খাতা
                </span>
                <span className="text-[9px] bg-slate-100 text-slate-500 font-mono font-bold border border-slate-200/80 px-2.5 py-0.5 rounded-full">Automated Ledger</span>
              </div>

              <div className="space-y-3 font-sans text-xs font-bold leading-relaxed">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500">1. সঞ্চয় তহবিলের স্থিতিঃ</span>
                  <span className="font-sans font-black text-slate-850">৳ {userSavings.toLocaleString('bn-BD')}</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500">2. ডিপিএস অ্যাকাউন্ট সংখ্যাঃ</span>
                  <span className="font-sans font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100 text-[10px]">1টি সক্রিয় ডিপিএস</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500">3. মাসিক ডিপিএস কিস্তিঃ</span>
                  <span className="font-mono text-slate-800">৳ 500 / মাসিক</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500">4. মোট পরিশোধিত ডিপিএস কিস্তিঃ</span>
                  <span className="font-mono text-slate-800">৳ {userDps.toLocaleString('bn-BD')} ({Math.floor(userDps / 500)}টি কিস্তি পরিশোধিত)</span>
                </div>

                <p className="text-[10px] text-slate-400 bg-slate-50 p-2.5 border border-slate-150 leading-normal pt-2 border-t rounded-xl italic font-normal">
                  *আপনার কোনো ডিপিএস কিস্তি বকেয়া নেই। ডিপিএস ম্যাচিউরিটি হলে 100% হালাল মুনাফা সহ মূল সঞ্চয় ওয়ালেটে একযোগে জমা হয়ে যাবে।
                </p>
              </div>
            </div>

            {/* Savings Deposit History Ledger */}
            <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-3 shadow-3xs text-left font-sans">
              <h4 className="text-[11.5px] font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <span className="w-1.5 h-3 bg-emerald-500 rounded-sm inline-block"></span>
                সমবায় ও ইনভেস্টর জমা স্টেটমেন্ট (ইতিহাস)
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {userTxHistory.filter(tx => tx.type === 'coop_savings_deposit' && (tx.status === 'success' || tx.status === 'approved')).length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-[10.5px] font-bold">
                    এখনো কোনো আমানত বা সঞ্চয় জমা করা হয়নি।
                  </div>
                ) : (
                  userTxHistory
                    .filter(tx => tx.type === 'coop_savings_deposit' && (tx.status === 'success' || tx.status === 'approved'))
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((tx, idx) => (
                      <div key={`${tx.id}-${idx}`} className="flex justify-between items-center p-2.5 bg-slate-50/60 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="font-extrabold text-slate-700 block">{tx.typeLabel || 'মাসিক সঞ্চয় ডিপিএস'}</span>
                          <span className="text-[9.5px] text-slate-400 block mt-0.5 font-medium">
                            {new Date(tx.createdAt).toLocaleDateString('bn-BD')} {new Date(tx.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-600 font-mono">+ ৳{tx.amount.toLocaleString('bn-BD')} BDT</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <button
              onClick={() => setActiveSubView('new_deposit')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl text-xs transition duration-200 shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-5 h-5 text-white" />
              নতুন আমানত বা ডিপিএস কিস্তি জমা দিন
            </button>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: CUSTOM SAVINGS ================= */}
        {bottomTab === 'home' && activeSubView === 'custom_savings' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left font-sans animate-fade-in"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-4 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="text-xs font-black text-amber-600 flex items-center gap-1">
                  <Wallet className="w-4 h-4" />
                  ইচ্ছেমত সঞ্চয় খাতা ও আমানত
                </span>
                <span className="text-[9px] bg-amber-50 text-amber-700 font-mono font-bold border border-amber-200 px-2.5 py-0.5 rounded-full">Flexible Savings</span>
              </div>

              {/* Savings Balance summary */}
              <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 border border-amber-100 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-500 font-black uppercase">সঞ্চয় তহবিলের মোট ব্যালেন্স</span>
                  <h3 className="text-2xl font-black text-amber-700 mt-1">৳ {userDps.toLocaleString('bn-BD')} <span className="text-xs font-bold text-slate-500">BDT</span></h3>
                </div>
                <Award className="w-10 h-10 text-amber-500/30 shrink-0" />
              </div>

              {/* Savings Deposit Form */}
              <div className="space-y-4 pt-1.5">
                <h4 className="text-[11.5px] font-black text-slate-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-amber-500 rounded-sm inline-block"></span>
                  নতুন সঞ্চয় যুক্ত করুন
                </h4>

                {formSuccess && <div className="p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] rounded-lg font-bold">{formSuccess}</div>}
                {formError && <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] rounded-lg font-bold">{formError}</div>}

                {/* Quick Deposit Buttons */}
                <div className="space-y-1.5">
                  <span className="block text-[9.5px] text-slate-400 font-extrabold uppercase">দ্রুত পরিমাণ নির্বাচন করুনঃ</span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[10, 50, 100, 200, 500].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setCustomDepositAmount(amount.toString())}
                        className={`py-2 text-[10.5px] font-black rounded-xl border transition-all cursor-pointer ${
                          customDepositAmount === amount.toString()
                            ? 'bg-amber-600 text-white border-amber-600 shadow-3xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        ৳{amount}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[9.5px] text-slate-400 font-extrabold uppercase mb-1">অথবা কাস্টম পরিমাণ (৳):</label>
                    <input
                      type="number"
                      value={customDepositAmount}
                      onChange={(e) => setCustomDepositAmount(e.target.value)}
                      placeholder="৳ জমার পরিমাণ লিখুন"
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-805 font-bold focus:outline-none focus:bg-white focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] text-slate-400 font-extrabold uppercase mb-1">4 ডিজিটের সিকিউরিটি পিন:</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={customDepositPin}
                      onChange={(e) => setCustomDepositPin(e.target.value)}
                      placeholder="•••• আপনার অ্যাকাউন্ট পিন"
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 text-center tracking-widest focus:outline-none focus:bg-white focus:border-amber-500"
                    />
                  </div>

                  <button
                    onClick={() => {
                      const amt = Number(customDepositAmount);
                      handleCustomSavingsSubmit(amt, customDepositPin);
                    }}
                    disabled={actionLoading}
                    className="w-full mt-1.5 py-3 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-700 hover:to-orange-800 text-white rounded-xl text-xs font-black transition cursor-pointer text-center shadow-md shadow-amber-100"
                  >
                    {actionLoading ? 'সঞ্চয় স্থানান্তর হচ্ছে...' : 'মেইন ব্যালেন্স থেকে সঞ্চয় করুন'}
                  </button>
                </div>
              </div>
            </div>

            {/* Savings History Ledger list */}
            <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-3 shadow-3xs">
              <h4 className="text-[11.5px] font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <span className="w-1.5 h-3 bg-amber-500 rounded-sm inline-block"></span>
                সঞ্চয় জমার স্টেটমেন্ট (হিস্টোরি)
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {userTxHistory.filter(tx => tx.type === 'coop_savings_deposit' && tx.status === 'success').length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-[10.5px] font-bold">
                    এখনো কোনো সঞ্চয় জমা করা হয়নি।
                  </div>
                ) : (
                  userTxHistory
                    .filter(tx => tx.type === 'coop_savings_deposit' && tx.status === 'success')
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((tx, idx) => (
                      <div key={`${tx.id}-${idx}`} className="flex justify-between items-center p-2.5 bg-slate-50/60 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="font-extrabold text-slate-700 block">সঞ্চয় আমানত</span>
                          <span className="text-[9.5px] text-slate-400 block mt-0.5 font-medium">
                            {new Date(tx.createdAt).toLocaleDateString('bn-BD')} {new Date(tx.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-600 font-mono">+ ৳{tx.amount.toLocaleString('bn-BD')} BDT</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setActiveSubView('main');
                resetFormState();
                setCustomDepositAmount('');
                setCustomDepositPin('');
              }}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: COOPERATIVE LOAN LEDGER ================= */}
        {bottomTab === 'home' && activeSubView === 'loan_ledger' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-2.5xl space-y-4 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-rose-600" />
                  লোন হিসাব (Co-operative Loan)
                </span>
                <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${user.dueLoan > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {user.dueLoan > 0 ? "ACTIVE LOAN" : "NO OUTSTANDING LOAN"}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-500 font-bold">চলতি বকেয়া ঋণের পরিমাণঃ</span>
                  <span className="text-xl font-black font-sans text-rose-600">৳ {user.dueLoan > 0 ? user.dueLoan.toLocaleString('bn-BD') : "0"} BDT</span>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[10.5px] text-amber-850 leading-relaxed font-sans font-bold shadow-4xs">
                  ⚠️ <strong>ঋণ নিয়মনীতিঃ</strong> সমবায় বিধি অনুযায়ী প্রতিটি লোন কিস্তি প্রতি মাসের 10 তারিখের মধ্যে ওয়ালেট ব্যালেন্স থেকে পরিশোধ করা বাধ্যতামুলক।
                </div>
              </div>
            </div>

            {/* Direct Loan Apply Inline Form */}
            <div className="bg-white border border-slate-150 p-5 rounded-2.5xl space-y-4 shadow-3xs">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                ✏️ নতুন সমবায় লোনের জন্য আবেদন ফর্ম
              </h4>

              <form onSubmit={handleLoanApplicationSubmit} className="space-y-3">
                {formSuccess && <div className="p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] rounded-lg font-bold">{formSuccess}</div>}
                {formError && <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] rounded-lg font-bold">{formError}</div>}

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">কাম্য ঋণের পরিমাণ (BDT)</label>
                  <input
                    type="number"
                    required
                    value={loanApplyAmount}
                    onChange={(e) => setLoanApplyAmount(e.target.value)}
                    placeholder="৳ কত টাকা সর্বোচ্চ 50,000 BDT"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-teal-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">ঋণ ব্যবহারের সুনির্দিষ্ট কারণ</label>
                  <input
                    type="text"
                    required
                    value={loanApplyPurpose}
                    onChange={(e) => setLoanApplyPurpose(e.target.value)}
                    placeholder="উদাঃ ব্যবসার নতুন পণ্য কিনার উদ্দেশ্যে"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-teal-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">4 ডিজিটের সিকিউরিটি পিন কোড</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={loanApplyPin}
                    onChange={(e) => setLoanApplyPin(e.target.value)}
                    placeholder="•••• আপনার 4 ডিজিটের একাউন্ট পিন"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 text-center tracking-widest focus:outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full mt-1.5 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer text-center"
                >
                  {actionLoading ? 'আবেদন পাঠানো হচ্ছে...' : 'লোন আবেদন সাবমিট করুন'}
                </button>
              </form>
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: PROFITS LEDGER ================= */}
        {bottomTab === 'home' && activeSubView === 'profits' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-2xl space-y-4 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Award className="w-5 h-5 text-indigo-600 animate-pulse" />
                  কোপারেটিভ অর্জিত হালাল লাভ বিবরণী
                </span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full font-mono">Profit Ledger</span>
              </div>

              <div className="space-y-3.5">
                <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 p-4 rounded-xl flex justify-between items-baseline shadow-4xs">
                  <span className="text-xs text-slate-500 font-bold">সর্বমোট লভ্যাংশ ক্রেডিটঃ</span>
                  <span className="text-xl font-black text-emerald-800">৳ {userProfits.toLocaleString('bn-BD')} BDT</span>
                </div>

                <div className="text-[11px] text-slate-650 leading-relaxed font-sans font-bold space-y-2">
                  <p>🌿 <strong>লাভ বণ্টন পরিবীক্ষণঃ</strong> কো-অপারেটিভ তহবিলের সমস্ত অর্থ সরাসরি আমাদের ক্ষুদ্র শিল্প ব্যবসায় নিয়োজিত থাকে এবং অর্জিত লভ্যাংশ প্রতি 100 টাকায় 1% হারে বণ্টন হয়।</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: MEMBER REGISTRY ================= */}
        {bottomTab === 'home' && activeSubView === 'member_registry' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-150 p-4.5 rounded-2.5xl space-y-4 shadow-3xs">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Users className="w-5 h-5 text-indigo-600" />
                  ইনভেস্টর মেম্বার রেজিস্ট্রি ({allUsers.length} জন)
                </h3>
              </div>

              {/* Seach registry */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="মেম্বারের নাম বা আইডি দিয়ে খুঁজুন..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-9 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-teal-500 font-bold"
                />
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {filteredUsers.map((m, idx) => (
                  <div key={`${m.uid}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-2xl text-xs shadow-4xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-800">{m.name}</span>
                        <span className="text-[8.5px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-black">{m.memberId || 'PENDING'}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[8.5px] bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded-full uppercase">সক্ষম</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: SAVINGS WITHDRAWAL ================= */}
        {bottomTab === 'home' && activeSubView === 'withdraw_savings' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left animate-fade-in"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-2.5xl space-y-4.5 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <span className="text-xs font-black text-rose-600 flex items-center gap-1">
                  <ArrowDownLeft className="w-5 h-5 text-rose-600" />
                  সঞ্চয় সাধারণ তহবিল হতে মেইন ব্যালেন্স স্থানান্তর
                </span>
                <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full font-mono uppercase font-black">Coop Transfer</span>
              </div>

              {/* Destination Warning Card */}
              <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl space-y-1 text-slate-700">
                <span className="text-[10px] font-bold text-rose-700 block uppercase">💡 স্থানান্তর পলিসিঃ</span>
                <p className="text-[10.5px] font-bold leading-relaxed text-slate-600">
                  সঞ্চয়ী আমানত হতে টাকা ডিরেক্টলি বা সরাসরি আপনার মেইন ব্যালেন্সে ট্রান্সফার হবে। কোনো গেটওয়ে নম্বর লাগবে না। তবে স্থানান্তরের জন্য সমবায় এডমিন অফিস থেকে অনুমতি (অ্যাপ্রুভাল) প্রয়োজন।
                </p>
              </div>

              <form onSubmit={handleSavingsWithdrawSubmit} className="space-y-3.5">
                {formSuccess && <div className="p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] rounded-lg font-bold">{formSuccess}</div>}
                {formError && <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] rounded-lg font-bold">{formError}</div>}

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] text-slate-500 font-extrabold uppercase">স্থানান্তরের মোট পরিমাণ (BDT)</label>
                    <span className="text-[10px] text-indigo-600 font-bold">সর্বোচ্চঃ ৳{userSavings.toLocaleString('bn-BD')} BDT</span>
                  </div>
                  <input
                    type="number"
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="৳ কত টাকা স্থানান্তর করবেন"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-805 font-bold focus:outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">4 ডিজিটের সিকিউরিটি পিন</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={withdrawPin}
                    onChange={(e) => setWithdrawPin(e.target.value)}
                    placeholder="•••• আপনার 4 ডিজিটের অ্যাকাউন্ট পিন"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 text-center tracking-widest focus:outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full mt-1.5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer text-center"
                >
                  {actionLoading ? 'অনুরোধ পাঠানো হচ্ছে...' : 'স্থানান্তর ভেরিফিকেশন পাঠান'}
                </button>
              </form>
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: NEW DEPOSIT ONLINE ================= */}
        {bottomTab === 'home' && activeSubView === 'new_deposit' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left font-sans"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-2.5xl space-y-4 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                  <Plus className="w-4 h-4 stroke-[3]" />
                  অনলাইন আমানত ও সঞ্চয় কিস্তি জমা পোর্টাল
                </span>
                <span className="text-[9.5px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-0.5 rounded-full">Deposit</span>
              </div>

              {/* Jamadan Sector Info Label */}
              <div className="bg-gradient-to-r from-emerald-50/60 to-teal-50/60 border border-emerald-100 p-3 rounded-xl flex justify-between items-center text-xs font-bold text-teal-800">
                <span>জমাদানের খাতঃ</span>
                <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-md text-[10px] font-black">1. সাধারণ সঞ্চয়</span>
              </div>

              <form onSubmit={handleCoopDepositSubmit} className="space-y-3.5 pt-1.5">
                {formSuccess && <div className="p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] rounded-lg font-bold">{formSuccess}</div>}
                {formError && <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] rounded-lg font-bold">{formError}</div>}

                {/* Current Main Balance Display */}
                <div className="flex justify-between items-center bg-teal-50/30 border border-teal-100 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase">আপনার বর্তমান মেইন ব্যালেন্স</span>
                  <span className="text-xs font-black text-teal-800">৳ {(user.balance || 0).toLocaleString('bn-BD')} BDT</span>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">জমাদানের পরিমাণ (৳ টাকার পরিমাণ)</label>
                  <input
                    type="number"
                    required
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="৳ কত টাকা স্থানান্তর করতে চান লিখুন"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">4 ডিজিটের সিকিউরিটি পিন</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={depositPin}
                    onChange={(e) => setDepositPin(e.target.value)}
                    placeholder="•••• আপনার 4 ডিজিটের অ্যাকাউন্ট পিন"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 text-center tracking-widest focus:outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>

                <div className="p-3 bg-emerald-50/50 border border-emerald-150 rounded-xl text-[9.5px] leading-relaxed text-emerald-850 font-bold italic">
                  🌿 জমাকৃত টাকা আপনার প্রধান বা মেইন ব্যালেন্স থেকে সরাসরি কেটে নিয়ে এই তহবিলে স্থানান্তর করা হবে। এর জন্য কোনো সার্ভিস চার্জ প্রযোজ্য নয় এবং এটি তাৎক্ষণিকভাবে সম্পন্ন হবে।
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full mt-1.5 py-3 bg-gradient-to-r from-teal-700 to-emerald-850 text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer text-center shadow-md shadow-emerald-100"
                >
                  {actionLoading ? 'আমানত স্থানান্তর হচ্ছে...' : 'মেইন ব্যালেন্স থেকে সরাসরি যুক্ত করুন'}
                </button>
              </form>
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= LOCALIZED TRANSACTION HISTORY MODAL ================= */}
        <AnimatePresence>
          {showSectionTxHistory && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans"
            >
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden text-slate-800"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 text-white px-5 py-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    <div>
                      <h3 className="text-sm font-black">সমবায় ও ইনভেস্টর খতিয়ান</h3>
                      <p className="text-[10px] text-teal-100 font-medium">শুধুমাত্র কো-অপারেティブ ও বিনিয়োগ কার্যক্রমের লেনদেন</p>
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
                      placeholder="পরিমাণ, আইডি বা বিবরণ দিয়ে খুঁজুন..."
                      className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-2xl text-xs font-medium focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
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
                    const filteredTxs = userTxHistory.filter(tx => {
                      const isSamityType = ['coop_savings_deposit', 'coop_loan_apply', 'coop_loan_disbursment', 'loan_repayment'].includes(tx.type) ||
                        tx.type === 'coop_savings_deposit' ||
                        tx.type?.includes('coop') ||
                        tx.type?.includes('samity') ||
                        tx.typeLabel?.includes('সঞ্চয়') ||
                        tx.typeLabel?.includes('সমবায়') ||
                        tx.typeLabel?.includes('ডিপিএস') ||
                        tx.typeLabel?.includes('লোন') ||
                        tx.typeLabel?.includes('ঋণ') ||
                        tx.typeLabel?.includes('জরিমানা') ||
                        tx.typeLabel?.includes('শেয়ার') ||
                        tx.description?.includes('সঞ্চয়') ||
                        tx.description?.includes('সমবায়') ||
                        tx.description?.includes('ডিপিএস') ||
                        tx.description?.includes('লোন') ||
                        tx.description?.includes('ঋণ') ||
                        tx.description?.includes('জরিমানা') ||
                        tx.description?.includes('শেয়ার') ||
                        (tx.type === 'deposit' && (tx.typeLabel?.includes('সঞ্চয়') || tx.typeLabel?.includes('ডিপিএস') || tx.description?.includes('সঞ্চয়') || tx.description?.includes('ডিপিএস'))) ||
                        (tx.type === 'withdraw' && (tx.description?.includes('সমবায়') || tx.description?.includes('সঞ্চয়') || tx.typeLabel?.includes('সঞ্চয়') || tx.typeLabel?.includes('সমবায়'))) ||
                        (tx.type === 'fee_payment' && (tx.description?.includes('সমিতি') || tx.description?.includes('ডিপিএস') || tx.description?.includes('জরিমানা') || tx.description?.includes('সার্ভিস')));
                      
                      if (!isSamityType) return false;
                      
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
                          কোনো সমবায় লেনদেন রেকর্ড পাওয়া যায়নি।
                        </div>
                      );
                    }

                    return filteredTxs.map((tx, idx) => {
                      const isCredit = ['coop_savings_deposit', 'deposit'].includes(tx.type) && !tx.description?.includes('উত্তোলন');
                      return (
                        <div 
                          key={`${tx.id}-${idx}`} 
                          onClick={() => openReceiptForTx(tx)}
                          className="p-3 bg-white border border-slate-150 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-2xl shadow-3xs flex justify-between items-start gap-3 cursor-pointer transition active:scale-[0.99]"
                        >
                          <div className="space-y-1 text-left">
                            <span className="text-xs font-black text-slate-800 block">{tx.typeLabel || 'সমবায় সঞ্চয়'}</span>
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
                          <div className="text-right shrink-0">
                            <span className={`text-xs font-black font-mono block ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isCredit ? '+' : '-'} ৳{tx.amount.toLocaleString('bn-BD')}
                            </span>
                            <span className={`inline-block text-[8.5px] font-extrabold px-1.5 py-0.2 mt-1 rounded-md uppercase ${
                              tx.status === 'success' || tx.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              tx.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {tx.status === 'success' || tx.status === 'approved' ? 'সফল' : tx.status === 'pending' ? 'অপেক্ষমাণ' : 'ব্যর্থ'}
                            </span>
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

        {/* Month Payment Modal */}
        <AnimatePresence>
          {selectedPayMonth && (
            <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPayMonth(null)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 text-left z-10"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 flex items-center justify-center font-bold">
                      <PiggyBank className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase">
                        {selectedPayMonth.name} মাসের সঞ্চয় জমা
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold">
                        সমবায় সমিতি কিস্তি পরিশোধ
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPayMonth(null)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-bold">
                    <span>মাসের নাম:</span>
                    <span className="font-black text-emerald-800 dark:text-emerald-300">{selectedPayMonth.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-bold">
                    <span>সঞ্চয় কিস্তি পরিমাণ:</span>
                    <span className="font-black text-emerald-700 font-mono">৳{targetMonthlyRate.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-bold border-t border-emerald-200/60 pt-1.5">
                    <span>আপনার মেইন ব্যালেন্স:</span>
                    <span className="font-black font-mono text-teal-900 dark:text-teal-300">৳{getEffectiveBalance(effectiveUser).toLocaleString('bn-BD')}</span>
                  </div>
                </div>

                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                  💡 আপনি মেইন ব্যালেন্স থেকে <strong className="text-emerald-700">{selectedPayMonth.name}</strong> মাসের কিস্তি ৳{targetMonthlyRate.toLocaleString('bn-BD')} টাকা জমা দিতে নিশ্চিত করুন। জমা সম্পন্ন হলে তা সরাসরি সমবায় সঞ্চয় আমানতে যোগ হবে।
                </p>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPayMonth(null)}
                    className="w-1/2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold rounded-xl text-xs hover:bg-slate-200 transition cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    disabled={monthPayLoading}
                    onClick={handleConfirmMonthPayment}
                    className="w-1/2 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {monthPayLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'জমা নিশ্চিত করুন ⚡'
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 50-Year Multi-Year Calendar & Target Modal (2024 - 2050) */}
        <AnimatePresence>
          {show2050CalendarModal && (
            <div className="fixed inset-0 z-[9995] flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShow2050CalendarModal(false)}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                className="relative bg-white dark:bg-slate-900 border border-emerald-300 dark:border-slate-800 w-full max-w-2xl rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 text-left z-10 max-h-[90vh] flex flex-col"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-emerald-100 dark:border-slate-800 pb-3 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-md">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-1.5">
                        50 সালের রূপকল্প ও সঞ্চয় কিস্তি ক্যালেন্ডার
                        <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-mono font-bold">2026 - 2050</span>
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold">
                        দীর্ঘমেয়াদী সমবায় সমিতি সঞ্চয় লক্ষ্যমাত্রা ও খতিয়ান
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShow2050CalendarModal(false)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Target Progress Overview Box */}
                <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-3.5 rounded-2xl shadow-sm space-y-2 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-700/60 pb-2">
                    <div>
                      <span className="text-[9px] font-extrabold text-emerald-300 uppercase tracking-wider block">50 সালের দীর্ঘমেয়াদী সঞ্চয় লক্ষ্যমাত্রা</span>
                      <h4 className="text-base font-black font-mono text-amber-300">
                        ৳{(300 * targetMonthlyRate).toLocaleString('bn-BD')} টাকা
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-extrabold text-emerald-200 block">মোট সঞ্চিত জমা (আমানত)</span>
                      <h4 className="text-sm font-black font-mono text-emerald-400">
                        ৳{userSavings.toLocaleString('bn-BD')}
                      </h4>
                    </div>
                  </div>

                  {/* Overall 2050 Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-emerald-200">মোট কিস্তি পরিশোধ (2026-2050):</span>
                      <span className="text-amber-300 font-mono">
                        {Math.floor(userSavings / targetMonthlyRate)} / 300 মাস ({((Math.floor(userSavings / targetMonthlyRate) / 300) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-emerald-950/80 rounded-full overflow-hidden border border-emerald-700/50 p-0.5">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-300 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (Math.floor(userSavings / targetMonthlyRate) / 300) * 100)}%` }} 
                      />
                    </div>
                  </div>
                </div>

                {/* 2026 to 2050 Yearly Matrix Scroll Area */}
                <div className="overflow-y-auto space-y-3 pr-1 grow max-h-[50vh]">
                  <p className="text-[10px] text-slate-600 dark:text-slate-300 font-bold">
                    💡 <strong>বছর সিলেক্ট নির্দেশিকা:</strong> যেকোনো বছরে ক্লিক করলে প্রধান স্ক্রিনের কিস্তি ট্র্যাকার সেই বছরে সরাসরি নেভিগেট হবে।
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {SAMITY_YEARS.map(yr => {
                      const isCurrent = yr === new Date().getFullYear();
                      const yrPaidCount = SAMITY_MONTHS.filter((m, idx) => checkIsMonthPaid(m.id, yr, idx)).length;
                      const isSelected = yr === trackerSelectedYear;

                      return (
                        <div
                          key={yr}
                          onClick={() => {
                            setTrackerSelectedYear(yr);
                            setShow2050CalendarModal(false);
                          }}
                          className={`p-3 rounded-2xl border transition cursor-pointer text-left space-y-2 ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-400 shadow-md'
                              : yrPaidCount === 12
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/40'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
                            <span className="text-xs font-black font-mono text-slate-900 dark:text-white flex items-center gap-1.5">
                              📅 {yr} সালের কিস্তি {isCurrent ? <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-sans">চলতি</span> : null}
                            </span>
                            <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full font-mono ${
                              yrPaidCount === 12
                                ? 'bg-emerald-600 text-white'
                                : yrPaidCount > 0
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}>
                              {yrPaidCount} / 12 মাস পরিশোধিত
                            </span>
                          </div>

                          {/* 12 Month Dots Matrix */}
                          <div className="grid grid-cols-6 gap-1 pt-0.5">
                            {SAMITY_MONTHS.map((m, idx) => {
                              const mPaid = checkIsMonthPaid(m.id, yr, idx);

                              return (
                                <div
                                  key={m.id}
                                  title={`${m.name} ${yr}: ${mPaid ? 'পরিশোধিত' : 'বকেয়া'}`}
                                  className={`p-1 rounded-lg text-center text-[8.5px] font-black truncate ${
                                    mPaid
                                      ? 'bg-emerald-600 text-white shadow-3xs'
                                      : 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                                  }`}
                                >
                                  {m.short}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setShow2050CalendarModal(false)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Beautiful Custom Popup/Alert Modal */}
        <AnimatePresence>
          {customAlert && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setCustomAlert(null)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
              />
              
              {/* Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl overflow-hidden text-center space-y-4"
              >
                {/* Colored Accent Top Strip */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-teal-500 via-amber-500 to-indigo-500" />
                
                {/* Visual Icon Badge */}
                <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Bell className="w-6 h-6 stroke-[2]" />
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    {customAlert.title || "বিজ্ঞপ্তি"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed px-1">
                    {customAlert.message}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setCustomAlert(null)}
                    className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black rounded-2xl shadow-md shadow-teal-700/10 transition active:scale-95 cursor-pointer"
                  >
                    ঠিক আছে
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Custom Confirmation / Prompt Modal */}
        <AnimatePresence>
          {confirmState && confirmState.isOpen && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (confirmState.onCancel) confirmState.onCancel();
                  setConfirmState(null);
                }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
              />

              {/* Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-left"
              >
                <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-500" />

                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                  {confirmState.title}
                </h3>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                  {confirmState.description}
                </p>

                {confirmState.requireInput && (
                  <div className="mt-3">
                    <input
                      type="text"
                      defaultValue={confirmState.inputValue || ''}
                      id="custom-confirm-input"
                      className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold text-slate-900 dark:text-white"
                      placeholder={confirmState.inputPlaceholder || 'কারণ লিখুন...'}
                      onChange={(e) => {
                        confirmState.inputValue = e.target.value;
                      }}
                    />
                  </div>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmState.onCancel) confirmState.onCancel();
                      setConfirmState(null);
                    }}
                    className="flex-1 py-3 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 text-xs font-black rounded-2xl transition active:scale-95 cursor-pointer text-center"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const inputVal = confirmState.requireInput 
                        ? (document.getElementById('custom-confirm-input') as HTMLInputElement)?.value 
                        : undefined;
                      const callback = confirmState.onConfirm;
                      setConfirmState(null);
                      setTimeout(() => {
                        callback(inputVal);
                      }, 0);
                    }}
                    className="flex-grow py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl shadow-md shadow-emerald-600/10 transition active:scale-95 cursor-pointer text-center"
                  >
                    নিশ্চিত করুন
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Secure PIN Prompt Modal for Samity Scheme Toggle */}
        <AnimatePresence>
          {samityPinPrompt !== 'none' && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setSamityPinPrompt('none');
                  setSamityPinInput('');
                }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
              />

              {/* Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-left font-sans"
              >
                {/* Accent Top Strip */}
                <div className={`absolute top-0 inset-x-0 h-1.5 ${
                  samityPinPrompt === 'close' ? 'bg-rose-500' : 'bg-emerald-500'
                }`} />

                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 animate-pulse ${
                      samityPinPrompt === 'close' ? 'bg-rose-500' : 'bg-emerald-500'
                    }`} />
                    সিকিউরিটি পিন যাচাই করুন
                  </h3>
                  <p className="text-xs text-slate-500 font-bold leading-normal">
                    {samityPinPrompt === 'close' && 'আপনার মাসিক বিনিয়োগ স্কিমটি সাময়িকভাবে বন্ধ করতে সিকিউরিটি পিন প্রবেশ করুন। এটি বন্ধ করলে মাসিক অটো-ডেবিট বন্ধ হবে।'}
                    {samityPinPrompt === 'active' && 'আপনার মাসিক বিনিয়োগ স্কিমটি পুনরায় সচল করতে সিকিউরিটি পিন প্রবেশ করুন।'}
                    {samityPinPrompt === 'pay_reactivate' && `আপনার বকেয়া ${user.dueMonths || 1} মাসের কিস্তি (৳${((user.monthlySavingsTarget || 500) * (user.dueMonths || 1)).toLocaleString('bn-BD')} BDT) পরিশোধ করে স্কিম সচল করতে সিকিউরিটি পিন প্রবেশ করুন।`}
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[10.5px] text-slate-500 font-extrabold mb-1 uppercase tracking-wider">4 ডিজিটের পিন কোড</label>
                    <input
                      type="password"
                      maxLength={4}
                      pattern="\d*"
                      value={samityPinInput}
                      onChange={(e) => setSamityPinInput(e.target.value.replace(/\D/g, ''))}
                      className="block w-full text-center tracking-[1em] font-mono py-3 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-lg font-black text-slate-900 placeholder:tracking-normal placeholder:text-sm placeholder:font-sans"
                      placeholder="••••"
                    />
                  </div>
                </div>

                {/* Confirm/Cancel Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSamityPinPrompt('none');
                      setSamityPinInput('');
                    }}
                    className="flex-1 py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs font-black rounded-2xl transition active:scale-95 cursor-pointer text-center"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (samityPinPrompt === 'close') {
                        handleDeactivateScheme();
                      } else if (samityPinPrompt === 'active') {
                        handleReactivateScheme();
                      } else if (samityPinPrompt === 'pay_reactivate') {
                        handlePayArrearsAndReactivate();
                      }
                    }}
                    disabled={actionLoading || samityPinInput.length < 4}
                    className={`flex-grow py-3 px-4 text-white text-xs font-black rounded-2xl shadow-md transition active:scale-95 cursor-pointer text-center disabled:opacity-40 disabled:pointer-events-none ${
                      samityPinPrompt === 'close' 
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10' 
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10'
                    }`}
                  >
                    {actionLoading ? 'যাচাই হচ্ছে...' : 'নিশ্চিত করুন'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Helpline WhatsApp Modal */}
        <AnimatePresence>
          {showHelplineModal && (
            <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHelplineModal(false)}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-left z-10 overflow-hidden"
              >
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">অফিসিয়াল হেল্পলাইন সেবা</h3>
                      <p className="text-[10px] text-slate-500 font-bold">BNB সমবায় সমিতি ও কাস্টমার সাপোর্ট</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHelplineModal(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2 text-center">
                  <span className="text-[10.5px] font-black text-emerald-900 uppercase tracking-tight block">
                    WhatsApp হেল্পলাইন ও সাপোর্ট নম্বর
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl font-black font-mono text-emerald-950 tracking-wider">
                      01865911728
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('01865911728');
                        setCopySuccess('কপি হয়েছে!');
                        setTimeout(() => setCopySuccess(''), 2500);
                      }}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-3xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copySuccess || 'কপি করুন'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <a
                    href="https://wa.me/8801865911728"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-2xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>WhatsApp-এ সরাসরি মেসেজ দিন</span>
                  </a>
                  <a
                    href="tel:01865911728"
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-xs font-extrabold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-slate-600" />
                    <span>সরাসরি কল দিন (01865911728)</span>
                  </a>
                </div>

                <p className="text-[10px] text-slate-400 text-center font-semibold">
                  সাপ্তাহিক 7 দিন সকাল 9:00 টা থেকে রাত 10:00 টা পর্যন্ত সাপোর্ট খোলা থাকবে।
                </p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ================= MODAL 0: OWNER MODAL (🔴 ওনার — Red) ================= */}
        <AnimatePresence>
          {activeTopModal === 'owner' && (
            <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveTopModal('none')}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                className="relative bg-white border border-rose-300 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3.5 text-left z-10 overflow-hidden max-h-[90vh] overflow-y-auto"
              >
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-800" />

                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg font-black border border-rose-200">
                      🔴
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">
                        {getMembershipCategory(effectiveUser).key === 'owner'
                          ? 'আপনার ওনার সদস্য একাউন্ট'
                          : '🔴 ওনার সদস্য পদবী ও শর্তাবলী'}
                      </h3>
                      <p className="text-[10px] text-rose-700 font-bold">মাসিক ৳৪,০০০ | ৩ মাসে ৳১০,০০০ | নমিনি ৩ জন</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTopModal('none')}
                    className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Rules Banner */}
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-black text-rose-950 text-[11px]">
                    <span>📌 ওনার সদস্য নিয়মাবলীঃ</span>
                    <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded font-mono">Red ক্যাটাগরি</span>
                  </div>
                  <ul className="space-y-1 text-[10.5px] font-semibold text-rose-900 leading-tight">
                    <li>• <strong>মাসিক কিস্তি:</strong> ৳৪,০০০ (১-১০ তারিখ নিজস্ব পেমেন্ট সময়, ১১ তারিখ অটো পেমেন্ট, ১৫ তারিখ শেষ সময়)</li>
                    <li>• <strong>৩ মাস পর পর কিস্তি:</strong> ৳১০,০০০ (বছরে ৪ কিস্তি: জানুয়ারি, এপ্রিল, জুলাই, অক্টোবর)</li>
                    <li>• <strong>কিস্তির মাস:</strong> জানুয়ারি • এপ্রিল • জুলাই • অক্টোবর</li>
                    <li>• <strong>নমিনি:</strong> ফর্মে সর্বোচ্চ ৩ জনের নাম দিতে পারবেন।</li>
                  </ul>
                </div>

                {/* Nominee Management for Owner (Max 3 Nominees) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 text-[11px] flex items-center gap-1">
                      <span>👥</span> মনোনীত নমিনি তালিকা ({Array.isArray(effectiveUser.nominees) ? effectiveUser.nominees.length : (effectiveUser.nomineeName ? 1 : 0)} / ৩ জন)
                    </span>
                    <span className="text-[9px] font-bold text-rose-700">সর্বোচ্চ ৩ জন</span>
                  </div>

                  {Array.isArray(effectiveUser.nominees) && effectiveUser.nominees.length > 0 ? (
                    <div className="space-y-1.5">
                      {effectiveUser.nominees.map((nom, nIdx) => (
                        <div key={nom.id || nIdx} className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between text-[10.5px]">
                          <div>
                            <div className="font-black text-slate-900">{nIdx + 1}. {nom.name} {nom.relation ? `(${nom.relation})` : ''}</div>
                            <div className="text-[9px] text-slate-500 font-mono">মোবাইল: {nom.phone || 'N/A'} | এনআইডি: {nom.nid || 'N/A'}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteNominee(nIdx)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="নমিনি মুছুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : effectiveUser.nomineeName ? (
                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between text-[10.5px]">
                      <div>
                        <div className="font-black text-slate-900">১. {effectiveUser.nomineeName} ({effectiveUser.nomineeRelation || 'নমিনি'})</div>
                        <div className="text-[9px] text-slate-500 font-mono">মোবাইল: {effectiveUser.nomineePhone || 'N/A'} | সম্পর্ক: {effectiveUser.nomineeRelation || 'N/A'}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic">এখনো কোনো নমিনি যুক্ত করা হয়নি। নিচে নাম দিন।</p>
                  )}

                  {/* Add nominee form if below 3 */}
                  {(Array.isArray(effectiveUser.nominees) ? effectiveUser.nominees.length : (effectiveUser.nomineeName ? 1 : 0)) < 3 && (
                    <div className="pt-1.5 border-t border-slate-200/80 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-700 block">+ নতুন নমিনির তথ্য দিনঃ</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={nomineeInputName}
                          onChange={(e) => setNomineeInputName(e.target.value)}
                          placeholder="নমিনির নাম *"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-900"
                        />
                        <input
                          type="text"
                          value={nomineeInputRelation}
                          onChange={(e) => setNomineeInputRelation(e.target.value)}
                          placeholder="সম্পর্ক (যেমন: স্ত্রী/পুত্র)"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-900"
                        />
                        <input
                          type="tel"
                          value={nomineeInputPhone}
                          onChange={(e) => setNomineeInputPhone(e.target.value)}
                          placeholder="মোবাইল নম্বর"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-900"
                        />
                        <input
                          type="text"
                          value={nomineeInputNid}
                          onChange={(e) => setNomineeInputNid(e.target.value)}
                          placeholder="জাতীয় পরিচয়পত্র (NID)"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-900"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={savingNominees || !nomineeInputName.trim()}
                        onClick={() => handleSaveNominee({
                          name: nomineeInputName.trim(),
                          relation: nomineeInputRelation.trim(),
                          phone: nomineeInputPhone.trim(),
                          nid: nomineeInputNid.trim()
                        })}
                        className="w-full py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-black text-[10px] rounded-lg transition disabled:opacity-40 cursor-pointer shadow-3xs"
                      >
                        {savingNominees ? 'সংরক্ষণ হচ্ছে...' : '➕ নমিনি যুক্ত করুন'}
                      </button>
                    </div>
                  )}
                </div>

                {getMembershipCategory(effectiveUser).key === 'owner' ? (
                  <div className="space-y-3">
                    <div className="bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 p-3 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-rose-900">পদবী স্থিতি</span>
                        <span className="px-2 py-0.5 bg-rose-600 text-white text-[9.5px] font-black rounded-lg">🔴 সক্রিয় ওনার সদস্য</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center pt-1">
                        <div className="bg-white p-2 rounded-xl border border-rose-200/80 shadow-3xs">
                          <span className="text-[9px] font-bold text-slate-500 block">মাসিক কিস্তি</span>
                          <span className="text-xs font-black text-rose-700">৳৪,০০০/মাস</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-rose-200/80 shadow-3xs">
                          <span className="text-[9px] font-bold text-slate-500 block">ত্রৈমাসিক কিস্তি (৪ বার)</span>
                          <span className="text-xs font-black text-emerald-700">৳১০,০০০/কিস্তি</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTopModal('none')}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition shadow-md shadow-rose-600/20 cursor-pointer"
                    >
                      ঠিক আছে, বুঝেছি 👍
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleUpgradeToOwner} className="space-y-3">
                    <label className="flex items-start gap-2 p-2.5 bg-rose-50/70 border border-rose-200 rounded-xl cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={ownerAgree}
                        onChange={(e) => setOwnerAgree(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 shrink-0 cursor-pointer"
                      />
                      <span className="text-[10px] font-black text-rose-950 leading-tight">
                        আমি ওনার হিসেবে মাসিক ৳৪,০০০ সঞ্চয় এবং ৩ মাস পর পর ৳১০,০০০ কিস্তি (জানুয়ারি, এপ্রিল, জুলাই, অক্টোবর) প্রদানে সম্পূর্ণ একমত এবং সম্মতি জ্ঞাপন করছি।
                      </span>
                    </label>

                    <div>
                      <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                        আপনার 4 ডিজিটের সিকিউরিটি পিন কোড *
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        pattern="\d*"
                        required
                        value={ownerUpgradePin}
                        onChange={(e) => setOwnerUpgradePin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full text-center tracking-[0.5em] font-mono py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-base font-black text-slate-900"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTopModal('none')}
                        className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        disabled={ownerUpgrading || !ownerAgree || ownerUpgradePin.length < 4}
                        className="w-2/3 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-black text-xs rounded-xl transition shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                      >
                        {ownerUpgrading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          '🔴 ওনার সদস্য নিশ্চিত করুন'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ================= MODAL 1: SHAREHOLDER MODAL (🔵 শেয়ার হোল্ডার — Blue) ================= */}
        <AnimatePresence>
          {activeTopModal === 'shareholder' && (
            <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveTopModal('none')}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                className="relative bg-white border border-blue-300 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3.5 text-left z-10 overflow-hidden max-h-[90vh] overflow-y-auto"
              >
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800" />

                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-lg font-black border border-blue-200">
                      🔵
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">
                        {getMembershipCategory(effectiveUser).key === 'shareholder'
                          ? 'আপনার শেয়ার হোল্ডার একাউন্ট'
                          : '🔵 শেয়ার হোল্ডার পদবী ও শর্তাবলী'}
                      </h3>
                      <p className="text-[10px] text-blue-700 font-bold">মাসিক ৳২,০০০ | ৩ মাসে ৳৫,০০০ | নমিনি ২ জন</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTopModal('none')}
                    className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Rules Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-black text-blue-950 text-[11px]">
                    <span>📌 শেয়ার হোল্ডার নিয়মাবলীঃ</span>
                    <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded font-mono">Blue ক্যাটাগরি</span>
                  </div>
                  <ul className="space-y-1 text-[10.5px] font-semibold text-blue-900 leading-tight">
                    <li>• <strong>মাসিক কিস্তি:</strong> ৳২,০০০ (১-১০ তারিখ নিজস্ব পেমেন্ট সময়, ১১ তারিখ অটো পেমেন্ট, ১৫ তারিখ শেষ সময়)</li>
                    <li>• <strong>৩ মাস পর পর কিস্তি:</strong> ৳৫,০০০ (বছরে ৪ কিস্তি: জানুয়ারি, এপ্রিল, জুলাই, অক্টোবর)</li>
                    <li>• <strong>কিস্তির মাস:</strong> জানুয়ারি • এপ্রিল • জুলাই • অক্টোবর</li>
                    <li>• <strong>নমিনি:</strong> ফর্মে সর্বোচ্চ ২ জনের নাম দিতে পারবেন।</li>
                  </ul>
                </div>

                {/* Nominee Management for Shareholder (Max 2 Nominees) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 text-[11px] flex items-center gap-1">
                      <span>👥</span> মনোনীত নমিনি তালিকা ({Array.isArray(effectiveUser.nominees) ? effectiveUser.nominees.length : (effectiveUser.nomineeName ? 1 : 0)} / ২ জন)
                    </span>
                    <span className="text-[9px] font-bold text-amber-700">সর্বোচ্চ ২ জন</span>
                  </div>

                  {Array.isArray(effectiveUser.nominees) && effectiveUser.nominees.length > 0 ? (
                    <div className="space-y-1.5">
                      {effectiveUser.nominees.map((nom, nIdx) => (
                        <div key={nom.id || nIdx} className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between text-[10.5px]">
                          <div>
                            <div className="font-black text-slate-900">{nIdx + 1}. {nom.name} {nom.relation ? `(${nom.relation})` : ''}</div>
                            <div className="text-[9px] text-slate-500 font-mono">মোবাইল: {nom.phone || 'N/A'} | এনআইডি: {nom.nid || 'N/A'}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteNominee(nIdx)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="নমিনি মুছুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : effectiveUser.nomineeName ? (
                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between text-[10.5px]">
                      <div>
                        <div className="font-black text-slate-900">১. {effectiveUser.nomineeName} ({effectiveUser.nomineeRelation || 'নমিনি'})</div>
                        <div className="text-[9px] text-slate-500 font-mono">মোবাইল: {effectiveUser.nomineePhone || 'N/A'} | সম্পর্ক: {effectiveUser.nomineeRelation || 'N/A'}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic">এখনো কোনো নমিনি যুক্ত করা হয়নি। নিচে নাম দিন।</p>
                  )}

                  {/* Add nominee form if below 2 */}
                  {(Array.isArray(effectiveUser.nominees) ? effectiveUser.nominees.length : (effectiveUser.nomineeName ? 1 : 0)) < 2 && (
                    <div className="pt-1.5 border-t border-slate-200/80 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-700 block">+ নতুন নমিনির তথ্য দিনঃ</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={nomineeInputName}
                          onChange={(e) => setNomineeInputName(e.target.value)}
                          placeholder="নমিনির নাম *"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-900"
                        />
                        <input
                          type="text"
                          value={nomineeInputRelation}
                          onChange={(e) => setNomineeInputRelation(e.target.value)}
                          placeholder="সম্পর্ক (যেমন: স্ত্রী/পুত্র)"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-900"
                        />
                        <input
                          type="tel"
                          value={nomineeInputPhone}
                          onChange={(e) => setNomineeInputPhone(e.target.value)}
                          placeholder="মোবাইল নম্বর"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-900"
                        />
                        <input
                          type="text"
                          value={nomineeInputNid}
                          onChange={(e) => setNomineeInputNid(e.target.value)}
                          placeholder="জাতীয় পরিচয়পত্র (NID)"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-900"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={savingNominees || !nomineeInputName.trim()}
                        onClick={() => handleSaveNominee({
                          name: nomineeInputName.trim(),
                          relation: nomineeInputRelation.trim(),
                          phone: nomineeInputPhone.trim(),
                          nid: nomineeInputNid.trim()
                        })}
                        className="w-full py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-black text-[10px] rounded-lg transition disabled:opacity-40 cursor-pointer shadow-3xs"
                      >
                        {savingNominees ? 'সংরক্ষণ হচ্ছে...' : '➕ নমিনি যুক্ত করুন'}
                      </button>
                    </div>
                  )}
                </div>

                {getMembershipCategory(effectiveUser).key === 'shareholder' ? (
                  <div className="space-y-3">
                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 p-3 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-amber-900">পদবী স্থিতি</span>
                        <span className="px-2 py-0.5 bg-amber-600 text-white text-[9.5px] font-black rounded-lg">🟡 সক্রিয় শেয়ার হোল্ডার</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center pt-1">
                        <div className="bg-white p-2 rounded-xl border border-amber-200/80 shadow-3xs">
                          <span className="text-[9px] font-bold text-slate-500 block">মাসিক কিস্তি</span>
                          <span className="text-xs font-black text-amber-800">৳২,০০০/মাস</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-amber-200/80 shadow-3xs">
                          <span className="text-[9px] font-bold text-slate-500 block">ত্রৈমাসিক কিস্তি (৪ বার)</span>
                          <span className="text-xs font-black text-emerald-700">৳৫,০০০/কিস্তি</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTopModal('none')}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition shadow-md shadow-amber-600/20 cursor-pointer"
                    >
                      ঠিক আছে, বুঝেছি 👍
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleUpgradeToShareholder} className="space-y-3">
                    <label className="flex items-start gap-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={shareholderAgree}
                        onChange={(e) => setShareholderAgree(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 shrink-0 cursor-pointer"
                      />
                      <span className="text-[10px] font-black text-amber-950 leading-tight">
                        আমি শেয়ার হোল্ডার হিসেবে মাসিক ৳২,০০০ সঞ্চয় এবং ৩ মাস পর পর ৳৫,০০০ কিস্তি (জানুয়ারি, এপ্রিল, জুলাই, অক্টোবর) প্রদানে সম্পূর্ণ একমত এবং সম্মতি জ্ঞাপন করছি।
                      </span>
                    </label>

                    <div>
                      <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                        আপনার 4 ডিজিটের সিকিউরিটি পিন কোড *
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        pattern="\d*"
                        required
                        value={shareholderUpgradePin}
                        onChange={(e) => setShareholderUpgradePin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full text-center tracking-[0.5em] font-mono py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-base font-black text-slate-900"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTopModal('none')}
                        className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        disabled={shareholderUpgrading || !shareholderAgree || shareholderUpgradePin.length < 4}
                        className="w-2/3 py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black text-xs rounded-xl transition shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                      >
                        {shareholderUpgrading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          '🟡 শেয়ার হোল্ডার নিশ্চিত করুন'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ================= MODAL 2: INVESTOR MODAL (🟢 ইনভেস্টার — Green) ================= */}
        <AnimatePresence>
          {activeTopModal === 'investor' && (
            <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveTopModal('none')}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                className="relative bg-white border border-emerald-300 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3.5 text-left z-10 overflow-hidden max-h-[90vh] overflow-y-auto"
              >
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-800" />

                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg font-black border border-emerald-200">
                      🟢
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">
                        {getMembershipCategory(effectiveUser).key === 'investor'
                          ? 'আপনার ইনভেস্টার একাউন্ট'
                          : '🟢 ইনভেস্টার সদস্য পদবী ও শর্তাবলী'}
                      </h3>
                      <p className="text-[10px] text-emerald-700 font-bold">মাসিক ৳১,০০০ | ৩ মাসে কিস্তি নেই | নমিনি ১ জন</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTopModal('none')}
                    className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Rules Banner */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-black text-emerald-950 text-[11px]">
                    <span>📌 ইনভেস্টার সদস্য নিয়মাবলীঃ</span>
                    <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.2 rounded font-mono">Green ক্যাটাগরি</span>
                  </div>
                  <ul className="space-y-1 text-[10.5px] font-semibold text-emerald-900 leading-tight">
                    <li>• <strong>মাসিক কিস্তি:</strong> ৳১,০০০ (১-১০ তারিখ নিজস্ব পেমেন্ট সময়, ১১ তারিখ অটো পেমেন্ট, ১৫ তারিখ শেষ সময়)</li>
                    <li>• <strong>৩ মাস পর পর কিস্তি:</strong> কোনো অতিরিক্ত কিস্তি নেই।</li>
                    <li>• <strong>নমিনি:</strong> ফর্মে সর্বোচ্চ ১ জনের নাম দিতে পারবেন।</li>
                  </ul>
                </div>

                {/* Nominee Management for Investor (Max 1 Nominee) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 text-[11px] flex items-center gap-1">
                      <span>👥</span> মনোনীত নমিনি ({Array.isArray(effectiveUser.nominees) ? effectiveUser.nominees.length : (effectiveUser.nomineeName ? 1 : 0)} / ১ জন)
                    </span>
                    <span className="text-[9px] font-bold text-slate-600">সর্বোচ্চ ১ জন</span>
                  </div>

                  {Array.isArray(effectiveUser.nominees) && effectiveUser.nominees.length > 0 ? (
                    <div className="space-y-1.5">
                      {effectiveUser.nominees.map((nom, nIdx) => (
                        <div key={nom.id || nIdx} className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between text-[10.5px]">
                          <div>
                            <div className="font-black text-slate-900">১. {nom.name} {nom.relation ? `(${nom.relation})` : ''}</div>
                            <div className="text-[9px] text-slate-500 font-mono">মোবাইল: {nom.phone || 'N/A'} | এনআইডি: {nom.nid || 'N/A'}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteNominee(nIdx)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="নমিনি মুছুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : effectiveUser.nomineeName ? (
                    <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between text-[10.5px]">
                      <div>
                        <div className="font-black text-slate-900">১. {effectiveUser.nomineeName} ({effectiveUser.nomineeRelation || 'নমিনি'})</div>
                        <div className="text-[9px] text-slate-500 font-mono">মোবাইল: {effectiveUser.nomineePhone || 'N/A'} | সম্পর্ক: {effectiveUser.nomineeRelation || 'N/A'}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic">এখনো কোনো নমিনি যুক্ত করা হয়নি। নিচে নাম দিন।</p>
                  )}

                  {/* Add nominee form if below 1 */}
                  {(Array.isArray(effectiveUser.nominees) ? effectiveUser.nominees.length : (effectiveUser.nomineeName ? 1 : 0)) < 1 && (
                    <div className="pt-1.5 border-t border-slate-200/80 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-700 block">+ নমিনির তথ্য দিনঃ</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <input
                          type="text"
                          value={nomineeInputName}
                          onChange={(e) => setNomineeInputName(e.target.value)}
                          placeholder="নমিনির নাম *"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-900"
                        />
                        <input
                          type="text"
                          value={nomineeInputRelation}
                          onChange={(e) => setNomineeInputRelation(e.target.value)}
                          placeholder="সম্পর্ক *"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-900"
                        />
                        <input
                          type="tel"
                          value={nomineeInputPhone}
                          onChange={(e) => setNomineeInputPhone(e.target.value)}
                          placeholder="মোবাইল নম্বর *"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-900"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={savingNominees || !nomineeInputName.trim()}
                        onClick={() => handleSaveNominee({
                          name: nomineeInputName.trim(),
                          relation: nomineeInputRelation.trim(),
                          phone: nomineeInputPhone.trim(),
                          nid: ''
                        })}
                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-[10px] rounded-lg transition disabled:opacity-40 cursor-pointer shadow-3xs"
                      >
                        {savingNominees ? 'সংরক্ষণ হচ্ছে...' : '➕ নমিনি যুক্ত করুন'}
                      </button>
                    </div>
                  )}
                </div>

                {getMembershipCategory(effectiveUser).key === 'investor' ? (
                  <div className="space-y-3">
                    <div className="bg-gradient-to-r from-slate-100 to-slate-200 border border-slate-300 p-3 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-slate-900">পদবী স্থিতি</span>
                        <span className="px-2 py-0.5 bg-slate-800 text-white text-[9.5px] font-black rounded-lg">⚪ সক্রিয় ইনভেস্টার সদস্য</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center pt-1">
                        <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-3xs">
                          <span className="text-[9px] font-bold text-slate-500 block">মাসিক কিস্তি</span>
                          <span className="text-xs font-black text-slate-800">৳১,০০০/মাস</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-3xs">
                          <span className="text-[9px] font-bold text-slate-500 block">ত্রৈমাসিক অতিরিক্ত</span>
                          <span className="text-xs font-black text-slate-600">কোনো কিস্তি নেই</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTopModal('none')}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
                    >
                      ঠিক আছে, বুঝেছি 👍
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleUpgradeToInvestor} className="space-y-3">
                    <label className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={investorAgree}
                        onChange={(e) => setInvestorAgree(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-slate-700 focus:ring-slate-500 border-slate-300 shrink-0 cursor-pointer"
                      />
                      <span className="text-[10px] font-black text-slate-900 leading-tight">
                        আমি ইনভেস্টার হিসেবে মাসিক ৳১,০০০ নিয়মিত সঞ্চয় কিস্তি প্রদানে সম্পূর্ণ একমত এবং সম্মতি জ্ঞাপন করছি।
                      </span>
                    </label>

                    <div>
                      <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                        আপনার 4 ডিজিটের সিকিউরিটি পিন কোড *
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        pattern="\d*"
                        required
                        value={investorUpgradePin}
                        onChange={(e) => setInvestorUpgradePin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full text-center tracking-[0.5em] font-mono py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-base font-black text-slate-900"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTopModal('none')}
                        className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        disabled={investorUpgrading || !investorAgree || investorUpgradePin.length < 4}
                        className="w-2/3 py-2.5 bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white font-black text-xs rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                      >
                        {investorUpgrading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          '⚪ ইনভেস্টার নিশ্চিত করুন'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ================= MODAL 3: EXIT / AUTO-SAVINGS SWITCH MODAL ================= */}
        <AnimatePresence>
          {activeTopModal === 'exit_switch' && (
            <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveTopModal('none')}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                className="relative bg-white border border-amber-200 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 text-left z-10 overflow-hidden max-h-[90vh] overflow-y-auto"
              >
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-black">
                      🔄
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">সমিতি সঞ্চয় নিয়ন্ত্রণ ও সুইচ</h3>
                      <p className="text-[10px] text-amber-700 font-bold">এডমিনের অনুমতি ছাড়াই তাৎক্ষণিক নিয়ন্ত্রণ</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTopModal('none')}
                    className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Current Status Card */}
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-700">বর্তমান সুইচ অবস্থা:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                      samityAutoSavingsActive
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {samityAutoSavingsActive ? '🟢 সচল (ON)' : '🔴 বন্ধ (OFF)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                    <span className="font-bold text-slate-500">মোট সঞ্চিত আমানত:</span>
                    <strong className="font-mono text-xs font-black text-slate-900">৳{userSavings.toLocaleString('bn-BD')}</strong>
                  </div>
                </div>

                {/* Policy Banner */}
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[10px] text-amber-950 font-bold leading-relaxed space-y-1.5">
                  <p>
                    📢 <strong>25শে ডিসেম্বর স্বয়ংক্রিয় অর্থ ফেরত নীতিঃ</strong> যদি আপনি সমিতিতে আর কিস্তি বা সঞ্চয় দিতে না চান বা লিভ নিতে চান, তবে নিজে নিজেই সুইচটি বন্ধ (OFF) করতে পারবেন—<strong>কোনো এডমিন অনুমোদনের প্রয়োজন নেই।</strong>
                  </p>
                  <p className="text-rose-800 font-black">
                    🔔 সুইচ অফ করলেই এডমিন প্যানেলে স্বয়ংক্রিয় নোটিফিকেশন চলে যাবে এবং আগামী <strong>25শে ডিসেম্বর</strong> আপনার জমাকৃত সম্পূর্ণ <strong>৳{userSavings.toLocaleString('bn-BD')}</strong> টাকা কোনো কর্তন ছাড়াই আপনার মেইন ব্যালেন্সে স্বয়ংক্রিয়ভাবে ফেরত প্রদান করা হবে।
                  </p>
                </div>

                {samityAutoSavingsActive ? (
                  // FORM TO TURN SWITCH OFF
                  <form onSubmit={handleToggleAutoSavingsOff} className="space-y-3">
                    <div>
                      <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                        সঞ্চয় বন্ধ বা লিভ নেওয়ার কারণ লিখুন *
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={switchOffReason}
                        onChange={(e) => setSwitchOffReason(e.target.value)}
                        placeholder="যেমন: ব্যক্তিগত প্রয়োজনে সাময়িকভাবে কিস্তি বন্ধ রাখতে চাচ্ছি..."
                        className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                        আপনার 4 ডিজিটের সিকিউরিটি পিন কোড *
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        pattern="\d*"
                        required
                        value={switchSecurityPin}
                        onChange={(e) => setSwitchSecurityPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full text-center tracking-[0.5em] font-mono py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-base font-black text-slate-900"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTopModal('none')}
                        className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        disabled={switchSubmitting || switchSecurityPin.length < 4 || !switchOffReason.trim()}
                        className="w-2/3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                      >
                        {switchSubmitting ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          '⏸️ সুইচ অফ (বন্ধ) করুন'
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  // FORM TO TURN SWITCH BACK ON
                  <form onSubmit={handleToggleAutoSavingsOn} className="space-y-3">
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-[10.5px] text-emerald-950 font-bold leading-relaxed">
                      💡 <strong>পুনরায় সচলকরণ:</strong> সুইচ অন করলে আপনার মাসিক সঞ্চয় আবার নিয়মিত সচল হবে এবং লভ্যাংশের অংশ সক্রিয় থাকবে।
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                        সঞ্চয় পুনরায় সচল (ON) করার কারণ লিখুন *
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={switchOnReason}
                        onChange={(e) => setSwitchOnReason(e.target.value)}
                        placeholder="যেমন: সাময়িক সমস্যা সমাধান হয়েছে, পুনরায় নিয়মিত সঞ্চয় কিস্তি চালু করতে চাচ্ছি..."
                        className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                        আপনার 4 ডিজিটের সিকিউরিটি পিন কোড *
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        pattern="\d*"
                        required
                        value={switchSecurityPin}
                        onChange={(e) => setSwitchSecurityPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full text-center tracking-[0.5em] font-mono py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base font-black text-slate-900"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTopModal('none')}
                        className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        disabled={switchSubmitting || switchSecurityPin.length < 4 || !switchOnReason.trim()}
                        className="w-2/3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                      >
                        {switchSubmitting ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          '🔄 সুইচ অন (সচল) করুন'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      {/* Full-Screen BNB Payment Receipt Modal */}
      <BNBPaymentReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        data={receiptModalData}
        appLogo={appConfig?.logoUrl || "/bnb_logo.png"}
      />

      </div>

    </div>
  );
});

export default SamityScreen;
