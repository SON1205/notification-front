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
      // 네이티브: body token을 SecureStore에 저장
      // 웹: 서버가 Set-Cookie로 HttpOnly Cookie 자동 설정
      if (Platform.OS !== 'web' && response.token) {
        await tokenStorage.setAccessToken(response.token);
      }
      set({ isAuthenticated: true, username: data.username });
    },

    logout: async () => {
      disconnectSSE();
      try {
        // 서버에 로그아웃 요청 (웹: 쿠키 삭제, 앱: 선택적)
        await authApi.logout();
      } catch {
        // 서버 불가 시에도 로컬 정리
      }
      await tokenStorage.clearTokens();
      set({ isAuthenticated: false, username: null });
    },

    checkAuth: async () => {
      if (Platform.OS === 'web') {
        // 웹: Cookie가 있으면 인증된 상태이지만 JS에서 확인 불가
        // 알림 목록 API 호출 시 401이면 자동 로그아웃됨
        // TODO: /auth/me API 추가 시 서버 검증으로 전환
        set({ isAuthenticated: false, isLoading: false });
      } else {
        // 네이티브: SecureStore 토큰 존재 여부로 판단
        const token = await tokenStorage.getAccessToken();
        set({ isAuthenticated: !!token, isLoading: false });
      }
    },
  };
});
