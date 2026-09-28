
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");

async function listTransactions() {
  const querySnapshot = await getDocs(collection(db, 'transactions'));
  console.log('Transactions count:', querySnapshot.size);
  querySnapshot.forEach((doc) => {
    console.log(doc.id, ' => ', doc.data());
  });
}

listTransactions().catch(console.error);
