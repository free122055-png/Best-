import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { AppConfig } from '../types';

export const DEFAULT_QARD_CONFIG = {
  rulesTitle: "কল্যাণমুখী করজে হাসানা (সুদমুক্ত ঋণ) নীতিমালা",
  rulesSubtitle: "করযে হাসানা শর্তাবলি (সংক্ষেপে)",
  rulesList: [
    { id: '1', icon: '🤝', title: 'সম্পূর্ণ বিনা সুদে', description: 'সম্পূর্ণ বিনা সুদে করজে হাসানা (ঋণ) প্রদান করা হবে।' },
    { id: '2', icon: '📅', title: 'সক্রিয়তার শর্ত', description: 'আবেদনকারীকে আমাদের অ্যাপে সর্বনিম্ন ২ মাস সক্রিয় থাকতে হবে এবং এই সময়ে কমপক্ষে AMB টু AMB ২০,০০০ টাকার লেনদেন থাকতে হবে।' },
    { id: '3', icon: '🔍', title: 'এজেন্ট ভেরিফিকেশন', description: 'এরপর আমাদের এজেন্ট যাচাই-বাছাই করে আবেদনকারীর জন্য ঋণের পরিমাণ নির্ধারণ করবেন। কাউকে খালি হাতে ফেরানো হবে না।' },
    { id: '4', icon: '🎯', title: 'ঋণের লিমিট ও ভবিষ্যৎ প্ল্যান', description: 'প্রাথমিকভাবে সর্বনিম্ন ৫০০ টাকা থেকে সর্বোচ্চ ১০,০০০ টাকা পর্যন্ত করজে হাসানা দেওয়া হবে। তবে আমাদের ভবিষ্যৎ পরিকল্পনা আছে বাড়ি করার জন্য এবং বিদেশ যাওয়ার জন্য ৫০,০০০ থেকে ১,০০,০০০ টাকা পর্যন্ত এখান থেকে দেওয়ার জন্য বিনা সুদে।' },
    { id: '5', icon: '⏳', title: 'পরিশোধের মেয়াদ ও কিস্তির নিয়ম', description: 'যেই তারিখে টাকা নিবেন, ঠিক পরের মাসে সেই একই তারিখে পরিশোধ করতে হবে (অর্থাৎ পুরো ৩০ দিন গণনা হবে)। যারা ৩ মাসের জন্য নিবেন ৯০ দিন গণনা হবে তবে প্রতি ৩০ দিন পর পর মোট ৩টি সমান কিস্তিতে পরিশোধ করতে হবে।' },
    { id: '6', icon: '⚠️', title: '২ দিন আগে নোটিফিকেশন ও বিলম্ব জরিমানা', description: 'মেয়াদ শেষ হওয়ার ২ দিন পূর্বে রিমাইন্ডার নোটিফিকেশন পাঠানো হবে। ৩০ দিনের মধ্যে পরিশোধ না করলে প্রতিদিন প্রতি ১,০০০ টাকায় ১০ টাকা হারে বিলম্ব জরিমানা যুক্ত হবে।', isWarning: true },
    { id: '7', icon: '⚡', title: 'সমবায় আমানতের ১% - ৫০% ইনস্ট্যান্ট অটো-ঋণ', description: 'সমিতিতে যাদের সঞ্চয় রয়েছে, তারা যেকোনো সময় (২৪/৭) কোনো এডমিন অনুমোদন ছাড়াই ১ মাস (৩০ দিন) অথবা ৩ মাস (৩ কিস্তি) মেয়াদে ইনস্ট্যান্ট ঋণ নিতে পারবেন।' }
  ],
  verificationNotice: {
    title: "এডমিন প্যানেল ভেরিফিকেশন নোটিশঃ",
    body: "আপনি ঋণের জন্য আবেদন করার পর এডমিন প্যানেল আপনার প্রদানকৃত সচল WhatsApp নম্বরে যোগাযোগ করে প্রয়োজনীয় তথ্য যাচাই (Verification) করবে। যাচাই প্রক্রিয়া সম্পন্ন হওয়ার পর আপনার আবেদন মূল্যায়ন করা হবে। যদি আপনি ঋণ গ্রহণের জন্য যোগ্য ও গ্রহণযোগ্য হন, তাহলে \"আবেদন করুন\" সেকশনের মাধ্যমে আপনাকে অনুমোদনের তথ্য জানিয়ে দেওয়া হবে এবং পরবর্তী নির্দেশনা প্রদান করা হবে।",
    warningNote: "⚠️ অনুগ্রহ করে আপনার WhatsApp নম্বর সচল রাখুন এবং সঠিক তথ্য প্রদান করুন।"
  },
  eligibilityConfig: {
    requiredActiveDays: 60,
    requiredAmbTxVolume: 20000,
    trackerTitle: "আপনার করযে হাসানা যোগ্যতা ট্র্যাকার",
    trackerSubtitle: "ঋণের আবেদন করার জন্য নিম্নলিখিত শর্তাবলী পূরণ করা আবশ্যকঃ"
  },
  minLoanAmount: 500,
  maxLoanAmount: 10000,
  maxDurationMonths: 3,
  coopInstantLoanConfig: {
    enabled: true,
    percentage: 50,
    maxDurationMonths: 3,
    cooldownDays: 90,
    takeStartDay: 1,
    takeEndDay: 31,
    autoDeductStartDay: 1,
    autoDeductEndDay: 31,
    month1Ratio: 33.34,
    month2Ratio: 33.33,
    month3Ratio: 33.33,
    title: "🏢 সমবায় আমানতের ১% - ৫০% ইনস্ট্যান্ট অটো-ঋণ",
    description: "সমিতিতে যাদের একাউন্ট/সঞ্চয় রয়েছে, তারা তাদের জমানো সঞ্চয়ের ১% থেকে ৫০% টাকা (যেমন ১০০ টাকা থাকলে ১-৫০ টাকা) যেকোনো সময় (২৪/৭) কোনো এডমিন অনুমোদন ছাড়াই ইনস্ট্যান্ট অটো-ঋণ নিতে পারবেন। যে তারিখে টাকা নিবেন, ঠিক পরের মাসে সেই একই তারিখে দিতে হবে (ঠিক ৩০ দিন গণনা হবে)। যারা ৩ মাসের জন্য নিবেন ৯০ দিন গণনা হবে তবে প্রতি ৩০ দিন পর পর মোট ৩টি সমান কিস্তিতে দিতে হবে। ৩০ দিনের মধ্যে পরিশোধ না করলে প্রতিদিন প্রতি হাজারে ১০ টাকা করে বিলম্ব জরিমানা কার্যকর হবে।"
  },
  goldLoanConfig: {
    enabled: true,
    protectionMonths: 3,
    protectionDays: 90,
    equalMarketPrice: true,
    extraBenefit: 0,
    noticeTitle: "স্বর্ণ রেখে জরুরি টাকা নীতিমালা",
    noticeSubtitle: "বিপদের সময় পাশে থাকাই আমাদের মূল উদ্দেশ্য",
    rates: {
      k24: 125000,
      k22: 115000,
      k21: 110000,
      k18: 95000,
      traditional: 80000
    },
    guidelines: [
      { id: '1', icon: '👑', title: 'সমবায় সদস্যদের ১০০% সমপরিমাণ লোন সুবিধা', description: 'BNB সমবায় সমিতির সদস্যরা ৩ মাসের জন্য স্বর্ণের সমপরিমাণ (১০০% টাকা) জরুরি লোন নিতে পারবেন এবং ৩ মাসের মধ্যে সমপরিমাণ মূল টাকা পরিশোধ করে অক্ষত অবস্থায় স্বর্ণ ছাড়িয়ে নিতে পারবেন।' },
      { id: '2', icon: '👥', title: 'সাধারণ নাগরিকদের জন্য বাজারদর নীতি', description: 'যাঁরা সমবায় সমিতির সদস্য নন, তাঁরা প্রচলিত বাজার নীতি ও সাধারণ মূল্যায়নের ভিত্তিতে স্বর্ণ রেখে জরুরি আর্থিক সুবিধা গ্রহণ করতে পারবেন।' },
      { id: '3', icon: '💎', title: '০% সুদ ও সুদমুক্ত কল্যাণ সেবা', description: 'করযে হাসানা তহবিলের অধীনে সমবায় সদস্যদের জন্য কোনো প্রকার সুদ, অতিরিক্ত ফি বা লুকানো চার্জ নেই।' },
      { id: '4', icon: '🔒', title: '৩ মাসের সুরক্ষিত ভল্ট হেফাজত', description: 'নির্দিষ্ট ৩ মাস (৯০ দিন) সময়সীমার পূর্বে আপনার সংরক্ষিত স্বর্ণ কোনো অবস্থাতেই বিক্রি বা হস্তান্তর করা হবে না।' },
      { id: '5', icon: '🤝', title: 'টাকা পরিশোধে অক্ষত স্বর্ণ ফেরত', description: 'গৃহীত মূল টাকা পরিশোধ করার সাথে সাথে আপনার গচ্ছিত স্বর্ণ শতভাগ অক্ষত অবস্থায় ফিরিয়ে দেওয়া হবে।' },
      { id: '6', icon: '🏛️', title: 'সিদ্ধান্তের পূর্বে নোটিশ ও ভল্ট ডায়েরি', description: 'মেয়াদ শেষ হলে যেকোনো পদক্ষেপ নেওয়ার পূর্বে সদস্যের সাথে যোগাযোগ করা হবে এবং প্রতিটি অলংকার অফিশিয়াল সিলযুক্ত ভল্টে সংরক্ষিত থাকে।' }
    ]
  }
};

