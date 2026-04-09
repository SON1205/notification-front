export interface Notification {
  id: number;
  content: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

export type NotificationType = 'COMMENT' | 'FOLLOW' | 'LIKE' | 'SYSTEM';
