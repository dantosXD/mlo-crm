const fs = require('fs');

const filePath = './frontend/src/pages/ClientDetails.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const searchFor = `              <Select
                placeholder="Filter by priority"
                clearable
                data={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                ]}
                value={taskPriorityFilter}
                onChange={setTaskPriorityFilter}
                style={{ width: 160 }}
              />
              <Button`;

const replaceWith = `              <Select
                placeholder="Filter by priority"
                clearable
                data={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                ]}
                value={taskPriorityFilter}
                onChange={setTaskPriorityFilter}
                style={{ width: 160 }}
              />
              <Select
                placeholder="Due date"
                clearable
                data={[
                  { value: 'today', label: 'Due Today' },
                ]}
                value={taskDateFilter}
                onChange={setTaskDateFilter}
                style={{ width: 140 }}
              />
              <Button`;

if (content.includes(searchFor) && !content.includes('Due Today')) {
  content = content.replace(searchFor, replaceWith);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Added date filter dropdown UI');
} else if (content.includes('Due Today')) {
  console.log('✓ Due Today filter already exists');
} else {
  console.log('✗ Could not find priority filter Select component');
  process.exit(1);
}
