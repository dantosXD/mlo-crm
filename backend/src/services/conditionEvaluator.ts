import prisma from '../utils/prisma.js';

/**
 * Condition evaluation context
 */
export interface ConditionContext {
  clientId: string;
  triggerType: string;
  triggerData: Record<string, any>;
}

/**
 * Condition definition
 */
export interface Condition {
  type: string;
  field?: string;
  operator?: string;
  value?: any;
  conditions?: Condition[]; // For nested AND/OR
}

/**
 * Result of condition evaluation
 */
export interface ConditionResult {
  success: boolean;
  matched: boolean;
  message?: string;
}

/**
 * Fetch client data for evaluation
 */
async function getClientData(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      documents: true,
    },
  });

  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  return client;
}

/**
 * Evaluate a single condition
 */
async function evaluateCondition(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const { type, field, operator, value } = condition;

  try {
    switch (type) {
      case 'CLIENT_STATUS_EQUALS':
        return await evaluateClientStatusEquals(condition, context);
      case 'CLIENT_HAS_TAG':
        return await evaluateClientHasTag(condition, context);
      case 'CLIENT_AGE_DAYS':
        return await evaluateClientAgeDays(condition, context);
      case 'CLIENT_MISSING_DOCUMENTS':
        return await evaluateClientMissingDocuments(condition, context);
      case 'AND':
        return await evaluateAndCondition(condition, context);
      case 'OR':
        return await evaluateOrCondition(condition, context);
      default:
        return {
          success: false,
          matched: false,
          message: `Unknown condition type: ${type}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      matched: false,
      message: error instanceof Error ? error.message : 'Condition evaluation failed',
    };
  }
}

/**
 * Condition: Client status equals
 * Checks if client.status matches the specified value
 */
async function evaluateClientStatusEquals(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const client = await getClientData(context.clientId);
  const expectedStatus = condition.value;

  if (!expectedStatus) {
    return {
      success: false,
      matched: false,
      message: 'CLIENT_STATUS_EQUALS requires a value',
    };
  }

  const matched = client.status === expectedStatus;

  return {
    success: true,
    matched,
    message: `Client status is ${client.status} (expected: ${expectedStatus})`,
  };
}

/**
 * Condition: Client has tag
 * Checks if client.tags array contains the specified tag
 */
async function evaluateClientHasTag(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const client = await getClientData(context.clientId);
  const tag = condition.value;

  if (!tag) {
    return {
      success: false,
      matched: false,
      message: 'CLIENT_HAS_TAG requires a value',
    };
  }

  const tags = JSON.parse(client.tags);
  const matched = tags.includes(tag);

  return {
    success: true,
    matched,
    message: matched
      ? `Client has tag: ${tag}`
      : `Client does not have tag: ${tag} (has: ${tags.join(', ')})`,
  };
}

/**
 * Condition: Client age in days
 * Checks if client's age (created date) meets the criteria
 * Operators: greater_than (gt), less_than (lt), equals (eq)
 */
async function evaluateClientAgeDays(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const client = await getClientData(context.clientId);
  const operator = condition.operator || 'greater_than';
  const days = condition.value;

  if (typeof days !== 'number') {
    return {
      success: false,
      matched: false,
      message: 'CLIENT_AGE_DAYS requires a numeric value',
    };
  }

  const now = new Date();
  const createdDate = new Date(client.createdAt);
  const ageInMs = now.getTime() - createdDate.getTime();
  const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

  let matched = false;
  switch (operator) {
    case 'greater_than':
    case 'gt':
      matched = ageInDays > days;
      break;
    case 'less_than':
    case 'lt':
      matched = ageInDays < days;
      break;
    case 'equals':
    case 'eq':
      matched = ageInDays === days;
      break;
    case 'greater_than_or_equal':
    case 'gte':
      matched = ageInDays >= days;
      break;
    case 'less_than_or_equal':
    case 'lte':
      matched = ageInDays <= days;
      break;
    default:
      return {
        success: false,
        matched: false,
        message: `Unknown operator: ${operator}`,
      };
  }

  return {
    success: true,
    matched,
    message: `Client is ${ageInDays} days old (${operator} ${days}: ${matched})`,
  };
}

/**
 * Condition: Client missing documents
 * Checks if client is missing documents of a specific category or any documents
 */
async function evaluateClientMissingDocuments(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const client = await getClientData(context.clientId);
  const category = condition.value; // Optional category filter

  // Filter documents by status (REQUIRED, REQUESTED, UPLOADED are missing)
  const missingDocs = client.documents.filter((doc: any) => {
    const isMissing = ['REQUIRED', 'REQUESTED'].includes(doc.status);
    if (category) {
      return isMissing && doc.category === category;
    }
    return isMissing;
  });

  const matched = missingDocs.length > 0;

  return {
    success: true,
    matched,
    message: matched
      ? `Client has ${missingDocs.length} missing document(s)${
          category ? ` in category: ${category}` : ''
        }`
      : `Client has all required documents${
          category ? ` in category: ${category}` : ''
        }`,
  };
}

/**
 * Condition: AND logic
 * All nested conditions must be true
 */
async function evaluateAndCondition(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  if (!condition.conditions || condition.conditions.length === 0) {
    return {
      success: false,
      matched: false,
      message: 'AND condition requires nested conditions',
    };
  }

  const results = await Promise.all(
    condition.conditions.map((c) => evaluateCondition(c, context))
  );

  const allMatched = results.every((r) => r.matched);
  const failedCondition = results.find((r) => !r.matched);

  return {
    success: true,
    matched: allMatched,
    message: allMatched
      ? 'All AND conditions matched'
      : `AND condition failed: ${failedCondition?.message}`,
  };
}

/**
 * Condition: OR logic
 * At least one nested condition must be true
 */
async function evaluateOrCondition(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  if (!condition.conditions || condition.conditions.length === 0) {
    return {
      success: false,
      matched: false,
      message: 'OR condition requires nested conditions',
    };
  }

  const results = await Promise.all(
    condition.conditions.map((c) => evaluateCondition(c, context))
  );

  const anyMatched = results.some((r) => r.matched);
  const matchedCondition = results.find((r) => r.matched);

  return {
    success: true,
    matched: anyMatched,
    message: anyMatched
      ? `OR condition matched: ${matchedCondition?.message}`
      : 'No OR conditions matched',
  };
}

/**
 * Main entry point: Evaluate conditions against context
 */
export async function evaluateConditions(
  conditions: Condition | Condition[],
  context: ConditionContext
): Promise<ConditionResult> {
  try {
    // Handle single condition
    if (!Array.isArray(conditions)) {
      return await evaluateCondition(conditions, context);
    }

    // Handle array of conditions (implicit AND)
    if (conditions.length === 0) {
      return {
        success: true,
        matched: true,
        message: 'No conditions to evaluate (default: matched)',
      };
    }

    // Multiple conditions without explicit logic = AND
    const andResult = await evaluateAndCondition(
      { type: 'AND', conditions },
      context
    );

    return andResult;
  } catch (error) {
    return {
      success: false,
      matched: false,
      message: error instanceof Error ? error.message : 'Condition evaluation failed',
    };
  }
}

/**
 * Test endpoint for condition evaluation (development only)
 */
export async function testConditionEvaluation(
  conditions: Condition | Condition[],
  clientId: string
): Promise<ConditionResult & { details?: any }> {
  const context: ConditionContext = {
    clientId,
    triggerType: 'MANUAL',
    triggerData: {},
  };

  const result = await evaluateConditions(conditions, context);

  return result;
}
