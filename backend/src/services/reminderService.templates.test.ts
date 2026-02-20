import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createReminderTemplate,
  deleteReminderTemplate,
  listReminderTemplates,
  updateReminderTemplate,
} from './reminderService.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    reminderTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../utils/prisma.js', () => ({
  default: mocks.prisma,
}));

vi.mock('./reminderSuggestionService.js', () => ({
  default: {},
}));

describe('reminderService templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists system and caller-owned templates with normalized config', async () => {
    const now = new Date();
    mocks.prisma.reminderTemplate.findMany.mockResolvedValue([
      {
        id: 'sys',
        name: 'System Reminder',
        description: null,
        config: '{"priority":"MEDIUM","category":"GENERAL"}',
        isSystem: true,
        createdById: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mine',
        name: 'My Reminder',
        description: 'My template',
        config: '{"priority":"HIGH","remindOffset":{"value":1,"unit":"days","atTime":"09:00"}}',
        isSystem: false,
        createdById: 'user-1',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await listReminderTemplates('user-1');

    expect(mocks.prisma.reminderTemplate.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { isSystem: true },
          { createdById: 'user-1' },
        ],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'sys', source: 'SYSTEM', isSystem: true });
    expect(result[1]).toMatchObject({
      id: 'mine',
      source: 'PERSONAL',
      config: { priority: 'HIGH', remindOffset: { value: 1, unit: 'days', atTime: '09:00' } },
    });
  });

  it('rejects malformed config offsets and invalid units', async () => {
    await expect(createReminderTemplate({
      name: 'Bad Reminder',
      config: {
        remindOffset: { value: 2, unit: 'weeks' },
      },
    }, 'user-1')).rejects.toMatchObject({
      status: 400,
      code: 'Validation Error',
    });

    await expect(createReminderTemplate({
      name: 'Bad Reminder',
      config: {
        remindOffset: { value: -1, unit: 'days' },
      },
    }, 'user-1')).rejects.toMatchObject({
      status: 400,
      code: 'Validation Error',
    });
  });

  it('enforces ownership and system immutability on update', async () => {
    mocks.prisma.reminderTemplate.findUnique.mockResolvedValueOnce({
      id: 'system',
      isSystem: true,
      createdById: null,
    });
    await expect(updateReminderTemplate('system', { name: 'edit' }, 'user-1')).rejects.toMatchObject({
      status: 403,
      code: 'Access Denied',
    });

    mocks.prisma.reminderTemplate.findUnique.mockResolvedValueOnce({
      id: 'other-user',
      isSystem: false,
      createdById: 'user-2',
    });
    await expect(updateReminderTemplate('other-user', { name: 'edit' }, 'user-1')).rejects.toMatchObject({
      status: 403,
      code: 'Access Denied',
    });
  });

  it('enforces ownership on delete', async () => {
    mocks.prisma.reminderTemplate.findUnique.mockResolvedValue({
      id: 'other-user',
      isSystem: false,
      createdById: 'user-2',
    });

    await expect(deleteReminderTemplate('other-user', 'user-1')).rejects.toMatchObject({
      status: 403,
      code: 'Access Denied',
    });
    expect(mocks.prisma.reminderTemplate.delete).not.toHaveBeenCalled();
  });
});

