import axios from 'axios';
import { Platform } from 'react-native';
import { config } from '../../constants/config';
import { tokenStorage } from '../auth/tokenStorage';

/**
 * 인증 전략:
 * - 현재: 웹/네이티브 모두 Authorization 헤더
 * - 목표: 웹은 Cookie (withCredentials), 네이티브는 헤더
 *
 * 백엔드에서 Set-Cookie 구현 완료 시:
 * 1. COOKIE_AUTH_ENABLED를 true로 변경
 * 2. tokenStorage.ts에서 웹 localStorage 제거
 */
const COOKIE_AUTH_ENABLED = false;

export const apiClient = axios.create({
  baseURL: `${config.API_BASE_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: COOKIE_AUTH_ENABLED && Platform.OS === 'web',
});

// 네이티브는 항상 헤더, 웹은 Cookie 미구현 시에만 헤더
apiClient.interceptors.request.use(async (reqConfig) => {
  const useCookie = COOKIE_AUTH_ENABLED && Platform.OS === 'web';
  if (!useCookie) {
    const token = await tokenStorage.getAccessToken();
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
  }
  return reqConfig;
});

// 401 시 인증 상태 초기화
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: () => void): void {
  onUnauthorized = callback;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await tokenStorage.clearTokens();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);
