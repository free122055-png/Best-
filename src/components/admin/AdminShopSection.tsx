import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { SAMITY_MONTHS, SAMITY_YEARS, getUniquePaidMonthsCount, normalizePaidMonthsArray, getEffectiveBalance } from '../../types';
import { processUserSamitySavingsAutoDeduction, processBulkSamitySavingsAutoDeduction } from '../../lib/samitySavingsEngine';
console.log("AdminPanel: DB initialized:", !!db);
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  setDoc,
  query, 
  orderBy,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import { User, Transaction, Notice, Offer, BapReport, BapGroup, BapAdminRequest, AppConfig, Product, UserNotification, CompanyFundAccount, AdminBroadcastLog, QardRuleItem, QardConfig, PhoneChangeRequest, SamityPolicyConfig, SamityFineTier } from '../../types';
import { normalizeMemberId, formatBanglaAmount, normalizePhoneNumber, findUserInFirestoreByPhone, getNextSequentialMemberId, deleteUserCompletelyFromDatabase, convertBengaliToEnglishDigits } from '../../lib/memberUtils';
import { sortTransactionsNewestFirst, getTxTime } from '../../lib/transactionUtils';
import { saveAppConfig, DEFAULT_QARD_CONFIG } from '../../lib/config';
import { AMBLogo } from '../AMBLogo';
import { HeaderPendingModal } from '../HeaderPendingModal';
import SamityScreen from '../SamityScreen';
import UnifiedBackButton from '../UnifiedBackButton';
import SamityAdmin from '../SamityAdmin';
import SafiPremiumShop from '../SafiPremiumShop';
import TelecomAdmin from '../TelecomAdmin';
import AmbSalaryAdmin from '../AmbSalaryAdmin';
import { HistoryRetentionSettings } from '../HistoryRetentionSettings';
import { runWalletEndToEndTests, TestResultItem } from '../../lib/walletTests';
import { 
  ExternalLink,
  ShieldCheck, 
  Users, 
  PiggyBank, 
  BadgeAlert, 
  Activity, 
  Briefcase, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Send,
  ArrowLeft, 
  RefreshCw,
  RotateCcw,
  Search,
  Lock,
  Unlock,
  Megaphone,
  Check,
  Smartphone,
  Sparkles,
  UserPlus,
  Coins,
  History,
  FolderSync,
  AlertTriangle,
  AlertCircle,
  UserCheck,
  ChevronDown,
  SlidersHorizontal,
  CheckSquare,
  Save,
  Zap,
  ListOrdered,
  Settings,
  Bell,
  BellRing,
  Menu,
  Phone,
  Shield,
  ShieldAlert,
  FileText,
  ChevronRight,
  User as UserIcon,
  List,
  TrendingUp,
  ThumbsUp,
  HelpCircle,
  Home,
  Banknote,
  Wifi,
  Upload,
  Edit3,
  X,
  Scale,
  Printer,
  Building2,
  LayoutGrid,
  HeartHandshake,
  Heart,
  ClipboardList,
  Volume2,
  ShoppingBag,
  CreditCard,
  Truck,
  Store,
  BookOpen,
  Gift,
  Sliders,
  Wallet,
  Clock,
  Eye,
  EyeOff,
  Globe,
  PlusCircle,
  Calculator,
  Receipt,
  MapPin,
  Map as MapIcon,
  Cpu,
  FileJson,
  Pencil,
  PieChart,
  Copy,
  Calendar,
  ChevronLeft,
  CalendarDays
} from 'lucide-react';
import { motion } from 'motion/react';
import LeafletActiveMap from '../LeafletActiveMap';

export const copyTextToClipboard = (text: string, label: string = 'নম্বর') => {
  if (!text) return;
  const cleanText = String(text).trim();
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(cleanText).then(() => {
      alert(`✅ ${label} (${cleanText}) সফলভাবে কপি করা হয়েছে!`);
    }).catch(() => {
      fallbackCopyText(cleanText, label);
    });
  } else {
    fallbackCopyText(cleanText, label);
  }
};

const fallbackCopyText = (text: string, label: string) => {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
    alert(`✅ ${label} (${text}) সফলভাবে কপি করা হয়েছে!`);
  } catch (err) {
    prompt(`নিচে আপনার ${label} টি দেওয়া হলো, ম্যানুয়ালি কপি করুন:`, text);
  }
};

