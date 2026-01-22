const fs = require('fs');

const filePath = './frontend/src/pages/ClientDetails.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Update the clear filter button description
const searchFor = 'description="No tasks match the selected priority filter. Try changing the filter or add a new task."';
const replaceWith = 'description="No tasks match the selected filters. Try changing the filters or add a new task."';

if (content.includes(searchFor) && !content.includes('filters.')) {
  content = content.replace(searchFor, replaceWith);

  // Also update the onCtaClick to clear both filters
  const searchFor2 = 'onCtaClick={() => setTaskPriorityFilter(null)}';
  const replaceWith2 = 'onCtaClick={() => { setTaskPriorityFilter(null); setTaskDateFilter(null); }}';

  if (content.includes(searchFor2)) {
    content = content.replace(searchFor2, replaceWith2);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✓ Updated clear filter button');
  } else {
    console.log('✗ Could not find onCtaClick');
    process.exit(1);
  }
} else if (content.includes('filters.')) {
  console.log('✓ Clear filter button already updated');
} else {
  console.log('✗ Could not find description to update');
  process.exit(1);
}
