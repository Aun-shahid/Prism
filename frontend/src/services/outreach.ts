import api from '../api';
import { EmailAttachment, EmailLog } from './gmail';

export interface ExtractResult {
  recipients: string[];
  best?: string | null;
}

export interface ComposeResult {
  draft_id: string;
  subject: string;
  body: string;
  note: string;
  recipient?: string;
  recipients: string[];
  provider_used?: string;
}

export interface OutreachSendPayload {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  attachments?: EmailAttachment[];
  application_id?: string;
  company?: string;
  position?: string;
  job_description?: string;
  create_application?: boolean;
  override_guardrails?: boolean;
}

export interface OutreachSendResult {
  email_log: EmailLog;
  application_id?: string;
  warnings: string[];
}

export interface InboundReply {
  id: string;
  thread_id?: string;
  from_email?: string;
  subject?: string;
  category?: string;
  handled?: string;      // drafted | auto_replied | notified | sent | dismissed
  draft_reply?: string;
  reply_subject?: string;
  received_at?: string;
}

export interface InboundPollResult {
  handled: number;
  inbound_ready: boolean;
  enabled: boolean;
}

export const outreachService = {
  async extract(jobDescription: string): Promise<ExtractResult> {
    const res = await api.post<ExtractResult>('/outreach/extract', { job_description: jobDescription });
    return res.data;
  },

  async compose(payload: {
    job_description: string;
    recipient?: string;
    company?: string;
    preferred_provider?: string;
  }): Promise<ComposeResult> {
    // Composition is an LLM call — allow a generous timeout.
    const res = await api.post<ComposeResult>('/outreach/compose', payload, { timeout: 120000 });
    return res.data;
  },

  async send(payload: OutreachSendPayload): Promise<OutreachSendResult> {
    const res = await api.post<OutreachSendResult>('/outreach/send', payload);
    return res.data;
  },

  async listReplies(): Promise<InboundReply[]> {
    const res = await api.get<InboundReply[]>('/outreach/replies');
    return res.data;
  },

  async poll(): Promise<InboundPollResult> {
    const res = await api.post<InboundPollResult>('/outreach/poll');
    return res.data;
  },

  async sendReply(id: string, body?: string): Promise<EmailLog> {
    const res = await api.post<EmailLog>(`/outreach/replies/${id}/send`, { body });
    return res.data;
  },

  async dismissReply(id: string): Promise<void> {
    await api.post(`/outreach/replies/${id}/dismiss`);
  },
};
