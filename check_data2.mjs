import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import fs from 'fs';

const configPath = './firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");

async function run() {
  console.log("Checking recent add_money transactions...");
  const q = query(collection(db, 'transactions'), where('type', '==', 'add_money'), orderBy('createdAt', 'desc'), limit(10));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    console.log(`[Tx] ${doc.id} : amount=${doc.data().amount}, user=${doc.data().userId}, status=${doc.data().status}, method=${doc.data().paymentMethod}, date=${doc.data().createdAt}`);
  });
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
