import prisma from '../utils/prisma.js';

export interface ReminderSuggestion {
  type: 'WORKFLOW_STAGE' | 'UPCOMING_DUE' | 'INACTIVE_CLIENT' | 'COMPLIANCE' | 'CUSTOM';
  title: string;
  description: string;
  category: string;
  priority: string;
  suggestedRemindAt: Date;
  clientId?: string;
  metadata?: Record<string, any>;
  confidence: number; // 0-1 score
}

export interface SuggestionConfig {
  enabled: boolean;
  minConfidence: number;
  frequency: 'realtime' | 'hourly' | 'daily';
  inactiveDaysThreshold: number;
  dueDateWarningDays: number;
  maxSuggestionsPerBatch: number;
}

class ReminderSuggestionService {
  private defaultConfig: SuggestionConfig = {
    enabled: true,
    minConfidence: 0.5,
    frequency: 'hourly',
    inactiveDaysThreshold: 7,
    dueDateWarningDays: 3,
    maxSuggestionsPerBatch: 10,
  };

  /**
   * Generate reminder suggestions for a user
   */
  async generateSuggestions(userId: string, config?: Partial<SuggestionConfig>): Promise<ReminderSuggestion[]> {
    const finalConfig = { ...this.defaultConfig, ...config };

    if (!finalConfig.enabled) {
      return [];
    }

    const suggestions: ReminderSuggestion[] = [];

    // Get user's preferences for suggestion settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const userPrefs = user?.preferences ? JSON.parse(user.preferences) : {};
    const userConfig = { ...finalConfig, ...userPrefs.reminderSuggestions };

    if (!userConfig.enabled) {
      return [];
    }

    // 1. Workflow stage suggestions
    const workflowSuggestions = await this.analyzeWorkflowStages(userId);
    suggestions.push(...workflowSuggestions);

    // 2. Upcoming due date reminders
    const dueDateSuggestions = await this.analyzeUpcomingDueDates(userId, userConfig.dueDateWarningDays);
    suggestions.push(...dueDateSuggestions);

    // 3. Inactive client follow-ups
    const inactiveSuggestions = await this.analyzeInactiveClients(userId, userConfig.inactiveDaysThreshold);
    suggestions.push(...inactiveSuggestions);

    // 4. Compliance deadline reminders
    const complianceSuggestions = await this.analyzeComplianceDeadlines(userId);
    suggestions.push(...complianceSuggestions);

    // Filter by minimum confidence and limit
    return suggestions
      .filter(s => s.confidence >= userConfig.minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, userConfig.maxSuggestionsPerBatch);
  }

