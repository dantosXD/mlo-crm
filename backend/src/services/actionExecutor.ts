import prisma from '../utils/prisma.js';
import { decrypt } from '../utils/crypto.js';

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

/**
 * Communication action configuration
 */
interface CommunicationActionConfig {
  templateId?: string;
  to?: string; // Override recipient email/phone
  subject?: string; // Override subject (for EMAIL/LETTER)
  body?: string; // Override body
}

/**
 * Replace placeholders in template with values from context
 * Supported placeholders: {{client_name}}, {{client_email}}, {{client_phone}},
 * {{client_status}}, {{trigger_type}}, {{date}}, {{time}}
 */
function replacePlaceholders(template: string, context: ExecutionContext & { clientData?: any }): string {
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

  let result = template;
  Object.entries(placeholders).forEach(([key, value]) => {
    result = result.replace(new RegExp(key, 'g'), value);
  });

  return result;
}

/**
 * Fetch client data and decrypt it
 */
async function getClientData(clientId: string) {
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
  const tags = JSON.parse(client.tags);

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
 * Execute SEND_EMAIL action
 * Creates a communication record with status SENT
 */
export async function executeSendEmail(
  config: CommunicationActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    // Fetch client data
    const client = await getClientData(context.clientId);

    // Get template if provided
    let subject = config.subject;
    let body = config.body;
    let templateName = '';

    if (config.templateId) {
      const template = await prisma.communicationTemplate.findUnique({
        where: { id: config.templateId },
      });

      if (!template) {
        return {
          success: false,
          message: `Email template not found: ${config.templateId}`,
        };
      }

      if (template.type !== 'EMAIL') {
        return {
          success: false,
          message: `Template is not an email template: ${template.type}`,
        };
      }

      templateName = template.name;
      subject = template.subject || subject;
      body = template.body || body;
    }

    if (!body) {
      return {
        success: false,
        message: 'Email body is required',
      };
    }

    // Replace placeholders
    const placeholderContext = {
      ...context,
      clientData: client,
    };

    const finalBody = replacePlaceholders(body, placeholderContext);
    const finalSubject = subject ? replacePlaceholders(subject, placeholderContext) : undefined;
    const toEmail = config.to || client.email;

    // Create communication record with status SENT
    const communication = await prisma.communication.create({
      data: {
        clientId: context.clientId,
        type: 'EMAIL',
        status: 'SENT',
        subject: finalSubject || '',
        body: finalBody,
        templateId: config.templateId,
        sentAt: new Date(),
        createdById: context.userId,
        metadata: JSON.stringify({
          workflow: true,
          templateName,
          to: toEmail,
        }),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: context.clientId,
        userId: context.userId,
        type: 'COMMUNICATION_SENT',
        description: `Email sent via workflow: ${finalSubject || '(no subject)'}`,
        metadata: JSON.stringify({
          communicationId: communication.id,
          type: 'EMAIL',
          templateName,
        }),
      },
    });

    return {
      success: true,
      message: 'Email sent successfully',
      data: {
        communicationId: communication.id,
        type: 'EMAIL',
        to: toEmail,
        subject: finalSubject,
      },
    };
  } catch (error) {
    console.error('Error executing SEND_EMAIL action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Execute SEND_SMS action
 * Creates a communication record with status SENT
 */
export async function executeSendSms(
  config: CommunicationActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    // Fetch client data
    const client = await getClientData(context.clientId);

    // Get template if provided
    let body = config.body;
    let templateName = '';

    if (config.templateId) {
      const template = await prisma.communicationTemplate.findUnique({
        where: { id: config.templateId },
      });

      if (!template) {
        return {
          success: false,
          message: `SMS template not found: ${config.templateId}`,
        };
      }

      if (template.type !== 'SMS') {
        return {
          success: false,
          message: `Template is not an SMS template: ${template.type}`,
        };
      }

      templateName = template.name;
      body = template.body || body;
    }

    if (!body) {
      return {
        success: false,
        message: 'SMS body is required',
      };
    }

    // Replace placeholders
    const placeholderContext = {
      ...context,
      clientData: client,
    };

    const finalBody = replacePlaceholders(body, placeholderContext);
    const toPhone = config.to || client.phone;

    // Create communication record with status SENT
    const communication = await prisma.communication.create({
      data: {
        clientId: context.clientId,
        type: 'SMS',
        status: 'SENT',
        body: finalBody,
        templateId: config.templateId,
        sentAt: new Date(),
        createdById: context.userId,
        metadata: JSON.stringify({
          workflow: true,
          templateName,
          to: toPhone,
        }),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: context.clientId,
        userId: context.userId,
        type: 'COMMUNICATION_SENT',
        description: `SMS sent via workflow`,
        metadata: JSON.stringify({
          communicationId: communication.id,
          type: 'SMS',
          templateName,
        }),
      },
    });

    return {
      success: true,
      message: 'SMS sent successfully',
      data: {
        communicationId: communication.id,
        type: 'SMS',
        to: toPhone,
        body: finalBody,
      },
    };
  } catch (error) {
    console.error('Error executing SEND_SMS action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

/**
 * Execute GENERATE_LETTER action
 * Creates a communication record with status SENT for letter generation
 */
export async function executeGenerateLetter(
  config: CommunicationActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    // Fetch client data
    const client = await getClientData(context.clientId);

    // Get template if provided
    let subject = config.subject;
    let body = config.body;
    let templateName = '';

    if (config.templateId) {
      const template = await prisma.communicationTemplate.findUnique({
        where: { id: config.templateId },
      });

      if (!template) {
        return {
          success: false,
          message: `Letter template not found: ${config.templateId}`,
        };
      }

      if (template.type !== 'LETTER') {
        return {
          success: false,
          message: `Template is not a letter template: ${template.type}`,
        };
      }

      templateName = template.name;
      subject = template.subject || subject;
      body = template.body || body;
    }

    if (!body) {
      return {
        success: false,
        message: 'Letter body is required',
      };
    }

    // Replace placeholders
    const placeholderContext = {
      ...context,
      clientData: client,
    };

    const finalBody = replacePlaceholders(body, placeholderContext);
    const finalSubject = subject ? replacePlaceholders(subject, placeholderContext) : undefined;

    // Create communication record with status SENT
    const communication = await prisma.communication.create({
      data: {
        clientId: context.clientId,
        type: 'LETTER',
        status: 'SENT',
        subject: finalSubject || '',
        body: finalBody,
        templateId: config.templateId,
        sentAt: new Date(),
        createdById: context.userId,
        metadata: JSON.stringify({
          workflow: true,
          templateName,
          clientName: client.name,
        }),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: context.clientId,
        userId: context.userId,
        type: 'COMMUNICATION_SENT',
        description: `Letter generated via workflow: ${finalSubject || '(no title)'}`,
        metadata: JSON.stringify({
          communicationId: communication.id,
          type: 'LETTER',
          templateName,
        }),
      },
    });

    return {
      success: true,
      message: 'Letter generated successfully',
      data: {
        communicationId: communication.id,
        type: 'LETTER',
        subject: finalSubject,
        clientName: client.name,
      },
    };
  } catch (error) {
    console.error('Error executing GENERATE_LETTER action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate letter',
    };
  }
}

/**
 * Task action configuration
 */
interface TaskActionConfig {
  text?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDays?: number;
  dueDate?: Date;
  assignedToId?: string;
  assignedToRole?: string;
  taskId?: string; // For COMPLETE_TASK
}

/**
 * Execute CREATE_TASK action
 * Creates a new task linked to the trigger client
 */
export async function executeCreateTask(
  config: TaskActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    // Validate required fields
    if (!config.text) {
      return {
        success: false,
        message: 'Task text is required',
      };
    }

    // Calculate due date if dueDays is provided
    let dueDate: Date | null = null;
    if (config.dueDays) {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + config.dueDays);
    } else if (config.dueDate) {
      dueDate = config.dueDate;
    }

    // Determine assignee
    let assignedToId = config.assignedToId;
    if (!assignedToId && config.assignedToRole) {
      // Find first user with the specified role
      const user = await prisma.user.findFirst({
        where: {
          role: config.assignedToRole,
          isActive: true,
        },
      });
      assignedToId = user?.id;
    }

    // Default to workflow creator if no assignee specified
    if (!assignedToId) {
      assignedToId = context.userId;
    }

    // Replace placeholders in task text
    const client = await getClientData(context.clientId);
    const placeholderContext = {
      ...context,
      clientData: client,
    };

    const finalText = replacePlaceholders(config.text, placeholderContext);
    const finalDescription = config.description
      ? replacePlaceholders(config.description, placeholderContext)
      : null;

    // Create task
    const task = await prisma.task.create({
      data: {
        clientId: context.clientId,
        text: finalText,
        description: finalDescription,
        priority: config.priority || 'MEDIUM',
        dueDate,
        assignedToId,
        status: 'TODO',
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: context.clientId,
        userId: context.userId,
        type: 'TASK_CREATED',
        description: `Task created via workflow: ${finalText}`,
        metadata: JSON.stringify({
          taskId: task.id,
          priority: task.priority,
          dueDate: task.dueDate,
          assignedToId,
        }),
      },
    });

    return {
      success: true,
      message: 'Task created successfully',
      data: {
        taskId: task.id,
        text: finalText,
        priority: task.priority,
        dueDate: task.dueDate,
        assignedToId,
      },
    };
  } catch (error) {
    console.error('Error executing CREATE_TASK action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create task',
    };
  }
}

/**
 * Execute COMPLETE_TASK action
 * Marks an existing task as complete
 */
export async function executeCompleteTask(
  config: TaskActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.taskId) {
      return {
        success: false,
        message: 'Task ID is required to complete a task',
      };
    }

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id: config.taskId },
    });

    if (!task) {
      return {
        success: false,
        message: `Task not found: ${config.taskId}`,
      };
    }

    // Check if task is already complete
    if (task.status === 'COMPLETE') {
      return {
        success: true,
        message: 'Task is already complete',
        data: {
          taskId: task.id,
          status: task.status,
        },
      };
    }

    // Update task to complete
    const updatedTask = await prisma.task.update({
      where: { id: config.taskId },
      data: {
        status: 'COMPLETE',
        completedAt: new Date(),
      },
    });

    // Log activity
    if (task.clientId) {
      await prisma.activity.create({
        data: {
          clientId: task.clientId,
          userId: context.userId,
          type: 'TASK_COMPLETED',
          description: `Task completed via workflow: ${task.text}`,
          metadata: JSON.stringify({
            taskId: task.id,
          }),
        },
      });
    }

    return {
      success: true,
      message: 'Task completed successfully',
      data: {
        taskId: updatedTask.id,
        status: updatedTask.status,
        completedAt: updatedTask.completedAt,
      },
    };
  } catch (error) {
    console.error('Error executing COMPLETE_TASK action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to complete task',
    };
  }
}

