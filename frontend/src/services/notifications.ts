import api from '../api';
import config from '../config';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export const notificationsService = {
  async listNotifications(limit: number = 50): Promise<Notification[]> {
    const response = await api.get<Notification[]>('/notifications', {
      params: { limit },
    });
    return response.data;
  },

  async markRead(id: string): Promise<Notification> {
    const response = await api.patch<Notification>(`/notifications/${id}/read`);
    return response.data;
  },

  async markAllRead(): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/notifications/read-all');
    return response.data;
  },

  streamNotifications(
    onNotification: (notification: Notification) => void,
    onError?: (err: any) => void
  ): () => void {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const url = new URL(`${config.apiUrl}/notifications/stream`);
    if (token) {
      url.searchParams.append('token', token);
    }

    const eventSource = new EventSource(url.toString());

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected' || data.type === 'ping') {
          return;
        }
        onNotification(data as Notification);
      } catch (err) {
        console.error('Error parsing notification event:', err);
      }
    };

    eventSource.onerror = (err) => {
      if (onError) {
        onError(err);
      }
    };

    return () => {
      eventSource.close();
    };
  },
};
