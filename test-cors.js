const axios = require('axios');

async function testCORS() {
  const testUrls = [
    'http://localhost:5000/api/test',
    'http://localhost:5000/api/auth/refresh-token'
  ];

  const origins = [
    'http://localhost:5173',
    'http://localhost:5174', 
    'http://localhost:5176',
    'http://localhost:3000'
  ];

  console.log('Testing CORS configuration...\n');

  for (const url of testUrls) {
    console.log(`Testing URL: ${url}`);
    
    for (const origin of origins) {
      try {
        const response = await axios.get(url, {
          headers: {
            'Origin': origin,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Content-Type, Authorization'
          }
        });
        
        console.log(`  ✅ ${origin} - Success (${response.status})`);
        console.log(`     CORS Headers:`, {
          'Access-Control-Allow-Origin': response.headers['access-control-allow-origin'],
          'Access-Control-Allow-Credentials': response.headers['access-control-allow-credentials'],
          'Access-Control-Allow-Methods': response.headers['access-control-allow-methods']
        });
      } catch (error) {
        if (error.response) {
          console.log(`  ❌ ${origin} - Error (${error.response.status}): ${error.response.statusText}`);
        } else {
          console.log(`  ❌ ${origin} - Network Error: ${error.message}`);
        }
      }
    }
    console.log('');
  }
}

// Run the test
testCORS().catch(console.error); 