/**
 * Execute ASSIGN_TASK action
 * Assigns or reassigns a task to a user
 */
export async function executeAssignTask(
  config: TaskActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.taskId) {
      return {
        success: false,
        message: 'Task ID is required to assign a task',
      };
    }

    if (!config.assignedToId && !config.assignedToRole) {
      return {
        success: false,
        message: 'Either assignedToId or assignedToRole must be specified',
      };
    }

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id: config.taskId },
    });

    if (!task) {
      return {
        success: false,
        message: `Task not found: ${config.taskId}`,
      };
    }

    // Determine assignee
    let assignedToId = config.assignedToId;
    if (!assignedToId && config.assignedToRole) {
      // Find first user with the specified role
      const user = await prisma.user.findFirst({
        where: {
          role: config.assignedToRole,
          isActive: true,
        },
      });
      assignedToId = user?.id;
    }

    if (!assignedToId) {
      return {
        success: false,
        message: `No active user found with role: ${config.assignedToRole}`,
      };
    }

    // Update task assignment
    const updatedTask = await prisma.task.update({
      where: { id: config.taskId },
      data: {
        assignedToId,
      },
    });

    // Get assignee details
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, name: true, email: true, role: true },
    });

    // Log activity
    if (task.clientId) {
      await prisma.activity.create({
        data: {
          clientId: task.clientId,
          userId: context.userId,
          type: 'TASK_ASSIGNED',
          description: `Task reassigned via workflow: ${task.text}`,
          metadata: JSON.stringify({
            taskId: task.id,
            assignedToId,
            assignedToName: assignee?.name,
          }),
        },
      });
    }

    return {
      success: true,
      message: 'Task assigned successfully',
      data: {
        taskId: updatedTask.id,
        assignedToId,
        assignedToName: assignee?.name,
      },
    };
  } catch (error) {
    console.error('Error executing ASSIGN_TASK action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to assign task',
    };
  }
}

