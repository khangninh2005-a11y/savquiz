export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  user_token?: string;
  account_type_id: number;
  account_name?: string;
  group_ids: string;
  group_name?: string;
  access_permissions?: string;
  created_time?: string;
}

export interface Group {
  id: number;
  group_name: string;
  created_time?: string;
}

export interface Category {
  id: number;
  category_name: string;
  parent_id: number;
  created_time?: string;
}

export interface AccountType {
  id: number;
  account_name: string;
  access_permissions: string;
}

export type QuestionType =
  | 'Multiple Choice Single Answer'
  | 'Multiple Choice Multiple Answers'
  | 'True / False'
  | 'Short Answer'
  | 'Long Answer'
  | 'Match / Ordering'
  | 'Essay / Numerical'
  | (string & {});

export interface QuestionTypeItem {
  id: number;
  type_code: string;
  type_name: string;
  description?: string;
  trash_status?: number;
  created_time?: string;
}

export interface QuestionOption {
  id?: number;
  question_id?: number;
  question_option: string;
  score?: number;
  is_correct?: number;
}

export type DifficultyLevel = 'Nhận biết' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao';

export interface Question {
  id: number;
  category_ids: number;
  category_name?: string;
  question_type: QuestionType | string;
  question_type_name?: string;
  question: string;
  description?: string;
  difficulty_level?: DifficultyLevel | string;
  media_url?: string;
  media_type?: 'image' | 'audio' | string;
  options?: QuestionOption[];
  created_time?: string;
}

export interface MatrixRule {
  category_id: number;
  category_name?: string;
  difficulty?: string;
  count: number;
}

export interface Quiz {
  id: number;
  quiz_name: string;
  description: string;
  start_datetime: number | string;
  end_datetime: number | string;
  gids: string;
  qids: string;
  max_attempt: number;
  min_pass_percentage: number;
  correct_score: string;
  incorrect_score: string;
  instant_result: number;
  duration: number; // in minutes
  show_result: number;
  show_result_on_date?: number | string;
  shuffle_questions?: number;
  shuffle_options?: number;
  quiz_password?: string;
  matrix_config?: string;
  anti_cheating?: number;
  max_tab_switches?: number;
  created_time?: string;
}

export interface Result {
  id: number;
  uid: number;
  quid: number;
  quiz_name?: string;
  username?: string;
  email?: string;
  full_name?: string;
  obtained_percentage: number;
  obtained_score: number;
  max_score?: number;
  total_questions?: number;
  score_10?: number;
  no_corrected?: number;
  no_incorrected?: number;
  no_unanswered?: number;
  time_spent_in_min?: string;
  min_pass_percentage?: number;
  result_status: 'Open' | 'Pass' | 'Fail';
  time_spent: number;
  attempted_datetime: number;
  result_generated_time?: number;
  assigned_qids?: string;
  qids_status?: string;
  ind_score?: string;
  ind_time?: string;
  color_codes?: string;
  response_time?: number;
}

export interface ApiResponse<T = any> {
  status: 'success' | 'failed';
  message?: string;
  data?: T;
  options?: QuestionOption[];
  id?: number;
  rid?: number;
  maximum_datetime?: number;
}
