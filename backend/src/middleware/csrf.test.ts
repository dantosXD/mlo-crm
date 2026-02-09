import { describe, expect, it, vi } from 'vitest';
import { generateCsrfToken, validateCsrfToken } from './csrf.js';

function createResponseMock() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('csrf middleware', () => {
  it('sets csrf cookie for authenticated requests', () => {
    const req: any = {
      headers: {
        authorization: 'Bearer token-1',
      },
      cookies: {},
    };
    const res = createResponseMock();
    const next = vi.fn();

    generateCsrfToken(req, res, next);

    expect(res.cookie).toHaveBeenCalledOnce();
    expect(res.setHeader).toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
    expect(next).toHaveBeenCalledOnce();
  });

  it('accepts matching csrf cookie/header pair on mutating request', () => {
    const req: any = {
      method: 'POST',
      path: '/api/tasks',
      headers: {
        'x-csrf-token': 'csrf-123',
      },
      cookies: {
        'csrf-token': 'csrf-123',
      },
    };
    const res = createResponseMock();
    const next = vi.fn();

    validateCsrfToken(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects missing csrf header for mutating request', () => {
    const req: any = {
      method: 'POST',
      path: '/api/tasks',
      headers: {},
      cookies: {
        'csrf-token': 'csrf-123',
      },
    };
    const res = createResponseMock();
    const next = vi.fn();

    validateCsrfToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
