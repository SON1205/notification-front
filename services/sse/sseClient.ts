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
 * - 웹: Cookie 기반 (EventSource + withCredentials)
 * - 네이티브: Authorization 헤더 (fetch streaming)
 *
 * CSRF 방어: 백엔드에서 SameSite=Lax + Secure 설정을 전제.
 * 상태 변경 API는 POST/PATCH만 사용하므로 SameSite=Lax로 충분.
 */
export async function connectSSE(onNotification: SseCallback): Promise<void> {
  disconnect();

  if (Platform.OS === 'web') {
    connectWeb(onNotification);
  } else {
    await connectNative(onNotification);
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

/** 웹: 브라우저 EventSource + Cookie 자동 전송 */
function connectWeb(onNotification: SseCallback): void {
  const url = `${config.API_BASE_URL}/api/v1/notifications/stream`;

  eventSource = new EventSource(url, { withCredentials: true });

  eventSource.addEventListener('notification', (event: MessageEvent) => {
    try {
      const data: Notification = JSON.parse(event.data);
      onNotification(data);
    } catch {
      // malformed JSON은 무시하고 연결 유지
    }
  });

  eventSource.onerror = () => {
    disconnect();
    scheduleReconnect(onNotification);
  };
}

/** 네이티브: fetch streaming + Authorization 헤더 */
async function connectNative(onNotification: SseCallback): Promise<void> {
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

/**
 * SSE 표준 파서: \r\n 및 \r 지원, multi-line data, comment(`:`) 무시
 * 반환값: 아직 처리되지 않은 나머지 버퍼
 */
function processBuffer(buffer: string, onNotification: SseCallback): string {
  // \r\n -> \n, 단독 \r -> \n 으로 정규화
  buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = buffer.split('\n');
  // 마지막 요소는 아직 완성되지 않은 라인일 수 있음
  const remaining = lines.pop() ?? '';

  let eventName = '';
  let dataLines: string[] = [];

  for (const line of lines) {
    if (line === '') {
      // 빈 줄 = 이벤트 디스패치
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
      // 주석/heartbeat 무시
    } else if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
    // id:, retry: 등은 현재 무시 (Phase 2에서 Last-Event-ID 지원 시 추가)
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
