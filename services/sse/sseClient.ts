import { Platform } from 'react-native';
import { config } from '../../constants/config';
import { tokenStorage } from '../auth/tokenStorage';
import type { Notification } from '../../types/notification';

type SseCallback = (notification: Notification) => void;

let eventSource: EventSource | null = null;

export async function connectSSE(onNotification: SseCallback): Promise<void> {
  disconnect();

  const token = await tokenStorage.getAccessToken();
  if (!token) return;

  const url = `${config.API_BASE_URL}/api/notifications/stream?token=${token}`;

  if (Platform.OS === 'web') {
    eventSource = new EventSource(url);

    eventSource.addEventListener('notification', (event: MessageEvent) => {
      const data: Notification = JSON.parse(event.data);
      onNotification(data);
    });

    eventSource.onerror = () => {
      disconnect();
      setTimeout(() => connectSSE(onNotification), 5000);
    };
  } else {
    // React Native: EventSource polyfill 또는 fetch streaming 사용
    // RN 0.81+ 에서는 EventSource가 글로벌로 제공됨
    const es = new EventSource(url);

    es.addEventListener('notification', ((event: MessageEvent) => {
      const data: Notification = JSON.parse(event.data);
      onNotification(data);
    }) as EventListener);

    es.onerror = () => {
      es.close();
      setTimeout(() => connectSSE(onNotification), 5000);
    };

    eventSource = es;
  }
}

export function disconnect(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}
