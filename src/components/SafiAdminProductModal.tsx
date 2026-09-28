import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, Upload, Image as ImageIcon, Check, RefreshCw, 
  Trash2, Plus, Star, Layers, Sparkles
} from 'lucide-react';
import { SafiProduct, SafiCategory } from './SafiPremiumShop';

interface SafiAdminProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: SafiProduct | null;
  categories: SafiCategory[];
  selectedCategory: string | null;
  onSaveProduct: (productData: Partial<SafiProduct>) => Promise<void>;
  isSaving: boolean;
}

export default function SafiAdminProductModal({
  isOpen,
  onClose,
  editingProduct,
  categories,
  selectedCategory,
  onSaveProduct,
  isSaving
}: SafiAdminProductModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('clothing_fashion');
  const [price, setPrice] = useState('');
  const [regularPrice, setRegularPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [brand, setBrand] = useState('Safi Brand');
  const [stock, setStock] = useState('100 পিস');
  const [emoji, setEmoji] = useState('📦');
  const [badge, setBadge] = useState('Choice');
  const [sale, setSale] = useState(false);
  const [discountText, setDiscountText] = useState('স্পেশাল অফার');

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name || '');
      setCategory(editingProduct.category || (categories[0]?.id || 'clothing_fashion'));
      setPrice(editingProduct.price ? String(editingProduct.price) : '');
      setRegularPrice(editingProduct.regularPrice ? String(editingProduct.regularPrice) : '');
      setDesc(editingProduct.desc || '');
      
      const productImages: string[] = [];
      if (editingProduct.images && Array.isArray(editingProduct.images) && editingProduct.images.length > 0) {
        productImages.push(...editingProduct.images);
      } else if (editingProduct.image) {
        productImages.push(editingProduct.image);
      }
      setImages(productImages);
      setBrand(editingProduct.brand || 'Safi Brand');
      setStock(editingProduct.stock || '100 পিস');
      setEmoji(editingProduct.emoji || '📦');
      setBadge(editingProduct.badge || 'Choice');
      setSale(editingProduct.sale || false);
      setDiscountText(editingProduct.discountText || 'স্পেশাল অফার');
    } else {
      setName('');
      setCategory(selectedCategory || (categories[0]?.id || 'clothing_fashion'));
      setPrice('');
      setRegularPrice('');
      setDesc('');
      setImages([]);
      setBrand('Safi Brand');
      setStock('100 পিস');
      setEmoji('📦');
      setBadge('Choice');
      setSale(false);
      setDiscountText('স্পেশাল অফার');
    }
  }, [editingProduct, selectedCategory, categories, isOpen]);

  if (!isOpen) return null;

  // Handle multiple file upload & canvas compression
  const handleMultipleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDimension = 900;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.84);
            setImages((prev) => [...prev, compressedBase64]);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    setImages((prev) => [...prev, newImageUrl.trim()]);
    setNewImageUrl('');
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSetCoverImage = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const copy = [...prev];
      const selected = copy.splice(index, 1)[0];
      copy.unshift(selected);
      return copy;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      alert('অনুগ্রহ করে পণ্যের নাম এবং বিক্রয় মূল্য প্রদান করুন।');
      return;
    }

    const primaryImage = images.length > 0 ? images[0] : 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=500&auto=format&fit=crop&q=80';

    onSaveProduct({
      name: name.trim(),
      category,
      price: Number(price),
      regularPrice: regularPrice ? Number(regularPrice) : undefined,
      desc: desc.trim() || 'Safi ইন-হাউস প্রিমিয়াম পণ্য। সর্বোচ্চ গুণগত মানসম্পন্ন।',
      image: primaryImage,
      images: images.length > 0 ? images : [primaryImage],
      emoji: emoji || '📦',
      badge: badge || 'Choice',
      brand: brand.trim() || 'Safi Brand',
      stock: stock.trim() || '100 পিস',
      sale,
      discountText: discountText || (sale ? 'স্পেশাল ছাড়' : '')
    });
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs overflow-y-auto font-sans">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl text-left my-auto border border-slate-200 flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-4 flex items-center justify-between shrink-0 shadow-md">
          <div>
            <h3 className="text-sm sm:text-base font-black flex items-center gap-1.5">
              <span>{editingProduct ? '✏️ সাফি পণ্য তথ্য আপডেট' : '➕ নতুন সাফি পণ্য আপলোড (AliExpress Style)'}</span>
            </h3>
            <p className="text-[10px] text-amber-100 font-medium">৩-৪টি গ্যালারি ছবি ও বিস্তারিত ডেসক্রিপশন বক্স সহ পোস্ট করুন</p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto scrollbar-thin text-xs text-slate-800">
          
          {/* 1. Multi-image Gallery Uploader (AliExpress Style) */}
          <div className="space-y-2.5 bg-gradient-to-br from-amber-50/70 to-orange-50/40 p-3.5 rounded-2xl border border-amber-200">
            <div className="flex items-center justify-between">
              <label className="block text-[10.5px] font-black text-amber-950 uppercase flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-amber-700" />
                <span>📷 পণ্যের একাধিক ছবি (৩-৪টি ফটো গ্যালারি)</span>
              </label>
              <span className="text-[9px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-black">
                {images.length} টি ছবি যুক্ত
              </span>
            </div>

            {/* Gallery Image Previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 pt-1">
                {images.map((imgSrc, idx) => (
                  <div 
                    key={idx} 
                    className="relative group rounded-xl overflow-hidden border-2 border-amber-300 bg-white aspect-square flex items-center justify-center shadow-2xs"
                  >
                    <img 
                      src={imgSrc} 
                      alt={`Product preview ${idx + 1}`} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Primary Badge */}
                    {idx === 0 ? (
                      <span className="absolute top-1 left-1 bg-amber-600 text-white font-black text-[7.5px] px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                        <Star className="w-2 h-2 fill-white" /> কভার
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetCoverImage(idx)}
                        className="absolute top-1 left-1 bg-black/70 hover:bg-black text-white text-[7px] font-bold px-1 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        title="কভার বানান"
                      >
                        কভার
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white p-0.5 rounded-md shadow-xs transition cursor-pointer"
                      title="ছবি মুছুন"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <label className="flex-1 inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white px-3 py-2 rounded-xl text-[11px] font-black cursor-pointer shadow-xs transition">
                <Upload className="w-4 h-4" />
                <span>গ্যালারি থেকে ছবি সিলেক্ট করুন (একাধিক)</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleMultipleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* URL input adder */}
            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="অথবা সরাসরি ইমেজ লিংক (URL) পেস্ট করুন..."
                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[10px] font-black rounded-xl cursor-pointer"
              >
                + লিংক দিন
              </button>
            </div>
          </div>

          {/* 2. Product Name & Category */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-600 uppercase">পণ্যের নাম (বাংলায়) *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: Safi খাঁটি সুন্দরবনের ফুলের মধু"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-amber-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-600 uppercase">ক্যাটাগরি *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-amber-500 outline-none"
              >
                {categories.map((cat, idx) => (
                  <option key={`${cat.id}-${idx}`} value={cat.id}>{cat.nameBn}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-600 uppercase">ব্র্যান্ড নাম</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="যেমন: Safi Pure"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* 3. Pricing & Discounts */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-600 uppercase">বিক্রয় মূল্য (টাকা ৳) *</label>
              <input
                type="number"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="295"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-amber-500 outline-none font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-600 uppercase">আসল মূল্য / রেগুলার (৳)</label>
              <input
                type="number"
                value={regularPrice}
                onChange={(e) => setRegularPrice(e.target.value)}
                placeholder="350"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-amber-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* 4. Stock & Badges */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-600 uppercase">স্টক পরিমাণ</label>
              <input
                type="text"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="যেমন: 120 পিস বা 50 কেজি"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-amber-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-600 uppercase">ব্যাজ / ট্যাগ</label>
              <select
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-amber-500 outline-none"
              >
                <option value="Choice">Choice</option>
                <option value="Best Pure">Best Pure</option>
                <option value="Organic">Organic</option>
                <option value="Hot Deal">Hot Deal</option>
                <option value="Handloom">Handloom</option>
                <option value="Top Rated">Top Rated</option>
                <option value="Classic">Classic</option>
              </select>
            </div>
          </div>

          {/* 5. Spacious Detailed Description Box (AliExpress style) */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="block text-[10.5px] font-black text-slate-800 uppercase flex items-center gap-1">
                <span>📝 পণ্যের সম্পূর্ণ বিস্তারিত বিবরণ ও ডেসক্রিপশন বক্স</span>
              </label>
              <span className="text-[9px] text-slate-400 font-bold">কাস্টমাররা বিস্তারিত সব দেখতে পারবে</span>
            </div>
            <textarea
              rows={5}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="আলীএক্সপ্রেস এর মতো পণ্যের বিস্তারিত তথ্য লিখুন:&#10;• সাইজ/ওজন ও উপাদান&#10;• প্রস্তুত প্রণালী ও কার্যকারিতা&#10;• ব্যবহারের সঠিক নিয়ম&#10;• ১০০% গ্যারান্টি ও ডেলিভারি শর্তাবলী"
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-amber-500 outline-none leading-relaxed"
            />
          </div>

          {/* 6. Sale Toggle */}
          <div className="p-3 bg-red-50/70 border border-red-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-red-800 block">🔥 ভ্যাকেশন সেলে যুক্ত করুন</span>
              <span className="text-[9px] text-red-600 font-bold block">ডিসকাউন্ট সেকশনে বিশেষভাবে হাইলাইট হবে</span>
            </div>
            <input
              type="checkbox"
              checked={sale}
              onChange={(e) => setSale(e.target.checked)}
              className="w-4.5 h-4.5 accent-red-600 cursor-pointer"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl transition cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{editingProduct ? 'আপডেট সেভ করুন' : 'পণ্য প্রকাশ করুন'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