export const DEFAULT_MANDATORY_NOTICE: import('../types').MandatoryNoticeConsent = {
  id: 'notice_rule_v1',
  active: false,
  type: 'rules_consent',
  categoryBadge: 'নতুন নিয়ম',
  title: 'নতুন নিয়মে আপনার অনুমতি প্রয়োজন',
  introText: 'আমাদের সেবার মান উন্নয়ন এবং সদস্যদের নিরাপত্তা নিশ্চিত করতে কিছু নতুন নিয়ম ও আপডেট আনা হয়েছে। অনুমতি দেওয়ার আগে অনুগ্রহ করে সম্পূর্ণ পড়ুন।',
  startButtonText: 'চলুন দেখি',
  startCaption: 'আপনি না বলা পর্যন্ত এটি বারবার আসবে',
  slides: [
    {
      id: 'slide_1',
      badge: 'নতুন নিয়ম',
      iconType: 'security',
      title: '১. একাউন্ট নিরাপত্তা',
      description: 'আপনার একাউন্ট আরও নিরাপদ রাখতে এখন থেকে দুই-ধাপ যাচাইকরণ (2FA) বাধ্যতামূলক করা হয়েছে।\n\nএতে আপনার একাউন্ট সুরক্ষিত থাকবে।',
      bulletPoints: [
        'অননুমোদিত ডিভাইস থেকে প্রবেশ রোধ',
        'নিরাপদ পিন ও নিরাপত্তা সুরক্ষা'
      ]
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
      description: 'সবাই নিয়ম মেনে চললে আমাদের কমিউনিটি আরও শক্তিশালী হবে। আপনার সহযোগিতা আমাদের জন্য গুরুত্বপূর্ণ।',
      footerNote: 'আপনার মূল্যবান মতামত আমাদের সেবাকে আরো গতিশীল করবে'
    }
  ],
  finalQuestion: 'আপনি কি উপরোক্ত নতুন নিয়ম ও শর্তাবলী মেনে নিতে সম্মত?',
  agreeButtonText: 'হ্যাঁ, আমি সম্মত',
  disagreeButtonText: 'না, আমি সম্মত নই',
  allowFeedbackComment: false,
  successTitle: 'ধন্যবাদ!',
  successMessage: 'আপনি নতুন নিয়মে সম্মতি দিয়েছেন।\nএখন থেকে আপনি আমাদের সকল সেবা উপভোগ করতে পারবেন।',
  disagreeTitle: 'আপনি সম্মত হননি',
  disagreeMessage: 'আপনি নতুন নিয়মে সম্মতি না দেওয়ায় কিছু সেবা সীমিত থাকতে পারে।\n\nআপনি চাইলে পরে প্রোফাইল থেকে নিয়মগুলো পড়ে সম্মতি দিতে পারবেন।',
  version: 1
};

