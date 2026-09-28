import * as fs from 'fs';

let firebase = fs.readFileSync('src/lib/firebase.ts', 'utf8');
firebase = firebase.replace(/const TARGET_DATABASE_ID = "[^"]+";/, 'const TARGET_DATABASE_ID = "ai-studio-bnbbusinessnetwo-120ec6e1-2db5-45d2-b1b1-46493400c959";');
fs.writeFileSync('src/lib/firebase.ts', firebase);

let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(/const TARGET_DATABASE_ID = "[^"]+";/, 'const TARGET_DATABASE_ID = "ai-studio-bnbbusinessnetwo-120ec6e1-2db5-45d2-b1b1-46493400c959";');
fs.writeFileSync('server.ts', server);

let config = fs.readFileSync('firebase-applet-config.json', 'utf8');
config = config.replace(/"firestoreDatabaseId": "[^"]+"/, '"firestoreDatabaseId": "ai-studio-bnbbusinessnetwo-120ec6e1-2db5-45d2-b1b1-46493400c959"');
fs.writeFileSync('firebase-applet-config.json', config);
