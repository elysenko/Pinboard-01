import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigResolver, isConfiguredValue } from '../lib/config';
import {
  EDITABLE_KEYS,
  SERVICE_CATALOG,
  SettingFieldSpec,
} from './settings.catalog';
import { SettingEntryDto } from './dto/update-settings.dto';

/** Mirrors the frontend `ServiceSetting` model in core/setting.model.ts. */
export interface SettingFieldView {
  key: string;
  label: string;
  /** Masked for secrets; the raw secret is never returned by any endpoint. */
  value: string;
  secret: boolean;
  placeholder: string;
  configured: boolean;
  /** Where the effective value came from, so the UI can lock env-sourced rows. */
  source: 'env' | 'db' | null;
}

export interface ServiceSettingView {
  key: string;
  label: string;
  description: string;
  configured: boolean;
  fields: SettingFieldView[];
}

const VISIBLE_TAIL = 4;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configResolver: ConfigResolver,
  ) {}

  async list(): Promise<ServiceSettingView[]> {
    const rows = await this.prisma.systemSetting.findMany();
    const dbValues = new Map(rows.map((r) => [r.key, r.value]));

    return SERVICE_CATALOG.map((service) => {
      const fields = service.fields.map((spec) =>
        this.toFieldView(spec, dbValues.get(spec.key)),
      );
      return {
        key: service.key,
        label: service.label,
        description: service.description,
        // A service only counts as configured when *every* one of its fields resolves.
        configured: fields.every((f) => f.configured),
        fields,
      };
    });
  }

  /**
   * Validates the whole batch before writing anything, so a request containing one
   * bad key leaves SystemSetting completely untouched (no partial write).
   */
  async update(entries: SettingEntryDto[]): Promise<ServiceSettingView[]> {
    if (entries.length === 0) {
      throw new BadRequestException('No settings supplied');
    }

    const unknown = entries
      .map((e) => e.key)
      .filter((key) => !EDITABLE_KEYS.has(key));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown setting key(s): ${unknown.join(', ')}`,
      );
    }

    const duplicates = entries
      .map((e) => e.key)
      .filter((key, index, all) => all.indexOf(key) !== index);
    if (duplicates.length > 0) {
      throw new BadRequestException(
        `Duplicate setting key(s): ${[...new Set(duplicates)].join(', ')}`,
      );
    }

    await this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.systemSetting.upsert({
          where: { key: entry.key },
          update: { value: entry.value },
          create: { key: entry.key, value: entry.value },
        }),
      ),
    );

    return this.list();
  }

  private toFieldView(
    spec: SettingFieldSpec,
    dbValue: string | undefined,
  ): SettingFieldView {
    const envValue = process.env[spec.key];
    const envOk = isConfiguredValue(envValue);
    const dbOk = isConfiguredValue(dbValue);
    const effective = envOk ? (envValue as string) : dbOk ? (dbValue as string) : null;

    return {
      key: spec.key,
      label: spec.label,
      value: effective === null ? '' : this.present(spec, effective),
      secret: spec.secret,
      placeholder: spec.placeholder,
      configured: effective !== null,
      source: envOk ? 'env' : dbOk ? 'db' : null,
    };
  }

  /** Secrets come back as dots plus the last few characters, never in full. */
  private present(spec: SettingFieldSpec, value: string): string {
    if (!spec.secret) return value;
    return SettingsService.mask(value);
  }

  static mask(value: string): string {
    if (value.length <= VISIBLE_TAIL) return '•'.repeat(8);
    return `${'•'.repeat(8)}${value.slice(-VISIBLE_TAIL)}`;
  }
}
