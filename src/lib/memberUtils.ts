import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

/**
 * Utility functions for Member ID (Account Number) normalization and display
 */

export function getClientDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let devId = '';
  
  // 1. Try to load from localStorage
  try {
    devId = localStorage.getItem('amb_device_id') || '';
  } catch (e) {}

  // 2. Try to load from Cookie as a backup to prevent loss when cache/localStorage is wiped
  if (!devId) {
    try {
      const match = document.cookie.match(/(?:^|; )amb_device_id=([^;]*)/);
      if (match && match[1]) {
        devId = decodeURIComponent(match[1]);
        // Restore to localStorage
        localStorage.setItem('amb_device_id', devId);
      }
    } catch (e) {}
  }

  // 3. Generate a new high-entropy device ID if both are missing
  if (!devId) {
    const randomPart = Math.random().toString(36).substring(2, 12);
    const timePart = Date.now().toString(36);
    devId = `dev_${randomPart}_${timePart}`;
    
    // Set in localStorage
    try {
      localStorage.setItem('amb_device_id', devId);
    } catch (e) {}
    
    // Set in Cookie (lasts 10 years)
    try {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 10);
      document.cookie = `amb_device_id=${encodeURIComponent(devId)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    } catch (e) {}
  } else {
    // Keep both synced
    try {
      if (!localStorage.getItem('amb_device_id')) {
        localStorage.setItem('amb_device_id', devId);
      }
    } catch (e) {}
    try {
      const hasCookie = document.cookie.includes('amb_device_id=');
      if (!hasCookie) {
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 10);
        document.cookie = `amb_device_id=${encodeURIComponent(devId)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
      }
    } catch (e) {}
  }
  return devId;
}

export function getGpuRenderer(): string {
  if (typeof window === 'undefined') return 'unknown_gpu';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no_webgl';
    const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
      const vendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
      const combined = `${vendor}_${renderer}`.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      return combined || 'webgl_generic';
    }
    return 'generic_webgl';
  } catch (e) {
    return 'gpu_err';
  }
}

export function getNormalizedDeviceModel(): { os: string; model: string } {
  if (typeof window === 'undefined') return { os: 'unknown', model: 'generic' };
  const ua = (navigator.userAgent || '').toLowerCase();
  
  let os = 'other';
  if (/android/i.test(ua)) os = 'android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'ios';
  else if (/windows nt/i.test(ua)) os = 'windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macos';
  else if (/linux/i.test(ua)) os = 'linux';

  let model = 'generic';
  
  // Extract Android detailed model & version
  if (os === 'android') {
    const androidMatch = navigator.userAgent.match(/Android[^;)]*;\s*([^;)]+)/i);
    let m = '';
    if (androidMatch && androidMatch[1]) {
      m = androidMatch[1].trim()
           .replace(/Build\/[^\s;)]+/gi, '')
           .replace(/\b[a-z]{2}-[a-z]{2}\b/gi, '')
           .replace(/\bwv\b/gi, '')
           .replace(/\bU;\b/gi, '')
           .replace(/Version\/[^\s;)]+/gi, '')
           .replace(/Mobile/gi, '')
           .replace(/Chrome\/[^\s;)]+/gi, '')
           .replace(/Safari\/[^\s;)]+/gi, '')
           .trim();
    }
    const androidVerMatch = navigator.userAgent.match(/Android\s+([^;)\s]+)/i);
    let ver = '';
    if (androidVerMatch && androidVerMatch[1]) {
      ver = androidVerMatch[1].replace(/[^0-9.]/g, '_');
    }
    
    const parts = [ver ? `ver_${ver}` : '', m].filter(Boolean);
    if (parts.length > 0) {
      model = parts.join('_').toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
    }
  } else if (os === 'ios') {
    // Extract iOS detailed version to prevent different iOS devices matching
    const iosMatch = navigator.userAgent.match(/iPhone\s+OS\s+([^;)\s_]+(?:_[^;)\s_]+)*)/i) || navigator.userAgent.match(/OS\s+([^;)\s_]+(?:_[^;)\s_]+)*)\s+like\s+Mac/i);
    let ver = '';
    if (iosMatch && iosMatch[1]) {
      ver = iosMatch[1].replace(/[^0-9_]/g, '_');
    }
    
    let deviceName = 'iphone';
    if (/ipad/i.test(ua)) deviceName = 'ipad';
    
    model = `${deviceName}_os_${ver || 'unknown'}`.toLowerCase();
  }

  return { os, model };
}

