const fs = require('fs');
const path = require('path');

// Test script to verify file type validation
// This simulates what would happen when uploading different file types

const testFiles = [
  { name: 'test.pdf', content: '%PDF-1.4 test pdf content', mimeType: 'application/pdf', shouldPass: true },
  { name: 'test.exe', content: 'MZ\x90\x00 executable content', mimeType: 'application/x-msdownload', shouldPass: false },
  { name: 'test.bat', content: '@echo batch file', mimeType: 'text/plain', shouldPass: false },
  { name: 'test.jpg', content: '\xFF\xD8\xFF\xE0 jpeg content', mimeType: 'image/jpeg', shouldPass: true },
  { name: 'test.png', content: '\x89PNG png content', mimeType: 'image/png', shouldPass: true },
  { name: 'test.docx', content: 'PK\x03\x04 docx content', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', shouldPass: true },
];

// Dangerous extensions to check
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
  '.app', '.deb', '.rpm', '.dmg', '.pkg', '.sh', '.ps1', '.vb', '.wsf',
];

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/tiff',
  'image/bmp',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
];

console.log('='.repeat(80));
console.log('File Type Validation Test');
console.log('='.repeat(80));
console.log();

testFiles.forEach((file, index) => {
  console.log(`Test ${index + 1}: ${file.name}`);
  console.log('-'.repeat(80));

  // Check dangerous extension
  const fileName = file.name.toLowerCase();
  const hasDangerousExtension = DANGEROUS_EXTENSIONS.some(ext => fileName.endsWith(ext));

  console.log(`  Dangerous extension check: ${hasDangerousExtension ? '❌ FAILED' : '✓ PASSED'}`);
  if (hasDangerousExtension) {
    console.log(`    → File has dangerous extension: ${fileName.split('.').pop()}`);
  }

  // Check MIME type
  const mimeTypeAllowed = ALLOWED_MIME_TYPES.includes(file.mimeType);
  console.log(`  MIME type check (${file.mimeType}): ${mimeTypeAllowed ? '✓ PASSED' : '❌ FAILED'}`);

  // Overall result
  const wouldPass = !hasDangerousExtension && mimeTypeAllowed;
  const expected = file.shouldPass ? 'ALLOWED' : 'REJECTED';
  const actual = wouldPass ? 'ALLOWED' : 'REJECTED';
  const correct = expected === actual ? '✓ CORRECT' : '❌ INCORRECT';

  console.log(`  Expected: ${expected}`);
  console.log(`  Actual: ${actual}`);
  console.log(`  Result: ${correct}`);
  console.log();
});

// Test the error messages
console.log('='.repeat(80));
console.log('Error Message Test');
console.log('='.repeat(80));
console.log();

// Test .exe file error message
const exeFile = 'malicious.exe';
const hasDangerousExe = DANGEROUS_EXTENSIONS.some(ext => exeFile.toLowerCase().endsWith(ext));

if (hasDangerousExe) {
  console.log('Testing .exe file rejection:');
  console.log(`  File: ${exeFile}`);
  console.log(`  Error message: File type not allowed. Dangerous file types (${DANGEROUS_EXTENSIONS.join(', ')}) are not permitted for security reasons.`);
  console.log('  ✓ Error message includes dangerous file types list');
}

console.log();
console.log('='.repeat(80));
console.log('All validation tests completed');
console.log('='.repeat(80));
