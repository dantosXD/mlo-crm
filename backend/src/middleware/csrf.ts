import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Extend Express Request to include CSRF token
export interface CsrfRequest extends Request {
  csrfToken?: string;
}

// Store for CSRF tokens (in production, use Redis or similar)
const tokenStore = new Map<string, { token: string; expiresAt: number }>();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of tokenStore.entries()) {
    if (data.expiresAt < now) {
      tokenStore.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

// Generate CSRF token
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Get session ID from request
function getSessionId(req: Request): string {
  // Try to get session ID from cookie or create one based on user agent + IP
  const sessionId = req.cookies?.sessionId ||
    req.headers['x-session-id'] as string ||
    crypto.createHash('sha256')
      .update(`${req.ip}-${req.headers['user-agent'] || 'unknown'}`)
      .digest('hex');
  return sessionId;
}

// Middleware to generate CSRF token for authenticated requests
export function generateCsrfToken(req: CsrfRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];

  // Only generate CSRF token for authenticated requests
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionId = getSessionId(req);
    const token = generateCsrfToken();

    // Store token with 1 hour expiration
    tokenStore.set(sessionId, {
      token,
      expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
    });

    // Add CSRF token to response headers
    res.setHeader('X-CSRF-Token', token);

    // Also store it on request for potential use
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

  // Get CSRF token from header
  const csrfToken = req.headers['x-csrf-token'] as string;

  if (!csrfToken) {
    return res.status(403).json({
      error: 'CSRF Token Missing',
      message: 'CSRF token is required for this request. Include it in the X-CSRF-Token header.',
    });
  }

  // Get session ID and validate token
  const sessionId = getSessionId(req);
  const storedData = tokenStore.get(sessionId);

  if (!storedData || storedData.expiresAt < Date.now()) {
    return res.status(403).json({
      error: 'CSRF Token Invalid or Expired',
      message: 'CSRF token is invalid or has expired. Please refresh and try again.',
    });
  }

  if (storedData.token !== csrfToken) {
    return res.status(403).json({
      error: 'CSRF Token Mismatch',
      message: 'CSRF token does not match. This could indicate a cross-site request forgery attempt.',
    });
  }

  // Token is valid, proceed
  next();
}

// Middleware to rotate CSRF token after use (optional, for higher security)
export function rotateCsrfToken(req: CsrfRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionId = getSessionId(req);
    const newToken = generateCsrfToken();

    // Update stored token
    tokenStore.set(sessionId, {
      token: newToken,
      expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
    });

    // Send new token in response header
    res.setHeader('X-CSRF-Token', newToken);
    req.csrfToken = newToken;
  }

  next();
}
