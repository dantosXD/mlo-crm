#!/usr/bin/env node
/**
 * Test script for Feature #281 - Webhook Trigger System
 *
 * This script tests the webhook trigger functionality:
 * 1. Creates a workflow with WEBHOOK trigger type
 * 2. Generates a webhook secret
 * 3. Sends a webhook request with signature verification
 * 4. Verifies the workflow executes correctly
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN; // Optional: for creating workflow

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Generate a webhook signature
 */
function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Get CSRF token
 */
async function getCsrfToken() {
  log('\n=== Getting CSRF Token ===', 'blue');

  try {
    const response = await fetch(`${API_URL}/api/csrf-token`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to get CSRF token');
    }

    const data = await response.json();
    log(`✓ CSRF token obtained`, 'green');
    return data.csrfToken;
  } catch (error) {
    log(`✗ Failed to get CSRF token: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Create a test workflow with WEBHOOK trigger
 */
async function createWebhookWorkflow(authToken, csrfToken) {
  log('\n=== Step 1: Creating Webhook Workflow ===', 'blue');

  // Generate a secret for this webhook
  const webhookSecret = crypto.randomBytes(16).toString('hex');

  const workflowData = {
    name: 'Test Webhook Workflow',
    description: 'Workflow triggered by external webhook',
    triggerType: 'WEBHOOK',
    triggerConfig: {
      secret: webhookSecret,
    },
    conditions: null,
    actions: [
      {
        type: 'ADD_NOTE',
        config: {
          text: 'Webhook triggered at: {{timestamp}}\nPayload: {{triggerData}}',
          tags: 'webhook,test',
        },
      },
    ],
    isActive: true,
  };

  try {
    const response = await fetch(`${API_URL}/api/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(workflowData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create workflow: ${JSON.stringify(error)}`);
    }

    const workflow = await response.json();
    log(`✓ Created workflow: ${workflow.id}`, 'green');
    log(`  Name: ${workflow.name}`, 'reset');
    log(`  Trigger: ${workflow.triggerType}`, 'reset');
    log(`  Secret: ${webhookSecret}`, 'yellow');

    return { workflow, webhookSecret };
  } catch (error) {
    log(`✗ Failed to create workflow: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Send a webhook request
 */
async function sendWebhook(workflowId, webhookSecret, payload) {
  log('\n=== Step 2: Sending Webhook Request ===', 'blue');

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, webhookSecret);

  log(`Payload: ${payloadString}`, 'reset');
  log(`Signature: ${signature}`, 'yellow');
  log(`URL: ${API_URL}/api/webhooks/${workflowId}`, 'reset');

  try {
    const response = await fetch(`${API_URL}/api/webhooks/${workflowId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body: payloadString,
    });

    const result = await response.json();

    if (!response.ok) {
      log(`✗ Webhook failed: ${JSON.stringify(result)}`, 'red');
      return { success: false, result };
    }

    log(`✓ Webhook received successfully`, 'green');
    log(`  Message: ${result.message}`, 'reset');
    log(`  Timestamp: ${result.timestamp}`, 'reset');

    return { success: true, result };
  } catch (error) {
    log(`✗ Failed to send webhook: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Check workflow executions
 */
async function checkWorkflowExecutions(workflowId, authToken) {
  log('\n=== Step 3: Checking Workflow Executions ===', 'blue');

  try {
    const response = await fetch(`${API_URL}/api/workflows/${workflowId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch workflow');
    }

    const workflow = await response.json();
    const executions = workflow.executions || [];

    log(`Found ${executions.length} execution(s)`, 'reset');

    if (executions.length > 0) {
      const latestExecution = executions[0];
      log(`✓ Latest execution:`, 'green');
      log(`  ID: ${latestExecution.id}`, 'reset');
      log(`  Status: ${latestExecution.status}`, 'reset');
      log(`  Created: ${latestExecution.createdAt}`, 'reset');

      return latestExecution;
    } else {
      log(`✗ No executions found`, 'red');
      return null;
    }
  } catch (error) {
    log(`✗ Failed to check executions: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Main test function
 */
async function runTest() {
  log('========================================', 'blue');
  log('Feature #281: Webhook Trigger System Test', 'blue');
  log('========================================', 'blue');

  // Check for auth token
  if (!AUTH_TOKEN) {
    log('\n✗ AUTH_TOKEN environment variable not set', 'red');
    log('Please set AUTH_TOKEN to create test workflow', 'yellow');
    log('\nExample:', 'reset');
    log('  export AUTH_TOKEN="your-jwt-token"', 'reset');
    log('  node test-webhook-trigger.js', 'reset');
    process.exit(1);
  }

  try {
    // Step 0: Get CSRF token
    const csrfToken = await getCsrfToken();

    // Step 1: Create webhook workflow
    const { workflow, webhookSecret } = await createWebhookWorkflow(AUTH_TOKEN, csrfToken);

    // Wait a moment for workflow to be saved
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 2: Send webhook request
    const webhookPayload = {
      clientId: null, // Optional: link to a specific client
      userId: null, // Optional: specify user context
      testData: 'TEST_WEBHOOK_' + Date.now(),
      source: 'external-system',
      timestamp: new Date().toISOString(),
    };

    const webhookResult = await sendWebhook(workflow.id, webhookSecret, webhookPayload);

    if (!webhookResult.success) {
      throw new Error('Webhook request failed');
    }

    // Wait for workflow execution to complete
    log('\nWaiting for workflow execution...', 'yellow');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 3: Check workflow execution
    const execution = await checkWorkflowExecutions(workflow.id, AUTH_TOKEN);

    if (execution && execution.status === 'COMPLETED') {
      log('\n========================================', 'green');
      log('✓ WEBHOOK TRIGGER TEST PASSED', 'green');
      log('========================================', 'green');
      log('\nSummary:', 'blue');
      log(`  ✓ Workflow created with WEBHOOK trigger`, 'green');
      log(`  ✓ Webhook endpoint received request`, 'green');
      log(`  ✓ Signature verified successfully`, 'green');
      log(`  ✓ Workflow executed to completion`, 'green');
      log('\nWebhook URL:', 'blue');
      log(`  ${API_URL}/api/webhooks/${workflow.id}`, 'reset');
      log('\nWebhook Secret:', 'blue');
      log(`  ${webhookSecret}`, 'reset');
    } else {
      log('\n========================================', 'red');
      log('✗ WEBHOOK TRIGGER TEST FAILED', 'red');
      log('========================================', 'red');
      log(`Execution status: ${execution ? execution.status : 'NOT FOUND'}`, 'yellow');
    }

    // Cleanup: Ask if user wants to keep the workflow
    log('\n' + '='.repeat(50), 'blue');
    log(`Test workflow ID: ${workflow.id}`, 'yellow');
    log(`Workflow Name: ${workflow.name}`, 'yellow');
    log('='.repeat(50), 'blue');
    log('You can test this webhook endpoint with:', 'reset');
    log(`  curl -X POST ${API_URL}/api/webhooks/${workflow.id} \\`, 'reset');
    log(`    -H "Content-Type: application/json" \\`, 'reset');
    log(`    -H "X-Webhook-Signature: <signature>" \\`, 'reset');
    log(`    -d '{"test": "data"}'`, 'reset');
    log('\nTo generate signature:', 'reset');
    log(`  node -e "const crypto = require('crypto'); const payload = '{"test":"data"}'; const hmac = crypto.createHmac('sha256', '${webhookSecret}'); hmac.update(payload); console.log(hmac.digest('hex'));"`, 'reset');

  } catch (error) {
    log('\n========================================', 'red');
    log('✗ WEBHOOK TRIGGER TEST FAILED', 'red');
    log('========================================', 'red');
    log(`Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the test
runTest();
