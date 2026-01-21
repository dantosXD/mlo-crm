const fs = require('fs');
const files = ['frontend/src/pages/ClientDetails.tsx', 'frontend/src/pages/Dashboard.tsx', 'frontend/src/pages/Pipeline.tsx'];
files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/CLOSED: 'teal'/g, "CLOSED: 'green.9'");
    content = content.replace(/color: 'teal'/g, "color: 'green.9'");
    fs.writeFileSync(file, content);
    console.log('Updated:', file);
  }
});
