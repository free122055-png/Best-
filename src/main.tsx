import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global monkeypatch to ensure all numbers, monetary values, dates, and times are displayed
// in English numerals (e.g. 1, 2, 3) rather than Bengali digits, even when 'bn-BD' is requested.
// This also ensures 2 decimal places (poisha/paisa) are always shown for money formatting.
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

// Also patch Date localization to render in English numbers
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
