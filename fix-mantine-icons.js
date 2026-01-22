const fs = require('fs');
const path = require('path');

// Fix Mantine ComboboxChevron icons that don't have aria-hidden
const files = [
  'frontend/src/pages/Clients.tsx',
  'frontend/src/pages/Pipeline.tsx',
  'frontend/src/pages/Documents.tsx'
];

let totalFixed = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Find Select components with leftSection icons
  // Pattern: <Select ... leftSection={<Icon... /> />
  // We need to ensure the icon inside leftSection has aria-hidden

  // This regex catches Select components and ensures aria-hidden is on icons
  const selectPattern = /leftSection=\{<Icon([A-Z][a-zA-Z]+)\s+([^>]*?)\/>\}/g;

  content = content.replace(selectPattern, (match, iconName, rest) => {
    if (rest.includes('aria-hidden')) {
      return match;
    }
    totalFixed++;
    return `leftSection={<Icon${iconName} ${rest.trim()} aria-hidden="true" />}`;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed Mantine Select icons in ${file}`);
  }
});

console.log(`\n🎉 Total Mantine icons fixed: ${totalFixed}`);
