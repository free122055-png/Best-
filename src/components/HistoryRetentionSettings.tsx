import React, { useState } from 'react';
import { AppConfig } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { executeHistoryRetentionCleanup, RetentionCleanupResult, HISTORY_COLLECTIONS } from '../lib/retentionCleanup';
import { Calendar, Trash2, RefreshCw, CheckCircle2, ShieldAlert, Clock, Database, Layers, Sparkles } from 'lucide-react';

interface HistoryRetentionSettingsProps {
  appConfig: AppConfig;
  onChangeConfig: (newConfig: AppConfig) => void;
  className?: string;
}

const RETENTION_OPTIONS = [
  { days: 30, label: '1 মাস (30 দিন)', badge: 'সংক্ষিপ্ত মেয়াদ', desc: 'ডাটাবেস লাইট ও ফাস্ট রাখতে 30 দিনের বেশি পুরনো সব রেকর্ড অটো মুছে যাবে।' },
  { days: 90, label: '3 মাস (90 দিন)', badge: 'কোয়ার্টারলি', desc: 'সর্বশেষ 3 মাসের লেনদেন ও নোটিফিকেশন জমা থাকবে।' },
  { days: 180, label: '6 মাস (180 দিন)', badge: 'হাফ-ইয়ারলি', desc: '6 মাসের পুরনো হিস্ট্রি অটোমেটিক ক্লিন করা হবে।' },
  { days: 365, label: '1 বছর (365 দিন)', badge: 'ডিফোল্ট (পরামর্শকৃত)', desc: '1 বছরের ব্যাকআপ ডাটা সংরক্ষণে রেখে এর আগের পুরনো ডাটা সংকুচিত হবে।' },
  { days: 730, label: '2 বছর (730 দিন)', badge: 'দীর্ঘমেয়াদী', desc: '2 বছর পর্যন্ত সমস্ত অডিট ও লেনদেন হিস্ট্রি সুরক্ষিত থাকবে।' },
  { days: 1825, label: '5 বছর (1825 দিন)', badge: 'মাস্টার আর্কাইভ', desc: '5 বছর মেয়াদে ডাটা আর্কাইভ করে রাখা হবে।' },
];

