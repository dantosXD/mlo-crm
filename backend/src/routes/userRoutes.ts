import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';
import bcrypt from 'bcryptjs';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/users/team - Get list of active team members (for task assignment)
// This route does NOT require admin access - all authenticated users can see team members
router.get('/team', async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch team members',
    });
  }
});

// Middleware to check for admin role
function requireAdmin(req: AuthRequest, res: Response, next: () => void) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }
  next();
}

// GET /api/users - List all users (Admin only)
router.get('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        // Explicitly exclude passwordHash - never expose passwords
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch users',
    });
  }
});

// GET /api/users/:id - Get single user (Admin only)
router.get('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        // Explicitly exclude passwordHash - never expose passwords
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user',
    });
  }
});

// POST /api/users - Create new user (Admin only)
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email, password, and name are required',
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
        role: role || 'MLO',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        // Explicitly exclude passwordHash
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: req.user!.userId,
        type: 'USER_CREATED',
        description: `Admin created user ${user.name} (${user.email})`,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create user',
    });
  }
});

// PUT /api/users/:id - Update user (Admin only)
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, name, role, isActive, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });

    if (!existingUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Build update data
    const updateData: any = {};
    if (email) {
      updateData.email = email.toLowerCase();
    }
    if (name) {
      updateData.name = name;
    }
    if (role) {
      updateData.role = role;
    }
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Explicitly exclude passwordHash
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: req.user!.userId,
        type: 'USER_UPDATED',
        description: `Admin updated user ${user.name} (${user.email})`,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update user',
    });
  }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingUser = await prisma.user.findUnique({ where: { id } });

    if (!existingUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Prevent deleting self
    if (id === req.user!.userId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Cannot delete your own account',
      });
    }

    await prisma.user.delete({ where: { id } });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: req.user!.userId,
        type: 'USER_DELETED',
        description: `Admin deleted user ${existingUser.name} (${existingUser.email})`,
      },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete user',
    });
  }
});

export default router;
