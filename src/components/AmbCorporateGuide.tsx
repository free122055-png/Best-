import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  ChevronLeft, 
  BookOpen, 
  Lightbulb, 
  Award, 
  MessageSquare, 
  Edit3, 
  Save, 
  X, 
  Check, 
  Heart, 
  Shield, 
  Sparkles, 
  Send,
  Phone,
  Mail,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AmbCorporateGuideProps {
  user: User;
  onBack: () => void;
  appConfig: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
}

export default function AmbCorporateGuide({ 
  user, 
  onBack, 
  appConfig, 
  onUpdateConfig 
}: AmbCorporateGuideProps) {
  const isAdmin = user?.role === 'admin' || user?.role === 'sub_admin';

  // Toggle expanded category boxes
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Local state for editing fields
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({
    rules: false,
    futurePlans: false,
    mission: false,
    feedback: false,
  });

  const [editValues, setEditValues] = useState({
    rules: appConfig.corporateGuide?.rules || '',
    futurePlans: appConfig.corporateGuide?.futurePlans || '',
    mission: appConfig.corporateGuide?.mission || '',
    feedback: appConfig.corporateGuide?.feedback || '',
  });

  const [savingField, setSavingField] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // States for user interactive feedback submission (for non-admins / customers)
  const [userFeedbackText, setUserFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Categories definition
  const categories = [
    {
      key: 'rules',
      title: '1. অ্যাপসের নিয়মকানুন (App Rules & Guidelines)',
      icon: Shield,
      colorClass: 'text-amber-600 bg-amber-50 border-amber-100',
      gradientClass: 'from-amber-500 to-orange-600',
      placeholder: 'অ্যাপসের নিয়মকানুন এখানে লিখুন...',
    },
    {
      key: 'futurePlans',
      title: '2. ভবিষ্যৎ প্ল্যান ও পরিকল্পনা (Future Plans & Roadmap)',
      icon: Lightbulb,
      colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      gradientClass: 'from-emerald-500 to-teal-600',
      placeholder: 'ভবিষ্যৎ পরিকল্পনা এখানে লিখুন...',
    },
    {
      key: 'mission',
      title: '3. আমাদের লক্ষ্য ও উদ্দেশ্য (Our Mission & Vision)',
      icon: Award,
      colorClass: 'text-violet-600 bg-violet-50 border-violet-100',
      gradientClass: 'from-violet-500 to-indigo-600',
      placeholder: 'আমাদের লক্ষ্য ও উদ্দেশ্য এখানে লিখুন...',
    },
    {
      key: 'feedback',
      title: '4. আপনাদের মতামত ও যোগাযোগ (Your Feedback & Contact)',
      icon: MessageSquare,
      colorClass: 'text-blue-600 bg-blue-50 border-blue-100',
      gradientClass: 'from-blue-500 to-indigo-600',
      placeholder: 'যোগাযোগ ও মতামত গ্রহণের বিবরণী এখানে লিখুন...',
    },
  ];

  // Save changes to Firestore and update parent config
  const handleSaveField = async (fieldKey: string) => {
    setSavingField(fieldKey);
    setSaveSuccess(null);
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      const updatedCorporateGuide = {
        ...(appConfig.corporateGuide || {
          rules: '',
          futurePlans: '',
          mission: '',
          feedback: '',
        }),
        [fieldKey]: editValues[fieldKey as keyof typeof editValues],
      };

      const updatedConfig = {
        ...appConfig,
        corporateGuide: updatedCorporateGuide,
      };

      await updateDoc(configRef, {
        corporateGuide: updatedCorporateGuide
      });

      onUpdateConfig(updatedConfig);
      setIsEditing(prev => ({ ...prev, [fieldKey]: false }));
      setSaveSuccess(fieldKey);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (error) {
      console.error("Failed to save corporate guide field:", error);
      console.error("সংরক্ষণ করতে সমস্যা হয়েছে!");
    } finally {
      setSavingField(null);
    }
  };

  // Submit suggestion/feedback as a standard user
  const handleUserFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFeedbackText.trim()) return;

    setSubmittingFeedback(true);
    setFeedbackSuccess(false);

    try {
      // Save feedback in a subcollection or dedicated logs collection
      const feedbackRef = doc(db, 'system_settings', 'app_config');
      
      // Let's store user feedback directly in corporate_feedbacks Firestore collection
      const { collection, addDoc } = await import('firebase/firestore');
      const feedbackCollection = collection(db, 'corporate_feedbacks');
      await addDoc(feedbackCollection, {
        userId: user.uid || '',
        userName: user.name,
        userPhone: user.phone || 'N/A',
        feedback: userFeedbackText,
        createdAt: new Date().toISOString(),
      });

      setFeedbackSuccess(true);
      setUserFeedbackText('');
      setTimeout(() => setFeedbackSuccess(false), 5000);
    } catch (err) {
      console.error("Error submitting user feedback:", err);
      console.error("মতামত পাঠাতে সমস্যা হয়েছে!");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 pb-12">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-violet-900 via-indigo-950 to-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition active:scale-95 cursor-pointer font-bold"
          >
            <ChevronLeft className="w-4 h-4" />
            ফিরে যান
          </button>
          
          <div className="text-center flex-1">
            <h1 className="text-sm font-black tracking-tight flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              কোম্পানি প্রোফাইল ও লক্ষ্যমাত্রা
            </h1>
            <p className="text-[10px] text-slate-300 font-medium">AMB Corporate Guide & Mission</p>
          </div>

          <button
            onClick={onBack}
            className="p-1.5 hover:bg-white/10 rounded-full transition"
          >
            <X className="w-5 h-5 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Hero Banner Area */}
      <div className="bg-gradient-to-b from-indigo-950 to-slate-900 text-white pt-6 pb-12 px-4 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-xl mx-auto space-y-3 relative z-10">
          <div className="inline-block px-3 py-1 rounded-full bg-violet-800/40 border border-violet-700/50 text-[10px] uppercase font-black text-violet-300 tracking-wider">
            BUSINESS NETWORK BANGLADESH
          </div>
          <h2 className="text-xl font-black tracking-tight leading-snug text-slate-100">
            মেম্বারদের সমৃদ্ধি অর্জনের ডিজিটাল সোপান
          </h2>
          <p className="text-[11px] text-slate-300 max-w-sm mx-auto leading-relaxed">
            আমরা সততা, স্বচ্ছতা ও প্রযুক্তির মেলবন্ধনে এক স্বনির্ভর সুদমুক্ত ডিজিটাল সমবায় সমাজ বিনির্মাণে অঙ্গীকৃতবদ্ধ।
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-2xl mx-auto px-4 -mt-6 space-y-6 relative z-20">
        
        {/* Admin Alert Notice */}
        {isAdmin && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-center gap-3 text-amber-900 shadow-2xs">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-slate-950 shrink-0 shadow-3xs">
              <Edit3 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-xs font-black">এডমিন কন্ট্রোল অ্যাক্টিভ!</p>
              <p className="text-[10px] text-amber-800 font-medium leading-normal mt-0.5">
                আপনি এডমিন হিসেবে এই পেইজের সকল নিয়মকানুন, ভবিষ্যৎ প্ল্যান ও উদ্দেশ্য সরাসরি এডিট বা পরিবর্তন করতে পারবেন। সাধারণ গ্রাহকরা শুধু দেখতে পারবে।
              </p>
            </div>
          </div>
        )}

        {/* 4 Grid Clickable Boxes */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
          {categories.map((cat, idx) => {
            const IconComponent = cat.icon;
            const isSelected = (expandedCategory || 'rules') === cat.key;
            
            return (
              <button
                key={`cat-btn-${cat.key}-${idx}`}
                type="button"
                onClick={() => {
                  setExpandedCategory(cat.key);
                  // Turn off edit mode for other categories when switching
                  setIsEditing({
                    rules: false,
                    futurePlans: false,
                    mission: false,
                    feedback: false,
                  });
                }}
                className={`flex flex-col items-center justify-center text-center p-4 sm:p-5 rounded-3xl border transition-all duration-300 cursor-pointer relative overflow-hidden select-none active:scale-95 text-left h-28 sm:h-32 shadow-2xs ${
                  isSelected 
                    ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/10 shadow-md transform -translate-y-1' 
                    : 'bg-white border-slate-150 hover:border-slate-350 hover:shadow-xs'
                }`}
              >
                {/* Visual accent bar at the bottom */}
                <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r ${cat.gradientClass} ${isSelected ? 'opacity-100' : 'opacity-0 transition-opacity duration-300'}`} />

                {/* Icon wrapper inside a circle */}
                <div className={`p-2.5 rounded-2xl border mb-2 shrink-0 shadow-3xs ${cat.colorClass}`}>
                  <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                </div>

                <div className="space-y-0.5 text-center">
                  <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    {cat.key === 'rules' ? 'সেকশন 1' : cat.key === 'futurePlans' ? 'সেকশন 2' : cat.key === 'mission' ? 'সেকশন 3' : 'সেকশন 4'}
                  </h4>
                  <p className="text-[10px] sm:text-xs font-black text-slate-800 leading-tight line-clamp-2 max-w-xs px-1">
                    {cat.key === 'rules' ? 'নিয়মকানুন' : cat.key === 'futurePlans' ? 'ভবিষ্যৎ প্ল্যান' : cat.key === 'mission' ? 'লক্ষ্য ও উদ্দেশ্য' : 'যোগাযোগ ও মতামত'}
                  </p>
                </div>

                {/* Selected marker dot */}
                {isSelected && (
                  <span className="absolute top-2 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Category Detail Panel (Full Width Card) */}
        <div className="space-y-4">
          {categories.map((cat, idx) => {
            const currentFieldKey = cat.key;
            const isSelected = (expandedCategory || 'rules') === currentFieldKey;
            
            if (!isSelected) return null;

            const IconComponent = cat.icon;
            const isEditingThis = isEditing[currentFieldKey];
            const currentValue = appConfig.corporateGuide?.[currentFieldKey as keyof typeof editValues] || '';
            const isSuccess = saveSuccess === currentFieldKey;

            return (
              <motion.div 
                key={`cat-btn-${cat.key}-${idx}`} 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4 text-left relative overflow-hidden"
              >
                {/* Visual Accent */}
                <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${cat.gradientClass}`} />

                {/* Card Header */}
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-2xl border ${cat.colorClass} shrink-0 shadow-3xs`}>
                      <IconComponent className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-800 leading-tight">
                        {cat.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">বিস্তারিত তথ্য ও বিবরণী</p>
                    </div>
                  </div>

                  {/* Edit Trigger button for Admins */}
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      {isEditingThis ? (
                        <button 
                          onClick={() => {
                            setIsEditing(prev => ({ ...prev, [currentFieldKey]: false }));
                            setEditValues(prev => ({
                              ...prev,
                              [currentFieldKey]: appConfig.corporateGuide?.[currentFieldKey as keyof typeof editValues] || ''
                            }));
                          }}
                          className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg transition active:scale-95 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          বাতিল
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            setIsEditing(prev => ({ ...prev, [currentFieldKey]: true }));
                            setEditValues(prev => ({
                              ...prev,
                              [currentFieldKey]: appConfig.corporateGuide?.[currentFieldKey as keyof typeof editValues] || ''
                            }));
                          }}
                          className="px-2.5 py-1 text-[10px] bg-violet-555 hover:bg-violet-600 text-white font-black rounded-lg transition active:scale-95 flex items-center gap-1 shadow-3xs"
                        >
                          <Edit3 className="w-3 h-3 stroke-[3]" />
                          এডিট করুন
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Content Area */}
                <div className="pt-1 leading-relaxed font-sans text-slate-750 text-xs sm:text-sm">
                  {isEditingThis ? (
                    <div className="space-y-3">
                      <textarea
                        value={editValues[currentFieldKey as keyof typeof editValues]}
                        onChange={(e) => setEditValues(prev => ({ ...prev, [currentFieldKey]: e.target.value }))}
                        rows={8}
                        placeholder={cat.placeholder}
                        className="w-full bg-slate-50 border border-slate-250 rounded-2xl p-3.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium leading-relaxed"
                      />
                      
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSaveField(currentFieldKey)}
                          disabled={savingField !== null}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-[11px] flex items-center gap-1.5 shadow-2xs transition active:scale-95 disabled:opacity-50"
                        >
                          {savingField === currentFieldKey ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          সেভ করুন
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-line leading-relaxed text-slate-750 font-bold bg-slate-50/50 rounded-2xl p-4 border border-slate-100 max-h-[350px] overflow-y-auto custom-scrollbar">
                      {currentValue ? (
                        currentValue
                      ) : (
                        <div className="py-6 text-center italic text-slate-400 font-bold flex items-center justify-center gap-1">
                          <HelpCircle className="w-4 h-4" />
                          এখনো কোনো ডেসক্রিপশন সেট করা হয়নি।
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Live Saved Alert Banner */}
                {isSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-850 text-[10px] font-black flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    তথ্যটি সরাসরি লাইভ আপডেট করা হয়েছে এবং সকল গ্রাহকদের কাছে সিঙ্ক হয়েছে!
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Customer Suggestion Box (Only visible for standard customers) */}
        {!isAdmin && (
          <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-sm text-left transition hover:border-slate-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 to-indigo-600" />
            
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="p-2.5 rounded-2xl border text-blue-600 bg-blue-50 border-blue-100 shrink-0 shadow-3xs">
                <Send className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-800 leading-tight">
                  সরাসরি মতামত ও অভিযোগ দাখিল করুন
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">আপনার সুচিন্তিত পরামর্শ আমাদের প্রেরণা</p>
              </div>
            </div>

            <form onSubmit={handleUserFeedbackSubmit} className="pt-3.5 space-y-3 font-sans">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 block">আপনার মূল্যবান মতামত বা অভিযোগ লিখুন:</label>
                <textarea
                  value={userFeedbackText}
                  onChange={(e) => setUserFeedbackText(e.target.value)}
                  rows={4}
                  required
                  placeholder="আপনার কোনো পরামর্শ, অভিযোগ বা অভিজ্ঞতা থাকলে এখানে বিস্তারিত লিখুন। এডমিন বোর্ড সরাসরি আপনার বার্তাটি দেখতে পাবেন..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400 font-medium"
                />
              </div>

              <div className="flex justify-between items-center pt-1.5">
                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                  আমরা আপনার গোপনীয়তা বজায় রাখি
                </div>
                <button
                  type="submit"
                  disabled={submittingFeedback || !userFeedbackText.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-xl text-[11px] flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                >
                  {submittingFeedback ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  মতামত পাঠান
                </button>
              </div>

              {/* Feedback Success State Banner */}
              {feedbackSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-850 text-[10px] font-black flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                  আপনার মূল্যবান মতামত সফলভাবে পাঠানো হয়েছে। ব্যবসা নেটওয়ার্ক বাংলাদেশ ফ্যামিলিতে থাকার জন্য ধন্যবাদ!
                </motion.div>
              )}
            </form>
          </div>
        )}

        {/* Footer info stamp */}
        <div className="pt-2 pb-6 text-center space-y-2 font-sans select-none">
          <p className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            বাংলাদেশ সমবায় অধিদপ্তর নিবন্ধিত খসড়া নীতিমালা ও গাইড
          </p>
          <p className="text-[9px] text-slate-300 font-medium">© 2026 ব্যবসা নেটওয়ার্ক বাংলাদেশ লিমিটেড</p>
        </div>

      </div>
    </div>
  );
}
