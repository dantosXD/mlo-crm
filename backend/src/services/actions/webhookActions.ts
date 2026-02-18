import prisma from '../../utils/prisma.js';
import { ExecutionContext, ActionResult, replacePlaceholders, getClientData, sleep } from './types.js';
import { logger } from '../../utils/logger.js';

interface WebhookActionConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  bodyTemplate?: string;
  retryOnFailure?: boolean;
  maxRetries?: number;
  retryDelaySeconds?: number;
  timeoutSeconds?: number;
}

export async function executeCallWebhook(
  config: WebhookActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.url) return { success: false, message: 'Webhook URL is required' };

    try { new URL(config.url); } catch { return { success: false, message: 'Invalid webhook URL format' }; }

    const client = await getClientData(context.clientId);
    const placeholderContext = { ...context, clientData: client };

    const method = config.method || 'POST';
    const timeoutSeconds = config.timeoutSeconds || 30;
    const maxRetries = config.maxRetries ?? 3;
    const retryDelaySeconds = config.retryDelaySeconds ?? 5;

    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'MLO-Dashboard-Webhook/1.0', ...(config.headers || {}) };
    const processedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      processedHeaders[key] = replacePlaceholders(value, placeholderContext);
    }

    let body: string | undefined;
    if (config.bodyTemplate && ['POST', 'PUT', 'PATCH'].includes(method)) {
      const processedBody = replacePlaceholders(config.bodyTemplate, placeholderContext);
      try { JSON.parse(processedBody); body = processedBody; }
      catch { return { success: false, message: 'Invalid JSON body template after placeholder replacement' }; }
    }

    let lastError: Error | null = null;
    let attempt = 0;
    let response: { statusCode: number; headers: Record<string, string>; body: string } | null = null;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

        const fetchResponse = await fetch(config.url, { method, headers: processedHeaders, body, signal: controller.signal });
        clearTimeout(timeoutId);

        const responseBody = await fetchResponse.text();
        const responseHeaders: Record<string, string> = {};
        fetchResponse.headers.forEach((value, key) => { responseHeaders[key] = value; });
        response = { statusCode: fetchResponse.status, headers: responseHeaders, body: responseBody };

        if (fetchResponse.status >= 200 && fetchResponse.status < 300) {
          await prisma.activity.create({
            data: {
              clientId: context.clientId, userId: context.userId, type: 'WEBHOOK_CALLED',
              description: `Webhook called successfully: ${config.url}`,
              metadata: JSON.stringify({ url: config.url, method, statusCode: response.statusCode, attempt, retries: attempt - 1 }),
            },
          });
          return { success: true, message: 'Webhook called successfully', data: { url: config.url, method, statusCode: response.statusCode, attempt, retries: attempt - 1, responseBody: responseBody.slice(0, 1000) } };
        }

        lastError = new Error(`Webhook returned status ${fetchResponse.status}: ${responseBody.slice(0, 200)}`);
        if (fetchResponse.status >= 400 && fetchResponse.status < 500 && fetchResponse.status !== 429) break;
        if (config.retryOnFailure !== false && attempt <= maxRetries) {
          logger.warn('action_webhook_retry', { attempt, status: fetchResponse.status, retryDelaySeconds });
          await sleep(retryDelaySeconds * 1000);
          continue;
        }
        break;
      } catch (fetchError) {
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        if (config.retryOnFailure !== false && attempt <= maxRetries) {
          logger.warn('action_webhook_retry_network_error', { attempt, error: lastError.message, retryDelaySeconds });
          await sleep(retryDelaySeconds * 1000);
          continue;
        }
        break;
      }
    }

    const errorMessage = lastError?.message || 'Unknown error';
    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'WEBHOOK_FAILED',
        description: `Webhook call failed after ${attempt} attempts: ${config.url}`,
        metadata: JSON.stringify({ url: config.url, method, error: errorMessage, attempts: attempt, maxRetries }),
      },
    });

    return { success: false, message: `Webhook call failed after ${attempt} attempt(s): ${errorMessage}`, data: { url: config.url, method, attempts: attempt, lastResponse: response ? { statusCode: response.statusCode, body: response.body.slice(0, 500) } : null } };
  } catch (error) {
    logger.error('action_call_webhook_failed', { url: config.url, error: error instanceof Error ? error.message : String(error) });
    try {
      await prisma.activity.create({
        data: {
          clientId: context.clientId, userId: context.userId, type: 'WEBHOOK_FAILED',
          description: `Webhook execution error: ${config.url}`,
          metadata: JSON.stringify({ url: config.url, error: error instanceof Error ? error.message : String(error) }),
        },
      });
    } catch (logError) {
      logger.error('action_webhook_activity_log_failed', { error: logError instanceof Error ? logError.message : String(logError) });
    }
    return { success: false, message: error instanceof Error ? error.message : 'Failed to call webhook' };
  }
}

export async function executeWebhookAction(
  actionType: string,
  config: WebhookActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  switch (actionType) {
    case 'CALL_WEBHOOK': return executeCallWebhook(config, context);
    default: return { success: false, message: `Unknown webhook action type: ${actionType}` };
  }
}
