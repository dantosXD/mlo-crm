import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Extend Express Request to include CSRF token
export interface CsrfRequest extends Request {
  csrfToken?: string;
}

const CSRF_COOKIE_NAME = 'csrf-token';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Cookie-based double-submit CSRF protection.
 *
 * How it works:
 * 1. generateCsrfToken sets a non-HttpOnly cookie with a random token on
 *    every authenticated response. The cookie uses SameSite=Strict so the
 *    browser will never send it on cross-origin requests.
 * 2. The frontend reads the cookie value and echoes it in the X-CSRF-Token
 *    header on every state-changing request (POST/PUT/PATCH/DELETE).
 * 3. validateCsrfToken compares the cookie value with the header value.
 *    If they match the request is legitimate — an attacker on another origin
 *    cannot read the cookie (Same-Origin Policy) so they cannot forge the header.
 *
 * No server-side token store is needed. Survives restarts and scales to
 * multiple instances without Redis.
 */

function createCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware to set CSRF cookie for authenticated requests
export function generateCsrfToken(req: CsrfRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];

  // Only set CSRF cookie for authenticated requests
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Reuse existing cookie value if present, otherwise generate new
    let token = req.cookies?.[CSRF_COOKIE_NAME];
    if (!token) {
      token = createCsrfToken();
    }

    // Set cookie: NOT HttpOnly so frontend JS can read it
    // SameSite=Strict prevents cross-origin sending
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    // Also expose in response header for backward compatibility
    res.setHeader('X-CSRF-Token', token);
    req.csrfToken = token;
  }

  next();
}

// Middleware to validate CSRF token on state-changing requests
export function validateCsrfToken(req: CsrfRequest, res: Response, next: NextFunction) {
  // Skip CSRF validation for GET, HEAD, OPTIONS requests (they should be idempotent)
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  // Skip CSRF check for login/register endpoints (they're not authenticated yet)
  if (req.path.includes('/auth/login') || req.path.includes('/auth/register')) {
    return next();
  }

  // Get CSRF token from header (set by frontend JS)
  const headerToken = req.headers['x-csrf-token'] as string;

  if (!headerToken) {
    return res.status(403).json({
      error: 'CSRF Token Missing',
      message: 'CSRF token is required for this request. Include it in the X-CSRF-Token header.',
    });
  }

  // Get CSRF token from cookie (set by this middleware)
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!cookieToken) {
    return res.status(403).json({
      error: 'CSRF Cookie Missing',
      message: 'CSRF cookie is missing. Please refresh and try again.',
    });
  }

  // Double-submit check: cookie must match header
  if (cookieToken !== headerToken) {
    return res.status(403).json({
      error: 'CSRF Token Mismatch',
      message: 'CSRF token does not match. This could indicate a cross-site request forgery attempt.',
    });
  }

  // Token is valid, proceed
  next();
}