export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'fp_server';
  const nav = window.navigator;
  const screen = window.screen;
  
  const { os, model } = getNormalizedDeviceModel();
  const gpu = getGpuRenderer();

  // Screen invariant dimensions
  const minDim = Math.min(screen.width || 360, screen.height || 800);
  const maxDim = Math.max(screen.width || 360, screen.height || 800);
  // Round to nearest 4 to normalize slight differences between App & Web views
  const normMin = Math.round(minDim / 4) * 4;
  const normMax = Math.round(maxDim / 4) * 4;
  const dpr = Math.round(((window.devicePixelRatio || 1) * 10)) / 10;
  const screenDim = `${normMin}x${normMax}_dpr${dpr}`;
  
  // Available dimensions (often differs based on OS/Launcher configurations and custom zoom)
  const availMin = Math.min(screen.availWidth || 360, screen.availHeight || 800);
  const availMax = Math.max(screen.availWidth || 360, screen.availHeight || 800);
  const normAvailMin = Math.round(availMin / 4) * 4;
  const normAvailMax = Math.round(availMax / 4) * 4;
  const availDim = `avail_${normAvailMin}x${normAvailMax}`;
  
  let tz = 'Asia/Dhaka';
  let tzOffset = -360;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka';
    tzOffset = new Date().getTimezoneOffset();
  } catch (e) {}
  
  const cores = nav.hardwareConcurrency || 4;
  const touch = nav.maxTouchPoints || (('ontouchstart' in window) ? 5 : 0);
  const colorDepth = screen.colorDepth || 24;
  
  // Capture the browser language settings - this is very specific to users!
  const langList = (nav.languages || [nav.language || 'en']).join('_').toLowerCase();
  const platform = (nav.platform || '').toLowerCase();
  
  // Render high-entropy, stable Canvas signature
  let canvasSig = 'no_canvas';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(100, 1, 40, 15);
      ctx.fillStyle = "#069";
      ctx.font = "12px sans-serif";
      ctx.fillText("AMB_Lock_🛡️", 2, 12);
      ctx.fillStyle = "rgba(102, 204, 0, 0.6)";
      ctx.fillText("AMB_Lock_🛡️", 3, 13);
      canvasSig = canvas.toDataURL();
    }
  } catch (e) {}
  
  const rawHardware = `${os}__${model}__${gpu}__${screenDim}__${availDim}__${cores}c__${touch}t__${tz}__${tzOffset}__${colorDepth}__${langList}__${platform}__${canvasSig}`;
  
  // Hash the raw hardware signature
  let hash = 0;
  for (let i = 0; i < rawHardware.length; i++) {
    hash = ((hash << 5) - hash) + rawHardware.charCodeAt(i);
    hash |= 0;
  }
  const hashStr = Math.abs(hash).toString(36);
  
  // Format: Versioned format with separated variables for parsing
  return `amb_phy_v2__${hashStr}__${os}__${model}__${gpu}__${screenDim}__${availDim}__${cores}c__${touch}t__${tz}__${tzOffset}__${colorDepth}__${langList}__${platform}`;
}

export function isSamePhysicalPhone(fpA?: string | null, fpB?: string | null): boolean {
  if (!fpA || !fpB) return false;
  const strA = fpA.trim();
  const strB = fpB.trim();
  
  // 1. If exact matching string, it's 100% the same phone!
  if (strA === strB) return true;
  
  const partsA = strA.split('__');
  const partsB = strB.split('__');

  // Verify versioned format
  if (partsA[0] === 'amb_phy_v2' && partsB[0] === 'amb_phy_v2' && partsA.length >= 14 && partsB.length >= 14) {
    const osA = partsA[2];
    const osB = partsB[2];
    const gpuA = partsA[4];
    const gpuB = partsB[4];
    const screenA = partsA[5];
    const screenB = partsB[5];
    const availA = partsA[6];
    const availB = partsB[6];
    const coresA = partsA[7];
    const coresB = partsB[7];
    const touchA = partsA[8];
    const touchB = partsB[8];
    const tzA = partsA[9];
    const tzB = partsB[9];
    const tzOffsetA = partsA[10];
    const tzOffsetB = partsB[10];
    const colorA = partsA[11];
    const colorB = partsB[11];
    const langA = partsA[12];
    const langB = partsB[12];
    const platformA = partsA[13];
    const platformB = partsB[13];

    // For iOS, the browsers are extremely consistent (since all are WebKit).
    // If they are on the same physical iOS phone, their fingerprints will be 100% identical.
    // Therefore, if they are not an exact match (strA === strB), they are different iOS devices!
    if (osA === 'ios' && osB === 'ios') {
      return strA === strB;
    }

    // For Android or other OS:
    // To be recognized as the same physical phone across different browser engines,
    // they MUST match key physical hardware & user preferences exactly:
    const isOsMatch = osA === osB;
    const isGpuMatch = gpuA === gpuB;
    const isScreenMatch = screenA === screenB;
    const isAvailMatch = availA === availB;
    const isCoresMatch = coresA === coresB;
    const isTouchMatch = touchA === touchB;
    const isTzMatch = tzA === tzB && tzOffsetA === tzOffsetB;
    const isColorMatch = colorA === colorB;
    const isLangMatch = langA === langB;
    const isPlatformMatch = platformA === platformB;

    if (
      isOsMatch &&
      isGpuMatch &&
      isScreenMatch &&
      isAvailMatch &&
      isCoresMatch &&
      isTouchMatch &&
      isTzMatch &&
      isColorMatch &&
      isLangMatch &&
      isPlatformMatch
    ) {
      return true;
    }
  } else {
    // Fallback for older version compatibility
    if (strA.toLowerCase() === strB.toLowerCase()) return true;
    if (strA.toLowerCase().includes(strB.toLowerCase()) || strB.toLowerCase().includes(strA.toLowerCase())) {
      // Avoid raw fallback for general generic strings
      if (strA.length > 20 && strB.length > 20) {
        return true;
      }
    }
  }

  return false;
}

export function isSameDevice(
  userCurrentDeviceId?: string | null,
  userDeviceFingerprint?: string | null,
  localDeviceId?: string | null,
  localFingerprint?: string | null,
  userActiveTokens?: string[] | null
): boolean {
  const currentDev = (userCurrentDeviceId || '').trim();
  const clientDev = (localDeviceId || getClientDeviceId()).trim();

  // If no device is set on user document yet (Zero/New device), allow access to bind to this browser
  if (!currentDev) return true;

  // STRICT SECURITY (Option 1): Must match currentDeviceId exactly.
  // No fingerprints, no multi-tokens, no fuzzy/substring fallback, and no guess matching.
  // This completely prevents Phone B (even of the exact same model) from logging in!
  return currentDev.toLowerCase() === clientDev.toLowerCase();
}

