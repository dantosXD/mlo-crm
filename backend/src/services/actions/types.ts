import prisma from '../../utils/prisma.js';
import { decrypt } from '../../utils/crypto.js';

/**
 * Context passed to action executors containing trigger data
 */
export interface ExecutionContext {
  clientId: string;
  triggerType: string;
  triggerData: Record<string, any>;
  userId: string;
}

/**
 * Result of executing an action
 */
export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, any>;
}

const PLACEHOLDER_ALIAS_GROUPS: string[][] = [
  ['fromStatus', 'from_status', 'old_status', 'oldStatus', 'previous_status', 'previousStatus'],
  ['toStatus', 'to_status', 'new_status', 'newStatus', 'next_status', 'nextStatus'],
  ['fromStage', 'from_stage', 'old_stage', 'oldStage', 'previous_stage', 'previousStage'],
  ['toStage', 'to_stage', 'new_stage', 'newStage', 'next_stage', 'nextStage'],
];

function toSnakeCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function getTriggerKeyAliases(key: string): string[] {
  const aliases = new Set<string>([key, toSnakeCase(key)]);

  PLACEHOLDER_ALIAS_GROUPS.forEach((group) => {
    if (group.includes(key)) {
      group.forEach((entry) => aliases.add(entry));
    }
  });

  return Array.from(aliases);
}

/**
 * Replace placeholders in template with values from context
 * Supported placeholders: {{client_name}}, {{client_email}}, {{client_phone}},
 * {{client_status}}, {{trigger_type}}, {{date}}, {{time}}
 */
export function replacePlaceholders(template: string, context: ExecutionContext & { clientData?: any }): string {
  const now = new Date();
  const placeholders: Record<string, string> = {
    '{{date}}': now.toLocaleDateString(),
    '{{time}}': now.toLocaleTimeString(),
    '{{trigger_type}}': context.triggerType,
  };

  // Add client data placeholders if available
  if (context.clientData) {
    placeholders['{{client_name}}'] = context.clientData.name || '';
    placeholders['{{client_email}}'] = context.clientData.email || '';
    placeholders['{{client_phone}}'] = context.clientData.phone || '';
    placeholders['{{client_status}}'] = context.clientData.status || '';
  }

  // Add trigger data placeholders and compatibility aliases (old/new + snake/camel forms).
  if (context.triggerData && typeof context.triggerData === 'object') {
    Object.entries(context.triggerData).forEach(([key, value]) => {
      const normalizedValue = String(value ?? '');
      getTriggerKeyAliases(key).forEach((aliasKey) => {
        placeholders[`{{${aliasKey}}}`] = normalizedValue;
      });
    });
  }

  let result = template;
  Object.entries(placeholders).forEach(([key, value]) => {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  });

  return result;
}

/**
 * Fetch client data and decrypt it
 */
export async function getClientData(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  // Decrypt client data
  const name = decrypt(client.nameEncrypted);
  const email = decrypt(client.emailEncrypted);
  const phone = decrypt(client.phoneEncrypted);
  const tags = client.tags ? JSON.parse(client.tags) : [];

  return {
    id: client.id,
    name,
    email,
    phone,
    status: client.status,
    tags,
  };
}

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
