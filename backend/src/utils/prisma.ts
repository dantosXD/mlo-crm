import { PrismaClient } from '@prisma/client';
import { getRequestContext } from './requestContext.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const SOFT_DELETE_MODELS = new Set<string>([
  'User',
  'Client',
  'Note',
  'NoteTemplate',
  'Task',
  'TaskSubtask',
  'TaskAttachment',
  'TaskTemplate',
  'ReminderTemplate',
  'ActivityTemplate',
  'Document',
  'LoanScenario',
  'LoanProgramTemplate',
  'Notification',
  'CommunicationTemplate',
  'Communication',
  'Workflow',
  'Event',
  'Reminder',
  'CalendarShare',
]);

const VERSIONED_MODELS = new Set<string>([
  ...SOFT_DELETE_MODELS,
  'DocumentPackage',
  'ClientFinancialProfile',
  'WorkflowVersion',
  'WorkflowExecution',
  'WorkflowExecutionLog',
  'EventAttendee',
]);

const ARCHIVE_MUTATIONS: Record<string, Record<string, unknown>> = {
  User: { isActive: false },
  Client: { status: 'INACTIVE' },
  LoanScenario: { status: 'ARCHIVED' },
  LoanProgramTemplate: { isActive: false },
  CommunicationTemplate: { isActive: false },
  Communication: { status: 'ARCHIVED' },
  Workflow: { isActive: false },
  Event: { status: 'CANCELLED' },
  Reminder: { status: 'DISMISSED' },
  CalendarShare: { isActive: false },
};

function withNotDeleted(where: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!where) return { deletedAt: null };
  if (Object.prototype.hasOwnProperty.call(where, 'deletedAt')) return where;
  if (Array.isArray(where.AND)) {
    return {
      ...where,
      AND: [...(where.AND as unknown[]), { deletedAt: null }],
    };
  }
  return { ...where, deletedAt: null };
}

function modelToDelegate(model: string): string {
  return `${model.charAt(0).toLowerCase()}${model.slice(1)}`;
}

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

prismaClient.$use(async (params, next) => {
  if (!params.model || params.model === 'EntityVersion') {
    return next(params);
  }

  const model = params.model;
  const originalAction = params.action;
  const isSoftDeleteModel = SOFT_DELETE_MODELS.has(model);
  const shouldVersion = VERSIONED_MODELS.has(model);

  let beforeData: unknown = null;
  if (shouldVersion && ['update', 'delete', 'upsert'].includes(originalAction) && params.args?.where) {
    try {
      const delegate = (prismaClient as any)[modelToDelegate(model)];
      if (delegate?.findUnique) {
        beforeData = await delegate.findUnique({
          where: params.args.where,
        });
      }
    } catch {
      beforeData = null;
    }
  }

  if (isSoftDeleteModel) {
    if (
      params.action === 'findMany' ||
      params.action === 'findFirst' ||
      params.action === 'findFirstOrThrow' ||
      params.action === 'count' ||
      params.action === 'aggregate'
    ) {
      params.args = params.args ?? {};
      params.args.where = withNotDeleted(params.args.where);
    }

    if (params.action === 'delete') {
      const modelArchiveMutation = ARCHIVE_MUTATIONS[model] ?? {};
      params.action = 'update';
      params.args = {
        ...(params.args ?? {}),
        data: {
          ...modelArchiveMutation,
          ...(params.args?.data ?? {}),
          deletedAt: new Date(),
        },
      };
    }

    if (params.action === 'deleteMany') {
      const modelArchiveMutation = ARCHIVE_MUTATIONS[model] ?? {};
      params.action = 'updateMany';
      params.args = {
        ...(params.args ?? {}),
        where: withNotDeleted(params.args?.where),
        data: {
          ...modelArchiveMutation,
          ...(params.args?.data ?? {}),
          deletedAt: new Date(),
        },
      };
    }
  }

  const result = await next(params);

  if (!shouldVersion) {
    return result;
  }

  const operationMap: Record<string, string> = {
    create: 'CREATE',
    createMany: 'CREATE_MANY',
    update: 'UPDATE',
    updateMany: 'UPDATE_MANY',
    upsert: 'UPSERT',
    delete: 'ARCHIVE',
    deleteMany: 'ARCHIVE_MANY',
  };

  const versionOperation = operationMap[originalAction];
  if (!versionOperation) {
    return result;
  }

  // Avoid extra write attempts while the parent mutation is inside a DB transaction.
  // For SQLite this can create lock contention and degrade the primary request path.
  if ((params as { runInTransaction?: boolean }).runInTransaction) {
    return result;
  }

  const actorUserId = getRequestContext()?.userId ?? null;

  try {
    const resultAsRecord = result as Record<string, unknown> | null;
    const whereId =
      typeof params.args?.where?.id === 'string'
        ? params.args.where.id
        : null;
    const entityId =
      (typeof resultAsRecord?.id === 'string' ? resultAsRecord.id : null) ??
      whereId ??
      'bulk';

    await prismaClient.entityVersion.create({
      data: {
        entityType: model,
        entityId,
        operation: versionOperation,
        actorUserId,
        beforeData: beforeData ? JSON.stringify(beforeData) : null,
        afterData: result ? JSON.stringify(result) : null,
        metadata: params.args ? JSON.stringify({ where: params.args.where ?? null }) : null,
      },
    });
  } catch {
    // Version logging must never fail the main write operation.
  }

  return result;
});

export const prisma = prismaClient;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
