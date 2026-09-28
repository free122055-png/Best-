import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({
    projectId: "gen-lang-client-0459758196",
  });
}

const db = getFirestore();
db.settings({ databaseId: "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959" });

async function main() {
  console.log("--- Admin SDK Inspection of Firestore Database ---");
  const collections = ['users', 'transactions', 'samity_members', 'deposits', 'withdrawals', 'user_notifications', 'activity_logs', 'system_settings'];
  
  for (const colName of collections) {
    try {
      const snap = await db.collection(colName).get();
      console.log(`Collection "${colName}": ${snap.size} documents found.`);
      snap.docs.forEach((doc, idx) => {
        if (idx < 5) {
          const d = doc.data();
          console.log(`  [${doc.id}] name: ${d.name || d.fullName || 'N/A'}, phone: ${d.phone || d.mobile || 'N/A'}, balance: ${d.balance !== undefined ? d.balance : 'N/A'}`);
        }
      });
    } catch (err) {
      console.log(`Collection "${colName}" error:`, err.message);
    }
  }
}

main().then(() => process.exit(0));
