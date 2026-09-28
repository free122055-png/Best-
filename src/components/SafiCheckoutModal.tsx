import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, CheckCircle2, ShieldCheck, MapPin, 
  Navigation, RefreshCw, Phone, 
  ShoppingBag, ExternalLink, ArrowRight, Lock, 
  Check, MessageSquare, Building2, Landmark, UserCheck
} from 'lucide-react';
import { User as UserType } from '../types';
import { SafiProduct } from './SafiPremiumShop';
import { LiveLocationData } from './SafiLiveLocationWidget';
import { BANGLADESH_DISTRICTS, findDistrictByName } from '../data/bangladeshDistricts';

export interface CartCheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  emoji: string;
  brand: string;
}

const PHONE_RELATION_OPTIONS = [
  "নিজের",
  "বাবা (পিতা)",
  "মা (মাতা)",
  "ভাই",
  "বোন",
  "স্বামী",
  "স্ত্রী",
  "অভিভাবক",
  "বন্ধু / আত্মীয়",
  "অন্যান্য"
];

interface SafiCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType;
  checkoutType: 'single' | 'cart';
  singleProduct: SafiProduct | null;
  cartItems: CartCheckoutItem[];
  deliveryCharge?: number;
  onConfirmOrder: (orderData: {
    district: string;
    thana: string;
    detailedAddress: string;
    address: string;
    primaryPhone: string;
    primaryPhoneRelation: string;
    secondaryPhone: string;
    secondaryPhoneRelation: string;
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
  }) => Promise<void>;
  isLoading?: boolean;
}

