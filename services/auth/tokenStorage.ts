import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'access_token';

/**
 * 토큰 저장 전략:
 * - 네이티브: expo-secure-store (암호화 저장)
 * - 웹: localStorage (백엔드 Cookie 방식 구현 시 제거 예정)
 *
 * TODO: 백엔드에서 HttpOnly Cookie 인증 구현 후
 *       웹은 JS 토큰 관리 제거하고 Cookie 기반으로 전환
 */

async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setAccessToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearTokens(): Promise<void> {
  if (Platform.OS === 'web') {
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
