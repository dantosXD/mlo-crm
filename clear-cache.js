const fs = require('fs');
const path = require('path');

const viteCachePath = path.join(__dirname, 'frontend', 'node_modules', '.vite');

try {
  if (fs.existsSync(viteCachePath)) {
    fs.rmSync(viteCachePath, { recursive: true, force: true });
    console.log('Vite cache cleared successfully');
  } else {
    console.log('No Vite cache found');
  }
} catch (error) {
  console.error('Error clearing cache:', error.message);
}