  /**
   * Analyze workflow stages for reminder opportunities
   */
  private async analyzeWorkflowStages(userId: string): Promise<ReminderSuggestion[]> {
    const suggestions: ReminderSuggestion[] = [];

    // Get clients in specific workflow stages that might need reminders
    const clients = await prisma.client.findMany({
      where: {
        createdBy: { id: userId },
        status: { in: ['LEAD', 'PRE_QUALIFIED', 'ACTIVE'] },
      },
      include: {
        communications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      take: 20,
    });

    for (const client of clients) {
      // Lead follow-up suggestion
      if (client.status === 'LEAD') {
        const daysSinceLastContact = client.communications[0]
          ? Math.floor((Date.now() - new Date(client.communications[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        if (daysSinceLastContact > 2) {
          suggestions.push({
            type: 'WORKFLOW_STAGE',
            title: `Follow up with ${client.nameHash}`,
            description: `Lead hasn't been contacted in ${daysSinceLastContact} days`,
            category: 'FOLLOW_UP',
            priority: daysSinceLastContact > 5 ? 'HIGH' : 'MEDIUM',
            suggestedRemindAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
            clientId: client.id,
            metadata: { reason: 'lead_no_contact', daysSinceLastContact },
            confidence: Math.min(0.5 + (daysSinceLastContact / 10), 0.9),
          });
        }
      }

      // Pre-qualified to active conversion
      if (client.status === 'PRE_QUALIFIED') {
        const daysSinceCreated = Math.floor((Date.now() - new Date(client.createdAt).getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceCreated > 3) {
          suggestions.push({
            type: 'WORKFLOW_STAGE',
            title: `Check on application progress for ${client.nameHash}`,
            description: `Pre-qualified ${daysSinceCreated} days ago - check if moving to active`,
            category: 'CLIENT',
            priority: 'MEDIUM',
            suggestedRemindAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
            clientId: client.id,
            metadata: { reason: 'pre_qual_stalled', daysSinceCreated },
            confidence: 0.6,
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Suggest reminders based on upcoming due dates
   */
  private async analyzeUpcomingDueDates(userId: string, warningDays: number): Promise<ReminderSuggestion[]> {
    const suggestions: ReminderSuggestion[] = [];

    // Get tasks with due dates coming up
    const tasks = await prisma.task.findMany({
      where: {
        createdBy: { id: userId },
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000),
        },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        deletedAt: null,
      },
      include: {
        client: true,
      },
    });

    for (const task of tasks) {
      const daysUntilDue = Math.floor((new Date(task.dueDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      suggestions.push({
        type: 'UPCOMING_DUE',
        title: `Task due soon: ${task.text}`,
        description: task.client
          ? `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} for ${task.client.nameHash}`
          : `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
        category: 'CLIENT',
        priority: daysUntilDue <= 1 ? 'URGENT' : daysUntilDue <= 2 ? 'HIGH' : 'MEDIUM',
        suggestedRemindAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        clientId: task.clientId || undefined,
        metadata: { taskId: task.id, daysUntilDue },
        confidence: 0.8 + (daysUntilDue === 0 ? 0.2 : 0), // Higher confidence for urgent tasks
      });
    }

    // Check upcoming document due dates
    const documents = await prisma.document.findMany({
      where: {
        client: { createdBy: { id: userId } },
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000),
        },
        status: { in: ['REQUESTED', 'REQUIRED'] },
      },
      include: {
        client: true,
      },
    });

    for (const doc of documents) {
      const daysUntilDue = Math.floor((new Date(doc.dueDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      suggestions.push({
        type: 'UPCOMING_DUE',
        title: `Document reminder: ${doc.name}`,
        description: `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} for ${doc.client.nameHash}`,
        category: 'COMPLIANCE',
        priority: daysUntilDue <= 1 ? 'URGENT' : 'HIGH',
        suggestedRemindAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
        clientId: doc.clientId,
        metadata: { documentId: doc.id, daysUntilDue },
        confidence: 0.85,
      });
    }

    return suggestions;
  }

  /**
   * Detect inactive client patterns and suggest follow-ups
   */
  private async analyzeInactiveClients(userId: string, inactiveDaysThreshold: number): Promise<ReminderSuggestion[]> {
    const suggestions: ReminderSuggestion[] = [];

    const inactiveDate = new Date(Date.now() - inactiveDaysThreshold * 24 * 60 * 60 * 1000);

    const clients = await prisma.client.findMany({
      where: {
        createdBy: { id: userId },
        status: { in: ['ACTIVE', 'PRE_QUALIFIED'] },
        updatedAt: { lt: inactiveDate },
      },
    });

    for (const client of clients) {
      const daysInactive = Math.floor((Date.now() - new Date(client.updatedAt).getTime()) / (1000 * 60 * 60 * 24));

      suggestions.push({
        type: 'INACTIVE_CLIENT',
        title: `Reconnect with ${client.nameHash}`,
        description: `No activity for ${daysInactive} days - client might need attention`,
        category: 'FOLLOW_UP',
        priority: daysInactive > 14 ? 'HIGH' : 'MEDIUM',
        suggestedRemindAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        clientId: client.id,
        metadata: { daysInactive },
        confidence: Math.min(0.5 + (daysInactive / 30), 0.95),
      });
    }

    return suggestions;
  }

  /**
   * Recommend reminders for compliance deadlines
   */
  private async analyzeComplianceDeadlines(userId: string): Promise<ReminderSuggestion[]> {
    const suggestions: ReminderSuggestion[] = [];

    // Check for documents nearing expiration
    const expiringDocs = await prisma.document.findMany({
      where: {
        client: { createdBy: { id: userId } },
        expiresAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Next 14 days
        },
        status: 'APPROVED',
      },
      include: {
        client: true,
      },
    });

    for (const doc of expiringDocs) {
      const daysUntilExpiry = Math.floor((new Date(doc.expiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      suggestions.push({
        type: 'COMPLIANCE',
        title: `Document expiring soon: ${doc.name}`,
        description: `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'} - request updated document`,
        category: 'COMPLIANCE',
        priority: daysUntilExpiry <= 3 ? 'URGENT' : 'HIGH',
        suggestedRemindAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        clientId: doc.clientId,
        metadata: { documentId: doc.id, daysUntilExpiry },
        confidence: 0.9,
      });
    }

    return suggestions;
  }

  /**
   * Create a reminder from a suggestion
   */
  async acceptSuggestion(userId: string, suggestion: ReminderSuggestion): Promise<any> {
    return prisma.reminder.create({
      data: {
        userId,
        title: suggestion.title,
        description: suggestion.description,
        category: suggestion.category as any,
        priority: suggestion.priority as any,
        remindAt: suggestion.suggestedRemindAt,
        clientId: suggestion.clientId || null,
        metadata: JSON.stringify({
          ...suggestion.metadata,
          suggested: true,
          suggestionType: suggestion.type,
          confidence: suggestion.confidence,
        }),
      },
    });
  }

  /**
   * Track suggestion dismissal for learning
   */
  async trackSuggestionDismissal(userId: string, suggestionType: string, metadata: Record<string, any>): Promise<void> {
    // In a full implementation, this would update a ML model
    // For now, we'll store it in user preferences for basic learning
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const prefs = user?.preferences ? JSON.parse(user.preferences) : {};
    const dismissedTypes = prefs.dismissedSuggestionTypes || {};

    // Increment dismissal count for this type
    dismissedTypes[suggestionType] = (dismissedTypes[suggestionType] || 0) + 1;

    prefs.dismissedSuggestionTypes = dismissedTypes;
    prefs.reminderSuggestions = prefs.reminderSuggestions || this.defaultConfig;

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: JSON.stringify(prefs) },
    });
  }

  /**
   * Get suggestion analytics for a user
   */
  async getSuggestionAnalytics(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const prefs = user?.preferences ? JSON.parse(user.preferences) : {};

    // Get reminders created from suggestions
    const suggestedReminders = await prisma.reminder.findMany({
      where: {
        userId,
        metadata: {
          contains: '"suggested":true',
        },
      },
      take: 100,
    });

    // Calculate acceptance rate by type
    const typeCounts: Record<string, { created: number; completed: number }> = {};

    for (const reminder of suggestedReminders) {
      try {
        const meta = JSON.parse(reminder.metadata || '{}');
        const type = meta.suggestionType || 'UNKNOWN';

        if (!typeCounts[type]) {
          typeCounts[type] = { created: 0, completed: 0 };
        }

        typeCounts[type].created++;
        if (reminder.status === 'COMPLETED') {
          typeCounts[type].completed++;
        }
      } catch (e) {
        // Skip invalid metadata
      }
    }

    return {
      totalSuggested: suggestedReminders.length,
      totalCompleted: suggestedReminders.filter(r => r.status === 'COMPLETED').length,
      byType: typeCounts,
      dismissedTypes: prefs.dismissedSuggestionTypes || {},
      overallCompletionRate: suggestedReminders.length > 0
        ? suggestedReminders.filter(r => r.status === 'COMPLETED').length / suggestedReminders.length
        : 0,
    };
  }
}

export default new ReminderSuggestionService();
