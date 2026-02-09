import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  client: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
};

vi.mock('../utils/prisma.js', () => ({
  default: prismaMock,
}));

describe('conditionEvaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('evaluateConditions', () => {
    it('returns matched=true when no conditions are provided', async () => {
      const { evaluateConditions } = await import('./conditionEvaluator.js');
      const result = await evaluateConditions([], {
        clientId: 'c1',
        triggerType: 'MANUAL',
        triggerData: {},
      });

      expect(result.success).toBe(true);
      expect(result.matched).toBe(true);
    });

    it('evaluates CLIENT_STATUS_EQUALS correctly', async () => {
      prismaMock.client.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'ACTIVE',
        tags: '[]',
        createdAt: new Date(),
        documents: [],
        tasks: [],
        loanScenarios: [],
      });

      const { evaluateConditions } = await import('./conditionEvaluator.js');
      const result = await evaluateConditions(
        { type: 'CLIENT_STATUS_EQUALS', value: 'ACTIVE' },
        { clientId: 'c1', triggerType: 'MANUAL', triggerData: {} }
      );

      expect(result.success).toBe(true);
      expect(result.matched).toBe(true);
    });

    it('returns matched=false when CLIENT_STATUS_EQUALS does not match', async () => {
      prismaMock.client.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'LEAD',
        tags: '[]',
        createdAt: new Date(),
        documents: [],
        tasks: [],
        loanScenarios: [],
      });

      const { evaluateConditions } = await import('./conditionEvaluator.js');
      const result = await evaluateConditions(
        { type: 'CLIENT_STATUS_EQUALS', value: 'ACTIVE' },
        { clientId: 'c1', triggerType: 'MANUAL', triggerData: {} }
      );

      expect(result.success).toBe(true);
      expect(result.matched).toBe(false);
    });

    it('evaluates CLIENT_HAS_TAG correctly', async () => {
      prismaMock.client.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'ACTIVE',
        tags: '["vip","priority"]',
        createdAt: new Date(),
        documents: [],
        tasks: [],
        loanScenarios: [],
      });

      const { evaluateConditions } = await import('./conditionEvaluator.js');
      const matched = await evaluateConditions(
        { type: 'CLIENT_HAS_TAG', value: 'vip' },
        { clientId: 'c1', triggerType: 'MANUAL', triggerData: {} }
      );
      const notMatched = await evaluateConditions(
        { type: 'CLIENT_HAS_TAG', value: 'nonexistent' },
        { clientId: 'c1', triggerType: 'MANUAL', triggerData: {} }
      );

      expect(matched.matched).toBe(true);
      expect(notMatched.matched).toBe(false);
    });

    it('evaluates AND conditions correctly', async () => {
      prismaMock.client.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'ACTIVE',
        tags: '["vip"]',
        createdAt: new Date(),
        documents: [],
        tasks: [],
        loanScenarios: [],
      });

      const { evaluateConditions } = await import('./conditionEvaluator.js');
      const result = await evaluateConditions(
        {
          type: 'AND',
          conditions: [
            { type: 'CLIENT_STATUS_EQUALS', value: 'ACTIVE' },
            { type: 'CLIENT_HAS_TAG', value: 'vip' },
          ],
        },
        { clientId: 'c1', triggerType: 'MANUAL', triggerData: {} }
      );

      expect(result.matched).toBe(true);
    });

    it('evaluates OR conditions correctly', async () => {
      prismaMock.client.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'LEAD',
        tags: '["vip"]',
        createdAt: new Date(),
        documents: [],
        tasks: [],
        loanScenarios: [],
      });

      const { evaluateConditions } = await import('./conditionEvaluator.js');
      const result = await evaluateConditions(
        {
          type: 'OR',
          conditions: [
            { type: 'CLIENT_STATUS_EQUALS', value: 'ACTIVE' },
            { type: 'CLIENT_HAS_TAG', value: 'vip' },
          ],
        },
        { clientId: 'c1', triggerType: 'MANUAL', triggerData: {} }
      );

      expect(result.matched).toBe(true);
    });

    it('returns error for unknown condition type', async () => {
      const { evaluateConditions } = await import('./conditionEvaluator.js');
      const result = await evaluateConditions(
        { type: 'NONEXISTENT_CONDITION' },
        { clientId: 'c1', triggerType: 'MANUAL', triggerData: {} }
      );

      expect(result.success).toBe(false);
      expect(result.matched).toBe(false);
      expect(result.message).toContain('Unknown condition type');
    });

    it('handles client not found gracefully', async () => {
      prismaMock.client.findUnique.mockResolvedValue(null);

      const { evaluateConditions } = await import('./conditionEvaluator.js');
      const result = await evaluateConditions(
        { type: 'CLIENT_STATUS_EQUALS', value: 'ACTIVE' },
        { clientId: 'missing', triggerType: 'MANUAL', triggerData: {} }
      );

      expect(result.success).toBe(false);
      expect(result.matched).toBe(false);
    });
  });
});
