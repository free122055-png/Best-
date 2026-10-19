import { Capacitor, registerPlugin } from '@capacitor/core';
import { db } from './firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  where 
} from 'firebase/firestore';
import { DetectedPayment } from '../types';
import { apiUrl } from '../config/api';

export interface SmsGatewayPluginInterface {
  checkPermission: () => Promise<{ granted: boolean; receiveSms: boolean; readSms: boolean }>;
  requestPermission: () => Promise<{ granted: boolean; receiveSms: boolean; readSms: boolean }>;
  getGatewayStatus: () => Promise<{ isNative: boolean; smsPermissionGranted: boolean; supportedOperator: string; status: string }>;
  addListener: (eventName: string, listenerFunc: (data: any) => void) => Promise<any>;
}

// Fallback safe implementation without requiring native SMS permissions
export const SmsReceiver: SmsGatewayPluginInterface = {
  checkPermission: async () => ({ granted: true, receiveSms: false, readSms: false }),
  requestPermission: async () => ({ granted: true, receiveSms: false, readSms: false }),
  getGatewayStatus: async () => ({
    isNative: Capacitor.isNativePlatform(),
    smsPermissionGranted: false,
    supportedOperator: 'Payment Gateway API (bKash, Nagad, Rocket)',
    status: 'GATEWAY_API_ACTIVE'
  }),
  addListener: async () => ({ remove: () => {} })
};

export interface DetectionSystemStatus {
  isNativePlatform: boolean;
  isListening: boolean;
  smsPermissionGranted: boolean;
  firebaseConnected: boolean;
  error: string | null;
  webhookUrl: string;
  totalDetected: number;
  pendingVerificationCount: number;
  verifiedCount: number;
  failedCount: number;
  duplicateCount: number;
  lastDetectedAt: string | null;
}

/**
 * Checks Gateway status (Operates via dedicated Payment Gateway API / Webhook)
 */
export async function getNativeGatewayStatus(): Promise<{
  isNative: boolean;
  hasPermission: boolean;
  status: string;
  message: string;
}> {
  const isNative = Capacitor.isNativePlatform();
  return {
    isNative,
    hasPermission: true,
    status: 'GATEWAY_API_ACTIVE',
    message: 'নিরাপদ পেমেন্ট গেটওয়ে API ও সার্ভার ওয়েবহুকের মাধ্যমে লেনদেন সচল রয়েছে (ডিভাইসের কোনো সংবেদনশীল SMS পড়ার অনুমতির প্রয়োজন নেই)।'
  };
}

/**
 * Native Android SMS runtime permissions are no longer required
 */
export async function requestNativeSmsPermission(): Promise<boolean> {
  return true;
}

/**
 * Subscribes to real-time detected payments collection
 */
export function subscribeToDetectedPayments(
  statusFilter: 'all' | 'pending_verification' | 'verified' | 'failed' | 'duplicate',
  onData: (items: DetectedPayment[]) => void,
  onError?: (err: any) => void
) {
  try {
    const colRef = collection(db, 'detected_payments');
    let q;
    if (statusFilter === 'all') {
      q = query(colRef, orderBy('detectedAt', 'desc'), limit(100));
    } else {
      q = query(colRef, where('status', '==', statusFilter), orderBy('detectedAt', 'desc'), limit(100));
    }

    return onSnapshot(q, (snapshot) => {
      const items: DetectedPayment[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      onData(items);
    }, (err) => {
      console.warn(`[SMS Engine] Real-time subscribe error for ${statusFilter}:`, err);
      if (onError) onError(err);
    });
  } catch (err) {
    console.error('[SMS Engine] Subscription setup failed:', err);
    return () => {};
  }
}

/**
 * Subscribes to duplicate transactions collection
 */
export function subscribeToDuplicateTransactions(
  onData: (items: any[]) => void,
  onError?: (err: any) => void
) {
  try {
    const q = query(collection(db, 'duplicate_transactions'), orderBy('rejectedAt', 'desc'), limit(100));
    return onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...(doc.data() as any) }));
      onData(items);
    }, onError);
  } catch (err) {
    return () => {};
  }
}

/**
 * Subscribes to failed transactions collection
 */
export function subscribeToFailedTransactions(
  onData: (items: any[]) => void,
  onError?: (err: any) => void
) {
  try {
    const q = query(collection(db, 'failed_transactions'), orderBy('rejectedAt', 'desc'), limit(100));
    return onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...(doc.data() as any) }));
      onData(items);
    }, onError);
  } catch (err) {
    return () => {};
  }
}

/**
 * Admin action to verify & credit member balance atomically
 */
export async function approvePaymentVerification(
  trxId: string,
  targetUserId?: string,
  adminUid?: string,
  verificationProof?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const cleanTrx = trxId.trim().toUpperCase();
  const response = await fetch(apiUrl('/api/sms-gateway/approve-verification'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trxId: cleanTrx,
      targetUserId,
      adminUid: adminUid || 'admin_master',
      verificationProof: verificationProof || 'bKash Statement & SIM Verified by Admin',
      secretKey: 'bnb_sms_gateway_secure_2026'
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || 'অনুমোদনে ব্যর্থ হয়েছে');
  }
  return data;
}

/**
 * Admin action to reject detected payment
 */
export async function rejectPaymentVerification(
  trxId: string,
  reason: string,
  adminUid?: string
): Promise<{ success: boolean; message: string }> {
  const cleanTrx = trxId.trim().toUpperCase();
  const response = await fetch(apiUrl('/api/sms-gateway/reject-verification'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trxId: cleanTrx,
      reason,
      adminUid: adminUid || 'admin_master'
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || 'বাতিল করতে সমস্যা হয়েছে');
  }
  return data;
}

/**
 * Simulates incoming SMS (bKash / Nagad / Rocket) or forwards from tester
 */
export async function testDetectBkashSms(payload: {
  sender?: string;
  operator?: string;
  message: string;
  trxId?: string;
  amount?: number;
  senderPhone?: string;
}): Promise<any> {
  const response = await fetch(apiUrl('/api/sms-gateway/webhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secretKey: 'bnb_sms_gateway_secure_2026',
      sender: payload.sender || payload.operator || 'bKash',
      operator: payload.operator,
      message: payload.message,
      trxId: payload.trxId,
      amount: payload.amount,
      senderPhone: payload.senderPhone,
      source: 'web_simulator'
    })
  });
  return await response.json();
}

export const testDetectMfsSms = testDetectBkashSms;
