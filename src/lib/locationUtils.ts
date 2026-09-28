import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

export interface LocationData {
  address: string;
  ip: string;
  lat: number;
  lng: number;
  isRealGPS?: boolean;
}

export const fetchRealIpAndLocation = async (): Promise<LocationData> => {
  // Tier 1: ipwho.is (fast, accurate coordinates & city)
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal }).catch(() => null);
    clearTimeout(tid);
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        const city = data.city || data.region || '';
        const country = data.country || 'Bangladesh';
        const ip = data.ip || '';
        const addr = [city, country].filter(Boolean).join(', ');
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          return {
            address: addr || `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`,
            ip: ip || '',
            lat: data.latitude,
            lng: data.longitude,
            isRealGPS: false
          };
        }
      }
    }
  } catch {
    // try next
  }

  // Tier 2: ipapi.co
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal }).catch(() => null);
    clearTimeout(tid);
    if (res && res.ok) {
      const data = await res.json();
      const city = data.city || data.region || '';
      const country = data.country_name || 'Bangladesh';
      const ip = data.ip || '';
      const addr = [city, country].filter(Boolean).join(', ');
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return {
          address: addr || `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`,
          ip: ip || '',
          lat: data.latitude,
          lng: data.longitude,
          isRealGPS: false
        };
      }
    }
  } catch {
    // try next
  }

  // Tier 3: freeipapi.com
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://freeipapi.com/api/json', { signal: controller.signal }).catch(() => null);
    clearTimeout(tid);
    if (res && res.ok) {
      const data = await res.json();
      const city = data.cityName || data.regionName || '';
      const country = data.countryName || 'Bangladesh';
      const ip = data.ipAddress || '';
      const addr = [city, country].filter(Boolean).join(', ');
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return {
          address: addr || `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`,
          ip: ip || '',
          lat: data.latitude,
          lng: data.longitude,
          isRealGPS: false
        };
      }
    }
  } catch {
    // try next
  }

  // Default fallback if all fail
  return {
    address: 'ঢাকা, বাংলাদেশ',
    ip: '',
    lat: 23.8103,
    lng: 90.4125,
    isRealGPS: false
  };
};

export const syncUserLocationNow = async (userId: string): Promise<LocationData> => {
  const formattedTime = new Date().toLocaleString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return new Promise((resolve) => {
    let resolved = false;

    const saveAndResolve = async (data: LocationData) => {
      if (resolved) return;
      resolved = true;
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          latitude: data.lat,
          longitude: data.lng,
          lat: data.lat,
          lng: data.lng,
          realLat: data.lat,
          realLng: data.lng,
          fullAddress: data.address,
          lastLocation: data.address,
          lastLocationAddress: data.address,
          lastLoginIP: data.ip || '',
          ip: data.ip || '',
          lastIp: data.ip || '',
          locationLastUpdated: formattedTime,
          lastLoginTime: formattedTime,
          hasRealGPS: data.isRealGPS ?? true,
          deviceStatus: 'Online'
        }).catch(() => {});

        // Also update agents collections if user is an agent
        const agentRef = doc(db, 'agents', userId);
        updateDoc(agentRef, {
          latitude: data.lat,
          longitude: data.lng,
          lat: data.lat,
          lng: data.lng,
          realLat: data.lat,
          realLng: data.lng,
          fullAddress: data.address
        }).catch(() => {});
      } catch (err) {
        console.warn("Failed to sync user location to Firestore:", err);
      }
      resolve(data);
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          let fullAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

          try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=bn,en`,
              { signal: controller.signal }
            ).catch(() => null);
            clearTimeout(tid);

            if (res && res.ok) {
              const geoData = await res.json();
              if (geoData && geoData.display_name) {
                fullAddress = geoData.display_name;
              } else if (geoData && geoData.address) {
                const addr = geoData.address;
                const parts = [
                  addr.road,
                  addr.neighbourhood || addr.suburb,
                  addr.village || addr.town || addr.city_district,
                  addr.city || addr.state_district,
                  addr.state || addr.country
                ].filter(Boolean);
                if (parts.length > 0) {
                  fullAddress = parts.join(', ');
                }
              }
            }
          } catch (e) {
            console.warn("Reverse geocode error:", e);
          }

          const ipLocation = await fetchRealIpAndLocation().catch(() => null);
          saveAndResolve({
            lat,
            lng,
            address: fullAddress,
            ip: ipLocation?.ip || '',
            isRealGPS: true
          });
        },
        async () => {
          // GPS failed or denied, fall back to high accuracy IP geolocation
          const ipData = await fetchRealIpAndLocation();
          saveAndResolve(ipData);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    } else {
      fetchRealIpAndLocation().then(saveAndResolve);
    }
  });
};
