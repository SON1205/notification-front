import { Platform } from 'react-native';
import { config } from '../../constants/config';
import { tokenStorage } from '../auth/tokenStorage';
import type { Notification } from '../../types/notification';

type SseCallback = (notification: Notification) => void;

// 웹: 브라우저 EventSource
let eventSource: EventSource | null = null;
// 네이티브: react-native-sse
let nativeEventSource: InstanceType<typeof import('react-native-sse').default> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * SSE 하이브리드:
 * - 웹: 브라우저 EventSource + Cookie (withCredentials)
 * - 네이티브: react-native-sse + Authorization 헤더
 */
export async function connectSSE(onNotification: SseCallback): Promise<void> {
  disconnect();

  if (Platform.OS === 'web') {
    connectWeb(onNotification);
  } else {
    await connectNative(onNotification);
  }
}

/** 웹: EventSource + HttpOnly Cookie */
function connectWeb(onNotification: SseCallback): void {
  const url = `${config.API_BASE_URL}/api/v1/notifications/stream`;

  eventSource = new EventSource(url, { withCredentials: true });

  eventSource.addEventListener('notification', (event: MessageEvent) => {
    try {
      const data: Notification = JSON.parse(event.data);
      onNotification(data);
    } catch {
      // malformed JSON 무시
    }
  });

  eventSource.onerror = () => {
    disconnect();
    scheduleReconnect(onNotification);
  };
}

/** 네이티브: react-native-sse + Authorization 헤더 */
async function connectNative(onNotification: SseCallback): Promise<void> {
  const token = await tokenStorage.getAccessToken();
  if (!token) return;

  const url = `${config.API_BASE_URL}/api/v1/notifications/stream`;

  // react-native-sse는 커스텀 헤더를 지원하는 순수 JS SSE 클라이언트
  const RNEventSource = (await import('react-native-sse')).default;

  const es = new RNEventSource<'notification'>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  es.addEventListener('notification', (event) => {
    if (!event.data) return;
    try {
      const data: Notification = JSON.parse(event.data);
      onNotification(data);
    } catch {
      // malformed JSON 무시
    }
  });

  es.addEventListener('error', () => {
    es.close();
    nativeEventSource = null;
    scheduleReconnect(onNotification);
  });

  nativeEventSource = es;
}

function scheduleReconnect(onNotification: SseCallback): void {
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => connectSSE(onNotification), 5000);
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

export function disconnect(): void {
  clearReconnectTimer();
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (nativeEventSource) {
    nativeEventSource.close();
    nativeEventSource = null;
  }
}
