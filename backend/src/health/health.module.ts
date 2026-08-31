import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// PrismaService is provided globally by PrismaModule.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
