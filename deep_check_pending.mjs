import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");

  // Get all pending transactions
  const snap = await getDocs(collection(db, 'transactions'));
  const allTxs = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  const pendingTxs = allTxs.filter(t => t.status === 'pending' || t.status === 'processing');

  console.log(`Found ${pendingTxs.length} pending transactions:`);

  for (const pt of pendingTxs) {
    console.log(`\n-----------------------------------------`);
    console.log(`Doc ID: ${pt.docId} | ID: ${pt.id}`);
    console.log(`User: ${pt.userName} (${pt.userId}) | Phone: ${pt.userPhone || pt.phone}`);
    console.log(`Type: ${pt.type} | Amount: ${pt.amount} | Status: ${pt.status}`);
    console.log(`TrxID: ${pt.trxId || pt.transactionId || 'none'} | Created: ${pt.createdAt}`);
    console.log(`Desc: ${pt.description}`);

    // Check user data
    if (pt.userId) {
      const uSnap = await getDoc(doc(db, 'users', pt.userId));
      if (uSnap.exists()) {
        const u = uSnap.data();
        console.log(`User DB State: Balance=${u.balance}, MainBalance=${u.mainBalance}, Savings=${u.savings}, DpsBalance=${u.dpsBalance}, samityDeactivateStatus=${u.samityDeactivateStatus}`);
      } else {
        console.log(`User doc ${pt.userId} does not exist in users!`);
      }

      // Check notifications for this user
      const notifSnap = await getDocs(query(collection(db, 'user_notifications'), where('userId', '==', pt.userId)));
      console.log(`User notifications count: ${notifSnap.docs.length}`);
      notifSnap.docs.forEach(nd => {
        const n = nd.data();
        console.log(`  - [${n.createdAt}] ${n.title} :: ${n.message || n.body}`);
      });
    }
  }
}

main().catch(err => console.error(err)).then(() => process.exit(0));
