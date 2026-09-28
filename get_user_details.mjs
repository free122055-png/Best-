import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function getDetails() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");
  
  try {
    const q = query(collection(db, 'users'));
    const usersSnap = await getDocs(q);
    usersSnap.forEach(doc => {
      const d = doc.data();
      console.log(`UID: ${doc.id}`);
      console.log(`Name: ${d.name}`);
      console.log(`Phone: ${d.phone}`);
      console.log(`Savings: ${d.savings}`);
      console.log(`DPS Balance: ${d.dpsBalance}`);
      console.log(`Monthly Savings Target: ${d.monthlySavingsTarget}`);
      console.log(`Samity Paid Months: ${JSON.stringify(d.samityPaidMonths)}`);
      console.log(`---`);
    });
  } catch (err) {
    console.log(`Failed: ${err.message}`);
  }
}

getDetails().then(() => process.exit(0));
