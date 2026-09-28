import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  
  // Connect to the newly created database
  const db = getFirestore(app, "bnb-business-db");
  
  try {
    const docRef = doc(db, 'system_settings', 'app_config');
    // Just try reading first
    const snap = await getDoc(docRef);
    console.log("Success! Read from bnb-business-db:", snap.exists());
  } catch (err) {
    console.error("Failed:", err);
  }
  process.exit(0);
}
main();