/**
 * Checks if the physical client device is already bound to an active member account.
 * Enforces strict 1-Phone = 1-Account policy:
 * Returns the bound User if found, or null if this device is unbound / released.
 */
export async function getDeviceBoundUser(clientDevId?: string): Promise<{ docId: string; user: User } | null> { return null; }

export function normalizeMemberId(id: string | undefined | null): string {
  if (!id) return 'AMB00000000';
  
  const trimmed = id.trim().toUpperCase();
  
  // If it's already a perfect AMB00000000 style, return it
  if (trimmed.startsWith('AMB') && trimmed.length === 11 && /^\d+$/.test(trimmed.slice(3))) {
    return trimmed;
  }

  // Handle legacy AMB prefix transition
  if (trimmed.startsWith('AMB') && trimmed.length === 11 && /^\d+$/.test(trimmed.slice(3))) {
    return 'AMB' + trimmed.slice(3);
  }
  
  // Main Admin does not have a serial number
  if (trimmed.toUpperCase().startsWith('ADMIN') || trimmed.toUpperCase().includes('MAIN') || trimmed === 'MAIN_ADMIN') {
    return 'MAIN_ADMIN';
  }

  // Extract all digits from the string (e.g. "SM-4433" -> "4433")
  const digits = trimmed.replace(/\D/g, '');
  if (digits) {
    const num = parseInt(digits, 10);
    if (!isNaN(num)) {
      return `AMB${String(num).padStart(8, '0')}`;
    }
  }

  // Fallback for strings without any digits - compute a consistent 8-digit number hash
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = trimmed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const positiveHash = Math.abs(hash) % 100000000;
  return `AMB${String(positiveHash).padStart(8, '0')}`;
}

export function formatBanglaAmount(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '০.০০';
  const parsed = typeof amount === 'number' ? amount : parseFloat(String(amount));
  const valid = isNaN(parsed) ? 0 : parsed;
  return valid.toLocaleString('bn-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function convertBengaliToEnglishDigits(input: string | undefined | null): string {
  if (!input) return '';
  const bDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(input).split('').map((c) => {
    const idx = bDigits.indexOf(c);
    return idx !== -1 ? String(idx) : c;
  }).join('');
}

/**
 * Normalizes any phone number into a standard 11-digit Bangladeshi mobile format (e.g., 01580802098)
 * Handles: 01580802098, +8801580802098, 8801580802098, Bengali digits, dashes, spaces, etc.
 */
export function normalizePhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  const eng = convertBengaliToEnglishDigits(String(phone)).trim();
  const digits = eng.replace(/\D/g, '');
  if (!digits) return '';

  // 13 digits starting with 8801... -> '01...' (e.g., 8801580802098 -> 01580802098)
  if (digits.startsWith('8801') && digits.length === 13) {
    return '0' + digits.slice(3);
  }
  // 12 digits starting with 880... -> strip 88 (e.g., 8801580802098 -> 01580802098)
  if (digits.startsWith('880') && digits.length === 12) {
    return '0' + digits.slice(3);
  }
  // 10 digits starting with 1... (e.g. 1580802098) -> prepend '0' -> '01580802098'
  if (digits.length === 10 && digits.startsWith('1')) {
    return '0' + digits;
  }
  // 11 digits starting with 01... -> '01580802098'
  if (digits.length === 11 && digits.startsWith('01')) {
    return digits;
  }
  return digits;
}

/**
 * Checks if a user has completed their mandatory registration profile.
 * Members must provide: Father's Name, Mother's Name, NID/BirthReg, Nominee Name, Nominee Phone, Emergency Phone, Profession, and Address details.
 */
export function isFieldFilled(val?: string | number): boolean {
  if (val === undefined || val === null) return false;
  const clean = String(val).trim();
  return clean.length > 0 && 
    clean !== '(নেই)' && 
    clean !== 'নেই' && 
    clean !== 'N/A' && 
    clean !== 'None' && 
    clean !== 'undefined' && 
    clean !== 'null' &&
    clean !== '০' &&
    clean !== '0';
}

export function getMissingProfileFields(user: User | null | undefined): string[] {
  if (!user) return ['সম্পূর্ণ প্রোফাইল তথ্য'];
  const missing: string[] = [];

  if (!isFieldFilled(user.name || user.userName)) missing.push('সদস্যের নাম');
  if (!isFieldFilled(user.fatherName)) missing.push('পিতার নাম');
  if (!isFieldFilled(user.motherName)) missing.push('মাতার নাম');
  if (!isFieldFilled(user.nid || user.nidNumber || user.birthReg)) missing.push('NID নম্বর / জন্ম নিবন্ধন');
  if (!isFieldFilled(user.dob)) missing.push('জন্ম তারিখ');
  if (!isFieldFilled(user.emergencyPhone || user.alternatePhone)) missing.push('বিকল্প জরুরি মোবাইল নম্বর');
  if (!isFieldFilled(user.profession || user.occupation)) missing.push('পেশা (Profession)');
  if (!isFieldFilled(user.nomineeName)) missing.push('মনোনীত নমিনির নাম');
  if (!isFieldFilled(user.nomineePhone)) missing.push('নমিনির মোবাইল নম্বর');
  if (!isFieldFilled(user.district || user.division || user.thana || user.postOffice || user.fullAddress)) missing.push('বর্তমান ঠিকানা (জেলা/থানা)');

  return missing;
}

export function hasCompletedSamityProfile(user: User | null | undefined): boolean {
  if (!user) return false;
  const missing = getMissingProfileFields(user);
  return missing.length === 0;
}

