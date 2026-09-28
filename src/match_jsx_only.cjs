const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'components', 'Dashboard.tsx');
let data = fs.readFileSync(file, 'utf8');

const lines = data.split('\n');

const startLineIdx = 777; // Line 778
const endLineIdx = 1630;

const jsxLines = lines.slice(startLineIdx, endLineIdx);

let tagsStack = [];
const tagRegex = /<(\/?)([a-zA-Z0-9.:_-]+)(?:\s+[^>]*?)?(\/?)>/g;

for (let r = 0; r < jsxLines.length; r++) {
  const line = jsxLines[r];
  const lineNum = startLineIdx + 1 + r;
  
  let match;
  while ((match = tagRegex.exec(line)) !== null) {
    const isClosing = match[1] === '/';
    const tag = match[2];
    const isSelfClosing = match[3] === '/' || ['img', 'input', 'br', 'hr', 'link'].includes(tag.toLowerCase());
    
    if (isSelfClosing) continue;
    
    if (!isClosing) {
      tagsStack.push({ tag, lineNum });
    } else {
      const last = tagsStack.pop();
      if (!last) {
        console.log(`Error on line ${lineNum}: Found closing tag </${tag}> but stack was empty`);
      } else if (last.tag !== tag) {
        console.log(`Mismatch on line ${lineNum}: Found closing tag </${tag}>, but expected </${last.tag}> (opened on line ${last.lineNum})`);
        tagsStack.push(last); // restore
      }
    }
  }
}

console.log("Remaining open tags in stack at line 1630:", tagsStack);
