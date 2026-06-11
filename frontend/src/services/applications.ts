import api from '../api';

export type ApplicationStatus = 'wishlist' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';

export interface JobApplication {
  id: string;
  user_id: string;
  company: string;
  position: string;
  job_url?: string;
  job_description?: string;
  status: ApplicationStatus;
  salary_min?: number;
  salary_max?: number;
  location?: string;
  remote?: boolean;
  applied_date?: string;
  notes?: string;
  contact_name?: string;
  contact_email?: string;
  resume_id?: string;
  cover_letter_id?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ApplicationCreatePayload {
  company: string;
  position: string;
  job_url?: string;
  job_description?: string;
  status?: ApplicationStatus;
  salary_min?: number;
  salary_max?: number;
  location?: string;
  remote?: boolean;
  applied_date?: string;
  notes?: string;
  contact_name?: string;
  contact_email?: string;
  tags?: string[];
}

export interface ApplicationUpdatePayload {
  company?: string;
  position?: string;
  job_url?: string;
  job_description?: string;
  status?: ApplicationStatus;
  salary_min?: number;
  salary_max?: number;
  location?: string;
  remote?: boolean;
  applied_date?: string;
  notes?: string;
  contact_name?: string;
  contact_email?: string;
  resume_id?: string;
  cover_letter_id?: string;
  tags?: string[];
}

export interface ApplicationStats {
  total: number;
  wishlist: number;
  applied: number;
  interviewing: number;
  offered: number;
  rejected: number;
  withdrawn: number;
  response_rate: number;
  offer_rate: number;
}

export const applicationsService = {
  async listApplications(status?: ApplicationStatus, search?: string): Promise<JobApplication[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (search) params.search = search;
    const response = await api.get<JobApplication[]>('/applications', { params });
    return response.data;
  },

  async getStats(): Promise<ApplicationStats> {
    const response = await api.get<ApplicationStats>('/applications/stats');
    return response.data;
  },

  async getApplication(id: string): Promise<JobApplication> {
    const response = await api.get<JobApplication>(`/applications/${id}`);
    return response.data;
  },

  async createApplication(payload: ApplicationCreatePayload): Promise<JobApplication> {
    const response = await api.post<JobApplication>('/applications', payload);
    return response.data;
  },

  async updateApplication(id: string, payload: ApplicationUpdatePayload): Promise<JobApplication> {
    const response = await api.patch<JobApplication>(`/applications/${id}`, payload);
    return response.data;
  },

  async deleteApplication(id: string): Promise<void> {
    await api.delete(`/applications/${id}`);
  },
};
