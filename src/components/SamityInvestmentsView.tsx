import React, { useState, useEffect, useRef } from 'react';
import { User, SamityInvestment, SamityInvestmentCategory, SamityInvestmentStatus, SamityInvestmentComment } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { useBackHandler } from '../lib/navigationManager';
import UnifiedBackButton from './UnifiedBackButton';
import { 
  TrendingUp, 
  Sparkles, 
  Coins, 
  Landmark, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Heart, 
  ThumbsDown,
  MessageCircle, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Image as ImageIcon, 
  Search, 
  ArrowLeft, 
  ShieldCheck, 
  Eye, 
  Clock, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Send,
  Building2,
  Wheat,
  Briefcase,
  Layers,
  Award,
  Check,
  AlertTriangle,
  RotateCcw,
  UploadCloud,
  Camera,
  Maximize2,
  Users,
  SmilePlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SamityInvestmentsViewProps {
  user: User;
  onBack: () => void;
  isAdmin?: boolean;
}

const CATEGORIES: { id: SamityInvestmentCategory | 'all'; label: string; icon: any; color: string }[] = [
  { id: 'all', label: 'সব ইনভেস্ট', icon: Layers, color: 'from-slate-700 to-slate-900' },
  { id: 'gold', label: '🪙 স্বর্ণ ইনভেস্ট', icon: Coins, color: 'from-amber-500 to-yellow-600' },
  { id: 'land', label: '🏞️ জমি ও প্লট', icon: Landmark, color: 'from-emerald-600 to-teal-700' },
  { id: 'agro', label: '🌾 কৃষি ও খামার', icon: Wheat, color: 'from-green-600 to-emerald-700' },
  { id: 'business', label: '🏢 ব্যবসা ও শেয়ার', icon: Building2, color: 'from-blue-600 to-indigo-700' },
  { id: 'other', label: '📦 অন্যান্য প্রকল্প', icon: Briefcase, color: 'from-purple-600 to-indigo-700' },
];

const PRESET_IMAGES = [
  { label: '🏞️ জমি ও আবাসন', url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80' },
  { label: '🪙 স্বর্ণ ও গোল্ড বার', url: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80' },
  { label: '🌾 ডেইরি ও কৃষি খামার', url: 'https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&w=1200&q=80' },
  { label: '🏢 বাণিজ্যিক ভবন ও দোকান', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80' },
  { label: '🚚 ট্রান্সপোর্ট ও লজিস্টিকস', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80' },
  { label: '🐟 মৎস্য ও ফিশারিজ', url: 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=1200&q=80' },
];

export default function SamityInvestmentsView({ user, onBack, isAdmin }: SamityInvestmentsViewProps) {
  const [investments, setInvestments] = useState<SamityInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<SamityInvestmentCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<SamityInvestmentStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Post Creator/Editor Modal States
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingPost, setEditingPost] = useState<SamityInvestment | null>(null);
  
  // Post Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<SamityInvestmentCategory>('land');
  const [formStatus, setFormStatus] = useState<SamityInvestmentStatus>('active');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formBuyAmount, setFormBuyAmount] = useState('');
  const [formSellAmount, setFormSellAmount] = useState('');
  const [formProfitAmount, setFormProfitAmount] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formInvestmentDate, setFormInvestmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [formSaleDate, setFormSaleDate] = useState('');
  const [formDurationText, setFormDurationText] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Gallery File Upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit before processing (e.g. 15MB max)
    if (file.size > 15 * 1024 * 1024) {
      setFormError('ছবির সাইজ 15 মেগাবাইটের চেয়ে ছোট হতে হবে।');
      return;
    }

    setIsCompressingImage(true);
    setFormError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress to efficient JPEG format
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            setFormImageUrl(dataUrl);
          }
          setIsCompressingImage(false);
        } catch (canvasErr) {
          console.error("Canvas compression error:", canvasErr);
          // Fallback to direct dataUrl
          setFormImageUrl(event.target?.result as string);
          setIsCompressingImage(false);
        }
      };
      img.onerror = () => {
        setIsCompressingImage(false);
        setFormError('ছবিটি লোড করতে সমস্যা হয়েছে। অন্য ছবি বেছে নিন।');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsCompressingImage(false);
      setFormError('ফাইল পড়তে সমস্যা হয়েছে।');
    };
    reader.readAsDataURL(file);
  };

  // Lightbox Zoom
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Expanded Captions Map
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});

  // Comments Popup Modal States (Facebook-style dedicated bottom sheet/modal)
  const [commentModalPost, setCommentModalPost] = useState<SamityInvestment | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Reaction Details Modal (Who liked/disliked - on Long Press or Click)
  const [reactionDetailsModalPost, setReactionDetailsModalPost] = useState<SamityInvestment | null>(null);
  const [reactionTab, setReactionTab] = useState<'all' | 'likes' | 'dislikes'>('all');
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Comment Edit & Delete States (5-minute edit window, anytime delete)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<{ postId: string; commentId: string; commentText: string } | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  // Toast / Copy Message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper to convert any number/integer to neat Bengali digits with commas and NO decimals
  const formatBnNum = (num: number | string | undefined | null): string => {
    if (num === undefined || num === null || num === '') return '0';
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return '0';
    const rounded = Math.round(n);
    const formattedString = rounded.toLocaleString('en-US');
    const bnDigits: { [key: string]: string } = {
      '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
    };
    return formattedString.replace(/\d/g, (d) => bnDigits[d] || d);
  };

  // In-app Delete Modals (Avoids blocked window.confirm in iframe)
  const [postToDelete, setPostToDelete] = useState<SamityInvestment | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isUserAdmin = isAdmin || user.role === 'admin' || user.role === 'sub_admin';

  // 1. Real-time Subscription to `samity_investments` collection in Firestore
  useEffect(() => {
    const invColRef = collection(db, 'samity_investments');
    const unsub = onSnapshot(invColRef, (snapshot) => {
      if (!snapshot.empty) {
        const loaded: SamityInvestment[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as any;
          // Calculate strictly genuine counts based on actual arrays
          const actualLikedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
          const actualDislikedBy = Array.isArray(data.dislikedBy) ? data.dislikedBy : [];
          const actualComments = Array.isArray(data.comments) ? data.comments : [];
          
          return {
            id: docSnap.id,
            ...data,
            likedBy: actualLikedBy,
            dislikedBy: actualDislikedBy,
            comments: actualComments,
            likesCount: actualLikedBy.length,
            dislikesCount: actualDislikedBy.length,
            // If legacy viewsCount was inflated (e.g. >= 100 from old test data), clean it to real view count
            viewsCount: (Number(data.viewsCount) || 0) >= 100 ? 1 : (Number(data.viewsCount) || 0)
          } as SamityInvestment;
        });

        // Auto-sanitize legacy fake counts in Firestore so database is permanently accurate
        snapshot.docs.forEach(docSnap => {
          const raw = docSnap.data();
          const realLikes = Array.isArray(raw.likedBy) ? raw.likedBy.length : 0;
          const realDislikes = Array.isArray(raw.dislikedBy) ? raw.dislikedBy.length : 0;
          const rawViews = Number(raw.viewsCount) || 0;
          const rawLikes = Number(raw.likesCount) || 0;
          const rawDislikes = Number(raw.dislikesCount) || 0;

          if (rawViews >= 100 || rawLikes !== realLikes || rawDislikes !== realDislikes) {
            updateDoc(docSnap.ref, {
              likesCount: realLikes,
              dislikesCount: realDislikes,
              ...(rawViews >= 100 ? { viewsCount: 1 } : {})
            }).catch(() => {});
          }
        });

        // Sort pinned first, then newest first
        loaded.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
        setInvestments(loaded);
        // Sync active open modals with fresh realtime data
        if (commentModalPost) {
          const fresh = loaded.find(p => p.id === commentModalPost.id);
          if (fresh) setCommentModalPost(fresh);
        }
        if (reactionDetailsModalPost) {
          const fresh = loaded.find(p => p.id === reactionDetailsModalPost.id);
          if (fresh) setReactionDetailsModalPost(fresh);
        }
      } else {
        setInvestments([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore onSnapshot error on samity_investments:", error);
      setInvestments([]);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 2. Real View Counter: increment real views in Firestore once per post per session
  useEffect(() => {
    if (investments.length === 0) return;
    investments.forEach((post) => {
      const sessionKey = `viewed_inv_post_${post.id}`;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, 'true');
        const postRef = doc(db, 'samity_investments', post.id);
        updateDoc(postRef, {
          viewsCount: (Number(post.viewsCount) || 0) + 1
        }).catch(() => {});
      }
    });
  }, [investments.length]);

  // Filtered investments
  const filteredInvestments = investments.filter(inv => {
    if (selectedCategory !== 'all' && inv.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && inv.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (inv.title || '').toLowerCase().includes(q);
      const matchDesc = (inv.description || '').toLowerCase().includes(q);
      const matchLoc = (inv.location || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchLoc) return false;
    }
    return true;
  });

  // Aggregate Stats
  const totalInvestedAmount = investments.reduce((sum, item) => sum + (Number(item.buyAmount) || 0), 0);
  const totalSoldAmount = investments.reduce((sum, item) => sum + (Number(item.sellAmount) || 0), 0);
  const totalRealizedProfits = investments
    .reduce((sum, item) => sum + (Number(item.profitAmount) || 0), 0);
  const activeCount = investments.filter(item => item.status === 'active').length;
  const soldCount = investments.filter(item => item.status === 'sold' || (Number(item.sellAmount) || 0) > 0).length;

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingPost(null);
    setFormTitle('');
    setFormCategory('land');
    setFormStatus('active');
    setFormDescription('');
    setFormImageUrl(PRESET_IMAGES[0].url);
    setFormBuyAmount('');
    setFormSellAmount('');
    setFormProfitAmount('');
    setFormLocation('');
    setFormInvestmentDate(new Date().toISOString().split('T')[0]);
    setFormSaleDate('');
    setFormDurationText('');
    setFormIsPinned(false);
    setFormError('');
    setFormSuccess('');
    setShowPostModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (post: SamityInvestment) => {
    setEditingPost(post);
    setFormTitle(post.title || '');
    setFormCategory(post.category || 'land');
    setFormStatus(post.status || 'active');
    setFormDescription(post.description || '');
    setFormImageUrl(post.imageUrl || '');
    setFormBuyAmount(post.buyAmount ? String(post.buyAmount) : '');
    setFormSellAmount(post.sellAmount ? String(post.sellAmount) : '');
    setFormProfitAmount(post.profitAmount ? String(post.profitAmount) : '');
    setFormLocation(post.location || '');
    setFormInvestmentDate(post.investmentDate || new Date().toISOString().split('T')[0]);
    setFormSaleDate(post.saleDate || '');
    setFormDurationText(post.durationText || '');
    setFormIsPinned(post.isPinned || false);
    setFormError('');
    setFormSuccess('');
    setShowPostModal(true);
  };

  // Auto-calculate profit when buy/sell amount changes
  const handleCalculateProfit = (buyStr: string, sellStr: string) => {
    const buy = parseFloat(buyStr) || 0;
    const sell = parseFloat(sellStr) || 0;
    if (sell > 0 && buy > 0) {
      const diff = sell - buy;
      setFormProfitAmount(String(diff));
    }
  };

  // Submit Post to Firestore
  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('অনুগ্রহ করে পোস্টের শিরোনাম দিন।');
      return;
    }
    if (!formDescription.trim()) {
      setFormError('অনুগ্রহ করে বিস্তারিত বর্ণনা বা ফেসবুক পোস্টের মতো গল্প লিখুন।');
      return;
    }

    const buyNum = parseFloat(formBuyAmount) || 0;
    const sellNum = parseFloat(formSellAmount) || 0;
    const profitNum = parseFloat(formProfitAmount) || (sellNum > buyNum ? sellNum - buyNum : 0);
    const roi = buyNum > 0 && profitNum > 0 ? parseFloat(((profitNum / buyNum) * 100).toFixed(2)) : 0;

    setIsSubmitting(true);
    setFormError('');

    try {
      const postId = editingPost ? editingPost.id : `inv-${Date.now()}`;
      const postData: any = {
        id: postId,
        title: formTitle.trim(),
        category: formCategory || 'other',
        categoryLabel: CATEGORIES.find(c => c.id === formCategory)?.label || 'সাধারণ ইনভেস্ট',
        status: formStatus || 'active',
        description: formDescription.trim(),
        imageUrl: formImageUrl ? formImageUrl.trim() : '',
        buyAmount: buyNum,
        sellAmount: sellNum,
        profitAmount: profitNum,
        roiPercentage: roi,
        location: formLocation ? formLocation.trim() : '',
        investmentDate: formInvestmentDate || new Date().toISOString().split('T')[0],
        saleDate: formStatus === 'sold' ? (formSaleDate || new Date().toISOString().split('T')[0]) : '',
        durationText: formDurationText ? formDurationText.trim() : '',
        likesCount: editingPost?.likedBy && Array.isArray(editingPost.likedBy) ? editingPost.likedBy.length : 0,
        likedBy: editingPost?.likedBy && Array.isArray(editingPost.likedBy) ? editingPost.likedBy : [],
        likedUsers: editingPost?.likedUsers && Array.isArray(editingPost.likedUsers) ? editingPost.likedUsers : [],
        dislikesCount: editingPost?.dislikedBy && Array.isArray(editingPost.dislikedBy) ? editingPost.dislikedBy.length : 0,
        dislikedBy: editingPost?.dislikedBy && Array.isArray(editingPost.dislikedBy) ? editingPost.dislikedBy : [],
        dislikedUsers: editingPost?.dislikedUsers && Array.isArray(editingPost.dislikedUsers) ? editingPost.dislikedUsers : [],
        viewsCount: editingPost ? (Number(editingPost.viewsCount) || 0) : 0,
        comments: editingPost?.comments && Array.isArray(editingPost.comments) ? editingPost.comments : [],
        authorName: 'BNB ইনভেস্টমেন্ট বোর্ড / ম্যানেজমেন্ট',
        authorRole: 'ভেরিফায়েড সেন্ট্রাল বোর্ড',
        isPinned: Boolean(formIsPinned),
        createdAt: editingPost?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Ensure no undefined properties exist anywhere
      Object.keys(postData).forEach(key => {
        if (postData[key] === undefined) {
          delete postData[key];
        }
      });

      await setDoc(doc(db, 'samity_investments', postId), postData, { merge: true });
      
      setFormSuccess(editingPost ? 'পোস্টটি সফলভাবে আপডেট করা হয়েছে!' : 'নতুন ইনভেস্টমেন্ট পোস্ট সফলভাবে পাবলিশ করা হয়েছে!');
      setTimeout(() => {
        setShowPostModal(false);
        setFormSuccess('');
      }, 1200);
    } catch (err: any) {
      console.error("Error saving investment post:", err);
      setFormError('পোস্ট সেভ করতে সমস্যা হয়েছে: ' + (err?.message || 'অজানা ত্রুটি'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prompt Delete Single Post
  const handlePromptDeletePost = (post: SamityInvestment) => {
    setPostToDelete(post);
  };

  // Confirm Delete Single Post
  const handleConfirmDeletePost = async () => {
    if (!postToDelete) return;
    setIsDeletingPost(true);
    try {
      await deleteDoc(doc(db, 'samity_investments', postToDelete.id));
      setInvestments(prev => prev.filter(p => p.id !== postToDelete.id));
      showToast("পোস্টটি সফলভাবে মুছে ফেলা হয়েছে।");
      setPostToDelete(null);
    } catch (err: any) {
      console.error("Error deleting post:", err);
      showToast("পোস্ট ডিলিট করতে সমস্যা হয়েছে: " + (err?.message || ''));
    } finally {
      setIsDeletingPost(false);
    }
  };

  // Confirm Delete All Posts (Reset to Zero)
  const handleConfirmDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      const invColRef = collection(db, 'samity_investments');
      const snapshot = await getDocs(invColRef);
      const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
      setInvestments([]);
      showToast("সকল পোস্ট সফলভাবে মুছে ফেলা হয়েছে (হিসাব 0 করা হয়েছে)।");
      setShowDeleteAllModal(false);
    } catch (err: any) {
      console.error("Error deleting all posts:", err);
      showToast("মুছে ফেলতে সমস্যা হয়েছে: " + (err?.message || ''));
    } finally {
      setIsDeletingAll(false);
    }
  };

  // 3. Toggle Like / Love on Post (Real accounts only with user details stored)
  const handleToggleLike = async (post: SamityInvestment) => {
    if (!user?.uid) {
      showToast("লাইক দিতে অনুগ্রহ করে লগইন করুন।");
      return;
    }
    const isLiked = (post.likedBy || []).includes(user.uid);
    const isDisliked = (post.dislikedBy || []).includes(user.uid);
    const postRef = doc(db, 'samity_investments', post.id);

    const currentUserReactionObj = {
      uid: user.uid,
      name: user.name || 'সম্মানিত সদস্য',
      memberId: user.memberId || 'MEMBER',
      photoURL: user.photoURL || '',
      reactedAt: new Date().toISOString()
    };

    try {
      if (isLiked) {
        // Remove like
        const updatedLikedBy = (post.likedBy || []).filter(id => id !== user.uid);
        const updatedLikedUsers = (post.likedUsers || []).filter(u => u.uid !== user.uid);
        await updateDoc(postRef, {
          likedBy: updatedLikedBy,
          likedUsers: updatedLikedUsers,
          likesCount: updatedLikedBy.length
        });
      } else {
        // Add like & if previously disliked, remove dislike
        const updatedLikedBy = [...(post.likedBy || []).filter(id => id !== user.uid), user.uid];
        const updatedLikedUsers = [...(post.likedUsers || []).filter(u => u.uid !== user.uid), currentUserReactionObj];
        const updatedDislikedBy = (post.dislikedBy || []).filter(id => id !== user.uid);
        const updatedDislikedUsers = (post.dislikedUsers || []).filter(u => u.uid !== user.uid);
        
        await updateDoc(postRef, {
          likedBy: updatedLikedBy,
          likedUsers: updatedLikedUsers,
          likesCount: updatedLikedBy.length,
          dislikedBy: updatedDislikedBy,
          dislikedUsers: updatedDislikedUsers,
          dislikesCount: updatedDislikedBy.length
        });
      }
    } catch (e) {
      console.error("Error toggling like:", e);
    }
  };

  // 4. Toggle Dislike on Post (Real accounts only)
  const handleToggleDislike = async (post: SamityInvestment) => {
    if (!user?.uid) {
      showToast("ডিসলাইক দিতে অনুগ্রহ করে লগইন করুন।");
      return;
    }
    const isDisliked = (post.dislikedBy || []).includes(user.uid);
    const isLiked = (post.likedBy || []).includes(user.uid);
    const postRef = doc(db, 'samity_investments', post.id);

    const currentUserReactionObj = {
      uid: user.uid,
      name: user.name || 'সম্মানিত সদস্য',
      memberId: user.memberId || 'MEMBER',
      photoURL: user.photoURL || '',
      reactedAt: new Date().toISOString()
    };

    try {
      if (isDisliked) {
        // Remove dislike
        const updatedDislikedBy = (post.dislikedBy || []).filter(id => id !== user.uid);
        const updatedDislikedUsers = (post.dislikedUsers || []).filter(u => u.uid !== user.uid);
        await updateDoc(postRef, {
          dislikedBy: updatedDislikedBy,
          dislikedUsers: updatedDislikedUsers,
          dislikesCount: updatedDislikedBy.length
        });
      } else {
        // Add dislike & if previously liked, remove like
        const updatedDislikedBy = [...(post.dislikedBy || []).filter(id => id !== user.uid), user.uid];
        const updatedDislikedUsers = [...(post.dislikedUsers || []).filter(u => u.uid !== user.uid), currentUserReactionObj];
        const updatedLikedBy = (post.likedBy || []).filter(id => id !== user.uid);
        const updatedLikedUsers = (post.likedUsers || []).filter(u => u.uid !== user.uid);

        await updateDoc(postRef, {
          dislikedBy: updatedDislikedBy,
          dislikedUsers: updatedDislikedUsers,
          dislikesCount: updatedDislikedBy.length,
          likedBy: updatedLikedBy,
          likedUsers: updatedLikedUsers,
          likesCount: updatedLikedBy.length
        });
      }
    } catch (e) {
      console.error("Error toggling dislike:", e);
    }
  };

  // 5. Open Reaction Details Modal (Who liked/disliked)
  const handleOpenReactionDetails = (post: SamityInvestment, initialTab: 'all' | 'likes' | 'dislikes' = 'all') => {
    setReactionDetailsModalPost(post);
    setReactionTab(initialTab);
  };

  // Long-press helper for reactions inspection (Facebook style)
  const handleTouchStartReaction = (post: SamityInvestment, tab: 'likes' | 'dislikes') => {
    longPressTimerRef.current = setTimeout(() => {
      handleOpenReactionDetails(post, tab);
    }, 450);
  };

  const handleTouchEndReaction = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // 6. Handle Add Member Comment (Facebook popup style)
  const handleAddComment = async (postId: string) => {
    if (!commentInput.trim() || !user?.uid) return;
    setIsPostingComment(true);

    const newComment: SamityInvestmentComment = {
      id: `comment-${Date.now()}`,
      userId: user.uid,
      userName: user.name || 'সম্মানিত সদস্য',
      userPhone: user.phone || '',
      comment: commentInput.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      const postRef = doc(db, 'samity_investments', postId);
      await updateDoc(postRef, {
        comments: arrayUnion(newComment)
      });
      setCommentInput('');
      showToast("আপনার মন্তব্যটি সফলভাবে প্রকাশিত হয়েছে!");
    } catch (e) {
      console.error("Error posting comment:", e);
      showToast("মন্তব্য পাঠাতে সমস্যা হয়েছে।");
    } finally {
      setIsPostingComment(false);
    }
  };

  // 7. Check if comment was created within 5 minutes (5 * 60 * 1000 ms)
  const isWithin5Minutes = (createdAt: string) => {
    if (!createdAt) return false;
    const elapsed = Date.now() - new Date(createdAt).getTime();
    return elapsed >= 0 && elapsed <= 5 * 60 * 1000;
  };

  const getRemainingEditMinutes = (createdAt: string) => {
    if (!createdAt) return 0;
    const elapsed = Date.now() - new Date(createdAt).getTime();
    const remaining = 5 * 60 * 1000 - elapsed;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / (60 * 1000));
  };

  const handleStartEditComment = (cm: SamityInvestmentComment) => {
    if (!isWithin5Minutes(cm.createdAt)) {
      showToast("⚠️ 5 মিনিট পার হয়ে যাওয়ায় মন্তব্যটি আর এডিট করা যাবে না।");
      return;
    }
    setEditingCommentId(cm.id);
    setEditingCommentText(cm.comment);
  };

  const handleSaveEditedComment = async (postId: string, commentId: string) => {
    if (!editingCommentText.trim() || !user?.uid) return;
    setIsUpdatingComment(true);

    try {
      const postRef = doc(db, 'samity_investments', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) {
        showToast("পোস্টটি পাওয়া যায়নি।");
        setIsUpdatingComment(false);
        return;
      }

      const currentComments: SamityInvestmentComment[] = postSnap.data()?.comments || [];
      const targetComment = currentComments.find(c => c.id === commentId);

      if (!targetComment) {
        showToast("মন্তব্যটি পাওয়া যায়নি।");
        setIsUpdatingComment(false);
        return;
      }

      if (targetComment.userId !== user.uid && !isUserAdmin) {
        showToast("আপনি শুধুমাত্র আপনার নিজের মন্তব্য এডিট করতে পারবেন।");
        setIsUpdatingComment(false);
        return;
      }

      if (!isWithin5Minutes(targetComment.createdAt)) {
        showToast("⚠️ 5 মিনিট পার হয়ে যাওয়ায় মন্তব্যটি আর এডিট করা যাবে না।");
        setEditingCommentId(null);
        setIsUpdatingComment(false);
        return;
      }

      const updatedComments = currentComments.map(c => {
        if (c.id === commentId) {
          return {
            ...c,
            comment: editingCommentText.trim(),
            editedAt: new Date().toISOString()
          };
        }
        return c;
      });

      await updateDoc(postRef, {
        comments: updatedComments
      });

      setEditingCommentId(null);
      setEditingCommentText('');
      showToast("আপনার মন্তব্যটি সফলভাবে এডিট করা হয়েছে!");
    } catch (e) {
      console.error("Error updating comment:", e);
      showToast("মন্তব্য এডিট করতে সমস্যা হয়েছে।");
    } finally {
      setIsUpdatingComment(false);
    }
  };

  const handleConfirmDeleteComment = async () => {
    if (!commentToDelete || !user?.uid || isDeletingComment) return;
    const { postId, commentId } = commentToDelete;
    setIsDeletingComment(true);

    try {
      const postRef = doc(db, 'samity_investments', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) {
        showToast("পোস্টটি পাওয়া যায়নি।");
        setCommentToDelete(null);
        return;
      }

      const currentComments: SamityInvestmentComment[] = postSnap.data()?.comments || [];
      const targetComment = currentComments.find(c => c.id === commentId);

      if (!targetComment) {
        showToast("মন্তব্যটি পাওয়া যায়নি।");
        setCommentToDelete(null);
        return;
      }

      if (targetComment.userId !== user.uid && !isUserAdmin) {
        showToast("আপনি শুধুমাত্র আপনার নিজের মন্তব্য ডিলিট করতে পারবেন।");
        setCommentToDelete(null);
        return;
      }

      const updatedComments = currentComments.filter(c => c.id !== commentId);

      await updateDoc(postRef, {
        comments: updatedComments
      });

      setCommentToDelete(null);
      showToast("মন্তব্যটি সফলভাবে মুছে ফেলা হয়েছে।");
    } catch (e) {
      console.error("Error deleting comment:", e);
      showToast("মন্তব্য মুছতে সমস্যা হয়েছে।");
    } finally {
      setIsDeletingComment(false);
    }
  };

  // Stepwise back handler: Closes any open modal/popup first, then goes back to parent screen
  const handleStepBack = () => {
    if (commentToDelete) { setCommentToDelete(null); return true; }
    if (editingCommentId) { setEditingCommentId(null); return true; }
    if (commentModalPost) { setCommentModalPost(null); return true; }
    if (reactionDetailsModalPost) { setReactionDetailsModalPost(null); return true; }
    if (showPostModal) { setShowPostModal(false); setEditingPost(null); return true; }
    if (showDeleteAllModal) { setShowDeleteAllModal(false); return true; }
    if (selectedCategory !== 'all') { setSelectedCategory('all'); return true; }
    onBack();
    return true;
  };

  // Register with global back navigation manager (priority 35)
  useBackHandler(() => {
    return handleStepBack();
  }, true, 35);

  return (
    <div className="space-y-3 sm:space-y-4 pb-20 text-left max-w-2xl mx-auto">
      
      {/* 1. Header Navigation Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-3 sm:p-4 shadow-md relative overflow-hidden border border-indigo-500/30">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between gap-2 relative z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <UnifiedBackButton
              onClick={() => handleStepBack()}
              variant="dark"
              title="পিছনে যান"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  আমাদের ইনভেস্ট (Our Investments)
                </h2>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse">
                  লাইভ
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-300 font-medium mt-0.5">
                স্বর্ণ, জমি ও লাভজনক প্রকল্পের স্বচ্ছ ক্রয়-বিক্রয় ও লাভ হিসেব
              </p>
            </div>
          </div>

          {/* Admin Create & Manage Action Buttons */}
          {isUserAdmin && (
            <div className="flex items-center gap-1.5 shrink-0">
              {investments.length > 0 && (
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-rose-600/90 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-[11px] sm:text-xs font-black shadow-md flex items-center gap-1 transition cursor-pointer border border-rose-400/40"
                  title="সকল ডেমো পোস্ট মুছে হিসাব 0 করুন"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">সব মুছুন (0 করুন)</span>
                  <span className="sm:hidden">0 করুন</span>
                </button>
              )}
              <button
                onClick={handleOpenCreateModal}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span className="hidden sm:inline">নতুন পোস্ট</span>
                <span className="sm:hidden">পোস্ট</span>
              </button>
            </div>
          )}
        </div>

        {/* Aggregate Stats Summary Bar (4 Cards in a SINGLE Sleek Row) */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2 mt-2 pt-2 border-t border-white/10 relative z-10 text-center">
          {/* Card 1: মোট ক্রয় */}
          <div className="bg-white/5 border border-white/10 rounded-xl py-1 px-1 sm:py-1.5 sm:px-2 flex flex-col justify-center">
            <span className="block text-[7.5px] sm:text-[9.5px] text-slate-300 font-semibold truncate leading-tight">মোট ক্রয়</span>
            <strong className="text-[10px] sm:text-xs font-black text-emerald-400 font-mono block mt-0.5 leading-tight truncate">
              ৳{formatBnNum(totalInvestedAmount)}
            </strong>
          </div>

          {/* Card 2: মোট বিক্রি */}
          <div className="bg-white/5 border border-white/10 rounded-xl py-1 px-1 sm:py-1.5 sm:px-2 flex flex-col justify-center">
            <span className="block text-[7.5px] sm:text-[9.5px] text-cyan-300 font-semibold truncate leading-tight">মোট বিক্রি</span>
            <strong className="text-[10px] sm:text-xs font-black text-cyan-300 font-mono block mt-0.5 leading-tight truncate">
              ৳{formatBnNum(totalSoldAmount)}
            </strong>
          </div>

          {/* Card 3: নিট মুনাফা */}
          <div className="bg-white/5 border border-white/10 rounded-xl py-1 px-1 sm:py-1.5 sm:px-2 flex flex-col justify-center">
            <span className="block text-[7.5px] sm:text-[9.5px] text-amber-300 font-semibold truncate leading-tight">নিট মুনাফা</span>
            <strong className="text-[10px] sm:text-xs font-black text-amber-300 font-mono block mt-0.5 leading-tight truncate">
              ৳{formatBnNum(totalRealizedProfits)}
            </strong>
          </div>

          {/* Card 4: মোট প্রজেক্ট */}
          <div className="bg-white/5 border border-white/10 rounded-xl py-1 px-1 sm:py-1.5 sm:px-2 flex flex-col justify-center">
            <span className="block text-[7.5px] sm:text-[9.5px] text-indigo-300 font-semibold truncate leading-tight">মোট প্রজেক্ট</span>
            <strong className="text-[10px] sm:text-xs font-black text-white font-mono block mt-0.5 leading-tight truncate">
              {formatBnNum(investments.length)}টি ({formatBnNum(soldCount)})
            </strong>
          </div>
        </div>
      </div>

      {/* 2. Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer shrink-0 text-[11px] sm:text-xs flex items-center gap-1 ${
                isSelected 
                  ? 'bg-slate-900 text-white shadow-xs scale-102 ring-2 ring-emerald-500/40' 
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{cat.label}</span>
              {isSelected && <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />}
            </button>
          );
        })}
      </div>

      {/* 3. Sub-filter: Status & Search Filter */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9.5px] sm:text-[10px] font-black transition cursor-pointer shrink-0 ${
              selectedStatus === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            সব স্ট্যাটাস
          </button>
          <button
            onClick={() => setSelectedStatus('active')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9.5px] sm:text-[10px] font-black transition cursor-pointer shrink-0 ${
              selectedStatus === 'active' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            🟢 চলমান
          </button>
          <button
            onClick={() => setSelectedStatus('sold')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9.5px] sm:text-[10px] font-black transition cursor-pointer shrink-0 ${
              selectedStatus === 'sold' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            💰 বিক্রি ও লাভ
          </button>
          <button
            onClick={() => setSelectedStatus('new')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9.5px] sm:text-[10px] font-black transition cursor-pointer shrink-0 ${
              selectedStatus === 'new' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            🚀 নতুন
          </button>
        </div>

        {/* Search */}
        <div className="relative shrink-0 w-24 sm:w-32">
          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-6 pr-1.5 py-0.5 sm:py-1 bg-white border border-slate-200 rounded-lg text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
          />
        </div>
      </div>

      {/* 4. Facebook-Style Feed List */}
      {loading ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-150 space-y-2">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">ইনভেস্টমেন্ট পোস্ট লোড হচ্ছে...</p>
        </div>
      ) : filteredInvestments.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-150 space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
            🔍
          </div>
          <h3 className="text-sm font-black text-slate-800">কোনো ইনভেস্টমেন্ট পোস্ট পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-500">
            ফিল্টার পরিবর্তন করুন অথবা এডমিন প্যানেল থেকে নতুন পোস্ট পাবলিশ করুন।
          </p>
          {isUserAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="mt-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl"
            >
              প্রথম পোস্ট তৈরি করুন
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-3.5">
          {filteredInvestments.map((post) => {
            const isExpanded = !!expandedCaptions[post.id];
            const isLiked = user?.uid ? (post.likedBy || []).includes(user.uid) : false;
            const commentsCount = (post.comments || []).length;

            return (
              <article
                key={post.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs transition hover:shadow-sm"
              >
                {/* 1. Post Header (Facebook Style - Sleek & Compact) */}
                <div className="p-2.5 sm:p-3 flex items-center justify-between gap-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    {/* Avatar with Verified Icon */}
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white flex items-center justify-center font-black shadow-xs text-sm border border-white">
                        🏛️
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 bg-blue-600 text-white rounded-full p-0.5 shadow-2xs" title="ভেরিফায়েড ইনভেস্টমেন্ট বোর্ড">
                        <CheckCircle2 className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs sm:text-[12.5px] font-black text-slate-900 leading-tight">
                        {post.authorName || 'BNB ইনভেস্টমেন্ট বোর্ড / ম্যানেজমেন্ট'}
                      </h3>
                      <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-500 mt-0.5">
                        <span className="font-semibold">{post.authorRole || 'সেন্ট্রাল বোর্ড'}</span>
                        <span>•</span>
                        <span className="text-slate-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {post.investmentDate || new Date(post.createdAt).toLocaleDateString('bn-BD')}
                        </span>
                        <span>•</span>
                        <span className="text-slate-400" title="সর্বজনীন দৃশ্যমান">🌐</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Tag & Admin Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {post.status === 'sold' && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[8.5px] font-black flex items-center gap-0.5">
                        💰 লাভসহ বিক্রি
                      </span>
                    )}
                    {post.status === 'active' && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-[8.5px] font-black flex items-center gap-0.5 animate-pulse">
                        🟢 চলমান
                      </span>
                    )}
                    {post.status === 'new' && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-[8.5px] font-black flex items-center gap-0.5">
                        🚀 নতুন
                      </span>
                    )}

                    {/* Admin Edit & Delete buttons */}
                    {isUserAdmin && (
                      <div className="flex items-center gap-0.5 ml-0.5">
                        <button
                          onClick={() => handleOpenEditModal(post)}
                          className="p-1 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition cursor-pointer"
                          title="পোস্ট এডিট করুন"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handlePromptDeletePost(post)}
                          className="p-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          title="পোস্ট মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Post Title & Rich Caption Text */}
                <div className="px-3 pt-2 pb-1.5">
                  <h4 className="text-xs sm:text-[13px] font-black text-slate-900 leading-snug mb-1">
                    {post.title}
                  </h4>

                  {/* Facebook formatted story text */}
                  <div className="text-[11px] sm:text-[11.5px] text-slate-700 font-normal leading-relaxed whitespace-pre-line">
                    {isExpanded || post.description.length <= 180 ? (
                      post.description
                    ) : (
                      <>
                        {post.description.slice(0, 180)}...
                        <button
                          onClick={() => setExpandedCaptions(prev => ({ ...prev, [post.id]: true }))}
                          className="text-indigo-600 font-bold ml-1 hover:underline cursor-pointer"
                        >
                          আরও দেখুন
                        </button>
                      </>
                    )}
                  </div>

                  {isExpanded && post.description.length > 180 && (
                    <button
                      onClick={() => setExpandedCaptions(prev => ({ ...prev, [post.id]: false }))}
                      className="text-slate-400 text-[9.5px] font-bold mt-0.5 hover:underline cursor-pointer block"
                    >
                      সংক্ষিপ্ত করুন
                    </button>
                  )}
                </div>

                {/* 3. Financial Highlight Card (স্বর্ণ, জমি ও ক্রয়-বিক্রয় লাভ ড্যাশবোর্ড - Compact & Sleek) */}
                <div className="mx-2.5 my-1 p-2 bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-slate-200 rounded-xl">
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    
                    {/* 1. ক্রয় মূল্য / ইনভেস্ট */}
                    <div className="bg-white p-1.5 rounded-lg border border-slate-200/80 shadow-2xs flex flex-col justify-center">
                      <span className="block text-[7.5px] sm:text-[8px] font-black text-slate-500 uppercase tracking-tight">🏷️ ক্রয় মূল্য / ইনভেস্ট</span>
                      <strong className="text-[11px] sm:text-xs font-black text-slate-900 font-mono block mt-0.5">
                        ৳ {formatBnNum(post.buyAmount)}
                      </strong>
                      <span className="text-[7px] text-slate-400 font-bold block">
                        (কেনার খরচ)
                      </span>
                    </div>

                    {/* 2. বিক্রি করলাম কতো / বিক্রয় মূল্য */}
                    <div className={`p-1.5 rounded-lg border shadow-2xs flex flex-col justify-center ${
                      post.status === 'sold' || (Number(post.sellAmount) > 0) 
                        ? 'bg-blue-50/90 border-blue-200' 
                        : 'bg-white border-slate-200/80'
                    }`}>
                      <span className="block text-[7.5px] sm:text-[8px] font-black text-blue-700 uppercase tracking-tight">
                        💰 বিক্রি করলাম কতো
                      </span>
                      <strong className="text-[11px] sm:text-xs font-black text-blue-900 font-mono block mt-0.5">
                        {post.status === 'sold' || (Number(post.sellAmount) > 0) 
                          ? `৳ ${formatBnNum(post.sellAmount)}` 
                          : 'এখনো বিক্রি হয়নি'}
                      </strong>
                      <span className="text-[7px] font-bold block text-blue-600">
                        {post.status === 'sold' || (Number(post.sellAmount) > 0) 
                          ? '✅ বিক্রি সম্পন্ন' 
                          : '(হেফাজতে সংরক্ষিত)'}
                      </span>
                    </div>

                    {/* 3. লাভ হলো কতো / নিট মুনাফা */}
                    <div className={`p-1.5 rounded-lg border shadow-2xs flex flex-col justify-center ${
                      post.status === 'sold' || (Number(post.profitAmount) > 0) 
                        ? 'bg-emerald-50/90 border-emerald-300' 
                        : 'bg-white border-slate-200/80'
                    }`}>
                      <span className="block text-[7.5px] sm:text-[8px] font-black text-emerald-800 uppercase tracking-tight">
                        {post.status === 'sold' || (Number(post.profitAmount) > 0) ? '✨ লাভ হলো কতো' : '💎 বর্তমান মূল্যায়ন লাভ'}
                      </span>
                      <strong className="text-[11px] sm:text-xs font-black text-emerald-700 font-mono block mt-0.5">
                        {post.status === 'sold' || (Number(post.profitAmount) > 0) ? `+৳ ${formatBnNum(post.profitAmount)}` : '0 ৳'}
                      </strong>
                      {post.roiPercentage ? (
                        <span className="text-[7px] font-black text-emerald-600 block">
                          (+{formatBnNum(post.roiPercentage)}% লাভ)
                        </span>
                      ) : (
                        <span className="text-[7px] text-slate-400 font-bold block">
                          (চলমান ইনভেস্ট)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4. বিস্তারিত অবস্থা ও হিসাব ব্যানার */}
                  <div className="mt-1.5 pt-1 border-t border-slate-200/60">
                    {post.status === 'sold' || (Number(post.sellAmount) > 0) ? (
                      <div className="bg-emerald-50 text-emerald-900 border border-emerald-200/90 px-2 py-1 rounded-lg flex items-center justify-between text-[9px] font-bold">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>বিক্রি সম্পন্ন: <strong>৳ {formatBnNum(post.sellAmount)}</strong> টাকায় বিক্রি করা হয়েছে</span>
                        </span>
                        <span className="text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-mono shadow-2xs">
                          লাভ: +৳ {formatBnNum(post.profitAmount)}
                        </span>
                      </div>
                    ) : (
                      <div className="bg-amber-50/80 text-amber-900 border border-amber-200/70 px-2 py-0.5 rounded-lg flex items-center justify-between text-[8.5px] font-semibold">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          <span>নিজস্ব ভোল্ট ও হেফাজতে সংরক্ষিত (বিক্রি হলে এখানে বিক্রি মূল্য ও মুনাফা যুক্ত হবে)</span>
                        </span>
                        <span className="text-[8px] text-amber-700 bg-amber-100/80 px-1.5 py-0.2 rounded font-bold">
                          চলমান ইনভেস্ট
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Location & Duration tag */}
                  {(post.location || post.durationText) && (
                    <div className="mt-1 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[8.5px] text-slate-600 font-semibold flex-wrap gap-1">
                      {post.location && (
                        <span className="flex items-center gap-0.5 text-slate-700">
                          <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                          <span className="truncate max-w-[180px]">{post.location}</span>
                        </span>
                      )}
                      {post.durationText && (
                        <span className="flex items-center gap-0.5 text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100">
                          <Clock className="w-2.5 h-2.5 text-indigo-600" />
                          {post.durationText}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. High Resolution Post Image with Lightbox Zoom */}
                {post.imageUrl && (
                  <div className="relative group cursor-pointer overflow-hidden bg-slate-900 max-h-[320px]" onClick={() => setLightboxImage(post.imageUrl!)}>
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-full object-cover max-h-[320px] group-hover:scale-101 transition duration-300"
                      loading="lazy"
                    />
                    {/* Overlay Transparency Badge on Photo */}
                    <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-lg text-white text-[9px] font-black flex items-center gap-1 border border-white/20">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>100% নিরাপদ ও সমবায় ভেরিফায়েড ইনভেস্টমেন্ট</span>
                    </div>

                    <div className="absolute top-2 right-2 p-1 bg-black/60 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition">
                      <Eye className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}

                {/* 5. Engagement Stats Bar (Real Counter - Love, Dislike, Comments, Views) */}
                <div className="px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100">
                  {/* Left: Reaction Counters (Click or Hold to see list) */}
                  <div className="flex items-center gap-2">
                    {/* Love Reactions Count */}
                    <button
                      onClick={() => handleOpenReactionDetails(post, 'likes')}
                      className="flex items-center gap-1 hover:opacity-80 transition cursor-pointer group"
                      title="কে কে লাইক দিয়েছে দেখতে ট্যাপ বা চেপে ধরে রাখুন"
                    >
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] shadow-2xs group-hover:scale-110 transition">
                        ❤️
                      </span>
                      <span className="font-bold text-slate-700 font-mono">
                        {formatBnNum(post.likesCount || 0)}
                      </span>
                    </button>

                    {/* Dislike Reactions Count */}
                    {(post.dislikesCount || 0) > 0 && (
                      <button
                        onClick={() => handleOpenReactionDetails(post, 'dislikes')}
                        className="flex items-center gap-1 hover:opacity-80 transition cursor-pointer group"
                        title="কে কে ডিসলাইক দিয়েছে দেখতে ট্যাপ বা চেপে ধরে রাখুন"
                      >
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-600 text-white text-[9px] shadow-2xs group-hover:scale-110 transition">
                          👎
                        </span>
                        <span className="font-bold text-slate-600 font-mono">
                          {formatBnNum(post.dislikesCount || 0)}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Right: Comments and Views */}
                  <div className="flex items-center gap-2 font-semibold text-[10px]">
                    <button
                      onClick={() => {
                        setCommentModalPost(post);
                        setCommentInput('');
                      }}
                      className="hover:underline cursor-pointer text-slate-600 hover:text-indigo-600"
                    >
                      {commentsCount > 0 ? `${formatBnNum(commentsCount)} টি মন্তব্য` : 'মন্তব্য করুন'}
                    </button>
                    <span>•</span>
                    <span className="font-mono text-slate-400">{formatBnNum(post.viewsCount || 0)} ভিউ</span>
                  </div>
                </div>

                {/* 6. Interactive Action Buttons (Order: 1. Like, 2. Comment, 3. Dislike) */}
                <div className="px-1.5 py-1 bg-slate-50/80 border-t border-slate-150 grid grid-cols-3 gap-1 text-[11px]">
                  {/* 1. বামপাশে: Like / Love Button */}
                  <button
                    onClick={() => handleToggleLike(post)}
                    onTouchStart={() => handleTouchStartReaction(post, 'likes')}
                    onTouchEnd={handleTouchEndReaction}
                    onMouseDown={() => handleTouchStartReaction(post, 'likes')}
                    onMouseUp={handleTouchEndReaction}
                    className={`py-1.5 rounded-xl font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer select-none ${
                      isLiked 
                        ? 'text-rose-600 bg-rose-50 font-black ring-1 ring-rose-200' 
                        : 'text-slate-600 hover:bg-slate-150'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-600 stroke-rose-600' : ''}`} />
                    <span>{isLiked ? 'পছন্দ হয়েছে' : 'পছন্দ'}</span>
                  </button>

                  {/* 2. মাঝখানে: Comment Button (মন্তব্য) */}
                  <button
                    onClick={() => {
                      setCommentModalPost(post);
                      setCommentInput('');
                    }}
                    className="py-1.5 text-slate-600 hover:bg-slate-150 rounded-xl font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-indigo-600" />
                    <span>মন্তব্য</span>
                  </button>

                  {/* 3. ডানপাশে: Dislike Button (অপছন্দ) */}
                  {(() => {
                    const isDisliked = user?.uid ? (post.dislikedBy || []).includes(user.uid) : false;
                    return (
                      <button
                        onClick={() => handleToggleDislike(post)}
                        onTouchStart={() => handleTouchStartReaction(post, 'dislikes')}
                        onTouchEnd={handleTouchEndReaction}
                        onMouseDown={() => handleTouchStartReaction(post, 'dislikes')}
                        onMouseUp={handleTouchEndReaction}
                        className={`py-1.5 rounded-xl font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer select-none ${
                          isDisliked 
                            ? 'text-slate-800 bg-slate-200 font-black ring-1 ring-slate-400' 
                            : 'text-slate-600 hover:bg-slate-150'
                        }`}
                      >
                        <ThumbsDown className={`w-3.5 h-3.5 ${isDisliked ? 'fill-slate-700 stroke-slate-700' : ''}`} />
                        <span>{isDisliked ? 'অপছন্দ হয়েছে' : 'অপছন্দ'}</span>
                      </button>
                    );
                  })()}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 5. Fullscreen Professional Comments Modal with Left Like, Center Comment, Right Unlike */}
      <AnimatePresence>
        {commentModalPost && (() => {
          const activePost = investments.find(p => p.id === commentModalPost.id) || commentModalPost;
          const isLiked = user?.uid ? (activePost.likedBy || []).includes(user.uid) : false;
          const isDisliked = user?.uid ? (activePost.dislikedBy || []).includes(user.uid) : false;
          const likesCount = activePost.likesCount ?? (activePost.likedBy || []).length;
          const dislikesCount = activePost.dislikesCount ?? (activePost.dislikedBy || []).length;
          const commentsList = activePost.comments || [];

          return (
            <div className="fixed inset-0 z-[100] bg-slate-900/60 sm:backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-hidden">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="bg-white w-full h-[100dvh] sm:h-[90vh] sm:max-w-2xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden border-0 sm:border sm:border-slate-200"
              >
                {/* 1. Modern Top Header */}
                <div className="px-3.5 py-3 border-b border-slate-200 flex items-center justify-between bg-white shrink-0 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={() => setCommentModalPost(null)}
                      className="p-2 -ml-1 hover:bg-slate-100 rounded-full text-slate-700 transition cursor-pointer shrink-0"
                      title="ফিরে যান"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight flex items-center gap-2">
                        <span>মন্তব্য ও আলোচনা</span>
                        <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-mono font-bold">
                          {formatBnNum(commentsList.length)} টি
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 truncate max-w-[220px] sm:max-w-md font-medium">
                        {activePost.title}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setCommentModalPost(null)}
                      className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition cursor-pointer"
                      title="বন্ধ করুন"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 2. Post Summary & Live Reactions Overview Bar */}
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-xs text-slate-600 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {activePost.imageUrl ? (
                      <img 
                        src={activePost.imageUrl} 
                        alt="" 
                        className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" 
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                        💎
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 truncate block text-[11px] sm:text-xs">
                        {activePost.title}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                        <span className="text-indigo-600 font-semibold">{activePost.category || 'ইনভেস্ট'}</span>
                        <span>•</span>
                        <span className="font-mono">ক্রয়: ৳{formatBnNum(activePost.buyAmount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reaction Summary Pills */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleOpenReactionDetails(activePost, 'likes')}
                      className="flex items-center gap-1 bg-white hover:bg-rose-50 text-slate-700 px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold transition cursor-pointer"
                      title="লাইক তালিকা দেখুন"
                    >
                      <span>❤️</span>
                      <span className="font-mono">{formatBnNum(likesCount)}</span>
                    </button>
                    <button
                      onClick={() => handleOpenReactionDetails(activePost, 'dislikes')}
                      className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold transition cursor-pointer"
                      title="ডিসলাইক তালিকা দেখুন"
                    >
                      <span>👎</span>
                      <span className="font-mono">{formatBnNum(dislikesCount)}</span>
                    </button>
                  </div>
                </div>

                {/* 3. Comments List Body (Full scrollable area) */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-3 bg-slate-100/70">
                  {commentsList.length > 0 ? (
                    commentsList.map((cm) => {
                      const isAuthor = user?.uid === cm.userId;
                      const within5Min = isWithin5Minutes(cm.createdAt);
                      const canEdit = (isAuthor || isUserAdmin) && within5Min;
                      const canDelete = isAuthor || isUserAdmin;
                      const remainingMin = getRemainingEditMinutes(cm.createdAt);
                      const isEditingThis = editingCommentId === cm.id;

                      return (
                        <div key={cm.id} className="flex items-start gap-2.5 group">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-slate-800 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {cm.userName?.charAt(0) || 'U'}
                          </div>
                          <div className="flex-1 max-w-[92%]">
                            {isEditingThis ? (
                              /* Inline Edit Form */
                              <div className="bg-white rounded-2xl p-3 border-2 border-indigo-400 shadow-md space-y-2">
                                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-700">
                                  <span>✏️ মন্তব্য সংশোধন (এডিট)</span>
                                  <span className="font-mono text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-600">
                                    বাকি {formatBnNum(remainingMin)} মিনিট
                                  </span>
                                </div>
                                <textarea
                                  value={editingCommentText}
                                  onChange={(e) => setEditingCommentText(e.target.value)}
                                  rows={2}
                                  placeholder="আপনার সংশোধিত মন্তব্য লিখুন..."
                                  className="w-full p-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-indigo-400/30 text-slate-800"
                                  autoFocus
                                />
                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditingCommentText('');
                                    }}
                                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer"
                                  >
                                    বাতিল
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUpdatingComment || !editingCommentText.trim()}
                                    onClick={() => handleSaveEditedComment(activePost.id, cm.id)}
                                    className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs flex items-center gap-1"
                                  >
                                    {isUpdatingComment ? 'সেভ হচ্ছে...' : 'সংরক্ষণ করুন'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Normal Comment Bubble */
                              <>
                                <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-slate-200/90 shadow-2xs space-y-0.5 relative">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-[12px] font-black text-slate-900 leading-none truncate">
                                        {cm.userName}
                                      </span>
                                      {isAuthor && (
                                        <span className="text-[8.5px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-1.5 py-0.2 rounded-full">
                                          আপনি
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {cm.editedAt && (
                                        <span className="text-[8.5px] bg-slate-100 text-slate-500 font-semibold px-1 py-0.5 rounded border border-slate-200">
                                          সম্পাদিত
                                        </span>
                                      )}
                                      <span className="text-[9.5px] text-slate-400 font-mono">
                                        {new Date(cm.createdAt).toLocaleDateString('bn-BD')}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-[12px] text-slate-800 font-sans leading-relaxed whitespace-pre-wrap pt-0.5">
                                    {cm.comment}
                                  </p>
                                </div>

                                {/* Comment Action Footer: Reply, Edit (within 5 min), Delete (anytime) */}
                                <div className="flex flex-wrap items-center gap-3 px-2 pt-1 text-[10.5px] text-slate-500 font-semibold">
                                  <span>{new Date(cm.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}</span>
                                  
                                  <button 
                                    onClick={() => setCommentInput(`@${cm.userName} `)}
                                    className="hover:text-indigo-600 cursor-pointer font-bold"
                                  >
                                    উত্তর দিন
                                  </button>

                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditComment(cm)}
                                      className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-bold flex items-center gap-0.5"
                                      title={`5 মিনিটের মধ্যে সংশোধন করা যাবে (বাকি ${remainingMin} মিনিট)`}
                                    >
                                      <span>✏️ এডিট</span>
                                      <span className="text-[9px] font-mono text-indigo-400">({formatBnNum(remainingMin)}মি)</span>
                                    </button>
                                  )}

                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => setCommentToDelete({ postId: activePost.id, commentId: cm.id, commentText: cm.comment })}
                                      className="text-rose-500 hover:text-rose-700 hover:underline cursor-pointer font-bold flex items-center gap-0.5"
                                      title="মন্তব্যটি মুছে ফেলুন (যেকোনো সময়)"
                                    >
                                      <span>🗑️ মুছুন</span>
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-20 text-slate-400 space-y-2.5">
                      <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto shadow-2xs">
                        <MessageCircle className="w-7 h-7" />
                      </div>
                      <p className="text-sm font-black text-slate-700">এখনো কোনো মন্তব্য করা হয়নি</p>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        প্রথম মন্তব্যকারী হিসেবে এই ইনভেস্টমেন্ট সম্পর্কে আপনার মতামত বা শুভকামনা জানান।
                      </p>
                    </div>
                  )}
                </div>

                {/* 4. Professional Bottom Action Bar: [Left: Like Button] [Middle: Comment Input Box] [Right: Unlike Button] */}
                <div className="p-2.5 sm:p-3 border-t border-slate-200 bg-white shadow-2xl shrink-0 mt-auto z-10 pb-4 sm:pb-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    
                    {/* 👈 বাম পাশে লাইক বাটন (Left Like Button) */}
                    <button
                      type="button"
                      onClick={() => handleToggleLike(activePost)}
                      onTouchStart={() => handleTouchStartReaction(activePost, 'likes')}
                      onTouchEnd={handleTouchEndReaction}
                      onMouseDown={() => handleTouchStartReaction(activePost, 'likes')}
                      onMouseUp={handleTouchEndReaction}
                      className={`px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl flex items-center gap-1.5 text-xs font-black transition cursor-pointer shrink-0 select-none active:scale-90 ${
                        isLiked
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 ring-2 ring-rose-300'
                          : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200'
                      }`}
                      title={isLiked ? 'পছন্দ বাতিল করুন' : 'পছন্দ (লাইক) করুন'}
                    >
                      <Heart className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isLiked ? 'fill-white stroke-white' : ''}`} />
                      <span className="font-mono text-[11px] sm:text-xs">{formatBnNum(likesCount)}</span>
                    </button>

                    {/* 💬 মাঝ খানে কমেন্ট বক্স (Center Comment Input Box) */}
                    <div className="flex-1 relative flex items-center min-w-0">
                      <input
                        type="text"
                        placeholder="আপনার মন্তব্য বা শুভকামনা লিখুন..."
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment(activePost.id);
                          }
                        }}
                        className="w-full pl-3.5 pr-10 py-2.5 sm:py-2.5 bg-slate-100 focus:bg-white border border-slate-300 focus:border-indigo-500 rounded-full text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 font-sans shadow-inner transition placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddComment(activePost.id)}
                        disabled={isPostingComment || !commentInput.trim()}
                        className="absolute right-1.5 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white rounded-full transition cursor-pointer shadow-xs active:scale-90 flex items-center justify-center"
                        title="মন্তব্য পাঠান"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 👉 ডানপাশে আনলাইক / অপছন্দ বাটন (Right Dislike Button) */}
                    <button
                      type="button"
                      onClick={() => handleToggleDislike(activePost)}
                      onTouchStart={() => handleTouchStartReaction(activePost, 'dislikes')}
                      onTouchEnd={handleTouchEndReaction}
                      onMouseDown={() => handleTouchStartReaction(activePost, 'dislikes')}
                      onMouseUp={handleTouchEndReaction}
                      className={`px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl flex items-center gap-1.5 text-xs font-black transition cursor-pointer shrink-0 select-none active:scale-90 ${
                        isDisliked
                          ? 'bg-slate-800 text-white shadow-md shadow-slate-800/30 ring-2 ring-slate-500'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200'
                      }`}
                      title={isDisliked ? 'অপছন্দ বাতিল করুন' : 'অপছন্দ (ডিসলাইক) করুন'}
                    >
                      <ThumbsDown className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isDisliked ? 'fill-white stroke-white' : ''}`} />
                      <span className="font-mono text-[11px] sm:text-xs">{formatBnNum(dislikesCount)}</span>
                    </button>

                  </div>
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* 6. Facebook-Style Reaction List Modal (Who Liked / Disliked - View on Long-press or Click) */}
      <AnimatePresence>
        {reactionDetailsModalPost && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
            >
              {/* Header with Tabs */}
              <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs sm:text-sm font-black">প্রতিক্রিয়া তালিকা (Reactions)</h3>
                </div>
                <button
                  onClick={() => setReactionDetailsModalPost(null)}
                  className="p-1 bg-white/10 hover:bg-white/20 rounded-full text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Reaction Filter Tabs */}
              <div className="flex items-center border-b border-slate-200 bg-slate-50 px-2 pt-2 gap-1 text-xs">
                <button
                  onClick={() => setReactionTab('all')}
                  className={`px-3 py-1.5 font-black border-b-2 transition cursor-pointer ${
                    reactionTab === 'all' 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  সকল ({formatBnNum((reactionDetailsModalPost.likedUsers?.length || (reactionDetailsModalPost.likedBy?.length || 0)) + (reactionDetailsModalPost.dislikedUsers?.length || (reactionDetailsModalPost.dislikedBy?.length || 0)))})
                </button>
                <button
                  onClick={() => setReactionTab('likes')}
                  className={`px-3 py-1.5 font-black border-b-2 flex items-center gap-1 transition cursor-pointer ${
                    reactionTab === 'likes' 
                      ? 'border-rose-500 text-rose-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>❤️</span>
                  <span>{formatBnNum(reactionDetailsModalPost.likedUsers?.length || (reactionDetailsModalPost.likedBy?.length || 0))}</span>
                </button>
                <button
                  onClick={() => setReactionTab('dislikes')}
                  className={`px-3 py-1.5 font-black border-b-2 flex items-center gap-1 transition cursor-pointer ${
                    reactionTab === 'dislikes' 
                      ? 'border-slate-700 text-slate-800' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>👎</span>
                  <span>{formatBnNum(reactionDetailsModalPost.dislikedUsers?.length || (reactionDetailsModalPost.dislikedBy?.length || 0))}</span>
                </button>
              </div>

              {/* Reaction Users List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-72">
                {(() => {
                  const likedList = reactionDetailsModalPost.likedUsers && reactionDetailsModalPost.likedUsers.length > 0
                    ? reactionDetailsModalPost.likedUsers.map(u => ({ ...u, type: 'like' }))
                    : (reactionDetailsModalPost.likedBy || []).map(id => ({ uid: id, name: id === user.uid ? (user.name || 'আপনি') : 'সম্মানিত সদস্য', memberId: id === user.uid ? (user.memberId || '') : '', type: 'like' }));

                  const dislikedList = reactionDetailsModalPost.dislikedUsers && reactionDetailsModalPost.dislikedUsers.length > 0
                    ? reactionDetailsModalPost.dislikedUsers.map(u => ({ ...u, type: 'dislike' }))
                    : (reactionDetailsModalPost.dislikedBy || []).map(id => ({ uid: id, name: id === user.uid ? (user.name || 'আপনি') : 'সম্মানিত সদস্য', memberId: id === user.uid ? (user.memberId || '') : '', type: 'dislike' }));

                  let displayList = [];
                  if (reactionTab === 'likes') displayList = likedList;
                  else if (reactionTab === 'dislikes') displayList = dislikedList;
                  else displayList = [...likedList, ...dislikedList];

                  if (displayList.length === 0) {
                    return (
                      <div className="text-center py-6 text-slate-400">
                        <SmilePlus className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                        <p className="text-xs font-semibold">কোনো প্রতিক্রিয়া পাওয়া যায়নি</p>
                      </div>
                    );
                  }

                  return displayList.map((item, idx) => (
                    <div key={`${item.uid}-${idx}`} className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/70 transition">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-slate-800 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                            {item.name?.charAt(0) || 'U'}
                          </div>
                          <span className="absolute -bottom-1 -right-1 text-[10px]">
                            {item.type === 'like' ? '❤️' : '👎'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800">
                            {item.name} {item.uid === user?.uid && <span className="text-[10px] text-indigo-600">(আপনি)</span>}
                          </h4>
                          {item.memberId ? (
                            <span className="text-[9.5px] text-slate-400 font-mono">আইডি: {item.memberId}</span>
                          ) : (
                            <span className="text-[9.5px] text-emerald-600 font-semibold">BNB মেম্বার অ্যাকাউন্ট</span>
                          )}
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                        item.type === 'like' 
                          ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                          : 'bg-slate-200 text-slate-700 border border-slate-300'
                      }`}>
                        {item.type === 'like' ? 'লাইক' : 'ডিসলাইক'}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Lightbox Modal for Photo Zoom */}
      <AnimatePresence>
        {lightboxImage && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition cursor-pointer z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImage}
              alt="Zoomed"
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        )}
      </AnimatePresence>

      {/* 6. Admin Create / Edit Post Modal (Facebook Post Publisher - Fullscreen & Spacious) */}
      <AnimatePresence>
        {showPostModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-0 sm:p-3 md:p-6 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-white w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-4 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black shadow-inner">
                    🏛️
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black flex items-center gap-1.5">
                      <span>{editingPost ? 'ইনভেস্টমেন্ট পোস্ট এডিট করুন' : 'নতুন ইনভেস্টমেন্ট পোস্ট তৈরি করুন'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-normal border border-emerald-400/30">
                        ফুল স্ক্রিন ভিউ
                      </span>
                    </h3>
                    <p className="text-[10.5px] text-slate-300">
                      ফেসবুক স্টাইলে স্বর্ণ, জমি বা প্রকল্পের পোস্ট, ছবি ও লাভের হিসাব পাবলিশ করুন
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="p-2 hover:bg-white/15 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
                  title="বন্ধ করুন"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body - Scrollable */}
              <form onSubmit={handleSavePost} className="p-4 sm:p-6 space-y-4 overflow-y-auto text-left flex-1 bg-slate-50/50">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{formError}</span>
                  </div>
                )}
                {formSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                {/* 1. Category & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                    <label className="block text-[11px] font-black text-slate-700 mb-1.5">
                      ইনভেস্ট ক্যাটাগরি *
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="gold">🪙 স্বর্ণ ইনভেস্ট (Gold)</option>
                      <option value="land">🏞️ জমি ও প্লট (Land & Real Estate)</option>
                      <option value="agro">🌾 কৃষি ও খামার (Agro Farm)</option>
                      <option value="business">🏢 ব্যবসা ও শেয়ার (Business)</option>
                      <option value="other">📦 অন্যান্য প্রজেক্ট (Other)</option>
                    </select>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                    <label className="block text-[11px] font-black text-slate-700 mb-1.5">
                      ইনভেস্টের বর্তমান স্ট্যাটাস *
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="active">🟢 চলমান ইনভেস্ট (Active)</option>
                      <option value="sold">💰 সফল বিক্রি ও লাভ সম্পন্ন (Sold & Profit)</option>
                      <option value="new">🚀 নতুন ইনভেস্ট শুরু (Newly Launched)</option>
                    </select>
                  </div>
                </div>

                {/* 2. Title */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <label className="block text-[11px] font-black text-slate-700 mb-1.5">
                    পোস্টের আকর্ষণীয় শিরোনাম *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: চৌদ্দ আনা দুই রতি দুই পয়েন্ট গোল্ড ক্রয় অথবা পূর্বাচলে 5 কাঠা জমি"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>

                {/* 3. Description / Facebook Story Text */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <label className="block text-[11px] font-black text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>বিস্তারিত বর্ণনা / গল্প (ফেসবুক পোস্টের মতো) *</span>
                    <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                      ইমোজি ও সম্পূর্ণ হিসেব লিখতে পারেন
                    </span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="ফেসবুকে যেভাবে পোস্ট লিখে সেভাবে বিস্তারিত লিখুন: যেমন- 14 আনা 2 রতি 2 পয়েন্ট গোল্ড ক্রয় করা হয়েছে এক লক্ষ 81 হাজার টাকা দিয়ে ইত্যাদি..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
                  />
                </div>

                {/* 4. Financial Calculations */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <span>💰 ক্রয়-বিক্রয় ও আর্থিক হিসাব (টাকা)</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">অটো লাভ ক্যালকুলেশন হবে</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                        🏷️ ক্রয় মূল্য / কেনার খরচ (৳) *
                      </label>
                      <input
                        type="number"
                        placeholder="181000"
                        value={formBuyAmount}
                        onChange={(e) => {
                          setFormBuyAmount(e.target.value);
                          handleCalculateProfit(e.target.value, formSellAmount);
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-blue-900 mb-1">
                        💰 বিক্রি করলাম কতো / বিক্রয় মূল্য (৳)
                      </label>
                      <input
                        type="number"
                        placeholder="2280000"
                        value={formSellAmount}
                        onChange={(e) => {
                          setFormSellAmount(e.target.value);
                          handleCalculateProfit(formBuyAmount, e.target.value);
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-blue-300 rounded-xl text-xs font-mono font-bold text-blue-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-emerald-900 mb-1">
                        ✨ লাভ হলো কতো / নিট মুনাফা (৳)
                      </label>
                      <input
                        type="number"
                        placeholder="430000"
                        value={formProfitAmount}
                        onChange={(e) => setFormProfitAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-emerald-300 rounded-xl text-xs font-mono font-bold text-emerald-800"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Location & Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                      📍 প্রজেক্টের অবস্থান / লোকেশন
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: বায়তুল মোকাররম জুয়েলার্স মার্কেট / পূর্বাচল"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                      ⏳ মেয়াদকাল বা সময়কাল
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: চলমান সুরক্ষিত ইনভেস্ট / 6 মাস"
                      value={formDurationText}
                      onChange={(e) => setFormDurationText(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* 6. Direct Gallery Image Upload Section (User requested: directly upload from phone gallery without link) */}
                <div className="p-4 bg-white border border-indigo-100 rounded-2xl space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      <span>প্রজেক্টের ছবি (সরাসরি ফোন গ্যালারি থেকে)</span>
                    </label>
                    {formImageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormImageUrl('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ছবি মুছুন</span>
                      </button>
                    )}
                  </div>

                  {/* Hidden File Input for Device Gallery */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />

                  {/* Big Gallery Upload Button */}
                  <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isCompressingImage}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-teal-600 hover:from-indigo-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50"
                    >
                      <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        {isCompressingImage 
                          ? 'ছবি আপলোড ও প্রসেস হচ্ছে...' 
                          : '📁 ফোন গ্যালারি / ক্যামেরা থেকে ছবি আপলোড করুন'}
                      </span>
                    </button>
                  </div>

                  {/* Image Preview Box */}
                  {formImageUrl ? (
                    <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-300 bg-slate-900 shadow-inner group">
                      <img
                        src={formImageUrl}
                        alt="Post Preview"
                        className="w-full h-48 sm:h-56 object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 flex items-center justify-between text-white">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ছবি সফলভাবে যুক্ত হয়েছে
                        </span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold rounded-lg backdrop-blur-xs transition cursor-pointer"
                        >
                          ছবি পরিবর্তন করুন
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50 hover:bg-indigo-50/30"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">কোনো ছবি নির্বাচন করা হয়নি</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">গ্যালারি থেকে স্বর্ণ, জমি বা প্রজেক্টের ছবি সিলেক্ট করতে ক্লিক করুন</p>
                    </div>
                  )}

                  {/* Preset Options (Optional fallback) */}
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1.5">অথবা প্রিসেট স্যাম্পল ছবি বেছে নিন:</span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {PRESET_IMAGES.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormImageUrl(preset.url)}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition cursor-pointer shrink-0 ${
                            formImageUrl === preset.url 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 7. Pin Post */}
                <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-2.5 shadow-xs">
                  <input
                    type="checkbox"
                    id="chk-pin"
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                  <label htmlFor="chk-pin" className="text-xs font-bold text-slate-800 cursor-pointer">
                    📌 পোস্টটি সবার উপরে পিন (Pin to Top) করে রাখুন
                  </label>
                </div>
              </form>

              {/* Sticky Footer Action Bar */}
              <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3 shrink-0 shadow-lg">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleSavePost}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 active:scale-95 text-white text-xs font-black rounded-xl shadow-md disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'সেভ হচ্ছে...' : (editingPost ? 'আপডেট সম্পন্ন করুন' : 'ফেসবুক স্টাইলে পাবলিশ করুন')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Single Post Modal */}
      <AnimatePresence>
        {postToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left space-y-4 font-sans"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">ইনভেস্টমেন্ট পোস্ট মুছুন</h3>
                  <p className="text-[11px] text-slate-500">এই পোস্টটি পার্মানেন্টলি ডিলিট হবে</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <p className="text-xs font-black text-slate-800 line-clamp-2">{postToDelete.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                  <span>ক্রয়: ৳{formatBnNum(postToDelete.buyAmount)}</span>
                  {postToDelete.sellAmount ? <span>| বিক্রি: ৳{formatBnNum(postToDelete.sellAmount)}</span> : null}
                </div>
              </div>

              <p className="text-xs text-slate-600">
                আপনি কি নিশ্চিতভাবে এই পোস্টটি রিয়েল-টাইম ডাটাবেজ থেকে মুছে ফেলতে চান?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPostToDelete(null)}
                  disabled={isDeletingPost}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeletePost}
                  disabled={isDeletingPost}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingPost ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, মুছে ফেলুন'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Single Comment Confirmation Modal */}
      <AnimatePresence>
        {commentToDelete && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left space-y-4 font-sans"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">মন্তব্য মুছে ফেলুন</h3>
                  <p className="text-[11px] text-slate-500">আপনার এই মন্তব্যটি স্থায়ীভাবে মুছে যাবে</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 italic">
                "{commentToDelete.commentText}"
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCommentToDelete(null)}
                  disabled={isDeletingComment}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteComment}
                  disabled={isDeletingComment}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingComment ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, মন্তব্যটি মুছুন'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete All Posts / Reset to 0 Modal */}
      <AnimatePresence>
        {showDeleteAllModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left space-y-4 font-sans"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">সব পোস্ট মুছে 0 করুন (রিয়েল মোড)</h3>
                  <p className="text-[11px] text-slate-500">সকল ডেমো পোস্ট মুছে হিসাব ক্লিন হবে</p>
                </div>
              </div>

              <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200 text-xs text-rose-800 space-y-1">
                <p className="font-bold">⚠️ সতর্কবার্তা:</p>
                <p>বর্তমান <strong>{investments.length} টি পোস্ট</strong> ডাটাবেজ থেকে সম্পূর্ণ মুছে ফেলা হবে এবং সকল পরিসংখ্যান (মোট ক্রয়, মোট বিক্রি, নিট লাভ) 0 হয়ে যাবে।</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteAllModal(false)}
                  disabled={isDeletingAll}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAll}
                  disabled={isDeletingAll}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isDeletingAll ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, সব মুছে 0 করুন'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl border border-slate-700"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
