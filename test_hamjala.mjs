import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, runTransaction } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");

  // Let's test the Hamjala withdraw tx
  console.log("Checking Hamjala transaction doc cX49eOLESQfbcYuh7KCI...");
  const txSnap = await getDoc(doc(db, 'transactions', 'cX49eOLESQfbcYuh7KCI'));
  const tx = txSnap.data();
  console.log("Hamjala tx:", tx);

  // Check user
  const userSnap = await getDoc(doc(db, 'users', tx.userId));
  console.log("Hamjala user:", {
    uid: userSnap.id,
    savings: userSnap.data()?.savings,
    dpsBalance: userSnap.data()?.dpsBalance,
    balance: userSnap.data()?.balance,
    samityDeactivateStatus: userSnap.data()?.samityDeactivateStatus
  });

  // What about user_01874253045?
}

main().catch(err => console.error("Error in test:", err)).then(() => process.exit(0));