export const DEFAULT_CONFIG: AppConfig = {
  mandatoryNotice: DEFAULT_MANDATORY_NOTICE,
  mandatoryNoticeResponses: {},
  phoneChangeConfig: {
    enabled: true,
    freeDaysAfterRegistration: 5,
    freeAttempts: 1,
    feeIncrement: 10,
    maxFee: 50
  },
  historyRetentionDays: 365,
  sectionNotices: {
    samity: "BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর সেকশন নোটিশ: কোম্পানির শেয়ার ও সঞ্চয় জমার ক্ষেত্রে সবসময় অফিসিয়াল নম্বর ব্যবহার করুন।",
    bank: "MY BNB লেনদেন সেকশন নোটিশ: সরাসরি আপনার একাউন্ট থেকে রেমিট্যান্স এবং অভ্যন্তরীণ ফান্ড ক্যাশ ইন/আউট করুন।",
    safedeals: "BNB নিরাপদ লেনদেন সেকশন নোটিশ: পাইকারি ডিল বুকিং করার আগে সেলার বিবরণী ও পণ্যের সঠিক বিবরণ যাচাই করে নিন।",
    telecom: "BNB টেলিকম সেকশন নোটিশ: অটোমেটিক রিচার্জ ও ড্রাইভ প্যাক ফাস্ট ডেলিভারির জন্য ১০ সেকেন্ড থেকে ৫ মিনিট অপেক্ষা করুন।",
    qard: "BNB কর্জে হাসানা সেকশন নোটিশ: সুদমুক্ত ঋণ আবেদন করতে নিয়মাবলী অনুসরণ করুন। দান করে কল্যাণ ফান্ডকে সমৃদ্ধ করুন।",
    ration: "BNB রেশন কার্ড সেকশন নোটিশ: ডিজিটাল রেশন কার্ডের সহায়তায় কম দামে সেরা মানসম্মত রেশন সামগ্রী সংগ্রহ করুন।",
    safi: "safi সাফি ইন-হাউস ব্র্যান্ড সেকশন নোটিশ: শতভাগ ভেজালমুক্ত ও বিশুদ্ধ অর্গানিক পণ্যসামগ্রী অর্ডারে আকর্ষনীয় ছাড় রয়েছে।",
    hisab: "BNB হিসাব খাতা সেকশন নোটিশ: আপনার প্রতিদিনের ব্যক্তিগত ও ব্যবসায়িক আয়ের-ব্যয়ের নিখুঁত হিসাব রাখুন নিরাপদ ডিজিটাল খাতায়।",
    agent: "BNB এজেন্ট পোর্টাল সেকশন নোটিশ: এজেন্ট ও ক্যারিয়ার প্রতিনিধি হিসেবে আপনার কমিশন এবং মেম্বার সুবিধা তদারকি করুন।",
    bap: "AMB এডমিন প্যানেল সেকশন নোটিশ: জাতীয় গেটওয়ে থেকে অ্যাপের বিভিন্ন সিকিউরিটি এবং ভেরিফিকেশন স্টেটাস চেক করুন।",
    about: "AMB লক্ষ্যমাত্রা সেকশন নোটিশ: প্রতিষ্ঠানের কর্পোরেট লক্ষ্য, ভিশন, আগামী দিনের পরিকল্পনা এবং নিয়মনীতি বিস্তারিত পড়ুন।",
    courier: "AMB কুরিয়ার সেকশন নোটিশ: সারাদেশে সুপার ফাস্ট পার্সেল ও লজিস্টিকস ডেলিভারি বুকিং সহজেই গ্রহণ করুন।"
  },
  appName: "AMB Al Mayadin Bazar",
  personalMfsNumber: "01865911728",
  personalBankCard: "4840610010369801",
  supportPhone: "01865911728",
  mfsBkashNumber: "01865911728",
  mfsBkashActive: true,
  mfsNagadNumber: "01865911728",
  mfsNagadActive: true,
  mfsRocketNumber: "01865911728",
  mfsRocketActive: true,
  mfsUpayNumber: "01865911728",
  mfsUpayActive: true,
  paymentBanks: [
    {
      id: "DBBL (ডাচ-বাংলা ব্যাংক)",
      name: "Dutch-Bangla Bank PLC. (DBBL)",
      acronym: "DB",
      branch: "হেমায়েতপুর শাখা",
      routingNum: "090261545",
      holder: "MD SUJON MIA",
      accNum: "2441580395850",
      visaNum: "4840 6100 1036 9801",
      active: true,
      bgClass: "bg-blue-50 hover:bg-blue-100/70 border-blue-100",
      textClass: "text-blue-700",
      logoBgClass: "bg-blue-100"
    },
    {
      id: "Sonali (সোনালী ব্যাংক)",
      name: "Sonali Bank PLC (সোনালী)",
      acronym: "SB",
      branch: "লোকাল অফিস শাখা",
      routingNum: "200261484",
      holder: "MD SUJON MIA",
      accNum: "01029384756",
      visaNum: "",
      active: true,
      bgClass: "bg-emerald-50 hover:bg-emerald-100/70 border-emerald-100",
      textClass: "text-emerald-700",
      logoBgClass: "bg-emerald-100"
    },
    {
      id: "Islami Bank (ইসলামী ব্যাংক)",
      name: "Islami Bank Bangladesh PLC",
      acronym: "IB",
      branch: "Feni, Feni.",
      routingNum: "125300522",
      holder: "MD SAIFUL ISLAM",
      accNum: "20501226700344217",
      visaNum: "",
      active: true,
      bgClass: "bg-teal-50 hover:bg-teal-100/70 border-teal-100",
      textClass: "text-teal-700",
      logoBgClass: "bg-teal-100"
    },
    {
      id: "City Bank (সিটি ব্যাংক)",
      name: "The City Bank PLC (সিটি ব্যাংক)",
      acronym: "CB",
      branch: "গুলশান করপোরেট হেডকোয়ার্টার্স",
      routingNum: "225261453",
      holder: "MD SUJON MIA",
      accNum: "11029384756",
      visaNum: "",
      active: true,
      bgClass: "bg-sky-50 hover:bg-sky-100/70 border-sky-100",
      textClass: "text-sky-700",
      logoBgClass: "bg-sky-100"
    },
    {
      id: "SNB (সৌদি ব্যাংক)",
      name: "SAUDI NATIONAL BANK (SNB ALAHLI)",
      acronym: "SNB",
      branch: "Riyadh Main Branch",
      routingNum: "",
      holder: "BUSINESS NETWORK BANGLADESH",
      accNum: "640000010006087881869",
      iban: "SA50 8000 0640 6080 1788 1869",
      active: true,
      isInternational: true,
      bgClass: "bg-indigo-50 hover:bg-indigo-100/70 border-indigo-200",
      textClass: "text-indigo-800",
      logoBgClass: "bg-indigo-200"
    },
    {
      id: "ENBD (দুবাই ব্যাংক)",
      name: "EMIRATES NBD BANK (DUBAI)",
      acronym: "ENBD",
      branch: "Deira Branch, Dubai",
      routingNum: "",
      holder: "BUSINESS NETWORK BANGLADESH",
      accNum: "120220000987456321458",
      iban: "AE12 0220 0009 8745 6321 458",
      active: true,
      isInternational: true,
      bgClass: "bg-indigo-50 hover:bg-indigo-100/70 border-indigo-200",
      textClass: "text-indigo-800",
      logoBgClass: "bg-indigo-200"
    }
  ],
  samityTerms: "BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর মেম্বারশিপ ফি ৫০০ টাকা নগদ বা রকেট এর মাধ্যমে জমা করে আবেদন সম্পন্ন করুন। আপনার পেমেন্ট ভেরিফাই হয়ে গেলেই সকল প্রিভিলেজ আনলক হবে।",
  tickerText: "BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর সাধারণ ফান্ডে স্বাগতম। আপনি এখান থেকে সঞ্চয় জমা দিতে পারেন, ঋণ আবেদন এবং মুনাফার শেয়ার তুলতে পারেন।",
  samityTicker: "BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর সাধারণ ফান্ডে স্বাগতম। আপনি এখান থেকে সঞ্চয় জমা দিতে পারেন, ঋণ আবেদন এবং মুনাফার শেয়ার তুলতে পারেন।",
  qardTicker: "সুদমুক্ত করযে হাসানা কল্যাণ তহবিলে আপনাকে স্বাগতম। আপনার সামর্থ্য অনুযায়ী দান করে ফান্ড সমৃদ্ধ করুন অথবা প্রয়োজনের সময়ে সুদমুক্ত করযে স্বস্তির নিঃশ্বাস ফেলুন।",
  qardConfig: DEFAULT_QARD_CONFIG,
  telecomTicker: "টেলিকম ফ্লেক্সিলোড ও সুপার ফাস্ট ড্রাইভ অফার গাইডঃ সব অপারেটরের ইনস্ট্যান্ট ক্যাশব্যাক ও বেস্ট ডিসকাউন্টেড অফার ড্রাইভ প্যাকেজ সমূহ সচল রয়েছে। অটোমেটেড রিচার্জ ১০ সেকেন্ড থেকে ৫ মিনিটের মধ্যে সচলভাবে সম্পন্ন হয়।",
  safiTicker: "প্রিমিয়াম Safi ব্র্যান্ডের শতভাগ খাঁটি পণ্য সম্ভার! আমাদের নিজস্ব তত্ত্বাবধানে প্রস্তুতকৃত ভেজালমুক্ত প্রিমিয়াম পণ্যসমূহ সরাসরি মেইন ব্যালেন্স থেকে সহজেই ক্রয় করুন।",
  escrowTicker: "BNB নিরাপদ লেনদেনঃ যেকোনো প্রোডাক্ট কুরিয়ার কন্ডিশনে ক্রয়ের পূর্বে এসক্রো ডিল বুকিং করে আপনার মেইন ব্যালেন্সের পেমেন্ট নিরাপদ করুন।",
  rationTicker: "কো-অপারেটিভ ডিজিটাল রেশন কার্ড সেবাঃ ভর্তুকি মূল্যে নিত্যপ্রয়োজনীয় চাল, ডাল, তেল ও অন্যান্য পণ্যসামগ্রী ক্রয়ের সুবিধা উপভোগ করুন।",
  exchangeRatePerThousand: 1150,
  mobileRechargePercent: 2.0,
  alaapRechargePercent: 1.0,
  brilliantRechargePercent: 1.0,
  coopLoanInterestRate: 5,
  remittanceFeePercent: 1.5,
  remittanceTransferFee: 15,
  shopCategories: [
    { id: 'honey', label: '🍯 মধু ও মৌচাক' },
    { id: 'oil_ghee', label: '🍶 খাঁটি তেল ও ঘি' },
    { id: 'dates', label: '🧆 মিষ্টি খেজুর' },
    { id: 'spices', label: '🌶️ খাঁটি মসলা' },
    { id: 'nuts_seeds', label: '🥜 বাদাম ও বীজ' }
  ],
  telecomCategories: [
    { id: 'Grameenphone', label: 'Grameenphone' },
    { id: 'Robi', label: 'Robi' },
    { id: 'Airtel', label: 'Airtel' },
    { id: 'Banglalink', label: 'Banglalink' },
    { id: 'Teletalk', label: 'Teletalk' },
    { id: 'Alaap', label: 'Alaap' },
    { id: 'Brilliant', label: 'Brilliant' }
  ],
  globalTexts: {
    homeWelcomeTitle: "সমবায় ডিজিটাল ব্যাংকিং নেটওয়ার্ক",
    homeWelcomeSub: "আপনার সঞ্চয় ও ভবিষ্যৎ আর্থিক নিরাপত্তা নিশ্চিতে শতভাগ বিশ্বস্ত সমবায় প্ল্যাটফর্ম।",
    contactUsLabel: "হেল্প ডেস্ক যোগাযোগ",
    supportDeskInfo: "যেকোনো সাহায্য বা তথ্যের জন্য সরাসরি আমাদের হেল্প ডেস্কে কল করুন।",
    loanApplyBtnText: "কিল্যাণ ঋণ আবেদন",
    rationApplyBtnText: "ডিজিটাল রেশন কার্ডের আবেদন",
    sectionAllServicesTitle: "সকল সার্ভিস ও হিসাব খাতা",
    sectionAllServicesBadge: "১২টি লাইভ সেবা ও প্যানেল",
    footerLiveDbNotice: "*এই ড্যাশবোর্ডটি সরাসরি লাইভ ডাটাবেজ দ্বারা পরিচালিত হচ্ছে।",
    
    // Grid Cards
    cardSamityBadge: "কোম্পানি পোর্টাল",
    cardSamityTitle: "BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর",
    cardSamityDesc: "ডিপোজিট ও সঞ্চয়",

    cardSafeDealsBadge: "গ্রুপ বাই ডিল",
    cardSafeDealsTitle: "BNB নিরাপদ লেনদেন",
    cardSafeDealsDesc: "ভেরিফাইড পাইকারি",

    cardQardBadge: "সুদমুক্ত ঋণ",
    cardQardTitle: "BNB কর্জে হাসানা",
    cardQardDesc: "কল্যাণ ঋণ তহবিল",

    cardBankBadge: "রেমিট্যান্স লাইভ",
    cardBankTitle: "MY BNB লেনদেন",
    cardBankDesc: "প্রবাস থেকে পাঠান",

    cardSafiBadge: "ইন-হাউস ব্র্যান্ড",
    cardSafiTitle: "safi সাফি",
    cardSafiDesc: "খাঁটি পণ্য সম্ভার",

    cardTelecomBadge: "রিচার্জ প্যাক",
    cardTelecomTitle: "BNB টেলিকম",
    cardTelecomDesc: "ফ্লেক্সিলোড ও অফার",

    cardShopBadge: "পণ্য অর্ডার",
    cardShopTitle: "BNB সুপার শপ",
    cardShopDesc: "আমানত দিয়ে ক্রয়",

    cardRationBadge: "কার্ড হোল্ডার",
    cardRationTitle: "BNB রেশন কার্ড",
    cardRationDesc: "পাইকারি সুবিধা ও ছাড়",

    cardCourierBadge: "ইন্সট্যান্ট ফার্স্ট ⚡",
    cardCourierTitle: "BNB কুরিয়ার",
    cardCourierDesc: "পার্সেল ও লজিস্টিকস",

    cardAgentBadge: "এজেন্ট পোর্টাল",
    cardAgentTitle: "BNB এজেন্ট",
    cardAgentDesc: "লাভজনক ক্যারিয়ার",

    cardAboutBadge: "পরিচিতি ও গাইড",
    cardAboutTitle: "AMB লক্ষ্যমাত্রা",
    cardAboutDesc: "কোম্পানি প্রোফাইল",

    cardBapBadge: "ন্যাশনাল গেটওয়ে",
    cardBapTitle: "BNB বাংলাদেশ এডমিন প্যানেল",
    cardBapDesc: "ভেরিফিকেশন ও তথ্য সেবা"
  },
  serviceStatus: {
    samity: true,
    bank: true,
    telecom: true,
    shop: true,
    qard: true,
    safedeals: true,
    safi: true,
    ration: true,
    chat: true,
    agent: true,
    about: true,
    bap: true
  },
  maintenanceMode: false,
  maintenanceTitle: "আমরা আপডেট করছি",
  maintenanceDescription: "আপনাদের জন্য আরও উন্নত, দ্রুত ও নিরাপদ সেবা নিশ্চিত করতে আমাদের সিস্টেম বর্তমানে আপডেট করা হচ্ছে।",
  maintenanceEstimatedTime: "৩০ - ৬০ মিনিট",
  maintenanceAnimationUrl: "https://lottie.host/e2c079f4-0544-463f-9177-3e0a0d9bdf11/1qLzO2S2gN.json", // standard gear/maintenance lottie
  maintenanceLogoUrl: "",
  maintenanceBgUrl: "",
  forceUpdateActive: false,
  emailMigrationPopupEnabled: true,
  minAppVersion: "2.0",
  latestAppVersion: "2.0",
  downloadLink: "https://play.google.com/store/apps/details?id=com.amb.business",
  updateTitle: "নতুন সংস্করণ উপলব্ধ!",
  updateDescription: "AMB BUSINESS Network Bangladesh-এর নতুন আপডেট প্রকাশিত হয়েছে। অ্যাপ ব্যবহার চালিয়ে যেতে হলে নতুন ভার্সন ইনস্টল করা বাধ্যতামূলক।",
  telecomDefaultSlabs: [
    { amount: 20, cashback: 0 },
    { amount: 50, cashback: 5 },
    { amount: 100, cashback: 0 },
    { amount: 500, cashback: 0 }
  ],
  oneSignalAppId: "",
  oneSignalRestApiKey: "",
  sectionIcons: {
    samity: "/samity_logo.svg"
  },
  corporateGuide: {
    rules: `১. ১০০% সততা ও নিয়মানুবর্তিতা বজায় রাখতে হবে।
২. আমাদের সকল সেবামূলক কার্যক্রম ও সুদমুক্ত করযে হাসানা ফান্ড শুধুমাত্র নিবন্ধিত মেম্বারদের জন্য প্রযোজ্য।
৩. হিসাব খাতার সকল হিসাব সঠিক ও স্বচ্ছভাবে পরিচালনা করতে হবে।
৪. অ্যাপের কোনো প্রকার অপব্যবহার বা নিয়ম অমান্য করলে মেম্বারশিপ বাতিল হতে পারে।`,
    futurePlans: `১. অতি শীঘ্রই আমাদের গ্রাহকদের জন্য সুদমুক্ত ক্ষুদ্র ব্যবসা ঋণ সুবিধা চালু করা হবে।
২. সারা বাংলাদেশে উপজেলাভিত্তিক এজেন্ট ও প্রতিনিধি নিয়োগ প্রক্রিয়া সম্পন্ন করা।
৩. সাফি প্রিমিয়াম ইন-হাউস ব্রান্ডের নিজস্ব আউটলেট চালু করা।
৪. আন্তর্জাতিক রেমিট্যান্স ক্যাশ পোর্টালের গতি আরও উন্নত করা।`,
    mission: `আমাদের মূল লক্ষ্য হল প্রযুক্তির সঠিক ব্যবহারের মাধ্যমে একটি সুদমুক্ত, বৈষম্যহীন ও স্বনির্ভর অর্থনৈতিক সমাজ বিনির্মাণ করা। গ্রামীণ ও সুবিধাবঞ্চিত ক্ষুদ্র ব্যবসায়ী এবং প্রবাসী ভাই-বোনদের সঞ্চয় একত্রিত করে বড় আকারের লাভজনক যৌথ উদ্যোগে রূপান্তরের মাধ্যমে সবার সামাজিক সমৃদ্ধি অর্জন করা।`,
    feedback: `আমাদের সেবা ও অ্যাপের মান আরও উন্নত করার জন্য আপনার যেকোনো মূল্যবান মতামত, অভিযোগ অথবা পরামর্শ আমাদের কাছে অত্যন্ত গুরুত্বপূর্ণ। সরাসরি কল করুন আমাদের হেল্প ডেস্কে অথবা ইমেইল করুন networkbangladeshambbusiness@gmail.com ঠিকানায়।`
  }
};

