import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig, 'old_db');
  const db = getFirestore(app, "ai-studio-67ad61be-8028-48df-ad0c-06f8544ecb1b");
  
  try {
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    console.log(`OLD DB "ai-studio-67ad61be-8028-48df-ad0c-06f8544ecb1b" users count: ${snap.size}`);
    snap.forEach(doc => {
      console.log(` - ID: ${doc.id}, Name: ${doc.data().name}, Phone: ${doc.data().phone}, Balance: ${doc.data().balance}`);
    });
  } catch (err) {
    console.log("Error reading old db:", err.message);
  }
}

main().then(() => process.exit(0));
