import prisma from '../utils/prisma.js';

/**
 * Condition evaluation context
 */
export interface ConditionContext {
  clientId: string;
  triggerType: string;
  triggerData: Record<string, any>;
  userId?: string; // Optional: user who triggered the workflow
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
      tasks: true,
      loanScenarios: true,
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
      case 'DOCUMENT_COUNT':
        return await evaluateDocumentCount(condition, context);
      case 'DOCUMENT_MISSING':
        return await evaluateDocumentMissing(condition, context);
      case 'TASK_COUNT':
        return await evaluateTaskCount(condition, context);
      case 'TASK_OVERDUE_EXISTS':
        return await evaluateTaskOverdueExists(condition, context);
      case 'LOAN_AMOUNT_THRESHOLD':
        return await evaluateLoanAmountThreshold(condition, context);
      case 'USER_ROLE_EQUALS':
        return await evaluateUserRoleEquals(condition, context);
      case 'TIME_OF_DAY':
        return await evaluateTimeOfDay(condition, context);
      case 'DAY_OF_WEEK':
        return await evaluateDayOfWeek(condition, context);
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
 * Condition: User role equals
 * Checks if the user who triggered the workflow has a specific role
 */
async function evaluateUserRoleEquals(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const expectedRole = condition.value;

  if (!expectedRole) {
    return {
      success: false,
      matched: false,
      message: 'USER_ROLE_EQUALS requires a value (role)',
    };
  }

  if (!context.userId) {
    return {
      success: false,
      matched: false,
      message: 'USER_ROLE_EQUALS requires userId in context',
    };
  }

  // Fetch user data
  const user = await prisma.user.findUnique({
    where: { id: context.userId },
  });

  if (!user) {
    return {
      success: false,
      matched: false,
      message: `User not found: ${context.userId}`,
    };
  }

  const matched = user.role === expectedRole;

  return {
    success: true,
    matched,
    message: `User role is ${user.role} (expected: ${expectedRole})`,
  };
}

/**
 * Condition: Time of day
 * Checks if current time is within a specific range
 * Value should be an object: { start: "HH:MM", end: "HH:MM" }
 * Example: { start: "09:00", end: "17:00" } for business hours
 */
async function evaluateTimeOfDay(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const timeRange = condition.value;

  if (!timeRange || !timeRange.start || !timeRange.end) {
    return {
      success: false,
      matched: false,
      message: 'TIME_OF_DAY requires value with start and end times (HH:MM format)',
    };
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  // Parse start time
  const [startHour, startMinute] = timeRange.start.split(':').map(Number);
  const startTimeInMinutes = startHour * 60 + startMinute;

  // Parse end time
  const [endHour, endMinute] = timeRange.end.split(':').map(Number);
  const endTimeInMinutes = endHour * 60 + endMinute;

  // Check if current time is within range
  let matched = false;
  if (startTimeInMinutes <= endTimeInMinutes) {
    // Normal range (e.g., 09:00 - 17:00)
    matched = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
  } else {
    // Overnight range (e.g., 22:00 - 06:00)
    matched = currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
  }

  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

  return {
    success: true,
    matched,
    message: `Current time is ${currentTimeStr} (range: ${timeRange.start} - ${timeRange.end})`,
  };
}

/**
 * Condition: Day of week
 * Checks if current day is in the specified list of days
 * Value should be an array of day numbers (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * or day names: ["Monday", "Tuesday", "Wednesday"]
 * Example: [1, 2, 3, 4, 5] for weekdays
 */
async function evaluateDayOfWeek(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const allowedDays = condition.value;

  if (!Array.isArray(allowedDays) || allowedDays.length === 0) {
    return {
      success: false,
      matched: false,
      message: 'DAY_OF_WEEK requires an array of days (numbers 0-6 or day names)',
    };
  }

  const now = new Date();
  const currentDayNumber = now.getDay(); // 0 = Sunday, 6 = Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[currentDayNumber];

  // Check if allowed days are numbers or strings
  let matched = false;
  if (typeof allowedDays[0] === 'number') {
    // Array of numbers
    matched = allowedDays.includes(currentDayNumber);
  } else if (typeof allowedDays[0] === 'string') {
    // Array of day names (case-insensitive)
    const normalizedAllowedDays = allowedDays.map((day: string) => day.toLowerCase());
    matched = normalizedAllowedDays.includes(currentDayName.toLowerCase());
  } else {
    return {
      success: false,
      matched: false,
      message: 'DAY_OF_WEEK days must be numbers (0-6) or day names',
    };
  }

  return {
    success: true,
    matched,
    message: `Current day is ${currentDayName} (${currentDayNumber}) - allowed: ${allowedDays.join(', ')}`,
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
 * Condition: Document count
 * Checks if client has a specific number of documents (with optional category filter)
 * Operators: greater_than (gt), less_than (lt), equals (eq), gte, lte
 */
async function evaluateDocumentCount(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const client = await getClientData(context.clientId);
  const operator = condition.operator || 'greater_than';
  const count = condition.value;
  const category = condition.field; // Optional category filter

  if (typeof count !== 'number') {
    return {
      success: false,
      matched: false,
      message: 'DOCUMENT_COUNT requires a numeric value',
    };
  }

  // Filter documents by category if specified
  const filteredDocs = category
    ? client.documents.filter((doc: any) => doc.category === category)
    : client.documents;

  const docCount = filteredDocs.length;

  let matched = false;
  switch (operator) {
    case 'greater_than':
    case 'gt':
      matched = docCount > count;
      break;
    case 'less_than':
    case 'lt':
      matched = docCount < count;
      break;
    case 'equals':
    case 'eq':
      matched = docCount === count;
      break;
    case 'greater_than_or_equal':
    case 'gte':
      matched = docCount >= count;
      break;
    case 'less_than_or_equal':
    case 'lte':
      matched = docCount <= count;
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
    message: `Client has ${docCount} document(s)${
      category ? ` in category: ${category}` : ''
    } (${operator} ${count}: ${matched})`,
  };
}

/**
 * Condition: Document missing
 * Checks if client is missing documents of a specific category
 * Returns true if there are missing documents in the specified category
 */
async function evaluateDocumentMissing(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const client = await getClientData(context.clientId);
  const category = condition.value; // Required category

  if (!category) {
    return {
      success: false,
      matched: false,
      message: 'DOCUMENT_MISSING requires a category value',
    };
  }

  // Check for missing documents in the specified category
  const missingDocs = client.documents.filter((doc: any) => {
    return doc.category === category && ['REQUIRED', 'REQUESTED'].includes(doc.status);
  });

  const matched = missingDocs.length > 0;

  return {
    success: true,
    matched,
    message: matched
      ? `Client has ${missingDocs.length} missing document(s) in category: ${category}`
      : `Client has all required documents in category: ${category}`,
  };
}

/**
 * Condition: Task count
 * Checks if client has a specific number of tasks (with optional status filter)
 * Operators: greater_than (gt), less_than (lt), equals (eq), gte, lte
 */
async function evaluateTaskCount(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const client = await getClientData(context.clientId);
  const operator = condition.operator || 'greater_than';
  const count = condition.value;
  const status = condition.field; // Optional status filter

  if (typeof count !== 'number') {
    return {
      success: false,
      matched: false,
      message: 'TASK_COUNT requires a numeric value',
    };
  }

  // Filter tasks by status if specified
  const filteredTasks = status
    ? client.tasks.filter((task: any) => task.status === status)
    : client.tasks;

  const taskCount = filteredTasks.length;

  let matched = false;
  switch (operator) {
    case 'greater_than':
    case 'gt':
      matched = taskCount > count;
      break;
    case 'less_than':
    case 'lt':
      matched = taskCount < count;
      break;
    case 'equals':
    case 'eq':
      matched = taskCount === count;
      break;
    case 'greater_than_or_equal':
    case 'gte':
      matched = taskCount >= count;
      break;
    case 'less_than_or_equal':
    case 'lte':
      matched = taskCount <= count;
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
    message: `Client has ${taskCount} task(s)${
      status ? ` with status: ${status}` : ''
    } (${operator} ${count}: ${matched})`,
  };
}

/**
 * Condition: Task overdue exists
 * Checks if client has any overdue tasks
 * Optionally filter by task count threshold
 */
async function evaluateTaskOverdueExists(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const client = await getClientData(context.clientId);
  const now = new Date();

  // Find overdue tasks (due date has passed and not complete)
  const overdueTasks = client.tasks.filter((task: any) => {
    return (
      task.dueDate &&
      new Date(task.dueDate) < now &&
      task.status !== 'COMPLETE'
    );
  });

  const hasOverdue = overdueTasks.length > 0;

  // If value is provided, check if count matches threshold
  if (condition.value !== undefined) {
    const threshold = condition.value;
    const operator = condition.operator || 'greater_than';

    let matched = false;
    switch (operator) {
      case 'greater_than':
      case 'gt':
        matched = overdueTasks.length > threshold;
        break;
      case 'less_than':
      case 'lt':
        matched = overdueTasks.length < threshold;
        break;
      case 'equals':
      case 'eq':
        matched = overdueTasks.length === threshold;
        break;
      case 'greater_than_or_equal':
      case 'gte':
        matched = overdueTasks.length >= threshold;
        break;
      case 'less_than_or_equal':
      case 'lte':
        matched = overdueTasks.length <= threshold;
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
      message: `Client has ${overdueTasks.length} overdue task(s) (${operator} ${threshold}: ${matched})`,
    };
  }

  // No threshold, just check existence
  return {
    success: true,
    matched: hasOverdue,
    message: hasOverdue
      ? `Client has ${overdueTasks.length} overdue task(s)`
      : 'Client has no overdue tasks',
  };
}

/**
 * Condition: Loan amount threshold
 * Checks if any of the client's loan scenarios meet the amount criteria
 * Operators: greater_than (gt), less_than (lt), equals (eq), gte, lte
 */
async function evaluateLoanAmountThreshold(
  condition: Condition,
  context: ConditionContext
): Promise<ConditionResult> {
  const client = await getClientData(context.clientId);
  const operator = condition.operator || 'greater_than';
  const amount = condition.value;

  if (typeof amount !== 'number') {
    return {
      success: false,
      matched: false,
      message: 'LOAN_AMOUNT_THRESHOLD requires a numeric value',
    };
  }

  if (client.loanScenarios.length === 0) {
    return {
      success: true,
      matched: false,
      message: 'Client has no loan scenarios',
    };
  }

  // Check if any loan scenario meets the criteria
  let matched = false;
  const matchingScenarios: any[] = [];

  for (const scenario of client.loanScenarios) {
    const loanAmount = scenario.amount;

    let scenarioMatches = false;
    switch (operator) {
      case 'greater_than':
      case 'gt':
        scenarioMatches = loanAmount > amount;
        break;
      case 'less_than':
      case 'lt':
        scenarioMatches = loanAmount < amount;
        break;
      case 'equals':
      case 'eq':
        scenarioMatches = loanAmount === amount;
        break;
      case 'greater_than_or_equal':
      case 'gte':
        scenarioMatches = loanAmount >= amount;
        break;
      case 'less_than_or_equal':
      case 'lte':
        scenarioMatches = loanAmount <= amount;
        break;
      default:
        return {
          success: false,
          matched: false,
          message: `Unknown operator: ${operator}`,
        };
    }

    if (scenarioMatches) {
      matched = true;
      matchingScenarios.push({
        name: scenario.name,
        amount: loanAmount,
      });
    }
  }

  return {
    success: true,
    matched,
    message: matched
      ? `Found ${matchingScenarios.length} loan scenario(s) matching amount criteria (${operator} ${amount}): ${matchingScenarios.map((s) => s.name).join(', ')}`
      : `No loan scenarios match amount criteria (${operator} ${amount})`,
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
