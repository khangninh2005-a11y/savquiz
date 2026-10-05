import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  FileQuestion,
  Lock,
  ShieldAlert,
  Maximize,
  Minimize,
  Volume2,
  Key,
  ArrowRightLeft,
} from 'lucide-react';
import { quizApi } from '../../api/quizApi';
import { MathRenderer } from '../../components/Math/MathRenderer';
import { ConfirmModal } from '../../components/Common/ConfirmModal';
import { Modal } from '../../components/Common/Modal';
import { formatMediaUrl, isAudioMedia, parseMatchPair, deterministicShuffle } from '../../utils/media';

interface AttemptQuestion {
  question: {
    id: number;
    question_type: string;
    question: string;
    category_ids: number;
    difficulty_level?: string;
    media_url?: string;
    media_type?: string;
  };
  options?: {
    id: number;
    question_id: number;
    question_option: string;
  }[];
  user_response: any;
}

export const QuizAttemptPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Password Protection State
  const [requirePassword, setRequirePassword] = useState(false);
  const [quizPasswordInput, setQuizPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Anti-cheating & Integrity Monitor
  const [antiCheating, setAntiCheating] = useState(false);
  const [maxTabSwitches, setMaxTabSwitches] = useState(3);
  const [tabSwitchesCount, setTabSwitchesCount] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [rid, setRid] = useState<number | null>(null);
  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Status mapping: index -> 'notvisited' | 'notanswered' | 'answered' | 'reviewlater'
  const [questionStatus, setQuestionStatus] = useState<string[]>([]);
  // Responses mapping: questionId -> array of selected option ids or string text
  const [answers, setAnswers] = useState<Record<number, any>>({});

  // Countdown Timer
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Submit Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initAttempt = useCallback(async (pass?: string) => {
    if (!quizId) return;
    setLoading(true);
    setError('');
    setPasswordError('');
    try {
      // Step 1: Validate / Start attempt
      const valRes = await quizApi.validateQuiz(quizId, pass);
      if (valRes.require_password && valRes.status !== 'success') {
        setRequirePassword(true);
        if (pass) {
          setPasswordError(valRes.message || 'Mật khẩu không chính xác');
        }
        setLoading(false);
        return;
      }

      if (valRes.status !== 'success') {
        setError(valRes.message || 'Không thể bắt đầu bài thi.');
        setLoading(false);
        return;
      }

      // Password passed or not required
      setRequirePassword(false);

      if (valRes.anti_cheating) {
        setAntiCheating(true);
        setMaxTabSwitches(Number(valRes.max_tab_switches) || 3);
      }

      const resultId = valRes.rid || valRes.data?.id;
      setRid(resultId);

      // Calculate countdown timer
      const maxTime = valRes.maximum_datetime || Date.now() + 60 * 60 * 1000;
      const diffSeconds = Math.max(0, Math.floor((maxTime - Date.now()) / 1000));
      setTimeLeft(diffSeconds);

      const assignedQids = valRes.data?.assigned_qids;
      const uid = valRes.data?.uid;
      const respTime = valRes.data?.response_time;
      const colorCodes = (valRes.data?.color_codes || '').split(',');

      // Step 2: Get questions
      const qRes = await quizApi.getQuestions({
        quid: quizId,
        rid: resultId,
        uid,
        assigned_qids: assignedQids,
        response_time: respTime,
      });

      if (qRes.status === 'success' && qRes.data) {
        const qList: AttemptQuestion[] = qRes.data;
        setQuestions(qList);

        // Populate initial answers and status
        const initialAnswers: Record<number, any> = {};
        const initialStatus: string[] = [];

        qList.forEach((q, idx) => {
          if (q.user_response) {
            initialAnswers[q.question.id] = q.user_response;
          }
          initialStatus[idx] = colorCodes[idx] || 'notvisited';
        });

        // Mark current question as active/notanswered if notvisited
        if (initialStatus[0] === 'notvisited') {
          initialStatus[0] = 'notanswered';
        }

        setAnswers(initialAnswers);
        setQuestionStatus(initialStatus);
      } else {
        setError(qRes.message || 'Không có câu hỏi nào trong đề thi.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải bài thi.');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    initAttempt();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [initAttempt]);

  const handleAutoSubmit = useCallback(async (reason = 'System') => {
    if (!rid) return;
    try {
      await quizApi.submitQuiz(rid, reason);
      navigate(`/results/detail/${rid}`);
    } catch {
      navigate('/results');
    }
  }, [rid, navigate]);

  // Anti-cheating listeners (tab switch, window blur, window minimize)
  useEffect(() => {
    if (!antiCheating || !rid || isSubmitting) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const recordViolation = async () => {
      try {
        const res = await quizApi.logEvent({ rid, event: 'tab_switch' });
        if (res.status === 'success' && res.data) {
          const violations = res.data.violations;
          setTabSwitchesCount(violations);
          setShowViolationModal(true);

          if (res.data.should_terminate || violations >= maxTabSwitches) {
            handleAutoSubmit('CheatingViolation');
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(recordViolation, 300);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [antiCheating, rid, maxTabSwitches, isSubmitting, handleAutoSubmit]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, handleAutoSubmit]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (qid: number, optId: number, isMulti: boolean) => {
    const updated = { ...answers };
    if (isMulti) {
      const current = Array.isArray(updated[qid]) ? [...updated[qid]] : [];
      const optStr = String(optId);
      if (current.includes(optStr)) {
        updated[qid] = current.filter((id) => id !== optStr);
      } else {
        updated[qid] = [...current, optStr];
      }
    } else {
      updated[qid] = [String(optId)];
    }
    setAnswers(updated);

    // Update status to answered
    const nextStatus = [...questionStatus];
    nextStatus[currentIndex] = 'answered';
    setQuestionStatus(nextStatus);

    saveAnswerToBackend(qid, updated[qid]);
  };

  const handleTextAnswer = (qid: number, text: string) => {
    const updated = { ...answers, [qid]: text };
    setAnswers(updated);

    const nextStatus = [...questionStatus];
    nextStatus[currentIndex] = text.trim() ? 'answered' : 'notanswered';
    setQuestionStatus(nextStatus);

    saveAnswerToBackend(qid, text);
  };

  const saveAnswerToBackend = async (qid: number, responseVal: any) => {
    if (!rid || !quizId) return;
    try {
      const respStr = Array.isArray(responseVal)
        ? responseVal.join(',')
        : String(responseVal ?? '');

      await quizApi.saveAnswer({
        quid: quizId,
        rid,
        question_id: qid,
        qid,
        user_response: respStr,
        color_codes_p: questionStatus.join(','),
      });
    } catch (e) {
      console.error('Failed to auto-save answer:', e);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      const nextStatus = [...questionStatus];
      if (nextStatus[nextIdx] === 'notvisited') {
        nextStatus[nextIdx] = 'notanswered';
        setQuestionStatus(nextStatus);
      }
      setCurrentIndex(nextIdx);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleMarkReview = () => {
    const nextStatus = [...questionStatus];
    nextStatus[currentIndex] =
      nextStatus[currentIndex] === 'reviewlater' ? 'answered' : 'reviewlater';
    setQuestionStatus(nextStatus);
  };

  const handleJumpToQuestion = (index: number) => {
    const nextStatus = [...questionStatus];
    if (nextStatus[index] === 'notvisited') {
      nextStatus[index] = 'notanswered';
      setQuestionStatus(nextStatus);
    }
    setCurrentIndex(index);
  };

  const handleSubmitQuiz = async () => {
    if (!rid) return;
    setIsSubmitting(true);
    try {
      // 1. Ensure all answers currently in state are saved to sq_answer
      const savePromises = Object.entries(answers).map(([qIdStr, val]) => {
        const respStr = Array.isArray(val) ? val.join(',') : String(val ?? '');
        return quizApi.saveAnswer({
          quid: quizId!,
          rid,
          question_id: Number(qIdStr),
          qid: Number(qIdStr),
          user_response: respStr,
        });
      });
      await Promise.all(savePromises);

      // 2. Submit quiz with full answers dictionary for 100% guarantee
      await quizApi.submitQuiz(rid, 'User', { answers });
      setIsSubmitModalOpen(false);
      navigate(`/results/detail/${rid}`);
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Đang chuẩn bị đề thi và câu hỏi...</p>
      </div>
    );
  }

  // Password Required Prompt
  if (requirePassword) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 mt-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 mb-5">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Yêu cầu Mật khẩu phòng thi</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">
          Đề thi này được bảo mật bằng mã PIN. Vui lòng nhập mật khẩu do giám thị / giảng viên cung cấp để bắt đầu.
        </p>

        {passwordError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            initAttempt(quizPasswordInput);
          }}
          className="space-y-4"
        >
          <div className="relative">
            <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="password"
              required
              autoFocus
              placeholder="Nhập mã PIN / Mật khẩu bài thi"
              value={quizPasswordInput}
              onChange={(e) => setQuizPasswordInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/quizzes')}
              className="flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition-all"
            >
              Vào làm bài
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <AlertTriangle className="mx-auto h-12 w-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Không thể tham gia</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{error || 'Không tìm thấy câu hỏi nào.'}</p>
        <button
          onClick={() => navigate('/quizzes')}
          className="mt-6 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
        >
          Quay lại danh sách bài thi
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isMulti = currentQ.question.question_type === 'Multiple Choice Multiple Answers';
  const currentResp = answers[currentQ.question.id];

  return (
    <div
      className={`space-y-6 ${antiCheating ? 'select-none' : ''}`}
      onContextMenu={(e) => antiCheating && e.preventDefault()}
      onCopy={(e) => antiCheating && e.preventDefault()}
    >
      {/* Top Exam Status Bar */}
      <div className="sticky top-20 z-30 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/95 p-4 shadow-md backdrop-blur-md border border-slate-200/80 dark:bg-slate-900/95 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-bold font-mono">
            Q{currentIndex + 1}
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Đề thi #{quizId}
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Câu hỏi {currentIndex + 1} / {questions.length}
            </div>
          </div>
        </div>

        {/* Live Status: Anti-cheat, Fullscreen, Timer, Submit */}
        <div className="flex flex-wrap items-center gap-3">
          {antiCheating && (
            <div className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
              <ShieldAlert className="h-4 w-4" />
              <span>Giám sát: {tabSwitchesCount}/{maxTabSwitches} vi phạm</span>
            </div>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            title="Bật / tắt toàn màn hình"
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            <span>{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>

          <div
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 font-mono text-base font-bold shadow-xs transition-colors ${
              timeLeft < 300
                ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse dark:bg-rose-950/60 dark:border-rose-900'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900/50'
            }`}
          >
            <Clock className="h-5 w-5" />
            <span>{formatTime(timeLeft)}</span>
          </div>

          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 transition-all"
          >
            <Send className="h-4 w-4" /> Nộp bài
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Question Area (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {currentQ.question.question_type}
                </span>
                {currentQ.question.difficulty_level && (
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      currentQ.question.difficulty_level === 'Nhận biết'
                        ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                        : currentQ.question.difficulty_level === 'Thông hiểu'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : currentQ.question.difficulty_level === 'Vận dụng'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                    }`}
                  >
                    {currentQ.question.difficulty_level}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleMarkReview}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  questionStatus[currentIndex] === 'reviewlater'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Bookmark className="h-4 w-4" /> Đánh dấu xem lại
              </button>
            </div>

            {/* Media: Image or Audio Listening */}
            {currentQ.question.media_url && (
              <div className="mb-5">
                {isAudioMedia(currentQ.question.media_url, currentQ.question.media_type) ? (
                  <div className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <Volume2 className="h-4 w-4" />
                      <span>Tài liệu nghe:</span>
                    </div>
                    <audio
                      controls
                      src={formatMediaUrl(currentQ.question.media_url)}
                      className="w-full h-10"
                    />
                  </div>
                ) : (
                  <div className="flex justify-center p-3 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800">
                    <img
                      src={formatMediaUrl(currentQ.question.media_url)}
                      alt="Hình ảnh câu hỏi"
                      className="max-h-72 object-contain rounded-xl"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Question Content */}
            <div className="text-base sm:text-lg text-slate-900 dark:text-white leading-relaxed">
              <MathRenderer content={currentQ.question.question} />
            </div>

            {/* Options / Answer Input */}
            <div className="mt-8 space-y-3">
              {(() => {
                const isMatchQ =
                  currentQ.question.question_type === 'Match / Ordering' ||
                  String(currentQ.question.question_type) === '5' ||
                  String(currentQ.question.question_type).toLowerCase().includes('match') ||
                  String(currentQ.question.question_type).toLowerCase().includes('nối');

                if (isMatchQ) {
                  const pairs = (currentQ.options || []).map((opt) => parseMatchPair(opt.question_option));
                  const rawRightChoices = Array.from(new Set(pairs.map((p) => p.right).filter(Boolean)));
                  const rightChoices = deterministicShuffle(rawRightChoices, Number(currentQ.question.id) || 1);

                  let userMatchMap: Record<string, string> = {};
                  if (typeof currentResp === 'string' && currentResp.trim()) {
                    if (currentResp.startsWith('{') && currentResp.endsWith('}')) {
                      try {
                        userMatchMap = JSON.parse(currentResp);
                      } catch {}
                    } else {
                      currentResp.split(',').forEach((item) => {
                        const sep = item.includes(':::') ? ':::' : item.includes('===') ? '===' : '->';
                        const parts = item.split(sep);
                        if (parts.length >= 2) {
                          userMatchMap[parts[0].trim()] = parts[1].trim();
                        }
                      });
                    }
                  }

                  const handleMatchSelect = (leftVal: string, chosenRight: string) => {
                    const updatedMap = { ...userMatchMap };
                    if (chosenRight) {
                      updatedMap[leftVal] = chosenRight;
                    } else {
                      delete updatedMap[leftVal];
                    }
                    const jsonStr = Object.keys(updatedMap).length > 0 ? JSON.stringify(updatedMap) : '';
                    handleTextAnswer(currentQ.question.id, jsonStr);
                  };

                  return (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 dark:border-indigo-950 dark:bg-indigo-950/30">
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                          Hướng dẫn: Hãy ghép nối từng mục ở Cột A với đáp án chính xác tương ứng ở Cột B.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {pairs.map((pair, pIdx) => {
                          const selectedVal = userMatchMap[pair.left] || '';

                          // Tìm các đáp án đã được chọn bởi các dòng khác
                          const chosenByOtherRows = new Set(
                            Object.entries(userMatchMap)
                              .filter(([leftKey, rightVal]) => leftKey !== pair.left && Boolean(rightVal))
                              .map(([_, rightVal]) => rightVal)
                          );

                          // Loại các đáp án đã được chọn ở dòng khác ra khỏi danh sách
                          const availableChoices = rightChoices.filter(
                            (choice) => !chosenByOtherRows.has(choice)
                          );

                          return (
                            <div
                              key={pIdx}
                              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-2xl border border-slate-200/80 p-3.5 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs"
                            >
                              <div className="flex items-center gap-2 sm:w-1/2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold">
                                  {pIdx + 1}
                                </span>
                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                  <MathRenderer content={pair.left} />
                                </div>
                              </div>

                              <div className="hidden sm:flex items-center justify-center text-slate-400">
                                <ArrowRightLeft className="h-4 w-4" />
                              </div>

                              <div className="flex-1 sm:w-1/2">
                                <select
                                  value={selectedVal}
                                  onChange={(e) => handleMatchSelect(pair.left, e.target.value)}
                                  className={`w-full rounded-xl border py-2.5 px-3 text-xs font-medium transition-all ${
                                    selectedVal
                                      ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200 font-semibold'
                                      : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                                  }`}
                                >
                                  <option value="">-- Chọn đáp án ghép nối --</option>
                                  {availableChoices.map((choice, cIdx) => (
                                    <option key={cIdx} value={choice}>
                                      {choice}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (currentQ.options && currentQ.options.length > 0) {
                  return currentQ.options.map((opt, idx) => {
                    const isChecked = Array.isArray(currentResp) && currentResp.includes(String(opt.id));
                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectOption(currentQ.question.id, opt.id, isMulti)}
                        className={`flex items-start gap-3 rounded-2xl p-4 cursor-pointer border transition-all duration-150 ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-50/70 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/40'
                            : 'border-slate-200/80 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center ${
                            isMulti ? 'rounded-md' : 'rounded-full'
                          } border mt-0.5 text-xs font-bold transition-all ${
                            isChecked
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800'
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <div className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                          <MathRenderer content={opt.question_option} />
                        </div>
                      </div>
                    );
                  });
                }

                return (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                      Nhập câu trả lời của bạn:
                    </label>
                    <textarea
                      rows={4}
                      value={typeof currentResp === 'string' ? currentResp : ''}
                      onChange={(e) => handleTextAnswer(currentQ.question.id, e.target.value)}
                      placeholder="Gõ đáp án vào đây..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                );
              })()}
            </div>

            {/* Navigation Bottom Buttons */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentIndex <= 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" /> Câu trước
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={currentIndex >= questions.length - 1}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-500 disabled:opacity-40"
              >
                Lưu & Tiếp theo <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Question Matrix (1 col) */}
        <div className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-indigo-600" />
              Bảng câu hỏi
            </h3>

            {/* Grid of question buttons */}
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, idx) => {
                const status = questionStatus[idx] || 'notvisited';
                const isCurrent = idx === currentIndex;

                const statusStyles: Record<string, string> = {
                  notvisited: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                  notanswered: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300',
                  answered: 'bg-emerald-500 text-white font-bold shadow-xs',
                  reviewlater: 'bg-amber-400 text-white font-bold shadow-xs',
                };

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleJumpToQuestion(idx)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-mono font-bold transition-all ${
                      statusStyles[status] || statusStyles.notvisited
                    } ${isCurrent ? 'ring-3 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 scale-105' : ''}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-md bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-400">Đã trả lời</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-md bg-rose-100 border border-rose-300 dark:bg-rose-950" />
                <span className="text-slate-600 dark:text-slate-400">Chưa trả lời</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-md bg-amber-400" />
                <span className="text-slate-600 dark:text-slate-400">Đánh dấu xem lại</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-md bg-slate-100 dark:bg-slate-800" />
                <span className="text-slate-600 dark:text-slate-400">Chưa xem</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Anti-cheating Tab-Switch Violation Warning Modal */}
      <Modal
        isOpen={showViolationModal}
        onClose={() => setShowViolationModal(false)}
        title="Cảnh báo Vi phạm Quy chế Thi!"
        maxWidth="md"
      >
        <div className="text-center space-y-4 py-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Phát hiện rời màn hình làm bài / Chuyển Tab!
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Hệ thống giám sát thi cử (Exam Integrity Monitor) đã phát hiện bạn vừa rời khỏi màn hình bài thi.
            </p>
          </div>

          <div className="rounded-2xl bg-rose-50 p-4 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-900 text-xs">
            <span className="text-slate-500 dark:text-slate-400 block mb-1">Số lần vi phạm đã ghi nhận:</span>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">
              {tabSwitchesCount} / {maxTabSwitches} lần
            </div>
            <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-300 font-medium">
              Lưu ý: Nếu số lần vi phạm đạt mức {maxTabSwitches} lần, bài thi sẽ bị tự động thu hồi và nộp ngay lập tức!
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowViolationModal(false)}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-500"
          >
            Tôi đã hiểu, quay lại làm bài
          </button>
        </div>
      </Modal>

      {/* Submit Confirmation Modal */}
      <ConfirmModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={handleSubmitQuiz}
        title="Xác nhận nộp bài thi"
        message="Bạn có chắc chắn muốn nộp bài thi ngay bây giờ? Sau khi nộp, bạn sẽ không thể thay đổi đáp án nữa."
        confirmText="Nộp bài ngay"
        isDanger={false}
        loading={isSubmitting}
      />
    </div>
  );
};
