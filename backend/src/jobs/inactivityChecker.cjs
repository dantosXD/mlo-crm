/**
 * Inactivity Checker Job
 *
 * This scheduled job checks for inactive clients and triggers CLIENT_INACTIVITY workflows.
 * Should be run daily via cron or node-cron.
 *
 * Usage:
 *   node backend/dist/jobs/inactivityChecker.cjs
 *
 * Or set up in server.ts with node-cron:
 *   cron.schedule('0 9 * * *', () => checkInactiveClients());
 */

import { checkInactiveClients } from '../services/triggerHandler.js';

/**
 * Main function to run the inactivity check
 */
async function runInactivityCheck() {
  console.log('[Inactivity Checker] Starting inactivity check...');
  const startTime = Date.now();

  try {
    // Check for clients inactive for 7+ days (default threshold)
    await checkInactiveClients(7);

    const duration = Date.now() - startTime;
    console.log(`[Inactivity Checker] Completed in ${duration}ms`);
  } catch (error) {
    console.error('[Inactivity Checker] Failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runInactivityCheck()
    .then(() => {
      console.log('[Inactivity Checker] Finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Inactivity Checker] Failed:', error);
      process.exit(1);
    });
}

export { runInactivityCheck };
