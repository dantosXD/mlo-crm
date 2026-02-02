/**
 * Seed Pre-built Workflow Templates
 *
 * This script creates the following workflow templates:
 * - Feature #306: Stale Lead Follow-up
 * - Feature #307: Task Escalation
 * - Feature #308: Pre-Closing Checklist
 */

import prisma from '../utils/prisma.js';

// Helper to get admin user ID
async function getAdminUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!admin) {
    throw new Error('No admin user found. Please create an admin user first.');
  }

  return admin.id;
}

// Template 1: Stale Lead Follow-up (Feature #306)
async function createStaleLeadFollowUpTemplate(createdById: string) {
  const existing = await prisma.workflow.findFirst({
    where: { name: 'Stale Lead Follow-up' },
  });

  if (existing) {
    console.log('✓ Stale Lead Follow-up template already exists');
    return existing;
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: 'Stale Lead Follow-up',
      description: 'Automatically follow up with leads that have been inactive for 7 days. Sends an email, creates a follow-up task, and tags the client.',
      isActive: true,
      isTemplate: true,
      triggerType: 'CLIENT_INACTIVITY',
      triggerConfig: JSON.stringify({
        inactiveDays: 7,
      }),
      conditions: JSON.stringify({
        type: 'AND',
        rules: [
          {
            field: 'client.status',
            operator: 'equals',
            value: 'LEAD',
          },
        ],
      }),
      actions: JSON.stringify([
        {
          type: 'SEND_EMAIL',
          config: {
            templateId: null, // Will need to be set by user or reference a generic template
            to: '', // Empty means use client email
          },
          description: 'Send follow-up email to client',
        },
        {
          type: 'CREATE_TASK',
          config: {
            text: 'Follow up with stale lead',
            priority: 'MEDIUM',
            dueDays: 3,
            assignedToId: null, // Assign to workflow executor (user who triggered it)
          },
          description: 'Create task for MLO to call',
        },
        {
          type: 'ADD_TAG',
          config: {
            tags: 'needs-follow-up,stale-lead',
          },
          description: 'Add follow-up tags',
        },
      ]),
      version: 1,
      createdById,
    },
  });

  console.log('✓ Created Stale Lead Follow-up template');
  return workflow;
}

// Template 2: Task Escalation (Feature #307)
async function createTaskEscalationTemplate(createdById: string) {
  const existing = await prisma.workflow.findFirst({
    where: { name: 'Task Escalation' },
  });

  if (existing) {
    console.log('✓ Task Escalation template already exists');
    return existing;
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: 'Task Escalation',
      description: 'Escalate overdue tasks by notifying the assignee, waiting 24 hours, and then notifying their manager if still incomplete.',
      isActive: true,
      isTemplate: true,
      triggerType: 'TASK_OVERDUE',
      triggerConfig: JSON.stringify({}),
      conditions: JSON.stringify(null),
      actions: JSON.stringify([
        {
          type: 'SEND_NOTIFICATION',
          config: {
            userId: null, // Will be set to task assignee at runtime
            title: 'Task Overdue',
            message: 'Task "{{task_text}}" is overdue. Please complete it as soon as possible.',
            link: null, // Will link to task at runtime
          },
          description: 'Notify task assignee',
        },
        {
          type: 'WAIT',
          config: {
            duration: 24,
            unit: 'hours',
          },
          description: 'Wait 24 hours',
        },
        {
          type: 'SEND_NOTIFICATION',
          config: {
            userId: null, // Will be set to manager at runtime
            title: 'Task Escalation',
            message: 'Task "{{task_text}}" assigned to {{assignee_name}} is still overdue after 24 hours.',
            link: null, // Will link to task at runtime
          },
          description: 'Notify manager',
        },
      ]),
      version: 1,
      createdById,
    },
  });

  console.log('✓ Created Task Escalation template');
  return workflow;
}

// Template 3: Pre-Closing Checklist (Feature #308)
async function createPreClosingChecklistTemplate(createdById: string) {
  const existing = await prisma.workflow.findFirst({
    where: { name: 'Pre-Closing Checklist' },
  });

  if (existing) {
    console.log('✓ Pre-Closing Checklist template already exists');
    return existing;
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: 'Pre-Closing Checklist',
      description: 'When a client reaches Clear to Close status, automatically create tasks for final document review and send closing instructions to the client.',
      isActive: true,
      isTemplate: true,
      triggerType: 'CLIENT_STATUS_CHANGED',
      triggerConfig: JSON.stringify({
        toStatus: 'CLEAR_TO_CLOSE',
      }),
      conditions: JSON.stringify(null),
      actions: JSON.stringify([
        {
          type: 'CREATE_TASK',
          config: {
            text: 'Final document review for {{client_name}}',
            priority: 'HIGH',
            dueDays: 2,
            assignedToId: null,
          },
          description: 'Create task for final document review',
        },
        {
          type: 'CREATE_TASK',
          config: {
            text: 'Review closing disclosures with {{client_name}}',
            priority: 'HIGH',
            dueDays: 1,
            assignedToId: null,
          },
          description: 'Create task for closing disclosure review',
        },
        {
          type: 'SEND_EMAIL',
          config: {
            templateId: null, // Will need to be set by user
            to: '',
          },
          description: 'Send closing instructions email',
        },
      ]),
      version: 1,
      createdById,
    },
  });

  console.log('✓ Created Pre-Closing Checklist template');
  return workflow;
}

export async function seedWorkflowTemplates() {
  try {
    console.log('\n🌱 Seeding workflow templates...\n');

    const createdById = await getAdminUserId();

    await createStaleLeadFollowUpTemplate(createdById);
    await createTaskEscalationTemplate(createdById);
    await createPreClosingChecklistTemplate(createdById);

    console.log('\n✅ Workflow templates seeded successfully!\n');
  } catch (error) {
    console.error('❌ Error seeding workflow templates:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedWorkflowTemplates()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}
