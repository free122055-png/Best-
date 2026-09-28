import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function listUsers() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "ai-studio-67ad61be-8028-48df-ad0c-06f8544ecb1b");
  
  try {
    const q = query(collection(db, 'users'));
    const usersSnap = await getDocs(q);
    console.log(`FOUND ${usersSnap.size} USERS!`);
  } catch (err) {
    console.log(`Failed: ${err.message}`);
  }
}

listUsers().then(() => process.exit(0));
