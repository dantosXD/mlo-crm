import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import userRoutes from './routes/userRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import documentPackageRoutes from './routes/documentPackageRoutes.js';
import loanScenarioRoutes from './routes/loanScenarioRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import communicationRoutes from './routes/communicationRoutes.js';
import communicationTemplateRoutes from './routes/communicationTemplateRoutes.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const isLocalDevOrigin =
      /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

    const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean);

    if (isLocalDevOrigin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes placeholder
app.get('/api', (_req, res) => {
  res.json({
    message: 'MLO Dashboard API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/*',
      clients: '/api/clients/*',
      notes: '/api/notes/*',
      tasks: '/api/tasks/*',
      documents: '/api/documents/*',
      loanScenarios: '/api/loan-scenarios/*',
      activities: '/api/activities/*',
      analytics: '/api/analytics/*',
      workflows: '/api/workflows/*',
      communications: '/api/communications/*',
      communicationTemplates: '/api/communication-templates/*',
    },
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/clients', clientRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/document-packages', documentPackageRoutes);
app.use('/api/loan-scenarios', loanScenarioRoutes);

// Activity routes
app.use('/api/activities', activityRoutes);

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Workflow routes
app.use('/api/workflows', workflowRoutes);

// Communication routes
app.use('/api/communications', communicationRoutes);

// Communication template routes
app.use('/api/communication-templates', communicationTemplateRoutes);

// TODO: Implement remaining route modules
// app.use('/api/analytics', analyticsRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════╗
  ║     MLO Dashboard API Server               ║
  ╠════════════════════════════════════════════╣
  ║  Status: Running                           ║
  ║  Port:   ${PORT}                              ║
  ║  Mode:   ${process.env.NODE_ENV || 'development'}                     ║
  ╠════════════════════════════════════════════╣
  ║  Health: http://localhost:${PORT}/health       ║
  ║  API:    http://localhost:${PORT}/api          ║
  ╚════════════════════════════════════════════╝
  `);
});

export default app;
