import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Initialize Firebase Admin (assuming credentials in environment or default)
const serviceAccountPath = './firebase-applet-config.json';
let db;
try {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp();
  }
  db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
} catch (e) {
  console.error("Firebase init error:", e);
}

async function debug() {
  if (!db) return;
  console.log("--- DEBUGGING TRANSACTIONS ---");
  const txSnapshot = await db.collection('transactions').orderBy('createdAt', 'desc').limit(5).get();
  txSnapshot.forEach(doc => {
    console.log("Tx ID:", doc.id, "=>", doc.data());
  });

  console.log("--- DEBUGGING USER ---");
  // Get a user to see what balance fields exist
  const usersSnap = await db.collection('users').limit(2).get();
  usersSnap.forEach(user => {
    console.log("User ID:", user.id, "=>", {
      balance: user.data().balance,
      mainBalance: user.data().mainBalance,
      name: user.data().name
    });
  });
}
debug().catch(console.error);
