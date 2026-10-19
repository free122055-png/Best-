import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ShieldCheck, AlertCircle, RefreshCw, ExternalLink, ArrowLeft, Loader2, Check, Smartphone, Lock } from 'lucide-react';
import { apiUrl, getReturnOrigin } from '../config/api';
import { useBackHandler } from '../lib/navigationManager';
import UnifiedBackButton from './UnifiedBackButton';
import { Browser } from '@capacitor/browser';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc, runTransaction } from 'firebase/firestore';

export interface JenifyPaymentGatewayProps {
  onConfirm?: (amount: number, method: string) => void;
  onBack?: () => void;
  isLoading?: boolean;
  currentUser?: any;
  onPaymentSuccess?: (amount: number, newBalance: number, trxId: string) => void;
}

export const JenifyPaymentGateway: React.FC<JenifyPaymentGatewayProps> = ({ 
  onConfirm, 
  onBack, 
  isLoading: parentLoading,
  currentUser,
  onPaymentSuccess
}) => {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'input' | 'redirecting' | 'success'>('input');
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeInvoice, setActiveInvoice] = useState<{
    val_id: string;
    invoice_id: string;
    amount: number;
    payment_url: string;
  } | null>(null);
  const [successDetails, setSuccessDetails] = useState<{
    amount: number;
    newBalance: number;
    trxId: string;
  } | null>(null);

  const quickAmounts = [50, 100, 200, 500, 1000, 2000, 5000];
  const pollIntervalRef = useRef<any>(null);

  // Return to Dashboard cleanly on Back button or hardware/gesture back
  const handleReturnToDashboard = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setStep('input');
    setActiveInvoice(null);
    if (onBack) {
      onBack();
    }
  };

  // Hardware / System back gesture handler: Returns cleanly to Dashboard without exiting app
  useBackHandler(() => {
    handleReturnToDashboard();
    return true;
  }, true, 35);

  // Silent background status checker via server API only
  const checkPaymentStatusSilently = async () => {
    if (!activeInvoice) return;

    const targetUserId = currentUser?.uid || localStorage.getItem('amb_user_uid') || '';

    try {
      const res = await fetch(apiUrl('/api/payment/check-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          val_id: activeInvoice.val_id,
          invoice_id: activeInvoice.invoice_id,
          userId: targetUserId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.status === 'completed') {
          const confirmedAmount = Number(data.amount || activeInvoice.amount);
          const newBal = Number(data.newBalance || 0);
          const trxId = data.trxId || activeInvoice.invoice_id || `ZP_${Date.now()}`;

          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          setSuccessDetails({
            amount: confirmedAmount,
            newBalance: newBal,
            trxId
          });
          setStep('success');

          try {
            if (typeof window !== 'undefined') {
              const cur = Number(localStorage.getItem('amb_user_balance') || '0');
              const updated = cur + confirmedAmount;
              localStorage.setItem('amb_user_balance', String(newBal || updated));
              window.dispatchEvent(new CustomEvent('amb_admin_sync_tick', { detail: { time: Date.now() } }));
              window.dispatchEvent(new CustomEvent('bnb_balance_updated', { detail: { amount: confirmedAmount, newBalance: newBal } }));
            }
          } catch (e) {}

          if (onPaymentSuccess) {
            onPaymentSuccess(confirmedAmount, newBal, trxId);
          }
          return;
        }
      }
    } catch (err: any) {
      // Background polling silent catch
    }
  };

  // On mount: Check for recently saved pending invoice and verify status immediately
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem('amb_pending_zinipay_invoice');
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed && (parsed.invoice_id || parsed.val_id)) {
          setActiveInvoice(parsed);
          const targetUid = currentUser?.uid || localStorage.getItem('amb_user_uid') || '';
          fetch(apiUrl('/api/payment/check-status'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              val_id: parsed.val_id,
              invoice_id: parsed.invoice_id,
              userId: targetUid
            })
          }).then(r => r.json()).then(data => {
            if (data && (data.status === 'completed' || data.success)) {
              localStorage.removeItem('amb_pending_zinipay_invoice');
              const confirmedAmount = Number(data.amount || parsed.amount);
              const newBal = Number(data.newBalance || 0);
              const trxId = data.trxId || parsed.invoice_id;
              setSuccessDetails({
                amount: confirmedAmount,
                newBalance: newBal,
                trxId
              });
              setStep('success');
              if (onPaymentSuccess) {
                onPaymentSuccess(confirmedAmount, newBal, trxId);
              }
            }
          }).catch(() => {});
        }
      }
    } catch (e) {}
  }, [currentUser?.uid, onPaymentSuccess]);

  // Start silent background verification when redirecting
  useEffect(() => {
    if (step === 'redirecting' && activeInvoice) {
      pollIntervalRef.current = setInterval(() => {
        checkPaymentStatusSilently();
      }, 2500);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }
  }, [step, activeInvoice]);

  // Handle Initiate Payment: User selects amount -> Secure server API call
  const handleProceedToPayment = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 10) {
      setErrorMsg('সর্বনিম্ন জমার পরিমাণ ১০ টাকা।');
      return;
    }

    if (numAmount > 100000) {
      setErrorMsg('সর্বোচ্চ জমার পরিমাণ ১০০,০০০ টাকা।');
      return;
    }

    const targetUserId = currentUser?.uid || localStorage.getItem('amb_user_uid') || '';
    if (!targetUserId) {
      setErrorMsg('ব্যবহারকারী শনাক্ত করা যায়নি। দয়া করে পুনরায় লগইন করুন।');
      return;
    }

    const targetPhone = currentUser?.phone || localStorage.getItem('amb_user_phone') || '';

    setErrorMsg('');
    setLocalLoading(true);

    try {
      const currentUserObj = auth.currentUser;
      const idToken = currentUserObj ? await currentUserObj.getIdToken() : '';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(apiUrl('/api/payment/create'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        signal: controller.signal,
        body: JSON.stringify({
          amount: numAmount,
          userId: targetUserId,
          phone: targetPhone
        })
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'পেমেন্ট তৈরি করতে ব্যর্থ হয়েছে।');
      }

      const data = await res.json();
      if (data && data.success && data.payment_url) {
        const activeInv = {
          invoice_id: data.invoice_id,
          val_id: data.val_id || data.invoice_id,
          amount: numAmount,
          payment_url: data.payment_url
        };
        setActiveInvoice(activeInv);
        try {
          localStorage.setItem('amb_pending_zinipay_invoice', JSON.stringify(activeInv));
        } catch (e) {}

        setStep('redirecting');
        setTimeout(() => {
          window.location.href = data.payment_url;
        }, 500);
      } else {
        setErrorMsg('পেমেন্ট গেটওয়ে থেকে সঠিক লিংক পাওয়া যায়নি।');
      }
    } catch (serverErr: any) {
      if (serverErr.name === 'AbortError') {
        setErrorMsg('সার্ভার থেকে কোনো সাড়া পাওয়া যায়নি। দয়া করে আবার চেষ্টা করুন।');
      } else if (!navigator.onLine) {
        setErrorMsg('নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। দয়া করে ইন্টারনেট সংযোগ চেক করুন।');
      } else {
        setErrorMsg(serverErr.message || 'পেমেন্ট ব্যর্থ হয়েছে। দয়া করে সঠিক তথ্য দিয়ে আবার চেষ্টা করুন।');
      }
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <UnifiedBackButton onClick={handleReturnToDashboard} label="ফিরে যান" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">অনলাইন পেমেন্ট গেটওয়ে (ZiniPay)</h2>
      </div>

      {step === 'input' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-6 h-6 shrink-0" />
            <p className="text-sm">আপনার অ্যাকাউন্টে তাৎক্ষণিকভাবে ব্যালেন্স যোগ করতে নিরাপদ অনলাইন পেমেন্ট ব্যবহার করুন।</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              জমার পরিমাণ (টাকা)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-lg font-bold text-slate-400">৳</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="যেমন: ৫০০"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">দ্রুত পরিমাণ নির্বাচন:</p>
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/50 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 transition"
                >
                  ৳{q}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={handleProceedToPayment}
            disabled={localLoading || !amount}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-base shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
          >
            {localLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>প্রসেস হচ্ছে...</span>
              </>
            ) : (
              <>
                <span>পেমেন্ট গেটওয়েতে এগিয়ে যান</span>
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}

      {step === 'redirecting' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center border border-slate-100 dark:border-slate-800">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">পেমেন্ট পেজে রিডাইরেক্ট করা হচ্ছে...</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">আপনার পেমেন্ট যাচাই করা হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন...</p>
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-800 dark:text-amber-300 text-sm mb-6">
            পেমেন্ট সম্পন্ন হওয়ার পর স্বয়ংক্রিয়ভাবে অ্যাপে ফিরে আসবেন।
          </div>
          <button
            onClick={() => {
              if (activeInvoice?.payment_url) {
                window.location.href = activeInvoice.payment_url;
              }
            }}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow hover:bg-slate-800 transition"
          >
            ম্যানুয়ালি লিংকে যান
          </button>
        </div>
      )}

      {step === 'success' && successDetails && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center border border-slate-100 dark:border-slate-800">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">পেমেন্ট সফল হয়েছে!</h3>
          <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg mb-6">৳{successDetails.amount.toLocaleString('en-BD')} টাকা জমা হয়েছে</p>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-left mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">নতুন ব্যালেন্স:</span>
              <span className="font-bold text-slate-900 dark:text-white">৳{successDetails.newBalance.toLocaleString('en-BD')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ট্রানজেকশন আইডি:</span>
              <span className="font-mono text-slate-900 dark:text-white">{successDetails.trxId}</span>
            </div>
          </div>
          <button
            onClick={handleReturnToDashboard}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-base shadow-lg transition"
          >
            ড্যাশবোর্ডে ফিরে যান
          </button>
        </div>
      )}
    </div>
  );
};
