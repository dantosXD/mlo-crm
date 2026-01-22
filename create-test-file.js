const fs = require('fs');
// Create a 5MB test file
const size = 5 * 1024 * 1024; // 5MB
const buffer = Buffer.alloc(size, 'x');
fs.writeFileSync('test-upload-158.pdf', buffer);
console.log('Created test-upload-158.pdf (5MB)');
