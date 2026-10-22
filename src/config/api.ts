/**
 * Centralized API configuration and URL resolver.
 * Ensures seamless operation across Web and Android Capacitor (Play Store app).
 */

export const APP_BASE_URL = 'https://businessnetworkbangladesh.com';
export const DEFAULT_PRODUCTION_SERVER_URL = APP_BASE_URL;

export function isNativeOrLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const isCapacitorNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
  const isCapacitorScheme = window.location.protocol === 'capacitor:' || window.location.protocol === 'file:';
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isCapacitorNative || isCapacitorScheme || isLocalHost;
}

export function getApiBaseUrl(): string {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : null;
  if (metaEnv?.VITE_API_BASE_URL) {
    return String(metaEnv.VITE_API_BASE_URL).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && (window as any).BNB_API_BASE_URL) {
    return String((window as any).BNB_API_BASE_URL).replace(/\/$/, '');
  }
  if (isNativeOrLocalhost()) {
    // In native app or local dev, use window.location.origin if available or APP_BASE_URL
    if (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) {
      return window.location.origin.replace(/\/$/, '');
    }
    return APP_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return APP_BASE_URL;
}

export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = getApiBaseUrl();
  return `${base}${cleanEndpoint}`;
}

export function getReturnOrigin(): string {
  if (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) {
    return window.location.origin.replace(/\/$/, '');
  }
  return APP_BASE_URL;
}

