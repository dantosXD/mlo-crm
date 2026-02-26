/**
 * Demo seed — creates realistic mortgage pipeline data for the MLO user.
 * Run with: npx ts-node --esm prisma/seed-demo.ts
 * Or add to package.json scripts: "seed:demo": "ts-node --esm prisma/seed-demo.ts"
 *
 * Safe to re-run: uses upsert/deleteMany scoped to the MLO demo user only.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MLO_EMAIL = 'mlo@example.com';

const DEMO_CLIENTS = [
  {
    name: 'James & Patricia Holloway',
    email: 'james.holloway@email.com',
    phone: '(512) 555-0101',
    status: 'LEAD',
    tags: ['first-time-buyer', 'referral'],
    daysAgo: 2,
  },
  {
    name: 'Marcus Webb',
    email: 'marcus.webb@email.com',
    phone: '(512) 555-0102',
    status: 'PRE_QUALIFIED',
    tags: ['refinance'],
    daysAgo: 8,
  },
  {
    name: 'Sofia Reyes',
    email: 'sofia.reyes@email.com',
    phone: '(512) 555-0103',
    status: 'ACTIVE',
    tags: ['first-time-buyer', 'fha'],
    daysAgo: 14,
  },
  {
    name: 'David & Karen Nguyen',
    email: 'david.nguyen@email.com',
    phone: '(512) 555-0104',
    status: 'PROCESSING',
    tags: ['jumbo', 'investment'],
    daysAgo: 21,
  },
  {
    name: 'Robert Castillo',
    email: 'robert.castillo@email.com',
    phone: '(512) 555-0105',
    status: 'UNDERWRITING',
    tags: ['conventional'],
    daysAgo: 35,
  },
  {
    name: 'Aisha Johnson',
    email: 'aisha.johnson@email.com',
    phone: '(512) 555-0106',
    status: 'CLEAR_TO_CLOSE',
    tags: ['va-loan', 'veteran'],
    daysAgo: 52,
  },
  {
    name: 'Thomas & Linda Park',
    email: 'thomas.park@email.com',
    phone: '(512) 555-0107',
    status: 'CLOSED',
    tags: ['conventional', 'referral'],
    daysAgo: 68,
  },
  {
    name: 'Emily Thornton',
    email: 'emily.thornton@email.com',
    phone: '(512) 555-0108',
    status: 'LEAD',
    tags: ['first-time-buyer'],
    daysAgo: 1,
  },
  {
    name: 'Carlos Mendez',
    email: 'carlos.mendez@email.com',
    phone: '(512) 555-0109',
    status: 'PRE_QUALIFIED',
    tags: ['refinance', 'cash-out'],
    daysAgo: 5,
  },
  {
    name: 'Rachel & Kevin O\'Brien',
    email: 'rachel.obrien@email.com',
    phone: '(512) 555-0110',
    status: 'ACTIVE',
    tags: ['conventional'],
    daysAgo: 18,
  },
  {
    name: 'Samuel Washington',
    email: 'samuel.washington@email.com',
    phone: '(512) 555-0111',
    status: 'PROCESSING',
    tags: ['fha', 'first-time-buyer'],
    daysAgo: 28,
  },
  {
    name: 'Priya Patel',
    email: 'priya.patel@email.com',
    phone: '(512) 555-0112',
    status: 'CLOSED',
    tags: ['jumbo'],
    daysAgo: 90,
  },
];

const DEMO_TASKS = [
  { text: 'Call James Holloway — discuss pre-qualification requirements', priority: 'HIGH', dueDaysFromNow: 1 },
  { text: 'Request W-2s and pay stubs from Sofia Reyes', priority: 'HIGH', dueDaysFromNow: 2 },
  { text: 'Review appraisal report for David & Karen Nguyen', priority: 'HIGH', dueDaysFromNow: 0 },
  { text: 'Submit underwriting package for Robert Castillo', priority: 'MEDIUM', dueDaysFromNow: 3 },
  { text: 'Confirm closing date with Aisha Johnson and title company', priority: 'HIGH', dueDaysFromNow: 1 },
  { text: 'Send rate lock confirmation to Marcus Webb', priority: 'MEDIUM', dueDaysFromNow: 2 },
  { text: 'Follow up on missing bank statements — Carlos Mendez', priority: 'MEDIUM', dueDaysFromNow: 4 },
  { text: 'Schedule home inspection for Rachel & Kevin O\'Brien', priority: 'LOW', dueDaysFromNow: 7 },
  { text: 'Prepare closing disclosure for Aisha Johnson', priority: 'HIGH', dueDaysFromNow: 2 },
  { text: 'Review credit report — Samuel Washington', priority: 'MEDIUM', dueDaysFromNow: 5 },
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log('🌱 Starting demo seed...');

  const mlo = await prisma.user.findUnique({ where: { email: MLO_EMAIL } });
  if (!mlo) {
    console.error(`❌ MLO user not found (${MLO_EMAIL}). Run the base seed first.`);
    process.exit(1);
  }
  console.log(`✅ Found MLO user: ${mlo.name} (${mlo.email})`);

  // ── Clean up old test data for this user ──────────────────────────────────
  console.log('🧹 Removing old test data for MLO user...');
  const existingClients = await prisma.client.findMany({
    where: { createdById: mlo.id },
    select: { id: true },
  });
  const existingClientIds = existingClients.map((c) => c.id);

  if (existingClientIds.length > 0) {
    await prisma.activity.deleteMany({ where: { clientId: { in: existingClientIds } } });
    await prisma.task.deleteMany({ where: { clientId: { in: existingClientIds } } });
    await prisma.document.deleteMany({ where: { clientId: { in: existingClientIds } } });
    await prisma.note.deleteMany({ where: { clientId: { in: existingClientIds } } });
    await prisma.client.deleteMany({ where: { createdById: mlo.id } });
    console.log(`  Removed ${existingClientIds.length} old clients and related records.`);
  }

  // Also remove orphaned tasks (no clientId) created by MLO
  await prisma.task.deleteMany({ where: { createdById: mlo.id, clientId: null } });

  // ── Create demo clients ───────────────────────────────────────────────────
  console.log('👥 Creating demo clients...');
  const createdClients: Array<{ id: string; name: string }> = [];

  for (const demo of DEMO_CLIENTS) {
    const sanitizedName = demo.name.replace(/<[^>]*>/g, '');
    const client = await prisma.client.create({
      data: {
        nameEncrypted: demo.name,
        emailEncrypted: demo.email,
        phoneEncrypted: demo.phone,
        nameHash: sanitizedName.toLowerCase(),
        emailHash: demo.email.toLowerCase(),
        phoneHash: demo.phone,
        status: demo.status,
        tags: JSON.stringify(demo.tags),
        createdById: mlo.id,
        createdAt: daysAgo(demo.daysAgo),
        updatedAt: daysAgo(Math.max(0, demo.daysAgo - 1)),
      },
    });
    createdClients.push({ id: client.id, name: demo.name });
    console.log(`  ✓ ${demo.name} — ${demo.status}`);
  }

  // ── Create demo tasks ─────────────────────────────────────────────────────
  console.log('✅ Creating demo tasks...');
  for (let i = 0; i < DEMO_TASKS.length; i++) {
    const t = DEMO_TASKS[i];
    // Assign task to a client roughly by index
    const client = createdClients[i % createdClients.length];
    await prisma.task.create({
      data: {
        text: t.text,
        status: 'TODO',
        priority: t.priority,
        dueDate: daysFromNow(t.dueDaysFromNow),
        clientId: client.id,
        createdById: mlo.id,
      },
    });
    console.log(`  ✓ ${t.text.slice(0, 60)}...`);
  }

  // ── Create demo loan scenarios ────────────────────────────────────────────
  console.log('💰 Creating demo loan scenarios...');
  const loanData = [
    { clientIdx: 2, amount: 385000, rate: 6.875, term: 30, type: 'CONVENTIONAL', isPreferred: true },
    { clientIdx: 3, amount: 620000, rate: 7.125, term: 30, type: 'JUMBO', isPreferred: true },
    { clientIdx: 4, amount: 295000, rate: 6.5, term: 30, type: 'CONVENTIONAL', isPreferred: true },
    { clientIdx: 5, amount: 410000, rate: 5.75, term: 30, type: 'VA', isPreferred: true },
    { clientIdx: 6, amount: 525000, rate: 6.625, term: 30, type: 'CONVENTIONAL', isPreferred: true },
  ];

  for (const loan of loanData) {
    const client = createdClients[loan.clientIdx];
    if (!client) continue;
    await prisma.loanScenario.create({
      data: {
        clientId: client.id,
        createdById: mlo.id,
        name: `${loan.type} 30yr @ ${loan.rate}%`,
        amount: loan.amount,
        interestRate: loan.rate,
        termYears: loan.term,
        loanType: loan.type,
        status: 'ACTIVE',
        isPreferred: loan.isPreferred,
      },
    });
    console.log(`  ✓ $${loan.amount.toLocaleString()} ${loan.type} for ${client.name}`);
  }

  console.log('');
  console.log('🎉 Demo seed complete!');
  console.log(`   ${DEMO_CLIENTS.length} clients across all pipeline stages`);
  console.log(`   ${DEMO_TASKS.length} realistic tasks with due dates`);
  console.log(`   ${loanData.length} loan scenarios`);
  console.log('');
  console.log('Login: mlo@example.com / password123');
}

main()
  .catch((e) => {
    console.error('Error running demo seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
