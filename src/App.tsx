import React, { useEffect, useState, useRef } from 'react';
import { ensureAuth, db, handleFirestoreError, OperationType, auth } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc, limit, onSnapshot, increment, serverTimestamp, writeBatch, runTransaction } from 'firebase/firestore';
import { User, AppConfig, getEffectiveBalance } from './types';
import { processUserSamitySavingsAutoDeduction, getUnpaidSamityMonths } from './lib/samitySavingsEngine';
import { loadAppConfig, DEFAULT_CONFIG } from './lib/config';
import { executeHistoryRetentionCleanup } from './lib/retentionCleanup';
import { normalizeMemberId, findUserInFirestoreByPhone, convertBengaliToEnglishDigits, getClientDeviceId, getDeviceFingerprint, isSameDevice, getNextSequentialMemberId, getDeviceBoundUser } from './lib/memberUtils';
import { restoreAndSeedDatabase } from './lib/databaseSeeder';
import LoginScreen from './components/LoginScreen';
import LockScreen from './components/LockScreen';
import SetAppLockModal from './components/SetAppLockModal';
import Dashboard from './components/Dashboard';
import DrawerMenu from './components/DrawerMenu';
import AdminPanel from './components/AdminPanel';
import CleanSplash from './components/CleanSplash';
import { AMBLogo } from './components/AMBLogo';
import MaintenanceScreen from './components/MaintenanceScreen';
import ForceUpdateScreen from './components/ForceUpdateScreen';
import DeviceLockScreen from './components/DeviceLockScreen';
import { NotificationPrompt } from './components/NotificationPrompt';
import { NotificationBanner } from './components/NotificationBanner';
import { LocationPermissionModal } from './components/LocationPermissionModal';
import { MandatoryNoticeModal } from './components/MandatoryNoticeModal';
import { syncUserLocationNow } from './lib/locationUtils';
import { setupFCM } from './lib/fcm';
import { navigationManager, useBackHandler } from './lib/navigationManager';
import { ShieldCheck, ShieldAlert, X, RefreshCw, Lock, LogOut, Eye, EyeOff, AlertCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { App as CapApp } from '@capacitor/app';

// Detect fresh installation / reinstall: clear stale auto-restored credentials
if (typeof window !== 'undefined') {
  const currentInstallationKey = 'amb_installation_marker_v2';
  if (!localStorage.getItem(currentInstallationKey)) {
    const staleKeys = [
      'amb_user_phone', 'amb_user_uid', 'amb_user_name', 'amb_user_role',
      'amb_user_member_id', 'amb_user_balance', 'amb_user_savings',
      'amb_user_telecom_balance', 'amb_user_super_shop_balance', 'amb_user_due_loan',
      'amb_user_samity_status', 'amb_last_user', 'amb_admin_mode',
      'amb_user_phone', 'amb_user_uid', 'amb_user_name', 'amb_user_role',
      'amb_user_member_id', 'amb_user_balance', 'amb_user_savings',
      'amb_user_telecom_balance', 'amb_user_super_shop_balance', 'amb_user_due_loan',
      'amb_user_samity_status', 'amb_last_user', 'amb_admin_mode'
    ];
    staleKeys.forEach(k => localStorage.removeItem(k));
    localStorage.setItem(currentInstallationKey, 'true');
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const rememberedPhone = localStorage.getItem('amb_user_phone');
    const rememberedUid = localStorage.getItem('amb_user_uid');
    if (rememberedPhone && rememberedUid) {
      return {
        uid: rememberedUid,
        name: localStorage.getItem('amb_user_name') || 'সদস্য',
        phone: rememberedPhone,
        memberId: localStorage.getItem('amb_user_member_id') || 'AMB00000000',
        role: (localStorage.getItem('amb_user_role') as any) || 'user',
        balance: Number(localStorage.getItem('amb_user_balance') || '0'),
        mainBalance: Number(localStorage.getItem('amb_user_balance') || '0'),
        savings: Number(localStorage.getItem('amb_user_savings') || '0'),
        telecomBalance: Number(localStorage.getItem('amb_user_telecom_balance') || '0'),
        superShopBalance: Number(localStorage.getItem('amb_user_super_shop_balance') || '0'),
        dueLoan: Number(localStorage.getItem('amb_user_due_loan') || '0'),
        pin: localStorage.getItem('amb_user_pin') || undefined,
        createdAt: new Date().toISOString(),
        status: 'active',
        samityStatus: (localStorage.getItem('amb_user_samity_status') as any) || 'none'
      };
    }
    return null;
  });
  const [isLocked, setIsLocked] = useState(() => {
    // Bypass lock screen automatically if returning from payment gateway
    if (typeof window !== 'undefined' && window.location.search.includes('payment_status=')) {
      return false;
    }
    return !!localStorage.getItem('amb_user_phone');
  });
  const [showSetLockModal, setShowSetLockModal] = useState(false);
  const [authUid, setAuthUid] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    try {
      const cached = localStorage.getItem('amb_app_config');
      if (cached) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.warn("Failed to parse cached appConfig", e);
    }
    return DEFAULT_CONFIG;
  });
  const [preferRegister, setPreferRegister] = useState(false);
  const [adminBypassed, setAdminBypassed] = useState(false);
    const CURRENT_APP_VERSION = "2.0";

  // Unique client-side device identifier & hardware fingerprint for single device locking across App + Web
  const [deviceId] = useState(() => getClientDeviceId());
  const [deviceFingerprint] = useState(() => getDeviceFingerprint());


  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('payment_status=')) {
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({path: newUrl}, '', newUrl);
    }
  }, []);

  // Real-time synchronization of the app configuration settings
  useEffect(() => {
    restoreAndSeedDatabase().catch(err => console.warn(err));
    const configRef = doc(db, 'system_settings', 'app_config');
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppConfig;
        setAppConfig(prev => {
          const merged = {
            ...prev,
            ...data,
            // Keep sectionIcons from separate document or fallback to existing
            sectionIcons: { ...(prev.sectionIcons || {}), ...(data.sectionIcons || {}) }
          };
          try {
            localStorage.setItem('amb_app_config', JSON.stringify({ ...DEFAULT_CONFIG, ...merged }));
          } catch (e) {
            console.error("Failed to cache real-time appConfig", e);
          }
          return merged;
        });
      }
    }, (err) => {
      console.warn("Real-time AppConfig snapshot error:", err);
    });

    const iconsRef = doc(db, 'system_settings', 'section_icons');
    const unsubIcons = onSnapshot(iconsRef, (snap) => {
      if (snap.exists()) {
        const iconsData = (snap.data() as Record<string, string>) || {};
        setAppConfig(prev => {
          const merged = {
            ...prev,
            sectionIcons: { ...(prev.sectionIcons || {}), ...iconsData }
          };
          try {
            localStorage.setItem('amb_app_config', JSON.stringify({ ...DEFAULT_CONFIG, ...merged }));
          } catch (e) {}
          return merged;
        });
      }
    }, (err) => {
      console.warn("Real-time section_icons snapshot error:", err);
    });

    return () => {
      unsub();
      unsubIcons();
    };
  }, []);

  // Install Count tracking (Robust, Single Source of Truth, Race-condition safe)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // We rely on our persistent getClientDeviceId() to ensure each device is counted EXACTLY ONCE.
    const uniqueDeviceId = getClientDeviceId();
    const localTrackKey = `amb_install_counted_${uniqueDeviceId}`;
    
    // Check both localStorage and cookie to survive partial cache clears
    const isAppInstallCounted = localStorage.getItem(localTrackKey) || document.cookie.includes(`${localTrackKey}=true`);
    
    if (!isAppInstallCounted) {
      // 1. Immediately mark locally to prevent duplicate concurrent triggers (React Strict Mode / rapid re-renders)
      localStorage.setItem(localTrackKey, 'pending');
      
      const updateInstallCount = async () => {
        try {
          // 2. Attempt an online server-side atomic transaction first to guarantee no race conditions
          const transactionResult = await runTransaction(db, async (transaction) => {
            const installTrackingRef = doc(db, 'install_tracking', uniqueDeviceId);
            const snap = await transaction.get(installTrackingRef);
            
            if (snap.exists()) {
              // Already exists in DB. Skip increment.
              return false; 
            }
            
            // Does not exist. Set it and increment atomic counter.
            const configRef = doc(db, 'system_settings', 'app_config');
            transaction.set(installTrackingRef, { 
              installedAt: serverTimestamp(),
              deviceId: uniqueDeviceId,
              platform: 'capacitor_or_web'
            }, { merge: true });
            
            transaction.set(configRef, { 
              installCount: increment(1) 
            }, { merge: true });
            
            return true;
          });
          
          if (transactionResult) {
            console.log('App install count verified and tracked atomically for device:', uniqueDeviceId);
          } else {
            console.log('App install count recovered from Firestore for device:', uniqueDeviceId);
          }
          
          // 3. Mark locally as successful
          localStorage.setItem(localTrackKey, 'true');
          try {
            const expires = new Date();
            expires.setFullYear(expires.getFullYear() + 10);
            document.cookie = `${localTrackKey}=true;expires=${expires.toUTCString()};path=/;SameSite=Lax`;
          } catch (e) {}
          
        } catch (error: any) {
          // If offline, runTransaction will throw an error (e.g. 'unavailable').
          // We gracefully fallback to writeBatch which queues locally and syncs safely when online.
          if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
            try {
              const batch = writeBatch(db);
              const installTrackingRef = doc(db, 'install_tracking', uniqueDeviceId);
              const configRef = doc(db, 'system_settings', 'app_config');
              
              batch.set(installTrackingRef, { 
                installedAt: serverTimestamp(),
                deviceId: uniqueDeviceId,
                platform: 'capacitor_or_web'
              }, { merge: true });
              
              batch.set(configRef, { 
                installCount: increment(1) 
              }, { merge: true });
              
              await batch.commit();
              
              // Queued successfully
              localStorage.setItem(localTrackKey, 'true');
              try {
                const expires = new Date();
                expires.setFullYear(expires.getFullYear() + 10);
                document.cookie = `${localTrackKey}=true;expires=${expires.toUTCString()};path=/;SameSite=Lax`;
              } catch (e) {}
              
              console.warn('Install count sync delayed: Client is offline (queued safely).');
            } catch (batchErr) {
               localStorage.removeItem(localTrackKey); // revert pending
               console.error('Offline batch queuing failed:', batchErr);
            }
          } else {
            // Real error (e.g. permissions). Revert pending so it tries again next time.
            localStorage.removeItem(localTrackKey);
            console.error('Failed to update install count atomically:', error);
          }
        }
      };
      
      updateInstallCount();
    }
  }, []);

  // Automated Configurable History Retention Cleanup
  useEffect(() => {
    const retentionDays = appConfig?.historyRetentionDays ?? 365;
    const lastRunRaw = localStorage.getItem('amb_last_retention_cleanup');
    let shouldRun = true;

    if (lastRunRaw) {
      try {
        const lastRun = JSON.parse(lastRunRaw);
        const hoursSinceLastRun = (Date.now() - new Date(lastRun.executedAt).getTime()) / (1000 * 60 * 60);
        // Throttle background cleanup to run at most once every 12 hours unless period changed
        if (hoursSinceLastRun < 12 && lastRun.days === retentionDays) {
          shouldRun = false;
        }
      } catch (e) {
        shouldRun = true;
      }
    }

    if (shouldRun) {
      executeHistoryRetentionCleanup(retentionDays).then(res => {
        if (res.totalDeleted > 0) {
          console.log(`[RetentionSystem] Successfully auto-purged ${res.totalDeleted} expired records older than ${retentionDays} days.`);
        }
      }).catch(err => {
        console.warn("[RetentionSystem] Background retention cleanup error:", err);
      });
    }
  }, [appConfig?.historyRetentionDays]);

  // Client-Side OneSignal Push Notification Setup & Initialization
  useEffect(() => {
    if (appConfig?.oneSignalAppId) {
      try {
        const OneSignal = (window as any).OneSignal || [];
        if (typeof OneSignal.push === 'function') {
          OneSignal.push(() => {
            OneSignal.init({
              appId: appConfig.oneSignalAppId,
              allowLocalhostAsSecureOrigin: true,
              welcomeNotification: {
                disable: false,
                title: "Al Mayadin Bazar",
                message: "মোবাইল পুশ নোটিফিকেশন সফলভাবে চালু হয়েছে! 🔔"
              }
            }).then(() => {
              console.log("OneSignal initialized on client side with app ID:", appConfig.oneSignalAppId);
              
              // Automatically register/prompt the user for notification permissions
              try {
                if (OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === 'function') {
                  OneSignal.Notifications.requestPermission();
                } else if (typeof OneSignal.registerForPushNotifications === 'function') {
                  OneSignal.registerForPushNotifications();
                }
              } catch (permErr) {
                console.warn("OneSignal permission request failed:", permErr);
              }

              // Login the user to OneSignal with their Firebase UID to allow targeted push!
              if (currentUser?.uid) {
                if (typeof OneSignal.login === 'function') {
                  OneSignal.login(currentUser.uid).then(() => {
                    console.log("OneSignal user logged in with External ID:", currentUser.uid);
                    
                    // Set tags for targeted filtering (e.g. role, group, division)
                    if (OneSignal.User && typeof OneSignal.User.addTags === 'function') {
                      OneSignal.User.addTags({
                        uid: currentUser.uid,
                        phone: currentUser.phone || '',
                        role: currentUser.role || 'user',
                        group: currentUser.group || 'all',
                        division: currentUser.division || ''
                      });
                      console.log("OneSignal user tags updated.");
                    }
                  }).catch((err: any) => {
                    console.warn("OneSignal login error:", err);
                  });
                }
              } else {
                // If logged out, log out from OneSignal too to avoid cross-device push mixing
                if (typeof OneSignal.logout === 'function') {
                  OneSignal.logout();
                }
              }
            }).catch((err: any) => {
              console.warn("OneSignal.init error:", err);
            });
          });
        }
      } catch (err) {
        console.error("Failed to run OneSignal client initialization:", err);
      }
    }
  }, [appConfig?.oneSignalAppId, currentUser?.uid, currentUser?.role, currentUser?.group, currentUser?.division]);

  // Language & Theme Global States
  const [appLanguage, setAppLanguage] = useState(() => {
    return localStorage.getItem('amb_lang') || 'bn';
  });
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('amb_dark_mode') === 'true';
  });

  // Apply Tailwind class-based dark mode state
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLanguageChange = (lang: string) => {
    setAppLanguage(lang);
    localStorage.setItem('amb_lang', lang);
  };

  const handleThemeToggle = () => {
    const nextVal = !darkMode;
    setDarkMode(nextVal);
    localStorage.setItem('amb_dark_mode', String(nextVal));
  };

  // Layout states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminError, setAdminError] = useState('');

  const [tabHistory, setTabHistory] = useState<string[]>(['home']);
  const activeTab = tabHistory[tabHistory.length - 1] || 'home';

  const setActiveTab = (tab: string) => {
    setTabHistory(prev => {
      if (prev[prev.length - 1] === tab) return prev;
      return [...prev, tab];
    });
  };

  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [showDemoAuthPrompt, setShowDemoAuthPrompt] = useState(false);
  const [foregroundNotification, setForegroundNotification] = useState<{title: string, body: string} | null>(null);
  const [showExitToast, setShowExitToast] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(() => {
    return sessionStorage.getItem('amb_fresh_login_location_needed') === 'true';
  });

  // Connect NavigationManager toast callback
  useEffect(() => {
    navigationManager.setExitToastCallback(setShowExitToast);
  }, []);

  // Top-level App layer back handlers (Priority order: Modal overlays > Drawers > Admin/BAP > Tab History)
  useBackHandler(() => {
    if (showLocationModal) {
      sessionStorage.removeItem('amb_fresh_login_location_needed');
      setShowLocationModal(false);
      return true;
    }
    return false;
  }, showLocationModal, 90);

  useBackHandler(() => {
    if (showDemoAuthPrompt) {
      setShowDemoAuthPrompt(false);
      return true;
    }
    return false;
  }, showDemoAuthPrompt, 85);

  useBackHandler(() => {
    if (showAdminPinModal) {
      setShowAdminPinModal(false);
      return true;
    }
    return false;
  }, showAdminPinModal, 80);

  useBackHandler(() => {
    if (drawerOpen) {
      setDrawerOpen(false);
      return true;
    }
    return false;
  }, drawerOpen, 70);

  useBackHandler(() => {
    if (adminOpen) {
      if (typeof (window as any).amb_admin_close_modal === 'function') {
        const modalClosed = (window as any).amb_admin_close_modal();
        if (modalClosed) return true;
      }
      if ((window as any).amb_admin_viewing_grid === false) {
        if (typeof (window as any).amb_admin_set_viewing_grid === 'function') {
          (window as any).amb_admin_set_viewing_grid(true);
          return true;
        }
      }
      setAdminOpen(false);
      return true;
    }
    return false;
  }, adminOpen, 50);

  // Tab History Step-by-Step Back Navigation (Home -> Page A -> Page B -> Page C -> Back -> B -> Back -> A -> Back -> Home)
  useBackHandler(() => {
    if (tabHistory.length > 1) {
      setTabHistory(prev => {
        if (prev.length <= 1) return prev;
        return prev.slice(0, prev.length - 1);
      });
      return true;
    }
    return false;
  }, tabHistory.length > 1, 10);

  // Global Hardware / Gesture Back Button & popstate Event Dispatcher
  useEffect(() => {
    let capListener: any = null;

    try {
      CapApp.addListener('backButton', () => {
        navigationManager.handleBack('capacitor');
      }).then(listener => {
        capListener = listener;
      }).catch(() => {});
    } catch (e) {}

    const handlePopState = () => {
      navigationManager.handlePopState();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (capListener && typeof capListener.remove === 'function') {
        capListener.remove();
      }
    };
  }, []);

  // Global Soft Keyboard scroll and overlap fix for mobile devices
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        document.body.classList.add('keyboard-active');
        
        // Scroll target to viewport center after a short layout-settling delay
        setTimeout(() => {
          if (document.activeElement === target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'SELECT' && active.tagName !== 'TEXTAREA')) {
          document.body.classList.remove('keyboard-active');
        }
      }, 150);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Handler for mandatory rules/poll popup consent & opinion submission
  const handleMandatoryNoticeConsent = async (agreed: boolean, feedbackText?: string) => {
    if (!currentUser || !appConfig.mandatoryNotice) return;
    const noticeId = appConfig.mandatoryNotice.id || 'notice_default';
    const now = new Date().toISOString();

    // 1. Mark in localStorage so modal instantly unblocks client
    try {
      localStorage.setItem(`amb_consent_${currentUser.uid}_${noticeId}`, agreed ? 'agreed' : 'disagreed');
    } catch (e) {
      console.warn("Failed to set localStorage consent flag:", e);
    }

    // 2. Update currentUser state in memory
    const existingAgreedIds = currentUser.agreedNoticeIds || [];
    const updatedAgreedIds = agreed && !existingAgreedIds.includes(noticeId)
      ? [...existingAgreedIds, noticeId]
      : existingAgreedIds;

    const updatedNoticeResponses = {
      ...(currentUser.noticeResponses || {}),
      [noticeId]: {
        agreed,
        respondedAt: now,
        feedbackText: feedbackText || ''
      }
    };

    setCurrentUser(prev => prev ? {
      ...prev,
      agreedNoticeIds: updatedAgreedIds,
      noticeResponses: updatedNoticeResponses
    } : null);

    // 3. Update User document in Firestore
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        agreedNoticeIds: updatedAgreedIds,
        [`noticeResponses.${noticeId}`]: {
          agreed,
          respondedAt: now,
          feedbackText: feedbackText || ''
        }
      });
    } catch (err) {
      console.warn("Failed to update user doc with notice consent:", err);
    }

    // 4. Update centralized app_config responses map in Firestore
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      await updateDoc(configRef, {
        [`mandatoryNoticeResponses.${currentUser.uid}`]: {
          userId: currentUser.uid,
          userName: currentUser.name || 'সদস্য',
          memberId: currentUser.memberId || 'N/A',
          phone: currentUser.phone || '',
          noticeId: noticeId,
          agreed,
          feedbackText: feedbackText || '',
          respondedAt: now
        }
      });
    } catch (err) {
      console.warn("Failed to update app_config with notice response:", err);
    }
  };

  // Auto-lock on visibility change removed to prevent double PIN prompts in iframe preview environments

  const convertBengaliToEnglishDigits = (input: string): string => {
    const bDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return input.split('').map(c => {
      const idx = bDigits.indexOf(c);
      return idx !== -1 ? String(idx) : c;
    }).join('');
  };

  const autoPromoteAndReturnUser = async (user: User): Promise<User> => {
    let changed = false;
    const updatedUser = { ...user };

    // Lock & Guarantee permanent immutable memberId
    if (updatedUser.role === 'admin' || updatedUser.uid === 'admin_master') {
      if (updatedUser.memberId !== 'MAIN_ADMIN') {
        updatedUser.memberId = 'MAIN_ADMIN';
        changed = true;
      }
    } else if (!updatedUser.memberId || updatedUser.memberId === 'AMB00000000' || updatedUser.memberId === 'AMB00000000' || updatedUser.memberId === 'N/A' || updatedUser.memberId === '') {
      try {
        const nextId = await getNextSequentialMemberId();
        updatedUser.memberId = nextId;
        changed = true;
      } catch (e) {}
    } else {
      // Normalize padding only (e.g. AMB00000013), never alter serial numbers
      const normalizedId = normalizeMemberId(updatedUser.memberId);
      if (updatedUser.memberId !== normalizedId && normalizedId !== 'AMB00000000' && normalizedId !== 'AMB00000000') {
        updatedUser.memberId = normalizedId;
        changed = true;
      }
    }

    // Keep in-memory balance cleanly resolved without modifying Firestore
    const effectiveBal = getEffectiveBalance(updatedUser);
    updatedUser.balance = effectiveBal;
    (updatedUser as any).mainBalance = effectiveBal;

    const effectiveSavings = Number(
      updatedUser.savings !== undefined && updatedUser.savings !== null && !isNaN(Number(updatedUser.savings))
        ? updatedUser.savings
        : (updatedUser.dpsBalance !== undefined && updatedUser.dpsBalance !== null && !isNaN(Number(updatedUser.dpsBalance)) ? updatedUser.dpsBalance : 0)
    ) || 0;
    updatedUser.savings = effectiveSavings;
    updatedUser.dpsBalance = effectiveSavings;

    if (updatedUser.telecomBalance === undefined || updatedUser.telecomBalance === null || isNaN(Number(updatedUser.telecomBalance))) { updatedUser.telecomBalance = 0; }
    if (updatedUser.superShopBalance === undefined || updatedUser.superShopBalance === null || isNaN(Number(updatedUser.superShopBalance))) { updatedUser.superShopBalance = 0; }
    if (updatedUser.profitsBalance === undefined || updatedUser.profitsBalance === null || isNaN(Number(updatedUser.profitsBalance))) { updatedUser.profitsBalance = 0; }
    if (updatedUser.dueLoan === undefined || updatedUser.dueLoan === null || isNaN(Number(updatedUser.dueLoan))) { updatedUser.dueLoan = 0; }

    const cleanPhone = updatedUser.phone?.replace(/\D/g, '') || '';
    const isDeveloper = cleanPhone.endsWith('00011112222') || cleanPhone.endsWith('11112222') || updatedUser.phone === '+8800011112222' || updatedUser.uid === 'admin_master';
    if (isDeveloper && updatedUser.role !== 'admin') {
      updatedUser.role = 'admin';
      changed = true;
    }

    const isRealUser = updatedUser.phone && 
      !updatedUser.phone.includes('01700000000') && 
      !updatedUser.name?.toLowerCase().includes('demo') && 
      !updatedUser.name?.includes('ডেমো') && 
      !updatedUser.name?.toLowerCase().includes('guest') && 
      !updatedUser.name?.includes('গেস্ট') && 
      !updatedUser.memberId?.includes('DEMO');

    if (isRealUser && updatedUser.isDemo !== false) {
      updatedUser.isDemo = false;
      changed = true;
    }

    // Retain Samity status only if explicitly approved or admin
    if (
      updatedUser.role === 'admin' ||
      updatedUser.role === 'sub_admin'
    ) {
      if (updatedUser.samityStatus !== 'approved') {
        updatedUser.samityStatus = 'approved';
        changed = true;
      }
    }

    if (changed) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          role: updatedUser.role || 'user',
          memberId: updatedUser.memberId,
          isDemo: updatedUser.isDemo ?? false,
          samityStatus: updatedUser.samityStatus || 'pending'
        });
        console.log("Successfully synchronized user non-balance metadata for user:", user.uid);
      } catch (e: any) {
        if (e?.code === 'unavailable' || e?.message?.includes('offline')) {
          console.warn("User profile metadata update delayed: Client is offline.");
        } else {
          console.error("User profile metadata update in Firestore failed:", e);
        }
      }
    }
    return updatedUser;
  };

  useEffect(() => {
    async function initSession() {
      try {
        // Load dynamic configuration settings
        const config = await loadAppConfig();
        setAppConfig(config);
        try {
          localStorage.setItem('amb_app_config', JSON.stringify(config));
        } catch (e) {
          console.error("Failed to cache appConfig", e);
        }

        // 1. Ensure authenticated user uid exists anonymously
        const authUser = await ensureAuth();
        if (authUser) {
          setAuthUid(authUser.uid);

          // 2. Check for locally remembered session details or auto-login the first available profile
          const rememberedPhone = localStorage.getItem('amb_user_phone');
          const rememberedUid = localStorage.getItem('amb_user_uid');
          
          if (rememberedPhone) {
            // Retrieve actual details from Firestore under saved UID first, or fall back to authUID
            const targetUid = rememberedUid || authUser.uid;
            const userRef = doc(db, 'users', targetUid);
            let userSnap;
            try {
              userSnap = await getDoc(userRef);
            } catch (err: any) {
              if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
                handleFirestoreError(err, OperationType.GET, `users/${targetUid}`);
              } else {
                throw err;
              }
            }

            if (userSnap && userSnap.exists()) {
              const userData = userSnap.data() as User;
              const finalUserData = await autoPromoteAndReturnUser(userData);

              // STRICT 1 PHONE = 1 ACCOUNT: Check if device is bound to another user
              const boundResult = await getDeviceBoundUser(deviceId);
              if (boundResult && boundResult.user.uid !== finalUserData.uid && finalUserData.role !== 'admin') {
                console.warn("[Session Security] Stale session: device is bound to another user:", boundResult.user.name);
                handleDirectLogout();
                return;
              }

              // Multi-phone auto-logout removed

              if (finalUserData.pin) {
                localStorage.setItem('amb_user_pin', finalUserData.pin);
              }
              localStorage.setItem('amb_user_uid', finalUserData.uid);
              setCurrentUser(finalUserData);
              if (finalUserData.role === 'admin' || finalUserData.role === 'sub_admin') {
                if (localStorage.getItem('amb_admin_mode') !== 'false') {
                  localStorage.setItem('amb_admin_mode', 'true');
                }
              }
            } else {
              // Trigger final fallback querying by multi-format phone search
              let matchedUser = null;
              try {
                matchedUser = await findUserInFirestoreByPhone(rememberedPhone);
              } catch (err: any) {
                if (err?.code === 'unavailable' || err?.message?.includes('offline')) {
                  console.warn("Session init phone match delayed: Client is offline.");
                } else if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
                  handleFirestoreError(err, OperationType.LIST, 'users');
                } else {
                  console.error("Session init phone match error:", err);
                }
              }
              if (matchedUser) {
                const finalUserData = await autoPromoteAndReturnUser(matchedUser.user);

                // STRICT 1 PHONE = 1 ACCOUNT: Check if device is bound to another user
                const boundResult = await getDeviceBoundUser(deviceId);
                if (boundResult && boundResult.user.uid !== finalUserData.uid && finalUserData.role !== 'admin') {
                  console.warn("[Session Security] Stale session: device is bound to another user:", boundResult.user.name);
                  handleDirectLogout();
                  return;
                }

                // Strict Device Security Check
                const isAuthorized = isSameDevice(finalUserData.currentDeviceId, finalUserData.deviceFingerprint, deviceId, deviceFingerprint, finalUserData.activeDeviceTokens);
                if (finalUserData.currentDeviceId && !isAuthorized && finalUserData.role !== 'admin' && !finalUserData.deviceLockBypassed) {
                  console.warn("[Session Security] Account belongs to another phone. Wiping session for device isolation:", finalUserData.name, finalUserData.currentDeviceId);
                  handleDirectLogout();
                  return;
                }

                if (finalUserData.pin) {
                  localStorage.setItem('amb_user_pin', finalUserData.pin);
                }
                localStorage.setItem('amb_user_uid', matchedUser.docId);
                setCurrentUser(finalUserData);
                if (finalUserData.role === 'admin' || finalUserData.role === 'sub_admin') {
                  if (localStorage.getItem('amb_admin_mode') !== 'false') {
                    localStorage.setItem('amb_admin_mode', 'true');
                  }
                }
              } else {
                // Cache stale, clean up
                localStorage.removeItem('amb_user_phone');
                localStorage.removeItem('amb_user_uid');
                setCurrentUser(null);
                setIsLocked(false);
              }
            }
          } else {
            setCurrentUser(null);
            setIsLocked(false);
          }
        }
      } catch (err: any) {
        if (err?.code === 'unavailable' || err?.message?.includes('offline')) {
          console.warn("Session initialization delayed: Client is offline.");
        } else {
          console.error("Session initialization failed:", err);
        }
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, []);

  // Real-time synchronization of the active logged-in user profile document
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    // Setup FCM
    setupFCM(currentUser.uid, (notification) => {
      setForegroundNotification(notification);
      setTimeout(() => setForegroundNotification(null), 5000);
    });

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsub = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const uData = snap.data() as User;
        const normalized = normalizeMemberId(uData.memberId);
        if (uData.memberId !== normalized) {
          uData.memberId = normalized;
        }

        // ⚡ Real-time Instant Force Logout & Zero Device Check (< 1s execution)
        const isDeviceAuthorized = isSameDevice(uData.currentDeviceId, uData.deviceFingerprint, deviceId, deviceFingerprint, uData.activeDeviceTokens);
        
        // If device matches via physical hardware fingerprint (e.g., App + Web on same phone), keep local deviceId in sync
        if (isDeviceAuthorized && uData.currentDeviceId && uData.currentDeviceId !== deviceId) {
          try {
            localStorage.setItem('amb_device_id', uData.currentDeviceId);
          } catch (e) {}
        }

        // Device lock permanently removed by user command

        const effectiveBal = getEffectiveBalance(uData);
        uData.balance = effectiveBal;
        (uData as any).mainBalance = effectiveBal;
        const effectiveSav = Math.max(Number(uData.savings) || 0, Number(uData.dpsBalance) || 0);
        uData.savings = effectiveSav;
        uData.dpsBalance = effectiveSav;

        setCurrentUser((prev) => {
          if (!prev) return null;
          return { ...prev, ...uData, uid: snap.id };
        });
      }
    }, (err) => {
      console.error("Real-time App user document snapshot error:", err);
    });

    return () => unsub();
  }, [currentUser?.uid]);

  // Real-time Agent Live Geolocation Auto-Update
  useEffect(() => {
    if (!currentUser?.uid) return;

    let watchId: number | null = null;

    const startLocationTracking = () => {
      if (!navigator.geolocation) return;

      // watchPosition tracks real-time location updates automatically for all app users
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const updateObj = {
              latitude,
              longitude,
              lat: latitude,
              lng: longitude,
              realLat: latitude,
              realLng: longitude,
              hasRealGPS: true,
              lastSeen: 'Active Now',
              lastSeenAt: new Date().toISOString(),
              isOnline: true
            };

            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, updateObj).catch(() => {});

            // Also update in 'agents' collection
            const agentRef = doc(db, 'agents', currentUser.uid);
            await updateDoc(agentRef, updateObj).catch(() => {});

            // Also update in 'bap_agents'
            const bapAgentRef = doc(db, 'bap_agents', currentUser.uid);
            await updateDoc(bapAgentRef, updateObj).catch(() => {});

            // Also update in 'agent_requests'
            const reqRef = doc(db, 'agent_requests', currentUser.uid);
            await updateDoc(reqRef, updateObj).catch(() => {});

          } catch (e) {
            console.error("Error auto-updating live location:", e);
          }
        },
        (error) => {
          console.warn("Continuous geolocation tracking failed:", error);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    };

    startLocationTracking();

    // Clean up watch and mark offline
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      const userRef = doc(db, 'users', currentUser.uid);
      updateDoc(userRef, { isOnline: false }).catch(() => {});
      const agentRef = doc(db, 'agents', currentUser.uid);
      updateDoc(agentRef, { lastSeen: 'Offline', isOnline: false }).catch(() => {});
      const bapAgentRef = doc(db, 'bap_agents', currentUser.uid);
      updateDoc(bapAgentRef, { lastSeen: 'Offline', isOnline: false }).catch(() => {});
    };
  }, [currentUser?.uid, currentUser?.role]);

  // Automatically register device ID & hardware fingerprint if not already set on user document in Firestore
  useEffect(() => {
    if (currentUser && currentUser.uid && currentUser.role !== 'admin') {
      const isDeviceAuth = isSameDevice(currentUser.currentDeviceId, currentUser.deviceFingerprint, deviceId, deviceFingerprint, currentUser.activeDeviceTokens);
      const isFirstBinding = !currentUser.currentDeviceId || currentUser.deviceLockBypassed;

      // Only perform registration if this is the first binding, bypass enabled, or already authorized
      if (isFirstBinding || isDeviceAuth) {
        const registerDevice = async () => {
          try {
            const updates: any = {};
            if (!currentUser.currentDeviceId) {
              updates.currentDeviceId = deviceId;
            }
            if (!currentUser.deviceFingerprint) {
              updates.deviceFingerprint = deviceFingerprint;
            }
            const existingTokens = Array.isArray(currentUser.activeDeviceTokens) ? currentUser.activeDeviceTokens : [];
            if (!existingTokens.includes(deviceId) || !existingTokens.includes(deviceFingerprint)) {
              updates.activeDeviceTokens = Array.from(new Set([...existingTokens, deviceId, deviceFingerprint].filter(Boolean)));
            }
            if (Object.keys(updates).length > 0) {
              await updateDoc(doc(db, 'users', currentUser.uid), updates);
            }
          } catch (err) {
            console.error("Failed to automatically register device ID / fingerprint:", err);
          }
        };
        registerDevice();
      }
    }
  }, [currentUser?.uid, currentUser?.currentDeviceId, currentUser?.deviceFingerprint, currentUser?.activeDeviceTokens, currentUser?.deviceLockBypassed, deviceId, deviceFingerprint]);

  // Real-time Device Status tracking (Online/Offline)
  useEffect(() => {
    if (!currentUser?.uid || isLocked || isDeviceLocked) return;

    const setOnline = async () => {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          deviceStatus: 'Online'
        });
      } catch (err) {
        console.error("Failed to update status to Online in Firestore:", err);
      }
    };
    setOnline();

    const setOffline = () => {
      if (currentUser?.uid) {
        updateDoc(doc(db, 'users', currentUser.uid), {
          deviceStatus: 'Offline'
        }).catch((err) => console.error("Failed to update status to Offline:", err));
      }
    };

    window.addEventListener('beforeunload', setOffline);
    return () => {
      window.removeEventListener('beforeunload', setOffline);
      setOffline();
    };
  }, [currentUser?.uid, isLocked]);

  // Periodic background location auto-update (Last Location System - Overwrites previous record)
  useEffect(() => {
    if (!currentUser?.uid || isLocked) return;

    const runLocationUpdate = async () => {
      try {
        const locRes = await syncUserLocationNow(currentUser.uid);
        localStorage.setItem('amb_location_permission_granted', 'true');
        if (locRes && locRes.address) {
          setCurrentUser(prev => prev ? {
            ...prev,
            lastLocation: locRes.address,
            fullAddress: locRes.address,
            lastLoginIP: locRes.ip
          } : null);
        }
      } catch (err) {
        console.warn("Location update error:", err);
      }
    };

    runLocationUpdate();
    // Background timer to refresh location every 90 seconds
    const interval = setInterval(runLocationUpdate, 90000);
    return () => clearInterval(interval);
  }, [currentUser?.uid, isLocked]);

  // Handle caching of current user properties reactively to prevent any flicker/white screen on entry
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('amb_user_phone', currentUser.phone || '');
      localStorage.setItem('amb_user_uid', currentUser.uid || '');
      localStorage.setItem('amb_user_name', currentUser.name || '');
      localStorage.setItem('amb_user_role', currentUser.role || 'user');
      localStorage.setItem('amb_user_member_id', currentUser.memberId || '');
      localStorage.setItem('amb_user_balance', String(currentUser.balance || 0));
      localStorage.setItem('amb_user_savings', String(currentUser.savings || 0));
      localStorage.setItem('amb_user_telecom_balance', String(currentUser.telecomBalance || 0));
      localStorage.setItem('amb_user_super_shop_balance', String(currentUser.superShopBalance || 0));
      localStorage.setItem('amb_user_due_loan', String(currentUser.dueLoan || 0));
      if (currentUser.pin) {
        localStorage.setItem('amb_user_pin', String(currentUser.pin));
      }
    } else {
      localStorage.removeItem('amb_user_phone');
      localStorage.removeItem('amb_user_uid');
      localStorage.removeItem('amb_user_name');
      localStorage.removeItem('amb_user_role');
      localStorage.removeItem('amb_user_member_id');
      localStorage.removeItem('amb_user_balance');
      localStorage.removeItem('amb_user_savings');
      localStorage.removeItem('amb_user_telecom_balance');
      localStorage.removeItem('amb_user_super_shop_balance');
      localStorage.removeItem('amb_user_due_loan');
      localStorage.removeItem('amb_user_pin');
    }
  }, [currentUser]);

  const handleLoginSuccess = async (userData: User) => {
    const finalUserData = await autoPromoteAndReturnUser(userData);
    setCurrentUser(finalUserData);
    setPreferRegister(false);
    localStorage.setItem('amb_user_phone', finalUserData.phone);
    localStorage.setItem('amb_user_uid', finalUserData.uid);
    if (finalUserData.pin) {
      localStorage.setItem('amb_user_pin', String(finalUserData.pin));
    }

    const isAuthorized = isSameDevice(finalUserData.currentDeviceId, finalUserData.deviceFingerprint, deviceId, deviceFingerprint, finalUserData.activeDeviceTokens);
    const isLockedToOther = false;

    if (!isLockedToOther) {
      if (finalUserData.isAppLocked) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
      const cleanPhone = finalUserData.phone?.replace(/\D/g, '') || '';
      const isAdminAccount = (finalUserData.role === 'admin' || finalUserData.uid === 'admin_master') && 
                             (cleanPhone.endsWith('00011112222') || cleanPhone.endsWith('11112222') || finalUserData.uid === 'admin_master');
      if (isAdminAccount) {
        localStorage.setItem('amb_admin_mode', 'true');
        setAdminOpen(true);
      }
      // Trigger Location Permission Modal on fresh login for authorized device only
      sessionStorage.setItem('amb_fresh_login_location_needed', 'true');
      setShowLocationModal(true);
    } else {
      setIsLocked(false);
      setShowLocationModal(false);
    }
  };

  const [isMandatoryLockOnLogout, setIsMandatoryLockOnLogout] = useState(false);
  const [isLoggingOutLock, setIsLoggingOutLock] = useState(false);
  const [logoutTargetToRegister, setLogoutTargetToRegister] = useState(false);

  const handleLogout = (toRegister = false) => {
    setDrawerOpen(false);
    if (currentUser && !currentUser.isDemoUser && currentUser.uid !== 'guest_demo') {
      setLogoutTargetToRegister(toRegister);
      setIsMandatoryLockOnLogout(true);
      setShowSetLockModal(true);
    } else {
      handleDirectLogout(toRegister);
    }
  };

  const handleDirectLogout = (toRegister = false) => {
    const uid = currentUser?.uid;
    const isOwnerDevice = !currentUser?.currentDeviceId || isSameDevice(currentUser.currentDeviceId, currentUser.deviceFingerprint, deviceId, deviceFingerprint, currentUser.activeDeviceTokens);

    // 1. Immediately reset UI state and local storage for complete per-session security isolation
    localStorage.removeItem('amb_user_phone');
    localStorage.removeItem('amb_user_uid');
    localStorage.removeItem('amb_user_name');
    localStorage.removeItem('amb_user_role');
    localStorage.removeItem('amb_user_member_id');
    localStorage.removeItem('amb_user_balance');
    localStorage.removeItem('amb_user_savings');
    localStorage.removeItem('amb_user_telecom_balance');
    localStorage.removeItem('amb_user_super_shop_balance');
    localStorage.removeItem('amb_user_due_loan');
    localStorage.removeItem('amb_user_samity_status');
    localStorage.removeItem('amb_user_pin');
    localStorage.removeItem('amb_registered_members');
    localStorage.removeItem('amb_all_users_backup');
    localStorage.removeItem('amb_last_user');
    localStorage.removeItem('amb_admin_mode');
    sessionStorage.removeItem('amb_fresh_login_location_needed');
    
    setCurrentUser(null);
    setIsLocked(false);
    setIsLoggingOutLock(false);
    setIsMandatoryLockOnLogout(false);
    setAdminOpen(false);
    setTabHistory(['home']);
    setPreferRegister(toRegister);
    setShowLocationModal(false);

    // 2. Perform background cleanup
    if (uid && isOwnerDevice) {
      updateDoc(doc(db, 'users', uid), {
        deviceStatus: 'Offline',
        isLoggedIn: false
      }).catch(err => console.error("Failed to update status on logout:", err));
    }
    if (auth.currentUser) {
      signOut(auth).catch(err => console.error("SignOut error:", err));
    }
  };

  const handleAdminPinAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');

    const cleanInput = convertBengaliToEnglishDigits(adminPinInput).trim();
    const userPinClean = currentUser?.pin ? convertBengaliToEnglishDigits(String(currentUser.pin)).trim() : '';

    const cleanPhone = currentUser?.phone?.replace(/\D/g, '') || '';
    const isSecretAdminPhone = 
      cleanPhone.endsWith('00011112222') ||
      cleanPhone.endsWith('11112222') ||
      currentUser?.phone === '+8800011112222' ||
      currentUser?.uid === 'admin_master';

    if (!isSecretAdminPhone) {
      setAdminError('অ্যাক্সেস সংরক্ষিত! অ্যাডমিন প্যানেল শুধুমাত্র অফিশিয়াল এডমিন নম্বর (+8800011112222) দিয়ে লগইনকৃত একাউন্টে অনুমোদিত।');
      setAdminPinInput('');
      setAdminBypassed(false);
      return;
    }

    // Valid PIN: strictly "6666" or custom appConfig.adminPin
    const isMasterPin = cleanInput === '6666' || 
                        (appConfig?.adminPin && cleanInput === convertBengaliToEnglishDigits(String(appConfig.adminPin)).trim());

    if (isMasterPin || (userPinClean && cleanInput === userPinClean)) {
      if (currentUser && currentUser.role !== 'admin') {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), { role: 'admin' });
        } catch (err) {
          console.error("Failed to promote user to admin in attempt:", err);
        }
        setCurrentUser(prev => prev ? { ...prev, role: 'admin' } : null);
      }
      localStorage.setItem('amb_admin_mode', 'true');
      setAdminOpen(true);
      setShowAdminPinModal(false);
      setAdminPinInput('');
    } else {
      setAdminError('ভুল অ্যাডমিন সিকিউরিটি পিন! এডমিন প্যানেলে প্রবেশের জন্য সঠিক পিন (6666) দিন।');
      setAdminPinInput('');
      setAdminBypassed(false);
    }
  };

  const handleOpenAdmin = () => {
    const cleanPhone = currentUser?.phone?.replace(/\D/g, '') || '';
    const isSecretAdminPhone = 
      cleanPhone.endsWith('00011112222') ||
      cleanPhone.endsWith('11112222') ||
      currentUser?.phone === '+8800011112222' ||
      currentUser?.uid === 'admin_master';

    if (!isSecretAdminPhone) {
      alert('অ্যাক্সেস সংরক্ষিত! অ্যাডমিন প্যানেল শুধুমাত্র অফিশিয়াল এডমিন নম্বর (+8800011112222) দিয়ে লগইনকৃত একাউন্টে অনুমোদিত।');
      return;
    }

    localStorage.setItem('amb_admin_mode', 'true');
    setAdminOpen(true);
  };



  const isDevOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'sub_admin';
  const isDeviceLocked = false;

  const showMaintenance = !!currentUser && !isLocked && appConfig.maintenanceMode && !adminBypassed && !isDevOrAdmin;
  const showUpdate = !!currentUser && !isLocked && !showMaintenance && appConfig.forceUpdateActive && !adminBypassed && !isDevOrAdmin && (() => {
    try {
      const cur = parseFloat(CURRENT_APP_VERSION);
      const min = parseFloat(appConfig.minAppVersion || "2.0");
      return cur < min;
    } catch (e) {
      return CURRENT_APP_VERSION !== (appConfig.minAppVersion || "2.0");
    }
  })();

  const isMandatoryNoticeActive = Boolean(
    currentUser &&
    !isLocked &&
    !isDeviceLocked &&
    !showMaintenance &&
    !showUpdate &&
    appConfig?.mandatoryNotice?.active &&
    appConfig?.mandatoryNotice?.id &&
    !(
      currentUser.agreedNoticeIds?.includes(appConfig.mandatoryNotice.id) ||
      currentUser.noticeResponses?.[appConfig.mandatoryNotice.id] ||
      appConfig.mandatoryNoticeResponses?.[currentUser.uid]?.noticeId === appConfig.mandatoryNotice.id ||
      localStorage.getItem(`amb_consent_${currentUser.uid}_${appConfig.mandatoryNotice.id}`)
    )
  );

  if (showSplash) {
    return <CleanSplash onFinish={() => setShowSplash(false)} />;
  }

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-emerald-100 selection:text-emerald-900 ${darkMode ? 'dark bg-slate-950 text-slate-100' : ''}`}>
      

      {showMaintenance ? (
        <MaintenanceScreen 
          appConfig={appConfig} 
          currentUser={currentUser} 
          onBypassAdmin={() => {
            setAdminBypassed(true);
            setShowAdminPinModal(true);
          }} 
        />
      ) : showUpdate ? (
        <ForceUpdateScreen 
          appConfig={appConfig} 
          currentUser={currentUser} 
          onBypassAdmin={() => {
            setAdminBypassed(true);
            setShowAdminPinModal(true);
          }} 
        />
      ) : (
        <>
          {/* Route Switch Control */}
          {currentUser && isLocked ? (
            <div key="locked-screen">
              <LockScreen 
                user={currentUser} 
                onUnlock={() => {
                  setIsLocked(false);
                  setIsLoggingOutLock(false);
                  if (currentUser.role === 'admin' || currentUser.uid === 'admin_master') {
                    if (localStorage.getItem('amb_admin_mode') === 'true') {
                      setAdminOpen(true);
                    }
                  }
                }} 
                onLogout={() => {
                  setIsLoggingOutLock(false);
                  handleDirectLogout();
                }} 
                isLogoutMode={isLoggingOutLock}
                onCancelLogout={() => {
                  setIsLocked(false);
                  setIsLoggingOutLock(false);
                }}
                appConfig={appConfig}
                appLanguage={appLanguage}
                onLanguageChange={handleLanguageChange}
                darkMode={darkMode}
              />
            </div>
          ) : adminOpen && currentUser ? (
            <div key="admin-mode">
              <AdminPanel 
                currentUser={currentUser} 
                onBack={() => {
                  setAdminOpen(false);
                }} 
                appConfig={appConfig}
                onChangeConfig={(newConfig) => {
                  setAppConfig(newConfig);
                  try {
                    localStorage.setItem('amb_app_config', JSON.stringify(newConfig));
                  } catch (e) {
                    console.error("Failed to cache updated config", e);
                  }
                }}
                appLanguage={appLanguage}
                darkMode={darkMode}
                
              />
            </div>
          ) : currentUser ? (
            <div key="dashboard-mode" className="min-h-screen">
              <Dashboard 
                user={currentUser} 
                onLogout={handleLogout} 
                onOpenDrawer={() => setDrawerOpen(true)}
                onTriggerAdmin={handleOpenAdmin}
                onTriggerBap={() => {}}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                selectedAction={selectedAction}
                setSelectedAction={setSelectedAction}
                appConfig={appConfig}
                onTriggerDemoAuth={() => setShowDemoAuthPrompt(true)}
                appLanguage={appLanguage}
                onLanguageChange={handleLanguageChange}
                darkMode={darkMode}
                onThemeToggle={handleThemeToggle}
              />

              {/* Slide drawer menu overlay */}
              <DrawerMenu 
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                user={currentUser}
                onLogout={handleLogout}
                onOpenAdmin={() => { setDrawerOpen(false); setTimeout(handleOpenAdmin, 150); }}
                onSelectTab={(tab) => { setActiveTab(tab); }}
                onSelectAction={(actionName) => setSelectedAction(actionName)}
                onTriggerDemoAuth={() => setShowDemoAuthPrompt(true)}
                onLock={() => {
                  if (currentUser?.isAppLocked) {
                    setIsLocked(true);
                  } else {
                    setShowSetLockModal(true);
                  }
                }}
                appLanguage={appLanguage}
                onLanguageChange={handleLanguageChange}
                darkMode={darkMode}
                onThemeToggle={handleThemeToggle}
                appConfig={appConfig}
              />

              {/* Custom Secret App Lock Setup Modal */}
              {currentUser && (
                <SetAppLockModal
                  isOpen={showSetLockModal}
                  onClose={() => {
                    setShowSetLockModal(false);
                    setIsMandatoryLockOnLogout(false);
                  }}
                  user={currentUser}
                  isMandatoryOnLogout={isMandatoryLockOnLogout}
                  onLockSuccess={(secretCode) => {
                    setCurrentUser(prev => prev ? { ...prev, password: secretCode, isAppLocked: true, appLockCode: secretCode } : null);
                    setShowSetLockModal(false);
                    if (isMandatoryLockOnLogout) {
                      setIsMandatoryLockOnLogout(false);
                      handleDirectLogout(logoutTargetToRegister);
                    } else {
                      setIsLocked(true);
                    }
                  }}
                  appLanguage={appLanguage}
                />
              )}
            </div>
          ) : (
            <div key="login-mode" className="bg-white min-h-screen">
              <LoginScreen 
                authUid={authUid} 
                onLoginSuccess={handleLoginSuccess} 
                initialRegistering={preferRegister}
                appConfig={appConfig}
                appLanguage={appLanguage}
                onLanguageChange={handleLanguageChange}
                darkMode={darkMode}
                onThemeToggle={handleThemeToggle}
              />
            </div>
          )}

          {/* Mandatory Logout uses SetAppLockModal directly with 2-step password confirmation */}

          {showAdminPinModal && (
            <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-55 p-4 backdrop-blur-xs font-sans text-slate-800">
              <div 
                className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-sm border border-slate-100"
              >
                <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-450" />
                    <span className="font-bold text-sm">অ্যাডমিন এনরোলমেন্ট গেটওয়ে</span>
                  </div>
                  <button 
                    onClick={() => { setShowAdminPinModal(false); setAdminError(''); setAdminPinInput(''); setAdminBypassed(false); }}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAdminPinAttempt} className="p-6 space-y-4">
                  {adminError && (
                    <div className="bg-red-50 text-red-650 border border-red-100 p-3 rounded-2xl text-xs flex items-center gap-2 font-medium">
                      <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                      {adminError}
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-slate-550 leading-relaxed mb-3">
                      প্রবেশ করতে সিকিউরিটি পিন দিন। এডমিন প্যানেলের সিকিউরিটি পিন: <strong className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded leading-none text-xs">6666</strong> (এডমিন নম্বর: +8800011112222)
                    </p>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">4 ডিজিটের সিকিউরিটি পিন</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={adminPinInput}
                      onChange={(e) => {
                        const converted = convertBengaliToEnglishDigits(e.target.value);
                        setAdminPinInput(converted.replace(/\D/g, ''));
                      }}
                      placeholder="••••"
                      className="block w-full py-3 bg-slate-50 border border-slate-205 rounded-xl text-center text-xl font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => { setShowAdminPinModal(false); setAdminError(''); setAdminPinInput(''); setAdminBypassed(false); }}
                      className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-md active:scale-98"
                    >
                      যাচাই করুন
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Authentic Demo Auth Prompt Modal for Demo users */}
          <AnimatePresence>
            {showDemoAuthPrompt && (
              <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans text-slate-800">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 250 }}
                  className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl relative text-center overflow-hidden"
                >
                  {/* Decorative corner accent */}
                  <div className="absolute top-0 inset-x-0 h-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
                  
                  {/* Shield Alert Icon */}
                  <div className="mx-auto w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mb-4.5 border border-emerald-100 shadow-3xs animate-bounce" style={{ animationDuration: '3s' }}>
                    <ShieldAlert className="w-8 h-8 text-emerald-700" />
                  </div>

                  <h3 className="text-base font-black text-slate-800 tracking-tight leading-snug">
                    অ্যাকাউন্ট ভেরিফিকেশন প্রয়োজন
                  </h3>
                  <p className="text-[10px] text-emerald-800 font-bold bg-emerald-50/60 px-2.5 py-0.5 rounded-full inline-block mt-1 mx-auto border border-emerald-100">
                    🔒 অ্যাকাউন্ট যাচাইকরণ সেশন
                  </p>

                  <p className="text-xs text-slate-550 font-medium leading-relaxed mt-4 mb-6">
                    সফটওয়্যারের এই লাইভ ফিচারটি বা সেকশনটি ব্যবহার করতে অনুগ্রহ করে একটি নতুন অ্যাকাউন্ট তৈরি করুন অথবা আগের অ্যাকাউন্ট থাকলে লগইন করুন।
                  </p>

                  <div className="space-y-2.5">
                    {/* Action 1: Create New Account */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowDemoAuthPrompt(false);
                        handleLogout(true); // logs out and redirects straight to Registration!
                      }}
                      className="w-full bg-emerald-850 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition-all shadow-md shadow-emerald-800/15 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      🧑‍💻 নতুন অ্যাকাউন্ট তৈরি বা নিবন্ধন করুন
                    </button>

                    {/* Action 2: Login */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowDemoAuthPrompt(false);
                        handleLogout(false); // logs out and redirects straight to Log In!
                      }}
                      className="w-full bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      🔑 পূর্বের অ্যাকাউন্ট থেকে লগইন করুন
                    </button>

                    {/* Cancel */}
                    <button
                      type="button"
                      onClick={() => setShowDemoAuthPrompt(false)}
                      className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer mt-1"
                    >
                      ফিরে যান
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Mandatory Rule / Poll Popup (Blocks interaction until user submits consent/opinion) */}
          <MandatoryNoticeModal
            isOpen={isMandatoryNoticeActive}
            user={currentUser}
            appConfig={appConfig}
            noticeConfig={appConfig?.mandatoryNotice}
            onConsentSubmitted={handleMandatoryNoticeConsent}
          />

          {currentUser && !isDeviceLocked && !isLocked && !showMaintenance && !showUpdate && (
            <NotificationPrompt appConfig={appConfig} userId={currentUser.uid} />
          )}

          {currentUser && !isDeviceLocked && showLocationModal && (
            <LocationPermissionModal
              userId={currentUser.uid}
              onClose={() => {
                sessionStorage.removeItem('amb_fresh_login_location_needed');
                setShowLocationModal(false);
              }}
              onLocationUpdated={(locData) => {
                setCurrentUser(prev => prev ? {
                  ...prev,
                  lastLocation: locData.address,
                  fullAddress: locData.address,
                  lastLoginIP: locData.ip
                } : null);
              }}
            />
          )}

          {foregroundNotification && (
            <NotificationBanner 
              notification={foregroundNotification} 
              onClose={() => setForegroundNotification(null)} 
            />
          )}

          <AnimatePresence>
            {showExitToast && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/95 text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-xl border border-slate-800 backdrop-blur-md flex items-center gap-2.5 whitespace-nowrap select-none pointer-events-none"
              >
                <span>📱</span>
                <span>আবার Back চাপলে অ্যাপ থেকে বের হবে</span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

    </div>
  );
}
