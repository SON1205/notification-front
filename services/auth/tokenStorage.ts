import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'access_token';

/**
 * 토큰 저장 전략:
 * - 네이티브: expo-secure-store (암호화 저장)
 * - 웹 (현재): localStorage
 * - 웹 (목표): 서버 HttpOnly Cookie (JS 접근 불가 = XSS 방어)
 *
 * 백엔드 Cookie 구현 완료 시:
 * 1. client.ts의 COOKIE_AUTH_ENABLED를 true로 변경
 * 2. 아래 웹 분기에서 localStorage 대신 null 반환
 */

async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    // TODO: Cookie 전환 시 null 반환으로 변경
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setAccessToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    // TODO: Cookie 전환 시 no-op으로 변경
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearTokens(): Promise<void> {
  if (Platform.OS === 'web') {
    // TODO: Cookie 전환 시 no-op으로 변경 (서버가 쿠키 삭제)
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export const tokenStorage = {
  getAccessToken,
  setAccessToken,
  clearTokens,
};
