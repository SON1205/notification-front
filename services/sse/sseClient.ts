import { Platform } from 'react-native';
import { config } from '../../constants/config';
import { tokenStorage } from '../auth/tokenStorage';
import type { Notification } from '../../types/notification';

type SseCallback = (notification: Notification) => void;

let abortController: AbortController | null = null;
let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * SSE 인증 전략 (하이브리드):
 * - 현재: 웹/네이티브 모두 fetch streaming + Authorization 헤더
 * - 목표: 웹은 EventSource + Cookie, 네이티브는 fetch + 헤더
 *
 * 백엔드에서 Set-Cookie 구현 완료 시:
 * COOKIE_AUTH_ENABLED를 true로 변경하면 웹이 Cookie 방식으로 전환됨
 */
const COOKIE_AUTH_ENABLED = false;

export async function connectSSE(onNotification: SseCallback): Promise<void> {
  disconnect();

  if (COOKIE_AUTH_ENABLED && Platform.OS === 'web') {
    connectWebCookie(onNotification);
  } else {
    await connectWithHeader(onNotification);
  }
}

/** 웹 Cookie 방식: EventSource + withCredentials (백엔드 Cookie 구현 후 활성화) */
function connectWebCookie(onNotification: SseCallback): void {
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

/** 헤더 방식: fetch streaming + Authorization (웹/네이티브 공통) */
async function connectWithHeader(onNotification: SseCallback): Promise<void> {
  const token = await tokenStorage.getAccessToken();
  if (!token) return;

  const url = `${config.API_BASE_URL}/api/v1/notifications/stream`;

  abortController = new AbortController();

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      signal: abortController.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      buffer = processBuffer(buffer, onNotification);
    }

    // 정상 종료 (서버 재배포 등) -> 재연결
    scheduleReconnect(onNotification);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') return;
    scheduleReconnect(onNotification);
  }
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

/**
 * SSE 표준 파서: \r\n 및 \r 지원, multi-line data, comment(`:`) 무시
 */
function processBuffer(buffer: string, onNotification: SseCallback): string {
  buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = buffer.split('\n');
  const remaining = lines.pop() ?? '';

  let eventName = '';
  let dataLines: string[] = [];

  for (const line of lines) {
    if (line === '') {
      if (eventName === 'notification' && dataLines.length > 0) {
        const rawData = dataLines.join('\n');
        try {
          const notification: Notification = JSON.parse(rawData);
          onNotification(notification);
        } catch {
          // malformed JSON 무시
        }
      }
      eventName = '';
      dataLines = [];
    } else if (line.startsWith(':')) {
      // heartbeat/comment 무시
    } else if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  return remaining;
}

export function disconnect(): void {
  clearReconnectTimer();
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}
