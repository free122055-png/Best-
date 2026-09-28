import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import fs from 'fs';

const configPath = './firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");

async function run() {
  const q = query(collection(db, 'transactions'), limit(5));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    console.log(`[Tx] ${doc.id} : typeof createdAt = ${typeof doc.data().createdAt}, val = ${doc.data().createdAt}`);
  });
  process.exit(0);
}
run().catch(e => console.error(e));
