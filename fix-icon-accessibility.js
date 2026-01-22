const fs = require('fs');
const path = require('path');

// List of files to fix
const files = [
  'frontend/src/pages/ClientDetails.tsx',
  'frontend/src/pages/Pipeline.tsx',
  'frontend/src/pages/Dashboard.tsx',
  'frontend/src/pages/Documents.tsx',
  'frontend/src/pages/Notes.tsx',
  'frontend/src/components/EmptyState.tsx',
  'frontend/src/pages/Settings.tsx',
  'frontend/src/pages/Admin.tsx',
  'frontend/src/pages/Analytics.tsx',
  'frontend/src/pages/Calculator.tsx',
  'frontend/src/components/QuickCapture.tsx',
  'frontend/src/pages/NotFound.tsx',
  'frontend/src/pages/Login.tsx',
  'frontend/src/pages/AccessDenied.tsx'
];

let totalFixed = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let fixedCount = 0;

  // Pattern to match Tabler icon components without aria-hidden
  // Matches: <IconName size={...} /> or <IconName size={...} ... />
  const iconPattern = /<Icon([A-Z][a-zA-Z]+)\s+([^>]*?)\/>/g;

  content = content.replace(iconPattern, (match, iconName, rest) => {
    // Skip if already has aria-hidden
    if (rest.includes('aria-hidden')) {
      return match;
    }

    fixedCount++;
    // Add aria-hidden="true" before the closing />
    return `<Icon${iconName} ${rest.trim()} aria-hidden="true" />`;
  });

  if (fixedCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed ${fixedCount} icons in ${file}`);
    totalFixed += fixedCount;
  } else {
    console.log(`ℹ️  No icons needed fixing in ${file}`);
  }
});

console.log(`\n🎉 Total icons fixed: ${totalFixed}`);
