const fs = require('fs');

// Create a 15MB file
const fileSize = 15 * 1024 * 1024; // 15MB
const buffer = Buffer.alloc(fileSize, 0);

fs.writeFileSync('large-test-file.bin', buffer);

const stats = fs.statSync('large-test-file.bin');
console.log('Created file: large-test-file.bin');
console.log('Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
