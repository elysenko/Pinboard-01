import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SettingEntryDto } from './dto/update-settings.dto';
import { ServiceSettingView, SettingsService } from './settings.service';

/**
 * Admin-only. The guards are declared here as well as globally so the restriction is
 * visible at the call site and survives any future change to the global guard setup.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List provisioned services and their credential status' })
  list(): Promise<ServiceSettingView[]> {
    return this.settingsService.list();
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert credential values (idempotent)' })
  update(@Body() raw: unknown): Promise<ServiceSettingView[]> {
    return this.settingsService.update(SettingsController.parseEntries(raw));
  }

  /**
   * Accepts either a bare `[{key, value}]` array or `{ entries: [...] }`.
   *
   * Validation is done by hand because the global ValidationPipe cannot introspect a
   * top-level array body, and clients in this codebase send both shapes.
   */
  private static parseEntries(raw: unknown): SettingEntryDto[] {
    const candidate = Array.isArray(raw)
      ? raw
      : (raw as { entries?: unknown } | null)?.entries;

    if (!Array.isArray(candidate)) {
      throw new BadRequestException(
        'Body must be an array of { key, value } pairs, or { entries: [...] }',
      );
    }

    const entries = candidate.map((item) =>
      plainToInstance(SettingEntryDto, item, {
        excludeExtraneousValues: false,
      }),
    );

    const messages = entries.flatMap((entry, index) =>
      validateSync(entry, { whitelist: true, forbidUnknownValues: true }).flatMap(
        (error) =>
          Object.values(error.constraints ?? {}).map(
            (message) => `entries[${index}]: ${message}`,
          ),
      ),
    );
    if (messages.length > 0) throw new BadRequestException(messages);

    return entries;
  }
}
