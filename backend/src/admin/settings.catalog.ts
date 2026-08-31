/**
 * The credential slots the admin settings screen can edit.
 *
 * This is an allowlist, not a discovery mechanism: PATCH rejects any key that is not
 * listed here, so an admin cannot write arbitrary rows into SystemSetting (and cannot,
 * for example, overwrite JWT_SECRET through the settings form).
 */
export interface SettingFieldSpec {
  key: string;
  label: string;
  /** Secret fields are masked on the way out and never echoed in plaintext. */
  secret: boolean;
  placeholder: string;
}

export interface ServiceSpec {
  key: string;
  label: string;
  description: string;
  fields: SettingFieldSpec[];
}

export const SERVICE_CATALOG: ServiceSpec[] = [
  {
    key: 'postgresql',
    label: 'PostgreSQL',
    description:
      'Stores every pin on the wall, plus accounts and board settings.',
    fields: [
      {
        key: 'DATABASE_URL',
        label: 'Connection string',
        secret: true,
        placeholder: 'postgresql://user:password@host:5432/database',
      },
    ],
  },
  {
    key: 'minio',
    label: 'MinIO object storage',
    description:
      'Reserved for pin attachments. Nothing is uploaded until credentials are saved.',
    fields: [
      {
        key: 'MINIO_ENDPOINT',
        label: 'Endpoint',
        secret: false,
        placeholder: 'https://minio.internal:9000',
      },
      {
        key: 'MINIO_ACCESS_KEY',
        label: 'Access key',
        secret: false,
        placeholder: 'pinboard-access-key',
      },
      {
        key: 'MINIO_SECRET_KEY',
        label: 'Secret key',
        secret: true,
        placeholder: 'Paste the secret key',
      },
    ],
  },
];

export const EDITABLE_KEYS: ReadonlySet<string> = new Set(
  SERVICE_CATALOG.flatMap((service) => service.fields.map((f) => f.key)),
);

const SPEC_BY_KEY = new Map(
  SERVICE_CATALOG.flatMap((service) => service.fields.map((f) => [f.key, f])),
);

export function fieldSpec(key: string): SettingFieldSpec | undefined {
  return SPEC_BY_KEY.get(key);
}
