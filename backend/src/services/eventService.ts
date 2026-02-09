import prisma from '../utils/prisma.js';
import { ServiceError } from './taskService.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function assertFound<T>(value: T | null | undefined, entity = 'Resource'): asserts value is T {
  if (value === null || value === undefined) {
    throw new ServiceError(404, 'Not Found', `${entity} not found`);
  }
}

function assertOwnership(event: { createdById: string }, userId: string) {
  if (event.createdById !== userId)
    throw new ServiceError(403, 'Access Denied', 'Access denied');
}

const EVENT_INCLUDE = { client: true, eventAttendees: true } as const;

// ─── core CRUD ──────────────────────────────────────────────────────────────

export interface ListEventsParams {
  userId: string;
  startDate?: string;
  endDate?: string;
  clientId?: string;
  eventType?: string;
}

export async function listEvents(params: ListEventsParams) {
  const { userId, startDate, endDate, clientId, eventType } = params;

  const where: any = { createdById: userId, status: { not: 'CANCELLED' } };
  if (startDate && endDate) where.startTime = { gte: new Date(startDate), lte: new Date(endDate) };
  if (clientId) where.clientId = clientId;
  if (eventType) where.eventType = eventType;

  return prisma.event.findMany({ where, include: EVENT_INCLUDE, orderBy: { startTime: 'asc' } });
}

export async function getEvent(id: string, userId: string) {
  const event = await prisma.event.findFirst({
    where: { id, createdById: userId },
    include: { ...EVENT_INCLUDE, createdBy: { select: { id: true, name: true, email: true } } },
  });
  assertFound(event, 'Event');
  return event;
}

export interface CreateEventData {
  title: string;
  description?: string;
  eventType: string;
  startTime: string;
  endTime?: string;
  allDay?: boolean;
  location?: string;
  clientId?: string;
  taskId?: string;
  isRecurring?: boolean;
  recurringRule?: string;
  recurringEndDate?: string;
  attendees?: Array<{ userId?: string; email: string; name?: string; rsvpStatus?: string }>;
  reminders?: any[];
  status?: string;
  color?: string;
  metadata?: any;
}

export async function createEvent(data: CreateEventData, userId: string) {
  if (!data.title || !data.eventType || !data.startTime)
    throw new ServiceError(400, 'Validation Error', 'Title, event type, and start time are required');

  const event = await prisma.event.create({
    data: {
      title: data.title,
      description: data.description,
      eventType: data.eventType,
      startTime: new Date(data.startTime),
      endTime: data.endTime ? new Date(data.endTime) : null,
      allDay: data.allDay || false,
      location: data.location,
      clientId: data.clientId,
      taskId: data.taskId,
      createdById: userId,
      isRecurring: data.isRecurring || false,
      recurringRule: data.recurringRule,
      recurringEndDate: data.recurringEndDate ? new Date(data.recurringEndDate) : null,
      reminders: JSON.stringify(data.reminders || []),
      status: data.status || 'CONFIRMED',
      color: data.color,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    },
  });

  if (data.attendees?.length) {
    await prisma.eventAttendee.createMany({
      data: data.attendees.map((a) => ({
        eventId: event.id,
        userId: a.userId || null,
        email: a.email,
        name: a.name || null,
        rsvpStatus: a.rsvpStatus || 'NEEDS_ACTION',
      })),
    });
  }

  return prisma.event.findUnique({ where: { id: event.id }, include: EVENT_INCLUDE });
}

export interface UpdateEventData {
  title?: string;
  description?: string;
  eventType?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  location?: string;
  clientId?: string;
  taskId?: string;
  isRecurring?: boolean;
  recurringRule?: string;
  recurringEndDate?: string;
  attendees?: Array<{ userId?: string; email: string; name?: string; rsvpStatus?: string }>;
  reminders?: any[];
  status?: string;
  color?: string;
  metadata?: any;
}

export async function updateEvent(id: string, data: UpdateEventData, userId: string) {
  const existing = await prisma.event.findFirst({ where: { id, createdById: userId } });
  assertFound(existing, 'Event');

  const event = await prisma.event.update({
    where: { id },
    data: {
      title: data.title !== undefined ? data.title : existing.title,
      description: data.description !== undefined ? data.description : existing.description,
      eventType: data.eventType !== undefined ? data.eventType : existing.eventType,
      startTime: data.startTime !== undefined ? new Date(data.startTime) : existing.startTime,
      endTime: data.endTime !== undefined ? new Date(data.endTime) : existing.endTime,
      allDay: data.allDay !== undefined ? data.allDay : existing.allDay,
      location: data.location !== undefined ? data.location : existing.location,
      clientId: data.clientId !== undefined ? data.clientId : existing.clientId,
      taskId: data.taskId !== undefined ? data.taskId : existing.taskId,
      isRecurring: data.isRecurring !== undefined ? data.isRecurring : existing.isRecurring,
      recurringRule: data.recurringRule !== undefined ? data.recurringRule : existing.recurringRule,
      recurringEndDate: data.recurringEndDate !== undefined ? new Date(data.recurringEndDate) : existing.recurringEndDate,
      reminders: data.reminders !== undefined ? JSON.stringify(data.reminders) : existing.reminders,
      status: data.status !== undefined ? data.status : existing.status,
      color: data.color !== undefined ? data.color : existing.color,
      metadata: data.metadata !== undefined ? JSON.stringify(data.metadata) : existing.metadata,
    },
  });

  if (data.attendees !== undefined) {
    await prisma.eventAttendee.deleteMany({ where: { eventId: id } });
    if (data.attendees?.length) {
      await prisma.eventAttendee.createMany({
        data: data.attendees.map((a) => ({
          eventId: id,
          userId: a.userId || null,
          email: a.email,
          name: a.name || null,
          rsvpStatus: a.rsvpStatus || 'NEEDS_ACTION',
        })),
      });
    }
  }

  return prisma.event.findUnique({ where: { id }, include: EVENT_INCLUDE });
}

