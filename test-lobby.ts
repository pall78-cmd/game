import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/games/UNO/create',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response:', res.statusCode, data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(JSON.stringify({ numPlayers: 2 }));
req.end();
