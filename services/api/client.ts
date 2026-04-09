import axios from 'axios';
import { Platform } from 'react-native';
import { config } from '../../constants/config';
import { tokenStorage } from '../auth/tokenStorage';

export const apiClient = axios.create({
  baseURL: `${config.API_BASE_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  // 웹: Cookie 자동 전송 (CSRF는 백엔드 SameSite=Lax로 방어)
  withCredentials: Platform.OS === 'web',
});

// 네이티브: Authorization 헤더로 JWT 전달
apiClient.interceptors.request.use(async (reqConfig) => {
  if (Platform.OS !== 'web') {
    const token = await tokenStorage.getAccessToken();
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
  }
  return reqConfig;
});

// 401 시 인증 상태 초기화 (zustand import 순환 방지를 위해 이벤트 방식)
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
