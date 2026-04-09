import axios from 'axios';
import { config } from '../../constants/config';
import { tokenStorage } from '../auth/tokenStorage';

export const apiClient = axios.create({
  baseURL: `${config.API_BASE_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  // TODO: 백엔드 Cookie 인증 구현 후 웹에서 withCredentials: true 활성화
});

// JWT 헤더 자동 주입 (웹/네이티브 공통, Cookie 전환 시 네이티브만)
apiClient.interceptors.request.use(async (reqConfig) => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    reqConfig.headers.Authorization = `Bearer ${token}`;
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
