import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    await updateDoc(doc(db, 'system_settings', 'app_config'), {
      appName: 'BNB Business Network Bangladesh'
    });
    console.log('Successfully updated appName in Firestore');
    process.exit(0);
  } catch (e) {
    console.error('Error updating appName:', e);
    process.exit(1);
  }
}
run();
