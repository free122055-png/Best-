import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");

  const snap = await getDocs(collection(db, 'transactions'));
  const all = snap.docs.map(d => ({ docId: d.id, ...d.data() }));

  const testPhones = ['01993749868', '01945785600', '01864013840', '01904359062', '01751556892', '01874253045', '01886418112'];

  for (const phone of testPhones) {
    const userTxs = all.filter(t => (t.userPhone && t.userPhone.includes(phone.slice(-10))) || (t.phone && t.phone.includes(phone.slice(-10))));
    console.log(`\n=== Txs for phone ${phone} (count: ${userTxs.length}) ===`);
    userTxs.forEach(t => {
      console.log({
        docId: t.docId,
        id: t.id,
        trxId: t.trxId || t.transactionId,
        amount: t.amount,
        type: t.type,
        status: t.status,
        reviewStatus: t.reviewStatus,
        isApproved: t.isApproved,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      });
    });
  }
}

main().catch(err => console.error(err)).then(() => process.exit(0));
