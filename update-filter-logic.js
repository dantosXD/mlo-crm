const fs = require('fs');

const filePath = './frontend/src/pages/ClientDetails.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Update the filter logic in multiple places
const replacements = [
  {
    search: ') : tasks.filter(task => !taskPriorityFilter || task.priority === taskPriorityFilter).length === 0 ? (',
    replace: ') : tasks.filter(task => {\n' +
      '          const matchesPriority = !taskPriorityFilter || task.priority === taskPriorityFilter;\n' +
      '          const matchesDate = !taskDateFilter || (taskDateFilter === \'today\' && isTaskDueToday(task));\n' +
      '          return matchesPriority && matchesDate;\n' +
      '        }).length === 0 ? ('
  },
  {
    search: ') : (\n' +
      '            <Stack gap="md">\n' +
      '              {tasks.filter(task => !taskPriorityFilter || task.priority === taskPriorityFilter).map((task) => {',
    replace: ') : (\n' +
      '            <Stack gap="md">\n' +
      '              {tasks.filter(task => {\n' +
      '                const matchesPriority = !taskPriorityFilter || task.priority === taskPriorityFilter;\n' +
      '                const matchesDate = !taskDateFilter || (taskDateFilter === \'today\' && isTaskDueToday(task));\n' +
      '                return matchesPriority && matchesDate;\n' +
      '              }).map((task) => {'
  }
];

let modified = false;
for (const { search, replace } of replacements) {
  if (content.includes(search) && !content.includes('matchesDate')) {
    content = content.replace(search, replace);
    modified = true;
    console.log(`✓ Updated filter logic at "${search.substring(0, 50)}..."`);
  }
}

if (modified) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Updated task filtering logic');
} else if (content.includes('matchesDate')) {
  console.log('✓ Filter logic already updated');
} else {
  console.log('✗ Could not find filter logic to update');
  process.exit(1);
}
