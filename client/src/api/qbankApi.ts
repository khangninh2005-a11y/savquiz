import apiClient from './client';
import type { ApiResponse, Question, Category, QuestionOption, QuestionTypeItem } from '../types';

export const qbankApi = {
  getList: async (params?: {
    search?: string;
    id?: number | string;
    cid?: number | string;
    difficulty_level?: string;
    quid?: number | string;
    showAssignedQuestions?: string | number;
    limit?: number;
    maxRowsPerPage?: number;
  }): Promise<ApiResponse<Question[]>> => {
    const res = await apiClient.post<ApiResponse<Question[]>>('qbank/getList', {
      limit: params?.limit ?? 0,
      maxRowsPerPage: params?.maxRowsPerPage ?? 30,
      search: params?.search ?? '',
      id: params?.id ?? '',
      cid: params?.cid ?? '',
      difficulty_level: params?.difficulty_level ?? '',
      quid: params?.quid ?? '',
      showAssignedQuestions: params?.showAssignedQuestions ?? '',
    });
    return res.data;
  },

  getQuestion: async (
    id: number | string
  ): Promise<ApiResponse<Question> & { options: QuestionOption[] }> => {
    const res = await apiClient.post('qbank/getQuestion', { id });
    return res.data;
  },

  getCategoryList: async (): Promise<ApiResponse<Category[]>> => {
    const res = await apiClient.post<ApiResponse<Category[]>>('qbank/getCategoryList', {});
    return res.data;
  },

  uploadMedia: async (file: File): Promise<ApiResponse<{ url: string; media_type: string; file_name: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('user_token') || '';
    const res = await apiClient.post<ApiResponse<{ url: string; media_type: string; file_name: string }>>(
      `upload/media?user_token=${encodeURIComponent(token)}`,
      formData
    );
    return res.data;
  },

  addQuestion: async (data: {
    category_ids: number;
    question_type: string;
    question: string;
    description?: string;
    difficulty_level?: string;
    media_url?: string;
    media_type?: string;
    options?: { option: string; score: number }[];
  }): Promise<ApiResponse> => {
    const fData: { name: string; value: any }[] = [
      { name: 'category_ids', value: data.category_ids },
      { name: 'question_type', value: data.question_type },
      { name: 'question', value: data.question },
      { name: 'description', value: data.description || '' },
      { name: 'difficulty_level', value: data.difficulty_level || 'Thông hiểu' },
      { name: 'media_url', value: data.media_url || '' },
      { name: 'media_type', value: data.media_type || '' },
    ];

    if (data.options && data.options.length > 0) {
      data.options.forEach((opt) => {
        fData.push({ name: 'option[]', value: opt.option });
        fData.push({ name: 'score[]', value: opt.score });
      });
    }

    const res = await apiClient.post<ApiResponse>('qbank/add', {
      fData: JSON.stringify(fData),
    });
    return res.data;
  },

  editQuestion: async (
    id: number,
    data: {
      category_ids: number;
      question_type: string;
      question: string;
      description?: string;
      difficulty_level?: string;
      media_url?: string;
      media_type?: string;
      options?: { id?: number; option: string; score: number }[];
    }
  ): Promise<ApiResponse> => {
    const fData: { name: string; value: any }[] = [
      { name: 'category_ids', value: data.category_ids },
      { name: 'question_type', value: data.question_type },
      { name: 'question', value: data.question },
      { name: 'description', value: data.description || '' },
      { name: 'difficulty_level', value: data.difficulty_level || 'Thông hiểu' },
      { name: 'media_url', value: data.media_url || '' },
      { name: 'media_type', value: data.media_type || '' },
    ];

    if (data.options && data.options.length > 0) {
      data.options.forEach((opt) => {
        fData.push({ name: 'option[]', value: opt.option });
        fData.push({ name: 'score[]', value: opt.score });
        if (opt.id) {
          fData.push({ name: 'option_id[]', value: opt.id });
        }
      });
    }

    const res = await apiClient.post<ApiResponse>('qbank/edit', {
      id,
      fData: JSON.stringify(fData),
    });
    return res.data;
  },

  remove: async (id: number | string): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('qbank/remove', { id });
    return res.data;
  },

  addCategory: async (category_name: string, parent_id = 0): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('qbank/addCategory', { category_name, parent_id });
    return res.data;
  },

  removeCategory: async (id: number): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('qbank/removeCategory', { id });
    return res.data;
  },

  getQuestionTypeList: async (): Promise<ApiResponse<QuestionTypeItem[]>> => {
    const res = await apiClient.post<ApiResponse<QuestionTypeItem[]>>('qbank/getQuestionTypeList', {});
    return res.data;
  },

  addQuestionType: async (data: {
    type_code: string;
    type_name: string;
    description?: string;
  }): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('qbank/addQuestionType', data);
    return res.data;
  },

  updateQuestionType: async (data: {
    id: number;
    type_name: string;
    description?: string;
  }): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('qbank/updateQuestionType', data);
    return res.data;
  },

  deleteQuestionType: async (id: number): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('qbank/deleteQuestionType', { id });
    return res.data;
  },
};
