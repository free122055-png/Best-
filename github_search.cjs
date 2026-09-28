const https = require('https');
https.get('https://api.github.com/search/code?q="even+when+a+billing+instrument+is+enabled"&per_page=5', {
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/vnd.github.v3+json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(JSON.parse(data)));
});
