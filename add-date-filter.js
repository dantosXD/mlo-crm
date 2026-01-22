const fs = require('fs');
const path = require('path');

const filePath = './frontend/src/pages/ClientDetails.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add the taskDateFilter state after taskPriorityFilter
const searchFor = 'const [taskPriorityFilter, setTaskPriorityFilter] = useState<string | null>(null);';
const replaceWith = 'const [taskPriorityFilter, setTaskPriorityFilter] = useState<string | null>(null);\n  const [taskDateFilter, setTaskDateFilter] = useState<string | null>(null);';

if (content.includes(searchFor) && !content.includes('taskDateFilter')) {
  content = content.replace(searchFor, replaceWith);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Added taskDateFilter state variable');
} else if (content.includes('taskDateFilter')) {
  console.log('✓ taskDateFilter already exists');
} else {
  console.log('✗ Could not find taskPriorityFilter line');
  process.exit(1);
}
