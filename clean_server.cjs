const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(/console\.log\("--> \[TRACE\].*?;\n/g, '');
fs.writeFileSync('server.ts', server);
