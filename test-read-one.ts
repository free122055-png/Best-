import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "ai-studio-67ad61be-8028-48df-ad0c-06f8544ecb1b");
  
  try {
    const docRef = doc(db, 'users', 'some_id');
    const snap = await getDoc(docRef);
    console.log("Success! Read from db");
  } catch (err) {
    console.error("Failed:", err.message);
  }
  process.exit(0);
}
main();
