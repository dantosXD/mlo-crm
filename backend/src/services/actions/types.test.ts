import { describe, expect, it, vi } from 'vitest';
import { replacePlaceholders } from './types.js';

vi.mock('../../utils/prisma.js', () => ({
  default: {
    client: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../utils/crypto.js', () => ({
  decrypt: (value: string) => value,
}));

describe('replacePlaceholders trigger alias compatibility', () => {
  it('fills legacy old/new status placeholders from fromStatus/toStatus trigger keys', () => {
    const output = replacePlaceholders(
      'Status moved from {{old_status}} to {{new_status}}',
      {
        clientId: 'client-1',
        triggerType: 'CLIENT_STATUS_CHANGED',
        triggerData: {
          fromStatus: 'LEAD',
          toStatus: 'PRE_QUALIFIED',
        },
        userId: 'user-1',
      }
    );

    expect(output).toContain('from LEAD');
    expect(output).toContain('to PRE_QUALIFIED');
  });

  it('fills camelCase placeholders when trigger data uses snake_case keys', () => {
    const output = replacePlaceholders(
      'Status changed from {{fromStatus}} to {{toStatus}}',
      {
        clientId: 'client-1',
        triggerType: 'CLIENT_STATUS_CHANGED',
        triggerData: {
          from_status: 'ACTIVE',
          to_status: 'PROCESSING',
        },
        userId: 'user-1',
      }
    );

    expect(output).toContain('from ACTIVE');
    expect(output).toContain('to PROCESSING');
  });
});
