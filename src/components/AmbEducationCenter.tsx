import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { 
  ChevronLeft, 
  Search, 
  Bell, 
  BookOpen, 
  Bookmark, 
  Share2, 
  Sparkles, 
  Clock, 
  Check, 
  X, 
  Plus, 
  ChevronRight, 
  Home, 
  Grid, 
  FolderHeart, 
  Heart, 
  User as UserIcon,
  Flame,
  ThumbsUp,
  BookmarkCheck,
  Compass,
  Smile,
  BookMarked
} from 'lucide-react';

interface EduPost {
  id?: string;
  title: string;
  content: string;
  category: string;
  timeAgo: string;
  image: string;
  createdAt?: string;
}

interface PrayerTime {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

interface AmbEducationCenterProps {
  user: User | null;
  onBack: () => void;
  appConfig: AppConfig | null;
}

export default function AmbEducationCenter({ user, onBack, appConfig }: AmbEducationCenterProps) {
  // Tabs: 'home' | 'categories' | 'bookmarks' | 'my-readings' | 'profile'
  const [eduTab, setEduTab] = useState<'home' | 'categories' | 'bookmarks' | 'my-readings' | 'profile'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Firestore posts
  const [posts, setPosts] = useState<EduPost[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]); // Array of post IDs
  const [readCount, setReadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Prayer times state
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime>({
    fajr: '04:15 AM',
    dhuhr: '12:30 PM',
    asr: '04:45 PM',
    maghrib: '06:33 PM',
    isha: '08:00 PM'
  });

  // Default seed data for educational posts
  const defaultPosts: EduPost[] = [
    {
      title: 'সততার সাথে ব্যবসা করার গুরুত্ব',
      content: 'হালাল ব্যবসার মাধ্যমে দুনিয়া ও আখিরাতে সফলতা অর্জন করুন। সততা ও ন্যায়পরায়ণতা একজন আদর্শ ব্যবসায়ীর অন্যতম গুণ।',
      category: 'হালাল ব্যবসা শিক্ষা',
      timeAgo: '2 ঘণ্টা আগে',
      image: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=600&auto=format&fit=crop'
    },
    {
      title: 'আল্লাহর উপর ভরসা ও তাওয়াক্কুল',
      content: 'তাওয়াক্কুল বা আল্লাহর উপর অগাধ বিশ্বাস মানুষের জীবনে প্রশান্তি ও সফলতা নিয়ে আসে। প্রতিটি কাজে আল্লাহর সন্তুষ্টি অর্জনই মূল লক্ষ্য হওয়া উচিত।',
      category: 'ইসলামী শিক্ষা',
      timeAgo: '5 ঘণ্টা আগে',
      image: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?q=80&w=600&auto=format&fit=crop'
    },
    {
      title: 'সময় ব্যবস্থাপনার 10টি কার্যকর উপায়',
      content: 'সময়কে সঠিকভাবে কাজে লাগিয়ে অলসতা দূর করুন এবং নিজের লক্ষ্য পূরণে একধাপ এগিয়ে যান। সফল জীবনের চাবিকাঠি সময়ানুবর্তিতা।',
      category: 'आत्मউন্নয়ন',
      timeAgo: '1 দিন আগে',
      image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=600&auto=format&fit=crop'
    },
    {
      title: 'সুদমুক্ত ব্যবসার উপকারিতা',
      content: 'সুদমুক্ত অর্থব্যবস্থা সমাজ ও অর্থনীতিতে ইনসাফ কায়েম করে। ব্যবসা হোক কল্যাণকর ও শোষণমুক্ত।',
      category: 'হালাল ব্যবসা শিক্ষা',
      timeAgo: '2 দিন আগে',
      image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=600&auto=format&fit=crop'
    }
  ];

  // Load data from Firestore
  useEffect(() => {
    if (!user?.uid) return;

    // Load Posts
    const qPosts = query(collection(db, 'edu_posts'));
    const unsubPosts = onSnapshot(qPosts, async (snapshot) => {
      if (snapshot.empty) {
        // Seed default posts if none exist in firestore
        setLoading(true);
        try {
          for (const item of defaultPosts) {
            await addDoc(collection(db, 'edu_posts'), {
              ...item,
              createdAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error('Error seeding edu_posts:', err);
        }
        setLoading(false);
      } else {
        const list: EduPost[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as EduPost);
        });
        setPosts(list);
        setLoading(false);
      }
    });

    // Load Bookmarks
    const qBook = query(collection(db, 'edu_bookmarks'), where('userId', '==', user.uid));
    const unsubBook = onSnapshot(qBook, (snapshot) => {
      const list: string[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.postId) list.push(data.postId);
      });
      setBookmarks(list);
    });

    // Load user read count metric
    const qRead = query(collection(db, 'edu_read_logs'), where('userId', '==', user.uid));
    const unsubRead = onSnapshot(qRead, (snapshot) => {
      setReadCount(snapshot.size);
    });

    return () => {
      unsubPosts();
      unsubBook();
      unsubRead();
    };
  }, [user?.uid]);

