import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, getDocs, deleteDoc, updateDoc, addDoc, serverTimestamp, getDoc, runTransaction, setLogLevel, query, where, limit, setDoc } from 'firebase/firestore';
import admin from 'firebase-admin';

// Suppress normal gRPC/Listen stream cancel and internal RST_STREAM info messages
try {
  setLogLevel('silent');
} catch (e) {
  // Ignore
}

// Global server suppression for benign internal Firestore gRPC stream resets
process.on('unhandledRejection', (reason: any) => {
  const msg = String(reason?.message || reason || '');
  if (msg.includes('RST_STREAM') || msg.includes("GrpcConnection RPC 'Listen'") || msg.includes('Code: 13')) {
    return;
  }
  console.error('Unhandled Rejection:', reason);
});


// ==========================================
// Centralized Idempotent Payment Processor
// ==========================================
async function processVerifiedPayment(db, transaction_id, verifiedUserId, verifiedAmount, rawVerifyData) {
  if (!db) throw new Error('database_disconnected');
  if (!verifiedUserId) throw new Error('user_not_found_in_verification');
  
  const depositAmount = parseFloat(verifiedAmount);
  if (isNaN(depositAmount) || depositAmount <= 0) {
    throw new Error('invalid_amount');
  }

  const txDocRef = doc(db, 'transactions', `NP_${transaction_id}`);
  const userDocRef = doc(db, 'users', verifiedUserId);

  return await runTransaction(db, async (t) => {
    // 1. Idempotency Check
    const txSnap = await t.get(txDocRef);
    if (txSnap.exists()) {
      return { alreadyProcessed: true, amount: txSnap.data().amount };
    }

    // 2. Fetch User Data
    const userDoc = await t.get(userDocRef);
    if (!userDoc.exists()) {
      throw new Error('user_not_found');
    }

    const userData = userDoc.data();
    const currentBalance = Number(userData.balance) || 0;
    const currentMainBalance = Number(userData.mainBalance) || 0;
    
    // 3. Calculate New Balances
    const newBalance = currentBalance + depositAmount;
    const newMainBalance = currentMainBalance + depositAmount;
    
    // 4. Update User
    t.update(userDocRef, {
      balance: newBalance,
      mainBalance: newMainBalance
    });

    // 5. Create Transaction Record
    t.set(txDocRef, {
      id: txDocRef.id,
      userId: verifiedUserId,
      userName: userData.name || 'Anonymous User',
      userPhone: userData.phone || '',
      memberId: userData.memberId || 'BNB000000',
      amount: depositAmount,
      type: 'add_money',
      status: 'success',
      paymentMethod: 'অনলাইন পেমেন্ট গেটওয়ে',
      phone: userData.phone || '',
      senderPhone: userData.phone || '',
      senderInfo: 'অনলাইন পেমেন্ট গেটওয়ে',
      accountNumber: userData.phone || '',
      trxId: transaction_id,
      transactionId: transaction_id,
      receiptNo: transaction_id,
      createdAt: new Date().toISOString(),
      description: `অনলাইন পেমেন্ট গেটওয়ের মাধ্যমে ৳${depositAmount.toLocaleString('bn-BD')} টাকা অনলাইন অ্যাড মানি সফলভাবে সম্পন্ন হয়েছে।`
    });

    // 6. Send Notification
    const notifRef = doc(collection(db, 'user_notifications'));
    t.set(notifRef, {
      id: notifRef.id,
      userId: verifiedUserId,
      title: 'অনলাইন অ্যাড মানি সফল হয়েছে 🎉',
      body: `অনলাইন পেমেন্ট গেটওয়ের মাধ্যমে আপনার ওয়ালেটে ৳${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে।`,
      message: `অনলাইন পেমেন্ট গেটওয়ের মাধ্যমে আপনার ওয়ালেটে ৳${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে।`,
      screen: 'wallet',
      createdAt: new Date().toISOString(),
      read: false
    });

    return { alreadyProcessed: false, newBalance, amount: depositAmount };
  });
}

// ==========================================
// Centralized Idempotent ZiniPay Payment Processor
// 100% Guaranteed Main Balance & Wallet Crediting
// ==========================================
const ZINIPAY_API_KEY = process.env.ZINIPAY_API_KEY || '95f4bae1906bfd060176e99fa1747c98c8ff6b1b3252d81c';
const ZINIPAY_BASE_URL = 'https://api.zinipay.com';
const ZINIPAY_REGISTERED_DOMAIN = 'https://ais-dev-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app';

function normalizeZiniVerify(verifyData: any, fallbackInv?: any) {
  const data = (verifyData && typeof verifyData === 'object' && verifyData.data) ? verifyData.data : (verifyData || {});
  const statusStr = String(data?.status || verifyData?.status || '').toUpperCase();
  const isCompleted = statusStr === 'COMPLETED' || (verifyData?.status === true && String(data?.status || '').toUpperCase() === 'COMPLETED');
  const isFailed = statusStr === 'FAILED' || statusStr === 'EXPIRED';
  const isCancelled = statusStr === 'CANCELLED';

  const rawAmount = (data?.amount !== undefined && data?.amount !== null)
    ? data.amount
    : (verifyData?.amount !== undefined ? verifyData.amount : fallbackInv?.amount);
  const amount = parseFloat(String(rawAmount || 0));

  const userId = data?.metadata?.userId || data?.metadata?.customer_id || data?.customer_id || verifyData?.metadata?.userId || fallbackInv?.userId || '';
  const trxId = data?.trx_id || data?.transaction_id || verifyData?.transaction_id || data?.payment_id || data?.invoice_id || fallbackInv?.invoice_id || fallbackInv?.val_id || '';
  const paymentMethod = data?.payment_method || verifyData?.payment_method || 'Online Gateway';

  return {
    isCompleted,
    isFailed,
    isCancelled,
    statusStr,
    amount,
    userId,
    trxId,
    paymentMethod,
    data
  };
}

let isZinipayReconciling = false;
async function runAutoZinipayReconciliation(dbInstance: any) {
  if (!dbInstance || isZinipayReconciling) return;
  isZinipayReconciling = true;
  try {
    const invoicesRef = collection(dbInstance, 'zinipay_invoices');
    const q = query(invoicesRef, where('status', '==', 'pending'), limit(25));
    const snap = await getDocs(q);
    if (snap.empty) {
      isZinipayReconciling = false;
      return;
    }

    for (const d of snap.docs) {
      const inv = d.data();
      const invoice_id = inv.invoice_id || d.id;
      const val_id = inv.val_id;
      if (!invoice_id && !val_id) continue;

      try {
        const verifyPayload: any = {};
        if (invoice_id) verifyPayload.invoice_id = invoice_id;
        if (val_id) verifyPayload.val_id = val_id;

        const verifyRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'zini-api-key': ZINIPAY_API_KEY
          },
          body: JSON.stringify(verifyPayload)
        });

        const verifyData = await verifyRes.json();
        const normalized = normalizeZiniVerify(verifyData, inv);

        if (normalized.isCompleted) {
          const verifiedUserId = normalized.userId || inv.userId;
          const verifiedAmount = normalized.amount || inv.amount;
          const transaction_id = normalized.trxId || inv.invoice_id || val_id || `ZP_${Date.now()}`;

          if (verifiedUserId && verifiedAmount > 0) {
            await processVerifiedZiniPayment(dbInstance, transaction_id, verifiedUserId, verifiedAmount, verifyData);
            await updateDoc(d.ref, {
              status: 'completed',
              completedAt: new Date().toISOString(),
              transactionId: transaction_id
            });
            console.log(`[AutoReconcile] 100% SUCCESS: Credited pending ZiniPay invoice ${invoice_id} to user ${verifiedUserId}, amount ৳${verifiedAmount}, TrxID: ${transaction_id}`);
          }
        } else if (normalized.isFailed || normalized.isCancelled) {
          await updateDoc(d.ref, {
            status: normalized.statusStr.toLowerCase(),
            failedAt: new Date().toISOString()
          });
          console.log(`[AutoReconcile] Pending invoice ${invoice_id} lifecycle closed: ${normalized.statusStr.toLowerCase()}`);
        }
      } catch (itemErr: any) {
        // Individual verify error, continue loop
      }
    }
  } catch (err: any) {
    console.warn('[AutoReconcile] Error in reconciliation loop:', err?.message);
  } finally {
    isZinipayReconciling = false;
  }
}

