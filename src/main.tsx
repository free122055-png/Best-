import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AdminApp from './AdminApp.tsx';
import './index.css';

// Global monkeypatch for English numerals & currency formatting
const originalNumberToLocaleString = Number.prototype.toLocaleString;
Number.prototype.toLocaleString = function(locales?: any, options?: any): string {
  let targetLocale = locales;
  if (locales === 'bn-BD' || (Array.isArray(locales) && locales.includes('bn-BD'))) {
    targetLocale = 'en-US';
  }
  const isTargetLocale = !targetLocale || 
    targetLocale === 'en-US' || 
    targetLocale === 'en-IN' || 
    (Array.isArray(targetLocale) && (targetLocale.includes('en-US') || targetLocale.includes('en-IN')));

  if (isTargetLocale) {
    const hasExplicitFraction = options && (options.minimumFractionDigits !== undefined || options.maximumFractionDigits !== undefined);
    if (!hasExplicitFraction) {
      const updatedOptions = {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...options
      };
      return originalNumberToLocaleString.call(this, targetLocale, updatedOptions);
    }
  }
  return originalNumberToLocaleString.call(this, targetLocale, options);
};

const originalDateToLocaleString = Date.prototype.toLocaleString;
Date.prototype.toLocaleString = function(locales?: any, options?: any): string {
  let targetLocale = locales;
  if (locales === 'bn-BD' || (Array.isArray(locales) && locales.includes('bn-BD'))) {
    targetLocale = 'en-US';
  }
  return originalDateToLocaleString.call(this, targetLocale, options);
};

const originalDateToLocaleDateString = Date.prototype.toLocaleDateString;
Date.prototype.toLocaleDateString = function(locales?: any, options?: any): string {
  let targetLocale = locales;
  if (locales === 'bn-BD' || (Array.isArray(locales) && locales.includes('bn-BD'))) {
    targetLocale = 'en-US';
  }
  return originalDateToLocaleDateString.call(this, targetLocale, options);
};

const originalDateToLocaleTimeString = Date.prototype.toLocaleTimeString;
Date.prototype.toLocaleTimeString = function(locales?: any, options?: any): string {
  let targetLocale = locales;
  if (locales === 'bn-BD' || (Array.isArray(locales) && locales.includes('bn-BD'))) {
    targetLocale = 'en-US';
  }
  return originalDateToLocaleTimeString.call(this, targetLocale, options);
};

// Check if current URL indicates Admin App mode (e.g. /admin, ?admin=true, or admin. subdomain)
const isExplicitAdminApp = (() => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const host = window.location.hostname.toLowerCase();
  return path.includes('admin') || search.includes('admin=true') || host.startsWith('admin.');
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isExplicitAdminApp ? <AdminApp /> : <App />}
  </StrictMode>
);
