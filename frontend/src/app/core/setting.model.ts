export interface SettingField {
  key: string;
  label: string;
  /** Masked (`••••••••ab12`) for secrets — the API never returns a raw secret. */
  value: string;
  secret: boolean;
  placeholder: string;
  /** True when the key resolves from either the environment or a saved override. */
  configured: boolean;
  /**
   * Where the effective value came from. `env` values are set at deploy time from
   * the platform secret store and cannot be usefully overwritten from this screen.
   */
  source: 'env' | 'db' | null;
}

export interface ServiceSetting {
  key: string;
  label: string;
  description: string;
  configured: boolean;
  fields: SettingField[];
}

/** One credential write, matching the backend's `SettingEntryDto`. */
export interface SettingEntry {
  key: string;
  value: string;
}