/**
 * Client action configuration
 */
interface ClientActionConfig {
  status?: string;
  addTags?: string[]; // Array of tags to add
  removeTags?: string[]; // Array of tags to remove
  assignedToId?: string; // New owner for the client
}

/**
 * Execute UPDATE_CLIENT_STATUS action
 * Updates a client's status
 */
export async function executeUpdateClientStatus(
  config: ClientActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.status) {
      return {
        success: false,
        message: 'Status is required',
      };
    }

    // Valid status values
    const validStatuses = [
      'LEAD',
      'PRE_QUALIFIED',
      'ACTIVE',
      'PROCESSING',
      'UNDERWRITING',
      'CLEAR_TO_CLOSE',
      'CLOSED',
      'DENIED',
      'INACTIVE',
    ];

    if (!validStatuses.includes(config.status)) {
      return {
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      };
    }

    // Get current client
    const client = await prisma.client.findUnique({
      where: { id: context.clientId },
    });

    if (!client) {
      return {
        success: false,
        message: `Client not found: ${context.clientId}`,
      };
    }

    // Update client status
    const updatedClient = await prisma.client.update({
      where: { id: context.clientId },
      data: {
        status: config.status,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: context.clientId,
        userId: context.userId,
        type: 'STATUS_CHANGED',
        description: `Client status changed from ${client.status} to ${config.status} via workflow`,
        metadata: JSON.stringify({
          fromStatus: client.status,
          toStatus: config.status,
        }),
      },
    });

    return {
      success: true,
      message: 'Client status updated successfully',
      data: {
        clientId: updatedClient.id,
        fromStatus: client.status,
        toStatus: config.status,
      },
    };
  } catch (error) {
    console.error('Error executing UPDATE_CLIENT_STATUS action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update client status',
    };
  }
}

