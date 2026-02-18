import prisma from '../../utils/prisma.js';
import { ExecutionContext, ActionResult, replacePlaceholders, getClientData } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Communication action configuration
 */
interface CommunicationActionConfig {
  templateId?: string;
  to?: string;
  subject?: string;
  body?: string;
}

/**
 * Execute SEND_EMAIL action
 */
export async function executeSendEmail(
  config: CommunicationActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    const client = await getClientData(context.clientId);
    let subject = config.subject;
    let body = config.body;
    let templateName = '';

    if (config.templateId) {
      const template = await prisma.communicationTemplate.findUnique({ where: { id: config.templateId } });
      if (!template) return { success: false, message: `Email template not found: ${config.templateId}` };
      if (template.type !== 'EMAIL') return { success: false, message: `Template is not an email template: ${template.type}` };
      templateName = template.name;
      subject = template.subject || subject;
      body = template.body || body;
    }

    if (!body) return { success: false, message: 'Email body is required' };

    const placeholderContext = { ...context, clientData: client };
    const finalBody = replacePlaceholders(body, placeholderContext);
    const finalSubject = subject ? replacePlaceholders(subject, placeholderContext) : undefined;
    const toEmail = config.to || client.email;

    const communication = await prisma.communication.create({
      data: {
        clientId: context.clientId, type: 'EMAIL', status: 'SENT',
        subject: finalSubject || '', body: finalBody, templateId: config.templateId,
        sentAt: new Date(), createdById: context.userId,
        metadata: JSON.stringify({ workflow: true, templateName, to: toEmail }),
      },
    });

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'COMMUNICATION_SENT',
        description: `Email sent via workflow: ${finalSubject || '(no subject)'}`,
        metadata: JSON.stringify({ communicationId: communication.id, type: 'EMAIL', templateName }),
      },
    });

    return {
      success: true, message: 'Email sent successfully',
      data: { communicationId: communication.id, type: 'EMAIL', to: toEmail, subject: finalSubject },
    };
  } catch (error) {
    logger.error('action_send_email_failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: error instanceof Error ? error.message : 'Failed to send email' };
  }
}

/**
 * Execute SEND_SMS action
 */
export async function executeSendSms(
  config: CommunicationActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    const client = await getClientData(context.clientId);
    let body = config.body;
    let templateName = '';

    if (config.templateId) {
      const template = await prisma.communicationTemplate.findUnique({ where: { id: config.templateId } });
      if (!template) return { success: false, message: `SMS template not found: ${config.templateId}` };
      if (template.type !== 'SMS') return { success: false, message: `Template is not an SMS template: ${template.type}` };
      templateName = template.name;
      body = template.body || body;
    }

    if (!body) return { success: false, message: 'SMS body is required' };

    const placeholderContext = { ...context, clientData: client };
    const finalBody = replacePlaceholders(body, placeholderContext);
    const toPhone = config.to || client.phone;

    const communication = await prisma.communication.create({
      data: {
        clientId: context.clientId, type: 'SMS', status: 'SENT',
        body: finalBody, templateId: config.templateId,
        sentAt: new Date(), createdById: context.userId,
        metadata: JSON.stringify({ workflow: true, templateName, to: toPhone }),
      },
    });

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'COMMUNICATION_SENT',
        description: `SMS sent via workflow`,
        metadata: JSON.stringify({ communicationId: communication.id, type: 'SMS', templateName }),
      },
    });

    return {
      success: true, message: 'SMS sent successfully',
      data: { communicationId: communication.id, type: 'SMS', to: toPhone, body: finalBody },
    };
  } catch (error) {
    logger.error('action_send_sms_failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: error instanceof Error ? error.message : 'Failed to send SMS' };
  }
}

/**
 * Execute GENERATE_LETTER action
 */
export async function executeGenerateLetter(
  config: CommunicationActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    const client = await getClientData(context.clientId);
    let subject = config.subject;
    let body = config.body;
    let templateName = '';

    if (config.templateId) {
      const template = await prisma.communicationTemplate.findUnique({ where: { id: config.templateId } });
      if (!template) return { success: false, message: `Letter template not found: ${config.templateId}` };
      if (template.type !== 'LETTER') return { success: false, message: `Template is not a letter template: ${template.type}` };
      templateName = template.name;
      subject = template.subject || subject;
      body = template.body || body;
    }

    if (!body) return { success: false, message: 'Letter body is required' };

    const placeholderContext = { ...context, clientData: client };
    const finalBody = replacePlaceholders(body, placeholderContext);
    const finalSubject = subject ? replacePlaceholders(subject, placeholderContext) : undefined;

    const communication = await prisma.communication.create({
      data: {
        clientId: context.clientId, type: 'LETTER', status: 'SENT',
        subject: finalSubject || '', body: finalBody, templateId: config.templateId,
        sentAt: new Date(), createdById: context.userId,
        metadata: JSON.stringify({ workflow: true, templateName, clientName: client.name }),
      },
    });

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'COMMUNICATION_SENT',
        description: `Letter generated via workflow: ${finalSubject || '(no title)'}`,
        metadata: JSON.stringify({ communicationId: communication.id, type: 'LETTER', templateName }),
      },
    });

    return {
      success: true, message: 'Letter generated successfully',
      data: { communicationId: communication.id, type: 'LETTER', subject: finalSubject, clientName: client.name },
    };
  } catch (error) {
    logger.error('action_generate_letter_failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: error instanceof Error ? error.message : 'Failed to generate letter' };
  }
}

/**
 * Main dispatcher for communication actions
 */
export async function executeCommunicationAction(
  actionType: string,
  config: CommunicationActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  switch (actionType) {
    case 'SEND_EMAIL': return executeSendEmail(config, context);
    case 'SEND_SMS': return executeSendSms(config, context);
    case 'GENERATE_LETTER': return executeGenerateLetter(config, context);
    default: return { success: false, message: `Unknown communication action type: ${actionType}` };
  }
}
