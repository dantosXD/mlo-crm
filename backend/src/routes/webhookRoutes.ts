import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { fireWebhookTrigger } from '../services/triggerHandler.js';

const router = Router();

// =============================================================================
// WEBHOOK ENDPOINT
// =============================================================================

// POST /api/webhooks/:workflow_id - Receive webhook trigger from external systems
// This endpoint does NOT require authentication - it's for external systems
router.post('/:workflow_id', async (req: any, res: Response) => {
  try {
    const { workflow_id } = req.params;
    const signature = req.headers['x-webhook-signature'] as string | undefined;
    const payload = JSON.stringify(req.body);

    // Get workflow
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflow_id },
    });

    if (!workflow) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Workflow not found',
      });
    }

    if (!workflow.isActive) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Workflow is not active',
      });
    }

    if (workflow.triggerType !== 'WEBHOOK') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Workflow is not a webhook trigger',
      });
    }

    // Get webhook secret from trigger config
    const triggerConfig = workflow.triggerConfig ? JSON.parse(workflow.triggerConfig) : {};
    const secret = triggerConfig.secret;

    // Verify signature if secret is configured
    if (secret && signature) {
      const { verifyWebhookSignature } = await import('../services/triggerHandler.js');
      const isValid = verifyWebhookSignature(payload, signature, secret);

      if (!isValid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid webhook signature',
        });
      }
    } else if (secret && !signature) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Webhook signature is required',
      });
    }

    // Parse webhook payload
    const webhookData = req.body;
    let clientId: string | undefined;
    let userId: string | undefined;

    // Extract clientId and userId from payload if provided
    if (webhookData.clientId) {
      clientId = String(webhookData.clientId);
    }
    if (webhookData.userId) {
      userId = String(webhookData.userId);
    }

    // Validate clientId if provided
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Client not found',
        });
      }
    }

    // Fire webhook trigger
    await fireWebhookTrigger(workflow_id, webhookData, clientId, userId);

    res.json({
      success: true,
      message: 'Webhook received and workflow triggered',
      workflowId: workflow_id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to process webhook',
    });
  }
});

export default router;
