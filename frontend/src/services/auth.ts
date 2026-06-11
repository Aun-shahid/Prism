import api from '../api';

export interface RegisterPayload {
  email: string;
  name: string;
  username: string;
  password: string;
}

export interface LoginPayload {
  username_or_email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export const authService = {
  async register(payload: RegisterPayload) {
    const response = await api.post('/auth/register', payload);
    return response.data;
  },

  async login(payload: LoginPayload): Promise<TokenResponse> {
    const response = await api.post<TokenResponse>('/auth/login', payload);
    return response.data;
  },

  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  async refresh(): Promise<TokenResponse> {
    const response = await api.post<TokenResponse>('/auth/refresh');
    return response.data;
  },
};