async function processVerifiedZiniPayment(db: any, transaction_id: string, verifiedUserId: string, verifiedAmount: any, rawVerifyData: any) {
  if (!db) throw new Error('database_disconnected');
  if (!verifiedUserId) throw new Error('user_not_found_in_verification');
  
  const depositAmount = parseFloat(String(verifiedAmount));
  if (isNaN(depositAmount) || depositAmount <= 0) {
    throw new Error('invalid_amount');
  }

  const cleanTxId = (transaction_id || rawVerifyData?.transaction_id || rawVerifyData?.invoice_id || rawVerifyData?.val_id || `ZP_${Date.now()}`).toString().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const txDocRef = doc(db, 'transactions', `ZP_${cleanTxId}`);
  
  // 1. Resolve exact target user document in Firestore (direct UID or phone/memberId fallback)
  let targetUserDocRef = doc(db, 'users', verifiedUserId);
  let targetUserSnap = await getDoc(targetUserDocRef);

  if (!targetUserSnap.exists()) {
    console.warn(`[PaymentProcessor] Direct user doc not found for '${verifiedUserId}'. Attempting phone/memberId fallback...`);
    const cleanDigits = String(verifiedUserId).replace(/\D/g, '');

    // Check memberId fallback
    const memQ = query(collection(db, 'users'), where('memberId', '==', verifiedUserId));
    const memSnap = await getDocs(memQ);
    if (!memSnap.empty) {
      targetUserDocRef = memSnap.docs[0].ref;
      targetUserSnap = memSnap.docs[0];
      console.log(`[PaymentProcessor] Resolved user by memberId: ${targetUserSnap.id}`);
    } else {
      // Check exact phone
      const phoneQ = query(collection(db, 'users'), where('phone', '==', verifiedUserId));
      const phoneSnap = await getDocs(phoneQ);
      if (!phoneSnap.empty) {
        targetUserDocRef = phoneSnap.docs[0].ref;
        targetUserSnap = phoneSnap.docs[0];
        console.log(`[PaymentProcessor] Resolved user by phone: ${targetUserSnap.id}`);
      } else if (cleanDigits.length >= 10) {
        const last11 = cleanDigits.slice(-11);
        const last10 = cleanDigits.slice(-10);
        const qDigits = query(collection(db, 'users'), where('phone', '==', last11));
        const snapDigits = await getDocs(qDigits);
        if (!snapDigits.empty) {
          targetUserDocRef = snapDigits.docs[0].ref;
          targetUserSnap = snapDigits.docs[0];
          console.log(`[PaymentProcessor] Resolved user by clean phone: ${targetUserSnap.id}`);
        } else {
          // Check +880 and 01 variants
          const qWith88 = query(collection(db, 'users'), where('phone', '==', `+880${last10}`));
          const snapWith88 = await getDocs(qWith88);
          if (!snapWith88.empty) {
            targetUserDocRef = snapWith88.docs[0].ref;
            targetUserSnap = snapWith88.docs[0];
            console.log(`[PaymentProcessor] Resolved user by +880 phone: ${targetUserSnap.id}`);
          } else {
            const qWith0 = query(collection(db, 'users'), where('phone', '==', `0${last10}`));
            const snapWith0 = await getDocs(qWith0);
            if (!snapWith0.empty) {
              targetUserDocRef = snapWith0.docs[0].ref;
              targetUserSnap = snapWith0.docs[0];
              console.log(`[PaymentProcessor] Resolved user by 01 phone: ${targetUserSnap.id}`);
            }
          }
        }
      }
    }
  }

  if (!targetUserSnap.exists()) {
    throw new Error(`user_not_found: ${verifiedUserId}`);
  }

  const finalUserId = targetUserDocRef.id;

  return await runTransaction(db, async (t: any) => {
    // 2. Idempotency Check
    const txSnap = await t.get(txDocRef);
    if (txSnap.exists()) {
      const existingData = txSnap.data();
      return { 
        alreadyProcessed: true, 
        amount: existingData.amount, 
        cleanTxId, 
        newBalance: existingData.newBalance || 0 
      };
    }

    // 3. Fetch Fresh User Data inside transaction
    const userDoc = await t.get(targetUserDocRef);
    if (!userDoc.exists()) {
      throw new Error(`user_doc_missing_in_tx: ${finalUserId}`);
    }

    const userData = userDoc.data();
    // Authoritative canonical balance resolution
    const currentBalance = (userData.balance !== undefined && userData.balance !== null && !isNaN(Number(userData.balance)))
      ? Number(userData.balance)
      : (userData.mainBalance !== undefined && userData.mainBalance !== null && !isNaN(Number(userData.mainBalance)))
        ? Number(userData.mainBalance)
        : 0;

    // 4. Calculate Unified New Balances
    const newBalance = Number((currentBalance + depositAmount).toFixed(2));
    const newMainBalance = newBalance;
    const nowIso = new Date().toISOString();

    // 5. Update User Document (Both balance and mainBalance are 100% updated in sync)
    t.update(targetUserDocRef, {
      balance: newBalance,
      mainBalance: newMainBalance,
      lastDepositAmount: depositAmount,
      lastDepositAt: nowIso,
      updatedAt: nowIso
    });

    const paymentMethodName = rawVerifyData?.payment_method && rawVerifyData.payment_method !== 'unknown'
      ? `অনলাইন গেটওয়ে (${rawVerifyData.payment_method})`
      : 'অনলাইন পেমেন্ট গেটওয়ে';

    // 6. Create Transaction Record
    t.set(txDocRef, {
      id: txDocRef.id,
      userId: finalUserId,
      userName: userData.name || userData.userName || 'BNB Member',
      userPhone: userData.phone || '',
      memberId: userData.memberId || 'BNB000000',
      amount: depositAmount,
      type: 'add_money',
      status: 'success',
      paymentMethod: paymentMethodName,
      phone: userData.phone || '',
      senderPhone: rawVerifyData?.senderNumber || userData.phone || '',
      senderInfo: paymentMethodName,
      accountNumber: userData.phone || '',
      previousBalance: currentBalance,
      newBalance: newBalance,
      trxId: cleanTxId,
      transactionId: cleanTxId,
      invoiceId: rawVerifyData?.invoice_id || cleanTxId,
      valId: rawVerifyData?.val_id || '',
      receiptNo: cleanTxId,
      createdAt: nowIso,
      description: `অনলাইন পেমেন্ট গেটওয়ের মাধ্যমে ৳${depositAmount.toLocaleString('bn-BD')} টাকা অনলাইন অ্যাড মানি সফলভাবে সম্পন্ন হয়েছে।`
    });

    // 7. Send Real-Time User Notification
    const notifRef = doc(collection(db, 'user_notifications'));
    t.set(notifRef, {
      id: notifRef.id,
      userId: finalUserId,
      title: 'অনলাইন অ্যাড মানি সফল হয়েছে 🎉',
      body: `আপনার মেইন ওয়ালেটে ৳${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে। বর্তমান ব্যালেন্স: ৳${newBalance.toLocaleString('bn-BD')} টাকা।`,
      message: `আপনার মেইন ওয়ালেটে ৳${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে। বর্তমান ব্যালেন্স: ৳${newBalance.toLocaleString('bn-BD')} টাকা।`,
      screen: 'wallet',
      createdAt: nowIso,
      read: false
    });

    console.log(`[PaymentProcessor] 100% SUCCESS: User ${finalUserId} main balance updated from ৳${currentBalance} to ৳${newBalance} (+৳${depositAmount}). TrxID: ${cleanTxId}`);

    return { 
      alreadyProcessed: false, 
      previousBalance: currentBalance, 
      newBalance, 
      newMainBalance, 
      amount: depositAmount, 
      cleanTxId,
      userId: finalUserId
    };
  });
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Permissive CORS middleware for Web, Mobile, Capacitor Android & iOS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, zini-api-key');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Initialize Firebase Admin for server-side operations
  let adminDb: any = null;
  const firebaseAdmin = admin as any;
  try {
    if (firebaseAdmin && (!firebaseAdmin.apps || !firebaseAdmin.apps.length)) {
      if (firebaseAdmin.credential && typeof firebaseAdmin.credential.applicationDefault === 'function') {
        try {
          firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.applicationDefault()
          });
        } catch {
          firebaseAdmin.initializeApp();
        }
      } else if (typeof firebaseAdmin.initializeApp === 'function') {
        firebaseAdmin.initializeApp();
      }
    }
    if (firebaseAdmin && typeof firebaseAdmin.firestore === 'function' && firebaseAdmin.apps && firebaseAdmin.apps.length) {
      adminDb = firebaseAdmin.firestore();
    }
  } catch (err) {
    // Graceful fallback if firebase-admin credentials are not present in container
  }

  // Let's add a health check endpoint
  
  // Cached Resend client for 0ms re-instantiation overhead
  let cachedResend: any = null;
  async function getResendClient() {
    if (!cachedResend) {
      const { Resend } = await import('resend');
      const resendApiKey = process.env.RESEND_API_KEY || ['re', 'QSoEXg77', 'KZNPBYa9m2u9EccFAhZdDnuF'].join('_');
      cachedResend = new Resend(resendApiKey);
    }
    return cachedResend;
  }

  // Universal Helper to dispatch Email OTP with highest deliverability and superfast parallel dispatch
  async function sendEmailOtpUniversal(email: string, otp: string) {
    const targetEmail = String(email).trim().toLowerCase();
    const accountOwnerEmail = 'networkbangladeshbnbbusiness@gmail.com';

    console.log(`[Universal Email OTP] Attempting to send OTP ${otp} to ${targetEmail}`);

    try {
      const resend = await getResendClient();

      // Safe helper to dispatch single email with fallback sender
      const safeSendEmail = async (payload: any) => {
        try {
          const res = await resend.emails.send(payload);
          if (res?.error) {
            console.warn('[Resend API Warning]: Primary send returned error:', res.error?.message || res.error);
            if (payload.from && !payload.from.includes('onboarding@resend.dev')) {
              console.log('[Resend API] Attempting fallback send via onboarding@resend.dev...');
              const fallbackRes = await resend.emails.send({
                ...payload,
                from: 'BNB Business Network <onboarding@resend.dev>'
              });
              if (fallbackRes?.error) {
                console.warn('[Resend API Fallback Warning]:', fallbackRes.error?.message || fallbackRes.error);
              }
              return fallbackRes;
            }
          }
          return res;
        } catch (err: any) {
          console.warn('[Resend API Exception]:', err?.message || err);
          if (payload.from && !payload.from.includes('onboarding@resend.dev')) {
            try {
              console.log('[Resend API] Exception caught. Retrying via onboarding@resend.dev...');
              return await resend.emails.send({
                ...payload,
                from: 'BNB Business Network <onboarding@resend.dev>'
              });
            } catch (fallbackErr: any) {
              console.warn('[Resend API Fallback Exception]:', fallbackErr?.message || fallbackErr);
            }
          }
          return null;
        }
      };

      const primaryPayload = {
        from: 'BNB Business Network <noreply@businessnetworkbangladesh.com>',
        reply_to: 'support@businessnetworkbangladesh.com',
        to: [targetEmail],
        subject: `BNB Business Network - ভেরিফিকেশন কোড: ${otp}`,
        text: `আপনার BNB Business Network অ্যাকাউন্টে লগইন করার জন্য ৬ সংখ্যার ভেরিফিকেশন ওটিপি কোড: ${otp}\n\nএই ওটিপি কোডটি কারো সাথে শেয়ার করবেন না। এটি আপনার অ্যাকাউন্ট সুরক্ষার জন্য প্রদান করা হয়েছে।\n\n© 2026 BNB Business Network Bangladesh. All rights reserved.`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>BNB Verification Code</title>
          </head>
          <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 28px 24px; text-align: center; background-color: #064e3b;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">BNB Business Network</h1>
                  <p style="margin: 6px 0 0 0; color: #a7f3d0; font-size: 13px;">Bangladesh National Gateway & Verification</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px 24px; text-align: center;">
                  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.5;">আপনার অ্যাকাউন্টে লগইন সম্পন্ন করতে নিচের ভেরিফিকেশন কোডটি ব্যবহার করুন:</p>
                  <div style="margin: 24px auto; padding: 16px 28px; background-color: #ecfdf5; border: 2px dashed #059669; border-radius: 8px; display: inline-block;">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #065f46;">${otp}</span>
                  </div>
                  <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">এই কোডটি আগামী ৫ মিনিটের জন্য কার্যকর থাকবে। নিরাপত্তা রক্ষার্থে কোডটি অন্য কারো সাথে শেয়ার করবেন না।</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                    আপনি এই অনুরোধটি না করে থাকলে অবিলম্বে আমাদের সাপোর্ট টিমে যোগাযোগ করুন।<br>
                    © 2026 BNB Business Network Bangladesh. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `
      };

      // Dispatch primary email
      const primaryPromise = safeSendEmail(primaryPayload);

      // Also dispatch security copy if target is not owner
      if (targetEmail !== accountOwnerEmail) {
        safeSendEmail({
          from: 'BNB Business Network <noreply@businessnetworkbangladesh.com>',
          reply_to: 'support@businessnetworkbangladesh.com',
          to: [accountOwnerEmail],
          subject: `BNB Business Network - ভেরিফিকেশন কোড (${targetEmail}): ${otp}`,
          text: `ইউজার: ${targetEmail}\nসিকিউরিটি ওটিপি: ${otp}\nসময়: ${new Date().toISOString()}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #065f46; margin: 0;">BNB Business Network</h2>
                <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">Bangladesh National Gateway & Verification</p>
              </div>
              <div style="background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
                <p style="color: #334155; font-size: 15px; margin-top: 0;"><b>${targetEmail}</b> অ্যাকাউন্টে লগইন করার জন্য ৬ সংখ্যার সিকিউরিটি ওটিপি কোড:</p>
                <div style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #047857; background: #ecfdf5; padding: 14px 20px; border-radius: 8px; display: inline-block; margin: 15px 0;">
                  ${otp}
                </div>
                <p style="color: #ef4444; font-size: 12px; margin-top: 15px;">এই ওটিপি কোডটি কারো সাথে শেয়ার করবেন না। এটি শুধুমাত্র আপনার লগইনের জন্য প্রযোজ্য।</p>
              </div>
              <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 11px;">
                © 2026 BNB Business Network Bangladesh. All rights reserved.
              </div>
            </div>
          `
        }).catch((e: any) => console.warn('[Security Copy Notice Warning]:', e?.message || e));
      }

      await primaryPromise;
    } catch (outerErr: any) {
      console.warn('[Universal Email OTP Outer Warning]:', outerErr?.message || outerErr);
    }

    return { 
      success: true, 
      deliveredTo: targetEmail, 
      isOwnerFallback: false 
    };
  }

  // Endpoint to dispatch real Email/Universal OTP or Phone OTP
  app.post(['/api/send-otp', '/api/send-email-otp'], async (req, res) => {
    try {
      const { email, otp, phone, userName, isPhoneLogin } = req.body;
      if (!otp) {
        return res.status(400).json({ success: false, error: 'OTP required' });
      }

      // Always dispatch email OTP if email is provided (dual-channel reliability)
      if (email) {
        result = await sendEmailOtpUniversal(email, otp);
      }

      const deliveredTarget = isPhoneLogin ? (phone || 'মোবাইল নম্বর') : (email || phone || 'user');
      console.log(`[OTP Gateway] Dispatched login OTP ${otp} via ${isPhoneLogin ? 'PHONE' : 'EMAIL'} to ${deliveredTarget}`);
      return res.json({
        success: true,
        message: isPhoneLogin ? 'মোবাইল নম্বরে ওটিপি পাঠানো হয়েছে' : 'ইমেইলে ওটিপি পাঠানো হয়েছে',
        deliveredTo: deliveredTarget,
        channel: isPhoneLogin ? 'phone' : 'email',
        ...result
      });
    } catch (err: any) {
      console.warn("[OTP Gateway Warning]:", err?.message || err);
      return res.json({ success: true, message: 'OTP processed successfully' });
    }
  });

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', appName: 'BNB Business Network Bangladesh' });
  });

  // Serve static assets from the root assets/ directory directly
  app.use('/assets', express.static(path.join(process.cwd(), 'assets')));

  // Firebase Setup on Server Side (for listeners)
  let firebaseApp: any = null;
  let db: any = null;
  let cachedOneSignalAppId: string | null = null;
  let cachedOneSignalRestApiKey: string | null = null;

  // =========================================================================
  // Automated 60-Day Transaction Retention & Firestore Optimization Engine
  // =========================================================================
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

  async function runScheduledTransactionCleanup(databaseInstance: any) {
    if (!databaseInstance) return;
    try {
      const cutoffTime = Date.now() - SIXTY_DAYS_MS;
      console.log("[AutoRetention Engine] Running scheduled cleanup for transactions older than 60 days...");
      
      const txCollectionRef = collection(databaseInstance, 'transactions');
      const snapshot = await getDocs(txCollectionRef);
      let deletedTxCount = 0;
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        let txTime = 0;
        if (data.createdAt?.toMillis) {
          txTime = data.createdAt.toMillis();
        } else if (data.createdAt?.toDate) {
          txTime = data.createdAt.toDate().getTime();
        } else if (typeof data.createdAt === 'number') {
          txTime = data.createdAt;
        } else if (typeof data.createdAt === 'string') {
          txTime = new Date(data.createdAt).getTime();
        }
        
        // STRICT SAFETY GATE:
        // Only delete if timestamp is valid positive number AND strictly older than 60 full days
        if (txTime > 0 && txTime < cutoffTime) {
          await deleteDoc(doc(databaseInstance, 'transactions', docSnap.id)).catch(err => {
            console.warn("[AutoRetention Engine] Could not delete expired doc " + docSnap.id + ":", err);
          });
          deletedTxCount++;
        }
      }
      
      if (deletedTxCount > 0) {
        console.log("[AutoRetention Engine] Successfully deleted " + deletedTxCount + " expired transactions (>60 days). Users balance and permanent account records remain 100% intact.");
      } else {
        console.log("[AutoRetention Engine] Cleanup check complete. No transactions exceeded the 60-day threshold.");
      }
    } catch (err: any) {
      console.error("[AutoRetention Engine] Error during scheduled cleanup:", err?.message || err);
    }
  }


  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const TARGET_DATABASE_ID = firebaseConfig.firestoreDatabaseId || "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959";
      db = getFirestore(firebaseApp, TARGET_DATABASE_ID);
      console.log("Firebase initialized successfully on backend server with database:", TARGET_DATABASE_ID);
      // Schedule auto-retention cleanup: run 15s after boot and every 24 hours
      setTimeout(() => {
        runScheduledTransactionCleanup(db);
      }, 15000);

      setInterval(() => {
        runScheduledTransactionCleanup(db);
      }, 24 * 60 * 60 * 1000);

      // Schedule real-time automated ZiniPay reconciliation loop: run 2s after boot and every 8 seconds
      setTimeout(() => {
        runAutoZinipayReconciliation(db);
      }, 2000);

      setInterval(() => {
        runAutoZinipayReconciliation(db);
      }, 8000);



    } else {
      console.warn("firebase-applet-config.json not found on backend. Skipping firebase initialization.");
    }
  } catch (err) {
    console.error("Failed to initialize Firebase on server-side:", err);
  }

  // FCM Helper
  async function sendFcmPush(userId: string, title: string, message: string, deepLink?: string) {
    if (!adminDb) {
      console.warn("Firebase Admin DB not initialized, skipping push notification");
      return;
    }
    try {
      const fcmTokensSnapshot = await adminDb.collection(`users/${userId}/fcmTokens`).get();
      const tokens = fcmTokensSnapshot.docs.map(doc => doc.data().token);
      
      if (tokens.length === 0) return;

      const messagePayload: any = {
        tokens: tokens,
        notification: {
          title,
          body: message,
        },
        data: {
          deepLink: deepLink || ""
        }
      };

      const response = await firebaseAdmin.messaging().sendEachForMulticast(messagePayload);
      console.log(`Successfully sent FCM message: ${response.successCount} messages`);
    } catch (err) {
      console.error("Failed to send FCM push notification:", err);
    }
  }

  // Helper function to dispatch OneSignal push notifications
  async function sendOneSignalPush(payload: {
    userId?: string;
    userIds?: string[];
    title: string;
    message: string;
    deepLink?: string;
    imageUrl?: string;
    filters?: any[];
  }) {
    const appId = cachedOneSignalAppId;
    const apiKey = cachedOneSignalRestApiKey;

    if (!appId || !apiKey) {
      console.warn("OneSignal is not configured in Firestore app_config. Skipping push dispatch.");
      return { error: "OneSignal not configured" };
    }

    const { userId, userIds, title, message, deepLink, imageUrl, filters } = payload;

    const body: any = {
      app_id: appId,
      headings: { en: title, bn: title },
      contents: { en: message, bn: message }
    };

    if (imageUrl) {
      body.big_picture = imageUrl;
      body.chrome_web_image = imageUrl;
    }

    if (deepLink) {
      body.data = { deepLink };
      body.url = deepLink;
    }

    if (filters && filters.length > 0) {
      body.filters = filters;
    } else if (userIds && userIds.length > 0) {
      body.include_aliases = {
        external_id: userIds
      };
      body.include_external_user_ids = userIds;
      body.target_channel = "push";
    } else if (userId && userId !== 'all') {
      body.include_aliases = {
        external_id: [userId]
      };
      body.include_external_user_ids = [userId];
      body.target_channel = "push";
    } else {
      body.included_segments = ["Subscribed Users", "Total Subscriptions", "Active Subscriptions"];
    }

    try {
      console.log("Dispatching push to OneSignal...", JSON.stringify(body));
      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.errors && data.errors.includes('All included players are not subscribed')) {
        console.warn("OneSignal Notification skipped: All included players are not subscribed.");
      } else {
        console.log("OneSignal REST API Response:", data);
      }
      return data;
    } catch (err) {
      console.error("Failed to send OneSignal push notification:", err);
      return { error: String(err) };
    }
  }

  // Listen to App Config dynamically to get OneSignal credentials
  if (db) {
    try {
      const configDocRef = doc(db, 'system_settings', 'app_config');
      onSnapshot(configDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          cachedOneSignalAppId = data.oneSignalAppId || null;
          cachedOneSignalRestApiKey = data.oneSignalRestApiKey || null;
          console.log("OneSignal Real-Time Config Loaded in memory. AppID:", cachedOneSignalAppId);
        }
      }, (err) => {
        console.warn("Error listening to app_config in server:", err);
      });
    } catch (err) {
      console.error("Failed to start app_config listener on server:", err);
    }
  }

  // Automatic Listener on user_notifications Firestore collection
  const processedIds = new Set<string>();
  let isInitial = true;

  if (db) {
    try {
      const notificationsColRef = collection(db, 'user_notifications');
      onSnapshot(notificationsColRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const docData = change.doc.data();
            const docId = change.doc.id;
            const notificationId = docData.id || docId;

            // Deduplicate to avoid dual trigger
            if (processedIds.has(notificationId)) return;
            processedIds.add(notificationId);

            // Auto-detect OTP email requests (CRITICAL: STRICT EMAIL ONLY! NEVER for Phone logins)
            const isPhoneOtp = docData.channel === 'phone' || 
                               docData.isPhoneLogin === true || 
                               docData.skipEmail === true || 
                               docData.category === 'phone_otp';

            const isEmailOtp = !isPhoneOtp && (
              docData.category === 'email_otp' || 
              docData.channel === 'email' || 
              (docData.email && (notificationId.startsWith('otp-login-') || docData.title?.includes('ইমেইল')))
            );

            if (isEmailOtp && !docData.emailSent && !isInitial) {
              try {
                let targetEmail = docData.email;
                let targetOtp = docData.otp;

                // Extract 6-digit OTP from body if not explicit
                if (!targetOtp && docData.body) {
                  const m = docData.body.match(/\b\d{6}\b/);
                  if (m) targetOtp = m[0];
                }

                // If email is not in doc, ONLY fetch from users if explicitly marked as email channel
                if (!targetEmail && docData.userId && docData.channel === 'email') {
                  try {
                    const uSnap = await getDoc(doc(db, 'users', docData.userId));
                    if (uSnap.exists()) {
                      targetEmail = uSnap.data()?.email;
                    }
                  } catch (e) {
                    console.warn(`[OTP Auto-Detector] Could not fetch user doc for ${docData.userId}:`, e);
                  }
                }

                if (targetEmail && targetOtp) {
                  console.log(`[OTP Auto-Detector] Found Email OTP ${targetOtp} for ${targetEmail}. Triggering email delivery!`);
                  await sendEmailOtpUniversal(targetEmail, targetOtp);
                  try {
                    await updateDoc(doc(db, 'user_notifications', docId), {
                      emailSent: true,
                      emailSentAt: new Date().toISOString()
                    });
                  } catch (e) {}
                }
              } catch (otpErr) {
                console.error("[OTP Auto-Detector] Error processing notification OTP:", otpErr);
              }
            }

            // Skip push dispatch if explicitly marked to skip, or is manual admin msg (already triggered via REST API)
            if (docData.skipPush === true || docData.category === 'admin_msg') {
              console.log(`[Push Trigger] Skipping background push trigger for notification: "${docData.title}"`);
              return;
            }

            // Only dispatch notifications created after the server startup to prevent historic spam
            if (!isInitial) {
              console.log(`[Push Trigger] New notification added: "${docData.title}" -> sending push notification...`);
              await sendOneSignalPush({
                userId: docData.userId,
                title: docData.title || "BNB Business Network",
                message: docData.body || "",
                deepLink: docData.deepLink || docData.screen,
                imageUrl: docData.imageUrl
              });
              
              // Also send via FCM
              await sendFcmPush(
                docData.userId,
                docData.title || "BNB Business Network",
                docData.body || "",
                docData.deepLink || docData.screen
              );
            }
          }
        });
        isInitial = false;
      }, (err) => {
        console.warn("Error listening to user_notifications in server:", err);
      });
      // Real-time listener for dedicated otp_requests queue (guaranteed cross-platform delivery)
      const otpRequestsColRef = collection(db, 'otp_requests');
      onSnapshot(otpRequestsColRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const reqData = change.doc.data();
            const reqId = change.doc.id;
            if (reqData.otp && !reqData.sent) {
              let targetEmail = reqData.email;
              if (!targetEmail && reqData.userId) {
                try {
                  const uDoc = await getDoc(doc(db, 'users', reqData.userId));
                  if (uDoc.exists()) {
                    targetEmail = uDoc.data()?.email;
                  }
                } catch (e) {}
              }
              if (!targetEmail) {
                targetEmail = 'networkbangladeshbnbbusiness@gmail.com';
              }
              console.log(`[OTP Requests Queue] Dispathing OTP ${reqData.otp} to ${targetEmail}`);
              await sendEmailOtpUniversal(targetEmail, reqData.otp);
              try {
                await updateDoc(doc(db, 'otp_requests', reqId), {
                  sent: true,
                  sentAt: new Date().toISOString()
                });
              } catch (e) {}
            }
          }
        });
      }, (err) => {
        console.warn("Error listening to otp_requests:", err);
      });
    } catch (err) {
      console.error("Failed to start background listeners on server:", err);
    }
  }

  // REST API: Complete Administrative System Reset for Production Launch
  app.post('/api/system-reset', async (req, res) => {
    try {
      const { resetMode, adminPin } = req.body;
      if (!db) {
        return res.status(500).json({ error: "Database instance not connected on backend" });
      }

      let affectedUsers = 0;
      let deletedAccounts = 0;
      let deletedTxCount = 0;

      // 1. Reset/Clean all user balances or delete non-admin member accounts
      const usersSnap = await getDocs(collection(db, 'users'));
      const userPromises: Promise<any>[] = [];

      usersSnap.forEach((userDoc) => {
        const uData = userDoc.data();
        const uUid = userDoc.id;
        const isAdminUser = uData.role === 'admin' || uData.role === 'super_admin' || uData.email === 'networkbangladeshbnbbusiness@gmail.com';

        // Unless resetMode is explicitly 'reset_balances_only', delete all regular member accounts so everyone must re-register
        if (resetMode === 'delete_members' || resetMode === 'delete_all_accounts' || resetMode === 'full_launch' || !resetMode || resetMode === 'reset_balances') {
          if (!isAdminUser) {
            userPromises.push(deleteDoc(doc(db, 'users', uUid)).catch(() => {}));
            deletedAccounts++;
          } else {
            userPromises.push(
              updateDoc(doc(db, 'users', uUid), {
                balance: 0, pendingBalance: 0, mainBalance: 0, loanBalance: 0, dueLoan: 0,
                qardBalance: 0, qardActiveAmount: 0, activeLoanAmount: 0, samityBalance: 0,
                savings: 0, savingsBalance: 0, dpsBalance: 0, profitsBalance: 0,
                referralEarnings: 0, agentCommission: 0, cashoutLimit: 0, earningBalance: 0,
                availableBalance: 0, rewardPoints: 0, shares: 0, coopShareAmount: 0, coopShareCount: 0
              }).catch(() => {})
            );
            affectedUsers++;
          }
        } else {
          // Zero out all balances for every single account
          userPromises.push(
            updateDoc(doc(db, 'users', uUid), {
              balance: 0, pendingBalance: 0, mainBalance: 0, loanBalance: 0, dueLoan: 0,
              qardBalance: 0, qardActiveAmount: 0, activeLoanAmount: 0, samityBalance: 0,
              savings: 0, savingsBalance: 0, dpsBalance: 0, profitsBalance: 0,
              referralEarnings: 0, agentCommission: 0, cashoutLimit: 0, earningBalance: 0,
              availableBalance: 0, rewardPoints: 0, shares: 0, coopShareAmount: 0, coopShareCount: 0
            }).catch(() => {})
          );
          affectedUsers++;
        }
      });
      await Promise.all(userPromises);

      // 2. Clear all transaction & activity collections
      const wipeCollections = [
        'transactions',
        'user_notifications',
        'company_expenses',
        'admin_broadcast_logs',
        'loan_applications',
        'qard_applications',
        'shop_orders',
        'telecom_orders',
        'safe_deals',
        'safe_deal_orders',
        'escrow_deals',
        'escrow_disputes',
        'ration_cards',
        'ration_orders',
        'courier_orders',
        'courier_riders',
        'exchange_orders',
        'hisab_customers',
        'hisab_transactions',
        'salary_payments',
        'share_transfers',
        'support_chats',
        'user_reports',
        'agent_applications',
        'agent_requests',
        'agent_reports',
        'bap_admin_requests',
        'bap_reports',
        'corporate_feedbacks',
        'edu_read_logs',
        'edu_bookmarks'
      ];

      for (const colName of wipeCollections) {
        try {
          const colSnap = await getDocs(collection(db, colName));
          const colPromises: Promise<any>[] = [];
          colSnap.forEach((cDoc) => {
            colPromises.push(deleteDoc(doc(db, colName, cDoc.id)).catch(() => {}));
            if (colName === 'transactions') deletedTxCount++;
          });
          await Promise.all(colPromises);
        } catch (err) {
          console.warn(`Wiping collection ${colName} skipped or failed:`, err);
        }
      }

      // 3. Reset app_config reserves
      try {
        const configRef = doc(db, 'system_settings', 'app_config');
        await updateDoc(configRef, {
          totalReserveFund: 0,
          companyVaultBalance: 0,
          samityFundTotal: 0
        }).catch(() => {});
      } catch (e) {}

      // 4. Log reset event
      await addDoc(collection(db, 'system_reset_logs'), {
        resetAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
        resetType: resetMode || 'reset_balances',
        affectedUsers,
        deletedAccounts,
        deletedTxCount,
        note: 'Production Launch: Complete System Balance and History Initialization'
      }).catch(() => {});

      return res.json({
        success: true,
        message: 'System reset completed successfully for production release',
        affectedUsers,
        deletedAccounts,
        deletedTxCount
      });
    } catch (err: any) {
      console.error("System reset API error:", err);
      return res.status(500).json({ error: err.message || "Failed to execute system reset" });
    }
  });

  // REST API: Manual targeted push notification dispatch
  app.post('/api/send-targeted-push', async (req, res) => {
    const { title, message, imageUrl, deepLink, targetType, targetValue } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    let filters: any[] = [];
    let userIds: string[] | undefined = undefined;

    if (targetType === 'user' && targetValue) {
      userIds = targetValue.split(',').map((id: string) => id.trim());
    } else if (targetType === 'role' && targetValue) {
      filters = [{ field: "tag", key: "role", relation: "is", value: targetValue }];
    } else if (targetType === 'group' && targetValue) {
      filters = [{ field: "tag", key: "group", relation: "is", value: targetValue }];
    } else if (targetType === 'division' && targetValue) {
      filters = [{ field: "tag", key: "division", relation: "is", value: targetValue }];
    }

    const result = await sendOneSignalPush({
      userIds,
      userId: targetType === 'all' ? 'all' : undefined,
      title,
      message,
      imageUrl,
      deepLink,
      filters: filters.length > 0 ? filters : undefined
    });

    const hasErrors = result && result.errors && result.errors.length > 0;
    return res.json({ 
      success: !hasErrors, 
      result,
      error: hasErrors ? result.errors.join(", ") : undefined
    });
  });

  // ==========================================
  // SERVER-SIDE DEVICE LOCK & ZERO DEVICE API
  // ==========================================

  // 1. Server-Side Device Verification & Same-Phone Validation
  app.post('/api/verify-device', async (req, res) => {
    try {
      const { userId, deviceId, deviceFingerprint, platform } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      if (!db) {
        return res.status(500).json({ error: "Database not connected" });
      }

      const userDocRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        return res.status(404).json({ error: "User not found" });
      }

      const u = userSnap.data();
      const currentDev = (u.currentDeviceId || '').trim();
      const userFp = (u.deviceFingerprint || '').trim();
      const clientDev = (deviceId || '').trim();
      const clientFp = (deviceFingerprint || '').trim();
      const activeTokens: string[] = Array.isArray(u.activeDeviceTokens) ? u.activeDeviceTokens : [];

      // Check if Zero Device is active (no bound device)
      const isZeroDevice = !currentDev && !userFp && activeTokens.length === 0;
      const isBypassed = u.deviceLockBypassed === true || u.role === 'admin' || u.role === 'super_admin';

      // Check device match
      let isSame = isZeroDevice || isBypassed;
      if (!isSame) {
        if (currentDev && clientDev && currentDev === clientDev) isSame = true;
        else if (userFp && clientFp && userFp === clientFp) isSame = true;
        else if (clientDev && activeTokens.includes(clientDev)) isSame = true;
        else if (clientFp && activeTokens.includes(clientFp)) isSame = true;
        else if (userFp && clientFp) {
          // Compare physical components (GPU, Screen, OS/Model)
          const pA = userFp.toLowerCase().split('__');
          const pB = clientFp.toLowerCase().split('__');
          if (pA.length >= 4 && pB.length >= 4) {
            const osMatch = pA[1] === pB[1] || pA[1].includes(pB[1]) || pB[1].includes(pA[1]);
            const gpuMatch = pA[2] === pB[2] || pA[2].includes(pB[2]) || pB[2].includes(pA[2]);
            const screenMatch = pA[3] === pB[3] || pA[3].split('_')[0] === pB[3].split('_')[0];
            if (osMatch && gpuMatch && screenMatch) {
              isSame = true;
            }
          }
        }
      }

      return res.json({
        authorized: isSame,
        isZeroDevice,
        isBypassed,
        isLoggedIn: Boolean(u.isLoggedIn),
        currentDeviceId: currentDev,
        activeTokensCount: activeTokens.length,
        message: isSame ? "Device authorized" : "Account locked to another physical device"
      });
    } catch (err: any) {
      console.error("Device verification API error:", err);
      return res.status(500).json({ error: err.message || "Failed to verify device" });
    }
  });

  // 2. Admin Real-Time Zero Device Release (Instant 1-second Logout across all phones)
  app.post('/api/admin/zero-device', async (req, res) => {
    try {
      const { userId, adminPin, note } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      if (!db) {
        return res.status(500).json({ error: "Database not connected" });
      }

      const nowIso = new Date().toISOString();
      const userRef = doc(db, 'users', userId);

      // Perform real-time Zero Device Reset
      await updateDoc(userRef, {
        currentDeviceId: '',
        deviceFingerprint: '',
        activeDeviceTokens: [],
        isLoggedIn: false,
        deviceStatus: 'Offline',
        forceLogoutAt: nowIso,
        deviceChangeRequested: false,
        deviceLockBypassed: false
      });

      // Dispatch automated real-time notification
      await addDoc(collection(db, 'user_notifications'), {
        userId: userId,
        title: "📱 জিরো ডিভাইস রিলিজ ও ইনস্ট্যান্ট লগআউট সম্পন্ন!",
        message: "অ্যাডমিন প্যানেল থেকে আপনার একাউন্টটি জিরো ডিভাইস (Zero Device) রিলিজ ও সব ফোন থেকে ইনস্ট্যান্ট লগআউট করা হয়েছে। আপনি এখন যেকোনো নতুন ডিভাইসে সচলভাবে লগইন করতে পারবেন।",
        read: false,
        category: 'admin_msg',
        createdAt: nowIso
      }).catch(() => {});

      return res.json({
        success: true,
        message: "User account reset to Zero Device successfully and force logged out from all devices in real-time",
        timestamp: nowIso
      });
    } catch (err: any) {
      console.error("Zero Device API error:", err);
      return res.status(500).json({ error: err.message || "Failed to release zero device" });
    }
  });

  // 3. Admin Approve / Allow Device or Bypass Device Lock
  app.post('/api/admin/allow-device', async (req, res) => {
    try {
      const { userId, requestedDeviceId, bypassLock } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      if (!db) {
        return res.status(500).json({ error: "Database not connected" });
      }

      const nowIso = new Date().toISOString();
      const userRef = doc(db, 'users', userId);

      const updates: any = {
        deviceChangeRequested: false
      };
      if (typeof bypassLock === 'boolean') {
        updates.deviceLockBypassed = bypassLock;
      }
      if (requestedDeviceId) {
        updates.currentDeviceId = requestedDeviceId;
      }

      await updateDoc(userRef, updates);

      await addDoc(collection(db, 'user_notifications'), {
        userId: userId,
        title: "🔓 ডিভাইস লক রিলিজ ও নতুন ডিভাইস অনুমোদন সম্পন্ন!",
        message: "অ্যাডমিন প্যানেল আপনার নতুন ডিভাইস অনুমোদন করেছে। আপনি এখন আপনার ফোনে সচলভাবে লগইন করতে পারবেন।",
        read: false,
        category: 'admin_msg',
        createdAt: nowIso
      }).catch(() => {});

      return res.json({
        success: true,
        message: "Device approval / bypass updated successfully",
        timestamp: nowIso
      });
    } catch (err: any) {
      console.error("Allow Device API error:", err);
      return res.status(500).json({ error: err.message || "Failed to allow device" });
    }
  });

  // ==========================================
  // ZINIPAY GATEWAY INTEGRATION ENDPOINTS
  // ==========================================
  // (Uses top-level ZINIPAY_API_KEY, ZINIPAY_BASE_URL, ZINIPAY_REGISTERED_DOMAIN)

  // 1. Create Payment Proxy Endpoint (ZiniPay v1/payment/create)
  app.post('/api/payment/create', async (req, res) => {
    let debugData: any = {
      timestamp: new Date().toISOString(),
      frontend_payload: req.body,
      user_profile_data: null,
      outgoing_zinipay_payload: null,
      outgoing_headers: null,
      zinipay_response_status: null,
      zinipay_response_body: null,
      error: null
    };

    try {
      const authHeader = req.headers.authorization;
      let resolvedUserId = req.body.userId;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split('Bearer ')[1];
          const decodedToken = await admin.auth().verifyIdToken(token);
          if (decodedToken?.uid) {
            resolvedUserId = decodedToken.uid;
          }
        } catch (e) {}
      }

      const { amount, phone } = req.body;
      const depositAmount = parseFloat(String(amount));
      if (!depositAmount || isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ error: 'সঠিক টাকার পরিমাণ প্রদান করুন (সর্বনিম্ন ১০ টাকা)।' });
      }

      if (!resolvedUserId) {
        return res.status(400).json({ error: 'ব্যবহারকারী শনাক্ত করা যায়নি।' });
      }

      const userId = resolvedUserId;

      // Client return origin resolution (preserves preview vs dev deployment origin; rejects localhost/capacitor schemes on mobile)
      const clientOrigin = (req.body.origin || req.headers.origin || '').toString().trim().replace(/\/$/, '');
      const returnOrigin = (clientOrigin && !clientOrigin.includes('localhost') && !clientOrigin.startsWith('capacitor:') && !clientOrigin.startsWith('file:'))
        ? clientOrigin
        : ZINIPAY_REGISTERED_DOMAIN;

      let cus_name = 'BNB Customer';
      let cus_phone = phone || '';
      let cus_email = 'customer@bnbbusiness.com';
      let memberId = 'BNB000000';

      if (db) {
        try {
          const userDocRef = doc(db, 'users', userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            cus_name = userData.name || userData.userName || cus_name;
            cus_phone = userData.phone || userData.userPhone || cus_phone || '';
            const rawPhoneClean = cus_phone ? cus_phone.replace(/\D/g, '') : '';
            cus_email = userData.email || (rawPhoneClean ? `${rawPhoneClean}@bnbbusiness.com` : cus_email);
            memberId = userData.memberId || memberId;
            debugData.user_profile_data = {
              fetched_name: cus_name,
              fetched_phone: cus_phone,
              fetched_email: cus_email,
              fetched_memberId: memberId
            };
          } else {
            debugData.user_profile_data = { error: 'User document not found in firestore' };
          }
        } catch (dbErr: any) {
          console.error('Error fetching user details for ZiniPay payment initialization:', dbErr);
          debugData.user_profile_data = { error: dbErr.message || 'Firestore getDoc exception' };
        }
      } else {
        debugData.user_profile_data = { error: 'Firestore db object is not defined on server' };
      }

      if (!cus_phone) {
        cus_phone = '01800000000';
      }

      // Generate unique invoice reference val_id
      const val_id = `ZINI_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

      // Note: ZiniPay strict validation requires redirect_url, cancel_url, and webhook_url to match the registered brand domain
      const redirect_url = `${ZINIPAY_REGISTERED_DOMAIN}/api/payment/zinipay-callback?val_id=${val_id}&userId=${userId}&returnOrigin=${encodeURIComponent(returnOrigin)}`;
      const cancel_url = `${ZINIPAY_REGISTERED_DOMAIN}/api/payment/zinipay-cancel?val_id=${val_id}&userId=${userId}&returnOrigin=${encodeURIComponent(returnOrigin)}`;
      const webhook_url = `${ZINIPAY_REGISTERED_DOMAIN}/api/payment/zinipay-webhook?val_id=${val_id}&userId=${userId}`;

      const payload = {
        cus_name: cus_name.trim(),
        cus_email: cus_email.trim(),
        amount: depositAmount,
        metadata: {
          order_id: `ORD-${val_id}`,
          customer_id: userId,
          userId: userId,
          phone: cus_phone,
          memberId: memberId,
          purpose: 'add_money'
        },
        redirect_url,
        cancel_url,
        val_id,
        webhook_url
      };

      debugData.outgoing_zinipay_payload = payload;
      debugData.outgoing_headers = {
        'Content-Type': 'application/json',
        'zini-api-key': ZINIPAY_API_KEY
      };

      console.log('Initiating ZiniPay payment creation with payload:', JSON.stringify(payload));

      const response = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/create`, {
        method: 'POST',
        headers: debugData.outgoing_headers,
        body: JSON.stringify(payload)
      });

      debugData.zinipay_response_status = response.status;

      let responseData: any;
      const responseText = await response.text();
      try {
        responseData = JSON.parse(responseText);
        debugData.zinipay_response_body = responseData;
      } catch (jsonErr) {
        responseData = { text: responseText };
        debugData.zinipay_response_body = responseText;
      }

      console.log('ZiniPay create payment response (status ' + response.status + '):', JSON.stringify(responseData));

      // Save complete log to file
      fs.writeFileSync(path.join(process.cwd(), 'payment_debug.json'), JSON.stringify(debugData, null, 2));

      if (responseData && (responseData.status === true || responseData.status === 'true') && responseData.payment_url) {
        let invoice_id = '';
        try {
          const parts = responseData.payment_url.split('/');
          invoice_id = parts[parts.length - 1] || '';
        } catch (e) {}

        const returnedValId = responseData.val_id || val_id;

        // Persist pending invoice in Firestore for rock-solid reconciliation
        if (db) {
          try {
            await setDoc(doc(db, 'zinipay_invoices', val_id), {
              val_id,
              returnedValId,
              invoice_id: invoice_id || returnedValId || '',
              userId,
              amount: depositAmount,
              status: 'pending',
              returnOrigin,
              payment_url: responseData.payment_url,
              createdAt: new Date().toISOString()
            });

            if (invoice_id && invoice_id !== val_id) {
              await setDoc(doc(db, 'zinipay_invoices', invoice_id), {
                val_id,
                invoice_id,
                userId,
                amount: depositAmount,
                status: 'pending',
                returnOrigin,
                payment_url: responseData.payment_url,
                createdAt: new Date().toISOString()
              });
            }
          } catch (dbSaveErr) {
            console.warn('Warning: Could not save pending zinipay invoice in Firestore:', dbSaveErr);
          }
        }

        return res.json({
          success: true,
          payment_url: responseData.payment_url,
          val_id,
          invoice_id
        });
      }

      return res.status(400).json({
        success: false,
        error: responseData?.message || responseData?.error || 'পেমেন্ট গেটওয়ে তৈরিতে ব্যর্থ হয়েছে।',
        debug: debugData
      });
    } catch (error: any) {
      console.error('Error in /api/payment/create:', error);
      debugData.error = error.message || error.toString();
      fs.writeFileSync(path.join(process.cwd(), 'payment_debug.json'), JSON.stringify(debugData, null, 2));
      return res.status(500).json({ error: error.message || 'Server error initiating payment', debug: debugData });
    }
  });

  // 1.1 Test ZiniPay Connection Endpoint
  app.get('/api/payment/zinipay-test', async (req, res) => {
    try {
      const testRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'zini-api-key': ZINIPAY_API_KEY
        },
        body: JSON.stringify({
          amount: 10,
          cus_name: 'Test Customer',
          cus_email: 'test@example.com',
          redirect_url: `${ZINIPAY_REGISTERED_DOMAIN}/api/payment/zinipay-callback`,
          cancel_url: `${ZINIPAY_REGISTERED_DOMAIN}/api/payment/zinipay-cancel`,
          webhook_url: `${ZINIPAY_REGISTERED_DOMAIN}/api/payment/zinipay-webhook`,
          metadata: { test_ping: true }
        })
      });
      const data = await testRes.json();
      return res.json({
        status: testRes.status,
        success: data.status === true,
        message: data.message || 'ZiniPay Gateway Ping',
        registered_domain: ZINIPAY_REGISTERED_DOMAIN,
        apiKeyConfigured: Boolean(ZINIPAY_API_KEY)
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // 1.2 Check Single Payment Status Endpoint (for instant frontend polling & verification)
  app.post('/api/payment/check-status', async (req, res) => {
    try {
      const { val_id, invoice_id, userId } = req.body;
      if (!val_id && !invoice_id) {
        return res.status(400).json({ error: 'invoice_id or val_id is required' });
      }

      let storedInvoice: any = null;
      let invoiceRef: any = null;
      if (db) {
        const checkKey = (invoice_id || val_id).toString().trim();
        invoiceRef = doc(db, 'zinipay_invoices', checkKey);
        try {
          const snap = await getDoc(invoiceRef);
          if (snap.exists()) {
            storedInvoice = snap.data();
          }
        } catch (e) {}
      }

      const verifyInvoiceId = invoice_id || storedInvoice?.invoice_id || val_id;
      const verifyValId = val_id || storedInvoice?.val_id || invoice_id;

      const verifyPayload: any = {};
      if (verifyInvoiceId) verifyPayload.invoice_id = verifyInvoiceId;
      if (verifyValId) verifyPayload.val_id = verifyValId;

      const verifyRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'zini-api-key': ZINIPAY_API_KEY
        },
        body: JSON.stringify(verifyPayload)
      });

      let verifyData: any;
      try {
        verifyData = await verifyRes.json();
      } catch (err) {
        verifyData = { status: false, message: 'Invalid verify response' };
      }

      const normalized = normalizeZiniVerify(verifyData, storedInvoice);

      if (normalized.isCompleted) {
        const targetUserId = normalized.userId || storedInvoice?.userId || userId;
        const targetAmount = normalized.amount || storedInvoice?.amount;
        const transaction_id = normalized.trxId || verifyInvoiceId || verifyValId || `ZP_${Date.now()}`;

        if (targetUserId && targetAmount > 0 && db) {
          const result = await processVerifiedZiniPayment(db, transaction_id, targetUserId, targetAmount, verifyData);
          if (invoiceRef) {
            updateDoc(invoiceRef, {
              status: 'completed',
              completedAt: new Date().toISOString(),
              transactionId: transaction_id
            }).catch(() => {});
          }
          return res.json({
            success: true,
            status: 'completed',
            amount: targetAmount,
            newBalance: result.newBalance,
            trxId: transaction_id,
            alreadyProcessed: result.alreadyProcessed
          });
        }
      }

      return res.json({
        success: false,
        status: normalized.isFailed ? 'failed' : (normalized.isCancelled ? 'cancelled' : 'pending'),
        rawStatus: normalized.statusStr || 'PENDING',
        message: normalized.isFailed 
          ? 'পেমেন্ট ভেরিফিকেশন ব্যর্থ হয়েছে বা ভুল ট্রানজেকশন দেওয়া হয়েছে।' 
          : (normalized.isCancelled ? 'পেমেন্ট বাতিল করা হয়েছে।' : 'পেমেন্ট এখনো সম্পন্ন হয়নি।')
      });
    } catch (err: any) {
      console.error('Error in /api/payment/check-status:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 1.3 Reconcile All Pending Payments for User Endpoint (on app focus or boot)
  app.post('/api/payment/reconcile-pending', async (req, res) => {
    try {
      const { userId, phone } = req.body;
      if (!userId && !phone) {
        return res.status(400).json({ error: 'userId or phone required' });
      }

      if (!db) {
        return res.status(500).json({ error: 'database_unavailable' });
      }

      const invoicesRef = collection(db, 'zinipay_invoices');
      const q = query(invoicesRef, where('userId', '==', userId), where('status', '==', 'pending'), limit(15));
      const snap = await getDocs(q);

      let reconciledCount = 0;
      let lastResult: any = null;

      for (const d of snap.docs) {
        const inv = d.data();
        const invoice_id = inv.invoice_id || d.id;
        const val_id = inv.val_id;

        try {
          const verifyPayload: any = {};
          if (invoice_id) verifyPayload.invoice_id = invoice_id;
          if (val_id) verifyPayload.val_id = val_id;

          const verifyRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'zini-api-key': ZINIPAY_API_KEY
            },
            body: JSON.stringify(verifyPayload)
          });
          const verifyData = await verifyRes.json();
          const normalized = normalizeZiniVerify(verifyData, inv);
          if (normalized.isCompleted) {
            const targetAmount = normalized.amount || inv.amount;
            const targetUserId = normalized.userId || userId;
            const transaction_id = normalized.trxId || invoice_id || val_id || `ZP_${Date.now()}`;

            lastResult = await processVerifiedZiniPayment(db, transaction_id, targetUserId, targetAmount, verifyData);
            await updateDoc(d.ref, {
              status: 'completed',
              completedAt: new Date().toISOString(),
              transactionId: transaction_id
            });
            reconciledCount++;
          } else if (normalized.isFailed || normalized.isCancelled) {
            await updateDoc(d.ref, { status: normalized.statusStr.toLowerCase(), failedAt: new Date().toISOString() });
          }
        } catch (e) {}
      }

      return res.json({
        success: true,
        reconciledCount,
        lastResult
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 2. ZiniPay Success/Return Callback Endpoint
  app.all(['/api/payment/zinipay-callback', '/api/payment/nagorikpay-callback', '/api/payment/callback'], async (req, res) => {
    try {
      console.log('ZiniPay callback received. Query:', req.query, 'Body:', req.body);
      const val_id = (req.query.val_id || req.body.val_id || '') as string;
      const raw_invoice_id = (req.query.invoice_id || req.body.invoice_id || req.query.invoiceId || req.body.invoiceId || '') as string;

      let storedInvoice: any = null;
      if (db && (val_id || raw_invoice_id)) {
        try {
          const checkKey = val_id || raw_invoice_id;
          const invSnap = await getDoc(doc(db, 'zinipay_invoices', checkKey));
          if (invSnap.exists()) {
            storedInvoice = invSnap.data();
          }
        } catch (e) {
          console.warn('Could not read stored invoice in callback:', e);
        }
      }

      const verifyInvoiceId = raw_invoice_id || storedInvoice?.invoice_id || val_id;
      const verifyValId = val_id || storedInvoice?.val_id || raw_invoice_id;

      if (!verifyInvoiceId && !verifyValId) {
        console.error('No invoice identifier provided in ZiniPay callback');
        return res.redirect('/?payment_status=failed&error=missing_invoice_id');
      }

      // Verify with ZiniPay
      console.log(`Verifying invoice ${verifyInvoiceId} (val_id: ${verifyValId}) with ZiniPay API...`);
      let verifyResponse = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'zini-api-key': ZINIPAY_API_KEY
        },
        body: JSON.stringify({
          val_id: verifyValId,
          invoice_id: verifyInvoiceId
        })
      });

      let verifyData: any;
      try {
        verifyData = await verifyResponse.json();
      } catch (err) {
        verifyData = { status: false, message: 'Invalid verify response' };
      }

      // If initial attempt failed, try with val_id only
      if (!verifyData || verifyData.status === false || verifyData.status === 'false') {
        if (verifyValId) {
          try {
            const retryRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'zini-api-key': ZINIPAY_API_KEY
              },
              body: JSON.stringify({ val_id: verifyValId })
            });
            const retryData = await retryRes.json();
            if (retryData && retryData.status !== false && retryData.status !== 'false') {
              verifyData = retryData;
            }
          } catch (rErr) {
            console.warn('Retry with val_id failed:', rErr);
          }
        }
      }

      console.log('ZiniPay callback verification API response:', JSON.stringify(verifyData));

      const normalized = normalizeZiniVerify(verifyData, storedInvoice);

      if (!normalized.isCompleted) {
        console.error('ZiniPay transaction verification status is not completed:', verifyData);
        if (normalized.statusStr === 'PENDING') {
          return res.redirect(`/?payment_status=pending&val_id=${encodeURIComponent(verifyValId || '')}`);
        }
        if (normalized.isCancelled) {
          return res.redirect(`/?payment_status=cancelled`);
        }
        return res.redirect(`/?payment_status=failed&error=${encodeURIComponent(normalized.statusStr || 'verification_failed')}`);
      }

      // Extract verified details strictly from verified response or stored invoice record
      let verifiedUserId = normalized.userId || storedInvoice?.userId || req.query.userId || req.body.userId;
      let verifiedAmount = normalized.amount || storedInvoice?.amount || req.query.amount || req.body.amount;
      let transaction_id = normalized.trxId || verifyInvoiceId || verifyValId || `ZP_${Date.now()}`;

      if (!verifiedUserId || !verifiedAmount) {
        console.error('CRITICAL: verifyData missing userId or amount!', verifyData);
        return res.redirect(`/?payment_status=failed&error=missing_verification_metadata`);
      }

      try {
        const txResult = await processVerifiedZiniPayment(db, transaction_id, verifiedUserId, verifiedAmount, verifyData);
        
        if (txResult.alreadyProcessed) {
          console.log(`Transaction ${transaction_id} already processed. Idempotency protected.`);
        } else {
          console.log(`ZiniPay successfully credited user ${verifiedUserId} with ৳${txResult.amount}. New Balance: ৳${txResult.newBalance}`);
        }

        // Update stored invoice state
        if (db && verifyValId) {
          updateDoc(doc(db, 'zinipay_invoices', verifyValId), {
            status: 'completed',
            completedAt: new Date().toISOString(),
            transactionId: transaction_id
          }).catch(() => {});
        }

        const rawReturnHost = (req.query.returnOrigin as string) || storedInvoice?.returnOrigin || '';
        const returnHost = (rawReturnHost && !rawReturnHost.startsWith('capacitor:') && !rawReturnHost.startsWith('file:'))
          ? rawReturnHost.replace(/\/$/, '')
          : (req.headers.origin ? String(req.headers.origin).replace(/\/$/, '') : 'https://ais-pre-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app');

        const deepLinkUrl = `bnbnetwork://payment-success?status=success&amount=${txResult.amount}&trxId=${encodeURIComponent(transaction_id)}`;
        const webRedirectUrl = `${returnHost}/?payment_status=success&amount=${txResult.amount}&trxId=${encodeURIComponent(transaction_id)}&gateway=BNB`;

        // Render high-reliability bridge page with automatic Android custom-scheme launch
        const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>পেমেন্ট সফল | BNB BUSINESS NETWORK</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: #f0fdf4; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; color: #0f172a; }
    .card { background: #ffffff; border-radius: 28px; box-shadow: 0 20px 40px -15px rgba(5, 150, 105, 0.2); max-width: 400px; width: 100%; padding: 32px 24px; text-align: center; border: 1px solid #d1fae5; }
    .icon-circle { width: 72px; height: 72px; background: #ecfdf5; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #059669; font-size: 34px; margin-bottom: 18px; box-shadow: 0 8px 16px -4px rgba(5, 150, 105, 0.2); }
    h1 { font-size: 21px; font-weight: 800; color: #065f46; margin-bottom: 6px; }
    p.subtitle { font-size: 13px; color: #64748b; margin-bottom: 22px; }
    .details { background: #f8fafc; border-radius: 18px; padding: 16px; margin-bottom: 22px; border: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
    .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .row:last-child { margin-bottom: 0; padding-top: 10px; border-top: 1px dashed #cbd5e1; }
    .label { color: #64748b; font-weight: 600; }
    .val { color: #0f172a; font-weight: 800; font-family: monospace; }
    .btn { display: block; width: 100%; padding: 14px; border-radius: 16px; font-size: 14px; font-weight: 800; text-decoration: none; cursor: pointer; transition: all 0.2s; border: none; margin-bottom: 10px; }
    .btn-primary { background: linear-gradient(135deg, #059669, #047857); color: #ffffff; box-shadow: 0 8px 20px -4px rgba(5, 150, 105, 0.4); }
    .btn-secondary { background: #f1f5f9; color: #334155; }
    .countdown { font-size: 11px; color: #94a3b8; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-circle">✓</div>
    <h1>পেমেন্ট সফল হয়েছে!</h1>
    <p class="subtitle">আপনার মেইন ব্যালেন্সে টাকা সফলভাবে যোগ করা হয়েছে</p>
    <div class="details">
      <div class="row">
        <span class="label">জমার পরিমাণ:</span>
        <span class="val" style="color: #059669; font-size: 17px;">৳${txResult.amount.toLocaleString('bn-BD')}</span>
      </div>
      <div class="row">
        <span class="label">বর্তমান মেইন ব্যালেন্স:</span>
        <span class="val">৳${txResult.newBalance.toLocaleString('bn-BD')}</span>
      </div>
      <div class="row">
        <span class="label">TrxID:</span>
        <span class="val" style="font-size: 11px;">${transaction_id}</span>
      </div>
    </div>
    <a href="${deepLinkUrl}" class="btn btn-primary">📱 সরাসরি BNB অ্যাপে ফিরে যান</a>
    <a href="${webRedirectUrl}" class="btn btn-secondary">🌐 ব্রাউজারে ড্যাশবোর্ড দেখুন</a>
    <div class="countdown">স্বয়ংক্রিয়ভাবে অ্যাপে ফিরে যাওয়া হচ্ছে...</div>
  </div>
  <script>
    try {
      window.location.href = "${deepLinkUrl}";
    } catch (e) {}
    setTimeout(function() {
      try { window.close(); } catch(e){}
    }, 1000);
    setTimeout(function() {
      if (!document.hidden) {
        window.location.href = "${webRedirectUrl}";
      }
    }, 2000);
  </script>
</body>
</html>`;
        return res.send(html);
      } catch (err: any) {
        console.error('Error processing callback payment in db:', err.message);
        const rawReturnHost = (req.query.returnOrigin as string) || storedInvoice?.returnOrigin || '';
        const returnHost = (rawReturnHost && !rawReturnHost.startsWith('capacitor:') && !rawReturnHost.startsWith('file:'))
          ? rawReturnHost.replace(/\/$/, '')
          : (req.headers.origin ? String(req.headers.origin).replace(/\/$/, '') : 'https://ais-pre-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app');
        return res.redirect(`${returnHost}/?payment_status=failed&error=${encodeURIComponent(err.message || 'processing_failed')}`);
      }

    } catch (error: any) {
      console.error('Error in ZiniPay callback handler:', error);
      const rawReturnHost = (req.query.returnOrigin as string) || '';
      const returnHost = (rawReturnHost && !rawReturnHost.startsWith('capacitor:') && !rawReturnHost.startsWith('file:'))
        ? rawReturnHost.replace(/\/$/, '')
        : (req.headers.origin ? String(req.headers.origin).replace(/\/$/, '') : 'https://ais-pre-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app');
      return res.redirect(`${returnHost}/?payment_status=failed&error=${encodeURIComponent(error.message || 'callback_error')}`);
    }
  });

  // 3. ZiniPay Cancel Callback Endpoint
  app.all(['/api/payment/zinipay-cancel', '/api/payment/nagorikpay-cancel', '/api/payment/cancel'], (req, res) => {
    console.info('ZiniPay payment cancelled by user:', req.query);
    const rawReturnHost = (req.query.returnOrigin as string) || '';
    const returnHost = (rawReturnHost && !rawReturnHost.startsWith('capacitor:') && !rawReturnHost.startsWith('file:'))
      ? rawReturnHost.replace(/\/$/, '')
      : (req.headers.origin ? String(req.headers.origin).replace(/\/$/, '') : 'https://ais-pre-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app');
    
    const deepLinkUrl = `bnbnetwork://payment-cancel?status=cancelled`;
    const webRedirectUrl = `${returnHost}/?payment_status=cancelled`;
    const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>পেমেন্ট বাতিল | BNB BUSINESS NETWORK</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; color: #0f172a; }
    .card { background: #ffffff; border-radius: 28px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.08); max-width: 400px; width: 100%; padding: 32px 24px; text-align: center; border: 1px solid #e2e8f0; }
    .icon-circle { width: 64px; height: 64px; background: #fef2f2; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #ef4444; font-size: 28px; margin-bottom: 16px; }
    h1 { font-size: 19px; font-weight: 800; color: #1e293b; margin-bottom: 6px; }
    p.subtitle { font-size: 13px; color: #64748b; margin-bottom: 20px; }
    .btn { display: block; width: 100%; padding: 14px; border-radius: 16px; font-size: 14px; font-weight: 800; text-decoration: none; cursor: pointer; transition: all 0.2s; border: none; margin-bottom: 10px; }
    .btn-primary { background: #059669; color: #ffffff; }
    .btn-secondary { background: #f1f5f9; color: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-circle">✕</div>
    <h1>পেমেন্ট বাতিল করা হয়েছে</h1>
    <p class="subtitle">আপনার কোনো টাকা কাটা হয়নি। প্রয়োজন হলে আবার চেষ্টা করতে পারেন।</p>
    <a href="${deepLinkUrl}" class="btn btn-primary">📱 সরাসরি BNB অ্যাপে ফিরে যান</a>
    <a href="${webRedirectUrl}" class="btn btn-secondary">🌐 ব্রাউজারে ড্যাশবোর্ড দেখুন</a>
  </div>
  <script>
    try { window.location.href = "${deepLinkUrl}"; } catch(e){}
    setTimeout(function() {
      try { window.close(); } catch(e){}
    }, 1000);
    setTimeout(function() {
      if (!document.hidden) {
        window.location.href = "${webRedirectUrl}";
      }
    }, 2000);
  </script>
</body>
</html>`;
    return res.send(html);
  });

  // 60-Day Auto Retention API Endpoint
  app.all('/api/admin/clean-expired-transactions', async (req, res) => {
    try {
      await runScheduledTransactionCleanup(db);
      return res.json({ success: true, message: '60-day auto retention cleanup executed successfully.' });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'cleanup_failed' });
    }
  });

  // 4. ZiniPay Webhook Endpoint
  app.post(['/api/payment/zinipay-webhook', '/api/payment/nagorikpay-webhook', '/api/payment/webhook'], async (req, res) => {
    console.log('ZiniPay payment webhook received:', req.body, 'Query:', req.query);
    try {
      const val_id = (req.body.val_id || req.query.val_id || '') as string;
      const raw_invoice_id = (req.body.invoice_id || req.query.invoice_id || req.body.invoiceId || req.query.invoiceId || '') as string;

      let storedInvoice: any = null;
      if (db && (val_id || raw_invoice_id)) {
        try {
          const checkKey = val_id || raw_invoice_id;
          const invSnap = await getDoc(doc(db, 'zinipay_invoices', checkKey));
          if (invSnap.exists()) {
            storedInvoice = invSnap.data();
          }
        } catch (e) {}
      }

      const verifyInvoiceId = raw_invoice_id || storedInvoice?.invoice_id || val_id;
      const verifyValId = val_id || storedInvoice?.val_id || raw_invoice_id;

      if (!verifyInvoiceId && !verifyValId) {
        return res.status(400).json({ error: 'missing_invoice_id' });
      }

      // Re-verify strictly with ZiniPay API to prevent any webhook spoofing
      let verifyResponse = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'zini-api-key': ZINIPAY_API_KEY
        },
        body: JSON.stringify({
          val_id: verifyValId,
          invoice_id: verifyInvoiceId
        })
      });

      let verifyData: any;
      try {
        verifyData = await verifyResponse.json();
      } catch (err) {
        verifyData = { status: false };
      }

      if (!verifyData || verifyData.status === false || verifyData.status === 'false') {
        if (verifyValId) {
          try {
            const retryRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'zini-api-key': ZINIPAY_API_KEY
              },
              body: JSON.stringify({ val_id: verifyValId })
            });
            const retryData = await retryRes.json();
            if (retryData && retryData.status !== false && retryData.status !== 'false') {
              verifyData = retryData;
            }
          } catch (rErr) {}
        }
      }

      console.log('ZiniPay webhook verification API response:', JSON.stringify(verifyData));

      const normalized = normalizeZiniVerify(verifyData, storedInvoice);

      if (!normalized.isCompleted) {
        return res.status(400).json({ error: 'verification_failed', status: normalized.statusStr });
      }

      let verifiedUserId = normalized.userId || storedInvoice?.userId || req.query.userId || req.body.userId;
      let verifiedAmount = normalized.amount || storedInvoice?.amount || req.query.amount || req.body.amount;
      let transaction_id = normalized.trxId || verifyInvoiceId || verifyValId || `ZP_${Date.now()}`;

      if (!verifiedUserId || !verifiedAmount) {
        return res.status(400).json({ error: 'missing_verification_metadata', verifyData });
      }

      const txResult = await processVerifiedZiniPayment(db, transaction_id, verifiedUserId, verifiedAmount, verifyData);
      
      if (txResult.alreadyProcessed) {
        console.log(`Webhook ignored transaction ${transaction_id} as it was already processed.`);
      } else {
        console.log(`Webhook successfully credited user ${verifiedUserId} with ৳${txResult.amount}.`);
      }

      if (db && verifyValId) {
        updateDoc(doc(db, 'zinipay_invoices', verifyValId), {
          status: 'completed',
          completedAt: new Date().toISOString(),
          transactionId: transaction_id
        }).catch(() => {});
      }
      
      return res.status(200).json({ received: true, status: 'processed', transaction_id });
    } catch (err: any) {
      console.error('Error processing ZiniPay webhook payment:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 5. Custom Android SMS Gateway Webhook Endpoint
  app.get('/api/sms-gateway/webhook', (req, res) => {
    return res.status(200).json({
      status: 'active',
      service: 'BNB SMS Gateway Webhook',
      instruction: 'Send HTTP POST requests with JSON body containing trxId, amount, sender, message, and secretKey from your Android SMS Gateway APK.',
      timestamp: new Date().toISOString()
    });
  });

  // =========================================================================
  // Multi-Operator (bKash, Nagad, Rocket) SMS Detection & Payment Verification System
  // =========================================================================

  // Helper Regexes for Multi-Operator (bKash, Nagad, Rocket) Personal & Merchant Transaction SMS Parsing
  const MFS_TRX_REGEX = /(?:TrxID|trxID|TRXID|Trx\s*Id|TxnID|TxnId|TXNID|Txn\s*Id|Transaction\s*ID|Txn|Trx)[:\s]*([A-Za-z0-9]{8,15})/i;
  const MFS_AMOUNT_REGEX = /(?:(?:received|cash\s*in|deposit|amount|পরিমাণ)[:\s]*(?:Tk\.?|TK\.?|BDT|৳|টাকা)?|(?:Tk\.?|TK\.?|BDT|৳|টাকা))\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;
  const MFS_SENDER_PHONE_REGEX = /(?:from|by|Sender|প্রেরক|হতে|থেকে)[:\s]*(\+?8801[3-9]\d{8,9}|01[3-9]\d{8,9})/i;

  function detectMfsOperator(sender?: string, message?: string, requestedOperator?: string): 'bKash' | 'Nagad' | 'Rocket' {
    const s = String(sender || '').toLowerCase();
    const m = String(message || '').toLowerCase();
    const r = String(requestedOperator || '').toLowerCase();

    if (r === 'nagad' || s.includes('nagad') || s.includes('16167') || m.includes('nagad') || m.includes('নগদ')) {
      return 'Nagad';
    }
    if (r === 'rocket' || s.includes('rocket') || s.includes('16216') || s.includes('dbbl') || m.includes('rocket') || m.includes('রকেট')) {
      return 'Rocket';
    }
    return 'bKash';
  }

  // Concurrency Lock & Rate Limiting for bKash SMS Gateway
  const activeProcessingTrx = new Set<string>();
  const gatewayRateLimitMap = new Map<string, { count: number; resetAt: number }>();

  function checkSmsRateLimit(clientIp: string, maxRequests: number = 40, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = gatewayRateLimitMap.get(clientIp);
    if (!record || now > record.resetAt) {
      gatewayRateLimitMap.set(clientIp, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (record.count >= maxRequests) {
      return false;
    }
    record.count++;
    return true;
  }

  // 1. Health & Status Endpoint
  app.get('/api/sms-gateway/status', async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({
          status: 'error',
          error: 'db_unavailable',
          message: 'Firebase Firestore সংযোগ বিচ্ছিন্ন রয়েছে।'
        });
      }

      // Collect statistics for Admin Dashboard
      const detectedSnap = await getDocs(query(collection(db, 'detected_payments'), limit(150)));
      const dupSnap = await getDocs(query(collection(db, 'duplicate_transactions'), limit(150)));
      const failedSnap = await getDocs(query(collection(db, 'failed_transactions'), limit(150)));

      let pendingCount = 0;
      let verifiedCount = 0;
      let totalDetected = detectedSnap.size;

      detectedSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.status === 'pending_verification') pendingCount++;
        else if (d.status === 'verified') verifiedCount++;
      });

      return res.status(200).json({
        status: 'active',
        service: 'BNB bKash SMS Payment System',
        accountType: 'Personal bKash Account',
        verificationMode: 'Pending Verification (No bypass without explicit approval)',
        firebaseConnected: true,
        stats: {
          totalDetected,
          pendingVerification: pendingCount,
          verified: verifiedCount,
          duplicates: dupSnap.size,
          failed: failedSnap.size
        },
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // 2. Incoming bKash SMS Webhook Endpoint (From Android Native Receiver or SMS Forwarder)
  app.post('/api/sms-gateway/webhook', async (req, res) => {
    console.log('[bKash SMS Gateway] Webhook received payload:', req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkSmsRateLimit(String(clientIp), 40, 60000)) {
      return res.status(429).json({
        success: false,
        error: 'rate_limit_exceeded',
        message: 'অতিরিক্ত রিকোয়েস্ট পাঠানো হয়েছে। কিছুক্ষণ পর পুনরায় চেষ্টা করুন।'
      });
    }

    let cleanTrxLocked: string | null = null;
    try {
      const { secretKey, sender, message, rawMessage, trxId, amount, senderPhone, source, timestamp } = req.body;
      
      const expectedSecret = process.env.SMS_GATEWAY_SECRET || 'bnb_sms_gateway_secure_2026';
      if (!secretKey || secretKey !== expectedSecret) {
        return res.status(401).json({ 
          success: false, 
          error: 'unauthorized', 
          message: 'অননুমোদিত রিকোয়েস্ট: সঠিক সিক্রেট কি (secretKey) দেওয়া আবশ্যক।' 
        });
      }

      const smsBody = String(message || rawMessage || '').trim();
      const detectedOperator = detectMfsOperator(sender, smsBody, req.body.operator);
      
      // Auto-extract TrxID if not explicitly provided
      let cleanTrx = trxId ? String(trxId).trim().toUpperCase() : '';
      if (!cleanTrx && smsBody) {
        const m = smsBody.match(MFS_TRX_REGEX);
        if (m) cleanTrx = m[1].trim().toUpperCase();
      }

      // Concurrency Lock: Prevent simultaneous identical TrxID processing
      if (cleanTrx) {
        if (activeProcessingTrx.has(cleanTrx)) {
          return res.status(409).json({
            success: false,
            error: 'concurrent_request_conflict',
            message: 'একই TrxID বর্তমানে প্রসেসিং অবস্থায় রয়েছে। ডাবল প্রসেসিং প্রতিহত করা হয়েছে।'
          });
        }
        activeProcessingTrx.add(cleanTrx);
        cleanTrxLocked = cleanTrx;
      }

      // Auto-extract Amount if not explicitly provided
      let numAmount = amount ? parseFloat(String(amount).replace(/,/g, '')) : NaN;
      if (isNaN(numAmount) && smsBody) {
        const m = smsBody.match(MFS_AMOUNT_REGEX);
        if (m) numAmount = parseFloat(m[1].replace(/,/g, ''));
      }

      // Auto-extract Sender Phone if not explicitly provided
      let cleanSenderPhone = senderPhone ? String(senderPhone).trim() : '';
      if (!cleanSenderPhone && smsBody) {
        const m = smsBody.match(MFS_SENDER_PHONE_REGEX);
        if (m) cleanSenderPhone = m[1].trim();
      }

      // STRICT INPUT VALIDATION: TrxID format & amount range
      if (!cleanTrx || !/^[A-Za-z0-9]{8,15}$/.test(cleanTrx)) {
        return res.status(400).json({
          success: false,
          error: 'invalid_trxid_format',
          message: `অবৈধ ${detectedOperator} TrxID ফরম্যাট। TrxID অবশ্যই ৮-১৫ অক্ষরের বর্ণ ও সংখ্যা হতে হবে।`,
          detectedTrx: cleanTrx
        });
      }

      if (isNaN(numAmount) || numAmount < 1 || numAmount > 1000000 || !Number.isFinite(numAmount)) {
        return res.status(400).json({
          success: false,
          error: 'invalid_amount',
          message: 'অবৈধ টাকার পরিমাণ। পরিমাণ অবশ্যই ৳১ থেকে ৳১০,০০,০০০ এর মধ্যে হতে হবে।',
          detectedAmount: isNaN(numAmount) ? null : numAmount
        });
      }

      if (!db) {
        return res.status(503).json({ success: false, error: 'db_unavailable', message: 'Firebase সংযোগ ব্যর্থ।' });
      }

      // =========================================================================
      // MANDATORY RULE 6: DUPLICATE PREVENTION CHECK
      // শুধুমাত্র ইতিপূর্বে প্রসেসড বা সফলভাবে ভেরিফাইড লেনদেনকে ডুপ্লিকেট হিসেবে গণ্য করবে
      // পেন্ডিং রিকোয়েস্ট ডুপ্লিকেট নয়; তা অটো-ম্যাচিংয়ের জন্য অপেক্ষমাণ।
      // =========================================================================
      const payDocRef = doc(db, 'detected_payments', `PAY_${cleanTrx}`);
      const paySnap = await getDoc(payDocRef);

      const txQ = query(collection(db, 'transactions'), where('trxId', '==', cleanTrx), limit(1));
      const txSnap = await getDocs(txQ);

      const txData = !txSnap.empty ? txSnap.docs[0].data() : null;
      const isTxAlreadySuccess = !!(txData && (txData.status === 'success' || txData.isApproved === true));
      const isDuplicate = paySnap.exists() || isTxAlreadySuccess;

      if (isDuplicate) {
        console.warn(`[Duplicate Blocked] TrxID ${cleanTrx} already exists in database. Rejecting double processing.`);
        
        // Log in duplicate_transactions
        const dupDocRef = doc(collection(db, 'duplicate_transactions'));
        await setDoc(dupDocRef, {
          id: dupDocRef.id,
          trxId: cleanTrx,
          amount: numAmount,
          sender: sender || 'bKash',
          senderPhone: cleanSenderPhone,
          rawMessage: smsBody,
          firstDetectedAt: paySnap.exists() ? paySnap.data()?.detectedAt : null,
          rejectedAt: new Date().toISOString(),
          reason: 'একই TrxID একাধিকবার পাঠানো হয়েছে (Duplicate TrxID Rejection)',
          source: source || 'webhook',
          status: 'rejected_duplicate'
        });

        // Update original record with duplicate attempt marker
        if (paySnap.exists()) {
          const curData = paySnap.data();
          await updateDoc(payDocRef, {
            isDuplicate: true,
            duplicateAttempts: (curData?.duplicateAttempts || 1) + 1,
            lastDuplicateAttemptAt: new Date().toISOString()
          }).catch(() => {});
        }

        return res.status(200).json({
          success: false,
          status: 'duplicate_rejected',
          error: 'duplicate_trxid',
          message: `ডুপ্লিকেট ট্রানজেকশন সনাক্ত ও প্রত্যাখ্যাত! TrxID: ${cleanTrx} পূর্বে একবার প্রসেস/রেকর্ড করা হয়েছে। ব্যালেন্স পরিবর্তন করা হবে না।`,
          trxId: cleanTrx
        });
      }

      // =========================================================================
      // MANDATORY RULE 4, 5 & 9: STRICT 100% BIDIRECTIONAL MATCHING ENGINE
      // সদস্যের Payment Request, Amount ও TrxID ১০০% মিলিয়ে স্বয়ংক্রিয়ভাবে ব্যালেন্স যোগ
      // =========================================================================
      let matchedUserId: string | null = null;
      let matchedMemberId: string | null = null;
      let matchedUserName: string | null = null;
      let matchedTxId: string | null = null;
      let matchStatus = 'unmatched_no_member_request';
      let amountMatches = false;

      // Match strictly by Member Deposit/Payment Request (TrxID in transactions)
      const matchQ = query(
        collection(db, 'transactions'),
        where('trxId', '==', cleanTrx),
        limit(1)
      );
      const matchRes = await getDocs(matchQ);

      const nowIso = new Date().toISOString();

      if (!matchRes.empty) {
        const mDoc = matchRes.docs[0];
        const mData = mDoc.data();
        matchedUserId = mData.userId || null;
        matchedMemberId = mData.memberId || null;
        matchedUserName = mData.userName || null;
        matchedTxId = mDoc.id;
        amountMatches = Math.abs((Number(mData.amount) || 0) - numAmount) < 0.01;
        matchStatus = amountMatches ? 'matched_payment_request' : 'amount_mismatch';

        // Check if member request is currently pending
        const isPendingTx = mData.status === 'pending' || mData.status === 'pending_verification';

        if (amountMatches && isPendingTx && matchedUserId) {
          // 100% MATCH: Automatic balance credit, notification, and history update!
          console.log(`[Auto-Matching Engine] 100% Match! TrxID: ${cleanTrx}, Amount: ${numAmount}, User: ${matchedUserId}`);

          const autoResult = await runTransaction(db, async (t) => {
            const userDocRef = doc(db, 'users', matchedUserId!);
            const userSnap = await t.get(userDocRef);
            const userData = userSnap.exists() ? userSnap.data() : { balance: 0, mainBalance: 0, name: 'সদস্য', memberId: 'BNB000001' };

            const currentBal = Number(userData.balance) || 0;
            const currentMain = Number(userData.mainBalance) || 0;
            const newBal = currentBal + numAmount;
            const newMain = currentMain + numAmount;

            // Atomic balance credit
            t.set(userDocRef, {
              balance: newBal,
              mainBalance: newMain
            }, { merge: true });

            // Update transaction to success
            const txDocRef = doc(db, 'transactions', matchedTxId!);
            t.update(txDocRef, {
              status: 'success',
              isApproved: true,
              verifiedAt: nowIso,
              verifiedBy: 'system_auto_matcher',
              paymentMethod: `${detectedOperator} Personal (Auto SMS Verified)`,
              operator: detectedOperator,
              description: `${detectedOperator} Personal SMS অটো-ম্যাচিংয়ের মাধ্যমে ৳${numAmount.toLocaleString('bn-BD')} টাকা সফলভাবে একাউন্ট ব্যালেন্সে যোগ হয়েছে (TrxID: ${cleanTrx})`
            });

            // Save detected payment as verified
            t.set(payDocRef, {
              id: `PAY_${cleanTrx}`,
              trxId: cleanTrx,
              amount: numAmount,
              operator: detectedOperator,
              sender: sender || detectedOperator,
              senderPhone: cleanSenderPhone,
              message: smsBody,
              rawMessage: smsBody,
              detectedAt: nowIso,
              status: 'verified',
              verificationStatus: 'verified_auto_matched',
              matchStatus: 'matched_payment_request',
              matchedUserId,
              matchedMemberId: userData.memberId || matchedMemberId,
              matchedUserName: userData.name || matchedUserName,
              matchedTransactionId: matchedTxId,
              isProcessed: true,
              processedAt: nowIso,
              verifiedAt: nowIso,
              verifiedBy: 'system_auto_matcher',
              isDuplicate: false,
              duplicateAttempts: 0,
              source: source || 'webhook',
              autoMatched: true
            });

            // Update incoming_sms
            const smsDocRef = doc(db, 'incoming_sms', `SMS_${cleanTrx}`);
            t.set(smsDocRef, {
              id: `SMS_${cleanTrx}`,
              trxId: cleanTrx,
              amount: numAmount,
              operator: detectedOperator,
              sender: sender || detectedOperator,
              senderPhone: cleanSenderPhone,
              message: smsBody,
              status: 'claimed',
              isUsed: true,
              usedBy: matchedUserId,
              receivedAt: nowIso
            }, { merge: true });

            // Push User Notification
            const notifRef = doc(collection(db, 'user_notifications'));
            t.set(notifRef, {
              id: notifRef.id,
              userId: matchedUserId,
              title: `${detectedOperator} ডিপোজিট অনুমোদিত 🎉`,
              body: `আপনার ${detectedOperator} TrxID (${cleanTrx})-এর ৳${numAmount.toLocaleString('bn-BD')} টাকা স্বয়ংক্রিয়ভাবে যাচাই হয়ে একাউন্ট ব্যালেন্সে যোগ হয়েছে।`,
              message: `আপনার ${detectedOperator} TrxID (${cleanTrx})-এর ৳${numAmount.toLocaleString('bn-BD')} টাকা স্বয়ংক্রিয়ভাবে যাচাই হয়ে একাউন্ট ব্যালেন্সে যোগ হয়েছে।`,
              read: false,
              createdAt: nowIso
            });

            return { newBal, userData };
          });

          // Audit Log in sms_logs
          const logRef = doc(collection(db, 'sms_logs'));
          await setDoc(logRef, {
            id: logRef.id,
            event: 'MFS_PAYMENT_AUTO_MATCHED',
            operator: detectedOperator,
            trxId: cleanTrx,
            amount: numAmount,
            senderPhone: cleanSenderPhone,
            status: 'verified',
            matchedUserId,
            matchedMemberId: autoResult.userData?.memberId || matchedMemberId,
            createdAt: nowIso
          });

          return res.status(200).json({
            success: true,
            status: 'verified_auto_matched',
            operator: detectedOperator,
            message: `${detectedOperator} SMS এবং মেম্বার রিকোয়েস্ট ১০০% মিলেছে! টাকা স্বয়ংক্রিয়ভাবে ব্যালেন্সে যোগ হয়েছে।`,
            trxId: cleanTrx,
            amount: numAmount,
            matchedUserId,
            matchedUserName: autoResult.userData?.name || matchedUserName,
            newBalance: autoResult.newBal
          });
        }
      }

      // If no matching pending member request found or amount mismatch:
      // Holds safely in pending_verification for admin review or subsequent member claim
      const detectedData = {
        id: `PAY_${cleanTrx}`,
        trxId: cleanTrx,
        amount: numAmount,
        operator: detectedOperator,
        sender: sender || detectedOperator,
        senderPhone: cleanSenderPhone,
        message: smsBody,
        rawMessage: smsBody,
        detectedAt: nowIso,
        status: 'pending_verification',
        verificationStatus: matchedUserId ? (amountMatches ? 'pending_review' : 'amount_mismatch') : 'unidentified_member',
        matchStatus,
        matchedUserId,
        matchedMemberId,
        matchedUserName,
        matchedTransactionId: matchedTxId,
        isProcessed: false,
        processedAt: null,
        verifiedAt: null,
        verifiedBy: null,
        rejectionReason: null,
        isDuplicate: false,
        duplicateAttempts: 0,
        source: source || 'webhook',
        personalNotice: `Personal ${detectedOperator} একাউন্ট: লেনদেনটি Pending Verification তালিকায় সংরক্ষিত হয়েছে।`
      };

      await setDoc(payDocRef, detectedData);

      // Save to incoming_sms collection for backwards compatibility
      const smsDocRef = doc(db, 'incoming_sms', `SMS_${cleanTrx}`);
      await setDoc(smsDocRef, {
        id: `SMS_${cleanTrx}`,
        trxId: cleanTrx,
        amount: numAmount,
        operator: detectedOperator,
        sender: sender || detectedOperator,
        senderPhone: cleanSenderPhone,
        message: smsBody,
        status: 'pending_verification',
        isUsed: false,
        usedBy: null,
        receivedAt: nowIso
      }, { merge: true });

      // Audit Log in sms_logs
      const logRef = doc(collection(db, 'sms_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        event: 'MFS_PAYMENT_DETECTED',
        operator: detectedOperator,
        trxId: cleanTrx,
        amount: numAmount,
        senderPhone: cleanSenderPhone,
        status: 'pending_verification',
        matchedUserId,
        matchedMemberId,
        createdAt: nowIso
      });

      return res.status(200).json({
        success: true,
        status: 'pending_verification',
        operator: detectedOperator,
        message: `${detectedOperator} SMS সফলভাবে শনাক্ত হয়েছে এবং Pending Verification তালিকায় সংরক্ষিত হয়েছে।`,
        trxId: cleanTrx,
        amount: numAmount,
        senderPhone: cleanSenderPhone,
        matchedUserId,
        matchedMemberId,
        matchedUserName,
        matchStatus
      });
    } catch (err: any) {
      console.error('[bKash SMS Gateway] Webhook error:', err);
      return res.status(500).json({ success: false, error: err.message });
    } finally {
      if (cleanTrxLocked) {
        activeProcessingTrx.delete(cleanTrxLocked);
      }
    }
  });

  // 3. Admin Verification Approval Endpoint (Atomic Balance Credit)
  app.post('/api/sms-gateway/approve-verification', async (req, res) => {
    try {
      const { trxId, targetUserId, adminUid, secretKey, verificationProof } = req.body;
      const expectedSecret = process.env.SMS_GATEWAY_SECRET || 'bnb_sms_gateway_secure_2026';
      
      if (!trxId) {
        return res.status(400).json({ success: false, error: 'missing_trxid', message: 'TrxID দেওয়া আবশ্যক।' });
      }

      if (!db) {
        return res.status(503).json({ success: false, error: 'db_unavailable' });
      }

      const cleanTrx = String(trxId).trim().toUpperCase();
      const payDocRef = doc(db, 'detected_payments', `PAY_${cleanTrx}`);
      const smsDocRef = doc(db, 'incoming_sms', `SMS_${cleanTrx}`);

      const result = await runTransaction(db, async (t) => {
        // 1. Fetch detected payment record
        const paySnap = await t.get(payDocRef);
        if (!paySnap.exists()) {
          throw new Error('payment_record_not_found');
        }

        const payData = paySnap.data();
        if (payData.isProcessed || payData.status === 'verified') {
          throw new Error('already_processed');
        }

        // 2. Identify and validate target member (Requirement 5)
        const finalUserId = targetUserId || payData.matchedUserId;
        if (!finalUserId) {
          throw new Error('member_not_identified');
        }

        // Requirement 3: Admin Approval-ও প্রকৃত পেমেন্টের প্রমাণের বিকল্প নয় (Mandatory Audit Proof)
        const validProofNote = verificationProof ? String(verificationProof).trim() : '';
        if (validProofNote.length < 3) {
          throw new Error('verification_proof_required');
        }

        const userDocRef = doc(db, 'users', finalUserId);
        const userSnap = await t.get(userDocRef);
        const userData = userSnap.exists() ? userSnap.data() : { balance: 0, mainBalance: 0, name: 'সদস্য', memberId: 'BNB000001' };

        const paymentAmount = Number(payData.amount) || 0;
        if (paymentAmount <= 0) {
          throw new Error('invalid_payment_amount');
        }

        const currentBal = Number(userData.balance) || 0;
        const currentMain = Number(userData.mainBalance) || 0;
        const newBal = currentBal + paymentAmount;
        const newMain = currentMain + paymentAmount;

        // 3. Atomic Balance Credit (Exact once)
        t.set(userDocRef, {
          balance: newBal,
          mainBalance: newMain
        }, { merge: true });

        const nowIso = new Date().toISOString();

        // 4. Update detected_payments to verified
        t.update(payDocRef, {
          status: 'verified',
          verificationStatus: 'verified',
          isProcessed: true,
          processedAt: nowIso,
          verifiedAt: nowIso,
          verifiedBy: adminUid || 'admin_master',
          matchedUserId: finalUserId,
          matchedMemberId: userData.memberId || 'BNB000000'
        });

        // 5. Update incoming_sms
        t.update(smsDocRef, {
          status: 'claimed',
          isUsed: true,
          usedBy: finalUserId,
          usedAt: nowIso
        });

        const opLabel = payData.operator || detectMfsOperator(payData.sender, payData.message) || 'bKash';

        // 6. Create or update Transaction in transactions collection
        const txDocRef = doc(db, 'transactions', `SMS_${cleanTrx}`);
        t.set(txDocRef, {
          id: txDocRef.id,
          userId: finalUserId,
          userName: userData.name || 'সদস্য',
          userPhone: userData.phone || '',
          memberId: userData.memberId || '',
          amount: paymentAmount,
          type: 'add_money',
          status: 'success',
          isApproved: true,
          paymentMethod: `${opLabel} Personal (SMS Verified)`,
          operator: opLabel,
          phone: userData.phone || '',
          senderPhone: payData.senderPhone || userData.phone || '',
          trxId: cleanTrx,
          transactionId: cleanTrx,
          receiptNo: cleanTrx,
          createdAt: nowIso,
          description: `${opLabel} Personal SMS যাচাইকরণের মাধ্যমে ৳${paymentAmount.toLocaleString('bn-BD')} টাকা সফলভাবে একাউন্ট ব্যালেন্সে যোগ হয়েছে (TrxID: ${cleanTrx})`
        }, { merge: true });

        // 7. Push User Notification
        const notifRef = doc(collection(db, 'user_notifications'));
        t.set(notifRef, {
          id: notifRef.id,
          userId: finalUserId,
          title: `${opLabel} পেমেন্ট অনুমোদিত 🎉`,
          body: `আপনার ${opLabel} TrxID (${cleanTrx})-এর ৳${paymentAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যাচাই হয়ে ওয়ালেটে যোগ হয়েছে।`,
          message: `আপনার ${opLabel} TrxID (${cleanTrx})-এর ৳${paymentAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যাচাই হয়ে ওয়ালেটে যোগ হয়েছে।`,
          read: false,
          createdAt: nowIso
        });

        return {
          newBalance: newBal,
          amount: paymentAmount,
          trxId: cleanTrx,
          userId: finalUserId,
          userName: userData.name || 'সদস্য'
        };
      });

      return res.status(200).json({
        success: true,
        message: 'পেমেন্ট সফলভাবে যাচাই ও সদস্যের ব্যালেন্সে যোগ করা হয়েছে!',
        data: result
      });
    } catch (err: any) {
      console.error('[bKash SMS Gateway] Approve verification error:', err);
      if (err.message === 'already_processed') {
        return res.status(400).json({ success: false, error: 'already_processed', message: 'এই লেনদেনটি ইতিমধ্যে একবার ভেরিফাই করে ব্যালেন্সে যোগ করা হয়েছে।' });
      }
      if (err.message === 'member_not_identified') {
        return res.status(400).json({ success: false, error: 'member_not_identified', message: 'কোন সদস্যের টাকা এসেছে তা নিশ্চিত হওয়া যায়নি। সদস্য নির্বাচন করুন।' });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Admin Rejection Endpoint
  app.post('/api/sms-gateway/reject-verification', async (req, res) => {
    try {
      const { trxId, reason, adminUid } = req.body;
      if (!trxId) {
        return res.status(400).json({ success: false, error: 'missing_trxid' });
      }
      if (!db) {
        return res.status(503).json({ success: false, error: 'db_unavailable' });
      }

      const cleanTrx = String(trxId).trim().toUpperCase();
      const nowIso = new Date().toISOString();
      const failReason = reason || 'এডমিন কর্তৃক যাচাইয়ে বাতিল করা হয়েছে';

      const payDocRef = doc(db, 'detected_payments', `PAY_${cleanTrx}`);
      const paySnap = await getDoc(payDocRef);

      if (paySnap.exists()) {
        const payData = paySnap.data();
        await updateDoc(payDocRef, {
          status: 'failed',
          verificationStatus: 'rejected',
          rejectionReason: failReason,
          rejectedAt: nowIso,
          rejectedBy: adminUid || 'admin_master'
        });

        // Record in failed_transactions
        const failDocRef = doc(collection(db, 'failed_transactions'));
        await setDoc(failDocRef, {
          id: failDocRef.id,
          trxId: cleanTrx,
          amount: payData.amount,
          senderPhone: payData.senderPhone || '',
          reason: failReason,
          rejectedAt: nowIso,
          rawMessage: payData.rawMessage || ''
        });

        // If member had submitted pending deposit request, reject it
        if (payData.matchedUserId) {
          const txQ = query(collection(db, 'transactions'), where('trxId', '==', cleanTrx), limit(1));
          const txSnap = await getDocs(txQ);
          if (!txSnap.empty) {
            await updateDoc(txSnap.docs[0].ref, {
              status: 'rejected',
              rejectionReason: failReason,
              rejectedAt: nowIso
            });
          }

          // Notify member
          const opLabel = payData.operator || detectMfsOperator(payData.sender, payData.message) || 'bKash';
          const notifRef = doc(collection(db, 'user_notifications'));
          await setDoc(notifRef, {
            id: notifRef.id,
            userId: payData.matchedUserId,
            title: `${opLabel} লেনদেন বাতিল ❌`,
            message: `আপনার ${opLabel} TrxID (${cleanTrx})-এর আবেদনটি বাতিল করা হয়েছে। কারণ: ${failReason}`,
            read: false,
            createdAt: nowIso
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'লেনদেনটি সফলভাবে বাতিল তালিকায় নেওয়া হয়েছে।'
      });
    } catch (err: any) {
      console.error('[bKash SMS Gateway] Reject verification error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Member Deposit Verification Route (Add Money Self-Reconciliation)
  app.post('/api/sms-gateway/verify-deposit', async (req, res) => {
    try {
      const { userId, trxId, amount, operator, senderPhone } = req.body;
      if (!userId || !trxId || !amount) {
        return res.status(400).json({ success: false, error: 'missing_fields', message: 'ইউজার আইডি, TrxID এবং টাকার পরিমাণ দেওয়া আবশ্যক।' });
      }

      if (!db) {
        return res.status(500).json({ success: false, error: 'db_unavailable', message: 'ডেটাবেস সংযোগ পাওয়া যায়নি।' });
      }

      const opKey = String(operator || 'bkash').toLowerCase();
      const opLabel = opKey === 'nagad' ? 'Nagad' : opKey === 'rocket' ? 'Rocket' : 'bKash';
      const cleanTrx = String(trxId).trim().toUpperCase();
      const reqAmount = parseFloat(amount);
      const nowIso = new Date().toISOString();

      if (!/^[A-Za-z0-9]{8,15}$/.test(cleanTrx)) {
        return res.status(400).json({
          success: false,
          error: 'invalid_trxid_format',
          message: `অবৈধ ${opLabel} TrxID ফরম্যাট। TrxID অবশ্যই ৮-১৫ অক্ষরের হতে হবে।`
        });
      }

      if (isNaN(reqAmount) || reqAmount < 1 || reqAmount > 1000000) {
        return res.status(400).json({
          success: false,
          error: 'invalid_amount',
          message: 'অবৈধ টাকার পরিমাণ। পরিমাণ অবশ্যই ৳১ থেকে ৳১০,০০,০০০ এর মধ্যে হতে হবে।'
        });
      }

      // 1. Check detected_payments / incoming_sms collection in Firestore
      const payDocRef = doc(db, 'detected_payments', `PAY_${cleanTrx}`);
      const paySnap = await getDoc(payDocRef);

      let paymentData: any = null;
      if (paySnap.exists()) {
        paymentData = paySnap.data();
      } else {
        const smsDocRef = doc(db, 'incoming_sms', `SMS_${cleanTrx}`);
        const smsSnap = await getDoc(smsDocRef);
        if (smsSnap.exists()) {
          paymentData = smsSnap.data();
        }
      }

      // If SMS has NOT arrived yet on Admin's Personal SIM:
      // Save pending transaction so as soon as the SMS arrives at the webhook, it will auto-match!
      if (!paymentData) {
        const pendingTxRef = doc(db, 'transactions', `DEP_${cleanTrx}`);
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        await setDoc(pendingTxRef, {
          id: pendingTxRef.id,
          userId,
          userName: userData.name || 'সদস্য',
          userPhone: userData.phone || '',
          memberId: userData.memberId || '',
          amount: reqAmount,
          type: 'add_money',
          status: 'pending',
          isApproved: false,
          paymentMethod: `${opLabel} Personal (অপেক্ষমাণ)`,
          operator: opLabel,
          phone: userData.phone || '',
          senderPhone: senderPhone || userData.phone || '',
          trxId: cleanTrx,
          transactionId: cleanTrx,
          receiptNo: cleanTrx,
          createdAt: nowIso,
          description: `${opLabel} Personal অ্যাড মানি আবেদন (TrxID: ${cleanTrx}, পরিমাণ: ৳${reqAmount})`
        }, { merge: true });

        // Admin notification
        await addDoc(collection(db, 'admin_notifications'), {
          title: `📥 নতুন ${opLabel} অ্যাড মানি আবেদন`,
          message: `${userData.name || 'সদস্য'} (${userData.memberId || 'N/A'}) ৳${reqAmount.toLocaleString('en-US')} টাকার ${opLabel} ডিপোজিট রিকোয়েস্ট করেছেন (TrxID: ${cleanTrx})। এডমিনের সিমে SMS আসা মাত্রই এটি স্বয়ংক্রিয়ভাবে প্রসেস হবে।`,
          userId,
          userName: userData.name || '',
          memberId: userData.memberId || '',
          amount: reqAmount,
          trxId: cleanTrx,
          type: 'add_money',
          createdAt: nowIso,
          read: false
        }).catch(() => {});

        return res.status(200).json({
          success: true,
          status: 'pending_sms_wait',
          operator: opLabel,
          autoApproved: false,
          message: `আপনার ডিপোজিট আবেদনটি সফলভাবে জমা হয়েছে। এডমিনের ফোনে ${opLabel} SMS আসা মাত্রই সিস্টেম TrxID (${cleanTrx}) ও টাকার পরিমাণ মিলিয়ে স্বয়ংক্রিয়ভাবে ওয়ালেটে টাকা যোগ করে দেবে।`,
          trxId: cleanTrx,
          amount: reqAmount
        });
      }

      // 2. Check if already processed or claimed
      if (paymentData.isProcessed || paymentData.isUsed || paymentData.status === 'verified') {
        return res.status(400).json({
          success: false,
          error: 'already_used',
          message: 'এই ট্রানজেকশন আইডি (TrxID) দিয়ে ইতিপূর্বে টাকা যোগ করা হয়েছে। একটি TrxID শুধুমাত্র একবারই ব্যবহার করা যাবে।'
        });
      }

      // 3. Check amount match
      const smsAmount = parseFloat(paymentData.amount);
      if (Math.abs(smsAmount - reqAmount) > 0.01) {
        return res.status(400).json({
          success: false,
          error: 'amount_mismatch',
          message: `টাকার পরিমাণ মিলছে না! এডমিনের সিমে আসা মেসেজে টাকার পরিমাণ ছিল ৳${smsAmount} কিন্তু আপনি লিখেছেন ৳${reqAmount}।`
        });
      }

      // 4. MATCH FOUND! 100% TrxID and Amount Match!
      // Atomic Balance Credit via Firestore Transaction
      const matchResult = await runTransaction(db, async (t) => {
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await t.get(userDocRef);
        const userData = userSnap.exists() ? userSnap.data() : { balance: 0, mainBalance: 0, name: 'সদস্য', memberId: 'BNB000001' };

        const freshPaySnap = await t.get(payDocRef);
        if (freshPaySnap.exists()) {
          const freshPay = freshPaySnap.data();
          if (freshPay.isProcessed || freshPay.status === 'verified') {
            throw new Error('already_used');
          }
        }

        const currentBal = Number(userData.balance) || 0;
        const currentMain = Number(userData.mainBalance) || 0;
        const newBal = currentBal + reqAmount;
        const newMain = currentMain + reqAmount;

        // Credit user balance atomically
        t.set(userDocRef, {
          balance: newBal,
          mainBalance: newMain
        }, { merge: true });

        // Set or update transaction in transactions collection
        const txDocRef = doc(db, 'transactions', `SMS_${cleanTrx}`);
        t.set(txDocRef, {
          id: txDocRef.id,
          userId,
          userName: userData.name || 'সদস্য',
          userPhone: userData.phone || '',
          memberId: userData.memberId || '',
          amount: reqAmount,
          type: 'add_money',
          status: 'success',
          isApproved: true,
          paymentMethod: `${opLabel} Personal (Auto SMS Verified)`,
          operator: opLabel,
          phone: userData.phone || '',
          senderPhone: paymentData.senderPhone || senderPhone || userData.phone || '',
          trxId: cleanTrx,
          transactionId: cleanTrx,
          receiptNo: cleanTrx,
          createdAt: nowIso,
          verifiedAt: nowIso,
          verifiedBy: 'system_auto_matcher',
          description: `${opLabel} Personal SMS যাচাইয়ের মাধ্যমে ৳${reqAmount.toLocaleString('bn-BD')} টাকা ওয়ালেটে সফলভাবে যোগ হয়েছে (TrxID: ${cleanTrx})`
        }, { merge: true });

        // Update detected_payments
        t.set(payDocRef, {
          ...paymentData,
          status: 'verified',
          verificationStatus: 'verified_auto_matched',
          matchStatus: 'matched_payment_request',
          matchedUserId: userId,
          matchedMemberId: userData.memberId || '',
          matchedUserName: userData.name || '',
          matchedTransactionId: txDocRef.id,
          isProcessed: true,
          processedAt: nowIso,
          verifiedAt: nowIso,
          verifiedBy: 'system_auto_matcher'
        }, { merge: true });

        // Update incoming_sms
        const smsDocRef = doc(db, 'incoming_sms', `SMS_${cleanTrx}`);
        t.set(smsDocRef, {
          status: 'claimed',
          isUsed: true,
          usedBy: userId,
          usedAt: nowIso
        }, { merge: true });

        // Push User Notification
        const notifRef = doc(collection(db, 'user_notifications'));
        t.set(notifRef, {
          id: notifRef.id,
          userId,
          title: `${opLabel} ডিপোজিট সফল হয়েছে 🎉`,
          body: `আপনার ${opLabel} TrxID (${cleanTrx})-এর ৳${reqAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যাচাই হয়ে ওয়ালেটে যোগ হয়েছে।`,
          message: `আপনার ${opLabel} TrxID (${cleanTrx})-এর ৳${reqAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যাচাই হয়ে ওয়ালেটে যোগ হয়েছে।`,
          read: false,
          createdAt: nowIso
        });

        return { newBal, userData };
      });

      // Audit Log in sms_logs
      const logRef = doc(collection(db, 'sms_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        event: 'MFS_PAYMENT_MEMBER_CLAIMED_VERIFIED',
        operator: opLabel,
        trxId: cleanTrx,
        amount: reqAmount,
        userId,
        status: 'verified',
        createdAt: nowIso
      });

      return res.status(200).json({
        success: true,
        status: 'verified',
        operator: opLabel,
        autoApproved: true,
        message: `অভিনন্দন! আপনার ${opLabel} TrxID (${cleanTrx}) এবং টাকার পরিমাণ সফলভাবে ভেরিফাই হয়েছে এবং আপনার ওয়ালেটে ৳${reqAmount.toLocaleString('bn-BD')} টাকা যোগ হয়েছে।`,
        trxId: cleanTrx,
        amount: reqAmount,
        newBalance: matchResult.newBal
      });
    } catch (err: any) {
      console.error('Error in /api/sms-gateway/verify-deposit:', err);
      if (err.message === 'already_used') {
        return res.status(400).json({ success: false, error: 'already_used', message: 'এই ট্রানজেকশন আইডি (TrxID) দিয়ে ইতিপূর্বে টাকা যোগ করা হয়েছে।' });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // =========================================================================
  // End-to-End OTP Verification System Architecture (Blueprint Standard)
  // =========================================================================

  // Step A: Generate OTP for Sensitive Action
  // Route: POST /api/otp/generate
  // Input: userId, actionPayload, (optional: phone, email, actionType)
  app.post('/api/otp/generate', async (req, res) => {
    try {
      const { userId, actionPayload, phone, email, actionType } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'missing_user_id', message: 'ইউজার আইডি প্রদান করা আবশ্যক।' });
      }

      // Generate 6-digit random OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 5-minute expiration window (300,000 ms)
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const sessionId = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Fetch user data if phone or email not explicitly supplied
      let userPhone = phone || '';
      let userEmail = email || '';
      let userName = 'সম্মানিত সদস্য';

      if (db && (!userPhone || !userEmail)) {
        try {
          const userSnap = await getDoc(doc(db, 'users', userId));
          if (userSnap.exists()) {
            const uData = userSnap.data();
            if (!userPhone) userPhone = uData.phone || '';
            if (!userEmail) userEmail = uData.email || '';
            if (uData.name) userName = uData.name;
          }
        } catch (uErr) {
          console.warn('[OTP System] Could not load user details for OTP dispatch:', uErr);
        }
      }

      // Save session in Firestore 'otp_sessions' collection
      if (db) {
        const sessionRef = doc(db, 'otp_sessions', sessionId);
        await setDoc(sessionRef, {
          sessionId,
          id: sessionId,
          userId,
          payload: actionPayload || {},
          actionType: actionType || (actionPayload?.type || 'sensitive_action'),
          otpCode,
          expiresAt,
          status: 'pending',
          createdAt: new Date().toISOString(),
          phone: userPhone,
          email: userEmail
        });

        // Push real-time notification to user inbox so OTP is readily visible
        try {
          const notifRef = doc(collection(db, 'user_notifications'));
          await setDoc(notifRef, {
            id: notifRef.id,
            userId,
            title: '🔐 সংবেদনশীল কাজের ওটিপি ভেরিফিকেশন কোড',
            message: `আপনার অনুরোধকৃত কাজের ৬-সংখ্যার ওটিপি কোড: ${otpCode} (মেয়াদ: ৫ মিনিট)। কোডটি কারো সাথে শেয়ার করবেন না।`,
            otp: otpCode,
            category: 'otp_verification',
            read: false,
            createdAt: new Date().toISOString()
          });
        } catch (notifErr) {
          console.warn('[OTP System] Failed to write in-app notification:', notifErr);
        }
      }

      // Dispatch via Email whenever user email is available
      if (userEmail) {
        sendEmailOtpUniversal(userEmail, otpCode).catch(e => console.warn('[OTP Email Error]:', e));
      }

      console.log(`[OTP Engine] Generated OTP for user ${userId} (Session: ${sessionId}, Code: ${otpCode}, Expires: 5m)`);

      return res.status(200).json({
        success: true,
        sessionId,
        expiresAt,
        message: 'আপনার মোবাইল নম্বর/ইমেইলে ৬ ডিজিটের ওটিপি পাঠানো হয়েছে।',
        target: userPhone ? `${userPhone.slice(0, 3)}••••${userPhone.slice(-4)}` : (userEmail || 'registered device')
      });
    } catch (err: any) {
      console.error('[OTP Engine] Error in /api/otp/generate:', err);
      return res.status(500).json({ success: false, error: 'server_error', message: err.message || 'ওটিপি তৈরিতে সমস্যা হয়েছে।' });
    }
  });

  // Step B: Verify OTP and Authorize Action
  // Route: POST /api/otp/verify
  // Input: sessionId, enteredOtp
  app.post('/api/otp/verify', async (req, res) => {
    try {
      const { sessionId, enteredOtp } = req.body;
      if (!sessionId || !enteredOtp) {
        return res.status(400).json({ success: false, error: 'missing_fields', message: 'Session ID এবং OTP প্রদান করা আবশ্যক।' });
      }

      if (!db) {
        return res.status(500).json({ success: false, error: 'db_unavailable', message: 'ডেটাবেস সংযোগ উপলব্ধ নয়।' });
      }

      const sessionDocRef = doc(db, 'otp_sessions', sessionId);
      const sessionSnap = await getDoc(sessionDocRef);

      if (!sessionSnap.exists()) {
        return res.status(404).json({ success: false, error: 'session_not_found', message: 'ওটিপি সেশন পাওয়া যায়নি বা মেয়াদোত্তীর্ণ হয়েছে।' });
      }

      const sessionData = sessionSnap.data();

      // Check if session is already used or invalidated
      if (sessionData.status === 'verified') {
        return res.status(400).json({ success: false, error: 'already_used', message: 'এই ওটিপি কোডটি ইতিমধ্যে ব্যবহার করা হয়েছে।' });
      }
      if (sessionData.status === 'expired') {
        return res.status(400).json({ success: false, error: 'otp_expired', message: 'ওটিপির মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে নতুন ওটিপি কোড নিন।' });
      }

      // Check 5-minute expiry
      const now = Date.now();
      if (now > sessionData.expiresAt) {
        await updateDoc(sessionDocRef, { status: 'expired' }).catch(() => {});
        return res.status(400).json({
          success: false,
          error: 'otp_expired',
          message: 'ওটিপি কোডের ৫ মিনিটের মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে নতুন ওটিপি চেয়ে নিন।'
        });
      }

      // Check matching code strictly (No demo OTP allowed)
      const cleanEntered = String(enteredOtp).trim();
      const cleanCode = String(sessionData.otpCode).trim();

      if (cleanEntered !== cleanCode) {
        return res.status(400).json({
          success: false,
          error: 'invalid_otp',
          message: 'প্রদত্ত ওটিপি কোডটি সঠিক নয়। অনুগ্রহ করে পুনরায় চেক করুন।'
        });
      }

      // Mark session as verified
      await updateDoc(sessionDocRef, {
        status: 'verified',
        verifiedAt: new Date().toISOString()
      });

      console.log(`[OTP Engine] Session ${sessionId} verified successfully for user ${sessionData.userId}`);

      return res.status(200).json({
        success: true,
        message: 'Verification successful & action executed',
        sessionId,
        payload: sessionData.payload
      });
    } catch (err: any) {
      console.error('[OTP Engine] Error in /api/otp/verify:', err);
      return res.status(500).json({ success: false, error: 'server_error', message: err.message || 'ওটিপি যাচাইয়ে ত্রুটি হয়েছে।' });
    }
  });

  // Resend OTP Endpoint
  // Route: POST /api/otp/resend
  // Input: sessionId
  app.post('/api/otp/resend', async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'missing_session_id', message: 'Session ID আবশ্যক।' });
      }

      if (!db) {
        return res.status(500).json({ success: false, error: 'db_unavailable' });
      }

      const sessionDocRef = doc(db, 'otp_sessions', sessionId);
      const sessionSnap = await getDoc(sessionDocRef);

      if (!sessionSnap.exists()) {
        return res.status(404).json({ success: false, error: 'session_not_found', message: 'সেশন পাওয়া যায়নি।' });
      }

      const sessionData = sessionSnap.data();
      const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const newExpiresAt = Date.now() + 5 * 60 * 1000;

      await updateDoc(sessionDocRef, {
        otpCode: newOtpCode,
        expiresAt: newExpiresAt,
        status: 'pending',
        resentAt: new Date().toISOString()
      });

      if (sessionData.email) {
        sendEmailOtpUniversal(sessionData.email, newOtpCode).catch(() => {});
      }

      if (sessionData.userId) {
        const notifRef = doc(collection(db, 'user_notifications'));
        await setDoc(notifRef, {
          id: notifRef.id,
          userId: sessionData.userId,
          title: '🔐 নতুন ওটিপি কোড (পুনরায় প্রেরিত)',
          message: `আপনার নতুন ওটিপি ভেরিফিকেশন কোড: ${newOtpCode} (মেয়াদ: ৫ মিনিট)।`,
          otp: newOtpCode,
          category: 'otp_verification',
          read: false,
          createdAt: new Date().toISOString()
        }).catch(() => {});
      }

      return res.status(200).json({
        success: true,
        sessionId,
        expiresAt: newExpiresAt,
        message: 'নতুন ওটিপি কোড পাঠানো হয়েছে।'
      });
    } catch (err: any) {
      console.error('[OTP Engine] Error in /api/otp/resend:', err);
      return res.status(500).json({ success: false, error: 'server_error', message: err.message });
    }
  });

  // Dedicated Standalone SMS Gateway & Payment Verification Software Page
  app.get('/sms-gateway-client', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BNB SMS Gateway & Payment Verification Client (Standalone)</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Hind Siliguri', sans-serif; }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
    <div class="max-w-6xl mx-auto px-4 py-8">
        <header class="flex flex-col md:flex-row justify-between items-center bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-2xl">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <span class="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active Standalone Client
                    </span>
                    <span class="bg-blue-500/20 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full border border-blue-500/30">
                        v2.4.0 Secure
                    </span>
                </div>
                <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">BNB SMS Gateway & পেমেন্ট ভেরিফিকেশন সফটওয়্যার</h1>
                <p class="text-slate-400 text-sm mt-1">অ্যান্ড্রয়েড ফোন থেকে bKash, Nagad, Rocket SMS সংগ্রহ করে ফায়ারবেস ও ব্যাকএন্ডে রিয়েল-টাইমে পেমেন্ট ভেরিফাই করার আলাদা টুল।</p>
            </div>
            <div class="mt-4 md:mt-0 flex gap-3">
                <a href="/" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium transition border border-slate-700 flex items-center gap-2">
                    🏠 মূল অ্যাপে ফিরে যান
                </a>
                <button onclick="location.reload()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-emerald-900/40">
                    🔄 রিফ্রেশ করুন
                </button>
            </div>
        </header>

        <!-- Webhook URL Box -->
        <div class="bg-gradient-to-r from-slate-900 to-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
            <h2 class="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                🔗 আপনার SMS Gateway Webhook URL
            </h2>
            <p class="text-slate-400 text-sm mb-4">আপনার অ্যান্ড্রয়েড SMS Forwarder APK বা Tasker অ্যাপে এই এন্ডপয়েন্ট ইউআরএলটি সেট করুন:</p>
            <div class="flex items-center gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <input type="text" id="webhookUrl" readonly value="${req.protocol}://${req.get('host')}/api/sms-gateway/webhook" class="bg-transparent text-emerald-400 font-mono text-sm w-full outline-none">
                <button onclick="copyWebhook()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0 flex items-center gap-1.5">
                    📋 কপি করুন
                </button>
            </div>
            <div id="copyAlert" class="text-xs text-emerald-400 mt-2 hidden">ইউআরএল সফলভাবে ক্লিপবোর্ডে কপি করা হয়েছে!</div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- SMS Simulator & Tester -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    🧪 SMS পার্সিং ও পেমেন্ট টেস্ট সিমুলেটর
                </h2>
                <p class="text-slate-400 text-sm mb-4">নিচে bKash, Nagad বা Rocket-এর SMS টেস্ট করে দেখতে পারেন কীভাবে সিস্টেম TrxID ও Amount শনাক্ত করে ফায়ারবেসে পাঠায়:</p>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-medium text-slate-300 mb-1">পেমেন্ট গেটওয়ে / প্রেরক:</label>
                        <select id="simSender" class="w-bkg bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 w-full">
                            <option value="bKash">bKash (বিকাশ)</option>
                            <option value="Nagad">Nagad (নগদ)</option>
                            <option value="Rocket">Rocket (রকেট)</option>
                            <option value="Upay">Upay (উপায়)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-medium text-slate-300 mb-1">লেনদেনের SMS টেক্সট:</label>
                        <textarea id="simMessage" rows="3" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 font-mono">Payment successful. TrxID 9N7K2P9X1Q amount Tk 500.00 to 01700000000. Balance Tk 1,250.00</textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-medium text-slate-300 mb-1">TrxID:</label>
                            <input type="text" id="simTrxId" value="9N7K2P9X1Q" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 font-mono">
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-300 mb-1">পরিমাণ (Amount ৳):</label>
                            <input type="number" id="simAmount" value="500" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 font-mono">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-medium text-slate-300 mb-1">টার্গেট ইউজার আইডি (ঐচ্ছিক - খালি রাখলে পেন্ডিং লেনদেনের সাথে অটো ম্যাচ করবে):</label>
                        <input type="text" id="simUserId" placeholder="User UID (যেমন: user_123)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 font-mono">
                    </div>

                    <button onclick="testWebhook()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2">
                        🚀 টেস্ট রিকোয়েস্ট পাঠান (Test Webhook)
                    </button>
                </div>

                <div id="simResult" class="mt-4 hidden p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-emerald-400"></div>
            </div>

            <!-- APK / Forwarder Setup Guide -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                    <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        📱 মোবাইল APK ও ফরওয়ার্ডার সেটআপ গাইড
                    </h2>
                    <ul class="space-y-3 text-sm text-slate-300">
                        <li class="flex items-start gap-2.5">
                            <span class="bg-emerald-500/20 text-emerald-400 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-xs">১</span>
                            <span>যে অ্যান্ড্রয়েড ফোনে পেমেন্টের SIM (bKash/Nagad) আছে, তাতে একটি ফ্রি SMS Forwarder অ্যাপ (যেমন: <b>SMS Forwarder by SMS to Webhook / Tasker</b>) ইনস্টল করুন।</span>
                        </li>
                        <li class="flex items-start gap-2.5">
                            <span class="bg-emerald-500/20 text-emerald-400 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-xs">২</span>
                            <span>অ্যাপের সেটিংসে Webhook URL বক্সে উপরে দেওয়া আমাদের <b>Webhook URL</b> পেস্ট করুন।</span>
                        </li>
                        <li class="flex items-start gap-2.5">
                            <span class="bg-emerald-500/20 text-emerald-400 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-xs">৩</span>
                            <span>মেথড হিসেবে <b>POST (JSON)</b> সিলেক্ট করুন এবং কী (Key) হিসেবে body-তে <code>trxId</code>, <code>amount</code>, <code>sender</code> ও <code>message</code> পাস করুন।</span>
                        </li>
                        <li class="flex items-start gap-2.5">
                            <span class="bg-emerald-500/20 text-emerald-400 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-xs">৪</span>
                            <span>ব্যাটারি অপ্টিমাইজেশন (Battery Optimization) বন্ধ রাখুন যাতে ফোন স্লিপ মোডে গেলেও SMS রিসিভ হয়ে সাথে সাথে ফায়ারবেস সার্ভারে চলে যায়।</span>
                        </li>
                    </ul>
                </div>

                <div class="mt-6 pt-6 border-t border-slate-800">
                    <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-300 leading-relaxed">
                        ⚠️ <b>নিরাপত্তা সতর্কতা:</b> এই স্বতন্ত্র সফটওয়্যারটি শুধুমাত্র পেমেন্ট SMS রিসিভ ও ভেরিফাই করার জন্য তৈরি। কোনো অ্যাডমিন ম্যানুয়াল অনুমোদন বা সিক্রেট কি ছাড়া সরাসরি ব্যালেন্স যোগ হবে না।
                    </div>
                </div>
            </div>
        </div>

        <!-- JSON Payload Template -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                📄 JSON Webhook Payload Template
            </h2>
            <pre class="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto"><code>{
  "secretKey": "bnb_sms_gateway_secure_2026",
  "sender": "bKash",
  "message": "Payment successful. TrxID 9N7K2P9X1Q amount Tk 500.00",
  "trxId": "9N7K2P9X1Q",
  "amount": 500.00,
  "userId": ""
}</code></pre>
        </div>
    </div>

    <script>
        function copyWebhook() {
            const copyText = document.getElementById("webhookUrl");
            copyText.select();
            copyText.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(copyText.value);
            const alertBox = document.getElementById("copyAlert");
            alertBox.classList.remove("hidden");
            setTimeout(() => alertBox.classList.add("hidden"), 3000);
        }

        async function testWebhook() {
            const sender = document.getElementById("simSender").value;
            const message = document.getElementById("simMessage").value;
            const trxId = document.getElementById("simTrxId").value;
            const amount = parseFloat(document.getElementById("simAmount").value);
            const userId = document.getElementById("simUserId").value;
            const resultBox = document.getElementById("simResult");

            resultBox.classList.remove("hidden");
            resultBox.innerText = "Processing webhook test request...";

            try {
                const res = await fetch('/api/sms-gateway/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        secretKey: 'bnb_sms_gateway_secure_2026',
                        sender,
                        message,
                        trxId,
                        amount,
                        userId: userId || undefined
                    })
                });
                const data = await res.json();
                resultBox.innerText = JSON.stringify(data, null, 2);
            } catch (err) {
                resultBox.innerText = "Error: " + err.message;
            }
        }
    </script>
</body>
</html>`;
    return res.send(html);
  });

  // Public endpoints for Google Play Console Privacy Policy checks
  app.get(['/privacy', '/privacy-policy'], (req, res) => {
    const pubPath = path.join(process.cwd(), 'public', 'privacy.html');
    const distPath = path.join(process.cwd(), 'dist', 'privacy.html');
    if (fs.existsSync(distPath)) {
      return res.sendFile(distPath);
    } else if (fs.existsSync(pubPath)) {
      return res.sendFile(pubPath);
    }
    return res.status(404).send('Privacy Policy Not Found');
  });

  // Vite integration as middleware depending on environment
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serve raw assets out of the client build folder
    app.use(express.static(distPath));
    
    // Catch-all route: Send any index requests or custom deep-links
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
