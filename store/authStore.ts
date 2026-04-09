import { create } from 'zustand';
import { Platform } from 'react-native';
import { tokenStorage } from '../services/auth/tokenStorage';
import { authApi } from '../services/api/authApi';
import { setOnUnauthorized } from '../services/api/client';
import { disconnect as disconnectSSE } from '../services/sse/sseClient';
import type { LoginRequest } from '../types/auth';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  username: string | null;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  const forceLogout = () => {
    disconnectSSE();
    tokenStorage.clearTokens();
    set({ isAuthenticated: false, username: null });
  };

  // 401 발생 시 자동 로그아웃
  setOnUnauthorized(forceLogout);

  return {
    isAuthenticated: false,
    isLoading: true,
    username: null,

    login: async (data) => {
      const response = await authApi.login(data);
      // 네이티브: 응답 body에서 토큰 저장
      // 웹: 서버가 Set-Cookie로 자동 처리 (백엔드 구현 시)
      if (response.token) {
        await tokenStorage.setAccessToken(response.token);
      }
      set({ isAuthenticated: true, username: data.username });
    },

    logout: async () => {
      disconnectSSE();
      await tokenStorage.clearTokens();
      set({ isAuthenticated: false, username: null });
    },

    checkAuth: async () => {
      // 현재 백엔드에 /auth/me API가 없으므로 토큰 존재 여부로 판단
      // 백엔드에 me API 추가 시 서버 검증으로 전환
      const token = await tokenStorage.getAccessToken();
      set({ isAuthenticated: !!token, isLoading: false });
    },
  };
});
