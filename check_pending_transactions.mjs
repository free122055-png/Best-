import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");

  const targetTrxIds = [
    'cX49eOLESQfbcYuh7KCI',
    '75YP7YIO',
    'DI90BXYA48',
    'DI93BDR3T5',
    'DI85AYAOJN',
    'DI82AT78IU',
    'DI82AS1SMS',
    'DI82ARZYTC',
    'DI84ARU2P0',
    'QXLI14NGjYXyfZ4HIHFu'
  ];

  const snap = await getDocs(collection(db, 'transactions'));
  const all = snap.docs.map(d => ({ docId: d.id, ...d.data() }));

  console.log(`Total transactions in DB: ${all.length}`);

  for (const trx of targetTrxIds) {
    console.log(`\n--- Looking for trx containing "${trx}" ---`);
    const matches = all.filter(t => 
      t.docId === trx || 
      (t.trxId && t.trxId.includes(trx)) || 
      (t.transactionId && t.transactionId.includes(trx)) ||
      (t.id && t.id.includes(trx))
    );
    console.log(`Found ${matches.length} matching docs:`);
    matches.forEach(m => {
      console.log({
        docId: m.docId,
        id: m.id,
        trxId: m.trxId,
        transactionId: m.transactionId,
        type: m.type,
        status: m.status,
        reviewStatus: m.reviewStatus,
        isApproved: m.isApproved,
        amount: m.amount,
        userName: m.userName,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      });
    });
  }

  // Also look at all transactions in DB with status === 'pending'
  const pendingDocs = all.filter(t => t.status === 'pending' || t.status === 'processing');
  console.log(`\n=== ALL PENDING/PROCESSING DOCS IN DB (Total ${pendingDocs.length}) ===`);
  pendingDocs.forEach(p => {
    console.log({
      docId: p.docId,
      id: p.id,
      trxId: p.trxId || p.transactionId,
      userName: p.userName,
      userPhone: p.userPhone || p.phone,
      amount: p.amount,
      type: p.type,
      status: p.status,
      reviewStatus: p.reviewStatus,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    });
  });
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
}).then(() => process.exit(0));
