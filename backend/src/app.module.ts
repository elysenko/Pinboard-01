import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { ConfigResolverModule } from './lib/config.module';
import { PinsModule } from './pins/pins.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    ConfigResolverModule,
    AuthModule,
    PinsModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
