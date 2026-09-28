import { doc, getDoc, updateDoc, setDoc, runTransaction, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { User, Transaction, SAMITY_MONTHS, getEffectiveBalance, normalizePaidMonthsArray, getUniquePaidMonthsCount, getEffectivePaidMonthsList } from '../types';

/**
 * Check if a specific month is marked as paid for a user.
 */
export function isUserMonthPaid(user: User, year: number, monthId: string, monthIdx?: number): boolean {
  if (!user) return false;
  const targetRate = Math.max(1, Number(user.monthlySavingsTarget) || 1000);
  const userSavings = Math.max(Number(user.savings) || 0, Number(user.dpsBalance) || 0);
  const effectivePaidList = getEffectivePaidMonthsList(user.samityPaidMonths || [], userSavings, targetRate);

  const cleanMonthId = monthId.toLowerCase().trim();
  const yearKey = `${year}-${cleanMonthId}`;
  if (effectivePaidList.includes(yearKey)) return true;

  const mIndex = monthIdx !== undefined ? monthIdx : SAMITY_MONTHS.findIndex(m => m.id === cleanMonthId);
  const mNum = mIndex >= 0 ? mIndex + 1 : 0;
  const mNumPad = mNum < 10 ? `0${mNum}` : `${mNum}`;

  for (const k of effectivePaidList) {
    if (k === yearKey || k === `${year}_${cleanMonthId}` || k === `${year}-${mNum}` || k === `${year}-${mNumPad}`) {
      return true;
    }
    if (year === 2026 && (k === cleanMonthId || k === `2026-${cleanMonthId}` || k === `2026-${mNum}` || k === `2026-${mNumPad}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all unpaid months for a user up to a given month/year or across the full year/target years.
 * Parameters:
 * - user: User object
 * - targetYear: year to evaluate (default: current calendar year)
 * - upToCurrentMonthOnly: if true, strictly excludes future months (idx > currentMonthIdx) and future years
 * - enforceGracePeriod: if true, for the current running month, if today is on or before the 9th, it is considered within grace period (not yet overdue)
 */
export function getUnpaidSamityMonths(
  user: User,
  targetYear: number = new Date().getFullYear(),
  upToCurrentMonthOnly: boolean = false,
  enforceGracePeriod: boolean = false
): Array<{ id: string; monthNum: number; name: string; short: string; year: number; index: number }> {
  if (!user) return [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0 to 11 (8 = September)
  const currentDay = now.getDate(); // 1 to 31

  // If upToCurrentMonthOnly is true and targetYear is in the future, return empty
  if (upToCurrentMonthOnly && targetYear > currentYear) {
    return [];
  }

  const unpaid: Array<{ id: string; monthNum: number; name: string; short: string; year: number; index: number }> = [];

  SAMITY_MONTHS.forEach((m, idx) => {
    // If upToCurrentMonthOnly is true and targetYear is currentYear, strictly ignore future months
    if (upToCurrentMonthOnly && targetYear === currentYear && idx > currentMonthIdx) {
      return;
    }
    // If enforceGracePeriod is requested and targetYear is currentYear and this is the current month:
    // If today is <= 9th (1st to 9th of the month), member has time to pay manually, NOT overdue!
    if (enforceGracePeriod && targetYear === currentYear && idx === currentMonthIdx && currentDay <= 9) {
      return;
    }
    const isPaid = isUserMonthPaid(user, targetYear, m.id, idx);
    if (!isPaid) {
      unpaid.push({
        id: m.id,
        monthNum: m.monthNum,
        name: m.name,
        short: m.short,
        year: targetYear,
        index: idx
      });
    }
  });

  return unpaid;
}

/**
 * Returns STRICTLY OVERDUE months that are eligible for AUTO-DEDUCTION.
 * Absolute Rules:
 * 1. Future months (e.g. October, November, December when in September) can NEVER be auto-deducted under any circumstances!
 * 2. The Current Month (e.g. September) has a grace period from the 1st to the 9th:
 *    - If currentDay <= 9 (1st through 9th): Current month is NOT overdue. It will NEVER be auto-deducted!
 *    - If currentDay > 9 (from 10th onwards): Current month is now overdue if unpaid, and eligible for auto-deduction.
 * 3. Past unpaid months (e.g. January through August when in September) are overdue and eligible.
 * 4. Months are returned in strict chronological order (oldest overdue month first).
 */
export function getOverdueSamityMonthsForAutoDeduction(user: User): Array<{ id: string; monthNum: number; name: string; short: string; year: number; index: number }> {
  if (!user) return [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0-indexed (8 = September)
  const currentDay = now.getDate(); // 1 to 31

  const overdueList: Array<{ id: string; monthNum: number; name: string; short: string; year: number; index: number }> = [];

  // Check 2026 / currentYear months up to currentMonthIdx
  SAMITY_MONTHS.forEach((m, idx) => {
    // RULE 1: STRICT BAN ON FUTURE MONTHS (idx > currentMonthIdx)
    // October, November, December etc. are NEVER overdue and MUST NEVER be auto-deducted!
    if (idx > currentMonthIdx) {
      return;
    }

    // RULE 2: GRACE PERIOD FOR CURRENT MONTH (idx === currentMonthIdx)
    // Members have until the 9th of each month to pay manually.
    // If today is <= 9 (e.g. 1st through 9th of September), it is NOT overdue!
    if (idx === currentMonthIdx && currentDay <= 9) {
      return;
    }

    // If unpaid, add to overdue list
    const isPaid = isUserMonthPaid(user, currentYear, m.id, idx);
    if (!isPaid) {
      overdueList.push({
        id: m.id,
        monthNum: m.monthNum,
        name: m.name,
        short: m.short,
        year: currentYear,
        index: idx
      });
    }
  });

  // Sort chronologically (earliest overdue month first)
  overdueList.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.index - b.index;
  });

  return overdueList;
}

export interface AutoDeductionResult {
  success: boolean;
  userId: string;
  userName: string;
  deductedAmount: number;
  monthsPaid: Array<{ id: string; name: string; year: number }>;
  newMainBalance: number;
  newSavingsBalance: number;
  message?: string;
  reason?: 'not_eligible' | 'no_unpaid_months' | 'insufficient_balance' | 'error' | 'already_processed';
}

/**
 * Executes automatic monthly savings deduction for a single user from their Main Balance.
 * Rule:
 * - Must be a registered Samity member (samityStatus === 'approved' or isSamityMember or monthlySavingsTarget > 0).
 * - Target rate per month (e.g. 1000, 2000, 5000, etc.).
 * - Only deducts FULL installment. If balance < targetRate, does NOT deduct anything.
 * - In auto-deduction, deducts at most ONE overdue month per run to strictly protect the member's wallet balance.
 * - NEVER auto-deducts future months (October, November, etc.).
 * - If today <= 9th of the month, the current month (September) has grace period and CANNOT be auto-deducted.
 */
export async function processUserSamitySavingsAutoDeduction(
  user: User,
  options?: {
    maxMonths?: number;
    specificMonths?: Array<{ id: string; year: number; name?: string }>;
    forceAdminRun?: boolean;
    isExplicitUserAction?: boolean;
    customNote?: string;
  }
): Promise<AutoDeductionResult> {
  if (!user || !user.uid) {
    return {
      success: false,
      userId: '',
      userName: '',
      deductedAmount: 0,
      monthsPaid: [],
      newMainBalance: 0,
      newSavingsBalance: 0,
      reason: 'not_eligible',
      message: 'অবৈধ ব্যবহারকারী প্রোফাইল।'
    };
  }

  // Check if user has explicitly turned off auto savings switch, or not explicitly enabled for background run
  const isExplicitAction = Boolean(options?.isExplicitUserAction || options?.forceAdminRun || (options?.specificMonths && options.specificMonths.length > 0));
  if (!isExplicitAction) {
    if (user.samityAutoSavingsActive !== true || user.samityDeactivateStatus === 'self_opted_out') {
      return {
        success: false,
        userId: user.uid,
        userName: user.name || 'সদস্য',
        deductedAmount: 0,
        monthsPaid: [],
        newMainBalance: getEffectiveBalance(user),
        newSavingsBalance: Number(user.savings) || 0,
        reason: 'not_eligible',
        message: 'আপনার সমবায় সঞ্চয় অটো-ডেবিট সক্রিয় নেই। কোনো টাকা কাটা হবে না।'
      };
    }
  }

  // Check if eligible: must have samityStatus === 'approved' or isSamityMember or monthlySavingsTarget > 0
  const isSamityMember = user.samityStatus === 'approved' || user.isSamityMember === true || (user.monthlySavingsTarget && user.monthlySavingsTarget > 0);
  if (!isSamityMember && !options?.forceAdminRun) {
    return {
      success: false,
      userId: user.uid,
      userName: user.name || 'সদস্য',
      deductedAmount: 0,
      monthsPaid: [],
      newMainBalance: getEffectiveBalance(user),
      newSavingsBalance: Number(user.savings) || 0,
      reason: 'not_eligible',
      message: 'সদস্য সমবায় সমিতিতে নিবন্ধিত নন।'
    };
  }

  const targetRate = Math.max(1, Number(user.monthlySavingsTarget) || 1000);
  const now = new Date();
  const currentDay = now.getDate();

  // Find unpaid months to pay
  let targetUnpaidMonths: Array<{ id: string; monthNum: number; name: string; short: string; year: number; index: number }> = [];

  if (options?.specificMonths && options.specificMonths.length > 0) {
    targetUnpaidMonths = options.specificMonths.map(sm => {
      const found = SAMITY_MONTHS.find(m => m.id === sm.id) || { id: sm.id, monthNum: 1, name: sm.name || sm.id, short: sm.id };
      const idx = SAMITY_MONTHS.findIndex(m => m.id === sm.id);
      return {
        ...found,
        year: sm.year,
        index: idx >= 0 ? idx : 0
      };
    });
  } else {
    // STRICT RULE: For auto-deduction, ONLY get overdue months!
    // NEVER include future months (October, November, etc.) and NEVER include current month if day <= 9!
    targetUnpaidMonths = getOverdueSamityMonthsForAutoDeduction(user);
  }

  if (targetUnpaidMonths.length === 0) {
    const isWithinGrace = currentDay <= 9;
    const msg = isWithinGrace
      ? 'চলতি মাসের ৯ তারিখ পর্যন্ত কিস্তি পরিশোধের স্বাভাবিক সময় নির্ধারিত রয়েছে। ৯ তারিখের পূর্বে অটোমেটিক কোনো কিস্তি কাটা হবে না এবং ভবিষ্যৎ মাসের (অক্টোবর, নভেম্বর ইত্যাদি) টাকা কখনো কাটা হয় না।'
      : 'বর্তমানে কোনো বকেয়া কিস্তি নেই। অগ্রিম বা ভবিষ্যৎ মাসের টাকা অটোমেটিক কাটা সম্পূর্ণ নিষিদ্ধ।';
    return {
      success: false,
      userId: user.uid,
      userName: user.name || 'সদস্য',
      deductedAmount: 0,
      monthsPaid: [],
      newMainBalance: getEffectiveBalance(user),
      newSavingsBalance: Number(user.savings) || 0,
      reason: 'no_unpaid_months',
      message: msg
    };
  }

  const userRef = doc(db, 'users', user.uid);

  try {
    const result = await runTransaction(db, async (transaction) => {
      const uSnap = await transaction.get(userRef);
      if (!uSnap.exists()) {
        throw new Error('ব্যবহারকারীর প্রোফাইল ডেটাবেজে পাওয়া যায়নি।');
      }

      const freshData = uSnap.data() as User;
      const liveBal = getEffectiveBalance(freshData);
      const userMonthlyTarget = Math.max(1, Number(freshData.monthlySavingsTarget) || Number(user.monthlySavingsTarget) || targetRate);

      // Must have at least 1 full installment in main balance
      if (liveBal < userMonthlyTarget) {
        return {
          success: false,
          userId: user.uid,
          userName: freshData.name || user.name || 'সদস্য',
          deductedAmount: 0,
          monthsPaid: [],
          newMainBalance: liveBal,
          newSavingsBalance: Number(freshData.savings) || 0,
          reason: 'insufficient_balance' as const,
          message: `মেইন ব্যালেন্স ৳${liveBal.toLocaleString('bn-BD')} টাকা। পূর্ণ কিস্তির পরিমাণ ৳${userMonthlyTarget.toLocaleString('bn-BD')} টাকার কম হওয়ায় কোনো টাকা কাটা হয়নি।`
        };
      }

      // Collect all truly overdue months in real-time from freshData
      let freshUnpaidList: Array<{ id: string; monthNum: number; name: string; short: string; year: number; index: number }> = [];
      if (options?.specificMonths && options.specificMonths.length > 0) {
        freshUnpaidList = options.specificMonths
          .map(sm => {
            const found = SAMITY_MONTHS.find(m => m.id === sm.id) || { id: sm.id, monthNum: 1, name: sm.name || sm.id, short: sm.id };
            const idx = SAMITY_MONTHS.findIndex(m => m.id === sm.id);
            return { ...found, year: sm.year, index: idx >= 0 ? idx : 0 };
          })
          .filter(m => !isUserMonthPaid(freshData, m.year, m.id, m.index));
      } else {
        // STRICT RULE: For auto-deduction, ONLY get overdue months!
        freshUnpaidList = getOverdueSamityMonthsForAutoDeduction(freshData);
      }

      if (freshUnpaidList.length === 0) {
        const isWithinGrace = new Date().getDate() <= 9;
        return {
          success: false,
          userId: user.uid,
          userName: freshData.name || user.name || 'সদস্য',
          deductedAmount: 0,
          monthsPaid: [],
          newMainBalance: liveBal,
          newSavingsBalance: Number(freshData.savings) || 0,
          reason: 'already_processed' as const,
          message: isWithinGrace
            ? 'চলতি মাসের ৯ তারিখ পর্যন্ত কিস্তি দেওয়ার সুযোগ রয়েছে। এই সময়ে কোনো অটোমেটিক কর্তন করা হবে না।'
            : 'কোনো বকেয়া কিস্তি অবশিষ্ট নেই।'
        };
      }

      // CRITICAL PROTECTIVE RULE:
      // Auto-deduction must NEVER sweep multiple months from the member's wallet!
      // Even if member has large balance, auto-deduction processes at most 1 overdue month at a time.
      const limit = (options?.specificMonths && options.specificMonths.length > 0)
        ? options.specificMonths.length
        : 1;
      const monthsToProcess = freshUnpaidList.slice(0, Math.min(limit, freshUnpaidList.length));

      if (monthsToProcess.length === 0) {
        return {
          success: false,
          userId: user.uid,
          userName: freshData.name || user.name || 'সদস্য',
          deductedAmount: 0,
          monthsPaid: [],
          newMainBalance: liveBal,
          newSavingsBalance: Number(freshData.savings) || 0,
          reason: 'insufficient_balance' as const,
          message: `পর্যাপ্ত ব্যালেন্স নেই। প্রতি কিস্তি ৳${userMonthlyTarget.toLocaleString('bn-BD')} BDT।`
        };
      }

      const totalToDeduct = monthsToProcess.length * userMonthlyTarget;
      const currentSavings = Number(freshData.savings) || 0;
      const newSavings = currentSavings + totalToDeduct;
      const newMainBal = Math.max(0, liveBal - totalToDeduct);
      const newShares = Math.floor(newSavings / 1000);

      const existingPaidList: string[] = Array.isArray(freshData.samityPaidMonths) ? freshData.samityPaidMonths : [];
      const newKeysToAdd = monthsToProcess.map(m => `${m.year}-${m.id}`);
      const updatedPaidMonths = normalizePaidMonthsArray(
        [...existingPaidList, ...newKeysToAdd],
        newSavings,
        userMonthlyTarget
      );

      // Update user document
      transaction.update(userRef, {
        balance: newMainBal,
        mainBalance: newMainBal,
        savings: newSavings,
        dpsBalance: newSavings,
        shares: newShares,
        samityPaidMonths: updatedPaidMonths,
        lastPaidMonth: `${monthsToProcess[monthsToProcess.length - 1].year}-${monthsToProcess[monthsToProcess.length - 1].id}`,
        lastAutoSavingsDeductionAt: new Date().toISOString()
      });

      // Format Bengali month labels
      const monthNamesStr = monthsToProcess.map(m => `${m.name} ${m.year}`).join(', ');

      const txRef = doc(collection(db, 'transactions'));
      const notifRef = doc(collection(db, 'user_notifications'));
      const nowIso = new Date().toISOString();
      const receiptCode = `AUTO-SAV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 1. Transaction Ledger Record (dual-indexed by userId, memberId, phone, and userPhone for 10-year durability)
      transaction.set(txRef, {
        id: txRef.id,
        userId: user.uid,
        userName: freshData.name || user.name || '',
        userPhone: freshData.phone || user.phone || '',
        phone: freshData.phone || user.phone || '',
        memberId: freshData.memberId || user.memberId || (freshData as any).customUserId || '',
        type: 'samity_deposit',
        typeLabel: `সমবায় সঞ্চয় কিস্তি কর্তন (${monthNamesStr})`,
        amount: totalToDeduct,
        status: 'approved',
        isApproved: true,
        paymentMethod: 'Al Mayadin Wallet',
        description: options?.customNote || `মেইন ব্যালেন্স থেকে ${monthNamesStr} সমবায় সঞ্চয় কিস্তি ৳${totalToDeduct.toLocaleString('bn-BD')} টাকা স্বয়ংক্রিয়ভাবে কর্তন করে সঞ্চয় ফাণ্ডে জমা করা হয়েছে।`,
        createdAt: nowIso,
        receiptNo: receiptCode
      });

      // 2. Automated User Notification (Bell icon inbox)
      transaction.set(notifRef, {
        id: notifRef.id,
        userId: user.uid,
        memberId: freshData.memberId || user.memberId || '',
        title: `✅ সমবায় সঞ্চয় অটো-জমা সম্পন্ন (${monthNamesStr})`,
        body: `আপনার মেইন ব্যালেন্স থেকে ${monthNamesStr} মাসের সঞ্চয় কিস্তি ৳${totalToDeduct.toLocaleString('bn-BD')} টাকা সফলভাবে কেটে সমবায় সঞ্চয় তহবিলে জমা করা হয়েছে। বর্তমান সঞ্চয় ব্যালেন্স: ৳${newSavings.toLocaleString('bn-BD')}।`,
        read: false,
        isPersonal: true,
        isTransactionHistory: true,
        category: 'transaction',
        createdAt: nowIso
      });

      return {
        success: true,
        userId: user.uid,
        userName: freshData.name || user.name || 'সদস্য',
        deductedAmount: totalToDeduct,
        monthsPaid: monthsToProcess.map(m => ({ id: m.id, name: m.name, year: m.year })),
        newMainBalance: newMainBal,
        newSavingsBalance: newSavings,
        message: `${monthNamesStr} মাসের সঞ্চয় কিস্তি ৳${totalToDeduct.toLocaleString('bn-BD')} টাকা সফলভাবে মেইন ব্যালেন্স থেকে কর্তন করে সঞ্চয়ে জমা করা হয়েছে।`
      };
    });

    return result;
  } catch (error: any) {
    console.error('Error in processUserSamitySavingsAutoDeduction:', error);
    return {
      success: false,
      userId: user.uid,
      userName: user.name || 'সদস্য',
      deductedAmount: 0,
      monthsPaid: [],
      newMainBalance: getEffectiveBalance(user),
      newSavingsBalance: Number(user.savings) || 0,
      reason: 'error',
      message: error?.message || 'সঞ্চয় অটো-কর্তন প্রক্রিয়াকরণে সমস্যা হয়েছে।'
    };
  }
}

/**
 * Bulk runs automatic monthly savings deduction for all eligible registered members who have unpaid months and sufficient main balance.
 */
export async function processBulkSamitySavingsAutoDeduction(
  users: User[],
  options?: {
    targetYear?: number;
  }
): Promise<{
  totalEligible: number;
  processedCount: number;
  totalCollected: number;
  skippedCount: number;
  results: AutoDeductionResult[];
}> {
  const currentYear = options?.targetYear || new Date().getFullYear();
  const eligibleMembers = users.filter(u => 
    (u.samityStatus === 'approved' || u.isSamityMember === true || (u.monthlySavingsTarget && u.monthlySavingsTarget > 0)) &&
    u.samityAutoSavingsActive !== false &&
    u.samityDeactivateStatus !== 'self_opted_out'
  );

  const results: AutoDeductionResult[] = [];
  let processedCount = 0;
  let totalCollected = 0;
  let skippedCount = 0;

  for (const member of eligibleMembers) {
    const targetRate = Math.max(1, Number(member.monthlySavingsTarget) || 1000);
    const liveBal = getEffectiveBalance(member);

    // If user doesn't even have 1 full installment, skip quickly without hitting DB
    if (liveBal < targetRate) {
      skippedCount++;
      continue;
    }

    // STRICT CHECK: Only check OVERDUE months (past months, or current month ONLY if day > 9)
    // NEVER future months (October, November, etc.)
    const overdue = getOverdueSamityMonthsForAutoDeduction(member);
    if (overdue.length === 0) {
      skippedCount++;
      continue;
    }

    // Run deduction strictly for 1 overdue month
    const res = await processUserSamitySavingsAutoDeduction(member, { maxMonths: 1 });
    results.push(res);
    if (res.success && res.deductedAmount > 0) {
      processedCount++;
      totalCollected += res.deductedAmount;
    } else {
      skippedCount++;
    }
  }

  return {
    totalEligible: eligibleMembers.length,
    processedCount,
    totalCollected,
    skippedCount,
    results
  };
}

/**
 * Scans all users or a specific user to detect any erroneously deducted future/advance months
 * (such as October, November, December 2026) and instantly refunds them to the member's Main Balance!
 */
export async function adminRefundAllFutureAdvanceMonths(
  users: User[],
  targetUid?: string
): Promise<{
  totalRefundedMembers: number;
  totalRefundedAmount: number;
  refundDetails: Array<{ uid: string; name: string; refundedMonths: string[]; refundedAmount: number }>;
}> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 8 for Sept
  const futureMonthIds = SAMITY_MONTHS.slice(currentMonthIdx + 1).map(m => m.id); // ['october', 'november', 'december']

  const targetUsers = targetUid 
    ? users.filter(u => (u.uid || (u as any).id) === targetUid)
    : users;

  let totalRefundedMembers = 0;
  let totalRefundedAmount = 0;
  const refundDetails: Array<{ uid: string; name: string; refundedMonths: string[]; refundedAmount: number }> = [];

  for (const u of targetUsers) {
    const uid = u.uid || (u as any).id;
    if (!uid) continue;

    const paidList: string[] = Array.isArray(u.samityPaidMonths) ? u.samityPaidMonths : [];
    if (paidList.length === 0) continue;

    // Find all future month keys (e.g. '2026-october', '2026-november', 'october', 'november')
    const erroneousKeys = paidList.filter(k => {
      const lower = k.toLowerCase().trim();
      return futureMonthIds.some(fId => 
        lower === `${currentYear}-${fId}` || 
        lower === `${currentYear}_${fId}` || 
        (currentYear === 2026 && lower === fId)
      );
    });

    if (erroneousKeys.length === 0) continue;

    const targetRate = Math.max(1, Number(u.monthlySavingsTarget) || 1000);
    const refundAmount = erroneousKeys.length * targetRate;
    const currentSavings = Number(u.savings) || 0;
    const currentBal = getEffectiveBalance(u);
    const newMainBal = currentBal + refundAmount;
    const newSavings = Math.max(0, currentSavings - refundAmount);
    const newShares = Math.floor(newSavings / 1000);

    const updatedPaidMonths = paidList.filter(k => !erroneousKeys.includes(k));

    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        balance: newMainBal,
        mainBalance: newMainBal,
        savings: newSavings,
        dpsBalance: newSavings,
        shares: newShares,
        samityPaidMonths: updatedPaidMonths,
        updatedAt: new Date().toISOString()
      });

      const txRef = doc(collection(db, 'transactions'));
      const notifRef = doc(collection(db, 'user_notifications'));
      const nowIso = new Date().toISOString();
      const monthNames = erroneousKeys.map(k => {
        const idOnly = k.replace(`${currentYear}-`, '').replace(`${currentYear}_`, '');
        const found = SAMITY_MONTHS.find(m => m.id === idOnly);
        return found ? found.name : idOnly;
      }).join(', ');

      await setDoc(txRef, {
        id: txRef.id,
        userId: uid,
        userName: u.name || '',
        userPhone: u.phone || '',
        memberId: u.memberId || '',
        type: 'deposit',
        typeLabel: `ভুলবশত কর্তিত অগ্রিম সঞ্চয় রিফান্ড (${monthNames})`,
        amount: refundAmount,
        status: 'approved',
        isApproved: true,
        paymentMethod: 'Al Mayadin Wallet',
        description: `অগ্রিম মাসের (${monthNames}) সঞ্চয় কিস্তি ভুলবশত কর্তন হয়েছিল। এডমিন সিস্টেম কর্তৃক ৳${refundAmount.toLocaleString('bn-BD')} টাকা সদস্যের মেইন ব্যালেন্সে ফেরত প্রদান করা হয়েছে।`,
        createdAt: nowIso,
        receiptNo: `REF-ADV-${Date.now()}`
      });

      await setDoc(notifRef, {
        id: notifRef.id,
        userId: uid,
        memberId: u.memberId || '',
        title: `🔄 অগ্রিম কিস্তির ৳${refundAmount.toLocaleString('bn-BD')} টাকা মেইন ব্যালেন্সে রিফান্ড`,
        body: `আপনার একাউন্ট থেকে ভুলবশত কর্তিত অগ্রিম মাসের (${monthNames}) কিস্তির মোট ৳${refundAmount.toLocaleString('bn-BD')} টাকা সমবায় তহবিল থেকে প্রত্যাহার করে আপনার মেইন ব্যালেন্সে ফেরত জমা করা হয়েছে। আপনার নতুন মেইন ব্যালেন্স: ৳${newMainBal.toLocaleString('bn-BD')}।`,
        read: false,
        createdAt: nowIso,
        type: 'samity_refund'
      });

      totalRefundedMembers++;
      totalRefundedAmount += refundAmount;
      refundDetails.push({
        uid,
        name: u.name || 'সদস্য',
        refundedMonths: erroneousKeys,
        refundedAmount: refundAmount
      });
    } catch (err) {
      console.error('Error refunding advance month for user:', uid, err);
    }
  }

  return {
    totalRefundedMembers,
    totalRefundedAmount,
    refundDetails
  };
}

