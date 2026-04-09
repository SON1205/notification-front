import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'access_token';

/**
 * 토큰 저장 전략:
 * - 웹: 서버가 HttpOnly Cookie로 관리 (JS에서 접근 불가 = XSS 안전)
 * - 네이티브: expo-secure-store (암호화 저장)
 */

async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    // 웹은 Cookie 기반이므로 JS에서 토큰을 직접 관리하지 않음
    // API 요청 시 브라우저가 자동으로 Cookie를 포함
    return null;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setAccessToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    // 웹은 서버가 Set-Cookie로 관리하므로 클라이언트에서 저장하지 않음
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearTokens(): Promise<void> {
  if (Platform.OS === 'web') {
    // 웹은 로그아웃 API 호출 시 서버가 쿠키를 삭제
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export const tokenStorage = {
  getAccessToken,
  setAccessToken,
  clearTokens,
};
