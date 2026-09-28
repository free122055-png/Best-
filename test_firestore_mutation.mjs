import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");

  // Let's test what happens when we update doc 'bSsky3yj43za6t9dnVf4'
  console.log("Testing read of bSsky3yj43za6t9dnVf4...");
  const snap = await getDoc(doc(db, 'transactions', 'bSsky3yj43za6t9dnVf4'));
  console.log("Doc data:", snap.data());

  // Check if we can write to user_notifications
  console.log("Testing user_notifications addDoc...");
  try {
    const testNotifRef = await addDoc(collection(db, 'user_notifications'), {
      id: `test-${Date.now()}`,
      userId: 'test_user',
      title: 'test title',
      body: 'test body',
      read: false,
      createdAt: new Date().toISOString()
    });
    console.log("Notif written successfully, id:", testNotifRef.id);
  } catch (err) {
    console.error("Notif failed:", err);
  }
}

main().catch(err => console.error(err)).then(() => process.exit(0));
