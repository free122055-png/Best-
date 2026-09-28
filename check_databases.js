import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function checkDb(dbName) {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, dbName);
  
  try {
    const docRef = doc(db, 'system_settings', 'quota_test');
    await setDoc(docRef, { timestamp: Date.now() });
    console.log(`Success! Wrote to ${dbName}`);
    return true;
  } catch (err) {
    console.error(`Failed ${dbName}:`, err.message);
    return false;
  }
}

async function main() {
  await checkDb("(default)");
  await checkDb("bnb-paid-asia");
  await checkDb("ai-studio-bnbbusinessnetwo-120ec6e1-2db5-45d2-b1b1-46493400c959");
  process.exit(0);
}
main();
