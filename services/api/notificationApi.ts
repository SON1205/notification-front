import { apiClient } from './client';
import type { Notification } from '../../types/notification';

export const notificationApi = {
  getAll: () =>
    apiClient.get<Notification[]>('/notifications').then((res) => res.data),

  getUnread: () =>
    apiClient.get<Notification[]>('/notifications/unread').then((res) => res.data),

  markAsRead: (id: number) =>
    apiClient.patch(`/notifications/${id}/read`).then((res) => res.data),
};
