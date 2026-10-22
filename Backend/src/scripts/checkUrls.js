const https = require('https');

const urls = [
  'https://fundlelo.site/customer_documents/36_selfie_1792693377839.webp',
  'https://crd.fundlelo.site/customer_documents/36_selfie_1792693377839.webp',
  'https://app.fundlelo.site/customer_documents/36_selfie_1792693377839.webp',
  'https://api.fundlelo.site/customer_documents/36_selfie_1792693377839.webp',
  'https://crd.fundlelo.site/api/documents/stream?path=/customer_documents/36_selfie_1792693377839.webp',
  'https://crd.fundlelo.site/api/customer_documents/36_selfie_1792693377839.webp'
];

async function testUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        resolve({ url, status: res.statusCode, contentType: res.headers['content-type'], bodyLen: d.length, preview: d.slice(0, 100) });
      });
    }).on('error', (err) => resolve({ url, error: err.message }));
  });
}

Promise.all(urls.map(testUrl)).then(results => {
  results.forEach(r => console.log(r));
  process.exit(0);
});
