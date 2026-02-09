import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from './triggerHandler.js';

describe('verifyWebhookSignature', () => {
  it('returns true for a valid signature', () => {
    const payload = '1700000000.{"event":"created"}';
    const secret = 'test-secret';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    const payload = '1700000000.{"event":"created"}';
    const secret = 'test-secret';

    expect(verifyWebhookSignature(payload, 'invalid-signature', secret)).toBe(false);
  });
});
