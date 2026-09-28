import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Lock, 
  Smartphone, 
  HeartHandshake, 
  BookOpen, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  X, 
  AlertTriangle,
  Scale,
  Coins,
  Send,
  HelpCircle,
  Megaphone,
  Vote
} from 'lucide-react';
import { MandatoryNoticeConsent, MandatoryNoticeSlide, User, AppConfig } from '../types';

interface MandatoryNoticeModalProps {
  isOpen: boolean;
  user: User;
  appConfig: AppConfig;
  noticeConfig?: MandatoryNoticeConsent;
  onConsentSubmitted: (agreed: boolean, feedbackText?: string) => Promise<void> | void;
  onClose?: () => void;
  previewMode?: boolean;
}

export const MandatoryNoticeModal: React.FC<MandatoryNoticeModalProps> = ({
  isOpen,
  user,
  appConfig,
  noticeConfig,
  onConsentSubmitted,
  onClose,
  previewMode = false
}) => {
  // If noticeConfig is passed directly (e.g. from preview), use it; otherwise fallback to appConfig.mandatoryNotice
  const notice = noticeConfig || appConfig.mandatoryNotice;

  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [userDecision, setUserDecision] = useState<boolean | null>(null);
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showResultScreen, setShowResultScreen] = useState<boolean>(false);

  // Reset state when opened or notice ID changes
  useEffect(() => {
    if (isOpen) {
      setCurrentSlideIndex(0);
      setUserDecision(null);
      setFeedbackInput('');
      setShowResultScreen(false);
      setIsSubmitting(false);
    }
  }, [isOpen, notice?.id]);

  if (!isOpen || !notice) return null;

  const slides: MandatoryNoticeSlide[] = notice.slides && notice.slides.length > 0 ? notice.slides : [
    {
      id: 'slide_1',
      badge: 'নতুন নিয়ম',
      iconType: 'security',
      title: '১. একাউন্ট নিরাপত্তা',
      description: 'আপনার একাউন্ট আরও নিরাপদ রাখতে এখন থেকে দুই-ধাপ যাচাইকরণ (2FA) বাধ্যতামূলক করা হয়েছে।\n\nএতে আপনার একাউন্ট সুরক্ষিত থাকবে।'
    },
    {
      id: 'slide_2',
      badge: 'নতুন নিয়ম',
      iconType: 'limits',
      title: '২. লেনদেন সীমা আপডেট',
      description: 'সদস্যদের সুবিধার জন্য দৈনিক লেনদেন সীমা আপডেট করা হয়েছে।',
      bulletPoints: [
        'সাধারণ সদস্য: ৳ ৫০,০০০',
        'ভেরিফাইড সদস্য: ৳ ১০০,০০০'
      ]
    },
    {
      id: 'slide_3',
      badge: 'নতুন নিয়ম',
      iconType: 'handshake',
      title: '৩. আমাদের প্রত্যাশা',
      description: 'সবাই নিয়ম মেনে চললে আমাদের কমিউনিটি আরও শক্তিশালী হবে। আপনার সহযোগিতা আমাদের জন্য গুরুত্বপূর্ণ।'
    }
  ];

  // Total slides: Slide 0 (Intro/Welcome), Slide 1..N (Rules), Slide N+1 (Final Question/Poll)
  const totalSlides = slides.length + 2; 
  const isIntroSlide = currentSlideIndex === 0;
  const isFinalDecisionSlide = currentSlideIndex === totalSlides - 1;
  const activeRuleIndex = currentSlideIndex - 1;
  const activeRule = !isIntroSlide && !isFinalDecisionSlide ? slides[activeRuleIndex] : null;

  const handleNext = () => {
    if (currentSlideIndex < totalSlides - 1) {
      setSlideDirection('right');
      setCurrentSlideIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setSlideDirection('left');
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  const handleDecision = async (agreed: boolean) => {
    setUserDecision(agreed);
    setShowResultScreen(true);
  };

  const handleFinalFinish = async () => {
    if (userDecision === null) return;
    setIsSubmitting(true);
    try {
      await onConsentSubmitted(userDecision, feedbackInput);
      if (previewMode && onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Error submitting notice consent:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Graphical Illustrations
  const renderIllustration = (type: string | undefined, defaultType: string = 'rules') => {
    const iconToUse = type || defaultType;

    if (iconToUse === 'security') {
      return (
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center my-2">
          <div className="absolute inset-0 bg-emerald-100 rounded-full scale-110 animate-pulse opacity-70" />
          <div className="relative w-24 h-24 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
            <ShieldCheck className="w-12 h-12" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-md text-emerald-600 border border-emerald-100">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      );
    }

    if (iconToUse === 'limits') {
      return (
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center my-2">
          <div className="absolute inset-0 bg-teal-100 rounded-full scale-110 opacity-70" />
          <div className="relative w-24 h-24 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20 text-white">
            <Smartphone className="w-11 h-11" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-400 p-1.5 rounded-full shadow-md text-slate-900 border-2 border-white">
            <Coins className="w-5 h-5" />
          </div>
        </div>
      );
    }

    if (iconToUse === 'handshake') {
      return (
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center my-2">
          <div className="absolute inset-0 bg-emerald-100 rounded-full scale-110 opacity-70" />
          <div className="relative w-24 h-24 bg-gradient-to-tr from-emerald-600 to-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
            <HeartHandshake className="w-12 h-12" />
          </div>
          <div className="absolute -top-1 -right-1 bg-white p-1.5 rounded-full shadow-md text-emerald-600 border border-emerald-100">
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
        </div>
      );
    }

    if (iconToUse === 'announcement') {
      return (
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center my-2">
          <div className="absolute inset-0 bg-sky-100 rounded-full scale-110 opacity-70" />
          <div className="relative w-24 h-24 bg-gradient-to-tr from-sky-500 to-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
            <Megaphone className="w-11 h-11" />
          </div>
        </div>
      );
    }

    // Default: Rules & Law Book
    return (
      <div className="relative w-32 h-32 mx-auto flex items-center justify-center my-2">
        <div className="absolute inset-0 bg-emerald-100/80 rounded-full scale-105" />
        <div className="relative w-28 h-28 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-3xl flex flex-col items-center justify-center shadow-inner text-emerald-700">
          <BookOpen className="w-12 h-12 text-emerald-600 drop-shadow-sm" />
          <div className="flex items-center gap-1 mt-1 text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-100/90 px-2 py-0.5 rounded-full">
            <Scale className="w-3 h-3 text-emerald-600" />
            <span>নিয়মাবলী</span>
          </div>
        </div>
        <div className="absolute -top-2 right-1 bg-amber-400 text-slate-900 p-1.5 rounded-full shadow-md">
          <Sparkles className="w-4 h-4" />
        </div>
      </div>
    );
  };

  return (
    <div 
      id="mandatory-notice-overlay"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans"
    >
      <div className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-center flex flex-col max-h-[92vh]">
        
        {/* Top Header Badge Bar */}
        <div className="pt-5 px-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-black rounded-full shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              {notice.categoryBadge || 'নতুন নিয়ম'}
            </span>
            {previewMode && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-full">
                এডমিন প্রিভিউ মোড
              </span>
            )}
          </div>
          {previewMode && onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
              title="প্রিভিউ বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Slides Carousel */}
        <div className="px-6 py-3 flex-1 overflow-y-auto flex flex-col justify-center min-h-[300px]">
          <AnimatePresence mode="wait">
            {!showResultScreen ? (
              <motion.div
                key={`slide-${currentSlideIndex}`}
                initial={{ opacity: 0, x: slideDirection === 'right' ? 25 : -25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: slideDirection === 'right' ? -25 : 25 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="space-y-4 my-auto"
              >
                {/* 1. SLIDE 0: Welcome / Intro */}
                {isIntroSlide && (
                  <div className="space-y-3">
                    {renderIllustration('rules')}

                    <h2 className="text-lg sm:text-xl font-black text-slate-850 leading-snug px-2">
                      {notice.title || 'নতুন নিয়মে আপনার অনুমতি প্রয়োজন'}
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium px-2 whitespace-pre-line">
                      {notice.introText || 'আমাদের সেবার মান উন্নয়ন এবং সদস্যদের নিরাপত্তা নিশ্চিত করতে কিছু নতুন নিয়ম ও আপডেট আনা হয়েছে। অনুমতি দেওয়ার আগে অনুগ্রহ করে সম্পূর্ণ পড়ুন।'}
                    </p>
                  </div>
                )}

                {/* 2. SLIDES 1 to N: Individual Rule Cards */}
                {activeRule && (
                  <div className="space-y-3">
                    {renderIllustration(activeRule.iconType)}

                    <h3 className="text-base sm:text-lg font-black text-slate-850">
                      {activeRule.title}
                    </h3>

                    {activeRule.description && (
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line px-2">
                        {activeRule.description}
                      </p>
                    )}

                    {activeRule.bulletPoints && activeRule.bulletPoints.length > 0 && (
                      <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3 text-left space-y-1.5 mt-2">
                        {activeRule.bulletPoints.map((point, pIdx) => (
                          <div key={pIdx} className="flex items-start gap-2 text-xs font-bold text-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeRule.footerNote && (
                      <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 py-1.5 px-3 rounded-xl inline-block">
                        {activeRule.footerNote}
                      </p>
                    )}
                  </div>
                )}

                {/* 3. SLIDE N+1: Final Consent & Poll Feedback */}
                {isFinalDecisionSlide && (
                  <div className="space-y-3">
                    {renderIllustration('handshake')}

                    <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 shadow-xs">
                      <div className="w-9 h-9 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                        <Vote className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm sm:text-base font-black text-slate-850 leading-relaxed">
                        {notice.finalQuestion || 'আপনি কি উপরোক্ত নতুন নিয়ম ও শর্তাবলী মেনে নিতে সম্মত?'}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1 font-medium">
                        সদস্যদের সুরক্ষা ও উন্নত সেবার স্বার্থে আপনার মতামত অতিব জরুরি
                      </p>
                    </div>

                    {notice.allowFeedbackComment && (
                      <div className="text-left space-y-1 mt-2">
                        <label className="text-[11px] font-extrabold text-slate-600">
                          আপনার মতামত বা পরামর্শ (ঐচ্ছিক):
                        </label>
                        <textarea
                          rows={2}
                          value={feedbackInput}
                          onChange={(e) => setFeedbackInput(e.target.value)}
                          placeholder={notice.feedbackPlaceholder || 'আপনার কোনো মতামত থাকলে এখানে লিখুন...'}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800"
                        />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              /* RESULT SCREEN (Success or Disagree acknowledgment) */
              <motion.div
                key="result-screen"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="space-y-4 my-auto py-2"
              >
                {userDecision === true ? (
                  <>
                    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-60" />
                      <div className="relative w-20 h-20 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-600/30">
                        <Check className="w-11 h-11 stroke-[3]" />
                      </div>
                      <div className="absolute -top-1 right-0 text-amber-500">
                        <Sparkles className="w-6 h-6 animate-bounce" />
                      </div>
                    </div>

                    <h2 className="text-xl font-black text-slate-850">
                      {notice.successTitle || 'ধন্যবাদ!'}
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed px-4 whitespace-pre-line">
                      {notice.successMessage || 'আপনি নতুন নিয়মে সম্মতি দিয়েছেন।\nএখন থেকে আপনি আমাদের সকল সেবা উপভোগ করতে পারবেন।'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 bg-rose-100 rounded-full opacity-60" />
                      <div className="relative w-20 h-20 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-rose-600/30">
                        <X className="w-11 h-11 stroke-[3]" />
                      </div>
                      <div className="absolute -top-1 right-0 text-rose-500">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                    </div>

                    <h2 className="text-xl font-black text-slate-850">
                      {notice.disagreeTitle || 'আপনি সম্মত হননি'}
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed px-4 whitespace-pre-line">
                      {notice.disagreeMessage || 'আপনি নতুন নিয়মে সম্মতি না দেওয়ায় কিছু সেবা সীমিত থাকতে পারে।\n\nআপনি চাইলে পরে প্রোফাইল থেকে নিয়মগুলো পড়ে সম্মতি দিতে পারবেন।'}
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Progress Indicator Dots */}
        {!showResultScreen && (
          <div className="py-2 flex items-center justify-center gap-2">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <span
                key={idx}
                className={`transition-all duration-300 rounded-full ${
                  currentSlideIndex === idx
                    ? 'w-5 h-2 bg-emerald-600'
                    : 'w-2 h-2 bg-slate-200'
                }`}
              />
            ))}
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="p-5 bg-slate-50 border-t border-slate-100">
          {!showResultScreen ? (
            <div>
              {/* Intro Slide Action */}
              {isIntroSlide && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold rounded-2xl text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <span>{notice.startButtonText || 'চলুন দেখি'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {notice.startCaption || 'আপনি মতামত না দেওয়া পর্যন্ত এটি প্রদর্শিত হবে'}
                  </p>
                </div>
              )}

              {/* Rule Slide Actions (Prev / Next) */}
              {!isIntroSlide && !isFinalDecisionSlide && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="py-3 bg-white hover:bg-slate-100 text-slate-700 font-extrabold rounded-2xl text-xs border border-slate-300 transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>পূর্ববর্তী</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>পরবর্তী</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Final Decision Slide Actions (Disagree / Agree) */}
              {isFinalDecisionSlide && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleDecision(false)}
                    className="py-3 bg-white hover:bg-rose-50 text-rose-600 font-black rounded-2xl text-xs border border-rose-200 shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <X className="w-4 h-4 text-rose-500" />
                    <span>{notice.disagreeButtonText || 'না, আমি সম্মত নই'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision(true)}
                    className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{notice.agreeButtonText || 'হ্যাঁ, আমি সম্মত'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Result Screen Action Button: "ঠিক আছে" */
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleFinalFinish}
              className={`w-full py-3.5 text-white font-black rounded-2xl text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                userDecision === true
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                  : 'bg-slate-800 hover:bg-slate-900 shadow-slate-900/30'
              }`}
            >
              {isSubmitting ? (
                <span>সংরক্ষণ হচ্ছে...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ঠিক আছে</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default MandatoryNoticeModal;
