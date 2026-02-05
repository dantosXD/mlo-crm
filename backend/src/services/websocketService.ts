import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { authenticateSocket } from '../middleware/socketAuth.js';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server
 */
export const initializeWebSocket = (httpServer: HTTPServer) => {
  if (io) {
    console.log('WebSocket already initialized');
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
    console.log(`WebSocket client connected: ${socket.id} for user: ${userId}`);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Join task-related rooms for real-time task updates
    socket.on('subscribe:tasks', (clientId: string) => {
      if (clientId) {
        socket.join(`tasks:client:${clientId}`);
        console.log(`Socket ${socket.id} subscribed to tasks for client ${clientId}`);
      } else {
        socket.join('tasks:all');
        console.log(`Socket ${socket.id} subscribed to all tasks`);
      }
    });

    socket.on('unsubscribe:tasks', (clientId: string) => {
      if (clientId) {
        socket.leave(`tasks:client:${clientId}`);
        console.log(`Socket ${socket.id} unsubscribed from tasks for client ${clientId}`);
      } else {
        socket.leave('tasks:all');
        console.log(`Socket ${socket.id} unsubscribed from all tasks`);
      }
    });

    // Join calendar-related rooms
    socket.on('subscribe:calendar', () => {
      socket.join(`calendar:${userId}`);
      console.log(`Socket ${socket.id} subscribed to calendar for user ${userId}`);
    });

    socket.on('unsubscribe:calendar', () => {
      socket.leave(`calendar:${userId}`);
      console.log(`Socket ${socket.id} unsubscribed from calendar`);
    });

    // Join reminder-related rooms
    socket.on('subscribe:reminders', () => {
      socket.join(`reminders:${userId}`);
      console.log(`Socket ${socket.id} subscribed to reminders for user ${userId}`);
    });

    socket.on('unsubscribe:reminders', () => {
      socket.leave(`reminders:${userId}`);
      console.log(`Socket ${socket.id} unsubscribed from reminders`);
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`WebSocket client disconnected: ${socket.id} for user: ${userId}`);
    });
  });

  console.log('WebSocket server initialized');
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
