import React, { Component } from 'react';
import { 
  SAMITY_MONTHS, 
  SAMITY_YEARS, 
  normalizePaidMonthsArray,
  User,
  Transaction
} from '../../types';
import { 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Lock, 
  Unlock, 
  Smartphone, 
  Save, 
  Zap, 
  Phone, 
  ShieldCheck, 
  User as UserIcon, 
  X, 
  Wallet, 
  MapPin, 
  Copy,
  Calendar,
  AlertCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

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

/**
 * Bulletproof date and time formatter
 * Safely parses Date instances, Firestore Timestamps ({ seconds, nanoseconds }),
 * ISO strings, numbers, or falls back to 'N/A' without throwing RangeError.
 */
export const formatSafeDateTime = (val: any): string => {
  try {
    if (!val) return 'N/A';
    let d: Date | null = null;
    if (val instanceof Date) {
      d = val;
    } else if (typeof val === 'object') {
      if (typeof val.toDate === 'function') {
        d = val.toDate();
      } else if (typeof val.seconds === 'number') {
        d = new Date(val.seconds * 1000);
      } else if (typeof val._seconds === 'number') {
        d = new Date(val._seconds * 1000);
      }
    } else if (typeof val === 'number') {
      d = new Date(val);
    } else if (typeof val === 'string') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }

    if (!d || isNaN(d.getTime())) return 'N/A';

    return d.toLocaleString('bn-BD', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  } catch (err) {
    return 'N/A';
  }
};

/**
 * Helper to ensure safe primitive strings for React rendering.
 * Prevents "Objects are not valid as a React child" errors when Firestore
 * Timestamps or nested objects are stored in user fields.
 */
export const safePrimitiveString = (val: any, fallback: string = ''): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try { return val.toDate().toLocaleString('bn-BD'); } catch (e) { return fallback; }
    }
    if (typeof val.seconds === 'number') {
      try { return new Date(val.seconds * 1000).toLocaleString('bn-BD'); } catch (e) { return fallback; }
    }
    try {
      return JSON.stringify(val);
    } catch (e) {
      return fallback;
    }
  }
  return fallback;
};

