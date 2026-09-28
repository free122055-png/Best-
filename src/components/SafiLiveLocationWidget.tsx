import React, { useState } from 'react';
import { MapPin, Navigation, ExternalLink, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export interface LiveLocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  mapsUrl: string;
  addressText: string;
  pinnedAt: string;
}

interface SafiLiveLocationWidgetProps {
  currentAddress: string;
  onAddressChange: (address: string) => void;
  onLocationPinned?: (location: LiveLocationData) => void;
  initialLocation?: LiveLocationData | null;
}

export default function SafiLiveLocationWidget({
  currentAddress,
  onAddressChange,
  onLocationPinned,
  initialLocation = null
}: SafiLiveLocationWidgetProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationData, setLocationData] = useState<LiveLocationData | null>(initialLocation);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleGetLiveLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('আপনার ব্রাউজার বা ডিভাইসে GPS লোকেশন সমর্থিত নয়।');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy || 0);
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

        let resolvedAddress = `GPS পিন অবস্থান: [${lat.toFixed(5)}, ${lng.toFixed(5)}] (নির্ভুলতা: ±${accuracy}m)`;

        try {
          // OpenStreetMap Nominatim reverse geocoding
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'bn,en' } }
          );
          if (response.ok) {
            const data = await response.json();
            if (data && data.display_name) {
              const addr = data.address || {};
              const road = addr.road || addr.suburb || addr.neighbourhood || '';
              const city = addr.city || addr.town || addr.municipality || addr.district || '';
              const state = addr.state || '';
              const post = addr.postcode ? ` - ${addr.postcode}` : '';
              
              const parts = [road, city, state + post].filter(Boolean);
              if (parts.length > 0) {
                resolvedAddress = `${parts.join(', ')} (GPS পিন: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
              } else {
                resolvedAddress = `${data.display_name.slice(0, 100)} (GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
              }
            }
          }
        } catch (err) {
          console.warn('Reverse geocode fallback to GPS coords:', err);
        }

        const newLocation: LiveLocationData = {
          lat,
          lng,
          accuracy,
          mapsUrl,
          addressText: resolvedAddress,
          pinnedAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
        };

        setLocationData(newLocation);
        onAddressChange(resolvedAddress);
        if (onLocationPinned) {
          onLocationPinned(newLocation);
        }
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        let msg = 'লোকেশন শনাক্ত করা যায়নি। অনুগ্রহ করে GPS লোকেশন পারমিশন চালু করুন।';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'লোকেশন পারমিশন বন্ধ আছে। অনুগ্রহ করে ব্রাউজার সেটিংসে গিয়ে লোকেশন অন করুন।';
        } else if (error.code === error.TIMEOUT) {
          msg = 'GPS সিগন্যাল পেতে সময় বেশি লেগেছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
        }
        setLocationError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="space-y-2 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-200 rounded-2xl p-3.5 shadow-3xs text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <MapPin className="w-4 h-4 animate-bounce" />
          </div>
          <div>
            <h5 className="text-[11.5px] font-black text-emerald-950 flex items-center gap-1.5">
              <span>📍 লাইভ লোকেশন পিন (হোয়াটসঅ্যাপ স্টাইল)</span>
            </h5>
            <p className="text-[9px] text-emerald-700 font-semibold">
              ঠিকানা লিখতে হবে না — সরাসরি ফোনের GPS দিয়ে পিন করুন
            </p>
          </div>
        </div>
      </div>

      {/* Action Button: Auto-detect location */}
      <button
        type="button"
        disabled={isLocating}
        onClick={handleGetLiveLocation}
        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
      >
        {isLocating ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
            <span>স্যাটেলাইট থেকে GPS লোকেশন পিন হচ্ছে...</span>
          </>
        ) : (
          <>
            <Navigation className="w-4 h-4 text-emerald-200" />
            <span>{locationData ? '🔄 পুনরায় লাইভ লোকেশন পিন করুন' : '📍 বর্তমান অবস্থান সরাসরি পিন করুন'}</span>
          </>
        )}
      </button>

      {/* Pinned Location Display Card */}
      {locationData && (
        <div className="bg-white border border-emerald-300/80 rounded-xl p-2.5 space-y-1.5 shadow-2xs animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-700 font-black text-[10px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>লাইভ GPS পিন সংরক্ষিত ({locationData.pinnedAt})</span>
            </div>
            <a
              href={locationData.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black px-2 py-0.5 rounded-md flex items-center gap-1 transition"
            >
              <span>গুগল ম্যাপে দেখুন</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <p className="text-[10px] text-slate-800 font-bold leading-tight break-words">
            {locationData.addressText}
          </p>
        </div>
      )}

      {/* Error display */}
      {locationError && (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-1.5 text-[9.5px] text-rose-700 font-bold">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          <span className="leading-snug">{locationError}</span>
        </div>
      )}

      {/* Manual Address input fallback */}
      <div className="pt-1">
        <label className="block text-[9px] font-extrabold text-slate-600 uppercase mb-1">
          অথবা বিস্তারিত ঠিকানা / ল্যান্ডমার্ক লিখুন (ঐচ্ছিক):
        </label>
        <input
          type="text"
          value={currentAddress}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="বাসা নং, রোড, এরিয়া, জেলা..."
          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-emerald-500 shadow-2xs"
        />
      </div>
    </div>
  );
}
