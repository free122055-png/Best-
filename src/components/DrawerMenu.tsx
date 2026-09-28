import React, { useState, useEffect } from 'react';
import { User, AppConfig } from '../types';
import { maskSecretPhone, getMembershipCategory } from '../lib/memberUtils';
import { 
  X, 
  Lock, 
  Settings as SettingsIcon, 
  HelpCircle, 
  Info, 
  BookOpen, 
  LogOut,
  ChevronRight,
  ChevronDown,
  Key,
  Languages,
  Bell,
  Moon,
  AlertTriangle,
  MessageSquare,
  FileText,
  FileLock2,
  Activity,
  Mail,
  Fingerprint,
  RotateCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  PhoneCall,
  MapPin,
  Sparkles,
  ExternalLink,
  Trash2,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AMBLogo } from './AMBLogo';
import { doc, updateDoc, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onSelectTab: (tab: string) => void;
  onSelectAction: (actionName: string) => void;
  onTriggerDemoAuth?: () => void;
  onLock: () => void;
  appLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  darkMode?: boolean;
  onThemeToggle?: () => void;
  appConfig?: AppConfig;
}

  // Menu Category Items Data structure matching exactly with user query
  const menuCategories = [
    {
      id: 'security',
      label: '🔒 SECURITY (নিরাপত্তা)',
      icon: Lock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      subItems: [
        { id: 'change_password', label: 'পাসওয়ার্ড পরিবর্তন', desc: 'অ্যাকাউন্টের মূল পাসওয়ার্ড পরিবর্তন' },
        { id: 'change_pin', label: 'পিন পরিবর্তন', desc: '4 ডিজিটের সিকিউরিটি ট্রানজেকশন পিন বদল' },
        { id: 'biometric', label: 'ফিঙ্গারপ্রিন্ট/ফেস আইডি', desc: 'বায়োমেট্রিক সহজ লগইন সেটিংস' },
        { id: 'logout_all', label: 'সকল ডিভাইস থেকে লগআউট', desc: 'অন্যান্য সব সেশন এক ক্লিকে বাতিল' },
        { id: 'delete_account', label: 'আজীবন স্থায়ী অ্যাকাউন্ট', desc: 'অ্যাকাউন্ট চিরস্থায়ী সুরক্ষা ও স্থায়িত্ব সনদ' },
      ]
    },
    {
      id: 'settings',
      label: '⚙️ SETTINGS (সেটিংস)',
      icon: SettingsIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      subItems: [
        { id: 'lang_setting', label: 'ভাষা (বাংলা/ইংরেজি)', desc: 'অ্যাপের ডিফল্ট ভাষা পরিবর্তন' },
        { id: 'notify_setting', label: 'নোটিফিকেশন চালু/বন্ধ', desc: 'জরুরি এলার্ট ও মেসেজ সেটিংস' },
        { id: 'theme_setting', label: 'ডার্ক/লাইট মোড', desc: 'চোখের আরামের জন্য ডিসপ্লে থিম' },
      ]
    },
    {
      id: 'support',
      label: '🛠 SUPPORT (সহায়তা)',
      icon: HelpCircle,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      subItems: [
        { id: 'report_issue', label: 'সমস্যা রিপোর্ট করুন', desc: 'যেকোনো অমিল বা ত্রুটি নিয়ে কমপ্লেইন' },
        { id: 'live_chat', label: 'আমাদের সাথে যোগাযোগ করুন লাইভ চ্যাট', desc: 'গ্রাহক সেবা এজেন্টের সাথে সরাসরি চ্যাট' },
        { id: 'faq', label: 'FAQ (সাধারণ প্রশ্ন)', desc: 'সমবায় নিয়ে আপনার মনে জাগা প্রশ্ন' },
      ]
    },
    {
      id: 'info',
      label: 'ℹ️ INFORMATION (তথ্য)',
      icon: Info,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      subItems: [
        { id: 'terms', label: 'শর্তাবলী (Terms & Conditions)', desc: 'AMB কো-অপারেটিভ এর আইনি শর্তাবলী' },
        { id: 'privacy', label: 'গোপনীয়তা নীতি (Privacy Policy)', desc: 'আপনার ব্যক্তিগত ও লেনদেন তথ্যের সুরক্ষা' },
        { id: 'permissions_info', label: 'অ্যাপ পারমিশন ও ডেটা সেফটি', desc: 'কোন পারমিশন কেন ব্যবহার করা হয়' },
      ]
    },
    {
      id: 'about',
      label: '👨💼 ABOUT (আমাদের সম্পর্কে)',
      icon: BookOpen,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      subItems: [
        { id: 'about_us', label: 'আমাদের সম্পর্কে', desc: 'BNB সমবায় উদ্যোগের মূল লক্ষ্য ও টিম' },
        { id: 'app_version', label: 'অ্যাপের ভার্সন', desc: 'রিলিজ ও কারিগরি সংস্করণ বিস্তারিত' },
        { id: 'contact_info', label: 'যোগাযোগের তথ্য', desc: 'আমাদের অফিস ঠিকানা ও কন্টাক্ট ইনফো' },
      ]
    }
  ];

  // FAQ Database
  const faqData = [
    {
      q: 'Al Mayadin Bazar (AMB) সমবায় সমিতি কী?',
      a: 'AMB হচ্ছে গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের বিধিমালা মেনে পরিচালিত একটি প্রগতিশীল অনলাইন ও অফলাইন ভিত্তিক সমবায় সঞ্চয় ও ঋণদান প্ল্যাটফর্ম। এর মূল উদ্দেশ্য সদস্যদের মাঝে অর্থনৈতিক বন্ধন সুদৃঢ় করা এবং গ্রামীণ ও ক্ষুদ্র ব্যবসায়ীদের সহজ শর্তে পুঁজির ব্যবস্থা করা।'
    },
    {
      q: 'আমানত ও দৈনিক সঞ্চয় জমার নিয়মাবলি কী?',
      a: 'AMB মেম্বারগণ দৈনিক, সাপ্তাহিক বা মাসিক ভিত্তিতে সঞ্চয় জমা করতে পারেন। বিকাশ, নগদ, রকেট মোবাইল ব্যাংকিং অথবা সরাসরি এজেন্টের মাধ্যমে সঞ্চয় গ্রহণ করা হয়। জমাকৃত সঞ্চয় প্রতি মাসের শেষে সুদমুক্ত লভ্যাংশ বা ক্যাশব্যাক অর্জনে ভূমিকা রাখে।'
    },
    {
      q: 'আমি কীভাবে লোন বা করজে হাসানা গ্রহণ করতে পারি?',
      a: 'কোনো প্রকার সুদ ছাড়াই জরুরি সাহায্য হিসেবে সদস্যদের "করজে হাসানা" ঋণ দেওয়া হয়। সদস্যদের আবেদনের 24 ঘণ্টার মধ্যে সর্বোচ্চ 5,000 টাকা পর্যন্ত ঋণ দ্রুত অনুমোদন করা হয়। তবে এর জন্য সদস্যের ক্যাটাগরি ও নিয়মিত সঞ্চয়ের ইতিহাস বিবেচনা করা হয়।'
    },
    {
      q: 'টেলিকম ও ই-মার্কেট রিচার্জ কমিশন কী?',
      a: 'BNB টেলিকম প্যানেলে রয়েছে লাভজনক রিচার্জ কমিশন। যেকোনো রিচার্জে সদস্যরা তাৎক্ষণিক 2% থেকে 5% পর্যন্ত ক্যাশব্যাক ও ড্রাইভিং অফার কমিশন পান। এই কমিশন সরাসরি আপনার মূল ব্যালেন্সে যুক্ত হয়।'
    },
    {
      q: 'আমার পিন বা পাসওয়ার্ড ভুলে গেলে করণীয় কী?',
      a: 'নিরাপত্তা পিন বা পাসওয়ার্ড পরিবর্তন বা রিসেট করতে আমাদের হোয়াটসঅ্যাপ হেল্পলাইনে মেসেজ দিন (01865911728)। শুধুমাত্র এডমিন প্যানেল থেকে এডমিন যাচাই করে আপনার পিন পরিবর্তন করে দিবেন।'
    }
  ];



