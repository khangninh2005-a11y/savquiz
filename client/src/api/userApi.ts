import apiClient from './client';
import type { ApiResponse, User, Group, AccountType } from '../types';

export const userApi = {
  getList: async (params?: {
    search?: string;
    id?: number | string;
    limit?: number;
    maxRowsPerPage?: number;
  }): Promise<ApiResponse<User[]>> => {
    const res = await apiClient.post<ApiResponse<User[]>>('user/getList', {
      limit: params?.limit ?? 0,
      maxRowsPerPage: params?.maxRowsPerPage ?? 30,
      search: params?.search ?? '',
      id: params?.id ?? '',
    });
    return res.data;
  },

  getGroupList: async (): Promise<ApiResponse<Group[]>> => {
    const res = await apiClient.post<ApiResponse<Group[]>>('user/getGroupList', {});
    return res.data;
  },

  getAccountTypeList: async (): Promise<ApiResponse<AccountType[]>> => {
    const res = await apiClient.post<ApiResponse<AccountType[]>>('user/getAccountTypeList', {});
    return res.data;
  },

  addUser: async (data: {
    username: string;
    email: string;
    full_name: string;
    passworde: string;
    account_type_id: number;
    group_ids: string;
  }): Promise<ApiResponse> => {
    const fData = [
      { name: 'username', value: data.username },
      { name: 'email', value: data.email },
      { name: 'full_name', value: data.full_name },
      { name: 'passworde', value: data.passworde },
      { name: 'account_type_id', value: data.account_type_id },
      { name: 'group_ids', value: data.group_ids },
    ];
    const res = await apiClient.post<ApiResponse>('user/add', {
      fData: JSON.stringify(fData),
    });
    return res.data;
  },

  editUser: async (
    id: number,
    data: {
      username: string;
      email: string;
      full_name: string;
      passworde?: string;
      account_type_id: number;
      group_ids: string;
    }
  ): Promise<ApiResponse> => {
    const fData = [
      { name: 'username', value: data.username },
      { name: 'email', value: data.email },
      { name: 'full_name', value: data.full_name },
      { name: 'account_type_id', value: data.account_type_id },
      { name: 'group_ids', value: data.group_ids },
    ];
    if (data.passworde) {
      fData.push({ name: 'passworde', value: data.passworde });
    }
    const res = await apiClient.post<ApiResponse>('user/edit', {
      id,
      fData: JSON.stringify(fData),
    });
    return res.data;
  },

  remove: async (id: number | string): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('user/remove', { id });
    return res.data;
  },

  addGroup: async (group_name: string): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('user/addGroup', { group_name });
    return res.data;
  },

  removeGroup: async (id: number): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('user/removeGroup', { id });
    return res.data;
  },

  getDashboardStat: async (): Promise<ApiResponse<{
    total_users: number;
    total_questions: number;
    total_quizzes: number;
    total_results: number;
  }>> => {
    const res = await apiClient.post<ApiResponse<any>>('user/dashboardStat', {});
    return res.data;
  },

  updateProfile: async (data: { full_name: string; email: string }): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('user/updateProfile', data);
    return res.data;
  },

  changePassword: async (data: { old_password: string; new_password: string }): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('user/changePassword', data);
    return res.data;
  },
};