export const safePrimitiveNumber = (val: any, fallback: number = 0): number => {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

/**
 * Error boundary component to guarantee the admin screen never goes blank/white.
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  onClose: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class AdminUserEditErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('AdminUserEditModal Error Boundary caught an exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl p-6 max-w-md w-full text-white shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/40">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-rose-300">সদস্যের তথ্য প্রদর্শনে সাময়িক ত্রুটি</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              সদস্যের কোনো ফিল্ডে অসংলগ্ন ডাটা থাকার কারণে রেন্ডারিং ব্যাহত হয়েছিল। সিস্টেম স্বয়ংক্রিয়ভাবে স্ক্রিন সাদা হওয়া প্রতিরোধ করেছে।
            </p>
            <div className="p-2.5 bg-slate-950 rounded-lg text-[10px] font-mono text-rose-400/90 text-left overflow-x-auto max-h-24">
              {String(this.state.error?.message || this.state.error || 'Unknown Rendering Issue')}
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>পুনরায় লোড করুন</span>
              </button>
              <button
                type="button"
                onClick={this.props.onClose}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Main Content Component for Admin User Edit Modal
 */
function AdminUserEditModalContent(props: any) {
  const {
    editingUser,
    setEditingUser,
    setAdjType,
    setAdjAmount,
    setAdjReason,
    editUserName,
    editUserMemberId,
    isSavingUser,
    handleSaveEditUser,
    setEditUserName,
    setEditUserMemberId,
    editUserPhone,
    setEditUserPhone,
    handleReleaseAccountDeviceAndLogout,
    setEditBalance,
    setEditTelecomBalance,
    setEditSuperShopBalance,
    setEditSavings,
    setEditDueLoan,
    editBalance,
    editTelecomBalance,
    editSuperShopBalance,
    editSavings,
    editDueLoan,
    editPin,
    setEditPin,
    editIsAppLocked,
    setCopiedAppLockUid,
    copiedAppLockUid,
    editAppLockCode,
    setEditAppLockCode,
    setEditIsAppLocked,
    handleAdminInstantUnlockUser,
    editUserStatus,
    setEditUserStatus,
    editRole,
    setEditRole,
    editMonthlySavingsTarget,
    setEditMonthlySavingsTarget,
    editSamitySchemeActive,
    setEditSamitySchemeActive,
    editCanDisableAutoSavings,
    setEditCanDisableAutoSavings,
    setEditSubAdminPermissions,
    editSubAdminPermissions,
    editSamityStatus,
    setEditSamityStatus,
    editMemberGroup,
    setEditMemberGroup,
    editCustomTelecomPercent,
    setEditCustomTelecomPercent,
    editCurrentDeviceId,
    setEditCurrentDeviceId,
    setEditDeviceChangeRequested,
    editDeviceLockBypassed,
    setEditDeviceLockBypassed,
    editFatherName,
    setEditFatherName,
    editMotherName,
    setEditMotherName,
    editNid,
    setEditNid,
    editDob,
    setEditDob,
    editOccupation,
    setEditOccupation,
    editAlternatePhone,
    setEditAlternatePhone,
    editDivision,
    setEditDivision,
    editDistrict,
    setEditDistrict,
    editThana,
    setEditThana,
    editPostOffice,
    setEditPostOffice,
    editFullAddress,
    setEditFullAddress,
    setEditHasSetProfile,
    editHasSetProfile,
    editNomineeName,
    setEditNomineeName,
    editNomineeRelation,
    setEditNomineeRelation,
    editNomineePhone,
    setEditNomineePhone,
    hasRationCard,
    editRationEnabled,
    setEditRationEnabled,
    editRationName,
    setEditRationName,
    editRationPhone,
    setEditRationPhone,
    editRationVillage,
    setEditRationVillage,
    editRationUpazila,
    setEditRationUpazila,
    editRationDistrict,
    setEditRationDistrict,
    editRationCardNo,
    setEditRationCardNo,
    editRationSecurityCode,
    setEditRationSecurityCode,
    editRationIssueDate,
    setEditRationIssueDate,
    editRationExpiryDate,
    setEditRationExpiryDate,
    editRationSignature,
    setEditRationSignature,
    editRationPhotoUrl,
    setEditRationPhotoUrl,
    adjType,
    adjAmount,
    adjReason,
    customNoticeText,
    setCustomNoticeText,
    editSamityPaidMonths,
    editTrackerSelectedYear,
    setEditTrackerSelectedYear,
    setEditSamityPaidMonths,
    transactions,
    handleAdminDeleteTransaction
  } = props;

  if (!editingUser) return null;

  const targetUserId = editingUser.uid || editingUser.id || (editingUser as any).docId || '';
  const targetPhone = editUserPhone || editingUser.phone || '';
  const targetMemberId = editUserMemberId || editingUser.memberId || '';

  // Safe paid months list
  const safePaidMonths: string[] = Array.isArray(editSamityPaidMonths)
    ? editSamityPaidMonths
    : (editSamityPaidMonths && typeof editSamityPaidMonths === 'object'
        ? Object.keys(editSamityPaidMonths).filter(k => (editSamityPaidMonths as any)[k])
        : (typeof editSamityPaidMonths === 'string' ? [editSamityPaidMonths] : []));

  // Filter transactions belonging to this specific user
  const getTxTime = (t: any): number => {
    if (!t) return 0;
    if (t.createdAt?.toDate && typeof t.createdAt.toDate === 'function') {
      try { return t.createdAt.toDate().getTime(); } catch (e) {}
    }
    if (typeof t.createdAt?.seconds === 'number') return t.createdAt.seconds * 1000;
    if (typeof t.timestamp === 'number') return t.timestamp;
    if (typeof t.createdAt === 'number') return t.createdAt;
    if (typeof t.createdAt === 'string') {
      const d = new Date(t.createdAt).getTime();
      return isNaN(d) ? 0 : d;
    }
    return 0;
  };

  const memberTxs = Array.isArray(transactions) ? transactions.filter((t: any) => {
    if (!t) return false;
    const matchId = (t.userId && t.userId === targetUserId) || (t.id && t.id === targetUserId);
    const matchPhone = targetPhone && (t.userPhone === targetPhone || t.senderPhone === targetPhone || t.phone === targetPhone || t.accountNumber === targetPhone || t.senderInfo === targetPhone);
    const matchMemberId = targetMemberId && t.memberId === targetMemberId;
    return matchId || matchPhone || matchMemberId;
  }) : [];

  memberTxs.sort((a: any, b: any) => getTxTime(b) - getTxTime(a));
  const totalTxCount = memberTxs.length;
  const totalSuccessSum = memberTxs
    .filter((t: any) => t && (t.status === 'success' || t.status === 'approved' || t.status === 'completed'))
    .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);

  const getYearPaidCount = (yr: number) => {
    return SAMITY_MONTHS.filter(m => {
      const yKey = `${yr}-${m.id}`;
      const yKeyAlt = `${yr}_${m.id}`;
      return safePaidMonths.includes(yKey) || safePaidMonths.includes(yKeyAlt) || (yr === 2026 && safePaidMonths.includes(m.id));
    }).length;
  };

  const curYearPaid = getYearPaidCount(editTrackerSelectedYear || 2026);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col justify-between overflow-hidden animate-fade-in font-sans text-xs">
      {/* Top Header Bar (Compact & Sticky) */}
      <div className="bg-slate-900 border-b border-emerald-800/80 px-3 py-2 text-white flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setEditingUser(null)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition shrink-0 cursor-pointer"
            title="ফিরে যান"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-emerald-400 text-xs sm:text-sm truncate">
                {safePrimitiveString(editUserName) || safePrimitiveString(editingUser.name) || 'সদস্য'}
              </span>
              <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 px-1.5 py-0.2 rounded">
                ID: {safePrimitiveString(editUserMemberId) || safePrimitiveString(editingUser.memberId) || 'N/A'}
              </span>
              <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800 px-1.5 py-0.2 rounded">
                মেইন: ৳{safePrimitiveNumber(editBalance, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={isSavingUser}
            onClick={handleSaveEditUser}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-lg transition shadow flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingUser ? 'সংরক্ষণ...' : 'সংরক্ষণ'}</span>
          </button>
          <button
            type="button"
            onClick={() => setEditingUser(null)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer"
          >
            বাতিল
          </button>
        </div>
      </div>

      {/* Main Scrollable Content Body - Ultra Compact & Dense Layout */}
      <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto p-2 sm:p-3 space-y-2.5 pb-20 scrollbar-thin">
        
        {/* ========================================================================= */}
        {/* 1. 📅 সমবায় সমিতি ৫০ বছরের সঞ্চয় কিস্তি ট্র্যাকার ও মাস কন্ট্রোল */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border border-emerald-600/70 p-2.5 sm:p-3 rounded-xl text-white shadow-md text-left space-y-2">
          {/* Tracker Header */}
          <div className="flex items-center justify-between gap-2 border-b border-emerald-800/80 pb-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="p-1 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/40 text-xs">
                📅
              </span>
              <h4 className="text-xs font-bold text-white">
                সমবায় সমিতি ৫০ বছরের সঞ্চয় কিস্তি ট্র্যাকার ও ম্যানুয়াল মাস কন্ট্রোল
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-md">
                {curYearPaid}/12 মাস পরিশোধিত ({editTrackerSelectedYear || 2026})
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded-md">
                মাসিক: ৳{safePrimitiveNumber(editMonthlySavingsTarget, 1000).toLocaleString()}
              </span>
            </div>
          </div>

          {/* 50 Years Year Pills & Dropdown (Ultra Compact) */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-emerald-900 p-1.5 rounded-lg">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-thin flex-1 text-[10px]">
              {SAMITY_YEARS.map(yr => {
                const yrPaid = getYearPaidCount(yr);
                const isSelected = yr === editTrackerSelectedYear;
                const isCurrent = yr === new Date().getFullYear();

                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setEditTrackerSelectedYear(yr)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 ring-1 ring-emerald-300 font-black'
                        : yrPaid === 12
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : yrPaid > 0
                        ? 'bg-amber-950/70 text-amber-300 border border-amber-800'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-emerald-700'
                    }`}
                  >
                    {yr}{isCurrent ? '*' : ''}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 bg-slate-900 border border-emerald-700 px-1 py-0.5 rounded shrink-0">
              <span className="text-[9px] text-emerald-400 font-bold hidden sm:inline">বছর:</span>
              <select
                value={editTrackerSelectedYear || 2026}
                onChange={(e) => setEditTrackerSelectedYear(Number(e.target.value))}
                className="bg-slate-950 text-white font-mono font-bold text-[10px] px-1 py-0.5 rounded border border-emerald-600 focus:outline-none cursor-pointer"
              >
                {SAMITY_YEARS.map(yr => (
                  <option key={yr} value={yr}>{yr} সাল</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Action Toolbar (Ultra Compact) */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-950/90 border border-emerald-800/80 p-1.5 rounded-lg text-[10px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-emerald-300">⚡ দ্রুত একশন:</span>
              <button
                type="button"
                onClick={() => {
                  const targetRate = Math.max(1, safePrimitiveNumber(editMonthlySavingsTarget, 1000));
                  const curMainBal = safePrimitiveNumber(editBalance, 0);
                  const curSavingsVal = safePrimitiveNumber(editSavings, 0);

                  const unpaidMonths = SAMITY_MONTHS.filter(m => {
                    const yearKey = `${editTrackerSelectedYear}-${m.id}`;
                    return !safePaidMonths.some((k: string) => {
                      const norm = k.replace('_', '-');
                      return norm === yearKey || (editTrackerSelectedYear === 2026 && (norm === `2026-${m.id}` || norm === m.id));
                    });
                  });

                  if (unpaidMonths.length === 0) {
                    alert(`ℹ️ ${editTrackerSelectedYear} সালের 12টি মাসই ইতিমধ্যে পরিশোধিত আছে।`);
                    return;
                  }

                  const totalNeeded = unpaidMonths.length * targetRate;
                  if (curMainBal < totalNeeded) {
                    alert(`⚠️ সদস্যের মেইন ব্যালেন্সে পর্যাপ্ত টাকা নেই!\n\n${editTrackerSelectedYear} সালের ${unpaidMonths.length}টি বকেয়া মাস পরিশোধ করতে মোট ৳${totalNeeded.toLocaleString('bn-BD')} টাকা প্রয়োজন (প্রতি মাস ৳${targetRate.toLocaleString('bn-BD')})।\n\nকিন্তু সদস্যের বর্তমান মেইন ব্যালেন্স মাত্র ৳${curMainBal.toLocaleString('bn-BD')} টাকা।`);
                    return;
                  }

                  const yearMonthKeys = SAMITY_MONTHS.map(m => `${editTrackerSelectedYear}-${m.id}`);
                  const newSet = normalizePaidMonthsArray([...safePaidMonths, ...yearMonthKeys]);
                  setEditSamityPaidMonths(newSet);
                  setEditBalance(Math.max(0, curMainBal - totalNeeded));
                  setEditSavings(curSavingsVal + totalNeeded);
                }}
                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded transition cursor-pointer"
              >
                ✅ ১২ মাস পরিশোধিত
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetRate = Math.max(1, safePrimitiveNumber(editMonthlySavingsTarget, 1000));
                  const curMainBal = safePrimitiveNumber(editBalance, 0);
                  const curSavingsVal = safePrimitiveNumber(editSavings, 0);

                  const paidMonthsInYear = SAMITY_MONTHS.filter(m => {
                    const yearKey = `${editTrackerSelectedYear}-${m.id}`;
                    return safePaidMonths.some((k: string) => {
                      const norm = k.replace('_', '-');
                      return norm === yearKey || (editTrackerSelectedYear === 2026 && (norm === `2026-${m.id}` || norm === m.id));
                    });
                  });

                  if (paidMonthsInYear.length === 0) {
                    alert(`ℹ️ ${editTrackerSelectedYear} সালে কোনো পরিশোধিত মাস নেই।`);
                    return;
                  }

                  const totalRefund = paidMonthsInYear.length * targetRate;
                  const prefix = `${editTrackerSelectedYear}-`;
                  const filtered = safePaidMonths.filter((k: string) => {
                    const norm = k.replace('_', '-');
                    return !norm.startsWith(prefix) && (editTrackerSelectedYear !== 2026 || !SAMITY_MONTHS.some(m => m.id === norm || `2026-${m.id}` === norm));
                  });
                  const newSet = normalizePaidMonthsArray(filtered);
                  setEditSamityPaidMonths(newSet);
                  setEditBalance(curMainBal + totalRefund);
                  setEditSavings(Math.max(0, curSavingsVal - totalRefund));
                }}
                className="px-2 py-0.5 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold rounded transition cursor-pointer"
              >
                🧹 সকল মাস বকেয়া (ব্যালেন্সে ফেরত)
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetRate = Math.max(1, safePrimitiveNumber(editMonthlySavingsTarget, 1000));
                  const totalPaidAllYears = safePaidMonths.length;
                  const totalRequiredSavings = totalPaidAllYears * targetRate;
                  const curSavingsVal = safePrimitiveNumber(editSavings, 0);
                  const curMainBal = safePrimitiveNumber(editBalance, 0);
                  const diff = totalRequiredSavings - curSavingsVal;

                  if (diff === 0) {
                    alert(`✅ হিসাব সম্পূর্ণ নিখুঁত আছে!\n\nমোট পরিশোধিত মাস: ${totalPaidAllYears}টি\nমাসিক হার: ৳${targetRate.toLocaleString('bn-BD')}\nমোট সঞ্চয়: ৳${totalRequiredSavings.toLocaleString('bn-BD')}`);
                    return;
                  }

                  const newMainBal = diff > 0 ? Math.max(0, curMainBal - diff) : curMainBal + Math.abs(diff);
                  setEditSavings(totalRequiredSavings);
                  setEditBalance(newMainBal);
                  alert(`✅ ব্যালেন্স সফলভাবে সমন্বয় করা হয়েছে!\n\nপরিশোধিত মাস: ${totalPaidAllYears}টি × ৳${targetRate.toLocaleString('bn-BD')} = ৳${totalRequiredSavings.toLocaleString('bn-BD')}\n\nসঞ্চয় আমানত: ৳${curSavingsVal.toLocaleString('bn-BD')} ➔ ৳${totalRequiredSavings.toLocaleString('bn-BD')}\nমেইন ব্যালেন্স: ৳${curMainBal.toLocaleString('bn-BD')} ➔ ৳${newMainBal.toLocaleString('bn-BD')}`);
                }}
                className="px-2 py-0.5 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded transition cursor-pointer"
              >
                ⚖️ ব্যালেন্স রিকনসিল
              </button>
            </div>

            <div className="text-[10px] text-emerald-300 font-mono font-bold">
              সঞ্চয় জমা: ৳{safePrimitiveNumber(editSavings, 0).toLocaleString()}
            </div>
          </div>

          {/* 12 Months Interactive Grid (Ultra Compact & Responsive 6-12 Columns) */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1">
            {SAMITY_MONTHS.map((m) => {
              const yearKey = `${editTrackerSelectedYear}-${m.id}`;
              const isPaid = safePaidMonths.some((k: string) => {
                const norm = k.replace('_', '-');
                return norm === yearKey || (editTrackerSelectedYear === 2026 && (norm === `2026-${m.id}` || norm === m.id));
              });

              const toggleMonth = () => {
                const targetRate = Math.max(1, safePrimitiveNumber(editMonthlySavingsTarget, 1000));
                const curMainBal = safePrimitiveNumber(editBalance, 0);
                const curSavingsVal = safePrimitiveNumber(editSavings, 0);

                if (isPaid) {
                  const updated = safePaidMonths.filter((k: string) => {
                    const norm = k.replace('_', '-');
                    return norm !== yearKey && (editTrackerSelectedYear !== 2026 || (norm !== `2026-${m.id}` && norm !== m.id));
                  });
                  const normalized = normalizePaidMonthsArray(updated);
                  setEditSamityPaidMonths(normalized);
                  setEditBalance(curMainBal + targetRate);
                  setEditSavings(Math.max(0, curSavingsVal - targetRate));
                } else {
                  if (curMainBal < targetRate) {
                    alert(`⚠️ সদস্যের মেইন ব্যালেন্সে পর্যাপ্ত টাকা নেই!\n\n"${m.name} ${editTrackerSelectedYear}" মাসের কিস্তি বাবদ ৳${targetRate.toLocaleString('bn-BD')} টাকা প্রয়োজন, কিন্তু সদস্যের বর্তমান মেইন ব্যালেন্স মাত্র ৳${curMainBal.toLocaleString('bn-BD')} টাকা।`);
                    return;
                  }
                  const updated = [...safePaidMonths, yearKey];
                  const normalized = normalizePaidMonthsArray(updated);
                  setEditSamityPaidMonths(normalized);
                  setEditBalance(Math.max(0, curMainBal - targetRate));
                  setEditSavings(curSavingsVal + targetRate);
                }
              };

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={toggleMonth}
                  className={`p-1 rounded-lg border text-center transition cursor-pointer flex flex-col items-center justify-between min-h-[46px] ${
                    isPaid
                      ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100 ring-1 ring-emerald-500/50 hover:bg-emerald-900/90'
                      : 'bg-rose-950/60 border-rose-800 text-rose-200 hover:bg-rose-900/70'
                  }`}
                  title={`${m.name} ${editTrackerSelectedYear}: ক্লিক করে টগল করুন`}
                >
                  <span className="text-[10px] font-bold text-white truncate w-full">{m.name}</span>
                  <span className={`text-[8.5px] font-black px-1 py-0.2 rounded w-full truncate ${isPaid ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'}`}>
                    {isPaid ? '✓ পরিশোধিত' : '✕ বকেয়া'}
                  </span>
                  <span className="text-[8.5px] font-mono text-emerald-300 font-bold">
                    ৳{safePrimitiveNumber(editMonthlySavingsTarget, 1000).toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. 💰 ওয়ালেট ব্যালেন্স ও পিন দ্রুত কন্ট্রোল (Dense 6-Column Balances Grid) */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white space-y-2 text-left">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              <span>ওয়ালেট ব্যালেন্স ও পিন দ্রুত কন্ট্রোল</span>
            </h4>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (confirm('⚠️ আপনি কি এই ইউজারের সমস্ত ওয়ালেট ব্যালেন্স (মেইন, টেলিকম, শপ, ঋণ) শূন্য (0) করতে চান?')) {
                    setEditBalance(0);
                    setEditTelecomBalance(0);
                    setEditSuperShopBalance(0);
                    setEditDueLoan(0);
                  }
                }}
                className="px-2 py-0.5 bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700 text-[10px] font-bold rounded transition cursor-pointer"
              >
                ⚡ সব ব্যালেন্স ৳0 করুন
              </button>
            </div>
          </div>

          {/* 6 Dense Columns for Balances & PIN */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {/* Main Balance */}
            <div className="bg-slate-800/90 border border-slate-700 p-1.5 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-300 font-bold">
                <span>মেইন ওয়ালেট</span>
                <button type="button" onClick={() => setEditBalance(0)} className="text-[9px] text-rose-400 hover:underline cursor-pointer">0</button>
              </div>
              <input
                type="number"
                value={editBalance === '' ? '' : (editBalance ?? 0)}
                onChange={(e) => setEditBalance(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Savings Deposit */}
            <div className="bg-slate-800/90 border border-slate-700 p-1.5 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-300 font-bold">
                <span>সমিতি সঞ্চয়</span>
                <button type="button" onClick={() => setEditSavings(0)} className="text-[9px] text-rose-400 hover:underline cursor-pointer">0</button>
              </div>
              <input
                type="number"
                value={editSavings === '' ? '' : (editSavings ?? 0)}
                onChange={(e) => setEditSavings(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Due Loan */}
            <div className="bg-slate-800/90 border border-slate-700 p-1.5 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-300 font-bold">
                <span>বকেয়া ঋণ স্থিতি</span>
                <button type="button" onClick={() => setEditDueLoan(0)} className="text-[9px] text-rose-400 hover:underline cursor-pointer">0</button>
              </div>
              <input
                type="number"
                value={editDueLoan === '' ? '' : (editDueLoan ?? 0)}
                onChange={(e) => setEditDueLoan(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono font-bold text-rose-400 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Telecom Balance */}
            <div className="bg-slate-800/90 border border-slate-700 p-1.5 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-300 font-bold">
                <span>টেলিকম ব্যালেন্স</span>
                <button type="button" onClick={() => setEditTelecomBalance(0)} className="text-[9px] text-rose-400 hover:underline cursor-pointer">0</button>
              </div>
              <input
                type="number"
                value={editTelecomBalance === '' ? '' : (editTelecomBalance ?? 0)}
                onChange={(e) => setEditTelecomBalance(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Super Shop Balance */}
            <div className="bg-slate-800/90 border border-slate-700 p-1.5 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-300 font-bold">
                <span>সুপার শপ ব্যালেন্স</span>
                <button type="button" onClick={() => setEditSuperShopBalance(0)} className="text-[9px] text-rose-400 hover:underline cursor-pointer">0</button>
              </div>
              <input
                type="number"
                value={editSuperShopBalance === '' ? '' : (editSuperShopBalance ?? 0)}
                onChange={(e) => setEditSuperShopBalance(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Security PIN */}
            <div className="bg-slate-800/90 border border-slate-700 p-1.5 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-300 font-bold">
                <span>৪-ডিজিট পিন</span>
                <span className="text-[9px] text-emerald-400">PIN</span>
              </div>
              <input
                type="text"
                maxLength={4}
                value={editPin || ''}
                onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                placeholder="1234"
                className="w-full px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500 text-center"
              />
            </div>
          </div>

          {/* Scheme, Status & Role Dense Controls Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800 text-[10px]">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">মাসিক সঞ্চয় লক্ষ্যমাত্রা (BDT)</label>
              <input
                type="number"
                value={editMonthlySavingsTarget === '' ? '' : (editMonthlySavingsTarget ?? 1000)}
                onChange={(e) => setEditMonthlySavingsTarget(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">সমিতি স্কিম স্থিতি</label>
              <select
                value={editSamitySchemeActive ? 'active' : 'inactive'}
                onChange={(e) => setEditSamitySchemeActive(e.target.value === 'active')}
                className="w-full px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="active">✅ সঞ্চয় স্কিম সচল</option>
                <option value="inactive">❌ সঞ্চয় স্কিম নিষ্ক্রিয়</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">অ্যাকাউন্ট স্ট্যাটাস</label>
              <select
                value={editUserStatus || 'active'}
                onChange={(e) => setEditUserStatus(e.target.value as 'active' | 'suspended')}
                className="w-full px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="active">🟢 একাউন্ট সচল (Active)</option>
                <option value="suspended">🔴 স্থগিত (Suspended)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">অ্যাকাউন্ট রোল / পদবী</label>
              <select
                value={editRole || 'user'}
                onChange={(e) => setEditRole(e.target.value as 'user' | 'admin' | 'sub_admin')}
                className="w-full px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="user">👤 সাধারণ মেম্বার (User)</option>
                <option value="sub_admin">🛡️ সাব-এডমিন (Sub-Admin)</option>
                <option value="admin">👑 সুপার এডমিন (Super Admin)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. 🔒 জিরো ডিভাইস অপশন, সিকিউরিটি ও অ্যাপ লক */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white space-y-2 text-left">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              <span>জিরো ডিভাইস অপশন, সিকিউরিটি ও অ্যাপ লক</span>
            </h4>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] font-bold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editDeviceLockBypassed)}
                  onChange={(e) => setEditDeviceLockBypassed(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span>ডিভাইস বাইপাস (Allow Any Device)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {/* Release Device / Zero Device Button */}
            <div className="bg-slate-800/90 border border-slate-700 p-2 rounded-lg flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold truncate">
                <span>বর্তমান ডিভাইস:</span>{' '}
                <span className="font-mono text-slate-300 text-[9px]">{editCurrentDeviceId ? String(editCurrentDeviceId).slice(0, 10) + '...' : 'জিরো (ডিভাইস নেই)'}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('⚠️ আপনি কি এই ইউজারের রেজিস্টার্ড ডিভাইস আইডি মুছে জিরো ডিভাইস করতে ও ফোর্স লগআউট করতে চান?')) {
                    setEditCurrentDeviceId('');
                    if (typeof setEditDeviceChangeRequested === 'function') setEditDeviceChangeRequested(false);
                    if (typeof handleReleaseAccountDeviceAndLogout === 'function') {
                      handleReleaseAccountDeviceAndLogout(targetUserId, editUserName || 'User');
                    } else {
                      alert('✅ ডিভাইস রিলিজ করা হয়েছে! সেভ বাটনে ক্লিক করুন।');
                    }
                  }
                }}
                className="w-full py-1 bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700 font-bold text-[10px] rounded transition cursor-pointer"
              >
                📱 জিরো ডিভাইস ও ফোর্স লগআউট
              </button>
            </div>

            {/* Instant Unlock Button */}
            <div className="bg-slate-800/90 border border-slate-700 p-2 rounded-lg flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold">
                <span>লক স্ট্যাটাস:</span>{' '}
                <span className={editIsAppLocked ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {editIsAppLocked ? '🔒 লকড' : '🔓 আনলকড'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditIsAppLocked(false);
                  setEditAppLockCode('');
                  if (typeof handleAdminInstantUnlockUser === 'function') {
                    handleAdminInstantUnlockUser(targetUserId);
                  } else {
                    alert('✅ অ্যাপ লক মুছে আনলক করা হয়েছে! সেভ বাটনে ক্লিক করুন।');
                  }
                }}
                className="w-full py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px] rounded transition cursor-pointer"
              >
                🔓 তাৎক্ষণিক আনলক করুন
              </button>
            </div>

            {/* App Lock Password Display with Copy */}
            <div className="bg-slate-800/90 border border-slate-700 p-2 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <span>🔐 গোপন অ্যাপ লক পাসওয়ার্ড</span>
                <button
                  type="button"
                  onClick={() => copyTextToClipboard(editAppLockCode || '', 'অ্যাপ লক কোড')}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>কপি</span>
                </button>
              </div>
              <input
                type="text"
                value={editAppLockCode || ''}
                onChange={(e) => setEditAppLockCode(e.target.value)}
                placeholder="কোনো লক কোড নেই"
                className="w-full px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono font-black text-amber-300 text-center"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. ⚡ কর্তন অপশন অথবা বোনাস (Auto Wallet Adjustment - Deduct or Bonus) */}
        {/* ========================================================================= */}
        <div className="bg-emerald-50/90 border border-emerald-300/80 p-2.5 rounded-xl text-left space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1">
              <span>⚡</span>
              <span>কর্তন অপশন অথবা বোনাস (Automatic Add / Deduct & Notice)</span>
            </h4>
            <span className="text-[9px] bg-emerald-200/80 text-emerald-900 font-bold px-1.5 py-0.2 rounded">
              স্বয়ংক্রিয় ট্রানজেকশন ও নোটিফিকেশন
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">লেনদেনের ধরন (Type)</label>
              <select
                value={adjType}
                onChange={(e) => {
                  const val = e.target.value as 'none' | 'bonus' | 'deduct';
                  setAdjType(val);
                  if (val === 'none') {
                    setAdjAmount('');
                    setAdjReason('');
                  }
                }}
                className="block w-full px-2 py-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-800 cursor-pointer"
              >
                <option value="none">কোনো পরিবর্তন নয় (No Change)</option>
                <option value="bonus">🎁 টাকা যোগ / বোনাস (Bonus / Deposit)</option>
                <option value="deduct">💸 টাকা কর্তন / চার্জ (Deduct / Charge)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">টাকার পরিমাণ (Amount ৳)</label>
              <input
                type="number"
                min="1"
                disabled={adjType === 'none'}
                value={adjAmount || ''}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="যেমনঃ 500"
                className="block w-full px-2 py-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">কারণ / রেফারেন্স নোট (Reason)</label>
              <input
                type="text"
                disabled={adjType === 'none'}
                value={adjReason || ''}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="যেমনঃ বিশেষ বোনাস / চার্জ কর্তন"
                className="block w-full px-2 py-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-semibold text-slate-800 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="pt-1 border-t border-emerald-200">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-emerald-900 shrink-0">📢 ইনবক্স নোটিশ:</span>
              <input
                type="text"
                value={customNoticeText || ''}
                onChange={(e) => setCustomNoticeText(e.target.value)}
                placeholder="সদস্যের নোটিফিকেশনে বিশেষ বার্তা পাঠাতে চাইলে এখানে লিখুন..."
                className="block w-full px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-[10px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. 👤 সদস্যের মৌলিক তথ্য সংশোধন (Compact Name, Member ID, Phone) */}
        {/* ========================================================================= */}
        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-left space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-emerald-700" />
              <span>সদস্যের মৌলিক তথ্য সংশোধন</span>
            </h4>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] font-bold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editHasSetProfile)}
                  onChange={(e) => setEditHasSetProfile(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>প্রোফাইল লক (সদস্য এডিট বন্ধ)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                সদস্যের পূর্ণ নাম <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editUserName || ''}
                onChange={(e) => setEditUserName(e.target.value)}
                placeholder="নাম লিখুন"
                className="block w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5 flex items-center justify-between">
                <span>🔒 মেম্বার সিরিয়াল আইডি</span>
                <span className="text-[9px] text-emerald-700 bg-emerald-100 px-1 rounded">এডমিন কন্ট্রোল</span>
              </label>
              <input
                type="text"
                required
                value={editUserMemberId || ''}
                onChange={(e) => setEditUserMemberId(e.target.value.toUpperCase())}
                placeholder="AMB00000001"
                className="block w-full px-2 py-1 bg-white border border-emerald-400 rounded-lg text-xs font-mono font-black text-emerald-950 uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                মোবাইল নম্বর (Phone)
              </label>
              <input
                type="text"
                value={editUserPhone || ''}
                onChange={(e) => setEditUserPhone(e.target.value)}
                placeholder="01700000000"
                className="block w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. 📋 সদস্যের বিস্তারিত তথ্য ও কেওয়াইসি (KYC Data Sheet) */}
        {/* ========================================================================= */}
        <div className="bg-white border border-slate-200 p-2.5 rounded-xl text-left space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>📋</span>
              <span>সদস্যের বিস্তারিত কেওয়াইসি তথ্য (KYC Data Sheet)</span>
            </h4>
            <span className="text-[9.5px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded">
              ব্যক্তিগত ও ঠিকানা তথ্য
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">পিতার নাম</label>
              <input
                type="text"
                value={editFatherName || ''}
                onChange={(e) => setEditFatherName(e.target.value)}
                placeholder="পিতার নাম"
                className="w-full px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">মাতার নাম</label>
              <input
                type="text"
                value={editMotherName || ''}
                onChange={(e) => setEditMotherName(e.target.value)}
                placeholder="মাতার নাম"
                className="w-full px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">জাতীয় পরিচয়পত্র (NID)</label>
              <input
                type="text"
                value={editNid || ''}
                onChange={(e) => setEditNid(e.target.value)}
                placeholder="NID নম্বর"
                className="w-full px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">জন্ম তারিখ (DOB)</label>
              <input
                type="text"
                value={editDob || ''}
                onChange={(e) => setEditDob(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">পেশা (Occupation)</label>
              <input
                type="text"
                value={editOccupation || ''}
                onChange={(e) => setEditOccupation(e.target.value)}
                placeholder="যেমনঃ ব্যবসা / চাকুরি"
                className="w-full px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">জরুরী মোবাইল (Alt Phone)</label>
              <input
                type="text"
                value={editAlternatePhone || ''}
                onChange={(e) => setEditAlternatePhone(e.target.value)}
                placeholder="বিকল্প নম্বর"
                className="w-full px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">বিভাগ (Division)</label>
              <input
                type="text"
                value={editDivision || ''}
                onChange={(e) => setEditDivision(e.target.value)}
                placeholder="বিভাগ"
                className="w-full px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">জেলা (District)</label>
              <input
                type="text"
                value={editDistrict || ''}
                onChange={(e) => setEditDistrict(e.target.value)}
                placeholder="জেলা"
                className="w-full px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">উপজেলা / থানা (Thana)</label>
              <input
                type="text"
                value={editThana || ''}
                onChange={(e) => setEditThana(e.target.value)}
                placeholder="থানা"
                className="w-full px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">পোস্ট অফিস / গ্রাম</label>
              <input
                type="text"
                value={editPostOffice || ''}
                onChange={(e) => setEditPostOffice(e.target.value)}
                placeholder="পোস্ট অফিস"
                className="w-full px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="col-span-2 sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">পূর্ণাঙ্গ স্থায়ী ঠিকানা (Full Address)</label>
              <input
                type="text"
                value={editFullAddress || ''}
                onChange={(e) => setEditFullAddress(e.target.value)}
                placeholder="গ্রাম, রোড, বাড়ি নম্বর, ডাকঘর..."
                className="w-full px-2 py-1 bg-slate-50 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 7. 🛡️ নমিনির তথ্য (Nominee Setup) */}
        {/* ========================================================================= */}
        <div className="bg-amber-50/70 border border-amber-250 p-2.5 rounded-xl text-left space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <span>🛡️</span>
              <span>নমিনির তথ্য (Nominee Setup)</span>
            </h4>
            <span className="text-[9px] bg-amber-200 text-amber-950 font-bold px-1.5 py-0.2 rounded">
              উত্তরাধিকারী
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">নমিনির নাম</label>
              <input
                type="text"
                value={editNomineeName || ''}
                onChange={(e) => setEditNomineeName(e.target.value)}
                placeholder="নমিনির নাম"
                className="w-full px-2 py-1 bg-white border border-amber-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">সম্পর্ক (Relation)</label>
              <input
                type="text"
                value={editNomineeRelation || ''}
                onChange={(e) => setEditNomineeRelation(e.target.value)}
                placeholder="যেমনঃ স্ত্রী / মাতা / ভাই"
                className="w-full px-2 py-1 bg-white border border-amber-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">নমিনির মোবাইল নম্বর</label>
              <input
                type="text"
                value={editNomineePhone || ''}
                onChange={(e) => setEditNomineePhone(e.target.value)}
                placeholder="01900000000"
                className="w-full px-2 py-1 bg-white border border-amber-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 8. 🪪 রেশন কার্ড তথ্য (Ration Card Setup) */}
        {/* ========================================================================= */}
        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-left space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1">
              <span>🪪</span>
              <span>রেশন কার্ড তথ্য (Ration Card Setup)</span>
            </h4>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${hasRationCard ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                {hasRationCard ? 'কার্ড আছে' : 'কার্ড নেই'}
              </span>
              <label className="inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={Boolean(editRationEnabled)} 
                  onChange={(e) => setEditRationEnabled(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="relative w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ms-1 text-[10px] font-bold text-slate-700">সচল</span>
              </label>
            </div>
          </div>

          {editRationEnabled && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-2 rounded-lg border border-slate-200 text-xs">
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">কার্ডধারীর নাম</label>
                <input
                  type="text"
                  value={editRationName || ''}
                  onChange={(e) => setEditRationName(e.target.value)}
                  className="w-full px-2 py-0.5 bg-slate-50 border border-slate-250 rounded text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">মোবাইল</label>
                <input
                  type="text"
                  value={editRationPhone || ''}
                  onChange={(e) => setEditRationPhone(e.target.value)}
                  className="w-full px-2 py-0.5 bg-slate-50 border border-slate-250 rounded text-xs font-mono font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">কার্ড নম্বর</label>
                <input
                  type="text"
                  value={editRationCardNo || ''}
                  onChange={(e) => setEditRationCardNo(e.target.value)}
                  className="w-full px-2 py-0.5 bg-slate-50 border border-slate-250 rounded text-xs font-mono font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">সিকিউরিটি পিন (৪ ডিজিট)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={editRationSecurityCode || ''}
                  onChange={(e) => setEditRationSecurityCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  className="w-full px-2 py-0.5 bg-emerald-50 border border-emerald-300 rounded text-xs font-mono font-black text-emerald-900 text-center"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">গ্রাম</label>
                <input
                  type="text"
                  value={editRationVillage || ''}
                  onChange={(e) => setEditRationVillage(e.target.value)}
                  className="w-full px-2 py-0.5 bg-slate-50 border border-slate-250 rounded text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">উপজেলা</label>
                <input
                  type="text"
                  value={editRationUpazila || ''}
                  onChange={(e) => setEditRationUpazila(e.target.value)}
                  className="w-full px-2 py-0.5 bg-slate-50 border border-slate-250 rounded text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">জেলা</label>
                <input
                  type="text"
                  value={editRationDistrict || ''}
                  onChange={(e) => setEditRationDistrict(e.target.value)}
                  className="w-full px-2 py-0.5 bg-slate-50 border border-slate-250 rounded text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">ইস্যু / মেয়াদ শেষ</label>
                <input
                  type="text"
                  value={`${editRationIssueDate || ''} - ${editRationExpiryDate || ''}`}
                  onChange={(e) => {
                    const parts = e.target.value.split('-');
                    if (parts[0]) setEditRationIssueDate(parts[0].trim());
                    if (parts[1]) setEditRationExpiryDate(parts[1].trim());
                  }}
                  placeholder="2026 - 2030"
                  className="w-full px-2 py-0.5 bg-slate-50 border border-slate-250 rounded text-xs font-mono font-bold text-slate-800"
                />
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 9. 🛡️ সাব-এডমিন সেকশন পারমিশন কন্ট্রোল (if editRole === 'sub_admin') */}
        {/* ========================================================================= */}
        {editRole === 'sub_admin' && (
          <div className="bg-slate-900 border border-purple-800/80 p-2.5 rounded-xl text-white space-y-2 text-left">
            <h4 className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>সাব-এডমিন সেকশন পারমিশন কন্ট্রোল (১২টি সেকশন)</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
              {[
                { id: 'samity', label: 'সমবায় সমিতি' },
                { id: 'escrow', label: 'নিরাপদ লেনদেন' },
                { id: 'qard', label: 'কর্জ হাসানা' },
                { id: 'remittance', label: 'রেমিট্যান্স' },
                { id: 'safi', label: 'সাফি ব্রান্ড' },
                { id: 'telecom', label: 'টেলিকম রিচার্জ' },
                { id: 'shop', label: 'সুপার শপ' },
                { id: 'ration', label: 'রেশন কার্ড' },
                { id: 'courier', label: 'কুরিয়ার' },
                { id: 'agent', label: 'এজেন্ট' },
                { id: 'target', label: 'লক্ষ্যমাত্রা' },
                { id: 'admin_panel', label: 'এডমিন পোর্টাল' }
              ].map(sec => {
                const isChecked = Array.isArray(editSubAdminPermissions)
                  ? editSubAdminPermissions.includes(sec.id)
                  : Boolean(editSubAdminPermissions && (editSubAdminPermissions as any)[sec.id]);

                return (
                  <label key={sec.id} className="flex items-center gap-1.5 bg-slate-800/90 p-1.5 rounded border border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (typeof setEditSubAdminPermissions === 'function') {
                          if (Array.isArray(editSubAdminPermissions)) {
                            const newArr = e.target.checked
                              ? [...editSubAdminPermissions.filter((id: string) => id !== sec.id), sec.id]
                              : editSubAdminPermissions.filter((id: string) => id !== sec.id);
                            setEditSubAdminPermissions(newArr);
                          } else {
                            setEditSubAdminPermissions({
                              ...(editSubAdminPermissions || {}),
                              [sec.id]: e.target.checked
                            });
                          }
                        }
                      }}
                      className="rounded text-purple-500 cursor-pointer"
                    />
                    <span className="text-slate-200 font-bold truncate">{sec.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 10. 📍 সদস্যের সর্বশেষ লাইভ লোকেশন ও সিকিউরিটি লগ */}
        {/* ========================================================================= */}
        {(() => {
          const userLat = editingUser.latitude ?? (editingUser as any).lat ?? (typeof (editingUser as any).lastLocation === 'object' ? ((editingUser as any).lastLocation?.latitude ?? (editingUser as any).lastLocation?.lat) : undefined);
          const userLng = editingUser.longitude ?? (editingUser as any).lng ?? (typeof (editingUser as any).lastLocation === 'object' ? ((editingUser as any).lastLocation?.longitude ?? (editingUser as any).lastLocation?.lng) : undefined);
          const hasCoords = userLat !== undefined && userLng !== undefined && !isNaN(Number(userLat)) && !isNaN(Number(userLng));
          const latNum = hasCoords ? Number(userLat) : null;
          const lngNum = hasCoords ? Number(userLng) : null;

          const rawAddress = editingUser.fullAddress || 
            (typeof (editingUser as any).lastLocation === 'string' ? (editingUser as any).lastLocation : (editingUser as any).lastLocation?.address) || 
            (editingUser as any).address || 
            [editingUser.village, editingUser.thana, editingUser.district, editingUser.division, editingUser.country].filter(Boolean).join(', ') || 
            'লগইনে স্বয়ংক্রিয় সিঙ্ক হবে';
          const userAddress = safePrimitiveString(rawAddress, 'লগইনে স্বয়ংক্রিয় সিঙ্ক হবে');

          const rawIp = editingUser.lastLoginIP || (editingUser as any).ip || (editingUser as any).lastIp || (typeof (editingUser as any).lastLocation === 'object' ? (editingUser as any).lastLocation?.ip : '') || (editingUser as any).loginIp;
          const userIp = safePrimitiveString(rawIp, 'N/A');

          const rawTime = editingUser.locationLastUpdated || (editingUser as any).lastLoginTime || (editingUser as any).updatedAt;
          const userLocTime = formatSafeDateTime(rawTime);

          const mapQuery = hasCoords ? `${latNum},${lngNum}` : encodeURIComponent(userAddress);

          return (
            <div className="bg-slate-900 border border-emerald-500/60 p-2.5 rounded-xl text-white space-y-2 text-left shadow-lg">
              <div className="flex items-center justify-between flex-wrap gap-1.5 border-b border-slate-800 pb-1.5">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>সদস্যের সর্বশেষ লাইভ লোকেশন ও সিকিউরিটি লগ</span>
                </h4>
                <div className="flex items-center gap-1.5">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition shadow-xs"
                  >
                    <span>🗺️ গুগল ম্যাপসে লাইভ দেখুন</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-950/70 p-2.5 rounded-lg text-xs border border-slate-800">
                {/* 1. GPS Coordinates */}
                <div className="space-y-0.5">
                  <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                    <span>GPS কোঅর্ডিনেট (লোকেশন নাম্বার):</span>
                    {hasCoords && (
                      <button
                        type="button"
                        onClick={() => copyTextToClipboard(`${latNum?.toFixed(6)}, ${lngNum?.toFixed(6)}`, 'GPS কোঅর্ডিনেট')}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 text-[9px] cursor-pointer"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        <span>কপি</span>
                      </button>
                    )}
                  </div>
                  <div className="font-mono text-emerald-300 font-extrabold text-xs bg-slate-900 px-2 py-1 rounded border border-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{hasCoords ? `${latNum?.toFixed(6)}, ${lngNum?.toFixed(6)}` : 'লগইনে সিঙ্ক হবে'}</span>
                  </div>
                </div>

                {/* 2. Address / Place Name */}
                <div className="space-y-0.5">
                  <div className="text-[10px] text-slate-400 font-bold">
                    <span>জায়গার নাম / পূর্ণাঙ্গ ঠিকানা:</span>
                  </div>
                  <div className="text-slate-100 font-bold text-xs bg-slate-900 px-2 py-1 rounded border border-slate-800 truncate" title={userAddress}>
                    {userAddress}
                  </div>
                </div>

                {/* 3. Login IP & Time */}
                <div className="space-y-0.5">
                  <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                    <span>লগইন আইপি:</span>
                    <span className="text-[9px] text-slate-500 font-mono">{userLocTime}</span>
                  </div>
                  <div className="font-mono text-amber-300 font-bold text-xs bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    {userIp}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ========================================================================= */}
        {/* 11. 📜 সদস্যের নিজস্ব লেনদেন ইতিহাস ও এডমিন ডিলেট কন্ট্রোল */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 border border-indigo-500/60 p-2.5 rounded-xl text-white space-y-2 text-left">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1 flex-wrap gap-1">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>📜</span>
              <span>সদস্যের নিজস্ব লেনদেন ইতিহাস ও ডিলেট কন্ট্রোল ({totalTxCount} টি)</span>
            </h4>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-slate-800 px-2 py-0.5 rounded">
              সফল মোট: ৳{totalSuccessSum.toLocaleString()}
            </span>
          </div>

          {memberTxs.length === 0 ? (
            <div className="py-4 text-center text-slate-400 text-xs">
              এই সদস্যের এখনো কোনো লেনদেন ইতিহাস পাওয়া যায়নি।
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
              {memberTxs.map((tx: any, idx: number) => {
                const dateStr = formatSafeDateTime(tx.createdAt || tx.date || tx.timestamp);
                const displayType = safePrimitiveString(tx.typeLabel || tx.type, 'লেনদেন');
                const displayAmount = safePrimitiveNumber(tx.amount, 0);
                const method = safePrimitiveString(tx.paymentMethod || tx.method, 'গেটেওয়ে');
                const trxId = safePrimitiveString(tx.trxId || tx.transactionId || tx.receiptNo || tx.id, 'N/A');
                const desc = safePrimitiveString(tx.description || tx.adminNote || tx.note, '');

                const isSuccessTx = tx.status === 'success' || (tx.status as any) === 'approved' || (tx.status as any) === 'completed';
                const isRejectedTx = (tx.status as any) === 'rejected' || (tx.status as any) === 'failed' || (tx.status as any) === 'canceled' || (tx.status as any) === 'cancelled';
                const isOnHoldTx = (tx.status as any) === 'on_hold' || (tx as any).status === 'hold' || (tx as any).reviewStatus === 'on_hold';
                const isPendingTx = !isSuccessTx && !isRejectedTx && !isOnHoldTx;

                return (
                  <div 
                    key={`${tx.id || 'mtx'}-${idx}`}
                    className="bg-slate-950/80 border border-slate-800 p-2 rounded-lg flex items-center justify-between gap-2 text-[10px]"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white bg-slate-800 px-1.5 py-0.2 rounded">
                          {displayType}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${isSuccessTx ? 'bg-emerald-950 text-emerald-300' : isOnHoldTx ? 'bg-blue-950 text-blue-300' : isPendingTx ? 'bg-amber-950 text-amber-300' : 'bg-rose-950 text-rose-300'}`}>
                          {isSuccessTx ? '🟢 সফল' : isOnHoldTx ? '⏸️ অপেক্ষমাণ' : isPendingTx ? '🟡 পেন্ডিং' : '🔴 বাতিল'}
                        </span>
                        <span className="font-mono text-cyan-300 bg-cyan-950/80 px-1 rounded text-[9px]">
                          ID: {trxId}
                        </span>
                      </div>
                      <div className="text-slate-400 flex items-center gap-2 flex-wrap text-[9.5px]">
                        <span>📅 {dateStr}</span>
                        <span>🏦 {method}</span>
                        {desc && <span className="text-slate-300 italic truncate max-w-xs">"{desc}"</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono font-bold text-xs ${
                        isRejectedTx
                          ? 'text-slate-500 line-through'
                          : (tx.type === 'withdraw' || tx.type === 'telecom_recharge' || tx.type === 'qard_withdrawal')
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                      }`}>
                        {(tx.type === 'withdraw' || tx.type === 'telecom_recharge' || tx.type === 'qard_withdrawal') ? '-' : '+'}৳{displayAmount.toLocaleString()}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          if (typeof handleAdminDeleteTransaction === 'function') {
                            handleAdminDeleteTransaction(tx.id, `${displayType} - ৳${displayAmount}`);
                          }
                        }}
                        className="p-1 bg-rose-900/80 hover:bg-rose-700 text-rose-200 rounded transition cursor-pointer"
                        title="লেনদেন ডিলেট করুন"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Save & Cancel Action Bar */}
        <div className="flex gap-2 pt-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm sticky bottom-0 z-10">
          <button
            type="button"
            disabled={isSavingUser}
            onClick={() => setEditingUser(null)}
            className="flex-1 py-2 border border-slate-300 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
          >
            ❌ বাতিল করুন
          </button>
          <button
            type="button"
            disabled={isSavingUser}
            onClick={handleSaveEditUser}
            className="flex-1 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shadow cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isSavingUser ? (
              <span className="animate-pulse">সংরক্ষণ হচ্ছে...</span>
            ) : (
              <span>✅ সমস্ত ডাটা সংরক্ষণ করুন</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

/**
 * Exported AdminUserEditModal wrapped with AdminUserEditErrorBoundary
 */
export function AdminUserEditModal(props: any) {
  if (!props.editingUser) return null;
  return (
    <AdminUserEditErrorBoundary onClose={() => props.setEditingUser?.(null)}>
      <AdminUserEditModalContent {...props} />
    </AdminUserEditErrorBoundary>
  );
}
