const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'components', 'AdminPanel.tsx');
let data = fs.readFileSync(file, 'utf8');

// Let's parse tag openers and closers
const lines = data.split('\n');

const tagsStack = [];
const regex = /<\/?([a-zA-Z0-9.:_-]+)(?:\s+[^>]*?)?(\/?)>/g;

let insideRet = false;
let retBraceCount = 0;

for (let r = 0; r < lines.length; r++) {
  const line = lines[r];
  
  // Let's find tags in details
  let match;
  while ((match = regex.exec(line)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>') || match[2] === '/';
    
    // Ignore native inline code or comment styles
    if (tagName.toLowerCase() === 'br' || tagName.toLowerCase() === 'img' || tagName.toLowerCase() === 'input' || tagName.toLowerCase() === 'hr') {
      continue;
    }
    
    if (isSelfClosing) {
      continue;
    }
    
    if (!isClosing) {
      // Opener
      tagsStack.push({ tag: tagName, line: r + 1 });
    } else {
      // Closer
      const last = tagsStack.pop();
      if (!last || last.tag !== tagName) {
        console.log(`Mismatched closer Tag </${tagName}> at line ${r + 1} does not match opener <${last ? last.tag : 'none'}> from line ${last ? last.line : 'none'}`);
        // Put last back
        if (last) tagsStack.push(last);
      }
    }
  }
}

console.log("Unclosed tags remaining at end of check:", tagsStack.slice(-10));
