// Authentication & Lockout Security Management (3-Strike 1-Hour Lockout)

const LOCKOUT_DURATION_MS = 60 * 60 * 1000; // Exactly 1 hour = 3600 seconds
export const MAX_ATTEMPTS = 3;

export interface LockoutInfo {
  isLocked: boolean;
  remainingSeconds: number;
  pinAttempts: number;
  passwordAttempts: number;
  remainingAttempts?: number;
  failedAttempts?: number;
  lockedUntil?: number | null;
  reason?: 'pin' | 'password' | null;
}

export type LockoutState = LockoutInfo;

const normalizeKey = (key?: string): string => {
  if (!key) return 'global';
  const clean = key.replace(/\D/g, '');
  return clean.length >= 6 ? clean.slice(-10) : key.trim().toLowerCase();
};

export const getLockoutState = (identifier?: string): LockoutInfo => {
  const normKey = normalizeKey(identifier);
  const storageKey = `amb_lockout_${normKey}`;
  
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return {
        isLocked: false,
        remainingSeconds: 0,
        pinAttempts: 0,
        passwordAttempts: 0,
        lockedUntil: null,
        reason: null
      };
    }

    const data = JSON.parse(raw);
    const now = Date.now();
    const lockedUntil = Number(data.lockedUntil) || 0;

    if (lockedUntil > now) {
      const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
      return {
        isLocked: true,
        remainingSeconds,
        pinAttempts: data.pinAttempts || MAX_ATTEMPTS,
        passwordAttempts: data.passwordAttempts || MAX_ATTEMPTS,
        lockedUntil,
        reason: data.reason || 'pin'
      };
    } else {
      // Lockout expired, reset attempts
      if (lockedUntil > 0 && lockedUntil <= now) {
        localStorage.removeItem(storageKey);
      }
      return {
        isLocked: false,
        remainingSeconds: 0,
        pinAttempts: Number(data.pinAttempts) || 0,
        passwordAttempts: Number(data.passwordAttempts) || 0,
        lockedUntil: null,
        reason: null
      };
    }
  } catch (e) {
    return {
      isLocked: false,
      remainingSeconds: 0,
      pinAttempts: 0,
      passwordAttempts: 0,
      lockedUntil: null,
      reason: null
    };
  }
};

export const recordFailedAttempt = (
  identifier: string | undefined, 
  type: 'pin' | 'password'
): {
  isLocked: boolean;
  remainingSeconds: number;
  pinAttempts: number;
  passwordAttempts: number;
  remainingAttempts: number;
  reason?: 'pin' | 'password';
} => {
  const normKey = normalizeKey(identifier);
  const storageKey = `amb_lockout_${normKey}`;
  const currentState = getLockoutState(identifier);

  if (currentState.isLocked) {
    return {
      isLocked: true,
      remainingSeconds: currentState.remainingSeconds,
      pinAttempts: currentState.pinAttempts,
      passwordAttempts: currentState.passwordAttempts,
      remainingAttempts: 0,
      reason: currentState.reason || type
    };
  }

  let newPinAttempts = currentState.pinAttempts;
  let newPasswordAttempts = currentState.passwordAttempts;

  if (type === 'pin') {
    newPinAttempts += 1;
  } else {
    newPasswordAttempts += 1;
  }

  const currentTypeAttempts = type === 'pin' ? newPinAttempts : newPasswordAttempts;
  const isNowLocked = currentTypeAttempts >= MAX_ATTEMPTS;
  const lockedUntil = isNowLocked ? Date.now() + LOCKOUT_DURATION_MS : null;
  const remainingSeconds = isNowLocked ? 3600 : 0;
  const remainingAttempts = Math.max(0, MAX_ATTEMPTS - currentTypeAttempts);

  try {
    localStorage.setItem(storageKey, JSON.stringify({
      pinAttempts: newPinAttempts,
      passwordAttempts: newPasswordAttempts,
      lockedUntil,
      reason: isNowLocked ? type : null,
      updatedAt: Date.now()
    }));
  } catch (e) {}

  return {
    isLocked: isNowLocked,
    remainingSeconds,
    pinAttempts: newPinAttempts,
    passwordAttempts: newPasswordAttempts,
    remainingAttempts,
    reason: isNowLocked ? type : undefined
  };
};

export const resetLockout = (identifier?: string, type?: 'pin' | 'password' | 'all'): void => {
  const normKey = normalizeKey(identifier);
  const storageKey = `amb_lockout_${normKey}`;

  try {
    if (!type || type === 'all') {
      localStorage.removeItem(storageKey);
    } else {
      const currentState = getLockoutState(identifier);
      const updated = {
        ...currentState,
        pinAttempts: type === 'pin' ? 0 : currentState.pinAttempts,
        passwordAttempts: type === 'password' ? 0 : currentState.passwordAttempts,
        lockedUntil: null,
        reason: null
      };
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  } catch (e) {}
};

export const clearLockoutState = resetLockout;

const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export const toBengaliDigits = (num: number | string): string => {
  return String(num).split('').map(char => {
    const digit = parseInt(char, 10);
    return !isNaN(digit) && digit >= 0 && digit <= 9 ? bengaliDigits[digit] : char;
  }).join('');
};

export const formatRemainingTime = (totalSeconds: number): {
  formattedBengali: string;
  formattedEnglish: string;
  minutes: number;
  seconds: number;
} => {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;

  const minStr = String(minutes).padStart(2, '0');
  const secStr = String(seconds).padStart(2, '0');

  const minBn = toBengaliDigits(minStr);
  const secBn = toBengaliDigits(secStr);

  return {
    formattedBengali: `${minBn} মিনিট ${secBn} সেকেন্ড`,
    formattedEnglish: `${minStr}:${secStr}`,
    minutes,
    seconds
  };
};