export const extractNumbersFromTx = (tx: any, targetUserPhone?: string) => {
  const foundNumbers: Array<{ number: string; label: string }> = [];
  const added = new Set<string>();

  const add = (numStr: any, labelStr: string) => {
    if (!numStr) return;
    const cleaned = String(numStr).trim();
    if (cleaned && cleaned !== 'N/A' && cleaned !== 'undefined' && cleaned !== 'null' && !added.has(cleaned)) {
      added.add(cleaned);
      foundNumbers.push({ number: cleaned, label: labelStr });
    }
  };

  // 1. Primary phone/account fields
  if (tx.userPhone) add(tx.userPhone, 'মেম্বার ফোন');
  if (targetUserPhone) add(targetUserPhone, 'মেম্বার ফোন');
  if (tx.senderPhone) add(tx.senderPhone, 'প্রেরক নম্বর');
  if (tx.senderInfo) add(tx.senderInfo, 'প্রেরক নম্বর');
  if (tx.accountNumber) add(tx.accountNumber, 'একাউন্ট/প্রেরক');
  if (tx.phoneNumber) add(tx.phoneNumber, 'টার্গেট নম্বর');
  if (tx.phone) add(tx.phone, 'ফোন নম্বর');

  // 2. Extract Bangladeshi mobile numbers (013-019XXXXXXXX) from description or paymentMethod
  const textBlob = `${tx.description || ''} ${tx.paymentMethod || ''}`;
  const bdPhoneMatches = textBlob.match(/(?:01[3-9]\d{8})/g);
  if (bdPhoneMatches) {
    bdPhoneMatches.forEach(num => add(num, 'পেমেন্ট নম্বর'));
  }

  // 3. Extract 10-18 digit account numbers
  const genNumMatches = textBlob.match(/\b\d{10,18}\b/g);
  if (genNumMatches) {
    genNumMatches.forEach(num => add(num, 'একাউন্ট নম্বর'));
  }

  // 4. TrxID
  if (tx.trxId) add(tx.trxId, 'TrxID');
  else if (tx.transactionId) add(tx.transactionId, 'TrxID');
  else if (tx.receiptNo) add(tx.receiptNo, 'TrxID');

  return foundNumbers;
};

interface AdminPanelProps {
  onBack: () => void;
  currentUser: User;
  appConfig: AppConfig;
  onChangeConfig: (newConfig: AppConfig) => void;
  appLanguage?: string;
  darkMode?: boolean;
}

export interface DispatchReport {
  id: string;
  timestamp: string;
  actionType: 'bonus' | 'fine' | 'notice';
  targetType: 'all' | 'single';
  targetName: string;
  targetCount: number;
  amount: number;
  reason: string;
  status: string;
}

