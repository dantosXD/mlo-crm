import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, register, refresh, logout, getMe, updateProfile, changePassword } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Rate limiter for login attempts - 5 attempts per 15 minutes per IP
// NOTE: Temporarily disabled for regression testing
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 5 to 1000 for testing
  message: {
    error: 'Too many login attempts',
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    retryAfter: 15,
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Rate limiter for registration - 3 accounts per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  message: {
    error: 'Too many registration attempts',
    message: 'Too many registration attempts from this IP. Please try again after an hour.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes with rate limiting
router.post('/login', loginLimiter, login);
router.post('/register', registerLimiter, register);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);
router.put('/password', authenticateToken, changePassword);

export default router;
