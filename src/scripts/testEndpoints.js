const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
const ADMIN_EMAIL = 'admin@example.com'; // Change to your admin email
const ADMIN_PASSWORD = 'admin123'; // Change to your admin password

let accessToken = '';

async function login() {
  try {
    console.log('Logging in as admin...');
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    accessToken = res.data.accessToken || res.data.data?.accessToken;
    if (!accessToken) throw new Error('No access token received');
    console.log('✅ Login successful!');
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.message || error.message);
    process.exit(1);
  }
}

function authHeaders() {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

const testEndpoints = async () => {
  console.log('Testing endpoints...\n');

  await login();

  try {
    // Test 1: Get students by role
    console.log('1. Testing GET /users/by-role/student');
    try {
      const response = await axios.get(`${API_BASE}/users/by-role/student`, authHeaders());
      console.log('✅ Success:', response.data.success);
      console.log('   Students found:', response.data.data?.users?.length || 0);
    } catch (error) {
      console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
    }

    // Test 2: Get student fee by student ID
    console.log('\n2. Testing GET /student-fees/by-student/:studentId');
    try {
      // First get a student ID
      const studentsResponse = await axios.get(`${API_BASE}/users/by-role/student`, authHeaders());
      const studentId = studentsResponse.data.data?.users?.[0]?.id;
      
      if (studentId) {
        const response = await axios.get(`${API_BASE}/student-fees/by-student/${studentId}`, authHeaders());
        console.log('✅ Success:', response.data.success);
        console.log('   Fee record found:', !!response.data.data);
      } else {
        console.log('❌ No students found to test with');
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
    }

    // Test 3: Get payments by student
    console.log('\n3. Testing GET /payments/student/:studentId');
    try {
      const studentsResponse = await axios.get(`${API_BASE}/users/by-role/student`, authHeaders());
      const studentId = studentsResponse.data.data?.users?.[0]?.id;
      
      if (studentId) {
        const response = await axios.get(`${API_BASE}/payments/student/${studentId}`, authHeaders());
        console.log('✅ Success:', response.data.success);
        console.log('   Payments found:', response.data.data?.length || 0);
      } else {
        console.log('❌ No students found to test with');
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
    }

    // Test 4: Create student fee for custom fees
    console.log('\n4. Testing POST /student-fees/create-for-custom-fees');
    try {
      const studentsResponse = await axios.get(`${API_BASE}/users/by-role/student`, authHeaders());
      const student = studentsResponse.data.data?.users?.[0];
      
      if (student) {
        const response = await axios.post(`${API_BASE}/student-fees/create-for-custom-fees`, {
          studentId: student.id,
          courseId: student.courseInfo?._id || null,
          semester: student.currentSemester || 1,
          academicYear: new Date().getFullYear().toString()
        }, authHeaders());
        console.log('✅ Success:', response.data.success);
        console.log('   Fee record created:', !!response.data.data);
      } else {
        console.log('❌ No students found to test with');
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
    }

  } catch (error) {
    console.error('General error:', error.message);
  }
};

testEndpoints(); 