export function AdminShopSection(props: any) {
  const {
    adminTab,
    y,
    text,
    left,
    shopProductsList,
    transactions,
    type,
    amount,
    handleSeedDefaultProducts,
    loading,
    handlePostProduct,
    prodSuccess,
    prodError,
    newProdName,
    setNewProdName,
    target,
    newProdPrice,
    setNewProdPrice,
    newProdOldPrice,
    setNewProdOldPrice,
    newProdCategory,
    setNewProdCategory,
    url,
    newProdImageUrl,
    setNewProdImageUrl,
    newProdIcon,
    setNewProdIcon,
    newProdMinOrder,
    setNewProdMinOrder,
    newProdShipTime,
    setNewProdShipTime,
    newProdDescription,
    setNewProdDescription,
    key,
    id,
    img,
    name,
    handleOpenEditProduct,
    handleDeleteProduct,
    description,
    tx,
    users,
    u,
    uid,
    userId,
    setLoading,
    docId,
    alert
  } = props;

  return (
    <>
        {adminTab === 'shop_admin' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 p-6 rounded-3xl text-left text-slate-800">
              <h2 className="text-base sm:text-lg font-black text-rose-450 flex items-center gap-2">
                🛒 সমবায় সুপার শপ এডমিন প্যানেল (Co-Op Shop Catalog Manager)
              </h2>
              <p className="text-xs text-slate-500 mt-1">গ্রাহকদের ড্যাশবোর্ডে প্রদর্শিত প্রোডাক্ট ক্যাটালগ রিয়েলটাইম যোগ, ডিলিট এবং অর্ডার ডিসপ্যাচ ট্র্যাক করুন।</p>
              
              {/* Quick Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                  <span className="text-[10px] uppercase font-mono text-slate-550 block font-bold">মোট সক্রিয় প্রোডাক্ট</span>
                  <h3 className="text-lg font-extrabold text-white mt-1 font-mono">{shopProductsList.length} টি</h3>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                  <span className="text-[10px] uppercase font-mono text-slate-550 block font-bold">মোট শপ সেলস ট্রানজেকশন</span>
                  <h3 className="text-lg font-extrabold text-emerald-400 mt-1 font-mono">
                    ৳{transactions.filter(t => t.type === 'shop_purchase' && t.status === 'success')
                      .reduce((acc, current) => acc + (current.amount || 0), 0).toLocaleString('bn-BD')}
                  </h3>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-550 block font-bold">ক্যাটালগ রিসেট</span>
                    <span className="text-[10px] text-slate-500 block">ডিফল্ট প্রোডাক্ট রাইট করতে</span>
                  </div>
                  <button
                    onClick={handleSeedDefaultProducts}
                    disabled={loading}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-slate-100 border border-indigo-500 rounded-lg text-[10px] font-bold text-white cursor-pointer active:scale-95 transition-all"
                  >
                    ডিফল্ট অটো-সিড করুন
                  </button>
                </div>
              </div>
            </div>

            {/* Post Product Form */}
            <form onSubmit={handlePostProduct} className="bg-slate-955 border border-slate-200/80 rounded-3xl p-6 text-left space-y-4">
              <h3 className="text-sm font-extrabold text-white">➕ নতুন পণ্য যোগ খাতা (Add Product to Super Shop)</h3>
              
              {prodSuccess && (
                <div className="bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 p-3.5 rounded-xl text-xs font-bold leading-relaxed">
                  পণ্যটি সফলভাবে সমিতি ডাটাবেজে আপলোড করা হয়েছে এবং ড্যাশবোর্ড ক্যাটালগে যুক্ত হয়েছে!
                </div>
              )}
              {prodError && (
                <div className="bg-rose-950/40 text-rose-400 border border-rose-800/60 p-3.5 rounded-xl text-xs font-bold">
                  {prodError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-500">পণ্যের নাম (Product Name)</label>
                  <input
                    type="text"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-red-500 rounded-xl p-2.5 text-xs text-slate-900 outline-none transition"
                    placeholder="যেমন: সুন্দরবন ভেজালমুক্ত মধু 1 কেজি"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-500">বিক্রয় মূল্য (৳ Offer Price)</label>
                  <input
                    type="number"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-red-500 rounded-xl p-2.5 text-xs text-slate-900 outline-none font-mono"
                    placeholder="যেমন: 2300"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-500">পূর্বের মূল্য (৳ Slashed Old Price - Optional)</label>
                  <input
                    type="number"
                    value={newProdOldPrice}
                    onChange={(e) => setNewProdOldPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-red-500 rounded-xl p-2.5 text-xs text-slate-900 outline-none font-mono"
                    placeholder="যেমন: 2500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-500">ক্যাটাগরি (Category)</label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-red-500 rounded-xl p-2.5 text-xs text-slate-900 font-bold outline-none"
                  >
                    <option value="oil_ghee">Oil & Ghee (তেল ও ঘি)</option>
                    <option value="organic">Organic Food (অর্গানিক খাবার)</option>
                    <option value="honey">Honey (মধু)</option>
                    <option value="dates">Dates (খেজুর)</option>
                    <option value="spices">Spices (মসলা)</option>
                    <option value="nuts_seeds">Nuts & Seeds (বাদাম ও বীজ)</option>
                    <option value="beverage">Beverage (পানীয়)</option>
                    <option value="rice">Rice (চাল)</option>
                    <option value="flours_lentils">Flours & Lentils (আটা ও ডাল)</option>
                    <option value="combos">Packaged Combos (কম্বো অফার)</option>
                    <option value="mango">Mango (আম)</option>
                    <option value="offer_zone">Offer Zone (বিশেষ অফার)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] uppercase font-extrabold text-slate-500">পণ্যের ছবি লিংক (Image URL - Optional)</label>
                  <input
                    type="url"
                    value={newProdImageUrl}
                    onChange={(e) => setNewProdImageUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-red-500 rounded-xl p-2.5 text-xs text-slate-900 outline-none"
                    placeholder="https://images.unsplash.com/... (মধু/ঘি-এর ছবি লিংক)"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-500">প্রদর্শন ইমোজি (Emoji Backup)</label>
                  <input
                    type="text"
                    value={newProdIcon}
                    onChange={(e) => setNewProdIcon(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-red-500 rounded-xl p-2.5 text-xs text-center text-slate-900 outline-none"
                    placeholder="🍯 / 🍶"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-500">সর্বনিম্ন অর্ডার (Min Order)</label>
                  <input
                    type="text"
                    value={newProdMinOrder}
                    onChange={(e) => setNewProdMinOrder(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-red-500 rounded-xl p-2.5 text-xs text-slate-900 outline-none"
                    placeholder="1 কেজি / 1 Unit"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-500">শিপিং সময় (Shipping Estimate)</label>
                  <input
                    type="text"
                    value={newProdShipTime}
                    onChange={(e) => setNewProdShipTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 focus:border-red-500 rounded-xl p-2.5 text-xs text-slate-900 outline-none"
                    placeholder="3-5 দিন"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-extrabold text-slate-500">পণ্যের সংক্ষিপ্ত বিবরণ (Product Description)</label>
                <textarea
                  rows={2}
                  value={newProdDescription}
                  onChange={(e) => setNewProdDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/80 focus:border-red-500 rounded-xl p-3 text-xs text-slate-700 outline-none leading-relaxed"
                  placeholder="পণ্যের গুণাবলী, ওয়ারেন্টি এবং বিবরণ বাংলায় লিখুন..."
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer flex items-center justify-center gap-1 shadow-md active:scale-97"
                >
                  <Plus className="w-3.5 h-3.5" /> পণ্য তালিকায় পোস্ট করুন (Upload Product)
                </button>
              </div>
            </form>

            {/* Active Products Catalog and Table */}
            <div className="bg-slate-955 border border-slate-200/80 rounded-3xl p-6 text-left">
              <h3 className="text-sm font-extrabold text-white mb-4">📦 সক্রিয় ক্যাটালগ পণ্য তালিকা (Co-Op Store Catalog Inventory)</h3>
              
              {shopProductsList.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200/80 p-8 rounded-2xl text-center text-slate-500 text-xs">
                  কোনো ক্যাটালগ প্রোডাক্ট পাওয়া যায়নি। অটো সিড করুন অথবা নতুন যোগ করুন।
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {shopProductsList.map((prod, idx) => (
                    <div key={`${prod.id}-${idx}`} className="bg-slate-50 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between relative group hover:border-slate-300 transition">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            {prod.imageUrl ? (
                              <img src={prod.imageUrl} alt={prod.name} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-2xl">{prod.icon || '🌾'}</span>
                            )}
                            <div className="min-w-0">
                              <h4 className="text-xs font-extrabold text-white max-w-[150px] truncate">{prod.name}</h4>
                              <p className="text-[10px] text-slate-450 uppercase tracking-wide font-mono font-bold mt-0.5">{prod.category}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleOpenEditProduct(prod)}
                              className="p-1.5 bg-blue-950/20 hover:bg-blue-900 text-blue-400 hover:text-white rounded-lg transition border border-blue-900/40 cursor-pointer"
                              title="সম্পাদনা করুন"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-1.5 bg-red-950/20 hover:bg-red-900 text-red-500 hover:text-white rounded-lg transition border border-red-900/40 cursor-pointer"
                              title="মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2 min-h-[30px] leading-relaxed">{prod.description}</p>
                      </div>

                      <div className="border-t border-slate-800/60 pt-2.5 mt-3 flex items-center justify-between text-[11px] text-slate-450 font-bold">
                        <div>
                          মূল্য: <span className="font-mono text-emerald-400 font-extrabold">৳{prod.price.toLocaleString('bn-BD')}</span>
                          {prod.oldPrice && (
                            <span className="font-mono text-slate-550 line-through text-[10px] ml-1.5">৳{prod.oldPrice.toLocaleString('bn-BD')}</span>
                          )}
                        </div>
                        <div>
                          সময়: <span className="text-slate-600">{prod.shipTime || '3-5 দিন'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Shop Orders Dispatch Tracker */}
            <div className="bg-slate-955 border border-slate-200/80 rounded-3xl p-6 text-left">
              <h3 className="text-sm font-extrabold text-white mb-2">🛒 সুপার শপ অর্ডার ট্র্যাকিং ও ডিসপ্যাচ খাতা (Super Shop Shipping & Orders)</h3>
              <p className="text-xs text-slate-500 mb-4">গ্রাহকদের অর্ডারের পেমেন্ট ভেরিফিকেশন এবং শিপিং স্ট্যাটাস আপডেট করুন।</p>

              {transactions.filter(t => t.type === 'shop_purchase').length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200/80 p-8 rounded-2xl text-center text-slate-500 text-xs">
                  কোনো সুপার শপ অর্ডার ট্রানজেকশন পাওয়া যায়নি।
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-350 border-b border-slate-200/80 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3.5">অর্ডার বিবরণ (Item Purchased)</th>
                        <th className="p-3.5">ক্রেতা আইডি (Buyer Credentials)</th>
                        <th className="p-3.5">পরিশোধিত টাকা (Amount Paid)</th>
                        <th className="p-3.5">তারিখ (Order Date)</th>
                        <th className="p-3.5">ডেলিভারি স্ট্যাটাস (Shipping Dispatch Level)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-600 font-semibold">
                      {transactions.filter(t => t.type === 'shop_purchase').map((tx, idx) => {
                        const buyer = users.find(u => u.uid === tx.userId);
                        return (
                          <tr key={`${tx.id}-${idx}`} className="hover:bg-slate-900/60 transition">
                            <td className="p-3.5">
                              <div className="font-bold text-white uppercase">{tx.description?.replace('সুপার শপ থেকে ', '') || 'Super Shop Item'}</div>
                              <div className="text-[10px] text-indigo-400 mt-0.5 font-mono">{tx.id}</div>
                              {tx.deliveryAddress && (
                                <div className="text-[10px] text-slate-350 bg-slate-50 border border-slate-200/80 rounded px-1.5 py-0.5 mt-1.5 max-w-[200px] truncate" title={tx.deliveryAddress}>
                                  🏠 {tx.deliveryAddress}
                                </div>
                              )}
                              {tx.lat && tx.lng && (
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${tx.lat},${tx.lng}`} 
                                  target="_blank" 
                                  referrerPolicy="no-referrer"
                                  className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1 mt-1 hover:underline"
                                >
                                  📍 গুগল ম্যাপ ট্র্যাক করুন
                                </a>
                              )}
                            </td>
                            <td className="p-3.5">
                              <div className="text-slate-700">{tx.userName}</div>
                              <div className="text-[10px] text-slate-450 font-mono mt-0.5">{tx.memberId || buyer?.memberId}</div>
                            </td>
                            <td className="p-3.5 font-mono font-extrabold text-emerald-450 text-[12.5px]">
                              ৳{(tx.amount || 0).toLocaleString('bn-BD')}
                            </td>
                            <td className="p-3.5 text-[11px] font-mono">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('bn-BD') : '3-5 দিন পূর্বে'}
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <select
                                value={tx.orderStatus || 'pending'}
                                onChange={async (e) => {
                                  try {
                                    setLoading(true);
                                    await setDoc(doc(db, 'transactions', (tx as any).docId || tx.id), { orderStatus: e.target.value }, { merge: true });
                                    alert('অর্ডার ডেলিভারি স্ট্যাটাস সফলভাবে পরিবর্তন করা হয়েছে!');
                                  } catch (err) {
                                    console.error(err);
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold border outline-none bg-slate-900 cursor-pointer ${
                                  tx.orderStatus === 'delivered' 
                                    ? 'text-emerald-400 border-emerald-900 focus:ring-emerald-500' 
                                    : tx.orderStatus === 'shipped' 
                                    ? 'text-sky-400 border-sky-900 focus:ring-sky-500'
                                    : tx.orderStatus === 'processing' 
                                    ? 'text-amber-400 border-amber-900 focus:ring-amber-500'
                                    : 'text-red-400 border-red-900 focus:ring-red-500'
                                }`}
                              >
                                <option value="pending" className="text-red-400 font-bold bg-white">🔴 পেন্ডিং (Pending Call)</option>
                                <option value="processing" className="text-amber-450 font-bold bg-white">🟡 প্রসেসিং (Procuring)</option>
                                <option value="shipped" className="text-sky-450 font-bold bg-white">🔵 শিপড (Shipped Out)</option>
                                <option value="delivered" className="text-emerald-450 font-bold bg-white">🟢 ডেলিভারড (Delivered)</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 9: AMB DIGITAL BANK & CARD ADMIN */}
    </>
  );
}
