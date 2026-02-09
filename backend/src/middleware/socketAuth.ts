import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';

interface SocketData {
  userId: string;
  email: string;
}

/**
 * Authenticate WebSocket connection using JWT token
 */
export const authenticateSocket = async (socket: Socket, next: any) => {
  try {
    // Get token from auth handshake
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify token
    const decoded = jwt.verify(token, getEnv().JWT_SECRET) as any;

    if (!decoded.userId) {
      return next(new Error('Authentication error: Invalid token'));
    }

    // Attach user data to socket
    (socket.data as SocketData).userId = decoded.userId;
    (socket.data as SocketData).email = decoded.email;

    next();
  } catch (error) {
    console.error('WebSocket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};

export default authenticateSocket;
