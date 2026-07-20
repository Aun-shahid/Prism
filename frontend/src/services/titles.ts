import api from '../api';

export const titlesService = {
  async search(query: string, limit = 10): Promise<string[]> {
    if (!query.trim()) return [];
    const res = await api.get<string[]>('/titles/search', { params: { q: query, limit } });
    return res.data;
  },
};
