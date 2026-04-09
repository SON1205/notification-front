import { create } from 'zustand';
import { tokenStorage } from '../services/auth/tokenStorage';
import { authApi } from '../services/api/authApi';
import type { LoginRequest, User } from '../types/auth';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,

  login: async (data) => {
    const { accessToken } = await authApi.login(data);
    await tokenStorage.setAccessToken(accessToken);
    set({ isAuthenticated: true });
  },

  logout: async () => {
    await tokenStorage.clearTokens();
    set({ isAuthenticated: false, user: null });
  },

  checkAuth: async () => {
    const token = await tokenStorage.getAccessToken();
    set({ isAuthenticated: !!token, isLoading: false });
  },
}));
