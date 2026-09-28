import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "bnb-pro-db");
  
  try {
    const docRef = doc(db, 'system_settings', 'app_config');
    const snap = await getDoc(docRef);
    console.log("Success! Read from db:", snap.exists());
  } catch (err) {
    console.error("Failed:", err);
  }
  process.exit(0);
}
main();
