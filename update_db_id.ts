import * as fs from 'fs';

const oldDbId = "ai-studio-bnbbusinessnetwo-120ec6e1-2db5-45d2-b1b1-46493400c959";
const newDbId = "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959";

let firebase = fs.readFileSync('src/lib/firebase.ts', 'utf8');
firebase = firebase.replace(new RegExp(oldDbId, 'g'), newDbId);
fs.writeFileSync('src/lib/firebase.ts', firebase);

let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(new RegExp(oldDbId, 'g'), newDbId);
fs.writeFileSync('server.ts', server);

let config = fs.readFileSync('firebase-applet-config.json', 'utf8');
config = config.replace(new RegExp(oldDbId, 'g'), newDbId);
fs.writeFileSync('firebase-applet-config.json', config);

console.log("Updated to new DB ID successfully!");
