import api from '../api';
import { ResumeOperation, ResumeSection } from './resumeBuilder';

export type GenerationType = 'resume' | 'cover_letter' | 'both';

export interface GeneratedDocument {
  id: string;
  user_id: string;
  application_id?: string;
  generation_type: GenerationType;
  job_description: string;
  resume_content?: string;
  cover_letter_content?: string;
  ai_provider_used: string;
  created_at: string;
}

export interface ResumeGeneratePayload {
  job_description: string;
  generation_type: GenerationType;
  preferred_provider?: 'openai' | 'gemini' | 'claude';
  application_id?: string;
}

export interface TailorPayload {
  instruction?: string;
  job_description?: string;
  sections: ResumeSection[];               // current version's sections (with ids)
  want_resume?: boolean;
  want_cover_letter?: boolean;
  preferred_provider?: 'openai' | 'gemini' | 'claude';
}

export interface TailorResult {
  operations: ResumeOperation[];
  summary: string;
  cover_letter?: string | null;
  provider_used?: string | null;
}

export interface BulletImprovePayload {
  text: string;
  context?: string;
  job_description?: string;
}

export interface BulletImproveResult {
  improved: string;
  alternatives: string[];
  tips: string[];
  provider_used?: string | null;
}

export const resumeService = {
  async generate(payload: ResumeGeneratePayload): Promise<GeneratedDocument> {
    // Full resume + cover-letter generation is a large LLM call.
    const response = await api.post<GeneratedDocument>('/resume/generate', payload, { timeout: 120000 });
    return response.data;
  },

  async tailor(payload: TailorPayload): Promise<TailorResult> {
    // Prompt-driven edit — returns only the affected fields as operations.
    const response = await api.post<TailorResult>('/resume/tailor', payload, { timeout: 120000 });
    return response.data;
  },

  async listHistory(): Promise<GeneratedDocument[]> {
    const response = await api.get<GeneratedDocument[]>('/resume/history');
    return response.data;
  },

  async getDocument(docId: string): Promise<GeneratedDocument> {
    const response = await api.get<GeneratedDocument>(`/resume/history/${docId}`);
    return response.data;
  },

  async deleteDocument(docId: string): Promise<void> {
    await api.delete(`/resume/history/${docId}`);
  },

  async improveBullet(payload: BulletImprovePayload): Promise<BulletImproveResult> {
    const response = await api.post<BulletImproveResult>('/resume/improve-bullet', payload, { timeout: 60000 });
    return response.data;
  },
};
