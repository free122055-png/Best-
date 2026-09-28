import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, MapPin, Check, AlertCircle, RefreshCw, Navigation, ShieldCheck, Zap } from 'lucide-react';
import { AppConfig } from '../types';

type UnifiedPermissionState = 'granted' | 'denied' | 'prompt' | 'default';

interface NotificationPromptProps {
  appConfig: AppConfig;
  userId: string | undefined;
}

export const NotificationPrompt: React.FC<NotificationPromptProps> = ({ appConfig, userId }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [notifState, setNotifState] = useState<UnifiedPermissionState>('default');
  const [geoState, setGeoState] = useState<UnifiedPermissionState>('default');
  const [isLoading, setIsLoading] = useState(false);

  // Helper for geolocation status fallback
  const getGeolocationStatusFallback = (): Promise<UnifiedPermissionState> => {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        resolve('granted'); // Soft fallback to prevent blocking users in non-supporting browsers
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve('denied');
          } else {
            resolve('granted'); // Timeout or indoor signal weakness = permission granted!
          }
        },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: Infinity }
      );
    });
  };

  // Sync state with current system permissions
  const checkPermissions = async () => {
    let currentNotif: UnifiedPermissionState = 'default';
    let currentGeo: UnifiedPermissionState = 'default';

    // 1. Check Notification permission safely
    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
      try {
        currentNotif = (window.Notification.permission as UnifiedPermissionState) || 'default';
        setNotifState(currentNotif);
      } catch (e) {
        setNotifState('granted');
      }
    } else {
      currentNotif = 'granted';
      setNotifState('granted');
    }

    // 2. Check Geolocation permission safely
    if ('navigator' in window && 'permissions' in navigator) {
      try {
        const geoPermission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        currentGeo = geoPermission.state === 'prompt' ? 'default' : (geoPermission.state as UnifiedPermissionState);
        setGeoState(currentGeo);
        
        geoPermission.onchange = () => {
          const newState = geoPermission.state === 'prompt' ? 'default' : (geoPermission.state as UnifiedPermissionState);
          setGeoState(newState);
        };
      } catch (err) {
        console.warn("navigator.permissions.query failed for geolocation, trying fallback:", err);
        currentGeo = await getGeolocationStatusFallback();
        setGeoState(currentGeo);
      }
    } else {
      currentGeo = await getGeolocationStatusFallback();
      setGeoState(currentGeo);
    }

    // 3. Determine visibility logically: Persistent decision always takes precedence
    const permanentlyGranted = localStorage.getItem('amb_permissions_permanently_granted') === 'true' ||
                               localStorage.getItem('amb_location_permission_granted') === 'true';
    const bothGranted = currentNotif === 'granted' && currentGeo === 'granted';

    if (bothGranted || permanentlyGranted) {
      localStorage.setItem('amb_permissions_permanently_granted', 'true');
      setIsVisible(false);
    } else {
      // First install/login or ungranted session -> show bKash/Google style prompt
      setIsVisible(true);
    }

    setIsChecking(false);
  };

  useEffect(() => {
    checkPermissions();

    const handleFocus = () => {
      checkPermissions();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    if (isChecking) return;

    const permanentlyGranted = localStorage.getItem('amb_permissions_permanently_granted') === 'true' ||
                               localStorage.getItem('amb_location_permission_granted') === 'true';
    const bothGranted = notifState === 'granted' && geoState === 'granted';

    if (bothGranted || permanentlyGranted) {
      localStorage.setItem('amb_permissions_permanently_granted', 'true');
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }
  }, [notifState, geoState, isChecking]);

  // Request notifications permission
  const triggerNotificationRequest = async (): Promise<UnifiedPermissionState> => {
    if (typeof window === 'undefined' || !('Notification' in window) || !window.Notification || typeof window.Notification.requestPermission !== 'function') {
      return 'granted';
    }

    try {
      const permission = await window.Notification.requestPermission();
      setNotifState(permission as UnifiedPermissionState);

      const OneSignal = (window as any).OneSignal || [];
      if (typeof OneSignal.push === 'function') {
        OneSignal.push(() => {
          try {
            if (OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === 'function') {
              OneSignal.Notifications.requestPermission();
            } else if (typeof OneSignal.registerForPushNotifications === 'function') {
              OneSignal.registerForPushNotifications();
            }
          } catch (osErr) {
            console.warn("OneSignal registration sync warning:", osErr);
          }
        });
      }

      return (permission as UnifiedPermissionState) || 'granted';
    } catch (err) {
      console.warn("Error asking notification permission directly:", err);
      return (window.Notification?.permission as UnifiedPermissionState) || 'granted';
    }
  };

  // Request GPS location permission
  const triggerLocationRequest = (): Promise<UnifiedPermissionState> => {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        setGeoState('granted');
        resolve('granted');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("GPS Location acquired successfully:", position.coords.latitude, position.coords.longitude);
          setGeoState('granted');
          resolve('granted');
        },
        (error) => {
          console.warn("High-accuracy GPS attempt note:", error);
          if (error.code === error.PERMISSION_DENIED) {
            // User explicitly tapped Deny on browser prompt
            setGeoState('denied');
            resolve('denied');
          } else {
            // Soft fallback for indoor/weak GPS signal
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setGeoState('granted');
                resolve('granted');
              },
              (fallbackErr) => {
                // If it wasn't explicit deny, treat as granted so app doesn't freeze
                if (fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
                  setGeoState('denied');
                  resolve('denied');
                } else {
                  setGeoState('granted');
                  resolve('granted');
                }
              },
              { enableHighAccuracy: false, timeout: 5000, maximumAge: Infinity }
            );
          }
        },
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
      );
    });
  };

  // Trigger permissions and seamlessly enter
  const handleRequestAll = async () => {
    setIsLoading(true);

    try {
      if (notifState !== 'granted') {
        await triggerNotificationRequest();
      }
      if (geoState !== 'granted') {
        await triggerLocationRequest();
      }
    } catch (err) {
      console.warn("Permissions request parallel note:", err);
    }

    setIsLoading(false);
    
    // Always mark permanently granted in localStorage upon user action (single tap approval)
    localStorage.setItem('amb_permissions_permanently_granted', 'true');
    localStorage.setItem('amb_location_permission_granted', 'true');
    setGeoState('granted');
    setNotifState('granted');
    setIsVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('amb_permissions_permanently_granted', 'true');
    localStorage.setItem('amb_location_permission_granted', 'true');
    setIsVisible(false);
  };

  if (isChecking) return null;
  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="bg-[#121c24] border border-slate-700/60 w-full max-w-md rounded-3xl shadow-2xl p-6 text-left relative overflow-hidden font-sans text-white"
        >
          {/* bKash / Google Location Accuracy Style Design Header */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Navigation className="w-6 h-6 text-emerald-400 animate-pulse" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black tracking-wider uppercase text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Location Accuracy System
                </span>
                <h3 className="text-base font-black text-white mt-1 leading-snug">
                  অধিকতর নির্ভুল অভিজ্ঞতার জন্য লোকেশন অন করুন
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              For a better experience, your device will need to use Location Accuracy and live notifications.
            </p>

            <div className="pt-2 border-t border-slate-800 space-y-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                The following settings should be on (নিম্নলিখিত অপশনগুলো সচল রাখা হবে):
              </p>

              {/* Setting Item 1 */}
              <div className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/40">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-0.5">
                  <h4 className="font-extrabold text-white">Device location (ডিভাইস লোকেশন)</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    নিকটস্থ এজেন্ট, পয়েন্ট, রেশন শপ ও কুরিয়ার হাব প্রদর্শন করার জন্য।
                  </p>
                </div>
              </div>

              {/* Setting Item 2 */}
              <div className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/40">
                <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400 shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-0.5">
                  <h4 className="font-extrabold text-white">Location Accuracy & Security (নিরাপদ লেনদেন)</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Google sensor ও জিপিএস দিয়ে ভেরিফাইড ও নিরাপদ লেনদেন নিশ্চিতকরণ।
                  </p>
                </div>
              </div>

              {/* Setting Item 3 */}
              <div className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/40">
                <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400 shrink-0 mt-0.5">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-0.5">
                  <h4 className="font-extrabold text-white">Live Alerts (ইনস্ট্যান্ট অ্যালার্ট নোটিফিকেশন)</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    ক্যাশইন, ক্যাশআউট, ঋণ ও ডিপোজিটের তাৎক্ষণিক লাইভ মেসেজ।
                  </p>
                </div>
              </div>
            </div>

            <p className="text-[10.5px] text-slate-400 font-medium italic pt-1">
              You can change this at any time in location settings. (যেকোনো সময় ডিভাইস সেটিংস থেকে পরিবর্তন করা যাবে।)
            </p>
          </div>

          {/* bKash / Google Style Action Buttons Row */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="px-4 py-2.5 rounded-full text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              No, thanks (পরে করুন)
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleRequestAll}
              className="px-5 py-2.5 rounded-full text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-2 hover:scale-102 active:scale-98"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  প্রসেসিং...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                  Turn on (অনুমতি দিন)
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

