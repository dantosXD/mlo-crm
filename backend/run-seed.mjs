import { seedWorkflowTemplates } from './dist/scripts/seedWorkflowTemplates.js';

console.log('Starting seed script...');
await seedWorkflowTemplates();
console.log('Seed script completed!');
