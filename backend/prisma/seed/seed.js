'use strict';
/**
 * Production seed — runs with plain `node`, no TypeScript toolchain needed.
 * Uses @prisma/client (generated into node_modules at build time via `npx prisma generate`).
 *
 * Usage:  node prisma/seed/seed.js
 * Called by: npx prisma db seed  (via the package.json "prisma.seed" field)
 *
 * Fully idempotent: every row is upserted against a fixed primary key, so the
 * container entrypoint can re-run this on every boot and re-seeding restores the
 * canonical wall contents (and their newest-first order) exactly.
 */
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('crypto');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/** Deterministic per-email dev password so credentials are reproducible across boots. */
function derivePassword(email) {
  return createHash('sha256')
    .update(email + (process.env.SEED_SECRET || 'colossus-seed'))
    .digest('hex')
    .slice(0, 16);
}

const SEED_USERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
  },
];

// Ordered oldest -> newest. The wall renders `createdAt DESC, id DESC`, so the
// last entry here is the first card on the wall.
const SEED_PINS = [
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

async function main() {
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
    console.error('Seed failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
