import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteTaskTemplate, listTaskTemplates, updateTaskTemplate } from './taskService.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    taskTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../utils/prisma.js', () => ({
  default: mocks.prisma,
}));

vi.mock('../utils/clientPiiCodec.js', () => ({
  decodeClientPiiField: (value: string) => value,
}));

vi.mock('./triggerHandler.js', () => ({
  fireTaskCreatedTrigger: vi.fn(),
  fireTaskCompletedTrigger: vi.fn(),
  fireTaskAssignedTrigger: vi.fn(),
}));

describe('taskService templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists system + personal templates for caller and normalizes source', async () => {
    const now = new Date();
    mocks.prisma.taskTemplate.findMany.mockResolvedValue([
      {
        id: 'tpl-system',
        name: 'System',
        description: null,
        text: 'System text',
        type: 'GENERAL',
        priority: 'MEDIUM',
        tags: '["sys"]',
        dueDays: null,
        steps: null,
        isSystem: true,
        createdById: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'tpl-personal',
        name: 'Personal',
        description: 'Mine',
        text: 'Personal text',
        type: 'FOLLOW_UP',
        priority: 'HIGH',
        tags: '["mine"]',
        dueDays: 2,
        steps: '["step 1"]',
        isSystem: false,
        createdById: 'user-1',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await listTaskTemplates('user-1');

    expect(mocks.prisma.taskTemplate.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { isSystem: true },
          { createdById: 'user-1' },
        ],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'tpl-system', source: 'SYSTEM', isSystem: true, tags: ['sys'] });
    expect(result[1]).toMatchObject({ id: 'tpl-personal', source: 'PERSONAL', isSystem: false, steps: ['step 1'] });
  });

  it('handles legacy CSV tags/steps without throwing', async () => {
    const now = new Date();
    mocks.prisma.taskTemplate.findMany.mockResolvedValue([
      {
        id: 'tpl-legacy',
        name: 'Legacy',
        description: null,
        text: 'Legacy text',
        type: 'GENERAL',
        priority: 'MEDIUM',
        tags: 'urgent, follow-up',
        dueDays: null,
        steps: 'first step, second step',
        isSystem: true,
        createdById: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await listTaskTemplates('user-1');
    expect(result[0]).toMatchObject({
      id: 'tpl-legacy',
      tags: ['urgent', 'follow-up'],
      steps: ['first step', 'second step'],
    });
  });

  it('rejects updating system template', async () => {
    mocks.prisma.taskTemplate.findUnique.mockResolvedValue({
      id: 'tpl-system',
      isSystem: true,
      createdById: null,
    });

    await expect(updateTaskTemplate('tpl-system', { name: 'Updated' }, 'user-1')).rejects.toMatchObject({
      status: 403,
      code: 'Access Denied',
    });
  });

  it('rejects updating another user personal template', async () => {
    mocks.prisma.taskTemplate.findUnique.mockResolvedValue({
      id: 'tpl-2',
      isSystem: false,
      createdById: 'user-2',
    });

    await expect(updateTaskTemplate('tpl-2', { name: 'Updated' }, 'user-1')).rejects.toMatchObject({
      status: 403,
      code: 'Access Denied',
    });
  });

  it('rejects updating template with empty name/text', async () => {
    mocks.prisma.taskTemplate.findUnique.mockResolvedValue({
      id: 'tpl-own',
      isSystem: false,
      createdById: 'user-1',
    });

    await expect(updateTaskTemplate('tpl-own', { name: '   ' }, 'user-1')).rejects.toMatchObject({
      status: 400,
      code: 'Validation Error',
    });
    await expect(updateTaskTemplate('tpl-own', { text: '   ' }, 'user-1')).rejects.toMatchObject({
      status: 400,
      code: 'Validation Error',
    });
  });

  it('rejects deleting system template', async () => {
    mocks.prisma.taskTemplate.findUnique.mockResolvedValue({
      id: 'tpl-system',
      isSystem: true,
      createdById: null,
    });

    await expect(deleteTaskTemplate('tpl-system', 'user-1')).rejects.toMatchObject({
      status: 403,
      code: 'Access Denied',
    });
    expect(mocks.prisma.taskTemplate.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting another user personal template', async () => {
    mocks.prisma.taskTemplate.findUnique.mockResolvedValue({
      id: 'tpl-other',
      isSystem: false,
      createdById: 'user-2',
    });

    await expect(deleteTaskTemplate('tpl-other', 'user-1')).rejects.toMatchObject({
      status: 403,
      code: 'Access Denied',
    });
    expect(mocks.prisma.taskTemplate.delete).not.toHaveBeenCalled();
  });
});
