import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, X, CheckCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface Agent {
  id: string;
  name: string;
}

interface AgentReportModalProps {
  agent: Agent;
  user: any;
  db: any;
  onClose: () => void;
  t: any;
}

export default function AgentReportModal({
  agent,
  user,
  db,
  onClose,
  t,
}: AgentReportModalProps) {
  const [reportReason, setReportReason] = useState<string>('ভুল তথ্য');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (!reportDetails.trim()) {
      alert('অনুগ্রহ করে অভিযোগের বিবরণ দিন।');
      return;
    }
    setIsSubmittingReport(true);
    try {
      await addDoc(collection(db, 'agent_reports'), {
        agentId: agent.id,
        agentName: agent.name,
        reporterId: user.uid,
        reporterPhone: user.phone || 'Unknown',
        reason: reportReason,
        details: reportDetails,
        createdAt: serverTimestamp(),
      });
      setReportSuccess(true);
    } catch (err: any) {
      alert('Failed to submit report: ' + err.message);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-sm rounded-3xl p-5 border border-slate-150 shadow-xl space-y-4 text-left font-sans"
      >
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-xs font-black text-rose-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4.5 h-4.5 text-rose-500" />
            {t.reportModalTitle}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {reportSuccess ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-xs text-slate-800 font-bold leading-normal">{t.reportSuccessText}</p>
            <button 
              onClick={onClose}
              className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black rounded-lg transition"
            >
              বন্ধ করুন
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
              এজেন্ট <span className="font-black text-slate-800">{agent.name}</span> এর বিরুদ্ধে ভুল বা আপত্তিজনক কার্যক্রমের জন্য রিপোর্ট দাখিল করুন। অভিযোগটি সরাসরি অ্যাডমিন প্যানেলে যাচাই করা হবে।
            </p>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[9px] font-black text-slate-450 uppercase mb-1">{t.reportReasonLabel}</label>
                <select 
                  value={reportReason} 
                  onChange={e => setReportReason(e.target.value)} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-500"
                >
                  <option value="ভুল তথ্য">ভুল তথ্য / ফেক লোকেশন</option>
                  <option value="খারাপ ব্যবহার">আপত্তিকর বা খারাপ ব্যবহার</option>
                  <option value="অতিরিক্ত ফি">অতিরিক্ত ফি বা লেনদেনে অনিয়ম</option>
                  <option value="ফোন বন্ধ">ফোন কল বা হোয়াটসঅ্যাপে যোগাযোগ করা অসম্ভব</option>
                  <option value="অন্যান্য">অন্যান্য অভিযোগ</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-450 uppercase mb-1">{t.reportDetailsLabel}</label>
                <textarea 
                  rows={3} 
                  value={reportDetails} 
                  onChange={e => setReportDetails(e.target.value)} 
                  placeholder="অভিযোগের বিস্তারিত এখানে ব্যাখ্যা করুন..." 
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-rose-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={isSubmittingReport}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center"
            >
              {isSubmittingReport ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>{t.submitReportBtn}</span>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
