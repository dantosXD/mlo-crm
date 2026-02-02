/**
 * Seed Pre-built Workflow Templates (JavaScript version)
 *
 * This script creates workflow templates via API calls
 */

const http = require('http');

const API_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

// Get auth token
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.accessToken) {
            resolve(response.accessToken);
          } else {
            reject(new Error('No access token in response'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Create workflow template
async function createWorkflowTemplate(token, template) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(template);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/workflows',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 201) {
            resolve(response);
          } else {
            reject(new Error(`Failed to create: ${response.message || data}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Main seeding function
async function seedTemplates() {
  try {
    console.log('\n🌱 Seeding workflow templates...\n');

    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('✓ Auth token received');

    // Template 1: Stale Lead Follow-up
    console.log('\n📋 Creating Stale Lead Follow-up template...');
    try {
      await createWorkflowTemplate(token, {
        name: 'Stale Lead Follow-up',
        description: 'Automatically follow up with leads that have been inactive for 7 days. Sends an email, creates a follow-up task, and tags the client.',
        isActive: true,
        isTemplate: true,
        triggerType: 'CLIENT_INACTIVITY',
        triggerConfig: {
          inactiveDays: 7,
        },
        conditions: {
          type: 'AND',
          rules: [
            {
              field: 'client.status',
              operator: 'equals',
              value: 'LEAD',
            },
          ],
        },
        actions: [
          {
            type: 'SEND_EMAIL',
            config: {
              templateId: null,
              to: '',
            },
            description: 'Send follow-up email to client',
          },
          {
            type: 'CREATE_TASK',
            config: {
              text: 'Follow up with stale lead',
              priority: 'MEDIUM',
              dueDays: 3,
              assignedToId: null,
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
        ],
      });
      console.log('✓ Created Stale Lead Follow-up template');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ Stale Lead Follow-up template already exists');
      } else {
        console.error('✗ Failed:', error.message);
      }
    }

    // Template 2: Task Escalation
    console.log('\n📋 Creating Task Escalation template...');
    try {
      await createWorkflowTemplate(token, {
        name: 'Task Escalation',
        description: 'Escalate overdue tasks by notifying the assignee, waiting 24 hours, and then notifying their manager if still incomplete.',
        isActive: true,
        isTemplate: true,
        triggerType: 'TASK_OVERDUE',
        triggerConfig: {},
        conditions: null,
        actions: [
          {
            type: 'SEND_NOTIFICATION',
            config: {
              userId: null,
              title: 'Task Overdue',
              message: 'Task is overdue. Please complete it as soon as possible.',
              link: null,
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
              userId: null,
              title: 'Task Escalation',
              message: 'Task is still overdue after 24 hours.',
              link: null,
            },
            description: 'Notify manager',
          },
        ],
      });
      console.log('✓ Created Task Escalation template');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ Task Escalation template already exists');
      } else {
        console.error('✗ Failed:', error.message);
      }
    }

    // Template 3: Pre-Closing Checklist
    console.log('\n📋 Creating Pre-Closing Checklist template...');
    try {
      await createWorkflowTemplate(token, {
        name: 'Pre-Closing Checklist',
        description: 'When a client reaches Clear to Close status, automatically create tasks for final document review and send closing instructions to the client.',
        isActive: true,
        isTemplate: true,
        triggerType: 'CLIENT_STATUS_CHANGED',
        triggerConfig: {
          toStatus: 'CLEAR_TO_CLOSE',
        },
        conditions: null,
        actions: [
          {
            type: 'CREATE_TASK',
            config: {
              text: 'Final document review',
              priority: 'HIGH',
              dueDays: 2,
              assignedToId: null,
            },
            description: 'Create task for final document review',
          },
          {
            type: 'CREATE_TASK',
            config: {
              text: 'Review closing disclosures',
              priority: 'HIGH',
              dueDays: 1,
              assignedToId: null,
            },
            description: 'Create task for closing disclosure review',
          },
          {
            type: 'SEND_EMAIL',
            config: {
              templateId: null,
              to: '',
            },
            description: 'Send closing instructions email',
          },
        ],
      });
      console.log('✓ Created Pre-Closing Checklist template');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ Pre-Closing Checklist template already exists');
      } else {
        console.error('✗ Failed:', error.message);
      }
    }

    console.log('\n✅ Workflow templates seeded successfully!\n');
  } catch (error) {
    console.error('\n❌ Error seeding workflow templates:', error.message);
    process.exit(1);
  }
}

// Run the script
seedTemplates();
