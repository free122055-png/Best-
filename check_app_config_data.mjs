import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");
  
  try {
    const docRef = doc(db, 'system_settings', 'app_config');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log("App config document found! Content:");
      console.log(JSON.stringify(docSnap.data(), null, 2));
    } else {
      console.log("App config document NOT found!");
    }
  } catch (err) {
    console.log("Error reading app config:", err.message);
  }
}

main().then(() => process.exit(0));
