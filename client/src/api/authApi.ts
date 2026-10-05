import apiClient from './client';
import type { ApiResponse, User } from '../types';

export const authApi = {
  login: async (username: string, passworde: string): Promise<ApiResponse<User>> => {
    const res = await apiClient.post<ApiResponse<User>>('login/index', {
      username,
      passworde,
    });
    return res.data;
  },

  resetPassword: async (email: string): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('login/resetPassword', { email });
    return res.data;
  },

  validateToken: async (token?: string): Promise<boolean> => {
    try {
      const user_token = token || localStorage.getItem('user_token');
      if (!user_token) return false;
      const res = await apiClient.post('commondata/validateToken', { user_token });
      if (typeof res.data === 'string' && res.data.trim() === 'success') {
        return true;
      }
      if (typeof res.data === 'object' && res.data?.status === 'success') {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  myInfo: async (): Promise<ApiResponse<User[]>> => {
    const res = await apiClient.post<ApiResponse<User[]>>('user/myInfo', {});
    return res.data;
  },
};
