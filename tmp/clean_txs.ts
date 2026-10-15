import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");

async function checkAndCleanTransactions() {
  console.log("Fetching transactions...");
  const snap = await getDocs(collection(db, "transactions"));
  console.log(`Total transactions found: ${snap.size}`);
  snap.forEach((d) => {
    const data = d.data();
    console.log(`ID: ${d.id} | User: ${data.userName} | Phone: ${data.userPhone} | Type: ${data.type} | Amount: ${data.amount} | Status: ${data.status}`);
    
    // Check if it matches Jubayer or 2500 Tk donation to delete
    const nameStr = String(data.userName || '');
    const isJubayer = nameStr.includes('জুবায়ের') || nameStr.includes('Jubayer');
    const is2500 = Number(data.amount) === 2500;
    
    if (isJubayer || (is2500 && data.type === 'qard_donation')) {
      console.log(`>>> DELETING INVALID TRANSACTION: ${d.id}`);
      deleteDoc(doc(db, "transactions", d.id)).then(() => console.log(`Deleted ${d.id}`));
    }
  });
}

checkAndCleanTransactions().catch(console.error);
