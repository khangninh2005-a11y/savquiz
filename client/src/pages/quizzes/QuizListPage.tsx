import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Search,
  Plus,
  Trash2,
  Edit2,
  Play,
  Clock,
  ListPlus,
  Check,
  AlertCircle,
  Shuffle,
  Layers,
  Folder,
  CheckSquare,
  Square,
  CheckCircle2,
  X,
  Lock,
  ShieldAlert,
  Sparkles,
  Calendar,
  Key,
} from 'lucide-react';
import { quizApi } from '../../api/quizApi';
import { qbankApi } from '../../api/qbankApi';
import { userApi } from '../../api/userApi';
import type { Quiz, Question, Group, Category, MatrixRule } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/Common/Modal';
import { ConfirmModal } from '../../components/Common/ConfirmModal';
import { Pagination } from '../../components/Common/Pagination';
import { MathRenderer } from '../../components/Math/MathRenderer';

export const QuizListPage: React.FC = () => {
  const { isStaff } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 12;

  // Assign Questions State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSelectedCategory, setAssignSelectedCategory] = useState<number | 'all'>('all');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignFilterStatus, setAssignFilterStatus] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [batchUpdating, setBatchUpdating] = useState(false);

  // Add / Edit Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  // Mode: manual (qids) or matrix (matrix_config)
  const [quizMode, setQuizMode] = useState<'manual' | 'matrix'>('manual');
  const [matrixRules, setMatrixRules] = useState<MatrixRule[]>([]);
  const [ruleCategoryId, setRuleCategoryId] = useState<number>(0);
  const [ruleDifficulty, setRuleDifficulty] = useState<string>('');
  const [ruleCount, setRuleCount] = useState<number>(5);

  const [formData, setFormData] = useState({
    quiz_name: '',
    description: '',
    duration: 45,
    min_pass_percentage: 50,
    max_attempt: 10,
    start_datetime: new Date().toISOString().slice(0, 16),
    end_datetime: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
    gids: '1',
    correct_score: '1',
    incorrect_score: '0',
    shuffle_questions: 0,
    shuffle_options: 0,
    quiz_password: '',
    anti_cheating: 0,
    max_tab_switches: 3,
  });

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const res = isStaff
        ? await quizApi.getList({ limit: page * pageSize, maxRowsPerPage: pageSize, search })
        : await quizApi.getMyList({ limit: page * pageSize, maxRowsPerPage: pageSize, search });
      if (res.status === 'success' && res.data) {
        setQuizzes(res.data);
      } else {
        setQuizzes([]);
      }
    } catch {
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await userApi.getGroupList();
      if (res.status === 'success' && res.data) {
        setGroups(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await qbankApi.getCategoryList();
      if (res.status === 'success' && res.data) {
        setCategories(res.data);
        if (res.data.length > 0 && !ruleCategoryId) {
          setRuleCategoryId(res.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchQuizzes();
    if (isStaff) {
      fetchGroups();
      fetchCategories();
    }
  }, [page, search, isStaff]);

  const handleOpenAdd = () => {
    setFormData({
      quiz_name: '',
      description: '',
      duration: 45,
      min_pass_percentage: 50,
      max_attempt: 10,
      start_datetime: new Date().toISOString().slice(0, 16),
      end_datetime: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
      gids: String(groups[0]?.id || '1'),
      correct_score: '1',
      incorrect_score: '0',
      shuffle_questions: 0,
      shuffle_options: 0,
      quiz_password: '',
      anti_cheating: 0,
      max_tab_switches: 3,
    });
    setQuizMode('manual');
    setMatrixRules([]);
    if (categories.length > 0) setRuleCategoryId(categories[0].id);
    setRuleDifficulty('');
    setRuleCount(5);
    setFormError('');
    setIsAddOpen(true);
  };

  const handleOpenEdit = (q: Quiz) => {
    setSelectedQuiz(q);
    setFormData({
      quiz_name: q.quiz_name,
      description: q.description || '',
      duration: q.duration || 45,
      min_pass_percentage: q.min_pass_percentage || 50,
      max_attempt: q.max_attempt || 10,
      start_datetime: new Date(typeof q.start_datetime === 'number' ? q.start_datetime * 1000 : q.start_datetime)
        .toISOString()
        .slice(0, 16),
      end_datetime: new Date(typeof q.end_datetime === 'number' ? q.end_datetime * 1000 : q.end_datetime)
        .toISOString()
        .slice(0, 16),
      gids: q.gids || '1',
      correct_score: q.correct_score || '1',
      incorrect_score: q.incorrect_score || '0',
      shuffle_questions: q.shuffle_questions ? 1 : 0,
      shuffle_options: q.shuffle_options ? 1 : 0,
      quiz_password: q.quiz_password || '',
      anti_cheating: q.anti_cheating ? 1 : 0,
      max_tab_switches: q.max_tab_switches || 3,
    });

    let parsedRules: MatrixRule[] = [];
    if (q.matrix_config) {
      try {
        const parsed = typeof q.matrix_config === 'string' ? JSON.parse(q.matrix_config) : q.matrix_config;
        if (Array.isArray(parsed)) parsedRules = parsed;
      } catch (e) {
        parsedRules = [];
      }
    }
    setQuizMode(parsedRules.length > 0 ? 'matrix' : 'manual');
    setMatrixRules(parsedRules);
    if (categories.length > 0) setRuleCategoryId(categories[0].id);
    setRuleDifficulty('');
    setRuleCount(5);
    setFormError('');
    setIsEditOpen(true);
  };

  const handleAddMatrixRule = () => {
    if (!ruleCategoryId) return;
    const cat = categories.find((c) => c.id === ruleCategoryId);
    const newRule: MatrixRule = {
      category_id: ruleCategoryId,
      category_name: cat?.category_name || `Danh mục #${ruleCategoryId}`,
      difficulty: ruleDifficulty || undefined,
      count: Math.max(1, Number(ruleCount) || 1),
    };
    setMatrixRules([...matrixRules, newRule]);
  };

  const handleRemoveMatrixRule = (idx: number) => {
    setMatrixRules(matrixRules.filter((_, i) => i !== idx));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const payload = {
        ...formData,
        matrix_config: quizMode === 'matrix' ? JSON.stringify(matrixRules) : '',
      };
      const res = await quizApi.addQuiz(payload);
      if (res.status === 'success') {
        setIsAddOpen(false);
        fetchQuizzes();
      } else {
        setFormError(res.message || 'Không thể tạo bài thi');
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi kết nối máy chủ');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz) return;
    setFormError('');
    try {
      const payload = {
        ...formData,
        matrix_config: quizMode === 'matrix' ? JSON.stringify(matrixRules) : '',
      };
      const res = await quizApi.editQuiz(selectedQuiz.id, payload);
      if (res.status === 'success') {
        setIsEditOpen(false);
        fetchQuizzes();
      } else {
        setFormError(res.message || 'Không thể cập nhật bài thi');
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi kết nối máy chủ');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await quizApi.remove(deleteId);
      setDeleteId(null);
      fetchQuizzes();
    } catch (e) {
      console.error(e);
    }
  };

  // Assign questions handler
  const handleOpenAssign = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setIsAssignOpen(true);
    setAssignLoading(true);
    setAssignSelectedCategory('all');
    setAssignSearch('');
    setAssignFilterStatus('all');

    try {
      const [qRes, catRes] = await Promise.all([
        qbankApi.getList({ limit: 0, maxRowsPerPage: 1000 }),
        qbankApi.getCategoryList(),
      ]);

      if (qRes.status === 'success' && qRes.data) {
        setAvailableQuestions(qRes.data);
      }
      if (catRes.status === 'success' && catRes.data) {
        setCategories(catRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAssignLoading(false);
    }
  };

  const assignedQidsSet = useMemo(() => {
    if (!selectedQuiz?.qids) return new Set<string>();
    return new Set(selectedQuiz.qids.split(',').filter(Boolean));
  }, [selectedQuiz?.qids]);

  const handleToggleQuestionInQuiz = async (qid: number) => {
    if (!selectedQuiz) return;
    const currentQids = selectedQuiz.qids ? selectedQuiz.qids.split(',').filter(Boolean) : [];
    const isAssigned = currentQids.includes(String(qid));
    const nextQids = isAssigned
      ? currentQids.filter((id) => id !== String(qid))
      : [...currentQids, String(qid)];

    // Optimistic UI update
    setSelectedQuiz({ ...selectedQuiz, qids: nextQids.join(',') });

    try {
      if (isAssigned) {
        await quizApi.removeQuestionIntoQuiz(selectedQuiz.id, qid);
      } else {
        await quizApi.addQuestionIntoQuiz(selectedQuiz.id, qid);
      }
      fetchQuizzes();
    } catch (e) {
      console.error(e);
      setSelectedQuiz({ ...selectedQuiz, qids: currentQids.join(',') });
    }
  };

  const handleSelectAllInView = async (questionsToSelect: Question[]) => {
    if (!selectedQuiz || questionsToSelect.length === 0) return;
    setBatchUpdating(true);
    const currentQids = selectedQuiz.qids ? selectedQuiz.qids.split(',').filter(Boolean) : [];
    const newIds = questionsToSelect.map((q) => String(q.id));
    const merged = Array.from(new Set([...currentQids, ...newIds]));

    setSelectedQuiz({ ...selectedQuiz, qids: merged.join(',') });
    try {
      await quizApi.assignQuestions(selectedQuiz.id, merged);
      fetchQuizzes();
    } catch (e) {
      console.error(e);
      setSelectedQuiz({ ...selectedQuiz, qids: currentQids.join(',') });
    } finally {
      setBatchUpdating(false);
    }
  };

  const handleDeselectAllInView = async (questionsToDeselect: Question[]) => {
    if (!selectedQuiz || questionsToDeselect.length === 0) return;
    setBatchUpdating(true);
    const currentQids = selectedQuiz.qids ? selectedQuiz.qids.split(',').filter(Boolean) : [];
    const removeIds = new Set(questionsToDeselect.map((q) => String(q.id)));
    const remaining = currentQids.filter((id) => !removeIds.has(id));

    setSelectedQuiz({ ...selectedQuiz, qids: remaining.join(',') });
    try {
      await quizApi.assignQuestions(selectedQuiz.id, remaining);
      fetchQuizzes();
    } catch (e) {
      console.error(e);
      setSelectedQuiz({ ...selectedQuiz, qids: currentQids.join(',') });
    } finally {
      setBatchUpdating(false);
    }
  };

  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; assigned: number }> = {
      all: { total: availableQuestions.length, assigned: 0 },
    };

    categories.forEach((c) => {
      stats[String(c.id)] = { total: 0, assigned: 0 };
    });

    availableQuestions.forEach((q) => {
      const isAssigned = assignedQidsSet.has(String(q.id));
      if (isAssigned) {
        stats.all.assigned += 1;
      }
      const catKey = String(q.category_ids);
      if (!stats[catKey]) {
        stats[catKey] = { total: 0, assigned: 0 };
      }
      stats[catKey].total += 1;
      if (isAssigned) {
        stats[catKey].assigned += 1;
      }
    });

    return stats;
  }, [availableQuestions, categories, assignedQidsSet]);

  const filteredQuestions = useMemo(() => {
    return availableQuestions.filter((q) => {
      // Category filter
      if (assignSelectedCategory !== 'all' && q.category_ids !== assignSelectedCategory) {
        return false;
      }
      // Status filter
      const isAssigned = assignedQidsSet.has(String(q.id));
      if (assignFilterStatus === 'assigned' && !isAssigned) return false;
      if (assignFilterStatus === 'unassigned' && isAssigned) return false;

      // Search filter
      if (assignSearch.trim()) {
        const kw = assignSearch.toLowerCase();
        const matchText = (q.question || '').toLowerCase().includes(kw);
        const matchDesc = (q.description || '').toLowerCase().includes(kw);
        const matchCat = (q.category_name || '').toLowerCase().includes(kw);
        const matchId = String(q.id).includes(kw);
        if (!matchText && !matchDesc && !matchCat && !matchId) return false;
      }

      return true;
    });
  }, [availableQuestions, assignSelectedCategory, assignFilterStatus, assignSearch, assignedQidsSet]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 m-0">
            <BookOpen className="h-7 w-7 text-indigo-600" />
            Quản lý Bài thi
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tham gia các kỳ thi trắc nghiệm hoặc quản lý, gán câu hỏi cho từng đề thi
          </p>
        </div>
        {isStaff && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-all"
          >
            <Plus className="h-4 w-4" /> Tạo bài thi mới
          </button>
        )}
      </div>

      {/* Search & Grid */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Tìm theo tên bài thi..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Đang tải danh sách bài thi...</div>
      ) : quizzes.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white border border-slate-200/80 p-8 dark:bg-slate-900 dark:border-slate-800 text-slate-400">
          Chưa có bài thi nào khả dụng.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quizzes.map((quiz) => {
            let questionDisplay = '';
            let isMatrix = false;
            if (quiz.matrix_config) {
              try {
                const parsed = typeof quiz.matrix_config === 'string' ? JSON.parse(quiz.matrix_config) : quiz.matrix_config;
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const totalMatrix = parsed.reduce((sum: number, r: any) => sum + (Number(r.count) || 0), 0);
                  questionDisplay = `${totalMatrix} câu (Ma trận)`;
                  isMatrix = true;
                }
              } catch (e) {
                // ignore
              }
            }
            if (!questionDisplay) {
              const count = quiz.qids ? quiz.qids.split(',').filter(Boolean).length : 0;
              questionDisplay = `${count} câu`;
            }

            return (
              <div
                key={quiz.id}
                className="flex flex-col justify-between rounded-3xl bg-white p-6 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all dark:bg-slate-900 dark:border-slate-800"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      MÃ ĐỀ #{quiz.id}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Clock className="h-3.5 w-3.5 text-indigo-500" /> {quiz.duration} phút
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {quiz.quiz_name}
                  </h3>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {quiz.description || 'Không có mô tả chi tiết'}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-950/50">
                      <span className="text-slate-400 block text-xs">Số câu hỏi</span>
                      <strong className="text-slate-900 dark:text-white">{questionDisplay}</strong>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-950/50">
                      <span className="text-slate-400 block text-xs">Điểm đạt tối thiểu</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{quiz.min_pass_percentage}%</strong>
                    </div>
                  </div>

                  {/* Feature Badges */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {isMatrix && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                        <Sparkles className="h-3 w-3" /> Đề ma trận
                      </span>
                    )}
                    {Boolean(quiz.quiz_password) && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                        <Lock className="h-3 w-3" /> Có mật khẩu
                      </span>
                    )}
                    {Boolean(quiz.anti_cheating) && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                        <ShieldAlert className="h-3 w-3" /> Chống gian lận ({quiz.max_tab_switches || 3} lần)
                      </span>
                    )}
                    {Boolean(quiz.shuffle_questions) && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                        <Shuffle className="h-3 w-3" /> Đảo câu hỏi
                      </span>
                    )}
                    {Boolean(quiz.shuffle_options) && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                        <Shuffle className="h-3 w-3" /> Đảo đáp án
                      </span>
                    )}
                  </div>

                  {/* Schedule time */}
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>
                      {new Date(typeof quiz.start_datetime === 'number' ? quiz.start_datetime * 1000 : quiz.start_datetime).toLocaleDateString('vi-VN')}
                      {' - '}
                      {new Date(typeof quiz.end_datetime === 'number' ? quiz.end_datetime * 1000 : quiz.end_datetime).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  {/* Group tags */}
                  {quiz.gids && groups.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {quiz.gids.split(',').filter(Boolean).map((gid) => {
                        const grp = groups.find(g => String(g.id) === gid.trim());
                        return grp ? (
                          <span key={gid} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Layers className="h-3 w-3" /> {grp.group_name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <Link
                    to={`/quiz/attempt/${quiz.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 px-4 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-all"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" /> Làm bài thi
                  </Link>

                  {isStaff && (
                    <div className="flex items-center gap-1">
                      {!isMatrix && (
                        <button
                          onClick={() => handleOpenAssign(quiz)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900 transition-colors"
                          title="Thêm / bớt câu hỏi trong đề thi này"
                        >
                          <ListPlus className="h-4 w-4 shrink-0" />
                          <span>Gán câu hỏi ({quiz.qids ? quiz.qids.split(',').filter(Boolean).length : 0})</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(quiz)}
                        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800"
                        title="Chỉnh sửa bài thi"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(quiz.id)}
                        className="rounded-xl p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/50"
                        title="Xóa đề thi"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination
        currentPage={page}
        pageSize={pageSize}
        onPageChange={setPage}
        hasMore={quizzes.length >= pageSize}
      />

      {/* Add / Edit Quiz Modal */}
      <Modal
        isOpen={isAddOpen || isEditOpen}
        onClose={() => {
          setIsAddOpen(false);
          setIsEditOpen(false);
        }}
        title={isAddOpen ? 'Tạo đề thi mới' : 'Chỉnh sửa bài thi'}
        maxWidth="2xl"
      >
        <form onSubmit={isAddOpen ? handleAddSubmit : handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-100 dark:border-rose-900/50">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Tên bài thi
            </label>
            <input
              type="text"
              required
              value={formData.quiz_name}
              onChange={(e) => setFormData({ ...formData, quiz_name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Mô tả ngắn
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Thời gian làm bài (Phút)
              </label>
              <input
                type="number"
                min={1}
                required
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Điểm đạt tối thiểu (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                required
                value={formData.min_pass_percentage}
                onChange={(e) => setFormData({ ...formData, min_pass_percentage: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Số lần thi tối đa
              </label>
              <input
                type="number"
                min={1}
                required
                value={formData.max_attempt}
                onChange={(e) => setFormData({ ...formData, max_attempt: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Thời gian bắt đầu
              </label>
              <input
                type="datetime-local"
                required
                value={formData.start_datetime}
                onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Thời gian kết thúc
              </label>
              <input
                type="datetime-local"
                required
                value={formData.end_datetime}
                onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          {/* Groups selection */}
          {groups.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-2">
                Nhóm được phép tham gia thi
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {groups.map((g) => {
                  const selectedGids = formData.gids ? formData.gids.split(',').map(s => s.trim()) : [];
                  const isChecked = selectedGids.includes(String(g.id));
                  return (
                    <label
                      key={g.id}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-colors text-xs ${
                        isChecked
                          ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                          : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-950/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const prev = formData.gids ? formData.gids.split(',').map(s => s.trim()).filter(Boolean) : [];
                          let next: string[];
                          if (e.target.checked) {
                            next = [...prev, String(g.id)];
                          } else {
                            next = prev.filter(id => id !== String(g.id));
                          }
                          setFormData({ ...formData, gids: next.join(',') || String(g.id) });
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className={`font-semibold truncate ${isChecked ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {g.group_name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bảo mật phòng thi & Chống gian lận */}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-4 dark:border-rose-950 dark:bg-rose-950/20 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              Bảo mật phòng thi & Chế độ chống gian lận (Exam Integrity Monitor)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Key className="h-3.5 w-3.5 text-amber-500" /> Mật khẩu / Mã PIN phòng thi
                </label>
                <input
                  type="text"
                  placeholder="Để trống nếu không yêu cầu mật khẩu"
                  value={formData.quiz_password}
                  onChange={(e) => setFormData({ ...formData, quiz_password: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Giới hạn vi phạm chuyển tab
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  disabled={!formData.anti_cheating}
                  value={formData.max_tab_switches}
                  onChange={(e) => setFormData({ ...formData, max_tab_switches: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/60 dark:border-rose-900/50 cursor-pointer hover:border-rose-400 transition-colors">
              <input
                type="checkbox"
                checked={Boolean(formData.anti_cheating)}
                onChange={(e) => setFormData({ ...formData, anti_cheating: e.target.checked ? 1 : 0 })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Bật chế độ Giám sát chống gian lận (Anti-Cheating Monitor)
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                  Theo dõi chuyển tab, mất tiêu điểm hoặc rời màn hình. Hệ thống sẽ cảnh báo và tự động thu hồi/nộp bài ngay khi đạt số lần vi phạm cho phép.
                </span>
              </div>
            </label>
          </div>

          {/* Hình thức tạo đề thi: Cố định vs Ma trận ngẫu nhiên */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-950 dark:bg-indigo-950/20 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Phương thức phân phối câu hỏi
              </div>
              <div className="flex bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setQuizMode('manual')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    quizMode === 'manual'
                      ? 'bg-white text-indigo-700 shadow-xs dark:bg-indigo-600 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Cố định (Chọn danh sách)
                </button>
                <button
                  type="button"
                  onClick={() => setQuizMode('matrix')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    quizMode === 'matrix'
                      ? 'bg-white text-indigo-700 shadow-xs dark:bg-indigo-600 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Ma trận ngẫu nhiên (Matrix)
                </button>
              </div>
            </div>

            {quizMode === 'manual' ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-white/70 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
                Đề thi sẽ sử dụng danh sách câu hỏi cố định do bạn gán thủ công từ ngân hàng câu hỏi (nhấn nút "Gán câu hỏi" ngoài danh sách bài thi).
              </p>
            ) : (
              <div className="space-y-3 bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-xl border border-indigo-200/70 dark:border-indigo-900/50">
                <div className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                  Thiết lập tỷ lệ bốc ngẫu nhiên câu hỏi theo từng Danh mục và Mức độ khó:
                </div>

                {/* Form to add a rule */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Danh mục
                    </label>
                    <select
                      value={ruleCategoryId}
                      onChange={(e) => setRuleCategoryId(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.category_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Độ khó
                    </label>
                    <select
                      value={ruleDifficulty}
                      onChange={(e) => setRuleDifficulty(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">Tất cả mức độ</option>
                      <option value="Nhận biết">Nhận biết</option>
                      <option value="Thông hiểu">Thông hiểu</option>
                      <option value="Vận dụng">Vận dụng</option>
                      <option value="Vận dụng cao">Vận dụng cao</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3 flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Số câu
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={ruleCount}
                        onChange={(e) => setRuleCount(Math.max(1, Number(e.target.value)))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMatrixRule}
                      className="self-end rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 shrink-0"
                    >
                      + Thêm
                    </button>
                  </div>
                </div>

                {/* List of current matrix rules */}
                {matrixRules.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400 italic">
                    Chưa có quy tắc ma trận nào. Vui lòng thêm ít nhất một quy tắc.
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>Các quy tắc ma trận đã lập ({matrixRules.length}):</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        Tổng: {matrixRules.reduce((sum, r) => sum + (Number(r.count) || 0), 0)} câu hỏi
                      </span>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {matrixRules.map((rule, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {rule.category_name}
                            </span>
                            {rule.difficulty ? (
                              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                {rule.difficulty}
                              </span>
                            ) : (
                              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                Mọi mức độ
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {rule.count} câu
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMatrixRule(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cấu hình xáo trộn / trộn đề */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-950 dark:bg-indigo-950/20 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <Shuffle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Cấu hình xáo trộn đề thi
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:border-indigo-300 transition-colors">
                <input
                  type="checkbox"
                  checked={Boolean(formData.shuffle_questions)}
                  onChange={(e) => setFormData({ ...formData, shuffle_questions: e.target.checked ? 1 : 0 })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Xáo trộn thứ tự câu hỏi
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    Mỗi thí sinh khi vào thi sẽ nhận được câu hỏi xếp theo thứ tự ngẫu nhiên.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:border-indigo-300 transition-colors">
                <input
                  type="checkbox"
                  checked={Boolean(formData.shuffle_options)}
                  onChange={(e) => setFormData({ ...formData, shuffle_options: e.target.checked ? 1 : 0 })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Xáo trộn thứ tự đáp án
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    Đảo ngẫu nhiên vị trí các lựa chọn (A, B, C, D) trong từng câu hỏi.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsAddOpen(false);
                setIsEditOpen(false);
              }}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-indigo-500"
            >
              {isAddOpen ? 'Tạo bài thi' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Questions Modal */}
      <Modal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        title={`Gán câu hỏi vào bài thi: ${selectedQuiz?.quiz_name || ''}`}
        maxWidth="5xl"
      >
        <div className="space-y-4">
          {/* Top Banner with Quiz Info & Instructions */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200/80 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                Chọn các câu hỏi theo từng danh mục dưới đây để đưa vào đề thi.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-500 dark:text-slate-400">Đã chọn:</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {assignedQidsSet.size} câu hỏi
              </span>
            </div>
          </div>

          {/* Main 2-Column Split Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left: Category Selector Sidebar */}
            <div className="md:col-span-4 flex flex-col space-y-2 border-r md:pr-4 border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Danh mục ({categories.length})
                </span>
                <span className="text-[11px] font-medium text-slate-400">Đã gán / Tổng</span>
              </div>

              <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
                {/* All Categories Option */}
                <button
                  type="button"
                  onClick={() => setAssignSelectedCategory('all')}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs text-left transition-all ${
                    assignSelectedCategory === 'all'
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Layers className="h-4 w-4 shrink-0" />
                    <span className="truncate">Tất cả danh mục</span>
                  </div>
                  <span
                    className={`ml-2 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                      assignSelectedCategory === 'all'
                        ? 'bg-indigo-700/60 text-white'
                        : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {categoryStats.all?.assigned || 0}/{categoryStats.all?.total || 0}
                  </span>
                </button>

                {/* Individual Categories */}
                {categories.map((cat) => {
                  const stat = categoryStats[String(cat.id)] || { total: 0, assigned: 0 };
                  const isSelected = assignSelectedCategory === cat.id;
                  const pct = stat.total > 0 ? Math.round((stat.assigned / stat.total) * 100) : 0;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAssignSelectedCategory(cat.id)}
                      className={`w-full flex flex-col gap-1.5 rounded-xl px-3 py-2.5 text-xs text-left transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 truncate">
                          <Folder className="h-4 w-4 shrink-0" />
                          <span className="truncate">{cat.category_name}</span>
                        </div>
                        <span
                          className={`ml-2 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                            isSelected
                              ? 'bg-indigo-700/60 text-white'
                              : stat.assigned > 0
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {stat.assigned}/{stat.total}
                        </span>
                      </div>

                      {/* Mini progress bar */}
                      <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isSelected ? 'bg-white/80' : 'bg-indigo-500 dark:bg-indigo-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Batch Actions for Current Selection */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Thao tác nhanh ({filteredQuestions.length} câu)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={batchUpdating || filteredQuestions.length === 0}
                    onClick={() => handleSelectAllInView(filteredQuestions)}
                    className="flex items-center justify-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 px-2 py-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-colors"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    disabled={batchUpdating || filteredQuestions.length === 0}
                    onClick={() => handleDeselectAllInView(filteredQuestions)}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Question List with Filter Toolbar */}
            <div className="md:col-span-8 flex flex-col space-y-3">
              {/* Filter and Search Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    placeholder="Tìm theo nội dung, ID..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                  {assignSearch && (
                    <button
                      type="button"
                      onClick={() => setAssignSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1 self-start sm:self-auto bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  <button
                    type="button"
                    onClick={() => setAssignFilterStatus('all')}
                    className={`rounded-lg px-2.5 py-1 transition-all ${
                      assignFilterStatus === 'all'
                        ? 'bg-white dark:bg-slate-700 font-bold text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignFilterStatus('assigned')}
                    className={`rounded-lg px-2.5 py-1 transition-all ${
                      assignFilterStatus === 'assigned'
                        ? 'bg-white dark:bg-slate-700 font-bold text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Đã chọn
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignFilterStatus('unassigned')}
                    className={`rounded-lg px-2.5 py-1 transition-all ${
                      assignFilterStatus === 'unassigned'
                        ? 'bg-white dark:bg-slate-700 font-bold text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Chưa chọn
                  </button>
                </div>
              </div>

              {/* Question Items List */}
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 border rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {assignLoading ? (
                  <div className="p-12 text-center text-slate-400 text-xs">Đang tải danh sách câu hỏi...</div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs space-y-1">
                    <p className="font-semibold">Không tìm thấy câu hỏi phù hợp</p>
                    <p className="text-slate-500">Hãy thử đổi danh mục hoặc từ khóa tìm kiếm.</p>
                  </div>
                ) : (
                  filteredQuestions.map((q) => {
                    const isSelected = assignedQidsSet.has(String(q.id));
                    return (
                      <div
                        key={q.id}
                        onClick={() => handleToggleQuestionInQuiz(q.id)}
                        className={`flex items-start gap-3 p-3.5 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-l-4 border-transparent'
                        }`}
                      >
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border mt-0.5 transition-all ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                              : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <span className="font-mono text-[11px] font-bold text-slate-400">#{q.id}</span>
                            {q.category_name && (
                              <span className="rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-semibold">
                                {q.category_name}
                              </span>
                            )}
                            <span className="rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 text-[10px]">
                              {q.question_type}
                            </span>
                            {isSelected && (
                              <span className="ml-auto rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                                Đã đưa vào bài thi
                              </span>
                            )}
                          </div>
                          <MathRenderer content={q.question} className="text-xs text-slate-800 dark:text-slate-200 line-clamp-3" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Tổng số câu hỏi trong bài thi:{' '}
              <strong className="text-indigo-600 dark:text-indigo-400 text-sm font-bold">
                {assignedQidsSet.size}
              </strong>{' '}
              câu
            </div>
            <button
              type="button"
              onClick={() => {
                setIsAssignOpen(false);
                fetchQuizzes();
              }}
              className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 transition-colors cursor-pointer"
            >
              Hoàn tất
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Bạn có chắc chắn muốn xóa bài thi này?"
      />
    </div>
  );
};
