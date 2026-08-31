import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Written into a SystemSetting row (or an env var) to mean "a slot exists for this
 * credential but nobody has filled it in". Treated as absent everywhere.
 */
export const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

/**
 * Thrown by a feature whose credentials were never supplied. Surfaces as a 503 so a
 * missing third-party key degrades one feature instead of taking down the process.
 */
export class ServiceUnconfiguredError extends HttpException {
  constructor(service: string, missingKeys: string[] = []) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: `${service} is not configured`,
        service,
        missingKeys,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** A value is only usable if it is a non-blank string that is not the placeholder. */
export function isConfiguredValue(value: string | null | undefined): boolean {
  return (
    typeof value === 'string' && value.trim().length > 0 && value !== PLACEHOLDER
  );
}

@Injectable()
export class ConfigResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolution order:
   *   1. process.env — set at deploy time from the platform's secret store
   *   2. SystemSetting row — set by an admin through /api/admin/settings
   *   3. null — the caller should degrade, typically via ServiceUnconfiguredError
   */
  async resolveConfig(key: string): Promise<string | null> {
    const fromEnv = process.env[key];
    if (isConfiguredValue(fromEnv)) return fromEnv as string;

    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (isConfiguredValue(row?.value)) return row!.value;

    return null;
  }

  /** Resolves several keys at once; missing ones come back as null. */
  async resolveMany(keys: string[]): Promise<Record<string, string | null>> {
    const entries = await Promise.all(
      keys.map(async (key) => [key, await this.resolveConfig(key)] as const),
    );
    return Object.fromEntries(entries);
  }

  /** Convenience for call sites that cannot proceed without the value. */
  async requireConfig(service: string, key: string): Promise<string> {
    const value = await this.resolveConfig(key);
    if (value === null) throw new ServiceUnconfiguredError(service, [key]);
    return value;
  }

  /** True when every key for a service resolves — used for the admin badges. */
  async isConfigured(keys: string[]): Promise<boolean> {
    const resolved = await this.resolveMany(keys);
    return keys.every((key) => resolved[key] !== null);
  }
}
