import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function listUsers() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");
  
  try {
    const q = query(collection(db, 'users'));
    const usersSnap = await getDocs(q);
    console.log(`Found ${usersSnap.size} users.`);
    usersSnap.forEach(doc => console.log(doc.id, doc.data().name, doc.data().role));
  } catch (err) {
    console.log(`Failed: ${err.message}`);
  }
}

listUsers().then(() => process.exit(0));