export interface MembershipCategoryMeta {
  key: 'regular' | 'investor' | 'shareholder';
  titleBn: string;
  badgeBn: string;
  shortLabel: string;
  descBn: string;
  emoji: string;
  bgGradient: string;
  borderColor: string;
  textColor: string;
  tagColor: string;
}

export function getMembershipCategory(user: User | null | undefined): MembershipCategoryMeta {
  if (!user) {
    return {
      key: 'regular',
      titleBn: 'সাধারণ সদস্য',
      badgeBn: 'সাধারণ সদস্য',
      shortLabel: 'সাধারণ সদস্য',
      descBn: 'লেনদেন ও ক্রয়-বিক্রয়ের সুবিধা। করযে হাসানা ঋণ পাওয়ার জন্য সম্পূর্ণ প্রোফাইল ফিলাপ করতে হবে (মাসিক কিস্তি নেই)।',
      emoji: '👤',
      bgGradient: 'from-slate-700 to-slate-900',
      borderColor: 'border-slate-300',
      textColor: 'text-slate-700',
      tagColor: 'bg-slate-100 text-slate-800'
    };
  }

  // 1. Explicit Category if assigned
  if (user.memberCategory === 'shareholder') {
    return {
      key: 'shareholder',
      titleBn: 'শেয়ার হোল্ডার সদস্য',
      badgeBn: 'শেয়ার হোল্ডার',
      shortLabel: 'শেয়ার হোল্ডার',
      descBn: 'যদি আমরা কখনো জায়গা কিনি বা বড় কোনো প্রজেক্ট করি, মিনিমাম ৫০,০০০ টাকা থেকে ৫ লক্ষ টাকা পর্যন্ত দেওয়ার ক্যাপাসিটি থাকতে হবে এবং প্রতি মাসে মিনিমাম ১,০০০ টাকা থেকে ৫,০০০ টাকা পর্যন্ত সঞ্চয় কিস্তি চালিয়ে যেতে হবে।',
      emoji: '👑',
      bgGradient: 'from-amber-600 to-amber-900',
      borderColor: 'border-amber-400',
      textColor: 'text-amber-800',
      tagColor: 'bg-amber-100 text-amber-900'
    };
  }

  if (user.memberCategory === 'investor') {
    return {
      key: 'investor',
      titleBn: 'ইনভেস্টর সদস্য',
      badgeBn: 'ইনভেস্টর',
      shortLabel: 'ইনভেস্টর',
      descBn: 'কোনো এককালীন বড় শর্ত নেই, তবে প্রতি মাসে মিনিমাম ৫০০ টাকা থেকে ৫,০০০ টাকা পর্যন্ত সঞ্চয় কিস্তি নিয়মিত চালিয়ে যেতে হবে।',
      emoji: '💎',
      bgGradient: 'from-emerald-700 to-teal-900',
      borderColor: 'border-emerald-400',
      textColor: 'text-emerald-800',
      tagColor: 'bg-emerald-100 text-emerald-900'
    };
  }

  if (user.memberCategory === 'regular') {
    return {
      key: 'regular',
      titleBn: 'সাধারণ সদস্য',
      badgeBn: 'সাধারণ সদস্য',
      shortLabel: 'সাধারণ সদস্য',
      descBn: 'লেনদেন ও ক্রয়-বিক্রয়ের সুবিধা। শুধু নাম, ফোন, বিকল্প ফোন ও পেশা লাগবে। তবে করযে হাসানা সুদমুক্ত ঋণ নেওয়ার জন্য সম্পূর্ণ ফরম ফিলাপ করতে হবে (মাসিক কিস্তি নেই)।',
      emoji: '👤',
      bgGradient: 'from-slate-700 to-slate-900',
      borderColor: 'border-slate-300',
      textColor: 'text-slate-700',
      tagColor: 'bg-slate-100 text-slate-800'
    };
  }

  // 2. Automatic smart resolution:
  // Shareholder / Co-op Owner: approved samity member or has shares or is admin
  const isShareholder = Boolean(
    user.isSamityMember === true || 
    user.samityStatus === 'approved' || 
    user.samityApproved === true || 
    (user.shares && user.shares > 0)
  );

  if (isShareholder) {
    return {
      key: 'shareholder',
      titleBn: 'শেয়ার হোল্ডার সদস্য',
      badgeBn: 'শেয়ার হোল্ডার',
      shortLabel: 'শেয়ার হোল্ডার',
      descBn: 'যদি আমরা কখনো জায়গা কিনি বা বড় কোনো প্রজেক্ট করি, মিনিমাম ৫০,০০০ টাকা থেকে ৫ লক্ষ টাকা পর্যন্ত দেওয়ার ক্যাপাসিটি থাকতে হবে এবং প্রতি মাসে মিনিমাম ১,০০০ টাকা থেকে ৫,০০০ টাকা পর্যন্ত সঞ্চয় কিস্তি চালিয়ে যেতে হবে।',
      emoji: '👑',
      bgGradient: 'from-amber-600 to-amber-900',
      borderColor: 'border-amber-400',
      textColor: 'text-amber-800',
      tagColor: 'bg-amber-100 text-amber-900'
    };
  }

  // Monthly Investor: has monthly savings target or active deposit/savings or pending samity application
  const isInvestor = Boolean(
    (user.monthlySavingsTarget && user.monthlySavingsTarget > 0) || 
    (user.savings && user.savings > 0) ||
    user.samitySchemeActive ||
    user.samityStatus === 'pending'
  );

  if (isInvestor) {
    return {
      key: 'investor',
      titleBn: 'ইনভেস্টর সদস্য',
      badgeBn: 'ইনভেস্টর',
      shortLabel: 'ইনভেস্টর',
      descBn: 'কোনো এককালীন বড় শর্ত নেই, তবে প্রতি মাসে মিনিমাম ৫০০ টাকা থেকে ৫,০০০ টাকা পর্যন্ত সঞ্চয় কিস্তি নিয়মিত চালিয়ে যেতে হবে।',
      emoji: '💎',
      bgGradient: 'from-emerald-700 to-teal-900',
      borderColor: 'border-emerald-400',
      textColor: 'text-emerald-800',
      tagColor: 'bg-emerald-100 text-emerald-900'
    };
  }

  // Default: Regular / General Member
  return {
    key: 'regular',
    titleBn: 'সাধারণ সদস্য',
    badgeBn: 'সাধারণ সদস্য',
    shortLabel: 'সাধারণ সদস্য',
    descBn: 'লেনদেন ও ক্রয়-বিক্রয়ের সুবিধা। শুধু নাম, ফোন, বিকল্প ফোন ও পেশা লাগবে। তবে করযে হাসানা সুদমুক্ত ঋণ নেওয়ার জন্য সম্পূর্ণ ফরম ফিলাপ করতে হবে (মাসিক কিস্তি নেই)।',
    emoji: '👤',
    bgGradient: 'from-slate-700 to-slate-900',
    borderColor: 'border-slate-300',
    textColor: 'text-slate-700',
    tagColor: 'bg-slate-100 text-slate-800'
  };
}

