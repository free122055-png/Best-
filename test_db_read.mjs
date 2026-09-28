import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function testQuota(dbName) {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, dbName);
  
  try {
    const docRef = doc(db, 'system_settings', 'quota_test_3');
    await setDoc(docRef, { ts: Date.now() });
    console.log(`Success! Wrote to ${dbName} works (no quota/permission error).`);
    return true;
  } catch (err) {
    console.log(`Failed ${dbName}: ${err.message}`);
    return false;
  }
}

testQuota("ai-studio-bnbbusinessnetwo-120ec6e1-2db5-45d2-b1b1-46493400c959").then(() => process.exit(0));
