import apiClient from './client';
import type { ApiResponse, Result } from '../types';

export const resultApi = {
  getList: async (params?: {
    search?: string;
    id?: number | string;
    limit?: number;
    maxRowsPerPage?: number;
  }): Promise<ApiResponse<Result[]>> => {
    const res = await apiClient.post<ApiResponse<Result[]>>('result/getList', {
      limit: params?.limit ?? 0,
      maxRowsPerPage: params?.maxRowsPerPage ?? 30,
      search: params?.search ?? '',
      id: params?.id ?? '',
    });
    return res.data;
  },

  getMyList: async (params?: {
    search?: string;
    id?: number | string;
    limit?: number;
    maxRowsPerPage?: number;
  }): Promise<ApiResponse<Result[]>> => {
    const res = await apiClient.post<ApiResponse<Result[]>>('result/getMyList', {
      limit: params?.limit ?? 0,
      maxRowsPerPage: params?.maxRowsPerPage ?? 30,
      search: params?.search ?? '',
      id: params?.id ?? '',
    });
    return res.data;
  },

  view: async (id: number | string): Promise<any> => {
    const res = await apiClient.post('result/view', { id });
    return res.data;
  },

  remove: async (id: number | string): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('result/remove', { id });
    return res.data;
  },
};
