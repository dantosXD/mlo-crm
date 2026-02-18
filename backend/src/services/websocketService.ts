import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { authenticateSocket } from '../middleware/socketAuth.js';
import { logger } from '../utils/logger.js';
import { getEnv } from '../config/env.js';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server
 */
export const initializeWebSocket = (httpServer: HTTPServer) => {
  if (io) {
    logger.info('websocket_already_initialized');
    return io;
  }

  const env = getEnv();

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(authenticateSocket);

  // Connection handler
  io.on('connection', (socket) => {
    const userId = (socket.data as any).userId;
    logger.info('websocket_client_connected', { socketId: socket.id, userId });

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Join task-related rooms for real-time task updates
    socket.on('subscribe:tasks', (clientId: string) => {
      if (clientId) {
        socket.join(`tasks:client:${clientId}`);
        logger.info('websocket_subscribed_tasks_client', { socketId: socket.id, clientId });
      } else {
        socket.join('tasks:all');
        logger.info('websocket_subscribed_tasks_all', { socketId: socket.id });
      }
    });

    socket.on('unsubscribe:tasks', (clientId: string) => {
      if (clientId) {
        socket.leave(`tasks:client:${clientId}`);
        logger.info('websocket_unsubscribed_tasks_client', { socketId: socket.id, clientId });
      } else {
        socket.leave('tasks:all');
        logger.info('websocket_unsubscribed_tasks_all', { socketId: socket.id });
      }
    });

    // Join calendar-related rooms
    socket.on('subscribe:calendar', () => {
      socket.join(`calendar:${userId}`);
      logger.info('websocket_subscribed_calendar', { socketId: socket.id, userId });
    });

    socket.on('unsubscribe:calendar', () => {
      socket.leave(`calendar:${userId}`);
      logger.info('websocket_unsubscribed_calendar', { socketId: socket.id, userId });
    });

    // Join reminder-related rooms
    socket.on('subscribe:reminders', () => {
      socket.join(`reminders:${userId}`);
      logger.info('websocket_subscribed_reminders', { socketId: socket.id, userId });
    });

    socket.on('unsubscribe:reminders', () => {
      socket.leave(`reminders:${userId}`);
      logger.info('websocket_unsubscribed_reminders', { socketId: socket.id, userId });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      logger.info('websocket_client_disconnected', { socketId: socket.id, userId });
    });
  });

  logger.info('websocket_server_initialized');
  return io;
};

/**
 * Get Socket.IO instance
 */
export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('WebSocket not initialized. Call initializeWebSocket first.');
  }
  return io;
};

/**
 * Emit task update to subscribed clients
 */
export const emitTaskUpdate = (userId: string, clientId: string | null, task: any, action: 'created' | 'updated' | 'deleted' | 'completed') => {
  const io = getIO();

  // Emit to user's personal room
  io.to(`user:${userId}`).emit('task:update', {
    action,
    task,
    timestamp: new Date()
  });

  // Emit to client-specific room if clientId exists
  if (clientId) {
    io.to(`tasks:client:${clientId}`).emit('task:update', {
      action,
      task,
      timestamp: new Date()
    });
  }

  // Emit to all tasks room
  io.to('tasks:all').emit('task:update', {
    action,
    task,
    timestamp: new Date()
  });
};

/**
 * Emit event update to subscribed clients
 */
export const emitEventUpdate = (userId: string, event: any, action: 'created' | 'updated' | 'deleted' | 'status_changed') => {
  const io = getIO();

  // Emit to user's personal room
  io.to(`user:${userId}`).emit('event:update', {
    action,
    event,
    timestamp: new Date()
  });

  // Emit to calendar room
  io.to(`calendar:${userId}`).emit('event:update', {
    action,
    event,
    timestamp: new Date()
  });
};

/**
 * Emit reminder update to subscribed clients
 */
export const emitReminderUpdate = (userId: string, reminder: any, action: 'created' | 'updated' | 'deleted' | 'completed' | 'dismissed' | 'snoozed') => {
  const io = getIO();

  // Emit to user's personal room
  io.to(`user:${userId}`).emit('reminder:update', {
    action,
    reminder,
    timestamp: new Date()
  });

  // Emit to reminders room
  io.to(`reminders:${userId}`).emit('reminder:update', {
    action,
    reminder,
    timestamp: new Date()
  });
};

/**
 * Emit notification to user
 */
export const emitNotification = (userId: string, notification: any) => {
  const io = getIO();
  io.to(`user:${userId}`).emit('notification', {
    ...notification,
    timestamp: new Date()
  });
};

/**
 * Broadcast to all connected clients
 */
export const broadcastMessage = (event: string, data: any) => {
  const io = getIO();
  io.emit(event, data);
};

export default {
  initializeWebSocket,
  getIO,
  emitTaskUpdate,
  emitEventUpdate,
  emitReminderUpdate,
  emitNotification,
  broadcastMessage
};
