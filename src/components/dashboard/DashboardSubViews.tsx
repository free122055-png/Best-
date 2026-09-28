import React, { useState, useEffect, useRef } from 'react';
import { User, Transaction, Notice, Offer, AppConfig, Product, UserNotification, SAMITY_MONTHS, SAMITY_YEARS, normalizePaidMonthsArray, getEffectivePaidMonthsList, getEffectiveBalance } from '../../types';
import { sortTransactionsNewestFirst } from '../../lib/transactionUtils';
import UserTransactionsStatement from '../UserTransactionsStatement';
import TransactionExchangeIcon from '../TransactionExchangeIcon';
import { filterTransactionsLast60Days, cleanupExpiredTransactions } from '../../lib/transactionCleanup';
import { db } from '../../lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc,
  setDoc,
  limit,
  onSnapshot,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { 
  Menu, 
  Bell, 
  BellRing,
  Eye,
  LogOut, 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Home,
  UserCircle, 
  DollarSign, 
  BookOpen, 
  Smartphone, 
  ShoppingBag, 
  CreditCard,
  Building2, 
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  FileText,
  Users,
  Megaphone,
  History,
  CheckCircle2,
  PlusCircle,
  AlertCircle,
  X,
  Languages,
  BadgePercent,
  ChevronRight,
  ChevronLeft,
  Clock,
  ShieldAlert,
  RefreshCw,
  MessageCircle,
  Store,
  Plus,
  Send,
  Calendar,
  Ticket,
  Construction,
  Lock,
  Check,
  Gift,
  Target,
  Landmark,
  Truck,
  Heart,
  Globe,
  PhoneCall,
  Utensils,
  Sun,
  Moon,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AMBLogo } from '../AMBLogo';
import SafeDealsEscrowView from '../SafeDealsEscrowView';
import AMBTelecomScreen from '../AMBTelecomScreen';
import SamityScreen from '../SamityScreen';
import SamityRequestForm from '../SamityRequestForm';
import QardScreen from '../QardScreen';
import AgentScreen from '../AgentScreen';
import { QardLiveTicker } from '../QardLiveTicker';
import ProfileView from '../ProfileView';
import { formatBanglaAmount, hasCompletedSamityProfile } from '../../lib/memberUtils';
import MoneyExchangeModule from '../MoneyExchangeModule';
import { AmbMobileBankingPortal } from '../AmbMobileBankingPortal';
import RationCardView from '../RationCardView';
import AmbAutoSalaryPay from '../AmbAutoSalaryPay';
import AmbEducationCenter from '../AmbEducationCenter';
import SmartExchange from '../SmartExchange';
import SafiPremiumShop from '../SafiPremiumShop';
import AmbCorporateGuide from '../AmbCorporateGuide';
import AmbBillPayScreen from '../AmbBillPayScreen';
import AmbAutoRechargeScreen from '../AmbAutoRechargeScreen';
import { useBackHandler } from '../../lib/navigationManager';

const cleanDescription = (desc: string, status?: string): string => {
  if (!desc) return '';
  if (status && status !== 'pending') {
    return desc
      .replace(/s*(অ্যাডমিন অনুমোদনের অপেক্ষায়)।?/g, '')
      .replace(/s*(অ্যাডমিন অনুমোদনের অপেক্ষায়)/g, '')
      .replace(/s*(অ্যাডমিন অনুমোদনের অপেক্ষায়)।?/g, '')
      .replace(/s*(অ্যাডমিন অনুমোদনের অপেক্ষায়)/g, '')
      .replace(/s*(অনুমোদনের অপেক্ষায়)।?/g, '')
      .replace(/s*(অনুমোদনের অপেক্ষায়)/g, '')
      .trim();
  }
  return desc;
};

export interface DashboardSubViewsProps {
  modalType: string | null;
  setModalType: (type: string | null) => void;
  liveUser: User;
  setLiveUser: React.Dispatch<React.SetStateAction<User>>;
  appConfig: AppConfig;
  setAppConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  allUsers: User[];
  allTransactions: Transaction[];
  notices: Notice[];
  setNotices: React.Dispatch<React.SetStateAction<Notice[]>>;
  offers: Offer[];
  products: Product[];
  language: 'bn' | 'en';
  onLogout: () => void;
  [key: string]: any;
}

