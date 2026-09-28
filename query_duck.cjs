const https = require('https');
const q = encodeURIComponent("firestore This database cannot exceed free quota limits even when a billing instrument is enabled");
https.get('https://html.duckduckgo.com/html/?q=' + q, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
      const matches = data.match(/<a class="result__snippet[^>]*>(.*?)<\/a>/g);
      if (matches) {
          console.log(matches.map(m => m.replace(/<[^>]+>/g, '')).join('\n---\n'));
      } else {
          console.log("no results");
      }
  });
});
