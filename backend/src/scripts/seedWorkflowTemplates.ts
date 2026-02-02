/**
 * Seed Pre-built Workflow Templates
 *
 * This script creates the following workflow templates:
 * - Feature #306: Stale Lead Follow-up
 * - Feature #307: Task Escalation
 * - Feature #308: Pre-Closing Checklist
 * - Feature #309: Post-Closing Thank You
 * - Feature #310: Birthday Greetings
 * - Feature #311: Document Expiration Reminders
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

// Template 4: Post-Closing Thank You (Feature #309)
async function createPostClosingThankYouTemplate(createdById: string) {
  const existing = await prisma.workflow.findFirst({
    where: { name: 'Post-Closing Thank You' },
  });

  if (existing) {
    console.log('✓ Post-Closing Thank You template already exists');
    return existing;
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: 'Post-Closing Thank You',
      description: 'Automatically send a thank you message when a loan closes, wait 7 days, then request a review and referral from the client.',
      isActive: true,
      isTemplate: true,
      triggerType: 'CLIENT_STATUS_CHANGED',
      triggerConfig: JSON.stringify({
        toStatus: 'CLOSED',
      }),
      conditions: JSON.stringify(null),
      actions: JSON.stringify([
        {
          type: 'SEND_EMAIL',
          config: {
            templateId: null, // Will need to be set by user
            to: '', // Empty means use client email
          },
          description: 'Send thank you email',
        },
        {
          type: 'WAIT',
          config: {
            duration: 7,
            unit: 'days',
          },
          description: 'Wait 7 days',
        },
        {
          type: 'SEND_EMAIL',
          config: {
            templateId: null, // Will need to be set by user
            to: '',
          },
          description: 'Send review/referral request email',
        },
        {
          type: 'ADD_TAG',
          config: {
            tags: 'completed',
          },
          description: 'Add completed tag',
        },
      ]),
      version: 1,
      createdById,
    },
  });

  console.log('✓ Created Post-Closing Thank You template');
  return workflow;
}

// Template 5: Birthday Greetings (Feature #310)
async function createBirthdayGreetingsTemplate(createdById: string) {
  const existing = await prisma.workflow.findFirst({
    where: { name: 'Birthday Greetings' },
  });

  if (existing) {
    console.log('✓ Birthday Greetings template already exists');
    return existing;
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: 'Birthday Greetings',
      description: 'Send personalized birthday greetings to clients. Runs daily and checks if today is the client\'s birthday.',
      isActive: true,
      isTemplate: true,
      triggerType: 'MANUAL', // Will be triggered by scheduled job
      triggerConfig: JSON.stringify({}),
      conditions: JSON.stringify({
        type: 'CUSTOM',
        expression: 'client.birthday_today === true',
      }),
      actions: JSON.stringify([
        {
          type: 'SEND_EMAIL',
          config: {
            templateId: null, // Will need to be set by user
            to: '', // Empty means use client email
          },
          description: 'Send birthday greeting email',
        },
        {
          type: 'LOG_ACTIVITY',
          config: {
            description: 'Birthday greeting sent to {{client_name}}',
          },
          description: 'Log birthday greeting',
        },
      ]),
      version: 1,
      createdById,
    },
  });

  console.log('✓ Created Birthday Greetings template');
  return workflow;
}

// Template 6: Document Expiration Reminders (Feature #311)
async function createDocumentExpirationRemindersTemplate(createdById: string) {
  const existing = await prisma.workflow.findFirst({
    where: { name: 'Document Expiration Reminders' },
  });

  if (existing) {
    console.log('✓ Document Expiration Reminders template already exists');
    return existing;
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: 'Document Expiration Reminders',
      description: 'Automatically remind clients and MLOs when documents are expiring (30 days before expiration). Creates a task to request updated documents and sends an email to the client.',
      isActive: true,
      isTemplate: true,
      triggerType: 'MANUAL', // Will be triggered by scheduled job
      triggerConfig: JSON.stringify({}),
      conditions: JSON.stringify({
        type: 'CUSTOM',
        expression: 'document.days_until_expiration <= 30 && document.days_until_expiration > 0',
      }),
      actions: JSON.stringify([
        {
          type: 'CREATE_TASK',
          config: {
            text: 'Request updated {{document_name}} from {{client_name}} (expires in {{days_until_expiration}} days)',
            priority: 'MEDIUM',
            dueDays: 7,
            assignedToId: null, // Assign to workflow executor
          },
          description: 'Create task to request updated document',
        },
        {
          type: 'SEND_EMAIL',
          config: {
            templateId: null, // Will need to be set by user
            to: '', // Empty means use client email
          },
          description: 'Send email to client requesting updated document',
        },
        {
          type: 'UPDATE_DOCUMENT_STATUS',
          config: {
            status: 'REQUIRED',
          },
          description: 'Update document status to REQUIRED',
        },
      ]),
      version: 1,
      createdById,
    },
  });

  console.log('✓ Created Document Expiration Reminders template');
  return workflow;
}

export async function seedWorkflowTemplates() {
  try {
    console.log('\n🌱 Seeding workflow templates...\n');

    const createdById = await getAdminUserId();

    await createStaleLeadFollowUpTemplate(createdById);
    await createTaskEscalationTemplate(createdById);
    await createPreClosingChecklistTemplate(createdById);
    await createPostClosingThankYouTemplate(createdById);
    await createBirthdayGreetingsTemplate(createdById);
    await createDocumentExpirationRemindersTemplate(createdById);

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