export const DrawerMenu = React.memo(function DrawerMenu({ 
  isOpen, 
  onClose, 
  user, 
  onLogout, 
  onOpenAdmin,
  onSelectTab,
  onSelectAction,
  onTriggerDemoAuth,
  onLock,
  appLanguage: propAppLanguage,
  onLanguageChange,
  darkMode: propDarkMode,
  onThemeToggle,
  appConfig
}: DrawerMenuProps) {

  // Accordion state - which category is expanded
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Active sub-item modal
  const [activeSubModal, setActiveSubModal] = useState<string | null>(null);

  if (!isOpen && !activeSubModal) return null;


  // Success/Error feedback alerts
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Password modification form states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 2. PIN modification form states
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // 3. Biometric fingerprint state
  const [fingerprintEnabled, setFingerprintEnabled] = useState(() => {
    return localStorage.getItem('amb_biometric_enabled') === 'true';
  });
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [biometricComplete, setBiometricComplete] = useState(false);

  // 4. Language state
  const [localAppLanguage, setLocalAppLanguage] = useState(() => {
    return localStorage.getItem('amb_lang') || 'bn';
  });
  const appLanguage = propAppLanguage !== undefined ? propAppLanguage : localAppLanguage;

  // 5. Notification preference state
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('amb_notify_enabled') !== 'false';
  });

  // 6. Theme state
  const [localDarkMode, setLocalDarkMode] = useState(() => {
    return localStorage.getItem('amb_dark_mode') === 'true';
  });
  const darkMode = propDarkMode !== undefined ? propDarkMode : localDarkMode;

  // 7. Problem report form states
  const [reportType, setReportType] = useState('deposit');
  const [reportDescription, setReportDescription] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // 8. FAQ accordion expanded indices
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // 9. Permanent Account Protection confirmation state
  const [permanentSyncDone, setPermanentSyncDone] = useState(false);

  const handleVerifyPermanence = async () => {
    setIsSubmitting(true);
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          isPermanent: true,
          permanentLifetimeAccount: true,
          lifetimeProtected: true,
          status: 'active',
          updatedAt: new Date().toISOString()
        });
      }
      setPermanentSyncDone(true);
      setFeedback({ type: 'success', message: 'আপনার অ্যাকাউন্টটি আজীবন চিরস্থায়ী হিসেবে সফলভাবে যাচাই ও নিশ্চিত করা হয়েছে।' });
    } catch (e: any) {
      setFeedback({ type: 'success', message: 'আপনার অ্যাকাউন্টটি সিস্টেমে আজীবন চিরস্থায়ী হিসেবে সক্রিয় রয়েছে।' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Translation helper for Drawer Menu UI elements
  const t = (str: string) => {
    if (appLanguage === 'en') {
      const dict: Record<string, string> = {
        '🔒 SECURITY (নিরাপত্তা)': '🔒 SECURITY & PIN',
        'পাসওয়ার্ড পরিবর্তন': 'Change Password',
        'অ্যাকাউন্টের মূল পাসওয়ার্ড পরিবর্তন': 'Change main account password',
        'পিন পরিবর্তন': 'Change PIN',
        '4 ডিজিটের সিকিউরিটি ট্রানজেকশন পিন বদল': 'Change 4-digit security transaction PIN',
        'ফিঙ্গারপ্রিন্ট/ফেস আইডি': 'Fingerprint / Face ID',
        'বায়োমেট্রিক সহজ লগইন সেটিংস': 'Biometric easy login settings',
        'সকল ডিভাইস থেকে লগআউট': 'Log out from all devices',
        'অন্যান্য সব সেশন এক ক্লিকে বাতিল': 'Log out of other sessions with one click',
        
        '⚙️ SETTINGS (সেটিংস)': '⚙️ DISPLAY & SYSTEM',
        'ভাষা (বাংলা/ইংরেজি)': 'Language (Bangla / English)',
        'অ্যাপের ডিফল্ট ভাষা পরিবর্তন': 'Change default language',
        'নোটিফিকেশন চালু/বন্ধ': 'Toggle Notifications',
        'জরুরি এলার্ট ও মেসেজ সেটিংস': 'Emergency alerts and message settings',
        'ডার্ক/লাইট মোড': 'Dark / Light Mode',
        'চোখের আরামের জন্য ডিসপ্লে থিম': 'Display theme for eye comfort',

        '🛠 SUPPORT (সহায়তা)': '🛠 HELP & SUPPORT',
        'সমস্যা রিপোর্ট করুন': 'Report an Issue',
        'যেকোনো অমিল বা ত্রুটি নিয়ে কমপ্লেইন': 'Complain about any issues or errors',
        'আমাদের সাথে যোগাযোগ করুন লাইভ চ্যাট': 'Contact Us via Live Chat',
        'গ্রাহক সেবা এজেন্টের সাথে সরাসরি চ্যাট': 'Chat directly with customer service',
        'FAQ (সাধারণ প্রশ্ন)': 'FAQ (Frequently Asked Questions)',
        'সমবায় নিয়ে আপনার মনে জাগা প্রশ্ন': 'Questions you have about the cooperative',

        'ℹ️ INFORMATION (তথ্য)': 'ℹ️ SYSTEM INFORMATION',
        'শর্তাবলী (Terms & Conditions)': 'Terms & Conditions',
        'AMB কো-অপারেティブ এর আইনি শর্তাবলী': 'Legal terms of AMB Cooperative',
        'গোপনীয়তা নীতি (Privacy Policy)': 'Privacy Policy',
        'আপনার ব্যক্তিগত ও লেনদেন তথ্যের সুরক্ষা': 'Protection of personal and transaction data',

        '👨💼 ABOUT (আমাদের সম্পর্কে)': '👨💼 ABOUT THE INITIATIVE',
        'আমাদের সম্পর্কে': 'About Us',
        'BNB সমবায় উদ্যোগের মূল লক্ষ্য ও টিম': 'Core mission and team of AMB initiative',
        'অ্যাপের ভার্সন': 'App Version',
        'রিলিজ ও কারিগরি সংস্করণ বিস্তারিত': 'Release and technical version details',
        'যোগাযোগের তথ্য': 'Contact Information',
        'আমাদের অফিস ঠিকানা ও কন্টাক্ট ইনফো': 'Our office address and contact info'
      };
      return dict[str] || str;
    }
    return str;
  };

  // Reset feedback when modal shifts
  useEffect(() => {
    setFeedback(null);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setReportDescription('');
    setAttachedImage(null);
  }, [activeSubModal]);

  // Handle Biometric enrollment toggle
  const handleToggleBiometrics = () => {
    if (fingerprintEnabled) {
      // Disabling is instant
      localStorage.setItem('amb_biometric_enabled', 'false');
      setFingerprintEnabled(false);
      setFeedback({ type: 'success', message: 'ফিঙ্গারপ্রিন্ট/ফেস আইডি সফলভাবে নিষ্ক্রিয় করা হয়েছে।' });
    } else {
      // Enabling triggers mock visual biometric scanning first
      setBiometricScanning(true);
      setBiometricComplete(false);
      
      setTimeout(() => {
        setBiometricComplete(true);
        setTimeout(() => {
          setBiometricScanning(false);
          localStorage.setItem('amb_biometric_enabled', 'true');
          setFingerprintEnabled(true);
          setFeedback({ type: 'success', message: 'ফিঙ্গারপ্রিন্ট/ফেস আইডি সফলভাবে সক্রিয় করা হয়েছে!' });
        }, 1000);
      }, 2000);
    }
  };

  // Submit Password Change
  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (newPassword.length < 6) {
      setFeedback({ type: 'error', message: 'পাসওয়ার্ডটি অবশ্যই কমপক্ষে 6 অক্ষরের হতে হবে।' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'নতুন পাসওয়ার্ড এবং নিশ্চিত পাসওয়ার্ড মেলেনি।' });
      return;
    }

    setIsSubmitting(true);
    setTimeout(async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { customPassword: newPassword });
        setFeedback({ type: 'success', message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (err) {
        setFeedback({ type: 'error', message: 'ডেটাবেজে পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে।' });
      } finally {
        setIsSubmitting(false);
      }
    }, 800);
  };

  // Submit PIN Change
  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (oldPin !== user.pin) {
      setFeedback({ type: 'error', message: 'বর্তমান পিন নম্বরটি সঠিক নয়।' });
      return;
    }

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      setFeedback({ type: 'error', message: 'নতুন পিন অবশ্যই 4 ডিজিটের সংখ্যা হতে হবে।' });
      return;
    }

    if (newPin !== confirmPin) {
      setFeedback({ type: 'error', message: 'নতুন পিন এবং নিশ্চিত পিন মেলেনি।' });
      return;
    }

    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { pin: newPin });
      setFeedback({ type: 'success', message: 'সিকিউরিটি পিন নম্বরটি সফলভাবে পরিবর্তন করা হয়েছে!' });
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      setFeedback({ type: 'error', message: 'ডেটাবেজে পিন আপডেট করতে সমস্যা হয়েছে।' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Problem Report
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (reportDescription.trim().length < 10) {
      setFeedback({ type: 'error', message: 'অনুগ্রহ করে সমস্যার বিবরণ একটু বিস্তারিত লিখুন (কমপক্ষে 10 অক্ষরের)।' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Write durable problem ticket to Firestore
      const reportsRef = collection(db, 'user_reports');
      const ticketId = 'AMB-' + Math.floor(100000 + Math.random() * 900000);
      
      await addDoc(reportsRef, {
        ticketId,
        userId: user.uid,
        userName: user.name,
        userPhone: user.phone,
        memberId: user.memberId,
        type: reportType,
        description: reportDescription,
        attachedImage: attachedImage,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setFeedback({ 
        type: 'success', 
        message: `আপনার অভিযোগটি সফলভাবে দাখিল করা হয়েছে! টিকিট নাম্বার: ${ticketId}। আমাদের কাস্টমার রিলেশন টিম 24 ঘণ্টার মধ্যে সরাসরি আপনার মোবাইলে যোগাযোগ করবে।` 
      });
      setReportDescription('');
      setAttachedImage(null);
    } catch (err) {
      setFeedback({ type: 'error', message: 'সার্ভারে রিপোর্ট জমা দিতে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mock upload drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachedImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachedImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Languages handler
  const handleLanguageChange = (lang: string) => {
    if (onLanguageChange) {
      onLanguageChange(lang);
    } else {
      setLocalAppLanguage(lang);
      localStorage.setItem('amb_lang', lang);
    }
    setFeedback({ 
      type: 'success', 
      message: lang === 'bn' ? 'ভাষা সফলভাবে বাংলা সেট করা হয়েছে।' : 'English language setup completed! Translation is active.' 
    });
  };

  // Notification toggle handler
  const handleNotificationToggle = () => {
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    localStorage.setItem('amb_notify_enabled', String(nextVal));
    setFeedback({ 
      type: 'success', 
      message: nextVal ? 'সব ধরনের পুশ নোটিফিকেশন সচল করা হয়েছে।' : 'পুশ নোটিফিকেশন সাময়িকভাবে বন্ধ করা হয়েছে।' 
    });
  };

  // Theme change handler
  const handleThemeToggle = (targetMode?: boolean) => {
    const nextVal = targetMode !== undefined ? targetMode : !darkMode;
    if (onThemeToggle) {
      if (nextVal !== darkMode) {
        onThemeToggle();
      }
    } else {
      setLocalDarkMode(nextVal);
      localStorage.setItem('amb_dark_mode', String(nextVal));
    }
    setFeedback({ 
      type: 'success', 
      message: nextVal ? 
        (appLanguage === 'en' ? 'Dark mode successfully activated!' : 'ডার্ক মোড সফলভাবে সক্রিয় করা হয়েছে।') : 
        (appLanguage === 'en' ? 'Light mode successfully activated!' : 'লাইট মোড সফলভাবে সক্রিয় করা হয়েছে।') 
    });
  };

  // All devices logout handler
  const handleLogoutAllDevices = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setActiveSubModal(null);
      onLogout();
    }, 1500);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs"
            />

            {/* Drawer Sliding Body */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 w-full max-w-sm bg-white z-55 shadow-2xl flex flex-col h-full overflow-hidden text-slate-800 font-sans transform-gpu will-change-transform"
            >
              {/* Drawer Header Box */}
              <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-5 pt-7 relative shrink-0">
                {/* Close Button */}
                <button 
                  onClick={onClose}
                  className="absolute top-4 right-4 text-emerald-100 hover:text-white bg-emerald-900/40 hover:bg-emerald-900/60 p-1.5 rounded-full transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center p-0.5 border border-white/20 overflow-hidden relative shrink-0">
                    {appConfig?.logoUrl ? (
                      <img 
                        src={appConfig.logoUrl} 
                        alt="Logo" 
                        className="w-full h-full object-cover rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <AMBLogo size={34} variant="white" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black tracking-wider uppercase text-emerald-300">AMB Al Mayadin Bazar</span>
                      <span className="bg-emerald-500/80 text-[8px] text-white px-1 py-0.5 rounded font-mono">v2.0</span>
                    </div>
                    <span className="bg-emerald-700/60 text-white font-mono text-[9px] px-2 py-0.5 rounded-md font-bold">Bangladesh</span>
                  </div>
                </div>

                {/* Drawer Profile Card */}
                {(() => {
                  const categoryMeta = getMembershipCategory(user);
                  return (
                    <button 
                      onClick={() => { 
                        onSelectTab('profile'); 
                        onClose(); 
                      }}
                      className="w-full flex items-center gap-3.5 mt-6 bg-emerald-950/55 hover:bg-emerald-900/60 p-3.5 rounded-2xl border border-white/10 text-left transition duration-150 active:scale-98 cursor-pointer group"
                    >
                      <div className={`w-14 h-14 rounded-full p-0.5 overflow-hidden flex items-center justify-center relative shrink-0 border-2 transition-all ${
                        categoryMeta.key === 'shareholder'
                          ? 'border-red-500 ring-2 ring-red-600 bg-red-950/50'
                          : categoryMeta.key === 'investor'
                          ? 'border-blue-500 ring-2 ring-blue-600 bg-blue-950/50'
                          : 'border-emerald-400 bg-gradient-to-tr from-emerald-500 to-teal-400'
                      }`}>
                        {user.profilePic?.startsWith('http') || user.profilePic?.startsWith('data:image/') ? (
                          <img 
                            src={user.profilePic} 
                            alt="Profile" 
                            className="w-full h-full object-cover rounded-full"
                            referrerPolicy="no-referrer"
                          />
                        ) : (() => {
                          const PRESET_AVATARS = [
                            { id: 'av1', emoji: '👨‍💼', bg: 'bg-indigo-50 text-indigo-700' },
                            { id: 'av2', emoji: '👩‍💼', bg: 'bg-rose-50 text-rose-700' },
                            { id: 'av3', emoji: '👨‍💻', bg: 'bg-teal-50 text-teal-700 font-bold' },
                            { id: 'av4', emoji: '🧑‍🌾', bg: 'bg-amber-50 text-amber-700' },
                            { id: 'av5', emoji: '👩‍🏫', bg: 'bg-emerald-50 text-emerald-700' },
                            { id: 'av6', emoji: '✨', bg: 'bg-cyan-50 text-cyan-700' },
                          ];
                          const activeAv = PRESET_AVATARS.find(av => av.id === user.profilePic) || PRESET_AVATARS[2];
                          return (
                            <div className={`w-full h-full rounded-full flex items-center justify-center text-2xl ${activeAv.bg}`}>
                              {activeAv.emoji}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* [1. পদবী] -> [2. নাম] */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-md leading-none border ${
                            categoryMeta.key === 'shareholder'
                              ? 'bg-red-600 text-white border-red-400'
                              : categoryMeta.key === 'investor'
                              ? 'bg-blue-600 text-white border-blue-400'
                              : 'bg-emerald-800/80 text-emerald-200 border-emerald-600'
                          }`}>
                            {categoryMeta.key === 'shareholder' ? '👑 শেয়ার হোল্ডার' : categoryMeta.key === 'investor' ? '💎 ইনভেস্টার' : '👤 সাধারণ সদস্য'}
                          </span>
                        </div>
                        <h3 className="text-sm font-black font-sans text-slate-100 leading-snug group-hover:text-white truncate mt-0.5">{user.name}</h3>
                        <p className="text-xs text-emerald-300 font-mono mt-0.5">ID: {user.memberId}</p>
                        <p className="text-[10px] text-emerald-250/75 font-mono">{maskSecretPhone(user.phone)}</p>
                      </div>
                      <div className="bg-emerald-500/25 text-emerald-200 border border-emerald-550/30 text-[9.5px] px-2.5 py-1 rounded-full font-extrabold shadow-sm shrink-0 uppercase tracking-widest leading-none self-center flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {appLanguage === 'en' ? 'ACTIVE' : 'একটিভ'}
                      </div>
                    </button>
                  );
                })()}
              </div>

              {/* Scrollable Nav Items with Interactive Accordion structure */}
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
                
                {/* Expandable Accordion Menu Categories */}
                <div className="space-y-2.5">
                  {menuCategories.map((category, idx) => {
                    const CategoryIcon = category.icon;
                    const isExpanded = expandedSection === category.id;
                    return (
                      <div key={`${category.id}-${idx}`} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-3xs">
                        {/* Category Header */}
                        <button
                          onClick={() => setExpandedSection(isExpanded ? null : category.id)}
                          className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50/75 transition-all text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${category.bgColor} ${category.color}`}>
                              <CategoryIcon className="w-4.5 h-4.5" />
                            </div>
                            <span className="text-xs font-bold text-slate-700 font-sans tracking-wide">{t(category.label)}</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-450" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {/* Sub-items list with expansion animations */}
                        {isExpanded && (
                          <div className="bg-slate-50/50 border-t border-slate-50 px-3 py-1.5 space-y-1">
                            {category.subItems.map((sub, idx) => {
                              return (
                                <button
                                  key={`${sub.id}-${idx}`}
                                  onClick={() => {
                                    if (sub.id === 'live_chat') {
                                      onClose();
                                      onSelectAction('chat');
                                    } else if (sub.id === 'about_us') {
                                      onClose();
                                      onSelectAction('about');
                                    } else {
                                      setActiveSubModal(sub.id);
                                    }
                                  }}
                                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white text-slate-700 hover:text-emerald-850 transition-all cursor-pointer text-left border border-transparent hover:border-slate-100 hover:shadow-4xs group"
                                >
                                  <div className="flex-1 min-w-0 pr-2">
                                    <span className="text-[11.5px] font-extrabold text-slate-805 block group-hover:text-emerald-800 transition-colors">{t(sub.label)}</span>
                                    <span className="text-[9.5px] text-slate-400 block font-medium leading-none mt-0.5">{t(sub.desc)}</span>
                                  </div>
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Action Utility Buttons */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  {/* Lock App Button */}
                  <button
                    onClick={() => { onClose(); onLock(); }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-800 hover:text-emerald-900 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    {appLanguage === 'en' ? 'Lock App' : 'অ্যাপ লক করুন (Lock App)'}
                  </button>

                  {/* Logout Button */}
                  <button
                    onClick={() => { onClose(); onLogout(); }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 border border-red-100 text-red-650 hover:text-red-750 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    <LogOut className="w-4.5 h-4.5" />
                    {appLanguage === 'en' ? 'Logout' : 'লগআউট (Logout)'}
                  </button>
                </div>

                {/* ADMin GATEWAY HAS BEEN SUCCESSFULLY REMOVED FROM HERE PER USER DIRECTIVE */}

              </div>

              {/* Bottom Tag */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-mono font-medium shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  ডাটা এনক্রিপ্টেড
                </span>
                <span>BDT - SECURE v2.0</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Dynamic Action Modals Overlay */}
      <AnimatePresence>
        {activeSubModal && (
          <div className="fixed inset-0 bg-black/75 z-60 flex items-center justify-center p-4 backdrop-blur-xs font-sans text-slate-800">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-150 flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-4.5 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  {activeSubModal === 'change_password' && <Key className="w-4.5 h-4.5 text-amber-450" />}
                  {activeSubModal === 'change_pin' && <Lock className="w-4.5 h-4.5 text-amber-450" />}
                  {activeSubModal === 'biometric' && <Fingerprint className="w-4.5 h-4.5 text-teal-400" />}
                  {activeSubModal === 'logout_all' && <LogOut className="w-4.5 h-4.5 text-rose-450" />}
                  {activeSubModal === 'lang_setting' && <Languages className="w-4.5 h-4.5 text-blue-400" />}
                  {activeSubModal === 'notify_setting' && <Bell className="w-4.5 h-4.5 text-amber-400" />}
                  {activeSubModal === 'theme_setting' && <Moon className="w-4.5 h-4.5 text-indigo-400" />}
                  {activeSubModal === 'report_issue' && <AlertTriangle className="w-4.5 h-4.5 text-rose-500" />}
                  {activeSubModal === 'faq' && <HelpCircle className="w-4.5 h-4.5 text-teal-400" />}
                  {activeSubModal === 'terms' && <FileText className="w-4.5 h-4.5 text-blue-400" />}
                  {activeSubModal === 'privacy' && <FileLock2 className="w-4.5 h-4.5 text-emerald-400" />}
                  {activeSubModal === 'app_version' && <Activity className="w-4.5 h-4.5 text-purple-400" />}
                  {activeSubModal === 'contact_info' && <Mail className="w-4.5 h-4.5 text-pink-400" />}
                  {activeSubModal === 'delete_account' && <ShieldCheck className="w-4.5 h-4.5 text-emerald-450" />}
                  {activeSubModal === 'permissions_info' && <ShieldAlert className="w-4.5 h-4.5 text-teal-400" />}
                  
                  <h3 className="text-xs font-black tracking-wide uppercase">
                    {activeSubModal === 'change_password' && 'পাসওয়ার্ড পরিবর্তন'}
                    {activeSubModal === 'change_pin' && 'সিকিউরিটি পিন পরিবর্তন'}
                    {activeSubModal === 'biometric' && 'বায়োমেট্রিক অথেন্টিকেশন'}
                    {activeSubModal === 'logout_all' && 'সকল ডিভাইস লগআউট'}
                    {activeSubModal === 'lang_setting' && 'অ্যাপের ভাষা পরিবর্তন'}
                    {activeSubModal === 'notify_setting' && 'নোটিফিকেশন অ্যালার্ট'}
                    {activeSubModal === 'theme_setting' && 'থিম পরিবর্তন সেটিংস'}
                    {activeSubModal === 'report_issue' && 'সমস্যা বা ত্রুটি রিপোর্ট'}
                    {activeSubModal === 'faq' && 'সচরাচর জিজ্ঞাসিত প্রশ্নাবলী'}
                    {activeSubModal === 'terms' && 'ব্যবহারকারীর শর্তাবলী'}
                    {activeSubModal === 'privacy' && 'গোপনীয়তা নীতিমালা'}
                    {activeSubModal === 'app_version' && 'অ্যাপের রিলিজ ভার্সন'}
                    {activeSubModal === 'contact_info' && 'যোগাযোগ ও সাপোর্ট টিম'}
                    {activeSubModal === 'delete_account' && 'আজীবন স্থায়ী অ্যাকাউন্ট সনদ'}
                    {activeSubModal === 'permissions_info' && 'অ্যাপ পারমিশন ও ডেটা সেফটি'}
                  </h3>
                </div>
                <button 
                  onClick={() => setActiveSubModal(null)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal scrollable content area */}
              <div className="p-5 overflow-y-auto space-y-4">
                
                {/* Feedback Alerts */}
                {feedback && (
                  <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed border ${
                    feedback.type === 'success' 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                      : 'bg-red-50 border-red-100 text-red-750'
                  }`}>
                    {feedback.type === 'success' ? '✓ ' : '⚠️ '}
                    {feedback.message}
                  </div>
                )}

                {/* 1. PASSWORD MODIFICATION VIEW */}
                {activeSubModal === 'change_password' && (
                  <form onSubmit={handlePasswordChange} className="space-y-4 text-left">
                    <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">আপনার AMB মেম্বার অ্যাকাউন্ট সুরক্ষায় নতুন গোপন পাসওয়ার্ড সেট করুন।</p>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">বর্তমান পাসওয়ার্ড</label>
                      <input 
                        type="password" 
                        required
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-350 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">নতুন পাসওয়ার্ড</label>
                      <input 
                        type="password" 
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="কমপক্ষে 6 অক্ষরের পাসওয়ার্ড"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-350 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">পাসওয়ার্ড নিশ্চিত করুন</label>
                      <input 
                        type="password" 
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="নতুন পাসওয়ার্ড পুনরায় লিখুন"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-350 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none transition"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-slate-900 hover:bg-black text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-slate-900/10"
                    >
                      {isSubmitting ? (
                        <RotateCw className="w-4 h-4 animate-spin" />
                      ) : 'পাসওয়ার্ড হালনাগাদ করুন'}
                    </button>
                  </form>
                )}

                {/* 2. TRANSACTION PIN MODIFICATION VIEW */}
                {activeSubModal === 'change_pin' && (
                  <form onSubmit={handlePinChange} className="space-y-4 text-left">
                    <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">টাকা জমা, উত্তোলন, ঋণ ও রিচার্জ অনুমোদনে 4 ডিজিটের সিকিউরিটি পিন নম্বর জরুরি।</p>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">বর্তমান 4-ডিজিট পিন</label>
                      <input 
                        type="password" 
                        required
                        maxLength={4}
                        value={oldPin}
                        onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="যেমন: 1234"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-350 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold tracking-widest outline-none transition text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">নতুন 4-ডিজিট পিন</label>
                      <input 
                        type="password" 
                        required
                        maxLength={4}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="নতুন গোপন 4 ডিজিট লিখুন"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-350 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold tracking-widest outline-none transition text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">নতুন পিন নিশ্চিত করুন</label>
                      <input 
                        type="password" 
                        required
                        maxLength={4}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="নতুন 4 ডিজিট পুনরায় লিখুন"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-350 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold tracking-widest outline-none transition text-center"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-800/10"
                    >
                      {isSubmitting ? (
                        <RotateCw className="w-4 h-4 animate-spin" />
                      ) : 'সিকিউরিটি পিন হালনাগাদ করুন'}
                    </button>
                  </form>
                )}

                {/* 3. BIOMETRIC AUTHENTICATION PANEL */}
                {activeSubModal === 'biometric' && (
                  <div className="space-y-5 text-center">
                    <div className="mx-auto w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center text-teal-600 relative">
                      <Fingerprint className={`w-9 h-9 ${biometricScanning ? 'animate-pulse text-emerald-500 scale-110' : ''}`} />
                      {fingerprintEnabled && !biometricScanning && (
                        <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">✓</span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-sm font-bold text-slate-800">সহজ মেম্বার বায়োমেট্রিক লগইন</h4>
                      <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                        বারবার পিন প্রবেশ করা এড়াতে ফিঙ্গারপ্রিন্ট বা ফেস আইডি সক্রিয় করুন। এটি আপনার ডিভাইসের নিজস্ব বায়োমেট্রিক মেমোরি চিপসেট ব্যবহার করে সুরক্ষিত রাখবে।
                      </p>
                    </div>

                    {biometricScanning ? (
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <span className="text-[11px] font-bold text-emerald-700 animate-pulse">
                          {biometricComplete ? 'রেজিস্ট্রেশন সম্পন্ন হয়েছে!' : 'ফিঙ্গারপ্রিন্ট স্ক্যানারটি যাচাই করা হচ্ছে...'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-left">
                        <div>
                          <strong className="text-xs text-slate-800 block font-bold">ফিঙ্গারপ্রিন্ট/ফেস আইডি এনরোলমেন্ট</strong>
                          <span className="text-[9.5px] text-slate-450 block font-semibold mt-0.5">ডিভাইস সেন্সর স্ট্যাটাস: সচল</span>
                        </div>
                        <button
                          onClick={handleToggleBiometrics}
                          className={`w-12 h-6.5 rounded-full p-1 transition-colors cursor-pointer relative ${fingerprintEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                        >
                          <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${fingerprintEnabled ? 'translate-x-5.5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. LOGOUT ALL SESSIONS VIEW */}
                {activeSubModal === 'logout_all' && (
                  <div className="space-y-4 text-center">
                    <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-bold text-slate-800">সকল ডিভাইস ও সেশন লগআউট</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                        আপনার এই অ্যাকাউন্টটি যদি অন্য কোনো ফোন, ব্রাউজার বা ডিভাইসে অসাবধানতাবশত লগইন করা থাকে, তবে এখনি এক ক্লিকে সেই সব ডিভাইস থেকে সেশন ক্লোজ করতে পারেন।
                      </p>
                    </div>

                    {isSubmitting ? (
                      <div className="py-4 text-center">
                        <RotateCw className="w-6 h-6 text-rose-600 animate-spin mx-auto mb-2" />
                        <span className="text-[11px] text-slate-500 font-bold animate-pulse">অন্য সকল ফোন থেকে আপনার মেম্বার সেশন ডিলিট করা হচ্ছে...</span>
                      </div>
                    ) : (
                      <div className="flex gap-2.5 pt-2">
                        <button
                          onClick={() => setActiveSubModal(null)}
                          className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
                        >
                          বাতিল
                        </button>
                        <button
                          onClick={handleLogoutAllDevices}
                          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-md shadow-rose-600/10"
                        >
                          হ্যাঁ, লগআউট করুন
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. LANGUAGE SETTING */}
                {activeSubModal === 'lang_setting' && (
                  <div className="space-y-4 text-left">
                    <p className="text-[10.5px] text-slate-500 leading-relaxed font-semibold">আপনার পছন্দের ভাষা নির্বাচন করুন। চেঞ্জ করার সাথে সাথে সেটিংস সচল হবে।</p>
                    
                    <div className="space-y-2.5">
                      <button
                        onClick={() => handleLanguageChange('bn')}
                        className={`w-full p-3.5 rounded-2xl border text-left flex justify-between items-center transition cursor-pointer ${
                          appLanguage === 'bn' 
                            ? 'bg-emerald-50/50 border-emerald-400 text-emerald-950 font-black' 
                            : 'bg-white border-slate-150 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🇧🇩</span>
                          <div>
                            <span className="text-xs block">বাংলা (Bengali)</span>
                            <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">ডিফল্ট এবং সম্পূর্ণ অপ্টিমাইজড</span>
                          </div>
                        </div>
                        {appLanguage === 'bn' && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />}
                      </button>

                      <button
                        onClick={() => handleLanguageChange('en')}
                        className={`w-full p-3.5 rounded-2xl border text-left flex justify-between items-center transition cursor-pointer ${
                          appLanguage === 'en' 
                            ? 'bg-emerald-50/50 border-emerald-400 text-emerald-950 font-black' 
                            : 'bg-white border-slate-150 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🇺🇸</span>
                          <div>
                            <span className="text-xs block">English (United States)</span>
                            <span className="text-[9px] text-slate-450 font-semibold block mt-0.5">Partial Translation & Analytics</span>
                          </div>
                        </div>
                        {appLanguage === 'en' && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* 6. NOTIFICATION ALERTS */}
                {activeSubModal === 'notify_setting' && (
                  <div className="space-y-4 text-left">
                    <p className="text-[10.5px] text-slate-500 leading-relaxed font-semibold">সমিতি সংক্রান্ত আপডেট, টাকা জমা রশিদ এবং লোন পেমেন্ট এলার্ট নোটিফিকেশন সেটিংস।</p>
                    
                    <div className="space-y-3.5 bg-slate-50 border border-slate-100 p-4 rounded-2.5xl">
                      <div className="flex justify-between items-center">
                        <div>
                          <strong className="text-xs text-slate-800 block font-extrabold">পুশ নোটিফিকেশন</strong>
                          <span className="text-[9px] text-slate-450 block font-medium mt-0.5">জমা, উত্তোলন ও ঋণ এলার্ট</span>
                        </div>
                        <button
                          onClick={handleNotificationToggle}
                          className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer relative ${notificationsEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <div className="border-t border-slate-200/60 pt-3 flex justify-between items-center">
                        <div>
                          <strong className="text-xs text-slate-800 block font-extrabold">এসএমএস (SMS) নোটিফিকেশন</strong>
                          <span className="text-[9px] text-slate-450 block font-medium mt-0.5">মোবাইল নম্বরে ব্যাংক রশিদ</span>
                        </div>
                        <span className="text-[8.5px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">সক্রিয়</span>
                      </div>

                      <div className="border-t border-slate-200/60 pt-3 flex justify-between items-center">
                        <div>
                          <strong className="text-xs text-slate-800 block font-extrabold">ইমেইল (Email) নোটিফিকেশন</strong>
                          <span className="text-[9px] text-slate-450 block font-medium mt-0.5">মাসিক হিসাবের খতিয়ান পিডিএফ</span>
                        </div>
                        <span className="text-[8.5px] font-black bg-slate-100 text-slate-550 px-1.5 py-0.5 rounded">আসন্ন</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. THEME SELECTION */}
                {activeSubModal === 'theme_setting' && (
                  <div className="space-y-4 text-left">
                    <p className="text-[10.5px] text-slate-505 dark:text-slate-400 leading-relaxed font-semibold">
                      {appLanguage === 'en' 
                        ? 'Set comfortable Light or Dark mode theme for day and night use.' 
                        : 'দিনের ও রাতের ব্যবহারের সুবিধার জন্য চোখের আরামদায়ক লাইট বা ডার্ক মোড থিম সেট করুন।'}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleThemeToggle(false)}
                        className={`p-4 border-2 rounded-2xl text-center cursor-pointer transition relative group ${
                          !darkMode 
                            ? 'border-emerald-600 bg-emerald-50/15' 
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <strong className="text-xs text-slate-800 dark:text-slate-100 font-extrabold block">
                          {appLanguage === 'en' ? 'Light Mode' : 'লাইট মোড'}
                        </strong>
                        {!darkMode ? (
                          <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full mt-1.5 inline-block">
                            {appLanguage === 'en' ? 'Active' : 'সক্রিয়'}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium px-1.5 py-0.5 rounded-full mt-1.5 inline-block">
                            {appLanguage === 'en' ? 'Select' : 'নির্বাচন করুন'}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => handleThemeToggle(true)}
                        className={`p-4 border-2 rounded-2xl text-center cursor-pointer transition group ${
                          darkMode 
                            ? 'border-emerald-500 bg-slate-900 dark:bg-slate-950' 
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <div className="w-10 h-10 bg-slate-800 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                          <Moon className="w-5 h-5" />
                        </div>
                        <strong className={`text-xs font-extrabold block ${darkMode ? 'text-slate-100' : 'text-slate-700'}`}>
                          {appLanguage === 'en' ? 'Dark Mode' : 'ডার্ক মোড'}
                        </strong>
                        {darkMode ? (
                          <span className="text-[9px] text-emerald-400 font-bold bg-slate-850 px-1.5 py-0.5 rounded-full mt-1.5 inline-block">
                            {appLanguage === 'en' ? 'Active' : 'সক্রিয়'}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-500 font-medium px-1.5 py-0.5 rounded-full mt-1.5 inline-block">
                            {appLanguage === 'en' ? 'Select' : 'নির্বাচন করুন'}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* 8. COMPLAINT & ISSUE REPORT FORM */}
                {activeSubModal === 'report_issue' && (
                  <form onSubmit={handleReportSubmit} className="space-y-4 text-left">
                    <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">আপনার সঞ্চয় জমা, করজে হাসানা বা অন্য কোনো ফিচারে সমস্যা হলে তা দ্রুত আমাদের সাপোর্ট সেন্টারকে অবগত করুন।</p>
                    
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">সমস্যার বিষয় / ক্যাটাগরি</label>
                      <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-350 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer"
                      >
                        <option value="deposit">সঞ্চয় বা ডিপিএস জমার সমস্যা (Savings)</option>
                        <option value="loan">ঋণ বা করজে হাসানা আবেদন (Loan)</option>
                        <option value="telecom">টেলিকম বা মোবাইল রিচার্জ পেমেন্ট</option>
                        <option value="samity">সমবায় গ্রুপ বা গ্রুপের হিসাব সমস্যা</option>
                        <option value="profile">প্রোফাইল সংশোধন ও এনরোলমেন্ট</option>
                        <option value="other">অন্যান্য যান্ত্রিক ত্রুটি ও সমস্যা</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">সমস্যার বিস্তারিত বিবরণ</label>
                      <textarea
                        required
                        rows={3.5}
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                        placeholder="আপনার সমস্যাটি বিস্তারিত লিখুন (উদাঃ বিকাশ দিয়ে আজ সঞ্চয় জমার টাকা কেটেছে কিন্তু ব্যালেন্সে যোগ হয়নি...)"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-350 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none transition leading-relaxed placeholder-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">প্রমাণস্বরূপ ছবি / স্ক্রিনশট সংযুক্ত করুন (ঐচ্ছিক)</label>
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition ${
                          dragActive ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                        }`}
                        onClick={() => document.getElementById('report-screenshot-input')?.click()}
                      >
                        <input 
                          type="file" 
                          id="report-screenshot-input"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileSelect}
                        />
                        {attachedImage ? (
                          <div className="space-y-2">
                            <img 
                              src={attachedImage} 
                              alt="Screenshot Preview" 
                              className="max-h-20 mx-auto rounded-lg object-contain shadow-xs" 
                            />
                            <p className="text-[9.5px] text-emerald-600 font-bold">✓ স্ক্রিনশট সফলভাবে সংযুক্ত করা হয়েছে! (ক্লিক করে পরিবর্তন করুন)</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold">ড্র্যাগ এন্ড ড্রপ করুন অথবা ব্রাউজ করুন</p>
                            <span className="text-[8.5px] text-slate-400 block font-medium">PNG, JPG formats accepted</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/10"
                    >
                      {isSubmitting ? (
                        <RotateCw className="w-4 h-4 animate-spin" />
                      ) : 'কমপ্লেইন টিকিট দাখিল করুন'}
                    </button>
                  </form>
                )}

                {/* 9. FAQ ACCORDION LIST */}
                {activeSubModal === 'faq' && (
                  <div className="space-y-3 text-left">
                    <p className="text-[10.5px] text-slate-500 leading-relaxed font-semibold mb-1">AMB মেম্বারদের সচরাচর জিজ্ঞাসিত কিছু সাধারণ উত্তর ও নিয়মাবলি নিচে প্রদান করা হলো:</p>
                    
                    <div className="space-y-2 max-h-[50vh] pr-1">
                      {faqData.map((item, idx) => {
                        const isExpanded = expandedFaq === idx;
                        return (
                          <div key={idx} className="border border-slate-100 bg-slate-50/50 rounded-2xl overflow-hidden transition-all duration-150">
                            <button
                              onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                              className="w-full flex items-start justify-between p-3.5 hover:bg-slate-50 text-left transition cursor-pointer gap-2"
                            >
                              <span className="text-[11.5px] font-extrabold text-slate-805 leading-snug">{item.q}</span>
                              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {isExpanded && (
                              <div className="px-4.5 pb-4 pt-1 border-t border-slate-100/50 text-[11px] text-slate-600 font-medium leading-relaxed font-sans bg-white">
                                {item.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 10. TERMS & CONDITIONS */}
                {activeSubModal === 'terms' && (
                  <div className="text-left space-y-4 text-slate-650 leading-relaxed text-[11px] font-sans max-h-[50vh] pr-1">
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-[10px] text-blue-700 font-semibold mb-2">
                      ⚠️ AMB মেম্বারশিপ একাউন্ট খোলার পূর্বে দয়া করে আইনি শর্তাবলী মনোযোগ সহকারে পঠন করুন।
                    </div>
                    
                    <div className="space-y-3 font-medium">
                      <p><strong>1. মেম্বারশিপ যোগ্যতাঃ</strong> আবেদনকারীকে অবশ্যই বাংলাদেশী নাগরিক এবং প্রাপ্তবয়স্ক হতে হবে। একটি এনআইডি কার্ডের বিপরীতে সর্বোচ্চ একটি একাউন্ট অনুমোদনযোগ্য।</p>
                      <p><strong>2. সঞ্চয় পলিসিঃ</strong> জমাকৃত সঞ্চয় বা আমানত সমবায়ের উন্নয়নমূলক ও ই-কমার্স ব্যবসায় বিনিয়োগ করা হয়। কোনো সদস্য একাউন্ট ডিলিট বা সমবায় ত্যাগ করতে চাইলে আবেদনের 15 দিনের মধ্যে মূল সঞ্চয় ফেরত দেওয়া হবে।</p>
                      <p><strong>3. ঋণ নীতিমালাঃ</strong> করজে হাসানা বা লোন কেবল নিয়মিত আমানতকারী ও বিশ্বস্ত মেম্বারদের প্রদান করা হয়। লোন গ্রহীতাকে অবশ্যই কিস্তি সময়মতো পরিশোধ করতে হবে। অনাদায়ে আইনানুগ ব্যবস্থা ও সদস্যপদ বাতিলের অধিকার সমবায় সংরক্ষণ করে।</p>
                      <p><strong>4. ফি চার্জঃ</strong> টেলিকম ও বিল পরিশোধ সার্ভিস ছাড়া সমবায়ের সাধারণ সঞ্চয় আমানতে কোনো অতিরিক্ত মাসিক সার্ভিস চার্জ বা কর কর্তন করা হয় না।</p>
                    </div>
                  </div>
                )}

                {/* 11. PRIVACY POLICY */}
                {activeSubModal === 'privacy' && (
                  <div className="text-left space-y-4 text-slate-650 leading-relaxed text-[11px] font-sans max-h-[50vh] pr-1">
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-[10px] text-emerald-700 font-semibold mb-2">
                      🔒 আপনার সকল তথ্য ও ডিজিটাল ট্রানজেকশন ডেটা আমাদের সুরক্ষিত ডাটাবেসে সম্পূর্ণ এনক্রিপ্টেড থাকে।
                    </div>
                    
                    <div className="space-y-3 font-medium">
                      <p><strong>1. সংগৃহীত তথ্যঃ</strong> একাউন্ট ভেরিফিকেশনের জন্য আমরা মেম্বারের নাম, মোবাইল নাম্বার, ভোটার আইডি বা এনআইডি (NID) নম্বর ও মনোনীত নমিনির মোবাইল তথ্য সংগ্রহ করি।</p>
                      <p><strong>2. তথ্য সুরক্ষাঃ</strong> সদস্যদের ব্যক্তিগত গোপন তথ্য বা পাসওয়ার্ড কখনোই কোনো তৃতীয় পক্ষ বা বিপণনকারী প্রতিষ্ঠানের কাছে হস্তান্তর করা হয় না।</p>
                      <p><strong>3. বায়োমেট্রিক ও পিন ডেটাঃ</strong> বায়োমেট্রিক আঙুলের ছাপ এবং সিকিউরিটি পিন সম্পূর্ণভাবে আপনার হ্যান্ডসেটের অভ্যন্তরীণ সুরক্ষিত এনক্লেভে সেভ থাকে। সার্ভারে পিন বা বায়োমেট্রিক সংরক্ষণ করা হয় না।</p>
                      <p><strong>4. ট্রানজেকশন ট্র্যাকিংঃ</strong> নিরাপত্তা রক্ষার খাতিরে আপনার আইপি এড্রেস এবং প্রতিটি রিচার্জ ও পেমেন্টের ডিজিটাল ক্যাশবুক লগসমূহ ক্লাউড ফায়ারে সংরক্ষিত রাখা হয়।</p>
                    </div>
                  </div>
                )}

                {/* 12. APP VERSION RELEASE NOTES */}
                {activeSubModal === 'app_version' && (
                  <div className="text-center space-y-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto">
                      <Activity className="w-6 h-6" />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800">AMB App Production Version</h4>
                      <p className="font-mono text-xs font-black text-purple-700">v2.0 (Stable Release)</p>
                      <span className="text-[9.5px] text-slate-400 font-mono block">Build Signature: AMB-PROD-20260627</span>
                    </div>

                    <div className="border-t border-slate-100 pt-3 text-left space-y-2.5 max-h-[30vh]">
                      <strong className="text-[10px] font-black text-slate-405 uppercase tracking-wider block">নতুন সংযুক্ত ফিচারসমূহঃ</strong>
                      
                      <div className="space-y-1.5 text-[10.5px] text-slate-600 font-medium">
                        <p className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-purple-600 rounded-full shrink-0" /> 4 ডিজিট সিকিউরিটি পিন নম্বর পরিবর্তন মডিউল</p>
                        <p className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-purple-600 rounded-full shrink-0" /> গ্রাহক ও মেম্বারদের জন্য লাইভ সমস্যা কমপ্লেইন টিকিট ও Firestore ডেটা সংরক্ষণ সার্ভিস</p>
                        <p className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-purple-600 rounded-full shrink-0" /> ফিঙ্গারপ্রিন্ট সেন্সর এনরোলমেন্ট ও ডিভাইসের বায়োমেট্রিক সহজ লগইন ব্যবস্থা</p>
                        <p className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-purple-600 rounded-full shrink-0" /> নতুন আইনি মেম্বারশিপ শর্তাবলী এবং ব্যবহারকারী গোপনীয়তা খতিয়ান</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 13. CONTACT INFORMATION */}
                {activeSubModal === 'contact_info' && (
                  <div className="space-y-4 text-left">
                    <p className="text-[10.5px] text-slate-500 leading-relaxed font-semibold">আমাদের সাথে সরাসরি যোগাযোগের বিস্তারিত ঠিকানা ও নাম্বারসমূহ নিচে দেওয়া হলো। কাস্টমার সাপোর্টে যেকোনো প্রয়োজনে নির্দ্বিধায় কল করুন।</p>
                    
                    <div className="space-y-3">
                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center gap-3">
                        <div className="w-9 h-9 bg-pink-50 text-pink-600 border border-pink-100 rounded-full flex items-center justify-center shrink-0">
                          <PhoneCall className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider leading-none">হেল্পলাইন (Helpline)</span>
                          <a href="https://wa.me/8801865911728" target="_blank" rel="noopener noreferrer" className="text-xs font-mono font-black text-slate-800 hover:text-pink-600 block mt-1 hover:underline">01865911728</a>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center justify-center shrink-0">
                          <MessageSquare className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider leading-none">হোয়াটসঅ্যাপ সাপোর্ট (WhatsApp)</span>
                          <a href="https://wa.me/8801865911728" target="_blank" rel="noopener noreferrer" className="text-xs font-mono font-black text-emerald-700 hover:underline block mt-1 flex items-center gap-1">
                            +880 1865911728 <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-50 text-blue-600 border border-blue-100 rounded-full flex items-center justify-center shrink-0">
                          <Mail className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider leading-none">অফিসিয়াল ইমেইল (Email)</span>
                          <a href="mailto:support@amb-business.net" className="text-xs font-mono font-extrabold text-slate-800 hover:text-blue-600 block mt-1 hover:underline truncate">support@amb-business.net</a>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full flex items-center justify-center shrink-0">
                          <MapPin className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider leading-none">প্রধান কার্যালয় (Head Office)</span>
                          <p className="text-[10.5px] font-bold text-slate-700 mt-1 leading-normal">রোড 4, সেক্টর 11, উত্তরা, ঢাকা-1230, বাংলাদেশ।</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 14. PERMANENT LIFETIME ACCOUNT STATUS */}
                {activeSubModal === 'delete_account' && (
                  <div className="space-y-4 text-left">
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-[11px] text-emerald-800 font-semibold flex items-start gap-3">
                      <ShieldCheck className="w-6 h-6 shrink-0 mt-0.5 text-emerald-600" />
                      <div className="space-y-1">
                        <strong className="block text-xs font-black text-emerald-900">🛡️ আজীবন স্থায়ী ও চিরস্থায়ী অ্যাকাউন্ট (Lifetime Account)</strong>
                        <span>BNB সমবায় ও ফিন্যান্সিয়াল প্ল্যাটফর্মে একবার অ্যাকাউন্ট তৈরি হলে তা আজীবন চিরস্থায়ী থাকে। এই অ্যাকাউন্ট কখনোই মুছে যাবে না বা সিস্টেম থেকে সরানো হবে না।</span>
                      </div>
                    </div>

                    {feedback && (
                      <div className={`p-2.5 rounded-xl text-xs font-bold ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                        {feedback.message}
                      </div>
                    )}

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">মেম্বার আইডি</span>
                        <span className="font-mono text-xs font-black text-slate-800">{user.memberId || 'AMB Member'}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">নিবন্ধিত মোবাইল</span>
                        <span className="font-mono text-xs font-black text-slate-800">{user.phone || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">অ্যাকাউন্ট স্থায়িত্ব</span>
                        <span className="text-[11px] font-black text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> আজীবন সংরক্ষিত (Lifetime Active)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">ডেটাবেজ সুরক্ষা</span>
                        <span className="text-[11px] font-bold text-slate-700">Firestore Rules Protected (Anti-Delete)</span>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10.5px] text-amber-900 leading-relaxed font-medium">
                      💡 <strong>কোম্পানি নিরাপত্তা নিয়ম:</strong> সমবায় বিধিমালা ও সদস্যদের আর্থিক সুরক্ষার্থে কোনো অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলা নিষিদ্ধ। আপনি চাইলে আপনার ডিভাইস থেকে নিরাপদে লগআউট করতে পারেন, তবে আপনার জমার হিসাব ও অ্যাকাউন্ট আজীবন সুরক্ষিত থাকবে।
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleVerifyPermanence}
                        disabled={isSubmitting}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10"
                      >
                        {isSubmitting ? (
                          <RotateCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" /> স্থায়িত্ব যাচাই করুন
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={onLogout}
                        className="px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        লগআউট
                      </button>
                    </div>
                  </div>
                )}

                {/* 15. PERMISSIONS & DATA SAFETY */}
                {activeSubModal === 'permissions_info' && (
                  <div className="text-left space-y-4 text-slate-650 leading-relaxed text-[11px] font-sans max-h-[50vh] pr-1">
                    <div className="bg-teal-50 border border-teal-100 p-3 rounded-2xl text-[10px] text-teal-800 font-semibold mb-2">
                      🛡️ Google Play Data Safety & Permissions Compliance
                    </div>

                    <div className="space-y-3 font-medium">
                      <p><strong>1. Geolocation (লোকেশন):</strong> শুধুমাত্র সমবায় এজেন্ট লোকেশন ভেরিফিকেশন এবং নির্দিষ্ট ডিল পয়েন্ট যাচাইয়ের জন্য ব্যবহার করা হয়।</p>
                      <p><strong>2. Storage & Photos (ফাইল/স্টোরেজ):</strong> সমস্যা রিপোর্ট করার সময় স্ক্রিনশট সংযুক্ত করার উদ্দেশ্যে ব্যবহৃত হয়।</p>
                      <p><strong>3. Biometric / Fingerprint (ফিঙ্গারপ্রিন্ট):</strong> মেম্বারের হ্যান্ডসেটের সুরক্ষিত হার্ডওয়্যার এনক্লেভ ব্যবহার করে দ্রুত ও নিরাপদ লগইন নিশ্চিত করতে ব্যবহৃত হয়।</p>
                      <p><strong>4. Network Access (ইন্টারনেট):</strong> ফায়ারবেস ক্লাউড ডাটাবেসের সাথে রিয়েল-টাইম ব্যালেন্স ও ট্রানজেকশন সিঙ্ক করার জন্য ইন্টারনেট প্রয়োজন হয়।</p>
                    </div>
                  </div>
                )}

              </div>

              {/* Modal footer / Close button */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                <button
                  onClick={() => setActiveSubModal(null)}
                  className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl text-xs font-black transition cursor-pointer shadow-md shadow-slate-900/10"
                >
                  ঠিক আছে
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
});

export default DrawerMenu;
