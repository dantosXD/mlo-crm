/**
 * Standalone script to process scheduled communications
 * Can be run manually or scheduled via cron/node-cron
 *
 * Usage: node backend/dist/jobs/processScheduledCommunications.cjs
 */

import { processScheduledCommunications } from './processScheduledCommunications.js';

console.log('Processing scheduled communications...', new Date().toISOString());

const result = await processScheduledCommunications();

if (result.error) {
  console.error('Error:', result.error);
  process.exit(1);
}

console.log(result.message);
console.log(`Processed: ${result.processed} communications`);
