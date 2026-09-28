import React, { useState } from 'react';
import { Compass, MapPin, ShieldCheck, Bell, Zap } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { syncUserLocationNow, fetchRealIpAndLocation } from '../lib/locationUtils';

interface LocationPermissionModalProps {
  userId: string;
  onClose: () => void;
  onLocationUpdated?: (locationData: { address: string; ip: string }) => void;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  userId,
  onClose,
  onLocationUpdated
}) => {
  const [loading, setLoading] = useState(false);

  const handleTurnOn = () => {
    // Instantly close modal so user feels 0 delay
    onClose();

    // Perform location sync in background non-blockingly with real GPS & IP
    (async () => {
      try {
        const locResult = await syncUserLocationNow(userId);
        if (onLocationUpdated) {
          onLocationUpdated({ address: locResult.address, ip: locResult.ip });
        }
      } catch (err) {
        console.error("Location sync error:", err);
      }
    })();
  };

  const handleDecline = () => {
    // Instantly close modal
    onClose();

    // Record network IP location baseline in background without hardcoded fake coords
    (async () => {
      try {
        const ipData = await fetchRealIpAndLocation();
        const formattedTime = new Date().toLocaleString('bn-BD', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });

        await updateDoc(doc(db, 'users', userId), {
          latitude: ipData.lat,
          longitude: ipData.lng,
          lat: ipData.lat,
          lng: ipData.lng,
          realLat: ipData.lat,
          realLng: ipData.lng,
          fullAddress: ipData.address,
          lastLocation: ipData.address,
          lastLoginIP: ipData.ip,
          locationLastUpdated: formattedTime,
          deviceStatus: 'Online'
        }).catch(() => {});

        if (onLocationUpdated) {
          onLocationUpdated({ address: ipData.address, ip: ipData.ip });
        }
      } catch (err) {
        console.error("Background IP location update error:", err);
      }
    })();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4 font-sans text-white animate-fade-in">
      <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl w-full max-w-md overflow-hidden relative p-5 sm:p-6 space-y-5">
        
        {/* Header Icon & Title */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <span className="text-[10px] sm:text-xs font-black tracking-wider text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              LOCATION ACCURACY SYSTEM
            </span>
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-black text-white leading-snug">
              অধিকতর নির্ভুল অভিজ্ঞতার জন্য লোকেশন অন করুন
            </h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed mt-1">
              For a better experience, your device will need to use Location Accuracy and live notifications.
            </p>
          </div>
        </div>

        {/* Requirements Box */}
        <div className="space-y-3 pt-1">
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
            THE FOLLOWING SETTINGS SHOULD BE ON (নিম্নলিখিত অপশনগুলো সচল রাখা হবে):
          </h4>

          <div className="space-y-2.5">
            {/* Item 1 */}
            <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-xs font-bold text-slate-100">
                  Device location (ডিভাইস লোকেশন)
                </h5>
                <p className="text-[11px] text-slate-400 leading-tight truncate">
                  নিকটস্থ এজেন্ট, পয়েন্ট, রেশন শপ ও কুরিয়ার হাব প্রদর্শন করার জন্য।
                </p>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-xs font-bold text-slate-100">
                  Location Accuracy & Security (নিরাপদ লেনদেন)
                </h5>
                <p className="text-[11px] text-slate-400 leading-tight truncate">
                  Google sensor ও জিপিএস দিয়ে ভেরিফাইড ও নিরাপদ লেনদেন নিশ্চিতকরণ।
                </p>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-xs font-bold text-slate-100">
                  Live Alerts (ইনস্ট্যান্ট অ্যালার্ট নোটিফিকেশন)
                </h5>
                <p className="text-[11px] text-slate-400 leading-tight truncate">
                  ক্যাশইন, ক্যাশআউট, ঋণ ও ডিপোজিটের তাৎক্ষণিক লাইভ মেসেজ।
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-[10px] text-slate-400 italic leading-snug">
          You can change this at any time in location settings. (যেকোনো সময় ডিভাইস সেটিংস থেকে পরিবর্তন করা যাবে।)
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleDecline}
            disabled={loading}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black py-3 px-4 rounded-2xl transition cursor-pointer text-center disabled:opacity-50"
          >
            No, thanks (পরে করুন)
          </button>
          
          <button
            type="button"
            onClick={handleTurnOn}
            disabled={loading}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black py-3 px-4 rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/25 disabled:opacity-50 active:scale-95"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4 fill-slate-950" /> Turn on (অনুমতি দিন)
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