export const DEFAULT_SAMITY_INVESTMENTS: import('../types').SamityInvestment[] = [];

export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const configRef = doc(db, 'system_settings', 'app_config');
    const iconsRef = doc(db, 'system_settings', 'section_icons');

    const [docSnap, iconsSnap] = await Promise.all([
      getDoc(configRef),
      getDoc(iconsRef).catch(() => null)
    ]);

    let data: any = {};
    if (docSnap.exists()) {
      data = docSnap.data() as any;
    }

    let iconsData: Record<string, string> = {};
    if (iconsSnap && iconsSnap.exists()) {
      iconsData = (iconsSnap.data() as Record<string, string>) || {};
    }

    // Migration / fallback: if legacy app_config still has sectionIcons, merge and clean it
    if (data.sectionIcons && typeof data.sectionIcons === 'object') {
      iconsData = { ...data.sectionIcons, ...iconsData };
      try {
        await updateDoc(configRef, { sectionIcons: deleteField() });
      } catch (e) {}
      delete data.sectionIcons;
    }

    if (!iconsData.samity) {
      iconsData.samity = "/samity_logo.svg";
    }
    data.sectionIcons = iconsData;

    let updated = false;
    if (!data.globalTexts) {
      data.globalTexts = {};
    }
    if (data.globalTexts.cardSafeDealsTitle === "AMB নিরাপদ ডিল" || !data.globalTexts.cardSafeDealsTitle) {
      data.globalTexts.cardSafeDealsTitle = "BNB নিরাপদ লেনদেন";
      updated = true;
    }
    if (data.globalTexts.cardBankTitle === "AMB ব্যাংক" || data.globalTexts.cardBankTitle === "BNB লেনদেন" || !data.globalTexts.cardBankTitle) {
      data.globalTexts.cardBankTitle = "MY BNB লেনদেন";
      updated = true;
    }
    if (data.escrowTicker === "AMB নিরাপদ ডিলঃ যেকোনো প্রোডাক্ট কুরিয়ার কন্ডিশনে ক্রয়ের পূর্বে এসক্রো ডিল বুকিং করে আপনার মেইন ব্যালেন্সের পেমেন্ট নিরাপদ করুন।" || !data.escrowTicker) {
      data.escrowTicker = "BNB নিরাপদ লেনদেনঃ যেকোনো প্রোডাক্ট কুরিয়ার কন্ডিশনে ক্রয়ের পূর্বে এসক্রো ডিল বুকিং করে আপনার মেইন ব্যালেন্সের পেমেন্ট নিরাপদ করুন।";
      updated = true;
    }
    if (updated) {
      try {
        const { sectionIcons: _discard, ...toSave } = data;
        await setDoc(configRef, toSave, { merge: true });
      } catch (e) {
        console.error("Failed to migrate app config in Firestore:", e);
      }
    }
    return { ...DEFAULT_CONFIG, ...data } as AppConfig;
  } catch (err) {
    console.warn("Failed to load DB config, using local default values:", err);
    return DEFAULT_CONFIG;
  }
}

