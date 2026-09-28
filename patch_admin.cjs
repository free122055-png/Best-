const fs = require('fs');

let content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
const lines = content.split('\n');

// 1. Remove extra </div> at line 31255 (or before drillDownModalData closing)
for (let i = lines.length - 200; i < lines.length; i++) {
  if (lines[i].includes('onClick={() => setDrillDownModalData(null)}')) {
    // Look ahead 5-10 lines for the closing tags
    for (let j = i + 1; j < i + 15 && j < lines.length; j++) {
      if (lines[j].trim() === '</div>' && lines[j+1] && lines[j+1].trim() === '</div>' && lines[j+2] && lines[j+2].trim() === ')}') {
        console.log('Found double </div> before )} at line', j + 2);
        lines.splice(j + 1, 1);
        break;
      }
    }
    break;
  }
}

// 2. Fix the last lines of the function
for (let i = lines.length - 1; i >= lines.length - 10; i--) {
  if (lines[i].trim() === '};') {
    lines[i] = '}';
    console.log('Fixed function closing at line', i + 1);
    break;
  }
}

fs.writeFileSync('src/components/AdminPanel.tsx', lines.join('\n'), 'utf8');
console.log('Updated successfully!');
