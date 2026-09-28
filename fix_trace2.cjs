const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(
    /console\.log\("--> \[TRACE\] Calculated newMainBalance:", newMainBalance\);\n\s*const newMainBalance = currentMainBalance \+ depositAmount;/g,
    'const newMainBalance = currentMainBalance + depositAmount;\n          console.log("--> [TRACE] Calculated newMainBalance:", newMainBalance);'
);

fs.writeFileSync('server.ts', server);