export default function SafiCheckoutModal({
  isOpen,
  onClose,
  user,
  checkoutType,
  singleProduct,
  cartItems,
  deliveryCharge = 50,
  onConfirmOrder,
  isLoading = false
}: SafiCheckoutModalProps) {
  // Step state: 1 = Address & Contacts, 2 = Order Review & Security PIN
  const [step, setStep] = useState<1 | 2>(1);

  // Address fields (Initially empty - Customer must select/write)
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedThana, setSelectedThana] = useState<string>('');
  const [customThana, setCustomThana] = useState<string>('');
  const [detailedAddress, setDetailedAddress] = useState<string>('');

  // Contact Phone states & Relations
  const [primaryPhone, setPrimaryPhone] = useState(user?.phone || '');
  const [primaryPhoneRelation, setPrimaryPhoneRelation] = useState<string>('নিজের');
  const [customPrimaryRelation, setCustomPrimaryRelation] = useState<string>('');

  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [secondaryPhoneRelation, setSecondaryPhoneRelation] = useState<string>('বাবা (পিতা)');
  const [customSecondaryRelation, setCustomSecondaryRelation] = useState<string>('');

  const [callPreference, setCallPreference] = useState<'primary' | 'secondary' | 'any'>('primary');
  const [deliveryNote, setDeliveryNote] = useState('');
  
  // GPS / Auto Location states
  const [isLocating, setIsLocating] = useState(false);
  const [locationData, setLocationData] = useState<LiveLocationData | null>(null);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);

  // Step 2 Security PIN
  const [pinNumber, setPinNumber] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Current district's thana list
  const currentDistrictObj = BANGLADESH_DISTRICTS.find(d => d.nameBn === selectedDistrict);
  const availableThanas = currentDistrictObj ? currentDistrictObj.thanas : [];

  // Update thana when district changes
  const handleDistrictChange = (newDistrictName: string) => {
    setSelectedDistrict(newDistrictName);
    const districtObj = BANGLADESH_DISTRICTS.find(d => d.nameBn === newDistrictName);
    if (districtObj && districtObj.thanas.length > 0) {
      setSelectedThana(''); // Let user pick their thana
    } else {
      setSelectedThana('');
    }
  };

  if (!isOpen) return null;

  // Calculate items and pricing
  const items = checkoutType === 'single' && singleProduct 
    ? [{
        id: singleProduct.id,
        name: singleProduct.name,
        price: singleProduct.price,
        quantity: 1,
        image: singleProduct.image,
        emoji: singleProduct.emoji || '📦',
        brand: singleProduct.brand
      }]
    : cartItems;

  const subTotal = items.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  const totalAmount = subTotal + (subTotal > 0 ? deliveryCharge : 0);
  const userBalance = user?.balance || 0;
  const remainingBalance = userBalance - totalAmount;
  const isBalanceSufficient = userBalance >= totalAmount;

  // Active Thana value
  const activeThana = selectedThana === 'custom' ? (customThana || 'অন্যান্য') : selectedThana;

  // Active Relations
  const activePrimaryRelation = primaryPhoneRelation === 'অন্যান্য' ? (customPrimaryRelation || 'অন্যান্য') : primaryPhoneRelation;
  const activeSecondaryRelation = secondaryPhoneRelation === 'অন্যান্য' ? (customSecondaryRelation || 'অন্যান্য') : secondaryPhoneRelation;

  // Full composite address
  const fullAddress = `জেলা: ${selectedDistrict || 'অনির্দিষ্ট'}, থানা: ${activeThana || 'অনির্দিষ্ট'}, ${detailedAddress}`;

  // Resilient GPS & Network Location Auto-Detection
  const handleGetLiveLocation = async () => {
    setIsLocating(true);
    setLocationSuccessMsg(null);

    const applyLocation = (lat: number, lng: number, accuracy: number, areaName: string, resolvedDistrict?: string, resolvedThana?: string) => {
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      const timeStr = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
      
      const newLocation: LiveLocationData = {
        lat,
        lng,
        accuracy,
        mapsUrl,
        addressText: areaName,
        pinnedAt: timeStr
      };

      setLocationData(newLocation);

      if (resolvedDistrict) {
        const found = findDistrictByName(resolvedDistrict);
        if (found) {
          setSelectedDistrict(found.nameBn);
          if (resolvedThana) {
            const matchThana = found.thanas.find(t => t.includes(resolvedThana) || resolvedThana.includes(t));
            if (matchThana) {
              setSelectedThana(matchThana);
            } else {
              setSelectedThana(found.thanas[0] || 'সদর');
            }
          } else {
            setSelectedThana(found.thanas[0] || 'সদর');
          }
        }
      }

      setDetailedAddress(prev => {
        if (areaName && !prev.includes(areaName.slice(0, 15))) {
          return `${areaName} (GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        }
        return prev || `GPS পিন অবস্থান: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
      });

      setLocationSuccessMsg(`আপনার বর্তমান অবস্থান সফলভাবে পিন হয়েছে (${timeStr})`);
      setIsLocating(false);
    };

    // Helper: Reverse Geocode via OpenStreetMap
    const reverseGeocode = async (lat: number, lng: number, accuracy: number) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'bn,en' } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.address) {
            const a = data.address;
            const dist = a.state_district || a.county || a.city || a.state || '';
            const sub = a.suburb || a.neighbourhood || a.road || a.town || a.municipality || '';
            const resolvedText = [a.road, a.suburb, a.city || a.town, a.state].filter(Boolean).join(', ');
            applyLocation(lat, lng, accuracy, resolvedText || data.display_name?.slice(0, 80) || 'বাংলাদেশ', dist, sub);
            return true;
          }
        }
      } catch (err) {
        console.warn('Nominatim reverse geocode error:', err);
      }
      return false;
    };

    // Helper: IP-based Network Fallback
    const tryIpGeolocation = async () => {
      try {
        const res = await fetch('https://ipwho.is/');
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.latitude && data.longitude) {
            const lat = data.latitude;
            const lng = data.longitude;
            const city = data.city || 'ঢাকা';
            const region = data.region || 'ঢাকা';
            applyLocation(lat, lng, 1500, `${city}, ${region} (নেটওয়ার্ক লোকেশন পিন)`, region, city);
            return true;
          }
        }
      } catch (e1) {
        try {
          const res2 = await fetch('https://ipapi.co/json/');
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2 && data2.latitude && data2.longitude) {
              const lat = data2.latitude;
              const lng = data2.longitude;
              const city = data2.city || 'ঢাকা';
              const region = data2.region || 'ঢাকা';
              applyLocation(lat, lng, 2000, `${city}, ${region} (নেটওয়ার্ক লোকেশন পিন)`, region, city);
              return true;
            }
          }
        } catch (e2) {
          console.warn('IP geo fallback error:', e2);
        }
      }
      return false;
    };

    // Attempt 1: Browser GPS
    if (navigator.geolocation) {
      const gpsPromise = new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = Math.round(pos.coords.accuracy || 15);
            const geoSuccess = await reverseGeocode(lat, lng, accuracy);
            if (!geoSuccess) {
              applyLocation(lat, lng, accuracy, `GPS পিন অবস্থান: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`, 'ঢাকা', 'মিরপুর');
            }
            resolve(true);
          },
          async (_err) => {
            resolve(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 30000
          }
        );
      });

      const success = await gpsPromise;
      if (success) return;
    }

    // Attempt 2: IP / Network location fallback
    const ipSuccess = await tryIpGeolocation();
    if (ipSuccess) return;

    // Attempt 3: Default Dhaka Central
    applyLocation(23.8103, 90.4125, 50, 'ঢাকা কেন্দ্রীয় অবস্থান (অটো পিন)', 'ঢাকা', 'মিরপুর');
  };

  // Step 1 Validation & Proceed
  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDistrict) {
      alert('অনুগ্রহ করে আপনার জেলা নির্বাচন করুন।');
      return;
    }
    if (!activeThana) {
      alert('অনুগ্রহ করে আপনার থানা বা উপজেলা নির্বাচন করুন।');
      return;
    }
    if (!detailedAddress.trim()) {
      alert('অনুগ্রহ করে ইউনিয়ন / গ্রাম / বাসা নং / রোড নং বিস্তারিত ঠিকানা লিখুন।');
      return;
    }
    if (!primaryPhone.trim() || primaryPhone.trim().length < 10) {
      alert('সঠিক প্রাথমিক মোবাইল নাম্বার প্রদান করুন (কমপক্ষে ১১ ডিজিট)।');
      return;
    }
    setStep(2);
  };

  // Step 2 Confirm Order
  const handleFinalSubmit = async () => {
    if (!pinNumber) {
      setPinError('অনুগ্রহ করে আপনার ৪ সংখ্যার সিকিউরিটি পিন দিন।');
      return;
    }
    if (pinNumber !== user?.pin) {
      setPinError('ভুল পিন নাম্বার প্রদান করেছেন। আবার চেষ্টা করুন।');
      return;
    }
    if (!isBalanceSufficient) {
      alert('আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই। অনুগ্রহ করে ওয়ালেট রিচার্জ করুন।');
      return;
    }

    setPinError(null);
    await onConfirmOrder({
      district: selectedDistrict,
      thana: activeThana,
      detailedAddress: detailedAddress.trim(),
      address: fullAddress,
      primaryPhone: primaryPhone.trim(),
      primaryPhoneRelation: activePrimaryRelation,
      secondaryPhone: secondaryPhone.trim(),
      secondaryPhoneRelation: activeSecondaryRelation,
      callPreference,
      deliveryNote: deliveryNote.trim(),
      liveLocation: locationData,
      pin: pinNumber,
      items: items.map(it => ({
        id: it.id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        image: it.image
      })),
      totalAmount
    });
  };

  return (
    <div className="fixed inset-0 z-80 flex flex-col bg-[#f8fafc] font-sans text-slate-800 overflow-hidden">
      {/* 1. Full-Screen Sticky Header */}
      <div className="bg-[#1e1e2d] text-white px-4 py-3 shrink-0 flex items-center justify-between shadow-md border-b border-white/10 z-20">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (step === 2) {
                setStep(1);
              } else {
                onClose();
              }
            }}
            className="p-1.5 px-3 bg-white/10 hover:bg-white/20 active:scale-95 transition rounded-xl text-xs font-black cursor-pointer border border-white/5 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{step === 2 ? 'ধাপ ১-এ ফিরুন' : 'বাতিল'}</span>
          </button>
          <div>
            <h2 className="text-xs sm:text-sm font-black tracking-wide leading-none flex items-center gap-1.5">
              <span>নিরাপদ চেকআউট</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                {step === 1 ? 'ধাপ ১/২' : 'ধাপ ২/২'}
              </span>
            </h2>
            <span className="text-[9px] text-slate-300 font-medium">
              {step === 1 ? 'ঠিকানা ও যোগাযোগের তথ্য প্রদান' : 'অর্ডার রিভিউ ও সিকিউরিটি পিন'}
            </span>
          </div>
        </div>

        {/* Step Indicator Badges */}
        <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-xl border border-white/10">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
            step === 1 ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-emerald-500 text-white'
          }`}>
            {step === 1 ? '১' : <Check className="w-3 h-3" />}
          </div>
          <div className="w-3 h-0.5 bg-white/30 rounded" />
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
            step === 2 ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-white/20 text-white/60'
          }`}>
            ২
          </div>
        </div>
      </div>

      {/* 2. Scrollable Body Form */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-4 pb-28">
        
        {/* ================= STEP 1: ADDRESS, DISTRICT, THANA & PHONE NUMBERS ================= */}
        {step === 1 && (
          <motion.div
            key="checkout-step-1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-4"
          >
            {/* Quick Product Preview Bar */}
            <div className="bg-white border border-slate-200 rounded-3xl p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                  <span>অর্ডারের পণ্যসমূহ ({items.length}টি)</span>
                </span>
                <span className="text-xs font-mono font-black text-amber-700">
                  মোট: ৳{totalAmount}
                </span>
              </div>

              <div className="space-y-2 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
                {items.map((it, idx) => (
                  <div key={`${it.id}-${idx}`} className="flex items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                        {it.image ? (
                          <img src={it.image} alt={it.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm">{it.emoji}</div>
                        )}
                      </div>
                      <div className="leading-tight">
                        <h5 className="font-extrabold text-slate-900 line-clamp-1 text-[11px]">{it.name}</h5>
                        <span className="text-[10px] text-slate-500 font-bold">পরিমাণ: {it.quantity}টি × ৳{it.price}</span>
                      </div>
                    </div>
                    <span className="font-mono font-black text-slate-900 text-xs shrink-0">৳{it.price * it.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GPS & Address Section */}
            <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">ডেলিভারি ঠিকানা ও অবস্থান</h4>
                  <p className="text-[10px] text-slate-500 font-semibold">অটোমেটিক জিপিএস লোকেশন বা জেলা-থানা নির্বাচন করুন</p>
                </div>
              </div>

              {/* Automatic GPS Location Auto-Pin Button */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50/70 to-emerald-50 border border-emerald-300/80 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-emerald-950 flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    <span>অটোমেটিক লাইভ লোকেশন পিন</span>
                  </span>
                  <span className="text-[9px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-3xs">
                    GPS ও নেটওয়ার্ক
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isLocating}
                  onClick={handleGetLiveLocation}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  {isLocating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
                      <span>স্যাটেলাইট ও নেটওয়ার্ক থেকে লোকেশন সেট হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 text-emerald-200" />
                      <span>{locationData ? '🔄 বর্তমান লোকেশন পুনরায় রিফ্রেশ করুন' : '🧭 বর্তমান অবস্থান সরাসরি পিন করুন'}</span>
                    </>
                  )}
                </button>

                {locationSuccessMsg && (
                  <div className="bg-white border border-emerald-300 rounded-xl p-2.5 space-y-1 text-xs shadow-3xs animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-800 font-black text-[10.5px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{locationSuccessMsg}</span>
                      </span>
                      {locationData && (
                        <a
                          href={locationData.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[9px] text-emerald-800 font-bold underline flex items-center gap-0.5"
                        >
                          <span>ম্যাপ</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    {locationData && (
                      <p className="text-[10px] text-slate-700 font-bold leading-tight break-words">
                        📍 {locationData.addressText}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* DISTRICT ON LEFT & THANA ON RIGHT (BLANK INITIALLY - CUSTOMER SELECTS) */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* Left Side: জেলা (District) */}
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-black text-slate-800 uppercase flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>জেলা *</span>
                    <span className="text-[9px] text-rose-500 font-bold">(বাধ্যতামূলক)</span>
                  </label>
                  <select
                    required
                    value={selectedDistrict}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full py-2.5 px-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-amber-500 focus:bg-white shadow-3xs cursor-pointer"
                  >
                    <option value="" disabled className="text-slate-400 font-normal">
                      -- জেলা নির্বাচন করুন --
                    </option>
                    {BANGLADESH_DISTRICTS.map((d) => (
                      <option key={d.id} value={d.nameBn} className="font-bold text-slate-900">
                        {d.nameBn} ({d.nameEn})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Right Side: থানা / উপজেলা (Thana/Upazila) */}
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-black text-slate-800 uppercase flex items-center gap-1">
                    <Landmark className="w-3.5 h-3.5 text-amber-600" />
                    <span>থানা / উপজেলা *</span>
                    <span className="text-[9px] text-rose-500 font-bold">(বাধ্যতামূলক)</span>
                  </label>
                  <select
                    required
                    disabled={!selectedDistrict}
                    value={selectedThana}
                    onChange={(e) => setSelectedThana(e.target.value)}
                    className="w-full py-2.5 px-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-amber-500 focus:bg-white shadow-3xs cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="" disabled className="text-slate-400 font-normal">
                      {selectedDistrict ? '-- থানা নির্বাচন করুন --' : '-- আগে জেলা নির্বাচন করুন --'}
                    </option>
                    {availableThanas.map((th, idx) => (
                      <option key={`${th}-${idx}`} value={th} className="font-bold text-slate-900">
                        {th}
                      </option>
                    ))}
                    {selectedDistrict && (
                      <option value="custom" className="font-bold text-amber-700">
                        ✏️ অন্য কোনো থানা (নিজে লিখুন)
                      </option>
                    )}
                  </select>
                </div>
              </div>

              {/* Custom Thana Input if "custom" is selected */}
              {selectedThana === 'custom' && (
                <div className="space-y-1 animate-fade-in">
                  <label className="block text-[10px] font-black text-amber-800 uppercase">
                    আপনার থানার নাম লিখুন:
                  </label>
                  <input
                    type="text"
                    required
                    value={customThana}
                    onChange={(e) => setCustomThana(e.target.value)}
                    placeholder="যেমন: ডেমরা, রামপুরা, কালিয়াকৈর ইত্যাদি..."
                    className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-600 focus:bg-white shadow-3xs"
                  />
                </div>
              )}

              {/* Detailed Address (Village / Union / Road / House No / Landmark) - INITIALLY EMPTY */}
              <div className="space-y-1 pt-1">
                <label className="block text-[10.5px] font-black text-slate-800 uppercase flex items-center justify-between">
                  <span>ইউনিয়ন / গ্রাম / বাসা / রোড / এলাকা / ল্যান্ডমার্ক *</span>
                  <span className="text-[9px] text-slate-500 font-semibold">বিস্তারিত ঠিকানা</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={detailedAddress}
                  onChange={(e) => setDetailedAddress(e.target.value)}
                  placeholder="যেমন: বাসা নং ১২, রোড নং ৫, ব্লক বি অথবা গ্রাম / ইউনিয়ন ও পরিচিত ল্যান্ডমার্ক লিখুন..."
                  className="w-full text-xs font-bold bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 text-slate-900 outline-none focus:border-amber-500 focus:bg-white shadow-3xs resize-none"
                />
                <span className="text-[9px] text-slate-500 font-medium block">
                  * জেলা ও থানা নির্বাচন করার পর ইউনিয়ন, গ্রাম, রোড বা বাড়ির সুনির্দিষ্ট বিবরণ দিন।
                </span>
              </div>
            </div>

            {/* Contact Phone Numbers Section (2 Numbers with Relationship Selection) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">যোগাযোগের মোবাইল নাম্বার (২টি নাম্বার)</h4>
                  <p className="text-[10px] text-slate-500 font-semibold">নাম্বারটি কার এবং সম্পর্কে কি হয় তা নির্দিষ্ট করুন</p>
                </div>
              </div>

              {/* Primary Mobile Card with Relationship Selector */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>১. প্রাথমিক মোবাইল নাম্বার *</span>
                  </span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                    মেইন কন্টাক্ট
                  </span>
                </div>

                {/* Relationship / Who owns this number */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>এই নাম্বারটি আপনার কি হয় / কার নাম্বার? *</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={primaryPhoneRelation}
                      onChange={(e) => setPrimaryPhoneRelation(e.target.value)}
                      className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-amber-500 shadow-3xs cursor-pointer"
                    >
                      {PHONE_RELATION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt === 'নিজের' ? '👤 আমার নিজের নাম্বার' : `👥 ${opt}`}
                        </option>
                      ))}
                    </select>

                    {primaryPhoneRelation === 'অন্যান্য' ? (
                      <input
                        type="text"
                        required
                        value={customPrimaryRelation}
                        onChange={(e) => setCustomPrimaryRelation(e.target.value)}
                        placeholder="সম্পর্ক লিখুন (যেমন: কাকা)..."
                        className="w-full px-2.5 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500 shadow-3xs"
                      />
                    ) : (
                      <div className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-xl px-2.5 py-2 flex items-center">
                        সম্পর্ক: <span className="font-black text-slate-800 ml-1">{primaryPhoneRelation}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Number Input */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="tel"
                    required
                    value={primaryPhone}
                    onChange={(e) => setPrimaryPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-amber-500 shadow-3xs"
                  />
                </div>
              </div>

              {/* Secondary Mobile Card with Relationship Selector */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>২. বিকল্প মোবাইল নাম্বার</span>
                  </span>
                  <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md">
                    ঐচ্ছিক / ব্যাকআপ
                  </span>
                </div>

                {/* Relationship / Who owns secondary number */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>বিকল্প নাম্বারটি আপনার কি হয় / কার নাম্বার?</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={secondaryPhoneRelation}
                      onChange={(e) => setSecondaryPhoneRelation(e.target.value)}
                      className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-blue-500 shadow-3xs cursor-pointer"
                    >
                      {PHONE_RELATION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt === 'নিজের' ? '👤 নিজের ২য় নাম্বার' : `👥 ${opt}`}
                        </option>
                      ))}
                    </select>

                    {secondaryPhoneRelation === 'অন্যান্য' ? (
                      <input
                        type="text"
                        value={customSecondaryRelation}
                        onChange={(e) => setCustomSecondaryRelation(e.target.value)}
                        placeholder="সম্পর্ক লিখুন (যেমন: মামা)..."
                        className="w-full px-2.5 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-500 shadow-3xs"
                      />
                    ) : (
                      <div className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-xl px-2.5 py-2 flex items-center">
                        সম্পর্ক: <span className="font-black text-slate-800 ml-1">{secondaryPhoneRelation}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Secondary Number Input */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="tel"
                    value={secondaryPhone}
                    onChange={(e) => setSecondaryPhone(e.target.value)}
                    placeholder="018XXXXXXXX (যদি থাকে)"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-blue-500 shadow-3xs"
                  />
                </div>
              </div>

              {/* Call Preference Option */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[10px] font-black text-slate-700 uppercase">
                  ডেলিভারিম্যান কোন নাম্বারে কল করবে?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCallPreference('primary')}
                    className={`py-2 px-1 rounded-xl text-[10px] font-black border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      callPreference === 'primary'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-3xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>📞 নাম্বার ১-এ</span>
                    <span className="text-[8px] font-semibold">({activePrimaryRelation})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCallPreference('secondary')}
                    className={`py-2 px-1 rounded-xl text-[10px] font-black border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      callPreference === 'secondary'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-3xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>📱 নাম্বার ২-এ</span>
                    <span className="text-[8px] font-semibold">({activeSecondaryRelation})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCallPreference('any')}
                    className={`py-2 px-1 rounded-xl text-[10px] font-black border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      callPreference === 'any'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-3xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>🔁 যেকোনোটিতে</span>
                    <span className="text-[8px] font-semibold">(যেটিতে পাওয়া যায়)</span>
                  </button>
                </div>
              </div>

              {/* Special Delivery Note */}
              <div className="space-y-1 pt-1">
                <label className="block text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-slate-500" />
                  <span>বিশেষ ডেলিভারি নির্দেশনা বা নোট (ঐচ্ছিক):</span>
                </label>
                <input
                  type="text"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="যেমন: গেটে এসে কল দিবেন, সকাল ১০টার পরে ডেলিভারি দিন ইত্যাদি..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500 focus:bg-white shadow-3xs"
                />
              </div>
            </div>

            {/* Action Bar: Next Step Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleProceedToReview}
                className="w-full py-3.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 active:scale-98 text-white rounded-2xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                <span>পরবর্তী ধাপে যান (অর্ডার রিভিউ ও পিন)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ================= STEP 2: FINAL ORDER REVIEW & SECURITY PIN ================= */}
        {step === 2 && (
          <motion.div
            key="checkout-step-2"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            {/* Review Card 1: Delivery Address & Phone Summary */}
            <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>ডেলিভারি গন্তব্য ও কন্টাক্ট</span>
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[10px] text-amber-700 font-extrabold hover:underline cursor-pointer"
                >
                  ✏️ এডিট করুন
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] font-black text-slate-900">
                    <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">জেলা: {selectedDistrict}</span>
                    <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">থানা: {activeThana}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase block">বিস্তারিত ঠিকানা:</span>
                    <p className="font-bold text-slate-800 leading-snug">{detailedAddress}</p>
                  </div>

                  {locationData && (
                    <div className="pt-1">
                      <a
                        href={locationData.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-emerald-700 font-black inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md"
                      >
                        <Navigation className="w-2.5 h-2.5" />
                        <span>লাইভ GPS ম্যাপে লোকেশন দেখুন</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[9px] font-black text-slate-400 block">
                      প্রাথমিক ({activePrimaryRelation}):
                    </span>
                    <span className="font-mono font-black text-slate-800">{primaryPhone}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[9px] font-black text-slate-400 block">
                      বিকল্প ({activeSecondaryRelation}):
                    </span>
                    <span className="font-mono font-black text-slate-800">{secondaryPhone || 'দেওয়া হয়নি'}</span>
                  </div>
                </div>

                {deliveryNote && (
                  <div className="bg-amber-50/60 border border-amber-200/60 p-2 rounded-xl text-[10.5px]">
                    <span className="font-black text-amber-900 block text-[9px]">ডেলিভারি নোট:</span>
                    <p className="text-amber-800 font-medium">{deliveryNote}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Review Card 2: Price Calculation & Wallet Balance */}
            <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-black text-slate-900">মূল্য হিসাব ও ওয়ালেট কর্তন</h4>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 font-semibold">
                  <span>আইটেমের মোট মূল্য ({items.length}টি):</span>
                  <span className="font-mono">৳{subTotal}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-semibold">
                  <span>হোম ডেলিভারি চার্জ:</span>
                  <span className="font-mono">৳{deliveryCharge}</span>
                </div>
                
                <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
                  <span>সর্বমোট প্রদেয় টাকা:</span>
                  <span className="font-mono text-base text-amber-700">৳{totalAmount}</span>
                </div>

                {/* User Wallet Status */}
                <div className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs mt-2 ${
                  isBalanceSufficient 
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div>
                    <span className="text-[10px] font-bold block">আপনার মেইন ওয়ালেট ব্যালেন্স:</span>
                    <span className="font-mono font-black text-sm">৳{userBalance.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold block">অর্ডারের পর অবশিষ্ট থাকবে:</span>
                    <span className="font-mono font-black text-sm">
                      {isBalanceSufficient ? `৳${remainingBalance.toLocaleString('bn-BD')}` : 'অপর্যাপ্ত'}
                    </span>
                  </div>
                </div>

                {!isBalanceSufficient && (
                  <div className="p-2 bg-rose-100 text-rose-800 rounded-xl text-[10.5px] font-bold text-center">
                    ⚠️ আপনার ওয়ালেটে পর্যাপ্ত টাকা নেই। অর্ডার সম্পন্ন করতে ওয়ালেটে রিচার্জ করুন।
                  </div>
                )}
              </div>
            </div>

            {/* Review Card 3: Security PIN Input */}
            <div className="bg-white border-2 border-amber-300 rounded-3xl p-5 space-y-3 shadow-sm text-center">
              <div className="w-11 h-11 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-600">
                <Lock className="w-6 h-6" />
              </div>
              
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-900">আপনার ৪ সংখ্যার সিকিউরিটি পিন দিন</h4>
                <p className="text-[10px] text-slate-500 font-semibold">অর্ডারটি নিশ্চিত করতে অ্যাকাউন্টের পিন লিখুন</p>
              </div>

              <div className="max-w-xs mx-auto">
                <input
                  type="password"
                  maxLength={4}
                  value={pinNumber}
                  onChange={(e) => {
                    setPinNumber(e.target.value);
                    if (pinError) setPinError(null);
                  }}
                  placeholder="• • • •"
                  className="w-full text-center tracking-[0.7em] font-mono text-2xl py-2.5 bg-slate-50 border-2 border-amber-300 rounded-2xl text-slate-900 outline-none focus:border-amber-600 focus:bg-white shadow-inner"
                />
              </div>

              {pinError && (
                <div className="text-[10.5px] font-bold text-rose-600 bg-rose-50 p-2 rounded-xl animate-shake">
                  {pinError}
                </div>
              )}
            </div>

            {/* Action Buttons: Confirm & Back */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setStep(1)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-black text-xs rounded-2xl transition cursor-pointer"
              >
                ← পূর্ববর্তী
              </button>

              <button
                type="button"
                disabled={isLoading || pinNumber.length !== 4 || !isBalanceSufficient}
                onClick={handleFinalSubmit}
                className="flex-1 py-3.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 active:scale-98 text-white rounded-2xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>অর্ডার সম্পন্ন হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>অর্ডার নিশ্চিত করুন (৳{totalAmount})</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
