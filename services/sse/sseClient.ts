import { Platform } from 'react-native';
import { config } from '../../constants/config';
import { tokenStorage } from '../auth/tokenStorage';
import type { Notification } from '../../types/notification';
import {
  startElection,
  broadcastNotification,
  cleanup as cleanupLeader,
  isCurrentTabLeader,
} from './sseTabLeader';

type SseCallback = (notification: Notification) => void;

// 웹: 브라우저 EventSource (리더 탭만 보유)
let eventSource: EventSource | null = null;
// 네이티브: react-native-sse
let nativeEventSource: InstanceType<typeof import('react-native-sse').default> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

// iOS는 유휴 연결을 공격적으로 끊지만 error 이벤트가 안 올 수 있음
// 서버에서 heartbeat가 오든, notification이 오든 아무 이벤트가 없으면 재연결
const HEARTBEAT_TIMEOUT = 45_000; // 45초

/**
 * SSE 하이브리드:
 * - 웹: BroadcastChannel 탭 리더 선출 → 리더 탭만 EventSource 연결
 * - 네이티브: react-native-sse + Authorization 헤더
 */
export async function connectSSE(onNotification: SseCallback): Promise<void> {
  disconnect();

  if (Platform.OS === 'web') {
    connectWebWithLeaderElection(onNotification);
  } else {
    await connectNative(onNotification);
  }
}

/**
 * 웹: BroadcastChannel 리더 선출 → 리더 탭만 EventSource 연결
 * 팔로워 탭은 BroadcastChannel로 알림 수신
 */
function connectWebWithLeaderElection(onNotification: SseCallback): void {
  startElection(
    // 팔로워 탭: 리더가 broadcast한 알림 수신
    onNotification,
    // 리더 승격: SSE 연결 시작
    () => openEventSource(onNotification),
    // 리더 상실: SSE 연결 해제 (팔로워로 전환)
    () => closeEventSource(),
  );
}

/** 리더 탭 전용: 실제 EventSource 연결 */
function openEventSource(onNotification: SseCallback): void {
  closeEventSource();

  const url = `${config.API_BASE_URL}/api/v1/notifications/stream`;
  eventSource = new EventSource(url, { withCredentials: true });

  eventSource.addEventListener('notification', (event: MessageEvent) => {
    try {
      const data: Notification = JSON.parse(event.data);
      onNotification(data);
      broadcastNotification(data);
    } catch {
      // malformed JSON 무시
    }
  });

  eventSource.onerror = () => {
    closeEventSource();
    // 리더인 동안만 재연결 시도
    if (isCurrentTabLeader()) {
      scheduleReconnect(onNotification);
    }
  };
}

/** EventSource만 정리 (리더 선출은 유지) */
function closeEventSource(): void {
  clearReconnectTimer();
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

/** 네이티브: react-native-sse + Authorization 헤더 */
async function connectNative(onNotification: SseCallback): Promise<void> {
  const token = await tokenStorage.getAccessToken();
  if (!token) return;

  const url = `${config.API_BASE_URL}/api/v1/notifications/stream`;

  // react-native-sse는 커스텀 헤더를 지원하는 순수 JS SSE 클라이언트
  const RNEventSource = (await import('react-native-sse')).default;

  const es = new RNEventSource<'notification' | 'heartbeat'>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // 연결 성공 시 heartbeat 감시 시작
  es.addEventListener('open', () => {
    resetHeartbeat(onNotification);
  });

  es.addEventListener('notification', (event) => {
    resetHeartbeat(onNotification);
    if (!event.data) return;
    try {
      const data: Notification = JSON.parse(event.data);
      onNotification(data);
    } catch {
      // malformed JSON 무시
    }
  });

  // 서버가 heartbeat 이벤트를 보내는 경우 타이머만 리셋
  es.addEventListener('heartbeat', () => {
    resetHeartbeat(onNotification);
  });

  // SSE 기본 메시지(이벤트 이름 없는 data)도 heartbeat로 취급
  es.addEventListener('message', () => {
    resetHeartbeat(onNotification);
  });

  es.addEventListener('error', () => {
    clearHeartbeat();
    es.close();
    nativeEventSource = null;
    scheduleReconnect(onNotification);
  });

  nativeEventSource = es;
}

/** heartbeat 타이머 리셋 — 타임아웃 내에 아무 이벤트도 없으면 강제 재연결 */
function resetHeartbeat(onNotification: SseCallback): void {
  clearHeartbeat();
  heartbeatTimer = setTimeout(() => {
    // iOS에서 연결이 조용히 끊긴 것으로 판단
    disconnect();
    scheduleReconnect(onNotification);
  }, HEARTBEAT_TIMEOUT);
}

function clearHeartbeat(): void {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
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

export function disconnect(): void {
  clearReconnectTimer();
  clearHeartbeat();
  cleanupLeader();
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (nativeEventSource) {
    nativeEventSource.close();
    nativeEventSource = null;
  }
}