export const DashboardSubViews = React.memo(function DashboardSubViews(props: DashboardSubViewsProps) {
  if (!props.modalType) return null;

  
  
  const resendSamitySuccess = props.resendSamitySuccess || false;
  const resendSamityLoading = props.resendSamityLoading || false;
  const handleDirectResendSamityRequest = props.handleDirectResendSamityRequest || (() => {});

const {
    modalType,
    setModalType,
    liveUser,
    setLiveUser,
    appConfig,
    setAppConfig,
    transactions,
    setTransactions,
    allUsers,
    allTransactions,
    notices,
    setNotices,
    offers,
    products,
    language,
    onLogout,
  } = props;
  const allNotices = props.allNotices || notices || [];
  const allOffers = props.allOffers || offers || [];
  const allProducts = props.allProducts || products || [];

  const {
    isLocatingUser = false,
    setIsLocatingUser = () => {},
    searchRange = 50,
    setSearchRange = () => {},
    shopSearchTerm = '',
    setShopSearchTerm = () => {},
    shopCategory = 'all',
    setShopCategory = () => {},
    selectedSupplier = null,
    setSelectedSupplier = () => {},
    userLat = null,
    setUserLat = () => {},
    userLng = null,
    setUserLng = () => {},
    userAddress = '',
    setUserAddress = () => {},
    calculateDistance = () => 0,
    toBnDigits = (n: any) => n,
    handleDetectUserLocation = () => {},
    supplierContactProduct = null,
    setSupplierContactProduct = () => {},
    supplierContactMsg = '',
    setSupplierContactMsg = () => {},
    selectedProductForCheckout = null,
    setSelectedProductForCheckout = () => {},
    checkoutQuantity = 1,
    setCheckoutQuantity = () => {},
    checkoutPin = '',
    setCheckoutPin = () => {},
    checkoutDeliveryType = 'delivery',
    setCheckoutDeliveryType = () => {},
    checkoutPaymentMethod = 'wallet',
    setCheckoutPaymentMethod = () => {},
    checkoutLat = null,
    setCheckoutLat = () => {},
    checkoutLng = null,
    setCheckoutLng = () => {},
    checkoutAddress = '',
    setCheckoutAddress = () => {},
    checkoutLocationShared = false,
    setCheckoutLocationShared = () => {},
    checkoutDistance = 0,
    setCheckoutDistance = () => {},
    shopActiveSubTab = 'catalog',
    setShopActiveSubTab = () => {},
    allShopOrders = [],
    setAllShopOrders = () => {},
    handleShopTransferSubmit = () => {},
    shopTransferErr = '',
    setShopTransferErr = () => {},
    shopTransferSucc = '',
    setShopTransferSucc = () => {},
    shopDir = 'to_shop',
    setShopDir = () => {},
    shopTransferAmount = '',
    setShopTransferAmount = () => {},
    shopTransferPin = '',
    setShopTransferPin = () => {},
    shopTransferLoading = false,
    setShopTransferLoading = () => {},
    syncLiveProfile = () => {},
    handleBuyPremiumSafi = () => {},
    expandedNoticeId = null,
    setExpandedNoticeId = () => {},
    noticeSearchQuery = '',
    setNoticeSearchQuery = () => {},
    agentPhone = '',
    setAgentPhone = () => {},
    agentDistrict = '',
    setAgentDistrict = () => {},
    agentExperience = '',
    setAgentExperience = () => {},
    isReapplyingSamity = false,
    setIsReapplyingSamity = () => {},
    hasCompletedSamityProfile = (u: any) => Boolean(u?.samityApproved || u?.isSamityMember),
  } = props;


  // Destructure any other props passed
  const {
    openAdminWithSecret,
    handleSaveProfile,
    handleSaveNominee,
    handleSaveSecurity,
    handleSaveAppLock,
    setShowAppLockModal,
    showAppLockModal,
    handleTransfer,
    handleTelecomRecharge,
    handleDirectDeposit,
    handleDirectWithdraw,
    handleQardApply,
    handleQardRepay,
    handleSamityInstallment,
    handleSamityFullPay,
    handleSamityCancel,
    handleRationApply,
    handleAgentApply,
    handleSafeDealCreate,
    handleSafeDealAccept,
    handleSafeDealComplete,
    handleSafeDealCancel,
    handleCourierBook,
    handleProductOrder,
    handleExchangeSubmit,
    handleSalaryDisburse,
    handleHisabKhataSave,
    selectedYear,
    setSelectedYear,
    activeTab,
    setActiveTab,
    isDarkMode,
    toggleDarkMode,
    t,
    formatAmount,
    ...rest
  } = props;

  return (
    <>
              
                {modalType === 'samity' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    {(
                      (liveUser.role === 'admin' || liveUser.role === 'sub_admin') ||
                      liveUser.samityStatus === 'approved' ||
                      liveUser.samityApproved === true ||
                      liveUser.isSamityMember === true ||
                      hasCompletedSamityProfile(liveUser)
                    ) ? (
                      <SamityScreen
                        user={liveUser}
                        allUsers={allUsers}
                        onBack={() => setModalType(null)}
                        syncLiveProfile={syncLiveProfile}
                        setActiveTab={setActiveTab}
                        setModalType={setModalType}
                        appConfig={appConfig}
                        allNotices={allNotices}
                        transactions={allTransactions || transactions || []}
                      />
                    ) : ((liveUser.samityStatus === 'pending' || Boolean(liveUser.samityAppliedAt)) && !isReapplyingSamity) ? (
                      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
                        <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-xl mt-6 text-left">
                          <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-white relative overflow-hidden">
                            <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
                            <button 
                              onClick={() => {
                                setModalType(null);
                                setIsReapplyingSamity(false);
                              }}
                              className="mb-4 flex items-center gap-1.5 text-xs text-amber-50 hover:text-white transition bg-amber-700/40 p-2 py-1 rounded-lg cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              বাহির হোন
                            </button>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                                <Clock className="w-6 h-6 animate-spin" style={{ animationDuration: '4s' }} />
                              </div>
                              <div>
                                <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">সমিতি মেম্বারশিপ আবেদন পেন্ডিং</h1>
                                <p className="text-[10.5px] text-amber-100 mt-1 font-medium font-sans">আপনার আবেদনটি বর্তমানে এডমিন এবং ট্রাস্টি বোর্ডের সক্রিয় বিবেচনায় রয়েছে</p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6 space-y-5 text-slate-700">
                            {resendSamitySuccess && (
                              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-emerald-900 font-bold text-xs animate-fadeIn">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                <p>{resendSamitySuccess}</p>
                              </div>
                            )}

                            <div className="bg-amber-50/55 border border-amber-200/50 p-4 rounded-2.5xl flex items-start gap-3">
                              <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                              <div className="text-[11px] leading-relaxed font-sans font-bold text-amber-900">
                                <p className="text-xs font-black">📢 আবেদনটি বর্তমানে পেন্ডিং আছে (Pending Approval)</p>
                                <p className="mt-1 text-amber-805 font-medium font-sans">আপনার সমিতির সদস্যপদ আবেদনটি ডাটাবেজে পেন্ডিং হিসেবে আছে। আপনি চাইলে তথ্য পরিবর্তন করে আবার সাবমিট করতে পারেন অথবা সরাসরি এডমিন প্যানেলে আবেদন রিসেন্ড করতে পারেন।</p>
                              </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-150 rounded-2.5xl p-4.5 space-y-3">
                              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" /> প্রেরিত আবেদনের তথ্যাদিঃ
                              </h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-sans">
                                <div>
                                  <span className="text-slate-400 font-semibold block">আবেদনকারীর নামঃ</span>
                                  <p className="text-slate-800 font-black">{liveUser.name}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-semibold block">সদস্য আইডি (Member ID):</span>
                                  <p className="text-emerald-800 font-black font-mono">{liveUser.memberId}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-semibold block">মোবাইল নম্বরঃ</span>
                                  <p className="text-slate-700 font-bold font-mono">{liveUser.phone}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-semibold block">স্থায়ী দেশ (Country):</span>
                                  <p className="text-slate-700 font-bold">{liveUser.country || 'Bangladesh'}</p>
                                </div>
                                {liveUser.monthlySavingsTarget && (
                                  <div>
                                    <span className="text-slate-400 font-semibold block">মনোনীত মাসিক সঞ্চয় কিস্তিঃ</span>
                                    <p className="text-indigo-700 font-extrabold font-mono">৳ {liveUser.monthlySavingsTarget.toLocaleString('bn-BD')} BDT</p>
                                  </div>
                                )}
                                <div>
                                  <span className="text-slate-400 font-semibold block">আবেদনের তারিখঃ</span>
                                  <p className="text-slate-600 font-sans font-bold">
                                    {liveUser.samityAppliedAt ? new Date(liveUser.samityAppliedAt).toLocaleString('bn-BD') : 'উপাত্ত নেই'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <p className="text-[10px] text-slate-400 text-center">
                              *ভেরিফিকেশন সম্পন্ন হতে সাধারণত 1 থেকে 12 ঘন্টা পর্যন্ত সময় লাগতে পারে।*
                            </p>

                            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
                              <button
                                onClick={() => setIsReapplyingSamity(true)}
                                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold hover:from-emerald-700 hover:to-teal-700 active:scale-98 transition text-center cursor-pointer shadow-md flex items-center justify-center gap-2"
                              >
                                <FileText className="w-4 h-4" />
                                📝 তথ্য সংশোধন ও নতুন করে আবেদন জমা দিন (Edit & Resubmit)
                              </button>

                              <button
                                onClick={handleDirectResendSamityRequest}
                                disabled={resendSamityLoading}
                                className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold active:scale-98 transition text-center cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                <RefreshCw className={`w-4 h-4 ${resendSamityLoading ? 'animate-spin' : ''}`} />
                                {resendSamityLoading ? 'এডমিন প্যানেলে পাঠানো হচ্ছে...' : '⚡ এডমিন প্যানেলে আবেদন রিসেন্ড / রিফ্রেশ করুন (Instant Resend to Admin)'}
                              </button>

                              <button
                                onClick={() => {
                                  setModalType(null);
                                  setIsReapplyingSamity(false);
                                }}
                                className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition text-center cursor-pointer"
                              >
                                ড্যাশবোর্ডে ফিরে যান (Return Home)
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : liveUser.samityStatus === 'rejected' ? (
                      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
                        <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-xl mt-6 text-left">
                          <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-6 text-white relative overflow-hidden">
                            <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
                            <button 
                              onClick={() => {
                                setModalType(null);
                                setIsReapplyingSamity(false);
                              }}
                              className="mb-4 flex items-center gap-1.5 text-xs text-rose-50 hover:text-white transition bg-rose-700/40 p-2 py-1 rounded-lg cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              বাহির হোন
                            </button>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                                <AlertCircle className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">সমিতি সদস্যপদ আবেদন প্রত্যাখ্যাত</h1>
                                <p className="text-[10.5px] text-rose-100 mt-1 font-medium font-sans">দুঃখিত! আপনার মেম্বারশিপ আবেদনটি অফিস কর্তৃক বাতিল করা হয়েছে।</p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6 space-y-5 text-slate-700">
                            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2.5xl flex items-start gap-3">
                              <ShieldAlert className="w-5 h-5 text-rose-650 mt-0.5 shrink-0" />
                              <div className="text-[11px] leading-relaxed font-sans font-bold text-rose-950">
                                <p className="text-xs font-black">❌ আবেদন বাতিলের কারণঃ</p>
                                <p className="mt-1 text-rose-800 font-extrabold text-[12px] bg-white border border-rose-100 px-3 py-2 rounded-xl mt-1 leading-normal font-sans">
                                  {liveUser.samityRejectReason || 'প্রদত্ত তথ্যের অমিল বা অসম্পূর্ণ নমিনি ডকুমেন্টস এর কারণে আপনার আবেদনটি বাতিল করা হয়েছে। সঠিক তথ্য প্রদান করে পুনরায় আবেদন করুন।'}
                                </p>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={async () => {
                                  try {
                                    const userRef = doc(db, 'users', liveUser.uid);
                                    await updateDoc(userRef, {
                                      samityStatus: 'none',
                                      samityRejectReason: ''
                                    });
                                    await syncLiveProfile();
                                  } catch (e) {
                                    console.error('Error resetting samity status:', e);
                                  }
                                }}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold hover:from-emerald-700 hover:to-teal-700 active:scale-98 transition text-center cursor-pointer shadow-md shadow-emerald-50"
                              >
                                📝 নতুন করে পুনরায় আবেদন করুন
                              </button>
                              <button
                                onClick={() => {
                                  setModalType(null);
                                  setIsReapplyingSamity(false);
                                }}
                                className="flex-1 px-4 py-3 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 active:scale-98 transition text-center cursor-pointer"
                              >
                                ফিরে যান
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 sm:p-6">
                        <SamityRequestForm
                          user={liveUser}
                          appConfig={appConfig}
                          onClose={() => {
                            setModalType(null);
                            setIsReapplyingSamity(false);
                          }}
                          onSubmitSuccess={async () => {
                            setIsReapplyingSamity(false);
                            await syncLiveProfile();
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
                {modalType === 'telecom' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <AMBTelecomScreen
                      user={liveUser}
                      allOffers={allOffers}
                      onBack={() => setModalType(null)}
                      syncLiveProfile={syncLiveProfile}
                      onOpenDeposit={() => {
                        setModalType('deposit');
                      }}
                      appConfig={appConfig}
                      allNotices={allNotices}
                    />
                  </div>
                )}
                {modalType === 'qard' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <QardScreen
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      syncLiveProfile={async () => {
                        await syncLiveProfile();
                      }}
                      appConfig={appConfig}
                    />
                  </div>
                )}
                {modalType === 'safedeals' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <SafeDealsEscrowView 
                      liveUser={liveUser} 
                      syncLiveProfile={syncLiveProfile} 
                      appConfig={appConfig} 
                      onBack={() => setModalType(null)}
                      allNotices={allNotices}
                    />
                  </div>
                )}
                {modalType === 'agent' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-[#FAFDFB] w-full h-full min-h-screen font-sans">
                    <AgentScreen
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      appConfig={appConfig}
                    />
                  </div>
                )}
                {modalType === 'bank' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <div className="bg-slate-50 min-h-screen flex flex-col relative text-slate-800">
                      <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md shadow-xs w-full">
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setModalType(null)}
                            className="p-2 bg-white border border-slate-150 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer flex items-center justify-center shadow-3xs"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <div>
                            <h1 className="text-sm font-black flex items-center gap-1.5 text-emerald-700 font-sans">
                              <Landmark className="w-4.5 h-4.5 text-emerald-700" />
                              BNB সমবায় ব্যাংক লিঃ
                            </h1>
                            <p className="text-[9.5px] text-slate-400 uppercase tracking-widest font-mono font-bold">
                              ডিজিটাল রেমিট্যান্স, ক্যাশ আউট ও মোবাইল ব্যাংকিং কোর গেটওয়ে
                            </p>
                          </div>
                        </div>

                        {/* Balance display in header */}
                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-xl shadow-3xs">
                          <span className="text-[9px] text-emerald-800 font-extrabold uppercase">ওয়ালেট ব্যালেন্সঃ</span>
                          <strong className="text-xs font-black text-emerald-950 font-mono">৳ {(liveUser.balance || 0).toLocaleString('bn-BD')}</strong>
                        </div>
                      </header>

                      <div className="p-2 md:p-6 w-full flex-1 pb-16">
                        <AmbMobileBankingPortal 
                          user={liveUser}
                          onClose={() => setModalType(null)}
                          syncLiveProfile={syncLiveProfile}
                          appConfig={appConfig}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {modalType === 'shop' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <div className="bg-slate-50 min-h-screen flex flex-col relative text-slate-800">
                      <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md shadow-xs w-full">
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setModalType(null)}
                            className="p-2 bg-white border border-slate-150 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer flex items-center justify-center shadow-3xs"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <div>
                            <h1 className="text-sm font-black flex items-center gap-1.5 text-orange-600 font-sans">
                              <ShoppingBag className="w-4.5 h-4.5 text-orange-600" />
                              বিবিজি সুপার শপ সেভিং খাতা (Co-op Mini Market)
                            </h1>
                            <p className="text-[9.5px] text-slate-400 uppercase tracking-widest font-mono font-bold">
                              আমানত সঞ্চয় ও পণ্য ক্রয় পোর্টাল
                            </p>
                          </div>
                        </div>

                        {/* Balance display in header */}
                        <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 px-3 py-1 rounded-xl shadow-3xs">
                          <span className="text-[9px] text-orange-800 font-extrabold uppercase">শপ ব্যালেন্সঃ</span>
                          <strong className="text-xs font-black text-orange-950 font-mono">৳ {(liveUser.superShopBalance || 0).toLocaleString('bn-BD')}</strong>
                        </div>
                      </header>

                      {/* Navigation tabs for Super Shop Systems */}
                      <div className="bg-white border-b border-slate-250/75 sticky top-[61px] z-30 px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none w-full shadow-3xs">
                        {[
                          { id: 'products', name: '🛍️ পণ্য সম্ভার', desc: 'মিনি মার্কেট ক্যাটালগ' },
                          { id: 'rules', name: '📋 শপের নিয়মাবলী', desc: 'অপারেটিং সিস্টেম' },
                          { id: 'orders', name: '📦 আমার অর্ডার ট্র্যাক', desc: 'লাইভ ডেলিভারি খতিয়ান' },
                          { id: 'transfer', name: '💰 ওয়ালেট ট্রান্সফার', desc: 'ইনস্ট্যান্ট ফান্ড স্থানান্তর' }
                        ].map((subTab, idx) => (
                          <button
                            key={`${subTab.id}-${idx}`}
                            type="button"
                            onClick={() => {
                              setShopActiveSubTab(subTab.id as any);
                              setShopTransferErr('');
                              setShopTransferSucc('');
                            }}
                            className={`flex flex-col items-start px-3.5 py-1.5 rounded-xl border transition text-left cursor-pointer shrink-0 min-w-[125px] ${
                              shopActiveSubTab === subTab.id
                                ? 'bg-orange-55/80 border-orange-200 text-orange-950 font-black shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/90'
                            }`}
                          >
                            <span className="text-[10px] leading-tight flex items-center gap-1">{subTab.name}</span>
                            <span className={`text-[7px] leading-none mt-1 tracking-tight font-extrabold uppercase ${
                              shopActiveSubTab === subTab.id ? 'text-orange-700' : 'text-slate-400'
                            }`}>{subTab.desc}</span>
                          </button>
                        ))}
                      </div>

                      <div className="p-4 md:p-8 max-w-2xl mx-auto w-full flex-1 pb-16">
                        {/* 1. PRODUCTS TAB */}
                        {shopActiveSubTab === 'products' && (() => {
                          const shopProducts = allProducts;
                          const filteredShopProducts = shopProducts.filter(item => {
                            const matchesSearch = item.name.toLowerCase().includes(shopSearchTerm.toLowerCase()) || 
                                                  item.description.toLowerCase().includes(shopSearchTerm.toLowerCase()) ||
                                                  item.supplier.toLowerCase().includes(shopSearchTerm.toLowerCase());
                            const matchesCategory = shopCategory === 'all' || item.category === shopCategory;
                            
                            if (userLat && userLng && searchRange < 99999) {
                              const prodLat = item.latitude !== undefined ? item.latitude : 23.7915;
                              const prodLng = item.longitude !== undefined ? item.longitude : 90.2311;
                              const dist = calculateDistance(userLat, userLng, prodLat, prodLng);
                              return matchesSearch && matchesCategory && dist <= searchRange;
                            }
                            
                            return matchesSearch && matchesCategory;
                          });

                          return (
                            <div className="space-y-4 animate-fade-in text-left">
                              {/* Store banner notice */}
                              <div className="bg-amber-50/70 border border-amber-200/65 py-2.5 px-4 rounded-2xl flex justify-between items-center">
                                <div className="text-xs text-amber-900 font-bold flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                  সুপার শপ কারেন্ট ব্যালেন্স
                                </div>
                                <span className="font-mono text-xs font-black text-amber-950">৳ {(liveUser.superShopBalance || 0).toLocaleString('bn-BD')}</span>
                              </div>

                              <p className="text-[10px] text-slate-500 font-semibold leading-normal">
                                🛒 আপনার সুপার শপ ওয়ালেট ব্যালেন্স হতে আন্তর্জাতিক ও দেশীয় ভেরিফাইড পাইকারি ও খুচরা সরবরাহকারীদের থেকে সরাসরি পণ্য অর্ডার করতে পারবেন।
                              </p>

                              {/* Smart GPS Locator Panel */}
                              <div className="bg-rose-50/50 border border-rose-100 rounded-3xl p-4 space-y-3 shadow-3xs">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-[11px] font-black text-rose-955 flex items-center gap-1.5 uppercase">
                                    📍 আমার লোকেশন (Smart GPS Locator)
                                  </h4>
                                  <span className="bg-rose-150 text-rose-900 font-black px-1.5 py-0.2 rounded-sm text-[8px] uppercase tracking-wide">
                                    Auto Location Detection
                                  </span>
                                </div>

                                {userLat && userLng ? (
                                  <div className="space-y-2">
                                    <div className="p-3 bg-white border border-rose-150 rounded-2xl text-[11px] space-y-1 shadow-4xs">
                                      <p className="text-[9px] font-bold text-slate-405 uppercase tracking-wider">আমার বর্তমান লাইভ জিপিএস ঠিকানাঃ</p>
                                      <p className="text-[11.5px] font-black text-slate-850 leading-normal">
                                        {userAddress || "লোকেশন সনাক্ত হচ্ছে..."}
                                      </p>
                                      <p className="text-[9px] font-mono font-bold text-rose-800">
                                        কোঅর্ডিনেটসঃ {userLat.toFixed(5)}, {userLng.toFixed(5)}
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={handleDetectUserLocation}
                                        disabled={isLocatingUser}
                                        className="flex-1 py-1.5 border border-rose-200 hover:bg-rose-50/50 text-rose-800 rounded-xl text-[10px] font-black transition cursor-pointer text-center"
                                      >
                                        {isLocatingUser ? '⏳ খোঁজা হচ্ছে...' : '🔄 লোকেশন রিফ্রেশ করুন'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setUserLat(null);
                                          setUserLng(null);
                                          setUserAddress('');
                                        }}
                                        className="py-1.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black transition cursor-pointer text-center"
                                      >
                                        মুছুন ✕
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-[10px] text-slate-500 font-semibold leading-normal">
                                      ম্যানুয়ালি বিভাগ, জেলা বা উপজেলা নির্বাচন করার ঝামেলা নেই। জিপিএস ব্যবহার করে অটোমেটিক আপনার আশেপাশের 100% সঠিক লোকেশন ট্র্যাক করুন।
                                    </p>
                                    <button
                                      type="button"
                                      onClick={handleDetectUserLocation}
                                      disabled={isLocatingUser}
                                      className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-black transition active:scale-98 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      {isLocatingUser ? (
                                        <>
                                          <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                          জিপিএস লোকেশন সনাক্ত হচ্ছে...
                                        </>
                                      ) : (
                                        <>
                                          <span>📍 আমার লোকেশন (Use My Location)</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}

                                {/* Search Range Selector segment */}
                                <div className="space-y-1.5 border-t border-rose-100/60 pt-3">
                                  <label className="text-[9.5px] font-extrabold text-slate-505 uppercase block">আশেপাশের সার্চ রেঞ্জ নির্বাচন করুনঃ</label>
                                  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                                    {[
                                      { val: 0.5, label: '500মি' },
                                      { val: 1.0, label: '1 কিমি' },
                                      { val: 3.0, label: '3 কিমি' },
                                      { val: 5.0, label: '5 কিমি' },
                                      { val: 10.0, label: '10 কিমি' },
                                      { val: 25.0, label: '25 কিমি' },
                                      { val: 50.0, label: '50 কিমি' },
                                      { val: 99999, label: 'সব দূরত্ব' }
                                    ].map((r, idx) => (
                                      <button
                                        key={r.val}
                                        type="button"
                                        onClick={() => setSearchRange(r.val)}
                                        className={`py-1 px-2.5 rounded-lg text-[9.5px] font-black transition whitespace-nowrap border shrink-0 cursor-pointer ${
                                          searchRange === r.val
                                            ? 'bg-rose-850 text-white border-transparent shadow-3xs'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-55'
                                        }`}
                                      >
                                        {r.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Search Bar */}
                              <div className="relative shadow-3xs">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10.5px]">
                                  🔍
                                </span>
                                <input
                                  type="text"
                                  value={shopSearchTerm}
                                  onChange={(e) => setShopSearchTerm(e.target.value)}
                                  placeholder="পণ্য, বা সরবরাহকারী প্রতিষ্ঠান খুঁজুন..."
                                  className="pl-9 pr-3 py-2 w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                />
                              </div>

                              {/* Categories Selector list */}
                              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                                {[
                                  { id: 'all', label: 'সব প্রোডাক্ট' },
                                  ...(appConfig?.shopCategories || [
                                    { id: 'honey', label: '🍯 মধু ও মৌচাক' },
                                    { id: 'oil_ghee', label: '🍶 খাঁটি তেল ও ঘি' },
                                    { id: 'dates', label: '🧆 মিষ্টি খেজুর' },
                                    { id: 'spices', label: '🌶️ খাঁটি মসলা' },
                                    { id: 'nuts_seeds', label: '🥜 বাদাম ও বীজ' }
                                  ])
                                ].map((cat, idx) => (
                                  <button
                                    key={`${cat.id}-${idx}`}
                                    type="button"
                                    onClick={() => setShopCategory(cat.id)}
                                    className={`py-1 px-3 rounded-lg text-[10px] font-black transition whitespace-nowrap border shrink-0 cursor-pointer ${
                                      shopCategory === cat.id
                                        ? 'bg-orange-850 text-white border-transparent'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {cat.label}
                                  </button>
                                ))}
                              </div>

                              {/* Supplier profile display if selected */}
                              {selectedSupplier && (() => {
                                const supplierDetails = {
                                  "Sundarban API Co.": {
                                    banner: "🍯 सुंदरबन एपीআই কোং - শতভাগ খাঁটি মধু সরবরাহকারী",
                                    motto: "প্রাকৃতিক চাকের খাঁটি খলিশা ও গরান ফুলের মধু",
                                    description: "সুন্দরবনের গহীন অরণ্য থেকে সরাসরি সংগৃহীত প্রাকৃতিক মধু। কোনো কৃত্রিম প্রিজারভেটিভ বা চিনি ছাড়া শতভাগ খাঁটি গুণগত মান বজায় রাখতে আমরা অঙ্গীকারবদ্ধ।",
                                    rating: "5.0 ★ (গোল্ড সেলার)",
                                    year: "স্থাপিতঃ 2019",
                                    category: "মধু ও মৌচাক"
                                  },
                                  "Pabna Sweet Dairy": {
                                    banner: "🍶 পাবনা সুইট ডেইরি - ঐতিহ্যবাহী খাঁটি ঘি প্রস্তুতকারক",
                                    motto: "গরুর দুধের খাঁটি সর ও ঐতিহ্যবাহী সুস্বাদু ঘি",
                                    description: "পাবনার ঐতিহ্যবাহী ঘোষ পরিবারের বিশ্বস্ত রেসিপিতে তৈরি গাওয়া ঘি। দুধের সর থেকে মন্থন করে শতভাগ হাইজেনিক পরিবেশে প্রস্তুতকৃত সুবাসে অনন্য খাঁটি ঘি।",
                                    rating: "4.9 ★ (টপ রেটেড)",
                                    year: "স্থাপিতঃ 2015",
                                    category: "খাঁটি তেল ও ঘি"
                                  },
                                  "Rajshahi Oil Mills": {
                                    banner: "🌱 রাজশাহী অয়েল মিলস - ঘানির সরিষার তেল ও মসলা",
                                    motto: "কাঠের ঘানিতে ভাঙানো প্রথম চাপের শতভাগ খাঁটি সরিষার তেল",
                                    description: "সেরা মানের দেশি সরিষা বীজ থেকে কাঠের ঘানিতে মৃদু চাপে নিষ্কাশিত সরিষার তেল। ঝাঁঝালো খাঁটি স্বাদ ও ওষধি গুণাগুণ অক্ষুণ্ণ রেখে বোতলজাত করা হয়।",
                                    rating: "4.8 ★ (ভেরিফাইড)",
                                    year: "স্থাপিতঃ 2021",
                                    category: "খাঁটি তেল ও ঘি"
                                  },
                                  "Nator Honey Farms": {
                                    banner: "🐝 নাটোর হানি ফার্মস - কালোজিরা ও লিচু ফুলের মধু",
                                    motto: "স্বাস্থ্যসম্মত ও পুষ্টিকর খামারের প্রাকৃতিক মধু",
                                    description: "নাটোরের ঐতিহ্যবাহী কালোজিরা ও লিচু চাষের মাঠ থেকে সংগৃহীত। উন্নত বৈজ্ঞানিক উপায়ে মধু নিষ্কাশন ও প্রক্রিয়াকরণ যা প্রাকৃতিক পুষ্টিগুণ ধরে রাখে।",
                                    rating: "5.0 ★ (গোল্ড মেম্বার)",
                                    year: "স্থাপিতঃ 2020",
                                    category: "মধু ও মৌচাক"
                                  },
                                  "Kenya Wild Imports": {
                                    banner: "🇰🇪 কেনিয়া ওয়াইল্ড ইমপোর্টস - বুনো অর্গানিক মধু",
                                    motto: "আফ্রিকার চিরহরিৎ বনাঞ্চলের বুনো মোচাকের মধু",
                                    description: "আফ্রিকার প্রত্যন্ত বনভূমি থেকে আমদানিকৃত বিশ্বমানের অর্গানিক মধু। কড়া সুগন্ধ ও গাঢ় স্বাদের জন্য বিশ্বজুড়ে সমাদৃত অনন্য প্রাকৃতিক খাদ্য উপাদান।",
                                    rating: "4.7 ★ (ইন্টারন্যাশনাল সেলার)",
                                    year: "স্থাপিতঃ 2018",
                                    category: "মধু ও মৌচাক"
                                  },
                                  "Tehran Palm Orchard": {
                                    banner: "🌴 তেহরান পাম অরণ্য - প্রিমিয়াম ইরানি মরিয়ম খেজুর",
                                    motto: "ইরানের ঐতিহ্যবাহী পাম বাগান থেকে আমদানিকৃত সেরা খেজুর",
                                    description: "শতভাগ প্রিমিয়াম বড় সাইজের ইরানি মরিয়ম খেজুর। নরম, মিষ্টি ও সুস্বাদু। ইরানের পাম বাগান থেকে সরাসরি সংগ্রহ করে সর্বোচ্চ স্বাস্থ্যবিধি মেনে বোতলজাত করা হয়।",
                                    rating: "5.0 ★ (ভেরিফাইড)",
                                    year: "স্থাপিতঃ 2017",
                                    category: "মিষ্টি খেজুর"
                                  }
                                };

                                const details = supplierDetails[selectedSupplier] || {
                                  banner: "🏬 সরবরাহকারী প্রোফাইল",
                                  motto: "গ্রুপ বাই ও সেভিং ডিল অংশীদার",
                                  description: "বিবিজি সুপার শপের বিশ্বস্ত রেজিস্টার্ড সরবরাহকারী অংশীদার।",
                                  rating: "5.0 ★",
                                  year: "স্থাপিতঃ 2020",
                                  category: "জেনারেল"
                                };

                                return (
                                  <div className="bg-orange-50/60 border border-orange-150 rounded-2xl p-4 text-left space-y-3 shadow-3xs animate-fade-in relative">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedSupplier(null)}
                                      className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 font-bold text-xs"
                                    >
                                      বন্ধ করুন ✕
                                    </button>
                                    <div className="space-y-1">
                                      <h3 className="text-xs font-black text-orange-950 flex items-center gap-1.5 uppercase">
                                        🏬 {selectedSupplier}
                                      </h3>
                                      <p className="text-[10px] text-slate-500 font-bold">{details.banner}</p>
                                      <p className="text-[9.5px] text-orange-850 font-black italic">"{details.motto}"</p>
                                      <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">{details.description}</p>
                                      <div className="flex gap-4 text-[9px] text-slate-400 font-bold pt-1">
                                        <span>রেটিংঃ {details.rating}</span>
                                        <span>প্রতিষ্ঠাকালঃ {details.year}</span>
                                        <span>বিভাগঃ {details.category}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Product Grid */}
                              {filteredShopProducts.length === 0 ? (
                                <div className="py-12 text-center text-slate-450 text-xs font-bold bg-white rounded-2xl border border-dashed border-slate-200">
                                  😞 কোনো পণ্য পাওয়া যায়নি! অনুগ্রহ করে অন্য কি-ওয়ার্ড বা সার্চ রেঞ্জ চেষ্টা করুন।
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 gap-3.5">
                                  {filteredShopProducts.map((item, idx) => (
                                    <div key={`${item.id}-${idx}`} className="p-4 bg-white border border-slate-150 hover:border-orange-500/40 rounded-2xl flex flex-col gap-3 text-left transition shadow-xs">
                                      {/* Supplier Credentials Header */}
                                      <div className="flex justify-between items-center border-b border-slate-100 pb-2 text-[9px] text-slate-450 font-bold">
                                        <div className="flex items-center gap-1">
                                          <span className="text-[12px]">{item.flag}</span>
                                          <span className="text-slate-705 truncate max-w-[120px]">{item.supplier}</span>
                                          <span className="bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded-xs uppercase tracking-wider text-[7px] font-black">Verified</span>
                                        </div>
                                        
                                        {userLat && userLng ? (
                                          (() => {
                                            const pLat = item.latitude !== undefined ? item.latitude : 23.7915;
                                            const pLng = item.longitude !== undefined ? item.longitude : 90.2311;
                                            const d = calculateDistance(userLat, userLng, pLat, pLng);
                                            return (
                                              <span className="text-rose-700 bg-rose-55 px-1.5 py-0.5 rounded-md font-extrabold flex items-center gap-0.5 whitespace-nowrap">
                                                📍 {toBnDigits(d.toFixed(1))} কিমি দূরে
                                              </span>
                                            );
                                          })()
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={handleDetectUserLocation}
                                            className="text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-1.5 py-0.5 rounded-md font-black flex items-center gap-0.5 transition cursor-pointer text-[8.5px]"
                                          >
                                            📍 দূরত্ব মাপুন
                                          </button>
                                        )}
                                      </div>

                                      {/* Main Item details frame */}
                                      <div className="flex items-start gap-3">
                                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 text-3xl rounded-xl flex items-center justify-center shrink-0 shadow-inner select-none">
                                          {item.icon}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                          <h4 className="text-xs font-black text-slate-900 leading-tight">{item.name}</h4>
                                          <p className="text-[10px] text-slate-500 leading-snug font-medium">{item.description}</p>
                                          
                                          {/* Star Rating snippet */}
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-amber-500 text-[10px]">★</span>
                                            <span className="text-[10px] text-slate-700 font-extrabold">{item.rating}</span>
                                            <span className="text-[9px] text-slate-400 font-bold">({Math.floor(item.rating * 10 - 2)} রিভিউ)</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Price points and MOQ details */}
                                      <div className="flex justify-between items-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                                        <div>
                                          <p className="text-[8px] text-slate-400 uppercase font-black leading-none">কো-অপারেティブ পাইকারি মূল্য</p>
                                          <p className="text-sm font-black text-rose-800 font-mono mt-0.5">৳ {item.price.toLocaleString('bn-BD')}</p>
                                        </div>
                                        <div className="text-right text-[9px] text-slate-500 font-bold leading-normal">
                                          <p>ন্যূনতম অর্ডারঃ <strong className="text-slate-800">{item.minOrder}</strong></p>
                                          <p>শিপিং সময়ঃ <strong className="text-slate-800">{item.shipTime}</strong></p>
                                        </div>
                                      </div>

                                      {/* Supplier and order action buttons */}
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSupplierContactProduct(item);
                                            setSupplierContactMsg(`সম্মানিত সরবরাহকারী, আমি "${item.name}" প্রোডাক্টটি ক্রয়ে আগ্রহী। এটার কাস্টম ব্র্যান্ডিং এবং বাল্ক ডিসকাউন্ট সম্পর্কে বিস্তারিত জানতে চাচ্ছি।`);
                                          }}
                                          className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-black rounded-lg transition text-center cursor-pointer font-sans"
                                        >
                                          📨 Contact Supplier
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedProductForCheckout(item);
                                            setCheckoutQuantity(1);
                                            setCheckoutPin('');
                                            setCheckoutDeliveryType('home');
                                            setCheckoutPaymentMethod('cod');
                                            if (userLat && userLng) {
                                              setCheckoutLat(userLat);
                                              setCheckoutLng(userLng);
                                              setCheckoutAddress(userAddress || '');
                                              setCheckoutLocationShared(true);
                                              const pLat = item.latitude !== undefined ? item.latitude : 23.7915;
                                              const pLng = item.longitude !== undefined ? item.longitude : 90.2311;
                                              const d = calculateDistance(userLat, userLng, pLat, pLng);
                                              setCheckoutDistance(parseFloat(Math.max(0.1, d).toFixed(2)));
                                            } else {
                                              setCheckoutDistance(1.5);
                                              setCheckoutAddress('');
                                              setCheckoutLocationShared(false);
                                              setCheckoutLat(null);
                                              setCheckoutLng(null);
                                            }
                                          }}
                                          className="flex-1 py-1.5 bg-orange-700 hover:bg-orange-850 active:bg-orange-900 text-white text-[10px] font-black rounded-lg transition shadow-sm text-center cursor-pointer shadow-orange-705/10 font-sans"
                                        >
                                          🛍️ অর্ডার করুন
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Supplier message delivery popup */}
                              {supplierContactProduct && (
                                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
                                  <div className="bg-white rounded-3xl p-5 max-w-[280px] w-full border border-slate-100 shadow-xl space-y-3.5">
                                    <h3 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2">
                                      সরবরাহকারীঃ {supplierContactProduct.supplier}
                                    </h3>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-semibold mb-1">আপনার কাস্টম মেসেজ টাইপ করুনঃ</p>
                                      <textarea
                                        value={supplierContactMsg}
                                        onChange={(e) => setSupplierContactMsg(e.target.value)}
                                        rows={4}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[10px] text-slate-707 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setSupplierContactProduct(null)}
                                        className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg transition"
                                      >
                                        বন্ধ করুন
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          alert(`আপনার কাস্টম অনুসন্ধান বার্তাটি সরবরাহকারী প্রতিষ্ঠান "${supplierContactProduct.supplier}" এর গ্লোবাল ইনবক্সে প্রেরণ করা হয়েছে। সরবরাহকারী প্রতিষ্ঠানটি কয়েক ঘন্টার মধ্যে আপনার আইডিতে আপডেট পাঠাবে!`);
                                          setSupplierContactProduct(null);
                                        }}
                                        className="flex-1 py-2 bg-orange-700 hover:bg-orange-850 text-white text-[10px] font-bold rounded-lg transition"
                                      >
                                        বার্তার পাঠান
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* 2. RULES TAB */}
                        {shopActiveSubTab === 'rules' && (
                          <div className="space-y-4 font-sans text-xs text-slate-800 animate-fade-in text-left">
                            <h3 className="text-xs font-black text-slate-900 border-b border-slate-150 pb-2 flex items-center gap-1.5 uppercase">
                              📜 সুপার শপ ও গ্রুপ বাই ডিল নীতিমালা
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-3xs leading-relaxed">
                              <div className="space-y-2">
                                <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                  1. সরাসরি পাইকারি সরবরাহকারী চুক্তি
                                </h4>
                                <p className="text-[10px] text-slate-600 font-semibold pl-2.5">
                                  বিবিজি সুপার শপের সকল পণ্য সরাসরি উৎপাদক বা প্রথম শ্রেণীর আমদানিকারক হতে সংগৃহীত। কোনো প্রকার ভেজাল পণ্য প্রমাণিত হলে শতভাগ রিফান্ডের নিশ্চয়তা প্রদান করা হয়।
                                </p>
                              </div>

                              <div className="space-y-2">
                                <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                  2. ওয়ালেট পেমেন্ট ও অটোমেটিক ডেবিট সিস্টেম
                                </h4>
                                <p className="text-[10px] text-slate-600 font-semibold pl-2.5">
                                  অর্ডার করার সময় আপনার মেইন ওয়ালেট বা সুপার শপ ওয়ালেট থেকে পণ্য এবং আনুমানিক ডেলিভারি ফি ডেবিট করা হবে। রিজেক্ট বা পণ্য সংকটের ক্ষেত্রে সমপরিমাণ অর্থ ওয়ালেটে টাকা ফেরত দেওয়া হবে।
                                </p>
                              </div>

                              <div className="space-y-2">
                                <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                  3. জিপিএস হোম ডেলিভারি ও রুট ম্যাপ
                                </h4>
                                <p className="text-[10px] text-slate-600 font-semibold pl-2.5">
                                  আমরা লাইভ গুগল ম্যাপ ও জিপিএস কোঅর্ডিনেট ব্যবহার করে নিখুঁতভাবে পণ্য ডেলিভারি করি। গ্রাহক চাইলে গুগল ম্যাপ লিংকে ক্লিক করে ডেলিভারি রুট ট্র্যাকিং দেখতে পারবেন।
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3. ORDERS TAB */}
                        {shopActiveSubTab === 'orders' && (
                          <div className="space-y-4 animate-fade-in text-left text-xs text-slate-800">
                            <h3 className="text-xs font-black text-slate-900 border-b border-slate-150 pb-2 flex items-center gap-1.5 uppercase">
                              📦 আপনার সাম্প্রতিক শপ অর্ডার ট্র্যাকিং খতিয়ান
                            </h3>
                            
                            {allShopOrders.length === 0 ? (
                              <div className="py-12 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-150 shadow-3xs">
                                😞 এখনও কোনো শপ অর্ডার করেননি!
                              </div>
                            ) : (
                              <div className="space-y-3.5">
                                {allShopOrders.map((orderedItem, idx) => (
                                  <div key={`${orderedItem.id}-${idx}`} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs text-left text-xs text-slate-850 space-y-2.5">
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                                      <div>
                                        <span className="bg-orange-100 text-orange-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{orderedItem.status || 'Processing'}</span>
                                        <p className="text-[9px] text-slate-400 font-mono font-bold mt-0.5">অর্ডারঃ {orderedItem.id}</p>
                                      </div>
                                      <span className="font-mono text-[10px] font-black text-slate-450">{new Date(orderedItem.createdAt).toLocaleDateString('bn-BD')}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1.5 text-[10px] text-slate-650">
                                      <div>
                                        <span className="text-slate-400 font-bold">পণ্য ও পরিমাণঃ</span> <span className="text-slate-900 font-extrabold">{orderedItem.productName} x {orderedItem.quantity} পিস</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 font-bold">ডেলিভারি ধরনঃ</span> <span className="text-slate-850 font-bold">{orderedItem.deliveryType === 'pickup' ? '🏪 দোকান সংগ্রহ' : '🚚 হোম ডেলিভারি'}</span>
                                      </div>
                                      {orderedItem.deliveryType !== 'pickup' && (
                                        <>
                                          <div>
                                            <span className="text-slate-400 font-bold">নির্ধারিত দূরত্বঃ</span> <span className="text-slate-805 font-mono font-bold">{(orderedItem.deliveryDistance || 1.5).toFixed(1)} কিমি</span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400 font-bold">সম্ভাব্য চার্জ রেঞ্জঃ</span> <span className="text-amber-800 font-bold">{orderedItem.deliveryChargeRange || '৳ 5 - 20 (0-2 কিমি)'}</span>
                                          </div>
                                        </>
                                      )}
                                      <div>
                                        <span className="text-slate-400 font-bold">বিক্রেতার ফাইনাল চার্জঃ</span> <span className="text-[#8b1e10] font-black underline">৳ {(orderedItem.charge || 0).toLocaleString('bn-BD')} BDT</span>
                                      </div>
                                      <div className="col-span-2 border-t border-dashed border-slate-200 pt-1.5">
                                        <span className="text-slate-400 font-bold">ডেলিভারি ঠিকানা ও গন্তব্যঃ</span> 
                                        <p className="text-slate-700 font-bold mt-0.5 leading-normal bg-white p-1.5 rounded-lg border border-slate-150">
                                          {orderedItem.recipientAddress || orderedItem.deliveryAddress || 'নির্ধারিত লাইভ জিপিএস ঠিকানা'}
                                        </p>
                                      </div>
                                      {orderedItem.latitude && (
                                        <div className="col-span-2 pt-1">
                                          <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=${orderedItem.latitude},${orderedItem.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-150 border border-rose-200 text-rose-800 rounded-lg font-black text-[8.5px] cursor-pointer"
                                          >
                                            🗺️ গুগল ম্যাপে লাইভ জিপিএস রুট দেখুন
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. WALLET TRANSFER & RECHARGE TAB */}
                        {shopActiveSubTab === 'transfer' && (
                          <div className="space-y-4 font-sans text-xs text-slate-800 animate-fade-in text-left">
                            {/* Balances Board */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white border border-slate-200 p-3.5 rounded-2xl text-center space-y-1.5 shadow-3xs">
                                <span className="text-[20px] block">🏦</span>
                                <p className="text-[8.5px] text-slate-400 font-black uppercase">মেইন ওয়ালেট ব্যালেন্স</p>
                                <p className="text-sm font-black text-emerald-800 font-mono">৳ {(liveUser.balance || 0).toLocaleString('bn-BD')}</p>
                              </div>
                              <div className="bg-white border border-slate-200 p-3.5 rounded-2xl text-center space-y-1.5 shadow-3xs">
                                <span className="text-[20px] block">🛒</span>
                                <p className="text-[8.5px] text-slate-400 font-black uppercase">সুপার শপ ব্যালেন্স</p>
                                <p className="text-sm font-black text-orange-850 font-mono">৳ {(liveUser.superShopBalance || 0).toLocaleString('bn-BD')}</p>
                              </div>
                            </div>

                            {/* Dynamic Transfer Form */}
                            <form onSubmit={handleShopTransferSubmit} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-3xs space-y-4">
                              <h3 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-1.5 uppercase">
                                🔄 ইনস্ট্যান্ট ফান্ড ট্রান্সেফার প্যানেল
                              </h3>

                              {shopTransferErr && (
                                <div className="p-2.5 bg-rose-50 border border-rose-150 text-rose-800 rounded-xl text-[10px] font-bold">
                                  ⚠️ {shopTransferErr}
                                </div>
                              )}

                              {shopTransferSucc && (
                                <div className="p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-xl text-[10px] font-bold">
                                  🎉 {shopTransferSucc}
                                </div>
                              )}

                              {/* Direction Switch buttons */}
                              <div className="space-y-1.5">
                                <label className="block text-[10px] font-extrabold text-slate-500 uppercase">1. স্থানান্তরের অভিমুখ নির্বাচন করুন</label>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setShopDir('main_to_shop')}
                                    className={`py-2 px-3 rounded-xl border text-[10px] font-black transition cursor-pointer text-center flex flex-col justify-center gap-0.5 ${
                                      shopDir === 'main_to_shop'
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span>মেইন ওয়ালেট হতে শপে</span>
                                    <span className="text-[7.5px] font-bold text-slate-400">Main Wallet ➜ Super Shop</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setShopDir('shop_to_main')}
                                    className={`py-2 px-3 rounded-xl border text-[10px] font-black transition cursor-pointer text-center flex flex-col justify-center gap-0.5 ${
                                      shopDir === 'shop_to_main'
                                        ? 'bg-amber-50 border-amber-350 text-amber-950'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span>শপ ওয়ালেট হতে মেইনে</span>
                                    <span className="text-[7.5px] font-bold text-slate-400">Super Shop ➜ Main Wallet</span>
                                  </button>
                                </div>
                              </div>

                              {/* Amount Input */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-extrabold text-slate-500 uppercase">2. স্থানান্তরের পরিমাণ টাইপ করুন (৳)</label>
                                <div className="relative">
                                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 font-mono text-[11px] font-bold">
                                    ৳
                                  </span>
                                  <input
                                    type="number"
                                    value={shopTransferAmount}
                                    onChange={(e) => setShopTransferAmount(e.target.value)}
                                    placeholder="টাকার পরিমাণ লিখুন..."
                                    className="pl-7 pr-3 py-2 w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder-slate-400"
                                  />
                                </div>
                              </div>

                              {/* PIN INPUT */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-extrabold text-slate-500 uppercase">3. আপনার গোপন নিরাপত্তা পিন কোড</label>
                                <input
                                  type="password"
                                  value={shopTransferPin}
                                  onChange={(e) => setShopTransferPin(e.target.value)}
                                  placeholder="গোপন নিরাপত্তা পিন দিন..."
                                  maxLength={5}
                                  className="px-3 py-2 w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center tracking-widest font-mono placeholder-slate-400"
                                />
                              </div>

                              {/* Action submit button */}
                              <button
                                type="submit"
                                disabled={shopTransferLoading}
                                className="w-full py-2.5 bg-orange-700 hover:bg-orange-850 disabled:bg-slate-300 text-white text-xs font-black rounded-xl transition active:scale-98 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                {shopTransferLoading ? (
                                  <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    প্রক্রিয়া করা হচ্ছে...
                                  </>
                                ) : (
                                  <>
                                    <span>🔄 স্থানান্তরের রিকোয়েস্ট নিশ্চিত করুন</span>
                                  </>
                                )}
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {modalType === 'ration' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <RationCardView
                      liveUser={liveUser}
                      syncLiveProfile={syncLiveProfile}
                      appConfig={appConfig}
                      onClose={() => setModalType(null)}
                    />
                  </div>
                )}

                {modalType === 'bill_pay' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <AmbBillPayScreen
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      syncLiveProfile={syncLiveProfile}
                      appConfig={appConfig}
                    />
                  </div>
                )}

                {modalType === 'salary' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <AmbAutoSalaryPay
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      syncLiveProfile={syncLiveProfile}
                      appConfig={appConfig}
                    />
                  </div>
                )}

                {modalType === 'auto_recharge' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <AmbAutoRechargeScreen
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      syncLiveProfile={syncLiveProfile}
                      appConfig={appConfig}
                    />
                  </div>
                )}

                {modalType === 'edu' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <AmbEducationCenter
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      appConfig={appConfig}
                    />
                  </div>
                )}

                {modalType === 'safi' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <SafiPremiumShop
                      user={liveUser}
                      onClose={() => setModalType(null)}
                      appConfig={appConfig}
                      handleBuyPremiumSafi={handleBuyPremiumSafi}
                      syncLiveProfile={syncLiveProfile}
                    />
                  </div>
                )}

                {modalType === 'about' && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans">
                    <AmbCorporateGuide
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      appConfig={appConfig}
                      onUpdateConfig={() => {}}
                    />
                  </div>
                )}
              
    </>
  );
});
