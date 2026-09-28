const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'components', 'Dashboard.tsx');
let data = fs.readFileSync(file, 'utf8');

let stack = [];
const lines = data.split('\n');

for (let r = 0; r < lines.length; r++) {
  const line = lines[r];
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    if (char === '{' || char === '(' || char === '[') {
      stack.push({ char, lineNum: r + 1, colNum: c + 1 });
    } else if (char === '}') {
      const last = stack.pop();
      if (!last || last.char !== '{') {
        console.log(`Unmatched } at line ${r + 1}, col ${c + 1}. Expected match for:`, last);
      }
    } else if (char === ')') {
      const last = stack.pop();
      if (!last || last.char !== '(') {
        console.log(`Unmatched ) at line ${r + 1}, col ${c + 1}. Expected match for:`, last);
      }
    } else if (char === ']') {
      const last = stack.pop();
      if (!last || last.char !== '[') {
        console.log(`Unmatched ] at line ${r + 1}, col ${c + 1}. Expected match for:`, last);
      }
    }
  }
}

if (stack.length > 0) {
  console.log("Unclosed elements remaining at end of file:", stack.slice(-5));
} else {
  console.log("Excellent! Entire file is perfectly bracket-matched.");
}