/**
 * Admin manual month settlement for a specific member.
 * Supports:
 * 1. deductFromMainBalance === true: Checks and deducts from user's app main balance.
 * 2. deductFromMainBalance === false: Direct admin credit / Cash settlement without touching user's main wallet.
 * 3. action === 'unmark': Allows admin to unmark / revert months if needed.
 */
export async function adminProcessSamityMonthSettlement({
  userId,
  year,
  monthIds,
  deductFromMainBalance = true,
  action = 'mark_paid',
  adminNote = '',
  adminName = 'এডমিন'
}: {
  userId: string;
  year: number;
  monthIds: string[];
  deductFromMainBalance?: boolean;
  action?: 'mark_paid' | 'unmark';
  adminNote?: string;
  adminName?: string;
}): Promise<{ success: boolean; message: string; user?: User }> {
  if (!userId || !monthIds || monthIds.length === 0) {
    return { success: false, message: 'সদস্য এবং অন্তত একটি মাস নির্বাচন করুন।' };
  }

  const userRef = doc(db, 'users', userId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      const uSnap = await transaction.get(userRef);
      if (!uSnap.exists()) {
        throw new Error('ব্যবহারকারীর প্রোফাইল পাওয়া যায়নি।');
      }

      const freshUser = uSnap.data() as User;
      const targetRate = Math.max(1, Number(freshUser.monthlySavingsTarget) || 1000);
      const currentSavings = Number(freshUser.savings) || 0;
      const liveBal = getEffectiveBalance(freshUser);
      const existingPaidList: string[] = Array.isArray(freshUser.samityPaidMonths) ? freshUser.samityPaidMonths : [];

      const monthNamesList = monthIds.map(mId => {
        const found = SAMITY_MONTHS.find(m => m.id === mId);
        return found ? `${found.name} ${year}` : `${mId} ${year}`;
      });
      const monthNamesStr = monthNamesList.join(', ');

      if (action === 'unmark') {
        // Remove the selected months from paid array and refund amount to main balance
        const keysToRemove = monthIds.map(mId => `${year}-${mId}`);
        const keysToRemoveAlt = monthIds.map(mId => `${year}_${mId}`);
        const keysToRemoveBare = year === 2026 ? monthIds : [];

        const updatedPaidMonths = existingPaidList.filter(k => 
          !keysToRemove.includes(k) && !keysToRemoveAlt.includes(k) && !keysToRemoveBare.includes(k)
        );

        const totalRefund = monthIds.length * targetRate;
        const newMainBal = liveBal + totalRefund;
        const newSavings = Math.max(0, currentSavings - totalRefund);
        const newShares = Math.floor(newSavings / 1000);

        transaction.update(userRef, {
          balance: newMainBal,
          mainBalance: newMainBal,
          savings: newSavings,
          dpsBalance: newSavings,
          shares: newShares,
          samityPaidMonths: updatedPaidMonths,
          updatedAt: new Date().toISOString()
        });

        const txRef = doc(collection(db, 'transactions'));
        const notifRef = doc(collection(db, 'user_notifications'));
        const nowIso = new Date().toISOString();
        const receiptCode = `ADM-REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Record Transaction
        transaction.set(txRef, {
          id: txRef.id,
          userId: userId,
          userName: freshUser.name || '',
          userPhone: freshUser.phone || '',
          memberId: freshUser.memberId || (freshUser as any).customUserId || '',
          type: 'deposit',
          typeLabel: `সমবায় সঞ্চয় প্রত্যাহার ও ব্যালেন্সে ফেরত (${monthNamesStr})`,
          amount: totalRefund,
          status: 'approved',
          isApproved: true,
          paymentMethod: 'Al Mayadin Wallet',
          description: adminNote || `এডমিন প্যানেল কর্তৃক ${monthNamesStr} সমবায় সঞ্চয় কিস্তি ৳${totalRefund.toLocaleString('bn-BD')} টাকা সমবায় তহবিল থেকে প্রত্যাহার করে মেইন ব্যালেন্সে ফেরত প্রদান করা হয়েছে।`,
          createdAt: nowIso,
          receiptNo: receiptCode
        });

        // Record Notification
        transaction.set(notifRef, {
          id: notifRef.id,
          userId: userId,
          memberId: freshUser.memberId || '',
          title: `🔄 সমবায় সঞ্চয় প্রত্যাহার ও ব্যালেন্সে ফেরত (${monthNamesStr})`,
          body: `এডমিন কর্তৃক ${monthNamesStr} মাসের সমবায় সঞ্চয় কিস্তির ৳${totalRefund.toLocaleString('bn-BD')} টাকা সমবায় তহবিল থেকে প্রত্যাহার করে আপনার মেইন ব্যালেন্সে ফেরত জমা করা হয়েছে। নতুন মেইন ব্যালেন্স: ৳${newMainBal.toLocaleString('bn-BD')}।`,
          read: false,
          createdAt: nowIso,
          type: 'samity_refund'
        });

        return {
          success: true,
          message: `${monthNamesStr} মাসের কিস্তি (৳${totalRefund.toLocaleString('bn-BD')} টাকা) সফলভাবে সমবায় সঞ্চয় থেকে প্রত্যাহার করে সদস্যের মেইন ব্যালেন্সে ফেরত দেওয়া হয়েছে।`
        };
      }

      // action === 'mark_paid'
      const totalAmount = monthIds.length * targetRate;

      if (deductFromMainBalance) {
        if (liveBal < totalAmount) {
          throw new Error(`সদস্যের মেইন ব্যালেন্স ৳${liveBal.toLocaleString('bn-BD')} টাকা। নির্বাচিত ${monthIds.length}টি মাসের জন্য ৳${totalAmount.toLocaleString('bn-BD')} টাকা পর্যাপ্ত নয়।`);
        }
      }

      const newMainBal = deductFromMainBalance ? Math.max(0, liveBal - totalAmount) : liveBal;
      const newSavings = currentSavings + totalAmount;
      const newShares = Math.floor(newSavings / 1000);

      const newKeysToAdd = monthIds.map(mId => `${year}-${mId}`);
      const updatedPaidMonths = normalizePaidMonthsArray(
        [...existingPaidList, ...newKeysToAdd],
        newSavings,
        targetRate
      );

      transaction.update(userRef, {
        balance: newMainBal,
        mainBalance: newMainBal,
        savings: newSavings,
        dpsBalance: newSavings,
        shares: newShares,
        samityPaidMonths: updatedPaidMonths,
        lastPaidMonth: `${year}-${monthIds[monthIds.length - 1]}`,
        updatedAt: new Date().toISOString()
      });

      const txRef = doc(collection(db, 'transactions'));
      const notifRef = doc(collection(db, 'user_notifications'));
      const nowIso = new Date().toISOString();
      const receiptCode = `ADM-SAV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Record Transaction
      transaction.set(txRef, {
        id: txRef.id,
        userId: userId,
        userName: freshUser.name || '',
        userPhone: freshUser.phone || '',
        memberId: freshUser.memberId || (freshUser as any).customUserId || '',
        type: 'samity_deposit',
        typeLabel: `সমবায় সঞ্চয় জমা (${monthNamesStr})`,
        amount: totalAmount,
        status: 'approved',
        isApproved: true,
        paymentMethod: deductFromMainBalance ? 'Al Mayadin Wallet' : 'Admin Cash/Direct Deposit',
        description: adminNote || (deductFromMainBalance 
          ? `এডমিন প্যানেল কর্তৃক মেইন ব্যালেন্স থেকে ${monthNamesStr} সমবায় সঞ্চয় কিস্তি ৳${totalAmount.toLocaleString('bn-BD')} টাকা কর্তন ও সঞ্চয়ে জমা করা হয়েছে।`
          : `এডমিন কর্তৃক ${monthNamesStr} সমবায় সঞ্চয় কিস্তি ৳${totalAmount.toLocaleString('bn-BD')} টাকা সরাসরি সঞ্চয় হিসেবে জমা করা হয়েছে।`),
        createdAt: nowIso,
        receiptNo: receiptCode
      });

      // Record Notification
      transaction.set(notifRef, {
        id: notifRef.id,
        userId: userId,
        memberId: freshUser.memberId || '',
        title: `✅ সমবায় সঞ্চয় জমা সম্পন্ন (${monthNamesStr})`,
        body: deductFromMainBalance
          ? `আপনার মেইন ব্যালেন্স থেকে ${monthNamesStr} মাসের সমবায় সঞ্চয় কিস্তি ৳${totalAmount.toLocaleString('bn-BD')} টাকা কর্তন করে সঞ্চয়ে জমা করা হয়েছে। নতুন সঞ্চয় ব্যালেন্স: ৳${newSavings.toLocaleString('bn-BD')}।`
          : `আপনার সমবায় সঞ্চয় তহবিলে ${monthNamesStr} মাসের কিস্তি ৳${totalAmount.toLocaleString('bn-BD')} টাকা সফলভাবে জমা ও অন্তর্ভুক্ত করা হয়েছে। নতুন সঞ্চয় ব্যালেন্স: ৳${newSavings.toLocaleString('bn-BD')}।`,
        read: false,
        isPersonal: true,
        isTransactionHistory: true,
        category: 'transaction',
        createdAt: nowIso
      });

      return {
        success: true,
        message: `${monthNamesStr} মাসের সঞ্চয় কিস্তি মোট ৳${totalAmount.toLocaleString('bn-BD')} টাকা সফলভাবে ${deductFromMainBalance ? 'মেইন ব্যালেন্স থেকে কেটে' : 'সরাসরি'} সঞ্চয়ে জমা ও পেইড মার্ক করা হয়েছে!`
      };
    });

    return result;
  } catch (error: any) {
    console.error('Error in adminProcessSamityMonthSettlement:', error);
    return {
      success: false,
      message: error?.message || 'সঞ্চয় হিসাব হালনাগাদে ত্রুটি ঘটেছে।'
    };
  }
}
