import api from '../api';

export interface GmailStatus {
  is_connected: boolean;
  google_email?: string;
  connected_at?: string;
}

export interface EmailSendPayload {
  to: string;
  subject: string;
  body: string; // can be HTML
  application_id?: string;
}

export interface EmailLog {
  id: string;
  user_id: string;
  to: string;
  subject: string;
  sent_at: string;
  application_id?: string;
  status: string; // "sent" | "failed"
  error_message?: string;
}

export const gmailService = {
  async getStatus(): Promise<GmailStatus> {
    const response = await api.get<GmailStatus>('/gmail/status');
    return response.data;
  },

  async getConnectUrl(): Promise<string> {
    const response = await api.get<{ authorization_url: string }>('/gmail/connect');
    return response.data.authorization_url;
  },

  async disconnect(): Promise<void> {
    await api.post('/gmail/disconnect');
  },

  async sendEmail(payload: EmailSendPayload): Promise<EmailLog> {
    const response = await api.post<EmailLog>('/gmail/send', payload);
    return response.data;
  },

  async listSentEmails(): Promise<EmailLog[]> {
    const response = await api.get<EmailLog[]>('/gmail/sent');
    return response.data;
  },
};
