import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness. Deliberately does no I/O: a slow or briefly unreachable database must
   * not get the pod restarted, it only makes the app degraded (see /health/deep).
   */
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness. Actually round-trips to Postgres. */
  @Get('deep')
  @ApiOperation({ summary: 'Readiness probe — verifies the database round-trips' })
  @ApiResponse({ status: HttpStatus.OK, description: '{ status: "ok", db: "up" }' })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, description: 'Database unreachable' })
  async deep(): Promise<{ status: 'ok'; db: 'up' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        `Database health check failed: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        status: 'error',
        db: 'down',
      });
    }
    return { status: 'ok', db: 'up' };
  }
}
