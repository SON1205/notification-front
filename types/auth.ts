export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface SignupRequest {
  username: string;
  password: string;
}

export interface SignupResponse {
  userId: number;
  username: string;
}

export interface User {
  id: number;
  username: string;
}