export function sanitizeConfig(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeConfig(item));
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = sanitizeConfig(value);
    }
  }
  return result;
}

export async function saveAppConfig(newConfig: AppConfig): Promise<void> {
  try {
    const configRef = doc(db, 'system_settings', 'app_config');
    const sanitized = sanitizeConfig(newConfig);
    // Exclude sectionIcons from app_config to prevent hitting the 1MB Firestore document limit
    const { sectionIcons, ...configWithoutIcons } = sanitized;
    await setDoc(configRef, configWithoutIcons, { merge: true });

    // Persist sectionIcons to dedicated system_settings/section_icons document if provided
    if (sectionIcons && typeof sectionIcons === 'object' && Object.keys(sectionIcons).length > 0) {
      const iconsRef = doc(db, 'system_settings', 'section_icons');
      await setDoc(iconsRef, sectionIcons, { merge: true });
    }

    try {
      localStorage.setItem('amb_app_config', JSON.stringify({ ...DEFAULT_CONFIG, ...sanitized }));
    } catch (e) {}
  } catch (err) {
    console.error("Failed to save DB config:", err);
    throw err;
  }
}

export async function saveSectionIcon(sectionKey: string, iconDataUrl: string): Promise<void> {
  try {
    const iconsRef = doc(db, 'system_settings', 'section_icons');
    if (!iconDataUrl || iconDataUrl.trim() === '') {
      if (sectionKey === 'samity') {
        await setDoc(iconsRef, { samity: "/samity_logo.svg" }, { merge: true });
      } else {
        await updateDoc(iconsRef, {
          [sectionKey]: deleteField()
        });
      }
    } else {
      await setDoc(iconsRef, {
        [sectionKey]: iconDataUrl
      }, { merge: true });
    }

    // Remove from app_config if legacy key still exists to keep app_config slim
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      await updateDoc(configRef, {
        [`sectionIcons.${sectionKey}`]: deleteField(),
        sectionIcons: deleteField()
      });
    } catch (e) {
      // Ignored if key doesn't exist
    }
    
    try {
      const cached = localStorage.getItem('amb_app_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.sectionIcons = parsed.sectionIcons || {};
        if (!iconDataUrl) {
          if (sectionKey === 'samity') {
            parsed.sectionIcons.samity = "/samity_logo.svg";
          } else {
            delete parsed.sectionIcons[sectionKey];
          }
        } else {
          parsed.sectionIcons[sectionKey] = iconDataUrl;
        }
        localStorage.setItem('amb_app_config', JSON.stringify(parsed));
      }
    } catch (e) {}
  } catch (err) {
    console.error("Failed to update section icon in Firestore:", err);
    throw err;
  }
}

