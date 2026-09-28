import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function scanDb(dbId) {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig, 'app_' + dbId);
  const db = getFirestore(app, dbId);
  
  console.log(`\n--- Scanning Database ID: "${dbId}" ---`);
  const collectionsToTest = ['users', 'transactions', 'samity_members', 'deposits', 'withdrawals', 'user_notifications', 'activity_logs'];
  
  for (const colName of collectionsToTest) {
    try {
      const snap = await getDocs(query(collection(db, colName)));
      console.log(`Collection "${colName}": ${snap.size} documents found.`);
      if (snap.size > 0 && snap.size <= 10) {
        snap.forEach(doc => {
          console.log(`  - Doc ID: ${doc.id}, Data:`, JSON.stringify(doc.data()).substring(0, 150));
        });
      } else if (snap.size > 10) {
        console.log(`  - First 3 docs:`);
        let count = 0;
        snap.forEach(doc => {
          if (count < 3) {
            console.log(`    * ID: ${doc.id}, Name/Phone:`, doc.data().name || doc.data().phone || doc.id);
            count++;
          }
        });
      }
    } catch (err) {
      console.log(`Collection "${colName}" error: ${err.message}`);
    }
  }
}

async function main() {
  const dbIds = [
    "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959",
    "ai-studio-67ad61be-8028-48df-ad0c-06f8544ecb1b",
    "bnb-pro-db",
    "bnb-paid-asia",
    "(default)"
  ];
  
  for (const dbId of dbIds) {
    await scanDb(dbId);
  }
}

main().then(() => process.exit(0));
