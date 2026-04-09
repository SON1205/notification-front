import { create } from 'zustand';
import { Platform } from 'react-native';
import { tokenStorage } from '../services/auth/tokenStorage';
import { authApi } from '../services/api/authApi';
import { setOnUnauthorized } from '../services/api/client';
import { disconnect as disconnectSSE } from '../services/sse/sseClient';
import type { LoginRequest, User } from '../types/auth';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  const logout = async () => {
    disconnectSSE();
    try {
      await authApi.logout();
    } catch {
      // 서버 불가 시에도 로컬 정리
    }
    await tokenStorage.clearTokens();
    set({ isAuthenticated: false, user: null });
  };

  // 401 발생 시 자동 로그아웃
  setOnUnauthorized(() => {
    set({ isAuthenticated: false, user: null });
    disconnectSSE();
    tokenStorage.clearTokens();
  });

  return {
    isAuthenticated: false,
    isLoading: true,
    user: null,

    login: async (data) => {
      const response = await authApi.login(data);
      // 네이티브: 응답 body에서 토큰 저장
      // 웹: 서버가 Set-Cookie로 자동 처리
      if (Platform.OS !== 'web' && response.accessToken) {
        await tokenStorage.setAccessToken(response.accessToken);
      }
      // 로그인 직후 사용자 정보 확인
      try {
        const user = await authApi.me();
        set({ isAuthenticated: true, user });
      } catch {
        set({ isAuthenticated: true });
      }
    },

    logout,

    checkAuth: async () => {
      try {
        if (Platform.OS === 'web') {
          const user = await authApi.me();
          set({ isAuthenticated: true, user, isLoading: false });
        } else {
          const token = await tokenStorage.getAccessToken();
          if (token) {
            const user = await authApi.me();
            set({ isAuthenticated: true, user, isLoading: false });
          } else {
            set({ isAuthenticated: false, isLoading: false });
          }
        }
      } catch {
        // 인증 실패 시 토큰 정리
        await tokenStorage.clearTokens();
        set({ isAuthenticated: false, user: null, isLoading: false });
      }
    },
  };
});
