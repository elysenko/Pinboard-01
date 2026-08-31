import { Module } from '@nestjs/common';
import { PinsController } from './pins.controller';
import { PinsService } from './pins.service';

// PrismaService comes from the @Global PrismaModule, so no import is needed here.
@Module({
  controllers: [PinsController],
  providers: [PinsService],
  exports: [PinsService],
})
export class PinsModule {}
