import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
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
import workflowExecutionRoutes from './routes/workflowExecutionRoutes.js';
import workflowAnalyticsRoutes from './routes/workflowAnalyticsRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import communicationRoutes from './routes/communicationRoutes.js';
import communicationTemplateRoutes from './routes/communicationTemplateRoutes.js';
import attachmentRoutes from './routes/attachmentRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import { generateCsrfToken, validateCsrfToken } from './middleware/csrf.js';
import {
  checkOverdueTasks,
  checkTaskDueDates,
} from './services/triggerHandler.js';
import { seedWorkflowTemplates } from './scripts/seedWorkflowTemplates.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
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
  exposedHeaders: ['X-CSRF-Token'], // Expose CSRF token header to frontend
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Generate CSRF token for all authenticated requests
app.use(generateCsrfToken);

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
      events: '/api/events/*',
    },
  });
});

// Auth routes (no CSRF validation for login/register)
app.use('/api/auth', authRoutes);

// Protected routes with CSRF validation
app.use('/api/clients', validateCsrfToken, clientRoutes);
app.use('/api/notes', validateCsrfToken, noteRoutes);
app.use('/api/tasks', validateCsrfToken, taskRoutes);
app.use('/api/users', validateCsrfToken, userRoutes);
app.use('/api/documents', validateCsrfToken, documentRoutes);
app.use('/api/document-packages', validateCsrfToken, documentPackageRoutes);
app.use('/api/loan-scenarios', validateCsrfToken, loanScenarioRoutes);

// Activity routes
app.use('/api/activities', validateCsrfToken, activityRoutes);

// Notification routes
app.use('/api/notifications', validateCsrfToken, notificationRoutes);

// Workflow routes
app.use('/api/workflows', validateCsrfToken, workflowRoutes);

// Workflow execution routes
app.use('/api/workflow-executions', validateCsrfToken, workflowExecutionRoutes);

// Communication routes
app.use('/api/communications', validateCsrfToken, communicationRoutes);

// Communication template routes
app.use('/api/communication-templates', validateCsrfToken, communicationTemplateRoutes);

// Attachment routes
app.use('/api/attachments', validateCsrfToken, attachmentRoutes);

// Event routes
app.use('/api/events', validateCsrfToken, eventRoutes);

// Analytics routes
app.use('/api/analytics', validateCsrfToken, workflowAnalyticsRoutes);

// Webhook routes (no authentication or CSRF - for external systems)
app.use('/api/webhooks', webhookRoutes);

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

  // Start scheduled job to check for overdue tasks (runs every hour)
  setInterval(async () => {
    try {
      await checkOverdueTasks();
      await checkTaskDueDates(1); // Check tasks due within 1 day
    } catch (error) {
      console.error('[Scheduled Jobs] Error checking task triggers:', error);
    }
  }, 60 * 60 * 1000); // Run every hour

  // Run once on startup
  setTimeout(async () => {
    try {
      console.log('[Scheduled Jobs] Running initial task trigger checks...');
      await checkOverdueTasks();
      await checkTaskDueDates(1);
      console.log('[Scheduled Jobs] Initial task trigger checks completed');
    } catch (error) {
      console.error('[Scheduled Jobs] Error in initial task trigger checks:', error);
    }
  }, 5000); // Run 5 seconds after server starts

  // Seed workflow templates on startup
  setTimeout(async () => {
    try {
      console.log('[Initialization] Checking workflow templates...');
      await seedWorkflowTemplates();
      console.log('[Initialization] Workflow templates check completed');
    } catch (error) {
      console.error('[Initialization] Error seeding workflow templates:', error);
      // Don't fail the server if seeding fails
    }
  }, 10000); // Run 10 seconds after server starts (after DB is ready)
});

export default app;
