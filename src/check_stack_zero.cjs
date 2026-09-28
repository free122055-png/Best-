const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'components', 'Dashboard.tsx');
let data = fs.readFileSync(file, 'utf8');

const lines = data.split('\n');

const startLineIdx = 777; // Line 778
const endLineIdx = lines.length;

let stack = [];
// Let's seed with 1 element representing the Dashboard function open brace itself, since we are starting inside it
stack.push({ char: '{', lineNum: 777, colNum: 1 });

for (let r = startLineIdx; r < endLineIdx; r++) {
  const line = lines[r];
  
  let cleanLine = line;
  cleanLine = cleanLine.replace(/'[^']*'/g, "''");
  cleanLine = cleanLine.replace(/"[^"]*"/g, '""');
  cleanLine = cleanLine.replace(/{\/\*[\s\S]*?\*\/}/g, '');
  cleanLine = cleanLine.replace(/\/\/.*/g, '');

  for (let c = 0; c < cleanLine.length; c++) {
    const char = cleanLine[c];
    if (char === '{' || char === '(') {
      stack.push({ char, lineNum: r + 1, colNum: c + 1 });
    } else if (char === '}') {
      const last = stack.pop();
      if (!last) {
        console.log(`Stack empty on line ${r+1}, col ${c+1} when encountering }`);
      } else if (last.char !== '{') {
        console.log(`Mismatch } on line ${r+1}`);
      }
    } else if (char === ')') {
      const last = stack.pop();
      if (!last) {
        console.log(`Stack empty on line ${r+1}, col ${c+1} when encountering )`);
      } else if (last.char !== '(') {
        console.log(`Mismatch ) on line ${r+1}`);
      }
    }
    
    if (stack.length === 0) {
      console.log(`!!! SCOPE CLOSES ENTIRELY (STACK SIZE 0) AT line ${r + 1}, col ${c + 1} !!!`);
      // put a dummy back to avoid repeated prints
      stack.push({ char: 'dummy', lineNum: r+1, colNum: c+1 });
    }
  }
}

console.log("Trace done!");
