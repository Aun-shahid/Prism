import api from '../api';

export interface APIKey {
  id: string;
  provider: 'openai' | 'gemini' | 'claude';
  label?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface APIKeyCreatePayload {
  provider: 'openai' | 'gemini' | 'claude';
  api_key: string;
  label?: string;
}

export const apiKeysService = {
  async listKeys(): Promise<APIKey[]> {
    const response = await api.get<APIKey[]>('/api-keys');
    return response.data;
  },

  async storeKey(payload: APIKeyCreatePayload): Promise<APIKey> {
    const response = await api.post<APIKey>('/api-keys', payload);
    return response.data;
  },

  async deleteKey(keyId: string): Promise<void> {
    await api.delete(`/api-keys/${keyId}`);
  },

  async toggleKey(keyId: string, isActive: boolean): Promise<APIKey> {
    const response = await api.patch<APIKey>(`/api-keys/${keyId}/toggle?is_active=${isActive}`);
    return response.data;
  },
};
