import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import { getEnv } from '../config/env.js';
import { recordAuthAttempt } from '../monitoring/metrics.js';
import { logger } from '../utils/logger.js';
import { sendPasswordResetEmail } from '../services/mailerService.js';

const env = getEnv();
const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;
const REFRESH_TOKEN_EXPIRES_IN = env.REFRESH_TOKEN_EXPIRES_IN;
const REFRESH_TOKEN_COOKIE_NAME = env.REFRESH_TOKEN_COOKIE_NAME;
const isProduction = env.NODE_ENV === 'production';
const PASSWORD_RESET_TOKEN_EXPIRES_MS = 60 * 60 * 1000; // 1 hour

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions);
}

function generateRefreshToken(): string {
  return uuidv4();
}

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // Default 30 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
}

function setRefreshTokenCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge: parseExpiresIn(REFRESH_TOKEN_EXPIRES_IN),
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/api/auth',
  });
}

function readRefreshTokenFromRequest(req: Request): string | null {
  return req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || null;
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getResetLinkBaseUrl(req: Request): string {
  if (env.FRONTEND_URL) {
    return env.FRONTEND_URL.replace(/\/+$/, '');
  }

  const host = req.get('host');
  if (host) {
    return `${req.protocol}://${host}`;
  }

  return 'http://localhost:5173';
}

async function issuePasswordResetToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRES_MS);

  await prisma.passwordResetToken.deleteMany({
    where: {
      userId,
      OR: [{ usedAt: null }, { expiresAt: { lt: new Date() } }],
    },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required',
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      recordAuthAttempt(false);
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      recordAuthAttempt(false);
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      recordAuthAttempt(false);
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken();
    const refreshTokenExpiry = new Date(Date.now() + parseExpiresIn(REFRESH_TOKEN_EXPIRES_IN));

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        type: 'LOGIN',
        description: `User ${user.name} logged in`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    // Generate CSRF token for the session
    const csrfToken = crypto.randomBytes(32).toString('hex');

    setRefreshTokenCookie(res, refreshToken);
    recordAuthAttempt(true);

    return res
      .header('X-CSRF-Token', csrfToken)
      .json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
  } catch (error) {
    logger.error('auth_login_failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during login',
    });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email, password, and name are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 8 characters long',
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: 'MLO', // Default role
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken();
    const refreshTokenExpiry = new Date(Date.now() + parseExpiresIn(REFRESH_TOKEN_EXPIRES_IN));

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        type: 'LOGIN',
        description: `User ${user.name} registered and logged in`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    // Generate CSRF token for the session
    const csrfToken = crypto.randomBytes(32).toString('hex');

    setRefreshTokenCookie(res, refreshToken);

    return res
      .status(201)
      .header('X-CSRF-Token', csrfToken)
      .json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
  } catch (error) {
    logger.error('auth_register_failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during registration',
    });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const refreshToken = readRefreshTokenFromRequest(req);

    if (!refreshToken) {
      recordAuthAttempt(false);
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Refresh token cookie is required',
      });
    }

    // Find valid refresh token
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      clearRefreshTokenCookie(res);
      recordAuthAttempt(false);
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid or expired refresh token',
      });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId },
    });

    if (!user || !user.isActive) {
      clearRefreshTokenCookie(res);
      recordAuthAttempt(false);
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'User not found or inactive',
      });
    }

    // Delete old refresh token
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Generate new tokens
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const newRefreshToken = generateRefreshToken();
    const refreshTokenExpiry = new Date(Date.now() + parseExpiresIn(REFRESH_TOKEN_EXPIRES_IN));

    // Store new refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: newRefreshToken,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Generate new CSRF token for the session
    const csrfToken = crypto.randomBytes(32).toString('hex');

    setRefreshTokenCookie(res, newRefreshToken);
    recordAuthAttempt(true);

    return res
      .header('X-CSRF-Token', csrfToken)
      .json({
        accessToken: newAccessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
  } catch (error) {
    logger.error('auth_refresh_failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while refreshing token',
    });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const refreshToken = readRefreshTokenFromRequest(req);

    if (refreshToken) {
      // Delete refresh token
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    clearRefreshTokenCookie(res);
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('auth_logout_failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during logout',
    });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email is required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    let debugResetLink: string | undefined;

    if (user && user.isActive) {
      const { token, expiresAt } = await issuePasswordResetToken(user.id);
      const resetLink = `${getResetLinkBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;

      await prisma.activity.create({
        data: {
          userId: user.id,
          type: 'PASSWORD_RESET_REQUESTED',
          description: `Password reset requested for ${user.email}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });

      let emailDeliveryError: string | null = null;
      try {
        await sendPasswordResetEmail({
          to: user.email,
          resetLink,
          expiresAt,
        });
      } catch (error) {
        emailDeliveryError = error instanceof Error ? error.message : String(error);
        logger.error('auth_password_reset_email_failed', {
          userId: user.id,
          email: user.email,
          error: emailDeliveryError,
        });
      }

      await prisma.activity.create({
        data: {
          userId: user.id,
          type: emailDeliveryError ? 'PASSWORD_RESET_EMAIL_FAILED' : 'PASSWORD_RESET_EMAIL_SENT',
          description: emailDeliveryError
            ? `Password reset email delivery failed for ${user.email}`
            : `Password reset email sent to ${user.email}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });

      logger.info('auth_password_reset_requested', {
        userId: user.id,
        email: user.email,
        expiresAt: expiresAt.toISOString(),
        emailDeliveryError,
        ...(env.NODE_ENV === 'development' ? { resetLink } : {}),
      });

      if (!isProduction) {
        debugResetLink = resetLink;
      }
    }

    return res.json({
      message: 'If an account exists for that email, a password reset link has been sent.',
      ...(debugResetLink ? { debugResetLink } : {}),
    });
  } catch (error) {
    logger.error('auth_forgot_password_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while processing password reset request',
    });
  }
}

export async function validatePasswordResetToken(req: Request, res: Response) {
  try {
    const token = typeof req.query.token === 'string'
      ? req.query.token
      : typeof req.body?.token === 'string'
        ? req.body.token
        : '';

    if (!token) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Reset token is required',
      });
    }

    const tokenHash = hashResetToken(token);
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: { isActive: true },
        },
      },
    });

    if (!resetToken || !resetToken.user.isActive) {
      return res.status(400).json({
        error: 'Invalid Token',
        message: 'Password reset token is invalid or expired',
      });
    }

    return res.json({ valid: true });
  } catch (error) {
    logger.error('auth_validate_reset_token_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while validating reset token',
    });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Reset token is required',
      });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'New password is required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'New password must be at least 8 characters',
      });
    }

    const tokenHash = hashResetToken(token);
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
    });

    if (!resetToken || !resetToken.user.isActive) {
      return res.status(400).json({
        error: 'Invalid Token',
        message: 'Password reset token is invalid or expired',
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId: resetToken.userId },
      }),
      prisma.activity.create({
        data: {
          userId: resetToken.userId,
          type: 'PASSWORD_RESET_COMPLETED',
          description: 'User reset their password',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      }),
    ]);

    return res.json({
      message: 'Password reset successfully. Please sign in with your new password.',
    });
  } catch (error) {
    logger.error('auth_reset_password_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while resetting password',
    });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    // User should be attached by auth middleware
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'Please log in to access this resource',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    return res.json(user);
  } catch (error) {
    logger.error('auth_get_me_failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while fetching user data',
    });
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'Please log in to access this resource',
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Current password is required',
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'New password is required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'New password must be at least 8 characters',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Current password is incorrect',
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await prisma.activity.create({
      data: {
        userId: userId,
        type: 'PASSWORD_CHANGED',
        description: 'User changed their password',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('auth_change_password_failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while changing password',
    });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    // User should be attached by auth middleware
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'Please log in to access this resource',
      });
    }

    const { name, email } = req.body;

    // Build update data - only include fields that are provided
    const updateData: { name?: string; email?: string } = {};

    if (name && typeof name === 'string' && name.trim().length > 0) {
      updateData.name = name.trim();
    }

    if (email && typeof email === 'string' && email.trim().length > 0) {
      // Check if email is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'This email is already in use by another account',
        });
      }

      updateData.email = email.toLowerCase().trim();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'No valid fields to update',
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: userId,
        type: 'PROFILE_UPDATED',
        description: `User updated their profile`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('auth_update_profile_failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while updating profile',
    });
  }
}
