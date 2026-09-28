import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const configPath = './firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959");

async function check() {
  const d = await getDoc(doc(db, "transactions", "NP_NP123456")); // generic check
  console.log("Check complete.");
  process.exit();
}
check();
