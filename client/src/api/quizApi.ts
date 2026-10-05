import apiClient from './client';
import type { ApiResponse, Quiz } from '../types';

export const quizApi = {
  getList: async (params?: {
    search?: string;
    id?: number | string;
    limit?: number;
    maxRowsPerPage?: number;
  }): Promise<ApiResponse<Quiz[]>> => {
    const res = await apiClient.post<ApiResponse<Quiz[]>>('quiz/getList', {
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
  }): Promise<ApiResponse<Quiz[]>> => {
    const res = await apiClient.post<ApiResponse<Quiz[]>>('quiz/getMyList', {
      limit: params?.limit ?? 0,
      maxRowsPerPage: params?.maxRowsPerPage ?? 30,
      search: params?.search ?? '',
      id: params?.id ?? '',
    });
    return res.data;
  },

  addQuiz: async (data: Partial<Quiz>): Promise<ApiResponse> => {
    const fData = [
      { name: 'quiz_name', value: data.quiz_name },
      { name: 'description', value: data.description || '' },
      { name: 'start_datetime', value: data.start_datetime },
      { name: 'end_datetime', value: data.end_datetime },
      { name: 'gids[]', value: data.gids ? (Array.isArray(data.gids) ? data.gids : [data.gids]) : [] },
      { name: 'max_attempt', value: data.max_attempt || 10 },
      { name: 'min_pass_percentage', value: data.min_pass_percentage || 50 },
      { name: 'correct_score', value: data.correct_score || '1' },
      { name: 'incorrect_score', value: data.incorrect_score || '0' },
      { name: 'instant_result', value: data.instant_result ?? 1 },
      { name: 'duration', value: data.duration || 60 },
      { name: 'show_result', value: data.show_result ?? 1 },
      { name: 'show_result_on_date', value: data.show_result_on_date || data.end_datetime },
      { name: 'shuffle_questions', value: data.shuffle_questions ? 1 : 0 },
      { name: 'shuffle_options', value: data.shuffle_options ? 1 : 0 },
      { name: 'quiz_password', value: data.quiz_password || '' },
      { name: 'matrix_config', value: data.matrix_config || '' },
      { name: 'anti_cheating', value: data.anti_cheating ? 1 : 0 },
      { name: 'max_tab_switches', value: data.max_tab_switches || 3 },
    ];
    const res = await apiClient.post<ApiResponse>('quiz/add', {
      fData: JSON.stringify(fData),
    });
    return res.data;
  },

  editQuiz: async (id: number, data: Partial<Quiz>): Promise<ApiResponse> => {
    const fData = [
      { name: 'quiz_name', value: data.quiz_name },
      { name: 'description', value: data.description || '' },
      { name: 'start_datetime', value: data.start_datetime },
      { name: 'end_datetime', value: data.end_datetime },
      { name: 'gids[]', value: data.gids ? (Array.isArray(data.gids) ? data.gids : [data.gids]) : [] },
      { name: 'max_attempt', value: data.max_attempt || 10 },
      { name: 'min_pass_percentage', value: data.min_pass_percentage || 50 },
      { name: 'correct_score', value: data.correct_score || '1' },
      { name: 'incorrect_score', value: data.incorrect_score || '0' },
      { name: 'instant_result', value: data.instant_result ?? 1 },
      { name: 'duration', value: data.duration || 60 },
      { name: 'show_result', value: data.show_result ?? 1 },
      { name: 'show_result_on_date', value: data.show_result_on_date || data.end_datetime },
      { name: 'shuffle_questions', value: data.shuffle_questions ? 1 : 0 },
      { name: 'shuffle_options', value: data.shuffle_options ? 1 : 0 },
      { name: 'quiz_password', value: data.quiz_password !== undefined ? data.quiz_password : '' },
      { name: 'matrix_config', value: data.matrix_config !== undefined ? data.matrix_config : '' },
      { name: 'anti_cheating', value: data.anti_cheating !== undefined ? (data.anti_cheating ? 1 : 0) : 0 },
      { name: 'max_tab_switches', value: data.max_tab_switches || 3 },
    ];
    const res = await apiClient.post<ApiResponse>('quiz/edit', {
      id,
      fData: JSON.stringify(fData),
    });
    return res.data;
  },

  remove: async (id: number | string): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('quiz/remove', { id });
    return res.data;
  },

  addQuestionIntoQuiz: async (quid: number | string, qid: number | string): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('quiz/addQuestionIntoQuiz', { quid, qid });
    return res.data;
  },

  removeQuestionIntoQuiz: async (quid: number | string, qid: number | string): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('quiz/removeQuestionIntoQuiz', { quid, qid });
    return res.data;
  },

  assignQuestions: async (quid: number | string, qids: (number | string)[] | string): Promise<ApiResponse<{ qids: string }>> => {
    const res = await apiClient.post<ApiResponse<{ qids: string }>>('quiz/assignQuestions', { quid, qids });
    return res.data;
  },

  validateQuiz: async (quid: number | string, quiz_password?: string): Promise<ApiResponse & { require_password?: boolean; anti_cheating?: number; max_tab_switches?: number }> => {
    const res = await apiClient.post<ApiResponse & { require_password?: boolean; anti_cheating?: number; max_tab_switches?: number }>('quiz/validateQuiz', {
      quid,
      quiz_password,
    });
    return res.data;
  },

  logEvent: async (params: {
    rid: number | string;
    event?: string;
  }): Promise<ApiResponse<{ violations: number; max_allowed: number; should_terminate: boolean }>> => {
    const res = await apiClient.post<ApiResponse<{ violations: number; max_allowed: number; should_terminate: boolean }>>(
      'quiz/logEvent',
      params
    );
    return res.data;
  },

  getQuestions: async (params: {
    quid: number | string;
    rid: number | string;
    uid: number | string;
    assigned_qids: string;
    response_time?: number | string;
  }): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('quiz/getQuestions', params);
    return res.data;
  },

  saveAnswer: async (params: {
    quid: number | string;
    rid: number | string;
    question_id?: number | string;
    qid?: number | string;
    user_response?: string | number | (string | number)[];
    color_codes_p?: string;
    fData?: string;
  }): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('quiz/saveAnswer', params);
    return res.data;
  },

  submitQuiz: async (
    rid: number | string,
    rby = 'User',
    extra?: { answers?: Record<number | string, any> }
  ): Promise<ApiResponse> => {
    const res = await apiClient.post<ApiResponse>('quiz/submitQuiz', { rid, rby, ...extra });
    return res.data;
  },
};
