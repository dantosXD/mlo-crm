import prisma from './prisma.js';

/**
 * Standard placeholder definitions
 * Format: {{placeholder_name}}
 */
export const PLACEHOLDERS = {
  client_name: {
    description: 'Full name of the client',
    example: 'John Smith',
  },
  client_email: {
    description: 'Email address of the client',
    example: 'john@example.com',
  },
  client_phone: {
    description: 'Phone number of the client',
    example: '(555) 123-4567',
  },
  client_status: {
    description: 'Current status of the client',
    example: 'Active',
  },
  loan_amount: {
    description: 'Loan amount from most recent loan scenario',
    example: '$350,000',
  },
  loan_officer_name: {
    description: 'Name of the loan officer',
    example: 'Jane Doe',
  },
  company_name: {
    description: 'Name of your company',
    example: 'ABC Mortgage',
  },
  due_date: {
    description: 'Due date for documents/tasks',
    example: 'January 15, 2026',
  },
  date: {
    description: 'Current date',
    example: 'February 2, 2026',
  },
  time: {
    description: 'Current time',
    example: '2:30 PM',
  },
  property_address: {
    description: 'Property address',
    example: '123 Main St, City, State 12345',
  },
  trigger_type: {
    description: 'Type of trigger that initiated the communication',
    example: 'Document Uploaded',
  },
} as const;

export type PlaceholderKey = keyof typeof PLACEHOLDERS;

/**
 * Extract all placeholders from a template string
 * @param text - Template text to search for placeholders
 * @returns Array of placeholder keys found in the text
 */
export function extractPlaceholders(text: string): string[] {
  if (!text) return [];

  // Match {{placeholder}} pattern
  const placeholderRegex = /\{\{(\w+)\}\}/g;
  const matches = text.match(placeholderRegex) || [];

  // Extract the key from {{key}}
  const keys = matches.map(match => {
    const key = match.replace(/\{\{|\}\}/g, '');
    return key;
  });

  // Return unique keys
  return Array.from(new Set(keys));
}

/**
 * Decrypt encrypted client data
 */
function decryptField(encrypted: string | null): string {
  if (!encrypted) return '';

  try {
    const parsed = JSON.parse(encrypted);
    return parsed.data || '';
  } catch {
    return encrypted;
  }
}

/**
 * Format currency amount
 */
function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format date
 */
function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Format time
 */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Get context data for placeholders
 * Fetches client, user, and loan scenario data
 */
export async function getPlaceholderContext(
  clientId: string,
  userId: string,
  additionalContext?: Record<string, any>
): Promise<Record<string, any>> {
  const context: Record<string, any> = {
    ...additionalContext,
  };

  // Fetch client data
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (client) {
    context.client_name = decryptField(client.nameEncrypted);
    context.client_email = decryptField(client.emailEncrypted);
    context.client_phone = decryptField(client.phoneEncrypted);
    context.client_status = client.status;
  }

  // Fetch user data (loan officer)
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (user) {
    context.loan_officer_name = user.name;
  }

  // Fetch most recent loan scenario for loan amount
  const loanScenario = await prisma.loanScenario.findFirst({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  });

  if (loanScenario) {
    context.loan_amount = formatCurrency(loanScenario.amount);
  }

  // Current date and time
  const now = new Date();
  context.date = formatDate(now);
  context.time = formatTime(now);

  // Company name (from environment or default)
  context.company_name = process.env.COMPANY_NAME || 'ABC Mortgage';

  // Property address (if available in additional context)
  if (additionalContext?.property_address) {
    context.property_address = additionalContext.property_address;
  }

  return context;
}

/**
 * Replace placeholders in text with actual values
 * @param text - Template text with placeholders
 * @param context - Object containing placeholder values
 * @returns Text with placeholders replaced
 */
export function replacePlaceholders(
  text: string,
  context: Record<string, any>
): string {
  if (!text) return '';

  let result = text;

  // Replace each placeholder with its value
  Object.entries(PLACEHOLDERS).forEach(([key, _]) => {
    const placeholder = `{{${key}}}`;
    const value = context[key] || `[${key}]`; // Use [key] as fallback for missing values

    // Replace all occurrences
    result = result.replaceAll(placeholder, value);
  });

  return result;
}

/**
 * Preview a communication template with placeholders filled
 * @param template - Template text with placeholders
 * @param clientId - Client ID to fetch context data
 * @param userId - User ID (loan officer)
 * @param additionalContext - Optional additional context data
 * @returns Object with original, filled, and detected placeholders
 */
export async function previewTemplate(
  template: string,
  clientId: string,
  userId: string,
  additionalContext?: Record<string, any>
): Promise<{
  original: string;
  filled: string;
  placeholders: string[];
  missing: string[];
  context: Record<string, any>;
}> {
  // Extract placeholders from template
  const extractedPlaceholders = extractPlaceholders(template);

  // Get context data
  const context = await getPlaceholderContext(clientId, userId, additionalContext);

  // Replace placeholders
  const filled = replacePlaceholders(template, context);

  // Find missing placeholders (those without values)
  const missing = extractedPlaceholders.filter(
    key => !context[key] && context[key] !== ''
  );

  return {
    original: template,
    filled,
    placeholders: extractedPlaceholders,
    missing,
    context,
  };
}

/**
 * Validate that all required placeholders have values
 * @param placeholders - Array of placeholder keys
 * @param context - Context object with values
 * @returns Object with validation result
 */
export function validatePlaceholders(
  placeholders: string[],
  context: Record<string, any>
): {
  isValid: boolean;
  missing: string[];
  present: string[];
} {
  const missing: string[] = [];
  const present: string[] = [];

  placeholders.forEach(key => {
    if (context[key] && context[key] !== '') {
      present.push(key);
    } else {
      missing.push(key);
    }
  });

  return {
    isValid: missing.length === 0,
    missing,
    present,
  };
}
