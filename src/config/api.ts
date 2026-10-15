/**
 * Centralized API configuration and URL resolver.
 * Ensures seamless operation across:
 * 1. Web Browser (Local dev server & Cloud Run production)
 * 2. Mobile Android APK / AAB installed from Google Play Store (Capacitor)
 * 3. PWA and external WebView containers
 */

// Authoritative production Cloud Run server endpoint
export const DEFAULT_PRODUCTION_SERVER_URL = 'https://ais-dev-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app';

/**
 * Checks if the application is currently running in a native Android/iOS
 * wrapper (Capacitor WebView) or in a localhost asset container.
 */
export function isNativeOrLocalhost(): boolean {
  if (typeof window === 'undefined') return false;

  const isCapacitorNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
  const isCapacitorScheme = window.location.protocol === 'capacitor:' || window.location.protocol === 'file:';
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return isCapacitorNative || isCapacitorScheme || isLocalHost;
}

/**
 * Resolves the absolute backend API base URL.
 * When on Android Capacitor (Play Store app), requests must target the live cloud backend.
 * When on the web domain, relative paths `/api/...` or the live origin are used.
 */
export function getApiBaseUrl(): string {
  // Allow explicit environment override
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : null;
  if (metaEnv?.VITE_API_BASE_URL) {
    return String(metaEnv.VITE_API_BASE_URL).replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && (window as any).BNB_API_BASE_URL) {
    return String((window as any).BNB_API_BASE_URL).replace(/\/$/, '');
  }

  if (isNativeOrLocalhost()) {
    return DEFAULT_PRODUCTION_SERVER_URL;
  }

  // Running on Web preview/production domain: use current origin
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')) {
    return window.location.origin.replace(/\/$/, '');
  }

  return DEFAULT_PRODUCTION_SERVER_URL;
}

/**
 * Normalizes an API path and prepends the resolved base URL.
 * e.g., apiUrl('/api/payment/create') -> 'https://ais-dev-.../api/payment/create' on mobile
 */
export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = getApiBaseUrl();
  return `${base}${cleanEndpoint}`;
}

/**
 * Returns the reliable return origin for payment gateway redirects.
 * On Play Store native apps (where origin is https://localhost), it provides
 * the verified server domain so the payment callback works 100%.
 */
export function getReturnOrigin(): string {
  if (typeof window === 'undefined') return DEFAULT_PRODUCTION_SERVER_URL;
  
  if (isNativeOrLocalhost()) {
    return DEFAULT_PRODUCTION_SERVER_URL;
  }
  
  return window.location.origin;
}
