import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export interface HighPrecisionLocation {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  isRealGPS: boolean;
}

export interface AgentLocationRecord {
  userId: string;
  name: string;
  phone: string;
  memberId?: string;
  role?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  lastUpdated: string;
  lastUpdatedTs: number;
  isOnline: boolean;
  isSharingLocation: boolean;
  profileImage?: string;
  city?: string;
  district?: string;
  country?: string;
}

// Convert English numbers to Bangla digits
export const toBanglaDigits = (numStr: string | number): string => {
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return numStr.toString().replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
};

// Precise Haversine Distance calculation in Kilometers
export const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // returns distance in km
};

// Format Distance nicely (Meters if < 1km, Kilometers if >= 1km)
export const formatDistance = (
  distanceKm: number,
  lang: 'bn' | 'en' = 'bn'
): string => {
  if (distanceKm < 0.01) {
    return lang === 'bn' ? 'ঠিক এইখানেই (০ মিটার)' : 'Right Here (0m)';
  }

  if (distanceKm < 1.0) {
    const meters = Math.round(distanceKm * 1000);
    const mStr = meters.toString();
    if (lang === 'bn') {
      return `${toBanglaDigits(mStr)} মিটার`;
    }
    return `${mStr} meters`;
  }

  const kmStr = distanceKm.toFixed(2);
  if (lang === 'bn') {
    return `${toBanglaDigits(kmStr)} কি.মি.`;
  }
  return `${kmStr} km`;
};

// Format Relative Time since last GPS update
export const formatRelativeTime = (
  timestampMs: number,
  lang: 'bn' | 'en' = 'bn'
): string => {
  if (!timestampMs || timestampMs <= 0) {
    return lang === 'bn' ? 'তারিখ অজানা' : 'Unknown date';
  }

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestampMs) / 1000));

  if (diffSec < 15) {
    return lang === 'bn' ? 'সদ্য সক্রিয় (এখনই)' : 'Active Now';
  }
  if (diffSec < 60) {
    const s = diffSec.toString();
    return lang === 'bn' ? `${toBanglaDigits(s)} সেকেন্ড আগে` : `${s} seconds ago`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    const m = diffMin.toString();
    return lang === 'bn' ? `${toBanglaDigits(m)} মিনিট আগে` : `${m} minutes ago`;
  }

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    const h = diffHr.toString();
    return lang === 'bn' ? `${toBanglaDigits(h)} ঘন্টা আগে` : `${h} hours ago`;
  }

  const diffDays = Math.floor(diffHr / 24);
  const d = diffDays.toString();
  return lang === 'bn' ? `${toBanglaDigits(d)} দিন আগে` : `${d} days ago`;
};

// Get Online Status badge metadata
export const getOnlinePresenceStatus = (
  timestampMs: number,
  lang: 'bn' | 'en' = 'bn'
) => {
  if (!timestampMs) {
    return {
      status: 'offline',
      label: lang === 'bn' ? '⚪ অফলাইন' : '⚪ Offline',
      color: 'gray',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-300'
    };
  }

  const ageMs = Date.now() - timestampMs;

  if (ageMs < 300000) {
    // Under 5 minutes
    return {
      status: 'active',
      label: lang === 'bn' ? '🟢 লাইভ অনলাইন' : '🟢 Live Online',
      color: 'green',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 animate-pulse'
    };
  } else if (ageMs < 900000) {
    // Under 15 minutes
    return {
      status: 'recent',
      label: lang === 'bn' ? '🟡 সম্প্রতি সক্রিয়' : '🟡 Recently Active',
      color: 'yellow',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-300'
    };
  } else {
    // 15+ minutes
    return {
      status: 'offline',
      label: lang === 'bn' ? '⚪ অফলাইন' : '⚪ Offline',
      color: 'gray',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-300'
    };
  }
};

// Calculate ETA based on distance
export const getEstimatedTravelTime = (
  distanceKm: number,
  lang: 'bn' | 'en' = 'bn'
) => {
  if (distanceKm < 0.05) {
    return {
      timeStr: lang === 'bn' ? '১ মিনিট' : '1 min',
      modeStr: lang === 'bn' ? 'হাঁটা পথ' : 'Walking'
    };
  }

  if (distanceKm < 2.5) {
    // Walking average speed ~4.5 km/h
    const minutes = Math.max(1, Math.round((distanceKm / 4.5) * 60));
    const mStr = minutes.toString();
    return {
      timeStr: lang === 'bn' ? `${toBanglaDigits(mStr)} মিনিট` : `${mStr} mins`,
      modeStr: lang === 'bn' ? 'হাঁটা পথ' : 'Walking'
    };
  } else {
    // Driving average urban speed ~25 km/h
    const minutes = Math.max(1, Math.round((distanceKm / 25) * 60));
    const mStr = minutes.toString();
    return {
      timeStr: lang === 'bn' ? `${toBanglaDigits(mStr)} মিনিট` : `${mStr} mins`,
      modeStr: lang === 'bn' ? 'গাড়ি/বাইক' : 'Driving'
    };
  }
};

