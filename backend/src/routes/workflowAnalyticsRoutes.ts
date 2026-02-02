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
        const start = e.startedAt ? new Date(e.startedAt).getTime() : 0;
        const end = e.completedAt ? new Date(e.completedAt).getTime() : 0;
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

// GET /api/analytics/communications - Get communication analytics
router.get('/communications', async (req: AuthRequest, res: Response) => {
  try {
    const { days = '30', group_by = 'day' } = req.query;
    const daysNum = parseInt(days as string, 10);
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    startDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Build where clause based on role
    const where: any = {
      createdAt: {
        gte: startDate,
        lte: today,
      },
    };

    // Role-based data filtering
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      where.createdById = userId;
    }

    // Get all communications within date range
    const communications = await prisma.communication.findMany({
      where,
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Calculate counts by type
    const countsByType = {
      EMAIL: 0,
      SMS: 0,
      LETTER: 0,
    };

    communications.forEach((comm) => {
      if (comm.type in countsByType) {
        countsByType[comm.type as keyof typeof countsByType]++;
      }
    });

    // Calculate counts by status
    const countsByStatus = {
      DRAFT: 0,
      READY: 0,
      SENT: 0,
      FAILED: 0,
    };

    communications.forEach((comm) => {
      if (comm.status in countsByStatus) {
        countsByStatus[comm.status as keyof typeof countsByStatus]++;
      }
    });

    // Calculate time series data based on group_by parameter
    const timeSeries: Array<{ date: string; count: number; sent: number }> = [];

    if (group_by === 'day') {
      // Group by day
      for (let i = daysNum - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayComms = communications.filter((comm) => {
          const commDate = new Date(comm.createdAt);
          return commDate >= date && commDate < nextDate;
        });

        timeSeries.push({
          date: date.toISOString().split('T')[0],
          count: dayComms.length,
          sent: dayComms.filter((c) => c.status === 'SENT').length,
        });
      }
    } else if (group_by === 'week') {
      // Group by week
      const weeks = Math.ceil(daysNum / 7);
      for (let i = 0; i < weeks; i++) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekComms = communications.filter((comm) => {
          const commDate = new Date(comm.createdAt);
          return commDate >= weekStart && commDate < weekEnd;
        });

        timeSeries.push({
          date: `Week of ${weekStart.toISOString().split('T')[0]}`,
          count: weekComms.length,
          sent: weekComms.filter((c) => c.status === 'SENT').length,
        });
      }
      timeSeries.reverse();
    } else if (group_by === 'month') {
      // Group by month
      const months = Math.ceil(daysNum / 30);
      for (let i = 0; i < months; i++) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - (i + 1), 1);
        monthStart.setHours(0, 0, 0, 0);

        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const monthComms = communications.filter((comm) => {
          const commDate = new Date(comm.createdAt);
          return commDate >= monthStart && commDate < monthEnd;
        });

        timeSeries.push({
          date: monthStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
          count: monthComms.length,
          sent: monthComms.filter((c) => c.status === 'SENT').length,
        });
      }
      timeSeries.reverse();
    }

    // Calculate overall statistics
    const totalCommunications = communications.length;
    const sentCommunications = communications.filter((c) => c.status === 'SENT').length;
    const draftCommunications = communications.filter((c) => c.status === 'DRAFT').length;
    const readyCommunications = communications.filter((c) => c.status === 'READY').length;
    const failedCommunications = communications.filter((c) => c.status === 'FAILED').length;

    const sendRate = totalCommunications > 0 ? (sentCommunications / totalCommunications) * 100 : 0;

    // Get total communications count (all time)
    const totalAllTime = await prisma.communication.count({
      where: userRole !== 'ADMIN' && userRole !== 'MANAGER' ? { createdById: userId } : {},
    });

    res.json({
      overview: {
        totalCommunications,
        totalAllTime,
        sentCommunications,
        draftCommunications,
        readyCommunications,
        failedCommunications,
        sendRate: Math.round(sendRate * 100) / 100,
      },
      countsByType,
      countsByStatus,
      timeSeries,
      period: {
        days: daysNum,
        startDate: startDate.toISOString(),
        endDate: today.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching communication analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch communication analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
