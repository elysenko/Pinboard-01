import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ServiceSetting } from '../../core/setting.model';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsComponent {
  readonly services = signal<ServiceSetting[]>([
    {
      key: 'postgresql',
      label: 'PostgreSQL',
      description: 'Stores every pin on the wall, plus accounts and board settings.',
      configured: true,
      fields: [
        {
          key: 'DATABASE_URL',
          label: 'Connection string',
          value: 'postgresql://pinboard:••••••••@db:5432/pinboard?schema=public',
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
      configured: false,
      fields: [
        {
          key: 'MINIO_ENDPOINT',
          label: 'Endpoint',
          value: '',
          secret: false,
          placeholder: 'https://minio.internal:9000',
        },
        {
          key: 'MINIO_ACCESS_KEY',
          label: 'Access key',
          value: '',
          secret: false,
          placeholder: 'pinboard-access-key',
        },
        {
          key: 'MINIO_SECRET_KEY',
          label: 'Secret key',
          value: '',
          secret: true,
          placeholder: 'Paste the secret key',
        },
      ],
    },
  ]);

  readonly savedKey = signal<string | null>(null);

  readonly unconfigured = computed(() =>
    this.services().filter((s) => !s.configured),
  );

  fieldId(serviceKey: string, fieldKey: string): string {
    return `${serviceKey}-${fieldKey}`;
  }

  updateField(serviceKey: string, fieldKey: string, value: string): void {
    this.services.update((services) =>
      services.map((service) =>
        service.key === serviceKey
          ? {
              ...service,
              fields: service.fields.map((f) =>
                f.key === fieldKey ? { ...f, value } : f,
              ),
            }
          : service,
      ),
    );
  }

  save(serviceKey: string): void {
    this.services.update((services) =>
      services.map((service) =>
        service.key === serviceKey
          ? {
              ...service,
              configured: service.fields.every((f) => f.value.trim().length > 0),
            }
          : service,
      ),
    );
    this.savedKey.set(serviceKey);
  }
}