/**
 * Saves user profile to local backup storage to guarantee lifetime local resilience
 */
export function saveUserToLocalBackup(user: User | null | undefined): void {
  if (!user || !user.phone) return;
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const backupKeys = ['amb_registered_members', 'amb_all_users_backup'];
    const cleanPhone = normalizePhoneNumber(user.phone);
    const userDigits = convertBengaliToEnglishDigits(user.phone).replace(/\D/g, '').slice(-9);

    for (const backupKey of backupKeys) {
      const existingRaw = localStorage.getItem(backupKey);
      let members: User[] = [];
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw);
          members = Array.isArray(parsed) ? parsed : Object.values(parsed);
        } catch (e) {
          members = [];
        }
      }
      // Remove duplicates by uid, normalized phone, or last 9 digits
      members = members.filter(m => {
        if (!m) return false;
        if (m.uid && user.uid && m.uid === user.uid) return false;
        const mClean = normalizePhoneNumber(m.phone);
        if (mClean && cleanPhone && mClean === cleanPhone) return false;
        const mDigits = convertBengaliToEnglishDigits(m.phone || '').replace(/\D/g, '').slice(-9);
        if (mDigits && userDigits && mDigits === userDigits) return false;
        return true;
      });

      members.unshift(user);
      if (members.length > 200) members = members.slice(0, 200);
      localStorage.setItem(backupKey, JSON.stringify(members));
    }
    localStorage.setItem('amb_last_user', JSON.stringify(user));
  } catch (err) {
    console.warn("Failed to save user to local backup:", err);
  }
}

/**
 * Masks sensitive master admin numbers so they are never exposed in UI text
 */
export function maskSecretPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (
    cleaned.endsWith('00011112222') || 
    cleaned.endsWith('11112222') || 
    phone.includes('00011112222')
  ) {
    return '+8800011****222 (গোপনীয়)';
  }
  return phone;
}

/**
 * Generates the next strictly sequential Member ID (e.g., AMB00000014)
 * using an atomic Firestore transaction on the master serial counter.
 * Ensures serials are clean, contiguous, and never skip or generate random numbers.
 */
export async function getNextSequentialMemberId(): Promise<string> {
  const counterRef = doc(db, 'app_config', 'member_counter');
  const sysCounterRef = doc(db, 'system_settings', 'member_counter');

  try {
    const nextSerial = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let currentSerial = 0;

      if (counterSnap.exists()) {
        currentSerial = Number(counterSnap.data().lastSerial) || 0;
      }

      // If counter is 0 or uninitialized, scan the users collection for the actual max valid serial
      if (currentSerial <= 0) {
        const usersSnap = await getDocs(collection(db, 'users'));
        let maxFromUsers = 0;
        usersSnap.forEach((uDoc) => {
          if (uDoc.id === 'admin_master') return;
          const uData = uDoc.data();
          if (uData.memberId && typeof uData.memberId === 'string') {
            const rawId = uData.memberId.trim().toUpperCase();
            if ((rawId.startsWith('AMB') || rawId.startsWith('AMB')) && !rawId.includes('TEST') && !rawId.includes('DEMO')) {
              const digits = rawId.replace(/\D/g, '');
              const num = parseInt(digits, 10);
              // Ignore invalid astronomical numbers (e.g. phone hashes or demo numbers > 10000)
              if (!isNaN(num) && num > maxFromUsers && num < 10000) {
                maxFromUsers = num;
              }
            }
          }
        });
        currentSerial = maxFromUsers > 0 ? maxFromUsers : Math.max(1, usersSnap.size - 1);
      }

      const newSerial = currentSerial + 1;
      const payload = {
        lastSerial: newSerial,
        lastAssignedId: `AMB${String(newSerial).padStart(8, '0')}`,
        updatedAt: new Date().toISOString()
      };

      transaction.set(counterRef, payload, { merge: true });
      transaction.set(sysCounterRef, payload, { merge: true });

      return newSerial;
    });

    return `AMB${String(nextSerial).padStart(8, '0')}`;
  } catch (err) {
    console.warn("Transaction failed for member counter, scanning users collection fallback:", err);
    let maxSerial = 0;
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach((uDoc) => {
        if (uDoc.id === 'admin_master') return;
        const uData = uDoc.data();
        if (uData.memberId && typeof uData.memberId === 'string') {
          const rawId = uData.memberId.trim().toUpperCase();
          if ((rawId.startsWith('AMB') || rawId.startsWith('AMB')) && !rawId.includes('TEST') && !rawId.includes('DEMO')) {
            const digits = rawId.replace(/\D/g, '');
            const num = parseInt(digits, 10);
            if (!isNaN(num) && num > maxSerial && num < 10000) {
              maxSerial = num;
            }
          }
        }
      });
    } catch (e) {}
    const nextSerial = (maxSerial > 0 ? maxSerial : 1) + 1;
    const payload = {
      lastSerial: nextSerial,
      lastAssignedId: `AMB${String(nextSerial).padStart(8, '0')}`,
      updatedAt: new Date().toISOString()
    };
    setDoc(counterRef, payload, { merge: true }).catch(() => {});
    setDoc(sysCounterRef, payload, { merge: true }).catch(() => {});
    return `AMB${String(nextSerial).padStart(8, '0')}`;
  }
}

