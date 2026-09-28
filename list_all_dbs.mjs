import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function listAllDbs() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  
  // Try default
  try {
    const db = getFirestore(app, "(default)");
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    console.log(`(default) has ${snap.size} users`);
  } catch (err) {
    console.log(`(default) error: ${err.message}`);
  }

  // Try bnbbusinessnetwo
  try {
    const db = getFirestore(app, "ai-studio-bnbbusinessnetwo-120ec6e1-2db5-45d2-b1b1-46493400c959");
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    console.log(`ai-studio-bnbbusinessnetwo-120ec6e1... has ${snap.size} users`);
  } catch (err) {
    console.log(`ai-studio-bnbbusinessnetwo-120ec6e1... error: ${err.message}`);
  }

  // Try 67ad61be-8028-48df-ad0c-06f8544ecb1b
  try {
    const db = getFirestore(app, "ai-studio-67ad61be-8028-48df-ad0c-06f8544ecb1b");
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    console.log(`ai-studio-67ad61be... has ${snap.size} users`);
  } catch (err) {
    console.log(`ai-studio-67ad61be... error: ${err.message}`);
  }
}

listAllDbs().then(() => process.exit(0));
