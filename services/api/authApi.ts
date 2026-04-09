import { apiClient } from './client';
import type { LoginRequest, LoginResponse, SignupRequest, User } from '../../types/auth';

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', data).then((res) => res.data),

  signup: (data: SignupRequest) =>
    apiClient.post('/auth/signup', data).then((res) => res.data),

  /** 현재 인증 상태 확인 (웹: Cookie 기반, 앱: 헤더 기반) */
  me: () =>
    apiClient.get<User>('/auth/me').then((res) => res.data),

  /** 로그아웃 (웹: 서버가 쿠키 삭제) */
  logout: () =>
    apiClient.post('/auth/logout'),
};
