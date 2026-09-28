const fs = require('fs');
console.log(fs.readFileSync('server.ts', 'utf8').substring(0, 1000));
