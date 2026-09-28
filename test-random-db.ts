import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "super-random-db-12345");
  
  try {
    const docRef = doc(db, 'system_settings', 'quota_test');
    const snap = await getDoc(docRef);
    console.log("Success! Read from random-db");
  } catch (err) {
    console.error("Failed:", err.message);
  }
  process.exit(0);
}
main();
