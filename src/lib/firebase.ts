import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, getFirestore, setLogLevel, doc, getDocFromServer } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const TARGET_DATABASE_ID = firebaseConfig.firestoreDatabaseId || "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959";

// Suppress normal gRPC/Listen stream cancel and internal RST_STREAM info messages
try {
  setLogLevel('silent');
} catch (e) {
  // Ignore
}

// Global browser suppression for benign internal Firestore gRPC stream resets
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event?.reason?.message || event?.reason || '');
    if (msg.includes('RST_STREAM') || msg.includes("GrpcConnection RPC 'Listen'") || msg.includes('Code: 13')) {
      event.preventDefault();
    }
  });
}

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
    localCache: memoryLocalCache()
  }, TARGET_DATABASE_ID);
} catch (e) {
  firestoreInstance = getFirestore(app, TARGET_DATABASE_ID);
}

export const db = firestoreInstance; /* CRITICAL: The app will break without this line */

// Validate Connection to Firestore on boot as mandated by Firebase Skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'system_settings', 'app_config'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration: client is offline.");
    }
  }
}
if (typeof window !== 'undefined') {
  testConnection();
}

export const auth = getAuth(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// Sign in anonymously to bootstrap Auth UID so security rules resolve correctly
let fallbackUid: string | null = null;
function getOrCreateFallbackUid() {
  if (!fallbackUid) {
    fallbackUid = localStorage.getItem('amb_fallback_uid');
    if (!fallbackUid) {
      fallbackUid = 'anon_user_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('amb_fallback_uid', fallbackUid);
    }
  }
  return fallbackUid;
}

export async function ensureAuth() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.warn("Auth initialization failed (using fallback local UID):", e);
    }
  }
  if (auth.currentUser) {
    return { uid: auth.currentUser.uid, email: auth.currentUser.email };
  } else {
    return { uid: getOrCreateFallbackUid(), email: null };
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
