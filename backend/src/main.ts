import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Every REST route lives under /api. The SPA is served separately by nginx
  // (see colossus.yaml: serve_topology nginx_frontend_plus_backend), so this process
  // serves no static assets and the prefix can apply to everything without exclusions.
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist strips unknown keys, forbidNonWhitelisted turns them into a 400 so a
      // client cannot smuggle id/createdAt past the DTO; transform runs the @Transform
      // trimming before validation.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // The browser talks to this API cross-origin in development and through the nginx
  // proxy in production. Auth uses a bearer token rather than cookies, so reflecting
  // the request origin is safe here.
  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: frontendUrl && frontendUrl.length > 0 ? frontendUrl : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PinBoard API')
    .setDescription('REST API for the PinBoard sticky-note wall')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  app.enableShutdownHooks();

  // 3001 matches the containerPort in colossus.yaml; PORT overrides it in any
  // environment that assigns one.
  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`PinBoard API listening on http://0.0.0.0:${port}/api`);
  logger.log(`Swagger docs at http://0.0.0.0:${port}/api/docs`);
}

void bootstrap();