// In-memory cost-optimization cache for last written positions
const lastWrittenMap = new Map<
  string,
  { lat: number; lng: number; time: number }
>();

// Write / Overwrite high precision location to Firestore under agentLocations/{userId}
export const syncAgentLocationToFirestore = async (
  userId: string,
  userInfo: {
    name: string;
    phone: string;
    memberId?: string;
    role?: string;
    profileImage?: string;
    city?: string;
    district?: string;
    country?: string;
  },
  pos: HighPrecisionLocation,
  options?: { forceWrite?: boolean; isSharingLocation?: boolean }
): Promise<boolean> => {
  if (!userId) return false;

  const now = Date.now();
  const lastWritten = lastWrittenMap.get(userId);

  // COST OPTIMIZATION: Skip write if moved < 20 meters AND last write was < 30 seconds ago
  if (lastWritten && !options?.forceWrite) {
    const distKm = calculateHaversineDistance(
      lastWritten.lat,
      lastWritten.lng,
      pos.lat,
      pos.lng
    );
    const timeDiffSec = (now - lastWritten.time) / 1000;

    if (distKm < 0.02 && timeDiffSec < 30) {
      // Skipped write to save Firebase quota
      return true;
    }
  }

  const formattedTime = new Date().toLocaleString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const record: AgentLocationRecord = {
    userId: userId,
    name: userInfo.name || 'BNB Member',
    phone: userInfo.phone || '',
    memberId: userInfo.memberId || '',
    role: userInfo.role || 'Member',
    latitude: pos.lat,
    longitude: pos.lng,
    accuracy: Number(pos.accuracy.toFixed(2)),
    altitude: pos.altitude !== null ? Number(pos.altitude.toFixed(2)) : null,
    heading: pos.heading !== null ? Number(pos.heading.toFixed(2)) : null,
    speed: pos.speed !== null ? Number(pos.speed.toFixed(2)) : null,
    lastUpdated: formattedTime,
    lastUpdatedTs: now,
    isOnline: true,
    isSharingLocation: options?.isSharingLocation ?? true,
    profileImage: userInfo.profileImage || '',
    city: userInfo.city || '',
    district: userInfo.district || '',
    country: userInfo.country || 'Bangladesh'
  };

  try {
    // 1. Overwrite single location document under agentLocations/{userId}
    const locRef = doc(db, 'agentLocations', userId);
    await setDoc(locRef, record, { merge: true });

    // Update in-memory last written tracking
    lastWrittenMap.set(userId, { lat: pos.lat, lng: pos.lng, time: now });

    // 2. Sync to user profile for legacy compatibility
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        latitude: pos.lat,
        longitude: pos.lng,
        realLat: pos.lat,
        realLng: pos.lng,
        hasRealGPS: true,
        gpsAccuracy: pos.accuracy,
        locationLastUpdated: formattedTime,
        deviceStatus: 'Online'
      }).catch(() => {});

      const agentRef = doc(db, 'agents', userId);
      await updateDoc(agentRef, {
        latitude: pos.lat,
        longitude: pos.lng,
        realLat: pos.lat,
        realLng: pos.lng,
        hasRealGPS: true,
        gpsAccuracy: pos.accuracy,
        lastSeen: 'Active Now'
      }).catch(() => {});
    } catch {
      // Ignore non-fatal user document update errors
    }

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `agentLocations/${userId}`);
    return false;
  }
};

// Stop location sharing and mark offline in Firestore
export const stopSharingAgentLocation = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  try {
    const locRef = doc(db, 'agentLocations', userId);
    await setDoc(
      locRef,
      {
        isOnline: false,
        isSharingLocation: false,
        lastUpdatedTs: Date.now()
      },
      { merge: true }
    );
    lastWrittenMap.delete(userId);
    return true;
  } catch (e) {
    console.error('Failed to stop location sharing:', e);
    return false;
  }
};

// Fetch High-Precision GPS Position once
export const getHighPrecisionPosition = (): Promise<HighPrecisionLocation> => {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Browser geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp || Date.now(),
          isRealGPS: true
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
};

// Continuous background/foreground location watch with displacement filtering
export const startWatchingHighPrecisionLocation = (
  userId: string,
  userInfo: {
    name: string;
    phone: string;
    memberId?: string;
    role?: string;
    profileImage?: string;
    city?: string;
    district?: string;
    country?: string;
  },
  onLocationUpdate?: (pos: HighPrecisionLocation) => void,
  onError?: (err: any) => void
): (() => void) => {
  if (!('geolocation' in navigator)) {
    if (onError) onError(new Error('Geolocation not available'));
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const highPrecPos: HighPrecisionLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp || Date.now(),
        isRealGPS: true
      };

      if (onLocationUpdate) {
        onLocationUpdate(highPrecPos);
      }

      // Sync to Firebase in real-time with displacement/time filtering
      syncAgentLocationToFirestore(userId, userInfo, highPrecPos, {
        isSharingLocation: true
      });
    },
    (err) => {
      console.warn('Geolocation watch position error:', err);
      if (onError) onError(err);
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 5000
    }
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
    stopSharingAgentLocation(userId);
  };
};
