const axios = require('axios');

const testServer = async () => {
  try {
    console.log('Testing if server is running...');
    const response = await axios.get('http://localhost:5000');
    console.log('✅ Server is running!');
    console.log('Response:', response.status);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running');
    } else {
      console.log('✅ Server is running but returned:', error.response?.status);
    }
  }
};

testServer(); 