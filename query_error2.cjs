const https = require('https');
https.get('https://html.duckduckgo.com/html/?q=firestore+%22cannot+exceed+free+quota+limits+even+when+a+billing+instrument+is+enabled%22', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data.match(/<a class="result__snippet[^>]*>(.*?)<\/a>/g) || "no results"));
});
