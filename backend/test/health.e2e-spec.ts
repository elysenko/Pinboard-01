import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './setup-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports liveness without touching the database', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/health/deep round-trips to Postgres', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/deep').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('needs no Authorization header', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect((res) => expect(res.status).not.toBe(401));
  });

  it('is not reachable without the /api prefix', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});
