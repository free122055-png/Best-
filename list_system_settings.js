import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");
  
  try {
    const colSnap = await getDocs(collection(db, 'system_settings'));
    console.log("Documents in system_settings:");
    colSnap.forEach(doc => {
      console.log(`- ${doc.id}`);
    });
  } catch (err) {
    console.log("Error reading system_settings collection:", err.message);
  }
}

main().then(() => process.exit(0));