  // Handle Bookmarks Toggle
  const toggleBookmark = async (postId: string) => {
    if (!user?.uid) return;

    try {
      const q = query(collection(db, 'edu_bookmarks'), where('userId', '==', user.uid), where('postId', '==', postId));
      const snap = await getDocs(q);

      if (!snap.empty) {
        // Delete bookmark
        snap.forEach(async (docSnap) => {
          await deleteDoc(doc(db, 'edu_bookmarks', docSnap.id));
        });
      } else {
        // Add bookmark
        await addDoc(collection(db, 'edu_bookmarks'), {
          userId: user.uid,
          postId,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Read Counter Log
  const handlePostClick = async (postId: string) => {
    if (!user?.uid) return;

    try {
      const q = query(collection(db, 'edu_read_logs'), where('userId', '==', user.uid), where('postId', '==', postId));
      const snap = await getDocs(q);

      if (snap.empty) {
        await addDoc(collection(db, 'edu_read_logs'), {
          userId: user.uid,
          postId,
          readAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Categories list exactly matching the icons and titles in screenshot
  const categoriesList = [
    { title: 'ইসলামী শিক্ষা', icon: '🕌', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { title: 'নামাজের সময়সূচি', icon: '⏰', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { title: 'হালাল ব্যবসা শিক্ষা', icon: '💼', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { title: 'সাধারণ শিক্ষা', icon: '📖', color: 'bg-purple-50 text-purple-600 border-purple-100' },
    { title: 'আত্মউন্নয়ন', icon: '🌱', color: 'bg-teal-50 text-teal-600 border-teal-100' },
    { title: 'দোয়া ও আমল', icon: '🤲', color: 'bg-sky-50 text-sky-600 border-sky-100' },
    { title: 'নৈতিক শিক্ষা', icon: '❤️', color: 'bg-rose-50 text-rose-600 border-rose-100' },
    { title: 'পরিবার ও সমাজ', icon: '👨‍👩‍👧‍👦', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { title: 'জীবন গঠন', icon: '✍️', color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
    { title: 'অনুপ্রেরণা', icon: '⭐', color: 'bg-orange-50 text-orange-600 border-orange-100' }
  ];

  // Filter posts
  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? post.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-full min-h-screen bg-[#f3f4f6] pb-24 font-sans select-none relative" id="amb-education-center-root">
      
      {/* Top Header with Dark Green exact replica */}
      <div className="bg-[#0b543c] px-4 pt-3 pb-4 text-white shadow-md relative">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all active:scale-90"
              id="edu-back-btn"
            >
              <ChevronLeft className="w-5.5 h-5.5 text-white stroke-[2.5]" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-[13px] tracking-wide text-[#00a884] bg-white px-2 py-0.5 rounded leading-none">AMB</span>
                <h1 className="text-sm xs:text-base font-black tracking-tight text-white leading-none">
                  জ্ঞান ও শিক্ষা কেন্দ্র
                </h1>
              </div>
              <p className="text-[10px] xs:text-[10.5px] font-bold text-slate-300 mt-0.5">
                ইলম অর্জন করো, জীবন গড়ো
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
              <Search className="w-4.5 h-4.5 text-white" />
            </button>
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center relative">
              <Bell className="w-4.5 h-4.5 text-white" />
              <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 rounded-full border border-[#0b543c] text-[8px] font-extrabold flex items-center justify-center text-white">
                5
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container Content */}
      <div className="max-w-4xl mx-auto px-3 xs:px-4 mt-4 space-y-4">

        {/* -------------------- TAB 1: HOME -------------------- */}
        {eduTab === 'home' && (
          <>
            {/* Today's Quranic Verse Hero Card exact replica */}
            <div className="bg-gradient-to-r from-[#0b543c] to-[#043324] rounded-2xl overflow-hidden border border-[#043324] shadow-md text-white relative">
              
              <div className="grid grid-cols-12 items-center p-4 gap-4">
                
                {/* Quran Image left side */}
                <div className="col-span-4 xs:col-span-5 flex justify-center items-center">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-[#00a884]/20 blur-xl rounded-full"></div>
                    <img 
                      src="https://images.unsplash.com/photo-1609599006353-e629f1d40968?q=80&w=350&auto=format&fit=crop" 
                      alt="Holy Quran" 
                      className="w-full max-w-[120px] xs:max-w-[140px] rounded-xl object-cover shadow-lg relative z-10 border border-emerald-500/20"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                {/* Arabic text & Bengali right side */}
                <div className="col-span-8 xs:col-span-7 space-y-2 text-right">
                  <span className="inline-block bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[9px] xs:text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1">
                    আজকের কুরআনের আয়াত
                  </span>
                  
                  {/* Arabic block */}
                  <div className="text-right text-[15px] xs:text-[18px] sm:text-[20px] font-medium text-emerald-100 leading-normal tracking-wide" dir="rtl">
                    وَمَنْ يَتَّقِ اللَّهَ يَجْعَلْ لَهُ مَخْرَجًا
                  </div>

                  {/* Bengali interpretation */}
                  <p className="text-[10px] xs:text-[11.5px] text-slate-200 leading-snug font-medium">
                    আর যে ব্যক্তি আল্লাহকে ভয় করে, আল্লাহ তার জন্য কোন না কোন পথ বের করে দেন।
                  </p>

                  <div className="text-[9px] xs:text-[10px] text-emerald-400 font-extrabold uppercase mt-1">
                    সূরা আত-তালাক | আয়াতঃ 2
                  </div>
                </div>

              </div>

              {/* Bottom Dot indicators simulator */}
              <div className="pb-3 flex justify-center gap-1.5">
                <div className="w-4 h-1.5 rounded-full bg-[#00a884]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
              </div>

            </div>

            {/* Grid of 4 horizontal info blocks: হাদিস, ব্যবসা শিক্ষা, অনুপ্রেরণা, নামাজের সময় */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              
              {/* Card 1: আজকের হাদিস */}
              <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    📚
                  </div>
                  <h4 className="text-[11px] font-black text-emerald-600 tracking-tight">আজকের হাদিস</h4>
                </div>
                <p className="text-[11px] xs:text-[12px] font-bold text-slate-800 leading-relaxed min-h-[36px]">
                  "সততা ঈমানের অংশ।"
                </p>
                <span className="text-[9px] font-black text-slate-400 mt-2 block">
                  (সহীহ বুখারীঃ 60)
                </span>
              </div>

              {/* Card 2: হালাল ব্যবসার শিক্ষা */}
              <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    💼
                  </div>
                  <h4 className="text-[11px] font-black text-blue-600 tracking-tight">হালাল ব্যবসার শিক্ষা</h4>
                </div>
                <p className="text-[11px] xs:text-[12px] font-bold text-slate-800 leading-relaxed min-h-[36px]">
                  "সততা ও ন্যায়পরায়ণতা ব্যবসার মূল ভিত্তি।"
                </p>
                <span className="text-[9px] font-black text-slate-400 mt-2 block">
                  আল-হাদিস গাইড
                </span>
              </div>

              {/* Card 3: আজকের অনুপ্রেরণা */}
              <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                    💡
                  </div>
                  <h4 className="text-[11px] font-black text-amber-600 tracking-tight">আজকের অনুপ্রেরণা</h4>
                </div>
                <p className="text-[11px] xs:text-[12px] font-bold text-slate-800 leading-relaxed min-h-[36px]">
                  সফলতা তাদের জন্য, যারা আল্লাহর উপর ভরসা করে চেষ্টা করে।
                </p>
                <span className="text-[9px] font-black text-slate-400 mt-2 block">
                  সফলতা প্রেরণা
                </span>
              </div>

              {/* Card 4: আজকের নামাজের সময়সূচি */}
              <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2 justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                      ⏰
                    </div>
                    <h4 className="text-[11px] font-black text-purple-600 tracking-tight">নামাজের সময়</h4>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] font-extrabold text-slate-700 py-1">
                  <div className="flex justify-between">
                    <span>ফজর</span>
                    <span className="font-black text-slate-900">{prayerTimes.fajr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>যোহর</span>
                    <span className="font-black text-slate-900">{prayerTimes.dhuhr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>আসর</span>
                    <span className="font-black text-slate-900">{prayerTimes.asr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>মাগরিব</span>
                    <span className="font-black text-slate-900">{prayerTimes.maghrib}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>এশা</span>
                    <span className="font-black text-slate-900">{prayerTimes.isha}</span>
                  </div>
                </div>

                <button 
                  onClick={() => { setSelectedCategory('নামাজের সময়সূচি'); setEduTab('categories'); }}
                  className="text-[9.5px] font-black text-purple-600 hover:underline text-right mt-1.5 block w-full border-t border-slate-50 pt-1"
                >
                  সব সময় দেখুন
                </button>
              </div>

            </div>

            {/* প্রধান বিভাগসমূহ (Main Categories) exact replica with rounded circles */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-800">
                  প্রধান বিভাগসমূহ
                </h3>
                <button 
                  onClick={() => setEduTab('categories')}
                  className="text-[11px] font-black text-[#00a884] hover:underline"
                >
                  সব দেখুন
                </button>
              </div>

              {/* Grid of category icons */}
              <div className="grid grid-cols-5 gap-3 text-center">
                {categoriesList.slice(0, 10).map((cat, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedCategory(cat.title);
                      setEduTab('categories');
                    }}
                    className="flex flex-col items-center group transition-all duration-150 active:scale-95"
                  >
                    <div className={`w-11 h-11 xs:w-12 xs:h-12 rounded-full flex items-center justify-center text-lg shadow-3xs border transition-transform duration-200 group-hover:scale-105 ${cat.color}`}>
                      {cat.icon}
                    </div>
                    <span className="text-[9px] xs:text-[10px] font-black text-slate-700 leading-tight mt-1.5 max-w-[65px] truncate">
                      {cat.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* সাম্প্রতিক পোস্ট (Recent Posts) exact replica list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800">
                  সাম্প্রতিক পোস্ট
                </h3>
                <span className="text-[10px] font-extrabold text-[#00a884] bg-[#e6f7f4] border border-[#00a884]/30 px-2.5 py-0.5 rounded-full">
                  লাইভ পোস্টসমূহ
                </span>
              </div>

              <div className="space-y-3">
                {filteredPosts.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center text-slate-400 font-bold border border-slate-100">
                    কোনো পোস্ট পাওয়া যায়নি।
                  </div>
                ) : (
                  filteredPosts.map((post, idx) => {
                    const isBookmarked = bookmarks.includes(post.id || '');
                    
                    return (
                      <div 
                      key={`${post.id || idx}-${idx}`}
                        className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex gap-3 hover:shadow-2xs transition-shadow duration-150 cursor-pointer"
                        onClick={() => handlePostClick(post.id || '')}
                      >
                        {/* Image Left */}
                        <div className="w-20 h-20 xs:w-24 xs:h-24 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                          <img 
                            src={post.image} 
                            alt={post.title} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Text Content Middle & Actions Right */}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-[12px] xs:text-[13px] font-black text-slate-800 leading-snug line-clamp-2">
                              {post.title}
                            </h4>
                            <p className="text-[10px] xs:text-[11px] text-slate-500 font-medium line-clamp-2 mt-1 leading-normal">
                              {post.content}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                {post.category}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {post.timeAgo}
                              </span>
                            </div>

                            {/* Bookmark / Share Buttons */}
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button 
                                onClick={() => toggleBookmark(post.id || '')}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                  isBookmarked 
                                    ? 'bg-amber-50 text-amber-500 border border-amber-200' 
                                    : 'bg-slate-50 text-slate-400 border border-slate-100 hover:text-slate-600'
                                }`}
                              >
                                <Bookmark className="w-3.5 h-3.5 fill-current" />
                              </button>
                              <button 
                                onClick={() => {
                                  if (navigator.share) {
                                    navigator.share({ title: post.title, text: post.content });
                                  } else {
                                    alert('কপি করা হয়েছেঃ ' + post.title);
                                  }
                                }}
                                className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* -------------------- TAB 2: CATEGORIES -------------------- */}
        {eduTab === 'categories' && (
          <div className="space-y-4" id="categories-tab-content">
            
            {/* Filter by Category Header */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-800 mb-3">বিভাগ নির্বাচন করুন</h3>
              
              <div className="flex flex-wrap gap-1.5">
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${
                    selectedCategory === null 
                      ? 'bg-[#00a884] text-white border-[#00a884]' 
                      : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  সব বিভাগ ({posts.length})
                </button>

                {categoriesList.map((cat, idx) => {
                  const count = posts.filter(p => p.category === cat.title).length;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedCategory(cat.title)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${
                        selectedCategory === cat.title 
                          ? 'bg-[#00a884] text-white border-[#00a884]' 
                          : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      {cat.icon} {cat.title} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List of filtered posts */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                {selectedCategory || 'সব'} বিভাগের পোস্টসমূহ ({filteredPosts.length})
              </h4>

              {filteredPosts.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-slate-400 font-bold border border-slate-100">
                  এই বিভাগে কোনো পোস্ট পাওয়া যায়নি।
                </div>
              ) : (
                filteredPosts.map((post, idx) => {
                  const isBookmarked = bookmarks.includes(post.id || '');
                  return (
                    <div 
                      key={`${post.id || idx}-${idx}`}
                      className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex gap-3 hover:shadow-2xs transition-shadow duration-150 cursor-pointer"
                      onClick={() => handlePostClick(post.id || '')}
                    >
                      <div className="w-20 h-20 xs:w-24 xs:h-24 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                        <img src={post.image} alt={post.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[12px] xs:text-[13px] font-black text-slate-800 leading-snug">
                            {post.title}
                          </h4>
                          <p className="text-[10px] xs:text-[11px] text-slate-500 font-medium line-clamp-2 mt-1 leading-normal">
                            {post.content}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                              {post.category}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {post.timeAgo}
                            </span>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => toggleBookmark(post.id || '')}
                              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                isBookmarked 
                                  ? 'bg-amber-50 text-amber-500 border border-amber-200' 
                                  : 'bg-slate-50 text-slate-400 border border-slate-100'
                              }`}
                            >
                              <Bookmark className="w-3.5 h-3.5 fill-current" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* -------------------- TAB 3: BOOKMARKS -------------------- */}
        {eduTab === 'bookmarks' && (
          <div className="space-y-4" id="bookmarks-tab-content">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-800">আমার বুকমার্কসমূহ</h3>
              <p className="text-[11px] text-slate-400 font-bold mt-1">আপনার সেভ করে রাখা প্রয়োজনীয় পোস্ট ও নির্দেশনাবলি</p>
            </div>

            <div className="space-y-3">
              {posts.filter(p => bookmarks.includes(p.id || '')).length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400 font-black border border-slate-100">
                  <div className="text-3xl mb-2">🔖</div>
                  কোনো বুকমার্ক পোস্ট পাওয়া যায়নি।
                </div>
              ) : (
                posts.filter(p => bookmarks.includes(p.id || '')).map((post, idx) => (
                  <div 
                    key={`${post.id || idx}-${idx}`}
                    className="bg-white rounded-2xl p-3 border border-slate-100 shadow-3xs flex gap-3 hover:shadow-2xs transition-shadow duration-150 cursor-pointer"
                    onClick={() => handlePostClick(post.id || '')}
                  >
                    <div className="w-20 h-20 xs:w-24 xs:h-24 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                      <img src={post.image} alt={post.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-[12px] xs:text-[13px] font-black text-slate-800 leading-snug">
                          {post.title}
                        </h4>
                        <p className="text-[10px] xs:text-[11px] text-slate-500 font-medium line-clamp-2 mt-1 leading-normal">
                          {post.content}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          {post.category}
                        </span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleBookmark(post.id || ''); }}
                          className="text-[10px] font-black text-red-500 hover:underline"
                        >
                          মুছে ফেলুন
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* -------------------- TAB 4: MY READINGS -------------------- */}
        {eduTab === 'my-readings' && (
          <div className="space-y-4" id="readings-tab-content">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-2xl">
                📈
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">আমার পড়ার খতিয়ান</h3>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">আপনি এ পর্যন্ত মোট {readCount} টি সেশন বা পোস্ট পড়েছেন</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-3xs space-y-3">
              <h4 className="text-xs font-black text-slate-800">ডেইলি স্ট্রাইক ও লার্নিং টার্গেট</h4>
              
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-black py-2 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">পড়ার হার</span>
                  <span className="text-[13.5px] font-black text-emerald-600 mt-1 block">{readCount * 10}%</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">ডেইলি স্ট্রাইক</span>
                  <span className="text-[13.5://] font-black text-orange-600 mt-1 block">3 দিন 🔥</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">অর্জিত পয়েন্ট</span>
                  <span className="text-[13.5px] font-black text-blue-600 mt-1 block">{readCount * 50} XP</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- TAB 5: PROFILE -------------------- */}
        {eduTab === 'profile' && (
          <div className="space-y-4" id="profile-tab-content">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-[#00a884] flex items-center justify-center mx-auto text-3xl mb-2 overflow-hidden">
                👨‍🎓
              </div>
              <h3 className="text-[15px] font-black text-slate-800">{user?.name || 'শিক্ষার্থী মেম্বার'}</h3>
              <p className="text-[10.5px] font-extrabold text-slate-400 mt-0.5">ID: {user?.phone || 'AMB Member'}</p>
              
              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-left">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">মোট পঠিত প্রবন্ধঃ</span>
                  <span className="text-sm font-black text-[#00a884]">{readCount} টি</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">লার্নিং স্ট্যাটাসঃ</span>
                  <span className="text-sm font-black text-[#00a884]">অ্যাক্টিভ মেম্বার</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Beautiful Sticky Bottom Tab Bar Replica exactly like screenshot */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-150 py-2.5 z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex items-center justify-around font-sans">
          
          <button 
            onClick={() => { setEduTab('home'); setSelectedCategory(null); }}
            className={`flex flex-col items-center justify-center text-center transition-all ${
              eduTab === 'home' ? 'text-[#00a884] scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[9.5px] font-black mt-1">হোম</span>
          </button>

          <button 
            onClick={() => setEduTab('categories')}
            className={`flex flex-col items-center justify-center text-center transition-all ${
              eduTab === 'categories' ? 'text-[#00a884] scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Grid className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[9.5px] font-black mt-1">বিভাগসমূহ</span>
          </button>

          <button 
            onClick={() => setEduTab('bookmarks')}
            className={`flex flex-col items-center justify-center text-center transition-all ${
              eduTab === 'bookmarks' ? 'text-[#00a884] scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Bookmark className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[9.5px] font-black mt-1">বুকমার্ক</span>
          </button>

          <button 
            onClick={() => setEduTab('my-readings')}
            className={`flex flex-col items-center justify-center text-center transition-all ${
              eduTab === 'my-readings' ? 'text-[#00a884] scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BookMarked className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[9.5px] font-black mt-1">আমার পড়া</span>
          </button>

          <button 
            onClick={() => setEduTab('profile')}
            className={`flex flex-col items-center justify-center text-center transition-all ${
              eduTab === 'profile' ? 'text-[#00a884] scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <UserIcon className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[9.5px] font-black mt-1">প্রোফাইল</span>
          </button>

        </div>
      </div>

    </div>
  );
}
