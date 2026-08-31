/**
 * Development seed (ts-node). Kept behaviourally identical to the compiled
 * production entrypoint at prisma/seed/seed.js — update both together.
 */
import { PrismaClient, UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Deterministic per-email dev password so credentials are reproducible across boots. */
function derivePassword(email: string): string {
  return createHash('sha256')
    .update(email + (process.env.SEED_SECRET || 'colossus-seed'))
    .digest('hex')
    .slice(0, 16);
}

const SEED_USERS: Array<{
  id: string;
  email: string;
  name: string;
  role: UserRole;
}> = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    name: 'Admin User',
    role: UserRole.ADMIN,
  },
];

// Ordered oldest -> newest. The wall renders `createdAt DESC, id DESC`, so the
// last entry here is the first card on the wall.
const SEED_PINS: Array<{
  id: string;
  title: string;
  body: string;
  createdAt: Date;
}> = [
  {
    id: 'a1111111-1111-4111-8111-111111111111',
    title: 'Rooftop Garden Plan',
    body: 'Map out planter boxes and a drip line for the south corner before the first frost.',
    createdAt: new Date('2026-01-05T09:00:00.000Z'),
  },
  {
    id: 'b2222222-2222-4222-8222-222222222222',
    title: 'Migration Checklist',
    body: 'Freeze writes, snapshot the database, run the migration, then verify row counts match.',
    createdAt: new Date('2026-01-06T09:00:00.000Z'),
  },
  {
    id: 'c3333333-3333-4333-8333-333333333333',
    title: 'Q3 Roadmap Draft',
    body: 'Pull the top requests from support tickets and rank them against engineering capacity.',
    createdAt: new Date('2026-01-07T09:00:00.000Z'),
  },
];

async function main(): Promise<void> {
  for (const u of SEED_USERS) {
    const password = derivePassword(u.email);
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
      },
    });
    console.log(`SEED_CRED ${u.role} ${u.email} ${password}`);
  }

  for (const p of SEED_PINS) {
    await prisma.pin.upsert({
      where: { id: p.id },
      // createdAt is restated on update so re-seeding restores canonical wall order.
      update: { title: p.title, body: p.body, createdAt: p.createdAt },
      create: p,
    });
    console.log(`SEED_PIN ${p.title}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
