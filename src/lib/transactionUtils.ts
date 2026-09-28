import { Transaction } from '../types';

/**
 * Extracts a numeric timestamp (milliseconds since epoch) from any transaction document.
 * Handles Firestore Timestamps, ISO date strings, formatted date strings, numeric timestamps, and fallbacks.
 */
export const getTxTime = (t: any): number => {
  if (!t) return 0;

  // 1. Check createdAt field
  if (t.createdAt) {
    if (typeof t.createdAt === 'object' && t.createdAt !== null) {
      if ('seconds' in t.createdAt && typeof t.createdAt.seconds === 'number') {
        return t.createdAt.seconds * 1000;
      }
      if ('toDate' in t.createdAt && typeof t.createdAt.toDate === 'function') {
        try {
          return t.createdAt.toDate().getTime();
        } catch (e) {}
      }
    }
    if (typeof t.createdAt === 'number') return t.createdAt;
    if (typeof t.createdAt === 'string') {
      const d = new Date(t.createdAt).getTime();
      if (!isNaN(d) && d > 0) return d;
    }
  }

  // 2. Check processedAt / approvedAt / timestamp
  if (t.processedAt || t.approvedAt) {
    const pDate = t.processedAt || t.approvedAt;
    if (typeof pDate === 'string') {
      const d = new Date(pDate).getTime();
      if (!isNaN(d) && d > 0) return d;
    }
  }

  if (t.timestamp) {
    if (typeof t.timestamp === 'number') return t.timestamp;
    if (typeof t.timestamp === 'string') {
      const d = new Date(t.timestamp).getTime();
      if (!isNaN(d) && d > 0) return d;
    }
  }

  // 3. Check date / paymentDate
  if (t.date || t.paymentDate) {
    const dt = t.date || t.paymentDate;
    if (typeof dt === 'number') return dt;
    if (typeof dt === 'string') {
      const d = new Date(dt).getTime();
      if (!isNaN(d) && d > 0) return d;
    }
  }

  return 0;
};

/**
 * Sorts transactions strictly NEWEST FIRST (descending order).
 */
export const sortTransactionsNewestFirst = <T extends Transaction | any>(txList: T[]): T[] => {
  if (!Array.isArray(txList)) return [];
  return [...txList].sort((a, b) => {
    const timeA = getTxTime(a);
    const timeB = getTxTime(b);
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    const idA = String((a as any)?.id || (a as any)?.docId || '');
    const idB = String((b as any)?.id || (b as any)?.docId || '');
    return idB.localeCompare(idA);
  });
};