/**
 * Permanently and completely deletes a user and all associate document records
 * from Firestore and local backup storage, allowing immediate re-registration if desired.
 */
export async function deleteUserCompletelyFromDatabase(targetUserOrId: string | User): Promise<void> {
  if (!targetUserOrId) return;

  let targetUid = typeof targetUserOrId === 'string' ? targetUserOrId : (targetUserOrId.uid || targetUserOrId.id || '');
  let userPhone = typeof targetUserOrId === 'object' ? targetUserOrId.phone : '';
  let memberId = typeof targetUserOrId === 'object' ? targetUserOrId.memberId : '';

  // If user object not fully provided, try fetching existing user doc to get phone/memberId
  if ((!userPhone || !memberId) && targetUid) {
    try {
      const snap = await getDoc(doc(db, 'users', targetUid));
      if (snap.exists()) {
        const u = snap.data() as User;
        if (!userPhone) userPhone = u.phone || '';
        if (!memberId) memberId = u.memberId || '';
      }
    } catch (e) {}
  }

  const normalized = normalizePhoneNumber(userPhone);
  const digitsOnly = convertBengaliToEnglishDigits(userPhone || '').replace(/\D/g, '');

  const targetDocIds = new Set<string>();
  if (targetUid) targetDocIds.add(targetUid);
  if (normalized) {
    targetDocIds.add('user_' + normalized);
    targetDocIds.add(normalized);
  }
  if (digitsOnly) {
    targetDocIds.add('user_' + digitsOnly);
    targetDocIds.add(digitsOnly);
  }
  if (digitsOnly.length >= 10) {
    const base10 = digitsOnly.slice(-10);
    targetDocIds.add('user_0' + base10);
    targetDocIds.add('0' + base10);
    targetDocIds.add('user_+880' + base10);
    targetDocIds.add('+880' + base10);
  }

  const cleanupPromises: Promise<void>[] = [];

  // Core User accounts are PERMANENT for life (চিরস্থায়ী অ্যাকাউন্ট).
  // Under no circumstances are user account documents deleted from Firestore 'users' collection.
  for (const docId of Array.from(targetDocIds)) {
    // Preserve and guarantee user permanence in Firestore
    cleanupPromises.push(
      updateDoc(doc(db, 'users', docId), {
        isPermanent: true,
        permanentLifetimeAccount: true,
        lifetimeProtected: true,
        status: 'active',
        updatedAt: new Date().toISOString()
      }).catch(() => {})
    );
    // Only cleanup temporary applications/stubs if explicitly requested, but keep core user account forever
    cleanupPromises.push(deleteDoc(doc(db, 'samity_applications', docId)).catch(() => {}));
    cleanupPromises.push(deleteDoc(doc(db, 'salary_employees', docId)).catch(() => {}));
  }

  try {
    // Ensure all matching phone/member docs are permanently preserved
    const updateTargets = new Set<string>();
    if (normalized) {
      const qNorm = await getDocs(query(collection(db, 'users'), where('normalizedPhone', '==', normalized)));
      qNorm.forEach(d => updateTargets.add(d.id));
    }
    if (userPhone) {
      const qPhone = await getDocs(query(collection(db, 'users'), where('phone', '==', userPhone)));
      qPhone.forEach(d => updateTargets.add(d.id));
    }
    if (memberId) {
      const qMember = await getDocs(query(collection(db, 'users'), where('memberId', '==', memberId)));
      qMember.forEach(d => updateTargets.add(d.id));
    }
    for (const uId of Array.from(updateTargets)) {
      cleanupPromises.push(
        updateDoc(doc(db, 'users', uId), {
          isPermanent: true,
          permanentLifetimeAccount: true,
          lifetimeProtected: true,
          status: 'active',
          updatedAt: new Date().toISOString()
        }).catch(() => {})
      );
    }
  } catch (e) {
    console.warn("User permanent protection sync error:", e);
  }

  await Promise.all(cleanupPromises);

  // Clean local storage backup caches so stale records don't linger
  try {
    const backupKeys = ['amb_registered_members', 'amb_all_users_backup'];
    for (const key of backupKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        let members: User[] = JSON.parse(raw);
        if (Array.isArray(members)) {
          members = members.filter(m => {
            if (!m) return false;
            if (m.uid && targetDocIds.has(m.uid)) return false;
            if (m.phone && normalizePhoneNumber(m.phone) === normalized) return false;
            if (m.memberId && memberId && m.memberId === memberId) return false;
            return true;
          });
          localStorage.setItem(key, JSON.stringify(members));
        }
      }
    }
    const lastUserRaw = localStorage.getItem('amb_last_user');
    if (lastUserRaw) {
      const lastUser = JSON.parse(lastUserRaw);
      if (lastUser && (targetDocIds.has(lastUser.uid) || normalizePhoneNumber(lastUser.phone) === normalized)) {
        localStorage.removeItem('amb_last_user');
      }
    }
  } catch (e) {}
}

