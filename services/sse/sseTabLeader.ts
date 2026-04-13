/**
 * BroadcastChannel 기반 탭 리더 선출
 *
 * 계약: SSE 연결은 브라우저 전체에서 단 하나의 탭(리더)만 유지한다.
 * 리더가 알림을 받으면 BroadcastChannel로 다른 탭에 전파한다.
 * 리더 탭이 닫히면 나머지 탭 중 하나가 새 리더로 승격한다.
 */

import type { Notification } from '../../types/notification';

const CHANNEL_NAME = 'sse-leader';
const HEARTBEAT_INTERVAL = 2_000; // 리더 생존 신호 주기
const LEADER_TIMEOUT = 5_000; // 이 시간 안에 heartbeat 없으면 리더 사망 판정

type ChannelMessage =
  | { type: 'leader-heartbeat'; tabId: string }
  | { type: 'leader-claim'; tabId: string }
  | { type: 'notification'; payload: Notification };

type OnNotification = (n: Notification) => void;
type OnBecomeLeader = () => void;
type OnLoseLeadership = () => void;

const tabId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let channel: BroadcastChannel | null = null;
let isLeader = false;
let leaderHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
let leaderTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

let onNotificationCb: OnNotification | null = null;
let onBecomeLeaderCb: OnBecomeLeader | null = null;
let onLoseLeadershipCb: OnLoseLeadership | null = null;

export function isCurrentTabLeader(): boolean {
  return isLeader;
}

/**
 * 탭 리더 선출 시작
 * - onNotification: 팔로워 탭이 리더로부터 알림을 받았을 때
 * - onBecomeLeader: 이 탭이 리더로 승격됐을 때 (SSE 연결 시작)
 * - onLoseLeadership: 이 탭이 리더를 잃었을 때 (SSE 연결 해제)
 */
export function startElection(
  onNotification: OnNotification,
  onBecomeLeader: OnBecomeLeader,
  onLoseLeadership: OnLoseLeadership,
): void {
  cleanup();

  onNotificationCb = onNotification;
  onBecomeLeaderCb = onBecomeLeader;
  onLoseLeadershipCb = onLoseLeadership;

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (e: MessageEvent<ChannelMessage>) => {
    const msg = e.data;

    switch (msg.type) {
      case 'leader-heartbeat':
        if (msg.tabId !== tabId) {
          // 다른 탭이 리더 — 내가 리더면 양보 (먼저 claim한 쪽 우선)
          if (isLeader) {
            resignLeader();
          }
          resetLeaderTimeout();
        }
        break;

      case 'leader-claim':
        if (msg.tabId !== tabId && isLeader) {
          // 동시 claim 충돌 — tabId 사전순 비교로 결정
          if (msg.tabId < tabId) {
            resignLeader();
            resetLeaderTimeout();
          }
        }
        if (msg.tabId !== tabId && !isLeader) {
          resetLeaderTimeout();
        }
        break;

      case 'notification':
        if (!isLeader && onNotificationCb) {
          onNotificationCb(msg.payload);
        }
        break;
    }
  };

  // 리더 claim 시도
  claimLeader();
}

/** 리더로부터 받은 알림을 다른 탭에 전파 (리더 탭에서 호출) */
export function broadcastNotification(notification: Notification): void {
  if (!channel || !isLeader) return;
  const msg: ChannelMessage = { type: 'notification', payload: notification };
  channel.postMessage(msg);
}

export function cleanup(): void {
  stopLeaderHeartbeat();
  clearLeaderTimeout();
  isLeader = false;

  if (channel) {
    channel.close();
    channel = null;
  }

  onNotificationCb = null;
  onBecomeLeaderCb = null;
  onLoseLeadershipCb = null;
}

// --- internal ---

function claimLeader(): void {
  if (!channel) return;

  isLeader = true;
  const msg: ChannelMessage = { type: 'leader-claim', tabId };
  channel.postMessage(msg);
  startLeaderHeartbeat();
  onBecomeLeaderCb?.();
}

function resignLeader(): void {
  isLeader = false;
  stopLeaderHeartbeat();
  onLoseLeadershipCb?.();
}

function startLeaderHeartbeat(): void {
  stopLeaderHeartbeat();
  leaderHeartbeatTimer = setInterval(() => {
    if (!channel || !isLeader) return;
    const msg: ChannelMessage = { type: 'leader-heartbeat', tabId };
    channel.postMessage(msg);
  }, HEARTBEAT_INTERVAL);
}

function stopLeaderHeartbeat(): void {
  if (leaderHeartbeatTimer) {
    clearInterval(leaderHeartbeatTimer);
    leaderHeartbeatTimer = null;
  }
}

function resetLeaderTimeout(): void {
  clearLeaderTimeout();
  leaderTimeoutTimer = setTimeout(() => {
    // 리더가 사라짐 — 내가 새 리더로 승격
    claimLeader();
  }, LEADER_TIMEOUT);
}

function clearLeaderTimeout(): void {
  if (leaderTimeoutTimer) {
    clearTimeout(leaderTimeoutTimer);
    leaderTimeoutTimer = null;
  }
}
