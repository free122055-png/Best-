import React from 'react';
import { User, SAMITY_QUARTERLY_MONTHS, getEffectiveBalance } from '../types';
import { isUserQuarterlyPaid } from '../lib/samitySavingsEngine';
import { CheckCircle2, PlusCircle } from 'lucide-react';

interface SamityQuarterlySectionProps {
  trackerSelectedYear: number;
  quarterTargetMember: User | null;
  effectiveUser: User;
  selectedQuarterIds: string[];
  setSelectedQuarterIds: React.Dispatch<React.SetStateAction<string[]>>;
  quarterPaymentSource: 'payer' | 'target';
  setQuarterPaymentSource: (source: 'payer' | 'target') => void;
  quarterlyPaying: boolean;
  handlePayQuarterly: (monthId: string, year: number) => void;
  handlePayMultipleQuarterly: (quarterIds: string[]) => void;
  setCustomAlert: (alert: { title: string; message: string } | null) => void;
  activeCat: any;
  isTargetOwner: boolean;
  isTargetShareholder: boolean;
  isTargetEligible: boolean;
  targetQRate: number;
  unpaidQuarters: typeof SAMITY_QUARTERLY_MONTHS;
  activeTarget: User;
}

export const SamityQuarterlySection: React.FC<SamityQuarterlySectionProps> = ({
  trackerSelectedYear,
  quarterTargetMember,
  effectiveUser,
  selectedQuarterIds,
  setSelectedQuarterIds,
  quarterPaymentSource,
  setQuarterPaymentSource,
  quarterlyPaying,
  handlePayQuarterly,
  handlePayMultipleQuarterly,
  setCustomAlert,
  activeCat,
  isTargetOwner,
  isTargetShareholder,
  isTargetEligible,
  targetQRate,
  unpaidQuarters,
  activeTarget
}) => {
  return (
    <div className="bg-amber-50/70 border border-amber-300 rounded-lg p-2 space-y-2 shadow-2xs">
      {/* Selected Year Title Banner - Exactly matching 12-Month style above */}
      <div className="flex items-center justify-between text-[9px] font-bold text-slate-700 px-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>
            📅 <strong>{trackerSelectedYear} সালের</strong> ৩ মাস পর পর কিস্তি (বছরে ৪ কিস্তি: জানুয়ারি • এপ্রিল • জুলাই • অক্টোবর)
          </span>
          <span className="text-[7.5px] bg-rose-600 text-white px-1.5 py-0.2 rounded-full font-bold">
            যেকোনো সময় / অগ্রিম প্রদেয়
          </span>
          {quarterTargetMember && (
            <span className="text-[7.5px] bg-emerald-700 text-white px-1.5 py-0.2 rounded font-black shadow-3xs">
              🎯 প্রাপক: {quarterTargetMember.name} ({quarterTargetMember.memberId || 'N/A'})
            </span>
          )}
        </div>
        <span className="text-[8.5px] text-amber-900 font-mono font-black bg-amber-100/90 px-1.5 py-0.2 rounded border border-amber-300 shrink-0">
          {isTargetOwner
            ? 'ওনার: ৳১০,০০০'
            : isTargetShareholder
            ? 'শেয়ার হোল্ডার: ৳৫,০০০'
            : 'ওনার: ৳১০,০০০ | শেয়ার: ৳৫,০০০'}
        </span>
      </div>

      {/* 4-Month Payment Matrix Grid - Exactly matching 12-Month grid above (1 Line, 4 Columns) */}
      <div className="grid grid-cols-4 gap-1">
        {SAMITY_QUARTERLY_MONTHS.map((q) => {
          const isPaid = isUserQuarterlyPaid(activeTarget, trackerSelectedYear, q.id);
          const qAmount = isTargetOwner ? 10000 : isTargetShareholder ? 5000 : 10000;
          const isSelected = selectedQuarterIds.includes(q.id);

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                if (isPaid) {
                  setCustomAlert({
                    title: `✅ ${q.name} ${trackerSelectedYear} কিস্তি পরিশোধিত`,
                    message: `${quarterTargetMember ? quarterTargetMember.name : 'আপনার'} ${q.name} ${trackerSelectedYear} সালের ৩ মাস পর পর কিস্তি ৳${qAmount.toLocaleString('bn-BD')} টাকা ইতিমধ্যে সফলভাবে জমা সম্পন্ন হয়েছে।`
                  });
                  return;
                }

                if (!isTargetEligible) {
                  setCustomAlert({
                    title: 'ℹ️ ওনার ও শেয়ার হোল্ডার কিস্তি',
                    message: `৩ মাস পর পর ৪টি কিস্তি (জানুয়ারি, এপ্রিল, জুলাই, অক্টোবর) শুধুমাত্র ওনার (৳১০,০০০) ও শেয়ার হোল্ডার (৳৫,০০০) সদস্যদের জন্য প্রযোজ্য। আপনি অন্য কোনো ওনার বা শেয়ার হোল্ডার সদস্যের কিস্তি দিতে নিচের সার্চ বক্স দিয়ে সদস্যকে সিলেক্ট করুন।`
                  });
                  return;
                }

                if (selectedQuarterIds.length > 0) {
                  setSelectedQuarterIds(prev =>
                    prev.includes(q.id) ? prev.filter(id => id !== q.id) : [...prev, q.id]
                  );
                } else {
                  handlePayQuarterly(q.id, trackerSelectedYear);
                }
              }}
              className={`p-1 rounded-lg border text-center transition cursor-pointer flex flex-col items-center justify-between min-h-[46px] ${
                isPaid
                  ? 'bg-emerald-500/10 border-emerald-300 text-emerald-950 font-black shadow-3xs'
                  : isSelected
                  ? 'bg-amber-100 border-amber-500 ring-1 ring-amber-400 text-slate-900 shadow-2xs'
                  : 'bg-rose-50/60 border-rose-200 hover:border-rose-400 text-slate-800 font-bold hover:shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between w-full px-0.5">
                <span className="text-[9px] font-extrabold truncate leading-tight">{q.name}</span>
                <span className="text-[7px] font-bold text-amber-800 font-mono">({q.quarter})</span>
              </div>

              <span className="text-[7.5px] font-mono font-black text-amber-950 my-0.5">
                ৳{qAmount.toLocaleString('bn-BD')}
              </span>

              {isPaid ? (
                <span className="inline-flex items-center gap-0.5 text-[7.5px] bg-emerald-600 text-white px-1 py-0.2 rounded font-mono font-bold mt-0.5 shadow-3xs w-full justify-center">
                  <CheckCircle2 className="w-2 h-2" /> পরিশোধিত
                </span>
              ) : isSelected ? (
                <span className="inline-flex items-center gap-0.5 text-[7.5px] bg-amber-600 text-white px-1 py-0.2 rounded font-mono font-black mt-0.5 shadow-3xs w-full justify-center">
                  ✓ নির্বাচিত
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[7.5px] bg-rose-600 hover:bg-rose-700 text-white px-1 py-0.2 rounded font-mono font-bold mt-0.5 shadow-3xs w-full justify-center">
                  <PlusCircle className="w-2 h-2" /> জমা ⚡
                </span>
              )}
            </button>
          );
        })}
      </div>



      {/* Active Selected Target Member Banner */}
      {quarterTargetMember && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 rounded-md p-1.5 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🎯</span>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-[9.5px] font-black text-emerald-950">{quarterTargetMember.name}</span>
                  <span className={`text-[7.5px] font-black px-1 py-0.2 rounded ${activeCat.tagColor}`}>
                    {activeCat.titleBn}
                  </span>
                </div>
                <p className="text-[8px] text-emerald-850 font-mono">
                  আইডি: <strong>{quarterTargetMember.memberId || 'N/A'}</strong> • মোবাইল: {quarterTargetMember.phone || ''}
                </p>
              </div>
            </div>

            {/* Payment Source Selector */}
            <div className="text-right shrink-0">
              <label className="block text-[7px] font-bold text-emerald-900 mb-0.5">টাকা কর্তন মাধ্যম:</label>
              <select
                value={quarterPaymentSource}
                onChange={(e) => setQuarterPaymentSource(e.target.value as any)}
                className="text-[7.5px] font-black bg-white border border-emerald-400 text-emerald-950 rounded px-1.5 py-0.5 cursor-pointer shadow-3xs focus:outline-none"
              >
                <option value="payer">আমার ওয়ালেট থেকে (৳{getEffectiveBalance(effectiveUser).toLocaleString('bn-BD')})</option>
                <option value="target">সদস্যের ওয়ালেট থেকে (৳{getEffectiveBalance(quarterTargetMember).toLocaleString('bn-BD')})</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
