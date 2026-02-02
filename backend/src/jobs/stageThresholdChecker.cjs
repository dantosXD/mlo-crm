/**
 * Stage Threshold Checker Job
 *
 * This scheduled job checks for clients that have been in a pipeline stage
 * too long and triggers TIME_IN_STAGE_THRESHOLD workflows.
 *
 * Should be run daily via cron or node-cron.
 *
 * Usage:
 *   node backend/dist/jobs/stageThresholdChecker.cjs
 *
 * Or set up in server.ts with node-cron:
 *   cron.schedule('0 9 * * *', () => checkTimeInStageThreshold());
 */

import { checkTimeInStageThreshold } from '../services/triggerHandler.js';

/**
 * Main function to run the stage threshold check
 */
async function runStageThresholdCheck() {
  console.log('[Stage Threshold Checker] Starting stage threshold check...');
  const startTime = Date.now();

  try {
    // Check for clients in stage too long (default 30 days)
    // You can also specify a specific stage: checkTimeInStageThreshold('UNDERWRITING', 30)
    await checkTimeInStageThreshold();

    const duration = Date.now() - startTime;
    console.log(`[Stage Threshold Checker] Completed in ${duration}ms`);
  } catch (error) {
    console.error('[Stage Threshold Checker] Failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runStageThresholdCheck()
    .then(() => {
      console.log('[Stage Threshold Checker] Finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Stage Threshold Checker] Failed:', error);
      process.exit(1);
    });
}

export { runStageThresholdCheck };