/**
 * Execute ADD_TAG action
 * Adds tags to a client
 */
export async function executeAddTag(
  config: ClientActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.addTags || config.addTags.length === 0) {
      return {
        success: false,
        message: 'Tags to add are required',
      };
    }

    // Get current client
    const client = await prisma.client.findUnique({
      where: { id: context.clientId },
    });

    if (!client) {
      return {
        success: false,
        message: `Client not found: ${context.clientId}`,
      };
    }

    // Parse existing tags
    const existingTags = JSON.parse(client.tags);
    const newTags = [...new Set([...existingTags, ...config.addTags])]; // Deduplicate

    // Update client tags
    const updatedClient = await prisma.client.update({
      where: { id: context.clientId },
      data: {
        tags: JSON.stringify(newTags),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: context.clientId,
        userId: context.userId,
        type: 'TAGS_ADDED',
        description: `Tags added via workflow: ${config.addTags.join(', ')}`,
        metadata: JSON.stringify({
          addedTags: config.addTags,
          allTags: newTags,
        }),
      },
    });

    return {
      success: true,
      message: 'Tags added successfully',
      data: {
        clientId: updatedClient.id,
        addedTags: config.addTags,
        allTags: newTags,
      },
    };
  } catch (error) {
    console.error('Error executing ADD_TAG action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add tags',
    };
  }
}

/**
 * Execute REMOVE_TAG action
 * Removes tags from a client
 */
export async function executeRemoveTag(
  config: ClientActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.removeTags || config.removeTags.length === 0) {
      return {
        success: false,
        message: 'Tags to remove are required',
      };
    }

    // Get current client
    const client = await prisma.client.findUnique({
      where: { id: context.clientId },
    });

    if (!client) {
      return {
        success: false,
        message: `Client not found: ${context.clientId}`,
      };
    }

    // Parse existing tags
    const existingTags = JSON.parse(client.tags);
    const newTags = existingTags.filter((tag: string) => !config.removeTags!.includes(tag));

    // Update client tags
    const updatedClient = await prisma.client.update({
      where: { id: context.clientId },
      data: {
        tags: JSON.stringify(newTags),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: context.clientId,
        userId: context.userId,
        type: 'TAGS_REMOVED',
        description: `Tags removed via workflow: ${config.removeTags.join(', ')}`,
        metadata: JSON.stringify({
          removedTags: config.removeTags,
          remainingTags: newTags,
        }),
      },
    });

    return {
      success: true,
      message: 'Tags removed successfully',
      data: {
        clientId: updatedClient.id,
        removedTags: config.removeTags,
        remainingTags: newTags,
      },
    };
  } catch (error) {
    console.error('Error executing REMOVE_TAG action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove tags',
    };
  }
}

/**
 * Execute ASSIGN_CLIENT action
 * Assigns or reassigns a client to a different user
 */
