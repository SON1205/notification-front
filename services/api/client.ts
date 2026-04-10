import axios from 'axios';
import { Platform } from 'react-native';
import { config } from '../../constants/config';
import { tokenStorage } from '../auth/tokenStorage';

/**
 * 하이브리드 인증:
 * - 웹: HttpOnly Cookie (withCredentials: true, 서버가 Set-Cookie로 관리)
 * - 네이티브: Authorization 헤더 (expo-secure-store)
 *
 * CSRF 방어: 백엔드에서 SameSite=Lax + Secure 설정
 */
export const apiClient = axios.create({
  baseURL: `${config.API_BASE_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  // 웹: Cookie 자동 전송
  withCredentials: Platform.OS === 'web',
});

// 네이티브만 Authorization 헤더 주입
apiClient.interceptors.request.use(async (reqConfig) => {
  if (Platform.OS !== 'web') {
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
      if (Platform.OS !== 'web') {
        await tokenStorage.clearTokens();
      }
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);
