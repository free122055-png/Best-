const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Remove isQuotaExceeded state
content = content.replace(/const \[isQuotaExceeded, setIsQuotaExceeded\] = useState\(false\);\n/g, '');

// Remove global error listener
content = content.replace(/  \/\/ Global handler to monitor console\.error[\s\S]*?window\.removeEventListener\('unhandledrejection', handleUnhandledRejection\);\n    };\n  }, \[\]\);\n/g, '');

// Remove banner
content = content.replace(/      \{isQuotaExceeded && \([\s\S]*?      \)\}\n/g, '');

// Remove prop from AdminPanel
content = content.replace(/isQuotaExceeded=\{isQuotaExceeded\}/g, '');

fs.writeFileSync('src/App.tsx', content);