export async function executeAssignClient(
  config: ClientActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.assignedToId) {
      return {
        success: false,
        message: 'assignedToId is required',
      };
    }

    // Get current client
    const client = await prisma.client.findUnique({
      where: { id: context.clientId },
    });

    if (!client) {
      return {
        success: false,
        message: `Client not found: ${context.clientId}`,
      };
    }

    // Verify new owner exists
    const newOwner = await prisma.user.findUnique({
      where: { id: config.assignedToId },
    });

    if (!newOwner) {
      return {
        success: false,
        message: `User not found: ${config.assignedToId}`,
      };
    }

    // Update client owner
    const updatedClient = await prisma.client.update({
      where: { id: context.clientId },
      data: {
        createdById: config.assignedToId,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: context.clientId,
        userId: context.userId,
        type: 'CLIENT_ASSIGNED',
        description: `Client reassigned via workflow`,
        metadata: JSON.stringify({
          fromUserId: client.createdById,
          toUserId: config.assignedToId,
          toUserName: newOwner.name,
        }),
      },
    });

    return {
      success: true,
      message: 'Client assigned successfully',
      data: {
        clientId: updatedClient.id,
        fromUserId: client.createdById,
        toUserId: config.assignedToId,
        toUserName: newOwner.name,
      },
    };
  } catch (error) {
    console.error('Error executing ASSIGN_CLIENT action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to assign client',
    };
  }
}

/**
 * Document action configuration
 */
interface DocumentActionConfig {
  status?: string; // New status for UPDATE_DOCUMENT_STATUS
  documentId?: string; // Specific document to update (optional)
  category?: string; // Document category for REQUEST_DOCUMENT
  name?: string; // Document name for REQUEST_DOCUMENT
  dueDays?: number; // Days until due for REQUEST_DOCUMENT
  dueDate?: Date; // Specific due date for REQUEST_DOCUMENT
  message?: string; // Optional message for REQUEST_DOCUMENT
}

/**
 * Execute UPDATE_DOCUMENT_STATUS action
 * Updates one or more documents' status for a client
 */
export async function executeUpdateDocumentStatus(
  config: DocumentActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.status) {
      return {
        success: false,
        message: 'Status is required for UPDATE_DOCUMENT_STATUS action',
      };
    }

    // Valid status values
    const validStatuses = [
      'REQUIRED',
      'REQUESTED',
      'UPLOADED',
      'UNDER_REVIEW',
      'APPROVED',
      'REJECTED',
      'EXPIRED',
    ];

    if (!validStatuses.includes(config.status)) {
      return {
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      };
    }

    // If documentId is specified, update only that document
    if (config.documentId) {
      const document = await prisma.document.findUnique({
        where: { id: config.documentId },
      });

      if (!document) {
        return {
          success: false,
          message: `Document not found: ${config.documentId}`,
        };
      }

      if (document.clientId !== context.clientId) {
        return {
          success: false,
          message: 'Document does not belong to the trigger client',
        };
      }

      // Update single document
      const updatedDocument = await prisma.document.update({
        where: { id: config.documentId },
        data: {
          status: config.status,
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          clientId: context.clientId,
          userId: context.userId,
          type: 'DOCUMENT_STATUS_CHANGED',
          description: `Document "${updatedDocument.name}" status changed to ${config.status} via workflow`,
          metadata: JSON.stringify({
            documentId: updatedDocument.id,
            documentName: updatedDocument.name,
            fromStatus: document.status,
            toStatus: config.status,
          }),
        },
      });

      return {
        success: true,
        message: 'Document status updated successfully',
        data: {
          documentId: updatedDocument.id,
          documentName: updatedDocument.name,
          fromStatus: document.status,
          toStatus: config.status,
        },
      };
    }

    // If no documentId, update all documents for the client
    const documents = await prisma.document.findMany({
      where: {
        clientId: context.clientId,
      },
    });

    if (documents.length === 0) {
      return {
        success: false,
        message: 'No documents found for client',
      };
    }

    // Update all documents
    const updatePromises = documents.map((doc) =>
      prisma.document.update({
        where: { id: doc.id },
        data: {
          status: config.status,
        },
      })
    );

    const updatedDocuments = await Promise.all(updatePromises);

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: context.clientId,
        userId: context.userId,
        type: 'DOCUMENT_STATUS_CHANGED',
        description: `All documents (${updatedDocuments.length}) status changed to ${config.status} via workflow`,
        metadata: JSON.stringify({
          documentIds: updatedDocuments.map((d) => d.id),
          toStatus: config.status,
        }),
      },
    });

    return {
      success: true,
      message: `Updated ${updatedDocuments.length} document(s) to ${config.status}`,
      data: {
        count: updatedDocuments.length,
        documentIds: updatedDocuments.map((d) => d.id),
        toStatus: config.status,
      },
    };
  } catch (error) {
    console.error('Error executing UPDATE_DOCUMENT_STATUS action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update document status',
    };
  }
}

