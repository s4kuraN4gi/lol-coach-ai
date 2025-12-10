const fs = require('fs');
const https = require('https');

try {
  let key = '';
  // Try reading .env.local
  if (fs.existsSync('.env.local')) {
      const env = fs.readFileSync('.env.local', 'utf8');
      const match = env.match(/GEMINI_API_KEY=(.*)/);
      if (match) {
        key = match[1].trim();
      }
  }
  
  if (!key) {
      console.error('No GEMINI_API_KEY found in .env.local');
      process.exit(1);
  }

  console.log('Key found (length: ' + key.length + ')');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + key;

  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.models) {
            console.log("AVAILABLE MODELS:");
            console.log(JSON.stringify(json.models.map(m => m.name), null, 2));
        } else {
            console.error("No models found in response:", json);
        }
      } catch(e) {
        console.error("Failed to parse JSON:", data);
      }
    });
  }).on('error', (e) => console.error(e));

} catch (e) {
  console.error(e);
}
