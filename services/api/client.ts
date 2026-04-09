import axios from 'axios';
import { config } from '../../constants/config';
import { tokenStorage } from '../auth/tokenStorage';

export const apiClient = axios.create({
  baseURL: `${config.API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (reqConfig) => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    reqConfig.headers.Authorization = `Bearer ${token}`;
  }
  return reqConfig;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await tokenStorage.clearTokens();
    }
    return Promise.reject(error);
  },
);