export const HistoryRetentionSettings: React.FC<HistoryRetentionSettingsProps> = ({
  appConfig,
  onChangeConfig,
  className = ''
}) => {
  const currentDays = appConfig?.historyRetentionDays ?? 365;
  const [selectedDays, setSelectedDays] = useState<number>(currentDays);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RetentionCleanupResult | null>(() => {
    try {
      const raw = localStorage.getItem('amb_last_retention_cleanup');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Calculate cutoff date string for display
  const cutoffDate = new Date(Date.now() - selectedDays * 24 * 60 * 60 * 1000);
  const cutoffDateFormatted = cutoffDate.toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handleSaveRetentionPolicy = async (daysToSave: number) => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      const updated = { ...appConfig, historyRetentionDays: daysToSave };
      await setDoc(configRef, updated, { merge: true });
      onChangeConfig(updated);
      setSelectedDays(daysToSave);

      // Trigger automatic cleanup immediately upon retention policy update
      setCleaning(true);
      const res = await executeHistoryRetentionCleanup(daysToSave);
      setLastResult(res);
      setCleaning(false);

      setSuccessMsg(`হিস্ট্রি সংরক্ষণ মেয়াদ সফলভাবে ${daysToSave} দিনে (${RETENTION_OPTIONS.find(o => o.days === daysToSave)?.label}) সেট করা হয়েছে! মেয়াদোত্তীর্ণ ${res.totalDeleted} টি রেকর্ড ডাটাবেস থেকে অটোমেটিক ওয়াশ করা হয়েছে।`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('কনফিগারেশন আপডেট করতে সমস্যা হয়েছেঃ ' + err.message);
    } finally {
      setSaving(false);
      setCleaning(false);
    }
  };

  const handleManualCleanupNow = async () => {
    setCleaning(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await executeHistoryRetentionCleanup(selectedDays);
      setLastResult(res);
      setSuccessMsg(`হিস্ট্রি ওয়াশ সম্পন্ন হয়েছে! মোট ${res.totalDeleted} টি মেয়াদোত্তীর্ণ পুরনো হিস্ট্রি রেকর্ড ডাটাবেস থেকে মুছে ফেলা হয়েছে।`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('হিস্ট্রি ওয়াশ করতে সমস্যা হয়েছেঃ ' + err.message);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-2xl space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>অটোমেটিক ডাটা রিটেনশন ও লাইফসাইকেল কন্ট্রোল</span>
          </div>
          <h3 className="text-lg font-black text-white flex items-center gap-2 font-sans">
            ⚙️ হিস্ট্রি ও লগ ডাটা সংরক্ষণের মেয়াদ (Configurable History Retention Period)
          </h3>
          <p className="text-xs text-slate-400 font-sans leading-relaxed max-w-2xl">
            লেনদেন, নোটিফিকেশন ও অ্যাক্টিভিটি হিস্ট্রি কতদিন পর্যন্ত ডাটাবেসে সংরক্ষিত থাকবে তা এডমিন থেকে নির্ধারণ করুন। নির্ধারিত সময়ের চেয়ে পুরনো সকল তথ্য ফায়ারবেস থেকে স্বয়ংক্রিয়ভাবে মুছে যাবে।
          </p>
        </div>

        {/* Manual Flush Button */}
        <button
          type="button"
          onClick={handleManualCleanupNow}
          disabled={cleaning || saving}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white font-bold text-xs rounded-2xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer shrink-0 border border-rose-400/30 active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${cleaning ? 'animate-spin' : ''}`} />
          <span>{cleaning ? 'হিস্ট্রি ওয়াশ হচ্ছে...' : '🧹 এখনই হিস্ট্রি ওয়াশ করুন'}</span>
        </button>
      </div>

      {/* Current Policy Banner */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-sans">বর্তমান মেয়াদ নীতিঃ</span>
              <span className="text-xs font-black text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-700/50 px-2.5 py-0.5 rounded-md">
                {currentDays} দিন ({RETENTION_OPTIONS.find(o => o.days === currentDays)?.label || `${currentDays} দিন`})
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-sans mt-0.5">
              আজকের দিন থেকে <strong className="text-amber-300 font-bold">{cutoffDateFormatted}</strong> এর পূর্বের সমস্ত পুরনো হিস্ট্রি ওয়াশ হবে।
            </p>
          </div>
        </div>

        {lastResult && (
          <div className="text-right text-[11px] font-sans text-slate-400 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 shrink-0">
            <span className="block text-slate-500 text-[10px] uppercase tracking-wider">সর্বশেষ ওয়াশ রান</span>
            <span className="text-emerald-400 font-bold font-mono">{lastResult.totalDeleted} টি সংকুচিত</span>
            <span className="block text-[10px] text-slate-400">{new Date(lastResult.executedAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>

      {/* Notifications / Alerts */}
      {successMsg && (
        <div className="bg-emerald-950/60 text-emerald-200 border border-emerald-500/40 p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-inner">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-950/60 text-rose-200 border border-rose-500/40 p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-inner">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Retention Options Grid */}
      <div className="space-y-3">
        <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider font-sans block">
          নতুন সংরক্ষণ মেয়াদ নির্বাচন করুন (Select Retention Period)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {RETENTION_OPTIONS.map((opt) => {
            const isSelected = selectedDays === opt.days;
            const isCurrentActive = currentDays === opt.days;

            return (
              <div
                key={opt.days}
                onClick={() => handleSaveRetentionPolicy(opt.days)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-lg ring-1 ring-emerald-500'
                    : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-black text-white block">{opt.label}</span>
                    <span className="text-[10px] text-emerald-400 font-medium">{opt.badge}</span>
                  </div>

                  {isCurrentActive ? (
                    <span className="text-[9px] font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full uppercase shrink-0">
                      সক্রিয় নীতি
                    </span>
                  ) : (
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${
                      isSelected ? 'border-emerald-400 bg-emerald-500 text-slate-950 font-bold' : 'border-slate-600'
                    }`}>
                      {isSelected ? '✓' : ''}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {opt.desc}
                </p>

                <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>মেয়াদঃ {opt.days} দিন</span>
                  {saving && isSelected && <span className="text-amber-400 font-sans font-bold animate-pulse">সেভ হচ্ছে...</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scope Details breakdown */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3 font-sans">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-400" />
            স্বয়ংক্রিয় ক্লিনআপের আওতাভুক্ত ডাটা সংগ্রহ (In-Scope Collections)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{HISTORY_COLLECTIONS.length} টি কালেকশন</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[11px]">
          {HISTORY_COLLECTIONS.map((col) => {
            const count = lastResult?.details?.[col.name] ?? 0;
            return (
              <div key={col.name} className="bg-slate-900 border border-slate-800/80 p-2 rounded-xl flex items-center justify-between text-slate-400">
                <span className="truncate pr-1 text-[10px]">{col.label}</span>
                {count > 0 && (
                  <span className="bg-rose-950 text-rose-300 border border-rose-800 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                    -{count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
