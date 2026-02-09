import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import { getEnv } from '../config/env.js';
import { recordAuthAttempt } from '../monitoring/metrics.js';
import { logger } from '../utils/logger.js';

const env = getEnv();
const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;
const REFRESH_TOKEN_EXPIRES_IN = env.REFRESH_TOKEN_EXPIRES_IN;
const REFRESH_TOKEN_COOKIE_NAME = env.REFRESH_TOKEN_COOKIE_NAME;
const isProduction = env.NODE_ENV === 'production';

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

    setRefreshTokenCookie(res, refreshToken);

    return res.status(201).json({
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
