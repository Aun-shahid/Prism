import api from '../api';

export interface EmailSettings {
  custom_instructions: string;
  tone: string;                 // formal | warm | direct
  length: string;               // short | medium
  signature: string;
  sender_name: string;
  attach_resume: boolean;
  default_resume_version_id?: string | null;
  outbound_auto_send: boolean;
  daily_send_limit: number;
  cc_self: boolean;
  warn_already_emailed: boolean;
  enable_inbound: boolean;
  inbound_auto_reply: boolean;
}

export const emailSettingsService = {
  async get(): Promise<EmailSettings> {
    const res = await api.get<EmailSettings>('/email-settings');
    return res.data;
  },
  async update(payload: Partial<EmailSettings>): Promise<EmailSettings> {
    const res = await api.put<EmailSettings>('/email-settings', payload);
    return res.data;
  },
};
