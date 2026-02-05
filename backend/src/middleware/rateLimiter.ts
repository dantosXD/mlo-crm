import { Request, Response, NextFunction } from 'express';

/**
 * In-memory rate limiter for API endpoints
 * For production, use Redis or a similar distributed cache
 */
interface RateLimitStore {
  count: number;
  resetTime: number;
}

const limitStore = new Map<string, RateLimitStore>();

/**
 * Clean up expired entries from the store
 */
const cleanupExpiredEntries = () => {
  const now = Date.now();
  for (const [key, value] of limitStore.entries()) {
    if (now > value.resetTime) {
      limitStore.delete(key);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Rate limiter middleware factory
 * @param maxRequests - Maximum number of requests allowed in the time window
 * @param windowMs - Time window in milliseconds
 * @param keyPrefix - Prefix for the rate limit key (e.g., 'reminder:', 'task:')
 */
export const rateLimiter = (maxRequests: number, windowMs: number, keyPrefix: string = 'api:') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.userId || req.ip;
    const key = `${keyPrefix}${userId}`;
    const now = Date.now();

    // Get or create rate limit entry
    let entry = limitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry
      entry = {
        count: 1,
        resetTime: now + windowMs
      };
      limitStore.set(key, entry);
    } else {
      // Increment count
      entry.count++;
    }

    // Calculate remaining requests and reset time
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetTime = new Date(entry.resetTime);
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetTime.toISOString(),
      'Retry-After': retryAfter.toString()
    });

    // Check if limit exceeded
    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      });
    }

    next();
  };
};

/**
 * Specific rate limiters for different use cases
 */

// Reminder delivery: 10 reminders per minute per user
export const reminderDeliveryLimiter = rateLimiter(10, 60 * 1000, 'reminder:delivery:');

// Bulk operations: 5 bulk operations per minute per user
export const bulkOperationLimiter = rateLimiter(5, 60 * 1000, 'bulk:operation:');

// Search operations: 30 searches per minute per user
export const searchLimiter = rateLimiter(30, 60 * 1000, 'search:');

// Calendar sync: 20 syncs per minute per user
export const calendarSyncLimiter = rateLimiter(20, 60 * 1000, 'calendar:sync:');

// General API: 100 requests per minute per user
export const generalApiLimiter = rateLimiter(100, 60 * 1000, 'api:');

export default rateLimiter;
