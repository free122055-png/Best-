import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function listAllDbs() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  
  const dbNames = [
    "bnb-business-db",
    "bnb-pro-db",
    "bnb-paid-asia"
  ];

  for (const name of dbNames) {
    try {
      const db = getFirestore(app, name);
      const q = query(collection(db, 'users'));
      const snap = await getDocs(q);
      console.log(`${name} has ${snap.size} users`);
    } catch (err) {
      console.log(`${name} error: ${err.message}`);
    }
  }
}

listAllDbs().then(() => process.exit(0));
