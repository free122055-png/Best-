import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function checkDb(dbName) {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  
  try {
    const db = getFirestore(app, dbName);
    const q = query(collection(db, 'users'), limit(5));
    const usersSnap = await getDocs(q);
    console.log(`Database ${dbName} has ${usersSnap.size} users.`);
    return true;
  } catch (err) {
    console.log(`Failed ${dbName}: ${err.message}`);
    return false;
  }
}

async function main() {
  await checkDb("ai-studio-120ee6e1");
  await checkDb("ai-studio-120ec6e1");
  await checkDb("ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");
  process.exit(0);
}
main();
