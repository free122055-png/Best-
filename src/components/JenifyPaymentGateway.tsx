import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ShieldCheck, AlertCircle, RefreshCw, ExternalLink, ArrowLeft, Loader2, Check, Smartphone, Lock } from 'lucide-react';
import { apiUrl, getReturnOrigin } from '../config/api';
import { useBackHandler } from '../lib/navigationManager';
import UnifiedBackButton from './UnifiedBackButton';
import { Browser } from '@capacitor/browser';

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

  // Silent background status checker (No manual verify button needed!)
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

      const data = await res.json();

      if (data && data.success && data.status === 'completed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        const confirmedAmount = Number(data.amount || activeInvoice.amount);
        const newBal = Number(data.newBalance || 0);
        const trxId = data.trxId || activeInvoice.invoice_id || `ZP_${Date.now()}`;

        setSuccessDetails({
          amount: confirmedAmount,
          newBalance: newBal,
          trxId
        });
        setStep('success');

        // Update local cache and fire notification events
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
      }
    } catch (err: any) {
      // Silent error during polling
    }
  };

  // Start silent background verification when redirecting
  useEffect(() => {
    if (step === 'redirecting' && activeInvoice) {
      // Silent poll every 2.5 seconds in background
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

  // Handle Initiate Payment: User selects amount -> Direct to ZiniPay Gateway
  const handleProceedToPayment = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 10) {
      setErrorMsg('সর্বনিম্ন জমার পরিমাণ ১০ টাকা।');
      return;
    }

    setErrorMsg('');
    setLocalLoading(true);

    const targetUserId = currentUser?.uid || localStorage.getItem('amb_user_uid') || '';
    const targetPhone = currentUser?.phone || localStorage.getItem('amb_user_phone') || '';

    try {
      const res = await fetch(apiUrl('/api/payment/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          userId: targetUserId,
          phone: targetPhone,
          origin: getReturnOrigin()
        })
      });

      const data = await res.json();
      if (data && data.success && data.payment_url) {
        const inv = {
          val_id: data.val_id || '',
          invoice_id: data.invoice_id || data.val_id || '',
          amount: numAmount,
          payment_url: data.payment_url
        };
        setActiveInvoice(inv);
        setStep('redirecting');

        // Save last invoice for silent recovery
        try {
          localStorage.setItem('amb_pending_zinipay_invoice', JSON.stringify(inv));
        } catch (e) {}

        // Directly navigate the user to ZiniPay checkout page
        const isCapacitorNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());

        if (isCapacitorNative) {
          try {
            await Browser.open({ url: data.payment_url, presentationStyle: 'fullscreen' });

            // Listen for when user completes or closes the browser
            try {
              Browser.addListener('browserFinished', () => {
                // Instantly check status silently in background and return to dashboard
                checkPaymentStatusSilently().finally(() => {
                  setTimeout(() => {
                    handleReturnToDashboard();
                  }, 400);
                });
              });
            } catch (e) {}
          } catch (browserErr) {
            console.warn('Browser.open failed, fallback to location:', browserErr);
            window.location.href = data.payment_url;
          }
        } else {
          try {
            window.location.href = data.payment_url;
          } catch (navErr) {
            console.warn('Direct navigation failed, attempting window.open:', navErr);
            window.open(data.payment_url, '_self');
          }
        }
      } else {
        setErrorMsg(data.error || 'পেমেন্ট গেটওয়ে সক্রিয় করতে ব্যর্থ হয়েছে। দয়া করে কিছুক্ষণ পর চেষ্টা করুন।');
        setLocalLoading(false);
      }
    } catch (err: any) {
      setErrorMsg('সার্ভার সংযোগে সমস্যা হয়েছে। ইন্টারনেট চেক করে পুনরায় চেষ্টা করুন।');
      setLocalLoading(false);
    }
  };

  const isLoading = parentLoading || localLoading;

  return (
    <div className="max-w-md mx-auto bg-white min-h-[420px] flex flex-col font-sans text-left">
      {/* 1. Header Banner */}
      <div className="bg-[#1e293b] text-white p-5 pb-8 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="flex items-center justify-between mb-3">
          <UnifiedBackButton
            onClick={handleReturnToDashboard}
            variant="glass"
            label="ড্যাশবোর্ড"
            title="ড্যাশবোর্ডে ফিরে যান"
          />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1.5 shadow-sm"> 
               <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-base sm:text-lg font-black tracking-tight">BNB <span className="text-emerald-400">অটো পেমেন্ট</span></span>
          </div>

          <div className="w-8" />
        </div>

        <div className="text-center mt-1"> 
           <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1">
             <ShieldCheck className="w-3.5 h-3.5" /> ১০০% সুরক্ষিত অটোমেটিক গেটওয়ে
           </p>
           <h2 className="text-xl sm:text-2xl font-black mt-1">
             {step === 'input' && 'মেইন ব্যালেন্সে টাকা জমা'}
             {step === 'redirecting' && 'পেমেন্ট গেটওয়েতে পাঠানো হচ্ছে...'}
             {step === 'success' && 'পেমেন্ট সফল হয়েছে!'}
           </h2>
        </div>
      </div>

      {/* 2. Content Body */}
      <div className="flex-1 -mt-4 px-4 sm:px-5 pb-8">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-5 sm:p-6 space-y-5">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Amount Selection & Direct Submit */}
          {step === 'input' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">জমার পরিমাণ (টাকা)</label>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    সর্বনিম্ন ১০ টাকা
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="0.00"
                    autoFocus
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-2xl sm:text-3xl font-black text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-center"
                  />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">৳</div>
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setAmount(amt.toString());
                      setErrorMsg('');
                    }}
                    className={`py-2 rounded-xl border-2 text-xs font-black transition-all cursor-pointer ${
                      amount === amt.toString() 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 scale-105 shadow-xs' 
                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200 active:scale-95'
                    }`}
                  >
                    ৳{amt.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Supported Payment Channels */}
              <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-bold">
                <span className="text-slate-400">সমর্থিত চ্যানেল:</span>
                <div className="flex items-center gap-1.5 font-black text-slate-800">
                  <span className="px-2 py-0.5 bg-pink-50 text-pink-700 rounded-md border border-pink-100">bKash</span>
                  <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-md border border-orange-100">Nagad</span>
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md border border-purple-100">Rocket</span>
                </div>
              </div>

              {/* Submit Button: Directly opens ZiniPay */}
              <button
                type="button"
                disabled={!amount || Number(amount) < 10 || isLoading}
                onClick={handleProceedToPayment}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>জেনিফাই গেটওয়ে প্রস্তুত হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <span>পেমেন্ট গেটওয়েতে এগিয়ে যান</span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: Redirecting / Seamless Handshake */}
          {step === 'redirecting' && activeInvoice && (
            <div className="space-y-5 text-center py-4">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full inline-block">
                  অটোমেটিক রিডাইরেক্ট
                </span>
                <h3 className="text-lg font-black text-slate-800">
                  ৳{activeInvoice.amount.toLocaleString()} টাকা জমার গেটওয়ে লোড হচ্ছে
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                  জেনিফাই পেমেন্ট পেজে সরাসরি নিয়ে যাওয়া হচ্ছে। সেখানে পেমেন্ট সম্পন্ন হলে ব্যালেন্স স্বয়ংক্রিয়ভাবে যোগ হবে।
                </p>
              </div>

              {/* Direct fallback link in case browser blocked auto-navigation */}
              <div className="pt-2 space-y-2">
                <a
                  href={activeInvoice.payment_url}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>যদি সরাসরি না যায়, এখানে ক্লিক করুন</span>
                </a>

                <button
                  type="button"
                  onClick={handleReturnToDashboard}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer"
                >
                  বাতিল করে ড্যাশবোর্ডে ফিরে যান
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Payment Success Celebration */}
          {step === 'success' && successDetails && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="space-y-5 text-center py-3"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-md">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-0.5 rounded-full inline-block">
                  পেমেন্ট শতভাগ সম্পন্ন
                </span>
                <h3 className="text-xl font-black text-slate-800">
                  আলহামদুলিল্লাহ! টাকা জমা হয়েছে
                </h3>
                <p className="text-xs text-slate-500">
                  আপনার মেইন ব্যালেন্সে টাকা সফলভাবে যোগ করা হয়েছে।
                </p>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2.5 text-left">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-emerald-900 font-bold">জমার পরিমাণ:</span>
                  <span className="font-mono font-black text-emerald-700 text-base">
                    ৳{successDetails.amount.toLocaleString()}
                  </span>
                </div>
                {successDetails.newBalance > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-emerald-900 font-bold">বর্তমান মেইন ব্যালেন্স:</span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      ৳{successDetails.newBalance.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs pt-2 border-t border-emerald-200">
                  <span className="text-emerald-800 font-bold">TrxID:</span>
                  <span className="font-mono font-bold text-slate-800 text-[11px]">
                    {successDetails.trxId}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReturnToDashboard}
                className="w-full bg-[#1e293b] hover:bg-[#0f172a] text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
              >
                <span>ড্যাশবোর্ডে ফিরে যান</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
};
export default JenifyPaymentGateway;
