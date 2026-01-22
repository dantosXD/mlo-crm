import fs from 'fs';

const filePath = 'frontend/src/pages/ClientDetails.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add Box to Mantine imports
content = content.replace(
  '  FileInput,\n  Progress,\n}',
  '  FileInput,\n  Progress,\n  Box,\n}'
);

// Add Dropzone import after DateInput import
content = content.replace(
  "import { DateInput } from '@mantine/dates';\nimport { notifications } from '@mantine/notifications';",
  "import { DateInput } from '@mantine/dates';\nimport { Dropzone, FileWithPath } from '@mantine/dropzone';\nimport { notifications } from '@mantine/notifications';"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Imports updated successfully');
