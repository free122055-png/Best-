const fs = require('fs');
let content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// Replace setLocalQuotaExceeded with console.warn
content = content.replace(/setLocalQuotaExceeded\(true\);/g, 'console.warn("Quota exceeded error handled");');

fs.writeFileSync('src/components/AdminPanel.tsx', content);
