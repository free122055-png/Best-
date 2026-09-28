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

export function AdminSafeDealsSection(props: any) {
  const {
    adminTab,
    y,
    text,
    type,
    setSdSubTab,
    sdSubTab,
    disputes,
    d,
    left,
    handleCreateSafeDeal,
    sdTitle,
    setSdTitle,
    target,
    sdSupplier,
    setSdSupplier,
    sdPrice,
    setSdPrice,
    sdMinQty,
    setSdMinQty,
    sdEmoji,
    setSdEmoji,
    loadingEscrow,
    sdDesc,
    setSdDesc,
    safeDeals,
    key,
    id,
    description,
    handleToggleSafeDealStatus,
    handleDeleteSafeDeal,
    amount,
    handleUpdateDisputeStatus,
    updatingDisputeId
  } = props;

  return (
    <>
        {adminTab === 'safedeals_admin' && (
          <div className="space-y-6 animate-fade-in text-slate-800">
            {/* Sub-tab switcher */}
            <div className="flex border-b border-slate-200 pb-2 gap-2">
              <button
                type="button"
                onClick={() => setSdSubTab('deals')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                  sdSubTab === 'deals'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                📦 গ্রুপ ডিল ও প্রোডাক্টস তালিকা
              </button>
              <button
                type="button"
                onClick={() => setSdSubTab('disputes')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                  sdSubTab === 'disputes'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                🚨 কাস্টমার অভিযোগ ও সাপোর্ট টিকিট ({disputes.filter(d => d.status === 'Pending').length})
              </button>
            </div>

            {sdSubTab === 'deals' ? (
              <div className="space-y-6">
                <div className="bg-slate-955 border border-slate-200/80 p-6 rounded-3xl text-left">
                  <h2 className="text-base sm:text-lg font-black text-emerald-600 flex items-center gap-2">
                    🤝 গ্রুপ বাই ডিল প্রোডাক্টস কন্ট্রোল প্যানেল
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    ইউজারদের অ্যাপে প্রদর্শনের জন্য নিরাপদ লেনদেনের নতুন ক্যাটাগরি ও প্রোডাক্ট ডিল এখান থেকে নিয়ন্ত্রণ করুন।
                  </p>

                  <form onSubmit={handleCreateSafeDeal} className="mt-5 bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">নতুন প্রোডাক্ট ডিল যুক্ত করুন</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">প্রোডাক্টের নাম (Title)</label>
                          <input
                            type="text"
                            value={sdTitle}
                            onChange={(e) => setSdTitle(e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition"
                            placeholder="যেমন: ঘানি ভাঙা খাঁটি সরিষার তেল"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">সরবরাহকারী (Supplier Brand)</label>
                          <input
                            type="text"
                            value={sdSupplier}
                            onChange={(e) => setSdSupplier(e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition"
                            placeholder="যেমন: Safi Pure Food Ltd"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">মূল্য (৳ BDT)</label>
                          <input
                            type="number"
                            value={sdPrice}
                            onChange={(e) => setSdPrice(e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition"
                            placeholder="যেমন: 220"
                            required
                            min="1"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">সর্বনিম্ন অর্ডার (Min Qty)</label>
                          <input
                            type="text"
                            value={sdMinQty}
                            onChange={(e) => setSdMinQty(e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition"
                            placeholder="যেমন: 5 লিটার বা 3 পিস"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">আইকন ইমোজি (Emoji)</label>
                          <input
                            type="text"
                            value={sdEmoji}
                            onChange={(e) => setSdEmoji(e.target.value)}
                            className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition text-center"
                            placeholder="যেমন: 🛢️"
                          />
                        </div>

                        <div className="flex items-end">
                          <button
                            type="submit"
                            disabled={loadingEscrow}
                            className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-black transition shadow-sm hover:scale-101 active:scale-98 disabled:opacity-50 cursor-pointer"
                          >
                            {loadingEscrow ? "সেভ হচ্ছে..." : "ডিল প্রোডাক্ট সংরক্ষণ করুন 🚀"}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">প্রোডাক্টের বিবরণ (Description)</label>
                        <textarea
                          value={sdDesc}
                          onChange={(e) => setSdDesc(e.target.value)}
                          rows={2}
                          className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium outline-none transition resize-none"
                          placeholder="প্রোডাক্টের বৈশিষ্ট্য, বিশুদ্ধতার গ্যারান্টি ইত্যাদি সংক্ষিপ্ত বিবরণ দিন..."
                        />
                      </div>
                    </form>
                  </div>

                  {/* List of deals */}
                  <div className="bg-slate-955 border border-slate-200/80 p-6 rounded-3xl text-left">
                    <h3 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                      📦 বিদ্যমান গ্রুপ বাই ডিল প্রোডাক্টস তালিকা ({safeDeals.length} টি)
                    </h3>

                    {safeDeals.length === 0 ? (
                      <div className="py-12 border border-dashed border-slate-200/80 rounded-2xl text-center text-slate-500 text-xs font-bold">
                        কোনো প্রোডাক্ট ডিল পাওয়া যায়নি।
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {safeDeals.map((deal, idx) => (
                          <div key={`${deal.id}-${idx}`} className="bg-white border border-slate-200 p-4 rounded-2xl flex items-start gap-3 justify-between hover:border-emerald-500/40 transition">
                            <div className="flex items-start gap-2.5">
                              <span className="text-2xl bg-slate-100 p-2 rounded-xl block leading-none">{deal.emoji || '📦'}</span>
                              <div className="space-y-0.5 text-left">
                                <h4 className="text-xs font-black text-slate-850">{deal.title}</h4>
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed truncate max-w-[220px]">{deal.description}</p>
                                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-bold font-mono">
                                  <span>৳{deal.price}</span>
                                  <span>•</span>
                                  <span>Min: {deal.minQty}</span>
                                  <span>•</span>
                                  <span className="text-slate-750">{deal.supplier}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end justify-between h-full gap-4 shrink-0">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                deal.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {deal.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                              </span>

                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSafeDealStatus(deal.id, deal.status)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                >
                                  {deal.status === 'active' ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSafeDeal(deal.id)}
                                  className="p-1 text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg transition cursor-pointer"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-955 border border-slate-200/80 rounded-3xl p-6 text-left space-y-6 animate-fade-in">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">🚨 অভিযোগ ও সাপোর্ট টিকিট খাতা ({disputes.length} টি)</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      নিরাপদ লেনদেন বা পণ্য ক্রয়ের বিপরীতে গ্রাহকদের দাখিল করা অভিযোগসমূহ এখান থেকে পর্যালোচনা ও স্ট্যাটাস পরিবর্তন করুন।
                    </p>
                  </div>

                  {disputes.length === 0 ? (
                    <div className="py-12 border border-dashed border-slate-200/80 rounded-2xl text-center text-slate-500 text-xs font-bold">
                      কোনো কাস্টমার অভিযোগ পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {disputes.map((disp: any, idx) => (
                        <div key={`${disp.id}-${idx}`} className="bg-white border border-slate-250 p-5 rounded-2xl space-y-4 shadow-3xs hover:border-emerald-500/20 transition-all">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-slate-100 text-slate-800 font-extrabold px-2 py-1 rounded-md">
                                {disp.serialNo || `#${disp.id.substring(0, 6).toUpperCase()}`}
                              </span>
                              <span className="text-xs font-bold text-slate-500">
                                অর্ডার আইডি: #{disp.orderId?.substring(0, 8).toUpperCase() || 'N/A'}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                disp.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' :
                                disp.status === 'Under Investigation' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                                'bg-rose-100 text-rose-800'
                              }`}>
                                {disp.status || 'Pending'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                            <div className="space-y-1 text-left">
                              <p className="text-slate-450 text-[10px] font-black uppercase tracking-wide">গ্রাহকের বিবরণ</p>
                              <p className="text-slate-800 font-extrabold">{disp.userName || 'Unknown User'}</p>
                              <p className="text-slate-500 font-bold">{disp.userPhone || 'N/A'}</p>
                            </div>
                            <div className="space-y-1 text-left">
                              <p className="text-slate-450 text-[10px] font-black uppercase tracking-wide">প্রোডাক্ট ও টাকা</p>
                              <p className="text-slate-800 font-extrabold">{disp.orderTitle || 'নিরাপদ লেনদেন ডিল'}</p>
                              <p className="text-emerald-700 font-extrabold">৳{disp.amount?.toLocaleString('bn-BD')}</p>
                            </div>
                          </div>

                          {disp.courierName && disp.courierName !== 'N/A' && (
                            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-xs space-y-1">
                              <p className="text-slate-450 text-[10px] font-bold uppercase">কুরিয়ার ও ট্র্যাকিং</p>
                              <p className="text-slate-750 font-bold">কুরিয়ার: {disp.courierName} | ট্র্যাকিং নং: {disp.trackingNumber}</p>
                              <p className="text-slate-500">তারিখ: {disp.shipmentDate}</p>
                            </div>
                          )}

                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-left">
                            <p className="text-slate-450 text-[10px] font-bold uppercase mb-1">অভিযোগের কারণ / বিবরণ</p>
                            <p className="text-xs text-slate-700 font-semibold whitespace-pre-wrap leading-relaxed">{disp.description}</p>
                          </div>

                          <div className="flex justify-end gap-2">
                            <select
                              value={disp.status || 'Pending'}
                              onChange={(e) => handleUpdateDisputeStatus(disp.id, e.target.value)}
                              disabled={updatingDisputeId === disp.id}
                              className="bg-white border border-slate-250 text-slate-800 text-xs font-extrabold rounded-xl px-3 py-1.5 focus:outline-none"
                            >
                              <option value="Pending">🔴 Pending</option>
                              <option value="Under Investigation">🟡 Under Investigation</option>
                              <option value="Resolved">🟢 Resolved</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

    </>
  );
}
