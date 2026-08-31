export interface SettingField {
  key: string;
  label: string;
  value: string;
  secret: boolean;
  placeholder: string;
}

export interface ServiceSetting {
  key: string;
  label: string;
  description: string;
  configured: boolean;
  fields: SettingField[];
}
