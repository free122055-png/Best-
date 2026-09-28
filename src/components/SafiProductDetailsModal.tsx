import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, ChevronRight, Heart, Share2, ShoppingCart, 
  Sparkles, ShieldCheck, CheckCircle, Truck, RotateCcw, 
  Star, Edit, ShoppingBag, ArrowLeft, PackageCheck, Award
} from 'lucide-react';
import { SafiProduct } from './SafiPremiumShop';

interface SafiProductDetailsModalProps {
  product: SafiProduct | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (product: SafiProduct) => void;
  onAddToCart: (product: SafiProduct) => void;
  onBuyNow: (product: SafiProduct) => void;
  onAdminEdit?: (product: SafiProduct) => void;
  isAdmin?: boolean;
  cartCount?: number;
  onOpenCart?: () => void;
}

export default function SafiProductDetailsModal({
  product,
  onClose,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
  onBuyNow,
  onAdminEdit,
  isAdmin = false,
  cartCount = 0,
  onOpenCart
}: SafiProductDetailsModalProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  if (!product) return null;

  // Prepare images list (supports array of images or fallback to single image)
  const images: string[] = [];
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    images.push(...product.images);
  } else if (product.image) {
    images.push(product.image);
  } else {
    images.push('https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=500&auto=format&fit=crop&q=80');
  }

  const currentImage = images[activeImageIndex] || images[0];

  // Touch Swipe Handlers (Swipe left -> next, Swipe right -> prev)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    const minSwipeDistance = 45;

    if (distance > minSwipeDistance) {
      // Swiped Left -> Show Next Image
      handleNextImage();
    } else if (distance < -minSwipeDistance) {
      // Swiped Right -> Show Previous Image
      handlePrevImage();
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `${product.name} - মাত্র ৳${product.price} টাকায় Safi প্রিমিয়াম শপে!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${product.name} - ৳${product.price}`);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  const discountPercent = product.regularPrice && product.regularPrice > product.price
    ? Math.round(((product.regularPrice - product.price) / product.regularPrice) * 100)
    : null;

  return (
    <div className="fixed inset-0 z-65 flex items-center justify-center bg-black/80 backdrop-blur-xs font-sans overflow-hidden">
      <motion.div 
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-white w-full h-full sm:h-[94vh] sm:max-w-lg sm:rounded-3xl flex flex-col overflow-hidden text-slate-900 shadow-2xl relative"
      >
        {/* 1. AliExpress Top Navigation Bar */}
        <div className="bg-white/95 backdrop-blur-md border-b border-slate-150 px-3.5 py-2.5 flex items-center justify-between z-30 shrink-0 sticky top-0 shadow-2xs">
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={onClose}
              className="w-8.5 h-8.5 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-800 transition cursor-pointer"
              title="ফিরে যান"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div>
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider flex items-center gap-1">
                <span>{product.brand || 'Safi Official'}</span>
                <span className="text-[8px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-extrabold">VERIFIED</span>
              </span>
              <p className="text-[11px] font-extrabold text-slate-900 truncate max-w-[170px] sm:max-w-[220px]">
                {product.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Admin Quick Edit Button */}
            {isAdmin && onAdminEdit && (
              <button
                type="button"
                onClick={() => onAdminEdit(product)}
                className="p-2 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 transition active:scale-95 cursor-pointer"
                title="পণ্য এডিট করুন"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}

            {/* Share Button */}
            <button
              type="button"
              onClick={handleShare}
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 cursor-pointer relative"
              title="শেয়ার করুন"
            >
              <Share2 className="w-4 h-4" />
              {copiedToast && (
                <span className="absolute -bottom-7 right-0 bg-black text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                  কপি হয়েছে!
                </span>
              )}
            </button>

            {/* Favorite Wishlist Heart */}
            <button
              type="button"
              onClick={() => onToggleFavorite(product)}
              className={`p-2 rounded-full transition active:scale-90 cursor-pointer ${
                isFavorite 
                  ? 'bg-rose-50 text-rose-600' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title={isFavorite ? 'পছন্দের তালিকা থেকে সরান' : 'পছন্দের তালিকায় যুক্ত করুন'}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-600 text-rose-600' : ''}`} />
            </button>

            {/* Cart Icon */}
            {onOpenCart && (
              <button
                type="button"
                onClick={onOpenCart}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 cursor-pointer relative"
                title="কার্ট দেখুন"
              >
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs animate-scale-in">
                    {cartCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 2. Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto pb-28 scrollbar-thin">
          
          {/* Touch-Swipeable AliExpress Image Gallery Container */}
          <div 
            className="w-full bg-slate-50 relative select-none overflow-hidden touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Main Stage Image with Animated Transitions */}
            <div className="w-full aspect-square max-h-[380px] bg-slate-100 relative flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.img 
                  key={currentImage}
                  src={currentImage} 
                  alt={product.name} 
                  initial={{ opacity: 0.6, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.6 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>

              {/* Top-Left Badge */}
              {product.badge && (
                <span className="absolute top-3 left-3 bg-gradient-to-r from-red-600 to-amber-600 text-white font-black text-[10px] px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{product.badge}</span>
                </span>
              )}

              {/* AliExpress Counter Pill (Top-Right) */}
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10.5px] font-mono font-black px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                <span>{activeImageIndex + 1}</span>
                <span className="text-white/60">/</span>
                <span>{images.length}</span>
              </div>

              {/* Swipe Arrow Left */}
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={handlePrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition active:scale-90 cursor-pointer shadow-md"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {/* Swipe Arrow Right */}
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={handleNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition active:scale-90 cursor-pointer shadow-md"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              {/* Bottom Swipe Guidance Hint */}
              <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                <span className="text-[9px] bg-black/50 backdrop-blur-xs text-white/90 px-2.5 py-0.5 rounded-full font-semibold">
                  👈 ডানে বা বামে টেনে ছবি পরিবর্তন করুন 👉
                </span>
              </div>
            </div>

            {/* Clickable Horizontal Thumbnail Strip */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 p-2.5 bg-white border-y border-slate-150 overflow-x-auto scrollbar-none justify-center">
                {images.map((imgSrc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                      activeImageIndex === idx 
                        ? 'border-amber-600 scale-105 shadow-sm ring-2 ring-amber-400/50' 
                        : 'border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img 
                      src={imgSrc} 
                      alt={`Thumbnail ${idx + 1}`} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info Section */}
          <div className="p-4 space-y-4">
            
            {/* Price & Discounts Block */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="font-mono text-2xl sm:text-3xl font-black text-amber-600">
                  ৳{product.price}
                </span>
                {product.regularPrice && product.regularPrice > product.price && (
                  <span className="font-mono text-sm text-slate-400 line-through">
                    ৳{product.regularPrice}
                  </span>
                )}
                {discountPercent && (
                  <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-md font-black">
                    -{discountPercent}% ছাড়
                  </span>
                )}
                {product.discountText && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-black">
                    {product.discountText}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-snug pt-1">
                {product.name}
              </h1>

              {/* Rating & Sales Badge */}
              <div className="flex items-center gap-3 pt-1 text-xs text-slate-600 font-bold">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-3.5 h-3.5 fill-amber-500" />
                  <span className="font-black text-slate-800">{product.rating || '4.9'}</span>
                  <span className="text-[10px] text-slate-400 font-medium">({product.reviews || '450'} রিভিউ)</span>
                </div>
                <span className="text-slate-300">|</span>
                <span className="text-slate-700 font-extrabold">{product.soldCount || '1.2K+ বিক্রি'}</span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-700 font-black flex items-center gap-0.5">
                  <PackageCheck className="w-3 h-3" />
                  <span>{product.stock || 'স্টকে আছে'}</span>
                </span>
              </div>
            </div>

            {/* Rich Detailed Description Box (AliExpress Style) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-left">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <span>📝 পণ্যের বিস্তারিত বিবরণ ও স্পেসিফিকেশন</span>
                </h4>
                <span className="text-[9px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-extrabold">
                  {product.brand || 'Safi Brand'}
                </span>
              </div>

              {/* Formatted Text Box */}
              <div className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-line pt-1">
                {product.desc || 'Safi ইন-হাউস প্রিমিয়াম পণ্য। সর্বোচ্চ গুণগত মান ও বিশুদ্ধতা নিশ্চিত করে তৈরি করা হয়েছে।'}
              </div>
            </div>

            {/* Service Guarantees (AliExpress Standard) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center gap-2.5 text-left">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-[10.5px] font-black text-emerald-950 block">১০০% আসল ও খাঁটি</span>
                  <span className="text-[8.5px] text-emerald-700 font-semibold block">ল্যাব টেস্টে পরীক্ষিত কোয়ালিটি</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center gap-2.5 text-left">
                <RotateCcw className="w-5 h-5 text-amber-700 shrink-0" />
                <div>
                  <span className="text-[10.5px] font-black text-amber-950 block">৭ দিনের রিপ্লেসমেন্ট</span>
                  <span className="text-[8.5px] text-amber-700 font-semibold block">সহজ রিটার্ন গ্যারান্টি</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-center gap-2.5 text-left">
                <Truck className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <span className="text-[10.5px] font-black text-blue-950 block">দ্রুত হোম ডেলিভারি</span>
                  <span className="text-[8.5px] text-blue-700 font-semibold block">সারা দেশে কুরিয়ার সার্ভিস</span>
                </div>
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-2xl flex items-center gap-2.5 text-left">
                <Award className="w-5 h-5 text-purple-600 shrink-0" />
                <div>
                  <span className="text-[10.5px] font-black text-purple-950 block">Safi স্পেশাল গ্যারান্টি</span>
                  <span className="text-[8.5px] text-purple-700 font-semibold block">ভেজালমুক্ত প্রিমিয়াম পণ্য</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Sticky Bottom Action Bar (AliExpress Layout) */}
        <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2.5 px-4 flex items-center gap-2.5 z-30 shadow-lg">
          
          {/* Favorite Toggle Button */}
          <button
            type="button"
            onClick={() => onToggleFavorite(product)}
            className="flex flex-col items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 active:scale-95 transition cursor-pointer shrink-0 min-w-[48px]"
          >
            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-600 text-rose-600' : 'text-slate-600'}`} />
            <span className="text-[8px] font-black mt-0.5">{isFavorite ? 'পছন্দ' : 'উইশলিস্ট'}</span>
          </button>

          {/* Add to Cart Button */}
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            className="flex-1 py-3 px-3 bg-amber-100 hover:bg-amber-200 active:scale-98 text-amber-900 rounded-2xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <ShoppingCart className="w-4 h-4 text-amber-800" />
            <span>কার্টে যোগ করুন</span>
          </button>

          {/* Buy Now Button */}
          <button
            type="button"
            onClick={() => onBuyNow(product)}
            className="flex-1 py-3 px-3 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 active:scale-98 text-white rounded-2xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>এখনই কিনুন (৳{product.price})</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
