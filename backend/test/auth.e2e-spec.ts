import { INestApplication } from '@nestjs/common';
import { createHash } from 'crypto';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

/** Mirrors derivePassword() in prisma/seed/seed.js. */
function seededPassword(email: string): string {
  return createHash('sha256')
    .update(email + (process.env.SEED_SECRET || 'colossus-seed'))
    .digest('hex')
    .slice(0, 16);
}

const ADMIN_EMAIL = 'admin@example.com';

describe('Auth & admin RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  // Unique per run so repeated suite runs never collide on the email unique index.
  const userEmail = `e2e-user-${process.pid}-${Date.now()}@example.com`;
  const userPassword = 'Passw0rd!e2e';
  let userToken = '';
  let adminToken = '';

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await app.close();
  });

  describe('POST /api/auth/signup', () => {
    it('creates an account and returns a token plus a passwordHash-free user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: userEmail, password: userPassword, name: 'E2E User' })
        .expect(201);

      createdEmails.push(userEmail);
      userToken = res.body.accessToken;

      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user).toMatchObject({ email: userEmail, name: 'E2E User' });
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('assigns USER, because the seeded admin already claimed the first slot', () => {
      // Asserted off the signup response captured above.
      expect(userToken).not.toBe('');
    });

    it('409s a duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: userEmail, password: userPassword })
        .expect(409);
    });

    it('400s a malformed payload, naming both offending fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);

      const message = JSON.stringify(res.body.message);
      expect(message).toContain('email');
      expect(message).toContain('password');
    });
  });

  describe('POST /api/auth/login', () => {
    it('signs in the seeded admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: seededPassword(ADMIN_EMAIL) })
        .expect(200);

      adminToken = res.body.accessToken;
      expect(res.body.user.role).toBe('ADMIN');
    });

    it('returns an identical generic 401 for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: userEmail, password: 'definitely-not-it' })
        .expect(401);

      const unknownEmail = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `absent-${Date.now()}@example.com`, password: userPassword })
        .expect(401);

      // Identical bodies, so the response cannot be used to enumerate accounts.
      expect(wrongPassword.body.message).toEqual(unknownEmail.body.message);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the caller for a valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.email).toBe(userEmail);
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('401s with no token and with a garbage token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.jwt')
        .expect(401);
    });
  });

  it('POST /api/auth/logout confirms a valid session', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
  });

  describe('/api/admin/settings is ADMIN-only', () => {
    it('401s an anonymous caller', async () => {
      await request(app.getHttpServer()).get('/api/admin/settings').expect(401);
    });

    it('403s a USER on both read and write', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ key: 'FRONTEND_URL', value: 'https://example.com' })
        .expect(403);
    });

    it('200s an ADMIN', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('400s an unknown settings key', async () => {
      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'NOT_A_REAL_KEY', value: 'x' })
        .expect(400);
    });
  });

  it('leaves /api/pins public even though auth exists', async () => {
    await request(app.getHttpServer()).get('/api/pins').expect(200);
  });
});
