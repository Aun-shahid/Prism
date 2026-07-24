import api from '../api';
import { PaginatedScrapedJobs, ScrapedJob } from './scraper';
import { JobApplication } from './applications';

export interface JobImportPayload {
  status: string;
  notes?: string;
}

export interface ExternalSearchPayload {
  title: string;
  location?: string;
}

export const jobsService = {
  async listJobs(
    filters: { search?: string; is_new?: boolean; target_id?: string; page?: number; limit?: number } = {}
  ): Promise<PaginatedScrapedJobs> {
    const params: Record<string, string | number | boolean> = {
      page: filters.page ?? 1,
      limit: filters.limit ?? 25,
    };
    if (filters.search) params.search = filters.search;
    if (filters.is_new !== undefined) params.is_new = filters.is_new;
    if (filters.target_id) params.target_id = filters.target_id;

    const response = await api.get<PaginatedScrapedJobs>('/jobs', { params });
    return response.data;
  },

  async markRead(jobId: string): Promise<ScrapedJob> {
    const response = await api.patch<ScrapedJob>(`/jobs/${jobId}/read`);
    return response.data;
  },

  async importJob(jobId: string, payload: JobImportPayload): Promise<JobApplication> {
    const response = await api.post<JobApplication>(`/jobs/${jobId}/import`, payload);
    return response.data;
  },

  async searchExternal(payload: ExternalSearchPayload): Promise<ScrapedJob[]> {
    const response = await api.post<ScrapedJob[]>('/jobs/search-external', payload);
    return response.data;
  },

  async deleteJob(jobId: string): Promise<void> {
    await api.delete(`/jobs/${jobId}`);
  },
};
