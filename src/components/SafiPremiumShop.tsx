import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, ShoppingCart, ShoppingBag, 
  Trash2, Plus, CheckCircle, Volume2, ArrowRight,
  Sparkles, Heart, Star, ShieldCheck, Phone,
  Edit, Eye, Layers, RefreshCw
} from 'lucide-react';
import { User as UserType, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { useBackHandler } from '../lib/navigationManager';
import { collection, addDoc, doc, updateDoc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import SafiProductDetailsModal from './SafiProductDetailsModal';
import SafiAdminProductModal from './SafiAdminProductModal';
import SafiCheckoutModal from './SafiCheckoutModal';
import SafiLiveLocationWidget, { LiveLocationData } from './SafiLiveLocationWidget';

export interface SafiPremiumShopProps {
  user: UserType;
  onClose: () => void;
  appConfig: AppConfig;
  handleBuyPremiumSafi?: (itemName: string, itemPrice: number) => Promise<void>;
  syncLiveProfile?: () => void;
  isAdminMode?: boolean;
}

export interface SafiProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  regularPrice?: number;
  desc: string;
  image: string;
  images?: string[];
  emoji?: string;
  badge?: string;
  brand: string;
  stock: string;
  sale?: boolean;
  soldCount?: string;
  rating?: string;
  reviews?: string;
  discountText?: string;
  specifications?: string[];
  createdAt?: string;
}

export interface SafiCategory {
  id: string;
  name: string;
  nameBn: string;
  image: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  emoji: string;
  brand: string;
}

export default function SafiPremiumShop({ 
  user, 
  onClose, 
  appConfig, 
  handleBuyPremiumSafi,
  syncLiveProfile,
  isAdminMode = false
}: SafiPremiumShopProps) {
  // Session Admin permissions
  const isAdmin = isAdminMode || user?.role === 'admin' || user?.role === 'sub_admin';

  // Navigation tabs: 'home' | 'shop' | 'vacation_sale' | 'cart' | 'account' | 'favorites'
  const [activeTab, setActiveTab] = useState<'home' | 'shop' | 'vacation_sale' | 'cart' | 'account' | 'favorites'>('home');
  const [adminPreviewAsUser, setAdminPreviewAsUser] = useState(false);

  const [safiSearchQuery, setSafiSearchQuery] = useState('');
  const [safiSelectedCategory, setSafiSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [successOrder, setSuccessOrder] = useState<string | null>(null);
  const [isVoiceOn, setIsVoiceOn] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [address, setAddress] = useState('ঢাকা, বাংলাদেশ (অটো পিন করুন)');
  const [phone, setPhone] = useState(user?.phone || '');
  const [liveLocation, setLiveLocation] = useState<LiveLocationData | null>(null);
  const [checkoutType, setCheckoutType] = useState<'single' | 'cart'>('cart');
  const [singleItemToBuy, setSingleItemToBuy] = useState<SafiProduct | null>(null);

  // Favorites / Wishlist State
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('safi_user_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Detailed Product Modal (AliExpress style Fullscreen)
  const [selectedProductDetails, setSelectedProductDetails] = useState<SafiProduct | null>(null);

  // Admin Product Add & Edit States
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SafiProduct | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Admin Category Management States
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SafiCategory | null>(null);
  const [catFormId, setCatFormId] = useState('');
  const [catFormName, setCatFormName] = useState('');
  const [catFormNameBn, setCatFormNameBn] = useState('');
  const [catFormImage, setCatFormImage] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Categories Datasets
  const defaultSafiCategories: SafiCategory[] = [
    { 
      id: 'weddings_events', 
      name: 'Weddings & Events', 
      nameBn: 'বিয়ে ও অনুষ্ঠান', 
      image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=200&auto=format&fit=crop&q=80' 
    },
    { 
      id: 'jewelry_accessories', 
      name: 'Jewelry & Accessories', 
      nameBn: 'গহনা ও অলংকার', 
      image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=200&auto=format&fit=crop&q=80' 
    },
    { 
      id: 'manicure', 
      name: 'Manicure & Beauty', 
      nameBn: 'নখ ও রূপচর্চা', 
      image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=200&auto=format&fit=crop&q=80' 
    },
    { 
      id: 'clothing_fashion', 
      name: 'Dresses & Fashion', 
      nameBn: 'পোশাক ও ফ্যাশন', 
      image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=200&auto=format&fit=crop&q=80' 
    },
    { 
      id: 'cosmetics_lifestyle', 
      name: 'Beauty & Lifestyle', 
      nameBn: 'সৌন্দর্য ও প্রসাধন', 
      image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&auto=format&fit=crop&q=80' 
    },
    { 
      id: 'tech_gadgets', 
      name: 'Electronics & Tech', 
      nameBn: 'ইলেকট্রনিক্স ও গেজেটস', 
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200&auto=format&fit=crop&q=80' 
    },
    { 
      id: 'muslim_clothing', 
      name: 'Muslim Clothing', 
      nameBn: 'মুসলিম পোশাক', 
      image: 'https://images.unsplash.com/photo-1564982752979-3f7bc974d29a?w=200&auto=format&fit=crop&q=80' 
    },
    { 
      id: 'food_grocery', 
      name: 'Pure Organic Foods', 
      nameBn: 'খাঁটি খাদ্য ও মুদি', 
      image: 'https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?w=200&auto=format&fit=crop&q=80' 
    }
  ];

  // Default Products with 3-4 High-Quality Images per product
  const defaultSafiProducts: SafiProduct[] = [
    {
      id: 'sf_oil',
      category: 'food_grocery',
      name: 'Safi কাঠের ঘানি ভাঙা সর্ষের তৈল',
      price: 295,
      regularPrice: 350,
      desc: '1 লিটার বোতল, শতভাগ বিশুদ্ধ দেশি সরিষার বীজ থেকে প্রস্তুত কোল্ড প্রেসড তেল।\n• ১০০% রাসায়নিক মুক্ত ও প্রাকৃতিক সুবাস।\n• ঝাঁঝালো খাঁটি স্বাদ রান্নার স্বাদ বহুগুণ বৃদ্ধি করে।\n• হৃদযন্ত্রের সুরক্ষায় স্বাস্থ্যকর ফ্যাটি অ্যাসিড সমৃদ্ধ।\n• ল্যাব টেস্টে শতভাগ খাঁটি ও পরীক্ষিত।',
      emoji: '🛢️',
      badge: 'Best Pure',
      sale: true,
      soldCount: '12K+ বিক্রি',
      rating: '4.9',
      reviews: '450',
      discountText: '৳55 ছাড়',
      brand: 'Safi Pure',
      stock: '120 পিস',
      image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: 'sf_honey_wild',
      category: 'food_grocery',
      name: 'Safi প্রিমিয়াম খাঁটি ফুলের মধু (Wild Honey)',
      price: 650,
      regularPrice: 750,
      desc: '500 গ্রাম কাঁচের জার, সুন্দরবনের প্রাকৃতিক চাক হতে নিজস্ব তত্ত্বাবধানে সংগৃহীত অপরিশোধিত কাঁচা মধু।\n• কোনো প্রকার চিনি, প্রিজারভেটিভ বা কেমিক্যাল মেশানো নেই।\n• প্রাকৃতিক অ্যান্টি-অক্সিডেন্ট ও রোগ প্রতিরোধ ক্ষমতা বৃদ্ধিতে সহায়ক।\n• নিয়মিত সেবনে সর্দি-কাশি ও হজমজনিত সমস্যায় অত্যন্ত উপকারী।\n• ১০০% মানসম্মত ও হাইজিনিক প্যাকেজিং।',
      emoji: '🍯',
      badge: 'Organic',
      sale: true,
      soldCount: '8K+ বিক্রি',
      rating: '5.0',
      reviews: '920',
      discountText: '৳100 ছাড়',
      brand: 'Safi Organics',
      stock: '45 পিস',
      image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1582845512747-e42001c95638?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1471943311424-646960669fbc?w=600&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: 'sf_ghee',
      category: 'food_grocery',
      name: 'Safi প্রিমিয়াম গাওয়া ঘি (Pure Cow Ghee)',
      price: 420,
      regularPrice: 480,
      desc: '250 গ্রাম প্রিমিয়াম বয়াম, শতভাগ খাঁটি গাভীর দুধের মাখন থেকে ঐতিহ্যবাহী পদ্ধতিতে জ্বাল দিয়ে তৈরি দানাদার গাওয়া ঘি।\n• শাহী পোলাও, বিরিয়ানি ও গরম ভাতের সাথে অতুলনীয় সুবাস ও স্বাদ।\n• ভিটামিন A, D, E ও সুস্থ ফ্যাটি অ্যাসিড সমৃদ্ধ।\n• দীর্ঘমেয়াদে পুষ্টিগুণ অক্ষুন্ন থাকে।',
      emoji: '🧈',
      badge: 'Traditional',
      sale: true,
      soldCount: '5K+ বিক্রি',
      rating: '4.9',
      reviews: '890',
      discountText: '৳60 ছাড়',
      brand: 'Safi Dairy',
      stock: '60 পিস',
      image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=600&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: 'sf_sharee',
      category: 'clothing_fashion',
      name: 'Safi ঐতিহ্যবাহী টাঙ্গাইলের সফট কটন শাড়ি',
      price: 1450,
      regularPrice: 1750,
      desc: '১০০% পিওর কটন সুতা দিয়ে দক্ষ কারিগরদের তাঁতে বোনা আকর্ষণীয় ডিজাইনের শাড়ি।\n• আঁচল ও পাড়ে সূক্ষ্ম জরি ও রঙিন সুতার কাজ।\n• গ্রীষ্ম ও যেকোনো ঋতুতে সারাদিন পরার জন্য অত্যন্ত হালকা ও আরামদায়ক।\n• কালার গ্যারান্টি ও ব্লাউজ পিস সংযুক্ত।',
      emoji: '👘',
      badge: 'Handloom',
      sale: true,
      soldCount: '450 বিক্রি',
      rating: '4.7',
      reviews: '40',
      discountText: '৳300 ছাড়',
      brand: 'Safi Weaves',
      stock: '25 পিস',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: 'sf_panjabi',
      category: 'clothing_fashion',
      name: 'Safi প্রিমিয়াম সেমি-ফিটেড ফ্যাব্রিক পাঞ্জাবি',
      price: 1250,
      regularPrice: 1550,
      desc: 'লিলেন ও ফাইন সুতি ব্লেন্ডের হাই-কোয়ালিটি পাঞ্জাবি।\n• কলার ও বোতাম প্লেটে সূক্ষ্ম এমব্রয়ডারি ওয়ার্ক এবং কাস্টম মেটাল বাটন।\n• জুম্মা, ঈদ, বিয়ে ও পারিবারিক উৎসবের জন্য পারফেক্ট লুক।\n• সাইজ: 38, 40, 42, 44 উপলব্ধ।',
      emoji: '🧥',
      badge: 'Classic',
      sale: true,
      soldCount: '850 বিক্রি',
      rating: '4.8',
      reviews: '105',
      discountText: 'ঈদ অফার',
      brand: 'Safi Fits',
      stock: '40 পিস',
      image: 'https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?w=600&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1627993933933-4f9958742511?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: 'sf_earbuds',
      category: 'tech_gadgets',
      name: 'Safi ওয়্যারলেস ব্লুটুথ 5.3 ইয়ারবাডস',
      price: 990,
      regularPrice: 1350,
      desc: 'Hi-Fi সাউন্ড কোয়ালিটি ও ডিপ সুপার বেস সমৃদ্ধ স্টাইলিশ ইয়ারবাডস।\n• ২৪ ঘণ্টা মোট প্লেটাইম ব্যাকআপ ও টাইপ-সি ফাস্ট চার্জিং।\n• পরিবেশের অতিরিক্ত নয়েজ কমানোর জন্য স্মার্ট ANC ফিল্টার।\n• IPX4 ওয়াটার ও সোয়েট রেজিস্ট্যান্স প্রটেকশন।',
      emoji: '🎧',
      badge: 'ANC HiFi',
      sale: true,
      soldCount: '5K+ বিক্রি',
      rating: '4.8',
      reviews: '340',
      discountText: '৳360 ছাড়',
      brand: 'Safi Audio',
      stock: '45 পিস',
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1598331668826-20cecc596b86?w=600&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: 'sf_aloe_gel',
      category: 'cosmetics_lifestyle',
      name: 'Safi ফ্রেশ অ্যালোভেরা সুদিং জেল 99%',
      price: 180,
      regularPrice: 240,
      desc: '150 মিলি জার, প্রাকৃতিক অ্যালোভেরা নির্যাসের জাদুকরী স্কিন ও হেয়ার ময়শ্চারাইজার।\n• ত্বকের রোদে পোড়া কালচে দাগ দূর করে উজ্জ্বলতা বাড়ায়।\n• সব ধরণের ত্বকের জন্য উপযোগী ও প্যারাবেন মুক্ত।',
      emoji: '🧪',
      badge: 'Organic',
      sale: true,
      soldCount: '2K+ বিক্রি',
      rating: '4.8',
      reviews: '140',
      discountText: '৳60 ছাড়',
      brand: 'Safi Skin',
      stock: '80 পিস',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1608248597359-0d195a454d72?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&auto=format&fit=crop&q=80'
      ]
    }
  ];

  const [safiCategories, setSafiCategories] = useState<SafiCategory[]>(defaultSafiCategories);
  const [safiProducts, setSafiProducts] = useState<SafiProduct[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "product" | "category";
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => prev?.text === text ? null : prev);
    }, 3500);
  };

  // Back Button Handling
  useBackHandler(() => {
    if (deleteTarget) { setDeleteTarget(null); return true; }
    if (selectedProductDetails) { setSelectedProductDetails(null); return true; }
    if (showCheckoutModal) { setShowCheckoutModal(false); return true; }
    if (showProductModal) { setShowProductModal(false); return true; }
    if (showCategoryModal) { setShowCategoryModal(false); return true; }
    if (safiSelectedCategory) { setSafiSelectedCategory(null); return true; }
    if (activeTab !== 'home') {
      setActiveTab('home');
      return true;
    }
    return false;
  }, true, 25);

  // 1. Real-time Categories Sync with Firestore
  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, 'safi_categories'), async (snapshot) => {
      if (snapshot.empty) {
        try {
          for (const item of defaultSafiCategories) {
            await setDoc(doc(db, 'safi_categories', item.id), item);
          }
        } catch (err) {
          console.error("Failed seeding safi categories:", err);
        }
      } else {
        const list: SafiCategory[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SafiCategory);
        });
        setSafiCategories(list);
      }
    });
    return () => unsubCats();
  }, []);

  // 2. Real-time Products Sync with Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'safi_products'), async (snapshot) => {
      if (snapshot.empty) {
        try {
          for (const item of defaultSafiProducts) {
            await setDoc(doc(db, 'safi_products', item.id), item);
          }
        } catch (err) {
          console.error("Failed seeding safi products:", err);
        }
      } else {
        const list: SafiProduct[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const override = appConfig?.safiProductOverrides?.[docSnap.id];
          
          let productImages: string[] = [];
          if (data.images && Array.isArray(data.images) && data.images.length > 0) {
            productImages = data.images;
          } else if (data.image) {
            productImages = [data.image];
          }

          list.push({
            id: docSnap.id,
            name: override?.name !== undefined ? override.name : (data.name || 'Safi Product'),
            category: data.category || 'clothing_fashion',
            price: override?.price !== undefined ? override.price : Number(data.price || 0),
            regularPrice: data.regularPrice ? Number(data.regularPrice) : undefined,
            desc: override?.desc !== undefined ? override.desc : (data.desc || ''),
            image: override?.image || data.image || (productImages[0] || ''),
            images: productImages,
            emoji: override?.emoji || data.emoji || '📦',
            badge: data.badge || '',
            brand: override?.brand !== undefined ? override.brand : (data.brand || 'Safi Brand'),
            stock: override?.stock !== undefined ? override.stock : (data.stock || 'স্টকে আছে'),
            sale: data.sale || false,
            soldCount: data.soldCount || '1.2K+ বিক্রি',
            rating: data.rating || '4.9',
            reviews: data.reviews || '45',
            discountText: data.discountText || '',
            createdAt: data.createdAt || ''
          });
        });
        setSafiProducts(list);
      }
    });
    return () => unsubscribe();
  }, [appConfig?.safiProductOverrides]);

  // Wishlist Toggle Handler
  const toggleFavorite = (product: SafiProduct, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const isFav = favorites.includes(product.id);
    let next: string[];
    if (isFav) {
      next = favorites.filter(id => id !== product.id);
      showToast(`"${product.name}" পছন্দের তালিকা থেকে সরানো হয়েছে`, "error");
    } else {
      next = [...favorites, product.id];
      showToast(`"${product.name}" পছন্দের তালিকায় যুক্ত করা হয়েছে ❤️`, "success");
    }
    setFavorites(next);
    try {
      localStorage.setItem('safi_user_favorites', JSON.stringify(next));
    } catch (err) {
      console.warn("Storage write failed", err);
    }
  };

  // --- ADMIN PRODUCT ACTIONS ---
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (p: SafiProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProduct(p);
    setShowProductModal(true);
  };

  const handleSaveProductFromModal = async (productData: Partial<SafiProduct>) => {
    setIsSavingProduct(true);
    try {
      const isEditing = !!editingProduct;
      const productId = isEditing ? editingProduct.id : `sf_item_${Date.now()}`;
      
      const fullData: SafiProduct = {
        id: productId,
        name: productData.name || 'Safi Product',
        category: productData.category || 'clothing_fashion',
        price: Number(productData.price || 0),
        regularPrice: productData.regularPrice ? Number(productData.regularPrice) : undefined,
        desc: productData.desc || 'Safi ইন-হাউস প্রিমিয়াম পণ্য। সর্বোচ্চ গুণগত মানসম্পন্ন।',
        image: productData.image || 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=500&auto=format&fit=crop&q=80',
        images: productData.images || [productData.image || 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=500&auto=format&fit=crop&q=80'],
        emoji: productData.emoji || '📦',
        badge: productData.badge || 'Choice',
        brand: productData.brand || 'Safi Brand',
        stock: productData.stock || '100 পিস',
        sale: productData.sale || false,
        discountText: productData.discountText || '',
        soldCount: editingProduct?.soldCount || '0 বিক্রি',
        rating: editingProduct?.rating || '5.0',
        reviews: editingProduct?.reviews || '0',
        createdAt: editingProduct?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, 'safi_products', productId), fullData);

      setShowProductModal(false);
      setEditingProduct(null);
      
      if (selectedProductDetails?.id === productId) {
        setSelectedProductDetails(fullData);
      }

      showToast(isEditing ? 'পণ্য সফলভাবে আপডেট হয়েছে!' : 'নতুন পণ্য আপলোড সম্পন্ন হয়েছে!', 'success');
    } catch (err: any) {
      showToast('ত্রুটিঃ ' + err.message, 'error');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProductPrompt = (id: string, name: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDeleteTarget({ type: "product", id, name });
  };

  const handleDeleteCategoryPrompt = (catId: string, name: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDeleteTarget({ type: "category", id: catId, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setIsDeleting(true);
    try {
      if (target.type === "product") {
        const prodId = target.id;
        const prodName = target.name;

        await deleteDoc(doc(db, "safi_products", prodId));
        setSafiProducts(prev => prev.filter(p => p.id !== prodId));

        if (selectedProductDetails?.id === prodId) {
          setSelectedProductDetails(null);
        }

        showToast(`"${prodName}" পণ্যটি মুছে ফেলা হয়েছে!`, "success");
      } else if (target.type === "category") {
        const catId = target.id;
        const catName = target.name;

        await deleteDoc(doc(db, "safi_categories", catId));
        setSafiCategories(prev => prev.filter(c => c.id !== catId));

        if (safiSelectedCategory === catId) {
          setSafiSelectedCategory(null);
        }
        if (editingCategory?.id === catId) {
          setEditingCategory(null);
        }

        showToast(`"${catName}" ক্যাটাগরি মুছে ফেলা হয়েছে!`, "success");
      }
    } catch (err: any) {
      showToast(`মুছতে সমস্যা হয়েছে: ${err.message}`, "error");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // --- ADMIN CATEGORY ACTIONS ---
  const handleOpenCategoryManager = () => {
    setEditingCategory(null);
    setCatFormId('');
    setCatFormName('');
    setCatFormNameBn('');
    setCatFormImage('');
    setShowCategoryModal(true);
  };

  const handleEditCategoryInit = (cat: SafiCategory) => {
    setEditingCategory(cat);
    setCatFormId(cat.id);
    setCatFormName(cat.name);
    setCatFormNameBn(cat.nameBn);
    setCatFormImage(cat.image);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormNameBn.trim()) {
      showToast('অনুগ্রহ করে ক্যাটাগরির বাংলা নাম প্রদান করুন।', 'error');
      return;
    }

    setIsSavingCategory(true);
    try {
      const isEditing = !!editingCategory;
      const categoryId = isEditing ? editingCategory.id : (catFormId.trim() ? catFormId.trim().toLowerCase().replace(/\s+/g, '_') : `cat_${Date.now()}`);

      const categoryData: SafiCategory = {
        id: categoryId,
        name: catFormName.trim() || catFormNameBn.trim(),
        nameBn: catFormNameBn.trim(),
        image: catFormImage || 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=200&auto=format&fit=crop&q=80'
      };

      await setDoc(doc(db, 'safi_categories', categoryId), categoryData);

      setEditingCategory(null);
      setCatFormId('');
      setCatFormName('');
      setCatFormNameBn('');
      setCatFormImage('');

      showToast(isEditing ? 'ক্যাটাগরি সফলভাবে আপডেট হয়েছে!' : 'নতুন ক্যাটাগরি যুক্ত হয়েছে!', 'success');
    } catch (err: any) {
      showToast('ত্রুটিঃ ' + err.message, 'error');
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Voice Assistant
  const speakVoiceGuide = (text: string) => {
    try {
      if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
        window.speechSynthesis.cancel();
        const Utterance = (window as any).SpeechSynthesisUtterance;
        if (!Utterance) return;
        const utterance = new Utterance(text);
        utterance.lang = 'bn-BD';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
        setIsVoiceOn(true);
        utterance.onend = () => setIsVoiceOn(false);
      }
    } catch (err) {
      console.warn("Speech synthesis error:", err);
      setIsVoiceOn(false);
    }
  };

  const handleVoiceButtonClick = () => {
    if (isVoiceOn) {
      window.speechSynthesis.cancel();
      setIsVoiceOn(false);
    } else {
      const textToSpeak = "সাফি প্রিমিয়াম শপে আপনাকে স্বাগতম। আলীএক্সপ্রেস স্টাইলে ছবি টেনে দেখুন ও সরাসরি জিপিএস লাইভ লোকেশনে অর্ডার করুন।";
      speakVoiceGuide(textToSpeak);
    }
  };

  // Cart Handlers
  const addToCart = (product: SafiProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image,
        emoji: product.emoji || '📦',
        brand: product.brand
      }]);
    }
    showToast(`"${product.name}" কার্টে যোগ করা হয়েছে! 🛒`, "success");
    speakVoiceGuide(`"${product.name}" কার্টে যোগ করা হয়েছে।`);
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(cart.map((item) => {
      if (item.id === id) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const getSubTotal = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryCharge = 50;
  const getGrandTotal = () => getSubTotal() + (getSubTotal() > 0 ? deliveryCharge : 0);

  const handleInitiateCheckout = (type: 'single' | 'cart', item?: SafiProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (type === 'single' && item) {
      setSingleItemToBuy(item);
    }
    setCheckoutType(type);
    setShowCheckoutModal(true);
    speakVoiceGuide("অর্ডার সম্পন্ন করতে ঠিকানা ও যোগাযোগের তথ্য দিন।");
  };

  const handleConfirmOrder = async (orderData: {
    district?: string;
    thana?: string;
    detailedAddress?: string;
    address: string;
    primaryPhone: string;
    primaryPhoneRelation?: string;
    secondaryPhone: string;
    secondaryPhoneRelation?: string;
    callPreference: string;
    deliveryNote: string;
    liveLocation: LiveLocationData | null;
    pin: string;
    items: {
      id: string;
      name: string;
      price: number;
      quantity: number;
      image: string;
    }[];
    totalAmount: number;
  }) => {
    const orderAmount = orderData.totalAmount;
    
    if (orderAmount > (user?.balance || 0)) {
      showToast('আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।', 'error');
      speakVoiceGuide("আপনার ব্যালেন্স পর্যাপ্ত নয়। ওয়ালেটে টাকা রিচার্জ করুন।");
      return;
    }

    const orderItemsText = orderData.items.map(item => `${item.name} (${item.quantity}টি)`).join(', ');

    try {
      setCheckoutLoading(true);
      
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        balance: (user.balance || 0) - orderAmount,
        mainBalance: (user.balance || 0) - orderAmount
      });

      const transactionId = `tx-safi-${Date.now()}`;
      addDoc(collection(db, 'admin_notifications'), {
        title: '🛍️ নতুন al safi প্রিমিয়াম শপ অর্ডার',
        message: `${user.name || 'সদস্য'} (${(user as any).memberId || 'N/A'}) ৳${orderAmount.toLocaleString('bn-BD')} টাকার al safi ব্র্যান্ড পণ্য অর্ডার করেছেন (${orderItemsText})।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: (user as any).memberId || '',
        userPhone: user.phone || '',
        amount: orderAmount,
        type: 'safi_order',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      await addDoc(collection(db, "transactions"), {
        id: transactionId,
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId,
        type: "safi_purchase",
        typeLabel: "সাফি প্রিমিয়াম ই-কমার্স অর্ডার",
        amount: orderAmount,
        status: "success",
        description: `সাফি অর্ডার: [${orderItemsText}]. ডেলিভারি ঠিকানা: ${orderData.address}, মোবাইল ১ (${orderData.primaryPhoneRelation || 'নিজের'}): ${orderData.primaryPhone}, মোবাইল ২ (${orderData.secondaryPhoneRelation || 'বিকল্প'}): ${orderData.secondaryPhone || 'নাই'}, কল পছন্দ: ${orderData.callPreference === 'primary' ? 'নাম্বার ১' : orderData.callPreference === 'secondary' ? 'নাম্বার ২' : 'যেকোনো'}, বিশেষ নোট: ${orderData.deliveryNote || 'নাই'}`,
        district: orderData.district || '',
        thana: orderData.thana || '',
        detailedAddress: orderData.detailedAddress || '',
        address: orderData.address,
        primaryPhone: orderData.primaryPhone,
        primaryPhoneRelation: orderData.primaryPhoneRelation || 'নিজের',
        secondaryPhone: orderData.secondaryPhone || '',
        secondaryPhoneRelation: orderData.secondaryPhoneRelation || '',
        callPreference: orderData.callPreference,
        deliveryNote: orderData.deliveryNote || '',
        liveLocation: orderData.liveLocation || null,
        items: orderData.items,
        createdAt: new Date().toISOString()
      });

      // Real-time automatic notification to user
      try {
        await addDoc(collection(db, "user_notifications"), {
          userId: user.uid,
          title: "সাফি প্রিমিয়াম অর্ডার নিশ্চিত হয়েছে 🛍️",
          message: `আপনার ৳${orderAmount} মূল্যের সাফি অর্ডারটি [${orderItemsText}] সফলভাবে গৃহিত হয়েছে। কুরিয়ার প্রতিনিধি শীঘ্রই আপনার সাথে যোগাযোগ করবেন।`,
          type: "safi_order",
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (notifErr) {
        console.warn("Notification error:", notifErr);
      }

      if (checkoutType === 'cart') {
        setCart([]);
      }
      
      setShowCheckoutModal(false);
      setSuccessOrder(transactionId);
      if (syncLiveProfile) syncLiveProfile();
      
      showToast("অর্ডার সফলভাবে সম্পন্ন হয়েছে! 🛍️", "success");
      speakVoiceGuide("অভিনন্দন! আপনার অর্ডারটি সফলভাবে গৃহিত হয়েছে। আমাদের প্রতিনিধি দ্রুত আপনার ঠিকানায় পণ্য পৌঁছে দেবে।");
    } catch (error: any) {
      console.error(error);
      showToast('অর্ডার করার সময় ত্রুটি ঘটেছে: ' + error.message, 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Product Filter Logic
  const filteredProducts = safiProducts.filter(product => {
    if (activeTab === 'favorites') {
      return favorites.includes(product.id);
    }
    const matchesSearch = product.name.toLowerCase().includes(safiSearchQuery.toLowerCase()) || 
                          product.desc.toLowerCase().includes(safiSearchQuery.toLowerCase()) ||
                          product.brand.toLowerCase().includes(safiSearchQuery.toLowerCase());
    const matchesCategory = !safiSelectedCategory || product.category === safiSelectedCategory;
    return matchesSearch && matchesCategory;
  });

  const isEffectiveAdmin = isAdmin && !adminPreviewAsUser;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="fixed inset-0 z-50 bg-[#f8fafc] w-full h-full min-h-screen font-sans flex flex-col text-slate-800"
    >
      {/* 1. Header Area */}
      <div className="bg-[#1e1e2d] text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0 border-b border-white/10">
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => {
              if (selectedProductDetails) { setSelectedProductDetails(null); return; }
              if (showCheckoutModal) { setShowCheckoutModal(false); return; }
              if (showProductModal) { setShowProductModal(false); return; }
              if (showCategoryModal) { setShowCategoryModal(false); return; }
              if (safiSelectedCategory) { setSafiSelectedCategory(null); return; }
              if (activeTab !== 'home') {
                setActiveTab('home');
                return;
              }
              onClose();
            }}
            className="p-1 px-3 bg-white/10 hover:bg-white/20 active:scale-95 transition rounded-xl text-xs font-black cursor-pointer border border-white/5 flex items-center gap-1"
          >
            <span>← ব্যাক</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🛍️</span>
            <div>
              <h1 className="text-xs sm:text-sm font-black tracking-wide leading-none">SAFI প্রিমিয়াম শপ</h1>
              <span className="text-[9px] text-amber-300 font-bold">আলীএক্সপ্রেস স্টাইল ই-কমার্স</span>
            </div>
          </div>
        </div>

        {/* Balance Display & Admin Mode Badge */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAdminPreviewAsUser(!adminPreviewAsUser)}
              className={`px-2 py-1 rounded-xl text-[9px] font-extrabold flex items-center gap-1 transition cursor-pointer border ${
                adminPreviewAsUser
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs'
              }`}
              title={adminPreviewAsUser ? "মেম্বার প্রিভিউ চলছে" : "এডমিন কন্ট্রোল সচল"}
            >
              {adminPreviewAsUser ? <Eye className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
              <span>{adminPreviewAsUser ? 'মেম্বার ভিউ' : '👑 এডমিন'}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 bg-white/10 border border-white/10 px-2.5 py-1 rounded-xl shadow-inner">
            <span className="text-[10px] text-slate-300 font-bold">ব্যালেন্স:</span>
            <span className="text-xs font-mono font-black text-amber-400">৳ {(user?.balance || 0).toLocaleString('bn-BD')}</span>
          </div>
        </div>
      </div>

      {/* 2. Top Admin Quick Toolbar (When Admin mode is active) */}
      {isEffectiveAdmin && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2 shadow-sm border-b border-amber-500/40 shrink-0">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-black">
              <span className="w-2 h-2 rounded-full bg-amber-200 animate-ping" />
              <span>👑 এডমিন কন্ট্রোল প্যানেল</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenCategoryManager}
                className="px-2.5 py-1 bg-white/20 hover:bg-white/30 active:scale-95 text-white font-extrabold text-[10px] rounded-lg transition border border-white/20 flex items-center gap-1 cursor-pointer shadow-3xs"
              >
                <Layers className="w-3 h-3" />
                <span>📁 ক্যাটাগরি ({safiCategories.length})</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAddProduct}
                className="px-2.5 py-1 bg-amber-300 hover:bg-amber-200 active:scale-95 text-slate-950 font-black text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>➕ নতুন পণ্য আপলোড</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Scrollable Body Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 max-w-lg mx-auto w-full pb-24">
        
        {/* Notice/Marquee Bar */}
        <div className="bg-white border-2 border-amber-500/70 rounded-full px-2.5 py-1 flex items-center gap-2.5 overflow-hidden shadow-xs max-w-xl mx-auto w-full shrink-0">
          <div className="bg-amber-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 shadow-3xs flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>ঘোষণা</span>
          </div>
          <div className="flex-grow overflow-hidden relative">
            <marquee className="text-[11px] font-extrabold text-slate-800 leading-none py-0.5" behavior="scroll" direction="left" scrollamount="4">
              {appConfig?.safiTicker || "প্রিমিয়াম Safi ব্র্যান্ডের শতভাগ খাঁটি পণ্য সম্ভার! আলীএক্সপ্রেস স্টাইলে ছবি টেনে দেখুন ও সরাসরি জিপিএস লাইভ লোকেশনে অর্ডার করুন।"}
            </marquee>
          </div>
        </div>

        {/* 4. Search Bar / Voice Assistance button */}
        <div className="flex gap-2 shrink-0">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={safiSearchQuery}
              onChange={(e) => setSafiSearchQuery(e.target.value)}
              placeholder="আলীএক্সপ্রেস ও Safi ব্র্যান্ডের পণ্য খুঁজুন..."
              className="pl-9 pr-3 py-2 w-full bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-3xs"
            />
            {safiSearchQuery && (
              <button 
                type="button"
                onClick={() => setSafiSearchQuery('')}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-650 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          
          <button
            type="button"
            onClick={handleVoiceButtonClick}
            className={`p-2.5 rounded-2xl flex items-center justify-center transition active:scale-95 shadow-3xs border cursor-pointer ${
              isVoiceOn 
                ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse' 
                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
            }`}
            title="ভয়েস গাইড শুনুন"
          >
            <Volume2 className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Render Tab Screens */}
        <AnimatePresence mode="wait">
          {successOrder ? (
            <motion.div 
              key="success-screen"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white border border-emerald-100 rounded-3xl p-6 text-center space-y-4 shadow-sm"
            >
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-emerald-800">অর্ডার সফলভাবে সম্পন্ন হয়েছে!</h3>
                <p className="text-xs text-slate-500 font-bold">অর্ডার ট্র্যাকিং আইডি: {successOrder}</p>
              </div>
              <p className="text-xs text-slate-650 leading-relaxed bg-slate-50 p-3 rounded-2xl font-semibold">
                আপনার মেইন ব্যালেন্স থেকে টাকা কেটে নেওয়া হয়েছে। আমাদের কুরিয়ার প্রতিনিধি দ্রুত লাইভ লোকেশনে পণ্যটি পৌঁছে দেবেন।
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessOrder(null);
                    setActiveTab('account');
                  }}
                  className="flex-1 bg-[#1e1e2d] hover:bg-black text-white text-xs font-black py-2.5 rounded-xl cursor-pointer transition active:scale-95"
                >
                  অর্ডার হিস্টোরি দেখুন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessOrder(null);
                    setActiveTab('home');
                  }}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black py-2.5 rounded-xl cursor-pointer transition active:scale-95"
                >
                  আরও কেনাকাটা করুন
                </button>
              </div>
            </motion.div>
          ) : activeTab === 'home' ? (
            // ================= HOME TAB =================
            <motion.div 
              key="home-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Horizontal Category Row - 6-7 visible, scrollable */}
              <div className="flex items-start gap-1.5 sm:gap-2 overflow-x-auto pb-1 pt-0.5 px-0.5 scrollbar-none scroll-smooth touch-pan-x select-none">
                {safiCategories.map((cat, idx) => (
                  <div
                    key={`${cat.id}-${idx}`}
                    className="flex flex-col items-center text-center space-y-0.5 focus:outline-none group relative shrink-0 w-[54px] sm:w-[58px]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSafiSelectedCategory(cat.id);
                        setActiveTab('shop');
                        speakVoiceGuide(`${cat.nameBn} ক্যাটাগরি ফিল্টার করা হয়েছে।`);
                      }}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-1.5 border-slate-200 group-hover:border-amber-500 group-hover:scale-105 active:scale-95 transition-all duration-200 shadow-2xs flex items-center justify-center bg-white cursor-pointer relative"
                    >
                      <img 
                        src={cat.image || 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=150&auto=format&fit=crop&q=80'} 
                        alt={cat.nameBn} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </button>

                    {isEffectiveAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCategoryInit(cat);
                          setShowCategoryModal(true);
                        }}
                        className="absolute -top-0.5 right-0 bg-amber-500 hover:bg-amber-600 text-slate-950 p-0.5 rounded-full shadow-xs z-20 transition"
                        title="ক্যাটাগরি ছবি ও নাম এডিট করুন"
                      >
                        <Edit className="w-2 h-2" />
                      </button>
                    )}

                    <span 
                      className="text-[8.5px] sm:text-[9px] font-bold text-slate-900 leading-[1.15] text-center w-full px-0.5 break-words block group-hover:text-amber-700 min-h-[20px] flex items-center justify-center"
                      title={cat.nameBn}
                    >
                      {cat.nameBn}
                    </span>
                  </div>
                ))}

                {isEffectiveAdmin && (
                  <div className="flex flex-col items-center text-center space-y-0.5 focus:outline-none shrink-0 w-[54px] sm:w-[58px]">
                    <button
                      type="button"
                      onClick={handleOpenCategoryManager}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-1.5 border-dashed border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-2xs"
                      title="নতুন ক্যাটাগরি তৈরি ও সাজান"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="text-[8.5px] font-black text-amber-800 leading-[1.15] text-center w-full min-h-[20px] flex items-center justify-center">
                      + ক্যাটাগরি
                    </span>
                  </div>
                )}
              </div>

              {/* Popular Products Header & Wishlist Button */}
              <div className="flex justify-between items-center px-1 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🔥</span>
                  <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-wider">জনপ্রিয় পণ্যসমূহ</h4>
                </div>
                <div className="flex items-center gap-2">
                  {favorites.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('favorites')}
                      className="text-[9.5px] bg-rose-50 hover:bg-rose-100 text-rose-600 font-black px-2 py-0.5 rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer border border-rose-200 shadow-3xs"
                    >
                      <Heart className="w-3 h-3 fill-rose-600" />
                      <span>প্রিয় ({favorites.length})</span>
                    </button>
                  )}
                  {isEffectiveAdmin && (
                    <button
                      type="button"
                      onClick={handleOpenAddProduct}
                      className="text-[9.5px] bg-amber-600 hover:bg-amber-700 text-white font-black px-2 py-0.5 rounded-lg transition active:scale-95 flex items-center gap-0.5 cursor-pointer shadow-3xs"
                    >
                      <Plus className="w-3 h-3" />
                      <span>পণ্য যোগ</span>
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => {
                      setSafiSelectedCategory(null);
                      setActiveTab('shop');
                    }}
                    className="text-[10px] text-amber-600 font-black hover:underline cursor-pointer"
                  >
                    সবগুলো দেখুন →
                  </button>
                </div>
              </div>

              {/* 2-Column Popular Items Grid (AliExpress Card Layout) */}
              <div className="grid grid-cols-2 gap-2.5">
                {safiProducts.slice(0, 8).map((product, idx) => {
                  const isFav = favorites.includes(product.id);
                  return (
                    <div 
                      key={`${product.id}-${idx}`} 
                      onClick={() => setSelectedProductDetails(product)}
                      className="bg-white border border-slate-150 rounded-2xl overflow-hidden flex flex-col justify-between shadow-3xs hover:shadow-md hover:border-amber-300 transition-all duration-200 relative group cursor-pointer"
                    >
                      {/* Badge and Sale tags */}
                      <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-1">
                        {product.badge && (
                          <span className="text-[7.5px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide shadow-2xs">
                            {product.badge}
                          </span>
                        )}
                        {product.sale && (
                          <span className="text-[7.5px] bg-amber-500 text-slate-900 font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide shadow-2xs">
                            Sale
                          </span>
                        )}
                      </div>

                      {/* Favorite Wishlist Heart Button */}
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(product, e)}
                        className={`absolute top-1.5 right-1.5 z-20 p-1.5 rounded-full backdrop-blur-xs transition active:scale-80 cursor-pointer shadow-xs ${
                          isFav ? 'bg-white text-rose-600' : 'bg-black/40 text-white hover:bg-black/60'
                        }`}
                        title={isFav ? "পছন্দের তালিকা থেকে সরান" : "পছন্দের তালিকায় যুক্ত করুন"}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-600 text-rose-600' : ''}`} />
                      </button>

                      {/* Admin Floating Controls */}
                      {isEffectiveAdmin && (
                        <div className="absolute bottom-28 right-1.5 z-20 flex flex-col gap-1 bg-black/60 backdrop-blur-xs p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditProduct(product, e)}
                            className="bg-amber-400 hover:bg-amber-300 text-slate-950 p-1 rounded-lg text-[8px] font-black transition cursor-pointer"
                            title="এডিট করুন"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProductPrompt(product.id, product.name, e)}
                            className="bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-lg text-[8px] font-black transition cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Product Image */}
                      <div className="w-full aspect-square bg-slate-50 overflow-hidden relative flex items-center justify-center">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-4xl">{product.emoji || '📦'}</span>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="p-2.5 flex-1 flex flex-col justify-between text-left space-y-1.5">
                        <div>
                          <span className="text-[7.5px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-black uppercase inline-block">
                            {product.brand}
                          </span>
                          <h4 className="font-extrabold text-[11px] text-slate-900 leading-tight line-clamp-2 mt-0.5 group-hover:text-amber-700">
                            {product.name}
                          </h4>
                          
                          <div className="flex items-center gap-1.5 text-[8.5px] text-slate-500 font-bold mt-1">
                            <span className="text-amber-500 flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-amber-400" /> {product.rating || '5.0'}
                            </span>
                            <span>•</span>
                            <span>{product.soldCount || '10K+ বিক্রি'}</span>
                          </div>
                        </div>

                        {/* Buy & Cart Section */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          <div className="flex flex-col">
                            {product.regularPrice && product.regularPrice > product.price && (
                              <span className="text-[8px] text-slate-400 line-through leading-none">৳{product.regularPrice}</span>
                            )}
                            <span className="font-mono text-xs sm:text-sm font-black text-slate-900 leading-none">৳{product.price}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => addToCart(product, e)}
                              className="bg-amber-100 hover:bg-amber-200 text-amber-800 p-1.5 rounded-lg active:scale-90 transition cursor-pointer"
                              title="কার্টে যোগ করুন"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleInitiateCheckout('single', product, e)}
                              className="bg-[#1e1e2d] hover:bg-black text-white font-black text-[9px] py-1 px-2.5 rounded-lg active:scale-90 transition cursor-pointer"
                            >
                              কিনুন
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : activeTab === 'shop' || activeTab === 'favorites' ? (
            // ================= SHOP & FAVORITES TAB =================
            <motion.div 
              key="shop-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 text-left"
            >
              {/* Filter Display Bar */}
              <div className="flex items-center justify-between bg-white border border-slate-200 p-2.5 rounded-2xl shadow-3xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">{activeTab === 'favorites' ? '❤️' : '🛍️'}</span>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                      {activeTab === 'favorites' 
                        ? 'পছন্দের পণ্যসমূহ (Wishlist)' 
                        : (safiSelectedCategory ? safiCategories.find(c => c.id === safiSelectedCategory)?.nameBn : 'সকল ক্যাটাগরির পণ্য')}
                    </h4>
                    <p className="text-[8.5px] text-slate-450 font-bold">{filteredProducts.length}টি পণ্য প্রদর্শিত হচ্ছে</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {isEffectiveAdmin && (
                    <button
                      type="button"
                      onClick={handleOpenAddProduct}
                      className="text-[9.5px] bg-[#057A55] hover:bg-emerald-800 text-white font-black py-1 px-2.5 rounded-lg transition active:scale-95 cursor-pointer shadow-3xs flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>নতুন পণ্য</span>
                    </button>
                  )}
                  {safiSelectedCategory && (
                    <button
                      type="button"
                      onClick={() => setSafiSelectedCategory(null)}
                      className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-1 px-2 rounded-lg transition active:scale-95 cursor-pointer"
                    >
                      রিসেট ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Horizontal Category selector */}
              {activeTab === 'shop' && (
                <div className="flex gap-2 overflow-x-auto py-1.5 scrollbar-none scroll-smooth select-none">
                  <button
                    type="button"
                    onClick={() => setSafiSelectedCategory(null)}
                    className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition cursor-pointer shrink-0 shadow-2xs ${
                      !safiSelectedCategory 
                        ? 'bg-amber-600 text-white border border-amber-700' 
                        : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    সব পণ্য ({safiProducts.length})
                  </button>
                  {safiCategories.map((cat, idx) => (
                    <button
                      key={`${cat.id}-${idx}`}
                      type="button"
                      onClick={() => setSafiSelectedCategory(cat.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs ${
                        safiSelectedCategory === cat.id 
                          ? 'bg-amber-600 text-white border border-amber-700' 
                          : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{cat.nameBn}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Full Product Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {filteredProducts.map((product, idx) => {
                  const isFav = favorites.includes(product.id);
                  return (
                    <div 
                      key={`${product.id}-${idx}`} 
                      onClick={() => setSelectedProductDetails(product)}
                      className="bg-white border border-slate-150 rounded-2xl overflow-hidden flex flex-col justify-between shadow-3xs hover:shadow-md transition duration-200 relative group cursor-pointer"
                    >
                      <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-1">
                        {product.badge && (
                          <span className="text-[7px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                            {product.badge}
                          </span>
                        )}
                      </div>

                      {/* Favorite toggle */}
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(product, e)}
                        className={`absolute top-1.5 right-1.5 z-20 p-1.5 rounded-full backdrop-blur-xs transition active:scale-80 cursor-pointer shadow-xs ${
                          isFav ? 'bg-white text-rose-600' : 'bg-black/40 text-white hover:bg-black/60'
                        }`}
                        title={isFav ? "পছন্দের তালিকা থেকে সরান" : "পছন্দের তালিকায় যুক্ত করুন"}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-600 text-rose-600' : ''}`} />
                      </button>

                      {isEffectiveAdmin && (
                        <div className="absolute bottom-28 right-1.5 z-20 flex flex-col gap-1 bg-black/60 backdrop-blur-xs p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditProduct(product, e)}
                            className="p-1 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-[8px] font-black transition cursor-pointer"
                            title="এডিট"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProductPrompt(product.id, product.name, e)}
                            className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[8px] font-black transition cursor-pointer"
                            title="মুছুন"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="w-full aspect-square bg-slate-50 overflow-hidden relative flex items-center justify-center">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-4xl">{product.emoji || '📦'}</span>
                        )}
                      </div>

                      <div className="p-2.5 flex-1 flex flex-col justify-between space-y-1.5">
                        <div>
                          <span className="text-[7.5px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded font-black uppercase">
                            {product.brand}
                          </span>
                          <h4 className="font-extrabold text-[10.5px] text-slate-900 leading-tight line-clamp-2 mt-0.5">
                            {product.name}
                          </h4>
                          <p className="text-[8.5px] text-slate-500 font-medium line-clamp-2 mt-1">
                            {product.desc}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                          <div className="flex flex-col">
                            {product.regularPrice && product.regularPrice > product.price && (
                              <span className="text-[7.5px] text-slate-400 line-through leading-none">৳{product.regularPrice}</span>
                            )}
                            <span className="font-mono text-xs font-black text-slate-900">৳{product.price}</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={(e) => addToCart(product, e)}
                              className="bg-amber-100 hover:bg-amber-200 text-amber-800 p-1.5 rounded-lg active:scale-90 transition cursor-pointer"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleInitiateCheckout('single', product, e)}
                              className="bg-[#1e1e2d] hover:bg-black text-white font-black text-[8px] py-1 px-1.5 rounded-lg cursor-pointer"
                            >
                              কিনুন
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <div className="col-span-2 p-8 text-center space-y-2 bg-white rounded-3xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">
                      {activeTab === 'favorites' ? 'আপনার কোনো প্রিয় পণ্য তালিকায় নেই।' : 'দুঃখিত, কোনো পণ্য পাওয়া যায়নি।'}
                    </p>
                    <button 
                      type="button"
                      onClick={() => {
                        setSafiSelectedCategory(null);
                        setActiveTab('home');
                      }}
                      className="text-xs bg-amber-500 text-slate-950 font-black px-4 py-1.5 rounded-xl cursor-pointer"
                    >
                      হোম পেজে যান
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === 'vacation_sale' ? (
            // ================= VACATION SALE TAB =================
            <motion.div 
              key="sale-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 text-left"
            >
              <div className="bg-gradient-to-r from-red-600 to-amber-600 text-white p-3.5 rounded-3xl shadow-sm space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🔥</span>
                  <h4 className="text-xs font-black uppercase tracking-wider">ভ্যাকেশন মেগা সেল</h4>
                </div>
                <p className="text-[10px] text-white/90 font-medium">সাফি ব্র্যান্ডের সেরা অফারযুক্ত স্পেশাল কালেকশন</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {safiProducts.filter(p => p.sale).map((product, idx) => (
                  <div 
                    key={`${product.id}-${idx}`}
                    onClick={() => setSelectedProductDetails(product)}
                    className="bg-white border border-red-100 rounded-2xl overflow-hidden flex flex-col justify-between shadow-3xs relative cursor-pointer"
                  >
                    <span className="absolute top-1.5 left-1.5 bg-red-600 text-white font-black text-[7.5px] px-1.5 py-0.5 rounded shadow-xs z-10">
                      HOT SALE
                    </span>
                    <div className="w-full aspect-square bg-slate-50 overflow-hidden flex items-center justify-center">
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="p-2.5 space-y-1">
                      <h4 className="font-extrabold text-[10.5px] text-slate-900 line-clamp-1">{product.name}</h4>
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-xs font-black text-red-600">৳{product.price}</span>
                        {product.regularPrice && (
                          <span className="text-[8px] text-slate-400 line-through">৳{product.regularPrice}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleInitiateCheckout('single', product, e)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white text-[9px] font-black py-1 rounded-lg cursor-pointer transition active:scale-95"
                      >
                        অর্ডার করুন
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : activeTab === 'cart' ? (
            // ================= CART TAB =================
            <motion.div 
              key="cart-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 text-left animate-fade-in"
            >
              <div className="flex items-center gap-2 px-1">
                <ShoppingCart className="w-5 h-5 text-amber-700" />
                <h4 className="text-sm font-black text-slate-800">আপনার শপিং কার্ট ({cart.length})</h4>
              </div>

              {cart.length === 0 ? (
                <div className="p-10 text-center space-y-3 bg-white rounded-3xl border border-slate-150">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-450">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <p className="text-xs text-slate-500 font-bold">আপনার কার্টটি এখন খালি আছে।</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('home')}
                    className="bg-[#1e1e2d] text-white font-black text-xs px-5 py-2 rounded-xl transition active:scale-95 cursor-pointer"
                  >
                    কেনাকাটা করতে ফিরে যান
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    {cart.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="bg-white border border-slate-200 rounded-2xl p-3 flex gap-3 shadow-3xs relative overflow-hidden">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">{item.emoji}</div>
                          )}
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black uppercase">{item.brand}</span>
                              <h5 className="font-extrabold text-xs text-slate-900 line-clamp-1 mt-0.5">{item.name}</h5>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex justify-between items-center mt-2">
                            <span className="font-mono font-black text-amber-800 text-sm">৳{item.price * item.quantity}</span>
                            
                            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-2 py-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, -1)}
                                className="text-slate-600 hover:text-black font-black text-sm cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-xs font-mono font-bold text-slate-900 w-4 text-center">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, 1)}
                                className="text-slate-600 hover:text-black font-black text-sm cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* WhatsApp-Style GPS Live Location Widget */}
                  <SafiLiveLocationWidget
                    currentAddress={address}
                    onAddressChange={setAddress}
                    onLocationPinned={setLiveLocation}
                    initialLocation={liveLocation}
                  />

                  {/* Summary & Checkout Card */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3 shadow-sm">
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">অর্ডার সারাংশ</h5>
                    
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600 font-semibold">
                        <span>মোট আইটেম মূল্য:</span>
                        <span className="font-mono">৳{getSubTotal()}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 font-semibold">
                        <span>হোম ডেলিভারি চার্জ:</span>
                        <span className="font-mono">৳{deliveryCharge}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
                        <span>সর্বমোট মূল্য:</span>
                        <span className="font-mono text-amber-600">৳{getGrandTotal()}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInitiateCheckout('cart')}
                      className="w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 active:scale-98 text-white font-black text-xs py-3 rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>নিরাপদ চেকআউট করুন (৳{getGrandTotal()})</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            // ================= ACCOUNT TAB =================
            <motion.div 
              key="account-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 text-left animate-fade-in"
            >
              <div className="bg-white border border-slate-200 rounded-3xl p-4 flex items-center gap-3.5 shadow-3xs">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-black text-lg border-2 border-amber-300">
                  {user?.name ? user.name[0] : 'S'}
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">{user?.name || 'সাফি গ্রাহক'}</h4>
                  <p className="text-[10px] text-slate-500 font-mono font-bold">আইডি: {user?.memberId} | {user?.phone}</p>
                </div>
              </div>

              {/* WhatsApp-Style Live GPS Location Widget */}
              <SafiLiveLocationWidget
                currentAddress={address}
                onAddressChange={setAddress}
                onLocationPinned={setLiveLocation}
                initialLocation={liveLocation}
              />

              {/* Phone Field */}
              <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-2 shadow-3xs">
                <label className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-amber-600" />
                  <span>মোবাইল নম্বর</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="মোবাইল নম্বর..."
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Quality Assurances */}
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="bg-white border border-slate-150 p-3 rounded-2xl flex items-center gap-2.5 shadow-3xs">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black text-slate-900 block leading-tight">100% আসল পণ্য</span>
                    <span className="text-[8px] text-slate-400 font-bold block">কোয়ালিটি পরীক্ষিত</span>
                  </div>
                </div>
                <div className="bg-white border border-slate-150 p-3 rounded-2xl flex items-center gap-2.5 shadow-3xs">
                  <CheckCircle className="w-6 h-6 text-amber-600 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black text-slate-900 block leading-tight">দ্রুত কুরিয়ার</span>
                    <span className="text-[8px] text-slate-400 font-bold block">হোম ডেলিভারি</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ================= MODAL 1: ALIEXPRESS PRODUCT DETAILS MODAL ================= */}
      <AnimatePresence>
        {selectedProductDetails && (
          <SafiProductDetailsModal
            product={selectedProductDetails}
            onClose={() => setSelectedProductDetails(null)}
            isFavorite={favorites.includes(selectedProductDetails.id)}
            onToggleFavorite={(p) => toggleFavorite(p)}
            onAddToCart={(p) => addToCart(p)}
            onBuyNow={(p) => {
              setSelectedProductDetails(null);
              handleInitiateCheckout('single', p);
            }}
            onAdminEdit={(p) => {
              setSelectedProductDetails(null);
              handleOpenEditProduct(p);
            }}
            isAdmin={isEffectiveAdmin}
            cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
            onOpenCart={() => {
              setSelectedProductDetails(null);
              setActiveTab('cart');
            }}
          />
        )}
      </AnimatePresence>

      {/* ================= MODAL 2: ADMIN PRODUCT ADD / EDIT MODAL ================= */}
      <AnimatePresence>
        {showProductModal && (
          <SafiAdminProductModal
            isOpen={showProductModal}
            onClose={() => {
              setShowProductModal(false);
              setEditingProduct(null);
            }}
            editingProduct={editingProduct}
            categories={safiCategories}
            selectedCategory={safiSelectedCategory}
            onSaveProduct={handleSaveProductFromModal}
            isSaving={isSavingProduct}
          />
        )}
      </AnimatePresence>

      {/* ================= MODAL 3: ADMIN CATEGORY MANAGEMENT MODAL ================= */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs overflow-y-auto font-sans">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl text-left my-auto border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="bg-gradient-to-r from-amber-600 to-amber-800 text-white p-4 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-black flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>{editingCategory ? '✏️ ক্যাটাগরি এডিট করুন' : '📁 ক্যাটাগরি ম্যানেজমেন্ট'}</span>
                </h3>
                <button 
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin text-xs text-slate-800">
                <form onSubmit={handleSaveCategory} className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-600 uppercase">ক্যাটাগরি বাংলা নাম *</label>
                    <input
                      type="text"
                      required
                      value={catFormNameBn}
                      onChange={(e) => setCatFormNameBn(e.target.value)}
                      placeholder="যেমন: ফ্যাশন ও পোশাক"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-600 uppercase">ইংলিশ নাম / আইডি</label>
                    <input
                      type="text"
                      value={catFormName}
                      onChange={(e) => setCatFormName(e.target.value)}
                      placeholder="e.g., Clothing & Fashion"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-600 uppercase">ক্যাটাগরি ছবি (URL)</label>
                    <input
                      type="text"
                      value={catFormImage}
                      onChange={(e) => setCatFormImage(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-amber-500 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingCategory}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-xs transition cursor-pointer"
                  >
                    {isSavingCategory ? 'সংরক্ষণ হচ্ছে...' : (editingCategory ? 'ক্যাটাগরি আপডেট করুন' : '+ নতুন ক্যাটাগরি যুক্ত করুন')}
                  </button>
                </form>

                {/* Existing Categories List */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <span className="text-[11px] font-black text-slate-900 block">বিদ্যমান ক্যাটাগরি তালিকা ({safiCategories.length})</span>
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto scrollbar-thin border border-slate-200 rounded-2xl bg-white">
                    {safiCategories.map((cat, idx) => (
                      <div key={`${cat.id}-${idx}`} className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition text-xs">
                        <div className="flex items-center gap-2.5">
                          <img 
                            src={cat.image || 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=200&auto=format&fit=crop&q=80'} 
                            alt={cat.nameBn} 
                            className="w-8 h-8 rounded-full object-cover border border-amber-300 shadow-2xs" 
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="font-extrabold text-slate-900 block leading-tight">{cat.nameBn}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{cat.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditCategoryInit(cat)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg transition font-black cursor-pointer"
                            title="এডিট"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategoryPrompt(cat.id, cat.nameBn)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition font-black cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: IN-APP DELETE CONFIRMATION MODAL ================= */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-sans text-slate-800">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-sm border border-slate-100 p-6 text-center space-y-4"
            >
              <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <Trash2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-900">
                  {deleteTarget.type === "product" ? "পণ্য মুছে ফেলার নিশ্চয়তা" : "ক্যাটাগরি মুছে ফেলার নিশ্চয়তা"}
                </h3>
                <p className="text-xs text-slate-600 font-bold leading-relaxed px-2">
                  আপনি কি নিশ্চিতভাবে <span className="text-rose-600 font-black">"{deleteTarget.name}"</span> মুছে ফেলতে চান?
                </p>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>মুছছি...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>হ্যাঁ, মুছে ফেলুন</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING TOAST NOTIFICATION BANNER */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-90 px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-extrabold max-w-sm w-[90%] ${
              toastMessage.type === "success"
                ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30"
                : "bg-rose-600 text-white border-rose-500 shadow-rose-900/30"
            }`}
          >
            <span className="text-base">{toastMessage.type === "success" ? "✅" : "⚠️"}</span>
            <span className="flex-1 leading-snug">{toastMessage.text}</span>
            <button 
              type="button" 
              onClick={() => setToastMessage(null)}
              className="text-white/80 hover:text-white p-1 font-bold cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= MODAL 4: FULL SCREEN 2-STEP CHECKOUT WORKFLOW ================= */}
      <AnimatePresence>
        {showCheckoutModal && (
          <SafiCheckoutModal
            isOpen={showCheckoutModal}
            onClose={() => setShowCheckoutModal(false)}
            user={user}
            checkoutType={checkoutType}
            singleProduct={singleItemToBuy}
            cartItems={cart}
            deliveryCharge={deliveryCharge}
            onConfirmOrder={handleConfirmOrder}
            isLoading={checkoutLoading}
          />
        )}
      </AnimatePresence>

      {/* 5. Bottom Navigation Bar */}
      <div className="bg-[#1e1e2d] text-white border-t border-white/10 px-4 py-2 flex justify-around items-center shrink-0 fixed bottom-0 inset-x-0 z-40 max-w-lg mx-auto shadow-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${
            activeTab === 'home' ? 'text-amber-400 font-black scale-105' : 'text-slate-400 font-medium hover:text-slate-200'
          }`}
        >
          <span className="text-base">🏠</span>
          <span className="text-[9px]">হোম</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSafiSelectedCategory(null);
            setActiveTab('shop');
          }}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${
            activeTab === 'shop' ? 'text-amber-400 font-black scale-105' : 'text-slate-400 font-medium hover:text-slate-200'
          }`}
        >
          <span className="text-base">🛍️</span>
          <span className="text-[9px]">শপ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vacation_sale')}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition relative ${
            activeTab === 'vacation_sale' ? 'text-amber-400 font-black scale-105' : 'text-slate-400 font-medium hover:text-slate-200'
          }`}
        >
          <span className="text-base">🔥</span>
          <span className="text-[9px]">অফার</span>
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[7px] font-black px-1 rounded-full animate-bounce">
            Hot
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('favorites')}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition relative ${
            activeTab === 'favorites' ? 'text-rose-400 font-black scale-105' : 'text-slate-400 font-medium hover:text-slate-200'
          }`}
        >
          <Heart className={`w-4 h-4 ${activeTab === 'favorites' ? 'fill-rose-400 text-rose-400' : 'text-slate-400'}`} />
          <span className="text-[9px]">উইশলিস্ট</span>
          {favorites.length > 0 && (
            <span className="absolute -top-1 -right-1.5 bg-rose-600 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
              {favorites.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cart')}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition relative ${
            activeTab === 'cart' ? 'text-amber-400 font-black scale-105' : 'text-slate-400 font-medium hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="text-[9px]">কার্ট</span>
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${
            activeTab === 'account' ? 'text-amber-400 font-black scale-105' : 'text-slate-400 font-medium hover:text-slate-200'
          }`}
        >
          <span className="text-base">👤</span>
          <span className="text-[9px]">অ্যাকাউন্ট</span>
        </button>
      </div>
    </motion.div>
  );
}
