import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/analytics/workflows - Get workflow analytics
router.get('/workflows', async (req: AuthRequest, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10);

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    startDate.setHours(0, 0, 0, 0);

    // Get all executions within date range
    const executions = await prisma.workflowExecution.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            triggerType: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate overall statistics
    const totalExecutions = executions.length;
    const completedExecutions = executions.filter((e) => e.status === 'COMPLETED');
    const failedExecutions = executions.filter((e) => e.status === 'FAILED');
    const runningExecutions = executions.filter((e) => e.status === 'RUNNING');
    const pendingExecutions = executions.filter((e) => e.status === 'PENDING');

    const successRate = totalExecutions > 0
      ? (completedExecutions.length / totalExecutions) * 100
      : 0;

    // Calculate average execution time (for completed executions)
    const executionTimes = completedExecutions
      .filter((e) => e.startedAt && e.completedAt)
      .map((e) => {
        const start = new Date(e.startedAt).getTime();
        const end = new Date(e.completedAt!).getTime();
        return end - start;
      });

    const avgExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
      : 0;

    // Group executions by workflow
    const workflowStats = new Map<
      string,
      {
        workflowId: string;
        workflowName: string;
        triggerType: string;
        isActive: boolean;
        totalExecutions: number;
        completedExecutions: number;
        failedExecutions: number;
        avgExecutionTime: number;
      }
    >();

    executions.forEach((execution) => {
      const workflowId = execution.workflowId;
      const existing = workflowStats.get(workflowId);

      if (existing) {
        existing.totalExecutions++;
        if (execution.status === 'COMPLETED') existing.completedExecutions++;
        if (execution.status === 'FAILED') existing.failedExecutions++;
      } else {
        workflowStats.set(workflowId, {
          workflowId,
          workflowName: execution.workflow.name,
          triggerType: execution.workflow.triggerType,
          isActive: execution.workflow.isActive,
          totalExecutions: 1,
          completedExecutions: execution.status === 'COMPLETED' ? 1 : 0,
          failedExecutions: execution.status === 'FAILED' ? 1 : 0,
          avgExecutionTime: 0,
        });
      }
    });

    // Calculate average execution time per workflow
    workflowStats.forEach((stats) => {
      const workflowExecutions = completedExecutions.filter(
        (e) => e.workflowId === stats.workflowId && e.startedAt && e.completedAt
      );

      if (workflowExecutions.length > 0) {
        const times = workflowExecutions.map((e) => {
          const start = new Date(e.startedAt!).getTime();
          const end = new Date(e.completedAt!).getTime();
          return end - start;
        });
        stats.avgExecutionTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      }
    });

    // Convert to array and sort by total executions
    const mostTriggeredWorkflows = Array.from(workflowStats.values())
      .sort((a, b) => b.totalExecutions - a.totalExecutions)
      .slice(0, 10);

    // Calculate executions per day for the time series
    const executionsPerDay: Record<string, number> = {};
    const today = new Date();

    for (let i = 0; i < daysNum; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      executionsPerDay[dateStr] = 0;
    }

    executions.forEach((execution) => {
      const dateStr = execution.createdAt.toISOString().split('T')[0];
      if (executionsPerDay.hasOwnProperty(dateStr)) {
        executionsPerDay[dateStr]++;
      }
    });

    // Format time series data
    const timeSeries = Object.entries(executionsPerDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      overview: {
        totalExecutions,
        completedExecutions: completedExecutions.length,
        failedExecutions: failedExecutions.length,
        runningExecutions: runningExecutions.length,
        pendingExecutions: pendingExecutions.length,
        successRate: Math.round(successRate * 100) / 100,
        avgExecutionTime: Math.round(avgExecutionTime),
      },
      mostTriggeredWorkflows,
      timeSeries,
      period: {
        days: daysNum,
        startDate: startDate.toISOString(),
        endDate: today.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching workflow analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch workflow analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
