import api from '../api';

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  role: 'super_admin' | 'user';
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  last_login?: string;
  google_id?: string;
}

export interface UserUpdatePayload {
  email?: string;
  name?: string;
  username?: string;
  password?: string;
  role?: 'super_admin' | 'user';
  is_active?: boolean;
  email_verified?: boolean;
  google_id?: string;
}

export const usersService = {
  async getMe(): Promise<User> {
    const response = await api.get<User>('/users/me');
    return response.data;
  },

  async listUsers(): Promise<User[]> {
    const response = await api.get<User[]>('/users');
    return response.data;
  },

  async getUser(userId: string): Promise<User> {
    const response = await api.get<User>(`/users/${userId}`);
    return response.data;
  },

  async updateUser(userId: string, payload: UserUpdatePayload): Promise<User> {
    const response = await api.patch<User>(`/users/${userId}`, payload);
    return response.data;
  },

  async deleteUser(userId: string): Promise<void> {
    await api.delete(`/users/${userId}`);
  },

  async getAdminStats(): Promise<{ total_users: number; total_targets: number; total_jobs: number; total_sources: number }> {
    const response = await api.get('/users/admin/stats');
    return response.data;
  },
};
