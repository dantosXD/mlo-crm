// Test download API
const testDownload = async () => {
  try {
    // Login first
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'mlo@example.com',
        password: 'password123'
      })
    });

    const loginData = await loginResponse.json();
    const token = loginData.accessToken;

    // Test download
    const downloadResponse = await fetch('http://localhost:3000/api/documents/6bb870b3-d7f7-45cc-8257-8c0049bf5a09/download', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (downloadResponse.ok) {
      const content = await downloadResponse.text();
      console.log('✅ Download via API successful!');
      console.log('Content length:', content.length);
      console.log('Content preview:', content.substring(0, 100));
    } else {
      console.error('❌ Download failed:', downloadResponse.status, downloadResponse.statusText);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testDownload();