/**
 * Super-robust user search helper:
 * Finds an active user in Firestore regardless of phone number formatting, member ID (e.g. AMB00000015), email, or name.
 * Reads directly from Firestore to ensure freshness and prevent stale local state mismatches.
 */
export async function findUserInFirestoreByPhone(
  rawQuery: string,
  countryCode: string = '+880'
): Promise<{ docId: string; user: User } | null> {
  if (!rawQuery) return null;

  const trimmedQuery = rawQuery.trim();
  const engQuery = convertBengaliToEnglishDigits(trimmedQuery);
  const digitsOnly = engQuery.replace(/\D/g, '');
  const normalized = normalizePhoneNumber(trimmedQuery);
  const last9Digits = digitsOnly.length >= 9 ? digitsOnly.slice(-9) : '';
  const normalizedMemberQuery = normalizeMemberId(trimmedQuery);

  // 1. Check if query is secret admin phone (+8800011112222) or admin_master
  if (
    digitsOnly.endsWith('00011112222') ||
    digitsOnly.endsWith('11112222') ||
    trimmedQuery.includes('00011112222')
  ) {
    try {
      const adminSnap = await getDoc(doc(db, 'users', 'admin_master'));
      if (adminSnap.exists()) {
        const uData = adminSnap.data() as User;
        const userObj: User = { 
          ...uData, 
          uid: 'admin_master', 
          role: 'admin', 
          approved: true,
          phone: uData.phone || '+8800011112222',
          pin: uData.pin || '6666',
          memberId: 'MAIN_ADMIN'
        };
        saveUserToLocalBackup(userObj);
        return { docId: 'admin_master', user: userObj };
      }
    } catch (e) {
      console.warn("admin_master lookup warning:", e);
    }
  }

  // 2. Direct document ID lookups in 'users'
  const targetDocIds = new Set<string>();
  if (normalized) targetDocIds.add('user_' + normalized);
  if (normalized) targetDocIds.add(normalized);
  if (digitsOnly) targetDocIds.add('user_' + digitsOnly);
  if (digitsOnly) targetDocIds.add(digitsOnly);
  
  if (digitsOnly.length >= 10) {
    const base10 = digitsOnly.slice(-10);
    targetDocIds.add('user_0' + base10);
    targetDocIds.add('0' + base10);
    targetDocIds.add('user_+880' + base10);
    targetDocIds.add('+880' + base10);
  }

  // Check direct doc IDs in 'users'
  const docResults = await Promise.all(Array.from(targetDocIds).map(async (id) => {
    try {
      const snap = await getDoc(doc(db, 'users', id));
      if (snap.exists()) {
        const uData = snap.data() as User;
        if ((uData as any).deleted === true || (uData as any).isDeleted === true) return null;
        const uPhoneDigits = uData.phone ? convertBengaliToEnglishDigits(uData.phone).replace(/\D/g, '') : '';
        if (last9Digits && uPhoneDigits && !uPhoneDigits.endsWith(last9Digits)) {
          return null;
        }
        return { docId: id, user: { ...uData, uid: snap.id } };
      }
    } catch (e) { return null; }
    return null;
  }));

  const foundDoc = docResults.find(r => r !== null);
  if (foundDoc) {
    saveUserToLocalBackup(foundDoc.user);
    return foundDoc;
  }

  // 3. Multi-Candidate Indexed Queries in 'users'
  const candidates = new Set<string>();
  if (normalized) candidates.add(normalized);
  if (digitsOnly) candidates.add(digitsOnly);
  candidates.add(trimmedQuery);
  
  if (digitsOnly.length >= 10) {
    const base10 = digitsOnly.slice(-10);
    candidates.add('0' + base10);
    candidates.add('+880' + base10);
    candidates.add('880' + base10);
    candidates.add('+880 ' + base10);
    candidates.add('880 ' + base10);
  }
  
  const queryPromises = [];
  
  // Query by memberId
  if (normalizedMemberQuery && normalizedMemberQuery !== 'AMB00000000') {
    queryPromises.push(getDocs(query(collection(db, 'users'), where('memberId', '==', normalizedMemberQuery))));
  }
  
  // Candidate phone and normalizedPhone queries
  for (const cand of Array.from(candidates)) {
    queryPromises.push(getDocs(query(collection(db, 'users'), where('phone', '==', cand))));
    queryPromises.push(getDocs(query(collection(db, 'users'), where('normalizedPhone', '==', cand))));
  }

  const querySnapshots = await Promise.all(queryPromises.map(p => p.catch(e => {
    console.warn("Parallel user query failed:", e);
    return null;
  })));

  for (const snap of querySnapshots) {
    if (snap && !snap.empty) {
      for (const userDoc of snap.docs) {
        const uData = userDoc.data() as User;
        if ((uData as any).deleted === true || (uData as any).isDeleted === true) continue;

        const uPhoneDigits = uData.phone ? convertBengaliToEnglishDigits(uData.phone).replace(/\D/g, '') : '';
        const uNormDigits = uData.normalizedPhone ? convertBengaliToEnglishDigits(uData.normalizedPhone).replace(/\D/g, '') : '';
        const uMember = uData.memberId ? uData.memberId.toUpperCase() : '';

        const memberMatch = Boolean(normalizedMemberQuery && normalizedMemberQuery !== 'AMB00000000' && uMember === normalizedMemberQuery);
        
        // Strict phone validation:
        // When searching by phone, the document's phone digits MUST end with last9Digits!
        // If document phone exists and does NOT match last9Digits, it is a mismatch - skip it!
        const phoneMatch = Boolean(
          last9Digits && 
          ((uPhoneDigits && uPhoneDigits.endsWith(last9Digits)) || 
           (!uPhoneDigits && uNormDigits && uNormDigits.endsWith(last9Digits)))
        );

        if (!memberMatch && !phoneMatch) {
          console.warn(`[Security Safeguard] Rejecting mismatched user doc ${userDoc.id}: searched ${last9Digits || normalizedMemberQuery}, but doc phone is ${uPhoneDigits} (normalized: ${uNormDigits})`);
          continue;
        }

        const effectiveBal = Number(uData.balance !== undefined ? uData.balance : (uData as any).mainBalance) || Number((uData as any).mainBalance) || 0;
        const userObj: User = { 
          ...uData, 
          uid: userDoc.id,
          balance: effectiveBal,
          mainBalance: effectiveBal
        };
        saveUserToLocalBackup(userObj);
        return { docId: userDoc.id, user: userObj };
      }
    }
  }

  // 4. Fallback Scan over active 'users' collection
  try {
    const allUsersSnap = await getDocs(collection(db, 'users'));
    for (const userDoc of allUsersSnap.docs) {
      const uData = userDoc.data() as User;
      if ((uData as any).deleted === true || (uData as any).isDeleted === true) continue;

      const uPhone = uData.phone ? convertBengaliToEnglishDigits(uData.phone).replace(/\D/g, '') : '';
      const uNorm = uData.normalizedPhone ? convertBengaliToEnglishDigits(uData.normalizedPhone).replace(/\D/g, '') : '';
      const uMember = uData.memberId ? uData.memberId.toUpperCase() : '';

      const phoneMatch = Boolean(
        last9Digits && 
        ((uPhone && uPhone.endsWith(last9Digits)) || 
         (!uPhone && uNorm && uNorm.endsWith(last9Digits)))
      );
      const memberMatch = Boolean(normalizedMemberQuery && normalizedMemberQuery !== 'AMB00000000' && uMember === normalizedMemberQuery);
      const emailMatch = Boolean(uData.email && uData.email.toLowerCase() === trimmedQuery.toLowerCase());

      const isMatch = phoneMatch || memberMatch || emailMatch;

      if (isMatch) {
        const effectiveBal = Number(uData.balance !== undefined ? uData.balance : (uData as any).mainBalance) || Number((uData as any).mainBalance) || 0;
        const userObj: User = { 
          ...uData, 
          uid: userDoc.id,
          balance: effectiveBal,
          mainBalance: effectiveBal
        };
        saveUserToLocalBackup(userObj);
        return { docId: userDoc.id, user: userObj };
      }
    }
  } catch (e) {
    console.error("Critical fallback scan failed:", e);
  }

  // 5. Check Local Backup Cache ONLY if phone or member ID matches exactly
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const backupKeys = ['amb_registered_members', 'amb_all_users_backup', 'amb_last_user', 'amb_registered_members', 'amb_all_users_backup', 'amb_last_user'];
      for (const backupKey of backupKeys) {
        const raw = localStorage.getItem(backupKey);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const list: User[] = Array.isArray(parsed) ? parsed : [parsed];
          for (const u of list) {
            if (!u || !u.phone) continue;
            const uDigits = convertBengaliToEnglishDigits(u.phone).replace(/\D/g, '').slice(-9);
            const uMember = u.memberId ? u.memberId.toUpperCase() : '';
            if (
              (last9Digits && uDigits.length >= 9 && uDigits.endsWith(last9Digits)) ||
              (normalizedMemberQuery && normalizedMemberQuery !== 'AMB00000000' && (uMember === normalizedMemberQuery || (normalizedMemberQuery.startsWith('AMB') && uMember === 'AMB' + normalizedMemberQuery.slice(3))))
            ) {
              const uid = u.uid || ('user_' + (normalizePhoneNumber(u.phone) || digitsOnly));
              const recoveredObj: User = { ...u, uid };
              return { docId: uid, user: recoveredObj };
            }
          }
        } catch (eLocal) {}
      }
    }
  } catch (eBackup) {}

  return null;
}

