import prisma from '../utils/prisma.js';
import { previewTemplate } from '../utils/placeholders.js';
import { ServiceError } from './taskService.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function assertFound<T>(value: T | null | undefined, entity = 'Resource'): asserts value is T {
  if (value === null || value === undefined) {
    throw new ServiceError(404, 'Not Found', `${entity} not found`);
  }
}

function decryptName(encrypted: string | null): string {
  if (!encrypted) return 'Unknown';
  try {
    const parsed = JSON.parse(encrypted);
    return parsed.data || 'Unknown';
  } catch {
    return encrypted;
  }
}

function canAccessClientCommunication(userRole: string, userId: string, createdById: string): boolean {
  if (userRole === 'ADMIN' || userRole === 'MANAGER') return true;
  return userId === createdById;
}

const COMM_INCLUDE = {
  client: { select: { id: true, nameEncrypted: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  template: { select: { id: true, name: true } },
} as const;

const VALID_TYPES = ['EMAIL', 'SMS', 'LETTER'] as const;
const VALID_STATUSES = ['DRAFT', 'READY', 'SENT', 'FAILED'] as const;

function formatCommunication(c: any) {
  return {
    id: c.id,
    clientId: c.clientId,
    clientName: c.client ? decryptName(c.client.nameEncrypted) : 'Unknown',
    type: c.type,
    status: c.status,
    subject: c.subject,
    body: c.body,
    templateId: c.templateId,
    templateName: c.template?.name || null,
    ...(c.template && { template: c.template }),
    scheduledAt: c.scheduledAt,
    sentAt: c.sentAt,
    followUpDate: c.followUpDate,
    attachments: c.attachments ? JSON.parse(c.attachments) : [],
    createdBy: c.createdBy,
    metadata: c.metadata ? JSON.parse(c.metadata) : null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// ─── communications CRUD ────────────────────────────────────────────────────

export interface ListCommunicationsParams {
  userId: string;
  userRole: string;
  clientId?: string;
  type?: string;
  status?: string;
  scheduled?: string;
  followUp?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function listCommunications(params: ListCommunicationsParams) {
  const { userId, userRole, clientId, type, status, scheduled, followUp, startDate, endDate, page = 1, limit = 50 } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (clientId) where.clientId = clientId;
  if (type) where.type = type;
  if (status) where.status = status;
  if (scheduled === 'true') where.scheduledAt = { not: null };
  if (followUp === 'true') where.followUpDate = { not: null };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }
  if (userRole !== 'ADMIN' && userRole !== 'MANAGER') where.createdById = userId;

  const [communications, total] = await Promise.all([
    prisma.communication.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: COMM_INCLUDE }),
    prisma.communication.count({ where }),
  ]);

  return {
    data: communications.map(formatCommunication),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export interface SearchCommunicationsParams {
  userId: string;
  userRole: string;
  q: string;
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export async function searchCommunications(params: SearchCommunicationsParams) {
  const { userId, userRole, q, type, status, page = 1, limit = 50 } = params;
  const skip = (page - 1) * limit;

  if (!q.trim()) throw new ServiceError(400, 'Validation Error', 'Search query is required');

  const searchQuery = q.trim();
  const where: any = { OR: [{ subject: { contains: searchQuery } }, { body: { contains: searchQuery } }] };
  if (type) where.type = type;
  if (status) where.status = status;
  if (userRole !== 'ADMIN' && userRole !== 'MANAGER') where.createdById = userId;

  const [communications, _total] = await Promise.all([
    prisma.communication.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: COMM_INCLUDE }),
    prisma.communication.count({ where }),
  ]);

  // Also search by client name (encrypted, so must fetch & filter)
  const allClients = await prisma.client.findMany({
    where: userRole !== 'ADMIN' && userRole !== 'MANAGER' ? { createdById: userId } : {},
    select: { id: true, nameEncrypted: true },
  });

  const matchingClientIds = allClients
    .filter((c) => decryptName(c.nameEncrypted).toLowerCase().includes(searchQuery.toLowerCase()))
    .map((c) => c.id);

  let clientMatchCommunications: any[] = [];
  if (matchingClientIds.length > 0) {
    const clientWhere: any = { clientId: { in: matchingClientIds } };
    if (type) clientWhere.type = type;
    if (status) clientWhere.status = status;
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') clientWhere.createdById = userId;
    clientMatchCommunications = await prisma.communication.findMany({ where: clientWhere, orderBy: { createdAt: 'desc' }, include: COMM_INCLUDE });
  }

  // Merge & deduplicate
  const allResults = [...communications];
  const existingIds = new Set(communications.map((c) => c.id));
  clientMatchCommunications.forEach((c) => { if (!existingIds.has(c.id)) allResults.push(c); });

  const paginatedResults = allResults.slice(skip, skip + limit);

  return {
    data: paginatedResults.map(formatCommunication),
    pagination: { page, limit, total: allResults.length, totalPages: Math.ceil(allResults.length / limit) },
    query: searchQuery,
  };
}

export async function getCommunication(id: string, userId: string, userRole: string) {
  const communication = await prisma.communication.findUnique({
    where: { id },
    include: { ...COMM_INCLUDE, template: { select: { id: true, name: true, type: true } } },
  });
  assertFound(communication, 'Communication');
  if (!canAccessClientCommunication(userRole, userId, communication.createdById))
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to view this communication');
  return formatCommunication(communication);
}

export interface CreateCommunicationData {
  clientId: string;
  type: string;
  subject?: string;
  body: string;
  templateId?: string;
  scheduledAt?: string;
  followUpDate?: string;
  metadata?: any;
}

export async function createCommunication(data: CreateCommunicationData, userId: string) {
  if (!data.clientId || !data.type || !data.body)
    throw new ServiceError(400, 'Validation Error', 'Client ID, type, and body are required');
  if (!(VALID_TYPES as readonly string[]).includes(data.type))
    throw new ServiceError(400, 'Validation Error', `Type must be one of: ${VALID_TYPES.join(', ')}`);
  if ((data.type === 'EMAIL' || data.type === 'LETTER') && !data.subject)
    throw new ServiceError(400, 'Validation Error', 'Subject is required for EMAIL and LETTER types');

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  assertFound(client, 'Client');

  if (data.templateId) {
    const template = await prisma.communicationTemplate.findUnique({ where: { id: data.templateId } });
    assertFound(template, 'Communication template');
  }

  const communication = await prisma.communication.create({
    data: {
      clientId: data.clientId,
      type: data.type,
      subject: data.subject || null,
      body: data.body,
      templateId: data.templateId,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      status: 'DRAFT',
      createdById: userId,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    },
    include: COMM_INCLUDE,
  });

  await prisma.activity.create({
    data: {
      clientId: data.clientId,
      userId,
      type: 'COMMUNICATION_CREATED',
      description: `${data.type} communication draft created`,
      metadata: JSON.stringify({ communicationId: communication.id, type: data.type }),
    },
  });

  return formatCommunication(communication);
}

export interface UpdateCommunicationData {
  type?: string;
  subject?: string;
  body?: string;
  templateId?: string;
  scheduledAt?: string;
  followUpDate?: string;
  status?: string;
  metadata?: any;
}

export async function updateCommunication(id: string, data: UpdateCommunicationData, userId: string, userRole: string) {
  const existing = await prisma.communication.findUnique({ where: { id } });
  assertFound(existing, 'Communication');
  if (!canAccessClientCommunication(userRole, userId, existing.createdById))
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to update this communication');

  if (data.type && !(VALID_TYPES as readonly string[]).includes(data.type))
    throw new ServiceError(400, 'Validation Error', `Type must be one of: ${VALID_TYPES.join(', ')}`);

  const commType = data.type || existing.type;
  if ((commType === 'EMAIL' || commType === 'LETTER') && !data.subject && !existing.subject)
    throw new ServiceError(400, 'Validation Error', 'Subject is required for EMAIL and LETTER types');

  if (data.templateId) {
    const template = await prisma.communicationTemplate.findUnique({ where: { id: data.templateId } });
    assertFound(template, 'Communication template');
  }

  if (data.status) {
    if (!(VALID_STATUSES as readonly string[]).includes(data.status))
      throw new ServiceError(400, 'Validation Error', `Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const updateData: any = {};
  if (data.type !== undefined) updateData.type = data.type;
  if (data.subject !== undefined) updateData.subject = data.subject;
  if (data.body !== undefined) updateData.body = data.body;
  if (data.templateId !== undefined) updateData.templateId = data.templateId;
  if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
  if (data.followUpDate !== undefined) updateData.followUpDate = data.followUpDate ? new Date(data.followUpDate) : null;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === 'SENT') { updateData.sentAt = new Date(); updateData.followUpDate = null; }
  }
  if (data.metadata !== undefined) updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : null;

  const communication = await prisma.communication.update({ where: { id }, data: updateData, include: COMM_INCLUDE });

  await prisma.activity.create({
    data: {
      clientId: communication.clientId,
      userId,
      type: 'COMMUNICATION_UPDATED',
      description: `Communication updated${data.status ? ` to status: ${data.status}` : ''}`,
      metadata: JSON.stringify({ communicationId: communication.id, status: communication.status }),
    },
  });

  return formatCommunication(communication);
}

export async function deleteCommunication(id: string, userId: string, userRole: string) {
  const existing = await prisma.communication.findUnique({ where: { id } });
  assertFound(existing, 'Communication');
  if (!canAccessClientCommunication(userRole, userId, existing.createdById))
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to delete this communication');
  if (existing.status === 'SENT')
    throw new ServiceError(400, 'Validation Error', 'Cannot delete sent communications. Update status to FAILED or keep for records.');

  await prisma.communication.delete({ where: { id } });
  await prisma.activity.create({
    data: {
      clientId: existing.clientId,
      userId,
      type: 'COMMUNICATION_DELETED',
      description: `${existing.type} communication deleted`,
      metadata: JSON.stringify({ communicationId: id, type: existing.type }),
    },
  });

  return { message: 'Communication deleted successfully' };
}

export async function updateCommunicationStatus(id: string, status: string, userId: string, userRole: string) {
  if (!status) throw new ServiceError(400, 'Validation Error', 'Status is required');
  if (!(VALID_STATUSES as readonly string[]).includes(status))
    throw new ServiceError(400, 'Validation Error', `Status must be one of: ${VALID_STATUSES.join(', ')}`);

  const existing = await prisma.communication.findUnique({ where: { id } });
  assertFound(existing, 'Communication');
  if (!canAccessClientCommunication(userRole, userId, existing.createdById))
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to update this communication');

  if (status === existing.status) return { message: 'Status unchanged', communication: { id: existing.id, status: existing.status } };

  const allowedTransitions: Record<string, string[]> = { DRAFT: ['READY', 'FAILED'], READY: ['SENT', 'FAILED'], SENT: [], FAILED: [] };
  if (!allowedTransitions[existing.status]?.includes(status))
    throw new ServiceError(400, 'Validation Error', `Cannot transition from ${existing.status} to ${status}. Allowed transitions: ${allowedTransitions[existing.status].join(', ') || 'none'}`);

  const updateData: any = { status };
  if (status === 'SENT') updateData.sentAt = new Date();

  const communication = await prisma.communication.update({ where: { id }, data: updateData, include: COMM_INCLUDE });

  await prisma.activity.create({
    data: {
      clientId: communication.clientId,
      userId,
      type: 'COMMUNICATION_STATUS_CHANGED',
      description: `Communication status changed from ${existing.status} to ${status}`,
      metadata: JSON.stringify({ communicationId: communication.id, oldStatus: existing.status, newStatus: status, type: communication.type }),
    },
  });

  return formatCommunication(communication);
}

export async function sendCommunication(id: string, userId: string, userRole: string, metadata?: any) {
  const existing = await prisma.communication.findUnique({ where: { id } });
  assertFound(existing, 'Communication');
  if (!canAccessClientCommunication(userRole, userId, existing.createdById))
    throw new ServiceError(403, 'Access Denied', 'You do not have permission to send this communication');
  if (existing.status === 'SENT')
    throw new ServiceError(400, 'Validation Error', 'Communication has already been sent');
  if (existing.status === 'FAILED')
    throw new ServiceError(400, 'Validation Error', 'Cannot send a failed communication. Update status to READY first.');

  const communication = await prisma.communication.update({
    where: { id },
    data: { status: 'SENT', sentAt: new Date(), ...(metadata && { metadata: JSON.stringify(metadata) }) },
    include: COMM_INCLUDE,
  });

  await prisma.activity.create({
    data: {
      clientId: communication.clientId,
      userId,
      type: 'COMMUNICATION_SENT',
      description: `${communication.type} communication sent to client`,
      metadata: JSON.stringify({ communicationId: communication.id, type: communication.type, subject: communication.subject }),
    },
  });

  return formatCommunication(communication);
}

export async function previewCommunicationContent(clientId: string, body: string, userId: string, subject?: string, additionalContext?: any) {
  if (!clientId) throw new ServiceError(400, 'Validation Error', 'Client ID is required');
  if (!body) throw new ServiceError(400, 'Validation Error', 'Message body is required');

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  assertFound(client, 'Client');

  const bodyPreview = await previewTemplate(body, clientId, userId, additionalContext);
  let subjectPreview = null;
  if (subject) subjectPreview = await previewTemplate(subject, clientId, userId, additionalContext);

  return {
    body: { original: bodyPreview.original, filled: bodyPreview.filled, placeholders: bodyPreview.placeholders, missing: bodyPreview.missing },
    subject: subjectPreview ? { original: subjectPreview.original, filled: subjectPreview.filled, placeholders: subjectPreview.placeholders, missing: subjectPreview.missing } : null,
    context: {
      client_name: bodyPreview.context.client_name || '',
      client_status: bodyPreview.context.client_status || '',
      loan_officer_name: bodyPreview.context.loan_officer_name || '',
      company_name: bodyPreview.context.company_name || '',
      date: bodyPreview.context.date || '',
      time: bodyPreview.context.time || '',
      has_loan_amount: !!bodyPreview.context.loan_amount,
      has_client_email: !!bodyPreview.context.client_email,
      has_client_phone: !!bodyPreview.context.client_phone,
    },
  };
}

// ─── communication templates ────────────────────────────────────────────────

const VALID_CATEGORIES = ['WELCOME', 'FOLLOWUP', 'REMINDER', 'STATUS_UPDATE', 'DOCUMENT_REQUEST', 'APPOINTMENT', 'CLOSING', 'THANK_YOU', 'OTHER'] as const;

function formatTemplate(t: any) {
  return {
    id: t.id,
    name: t.name,
    type: t.type,
    category: t.category,
    subject: t.subject,
    body: t.body,
    placeholders: t.placeholders ? JSON.parse(t.placeholders) : [],
    isActive: t.isActive,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export interface ListTemplatesParams {
  type?: string;
  category?: string;
  isActive?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listTemplates(params: ListTemplatesParams) {
  const { type, category, isActive, search, page = 1, limit = 50 } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (type) {
    if (!(VALID_TYPES as readonly string[]).includes(type))
      throw new ServiceError(400, 'Validation Error', `Type must be one of: ${VALID_TYPES.join(', ')}`);
    where.type = type;
  }
  if (category) where.category = category;
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) where.OR = [{ name: { contains: search } }, { subject: { contains: search } }];

  const [templates, total] = await Promise.all([
    prisma.communicationTemplate.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.communicationTemplate.count({ where }),
  ]);

  return { data: templates.map(formatTemplate), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getTemplate(id: string) {
  const template = await prisma.communicationTemplate.findUnique({ where: { id } });
  assertFound(template, 'Communication template');
  return formatTemplate(template);
}

export interface CreateTemplateData {
  name: string;
  type: string;
  category?: string;
  subject?: string;
  body: string;
  placeholders?: string[];
  isActive?: boolean;
}

export async function createTemplate(data: CreateTemplateData) {
  if (!data.name || !data.type || !data.body)
    throw new ServiceError(400, 'Validation Error', 'Name, type, and body are required');
  if (!(VALID_TYPES as readonly string[]).includes(data.type))
    throw new ServiceError(400, 'Validation Error', `Type must be one of: ${VALID_TYPES.join(', ')}`);
  if ((data.type === 'EMAIL' || data.type === 'LETTER') && !data.subject)
    throw new ServiceError(400, 'Validation Error', 'Subject is required for EMAIL and LETTER types');
  if (data.category && !(VALID_CATEGORIES as readonly string[]).includes(data.category))
    throw new ServiceError(400, 'Validation Error', `Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  if (data.placeholders && !Array.isArray(data.placeholders))
    throw new ServiceError(400, 'Validation Error', 'Placeholders must be an array');

  const template = await prisma.communicationTemplate.create({
    data: {
      name: data.name,
      type: data.type,
      category: data.category || null,
      subject: data.subject || null,
      body: data.body,
      placeholders: data.placeholders?.length ? JSON.stringify(data.placeholders) : null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });

  return formatTemplate(template);
}

export interface UpdateTemplateData {
  name?: string;
  type?: string;
  category?: string;
  subject?: string;
  body?: string;
  placeholders?: string[];
  isActive?: boolean;
}

export async function updateTemplate(id: string, data: UpdateTemplateData) {
  const existing = await prisma.communicationTemplate.findUnique({ where: { id } });
  assertFound(existing, 'Communication template');

  if (data.type && !(VALID_TYPES as readonly string[]).includes(data.type))
    throw new ServiceError(400, 'Validation Error', `Type must be one of: ${VALID_TYPES.join(', ')}`);

  const tplType = data.type || existing.type;
  if ((tplType === 'EMAIL' || tplType === 'LETTER') && !data.subject && !existing.subject)
    throw new ServiceError(400, 'Validation Error', 'Subject is required for EMAIL and LETTER types');

  if (data.category && !(VALID_CATEGORIES as readonly string[]).includes(data.category))
    throw new ServiceError(400, 'Validation Error', `Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  if (data.placeholders !== undefined && !Array.isArray(data.placeholders))
    throw new ServiceError(400, 'Validation Error', 'Placeholders must be an array');

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.subject !== undefined) updateData.subject = data.subject;
  if (data.body !== undefined) updateData.body = data.body;
  if (data.placeholders !== undefined) updateData.placeholders = data.placeholders?.length ? JSON.stringify(data.placeholders) : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const template = await prisma.communicationTemplate.update({ where: { id }, data: updateData });
  return formatTemplate(template);
}

export async function deleteTemplate(id: string) {
  const template = await prisma.communicationTemplate.findUnique({ where: { id }, include: { communications: { take: 1 } } });
  assertFound(template, 'Communication template');
  if (template.communications && template.communications.length > 0)
    throw new ServiceError(400, 'Validation Error', 'Cannot delete template that is in use. Deactivate it instead.');

  await prisma.communicationTemplate.delete({ where: { id } });
  return { message: 'Communication template deleted successfully' };
}

export async function toggleTemplate(id: string) {
  const existing = await prisma.communicationTemplate.findUnique({ where: { id } });
  assertFound(existing, 'Communication template');

  const template = await prisma.communicationTemplate.update({ where: { id }, data: { isActive: !existing.isActive } });
  return formatTemplate(template);
}

// ─── static metadata ────────────────────────────────────────────────────────

export const TEMPLATE_TYPES_META = [
  { value: 'EMAIL', label: 'Email', description: 'Email communication template', hasSubject: true },
  { value: 'SMS', label: 'SMS', description: 'SMS/text message template', hasSubject: false },
  { value: 'LETTER', label: 'Letter', description: 'Printed letter template', hasSubject: true },
];

export const TEMPLATE_CATEGORIES_META = [
  { value: 'WELCOME', label: 'Welcome', description: 'New client welcome messages' },
  { value: 'FOLLOWUP', label: 'Follow Up', description: 'Follow up communications' },
  { value: 'REMINDER', label: 'Reminder', description: 'Payment and document reminders' },
  { value: 'STATUS_UPDATE', label: 'Status Update', description: 'Loan status updates' },
  { value: 'DOCUMENT_REQUEST', label: 'Document Request', description: 'Request documents from clients' },
  { value: 'APPOINTMENT', label: 'Appointment', description: 'Appointment scheduling and confirmations' },
  { value: 'CLOSING', label: 'Closing', description: 'Closing and finalization messages' },
  { value: 'THANK_YOU', label: 'Thank You', description: 'Thank you messages' },
  { value: 'OTHER', label: 'Other', description: 'Other communications' },
];

export const PLACEHOLDER_VARS_META = [
  { value: 'client_name', label: 'Client Name', description: 'Full name of the client' },
  { value: 'client_email', label: 'Client Email', description: 'Email address of the client' },
  { value: 'client_phone', label: 'Client Phone', description: 'Phone number of the client' },
  { value: 'loan_officer_name', label: 'Loan Officer Name', description: 'Name of the loan officer' },
  { value: 'loan_officer_email', label: 'Loan Officer Email', description: 'Email of the loan officer' },
  { value: 'loan_officer_phone', label: 'Loan Officer Phone', description: 'Phone number of the loan officer' },
  { value: 'loan_amount', label: 'Loan Amount', description: 'Loan amount' },
  { value: 'property_address', label: 'Property Address', description: 'Property address' },
  { value: 'due_date', label: 'Due Date', description: 'Document due date' },
  { value: 'document_name', label: 'Document Name', description: 'Name of the document' },
  { value: 'current_date', label: 'Current Date', description: "Today's date" },
  { value: 'company_name', label: 'Company Name', description: 'Your company name' },
];
