/**
 * Centralized API configuration and URL resolver.
 * Ensures seamless operation across Web and Android Capacitor (Play Store app).
 */

export const DEFAULT_PRODUCTION_SERVER_URL = 'https://ais-pre-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app';

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
    return DEFAULT_PRODUCTION_SERVER_URL;
  }
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')) {
    return window.location.origin.replace(/\/$/, '');
  }
  return DEFAULT_PRODUCTION_SERVER_URL;
}

export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = getApiBaseUrl();
  return `${base}${cleanEndpoint}`;
}

export function getReturnOrigin(): string {
  return DEFAULT_PRODUCTION_SERVER_URL;
}
