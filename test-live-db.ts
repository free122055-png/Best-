import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    console.error("firebase-applet-config.json not found!");
    return;
  }
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);

  // Initialize custom database
  const db = initializeFirestore(app, {}, "ai-studio-67ad61be-8028-48df-ad0c-06f8544ecb1b");
  
  console.log("Testing write/read to Firestore database...");
  try {
    const docRef = doc(db, 'system_settings', 'app_config');
    console.log("Writing test data...");
    await setDoc(docRef, {
      appName: "BNB Business Admin Panel",
      updatedAt: new Date().toISOString(),
      testField: "connection_success"
    });
    console.log("Write succeeded! Now reading...");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log("Read succeeded! Document data:", snap.data());
    } else {
      console.log("Document does not exist after writing!");
    }
  } catch (err: any) {
    console.error("Firestore operations failed:", err.message || err);
  }
  process.exit(0);
}

main();
