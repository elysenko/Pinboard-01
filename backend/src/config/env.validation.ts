/**
 * Boot-time environment contract.
 *
 * Only app-owned configuration that the platform always provisions is required.
 * Every third-party credential (MinIO today, anything added later) stays optional and
 * is resolved lazily through ConfigResolver — a missing integration key must degrade
 * that one feature with a 503, never crash-loop the pod.
 */
const REQUIRED_KEYS = ['DATABASE_URL', 'JWT_SECRET'] as const;

/** Present for discoverability; absence is normal and never fatal. */
export const OPTIONAL_KEYS = [
  'PORT',
  'NODE_ENV',
  'FRONTEND_URL',
  'JWT_EXPIRES_IN',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
] as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED_KEYS.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'These are provisioned by the platform; check the deployment secret.',
    );
  }

  return config;
}
