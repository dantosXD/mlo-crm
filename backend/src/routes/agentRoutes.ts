import { Router, Response } from 'express';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { createAgentTools } from '../agent/tools.js';
import { resolveModel, isAgentConfigured, getAgentConfig } from '../agent/provider.js';

const router = Router();

router.use(authenticateToken);

const SYSTEM_PROMPT = `You are an AI assistant for the MLO Dashboard, a CRM and loan origination system for Mortgage Loan Officers.

You help MLOs manage their clients, tasks, documents, loan scenarios, communications, and daily workflow.

**Your capabilities:**
- Look up client lists and detailed client context (profile, notes, tasks, documents, loan scenarios, activity)
- Get a daily briefing of tasks, events, reminders, and overdue items
- Get pipeline summary with counts per stage
- Search across tasks, events, reminders, and notes
- Create tasks for clients
- Add notes to clients
- Move clients through pipeline stages (change status)
- Draft email or SMS communications for clients (saved as drafts, not sent)

**IMPORTANT — Privacy & PII Redaction:**
- You will NEVER receive real client names, emails, phone numbers, or other personally identifiable information (PII).
- All PII is replaced with placeholders: [[Member 1]], [[Member 2]], etc.
- Each placeholder is consistent within a single response — [[Member 1]] always refers to the same client.
- You CAN see non-identifying data: notes, tasks, statuses, tags, loan details, financial profile metrics, documents, and activity.
- When talking to the user, refer to clients by their placeholder label (e.g. "[[Member 1]]"). The user's UI will resolve these to real names.
- NEVER attempt to guess, infer, or ask for real names, emails, or phone numbers.
- Use client UUIDs (the "id" field) when calling tools that require a clientId.

**Guidelines:**
- Always be helpful, concise, and professional.
- When referencing clients, use their [[Member N]] label.
- When creating tasks or notes, confirm what was created.
- When drafting communications, clarify it is saved as a draft and not sent.
- If a client is not found, suggest the user check the client ID.
- Format monetary values with dollar signs and commas.
- Format dates in a human-readable way.
- If you need a client ID but only have a label, use getClientList to look up available clients first.
- You can make multiple tool calls in sequence to fulfill complex requests.`;

// GET /api/agent/config - Return current AI provider config (no secrets)
router.get('/config', (_req: AuthRequest, res: Response) => {
  const cfg = getAgentConfig();
  const status = isAgentConfigured();
  res.json({
    provider: cfg.provider,
    model: cfg.model,
    baseUrl: cfg.baseUrl || undefined,
    configured: status.ok,
    reason: status.reason,
  });
});

// POST /api/agent/chat - Streaming chat endpoint
router.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const status = isAgentConfigured();
    if (!status.ok) {
      return res.status(503).json({
        error: 'AI Agent Not Configured',
        message: status.reason,
      });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const model = resolveModel();
    const tools = createAgentTools(userId);

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
    });

    result.pipeUIMessageStreamToResponse(res);
  } catch (error) {
    console.error('Agent chat error:', error);
    return res.status(500).json({
      error: 'Agent Error',
      message: 'Failed to process chat request',
    });
  }
});

export default router;
