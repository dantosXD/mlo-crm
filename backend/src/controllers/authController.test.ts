import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  activity: {
    create: vi.fn(),
  },
};

const bcryptCompare = vi.fn();
const jwtSign = vi.fn();
const uuidV4 = vi.fn();

vi.mock('../utils/prisma.js', () => ({
  default: prismaMock,
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: bcryptCompare,
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: jwtSign,
  },
}));

vi.mock('uuid', () => ({
  v4: uuidV4,
}));

function createResponseMock() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('auth controller cookie-based refresh flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jwtSign.mockReturnValue('access-token-1');
    uuidV4.mockReturnValue('refresh-token-1');
  });

  it('login sets refresh cookie and does not return refreshToken in JSON', async () => {
    const { login } = await import('./authController.js');
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      isActive: true,
      passwordHash: 'hashed',
    });
    prismaMock.user.update.mockResolvedValue(undefined);
    prismaMock.refreshToken.create.mockResolvedValue(undefined);
    prismaMock.activity.create.mockResolvedValue(undefined);
    bcryptCompare.mockResolvedValue(true);

    const req: any = {
      body: {
        email: 'admin@example.com',
        password: 'password123',
      },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('unit-test-agent'),
    };
    const res = createResponseMock();

    await login(req, res);

    expect(res.cookie).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'access-token-1',
      })
    );
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('refreshToken');
  });

  it('refresh reads refresh token from cookie and rotates cookie', async () => {
    const { refresh } = await import('./authController.js');
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      token: 'refresh-token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      isActive: true,
    });
    prismaMock.refreshToken.delete.mockResolvedValue(undefined);
    prismaMock.refreshToken.create.mockResolvedValue(undefined);
    uuidV4.mockReturnValue('refresh-token-2');

    const req: any = {
      cookies: {
        refresh_token: 'refresh-token-1',
      },
    };
    const res = createResponseMock();

    await refresh(req, res);

    expect(prismaMock.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { token: 'refresh-token-1' },
    });
    expect(res.cookie).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('refreshToken');
  });

  it('logout clears refresh cookie and removes token from store', async () => {
    const { logout } = await import('./authController.js');
    prismaMock.refreshToken.deleteMany.mockResolvedValue(undefined);

    const req: any = {
      cookies: {
        refresh_token: 'refresh-token-2',
      },
    };
    const res = createResponseMock();

    await logout(req, res);

    expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'refresh-token-2' },
    });
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
  });

  it('updateProfile persists phone in preferences and returns phone in payload', async () => {
    const { updateProfile } = await import('./authController.js');

    prismaMock.user.findUnique.mockResolvedValueOnce({
      preferences: JSON.stringify({
        profile: {
          locale: 'en-US',
        },
      }),
    });
    prismaMock.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      preferences: JSON.stringify({
        profile: {
          locale: 'en-US',
          phone: '555-101-2020',
        },
      }),
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });
    prismaMock.activity.create.mockResolvedValue(undefined);

    const req: any = {
      user: { userId: 'user-1' },
      body: { phone: '555-101-2020' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('unit-test-agent'),
    };
    const res = createResponseMock();

    await updateProfile(req, res);

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          preferences: expect.any(String),
        }),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Profile updated successfully',
        user: expect.objectContaining({
          phone: '555-101-2020',
        }),
      }),
    );
  });
});