/**
 * Execute REQUEST_DOCUMENT action
 * Creates a document request for the client
 */
export async function executeRequestDocument(
  config: DocumentActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    if (!config.category) {
      return {
        success: false,
        message: 'Document category is required for REQUEST_DOCUMENT action',
      };
    }

    // Valid categories
    const validCategories = [
      'INCOME',
      'EMPLOYMENT',
      'ASSETS',
      'PROPERTY',
      'INSURANCE',
      'CREDIT',
      'OTHER',
    ];

    if (!validCategories.includes(config.category)) {
      return {
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      };
    }

    // Determine document name
    let documentName = config.name;
    if (!documentName) {
      // Use category as default name
      documentName = `${config.category.charAt(0).toUpperCase() + config.category.slice(1).toLowerCase()} Document`;
    }

    // Calculate due date
    let dueDate: Date | null = null;
    if (config.dueDays) {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + config.dueDays);
    } else if (config.dueDate) {
      dueDate = config.dueDate;
    }

    // Get client data for notification
    const client = await getClientData(context.clientId);

    // Create document record with REQUESTED status
    const document = await prisma.document.create({
      data: {
        clientId: context.clientId,
        name: documentName,
        fileName: '', // Will be filled when client uploads
        filePath: '',
        fileSize: 0,
        mimeType: 'application/octet-stream',
        status: 'REQUESTED',
        category: config.category,
        dueDate,
        notes: config.message || null,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: context.clientId,
        userId: context.userId,
        type: 'DOCUMENT_REQUESTED',
        description: `Document "${documentName}" requested from client via workflow`,
        metadata: JSON.stringify({
          documentId: document.id,
          documentName,
          category: config.category,
          dueDate,
        }),
      },
    });

    // In development mode, log the email to terminal instead of sending
    if (process.env.NODE_ENV === 'development') {
      console.log('\n========================================');
      console.log('📧 DOCUMENT REQUEST EMAIL (DEV MODE)');
      console.log('========================================');
      console.log(`To: ${client.email}`);
      console.log(`Subject: Document Request: ${documentName}`);
      console.log('\nBody:');
      console.log(`Dear ${client.name},`);
      console.log(`\nWe need you to provide the following document:`);
      console.log(`\nDocument: ${documentName}`);
      console.log(`Category: ${config.category}`);
      if (dueDate) console.log(`Due Date: ${dueDate.toLocaleDateString()}`);
      if (config.message) console.log(`\nMessage: ${config.message}`);
      console.log(`\nPlease upload this document through your client portal or contact us.`);
      console.log('\n========================================\n');
    }

    return {
      success: true,
      message: 'Document request sent successfully',
      data: {
        documentId: document.id,
        documentName,
        category: config.category,
        dueDate,
        emailLogged: process.env.NODE_ENV === 'development',
      },
    };
  } catch (error) {
    console.error('Error executing REQUEST_DOCUMENT action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to request document',
    };
  }
}

/**
 * Main dispatcher for document actions
 * Routes to the appropriate executor based on action type
 */
export async function executeDocumentAction(
  actionType: string,
  config: DocumentActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  switch (actionType) {
    case 'UPDATE_DOCUMENT_STATUS':
      return executeUpdateDocumentStatus(config, context);
    case 'REQUEST_DOCUMENT':
      return executeRequestDocument(config, context);
    default:
      return {
        success: false,
        message: `Unknown document action type: ${actionType}`,
      };
  }
}

/**
 * Main dispatcher for communication actions
 * Routes to the appropriate executor based on action type
 */
export async function executeCommunicationAction(
  actionType: string,
  config: CommunicationActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  switch (actionType) {
    case 'SEND_EMAIL':
      return executeSendEmail(config, context);
    case 'SEND_SMS':
      return executeSendSms(config, context);
    case 'GENERATE_LETTER':
      return executeGenerateLetter(config, context);
    default:
      return {
        success: false,
        message: `Unknown communication action type: ${actionType}`,
      };
  }
}
