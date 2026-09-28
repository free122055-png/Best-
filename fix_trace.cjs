const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(
    'const currentBalance = Number(userData.balance) || 0;\\n          console.log("--> [TRACE] Fetched User Doc:", userDocRef.path);\\n          console.log("--> [TRACE] Existing balance:", currentBalance);\\n          console.log("--> [TRACE] Existing mainBalance:", currentMainBalance);',
    'const currentBalance = Number(userData.balance) || 0;'
);

server = server.replace(
    `const currentBalance = Number(userData.balance) || 0;
          console.log("--> [TRACE] Fetched User Doc:", userDocRef.path);
          console.log("--> [TRACE] Existing balance:", currentBalance);
          console.log("--> [TRACE] Existing mainBalance:", currentMainBalance);`,
    `const currentBalance = Number(userData.balance) || 0;`
);

server = server.replace(
    'const currentMainBalance = Number(userData.mainBalance) || 0;',
    `const currentMainBalance = Number(userData.mainBalance) || 0;
          console.log("--> [TRACE] Fetched User Doc:", userDocRef.path);
          console.log("--> [TRACE] Existing balance:", currentBalance);
          console.log("--> [TRACE] Existing mainBalance:", currentMainBalance);`
);

fs.writeFileSync('server.ts', server);
