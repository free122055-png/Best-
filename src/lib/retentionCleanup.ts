import { db } from './firebase';
import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';

export interface RetentionCleanupResult {
  totalDeleted: number;
  cutoffDateISO: string;
  days: number;
  details: Record<string, number>;
  executedAt: string;
}

export const HISTORY_COLLECTIONS = [
  // NOTE: 'transactions' collection is STRICTLY and PERMANENTLY EXCLUDED from retention cleanup.
  // Financial transaction ledgers are permanent audit logs and must never be deleted under any circumstances.
  { name: 'user_notifications', label: 'নোটিফিকেশন খাতা (Notifications)' },
  { name: 'notices', label: 'নোটিশ ও হিস্ট্রি (Notices)' },
  { name: 'corporate_feedbacks', label: 'ফিডব্যাক ও রিপোর্টস (Feedbacks)' },
  { name: 'support_chats', label: 'সাপোর্ট চ্যাট মেসেজ (Support Chats)' },
  { name: 'agent_requests', label: 'এজেন্ট রিকোয়েস্ট লগস (Agent Requests)' },
  { name: 'escrow_disputes', label: 'এসক্রো ডিসপিউট লগস (Escrow Disputes)' },
  { name: 'safe_deal_orders', label: 'নিরাপদ ডিল অর্ডারস (Safe Deal Orders)' },
  { name: 'shop_orders', label: 'সুপার শপ অর্ডারস (Shop Orders)' },
  { name: 'ration_orders', label: 'রেশন অর্ডার হিস্ট্রি (Ration Orders)' },
  { name: 'salary_payments', label: 'স্যালারি পে আউট লগস (Salary Payments)' },
  { name: 'activity_logs', label: 'অ্যাক্টিভিটি ও অডিট লগস (Activity Logs)' },
];

/**
 * Safely parses any date format present in documents (ISO string, epoch number, Date object)
 */
function parseDocDate(data: any): number | null {
  const raw = data.createdAt || data.timestamp || data.time || data.date || data.createdAtISO;
  if (!raw) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = new Date(raw).getTime();
    return isNaN(parsed) ? null : parsed;
  }
  if (raw && typeof raw.toDate === 'function') {
    return raw.toDate().getTime();
  }
  return null;
}

/**
 * Performs history retention cleanup for records older than `retentionDays`.
 * Records older than cutoff Date will be automatically deleted from Firestore.
 */
export async function executeHistoryRetentionCleanup(
  retentionDays: number = 365
): Promise<RetentionCleanupResult> {
  const effectiveDays = Math.max(1, retentionDays || 365);
  const cutoffMs = Date.now() - effectiveDays * 24 * 60 * 60 * 1000;
  const cutoffDateISO = new Date(cutoffMs).toISOString();

  let totalDeleted = 0;
  const details: Record<string, number> = {};

  for (const item of HISTORY_COLLECTIONS) {
    if (item.name === 'transactions') {
      // Hard security barrier: Transactions are immutable lifetime financial ledger records and MUST NEVER be deleted!
      continue;
    }
    let deletedInCol = 0;
    try {
      const snap = await getDocs(collection(db, item.name));
      const expiredDocIds: string[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const docTime = parseDocDate(data);
        if (docTime !== null && docTime < cutoffMs) {
          expiredDocIds.push(docSnap.id);
        }
      });

      // Delete in chunks of 450 (Firestore limit is 500 per batch)
      for (let i = 0; i < expiredDocIds.length; i += 450) {
        const chunk = expiredDocIds.slice(i, i + 450);
        const batch = writeBatch(db);
        chunk.forEach((docId) => {
          batch.delete(doc(db, item.name, docId));
        });
        await batch.commit();
        deletedInCol += chunk.length;
      }
    } catch (err) {
      console.warn(`[RetentionCleanup] Error cleaning collection ${item.name}:`, err);
    }

    details[item.name] = deletedInCol;
    totalDeleted += deletedInCol;
  }

  // Record completion timestamp in localStorage for throttling background runs
  try {
    localStorage.setItem('amb_last_retention_cleanup', JSON.stringify({
      totalDeleted,
      executedAt: new Date().toISOString(),
      days: effectiveDays,
      cutoffDateISO
    }));
  } catch (e) {
    // Ignore storage quota errors
  }

  return {
    totalDeleted,
    cutoffDateISO,
    days: effectiveDays,
    details,
    executedAt: new Date().toISOString()
  };
}
