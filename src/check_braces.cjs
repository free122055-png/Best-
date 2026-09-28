const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'components', 'Dashboard.tsx');
let data = fs.readFileSync(file, 'utf8');

const lines = data.split('\n');

const startLineIdx = 777; // Line 778
const endLineIdx = lines.length;

let stack = [];

for (let r = startLineIdx; r < endLineIdx; r++) {
  const line = lines[r];
  
  let cleanLine = line;
  // Replace strings
  cleanLine = cleanLine.replace(/'[^']*'/g, "''");
  cleanLine = cleanLine.replace(/"[^"]*"/g, '""');
  // Replace comments
  cleanLine = cleanLine.replace(/{\/\*[\s\S]*?\*\/}/g, '');
  cleanLine = cleanLine.replace(/\/\/.*/g, '');

  for (let c = 0; c < cleanLine.length; c++) {
    const char = cleanLine[c];
    if (char === '{' || char === '(') {
      stack.push({ char, lineNum: r + 1, colNum: c + 1 });
    } else if (char === '}') {
      const last = stack.pop();
      if (!last) {
        console.log(`EXTRA CLOSING } at line ${r + 1}, col ${c + 1}`);
      } else if (last.char !== '{') {
        console.log(`MISMATCH: got } at line ${r + 1}, col ${c + 1}, but open was ${last.char} from line ${last.lineNum}, col ${last.colNum}`);
        // Keep popping until we find a match or empty
        while(stack.length > 0) {
          const p = stack.pop();
          if (p.char === '{') {
            console.log(`Recovered and matched starting { from line ${p.lineNum}`);
            break;
          }
        }
      }
    } else if (char === ')') {
      const last = stack.pop();
      if (!last) {
        console.log(`EXTRA CLOSING ) at line ${r + 1}, col ${c + 1}`);
      } else if (last.char !== '(') {
        console.log(`MISMATCH: got ) at line ${r + 1}, col ${c + 1}, but open was ${last.char} from line ${last.lineNum}, col ${last.colNum}`);
        // Keep popping until we find a match or empty
        while(stack.length > 0) {
          const p = stack.pop();
          if (p.char === '(') {
            console.log(`Recovered and matched starting ( from line ${p.lineNum}`);
            break;
          }
        }
      }
    }
  }
}

console.log("Trace done!");
