const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        return;
      }
      if (stat && stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules') {
          results = results.concat(walk(fullPath));
        }
      } else {
        if (file.includes('AdminPanel') || file.endsWith('.bak') || file.endsWith('.tmp')) {
          results.push(fullPath);
        }
      }
    });
  } catch (e) {}
  return results;
}

console.log('Searching for AdminPanel or backups in /app recursively:');
console.log(walk('/app'));
