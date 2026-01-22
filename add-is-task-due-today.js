const fs = require('fs');

const filePath = './frontend/src/pages/ClientDetails.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const searchFor = `  // Helper function to check if a task is overdue
  const isTaskOverdue = (task: Task): boolean => {
    if (!task.dueDate || task.status === 'COMPLETE') return false;
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    // Set both dates to midnight for accurate comparison
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };`;

const replaceWith = `  // Helper function to check if a task is overdue
  const isTaskOverdue = (task: Task): boolean => {
    if (!task.dueDate || task.status === 'COMPLETE') return false;
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    // Set both dates to midnight for accurate comparison
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  // Helper function to check if a task is due today
  const isTaskDueToday = (task: Task): boolean => {
    if (!task.dueDate || task.status === 'COMPLETE') return false;
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    // Set both dates to midnight for accurate comparison
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return dueDate.getTime() === today.getTime();
  };`;

if (content.includes(searchFor) && !content.includes('isTaskDueToday')) {
  content = content.replace(searchFor, replaceWith);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Added isTaskDueToday helper function');
} else if (content.includes('isTaskDueToday')) {
  console.log('✓ isTaskDueToday already exists');
} else {
  console.log('✗ Could not find isTaskOverdue function');
  process.exit(1);
}