export async function deleteEvent(id: string, userId: string) {
  const existing = await prisma.event.findFirst({ where: { id, createdById: userId } });
  assertFound(existing, 'Event');
  await prisma.event.delete({ where: { id } });
  return { message: 'Event deleted successfully' };
}

export async function updateEventStatus(id: string, status: string, userId: string) {
  if (!status) throw new ServiceError(400, 'Validation Error', 'Status is required');
  const existing = await prisma.event.findFirst({ where: { id, createdById: userId } });
  assertFound(existing, 'Event');
  return prisma.event.update({ where: { id }, data: { status } });
}

export async function updateRsvp(eventId: string, attendeeId: string, rsvpStatus: string) {
  if (!attendeeId || !rsvpStatus)
    throw new ServiceError(400, 'Validation Error', 'Attendee ID and RSVP status are required');
  const event = await prisma.event.findFirst({ where: { id: eventId } });
  assertFound(event, 'Event');
  return prisma.eventAttendee.update({ where: { id: attendeeId }, data: { rsvpStatus, respondedAt: new Date() } });
}

// ─── cross-entity creation ──────────────────────────────────────────────────

export async function createTaskFromEvent(id: string, userId: string, dueDate?: string, priority = 'MEDIUM') {
  const event = await prisma.event.findUnique({ where: { id }, include: { client: true } });
  assertFound(event, 'Event');
  assertOwnership(event, userId);

  return prisma.task.create({
    data: {
      text: event.title,
      description: event.description,
      type: 'CLIENT_SPECIFIC',
      priority,
      clientId: event.clientId,
      dueDate: dueDate ? new Date(dueDate) : event.startTime,
      createdById: userId,
      status: 'TODO',
    },
    include: { client: { select: { id: true, nameEncrypted: true } }, assignedTo: { select: { id: true, name: true } } },
  });
}

export async function createReminderFromEvent(id: string, userId: string, remindAt?: string, category = 'GENERAL', priority = 'MEDIUM') {
  const event = await prisma.event.findUnique({ where: { id }, include: { client: true } });
  assertFound(event, 'Event');
  assertOwnership(event, userId);

  return prisma.reminder.create({
    data: {
      userId,
      clientId: event.clientId,
      title: `Event: ${event.title}`,
      description: event.description,
      category,
      priority,
      remindAt: remindAt ? new Date(remindAt) : new Date(event.startTime),
      dueDate: event.startTime,
      status: 'PENDING',
    },
    include: { client: { select: { id: true, nameEncrypted: true } } },
  });
}

// ─── conflict detection ─────────────────────────────────────────────────────

export async function checkConflicts(userId: string, startTime: string, endTime: string, excludeEventId?: string) {
  if (!startTime || !endTime)
    throw new ServiceError(400, 'Validation Error', 'Start time and end time are required');

  const start = new Date(startTime);
  const end = new Date(endTime);

  const where: any = {
    createdById: userId,
    status: { not: 'CANCELLED' },
    OR: [
      { startTime: { gte: start, lt: end } },
      { endTime: { gt: start, lte: end } },
      { startTime: { lt: start }, endTime: { gt: end } },
      { startTime: { gt: start }, endTime: { lt: end } },
    ],
  };

  if (excludeEventId) where.id = { not: excludeEventId };

  const conflicts = await prisma.event.findMany({
    where,
    include: { client: { select: { id: true, nameEncrypted: true } } },
    orderBy: { startTime: 'asc' },
  });

  return {
    hasConflicts: conflicts.length > 0,
    conflicts: conflicts.map((c) => ({
      id: c.id, title: c.title, startTime: c.startTime, endTime: c.endTime,
      allDay: c.allDay, location: c.location, eventType: c.eventType, client: c.client,
    })),
  };
}

export async function getAvailability(userId: string, date: string, duration = 60) {
  if (!date) throw new ServiceError(400, 'Validation Error', 'Date is required');

  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

  const events = await prisma.event.findMany({
    where: { createdById: userId, status: { not: 'CANCELLED' }, startTime: { gte: startOfDay, lte: endOfDay } },
    orderBy: { startTime: 'asc' },
  });

  const availableSlots: Array<{ start: Date; end: Date }> = [];
  let currentTime = new Date(startOfDay); currentTime.setHours(9, 0, 0, 0);
  const endTime = new Date(startOfDay); endTime.setHours(17, 0, 0, 0);

  for (const event of events) {
    const timeDiff = event.startTime.getTime() - currentTime.getTime();
    if (timeDiff >= duration * 60 * 1000) {
      availableSlots.push({ start: new Date(currentTime), end: new Date(currentTime.getTime() + duration * 60 * 1000) });
    }
    currentTime = new Date(event.endTime || event.startTime);
  }

  const timeDiff = endTime.getTime() - currentTime.getTime();
  if (timeDiff >= duration * 60 * 1000) {
    availableSlots.push({ start: new Date(currentTime), end: new Date(currentTime.getTime() + duration * 60 * 1000) });
  }

  return { date: targetDate, duration, availableSlots };
}
