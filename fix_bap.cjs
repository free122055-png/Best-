const fs = require('fs');
let content = fs.readFileSync('src/components/BapSystem.tsx', 'utf8');

// Remove isQuotaActive state
content = content.replace(/  const \[isQuotaActive, setIsQuotaActive\] = useState\(false\);\n/g, '');

// Remove setIsQuotaActive(true) calls
content = content.replace(/        setIsQuotaActive\(true\);\n/g, '');

// Remove the banner
content = content.replace(/       \{isQuotaActive && \([\s\S]*?      \)\}\n/g, '');

fs.writeFileSync('src/components/BapSystem.tsx', content);
