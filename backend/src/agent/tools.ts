import { tool } from 'ai';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { decodeClientPiiField } from '../utils/clientPiiCodec.js';

function parseTags(tagsStr: string | null | undefined): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createAgentTools(userId: string) {
  return {
    getClientList: tool({
      description:
        'Get a list of clients for the current user. Returns id, name, email, phone, status, and tags for each client.',
      inputSchema: z.object({
        status: z
          .string()
          .optional()
          .describe(
            'Filter by status: LEAD, PRE_QUALIFIED, ACTIVE, PROCESSING, UNDERWRITING, CLEAR_TO_CLOSE, CLOSED, DENIED, INACTIVE'
          ),
        limit: z
          .number()
          .optional()
          .default(20)
          .describe('Max number of clients to return (default 20)'),
      }),
      execute: async ({ status, limit }) => {
        const where: any = { createdById: userId };
        if (status) where.status = status;

        const clients = await prisma.client.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit ?? 20,
        });

        return clients.map((c) => ({
          id: c.id,
          name: decodeClientPiiField(c.nameEncrypted),
          email: decodeClientPiiField(c.emailEncrypted),
          phone: decodeClientPiiField(c.phoneEncrypted),
          status: c.status,
          tags: parseTags(c.tags),
          createdAt: c.createdAt.toISOString(),
        }));
      },
    }),

    getClientContext: tool({
      description:
        'Get full context for a specific client including their profile, recent notes, open tasks, documents, loan scenarios, and recent activity.',
      inputSchema: z.object({
        clientId: z.string().describe('The UUID of the client'),
      }),
      execute: async ({ clientId }) => {
        const client = await prisma.client.findFirst({
          where: { id: clientId, createdById: userId },
          include: {
            financialProfile: true,
            notes: { orderBy: { createdAt: 'desc' }, take: 5 },
            tasks: {
              where: { deletedAt: null, status: { not: 'COMPLETE' } },
              orderBy: { dueDate: 'asc' },
              take: 10,
            },
            documents: { orderBy: { createdAt: 'desc' }, take: 10 },
            loanScenarios: { orderBy: { createdAt: 'desc' }, take: 5 },
            activities: { orderBy: { createdAt: 'desc' }, take: 10 },
          },
        });

        if (!client) return { error: 'Client not found' };

        return {
          id: client.id,
          name: decodeClientPiiField(client.nameEncrypted),
          email: decodeClientPiiField(client.emailEncrypted),
          phone: decodeClientPiiField(client.phoneEncrypted),
          status: client.status,
          tags: parseTags(client.tags),
          createdAt: client.createdAt.toISOString(),
          financialProfile: client.financialProfile
            ? {
                annualIncome: client.financialProfile.annualIncome,
                monthlyDebts: client.financialProfile.monthlyDebts,
                creditScore: client.financialProfile.creditScore,
                employmentType: client.financialProfile.employmentType,
              }
            : null,
          recentNotes: client.notes.map((n) => ({
            id: n.id,
            text: n.text,
            tags: parseTags(n.tags),
            isPinned: n.isPinned,
            createdAt: n.createdAt.toISOString(),
          })),
          openTasks: client.tasks.map((t) => ({
            id: t.id,
            text: t.text,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate?.toISOString() ?? null,
          })),
          documents: client.documents.map((d) => ({
            id: d.id,
            name: d.name,
            category: d.category,
            status: d.status,
            createdAt: d.createdAt.toISOString(),
          })),
          loanScenarios: client.loanScenarios.map((ls) => ({
            id: ls.id,
            name: ls.name,
            loanType: ls.loanType,
            amount: ls.amount,
            interestRate: ls.interestRate,
            termYears: ls.termYears,
            status: ls.status,
          })),
          recentActivity: client.activities.map((a) => ({
            type: a.type,
            description: a.description,
            createdAt: a.createdAt.toISOString(),
          })),
        };
      },
    }),

    getDailyBriefing: tool({
      description:
        "Get today's briefing including tasks due today, today's events, reminders, and overdue items.",
      inputSchema: z.object({}),
      execute: async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [tasksDueToday, eventsToday, remindersToday, overdueTasks, overdueReminders] =
          await Promise.all([
            prisma.task.findMany({
              where: {
                dueDate: { gte: today, lt: tomorrow },
                deletedAt: null,
                client: { createdById: userId },
                status: { not: 'COMPLETE' },
              },
              include: {
                client: { select: { id: true, nameEncrypted: true } },
              },
              orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
            }),
            prisma.event.findMany({
              where: {
                startTime: { gte: today, lt: tomorrow },
                createdById: userId,
              },
              include: {
                client: { select: { id: true, nameEncrypted: true } },
              },
              orderBy: { startTime: 'asc' },
            }),
            prisma.reminder.findMany({
              where: {
                remindAt: { gte: today, lt: tomorrow },
                userId,
                status: { in: ['PENDING', 'SNOOZED'] },
              },
              orderBy: [{ priority: 'desc' }, { remindAt: 'asc' }],
            }),
            prisma.task.findMany({
              where: {
                dueDate: { lt: today },
                deletedAt: null,
                client: { createdById: userId },
                status: { not: 'COMPLETE' },
              },
              take: 10,
              orderBy: { dueDate: 'asc' },
            }),
            prisma.reminder.findMany({
              where: {
                remindAt: { lt: today },
                userId,
                status: { in: ['PENDING', 'SNOOZED'] },
              },
              take: 10,
              orderBy: { remindAt: 'asc' },
            }),
          ]);

        return {
          date: today.toISOString(),
          summary: {
            tasksDueToday: tasksDueToday.length,
            eventsToday: eventsToday.length,
            remindersToday: remindersToday.length,
            overdueTasks: overdueTasks.length,
            overdueReminders: overdueReminders.length,
          },
          tasks: tasksDueToday.map((t) => ({
            id: t.id,
            text: t.text,
            priority: t.priority,
            clientName: t.client
              ? decodeClientPiiField(t.client.nameEncrypted)
              : null,
            clientId: t.client?.id ?? null,
          })),
          events: eventsToday.map((e) => ({
            id: e.id,
            title: e.title,
            startTime: e.startTime.toISOString(),
            endTime: e.endTime?.toISOString() ?? null,
            clientName: e.client
              ? decodeClientPiiField(e.client.nameEncrypted)
              : null,
          })),
          reminders: remindersToday.map((r) => ({
            id: r.id,
            title: r.title,
            priority: r.priority,
            remindAt: r.remindAt.toISOString(),
          })),
          overdueTaskCount: overdueTasks.length,
          overdueReminderCount: overdueReminders.length,
        };
      },
    }),

    getPipelineSummary: tool({
      description:
        'Get a summary of the client pipeline with counts per stage.',
      inputSchema: z.object({}),
      execute: async () => {
        const clients = await prisma.client.findMany({
          where: { createdById: userId },
          select: { status: true },
        });

        const counts: Record<string, number> = {};
        for (const c of clients) {
          counts[c.status] = (counts[c.status] || 0) + 1;
        }

        return {
          total: clients.length,
          stages: counts,
        };
      },
    }),

    searchEntities: tool({
      description:
        'Search across clients, tasks, events, reminders, and notes by a text query.',
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .describe('Search query (minimum 2 characters)'),
      }),
      execute: async ({ query }) => {
        // Note: SQLite LIKE is case-insensitive for ASCII by default.
        // For PostgreSQL production, add `mode: 'insensitive'` to contains filters.
        const lowerQuery = query.toLowerCase();

        const [tasks, events, reminders, notes] = await Promise.all([
          prisma.task.findMany({
            where: {
              OR: [
                { text: { contains: lowerQuery } },
                { description: { contains: lowerQuery } },
              ],
              deletedAt: null,
              client: { createdById: userId },
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
          }),
          prisma.event.findMany({
            where: {
              OR: [
                { title: { contains: lowerQuery } },
                { description: { contains: lowerQuery } },
              ],
              createdById: userId,
            },
            take: 10,
            orderBy: { startTime: 'desc' },
          }),
          prisma.reminder.findMany({
            where: {
              userId,
              OR: [
                { title: { contains: lowerQuery } },
                { description: { contains: lowerQuery } },
              ],
            },
            take: 10,
            orderBy: { remindAt: 'desc' },
          }),
          prisma.note.findMany({
            where: {
              text: { contains: lowerQuery },
              client: { createdById: userId },
            },
            include: {
              client: { select: { id: true, nameEncrypted: true } },
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
          }),
        ]);

        return {
          query,
          tasks: tasks.map((t) => ({
            id: t.id,
            text: t.text,
            status: t.status,
            priority: t.priority,
          })),
          events: events.map((e) => ({
            id: e.id,
            title: e.title,
            startTime: e.startTime.toISOString(),
          })),
          reminders: reminders.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
          })),
          notes: notes.map((n) => ({
            id: n.id,
            text: n.text.substring(0, 200),
            clientName: n.client
              ? decodeClientPiiField(n.client.nameEncrypted)
              : null,
          })),
        };
      },
    }),

    createTask: tool({
      description: 'Create a new task, optionally associated with a client.',
      inputSchema: z.object({
        text: z.string().describe('Task title/text'),
        description: z.string().optional().describe('Optional task description'),
        clientId: z.string().optional().describe('Client UUID to associate with'),
        priority: z
          .enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
          .optional()
          .default('MEDIUM'),
        dueDate: z
          .string()
          .optional()
          .describe('Due date in ISO 8601 format'),
      }),
      execute: async ({ text, description, clientId, priority, dueDate }) => {
        if (clientId) {
          const client = await prisma.client.findFirst({
            where: { id: clientId, createdById: userId },
          });
          if (!client) return { error: 'Client not found or not owned by you' };
        }

        const task = await prisma.task.create({
          data: {
            text,
            description: description ?? null,
            clientId: clientId ?? null,
            priority: priority ?? 'MEDIUM',
            dueDate: dueDate ? new Date(dueDate) : null,
            createdById: userId,
          },
        });

        return {
          id: task.id,
          text: task.text,
          priority: task.priority,
          status: task.status,
          dueDate: task.dueDate?.toISOString() ?? null,
          message: `Task "${text}" created successfully.`,
        };
      },
    }),

    addNote: tool({
      description: 'Add a note to a specific client.',
      inputSchema: z.object({
        clientId: z.string().describe('Client UUID'),
        text: z.string().describe('Note text content'),
        tags: z
          .array(z.string())
          .optional()
          .describe('Optional tags for the note'),
      }),
      execute: async ({ clientId, text, tags }) => {
        const client = await prisma.client.findFirst({
          where: { id: clientId, createdById: userId },
        });
        if (!client) return { error: 'Client not found or not owned by you' };

        const note = await prisma.note.create({
          data: {
            clientId,
            text,
            tags: JSON.stringify(tags ?? []),
            createdById: userId,
          },
        });

        return {
          id: note.id,
          text: note.text,
          message: `Note added to client successfully.`,
        };
      },
    }),

    updateClientStatus: tool({
      description: 'Move a client to a different pipeline stage/status.',
      inputSchema: z.object({
        clientId: z.string().describe('Client UUID'),
        newStatus: z
          .enum([
            'LEAD',
            'PRE_QUALIFIED',
            'ACTIVE',
            'PROCESSING',
            'UNDERWRITING',
            'CLEAR_TO_CLOSE',
            'CLOSED',
            'DENIED',
            'INACTIVE',
          ])
          .describe('The new pipeline status'),
      }),
      execute: async ({ clientId, newStatus }) => {
        const client = await prisma.client.findFirst({
          where: { id: clientId, createdById: userId },
        });
        if (!client) return { error: 'Client not found or not owned by you' };

        const oldStatus = client.status;
        await prisma.client.update({
          where: { id: clientId },
          data: { status: newStatus },
        });

        await prisma.activity.create({
          data: {
            clientId,
            userId,
            type: 'STATUS_CHANGED',
            description: `Status changed from ${oldStatus} to ${newStatus} (via AI Agent)`,
          },
        });

        return {
          clientId,
          name: decodeClientPiiField(client.nameEncrypted),
          oldStatus,
          newStatus,
          message: `Client moved from ${oldStatus} to ${newStatus}.`,
        };
      },
    }),

    draftCommunication: tool({
      description:
        'Create a draft email or SMS communication for a client. The communication is saved as DRAFT and not sent.',
      inputSchema: z.object({
        clientId: z.string().describe('Client UUID'),
        type: z.enum(['EMAIL', 'SMS']).describe('Communication type'),
        subject: z
          .string()
          .optional()
          .describe('Email subject (required for EMAIL type)'),
        body: z.string().describe('Communication body text'),
      }),
      execute: async ({ clientId, type, subject, body }) => {
        const client = await prisma.client.findFirst({
          where: { id: clientId, createdById: userId },
        });
        if (!client) return { error: 'Client not found or not owned by you' };

        const comm = await prisma.communication.create({
          data: {
            clientId,
            type,
            status: 'DRAFT',
            subject: subject ?? null,
            body,
            createdById: userId,
          },
        });

        return {
          id: comm.id,
          type: comm.type,
          status: comm.status,
          message: `Draft ${type.toLowerCase()} created for ${decodeClientPiiField(client.nameEncrypted)}.`,
        };
      },
    }),
  };
}
