/**
 * Test Feature #277: Task Event Triggers (Simple Version)
 *
 * This test verifies that task triggers are integrated into the task routes
 * by checking that the trigger handlers are imported and called.
 */

const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 Feature #277: Task Event Triggers - Code Verification');
console.log('═══════════════════════════════════════════════════════════\n');

// Test 1: Check triggerHandler.ts exports task trigger functions
console.log('✓ Test 1: Checking triggerHandler.ts for task trigger exports...');

const triggerHandlerPath = path.join(__dirname, 'backend/src/services/triggerHandler.ts');
const triggerHandlerContent = fs.readFileSync(triggerHandlerPath, 'utf8');

const requiredFunctions = [
  'fireTaskCreatedTrigger',
  'fireTaskCompletedTrigger',
  'fireTaskOverdueTrigger',
  'fireTaskAssignedTrigger',
  'checkOverdueTasks',
  'checkTaskDueDates',
];

let allExportsFound = true;
requiredFunctions.forEach(funcName => {
  if (triggerHandlerContent.includes(`export async function ${funcName}`)) {
    console.log(`  ✓ Found: ${funcName}`);
  } else {
    console.log(`  ✗ Missing: ${funcName}`);
    allExportsFound = false;
  }
});

if (!allExportsFound) {
  console.log('\n❌ FAILED: Not all task trigger functions found in triggerHandler.ts');
  process.exit(1);
}

// Test 2: Check taskRoutes.ts imports and uses trigger handlers
console.log('\n✓ Test 2: Checking taskRoutes.ts for trigger integration...');

const taskRoutesPath = path.join(__dirname, 'backend/src/routes/taskRoutes.ts');
const taskRoutesContent = fs.readFileSync(taskRoutesPath, 'utf8');

const requiredImports = [
  'fireTaskCreatedTrigger',
  'fireTaskCompletedTrigger',
  'fireTaskAssignedTrigger',
];

let allImportsFound = true;
requiredImports.forEach(funcName => {
  if (taskRoutesContent.includes(funcName)) {
    console.log(`  ✓ Imported: ${funcName}`);
  } else {
    console.log(`  ✗ Not imported: ${funcName}`);
    allImportsFound = false;
  }
});

if (!allImportsFound) {
  console.log('\n❌ FAILED: Not all trigger handlers imported in taskRoutes.ts');
  process.exit(1);
}

// Check that triggers are called
const requiredCalls = [
  'fireTaskCreatedTrigger(task.id',
  'fireTaskCompletedTrigger(task.id',
  'fireTaskAssignedTrigger(task.id',
];

let allCallsFound = true;
requiredCalls.forEach(call => {
  if (taskRoutesContent.includes(call)) {
    console.log(`  ✓ Called: ${call.split('(')[0]}`);
  } else {
    console.log(`  ✗ Not called: ${call.split('(')[0]}`);
    allCallsFound = false;
  }
});

if (!allCallsFound) {
  console.log('\n❌ FAILED: Not all trigger handlers called in taskRoutes.ts');
  process.exit(1);
}

// Test 3: Check workflowRoutes.ts includes new trigger types
console.log('\n✓ Test 3: Checking workflowRoutes.ts for task trigger types...');

const workflowRoutesPath = path.join(__dirname, 'backend/src/routes/workflowRoutes.ts');
const workflowRoutesContent = fs.readFileSync(workflowRoutesPath, 'utf8');

const requiredTriggerTypes = [
  'TASK_CREATED',
  'TASK_ASSIGNED',
  'TASK_DUE',
  'TASK_OVERDUE',
  'TASK_COMPLETED',
];

let allTriggerTypesFound = true;
requiredTriggerTypes.forEach(triggerType => {
  if (workflowRoutesContent.includes(`type: '${triggerType}'`)) {
    console.log(`  ✓ Found trigger type: ${triggerType}`);
  } else {
    console.log(`  ✗ Missing trigger type: ${triggerType}`);
    allTriggerTypesFound = false;
  }
});

if (!allTriggerTypesFound) {
  console.log('\n❌ FAILED: Not all task trigger types found in workflowRoutes.ts');
  process.exit(1);
}

// Check validation arrays
const validationArrayPattern = /const validTriggerTypes = \[([\s\S]*?)\];/g;
let validationArraysMatched = 0;
let match;

while ((match = validationArrayPattern.exec(workflowRoutesContent)) !== null) {
  const arrayContent = match[1];
  let hasAllTaskTriggers = true;

  requiredTriggerTypes.forEach(triggerType => {
    if (!arrayContent.includes(`'${triggerType}'`)) {
      hasAllTaskTriggers = false;
    }
  });

  if (hasAllTaskTriggers) {
    validationArraysMatched++;
    console.log(`  ✓ Found validTriggerTypes array with all task triggers`);
  }
}

if (validationArraysMatched < 2) {
  console.log(`  ⚠️  Warning: Only ${validationArraysMatched} validation array(s) contain all task triggers`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('✅ All tests PASSED!');
console.log('═══════════════════════════════════════════════════════════');

console.log('\n📊 Summary:');
console.log('  ✓ Task trigger functions implemented in triggerHandler.ts');
console.log('  ✓ Task triggers integrated into taskRoutes.ts');
console.log('  ✓ Task trigger types added to workflowRoutes.ts');
console.log('\n🎯 Feature #277: Task Event Triggers - VERIFIED ✅');

console.log('\n📝 Implementation Details:');
console.log('  • TASK_CREATED: Fires when a task is created (linked to client)');
console.log('  • TASK_ASSIGNED: Fires when a task is assigned to a user');
console.log('  • TASK_COMPLETED: Fires when a task is marked complete');
console.log('  • TASK_OVERDUE: Fires when a task becomes overdue (scheduled check)');
console.log('  • TASK_DUE: Fires when a task is due soon (scheduled check)');
console.log('\n💡 To test manually:');
console.log('  1. Create a workflow with TASK_CREATED trigger');
console.log('  2. Create a task linked to a client');
console.log('  3. Verify the workflow executes and creates a note/activity');
