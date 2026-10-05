import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Search,
  Plus,
  Trash2,
  Edit2,
  FolderTree,
  CheckCircle2,
  Eye,
  AlertCircle,
  PlusCircle,
  MinusCircle,
  Image,
  Volume2,
  Upload,
  X,
  Sparkles,
  ArrowRightLeft,
} from 'lucide-react';
import { qbankApi } from '../../api/qbankApi';
import type { Question, Category, QuestionType, QuestionOption, DifficultyLevel, QuestionTypeItem } from '../../types';
import { MathRenderer } from '../../components/Math/MathRenderer';
import { TinyMceEditor } from '../../components/Editor/TinyMceEditor';
import { Modal } from '../../components/Common/Modal';
import { ConfirmModal } from '../../components/Common/ConfirmModal';
import { Pagination } from '../../components/Common/Pagination';
import { formatMediaUrl, isAudioMedia, parseMatchPair } from '../../utils/media';

export const QuestionBankPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questionTypes, setQuestionTypes] = useState<QuestionTypeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [page, setPage] = useState(0);
  const pageSize = 15;

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  // Form State
  const [formCategory, setFormCategory] = useState<number>(1);
  const [formType, setFormType] = useState<QuestionType>('Multiple Choice Single Answer');
  const [formDifficulty, setFormDifficulty] = useState<DifficultyLevel>('Thông hiểu');
  const [formText, setFormText] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMediaUrl, setFormMediaUrl] = useState('');
  const [formMediaType, setFormMediaType] = useState<'image' | 'audio' | ''>('');
  const [isUploading, setIsUploading] = useState(false);
  const [formOptions, setFormOptions] = useState<
    { id?: number; option: string; score: number }[]
  >([
    { option: '', score: 1 },
    { option: '', score: 0 },
    { option: '', score: 0 },
    { option: '', score: 0 },
  ]);

  const fetchCategories = async () => {
    try {
      const res = await qbankApi.getCategoryList();
      if (res.status === 'success' && res.data) {
        setCategories(res.data);
        if (res.data.length > 0 && !formCategory) {
          setFormCategory(res.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await qbankApi.getList({
        limit: page * pageSize,
        maxRowsPerPage: pageSize,
        search,
        cid: selectedCategory,
        difficulty_level: selectedDifficulty,
      });
      if (res.status === 'success' && res.data) {
        setQuestions(res.data);
      } else {
        setQuestions([]);
      }
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestionTypes = async () => {
    try {
      const res = await qbankApi.getQuestionTypeList();
      if (res.status === 'success' && res.data) {
        setQuestionTypes(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchQuestionTypes();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [page, search, selectedCategory, selectedDifficulty]);

  const handleOpenAdd = () => {
    setFormCategory(categories[0]?.id || 1);
    setFormType('Multiple Choice Single Answer');
    setFormDifficulty('Thông hiểu');
    setFormText('');
    setFormDesc('');
    setFormMediaUrl('');
    setFormMediaType('');
    setFormOptions([
      { option: '', score: 1 },
      { option: '', score: 0 },
      { option: '', score: 0 },
      { option: '', score: 0 },
    ]);
    setFormError('');
    setIsAddOpen(true);
  };

  const handleOpenEdit = async (q: Question) => {
    setSelectedQuestionId(q.id);
    setFormError('');
    try {
      const detail = await qbankApi.getQuestion(q.id);
      if (detail.status === 'success') {
        const rawData = detail.data as any;
        const qObj = rawData?.question && typeof rawData.question === 'object' ? rawData.question : rawData;
        const qText = typeof qObj?.question === 'string' ? qObj.question : q.question;

        setFormCategory(qObj?.category_ids || q.category_ids);
        setFormType(qObj?.question_type || q.question_type);
        setFormDifficulty((qObj?.difficulty_level || q.difficulty_level || 'Thông hiểu') as DifficultyLevel);
        setFormText(qText);
        setFormDesc(qObj?.description || '');
        setFormMediaUrl(qObj?.media_url || q.media_url || '');
        setFormMediaType((qObj?.media_type || q.media_type || '') as any);

        const opts = detail.options || rawData?.options;
        if (opts && opts.length > 0) {
          setFormOptions(
            opts.map((opt: QuestionOption) => ({
              id: opt.id,
              option: opt.question_option,
              score: opt.score || 0,
            }))
          );
        } else {
          setFormOptions([
            { option: '', score: 1 },
            { option: '', score: 0 },
          ]);
        }
        setIsEditOpen(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenPreview = async (q: Question) => {
    setPreviewQuestion(q);
    if (!q.options || q.options.length === 0) {
      try {
        const detail = await qbankApi.getQuestion(q.id);
        if (detail.status === 'success') {
          const rawData = detail.data as any;
          const qObj = rawData?.question && typeof rawData.question === 'object' ? rawData.question : rawData;
          const opts = detail.options || rawData?.options || [];
          setPreviewQuestion((prev) => {
            if (!prev || prev.id !== q.id) return prev;
            return {
              ...prev,
              ...(typeof qObj === 'object' ? qObj : {}),
              options: opts.map((opt: any) => ({
                id: opt.id,
                question_id: opt.question_id,
                question_option: opt.question_option,
                score: opt.score,
              })),
            };
          });
        }
      } catch (err) {
        console.error('Error fetching question preview options:', err);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setFormError('');
    try {
      const res = await qbankApi.uploadMedia(file);
      if (res.status === 'success' && res.data) {
        setFormMediaUrl(res.data.url);
        setFormMediaType(res.data.media_type as any);
      } else {
        setFormError(res.message || 'Lỗi khi tải file lên');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi kết nối khi tải file đa phương tiện';
      setFormError(msg);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleTypeChange = (newType: QuestionType) => {
    setFormType(newType);
    if (newType === 'True / False') {
      setFormOptions([
        { option: 'Đúng', score: 1 },
        { option: 'Sai', score: 0 },
      ]);
    } else if (newType === 'Short Answer' || newType === 'Long Answer') {
      setFormOptions([
        { option: formOptions[0]?.option || '', score: 1 },
      ]);
    } else if (
      newType === 'Match / Ordering' ||
      String(newType) === '5' ||
      String(newType).toLowerCase().includes('match') ||
      String(newType).toLowerCase().includes('nối')
    ) {
      setFormOptions([
        { option: ' ::: ', score: 1 },
        { option: ' ::: ', score: 1 },
        { option: ' ::: ', score: 1 },
      ]);
    } else if (formOptions.length < 2) {
      setFormOptions([
        { option: '', score: 1 },
        { option: '', score: 0 },
        { option: '', score: 0 },
        { option: '', score: 0 },
      ]);
    }
  };

  const handleMatchLeftChange = (idx: number, leftVal: string) => {
    const updated = [...formOptions];
    const pair = parseMatchPair(updated[idx]?.option || '');
    updated[idx] = {
      ...updated[idx],
      option: `${leftVal} ::: ${pair.right}`,
      score: 1,
    };
    setFormOptions(updated);
  };

  const handleMatchRightChange = (idx: number, rightVal: string) => {
    const updated = [...formOptions];
    const pair = parseMatchPair(updated[idx]?.option || '');
    updated[idx] = {
      ...updated[idx],
      option: `${pair.left} ::: ${rightVal}`,
      score: 1,
    };
    setFormOptions(updated);
  };

  const handleAddOption = () => {
    setFormOptions([...formOptions, { option: '', score: 0 }]);
  };

  const handleRemoveOption = (index: number) => {
    setFormOptions(formOptions.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, text: string) => {
    const updated = [...formOptions];
    updated[index].option = text;
    setFormOptions(updated);
  };

  const handleScoreChange = (index: number, score: number) => {
    const updated = [...formOptions];
    if (formType === 'Multiple Choice Single Answer' || formType === 'True / False') {
      // For single choice, reset all other options to 0 score
      updated.forEach((opt, i) => {
        opt.score = i === index ? 1 : 0;
      });
    } else {
      updated[index].score = score;
    }
    setFormOptions(updated);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const isMatch =
      formType === 'Match / Ordering' ||
      String(formType) === '5' ||
      String(formType).toLowerCase().includes('match') ||
      String(formType).toLowerCase().includes('nối');

    if (isMatch) {
      const validPairs = formOptions
        .map((o) => parseMatchPair(o.option))
        .filter((p) => p.left.trim() && p.right.trim());
      if (validPairs.length < 2) {
        setFormError('Vui lòng nhập đầy đủ ít nhất 2 cặp nối (cả vế A và vế B).');
        return;
      }
    }

    try {
      const res = await qbankApi.addQuestion({
        category_ids: formCategory,
        question_type: formType,
        question: formText,
        description: formDesc,
        difficulty_level: formDifficulty,
        media_url: formMediaUrl,
        media_type: formMediaType,
        options: formOptions,
      });
      if (res.status === 'success') {
        setIsAddOpen(false);
        fetchQuestions();
      } else {
        setFormError(res.message || 'Không thể tạo câu hỏi');
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi kết nối máy chủ');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuestionId) return;
    setFormError('');

    const isMatch =
      formType === 'Match / Ordering' ||
      String(formType) === '5' ||
      String(formType).toLowerCase().includes('match') ||
      String(formType).toLowerCase().includes('nối');

    if (isMatch) {
      const validPairs = formOptions
        .map((o) => parseMatchPair(o.option))
        .filter((p) => p.left.trim() && p.right.trim());
      if (validPairs.length < 2) {
        setFormError('Vui lòng nhập đầy đủ ít nhất 2 cặp nối (cả vế A và vế B).');
        return;
      }
    }

    try {
      const res = await qbankApi.editQuestion(selectedQuestionId, {
        category_ids: formCategory,
        question_type: formType,
        question: formText,
        description: formDesc,
        difficulty_level: formDifficulty,
        media_url: formMediaUrl,
        media_type: formMediaType,
        options: formOptions,
      });
      if (res.status === 'success') {
        setIsEditOpen(false);
        fetchQuestions();
      } else {
        setFormError(res.message || 'Không thể cập nhật câu hỏi');
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi kết nối máy chủ');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await qbankApi.remove(deleteId);
      setDeleteId(null);
      fetchQuestions();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 m-0">
            <HelpCircle className="h-7 w-7 text-indigo-600" />
            Ngân hàng Câu hỏi
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quản lý, tạo mới và phân loại ngân hàng câu hỏi trắc nghiệm & công thức toán
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-all"
        >
          <Plus className="h-4 w-4" /> Thêm câu hỏi
        </button>
      </div>

      {/* Filter and Table */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Tìm kiếm nội dung câu hỏi..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <FolderTree className="h-4 w-4 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(0);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                <option value="">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-slate-400" />
              <select
                value={selectedDifficulty}
                onChange={(e) => {
                  setSelectedDifficulty(e.target.value);
                  setPage(0);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                <option value="">Tất cả mức độ</option>
                <option value="Nhận biết">Nhận biết</option>
                <option value="Thông hiểu">Thông hiểu</option>
                <option value="Vận dụng">Vận dụng</option>
                <option value="Vận dụng cao">Vận dụng cao</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50/75 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:bg-slate-950/50 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5">ID</th>
                <th className="px-6 py-3.5">Nội dung câu hỏi</th>
                <th className="px-6 py-3.5">Loại câu hỏi</th>
                <th className="px-6 py-3.5">Mức độ</th>
                <th className="px-6 py-3.5">Danh mục</th>
                <th className="px-6 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Đang tải danh sách câu hỏi...
                  </td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Không tìm thấy câu hỏi nào.
                  </td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400">
                      #{q.id}
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <div className="space-y-1.5">
                        <div className="line-clamp-2">
                          <MathRenderer content={q.question} />
                        </div>
                        {q.media_url && (
                          <div className="flex flex-col gap-1.5 pt-1">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
                                {isAudioMedia(q.media_url, q.media_type) ? <Volume2 className="h-3 w-3" /> : <Image className="h-3 w-3" />}
                                {isAudioMedia(q.media_url, q.media_type) ? 'File Audio' : 'Hình ảnh'}
                              </span>
                            </div>
                            {isAudioMedia(q.media_url, q.media_type) && (
                              <audio
                                controls
                                preload="none"
                                src={formatMediaUrl(q.media_url)}
                                className="h-7 w-64 max-w-full"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        {q.question_type_name || questionTypes.find((t) => t.type_code === q.question_type)?.type_name || q.question_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${q.difficulty_level === 'Nhận biết'
                        ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                        : q.difficulty_level === 'Vận dụng'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : q.difficulty_level === 'Vận dụng cao'
                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}>
                        {q.difficulty_level || 'Thông hiểu'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      {q.category_name || `Category #${q.category_ids}`}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenPreview(q)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                          title="Xem trước"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(q)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(q.id)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/50 transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          hasMore={questions.length >= pageSize}
        />
      </div>

      {/* Add / Edit Question Modal */}
      <Modal
        isOpen={isAddOpen || isEditOpen}
        onClose={() => {
          setIsAddOpen(false);
          setIsEditOpen(false);
        }}
        title={isAddOpen ? 'Tạo câu hỏi mới' : 'Chỉnh sửa câu hỏi'}
        maxWidth="4xl"
      >
        <form onSubmit={isAddOpen ? handleAddSubmit : handleEditSubmit} className="space-y-5">
          {formError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-100 dark:border-rose-900/50">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Danh mục
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Loại câu hỏi
              </label>
              <select
                value={formType}
                onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                {questionTypes.length > 0 ? (
                  questionTypes.map((t) => (
                    <option key={t.type_code} value={t.type_code}>
                      {t.type_name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Multiple Choice Single Answer">Trắc nghiệm một đáp án</option>
                    <option value="Multiple Choice Multiple Answers">Trắc nghiệm nhiều đáp án</option>
                    <option value="True / False">Đúng / Sai</option>
                    <option value="Short Answer">Trả lời ngắn / Điền từ</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Mức độ nhận thức
              </label>
              <select
                value={formDifficulty}
                onChange={(e) => setFormDifficulty(e.target.value as DifficultyLevel)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                <option value="Nhận biết">Nhận biết</option>
                <option value="Thông hiểu">Thông hiểu</option>
                <option value="Vận dụng">Vận dụng</option>
                <option value="Vận dụng cao">Vận dụng cao</option>
              </select>
            </div>
          </div>

          {/* Media Attachment Upload Section */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Upload className="h-4 w-4 text-indigo-600" />
                Đính kèm Hình ảnh hoặc File nghe (Audio)
              </label>
              {formMediaUrl && (
                <button
                  type="button"
                  onClick={() => { setFormMediaUrl(''); setFormMediaType(''); }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Gỡ file
                </button>
              )}
            </div>

            {formMediaUrl ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center gap-4">
                {isAudioMedia(formMediaUrl, formMediaType) ? (
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1.5">
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>Nghe thử file âm thanh:</span>
                    </div>
                    <audio controls src={formatMediaUrl(formMediaUrl)} className="w-full h-9" />
                  </div>
                ) : (
                  <img src={formatMediaUrl(formMediaUrl)} alt="Preview" className="h-16 w-auto rounded-lg object-contain border border-slate-100 dark:border-slate-800" />
                )}
                <span className="text-xs text-slate-500 font-mono truncate max-w-xs">{formMediaUrl}</span>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-900 transition-all">
                <Upload className="h-5 w-5 text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isUploading ? 'Đang tải file lên...' : 'Nhấn để chọn file Ảnh (.png, .jpg, .webp) hoặc File nghe (.mp3, .wav)'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">Dung lượng tối đa 25MB</span>
                <input type="file" accept="image/*,audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.png,.jpg,.jpeg,.webp" onChange={handleFileUpload} disabled={isUploading} className="hidden" />
              </label>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                Nội dung câu hỏi
              </label>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
              <TinyMceEditor
                value={formText}
                onChange={setFormText}
                height={260}
              />
            </div>
          </div>

          {/* Live Math Preview */}
          {formText && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-2">
                Xem trước nội dung hiển thị:
              </span>
              <MathRenderer content={formText} />
            </div>
          )}

          {/* Options for Multiple Choice and True/False */}
          {(formType === 'Multiple Choice Single Answer' ||
            formType === 'Multiple Choice Multiple Answers' ||
            formType === 'True / False') && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {formType === 'True / False' ? 'Chọn đáp án đúng (Đúng hoặc Sai):' : 'Các lựa chọn đáp án (Options)'}
                  </label>
                  {formType !== 'True / False' && (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-500"
                    >
                      <PlusCircle className="h-4 w-4" /> Thêm đáp án
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {formOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleScoreChange(idx, opt.score > 0 ? 0 : 1)}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all ${opt.score > 0
                          ? 'border-emerald-500 bg-emerald-500 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900'
                          }`}
                        title={opt.score > 0 ? 'Đáp án đúng' : 'Nhấn để đặt là đáp án đúng'}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>

                      <input
                        type="text"
                        required
                        value={opt.option}
                        readOnly={formType === 'True / False'}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Đáp án ${String.fromCharCode(65 + idx)}...`}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                      />

                      {formType !== 'True / False' && formOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <MinusCircle className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Short Answer: Accepted answers */}
          {formType === 'Short Answer' && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Đáp án chấp nhận (các phương án phân tách bởi dấu phẩy):
              </label>
              <input
                type="text"
                required
                value={formOptions[0]?.option || ''}
                onChange={(e) => handleOptionChange(0, e.target.value)}
                placeholder="Ví dụ: Hà Nội, ha noi, Hanoi..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          )}

          {/* Match / Ordering: Matching Pairs */}
          {(formType === 'Match / Ordering' ||
            String(formType) === '5' ||
            String(formType).toLowerCase().includes('match') ||
            String(formType).toLowerCase().includes('nối')) && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Cấu hình các cặp nối (Vế A <span className="text-indigo-600">ghép với</span> Vế B)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Nhập nội dung tương ứng cho từng cặp. Khi làm bài, hệ thống sẽ hiển thị vế A và xáo trộn vế B để ghép cặp.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOptions([...formOptions, { option: ' ::: ', score: 1 }])}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 transition-colors cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" /> Thêm cặp nối
                </button>
              </div>

              <div className="space-y-2.5">
                {formOptions.map((opt, idx) => {
                  const pair = parseMatchPair(opt.option);
                  return (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/60 dark:bg-slate-900/60"
                    >
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">Cặp {idx + 1}:</span>
                      </div>

                      {/* Left Item */}
                      <input
                        type="text"
                        required
                        value={pair.left}
                        onChange={(e) => handleMatchLeftChange(idx, e.target.value)}
                        placeholder="Vế A (Câu hỏi / Khóa nối)..."
                        className="flex-1 rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />

                      {/* Matching Arrow */}
                      <div className="flex items-center justify-center text-indigo-600 dark:text-indigo-400 px-1 shrink-0">
                        <ArrowRightLeft className="h-4 w-4" />
                      </div>

                      {/* Right Item */}
                      <input
                        type="text"
                        required
                        value={pair.right}
                        onChange={(e) => handleMatchRightChange(idx, e.target.value)}
                        placeholder="Vế B (Đáp án tương ứng)..."
                        className="flex-1 rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />

                      {/* Remove Button */}
                      {formOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="self-center p-1.5 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                          title="Xóa cặp nối này"
                        >
                          <MinusCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
              {isAddOpen ? 'Tạo câu hỏi' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={previewQuestion !== null}
        onClose={() => setPreviewQuestion(null)}
        title="Xem trước câu hỏi"
        maxWidth="2xl"
      >
        {previewQuestion && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {previewQuestion.question_type_name || questionTypes.find((t) => t.type_code === previewQuestion.question_type)?.type_name || previewQuestion.question_type}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Mức độ: {previewQuestion.difficulty_level || 'Thông hiểu'}
              </span>
              <span className="text-xs text-slate-400">
                Danh mục: {previewQuestion.category_name}
              </span>
            </div>

            {/* Media if present */}
            {previewQuestion.media_url && (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950/40">
                {isAudioMedia(previewQuestion.media_url, previewQuestion.media_type) ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <Volume2 className="h-4 w-4" />
                      <span>Tài liệu nghe:</span>
                    </div>
                    <audio controls src={formatMediaUrl(previewQuestion.media_url)} className="w-full h-10" />
                  </div>
                ) : (
                  <img src={formatMediaUrl(previewQuestion.media_url)} alt="Media" className="max-h-72 w-auto mx-auto rounded-lg object-contain" />
                )}
              </div>
            )}

            <div className="rounded-xl border border-slate-200/80 p-4 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Nội dung câu hỏi:</div>
              <MathRenderer content={previewQuestion.question} />
            </div>

            {/* Answer Options */}
            {previewQuestion.question_type === 'Match / Ordering' ||
            String(previewQuestion.question_type) === '5' ||
            String(previewQuestion.question_type).toLowerCase().includes('match') ||
            String(previewQuestion.question_type).toLowerCase().includes('nối') ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Các cặp ghép nối đúng ({previewQuestion.options?.length || 0} cặp):
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {previewQuestion.options && previewQuestion.options.length > 0 ? (
                    previewQuestion.options.map((opt, idx) => {
                      const pair = parseMatchPair(opt.question_option);
                      return (
                        <div
                          key={opt.id || idx}
                          className="flex items-center gap-3 rounded-xl border border-indigo-200/80 bg-indigo-50/40 dark:border-indigo-900/60 dark:bg-indigo-950/30 p-3 text-xs"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <div className="flex-1 font-semibold text-slate-800 dark:text-slate-200">
                            <MathRenderer content={pair.left || opt.question_option} />
                          </div>
                          <ArrowRightLeft className="h-4 w-4 text-indigo-500 shrink-0" />
                          <div className="flex-1 font-semibold text-emerald-700 dark:text-emerald-400">
                            <MathRenderer content={pair.right || '(Chưa có vế tương ứng)'} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                      Chưa có cặp nối nào được thiết lập.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {previewQuestion.question_type === 'Short Answer'
                      ? 'Đáp án được chấp nhận'
                      : 'Các lựa chọn trả lời'}
                  </span>
                  {previewQuestion.options && previewQuestion.options.length > 0 && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {previewQuestion.options.length} lựa chọn
                    </span>
                  )}
                </div>

                {previewQuestion.options && previewQuestion.options.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2.5">
                    {previewQuestion.options.map((opt, idx) => {
                      const isCorrect = (opt.score || 0) > 0;
                      return (
                        <div
                          key={opt.id || idx}
                          className={`flex items-start gap-3 rounded-xl p-3 border transition-all ${isCorrect
                            ? 'border-emerald-300/90 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-200'
                            : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300'
                            }`}
                        >
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isCorrect
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </div>

                          <div className="flex-1 text-sm pt-0.5 leading-relaxed overflow-x-auto">
                            <MathRenderer content={opt.question_option} />
                          </div>

                          {isCorrect && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-xs font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                    Câu hỏi này chưa có danh sách đáp án hoặc là dạng câu hỏi tự luận.
                  </div>
                )}
              </div>
            )}

            {/* Explanation / Description if present */}
            {previewQuestion.description && previewQuestion.description.trim() !== '' && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1">
                  Lời giải / Giải thích:
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <MathRenderer content={previewQuestion.description} />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewQuestion(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng câu hỏi?"
      />
    </div>
  );
};