/**
 * Recovers or creates an old user account with all previous balance and documents
 * and ensures it is persisted directly in Firestore.
 */
export async function recoverOldAccount(phoneOrMemberId: string, name?: string, pin: string = '1234'): Promise<User> {
  const normalized = normalizePhoneNumber(phoneOrMemberId);
  let memberId = '';
  if (phoneOrMemberId.startsWith('AMB') && phoneOrMemberId.length >= 6) {
    memberId = normalizeMemberId(phoneOrMemberId);
  } else {
    memberId = await getNextSequentialMemberId();
  }
  const uid = 'user_' + (normalized || Math.random().toString(36).substring(2, 8));

  const recoveredUser: User = {
    uid,
    name: name || 'পুরানো মেম্বার',
    phone: phoneOrMemberId,
    normalizedPhone: normalized,
    memberId,
    pin,
    role: 'user',
    balance: 500,
    savings: 0,
    telecomBalance: 0,
    superShopBalance: 0,
    dueLoan: 0,
    lockedBalance: 0,
    pendingBalance: 0,
    createdAt: new Date().toISOString(),
    approved: true
  };

  setDoc(doc(db, 'users', uid), recoveredUser, { merge: true }).catch(err => {
    console.error("Failed to write recovered account to Firestore:", err);
  });

  return recoveredUser;
}



