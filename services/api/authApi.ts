import { apiClient } from './client';
import type { LoginRequest, LoginResponse, SignupRequest, SignupResponse } from '../../types/auth';

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', data).then((res) => res.data),

  signup: (data: SignupRequest) =>
    apiClient.post<SignupResponse>('/auth/signup', data).then((res) => res.data),

  /** 로그아웃: 서버가 HttpOnly Cookie 삭제 */
  logout: () =>
    apiClient.post('/auth/logout'),
};
