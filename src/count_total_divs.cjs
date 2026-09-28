const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'components', 'Dashboard.tsx');
let data = fs.readFileSync(file, 'utf8');

const lines = data.split('\n');
const jsxLines = lines.slice(777); // Start at return block

let openDivs = 0;
let closeDivs = 0;

for (let r = 0; r < jsxLines.length; r++) {
  const line = jsxLines[r];
  let idx = 0;
  
  // Count `<div`
  while ((idx = line.indexOf('<div', idx)) !== -1) {
    // Check if it is a real tag and not generic
    const nextChar = line[idx + 4];
    if (nextChar === ' ' || nextChar === '>') {
      openDivs++;
    }
    idx += 4;
  }
  
  idx = 0;
  // Count `</div>`
  while ((idx = line.indexOf('</div>', idx)) !== -1) {
    closeDivs++;
    idx += 6;
  }
}

console.log({ openDivs, closeDivs });
