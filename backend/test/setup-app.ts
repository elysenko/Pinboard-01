import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Boots the real AppModule against the real database and mirrors main.ts's global
 * configuration exactly. Anything that diverges here (prefix, pipe options) would
 * make these specs assert a contract the deployed process does not actually serve.
 */
export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

/** Seeded pin ids from prisma/seed/seed.js, oldest -> newest. */
export const SEEDED_PINS = [
  { id: 'a1111111-1111-4111-8111-111111111111', title: 'Rooftop Garden Plan' },
  { id: 'b2222222-2222-4222-8222-222222222222', title: 'Migration Checklist' },
  { id: 'c3333333-3333-4333-8333-333333333333', title: 'Q3 Roadmap Draft' },
];

/** A well-formed UUID that is guaranteed not to exist. */
export const ABSENT_ID = '00000000-0000-4000-8000-0000000000ff';
