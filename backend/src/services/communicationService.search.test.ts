import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listCommunications, searchCommunications } from './communicationService.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    communication: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    client: {
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

function buildCommunicationRow(id: string, createdAt: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    clientId: 'client-1',
    type: 'EMAIL',
    status: 'DRAFT',
    subject: `Subject ${id}`,
    body: `Body ${id}`,
    templateId: null,
    template: null,
    scheduledAt: null,
    sentAt: null,
    followUpDate: null,
    attachments: '[]',
    createdBy: { id: 'user-1', name: 'User One', email: 'user@example.com' },
    metadata: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    client: { id: 'client-1', nameEncrypted: 'Client One' },
    ...overrides,
  };
}

describe('communicationService list/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists communications with standard filters and pagination when q is not provided', async () => {
    mocks.prisma.communication.findMany.mockResolvedValue([
      buildCommunicationRow('comm-1', '2026-02-20T10:00:00.000Z'),
    ]);
    mocks.prisma.communication.count.mockResolvedValue(1);

    const result = await listCommunications({
      userId: 'user-1',
      userRole: 'MLO',
      status: 'DRAFT',
      page: 2,
      limit: 10,
    });

    expect(mocks.prisma.communication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'DRAFT',
          createdById: 'user-1',
        }),
        skip: 10,
        take: 10,
      })
    );
    expect(mocks.prisma.communication.count).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.client.findMany).not.toHaveBeenCalled();
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('supports fuzzy q search with status/scheduled filters and paginates merged results', async () => {
    mocks.prisma.communication.findMany
      .mockResolvedValueOnce([
        buildCommunicationRow('comm-1', '2026-02-20T09:00:00.000Z', {
          body: 'This body includes beta keyword',
        }),
      ])
      .mockResolvedValueOnce([
        buildCommunicationRow('comm-2', '2026-02-20T12:00:00.000Z', {
          clientId: 'client-2',
          client: { id: 'client-2', nameEncrypted: 'Beta Borrower' },
        }),
      ]);

    mocks.prisma.client.findMany.mockResolvedValue([
      { id: 'client-1', nameEncrypted: 'Alpha Applicant' },
      { id: 'client-2', nameEncrypted: 'Beta Borrower' },
    ]);

    const result = await listCommunications({
      userId: 'user-1',
      userRole: 'MLO',
      q: 'beta',
      status: 'DRAFT',
      scheduled: 'true',
      page: 1,
      limit: 1,
    });

    expect(mocks.prisma.communication.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.communication.findMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'DRAFT',
          createdById: 'user-1',
          scheduledAt: { not: null },
          OR: expect.any(Array),
        }),
      })
    );
    expect(mocks.prisma.communication.findMany.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'DRAFT',
          createdById: 'user-1',
          scheduledAt: { not: null },
          clientId: { in: ['client-2'] },
        }),
      })
    );

    expect(result.pagination.total).toBe(2);
    expect(result.pagination.totalPages).toBe(2);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('comm-2');
  });

  it('keeps /search compatibility response with query field', async () => {
    mocks.prisma.communication.findMany.mockResolvedValue([]);
    mocks.prisma.client.findMany.mockResolvedValue([]);

    const result = await searchCommunications({
      userId: 'user-1',
      userRole: 'MLO',
      q: 'follow up',
      page: 1,
      limit: 20,
    });

    expect(result.query).toBe('follow up');
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });
});
