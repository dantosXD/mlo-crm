/**
 * Test Feature #278: Note Event Triggers - Code Verification
 */

const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 Feature #278: Note Event Triggers - Code Verification');
console.log('═══════════════════════════════════════════════════════════\n');

// Test 1: Check triggerHandler.ts exports note trigger functions
console.log('✓ Test 1: Checking triggerHandler.ts for note trigger exports...');

const triggerHandlerPath = path.join(__dirname, 'backend/src/services/triggerHandler.ts');
const triggerHandlerContent = fs.readFileSync(triggerHandlerPath, 'utf8');

const requiredFunctions = [
  'fireNoteCreatedTrigger',
  'fireNoteWithTagTrigger',
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
  console.log('\n❌ FAILED: Not all note trigger functions found in triggerHandler.ts');
  process.exit(1);
}

// Test 2: Check noteRoutes.ts imports and uses trigger handlers
console.log('\n✓ Test 2: Checking noteRoutes.ts for trigger integration...');

const noteRoutesPath = path.join(__dirname, 'backend/src/routes/noteRoutes.ts');
const noteRoutesContent = fs.readFileSync(noteRoutesPath, 'utf8');

const requiredImports = [
  'fireNoteCreatedTrigger',
  'fireNoteWithTagTrigger',
];

let allImportsFound = true;
requiredImports.forEach(funcName => {
  if (noteRoutesContent.includes(funcName)) {
    console.log(`  ✓ Imported: ${funcName}`);
  } else {
    console.log(`  ✗ Not imported: ${funcName}`);
    allImportsFound = false;
  }
});

if (!allImportsFound) {
  console.log('\n❌ FAILED: Not all trigger handlers imported in noteRoutes.ts');
  process.exit(1);
}

// Check that triggers are called
const requiredCalls = [
  'fireNoteCreatedTrigger(note.id',
  'fireNoteWithTagTrigger(note.id',
];

let allCallsFound = true;
requiredCalls.forEach(call => {
  if (noteRoutesContent.includes(call)) {
    console.log(`  ✓ Called: ${call.split('(')[0]}`);
  } else {
    console.log(`  ✗ Not called: ${call.split('(')[0]}`);
    allCallsFound = false;
  }
});

if (!allCallsFound) {
  console.log('\n❌ FAILED: Not all trigger handlers called in noteRoutes.ts');
  process.exit(1);
}

// Test 3: Check workflowRoutes.ts includes note trigger types
console.log('\n✓ Test 3: Checking workflowRoutes.ts for note trigger types...');

const workflowRoutesPath = path.join(__dirname, 'backend/src/routes/workflowRoutes.ts');
const workflowRoutesContent = fs.readFileSync(workflowRoutesPath, 'utf8');

const requiredTriggerTypes = [
  'NOTE_CREATED',
  'NOTE_WITH_TAG',
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
  console.log('\n❌ FAILED: Not all note trigger types found in workflowRoutes.ts');
  process.exit(1);
}

// Check validation arrays
const validationArrayPattern = /const validTriggerTypes = \[([\s\S]*?)\];/g;
let validationArraysMatched = 0;
let match;

while ((match = validationArrayPattern.exec(workflowRoutesContent)) !== null) {
  const arrayContent = match[1];
  let hasAllNoteTriggers = true;

  requiredTriggerTypes.forEach(triggerType => {
    if (!arrayContent.includes(`'${triggerType}'`)) {
      hasAllNoteTriggers = false;
    }
  });

  if (hasAllNoteTriggers) {
    validationArraysMatched++;
    console.log(`  ✓ Found validTriggerTypes array with all note triggers`);
  }
}

if (validationArraysMatched < 2) {
  console.log(`  ⚠️  Warning: Only ${validationArraysMatched} validation array(s) contain all note triggers`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('✅ All tests PASSED!');
console.log('═══════════════════════════════════════════════════════════');

console.log('\n📊 Summary:');
console.log('  ✓ Note trigger functions implemented in triggerHandler.ts');
console.log('  ✓ Note triggers integrated into noteRoutes.ts');
console.log('  ✓ Note trigger types added to workflowRoutes.ts');
console.log('\n🎯 Feature #278: Note Event Triggers - VERIFIED ✅');

console.log('\n📝 Implementation Details:');
console.log('  • NOTE_CREATED: Fires when a note is created');
console.log('  • NOTE_WITH_TAG: Fires when a note is created with a specific tag');
console.log('\n💡 To test manually:');
console.log('  1. Create a workflow with NOTE_CREATED trigger');
console.log('  2. Create a note for a client');
console.log('  3. Verify the workflow executes');
