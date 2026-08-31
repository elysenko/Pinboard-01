import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/http-errors';
import { ServiceSetting, SettingEntry } from '../../core/setting.model';
import { SettingsService } from '../../core/settings.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsComponent {
  private readonly settingsService = inject(SettingsService);

  readonly services = signal<ServiceSetting[]>([]);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);
  readonly savedKey = signal<string | null>(null);
  readonly savingKey = signal<string | null>(null);

  /**
   * Keys the admin actually typed into, keyed by `key`.
   *
   * Values arrive from the API masked (`••••••••ab12`) because a secret is never
   * echoed in full. Only edited keys are sent on save — replaying an untouched
   * masked value would overwrite the real credential with dots.
   */
  private readonly edits = signal<Record<string, string>>({});

  readonly unconfigured = computed(() =>
    this.services().filter((s) => !s.configured),
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.services.set(await this.settingsService.list());
      this.error.set(null);
    } catch (error) {
      this.error.set(error as ApiError);
    } finally {
      this.loading.set(false);
    }
  }

  fieldId(serviceKey: string, fieldKey: string): string {
    return `${serviceKey}-${fieldKey}`;
  }

  /** The masked server value until the admin types, then whatever they typed. */
  displayValue(fieldKey: string, serverValue: string): string {
    return this.edits()[fieldKey] ?? serverValue;
  }

  updateField(_serviceKey: string, fieldKey: string, value: string): void {
    this.edits.update((edits) => ({ ...edits, [fieldKey]: value }));
    this.savedKey.set(null);
  }

  async save(serviceKey: string): Promise<void> {
    const service = this.services().find((s) => s.key === serviceKey);
    if (!service) return;

    const entries: SettingEntry[] = service.fields
      .filter((field) => this.edits()[field.key] !== undefined)
      .map((field) => ({ key: field.key, value: this.edits()[field.key] ?? '' }));

    // Nothing typed: PATCH with an empty batch is a 400, so report the no-op
    // instead of sending a request that can only fail.
    if (entries.length === 0) {
      this.savedKey.set(serviceKey);
      return;
    }

    this.savingKey.set(serviceKey);
    this.error.set(null);
    try {
      // The response is the re-listed catalogue, so the badges and banner below
      // reflect what the server stored rather than what the form assumed.
      this.services.set(await this.settingsService.save(entries));
      this.edits.update((edits) => {
        const next = { ...edits };
        for (const entry of entries) delete next[entry.key];
        return next;
      });
      this.savedKey.set(serviceKey);
    } catch (error) {
      this.error.set(error as ApiError);
    } finally {
      this.savingKey.set(null);
    }
  }
}
