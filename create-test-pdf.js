const fs = require('fs');
const path = require('path');

// Create a simple test PDF file (minimal valid PDF)
const minimalPdf = Buffer.from(
  '%PDF-1.4\n' +
  '1 0 obj\n' +
  '<< /Type /Catalog /Pages 2 0 R >>\n' +
  'endobj\n' +
  '2 0 obj\n' +
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n' +
  'endobj\n' +
  '3 0 obj\n' +
  '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\n' +
  'endobj\n' +
  '4 0 obj\n' +
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n' +
  'endobj\n' +
  '5 0 obj\n' +
  '<< /Length 44 >>\n' +
  'stream\n' +
  'BT\n' +
  '/F1 12 Tf\n' +
  '100 700 Td\n' +
  '(Test PDF Document) Tj\n' +
  'ET\n' +
  'endstream\n' +
  'endobj\n' +
  'xref\n' +
  '0 6\n' +
  '0000000000 65535 f\n' +
  '0000000009 00000 n\n' +
  '0000000058 00000 n\n' +
  '0000000115 00000 n\n' +
  '0000000262 00000 n\n' +
  '0000000349 00000 n\n' +
  'trailer\n' +
  '<< /Size 6 /Root 1 0 R >>\n' +
  'startxref\n' +
  '429\n' +
  '%%EOF'
);

const testPdfPath = path.join(__dirname, 'test-document-48.pdf');
fs.writeFileSync(testPdfPath, minimalPdf);
console.log(`Test PDF created at: ${testPdfPath}`);
