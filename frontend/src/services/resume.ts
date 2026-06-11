import api from '../api';

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

export const resumeService = {
  async generate(payload: ResumeGeneratePayload): Promise<GeneratedDocument> {
    const response = await api.post<GeneratedDocument>('/resume/generate', payload);
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
};
