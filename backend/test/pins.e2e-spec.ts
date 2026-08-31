import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { ABSENT_ID, SEEDED_PINS, createTestApp } from './setup-app';

/**
 * Full REST contract for /api/pins against a real Postgres.
 *
 * Every pin these specs create is tracked and removed in afterAll: the suite runs
 * against the same database the deployed wall reads, so it must never leave rows
 * behind and must never delete a seeded pin (those back the acceptance markers).
 */
describe('Pins (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const created: string[] = [];

  /** POSTs a pin and registers it for cleanup. */
  async function makePin(body: Record<string, unknown>): Promise<request.Response> {
    const res = await request(app.getHttpServer()).post('/api/pins').send(body);
    if (res.status === 201 && res.body?.id) created.push(res.body.id);
    return res;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    if (created.length > 0) {
      await prisma.pin.deleteMany({ where: { id: { in: created } } });
    }
    await app.close();
  });

  describe('GET /api/pins', () => {
    it('returns the seeded pins newest-first', async () => {
      const res = await request(app.getHttpServer()).get('/api/pins').expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const titles: string[] = res.body.map((p: { title: string }) => p.title);
      // Seeded pins are the three oldest rows, so they close out the list in
      // reverse-seed order regardless of what else the suite has created.
      const seededInOrder = [...SEEDED_PINS].reverse().map((p) => p.title);
      expect(titles.filter((t) => seededInOrder.includes(t))).toEqual(seededInOrder);
    });

    it('is ordered by createdAt descending', async () => {
      const res = await request(app.getHttpServer()).get('/api/pins').expect(200);
      const times = res.body.map((p: { createdAt: string }) => Date.parse(p.createdAt));
      const sorted = [...times].sort((a, b) => b - a);
      expect(times).toEqual(sorted);
    });

    it('exposes each pin with the full public shape', async () => {
      const res = await request(app.getHttpServer()).get('/api/pins').expect(200);
      expect(res.body[0]).toEqual({
        id: expect.any(String),
        title: expect.any(String),
        body: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('requires no Authorization header', async () => {
      await request(app.getHttpServer())
        .get('/api/pins')
        .expect((res) => expect(res.status).not.toBe(401));
    });
  });

  describe('POST /api/pins validation', () => {
    it('rejects an empty title with 400 and creates nothing', async () => {
      const before = await prisma.pin.count();
      await makePin({ title: '' }).then((r) => expect(r.status).toBe(400));
      expect(await prisma.pin.count()).toBe(before);
    });

    it('rejects a whitespace-only title (trim runs before validation)', async () => {
      const res = await makePin({ title: '   ' });
      expect(res.status).toBe(400);
    });

    it('rejects a title over 120 characters', async () => {
      const res = await makePin({ title: 'x'.repeat(121) });
      expect(res.status).toBe(400);
    });

    it('accepts a title of exactly 120 characters', async () => {
      const title = 'y'.repeat(120);
      const res = await makePin({ title });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe(title);
    });

    it('rejects a body over 2000 characters rather than truncating', async () => {
      const res = await makePin({ title: 'Body too long', body: 'z'.repeat(2001) });
      expect(res.status).toBe(400);
    });

    it('rejects unknown fields so a client cannot smuggle an id', async () => {
      const res = await makePin({ title: 'Smuggler', id: 'client-chosen-id' });
      expect(res.status).toBe(400);
    });

    it('defaults an omitted body to an empty string', async () => {
      const res = await makePin({ title: 'No body supplied' });
      expect(res.status).toBe(201);
      expect(res.body.body).toBe('');
    });
  });

  describe('create -> read -> update -> delete', () => {
    it('puts a newly created pin at the top of the wall', async () => {
      const res = await makePin({ title: 'Newest pin', body: 'Lands first.' });
      expect(res.status).toBe(201);

      const list = await request(app.getHttpServer()).get('/api/pins').expect(200);
      expect(list.body[0].id).toBe(res.body.id);
    });

    it('reads a single pin back by id', async () => {
      const { body: pin } = await makePin({ title: 'Readable', body: 'Fetch me.' });
      const res = await request(app.getHttpServer())
        .get(`/api/pins/${pin.id}`)
        .expect(200);
      expect(res.body).toMatchObject({ id: pin.id, title: 'Readable', body: 'Fetch me.' });
    });

    it('patches stored text and advances updatedAt', async () => {
      const { body: pin } = await makePin({ title: 'Before', body: 'Old body.' });
      // updatedAt has millisecond resolution; without this the patch can land in
      // the same tick and the timestamp assertion becomes flaky.
      await new Promise((r) => setTimeout(r, 5));

      const res = await request(app.getHttpServer())
        .patch(`/api/pins/${pin.id}`)
        .send({ title: 'After' })
        .expect(200);

      expect(res.body.title).toBe('After');
      // An untouched field survives a partial update.
      expect(res.body.body).toBe('Old body.');
      expect(Date.parse(res.body.updatedAt)).toBeGreaterThan(Date.parse(pin.updatedAt));
    });

    it('deletes with 204 and then 404s on the same id', async () => {
      const { body: pin } = await makePin({ title: 'Doomed' });

      await request(app.getHttpServer()).delete(`/api/pins/${pin.id}`).expect(204);
      await request(app.getHttpServer()).get(`/api/pins/${pin.id}`).expect(404);
      // Not silently idempotent: a second delete reports the row is gone.
      await request(app.getHttpServer()).delete(`/api/pins/${pin.id}`).expect(404);
    });
  });

  describe('missing pins', () => {
    it('404s a well-formed but absent id', async () => {
      await request(app.getHttpServer()).get(`/api/pins/${ABSENT_ID}`).expect(404);
    });

    it('404s a malformed id rather than 500ing', async () => {
      await request(app.getHttpServer()).get('/api/pins/not-a-uuid').expect(404);
    });

    it('404s a PATCH against an absent id', async () => {
      await request(app.getHttpServer())
        .patch(`/api/pins/${ABSENT_ID}`)
        .send({ title: 'Ghost' })
        .expect(404);
    });
  });

  it('404s an unknown /api route instead of swallowing it', async () => {
    await request(app.getHttpServer()).get('/api/does-not-exist').expect(404);
  });
});
