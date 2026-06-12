import api from '../api';

export interface ScraperTarget {
  id: string;
  user_id: string;
  company_name: string;
  career_url: string;
  keywords: string[];
  is_active: boolean;
  last_scraped?: string;
  created_at: string;
  updated_at: string;
}

export interface ScrapedJob {
  id: string;
  target_id: string;
  user_id: string;
  title: string;
  url?: string;
  description_snippet?: string;
  matched_keywords: string[];
  is_new: boolean;
  discovered_at: string;
}

export interface ScraperTargetCreatePayload {
  company_name: string;
  career_url: string;
  keywords: string[];
}

export interface ScraperTargetUpdatePayload {
  company_name?: string;
  career_url?: string;
  keywords?: string[];
  is_active?: boolean;
}

export interface GeneralScraperSource {
  id: string;
  name: string;
  url: string;
  source_type: string; // "rss", "preset_linkedin", "preset_arbeitnow"
  locations: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneralScraperSourceCreatePayload {
  name: string;
  url: string;
  source_type: string;
  locations: string[];
}

export interface GeneralScraperSourceUpdatePayload {
  name?: string;
  url?: string;
  locations?: string[];
  is_active?: boolean;
}

export const scraperService = {
  async listTargets(): Promise<ScraperTarget[]> {
    const response = await api.get<ScraperTarget[]>('/scraper/targets');
    return response.data;
  },

  async addTarget(payload: ScraperTargetCreatePayload): Promise<ScraperTarget> {
    const response = await api.post<ScraperTarget>('/scraper/targets', payload);
    return response.data;
  },

  async updateTarget(id: string, payload: ScraperTargetUpdatePayload): Promise<ScraperTarget> {
    const response = await api.patch<ScraperTarget>(`/scraper/targets/${id}`, payload);
    return response.data;
  },

  async deleteTarget(id: string): Promise<void> {
    await api.delete(`/scraper/targets/${id}`);
  },

  async triggerScrape(id: string): Promise<ScrapedJob[]> {
    const response = await api.post<ScrapedJob[]>(`/scraper/targets/${id}/scrape`);
    return response.data;
  },

  async listDiscoveredJobs(targetId?: string): Promise<ScrapedJob[]> {
    const params: Record<string, string> = {};
    if (targetId) params.target_id = targetId;
    const response = await api.get<ScrapedJob[]>('/scraper/jobs', { params });
    return response.data;
  },

  async markJobRead(jobId: string): Promise<ScrapedJob> {
    const response = await api.patch<ScrapedJob>(`/scraper/jobs/${jobId}/read`);
    return response.data;
  },

  async listGeneralSources(): Promise<GeneralScraperSource[]> {
    const response = await api.get<GeneralScraperSource[]>('/scraper/general-sources');
    return response.data;
  },

  async addGeneralSource(payload: GeneralScraperSourceCreatePayload): Promise<GeneralScraperSource> {
    const response = await api.post<GeneralScraperSource>('/scraper/general-sources', payload);
    return response.data;
  },

  async updateGeneralSource(id: string, payload: GeneralScraperSourceUpdatePayload): Promise<GeneralScraperSource> {
    const response = await api.patch<GeneralScraperSource>(`/scraper/general-sources/${id}`, payload);
    return response.data;
  },

  async deleteGeneralSource(id: string): Promise<void> {
    await api.delete(`/scraper/general-sources/${id}`);
  },

  async triggerGeneralScrape(id: string): Promise<ScrapedJob[]> {
    const response = await api.post<ScrapedJob[]>(`/scraper/general-sources/${id}/scrape`);
    return response.data;
  },
};
