import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "bnb-business-db");
  
  try {
    const docRef = doc(db, 'system_settings', 'app_config');
    await setDoc(docRef, { appName: "BNB Business Admin Panel", updatedAt: new Date().toISOString() });
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log("Success! Read from new db:", snap.data());
    }
  } catch (err) {
    console.error("Failed:", err);
  }
  process.exit(0);
}
main();
